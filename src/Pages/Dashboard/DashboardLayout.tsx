import { LayoutDashboard } from 'lucide-react'
import type { ReactNode } from 'react'

import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { AppNavigation } from '../../components/layout/AppNavigation'
import { UserMenu } from '../../components/layout/UserMenu'

type DashboardLayoutProps = {
  activePage: PageKey
  onPageChange: (page: PageKey) => void
  onLogout: () => void
  children: ReactNode
}

export function DashboardLayout({
  activePage,
  onPageChange,
  onLogout,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#eef0f4] text-[#1a2331]">
      <aside className="flex-none border-b border-[#e4e7ee] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-[#eef0f4] px-[22px] py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[var(--accent)] text-white">
              <LayoutDashboard size={18} aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-[#101828]">Impacto Businness Intelligence</div>
              <div className="text-[11px] font-medium text-[#98a2b3]">Business Intelligence</div>
            </div>
          </div>
          <UserMenu onLogout={onLogout} onPageChange={onPageChange} />
        </div>
        <AppNavigation activePage={activePage} onPageChange={onPageChange} />
      </aside>
      <div className="flex min-h-0 flex-1 flex-col">
        <AppHeader page={activePage} />
        <main className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-10 pt-[22px]">{children}</main>
      </div>
    </div>
  )
}
