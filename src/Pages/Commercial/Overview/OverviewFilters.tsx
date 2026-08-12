import type { ReactNode } from 'react'

import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
} from '../../../data/commercialCalendar'
import type { CommercialCity, CommercialCityId } from '../../../data/commercialTypes'
import type { SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import {
  initialCommercialOverviewFilters,
  type CommercialOverviewFilters,
} from './overviewModel'

// `overview-field` e `overview-date-input` existem só para o tema escuro desta
// página: superfície elevada nos controles e calendário nativo em esquema claro.
const fieldClass =
  'overview-field flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-item)] sm:flex-none'
const controlClass = 'min-w-0 flex-1 bg-transparent font-semibold outline-none sm:max-w-[190px]'
const dateControlClass = `${controlClass} overview-date-input`
const selectControlClass = `${controlClass} overview-select`

/**
 * Painel de filtros da Visão Geral.
 *
 * `Limpar filtros` fecha a própria linha dos controles, alinhado à direita
 * enquanto houver espaço e quebrando junto com os campos quando não houver. O
 * painel não tem mais faixa inferior: a quantidade de vendas do recorte que
 * ocupava esse lugar repetia o KPI `Vendas ativadas`, exibido logo abaixo.
 */
export function OverviewFilters({
  cities,
  filters,
  onChange,
}: {
  cities: readonly CommercialCity[]
  filters: CommercialOverviewFilters
  onChange: (filters: CommercialOverviewFilters) => void
}) {
  const initial = initialCommercialOverviewFilters()
  const isInitial =
    filters.startDate === initial.startDate &&
    filters.endDate === initial.endDate &&
    filters.cityId === null &&
    filters.team === 'todos'

  return (
    <section
      aria-label="Filtros da Visão Geral Comercial"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FilterField label="Início">
          <input
            className={dateControlClass}
            max={COMMERCIAL_PERIOD_END}
            min={COMMERCIAL_PERIOD_START}
            onChange={(event) => {
              const startDate = event.target.value
              if (!startDate) return
              onChange({
                ...filters,
                startDate,
                endDate: startDate > filters.endDate ? startDate : filters.endDate,
              })
            }}
            required
            type="date"
            value={filters.startDate}
          />
        </FilterField>

        <FilterField label="Fim">
          <input
            className={dateControlClass}
            max={COMMERCIAL_PERIOD_END}
            min={COMMERCIAL_PERIOD_START}
            onChange={(event) => {
              const endDate = event.target.value
              if (!endDate) return
              onChange({
                ...filters,
                startDate: endDate < filters.startDate ? endDate : filters.startDate,
                endDate,
              })
            }}
            required
            type="date"
            value={filters.endDate}
          />
        </FilterField>

        <FilterField label="Cidade">
          <select
            className={selectControlClass}
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
            className={selectControlClass}
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

        {/* `ml-auto` encosta a ação na direita da faixa de controles quando
            sobra espaço. Sem espaço, ela apenas desce com o `flex-wrap`, ainda
            à direita, sem criar rolagem horizontal.

            O anel de foco é o mesmo `var(--accent)` que o `Limpar filtros` de
            Metas e Desempenho já usa, e vem por `focus-visible`: aparece na
            navegação por Tab e não fica preso depois de um clique comum. O
            botão desabilitado não recebe foco, então o estado inicial continua
            exatamente como estava. */}
        <button
          className="ml-auto flex-none rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent"
          disabled={isInitial}
          onClick={() => onChange(initialCommercialOverviewFilters())}
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
