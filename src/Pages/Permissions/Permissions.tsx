import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../../components/ui/button'
import { biScreens, permissions } from '../../data/mockAdminData'
import { DialogFooter } from '../Users/Users'

export function Permissions() {
  const [open, setOpen] = useState(false)

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-[13px] leading-6 text-[#667085]">Cada permissão define o acesso a um conjunto de telas do BI. Vincule permissões aos usuários para controlar o que cada um enxerga.</p>
        <Button onClick={() => setOpen(true)}><Plus size={15} aria-hidden="true" />Nova permissão</Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3.5">
        {permissions.map((permission) => (
          <article key={permission.key} className="rounded-xl border border-[#e6e8ee] bg-white px-4 py-4 transition hover:border-[#d3d9e4] hover:shadow-[0_3px_12px_rgba(16,24,40,.07)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: permission.color }} />
                <h2 className="text-sm font-semibold text-[#101828]">{permission.name}</h2>
              </div>
              <button className="text-xs font-semibold text-[var(--accent)]" onClick={() => setOpen(true)} type="button">Editar</button>
            </div>
            <div className="ml-[18px] mt-1 font-mono text-[11px] text-[#98a2b3]">{permission.key}</div>
            <p className="my-3 text-[12.5px] leading-5 text-[#667085]">{permission.description}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {permission.screens.map((screen) => (
                <span key={screen} className="rounded-md border border-[#e6ebf5] bg-[#f2f5fb] px-2 py-1 text-[11px] text-[#475467]">{screen}</span>
              ))}
            </div>
            <div className="border-t border-[#f1f3f7] pt-2.5 text-xs text-[#98a2b3]">{permission.users} usuários vinculados</div>
          </article>
        ))}
      </div>
      <PermissionDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

function PermissionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[452px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_34px_rgba(16,24,40,.18)]">
          <div className="flex items-center justify-between border-b border-[#eef0f4] px-5 py-4">
            <div><Dialog.Title className="text-base font-bold text-[#101828]">Nova permissão</Dialog.Title><Dialog.Description className="text-xs text-[#98a2b3]">Defina o acesso às telas do BI</Dialog.Description></div>
            <Dialog.Close asChild><Button aria-label="Fechar" size="icon" variant="ghost"><X size={18} /></Button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <label className="mb-4 block"><span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">Nome da permissão</span><input className="w-full rounded-lg border border-[#dfe3ec] px-3 py-2.5 text-[13px]" placeholder="Ex.: Visão Executiva" /></label>
            <label className="mb-4 block"><span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">Chave</span><input className="w-full rounded-lg border border-[#dfe3ec] px-3 py-2.5 font-mono text-[13px]" placeholder="bi.executivo" /></label>
            <label className="mb-4 block"><span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">Descrição</span><textarea className="min-h-20 w-full resize-y rounded-lg border border-[#dfe3ec] px-3 py-2.5 text-[13px]" placeholder="Descreva o que esta permissão libera" /></label>
            <div className="mb-2 text-[12.5px] font-semibold text-[#344054]">Telas do BI liberadas</div>
            <div className="overflow-hidden rounded-[10px] border border-[#eef0f4]">
              {biScreens.map((screen) => (
                <label key={screen} className="flex cursor-pointer items-center gap-2.5 border-b border-[#f4f6fa] px-3 py-2.5 text-[12.5px] font-medium text-[#344054] last:border-b-0">
                  <input className="h-4 w-4 accent-[var(--accent)]" type="checkbox" />
                  {screen}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter onClose={() => onOpenChange(false)} saveLabel="Salvar permissão" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
