import { Bell, CircleHelp, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../../contexts/useAuth'
import { profileColorClasses } from '../../lib/profileColors'
import { settingsReturnState } from '../../lib/settingsNavigation'

type UserMenuProps = {
  onLogout: () => void
}

export function UserMenu({ onLogout }: UserMenuProps) {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  function handleLogout() {
    setOpen(false)
    onLogout()
  }

  if (!user) return null

  const menuItemClass =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[var(--text-item)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

  const menuItemTextClass = 'min-w-0 flex-1 text-[14px] font-normal leading-5'

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          aria-label="Ajuda"
          className="flex h-10 w-8 cursor-not-allowed items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
          disabled
          title="Ajuda - em desenvolvimento"
          type="button"
        >
          <CircleHelp aria-hidden="true" size={20} />
        </button>
        <button
          aria-label="Notificações"
          className="flex h-10 w-8 cursor-not-allowed items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
          disabled
          title="Notificações - em desenvolvimento"
          type="button"
        >
          <Bell aria-hidden="true" size={22} />
        </button>
        {/* Botão transparente: fundo, borda e hover recolorem o avatar conforme o tema. */}
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Abrir menu do usuário"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${profileColorClasses[user.profile]}`}
          >
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
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[242px] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[0_14px_34px_rgba(16,24,40,.16)]"
            role="menu"
          >
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-semibold text-[var(--text-heading)]">{user.name}</div>
              <div className="text-[11.5px] text-[#98a2b3]">{user.email}</div>
            </div>
            <div className="my-1 h-px bg-[var(--divider)]" />
            <Link
              className={menuItemClass}
              onClick={() => setOpen(false)}
              role="menuitem"
              state={settingsReturnState(location)}
              to="/dashboard/configuracoes/meu-perfil"
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-4 flex-none items-center justify-center"
              >
                <User size={16} />
              </span>
              <span className={menuItemTextClass}>Meu perfil</span>
            </Link>
            <div className="my-1 h-px bg-[var(--divider)]" />
            <button
              className={menuItemClass}
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-4 flex-none items-center justify-center"
              >
                <LogOut size={16} />
              </span>
              <span className={menuItemTextClass}>Sair</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
