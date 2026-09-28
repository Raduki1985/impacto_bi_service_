import * as Dialog from '@radix-ui/react-dialog'
import {Check, Edit, KeyRound, Mail, MailPlus, Plus, Power, X} from 'lucide-react'
import type {InputHTMLAttributes, ReactNode} from 'react'
import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react'

import {DataTable} from '../../components/dashboard/DataTable'
import {Button} from '../../components/ui/button'
import {SessionToast} from '../../components/ui/SessionToast'
import type {User} from '../../data/dashboardTypes'
import {
    activateUser,
    changeUserPassword,
    createUser,
    deactivateUser,
    type FirstAccessPasswordFailureReason,
    type FirstAccessResendFailureReason,
    loadUsers,
    resendFirstAccess,
    setUserPassword,
    updateUserDetails,
    type UserCreateFailureReason,
    type UserDetailsUpdateFailureReason,
    type UserFormInput,
    type UserPasswordChangeFailureReason,
    type UserStatusChangeFailureReason,
} from '../../services/users/userRepository'
import {loadUserFormCatalog, type UserFormCatalog} from '../../services/users/userApi'
import type {SystemProfileOption} from '../../services/users/userApiMapper'
import {ADMIN_USERS_WRITE_PERMISSION} from '../../config/permissions'
import {useAuth} from '../../contexts/useAuth'
import {
    firstAccessInviteState,
    type FirstAccessInviteState,
    formatInviteDeadline,
    hasDefinedPassword,
} from '../../lib/firstAccessInvite'
import {isPasswordAccepted, passwordRequirements} from '../../lib/passwordPolicy'
import {profileColorClasses} from '../../lib/profileColors'
import {userStatusColorClasses} from '../../lib/userStatusColors'
import {isValidUserEmail} from '../../lib/userEmail'
import type {AccessProfile} from '../../types/access'
// Superfície e overlay do modal central vêm das peças visuais dos Perfis de
// acesso, e não de uma segunda cópia dos mesmos valores: o padrão do portal é
// uma classe compartilhada, e dois conjuntos de literais para a mesma aparência
// divergiriam na primeira alteração. Só o traço do modal é reaproveitado; o
// modelo de apresentação daquela página continua fora daqui.
import {modalOverlayClass, modalShellClass, RequiredMark,} from '../AccessProfilesPreview/accessProfilesUi'
import {CoverageTooltipProvider} from '../AccessProfilesPreview/CoverageTooltipProvider'
import {DepartmentCoverageChip} from '../AccessProfilesPreview/DepartmentCoverageChip'
import {
    accessProfileDraftFor,
    type AccessProfileOption,
    accessProfileOptionsFor,
    type AccessProfileSelectionFailureReason,
    checkAccessProfileSelection,
    findAccessProfileOption,
    initialAccessProfileId,
    initialProfileSystemId,
    UNPROFILED_ACCESS_LABEL,
    userAccessProfileLabel,
} from './userAccessProfiles'

/** Quantidade fixa de usuários por página. */
const PAGE_SIZE = 10

/** Só Anterior e Próxima: mantêm o cursor de mão enquanto desabilitados, sem
 mexer no Button global e sem perder a semântica do atributo disabled. */
const PAGINATION_DISABLED_CLASSES =
    'disabled:pointer-events-auto disabled:cursor-pointer disabled:hover:bg-white'

const lastAccessPattern = /^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2}$/
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {weekday: 'long'})

/**
 * Dia da semana de um "dd/MM/yyyy HH:mm" apenas para o tooltip; o texto
 * visível continua o valor original. O parse é manual e monta a data com
 * componentes locais: new Date(string) não entende esse formato e qualquer
 * caminho via UTC deslocaria o dia. Retorna null quando não dá para
 * interpretar, para não exibir um tooltip errado.
 */
function weekdayFromLastAccess(value: string): string | null {
    const parts = lastAccessPattern.exec(value)
    if (!parts) return null

    const [, day, month, year] = parts.map(Number)
    const date = new Date(year, month - 1, day)

    // Rejeita datas que "transbordam", como 32/01 virando 01/02.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null
    }

    const weekday = weekdayFormatter.format(date)

    return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

type UserFeedback = {
    type: 'success' | 'error'
    message: string
}

/**
 * A interface só traduz o motivo; a regra vive no repositório.
 *
 * As recusas do SERVIÇO não passam por estas tabelas: elas chegam com a frase
 * pronta (`reason: 'service-failure'`) e são exibidas como vieram.
 */
const statusChangeFailureMessages: Record<UserStatusChangeFailureReason, string> = {
    'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
    'self-deactivation': 'Você não pode desativar o próprio usuário.',
    'last-active-administrator': 'O último administrador ativo não pode ser desativado.',
    'pending-first-access':
        'Este usuário ainda não definiu a senha. Resolva o primeiro acesso: a conta só pode ser ativada ou desativada depois de ter senha.',
}

/**
 * Recusas do reenvio do convite de primeiro acesso.
 *
 * As duas últimas descrevem uma corrida: o botão da tabela olha o estado da
 * última leitura, e entre ele e o clique a pessoa pode ter definido a senha ou
 * outro administrador pode ter reenviado o convite. O repositório confere de
 * novo contra a lista recém-lida e recusa aqui, com uma frase que diz o que
 * mudou.
 */
const firstAccessPasswordFailureMessages: Record<FirstAccessPasswordFailureReason, string> = {
    'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
    'already-active':
        'Este usuário já definiu a senha. Se ele a esqueceu, use a recuperação de senha na tela de entrada.',
    'weak-password': 'A senha não atende às exigências listadas abaixo do campo.',
}

/**
 * O que a tela diz quando a troca de senha não vai adiante.
 *
 * `refused` fica de fora de propósito: ali quem recusou foi o serviço, e é a
 * frase DELE que aparece, porque só ele sabe se a senha atual não confere ou se
 * a conta ainda não tem senha nenhuma.
 */
const passwordChangeFailureMessages: Record<
    Exclude<UserPasswordChangeFailureReason, 'refused'>,
    string
> = {
    'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
    'weak-password': 'A senha nova não atende às exigências listadas acima.',
}

const firstAccessResendFailureMessages: Record<FirstAccessResendFailureReason, string> = {
    'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
    'already-active': 'Este usuário já definiu a senha e não precisa de um novo primeiro acesso.',
    'invite-still-valid':
        'O link de primeiro acesso atual ainda está no prazo. Aguarde ele expirar para enviar outro.',
}

/**
 * Intervalo de reavaliação do prazo do convite, em milissegundos.
 *
 * Sem ele, um botão desabilitado continuaria desabilitado até alguém recarregar
 * a página, porque o prazo é comparado com o relógio no momento da renderização.
 * Meio minuto é folgado diante dos dez minutos do link e não pesa: o relógio só
 * corre enquanto existe algum convite no prazo na página aberta, e para sozinho
 * quando o último vence.
 */
const INVITE_TICK_MS = 30_000

/**
 * Relógio que só corre enquanto há prazo a vencer na página aberta.
 *
 * Ele se desliga sozinho: quando o último convite pendente expira, o próprio
 * avanço do relógio torna `pending` falso, o efeito é limpo e nenhum novo
 * intervalo é agendado. Numa página só de usuários ativos ele nunca chega a
 * ligar.
 */
function useInviteClock(users: readonly User[]): Date {
    const [now, setNow] = useState(() => new Date())

    const pending = users.some((user) => firstAccessInviteState(user, now) === 'pending')

    useEffect(() => {
        if (!pending) return

        const timer = setInterval(() => setNow(new Date()), INVITE_TICK_MS)

        return () => clearInterval(timer)
    }, [pending])

    return now
}

/**
 * Recusas da escolha de Perfil do Sistema e Perfil de Acesso, compartilhadas
 * pela criação e pela edição.
 *
 * Cada uma pede uma correção diferente, e por isso nenhuma delas é dobrada na
 * outra: tipo que sumiu do serviço, escolha que falta, perfil que não existe
 * mais e catálogo que não pôde ser lido.
 *
 * `incompatible-access-profile` era a quinta, e saiu: um Perfil de Acesso não
 * pertence mais a um Perfil do Sistema, então não existe par incompatível.
 */
const accessProfileFailureMessages = {
    'unknown-system-profile':
        'O Perfil do Sistema selecionado não existe mais no serviço. Atualize a página e tente novamente.',
    'access-profile-required': 'Selecione um Perfil de Acesso para este usuário.',
    'unknown-access-profile':
        'O Perfil de Acesso selecionado não existe mais. Escolha um dos perfis disponíveis.',
    'access-profile-unavailable':
        'Não foi possível ler os Perfis de Acesso no serviço. Atualize a página e tente novamente.',
} as const

const detailsUpdateFailureMessages: Record<UserDetailsUpdateFailureReason, string> = {
    'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
    'invalid-name': 'Informe o nome completo do usuário.',
    'invalid-email': 'Informe um e-mail válido.',
    'email-taken': 'Este e-mail já está em uso por outro usuário.',
    'self-access-change':
        'Você não pode alterar o próprio Perfil do Sistema nem o próprio Perfil de Acesso.',
    'last-active-administrator': 'O último administrador ativo não pode perder esse perfil.',
    ...accessProfileFailureMessages,
}

/** Mesmas mensagens da edição nos motivos em comum: o formulário é o mesmo. */
const createFailureMessages: Record<UserCreateFailureReason, string> = {
    'invalid-name': 'Informe o nome completo do usuário.',
    'invalid-email': 'Informe um e-mail válido.',
    'email-taken': 'Este e-mail já está em uso por outro usuário.',
    ...accessProfileFailureMessages,
}

/**
 * Orientação da recusa que a própria página avalia, antes do repositório.
 *
 * `unknown` cobre de uma vez o perfil excluído, o desativado e o de outro
 * destino: os três deixam de estar entre as opções oferecidas, que já são o
 * recorte do domínio, e a saída é a mesma nos três casos.
 */
const accessProfileSelectionMessages: Record<AccessProfileSelectionFailureReason, string> = {
    required: 'Selecione um Perfil de Acesso para este usuário.',
    unknown:
        'O Perfil de Acesso deste usuário não está disponível: ele pode ter sido excluído, desativado ou destinado a outro Perfil do Sistema. Escolha um dos perfis oferecidos.',
    unavailable:
        'Não foi possível ler os Perfis de Acesso no serviço. Atualize a página e tente novamente.',
}

/**
 * Catálogos do formulário, lidos do serviço.
 *
 * `loading` é o intervalo entre a montagem e a resposta; `failed` é a resposta
 * que não veio, e nesse caso o formulário não tem escolha a oferecer e diz
 * isso. Os dois catálogos chegam juntos, de uma leitura só.
 */
