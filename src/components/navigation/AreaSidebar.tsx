import { Fragment } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

export type AreaSidebarItem = {
  key: string
  label: string
  icon?: LucideIcon
  disabled?: boolean
  sectionLabel?: string
}

type AreaSidebarProps = {
  areaLabel: string
  items: AreaSidebarItem[]
  activeKey: string | null
  onItemSelect: (key: string) => void
}

export function AreaSidebar({ areaLabel, items, activeKey, onItemSelect }: AreaSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-[220px] flex-none flex-col border-r border-[#e4e7ee] bg-white">
      <div className="px-3.5 pb-2 pt-3.5 text-[10.5px] font-bold uppercase tracking-[.06em] text-[#b0b6c3]">
        {areaLabel}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeKey === item.key

          return (
            <Fragment key={item.key}>
              {item.sectionLabel ? (
                <div className="shrink-0 px-2.5 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[.06em] text-[#b0b6c3]">
                  {item.sectionLabel}
                </div>
              ) : null}
              <button
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-[#475467] transition hover:bg-[#f3f5f9]',
                  active && 'bg-[var(--accent-weak)] font-semibold text-[var(--accent)]',
                  item.disabled && 'cursor-not-allowed text-[#c2c8d2] hover:bg-transparent',
                )}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  onItemSelect(item.key)
                }}
                title={item.disabled ? 'Em desenvolvimento' : undefined}
                type="button"
              >
                {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            </Fragment>
          )
        })}
      </nav>
    </aside>
  )
}
