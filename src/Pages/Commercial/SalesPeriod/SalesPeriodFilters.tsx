import type { ReactNode } from 'react'

import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
} from '../../../data/commercialCalendar'
import type { CommercialCity, CommercialCityId } from '../../../data/commercialTypes'
import { formatNumber } from '../../../lib/formatters'
import {
  initialActiveSalesFilters,
  salesPeriodOriginLabels,
  type ActiveSalesFilters,
  type ActiveSalesOptions,
  type SalesPeriodOriginFilter,
} from './salesPeriodModel'

/**
 * O anel de foco fica no campo inteiro, e não no controle.
 *
 * O controle usa `outline-none` para o campo parecer um só elemento; sem o
 * `focus-within` aqui, a navegação por teclado deixaria de mostrar onde está.
 */
const fieldClass =
  'flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-item)] focus-within:ring-2 focus-within:ring-[var(--accent)] sm:flex-none'
const controlClass = 'min-w-0 flex-1 bg-transparent font-semibold outline-none sm:max-w-[190px]'

/**
 * Filtros de Vendas por Período.
 *
 * O universo já está fixado em vendas atualmente ativas, então não existe
 * filtro de status: ele só poderia contradizer o próprio bloco. Time, CPF do
 * indicador e retorno à base também não aparecem, porque nenhum deles é
 * dimensão deste bloco.
 */
export function SalesPeriodFilters({
  activeSales,
  cities,
  filters,
  onChange,
  options,
}: {
  activeSales: number
  cities: readonly CommercialCity[]
  filters: ActiveSalesFilters
  onChange: (filters: ActiveSalesFilters) => void
  options: ActiveSalesOptions
}) {
  const initial = initialActiveSalesFilters()
  const isInitial =
    filters.periodStart === initial.periodStart &&
    filters.periodEnd === initial.periodEnd &&
    filters.cityId === null &&
    filters.sellerId === null &&
    filters.origin === 'todas' &&
    filters.planName === null

  return (
    <section
      aria-label="Filtros de vendas ativas iniciadas no período"
      // `executive-panel` (24/09/2026): a mesma superfície do tema escuro dos
      // cards e painéis desta página, para a faixa não ficar um degrau mais
      // escura que eles.
      className="executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <div className="flex flex-wrap gap-2">
        <FilterField label="Data inicial">
          <input
            className={controlClass}
            onChange={(event) => {
              const periodStart = event.target.value
              // Data vazia ou incompleta é descartada: o recorte nunca fica sem
              // período, e o valor anterior continua valendo.
              if (!periodStart) return

              onChange({
                ...filters,
                periodStart,
                periodEnd: periodStart > filters.periodEnd ? periodStart : filters.periodEnd,
              })
            }}
            max={COMMERCIAL_PERIOD_END}
            min={COMMERCIAL_PERIOD_START}
            required
            type="date"
            value={filters.periodStart}
          />
        </FilterField>

        <FilterField label="Data final">
          <input
            className={controlClass}
            onChange={(event) => {
              const periodEnd = event.target.value
              if (!periodEnd) return

              onChange({
                ...filters,
                periodStart: periodEnd < filters.periodStart ? periodEnd : filters.periodStart,
                periodEnd,
              })
            }}
            max={COMMERCIAL_PERIOD_END}
            min={COMMERCIAL_PERIOD_START}
            required
            type="date"
            value={filters.periodEnd}
          />
        </FilterField>

        <FilterField label="Cidade de instalação">
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

        <FilterField label="Vendedor">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({
                ...filters,
                sellerId: event.target.value === 'todos' ? null : event.target.value,
              })
            }
            value={filters.sellerId ?? 'todos'}
          >
            <option value="todos">Todos os vendedores</option>
            {options.sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Origem">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({ ...filters, origin: event.target.value as SalesPeriodOriginFilter })
            }
            value={filters.origin}
          >
            <option value="todas">Todas as origens</option>
            <option value="indicacao">{salesPeriodOriginLabels.indicacao}</option>
            <option value="vendedores">{salesPeriodOriginLabels.vendedores}</option>
          </select>
        </FilterField>

        <FilterField label="Plano">
          <select
            className={controlClass}
            onChange={(event) =>
              onChange({
                ...filters,
                planName: event.target.value === 'todos' ? null : event.target.value,
              })
            }
            value={filters.planName ?? 'todos'}
          >
            <option value="todos">Todos os planos</option>
            {options.plans.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
              </option>
            ))}
          </select>
        </FilterField>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] pt-2.5">
        <p aria-live="polite" className="text-[11.5px] text-[var(--text-secondary)]">
          <b className="font-mono text-[var(--text-item)]">{formatNumber(activeSales)}</b>{' '}
          {activeSales === 1
            ? 'venda ativa iniciada no recorte'
            : 'vendas ativas iniciadas no recorte'}
        </p>
        <button
          className="rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
          disabled={isInitial}
          onClick={() => onChange(initialActiveSalesFilters())}
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
