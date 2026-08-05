import { Bell, CircleHelp, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { AppearanceIcon } from '../icons/AppearanceIcon'
import { useAuth } from '../../contexts/useAuth'
import { usePreferences } from '../../contexts/usePreferences'
import { profileColorClasses } from '../../lib/profileColors'
import { SETTINGS_ENTRY_PATH, settingsReturnState } from '../../lib/settingsNavigation'
import { cn } from '../../lib/utils'

type UserMenuProps = {
  onLogout: () => void
}

export function UserMenu({ onLogout }: UserMenuProps) {
  const { user } = useAuth()
  const { theme, toggleTheme } = usePreferences()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const isDark = theme === 'dark'
  /** O switch de Aparência lê o tema claro como "luz ligada". */
  const isLight = !isDark

  function handleLogout() {
    setOpen(false)
    onLogout()
  }

  if (!user) return null

  const menuItemClass =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[var(--text-item)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

  const menuItemTextClass = 'min-w-0 flex-1 text-[14px] font-normal leading-5'

  const menuItemIconClass = 'flex h-4 w-4 flex-none items-center justify-center'

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          aria-label="Ajuda"
          className="flex h-10 w-8 translate-x-[7px] cursor-not-allowed items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
          disabled
          title="Ajuda - em desenvolvimento"
          type="button"
        >
          <CircleHelp aria-hidden="true" size={21} />
        </button>
        <button
          aria-label="Notificações"
          className="flex h-10 w-8 cursor-not-allowed items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
          disabled
          title="Notificações - em desenvolvimento"
          type="button"
        >
          <Bell aria-hidden="true" size={21} />
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
            {/* Única entrada das Configurações, e ela abre em Meu perfil. O
                `settingsReturnState` registra a página de origem; estando já
                dentro das Configurações, ele repassa a origem antiga em vez de
                trocá-la por uma rota do próprio contexto, o que evita retorno
                circular. As abas internas seguem filtradas por permissão na
                própria rota. */}
            <Link
              className={menuItemClass}
              onClick={() => setOpen(false)}
              role="menuitem"
              state={settingsReturnState(location)}
              to={SETTINGS_ENTRY_PATH}
            >
              <span aria-hidden="true" className={menuItemIconClass}>
                <Settings size={16} />
              </span>
              <span className={menuItemTextClass}>Configurações</span>
            </Link>
            {/* Opção marcada do menu: `menuitemcheckbox` com aria-checked, e não
                `switch`, que não é papel válido dentro de role="menu". Não fecha
                o menu de propósito, para dar para comparar os dois temas na hora
                da escolha. O estado vive só no PreferencesContext. */}
            <button
              aria-checked={isLight}
              aria-label={isDark ? 'Aparência - tema escuro ativo' : 'Aparência - tema claro ativo'}
              className={menuItemClass}
              onClick={toggleTheme}
              role="menuitemcheckbox"
              title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              type="button"
            >
              {/* Símbolo fixo do controle: nomeia o assunto (claro contra
                  escuro) e não muda com o tema. Quem carrega o estado é a
                  chave, pela posição do botão e pelo ícone dentro dele. */}
              <span aria-hidden="true" className={menuItemIconClass}>
                <AppearanceIcon size={16} />
              </span>
              <span className={menuItemTextClass}>Aparência</span>
              <span
                aria-hidden="true"
                className="relative inline-flex h-5 w-9 flex-none items-center rounded-full bg-[var(--appearance-switch-active)] transition-colors duration-200 motion-reduce:transition-none"
              >
                <span
                  className={cn(
                    'inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
                    // 36px de trilho menos 16px do botão deixam 20px de curso:
                    // 18px à direita e 2px à esquerda dão a mesma folga de 2px
                    // nos dois extremos.
                    isLight ? 'translate-x-[18px]' : 'translate-x-0.5',
                  )}
                >
                  {/* Cor escura fixa: o botão é branco nos dois temas, então o
                      ícone não pode seguir os tokens de texto. */}
                  {isLight ? (
                    <Sun aria-hidden="true" className="text-[#344054]" size={10} />
                  ) : (
                    <Moon aria-hidden="true" className="text-[#344054]" size={10} />
                  )}
                </span>
              </span>
            </button>
            <div className="my-1 h-px bg-[var(--divider)]" />
            <button
              className={menuItemClass}
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              <span aria-hidden="true" className={menuItemIconClass}>
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