type CatalogState = UserFormCatalog & { status: 'loading' | 'ready' | 'failed' }

const EMPTY_CATALOG: CatalogState = {status: 'loading', profileTypes: [], accessProfiles: []}

/** Drawer fechado (null), em criação ou em edição. */
type DrawerState = { mode: 'create' } | { mode: 'edit'; user: User }

/**
 * Transição de status escolhida no botão da linha e ainda não confirmada. A ação
 * é registrada junto do alvo, e não deduzida do status dele na hora de confirmar:
 * o diálogo descreve exatamente o que foi pedido, sem depender de reler a coleção.
 */
type PendingStatusChange = { user: User; action: 'deactivate' | 'reactivate' }


export function Users() {
    const {user: authenticatedUser, hasPermission} = useAuth()
    const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)
    /**
     * Lista do serviço, carregada na montagem e recarregada após cada alteração.
     *
     * Vazia até a primeira resposta chegar. Uma falha na carga aparece no mesmo
     * aviso das demais operações, e a tabela fica com o que tinha.
     */
    const [userList, setUserList] = useState<User[]>([])
    /**
     * Catálogos do formulário, lidos do serviço na montagem: os tipos de perfil
     * (`profile_types`) e os perfis de acesso (`access`).
     *
     * Esta página não cria, não edita e não desativa perfil nenhum: ela só precisa
     * saber quais existem para oferecer e para nomear o vínculo de cada usuário.
     */
    const [catalog, setCatalog] = useState<CatalogState>(EMPTY_CATALOG)
    const accessProfiles = catalog.accessProfiles
    const accessProfilesAvailable = catalog.status === 'ready'
    const [page, setPage] = useState(0)
    const [drawer, setDrawer] = useState<DrawerState | null>(null)
    /** Transição de status aguardando a confirmação do administrador. */
    const [statusTarget, setStatusTarget] = useState<PendingStatusChange | null>(null)
    /**
     * Faixa acima da tabela: recusas, e as confirmações que NÃO vieram do
     * formulário — ativação, desativação, senha e reenvio do primeiro acesso.
     *
     * Cadastro e edição bem sucedidos saíram daqui e viraram aviso flutuante: a
     * confirmação deles responde a um formulário que acabou de fechar, e a mesma
     * frase nos dois lugares seria a mesma notícia contada duas vezes.
     */
    const [feedback, setFeedback] = useState<UserFeedback | null>(null)
    /**
     * Aviso flutuante da última gravação do formulário, cadastro ou edição.
     *
     * Quem o desenha é esta página, e não o `Portal` das rotas: salvar um usuário
     * não troca de tela, então a página continua montada atrás do drawer que
     * fecha.
     */
    const [saveToast, setSaveToast] = useState<{ description: string; title: string } | null>(null)
    /**
     * Estável de propósito: o `SessionToast` conta os 5 segundos em um efeito que
     * depende desta função, e uma função nova a cada render reiniciaria a
     * contagem antes de ela terminar.
     */
    const dismissSaveToast = useCallback(() => setSaveToast(null), [])
    /**
     * Reenvio em andamento, pelo id do usuário.
     *
     * Guarda contra o segundo clique enquanto o serviço ainda não respondeu ao
     * primeiro: cada reenvio gera um token novo e mata o anterior, então dois
     * disparos seguidos deixariam viva só a segunda mensagem, e a pessoa poderia
     * abrir a primeira.
     */
    const [resendingUserId, setResendingUserId] = useState<string | null>(null)
    /** Usuário cujo primeiro acesso está sendo resolvido no diálogo. */
    const [firstAccessTarget, setFirstAccessTarget] = useState<User | null>(null)
    /** Usuário cuja senha está sendo trocada no diálogo. */
    const [passwordTarget, setPasswordTarget] = useState<User | null>(null)
    const activeCount = userList.filter((user) => user.status === 'Ativo').length
    const pendingCount = userList.filter((user) => user.status === 'Pendente').length
    // Por subtração, e não por um terceiro filtro: assim os três indicadores
    // somam o total em qualquer situação, inclusive nas que o serviço tem e o
    // portal lê como Inativo.
    const inactiveCount = userList.length - activeCount - pendingCount
    const administratorCount = userList.filter((user) => user.profile === 'Administrador').length
    const executiveCount = userList.filter((user) => user.profile === 'Executivo').length
    const analystCount = userList.filter((user) => user.profile === 'Analista').length
    const totalPages = Math.max(1, Math.ceil(userList.length / PAGE_SIZE))
    // Página derivada já dentro do intervalo válido: se a lista encolher no
    // futuro, o render corrige sozinho, sem setState em efeito.
    const safePage = Math.min(page, totalPages - 1)
    const pageUsers = useMemo(
        () => userList.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
        [safePage, userList],
    )
    // Instante usado para decidir quais convites de primeiro acesso já venceram.
    // Avança sozinho enquanto houver algum no prazo, para o botão de reenvio
    // liberar na hora certa sem depender de alguém recarregar a página.
    const now = useInviteClock(pageUsers)
    // Lista vazia mostra "0-0 de 0" sem quebrar a navegação (totalPages já é 1).
    const from = userList.length === 0 ? 0 : safePage * PAGE_SIZE + 1
    const to = Math.min(userList.length, safePage * PAGE_SIZE + PAGE_SIZE)
    const headers = canManageUsers
        ? ['Usuário', 'Perfil do Sistema', 'Perfil de Acesso', 'Status', 'Último acesso', 'Ações']
        : ['Usuário', 'Perfil do Sistema', 'Perfil de Acesso', 'Status', 'Último acesso']
    // Larguras fixas por coluna: sem elas o layout automático redistribui tudo a
    // cada página, porque depende do conteúdo das linhas renderizadas. A coluna
    // sem largura (Perfil de Acesso) absorve o restante, e as demais foram
    // reduzidas ao que o conteúdo delas realmente ocupa para sobrar espaço a
    // nomes longos como Acesso Operações Técnicas e Acesso Experiência do Cliente.
    // A coluna de Ações foi de 100px a 134px com o botão de primeiro acesso e
    // chegou a 170px com o de trocar a senha: são quatro alvos de 30px com 6px de
    // intervalo, mais o respiro lateral da célula. Os quatro aparecem em toda
    // linha. A folga sai da coluna sem largura (Perfil de Acesso), que é quem
    // absorve o restante por definição.
    const columnWidths = canManageUsers
        ? ['28%', '180px', undefined, '90px', '145px', '170px']
        : ['30%', '180px', undefined, '90px', '145px']

    /**
     * Relê a lista do serviço. Devolve a lista nova, ou null quando a leitura
     * falhou e o aviso já foi publicado.
     */
    async function refreshUsers(): Promise<User[] | null> {
        const result = await loadUsers()

        if (!result.ok) {
            setFeedback({type: 'error', message: result.message})
            return null
        }

        setUserList(result.users)

        return result.users
    }

    // Carga inicial da lista e dos catálogos, em paralelo. O StrictMode monta o
    // efeito duas vezes em desenvolvimento; a primeira resposta é descartada para
    // a segunda montagem não receber um estado que não é dela.
    useEffect(() => {
        let cancelled = false

        void loadUsers().then((result) => {
            if (cancelled) return

            if (result.ok) setUserList(result.users)
            else setFeedback({type: 'error', message: result.message})
        })

        void loadUserFormCatalog().then(
            (loaded) => {
                if (!cancelled) setCatalog({status: 'ready', ...loaded})
            },
            () => {
                if (!cancelled) setCatalog({...EMPTY_CATALOG, status: 'failed'})
            },
        )

        return () => {
            cancelled = true
        }
    }, [])

    /**
     * Persiste nome, e-mail, perfil e acessos em uma única chamada ao serviço.
     * Devolve a mensagem de erro para o drawer exibir junto ao formulário, ou
     * null no sucesso, quando a tabela é recarregada, o drawer fecha e o feedback
     * aparece na página.
     */
    async function saveUserEdit(userId: string, input: UserFormInput): Promise<string | null> {
        if (!authenticatedUser) {
            return 'Sessão não identificada. Entre novamente para gerenciar usuários.'
        }

        const result = await updateUserDetails(userId, input, {
            id: authenticatedUser.id,
            name: authenticatedUser.name,
        })

        if (!result.ok) {
            return result.reason === 'service-failure'
                ? result.message
                : detailsUpdateFailureMessages[result.reason]
        }

        if (result.changed) await refreshUsers()

        setDrawer(null)
        // Salvar sem ter mudado nada CONTINUA sendo dito, e com outro título: o
        // serviço aceitou, mas nada foi gravado, e anunciar uma atualização que
        // não houve seria a confirmação de um fato falso.
        setSaveToast(
            result.changed
                ? {
                    title: 'Usuário atualizado com sucesso',
                    description: `As alterações de ${result.user.name} foram gravadas.`,
                }
                : {
                    title: 'Nenhuma alteração a gravar',
                    description: `${result.user.name} já estava com estes dados.`,
                },
        )

        return null
    }

    /**
     * Cadastra o usuário com o perfil e os acessos escolhidos no drawer. Mesmo
     * contrato de `saveUserEdit`: devolve a mensagem de erro para o formulário, ou
     * null no sucesso, quando a tabela é recarregada, o drawer fecha e o feedback
     * aparece na página. Senha não faz parte do cadastro: o serviço envia à pessoa
     * o link de primeiro acesso, e é nele que ela define a própria.
     */
    async function saveUserCreate(input: UserFormInput): Promise<string | null> {
        if (!authenticatedUser) {
            return 'Sessão não identificada. Entre novamente para gerenciar usuários.'
        }

        const result = await createUser(input)

        if (!result.ok) {
            return result.reason === 'service-failure'
                ? result.message
                : createFailureMessages[result.reason]
        }

        // A tabela não tem ordenação e a lista vem na ordem de cadastro: a última
        // página da lista recarregada é onde o novo usuário está.
        const nextList = await refreshUsers()
        if (nextList) setPage(Math.max(0, Math.ceil(nextList.length / PAGE_SIZE) - 1))

        setDrawer(null)
        setSaveToast({
            title: 'Usuário cadastrado com sucesso',
            description: `${result.user.name} já está na lista de usuários.`,
        })

        return null
    }

    /** Executa a operação com o ator logado e converte o resultado em feedback. */
    async function runStatusChange(
        target: User,
        operation: typeof deactivateUser,
        messages: { done: string; already: string },
    ) {
        if (!authenticatedUser) {
            setFeedback({type: 'error', message: 'Sessão não identificada. Entre novamente para gerenciar usuários.'})
            return
        }

        const result = await operation(target.id, {
            id: authenticatedUser.id,
            name: authenticatedUser.name,
        })

        if (!result.ok) {
            setFeedback({
                type: 'error',
                message:
                    result.reason === 'service-failure'
                        ? result.message
                        : statusChangeFailureMessages[result.reason],
            })
            return
        }

        if (result.changed) await refreshUsers()

        setFeedback({
            type: 'success',
            message: `${result.user.name} ${result.changed ? messages.done : messages.already}`,
        })
    }

    /**
     * Reenvia o convite de primeiro acesso do usuário.
     *
     * A tabela é recarregada no sucesso porque é dela que sai a validade nova: o
     * botão volta a ficar desabilitado pelos próximos dez minutos, e não continua
     * liberado oferecendo um segundo reenvio em cima do e-mail que acabou de sair.
     */
    async function handleResendFirstAccess(target: User) {
        if (resendingUserId !== null) return

        setFeedback(null)
        setResendingUserId(target.id)

        let result: Awaited<ReturnType<typeof resendFirstAccess>>
        try {
            result = await resendFirstAccess(target.id)
        } finally {
            setResendingUserId(null)
        }

        if (!result.ok) {
            setFeedback({
                type: 'error',
                message:
                    result.reason === 'service-failure'
                        ? result.message
                        : firstAccessResendFailureMessages[result.reason],
            })
            // Mesmo na recusa a lista é relida: os dois motivos do portal significam
            // que a tabela está desatualizada, e é isso que precisa ser corrigido.
            if (result.reason !== 'service-failure') await refreshUsers()
            return
        }

        // Só a linha afetada é trocada, e pelo usuário que o repositório já releu
        // do serviço. Recarregar a lista inteira aqui seria a terceira leitura do
        // mesmo clique, e nenhuma outra linha mudou.
        setUserList((list) => list.map((item) => (item.id === result.user.id ? result.user : item)))
        setFeedback({
            type: 'success',
            message: `Novo link de primeiro acesso enviado para ${result.user.email}. Ele vale por 10 minutos.`,
        })
    }

    /** Abre o diálogo de primeiro acesso. O clique aqui não envia nada. */
    function handleFirstAccessClick(target: User) {
        setFeedback(null)
        setFirstAccessTarget(target)
    }

    /** Reenvia o convite a partir do diálogo, que fecha antes da chamada. */
    async function handleResendFromDialog() {
        const target = firstAccessTarget
        if (!target) return

        setFirstAccessTarget(null)
        await handleResendFirstAccess(target)
    }

    /**
     * Cadastra a senha que o administrador digitou no diálogo.
     *
     * Mesmo contrato dos formulários do drawer: devolve a mensagem de erro para
     * ser mostrada dentro do diálogo, ou null no sucesso, quando ele fecha e o
     * aviso aparece na página.
     */
    async function handleSaveFirstAccessPassword(password: string): Promise<string | null> {
        const target = firstAccessTarget
        if (!target) return firstAccessPasswordFailureMessages['not-found']

        const result = await setUserPassword(target.id, password)

        if (!result.ok) {
            if (result.reason === 'service-failure') return result.message

            return result.reason === 'weak-password' && result.message
                ? result.message
                : firstAccessPasswordFailureMessages[result.reason]
        }

        setUserList((list) => list.map((item) => (item.id === result.user.id ? result.user : item)))
        setFirstAccessTarget(null)
        setFeedback({
            type: 'success',
            message: `Senha cadastrada para ${result.user.name}. A conta está ativa, e ele já pode entrar no portal com ${result.user.email}.`,
        })

        return null
    }

    /** Abre o diálogo de troca de senha. O clique aqui não grava nada. */
    function handleChangePasswordClick(target: User) {
        setFeedback(null)
        setPasswordTarget(target)
    }

    /**
     * Troca a senha do usuário escolhido, confirmada pela senha de quem está
     * autenticado.
     *
     * Mesmo contrato dos demais formulários: devolve a mensagem de erro para ser
     * mostrada dentro do diálogo, ou null no sucesso, quando ele fecha e o aviso
     * aparece na página.
     *
     * A tabela não é recarregada: nenhuma coluna dela muda com a troca, e
     * nenhuma das duas senhas fica guardada no portal.
     */
    async function handleChangePassword(
        newPassword: string,
        authenticatedPassword: string,
    ): Promise<string | null> {
        const target = passwordTarget
        if (!target) return passwordChangeFailureMessages['not-found']

        const result = await changeUserPassword(target.id, {newPassword, authenticatedPassword})

        if (!result.ok) {
            if (result.reason === 'service-failure') return result.message

            // A recusa do serviço já vem como frase pronta: a senha digitada na
            // confirmação não é a do administrador, ou a conta ainda não definiu
            // senha nenhuma.
            if (result.reason === 'refused') {
                return result.message ?? 'Não foi possível trocar a senha. Confira a sua senha.'
            }

            return result.reason === 'weak-password' && result.message
                ? result.message
                : passwordChangeFailureMessages[result.reason]
        }

        setPasswordTarget(null)
        setFeedback({
            type: 'success',
            message: `Senha de ${target.name} trocada com sucesso. A senha anterior deixou de valer.`,
        })

        return null
    }

    function handleStatusButtonClick(target: User) {
        setFeedback(null)

        // Pendente não tem transição a confirmar: o botão já está desabilitado na
        // linha, e a guarda evita que a confirmação abra sobre uma mudança que o
        // repositório e o serviço recusariam depois.
        if (target.status === 'Pendente') return

        // As duas transições passam pela confirmação: uma tira o acesso ao portal e
        // a outra devolve. O clique aqui só registra a intenção.
        setStatusTarget({
            user: target,
            action: target.status === 'Ativo' ? 'deactivate' : 'reactivate',
        })
    }

    /** Única porta de saída do diálogo que altera status: o cancelamento e o
     fechamento apenas descartam a intenção, sem chamar o repositório. */
    function handleStatusConfirm() {
        const pending = statusTarget
        setStatusTarget(null)

        if (!pending) return

        if (pending.action === 'deactivate') {
            void runStatusChange(pending.user, deactivateUser, {
                done: 'foi desativado com sucesso.',
                already: 'já estava inativo.',
            })
            return
        }

        void runStatusChange(pending.user, activateUser, {
            done: 'foi reativado com sucesso.',
            already: 'já estava ativo.',
        })
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Identidade da aba, na mesma composição de Meu perfil, Preferências e
          Perfis de acesso: título e linha de apoio à esquerda, ação principal à
          direita e o filete que separa o cabeçalho do conteúdo administrativo. A
          descrição acompanha a permissão já calculada em `canManageUsers`, e não
          uma segunda regra: quem gerencia lê "Gerencie", quem só consulta lê
          "Consulte".

          `Novo usuário` subiu para cá, na mesma posição que `Novo perfil` ocupa
          na aba Perfis de acesso: as duas abas passaram a apresentar a ação
          principal no mesmo lugar, e os indicadores ficam abaixo do cabeçalho.
          Em telas estreitas o `flex-wrap` desce o botão para a linha seguinte,
          sob o título, sem passar da largura disponível. */}
            <div className="flex flex-none flex-wrap items-start justify-between gap-3 border-b border-[#eef0f4] pb-4">
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-[#1a2331]">Usuários</h2>
                    <p className="mt-1 text-[13px] text-[#667085]">
                        {canManageUsers
                            ? 'Gerencie usuários, Perfis do Sistema e acessos vinculados ao portal.'
                            : 'Consulte usuários, Perfis do Sistema e acessos vinculados ao portal.'}
                    </p>
                </div>
                {/* Mesmo componente, mesma variante e mesmo tamanho do `Novo perfil`:
            altura, ícone, espaçamento, tipografia, cor, raio e padding vêm do
            Button global, e não de classes escritas em uma tela só. */}
                {canManageUsers ? (
                    <Button
                        onClick={() => {
                            setFeedback(null)
                            setSaveToast(null)
                            setDrawer({mode: 'create'})
                        }}
                        size="sm"
                    >
                        <Plus aria-hidden="true" size={15}/>
                        Novo usuário
                    </Button>
                ) : null}
            </div>
            <div className="flex flex-none flex-wrap items-end gap-x-10 gap-y-3">
                <div className="flex gap-7">
                    <UserKpi label="Usuários" value={userList.length} valueClassName="text-[#101828]"/>
                    <UserKpi label="Ativos" value={activeCount} valueClassName="text-[#16a34a]"/>
                    {/* Pendentes entra entre os dois porque é isso que ele é: o
              cadastro que já existe e ainda não entrou. Âmbar, e não vermelho,
              pelo mesmo motivo do "Sem perfil definido" da aba Perfis de
              acesso: é um cadastro a terminar, não uma falha. */}
                    <UserKpi label="Pendentes" value={pendingCount} valueClassName="text-[#b54708]"/>
                    <UserKpi label="Inativos" value={inactiveCount} valueClassName="text-[#dc2626]"/>
                </div>
                <div className="flex gap-7">
                    <UserKpi label="Administradores" value={administratorCount} valueClassName="text-[#003be2]"/>
                    <UserKpi label="Executivos" value={executiveCount} valueClassName="text-[#0369a1]"/>
                    <UserKpi label="Analistas" value={analystCount} valueClassName="text-[#305522]"/>
                </div>
            </div>
            {feedback ? (
                <div
                    className={`flex-none rounded-lg border px-3.5 py-2 text-[12.5px] font-medium ${
                        feedback.type === 'success'
                            ? 'border-[#b7e4c7] bg-[#f2fbf5] text-[#16794a]'
                            : 'border-[#f4c7c9] bg-[#fdf3f3] text-[#b42318]'
                    }`}
                    role={feedback.type === 'success' ? 'status' : 'alert'}
                >
                    {feedback.message}
                </div>
            ) : null}
            {/* Região flexível da tabela: com PAGE_SIZE fixo, a rolagem vertical fica
          dentro do DataTable (scrollY), com cabeçalho fixo durante a rolagem;
          a paginação segue sempre visível logo abaixo. A key remonta a tabela
          somente quando a página muda de fato, devolvendo a rolagem ao topo sem
          efeito, ref ou rolagem via JavaScript; o foco permanece no botão usado. */}
            <div className="min-h-0 flex-1">
                <DataTable
                    columnWidths={columnWidths}
                    headers={headers}
                    key={safePage}
                    minWidth={960}
                    scrollY
                >
                    {pageUsers.map((user) => (
                        <UserTableRow
                            accessProfiles={accessProfiles}
                            canManageUsers={canManageUsers}
                            key={user.id}
                            now={now}
                            onChangePasswordClick={handleChangePasswordClick}
                            onEdit={() => {
                                setFeedback(null)
                                setSaveToast(null)
                                setDrawer({mode: 'edit', user})
                            }}
                            onFirstAccessClick={handleFirstAccessClick}
                            onStatusClick={handleStatusButtonClick}
                            resending={resendingUserId === user.id}
                            user={user}
                        />
                    ))}
                </DataTable>
            </div>
            {/* py-2.5 em vez de py-3: devolve 4px à região da tabela, o suficiente para
          as 10 linhas caberem no monitor grande sem barra de rolagem residual. */}
            <div
                className="mt-auto flex flex-none flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6e8ee] bg-[#fafbfc] px-4 py-2.5 text-[12.5px] text-[#667085]">
                <div>Mostrando <b className="text-[#344054]">{from}</b>-<b className="text-[#344054]">{to}</b> de <b
                    className="text-[#344054]">{userList.length}</b> usuários
                </div>
                <div className="flex gap-1.5">
                    {/* pointer-events-auto devolve o hit-test ao botão desabilitado (sem ele
              o cursor vem do ancestral); hover neutralizado para não reagir. */}
                    <Button className={PAGINATION_DISABLED_CLASSES} disabled={safePage === 0}
                            onClick={() => setPage(Math.max(0, safePage - 1))} size="sm"
                            variant="secondary">Anterior</Button>
                    {Array.from({length: totalPages}, (_, index) => (
                        <Button key={index} onClick={() => setPage(index)} size="sm"
                                variant={safePage === index ? 'primary' : 'secondary'}>{index + 1}</Button>
                    ))}
                    <Button className={PAGINATION_DISABLED_CLASSES} disabled={safePage >= totalPages - 1}
                            onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} size="sm"
                            variant="secondary">Próxima</Button>
                </div>
            </div>
            {canManageUsers ? (
                <UserDialog
                    accessProfiles={accessProfiles}
                    accessProfilesAvailable={accessProfilesAvailable}
                    editingUser={drawer?.mode === 'edit' ? drawer.user : null}
                    profileTypes={catalog.profileTypes}
                    isOwnAccount={drawer?.mode === 'edit' && drawer.user.id === authenticatedUser?.id}
                    // A key remonta o drawer a cada alvo: o formulário nasce preenchido
                    // (ou vazio) e erros e rascunhos da tentativa anterior não vazam entre
                    // aberturas, que sempre partem dos dados persistidos.
                    key={drawer === null ? 'closed' : drawer.mode === 'edit' ? drawer.user.id : 'create'}
                    onOpenChange={(nextOpen) => {
                        if (!nextOpen) setDrawer(null)
                    }}
                    onSaveCreate={saveUserCreate}
                    onSaveEdit={saveUserEdit}
                    open={drawer !== null}
                />
            ) : null}
            {canManageUsers ? (
                <StatusConfirmationDialog
                    onCancel={() => setStatusTarget(null)}
                    onConfirm={handleStatusConfirm}
                    pending={statusTarget}
                />
            ) : null}
            {canManageUsers ? (
                <ChangePasswordDialog
                    // Mesma chave dos demais diálogos: fechar remonta o formulário, e a
                    // senha digitada na abertura anterior não sobrevive a ela.
                    key={passwordTarget === null ? 'closed' : passwordTarget.id}
                    onCancel={() => setPasswordTarget(null)}
                    onSave={handleChangePassword}
                    target={passwordTarget}
                />
            ) : null}
            {canManageUsers ? (
                <FirstAccessDialog
                    // Fechar devolve a chave para 'closed', e a próxima abertura remonta o
                    // diálogo: a etapa, a senha digitada e o erro da tentativa anterior
                    // não vazam de uma abertura para a seguinte.
                    key={firstAccessTarget === null ? 'closed' : firstAccessTarget.id}
                    now={now}
                    onCancel={() => setFirstAccessTarget(null)}
                    onResend={handleResendFromDialog}
                    onSavePassword={handleSaveFirstAccessPassword}
                    target={firstAccessTarget}
                />
            ) : null}

            {/* Por último na árvore, mas a posição na tela é fixa e vem do próprio
          aviso: ele não empurra nem reposiciona nada desta página. */}
            {saveToast ? (
                <SessionToast
                    description={saveToast.description}
                    onDismiss={dismissSaveToast}
                    title={saveToast.title}
                />
            ) : null}
        </div>
    )
}

