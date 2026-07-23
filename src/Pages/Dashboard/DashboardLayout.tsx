import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Menu, Settings } from 'lucide-react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { AreaSelector } from '../../components/navigation/AreaSelector'
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
}

export function DashboardLayout({
  activePage,
  onPageChange,
  onLogout,
  children,
  title,
  subtitle,
  sidebar,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#eef0f4] text-[#1a2331]">
      <aside className="flex-none border-b border-[#e4e7ee] bg-white">
        <div className="flex items-center gap-4 border-b border-[#263244] bg-[#101828] px-[22px] py-3">
          <div className="flex flex-none items-center gap-2">
            {sidebar ? (
              <button
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Recolher menu lateral' : 'Expandir menu lateral'}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101828]"
                onClick={() => setSidebarOpen((value) => !value)}
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
          <div className="flex flex-none items-center">
            <UserMenu onLogout={onLogout} onPageChange={onPageChange} />
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
            <div className="flex flex-none flex-col gap-0.5 border-t border-[#e4e7ee] bg-white px-2 py-2">
              <button
                aria-checked="true"
                aria-label="Aparência - modo claro"
                className="flex h-9 w-full cursor-not-allowed items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-[#c2c8d2]"
                disabled
                role="switch"
                title="Em desenvolvimento"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="flex h-[15px] w-[15px] flex-none items-center justify-center text-[15px] leading-none"
                >
                  ◐
                </span>
                <span className="min-w-0 flex-1 truncate">Aparência</span>
                <span aria-hidden="true" className="relative inline-flex h-5 w-9 flex-none items-center rounded-full bg-[var(--accent)] opacity-60">
                  <span className="inline-block h-4 w-4 translate-x-4 rounded-full bg-white shadow" />
                </span>
              </button>
              <button
                className="flex h-9 w-full cursor-not-allowed items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-[#c2c8d2]"
                disabled
                title="Em desenvolvimento"
                type="button"
              >
                <Settings size={15} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">Configurações</span>
              </button>
              <button
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-[#475467] transition hover:bg-[#f3f5f9]"
                onClick={onLogout}
                type="button"
              >
                <LogOut size={15} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">Sair</span>
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader page={activePage} subtitle={subtitle} title={title} />
          <main className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-10 pt-[22px]">{children}</main>
        </div>
      </div>
    </div>
  )
}
