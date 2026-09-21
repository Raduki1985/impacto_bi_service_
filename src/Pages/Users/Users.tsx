import * as Dialog from '@radix-ui/react-dialog'
import { Edit, Mail, Power, Plus, X } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId, useMemo, useRef, useState } from 'react'

import { DataTable } from '../../components/dashboard/DataTable'
import { Button } from '../../components/ui/button'
import type { User } from '../../data/dashboardTypes'
import {
  activateUser,
  createUser,
  deactivateUser,
  listUsers,
  updateUserDetails,
  type UserCreateFailureReason,
  type UserDetailsUpdateFailureReason,
  type UserStatusChangeFailureReason,
} from '../../services/users/userRepository'
import { listAccessProfiles } from '../../services/accessProfiles/accessProfileRepository'
import { ADMIN_USERS_WRITE_PERMISSION } from '../../config/permissions'
import { useAuth } from '../../contexts/useAuth'
import { profileColorClasses } from '../../lib/profileColors'
import { isValidUserEmail } from '../../lib/userEmail'
import type { AccessProfile, UserProfile } from '../../types/access'
// Superfície e overlay do modal central vêm das peças visuais dos Perfis de
// acesso, e não de uma segunda cópia dos mesmos valores: o padrão do portal é
// uma classe compartilhada, e dois conjuntos de literais para a mesma aparência
// divergiriam na primeira alteração. Só o traço do modal é reaproveitado; o
// modelo de apresentação daquela página continua fora daqui.
import {
  modalOverlayClass,
  modalShellClass,
  RequiredMark,
} from '../AccessProfilesPreview/accessProfilesUi'
import { CoverageTooltipProvider } from '../AccessProfilesPreview/CoverageTooltipProvider'
import { DepartmentCoverageChip } from '../AccessProfilesPreview/DepartmentCoverageChip'
import {
  UNPROFILED_ACCESS_LABEL,
  accessProfileDraftFor,
  accessProfileOptionsFor,
  automaticAccessProfileOption,
  checkAccessProfileSelection,
  findAccessProfileOption,
  initialAccessProfileId,
  userAccessProfileLabel,
  type AccessProfileOption,
  type AccessProfileSelectionFailureReason,
} from './userAccessProfiles'

/** Quantidade fixa de usuários por página. */
const PAGE_SIZE = 10

/** Só Anterior e Próxima: mantêm o cursor de mão enquanto desabilitados, sem
    mexer no Button global e sem perder a semântica do atributo disabled. */
const PAGINATION_DISABLED_CLASSES =
  'disabled:pointer-events-auto disabled:cursor-pointer disabled:hover:bg-white'

const lastAccessPattern = /^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2}$/
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })

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

/** A interface só traduz o motivo; a regra vive no repositório. */
const statusChangeFailureMessages: Record<UserStatusChangeFailureReason, string> = {
  'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
  'self-deactivation': 'Você não pode desativar o próprio usuário.',
  'last-active-administrator': 'O último administrador ativo não pode ser desativado.',
  'storage-failure': 'Não foi possível gravar a alteração. Verifique o navegador e tente novamente.',
}

/**
 * Recusas do Perfil de Acesso, compartilhadas pela criação e pela edição.
 *
 * Cada uma pede uma correção diferente, e por isso nenhuma delas é dobrada na
 * outra: escolha que falta, perfil que não existe mais, perfil desativado,
 * destino incompatível e coleção que não pôde ser lida.
 */
const accessProfileFailureMessages = {
  'access-profile-required': 'Selecione um Perfil de Acesso para este usuário.',
  'unknown-access-profile':
    'O Perfil de Acesso selecionado não existe mais. Escolha um dos perfis disponíveis.',
  'inactive-access-profile':
    'O Perfil de Acesso selecionado está inativo e não aceita novas atribuições.',
  'incompatible-access-profile':
    'O Perfil de Acesso selecionado não serve a este Perfil do Sistema. Escolha um perfil compatível.',
  'access-profile-unavailable':
    'Não foi possível ler os Perfis de Acesso neste navegador. Atualize a página e tente novamente.',
} as const

