import type { LucideIcon } from 'lucide-react'

import type { PageKey } from '../../Pages/Dashboard/pageConfig'
import { navigationGroups } from '../../Pages/Dashboard/pageConfig'
import { cn } from '../../lib/utils'

type AppNavigationProps = {
  activePage: PageKey
  onPageChange: (page: PageKey) => void
}

type NavigationItem = {
  key: PageKey
  label: string
  icon: LucideIcon
}

export function AppNavigation({ activePage, onPageChange }: AppNavigationProps) {
  const items = navigationGroups.reduce<NavigationItem[]>(
    (acc, group) => [...acc, ...group.items],
    [],
  )

  return (
    <nav className="flex flex-wrap items-center gap-1 px-4 py-2">
      {items.map((item) => {
        const Icon = item.icon
        const active = activePage === item.key

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onPageChange(item.key)}
            className={cn(
              'flex h-9 flex-none items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-[#475467] transition hover:bg-[#f3f5f9]',
              active && 'bg-[var(--accent-weak)] font-semibold text-[var(--accent)]',
            )}
          >
            <Icon size={15} aria-hidden="true" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