/**
 * O que o botão de primeiro acesso diz.
 *
 * Serve de `title` e de `aria-label`: leitor de tela e ponteiro recebem a mesma
 * frase. Quando ele está desabilitado, o texto é a única explicação do motivo.
 */
function firstAccessLabel(user: User, state: FirstAccessInviteState): string {
    return state === 'not-applicable'
        ? `${user.name} já definiu a senha. Não há primeiro acesso a resolver.`
        : `Primeiro acesso de ${user.name}: reenviar o e-mail ou cadastrar uma senha`
}

/**
 * O que o botão de trocar a senha diz.
 *
 * Serve de `title` e de `aria-label`, como no de primeiro acesso. Desabilitado,
 * o texto é a única explicação do motivo, e ele aponta o caminho certo: quem
 * ainda não tem senha se resolve pelo primeiro acesso, ao lado.
 */
/**
 * O que o botão de ativar/desativar diz.
 *
 * Desabilitado em `Pendente`, o texto é a única explicação do motivo, e ele
 * aponta o caminho certo: ativar e desativar são ações de conta com senha, e o
 * botão ao lado, o de primeiro acesso, é o que resolve a falta dela.
 */
function statusToggleLabel(user: User): string {
    if (user.status === 'Pendente') {
        return `${user.name} ainda não definiu a senha. Resolva o primeiro acesso antes de ativar ou desativar.`
    }

    return user.status === 'Ativo' ? `Desativar ${user.name}` : `Reativar ${user.name}`
}

