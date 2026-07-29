import * as Dialog from '@radix-ui/react-dialog'
import { Edit, Power, Plus, X } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { DataTable } from '../../components/dashboard/DataTable'
import { Button } from '../../components/ui/button'
import { permissions } from '../../data/mockAdminData'
import type { User } from '../../data/dashboardTypes'
import {
  activateUser,
  deactivateUser,
  listUsers,
  updateUserDetails,
  type UserAccessConfig,
  type UserDetailsUpdateFailureReason,
  type UserStatusChangeFailureReason,
} from '../../services/users/userRepository'
import { ADMIN_USERS_WRITE_PERMISSION } from '../../config/permissions'
import { useAuth } from '../../contexts/useAuth'
import { MODEL_PAGE_KEY } from '../../lib/userAccessRules'
import { profileColorClasses } from '../../lib/profileColors'
import type { UserProfile } from '../../types/access'
import { UserAccessEditor, type DepartmentSelectionDraft } from './UserAccessEditor'

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
  'invalid-access-configuration': 'Revise os departamentos e páginas selecionados.',
  'self-access-change': 'Você não pode alterar o próprio perfil ou os próprios acessos.',
  'last-active-administrator': 'O último administrador ativo não pode perder esse perfil.',
  'storage-failure': 'Não foi possível gravar a alteração. Verifique o navegador e tente novamente.',
}

/** Perfis oficiais, na ordem exibida no select do drawer. */
const USER_PROFILES: UserProfile[] = ['Administrador', 'Executivo', 'Usuário Departamental']

/** O value do select é string; sem correspondência, mantém o perfil informado. */
function toUserProfile(value: string, fallback: UserProfile): UserProfile {
  return USER_PROFILES.find((profile) => profile === value) ?? fallback
}

/** Drawer fechado (null), em criação (sem persistência neste bloco) ou em edição. */
type DrawerState = { mode: 'create' } | { mode: 'edit'; user: User }

