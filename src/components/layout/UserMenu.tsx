import { Bell, CircleHelp, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../contexts/useAuth'

type UserMenuProps = {
  onLogout: () => void
}

export function UserMenu({ onLogout }: UserMenuProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  function handleLogout() {
    setOpen(false)
    onLogout()
  }

  if (!user) return null

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          aria-label="Ajuda"
          className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101828]"
          disabled
          title="Ajuda - em desenvolvimento"
          type="button"
        >
          <CircleHelp aria-hidden="true" size={20} />
        </button>
        <button
          aria-label="Notificações"
          className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101828]"
          disabled
          title="Notificações - em desenvolvimento"
          type="button"
        >
          <Bell aria-hidden="true" size={20} />
        </button>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Abrir menu do usuário"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e7ee] bg-white p-1 transition hover:bg-[#f3f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-weak)] text-xs font-bold text-[var(--accent)]">
            {user.initials}
          </span>
        </button>
      </div>
      {open ? (
        <>
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[242px] rounded-2xl border border-[#e4e7ee] bg-white p-1.5 shadow-[0_14px_34px_rgba(16,24,40,.16)]"
            role="menu"
          >
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-semibold text-[#101828]">{user.name}</div>
              <div className="text-[11.5px] text-[#98a2b3]">{user.email}</div>
            </div>
            <div className="my-1 h-px bg-[#eef0f4]" />
            <Link
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#344054] transition hover:bg-[#f3f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={() => setOpen(false)}
              role="menuitem"
              to="/dashboard/configuracoes/meu-perfil"
            >
              <User aria-hidden="true" size={16} />
              Meu perfil
            </Link>
            <div className="my-1 h-px bg-[#eef0f4]" />
            <button
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#344054] transition hover:bg-[#f3f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              <LogOut aria-hidden="true" size={16} />
              Sair
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