function passwordChangeLabel(user: User, passwordDefined: boolean): string {
    return passwordDefined
        ? `Trocar a senha de ${user.name}`
        : `${user.name} ainda não definiu a senha. Resolva o primeiro acesso antes de trocá-la.`
}

type UserTableRowProps = {
    user: User
    accessProfiles: readonly AccessProfile[]
    canManageUsers: boolean
    /** Instante da avaliação do prazo do convite. Vem de fora para a linha não ter relógio próprio. */
    now: Date
    onChangePasswordClick?: (user: User) => void
    onEdit?: () => void
    onFirstAccessClick?: (user: User) => void
    onStatusClick?: (user: User) => void
    /** Reenvio deste usuário em andamento. */
    resending?: boolean
}

function UserTableRow({
                          user,
                          accessProfiles,
                          canManageUsers,
                          now,
                          onChangePasswordClick,
                          onEdit,
                          onFirstAccessClick,
                          onStatusClick,
                          resending = false,
                      }: UserTableRowProps) {
    // Um único valor por usuário: o nome do Perfil de Acesso ao qual ele está
    // vinculado, ou o estado de quem não tem vínculo válido. O vínculo gravado é
    // sempre confrontado com a coleção real, e não exibido por si só.
    const accessProfileLabel = userAccessProfileLabel(user, accessProfiles)
    const lastAccessWeekday = weekdayFromLastAccess(user.lastAccess)
    const inviteState = firstAccessInviteState(user, now)
    // Quem ainda não definiu senha não tem senha atual a informar, e é o que
    // desabilita a troca. As duas condições são opostas de propósito: o botão ao
    // lado, o de primeiro acesso, atende exatamente quem este recusa.
    const passwordDefined = hasDefinedPassword(user)

    return (
        <tr className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${profileColorClasses[user.profile]}`}>{user.initials}</span>
                    {/* min-w-0 é o que permite truncar dentro do flex; sem ele o texto
              empurraria a coluna e desfaria a largura fixa. */}
                    <span className="min-w-0 leading-tight">
            <span className="block truncate font-medium text-[#1a2331]" title={user.name}>{user.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-[#98a2b3]"
                  title={user.email}>{user.email}</span>
          </span>
                </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5"><ProfileBadge profile={user.profile}/></td>
            <td className="px-4 py-2.5 text-[#475467]">
                <span className="block truncate" title={accessProfileLabel}>{accessProfileLabel}</span>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5"><StatusBadge status={user.status}/></td>
            <td className="whitespace-nowrap px-4 py-2.5 text-[#98a2b3]"
                title={lastAccessWeekday ?? undefined}>{user.lastAccess}</td>
            {canManageUsers ? (
                <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                        <button
                            aria-label={`Editar ${user.name}`}
                            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828]"
                            onClick={onEdit}
                            title={`Editar ${user.name}`}
                            type="button"
                        >
                            <Edit size={14} aria-hidden="true"/>
                        </button>
                        {/* Primeiro acesso. O clique só ABRE o diálogo, onde se escolhe entre
                reenviar o e-mail e cadastrar a senha pelo administrador; nada é
                enviado daqui. O botão fica disponível para quem ainda não
                definiu a senha, porque a segunda opção existe justamente para
                quando o e-mail não chega, e prendê-la ao prazo do link deixaria
                a pessoa esperando por um e-mail que talvez nunca venha. Quem já
                definiu a senha não tem primeiro acesso a resolver, e aí sim o
                botão fica desabilitado. */}
                        <button
                            aria-label={firstAccessLabel(user, inviteState)}
                            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828] disabled:cursor-not-allowed disabled:border-[#e9ecf2] disabled:bg-[#f9fafb] disabled:text-[#c2c8d2] disabled:hover:bg-[#f9fafb] disabled:hover:text-[#c2c8d2]"
                            disabled={inviteState === 'not-applicable' || resending}
                            onClick={() => onFirstAccessClick?.(user)}
                            title={firstAccessLabel(user, inviteState)}
                            type="button"
                        >
                            <MailPlus size={14} aria-hidden="true"/>
                        </button>
                        {/* Troca de senha, em TODA linha: a ação é do administrador sobre a
                conta de qualquer pessoa da plataforma, para as situações em que
                alguém precisa de uma senha nova sem passar pelo "esqueci minha
                senha" da tela de entrada. Quem pode usá-la já está decidido pela
                coluna, que só existe para quem administra usuários. O clique
                apenas ABRE o diálogo; a gravação ainda passa pela confirmação com
                a senha do próprio administrador. */}
                        <button
                            aria-label={passwordChangeLabel(user, passwordDefined)}
                            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828] disabled:cursor-not-allowed disabled:border-[#e9ecf2] disabled:bg-[#f9fafb] disabled:text-[#c2c8d2] disabled:hover:bg-[#f9fafb] disabled:hover:text-[#c2c8d2]"
                            disabled={!passwordDefined}
                            onClick={() => onChangePasswordClick?.(user)}
                            title={passwordChangeLabel(user, passwordDefined)}
                            type="button"
                        >
                            <KeyRound size={14} aria-hidden="true"/>
                        </button>
                        {/* Ativar/desativar, desabilitado enquanto a conta está
                Pendente. As duas ações pressupõem alguém que ENTRA no portal:
                desativar quem nunca entrou não tira acesso nenhum, e ativar
                quem não tem senha é recusado pelo serviço. A conta entra neste
                par sozinha, no instante em que a senha passa a existir. */}
                        <button
                            aria-label={statusToggleLabel(user)}
                            className={`flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#e4e7ee] ${user.status === 'Ativo' ? 'text-[#e5484d] hover:bg-[#fdf3f3]' : 'text-[#16a34a] hover:bg-[#f2fbf5]'} disabled:cursor-not-allowed disabled:border-[#e9ecf2] disabled:bg-[#f9fafb] disabled:text-[#c2c8d2] disabled:hover:bg-[#f9fafb] disabled:hover:text-[#c2c8d2]`}
                            disabled={user.status === 'Pendente'}
                            onClick={() => onStatusClick?.(user)}
                            title={statusToggleLabel(user)}
                            type="button"
                        >
                            <Power size={14} aria-hidden="true"/>
                        </button>
                    </div>
                </td>
            ) : null}
        </tr>
    )
}

