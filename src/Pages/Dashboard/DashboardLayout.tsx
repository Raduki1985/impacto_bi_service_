import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { AreaSelector } from '../../components/navigation/AreaSelector'

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
              aria-label="Ir para a Visão Geral Corporativa"
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101828]"
              to="/dashboard/inicio"
            >
              <img
                className="h-9 w-auto max-w-[236px] object-contain"
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
        {sidebarOpen ? sidebar : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader page={activePage} subtitle={subtitle} title={title} />
          <main className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-10 pt-[22px]">{children}</main>
        </div>
      </div>
    </div>
  )
}