const detailsUpdateFailureMessages: Record<UserDetailsUpdateFailureReason, string> = {
  'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
  'invalid-name': 'Informe o nome completo do usuário.',
  'invalid-email': 'Informe um e-mail válido.',
  'email-taken': 'Este e-mail já está em uso por outro usuário.',
  'invalid-access-configuration': 'Revise o Perfil de Acesso selecionado.',
  'self-access-change':
    'Você não pode alterar o próprio Perfil do Sistema nem o próprio Perfil de Acesso.',
  'last-active-administrator': 'O último administrador ativo não pode perder esse perfil.',
  'storage-failure': 'Não foi possível gravar a alteração. Verifique o navegador e tente novamente.',
  ...accessProfileFailureMessages,
}

/** Mesmas mensagens da edição nos motivos em comum: o formulário é o mesmo. */
const createFailureMessages: Record<UserCreateFailureReason, string> = {
  'invalid-name': 'Informe o nome completo do usuário.',
  'invalid-email': 'Informe um e-mail válido.',
  'email-taken': 'Este e-mail já está em uso por outro usuário.',
  'invalid-access-configuration': 'Revise o Perfil de Acesso selecionado.',
  'storage-failure': 'Não foi possível gravar o cadastro. Verifique o navegador e tente novamente.',
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
    'Não foi possível ler os Perfis de Acesso neste navegador. Atualize a página e tente novamente.',
}

/** Perfis oficiais, na ordem exibida no select do drawer. */
const USER_PROFILES: UserProfile[] = ['Administrador', 'Executivo', 'Analista']

/** O value do select é string; sem correspondência, mantém o perfil informado. */
function toUserProfile(value: string, fallback: UserProfile): UserProfile {
  return USER_PROFILES.find((profile) => profile === value) ?? fallback
}

/** Drawer fechado (null), em criação ou em edição. */
type DrawerState = { mode: 'create' } | { mode: 'edit'; user: User }

/**
 * Transição de status escolhida no botão da linha e ainda não confirmada. A ação
 * é registrada junto do alvo, e não deduzida do status dele na hora de confirmar:
 * o diálogo descreve exatamente o que foi pedido, sem depender de reler a coleção.
 */
type PendingStatusChange = { user: User; action: 'deactivate' | 'reactivate' }


