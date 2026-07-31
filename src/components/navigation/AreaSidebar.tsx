import { Fragment } from 'react'
import { Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

export type AreaSidebarItem = {
  key: string
  label: string
  icon?: LucideIcon
  disabled?: boolean
  sectionLabel?: string
  /**
   * Tooltip do item habilitado, para ler o nome inteiro quando o rótulo trunca
   * na largura da sidebar. Sem ele, o item habilitado continua sem tooltip.
   */
  title?: string
}

type AreaSidebarProps = {
  areaLabel: string
  items: AreaSidebarItem[]
  activeKey: string | null
  onItemSelect: (key: string) => void
  /**
   * Opcional: quando informado, o título da sidebar ganha uma seta compacta de
   * retorno à sua esquerda. Sem ele, apenas o título é renderizado, exatamente
   * como nos demais contextos.
   */
  onDashboardsSelect?: () => void
}

/** Base visual compartilhada pelos itens e pelo controle superior. */
const sidebarButtonClasses =
  'flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)]'

export function AreaSidebar({
  areaLabel,
  items,
  activeKey,
  onDashboardsSelect,
  onItemSelect,
}: AreaSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-[220px] flex-none flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      {/* A altura do topo vem sempre da linha do título: a seta é posicionada de
          forma absoluta e não entra no fluxo vertical, então o título e o
          primeiro item ficam na mesma posição com ou sem seta. A seta é o único
          elemento clicável do topo; o título continua sendo texto. */}
      <div className="px-3.5 pb-2 pt-3.5">
        <div className="relative">
          {onDashboardsSelect ? (
            <button
              aria-label="Voltar para a lista de dashboards"
              className="absolute left-0 top-1/2 -mt-px flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              onClick={onDashboardsSelect}
              title="Voltar para a lista de dashboards"
              type="button"
            >
              <Undo2 size={15} aria-hidden="true" />
            </button>
          ) : null}
          <span
            className={cn(
              'block truncate text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--text-secondary)]',
              onDashboardsSelect && 'pl-7',
            )}
          >
            {areaLabel}
          </span>
        </div>
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
                  sidebarButtonClasses,
                  active && 'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)]',
                  item.disabled && 'cursor-not-allowed text-[var(--text-disabled)] hover:bg-transparent',
                )}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return
                  onItemSelect(item.key)
                }}
                title={item.disabled ? `${item.label} - Em desenvolvimento` : item.title}
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
