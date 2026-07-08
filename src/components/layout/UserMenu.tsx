import { LogOut, Shield, Users } from 'lucide-react'
import { useState } from 'react'

import type { PageKey } from '../../Pages/Dashboard/pageConfig'

type UserMenuProps = {
  onLogout: () => void
  onPageChange: (page: PageKey) => void
}

export function UserMenu({ onLogout, onPageChange }: UserMenuProps) {
  const [open, setOpen] = useState(false)

  function goTo(page: PageKey) {
    onPageChange(page)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2.5 rounded-[10px] border border-[#e4e7ee] bg-white py-1 pl-1.5 pr-2.5 transition hover:bg-[#f3f5f9]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-weak)] text-xs font-bold text-[var(--accent)]">
          CM
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[12.5px] font-semibold text-[#101828]">Carla Mendes</span>
          <span className="block text-[11px] text-[#98a2b3]">Administrador</span>
        </span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[242px] rounded-xl border border-[#e4e7ee] bg-white p-1.5 shadow-[0_14px_34px_rgba(16,24,40,.16)]">
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-semibold text-[#101828]">Carla Mendes</div>
              <div className="text-[11.5px] text-[#98a2b3]">carla.mendes@provedor.com.br</div>
            </div>
            <div className="px-3 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[#b0b6c3]">
              Administração
            </div>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#344054] hover:bg-[#f3f5f9]" onClick={() => goTo('users')} type="button">
              <Users size={16} aria-hidden="true" />
              Usuários
            </button>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#344054] hover:bg-[#f3f5f9]" onClick={() => goTo('permissions')} type="button">
              <Shield size={16} aria-hidden="true" />
              Permissões
            </button>
            <div className="my-1 h-px bg-[#eef0f4]" />
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#e5484d] hover:bg-[#f3f5f9]" onClick={onLogout} type="button">
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