export function Users() {
  const { user: authenticatedUser, hasPermission } = useAuth()
  const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)
  // Base persistida carregada na montagem e recarregada após cada alteração.
  const [userList, setUserList] = useState(() => listUsers())
  /**
   * Coleção real de Perfis de Acesso, lida uma vez na montagem.
   *
   * Vem depois da leitura dos usuários de propósito: é o repositório de usuários
   * que garante a coleção inicial de perfis e resolve os vínculos legados, e ler
   * os perfis antes disso mostraria a coleção anterior a essa garantia.
   *
   * Esta página não cria, não edita e não desativa perfil nenhum: ela só precisa
   * saber quais existem para oferecer e para nomear o vínculo de cada usuário.
   */
  const [profileCollection] = useState(() => listAccessProfiles())
  const accessProfiles = profileCollection.profiles
  const accessProfilesAvailable = profileCollection.ok
  const [page, setPage] = useState(0)
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  /** Transição de status aguardando a confirmação do administrador. */
  const [statusTarget, setStatusTarget] = useState<PendingStatusChange | null>(null)
  const [feedback, setFeedback] = useState<UserFeedback | null>(null)
  const activeCount = userList.filter((user) => user.status === 'Ativo').length
  const inactiveCount = userList.length - activeCount
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
  const columnWidths = canManageUsers
    ? ['28%', '180px', undefined, '90px', '145px', '100px']
    : ['30%', '180px', undefined, '90px', '145px']

  function refreshUsers() {
    setUserList(listUsers())
  }

  /**
   * Persiste nome, e-mail, perfil e acessos em uma única operação atômica.
   * Devolve a mensagem de erro para o drawer exibir junto ao formulário, ou
   * null no sucesso, quando a tabela é recarregada, o drawer fecha e o feedback
   * aparece na página.
   */
  function saveUserEdit(
    userId: string,
    input: { name: string; email: string; profile: UserProfile; accessProfileId: string | null },
  ): string | null {
    if (!authenticatedUser) {
      return 'Sessão não identificada. Entre novamente para gerenciar usuários.'
    }

    const result = updateUserDetails(userId, input, {
      id: authenticatedUser.id,
      name: authenticatedUser.name,
    })

    if (!result.ok) return detailsUpdateFailureMessages[result.reason]

    if (result.changed) refreshUsers()

    setDrawer(null)
    setFeedback({
      type: 'success',
      message: `${result.user.name} ${result.changed ? 'foi atualizado com sucesso.' : 'já estava com estes dados.'}`,
    })

    return null
  }

  /**
   * Cadastra o usuário com o perfil e os acessos escolhidos no drawer. Mesmo
   * contrato de `saveUserEdit`: devolve a mensagem de erro para o formulário, ou
   * null no sucesso, quando a tabela é recarregada, o drawer fecha e o feedback
   * aparece na página. A senha digitada não chega aqui: ela é validada no
   * formulário e nunca sai dele.
   */
  function saveUserCreate(input: {
    name: string
    email: string
    profile: UserProfile
    accessProfileId: string | null
  }): string | null {
    if (!authenticatedUser) {
      return 'Sessão não identificada. Entre novamente para gerenciar usuários.'
    }

    const result = createUser(input, {
      id: authenticatedUser.id,
      name: authenticatedUser.name,
    })

    if (!result.ok) return createFailureMessages[result.reason]

    // A tabela não tem ordenação e o repositório acrescenta no fim da coleção:
    // a última página da lista recarregada é onde o novo usuário está.
    const nextList = listUsers()
    setUserList(nextList)
    setPage(Math.max(0, Math.ceil(nextList.length / PAGE_SIZE) - 1))

    setDrawer(null)
    setFeedback({ type: 'success', message: `${result.user.name} foi criado com sucesso.` })

    return null
  }

  /** Executa a operação com o ator logado e converte o resultado em feedback. */
  function runStatusChange(
    target: User,
    operation: typeof activateUser,
    messages: { done: string; already: string },
  ) {
    if (!authenticatedUser) {
      setFeedback({ type: 'error', message: 'Sessão não identificada. Entre novamente para gerenciar usuários.' })
      return
    }

    const result = operation(target.id, {
      id: authenticatedUser.id,
      name: authenticatedUser.name,
    })

    if (!result.ok) {
      setFeedback({ type: 'error', message: statusChangeFailureMessages[result.reason] })
      return
    }

    if (result.changed) refreshUsers()

    setFeedback({
      type: 'success',
      message: `${result.user.name} ${result.changed ? messages.done : messages.already}`,
    })
  }

  function handleStatusButtonClick(target: User) {
    setFeedback(null)

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
      runStatusChange(pending.user, deactivateUser, {
        done: 'foi desativado com sucesso.',
        already: 'já estava inativo.',
      })
      return
    }

    runStatusChange(pending.user, activateUser, {
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
          <Button onClick={() => setDrawer({ mode: 'create' })} size="sm">
            <Plus aria-hidden="true" size={15} />
            Novo usuário
          </Button>
        ) : null}
      </div>
      <div className="flex flex-none flex-wrap items-end gap-x-10 gap-y-3">
        <div className="flex gap-7">
          <UserKpi label="Usuários" value={userList.length} valueClassName="text-[#101828]" />
          <UserKpi label="Ativos" value={activeCount} valueClassName="text-[#16a34a]" />
          <UserKpi label="Inativos" value={inactiveCount} valueClassName="text-[#dc2626]" />
        </div>
        <div className="flex gap-7">
          <UserKpi label="Administradores" value={administratorCount} valueClassName="text-[#003be2]" />
          <UserKpi label="Executivos" value={executiveCount} valueClassName="text-[#0369a1]" />
          <UserKpi label="Analistas" value={analystCount} valueClassName="text-[#305522]" />
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
              onEdit={() => {
                setFeedback(null)
                setDrawer({ mode: 'edit', user })
              }}
              onStatusClick={handleStatusButtonClick}
              user={user}
            />
          ))}
        </DataTable>
      </div>
      {/* py-2.5 em vez de py-3: devolve 4px à região da tabela, o suficiente para
          as 10 linhas caberem no monitor grande sem barra de rolagem residual. */}
      <div className="mt-auto flex flex-none flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6e8ee] bg-[#fafbfc] px-4 py-2.5 text-[12.5px] text-[#667085]">
        <div>Mostrando <b className="text-[#344054]">{from}</b>-<b className="text-[#344054]">{to}</b> de <b className="text-[#344054]">{userList.length}</b> usuários</div>
        <div className="flex gap-1.5">
          {/* pointer-events-auto devolve o hit-test ao botão desabilitado (sem ele
              o cursor vem do ancestral); hover neutralizado para não reagir. */}
          <Button className={PAGINATION_DISABLED_CLASSES} disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))} size="sm" variant="secondary">Anterior</Button>
          {Array.from({ length: totalPages }, (_, index) => (
            <Button key={index} onClick={() => setPage(index)} size="sm" variant={safePage === index ? 'primary' : 'secondary'}>{index + 1}</Button>
          ))}
          <Button className={PAGINATION_DISABLED_CLASSES} disabled={safePage >= totalPages - 1} onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} size="sm" variant="secondary">Próxima</Button>
        </div>
      </div>
      {canManageUsers ? (
        <UserDialog
          accessProfiles={accessProfiles}
          accessProfilesAvailable={accessProfilesAvailable}
          editingUser={drawer?.mode === 'edit' ? drawer.user : null}
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
    </div>
  )
}

