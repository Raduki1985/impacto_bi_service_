import type { ReactNode } from 'react'

import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
} from '../../../data/commercialCalendar'
import type {
  CommercialCity,
  CommercialCityId,
  CommercialPartner,
  CommercialSaleStatus,
} from '../../../data/commercialTypes'
import { formatNumber } from '../../../lib/formatters'
import {
  commercialSaleStatusLabels,
  DEFAULT_SALES_PERIOD_END,
  DEFAULT_SALES_PERIOD_START,
  initialSalesPeriodFilters,
  type SalesPeriodFilters,
  type SalesPeriodIndicatorFilter,
  type SalesPeriodReturnFilter,
  type SalesPeriodStatusFilter,
  type SalesPeriodTeamFilter,
} from './salesPeriodModel'

const fieldClass =
  'flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-item)] sm:flex-none'
const controlClass = 'min-w-0 flex-1 bg-transparent font-semibold outline-none sm:max-w-[190px]'

export function SalesPeriodFilters({
  activeSales,
  cities,
  filters,
  onChange,
  partners,
}: {
  activeSales: number
  cities: readonly CommercialCity[]
  filters: SalesPeriodFilters
  onChange: (filters: SalesPeriodFilters) => void
  partners: readonly CommercialPartner[]
}) {
  const isInitial =
    filters.startDate === DEFAULT_SALES_PERIOD_START &&
    filters.endDate === DEFAULT_SALES_PERIOD_END &&
    filters.cityId === null &&
    filters.team === 'todos' &&
    filters.indicator === 'todos' &&
    filters.returnType === 'todos' &&
    filters.status === 'todos'

  return (
    <section
      aria-label="Filtros de vendas por período"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <div className="flex flex-wrap gap-2">
        <FilterField label="Início">
          <input
            className={controlClass}
            onChange={(event) => {
              const startDate = event.target.value
              if (!startDate) return

              onChange({
                ...filters,
                startDate,
                endDate: startDate > filters.endDate ? startDate : filters.endDate,
              })
            }}
            max={COMMERCIAL_PERIOD_END}
            min={COMMERCIAL_PERIOD_START}
            required
            type="date"
            value={filters.startDate}
          />
        </FilterField>

        <FilterField label="Fim">
          <input
            className={controlClass}
            onChange={(event) => {
              const endDate = event.target.value
              if (!endDate) return

              onChange({
                ...filters,
                startDate: endDate < filters.startDate ? endDate : filters.startDate,
                endDate,
              })
            }}
            max={COMMERCIAL_PERIOD_END}
            min={COMMERCIAL_PERIOD_START}
            required
            type="date"
            value={filters.endDate}
          />
        </FilterField>

        <FilterField label="Cidade">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({
                ...filters,
                cityId:
                  event.target.value === 'todas'
                    ? null
                    : (event.target.value as CommercialCityId),
              })
            }
            value={filters.cityId ?? 'todas'}
          >
            <option value="todas">Todas as cidades</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Time">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({ ...filters, team: event.target.value as SalesPeriodTeamFilter })
            }
            value={filters.team}
          >
            <option value="todos">Todos os times</option>
            <option value="comercial">Comercial</option>
            <option value="corporativo">Corporativo</option>
          </select>
        </FilterField>

        <FilterField label="CPF indicador">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({
                ...filters,
                indicator: event.target.value as SalesPeriodIndicatorFilter,
              })
            }
            value={filters.indicator}
          >
            <option value="todos">Todos</option>
            <option value="sem-indicacao">Sem indicação</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.indicationCode}>
                {partner.indicationCode}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Cliente">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({ ...filters, returnType: event.target.value as SalesPeriodReturnFilter })
            }
            value={filters.returnType}
          >
            <option value="todos">Novos e retornados</option>
            <option value="novos">Somente novos</option>
            <option value="retornaram">Retornaram à base</option>
          </select>
        </FilterField>

        <FilterField label="Status">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as SalesPeriodStatusFilter })
            }
            value={filters.status}
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(commercialSaleStatusLabels) as CommercialSaleStatus[]).map((status) => (
              <option key={status} value={status}>
                {commercialSaleStatusLabels[status]}
              </option>
            ))}
          </select>
        </FilterField>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] pt-2.5">
        <p className="text-[11.5px] text-[var(--text-secondary)]">
          <b className="font-mono text-[var(--text-item)]">{formatNumber(activeSales)}</b>{' '}
          {activeSales === 1 ? 'venda ativada no recorte' : 'vendas ativadas no recorte'}
        </p>
        <button
          className="rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent)] transition hover:bg-[var(--hover-bg)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
          disabled={isInitial}
          onClick={() => onChange(initialSalesPeriodFilters())}
          type="button"
        >
          Limpar filtros
        </button>
      </div>
    </section>
  )
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className={fieldClass}>
      <span className="flex-none text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  )
}
