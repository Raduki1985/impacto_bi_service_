import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronDown, Trash2, Users } from 'lucide-react'

import {
  COMMERCIAL_MONTHS,
  DEFAULT_COMMERCIAL_MONTH,
  isCommercialMonthKey,
  monthLabel,
} from '../../../data/commercialCalendar'
import type {
  CommercialCity,
  CommercialCityId,
  CommercialGoalsFilters,
  CommercialSeller,
} from '../../../data/commercialTypes'
import { formatNumber } from '../../../lib/formatters'
import { cn } from '../../../lib/utils'
import { initialCommercialGoalsFilters } from './commercialGoalsModel'

const ALL_CITIES = 'todas'

const fieldClass =
  'flex flex-none items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] text-[var(--text-item)] focus-within:ring-2 focus-within:ring-[var(--accent)]'

const controlClass = 'bg-transparent font-semibold outline-none'

type GoalsFiltersProps = {
  cities: readonly CommercialCity[]
  sellers: readonly CommercialSeller[]
  filters: CommercialGoalsFilters
  activeSales: number
  onChange: (filters: CommercialGoalsFilters) => void
}

/**
 * Filtros da página: mês único, cidade única e vendedores em seleção múltipla.
 *
 * O Vendedor precisa aceitar mais de um nome porque a meta do recorte é 50 x
 * quantidade de vendedores internos selecionados, e porque a leitura de interno
 * junto com Corporativo é justamente um dos casos que a página tem de explicar.
 *
 * Colaboradores não aparecem aqui: eles não são vendedores, não têm meta e a
 * contribuição deles é mostrada agregada.
 */
export function GoalsFilters({
  cities,
  sellers,
  filters,
  activeSales,
  onChange,
}: GoalsFiltersProps) {
  const isInitial =
    filters.cityId === null &&
    filters.sellerIds.length === 0 &&
    filters.month === DEFAULT_COMMERCIAL_MONTH

  return (
    <section
      aria-label="Filtros de metas e desempenho"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
    >
      <label className={fieldClass}>
        <span className="text-[var(--text-secondary)]">Mês</span>
        <select
          className={controlClass}
          onChange={(event) => {
            const value = event.target.value

            if (isCommercialMonthKey(value)) onChange({ ...filters, month: value })
          }}
          value={filters.month}
        >
          {COMMERCIAL_MONTHS.map((month) => (
            <option key={month} value={month}>
              {monthLabel(month)}
            </option>
          ))}
        </select>
      </label>

      <label className={fieldClass}>
        <span className="text-[var(--text-secondary)]">Cidade</span>
        <select
          className={cn(controlClass, 'max-w-[190px]')}
          onChange={(event) => {
            const value = event.target.value

            onChange({
              ...filters,
              cityId: value === ALL_CITIES ? null : (value as CommercialCityId),
            })
          }}
          value={filters.cityId ?? ALL_CITIES}
        >
          <option value={ALL_CITIES}>Todas as cidades</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>

      <SellerFilter
        cities={cities}
        onChange={(sellerIds) => onChange({ ...filters, sellerIds })}
        sellers={sellers}
        selectedIds={filters.sellerIds}
      />

      <p className="flex flex-none items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--text-secondary)]">
        <b className="font-mono text-[var(--text-item)]">{formatNumber(activeSales)}</b>
        <span className="ml-1">{activeSales === 1 ? 'venda ativa' : 'vendas ativas'}</span>
      </p>

      <button
        className="ml-auto flex flex-none cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold text-[var(--accent)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
        disabled={isInitial}
        onClick={() => onChange(initialCommercialGoalsFilters(DEFAULT_COMMERCIAL_MONTH))}
        type="button"
      >
        <Trash2 aria-hidden="true" size={13} />
        Limpar filtros
      </button>
    </section>
  )
}

function sellerButtonLabel(selected: readonly CommercialSeller[]): string {
  if (selected.length === 0) return 'Todos os vendedores'
  if (selected.length === 1) return selected[0].name

  return `${formatNumber(selected.length)} vendedores`
}

/**
 * Seleção múltipla de vendedores.
 *
 * É um botão de divulgação com um grupo de caixas de seleção: navega por Tab,
 * marca por espaço e fecha por Escape ou por clique fora, sem depender de
 * componente novo. Cada nome traz a cidade, e o Corporativo traz a informação de
 * que não tem meta individual de volume.
 */
function SellerFilter({
  cities,
  onChange,
  sellers,
  selectedIds,
}: {
  cities: readonly CommercialCity[]
  onChange: (sellerIds: readonly string[]) => void
  sellers: readonly CommercialSeller[]
  selectedIds: readonly string[]
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const cityNames = new Map(cities.map((city) => [city.id, city.name]))
  const selected = sellers.filter((seller) => selectedIds.includes(seller.id))
  const internal = sellers.filter((seller) => seller.segment === 'interno' && seller.active)
  const corporate = sellers.filter((seller) => seller.segment === 'corporativo' && seller.active)

  const toggle = (sellerId: string) => {
    onChange(
      selectedIds.includes(sellerId)
        ? selectedIds.filter((id) => id !== sellerId)
        : [...selectedIds, sellerId],
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return

    event.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className="relative flex-none" onKeyDown={handleKeyDown} ref={containerRef}>
      <button
        aria-expanded={open}
        className={cn(
          fieldClass,
          'cursor-pointer py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        )}
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <Users aria-hidden="true" className="text-[var(--text-secondary)]" size={13} />
        <span className="text-[var(--text-secondary)]">Vendedor</span>
        <span className="max-w-[210px] truncate font-semibold">{sellerButtonLabel(selected)}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('text-[var(--text-secondary)] transition', open && 'rotate-180')}
          size={14}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[340px] w-[290px] max-w-[calc(100vw-64px)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[0_14px_34px_-16px_rgba(13,27,49,.5)]">
          <fieldset className="border-0 p-0">
            <legend className="sr-only">Vendedores do Comercial</legend>
            <SellerGroup
              cityNames={cityNames}
              label="Vendas Internas, meta de 50 vendas por mês"
              onToggle={toggle}
              selectedIds={selectedIds}
              sellers={internal}
            />
            <SellerGroup
              cityNames={cityNames}
              label="Corporativo, sem meta individual de volume"
              onToggle={toggle}
              selectedIds={selectedIds}
              sellers={corporate}
            />
          </fieldset>
          <button
            className="mt-1 w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--accent)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
            disabled={selectedIds.length === 0}
            onClick={() => onChange([])}
            type="button"
          >
            Limpar seleção de vendedores
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SellerGroup({
  cityNames,
  label,
  onToggle,
  selectedIds,
  sellers,
}: {
  cityNames: ReadonlyMap<CommercialCityId, string>
  label: string
  onToggle: (sellerId: string) => void
  selectedIds: readonly string[]
  sellers: readonly CommercialSeller[]
}) {
  if (sellers.length === 0) return null

  return (
    <div className="mb-1">
      <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.6px] text-[var(--text-secondary)]">
        {label}
      </p>
      {sellers.map((seller) => (
        <label
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-[var(--text-item)] transition hover:bg-[var(--hover-bg)]"
          key={seller.id}
        >
          <input
            checked={selectedIds.includes(seller.id)}
            className="h-3.5 w-3.5 flex-none accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onChange={() => onToggle(seller.id)}
            type="checkbox"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate" title={seller.name}>
              {seller.name}
            </span>
            <span className="block truncate text-[11px] text-[var(--text-secondary)]">
              {seller.cityId === null
                ? 'Atuação regional'
                : (cityNames.get(seller.cityId) ?? 'Cidade não catalogada')}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}
