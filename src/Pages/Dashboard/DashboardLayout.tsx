import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Menu, Settings } from 'lucide-react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { AreaSelector } from '../../components/navigation/AreaSelector'
import { usePreferences } from '../../contexts/usePreferences'
import { cn } from '../../lib/utils'

type DashboardLayoutProps = {
  /** null identifica uma seção externa às páginas de OS (ex.: um departamento) — usa title/subtitle no lugar do lookup por página. */
  activePage: PageKey | null
  onPageChange: (page: PageKey) => void
  onLogout: () => void
  children: ReactNode
  title?: string
  subtitle?: string
  sidebar?: ReactNode
  showPageHeader?: boolean
}

export function DashboardLayout({
  activePage,
  onLogout,
  children,
  title,
  subtitle,
  sidebar,
  showPageHeader = true,
}: DashboardLayoutProps) {
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = usePreferences()
  const isDark = theme === 'dark'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <aside className="flex-none border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-4 border-b border-[#263244] bg-[#101828] px-[22px] py-3">
          <div className="flex flex-none items-center gap-2">
            {sidebar ? (
              <button
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101828]"
                onClick={toggleSidebar}
                title={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
                type="button"
              >
                <Menu size={19} aria-hidden="true" />
              </button>
            ) : null}
            <Link
              aria-label="Ir para a Visão Geral Executiva"
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101828]"
              to="/dashboard/inicio"
            >
              <img
                className="h-11 w-auto max-w-[236px] object-contain"
                src={logoImpactoHeader}
                alt="Impacto Telecom"
              />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <AreaSelector />
          </div>
          <div className="flex flex-none items-center pr-1">
            <UserMenu onLogout={onLogout} />
          </div>
        </div>
      </aside>
      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <div
            aria-hidden={!sidebarOpen}
            className={cn(
              'flex flex-none flex-col overflow-hidden transition-[width,opacity] duration-[220ms] ease-in-out motion-reduce:transition-none',
              sidebarOpen ? 'w-[220px] opacity-100' : 'w-0 opacity-0 pointer-events-none',
            )}
            inert={!sidebarOpen}
          >
            <div className="min-h-0 flex-1">{sidebar}</div>
            <div className="flex flex-none flex-col gap-0.5 border-t border-[var(--border)] bg-[var(--surface)] px-2 pb-3 pt-2">
              <button
                aria-checked={isDark}
                aria-label={isDark ? 'Aparência - tema escuro ativo' : 'Aparência - tema claro ativo'}
                className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[16px] font-normal text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={toggleTheme}
                role="switch"
                title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 flex-none items-center justify-center text-[16px] leading-none"
                >
                  ◐
                </span>
                <span className="min-w-0 flex-1 truncate">Aparência</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors duration-200 motion-reduce:transition-none',
                    isDark ? 'bg-[var(--appearance-switch-active)]' : 'bg-[#d0d5dd]',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
                      isDark ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
              <Link
                className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[16px] font-normal text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                to="/dashboard/configuracoes/preferencias"
              >
                <Settings aria-hidden="true" className="flex-none" size={16} />
                <span className="min-w-0 flex-1 truncate">Configurações</span>
              </Link>
              <button
                className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[16px] font-normal text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={onLogout}
                type="button"
              >
                <LogOut aria-hidden="true" className="flex-none" size={16} />
                <span className="min-w-0 flex-1 truncate">Sair</span>
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showPageHeader ? <AppHeader page={activePage} subtitle={subtitle} title={title} /> : null}
          <main className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-10 pt-[22px]">{children}</main>
        </div>
      </div>
    </div>
  )
}
