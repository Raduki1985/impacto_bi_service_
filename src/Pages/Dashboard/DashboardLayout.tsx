import type { ReactNode } from 'react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { AppNavigation } from '../../components/layout/AppNavigation'
import { UserMenu } from '../../components/layout/UserMenu'

type DashboardLayoutProps = {
  /** null identifica uma seção externa às páginas de OS (ex.: um departamento) — usa title/subtitle no lugar do lookup por página. */
  activePage: PageKey | null
  onPageChange: (page: PageKey) => void
  onLogout: () => void
  children: ReactNode
  title?: string
  subtitle?: string
}

export function DashboardLayout({
  activePage,
  onPageChange,
  onLogout,
  children,
  title,
  subtitle,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#eef0f4] text-[#1a2331]">
      <aside className="flex-none border-b border-[#e4e7ee] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-[#263244] bg-[#101828] px-[22px] py-3">
          <div className="flex items-center">
            <img
              className="h-9 w-auto max-w-[236px] object-contain"
              src={logoImpactoHeader}
              alt="Impacto Telecom"
            />
          </div>
          <UserMenu onLogout={onLogout} onPageChange={onPageChange} />
        </div>
        <AppNavigation activePage={activePage} onPageChange={onPageChange} />
      </aside>
      <div className="flex min-h-0 flex-1 flex-col">
        <AppHeader page={activePage} subtitle={subtitle} title={title} />
        <main className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-10 pt-[22px]">{children}</main>
      </div>
    </div>
  )
}