export function Users() {
  const { user: authenticatedUser, hasPermission } = useAuth()
  const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)
  // Base persistida carregada na montagem e recarregada após cada alteração.
  const [userList, setUserList] = useState(() => listUsers())
  const [page, setPage] = useState(0)
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  /** Usuário Ativo aguardando a confirmação de desativação. */
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [feedback, setFeedback] = useState<UserFeedback | null>(null)
  const activeCount = userList.filter((user) => user.status === 'Ativo').length
  const inactiveCount = userList.length - activeCount
  const administratorCount = userList.filter((user) => user.profile === 'Administrador').length
  const executiveCount = userList.filter((user) => user.profile === 'Executivo').length
  const departmentalUserCount = userList.filter(
    (user) => user.profile === 'Usuário Departamental',
  ).length
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
    ? ['Usuário', 'Perfil', 'Permissões', 'Status', 'Último acesso', 'Ações']
    : ['Usuário', 'Perfil', 'Departamentos', 'Status', 'Último acesso']
  // Larguras fixas por coluna: sem elas o layout automático redistribui tudo a
  // cada página, porque depende do conteúdo das linhas renderizadas. A coluna
  // sem largura (Permissões/Departamentos) absorve o restante.
  const columnWidths = canManageUsers
    ? ['30%', '180px', undefined, '90px', '150px', '110px']
    : ['32%', '180px', undefined, '90px', '150px']

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

    // Desativar é destrutivo e passa pela confirmação; reativar é imediato.
    if (target.status === 'Ativo') {
      setStatusTarget(target)
      return
    }

    runStatusChange(target, activateUser, {
      done: 'foi reativado com sucesso.',
      already: 'já estava ativo.',
    })
  }

  function handleDeactivationConfirm() {
    const target = statusTarget
    setStatusTarget(null)

    if (!target) return

    runStatusChange(target, deactivateUser, {
      done: 'foi desativado com sucesso.',
      already: 'já estava inativo.',
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
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
            <UserKpi label="Usuários Departamentais" value={departmentalUserCount} valueClassName="text-[#305522]" />
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
          onSaveEdit={saveUserEdit}
          open={drawer !== null}
        />
      ) : null}
      {canManageUsers ? (
        <StatusConfirmationDialog
          onCancel={() => setStatusTarget(null)}
          onConfirm={handleDeactivationConfirm}
          user={statusTarget}
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
  const departmentsLabel =
    user.profile === 'Usuário Departamental'
      ? user.departments.join(', ')
      : 'Todos os departamentos'
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
      {canManageUsers ? (
        <td className="px-4 py-2.5 text-[#475467]">
          <span className="block truncate" title={user.permissions}>{user.permissions}</span>
        </td>
      ) : (
        <td className="px-4 py-2.5 text-[#475467]">
          <span className="block truncate" title={departmentsLabel}>{departmentsLabel}</span>
        </td>
      )}
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

/** Confirmação exclusiva da desativação; a reativação não passa por aqui. */
function StatusConfirmationDialog({
  user,
  onCancel,
  onConfirm,
}: {
  user: User | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog.Root
      open={user !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
          <Dialog.Title className="text-base font-bold text-[#101828]">Desativar usuário?</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
            {user
              ? `${user.name} não poderá entrar no portal enquanto estiver Inativo. O acesso pode ser devolvido depois pela reativação.`
              : ''}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2.5">
            <Button onClick={onCancel} variant="secondary">Cancelar</Button>
            <Button
              className="bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[#e5484d]"
              onClick={onConfirm}
            >
              Desativar usuário
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

/**
 * Departamentos em que o Modelo já está liberado. O acesso global do
 * Administrador não é liberação granular, então não semeia o rascunho: trocar
 * um Administrador para Executivo começa sem nenhum Modelo marcado.
 */
function initialModelDepartmentIds(user: User | null): string[] {
  if (!user || user.profile === 'Administrador') return []

  return user.departmentPageAccess
    .filter((access) => access.pageKeys.includes(MODEL_PAGE_KEY))
    .map((access) => access.departmentId)
}

/**
 * Departamentos e páginas atuais, na ordem em que estão persistidos, para que
 * salvar sem mexer em nada continue sendo idempotente. Só o Usuário
 * Departamental tem seleção granular; vindo de outro perfil, a seleção começa
 * vazia e o Administrador precisa escolher ao menos um departamento.
 */
function initialDepartmentSelections(user: User | null): DepartmentSelectionDraft[] {
  if (!user || user.profile !== 'Usuário Departamental') return []

  return user.departmentPageAccess.map((access) => ({
    departmentId: access.departmentId,
    pageKeys: [...access.pageKeys],
  }))
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
}

function UserDialog({ open, editingUser, isOwnAccount, onOpenChange, onSaveEdit }: UserDialogProps) {
  const isEditing = editingUser !== null
  // O pai remonta o drawer via key a cada abertura, então o estado inicial já
  // nasce com os dados do usuário em edição, sem efeito de sincronização.
  const [name, setName] = useState(editingUser?.name ?? '')
  const [email, setEmail] = useState(editingUser?.email ?? '')
  const [profile, setProfile] = useState<UserProfile>(editingUser?.profile ?? 'Usuário Departamental')
  // Rascunhos separados por perfil: alternar o select no meio da edição não
  // apaga o que já foi configurado para o outro perfil.
  const [modelDepartmentIds, setModelDepartmentIds] = useState(() =>
    initialModelDepartmentIds(editingUser),
  )
  const [departmentSelections, setDepartmentSelections] = useState(() =>
    initialDepartmentSelections(editingUser),
  )
  const [formError, setFormError] = useState<string | null>(null)

  /** Entrada do repositório conforme o perfil escolhido. */
  function buildAccessConfig(): UserAccessConfig {
    if (profile === 'Administrador') return { profile: 'Administrador' }
    if (profile === 'Executivo') return { profile: 'Executivo', modelDepartmentIds }

    return { profile: 'Usuário Departamental', departments: departmentSelections }
  }

  // Operação síncrona no mock: sem estado de processamento; o drawer fecha (ou
  // mostra o erro) na mesma interação, então não há como reenviar no meio.
  function handleSave() {
    // Criação segue sem persistência neste bloco: mantém o comportamento
    // anterior de apenas fechar o drawer.
    if (!editingUser) {
      onOpenChange(false)
      return
    }

    const error = onSaveEdit(editingUser.id, { name, email, access: buildAccessConfig() })
    if (error) setFormError(error)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[452px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_34px_rgba(16,24,40,.18)]">
          <div className="flex items-center justify-between border-b border-[#eef0f4] px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-bold text-[#101828]">{isEditing ? 'Editar usuário' : 'Novo usuário'}</Dialog.Title>
              <Dialog.Description className="text-xs text-[#98a2b3]">{isEditing ? 'Atualização de dados, perfil e acessos' : 'Cadastro de acesso ao BI'}</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button aria-label="Fechar" size="icon" variant="ghost"><X size={18} /></Button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {formError ? (
              <div className="mb-4 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3.5 py-2 text-[12.5px] font-medium text-[#b42318]" role="alert">
                {formError}
              </div>
            ) : null}
            {isEditing ? <SectionTitle>Dados do usuário</SectionTitle> : null}
            <FormInput label="Nome completo" onChange={(event) => setName(event.target.value)} placeholder="Ex.: João da Silva" value={name} />
            <FormInput label="E-mail" onChange={(event) => setEmail(event.target.value)} placeholder="usuario@provedor.com.br" type="email" value={email} />
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">Perfil</label>
            {/* Mesma causa do FormInput: fundo branco fixo exige cor própria. */}
            <select
              className="mb-4 w-full cursor-pointer rounded-lg border border-[#dfe3ec] bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
              disabled={isOwnAccount}
              onChange={(event) => setProfile(toUserProfile(event.target.value, profile))}
              value={profile}
            >
              {USER_PROFILES.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            {isOwnAccount ? (
              <p className="-mt-3 mb-4 text-[11.5px] text-[#98a2b3]">Você pode editar seu nome e e-mail, mas não pode alterar o próprio perfil ou os próprios acessos.</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <FormInput disabled={isEditing} label="Senha" placeholder="••••••••" type="password" />
              <FormInput disabled={isEditing} label="Confirmar" placeholder="••••••••" type="password" />
            </div>
            {isEditing ? (
              <p className="-mt-3 mb-4 text-[11.5px] text-[#98a2b3]">Senha indisponível: a autenticação real ainda não foi implementada.</p>
            ) : null}
            {isEditing ? (
              <>
                <SectionTitle>Acessos</SectionTitle>
                <UserAccessEditor
                  departmentSelections={departmentSelections}
                  disabled={isOwnAccount}
                  modelDepartmentIds={modelDepartmentIds}
                  onDepartmentSelectionsChange={setDepartmentSelections}
                  onModelDepartmentIdsChange={setModelDepartmentIds}
                  profile={profile}
                />
              </>
            ) : (
              <>
                {/* Modo Novo usuário: a criação real segue fora de escopo, então a
                    lista antiga de permissões continua apenas ilustrativa aqui. */}
                <div className="mb-2 text-[12.5px] font-semibold text-[#344054]">Permissões vinculadas</div>
                <div className="overflow-hidden rounded-[10px] border border-[#eef0f4]">
                  {permissions.map((permission) => (
                    <label key={permission.key} className="flex cursor-pointer items-center gap-2.5 border-b border-[#f4f6fa] px-3 py-2.5 text-[12.5px] font-medium text-[#344054] last:border-b-0">
                      <input className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed" type="checkbox" />
                      {permission.name}
                      <span className="ml-auto font-mono text-[10.5px] text-[#b0b6c3]">{permission.key}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
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

/** Título das seções do drawer em edição: Dados do usuário e Acessos. */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 border-b border-[#eef0f4] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#667085]">
      {children}
    </div>
  )
}

function FormInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">{label}</span>
      {/* Cor explícita: o fundo é branco fixo, então herdar --text-primary
          deixaria o texto quase branco sobre branco no tema escuro. */}
      <input
        className="w-full rounded-lg border border-[#dfe3ec] bg-white px-3 py-2.5 text-[13px] text-[#1a2331] placeholder:text-[#98a2b3] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]"
        {...props}
      />
    </label>
  )
}

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
      <Button onClick={onClose} variant="secondary">Cancelar</Button>
      <Button onClick={onSave}>{saveLabel}</Button>
    </div>
  )
}
