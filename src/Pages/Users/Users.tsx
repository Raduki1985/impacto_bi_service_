import * as Dialog from '@radix-ui/react-dialog'
import { Edit, Power, Plus, X } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DataTable } from '../../components/dashboard/DataTable'
import { Button } from '../../components/ui/button'
import { permissions } from '../../data/mockAdminData'
import type { User } from '../../data/dashboardTypes'
import {
  activateUser,
  deactivateUser,
  listUsers,
  type UserStatusChangeFailureReason,
} from '../../services/users/userRepository'
import { ADMIN_USERS_WRITE_PERMISSION } from '../../config/permissions'
import { useAuth } from '../../contexts/useAuth'
import { profileColorClasses } from '../../lib/profileColors'

const MAX_PAGE_SIZE = 10
const MIN_PAGE_SIZE = 1
/** Altura de linha usada antes de existir linha renderizada para medir. */
const FALLBACK_ROW_HEIGHT = 48
/** Folga para bordas e arredondamentos não cortarem a última linha. */
const CAPACITY_SAFETY_MARGIN = 4

type UserFeedback = {
  type: 'success' | 'error'
  message: string
}

/** A interface só traduz o motivo; a regra vive no repositório. */
const statusChangeFailureMessages: Record<UserStatusChangeFailureReason, string> = {
  'not-found': 'Usuário não encontrado. Atualize a página e tente novamente.',
  'self-deactivation': 'Você não pode desativar o próprio usuário.',
  'last-active-administrator': 'O último administrador ativo não pode ser desativado.',
}

/**
 * Maior pageSize (1..10) em que TODAS as páginas candidatas cabem na altura
 * disponível, somando as alturas reais das linhas de cada grupo consecutivo.
 * Assim páginas de linhas baixas não pagam o preço da linha mais alta do
 * conjunto, que antes era multiplicada por todos os registros.
 */
function calculatePageCapacity(rowHeights: number[], availableHeight: number): number {
  for (let candidate = MAX_PAGE_SIZE; candidate >= MIN_PAGE_SIZE; candidate -= 1) {
    let everyPageFits = true

    for (let start = 0; start < rowHeights.length; start += candidate) {
      const pageHeight = rowHeights
        .slice(start, start + candidate)
        .reduce((total, height) => total + height, 0)

      if (pageHeight > availableHeight) {
        everyPageFits = false
        break
      }
    }

    if (everyPageFits) return candidate
  }

  return MIN_PAGE_SIZE
}