type UserTableRowProps = {
  user: User
  accessProfiles: readonly AccessProfile[]
  canManageUsers: boolean
  onEdit?: () => void
  onStatusClick?: (user: User) => void
}

function UserTableRow({
  user,
  accessProfiles,
  canManageUsers,
  onEdit,
  onStatusClick,
}: UserTableRowProps) {
  // Um único valor por usuário: o nome do Perfil de Acesso ao qual ele está
  // vinculado, ou o estado de quem não tem vínculo válido. O vínculo gravado é
  // sempre confrontado com a coleção real, e não exibido por si só.
  const accessProfileLabel = userAccessProfileLabel(user, accessProfiles)
  const lastAccessWeekday = weekdayFromLastAccess(user.lastAccess)

  return (
    <tr className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${profileColorClasses[user.profile]}`}>{user.initials}</span>
          {/* min-w-0 é o que permite truncar dentro do flex; sem ele o texto
              empurraria a coluna e desfaria a largura fixa. */}
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-medium text-[#1a2331]" title={user.name}>{user.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-[#98a2b3]" title={user.email}>{user.email}</span>
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5"><ProfileBadge profile={user.profile} /></td>
      <td className="px-4 py-2.5 text-[#475467]">
        <span className="block truncate" title={accessProfileLabel}>{accessProfileLabel}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5"><StatusBadge status={user.status} /></td>
      <td className="whitespace-nowrap px-4 py-2.5 text-[#98a2b3]" title={lastAccessWeekday ?? undefined}>{user.lastAccess}</td>
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
              <Edit size={14} aria-hidden="true" />
            </button>
            <button
              aria-label={user.status === 'Ativo' ? `Desativar ${user.name}` : `Reativar ${user.name}`}
              className={`flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#e4e7ee] ${user.status === 'Ativo' ? 'text-[#e5484d] hover:bg-[#fdf3f3]' : 'text-[#16a34a] hover:bg-[#f2fbf5]'}`}
              onClick={() => onStatusClick?.(user)}
              title={user.status === 'Ativo' ? `Desativar ${user.name}` : `Reativar ${user.name}`}
              type="button"
            >
              <Power size={14} aria-hidden="true" />
            </button>
          </div>
        </td>
      ) : null}
    </tr>
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
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
function UserKpi({ label, value, valueClassName }: { label: string; value: number; valueClassName: string }) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold uppercase text-[#667085]">{label}</div>
      <div className={`mt-1 font-mono text-[22px] font-semibold ${valueClassName}`}>{value}</div>
    </div>
  )
}