/**
 * Diálogo do primeiro acesso: os dois caminhos para dar uma senha a quem ainda
 * não tem.
 *
 * REENVIAR O E-MAIL é o caminho normal: a pessoa recebe o link e cria a própria
 * senha, que ninguém mais chega a conhecer. Ele fica desabilitado enquanto o
 * link atual está no prazo, porque cada reenvio gera um token novo e derruba o
 * anterior: disparar um segundo e-mail ali invalidaria justamente o link que a
 * pessoa pode estar abrindo naquele instante.
 *
 * CADASTRAR UMA SENHA é a saída para quando o e-mail não chega, e por isso não
 * espera prazo nenhum. Sem ela, uma pessoa cadastrada em um ambiente onde o
 * envio falha ficaria inativa para sempre. O preço é real e conhecido: a senha
 * passa a ser conhecida por quem a digitou, então ela é o segundo caminho, e não
 * o primeiro.
 *
 * Duas etapas em um diálogo só. A escolha vem primeiro, e o formulário de senha
 * só aparece depois de ela ser feita: um campo de senha visível ao lado da opção
 * de reenviar convidaria a digitar uma sem pensar no que isso significa.
 */
function FirstAccessDialog({
                               target,
                               now,
                               onCancel,
                               onResend,
                               onSavePassword,
                           }: {
    target: User | null
    /** Instante da avaliação do prazo do convite. */
    now: Date
    onCancel: () => void
    onResend: () => void
    /** Persiste a senha; devolve a mensagem de erro, ou null em caso de sucesso. */
    onSavePassword: (password: string) => Promise<string | null>
}) {
    const [stage, setStage] = useState<'choose' | 'password'>('choose')
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [error, setError] = useState<string | null>(null)
    /** Gravação em andamento: guarda contra o segundo clique em Salvar. */
    const [saving, setSaving] = useState(false)

    const inviteState = target === null ? 'not-applicable' : firstAccessInviteState(target, now)
    const inviteDeadline = formatInviteDeadline(target?.firstAccessExpiresAt)
    const accepted = isPasswordAccepted(password)
    const matches = password !== '' && password === confirmation

    async function handleSave() {
        if (saving) return

        if (!accepted) {
            setError('A senha ainda não atende a todas as exigências listadas acima.')
            return
        }
        if (!matches) {
            setError('As duas senhas digitadas não são iguais.')
            return
        }

        setError(null)
        setSaving(true)
        let message: string | null
        try {
            message = await onSavePassword(password)
        } finally {
            setSaving(false)
        }

        setError(message)
    }

    return (
        <Dialog.Root
            open={target !== null}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onCancel()
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                    <Dialog.Title className="text-base font-bold text-[#101828]">
                        {stage === 'choose' ? 'Primeiro acesso' : 'Cadastrar senha'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                        {target === null
                            ? ''
                            : stage === 'choose'
                                ? `Reenviar o e-mail ou cadastrar uma senha para o usuário ${target.name}.`
                                : `A senha abaixo passa a valer para ${target.name}, e a conta é ativada. Combine-a com ele e peça que a troque depois pela recuperação de senha.`}
                    </Dialog.Description>

                    {stage === 'choose' ? (
                        <>
                            {/* O motivo de o reenvio estar bloqueado fica à vista, e não só no
                  título do botão: sem isso, um botão desabilitado pareceria um
                  defeito da tela. */}
                            {inviteState === 'pending' ? (
                                <p className="mt-4 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3.5 py-3 text-[12.5px] leading-5 text-[#475467]">
                                    {inviteDeadline === null
                                        ? 'O link enviado por e-mail ainda está no prazo. O reenvio libera quando ele expirar, porque um e-mail novo derruba o anterior.'
                                        : `O link enviado por e-mail vale até ${inviteDeadline}. O reenvio libera depois disso, porque um e-mail novo derruba o anterior.`}
                                </p>
                            ) : null}

                            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
                                <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                                <Button onClick={() => setStage('password')} variant="secondary">
                                    <KeyRound aria-hidden="true" size={14}/>
                                    Cadastrar senha
                                </Button>
                                <Button disabled={inviteState !== 'expired'} onClick={onResend}>
                                    <MailPlus aria-hidden="true" size={14}/>
                                    Reenviar e-mail
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="mt-4">
                            <FormInput
                                autoComplete="new-password"
                                autoFocus
                                label="Senha"
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                type="password"
                                value={password}
                            />

                            <PasswordRequirementList password={password}/>

                            <FormInput
                                autoComplete="new-password"
                                error={error}
                                label="Repita a senha"
                                onChange={(event) => setConfirmation(event.target.value)}
                                required
                                type="password"
                                value={confirmation}
                            />

                            <div className="flex flex-wrap justify-end gap-2.5">
                                <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                                <Button onClick={() => setStage('choose')} variant="secondary">Voltar</Button>
                                <Button disabled={saving || !accepted || !matches} onClick={handleSave}>
                                    {saving ? 'Salvando...' : 'Salvar senha e ativar'}
                                </Button>
                            </div>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

/**
 * As exigências da senha, com o estado de cada uma.
 *
 * A lista fica visível o tempo todo, e não só depois de um erro: é ela que diz
 * o que fazer ANTES de tentar. Cor não informa sozinha, então cada item carrega
 * o próprio texto de estado para quem usa leitor de tela.
 *
 * Uma lista só para os dois diálogos que pedem senha, o de primeiro acesso e o
 * de troca: a régua é a mesma (`passwordPolicy`), e duas cópias do mesmo desenho
 * divergiriam na primeira mudança dela.
 */
function PasswordRequirementList({password}: { password: string }) {
    return (
        <ul
            aria-label="Exigências da senha"
            className="mb-4 space-y-1.5 rounded-lg border border-[#e4e7ee] bg-[#f9fafb] px-3.5 py-3"
        >
            {passwordRequirements.map((rule) => {
                const met = rule.isMet(password)

                return (
                    <li
                        className={`flex items-center gap-2 text-[12px] leading-4 ${met ? 'text-[#13875a]' : 'text-[#667085]'}`}
                        key={rule.id}
                    >
                        {met ? (
                            <Check aria-hidden="true" className="flex-none" size={13}/>
                        ) : (
                            <span
                                aria-hidden="true"
                                className="h-[7px] w-[7px] flex-none rounded-full border border-current"
                            />
                        )}
                        {rule.label}
                        <span className="sr-only">{met ? ' (atendido)' : ' (pendente)'}</span>
                    </li>
                )
            })}
        </ul>
    )
}

/**
 * Troca da senha de um usuário pelo cadastro, em dois passos.
 *
 * O formulário tem a senha nova e a repetição dela, e mais nada: a senha ATUAL
 * da conta não é pedida em lugar nenhum, porque ninguém sabe a senha alheia, e
 * é justamente quem a esqueceu que costuma precisar desta tela. A repetição
 * existe para pegar o erro de digitação antes de a conta ficar com uma senha
 * que ninguém sabe qual é.
 *
 * O segundo passo é a confirmação, e ela é o que protege a ação: antes de
 * gravar, quem está trocando digita a PRÓPRIA senha. Sem isso, um computador
 * destravado com a sessão de um administrador aberta seria a senha de qualquer
 * pessoa da lista. O serviço confere essa senha e recusa a troca sem ela.
 *
 * Quem nunca definiu a primeira senha não passa por aqui: o botão da linha fica
 * desabilitado, e o caminho dele é o primeiro acesso, ao lado.
 */
function ChangePasswordDialog({
                                  target,
                                  onCancel,
                                  onSave,
                              }: {
    target: User | null
    onCancel: () => void
    /** Grava a senha nova; devolve a mensagem de erro, ou null em caso de sucesso. */
    onSave: (newPassword: string, authenticatedPassword: string) => Promise<string | null>
}) {
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [error, setError] = useState<string | null>(null)
    /**
     * Confirmação aberta por cima do formulário.
     *
     * Estado próprio, e não uma etapa que substitui o formulário: cancelar a
     * confirmação devolve as duas senhas já digitadas, em vez de mandar começar
     * de novo.
     */
    const [confirming, setConfirming] = useState(false)
    /** Senha de quem está trocando, digitada só dentro da confirmação. */
    const [authenticatedPassword, setAuthenticatedPassword] = useState('')
    const [confirmError, setConfirmError] = useState<string | null>(null)
    /** Gravação em andamento: guarda contra o segundo clique em Confirmar. */
    const [saving, setSaving] = useState(false)

    const accepted = isPasswordAccepted(password)
    const matches = password !== '' && password === confirmation

    /**
     * Primeiro clique: confere o que a TELA sabe conferir e abre a confirmação.
     *
     * Nada é enviado aqui. Uma senha fraca ou uma repetição diferente param no
     * formulário, sem gastar a confirmação de quem ainda teria de digitar a
     * própria senha para descobrir o erro.
     */
    function handleRequestConfirmation() {
        if (!accepted) {
            setError('A senha nova ainda não atende a todas as exigências listadas acima.')
            return
        }
        if (!matches) {
            setError('As duas senhas digitadas não são iguais.')
            return
        }

        setError(null)
        setAuthenticatedPassword('')
        setConfirmError(null)
        setConfirming(true)
    }

    async function handleConfirm() {
        if (saving) return

        if (authenticatedPassword === '') {
            setConfirmError('Digite a sua senha para confirmar a troca.')
            return
        }

        setConfirmError(null)
        setSaving(true)
        let message: string | null
        try {
            message = await onSave(password, authenticatedPassword)
        } finally {
            setSaving(false)
        }

        // No sucesso quem fecha é a página, que descarta o alvo e desmonta os
        // dois diálogos. Aqui só resta mostrar o motivo quando houve recusa, e
        // ele fica na confirmação, que é onde o dedo está.
        setConfirmError(message)
    }

    return (
        <>
            <Dialog.Root
                open={target !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) onCancel()
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                    {/* Rolagem própria: são dois campos mais a lista de exigências, e em
                      tela baixa o rodapé do diálogo precisa continuar alcançável. */}
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[520px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                        <Dialog.Title className="text-base font-bold text-[#101828]">
                            Trocar senha
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                            {target === null
                                ? ''
                                : `Troque a senha do usuário ${target.name}.`}
                        </Dialog.Description>

                        <div className="mt-4">
                            {/* autoComplete fora do padrão: esta não é a senha de quem está
                              usando o portal, e o gerenciador do navegador não deve oferecer
                              nem guardar a senha de outra pessoa. */}
                            <FormInput
                                autoComplete="new-password"
                                autoFocus
                                label="Nova senha"
                                onChange={(event) => {
                                    setPassword(event.target.value)
                                    setError(null)
                                }}
                                required
                                type="password"
                                value={password}
                            />
                            <PasswordRequirementList password={password}/>
                            {/* O erro mora no último campo, como no primeiro acesso: é o que
                  fica logo acima dos botões, onde o olho volta depois do clique. */}
                            <FormInput
                                autoComplete="new-password"
                                error={error}
                                label="Repita a nova senha"
                                onChange={(event) => {
                                    setConfirmation(event.target.value)
                                    setError(null)
                                }}
                                required
                                type="password"
                                value={confirmation}
                            />

                            <div className="flex flex-wrap justify-end gap-2.5">
                                <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                                <Button
                                    disabled={saving || !accepted || !matches}
                                    onClick={handleRequestConfirmation}
                                >
                                    Salvar senha
                                </Button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Confirmação por cima do formulário, no mesmo desenho das demais
          confirmações da tela. z-60 porque ela nasce enquanto o primeiro diálogo
          continua montado atrás, com o conteúdo preservado para quem desistir. */}
            <Dialog.Root
                open={confirming && target !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setConfirming(false)
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#101828]/40"/>
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-[60] w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                        <Dialog.Title className="text-base font-bold text-[#101828]">
                            Confirmar a troca de senha?
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                            {target === null
                                ? ''
                                : `Digite a sua senha para trocar a senha de ${target.name}. Ele passa a entrar no portal com a senha nova, e a anterior deixa de valer.`}
                        </Dialog.Description>

                        <div className="mt-4">
                            <FormInput
                                autoComplete="current-password"
                                autoFocus
                                error={confirmError}
                                label="Sua senha"
                                onChange={(event) => {
                                    setAuthenticatedPassword(event.target.value)
                                    setConfirmError(null)
                                }}
                                required
                                type="password"
                                value={authenticatedPassword}
                            />

                            <div className="flex flex-wrap justify-end gap-2.5">
                                <Button onClick={() => setConfirming(false)} variant="secondary">
                                    Cancelar
                                </Button>
                                <Button disabled={saving || authenticatedPassword === ''} onClick={handleConfirm}>
                                    {saving ? 'Salvando...' : 'Confirmar troca'}
                                </Button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    )
}

/**
 * Confirmação das duas transições de status. A estrutura é a mesma nos dois
 * casos: muda o título, a descrição e o botão principal, que segue vermelho para
 * desativar, ação destrutiva, e mantém o padrão positivo do portal para reativar.
 */
function StatusConfirmationDialog({
                                      pending,
                                      onCancel,
                                      onConfirm,
                                  }: {
    pending: PendingStatusChange | null
    onCancel: () => void
    onConfirm: () => void
}) {
    const deactivating = pending?.action === 'deactivate'

    return (
        <Dialog.Root
            open={pending !== null}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onCancel()
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                    <Dialog.Title className="text-base font-bold text-[#101828]">
                        {deactivating ? 'Desativar usuário?' : 'Reativar usuário?'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                        {!pending
                            ? ''
                            : deactivating
                                ? `${pending.user.name} não poderá entrar no portal enquanto estiver Inativo. O acesso pode ser devolvido depois pela reativação.`
                                : `Deseja reativar o usuário “${pending.user.name}”? Ele voltará a ter acesso ao portal conforme suas permissões atuais.`}
                    </Dialog.Description>
                    <div className="mt-5 flex justify-end gap-2.5">
                        <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                        {/* Sem className na reativação: o botão primário do portal já é a
                aparência de ação positiva, com o foco por teclado que vem dele. */}
                        <Button
                            className={
                                deactivating ? 'bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[#e5484d]' : undefined
                            }
                            onClick={onConfirm}
                        >
                            {deactivating ? 'Desativar usuário' : 'Reativar usuário'}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

/** Indicador da faixa superior. Cores explícitas: o painel segue branco no tema
 escuro, então os números não podem herdar a cor de texto do tema. */
function UserKpi({label, value, valueClassName}: { label: string; value: number; valueClassName: string }) {
    return (
        <div>
            <div className="text-[11.5px] font-semibold uppercase text-[#667085]">{label}</div>
            <div className={`mt-1 font-mono text-[22px] font-semibold ${valueClassName}`}>{value}</div>
        </div>
    )
}

function ProfileBadge({profile}: { profile: User['profile'] }) {
    return <span
        className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${profileColorClasses[profile]}`}>{profile}</span>
}

function StatusBadge({status}: { status: User['status'] }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${userStatusColorClasses[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current"/>
            {status}
    </span>
    )
}

type UserDialogProps = {
    open: boolean
    /** null no modo de criação; o usuário alvo no modo de edição. */
    editingUser: User | null
    /** true quando o alvo da edição é a própria conta autenticada. */
    isOwnAccount: boolean
    /** Tipos de perfil do serviço (`profile_types`), na ordem do serviço. */
    profileTypes: readonly SystemProfileOption[]
    /** Perfis de acesso do serviço (`access`), de todos os tipos. */
    accessProfiles: readonly AccessProfile[]
    /** false enquanto os catálogos não chegaram, ou quando não puderam ser lidos. */
    accessProfilesAvailable: boolean
    onOpenChange: (open: boolean) => void
    /** Persiste a edição; devolve a mensagem de erro, ou null em caso de sucesso. */
    onSaveEdit: (userId: string, input: UserFormInput) => Promise<string | null>
    /** Persiste o cadastro; mesmo contrato da edição. Senha não faz parte da
     entrada: ela é definida pela própria pessoa, no primeiro acesso. */
    onSaveCreate: (input: UserFormInput) => Promise<string | null>
}

/**
 * Formulário de usuário em modal CENTRAL, no mesmo traço do formulário de
 * Perfis de acesso: superfície, borda, raio, sombra e overlay compartilhados,
 * cabeçalho fixo com título, descrição e Fechar, conteúdo com rolagem própria e
 * rodapé fixo com Cancelar e Salvar.
 *
 * O painel lateral saiu. O conteúdo é um formulário curto, e uma coluna colada na
 * borda direita obrigava a lê-lo com metade da tela escurecida sem uso; o modal
 * central usa a largura de que os campos precisam e põe a leitura no eixo do
 * olhar. A largura é intermediária de propósito: menor que a do formulário de
 * perfis, que percorre o catálogo inteiro, e maior que a de um diálogo de
 * confirmação.
 *
 * Foco preso, fechamento por Escape e devolução do foco ao disparador vêm do
 * Dialog do Radix, e não de código próprio.
 */
function UserDialog({
                        open,
                        editingUser,
                        isOwnAccount,
                        profileTypes,
                        accessProfiles,
                        accessProfilesAvailable,
                        onOpenChange,
                        onSaveEdit,
                        onSaveCreate,
                    }: UserDialogProps) {
    const isEditing = editingUser !== null
    // O pai remonta o modal via key a cada abertura, então o estado inicial já
    // nasce com os dados do usuário em edição, sem efeito de sincronização.
    const [name, setName] = useState(editingUser?.name ?? '')
    const [email, setEmail] = useState(editingUser?.email ?? '')
    const [emailTouched, setEmailTouched] = useState(false)
    /**
     * Escolha do campo Perfil do Sistema: o UUID de uma linha de `profile_types`.
     *
     * Rascunho, e não valor: enquanto ninguém mexe no campo, o valor efetivo é
     * derivado no render a partir do usuário em edição (ou do Analista, na
     * criação) e do catálogo. É o que faz o campo abrir preenchido mesmo quando o
     * catálogo chega depois de o modal ter sido montado.
     */
    const [profileSystemDraft, setProfileSystemDraft] = useState<string | null>(null)
    const profileSystemId = profileSystemDraft ?? initialProfileSystemId(editingUser, profileTypes)
    /**
     * Escolha do seletor de Perfil de Acesso.
     *
     * Na edição nasce com o vínculo GRAVADO, e só quando ele continua válido:
     * `initialAccessProfileId` confronta o id com a coleção real, então um vínculo
     * que aponta para um perfil excluído, desativado ou de outro destino abre o
     * formulário sem seleção, com o salvamento bloqueado e a orientação escrita.
     */
    const [accessProfileDraft, setAccessProfileDraft] = useState<string | null>(() =>
        initialAccessProfileId(editingUser, accessProfiles),
    )
    const [formError, setFormError] = useState<string | null>(null)
    /**
     * Gravação em andamento no serviço. Enquanto dura, o botão Salvar fica
     * desabilitado: um segundo clique cadastraria a mesma pessoa duas vezes.
     */
    const [isSaving, setIsSaving] = useState(false)
    /** Conteúdo rolável do modal; a mensagem de erro fica no topo dele. */
    const contentRef = useRef<HTMLDivElement>(null)
    const profileFieldId = useId()

    /**
     * Opções do seletor: todos os perfis ATIVOS.
     *
     * O recorte por Perfil do Sistema acabou junto com o destino do Perfil de
     * Acesso, então a lista é a mesma para qualquer usuário, e trocar o Perfil do
     * Sistema não muda mais as opções.
     */
    const options = useMemo(() => accessProfileOptionsFor(accessProfiles), [accessProfiles])
    // Valor efetivo do campo, derivado no render: uma escolha que deixou de ser
    // oferecida nunca vira o valor exibido.
    const selectedId = accessProfileDraftFor(options, accessProfileDraft)
    const selectedOption = findAccessProfileOption(options, selectedId)
    const emailValid = isValidUserEmail(email)
    const emailError = emailTouched && !emailValid ? 'Informe um e-mail válido.' : null
    /**
     * Estado da escolha, e é ele que habilita o botão Salvar.
     *
     * A conferência não é `accessProfileId !== null`: o id é confrontado com as
     * opções oferecidas, que já são o recorte do domínio, então perfil inexistente
     * e inativo mantêm o salvamento bloqueado com orientação própria, em vez de
     * virarem erro depois do clique.
     */
    const selection = checkAccessProfileSelection(options, selectedId, accessProfilesAvailable)
    /** Usuário em edição cujo vínculo gravado não vale mais. */
    const hasUnprofiledAccess =
        editingUser !== null && initialAccessProfileId(editingUser, accessProfiles) === null

    /**
     * Troca do Perfil do Sistema.
     *
     * Ela NÃO mexe mais no Perfil de Acesso escolhido. Mexia porque a lista de
     * perfis oferecidos mudava com o Perfil do Sistema, e uma escolha que deixava
     * de ser compatível precisava sair do rascunho. Hoje a lista é a mesma para
     * todos, e uma escolha já feita continua válida.
     */
    function handleSystemProfileChange(value: string) {
        setProfileSystemDraft(value || null)
        setFormError(null)
    }

    /**
     * Publica o erro e devolve o topo do conteúdo ao campo de visão: a mensagem
     * fica acima do formulário, e o botão Salvar vive no rodapé fixo, então uma
     * recusa disparada com o modal rolado deixaria a mensagem fora da tela.
     *
     * A rolagem é imperativa, e não derivada de `formError`, porque a mesma
     * mensagem pode se repetir em duas tentativas seguidas: sem mudança de estado
     * não haveria novo render para reagir.
     */
    function showFormError(message: string) {
        setFormError(message)

        if (contentRef.current) contentRef.current.scrollTop = 0
    }

    // A gravação acontece no serviço, então há um intervalo em que o modal está
    // aberto e a resposta ainda não chegou: `isSaving` bloqueia o reenvio nele.
    // Qualquer erro mantém o modal aberto, com os campos preenchidos e a mensagem
    // visível; só o sucesso fecha, e quem fecha é o pai, ao zerar o alvo do modal.
    async function handleSave() {
        if (isSaving) return

        // Tentativa nova começa sem a mensagem da anterior.
        setFormError(null)

        if (!emailValid) {
            setEmailTouched(true)
            showFormError('Informe um e-mail válido.')
            return
        }

        // Rede de segurança: o botão já fica desabilitado sem escolha válida, e o
        // repositório recusa de novo. Nenhuma das três checagens substitui as outras.
        if (!selection.ok) {
            showFormError(accessProfileSelectionMessages[selection.reason])
            return
        }

        // Sem tipo de perfil não há o que gravar: o botão já fica desabilitado, e
        // esta é a rede de segurança do mesmo jeito que a da seleção acima.
        if (profileSystemId === null) {
            showFormError(accessProfileFailureMessages['unknown-system-profile'])
            return
        }

        const accessProfileId = selection.option.id

        setIsSaving(true)
        try {
            const error = editingUser
                ? await onSaveEdit(editingUser.id, {name, email, profileSystemId, accessProfileId})
                : await onSaveCreate({name, email, profileSystemId, accessProfileId})

            // Recusa mantém tudo como está, para o administrador corrigir só o que foi
            // apontado.
            if (error) showFormError(error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className={modalOverlayClass}/>
                {/* Largura intermediária e altura acompanhando o conteúdo até o limite da
            viewport: o formulário é curto, e esticá-lo até a tela inteira
            deixaria uma faixa branca sem função. `max-w` em `vw` impede rolagem
            horizontal em qualquer largura. */}
                <Dialog.Content
                    className={`${modalShellClass} max-h-[92vh] max-w-[calc(100vw-24px)] sm:max-h-[88vh] sm:w-[560px]`}
                >
                    <div
                        className="flex flex-none items-start justify-between gap-3 border-b border-[#eef0f4] px-5 py-4">
                        <div className="min-w-0">
                            <Dialog.Title className="text-base font-bold text-[#101828]">
                                {isEditing ? 'Editar usuário' : 'Novo usuário'}
                            </Dialog.Title>
                            <Dialog.Description className="mt-0.5 text-xs text-[#98a2b3]">
                                {isEditing
                                    ? 'Atualização de dados, Perfil do Sistema e Perfil de Acesso'
                                    : 'Cadastro de acesso ao BI'}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button aria-label="Fechar" size="icon" variant="ghost">
                                <X size={18}/>
                            </Button>
                        </Dialog.Close>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5" ref={contentRef}>
                        {formError ? (
                            <div
                                className="mb-4 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3.5 py-2 text-[12.5px] font-medium text-[#b42318]"
                                role="alert">
                                {formError}
                            </div>
                        ) : null}
                        <SectionTitle>Dados básicos</SectionTitle>
                        <FormInput
                            label="Nome completo"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Ex.: João da Silva"
                            required
                            value={name}
                        />
                        {/* Nome próprio do cadastro e autoComplete off: este e-mail é o de um
                usuário sendo cadastrado por um administrador, não o login de quem
                está usando o portal, e não deve ser lido como tal. */}
                        <FormInput
                            autoComplete="off"
                            error={emailError}
                            label="E-mail"
                            name="new-user-email"
                            onBlur={() => setEmailTouched(true)}
                            onChange={(event) => {
                                setEmail(event.target.value)
                                setFormError(null)
                            }}
                            placeholder="usuario@impactotelecom.com"
                            required
                            type="email"
                            value={email}
                        />
                        <label
                            className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
                            htmlFor={profileFieldId}
                        >
                            {/* Já nasce preenchido, com Analista, mas continua obrigatório: a
                  marca evita ler a ausência dela como campo dispensável. Some na
                  própria conta, onde o campo é desabilitado. */}
                            Perfil do Sistema {isOwnAccount ? null : <RequiredMark/>}
                        </label>
                        {/* Mesma causa do FormInput: fundo branco fixo exige cor própria. */}
                        {/* Opções vindas de `profile_types` do serviço, na ordem dele: o
                valor é o UUID da linha, e o texto é o nome gravado lá. */}
                        <select
                            className={`mb-4 w-full cursor-pointer rounded-lg border ${FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                            disabled={isOwnAccount}
                            id={profileFieldId}
                            onChange={(event) => handleSystemProfileChange(event.target.value)}
                            value={profileSystemId ?? ''}
                        >
                            {profileTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                        <AccessProfileField
                            disabled={isOwnAccount}
                            hasUnprofiledAccess={hasUnprofiledAccess}
                            isOwnAccount={isOwnAccount}
                            onSelect={(nextId) => {
                                setAccessProfileDraft(nextId)
                                setFormError(null)
                            }}
                            options={options}
                            selectedId={selectedId}
                            selectionFailureReason={selection.ok ? null : selection.reason}
                            selectedOption={selectedOption}
                        />
                        {/* Só no cadastro: na edição o aviso não responde a pergunta
                nenhuma de quem veio corrigir nome, e-mail ou perfil. */}
                        {isEditing ? null : <FirstAccessNotice/>}
                    </div>
                    <DialogFooter
                        // Sem Perfil de Acesso válido não existe usuário a gravar: a recusa
                        // aparece como botão desabilitado, e não como erro depois do clique.
                        // Sem tipo de perfil escolhido, o botão também fica desabilitado.
                        // A gravação em andamento sai daqui e vai em `saving`: ela também
                        // trava o botão, mas com a aparência de quem está trabalhando.
                        canSave={selection.ok && emailValid && profileSystemId !== null}
                        onClose={() => onOpenChange(false)}
                        onSave={handleSave}
                        saveLabel={isEditing ? 'Salvar alterações' : 'Salvar usuário'}
                        saving={isSaving}
                    />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

/**
 * Campo único de Perfil de Acesso.
 *
 * Um `select` e nada mais: sem cards, sem segundo passo e sem fluxo separado. Um
 * usuário tem exatamente um Perfil de Acesso, e ele define os departamentos e as
 * páginas visualizadas.
 *
 * A lista traz todos os perfis ativos, e é a mesma para qualquer Perfil do
 * Sistema. O Administrador tinha um tratamento próprio — uma única opção
 * possível e o campo bloqueado —, e não tem mais: ele escolhe como todo mundo.
 *
 * Depois da escolha, os departamentos aparecem como labels logo abaixo do
 * campo. Cada label reutiliza o detalhamento de páginas da tela Perfis de
 * acesso, disponível por mouse, teclado e toque. Sem seleção, nenhum label é
 * exibido.
 */
function AccessProfileField({
                                disabled,
                                hasUnprofiledAccess,
                                isOwnAccount,
                                onSelect,
                                options,
                                selectedId,
                                selectionFailureReason,
                                selectedOption,
                            }: {
    disabled: boolean
    /** true quando o usuário em edição está sem vínculo válido. */
    hasUnprofiledAccess: boolean
    isOwnAccount: boolean
    onSelect: (accessProfileId: string | null) => void
    options: readonly AccessProfileOption[]
    selectedId: string | null
    selectionFailureReason: AccessProfileSelectionFailureReason | null
    selectedOption: AccessProfileOption | null
}) {
    const fieldId = useId()
    const hintId = useId()

    const invalid = selectionFailureReason !== null && selectionFailureReason !== 'required'

    return (
        <>
            <label
                className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
                htmlFor={fieldId}
            >
                {/* Sem marca quando o campo não é escolha: a própria conta não edita o
            próprio acesso. */}
                Perfil de Acesso {disabled ? null : <RequiredMark/>}
            </label>
            <div>
                <select
                    aria-describedby={hintId}
                    aria-invalid={invalid || undefined}
                    className={`w-full cursor-pointer rounded-lg border ${invalid ? FIELD_ERROR_BORDER_CLASS : FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                    disabled={disabled}
                    id={fieldId}
                    onChange={(event) => onSelect(event.target.value || null)}
                    value={selectedId ?? ''}
                >
                    {/* Posição vazia, que não é perfil da coleção: é o pedido de escolha, e
              some assim que existe uma. */}
                    {selectedId === null ? (
                        <option value="">
                            {hasUnprofiledAccess ? UNPROFILED_ACCESS_LABEL : 'Selecione um Perfil de Acesso'}
                        </option>
                    ) : null}
                    {options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name}
                        </option>
                    ))}
                </select>
                {selectedOption ? (
                    <CoverageTooltipProvider>
                        <div
                            aria-label={`Departamentos concedidos por ${selectedOption.name}`}
                            className="mt-2 flex flex-wrap gap-1.5"
                        >
                            {selectedOption.departments.length > 0 ? (
                                selectedOption.departments.map((department) => (
                                    <DepartmentCoverageChip
                                        coverage={department.coverage}
                                        key={department.departmentId}
                                        label={department.label}
                                        pages={department.catalogPages}
                                    />
                                ))
                            ) : (
                                <span className="text-[11.5px] text-[#98a2b3]">
                  Nenhum departamento concedido.
                </span>
                            )}
                        </div>
                    </CoverageTooltipProvider>
                ) : null}
            </div>
            <AccessProfileHint
                failureReason={selectionFailureReason}
                hasUnprofiledAccess={hasUnprofiledAccess}
                id={hintId}
                isOwnAccount={isOwnAccount}
            />
        </>
    )
}

/**
 * Linha de apoio do Perfil de Acesso, sempre presente e sempre em texto: ela
 * carrega a informação que o seletor não consegue mostrar sozinho, e nenhuma das
 * situações depende de cor para ser entendida.
 *
 * A ordem é a da urgência. A coleção ilegível vem primeiro, porque não há
 * escolha a oferecer. Depois o vínculo que deixou de valer, que bloqueia o
 * salvamento até alguém escolher outro. Só então a nota da autoedição, o perfil
 * vindo do Perfil do Sistema, a escolha ainda pendente e a situação normal.
 */
function AccessProfileHint({
                               failureReason,
                               hasUnprofiledAccess,
                               id,
                               isOwnAccount,
                           }: {
    failureReason: AccessProfileSelectionFailureReason | null
    hasUnprofiledAccess: boolean
    /** Alvo do `aria-describedby` do seletor, em qualquer uma das situações. */
    id: string
    isOwnAccount: boolean
}) {
    if (failureReason === 'unavailable') {
        return (
            <HintText id={id} tone="attention">
                {accessProfileSelectionMessages.unavailable}
            </HintText>
        )
    }

    if (failureReason === 'unknown' || (failureReason === 'required' && hasUnprofiledAccess)) {
        return (
            <HintText id={id} tone="attention">
                Este usuário está sem Perfil de Acesso válido e não consegue entrar no portal. Escolha um
                dos perfis oferecidos para liberar o acesso.
            </HintText>
        )
    }

    if (isOwnAccount) {
        return (
            <HintText id={id}>
                Você pode editar seu nome e e-mail, mas não pode alterar o próprio Perfil do Sistema nem o
                próprio Perfil de Acesso.
            </HintText>
        )
    }

    if (failureReason === 'required') {
        return <HintText id={id}>Selecione um Perfil de Acesso para este usuário.</HintText>
    }

    return (
        <HintText id={id}>
            Os labels mostram os departamentos concedidos. Passe o mouse, use Tab ou toque em um deles
            para conferir as páginas.
        </HintText>
    )
}

/** Cor de cada situação da linha de apoio. Todas já existiam no drawer: o cinza
 das notas, o âmbar dos avisos e o vermelho das recusas. */
const HINT_TONE_CLASSES = {
    neutral: 'text-[#98a2b3]',
    attention: 'font-medium text-[#b54708]',
    error: 'font-medium text-[#b42318]',
}

/**
 * Mesmo espaçamento das demais linhas de apoio do drawer.
 *
 * No tom de recusa a linha vira região de alerta: ela aparece em resposta ao
 * clique em Salvar, e sem isso a mensagem seria apenas uma cor nova na tela.
 * `role` só existe nesse tom, para as orientações comuns não interromperem a
 * leitura a cada mudança de campo.
 */
function HintText({
                      children,
                      id,
                      tone = 'neutral',
                  }: {
    children: ReactNode
    id?: string
    tone?: keyof typeof HINT_TONE_CLASSES
}) {
    return (
        <p
            className={`mb-4 mt-1.5 text-[11.5px] ${HINT_TONE_CLASSES[tone]}`}
            id={id}
            role={tone === 'error' ? 'alert' : undefined}
        >
            {children}
        </p>
    )
}

/** Título das seções do drawer, hoje apenas Dados básicos. */
function SectionTitle({children}: { children: ReactNode }) {
    return (
        <div
            className="mb-3 border-b border-[#eef0f4] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#667085]">
            {children}
        </div>
    )
}

/**
 * Contorno padrão dos campos do drawer, compartilhado pelos inputs, pelo select
 * de perfil e pelo estado neutro dos campos de senha.
 *
 * O contorno nativo do navegador é suprimido porque é desenhado por fora da
 * borda, com espessura própria, e engrossaria o campo ao receber o foco. No
 * lugar dele, o foco troca apenas a cor da borda por um cinza mais escuro: a
 * borda continua com 1px em qualquer estado, e nenhuma segunda camada aparece.
 */
const FIELD_BORDER_CLASS = 'border-[#dfe3ec] focus:outline-none focus:border-[#667085]'

/**
 * Contorno de um campo recusado, no mesmo padrão que a confirmação de senha já
 * usa quando as senhas divergem: a borda troca de cor e o contorno nativo
 * continua suprimido, para a espessura não mudar e a cor da recusa não ficar
 * escondida atrás dele.
 */
const FIELD_ERROR_BORDER_CLASS = 'border-[#b42318] focus:outline-none'

function FormInput({
                       error,
                       label,
                       required,
                       ...props
                   }: InputHTMLAttributes<HTMLInputElement> & { error?: string | null; label: string }) {
    return (
        <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">
        {label} {required ? <RequiredMark/> : null}
      </span>
            {/* Cor explícita: o fundo é branco fixo, então herdar --text-primary
          deixaria o texto quase branco sobre branco no tema escuro. */}
            <input
                // `aria-required` em vez do atributo nativo: o modal não é um `form` que
                // submete, então o `required` do HTML não validaria nada e ainda ligaria
                // o balão do navegador se algum dia passasse a submeter.
                aria-invalid={error ? true : undefined}
                aria-required={required || undefined}
                className={`w-full rounded-lg border ${error ? FIELD_ERROR_BORDER_CLASS : FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] placeholder:text-[#98a2b3] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                {...props}
            />
            {error ? (
                <span className="mt-1.5 block text-[11.5px] font-medium text-[#b42318]" role="alert">
          {error}
        </span>
            ) : null}
        </label>
    )
}

/**
 * Como a senha passa a ser definida: pela própria pessoa, no primeiro acesso.
 *
 * Substituiu os campos Senha e Confirmar senha do cadastro. Senha digitada por
 * um terceiro é senha que outra pessoa conheceu, e o link enviado ao e-mail
 * cadastrado ainda confirma, de quebra, que aquele endereço existe e é de quem
 * está entrando.
 *
 * Aparece SÓ no cadastro, onde descreve o que vai acontecer com aquela pessoa ao
 * salvar. Na edição o aviso saiu: quem abre o modal para corrigir nome, e-mail ou
 * perfil não está tratando de senha, e o texto só empurrava o formulário para
 * baixo. Quem procura onde trocar a senha de alguém continua sendo atendido pela
 * coluna Ações da lista, que reenvia o convite ou cadastra a senha.
 *
 * A segunda linha era a ressalva de que o envio ainda não acontecia, e SAIU: o
 * serviço envia o e-mail, o link vale 10 minutos e só pode ser usado uma vez. No
 * lugar dela entrou para onde ir quando o e-mail não chega, que é a pergunta
 * seguinte de quem lê este aviso: a coluna Ações da lista reenvia o convite ou
 * permite cadastrar a senha pelo administrador.
 *
 * Continua valendo que esta TELA não cadastra senha: o campo de senha do
 * formulário não voltou. O cadastro direto existe só dentro do diálogo de
 * primeiro acesso, que é onde ele está claramente marcado como a segunda opção.
 */
function FirstAccessNotice() {
    return (
        <div className="mb-1 flex items-start gap-2.5 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3.5 py-3">
            <Mail aria-hidden="true" className="mt-0.5 flex-none text-[#98a2b3]" size={15}/>
            <div className="min-w-0 space-y-1">
                <p className="text-[12.5px] leading-5 text-[#475467]">
                    Ao salvar, o usuário recebe no e-mail cadastrado um link para cria a senha de acesso.
                </p>
                <p className="text-[11.5px] leading-4 text-[#98a2b3]">
                    O link vale 10 minutos e só pode ser usado uma vez.
                </p>
            </div>
        </div>
    )
}

/** Cor do anel de foco por teclado dos botões do rodapé do drawer. Só a cor: a
 espessura e o afastamento continuam sendo os do Button global. */
const FOOTER_FOCUS_RING_CLASS = 'focus-visible:ring-[#667085]'

function DialogFooter({
                          canSave,
                          onClose,
                          onSave,
                          saveLabel,
                          saving,
                      }: {
    /** false enquanto não houver Perfil de Acesso válido para gravar. */
    canSave: boolean
    onClose: () => void
    onSave: () => void
    saveLabel: string
    /** true enquanto a gravação no serviço está no ar. */
    saving: boolean
}) {
    return (
        <div className="flex flex-none justify-end gap-2.5 border-t border-[#eef0f4] px-5 py-4">
            {/* Anel de foco neutro nos dois botões: o verde do Button global se lê como
          confirmação e não como "aqui está o teclado". O cn do Button passa por
          tailwind-merge, então esta cor substitui a do componente e só ela; a
          espessura e o afastamento do anel continuam vindo de lá. */}
            <Button className={FOOTER_FOCUS_RING_CLASS} onClick={onClose} variant="secondary">Cancelar</Button>
            {/* type button explícito: sem ele o padrão é submit, e um botão de submit
          ao lado de campos de senha é um dos sinais que o navegador usa para
          reconhecer um formulário de credenciais. O drawer não tem form e o
          salvamento é feito no onClick, então nada depende de submit. */}
            {/* `loading` troca o botão travado por um botão trabalhando: a gravação
          passa pelo serviço, e sem esse sinal o modal fica idêntico ao de antes
          do clique enquanto a resposta não chega. */}
            <Button className={FOOTER_FOCUS_RING_CLASS} disabled={!canSave} loading={saving}
                    onClick={onSave}
                    type="button">{saving ? 'Salvando...' : saveLabel}</Button>
        </div>
    )
}
