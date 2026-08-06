import * as Dialog from '@radix-ui/react-dialog'
import { Edit, Eye, EyeOff, Power, Plus, X } from 'lucide-react'
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
  type UserAccessConfig,
  type UserCreateFailureReason,
  type UserDetailsUpdateFailureReason,
  type UserStatusChangeFailureReason,
} from '../../services/users/userRepository'
import { ADMIN_USERS_WRITE_PERMISSION } from '../../config/permissions'
import { useAuth } from '../../contexts/useAuth'
import { profileColorClasses } from '../../lib/profileColors'
import type { UserProfile } from '../../types/access'
import {
  UNPROFILED_ACCESS_LABEL,
  analystAccessProfileDraft,
  analystAccessProfileOptions,
  automaticAccessProfile,
  initialAccessProfileId,
  recognizeUserAccessProfile,
  resolveUserAccessConfig,
  userAccessProfileLabel,
  type UserAccessConfigFailureReason,
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
}

/** Mesmas mensagens da edição nos motivos em comum: o formulário é o mesmo. */
const createFailureMessages: Record<UserCreateFailureReason, string> = {
  'invalid-name': 'Informe o nome completo do usuário.',
  'invalid-email': 'Informe um e-mail válido.',
  'email-taken': 'Este e-mail já está em uso por outro usuário.',
  'invalid-access-configuration': 'Revise o Perfil de Acesso selecionado.',
  'storage-failure': 'Não foi possível gravar o cadastro. Verifique o navegador e tente novamente.',
}

/** Mensagens das recusas que a própria página avalia, antes do repositório. */
const accessConfigFailureMessages: Record<UserAccessConfigFailureReason, string> = {
  'access-profile-required': 'Selecione um Perfil de Acesso para o Analista.',
  'current-access-not-preservable':
    'Os acessos atuais deste usuário não podem ser reproduzidos pelo fluxo atual, e salvar agora os regravaria sem escolha explícita. Para prosseguir, altere deliberadamente o Perfil do Sistema ou o Perfil de Acesso.',
}

/**
 * A mesma recusa na própria conta.
 *
 * Mandar alterar deliberadamente o Perfil do Sistema ou o Perfil de Acesso seria
 * falso aqui: os dois campos estão bloqueados justamente porque ninguém altera
 * os próprios acessos. A saída real é outro Administrador corrigir a
 * configuração, e é isso que a mensagem diz.
 */
const OWN_ACCOUNT_ACCESS_NOT_PRESERVABLE_MESSAGE =
  'Os acessos atuais desta conta não podem ser reproduzidos pelo fluxo atual, e salvar regravaria os seus acessos. Como você não pode alterar o próprio Perfil do Sistema nem o próprio Perfil de Acesso, estes dados não podem ser salvos aqui: outro Administrador precisa corrigir esta configuração.'