export function Users() {
  const { user: authenticatedUser, hasPermission } = useAuth()
  const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)
  // Base persistida carregada na montagem e recarregada após cada alteração.
  const [userList, setUserList] = useState(() => listUsers())
  const [page, setPage] = useState(0)
  // Quantidade adaptativa: recalculada a partir da altura real da região da tabela.
  const [pageSize, setPageSize] = useState(MAX_PAGE_SIZE)
  const [open, setOpen] = useState(false)
  /** Usuário Ativo aguardando a confirmação de desativação. */
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [feedback, setFeedback] = useState<UserFeedback | null>(null)
  const tableRegionRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  /** Espelhos dos estados de paginação para o callback de medição ler sem depender de page. */
  const pageRef = useRef(0)
  const pageSizeRef = useRef(MAX_PAGE_SIZE)
  const activeCount = userList.filter((user) => user.status === 'Ativo').length
  const inactiveCount = userList.length - activeCount
  const administratorCount = userList.filter((user) => user.profile === 'Administrador').length
  const executiveCount = userList.filter((user) => user.profile === 'Executivo').length
  const managerCount = userList.filter((user) => user.profile === 'Gestor').length
  const totalPages = Math.ceil(userList.length / pageSize)
  const pageUsers = useMemo(
    () => userList.slice(page * pageSize, page * pageSize + pageSize),
    [page, pageSize, userList],
  )
  const from = page * pageSize + 1
  const to = Math.min(userList.length, page * pageSize + pageSize)
  const headers = canManageUsers
    ? ['Usuário', 'Perfil', 'Permissões', 'Status', 'Último acesso', 'Ações']
    : ['Usuário', 'Perfil', 'Departamentos', 'Status', 'Último acesso']

  // Espelhos atualizados a cada mudança: a medição não pode depender de page
  // nem de pageSize, senão navegar recriaria o observer e recalcularia tudo.
  useEffect(() => {
    pageRef.current = page
    pageSizeRef.current = pageSize
  }, [page, pageSize])

  /**
   * Paginação adaptativa estável: a capacidade vem da tabela invisível com
   * todos os usuários, somando as alturas reais de cada página candidata
   * (calculatePageCapacity); navegar entre páginas nunca altera o pageSize,
   * só mudança real de layout altera. Os setState ficam no callback
   * assíncrono porque a regra react-hooks/set-state-in-effect do projeto
   * proíbe setState síncrono no corpo do efeito.
   */
  useEffect(() => {
    const region = tableRegionRef.current
    const measurement = measurementRef.current
    if (!region || !measurement) return

    let frame: number | null = null

    const measure = () => {
      frame = null
      const regionHeight = region.clientHeight
      if (regionHeight === 0) return

      const header = measurement.querySelector('thead')
      const headerHeight = header ? header.getBoundingClientRect().height : 0
      const rows = Array.from(measurement.querySelectorAll('[data-measure-user-row]'))
      // Alturas reais na ordem de userList; zeros (linha ainda sem layout) saem
      // para não invalidar a soma, sem reordenar as demais.
      const rowHeights = rows
        .map((row) => row.getBoundingClientRect().height)
        .filter((height) => height > 0)
      const available = regionHeight - headerHeight - CAPACITY_SAFETY_MARGIN
      // Sem nenhuma linha mensurável ainda: estimativa simples pelo fallback.
      const capacity =
        rowHeights.length > 0
          ? calculatePageCapacity(rowHeights, available)
          : Math.min(
              MAX_PAGE_SIZE,
              Math.max(MIN_PAGE_SIZE, Math.floor(available / FALLBACK_ROW_HEIGHT)),
            )

      const currentPageSize = pageSizeRef.current
      if (capacity === currentPageSize) return

      // Só quando o pageSize muda de fato: preserva aproximadamente o primeiro
      // usuário visível e mantém a página dentro do novo total.
      const startIndex = pageRef.current * currentPageSize
      const nextTotalPages = Math.max(1, Math.ceil(userList.length / capacity))
      const nextPage = Math.min(Math.floor(startIndex / capacity), nextTotalPages - 1)

      pageSizeRef.current = capacity
      pageRef.current = nextPage
      setPageSize(capacity)
      setPage(nextPage)
    }

    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    schedule()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', schedule)

      return () => {
        if (frame !== null) cancelAnimationFrame(frame)
        window.removeEventListener('resize', schedule)
      }
    }

    const observer = new ResizeObserver(schedule)
    observer.observe(region)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [canManageUsers, feedback, userList])

  function refreshUsers() {
    setUserList(listUsers())
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
            <UserKpi label="Gestores" value={managerCount} valueClassName="text-[#305522]" />
          </div>
        </div>
        {canManageUsers ? (
          <Button onClick={() => setOpen(true)}><Plus size={15} aria-hidden="true" />Novo usuário</Button>
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
      {/* Região elástica sem rolagem vertical: a paginação adaptativa mede esta
          região e ajusta quantas linhas cabem, então nada é cortado nem rola. */}
      <div className="relative min-h-0 flex-1" ref={tableRegionRef}>
        {/* Tabela invisível com todos os usuários: fonte única da medição, imune
            à página visível. h-0 + overflow-hidden porque um bloco fora do fluxo
            ainda expandiria a área rolável dos ancestrais; assim não ocupa altura
            nem gera barra, mas as linhas mantêm geometria mensurável. */}
        <div
          aria-hidden="true"
          className="invisible absolute inset-x-0 top-0 h-0 overflow-hidden pointer-events-none"
          ref={measurementRef}
        >
          <DataTable headers={headers} minWidth={820}>
            {userList.map((user) => (
              <UserTableRow canManageUsers={canManageUsers} key={user.email} measurement user={user} />
            ))}
          </DataTable>
        </div>
        <DataTable headers={headers} minWidth={820}>
          {pageUsers.map((user) => (
            <UserTableRow
              canManageUsers={canManageUsers}
              key={user.email}
              onEdit={() => setOpen(true)}
              onStatusClick={handleStatusButtonClick}
              user={user}
            />
          ))}
        </DataTable>
      </div>
      <div className="mt-auto flex flex-none flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6e8ee] bg-[#fafbfc] px-4 py-3 text-[12.5px] text-[#667085]">
        <div>Mostrando <b className="text-[#344054]">{from}</b>-<b className="text-[#344054]">{to}</b> de <b className="text-[#344054]">{userList.length}</b> usuários</div>
        <div className="flex gap-1.5">
          <Button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} size="sm" variant="secondary">Anterior</Button>
          {Array.from({ length: totalPages }, (_, index) => (
            <Button key={index} onClick={() => setPage(index)} size="sm" variant={page === index ? 'primary' : 'secondary'}>{index + 1}</Button>
          ))}
          <Button disabled={page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} size="sm" variant="secondary">Próxima</Button>
        </div>
      </div>
      {canManageUsers ? <UserDialog open={open} onOpenChange={setOpen} /> : null}
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
  /** true na tabela invisível de medição: mesmas dimensões, nenhum elemento interativo. */
  measurement?: boolean
  onEdit?: () => void
  onStatusClick?: (user: User) => void
}

/** Linha única compartilhada pelas tabelas visível e de medição, para que as
    alturas medidas sejam exatamente as alturas reais. */
function UserTableRow({ user, canManageUsers, measurement = false, onEdit, onStatusClick }: UserTableRowProps) {
  return (
    <tr
      className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]"
      data-measure-user-row={measurement ? true : undefined}
      data-user-row={measurement ? undefined : true}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${profileColorClasses[user.profile]}`}>{user.initials}</span>
          <span className="leading-tight">
            <span className="block font-medium text-[#1a2331]">{user.name}</span>
            <span className="block font-mono text-[11.5px] text-[#98a2b3]">{user.email}</span>
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5"><ProfileBadge profile={user.profile} /></td>
      {canManageUsers ? (
        <td className="px-4 py-2.5 text-[#475467]">{user.permissions}</td>
      ) : (
        <td className="px-4 py-2.5 text-[#475467]">
          {user.profile === 'Gestor' ? user.departments.join(', ') : 'Todos os departamentos'}
        </td>
      )}
      <td className="px-4 py-2.5"><StatusBadge status={user.status} /></td>
      <td className="px-4 py-2.5 text-[#98a2b3]">{user.lastAccess}</td>
      {canManageUsers ? (
        <td className="px-4 py-2.5">
          <div className="flex justify-end gap-1.5">
            {measurement ? (
              <>
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded border border-[#d0d5dd]">
                  <Edit size={14} aria-hidden="true" />
                </span>
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded border border-[#e4e7ee]">
                  <Power size={14} aria-hidden="true" />
                </span>
              </>
            ) : (
              <>
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
              </>
            )}
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

function UserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[452px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_34px_rgba(16,24,40,.18)]">
          <div className="flex items-center justify-between border-b border-[#eef0f4] px-5 py-4">
            <div><Dialog.Title className="text-base font-bold text-[#101828]">Novo usuário</Dialog.Title><Dialog.Description className="text-xs text-[#98a2b3]">Cadastro de acesso ao BI</Dialog.Description></div>
            <Dialog.Close asChild><Button aria-label="Fechar" size="icon" variant="ghost"><X size={18} /></Button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <FormInput label="Nome completo" placeholder="Ex.: João da Silva" />
            <FormInput label="E-mail" placeholder="usuario@provedor.com.br" type="email" />
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">Perfil</label>
            <select className="mb-4 w-full cursor-pointer rounded-lg border border-[#dfe3ec] bg-white px-3 py-2.5 text-[13px] disabled:cursor-not-allowed"><option>Administrador</option><option>Executivo</option><option>Gestor</option></select>
            <div className="grid grid-cols-2 gap-3"><FormInput label="Senha" placeholder="••••••••" type="password" /><FormInput label="Confirmar" placeholder="••••••••" type="password" /></div>
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
          </div>
          <DialogFooter onClose={() => onOpenChange(false)} saveLabel="Salvar usuário" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FormInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">{label}</span>
      <input className="w-full rounded-lg border border-[#dfe3ec] bg-white px-3 py-2.5 text-[13px]" {...props} />
    </label>
  )
}

export function DialogFooter({ onClose, saveLabel }: { onClose: () => void; saveLabel: string }) {
  return (
    <div className="flex justify-end gap-2.5 border-t border-[#eef0f4] px-5 py-4">
      <Button onClick={onClose} variant="secondary">Cancelar</Button>
      <Button onClick={onClose}>{saveLabel}</Button>
    </div>
  )
}