function ProfileBadge({ profile }: { profile: User['profile'] }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${profileColorClasses[profile]}`}>{profile}</span>
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'Ativo'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${active ? 'bg-[#dcfce7] text-[#16794a]' : 'bg-[#f1f3f7] text-[#98a2b3]'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
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
  /** Coleção real de Perfis de Acesso, do perfil do sistema aos comuns. */
  accessProfiles: readonly AccessProfile[]
  /** false quando a coleção não pôde ser lida: sem ela não há escolha a oferecer. */
  accessProfilesAvailable: boolean
  onOpenChange: (open: boolean) => void
  /** Persiste a edição; devolve a mensagem de erro, ou null em caso de sucesso. */
  onSaveEdit: (
    userId: string,
    input: { name: string; email: string; profile: UserProfile; accessProfileId: string | null },
  ) => string | null
  /** Persiste o cadastro; mesmo contrato da edição. A senha não faz parte da
      entrada: ela é validada aqui e não é enviada ao repositório. */
  onSaveCreate: (input: {
    name: string
    email: string
    profile: UserProfile
    accessProfileId: string | null
  }) => string | null
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
  const [profile, setProfile] = useState<UserProfile>(editingUser?.profile ?? 'Analista')
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
  /** Conteúdo rolável do modal; a mensagem de erro fica no topo dele. */
  const contentRef = useRef<HTMLDivElement>(null)
  const profileFieldId = useId()

  /**
   * Opções do seletor: somente perfis ATIVOS e COMPATÍVEIS com o Perfil do
   * Sistema em vigor no formulário, e não com o que está gravado. Trocar para
   * Administrador já mostra a lista dele antes de qualquer gravação.
   */
  const options = useMemo(
    () => accessProfileOptionsFor(accessProfiles, profile),
    [accessProfiles, profile],
  )
  /** Administrador recebe `Acesso do Sistema` automaticamente e não escolhe. */
  const automaticOption = automaticAccessProfileOption(options, profile)
  // Valor efetivo do campo, derivado no render: uma escolha que deixou de ser
  // oferecida nunca vira o valor exibido, e o perfil automático vence qualquer
  // rascunho anterior.
  const selectedId = accessProfileDraftFor(options, profile, accessProfileDraft)
  const selectedOption = findAccessProfileOption(options, selectedId)
  const emailValid = isValidUserEmail(email)
  const emailError = emailTouched && !emailValid ? 'Informe um e-mail válido.' : null
  /**
   * Estado da escolha, e é ele que habilita o botão Salvar.
   *
   * A conferência não é `accessProfileId !== null`: o id é confrontado com as
   * opções oferecidas, que já são o recorte do domínio, então perfil inexistente,
   * inativo e de outro destino mantêm o salvamento bloqueado com orientação
   * própria, em vez de virarem erro depois do clique.
   */
  const selection = checkAccessProfileSelection(options, selectedId, accessProfilesAvailable)
  /** Usuário em edição cujo vínculo gravado não vale mais. */
  const hasUnprofiledAccess =
    editingUser !== null && initialAccessProfileId(editingUser, accessProfiles) === null

  /**
   * Troca do Perfil do Sistema.
   *
   * A seleção passa pelas opções do perfil NOVO: o que deixou de ser compatível
   * sai do rascunho no mesmo movimento, em vez de ficar escondido no estado
   * pronto para reaparecer. Administrador recebe `Acesso do Sistema` na hora,
   * porque para ele não existe escolha.
   */
  function handleSystemProfileChange(value: string) {
    const next = toUserProfile(value, profile)

    setProfile(next)
    setAccessProfileDraft((current) =>
      accessProfileDraftFor(accessProfileOptionsFor(accessProfiles, next), next, current),
    )
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

  // Operação síncrona no mock: sem estado de processamento; o modal fecha (ou
  // mostra o erro) na mesma interação, então não há como reenviar no meio.
  // Qualquer erro mantém o modal aberto, com os campos preenchidos e a mensagem
  // visível; só o sucesso fecha, e quem fecha é o pai, ao zerar o alvo do modal.
  function handleSave() {
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

    const accessProfileId = selection.option.id

    if (!editingUser) {
      const error = onSaveCreate({ name, email, profile, accessProfileId })
      // Recusa mantém tudo como está, para o administrador corrigir só o que foi
      // apontado.
      if (error) showFormError(error)

      return
    }

    const error = onSaveEdit(editingUser.id, { name, email, profile, accessProfileId })
    if (error) showFormError(error)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={modalOverlayClass} />
        {/* Largura intermediária e altura acompanhando o conteúdo até o limite da
            viewport: o formulário é curto, e esticá-lo até a tela inteira
            deixaria uma faixa branca sem função. `max-w` em `vw` impede rolagem
            horizontal em qualquer largura. */}
        <Dialog.Content
          className={`${modalShellClass} max-h-[92vh] max-w-[calc(100vw-24px)] sm:max-h-[88vh] sm:w-[560px]`}
        >
          <div className="flex flex-none items-start justify-between gap-3 border-b border-[#eef0f4] px-5 py-4">
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
                <X size={18} />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5" ref={contentRef}>
            {formError ? (
              <div className="mb-4 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3.5 py-2 text-[12.5px] font-medium text-[#b42318]" role="alert">
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
              Perfil do Sistema {isOwnAccount ? null : <RequiredMark />}
            </label>
            {/* Mesma causa do FormInput: fundo branco fixo exige cor própria. */}
            <select
              className={`mb-4 w-full cursor-pointer rounded-lg border ${FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
              disabled={isOwnAccount}
              id={profileFieldId}
              onChange={(event) => handleSystemProfileChange(event.target.value)}
              value={profile}
            >
              {USER_PROFILES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <AccessProfileField
              automaticOption={automaticOption}
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
            <FirstAccessNotice isEditing={isEditing} />
          </div>
          <DialogFooter
            // Sem Perfil de Acesso válido não existe usuário a gravar: a recusa
            // aparece como botão desabilitado, e não como erro depois do clique.
            canSave={selection.ok && emailValid}
            onClose={() => onOpenChange(false)}
            onSave={handleSave}
            saveLabel={isEditing ? 'Salvar alterações' : 'Salvar usuário'}
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
 * A lista traz somente perfis ativos e compatíveis com o Perfil do Sistema em
 * vigor. Administrador e Executivo continuam com tratamentos diferentes por um
 * motivo só: o Administrador tem exatamente uma opção possível, e por isso o
 * campo aparece bloqueado com o valor visível, no mesmo cinza dos demais campos
 * bloqueados; o Executivo escolhe entre os perfis executivos.
 *
 * Depois da escolha, os departamentos aparecem como labels logo abaixo do
 * campo. Cada label reutiliza o detalhamento de páginas da tela Perfis de
 * acesso, disponível por mouse, teclado e toque. Sem seleção, nenhum label é
 * exibido.
 */
function AccessProfileField({
  automaticOption,
  disabled,
  hasUnprofiledAccess,
  isOwnAccount,
  onSelect,
  options,
  selectedId,
  selectionFailureReason,
  selectedOption,
}: {
  /** Perfil definido pelo Perfil do Sistema, ou null quando é escolhido. */
  automaticOption: AccessProfileOption | null
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

  const automatic = automaticOption !== null
  const invalid = selectionFailureReason !== null && selectionFailureReason !== 'required'

  return (
    <>
      <label
        className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
        htmlFor={fieldId}
      >
        {/* Sem marca quando o campo não é escolha: o Administrador recebe o
            `Acesso do Sistema` automaticamente, e a própria conta não edita o
            próprio acesso. */}
        Perfil de Acesso {disabled || automatic ? null : <RequiredMark />}
      </label>
      <div>
        <select
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          className={`w-full cursor-pointer rounded-lg border ${invalid ? FIELD_ERROR_BORDER_CLASS : FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
          disabled={disabled || automatic}
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
        automatic={automatic}
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
  automatic,
  failureReason,
  hasUnprofiledAccess,
  id,
  isOwnAccount,
}: {
  /** true quando o perfil vem do Perfil do Sistema e não é escolhido. */
  automatic: boolean
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

  if (automatic) {
    return (
      <HintText id={id}>
        O Perfil de Acesso do Administrador é definido automaticamente pelo Perfil do Sistema.
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
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 border-b border-[#eef0f4] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#667085]">
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
        {label} {required ? <RequiredMark /> : null}
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
 * Duas leituras diferentes, e por isso dois textos. No cadastro o aviso descreve
 * o que vai acontecer com aquela pessoa ao salvar. Na edição ele responde a outra
 * pergunta, a de quem procura onde troca a senha de alguém e não encontra campo
 * nenhum.
 *
 * A segunda linha é a ressalva do estado atual, no mesmo tom que o aviso dos
 * campos de senha já usava: o envio depende do serviço, e ele ainda não existe.
 * Ela sai quando o envio passar a acontecer de verdade, e nada mais deste bloco
 * precisa mudar junto.
 *
 * PENDENTE DO LADO DO SERVIÇO, a combinar com o André antes de qualquer código
 * novo aqui: o envio do e-mail e o que ele responde ao portal quando falha, a
 * validade e o uso único do link, e por onde reenviar o convite a quem não
 * recebeu, que provavelmente é uma ação na lista de usuários.
 */
function FirstAccessNotice({ isEditing }: { isEditing: boolean }) {
  return (
    <div className="mb-1 flex items-start gap-2.5 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3.5 py-3">
      <Mail aria-hidden="true" className="mt-0.5 flex-none text-[#98a2b3]" size={15} />
      <div className="min-w-0 space-y-1">
        <p className="text-[12.5px] leading-5 text-[#475467]">
          {isEditing
            ? 'A senha é definida pelo próprio usuário, pelo link de primeiro acesso que ele recebe por e-mail. Ela não é cadastrada nem alterada nesta tela.'
            : 'Ao salvar, o usuário recebe no e-mail cadastrado um link de primeiro acesso, e é nele que cria a própria senha.'}
        </p>
        <p className="text-[11.5px] leading-4 text-[#98a2b3]">
          O envio ainda não está ativo: ele entra junto com a autenticação real,
          na conexão com o banco.
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
}: {
  /** false enquanto não houver Perfil de Acesso válido para gravar. */
  canSave: boolean
  onClose: () => void
  onSave: () => void
  saveLabel: string
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
      <Button className={FOOTER_FOCUS_RING_CLASS} disabled={!canSave} onClick={onSave} type="button">{saveLabel}</Button>
    </div>
  )
}