/** Texto da recusa conforme o alvo da edição. */
function accessConfigFailureMessage(
  reason: UserAccessConfigFailureReason,
  isOwnAccount: boolean,
): string {
  return reason === 'current-access-not-preservable' && isOwnAccount
    ? OWN_ACCOUNT_ACCESS_NOT_PRESERVABLE_MESSAGE
    : accessConfigFailureMessages[reason]
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

/** Conferência em tempo real entre a senha e a confirmação. */
type PasswordMatchState = 'neutral' | 'diverged' | 'matched'

/**
 * Estado da conferência, tolerante à digitação em andamento: enquanto a
 * confirmação for apenas o começo correto da senha, nada é apontado, para o
 * campo não acusar erro a cada tecla de quem está digitando certo.
 *
 * A ordem das verificações importa. Uma confirmação idêntica também é prefixo
 * dela mesma, então a igualdade é avaliada antes do prefixo; caso contrário o
 * acerto completo seria tratado como digitação em andamento.
 *
 * Comparação exata, a mesma do salvamento: sem trim, sem conversão e sem
 * normalização. É ajuda visual, não validação: quem recusa o cadastro continua
 * sendo `passwordDraftError`.
 */
function passwordMatchState(password: string, confirmation: string): PasswordMatchState {
  if (confirmation === '') return 'neutral'
  if (password === confirmation) return 'matched'
  // Confirmação mais longa que a senha, ou que divergiu no meio, cai aqui.
  if (password.startsWith(confirmation)) return 'neutral'

  return 'diverged'
}

/**
 * Senha do cadastro mockado: obrigatória, confirmada e comparada exatamente
 * como digitada. Validada apenas no formulário, porque o portal ainda não
 * autentica e nenhuma credencial é enviada ao repositório ou persistida.
 */
function passwordDraftError(password: string, confirmation: string): string | null {
  if (!password) return 'Informe uma senha para o novo usuário.'
  if (!confirmation) return 'Confirme a senha do novo usuário.'
  if (password !== confirmation) return 'A senha e a confirmação de senha precisam ser iguais.'

  return null
}

export function Users() {
  const { user: authenticatedUser, hasPermission } = useAuth()
  const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)
  // Base persistida carregada na montagem e recarregada após cada alteração.
  const [userList, setUserList] = useState(() => listUsers())
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
    input: { name: string; email: string; access: UserAccessConfig },
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
    access: UserAccessConfig
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
          Perfis de acesso: título, linha de apoio e o filete que separa o
          cabeçalho do conteúdo administrativo. A descrição acompanha a permissão
          já calculada em `canManageUsers`, e não uma segunda regra: quem gerencia
          lê "Gerencie", quem só consulta lê "Consulte". O botão Novo usuário não
          sobe para cá: ele continua na linha dos indicadores. */}
      <div className="flex-none border-b border-[#eef0f4] pb-4">
        <h2 className="text-base font-bold text-[#1a2331]">Usuários</h2>
        <p className="mt-1 text-[13px] text-[#667085]">
          {canManageUsers
            ? 'Gerencie usuários, Perfis do Sistema e acessos vinculados ao portal.'
            : 'Consulte usuários, Perfis do Sistema e acessos vinculados ao portal.'}
        </p>
      </div>
      <div className="flex flex-none flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <div className="flex gap-7">
            <UserKpi label="Usuários" value={userList.length} valueClassName="text-[#101828]" />
            <UserKpi label="Ativos" value={activeCount} valueClassName="text-[#16a34a]" />
            <UserKpi label="Inativos" value={inactiveCount} valueClassName="text-[#dc2626]" />
          </div>
          <div className="flex gap-7">
            <UserKpi label="Administradores" value={administratorCount} valueClassName="text-[#2f6bff]" />
            <UserKpi label="Executivos" value={executiveCount} valueClassName="text-[#0369a1]" />
            <UserKpi label="Analistas" value={analystCount} valueClassName="text-[#305522]" />
          </div>
        </div>
        {canManageUsers ? (
          <Button onClick={() => setDrawer({ mode: 'create' })}><Plus size={15} aria-hidden="true" />Novo usuário</Button>
        ) : null}
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
  canManageUsers: boolean
  onEdit?: () => void
  onStatusClick?: (user: User) => void
}

function UserTableRow({ user, canManageUsers, onEdit, onStatusClick }: UserTableRowProps) {
  // Um único valor por usuário: o Perfil de Acesso reconhecido pela combinação
  // gravada, ou o estado de leitura de quem não corresponde a nenhum perfil
  // aprovado. Departamentos e permissões não são mais concatenados aqui.
  const accessProfileLabel = userAccessProfileLabel(user)
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
  onOpenChange: (open: boolean) => void
  /** Persiste a edição; devolve a mensagem de erro, ou null em caso de sucesso. */
  onSaveEdit: (
    userId: string,
    input: { name: string; email: string; access: UserAccessConfig },
  ) => string | null
  /** Persiste o cadastro; mesmo contrato da edição. A senha não faz parte da
      entrada: ela é validada aqui e não é enviada ao repositório. */
  onSaveCreate: (input: {
    name: string
    email: string
    access: UserAccessConfig
  }) => string | null
}

