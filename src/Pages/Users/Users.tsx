import * as Dialog from '@radix-ui/react-dialog'
import { Edit, Power, Plus, X } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { useMemo, useState } from 'react'

import { DataTable } from '../../components/dashboard/DataTable'
import { Button } from '../../components/ui/button'
import { permissions, users } from '../../data/mockAdminData'
import type { User } from '../../data/dashboardTypes'
import { ADMIN_USERS_WRITE_PERMISSION } from '../../config/permissions'
import { useAuth } from '../../contexts/useAuth'
import { profileColorClasses } from '../../lib/profileColors'

const pageSize = 10

export function Users() {
  const { hasPermission } = useAuth()
  const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(false)
  const totalPages = Math.ceil(users.length / pageSize)
  const pageUsers = useMemo(() => users.slice(page * pageSize, page * pageSize + pageSize), [page])
  const from = page * pageSize + 1
  const to = Math.min(users.length, page * pageSize + pageSize)
  const headers = canManageUsers
    ? ['Usuário', 'Perfil', 'Permissões', 'Status', 'Último acesso', 'Ações']
    : ['Usuário', 'Perfil', 'Departamentos', 'Status', 'Último acesso']

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-none flex-wrap items-end justify-between gap-4">
        <div className="flex gap-7">
          <div><div className="text-[11.5px] font-semibold uppercase text-[#667085]">Usuários</div><div className="mt-1 font-mono text-[22px] font-semibold">{users.length}</div></div>
          <div><div className="text-[11.5px] font-semibold uppercase text-[#667085]">Ativos</div><div className="mt-1 font-mono text-[22px] font-semibold text-[#16a34a]">{users.filter((user) => user.status === 'Ativo').length}</div></div>
          <div><div className="text-[11.5px] font-semibold uppercase text-[#667085]">Administradores</div><div className="mt-1 font-mono text-[22px] font-semibold">{users.filter((user) => user.profile === 'Administrador').length}</div></div>
        </div>
        {canManageUsers ? (
          <Button onClick={() => setOpen(true)}><Plus size={15} aria-hidden="true" />Novo usuário</Button>
        ) : null}
      </div>
      {/* Região elástica: absorve a sobra e rola sozinha em janelas baixas,
          mantendo o rodapé colado à base do painel em qualquer altura. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable headers={headers} minWidth={820}>
          {pageUsers.map((user) => (
            <tr key={user.email} className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
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
                    <button className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#e4e7ee]" onClick={() => setOpen(true)} type="button"><Edit size={14} aria-hidden="true" /></button>
                    <button className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#e4e7ee] text-[#e5484d]" type="button"><Power size={14} aria-hidden="true" /></button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </DataTable>
      </div>
      <div className="mt-auto flex flex-none flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6e8ee] bg-[#fafbfc] px-4 py-3 text-[12.5px] text-[#667085]">
        <div>Mostrando <b className="text-[#344054]">{from}</b>-<b className="text-[#344054]">{to}</b> de <b className="text-[#344054]">{users.length}</b> usuários</div>
        <div className="flex gap-1.5">
          <Button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} size="sm" variant="secondary">Anterior</Button>
          {Array.from({ length: totalPages }, (_, index) => (
            <Button key={index} onClick={() => setPage(index)} size="sm" variant={page === index ? 'primary' : 'secondary'}>{index + 1}</Button>
          ))}
          <Button disabled={page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} size="sm" variant="secondary">Próxima</Button>
        </div>
      </div>
      {canManageUsers ? <UserDialog open={open} onOpenChange={setOpen} /> : null}
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