function UserDialog({
  open,
  editingUser,
  isOwnAccount,
  onOpenChange,
  onSaveEdit,
  onSaveCreate,
}: UserDialogProps) {
  const isEditing = editingUser !== null
  // O pai remonta o drawer via key a cada abertura, então o estado inicial já
  // nasce com os dados do usuário em edição, sem efeito de sincronização.
  const [name, setName] = useState(editingUser?.name ?? '')
  const [email, setEmail] = useState(editingUser?.email ?? '')
  const [profile, setProfile] = useState<UserProfile>(editingUser?.profile ?? 'Analista')
  // Dois papéis distintos, deliberadamente separados.
  //
  // O primeiro é o perfil reconhecido na abertura, usado unicamente para
  // distinguir uma escolha nova de um campo apenas preenchido: sem ele, reabrir
  // e salvar valeria como decisão de trocar os acessos.
  const loadedAccessProfileId = initialAccessProfileId(editingUser)
  // O segundo é o rascunho do seletor do Analista, que só aceita valores
  // existentes entre as opções: um perfil automático nunca vira valor deste
  // campo, e a ausência de escolha é sempre null, nunca uma opção arbitrária.
  // O rascunho sobrevive a uma passagem pelos perfis automáticos, então voltar
  // para Analista encontra a escolha onde ela estava.
  const [accessProfileDraft, setAccessProfileDraft] = useState(() =>
    analystAccessProfileDraft(loadedAccessProfileId),
  )
  // Só o cadastro usa estes dois campos, e apenas em memória: o drawer é
  // remontado a cada abertura, então o que foi digitado morre no fechamento.
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  /**
   * Recusa do próprio seletor, publicada só depois de uma tentativa de salvar.
   *
   * A falta de Perfil de Acesso pertence a um campo só, e por isso é apontada
   * nele, e não no alerta do topo, que continua reservado às falhas que não têm
   * um campo único a apontar. Antes da primeira tentativa a linha de apoio segue
   * neutra: orientar não é acusar.
   */
  const [accessProfileRejected, setAccessProfileRejected] = useState(false)
  /** Conteúdo rolável do drawer; a mensagem de erro fica no topo dele. */
  const contentRef = useRef<HTMLDivElement>(null)
  /** Seletor de Perfil de Acesso, para levar o foco até a recusa dele. */
  const accessProfileFieldRef = useRef<HTMLSelectElement>(null)
  // Conferência derivada no render, sem estado próprio: qualquer tecla em um dos
  // dois campos já recalcula o estado, inclusive quando a senha muda depois da
  // confirmação. Na edição os campos ficam desabilitados e vazios, então não há
  // o que conferir.
  const matchState = isEditing ? 'neutral' : passwordMatchState(password, passwordConfirmation)
  // Só a confirmação ganha cor de conferência; o campo Senha mantém sempre a
  // borda padrão. As cores são as mesmas da mensagem logo abaixo dos campos.
  //
  // Nos dois estados coloridos o foco também é assumido aqui: sem isso, o
  // contorno padrão do navegador é desenhado por cima da borda e esconde
  // justamente a cor que informa o resultado da conferência. Só o contorno
  // nativo é suprimido, e nada é acrescentado no lugar: a borda mantém a mesma
  // espessura com e sem foco, e apenas a cor distingue os estados. O estado
  // neutro usa FIELD_BORDER_CLASS, que segue o mesmo princípio: borda de 1px,
  // sem outline nativo e sem ring, mudando apenas para o cinza #667085 ao
  // receber foco, igual aos campos Nome completo, E-mail, Perfil e Senha.
  const confirmationFieldClass =
    matchState === 'matched'
      ? 'border-[#16794a] focus:outline-none'
      : matchState === 'diverged'
        ? 'border-[#b42318] focus:outline-none'
        : FIELD_BORDER_CLASS
  const profileFieldId = useId()
  const accessProfileFieldId = useId()
  /** Linha de apoio do Perfil de Acesso, sempre descrita pelo próprio seletor. */
  const accessProfileHintId = useId()
  // Perfil de Acesso automático do Perfil do Sistema selecionado agora, e não do
  // que está salvo: trocar para Administrador já mostra Acesso do Sistema no campo,
  // antes de qualquer gravação.
  const automaticProfile = automaticAccessProfile(profile)
  /** Usuário em edição cuja combinação gravada não corresponde a perfil aprovado. */
  const hasUnprofiledAccess =
    editingUser !== null && recognizeUserAccessProfile(editingUser) === null
  /** Escolha nova de Perfil de Acesso, e não campo apenas preenchido. */
  const accessProfileChanged = isEditing && accessProfileDraft !== loadedAccessProfileId
  // Entrada do repositório conforme o Perfil do Sistema e o Perfil de Acesso
  // escolhidos, derivada no render: é ela que diz, antes do clique, se ainda
  // falta escolher um perfil e se o acesso atual pode seguir intocado. Sem
  // alteração deliberada, nenhuma configuração de perfil aprovado sai daqui.
  const accessResolution = resolveUserAccessConfig({
    systemProfile: profile,
    accessProfileId: accessProfileDraft,
    loadedAccessProfileId,
    currentUser: editingUser,
  })

  /**
   * Troca do Perfil do Sistema. O rascunho do Analista é deliberadamente
   * mantido, e não recalculado a partir do perfil novo: passar por
   * Administrador ou Executivo e voltar precisa reencontrar a mesma escolha, e
   * nenhum perfil departamental pode ser escolhido por conta própria no
   * caminho. O rascunho já é sempre uma opção válida ou null, então não há
   * sincronização a fazer, e nenhum efeito é necessário para manter os dois
   * campos coerentes.
   */
  function handleSystemProfileChange(value: string) {
    setProfile(toUserProfile(value, profile))
    // A recusa descreve a última tentativa de salvar, e o formulário acabou de
    // mudar: Administrador e Executivo nem precisam da escolha, e voltar para
    // Analista sem seleção reencontra a orientação neutra, não a
    // acusação. O vermelho só volta com uma nova tentativa.
    setAccessProfileRejected(false)
  }

  /**
   * Leva o foco ao seletor recusado. O conteúdo do drawer rola e o rodapé é
   * fixo, então a tentativa pode ter partido de um ponto onde o campo não está
   * visível: ele é trazido para a vista antes de receber o foco, e `nearest`
   * evita mover a tela quando ele já está aparecendo.
   */
  function focusAccessProfileField() {
    const field = accessProfileFieldRef.current
    if (!field) return

    field.scrollIntoView({ block: 'nearest' })
    field.focus()
  }

  /**
   * Publica o erro e devolve o topo do conteúdo ao campo de visão: a mensagem
   * fica acima do formulário, e o botão Salvar vive no rodapé fixo, então uma
   * recusa disparada com o drawer rolado até os acessos deixaria a mensagem
   * fora da tela.
   *
   * A rolagem é imperativa, e não derivada de `formError`, porque a mesma
   * mensagem pode se repetir em duas tentativas seguidas: sem mudança de estado
   * não haveria novo render para reagir.
   */
  function showFormError(message: string) {
    setFormError(message)

    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  // Operação síncrona no mock: sem estado de processamento; o drawer fecha (ou
  // mostra o erro) na mesma interação, então não há como reenviar no meio.
  // Qualquer erro mantém o drawer aberto, com os campos preenchidos e a mensagem
  // visível; só o sucesso fecha, e quem fecha é o pai, ao zerar o alvo do drawer.
  function handleSave() {
    // Tentativa nova começa sem a mensagem da anterior.
    setFormError(null)

    // Perfil de Acesso antes do repositório, na ordem em que os campos aparecem:
    // sem um acesso válido para gravar, o salvamento não é nem tentado, e o
    // acesso atual continua exatamente como está.
    if (!accessResolution.ok) {
      // Falta de escolha é recusa de um campo só: ela aparece uma única vez, no
      // próprio seletor, que recebe o foco. As demais recusas continuam no
      // alerta do topo, com os mesmos textos e as mesmas prioridades.
      if (accessResolution.reason === 'access-profile-required') {
        setAccessProfileRejected(true)
        focusAccessProfileField()
        return
      }

      showFormError(accessConfigFailureMessage(accessResolution.reason, isOwnAccount))
      return
    }

    const access = accessResolution.access

    if (!editingUser) {
      // Senha antes do repositório: sem ela, o cadastro não é nem tentado.
      const passwordError = passwordDraftError(password, passwordConfirmation)
      if (passwordError) {
        showFormError(passwordError)
        return
      }

      const error = onSaveCreate({ name, email, access })
      // Recusa mantém tudo como está, inclusive as senhas, para o administrador
      // corrigir só o que foi apontado.
      if (error) {
        showFormError(error)
        return
      }

      // Cadastro aceito: o que foi digitado nos campos de senha não precisa
      // sobreviver ao fechamento do drawer.
      setPassword('')
      setPasswordConfirmation('')

      return
    }

    const error = onSaveEdit(editingUser.id, { name, email, access })
    if (error) showFormError(error)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[452px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_34px_rgba(16,24,40,.18)]">
          <div className="flex items-center justify-between border-b border-[#eef0f4] px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-bold text-[#101828]">{isEditing ? 'Editar usuário' : 'Novo usuário'}</Dialog.Title>
              <Dialog.Description className="text-xs text-[#98a2b3]">{isEditing ? 'Atualização de dados, Perfil do Sistema e Perfil de Acesso' : 'Cadastro de acesso ao BI'}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button aria-label="Fechar" size="icon" variant="ghost"><X size={18} /></Button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5" ref={contentRef}>
            {formError ? (
              <div className="mb-4 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3.5 py-2 text-[12.5px] font-medium text-[#b42318]" role="alert">
                {formError}
              </div>
            ) : null}
            <SectionTitle>Dados básicos</SectionTitle>
            <FormInput label="Nome completo" onChange={(event) => setName(event.target.value)} placeholder="Ex.: João da Silva" value={name} />
            {/* Nome próprio do cadastro e autoComplete off: este e-mail é o de um
                usuário sendo cadastrado por um administrador, não o login de quem
                está usando o portal, e não deve ser lido como tal. */}
            <FormInput
              autoComplete="off"
              label="E-mail"
              name="new-user-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@impactotelecom.com"
              type="email"
              value={email}
            />
            <label
              className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
              htmlFor={profileFieldId}
            >
              Perfil do Sistema
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
            <label
              className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
              htmlFor={accessProfileFieldId}
            >
              Perfil de Acesso
            </label>
            {/* Campo único: um usuário tem um Perfil de Acesso, e ele define os
                departamentos e as páginas que serão visualizados. Administrador
                e Executivo têm o perfil definido pelo Perfil do Sistema, e por
                isso o campo fica bloqueado, com o valor visível e o mesmo
                tratamento cinza dos demais campos bloqueados do drawer. */}
            <select
              aria-describedby={accessProfileHintId}
              aria-invalid={accessProfileRejected || undefined}
              className={`w-full cursor-pointer rounded-lg border ${accessProfileRejected ? FIELD_ERROR_BORDER_CLASS : FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
              disabled={isOwnAccount || automaticProfile !== null}
              id={accessProfileFieldId}
              onChange={(event) => {
                setAccessProfileDraft(analystAccessProfileDraft(event.target.value || null))
                // A recusa era da tentativa anterior: o campo acabou de mudar.
                setAccessProfileRejected(false)
              }}
              ref={accessProfileFieldRef}
              value={automaticProfile ? automaticProfile.id : (accessProfileDraft ?? '')}
            >
              {automaticProfile ? (
                <option value={automaticProfile.id}>{automaticProfile.name}</option>
              ) : (
                <>
                  {/* Posição vazia do seletor, que não é perfil do catálogo:
                      na edição de quem não tem perfil aprovado ela carrega o
                      estado atual, para o campo nunca parecer vazio, e mantém
                      os acessos como estão; no cadastro é o pedido de escolha. */}
                  {accessProfileDraft === null || hasUnprofiledAccess ? (
                    <option value="">
                      {hasUnprofiledAccess ? UNPROFILED_ACCESS_LABEL : 'Selecione um Perfil de Acesso'}
                    </option>
                  ) : null}
                  {analystAccessProfileOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </>
              )}
            </select>
            <AccessProfileHint
              accessProfileChanged={accessProfileChanged}
              accessProfileDraft={accessProfileDraft}
              automaticProfileName={automaticProfile?.name ?? null}
              failureReason={accessResolution.ok ? null : accessResolution.reason}
              hasUnprofiledAccess={hasUnprofiledAccess}
              id={accessProfileHintId}
              isOwnAccount={isOwnAccount}
              rejected={accessProfileRejected}
            />
            <div className="grid grid-cols-2 gap-3">
              <PasswordField
                disabled={isEditing}
                label="Senha"
                name="new-user-password"
                onValueChange={setPassword}
                stateClassName={FIELD_BORDER_CLASS}
                value={password}
              />
              <PasswordField
                disabled={isEditing}
                label="Confirmar senha"
                name="new-user-password-confirmation"
                onValueChange={setPasswordConfirmation}
                stateClassName={confirmationFieldClass}
                value={passwordConfirmation}
              />
            </div>
            {/* Mesmo -mt-3 mb-4 de antes, agora no bloco: a conferência entra
                como uma linha a mais junto dos campos, sem abrir espaço extra
                entre Dados básicos e Acessos. */}
            <div className="-mt-3 mb-4 space-y-1">
              {matchState === 'neutral' ? null : (
                <p
                  className={`text-[11.5px] font-medium ${
                    matchState === 'matched' ? 'text-[#16794a]' : 'text-[#b42318]'
                  }`}
                >
                  {matchState === 'matched'
                    ? 'As senhas coincidem.'
                    : 'As senhas não coincidem.'}
                </p>
              )}
              <p className="text-[11.5px] text-[#98a2b3]">
                {isEditing
                  ? 'Senha indisponível: a autenticação real ainda não foi implementada.'
                  : 'A autenticação real ainda não foi implementada: a senha é apenas confirmada neste formulário e não fica armazenada.'}
              </p>
            </div>
          </div>
          <DialogFooter
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
 * Linha de apoio do Perfil de Acesso, sempre presente e sempre em texto: ela
 * carrega a informação que o seletor não consegue mostrar sozinho, e nenhuma
 * das situações depende de cor para ser entendida.
 *
 * A ordem é a da urgência. O acesso que o fluxo atual não consegue reproduzir
 * vem primeiro, porque impede o salvamento e vale inclusive na própria conta,
 * onde nada é editável. Depois vem a nota da autoedição, que explica os dois
 * campos bloqueados. Só então as situações comuns: perfil vindo do Perfil do
 * Sistema, escolha ainda pendente, acesso atual preservado enquanto nada for
 * escolhido, e substituição anunciada quando um perfil novo foi escolhido.
 */
function AccessProfileHint({
  automaticProfileName,
  accessProfileDraft,
  accessProfileChanged,
  hasUnprofiledAccess,
  failureReason,
  isOwnAccount,
  id,
  rejected,
}: {
  /** Nome do perfil automático, ou null no Analista. */
  automaticProfileName: string | null
  /** Escolha atual do seletor do Analista; null é ausência de escolha. */
  accessProfileDraft: string | null
  /** true quando o seletor saiu do perfil reconhecido na abertura. */
  accessProfileChanged: boolean
  hasUnprofiledAccess: boolean
  /** Recusa já calculada para o estado atual do formulário, ou null. */
  failureReason: UserAccessConfigFailureReason | null
  isOwnAccount: boolean
  /** Alvo do `aria-describedby` do seletor, em qualquer uma das situações. */
  id: string
  /** true depois de uma tentativa de salvar sem Perfil de Acesso escolhido. */
  rejected: boolean
}) {
  if (failureReason === 'current-access-not-preservable') {
    // Na própria conta os dois campos estão bloqueados, então orientar uma
    // alteração deliberada seria orientar algo impossível.
    return isOwnAccount ? (
      <HintText id={id} tone="attention">
        Os acessos atuais desta conta não podem ser reproduzidos pelo fluxo atual, e salvar
        regravaria os seus acessos. Como você não pode alterar o próprio Perfil do Sistema nem o
        próprio Perfil de Acesso, estes dados não podem ser salvos aqui: outro Administrador precisa
        corrigir esta configuração.
      </HintText>
    ) : (
      <HintText id={id} tone="attention">
        Os acessos atuais deste usuário não podem ser reproduzidos pelo fluxo atual: salvar agora os
        regravaria sem escolha explícita. Altere deliberadamente o Perfil do Sistema ou o Perfil de
        Acesso para prosseguir.
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

  if (automaticProfileName) {
    return (
      <HintText id={id}>{`${automaticProfileName} é definido automaticamente pelo Perfil do Sistema.`}</HintText>
    )
  }

  if (accessProfileDraft === null) {
    // Mesma frase antes e depois da tentativa de salvar, em um lugar só: ela
    // nasce como orientação neutra e vira recusa quando o salvamento esbarra
    // nela. Repeti-la no alerta do topo diria duas vezes a mesma coisa.
    return hasUnprofiledAccess ? (
      <HintText id={id}>Os acessos atuais são preservados enquanto nenhum Perfil de Acesso for selecionado.</HintText>
    ) : (
      <HintText id={id} tone={rejected ? 'error' : 'neutral'}>
        Selecione um Perfil de Acesso para o Analista.
      </HintText>
    )
  }

  return accessProfileChanged ? (
    <HintText id={id}>Ao salvar, os acessos atuais serão substituídos pelo Perfil de Acesso selecionado.</HintText>
  ) : (
    <HintText id={id}>Define os departamentos e as páginas que este usuário visualiza.</HintText>
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

function FormInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">{label}</span>
      {/* Cor explícita: o fundo é branco fixo, então herdar --text-primary
          deixaria o texto quase branco sobre branco no tema escuro. */}
      <input
        className={`w-full rounded-lg border ${FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] placeholder:text-[#98a2b3] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
        {...props}
      />
    </label>
  )
}

/**
 * Campo de senha do drawer de usuários, com botão próprio de mostrar e ocultar.
 * Componente local e específico dos campos de senha; Nome completo e E-mail
 * continuam a cargo do FormInput. Os dois compartilham apenas o padrão visual de
 * borda, por FIELD_BORDER_CLASS, quando o campo está no estado neutro.
 *
 * Cada campo tem a própria visibilidade, sempre iniciando oculta, e o botão é
 * permanente, sem depender de foco ou de conteúdo digitado. Alternar troca
 * apenas o tipo do input, então o valor digitado permanece intacto.
 *
 * A borda entra por classe, e não por estado interno: quem decide a cor é o
 * formulário, que conhece a comparação entre a senha e a confirmação. A mesma
 * classe carrega o foco correspondente, para borda e foco nunca discordarem.
 */
function PasswordField({
  label,
  name,
  value,
  onValueChange,
  disabled,
  stateClassName,
}: {
  label: string
  /** Nome próprio do cadastro, distinto entre os dois campos: ajuda a diferenciar
      estes campos de um formulário de login, mas não garante que o navegador
      deixe de detectar o conjunto como credencial. */
  name: string
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  /** Borda do campo e, quando houver cor de validação, o foco combinando. */
  stateClassName: string
}) {
  const [visible, setVisible] = useState(false)
  const inputId = useId()
  const action = visible ? 'Ocultar senha' : 'Mostrar senha'

  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        {/* pr-10 reserva a área do botão, para o texto digitado nunca passar por
            baixo dele. ::-ms-reveal e ::-ms-clear escondidos evitam o olho e o X
            nativos do Edge aparecerem ao lado do botão do portal. autoComplete
            new-password sinaliza que o campo é uma senha nova, e não uma
            credencial já existente; o navegador pode ignorar essa indicação, e o
            atributo não garante que o gerenciador de senhas fique de fora. */}
        <input
          autoComplete="new-password"
          className={`w-full rounded-lg border bg-white px-3 py-2.5 pr-10 text-[13px] text-[#1a2331] placeholder:text-[#98a2b3] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3] [&::-ms-clear]:hidden [&::-ms-reveal]:hidden ${stateClassName}`}
          disabled={disabled}
          id={inputId}
          name={name}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="••••••••"
          type={visible ? 'text' : 'password'}
          value={value}
        />
        {/* Anel de foco cinza azulado: o foco do botão não pode ser lido como
            senha conferida. Verde e vermelho ficam reservados à conferência. */}
        <button
          aria-label={action}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[#98a2b3] transition hover:bg-[#f2f4f7] hover:text-[#475467] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#667085] disabled:cursor-not-allowed disabled:text-[#c4cad5] disabled:hover:bg-transparent"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          title={action}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
        </button>
      </div>
    </div>
  )
}

/** Cor do anel de foco por teclado dos botões do rodapé do drawer. Só a cor: a
    espessura e o afastamento continuam sendo os do Button global. */
const FOOTER_FOCUS_RING_CLASS = 'focus-visible:ring-[#667085]'

function DialogFooter({
  onClose,
  onSave,
  saveLabel,
}: {
  onClose: () => void
  onSave: () => void
  saveLabel: string
}) {
  return (
    <div className="flex justify-end gap-2.5 border-t border-[#eef0f4] px-5 py-4">
      {/* Anel de foco neutro nos dois botões: o verde do Button global se lê como
          confirmação e não como "aqui está o teclado". O cn do Button passa por
          tailwind-merge, então esta cor substitui a do componente e só ela; a
          espessura e o afastamento do anel continuam vindo de lá. */}
      <Button className={FOOTER_FOCUS_RING_CLASS} onClick={onClose} variant="secondary">Cancelar</Button>
      {/* type button explícito: sem ele o padrão é submit, e um botão de submit
          ao lado de campos de senha é um dos sinais que o navegador usa para
          reconhecer um formulário de credenciais. O drawer não tem form e o
          salvamento é feito no onClick, então nada depende de submit. */}
      <Button className={FOOTER_FOCUS_RING_CLASS} onClick={onSave} type="button">{saveLabel}</Button>
    </div>
  )
}
