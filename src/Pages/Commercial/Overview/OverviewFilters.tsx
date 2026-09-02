import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'

import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  formatIsoAsBrDate,
} from '../../../data/commercialCalendar'
import type { CommercialCity, CommercialCityId } from '../../../data/commercialTypes'
import { cn } from '../../../lib/utils'
import type { SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import {
  initialCommercialOverviewFilters,
  type CommercialOverviewFilters,
  type CommercialSellerOption,
} from './overviewModel'

/** Rótulo de cada time como ele aparece no seletor e no chip do resumo. */
const teamLabels: Record<SalesPeriodTeamFilter, string> = {
  todos: 'Todos os times',
  comercial: 'Comercial',
  corporativo: 'Corporativo',
}

type ActiveFilter = {
  field: keyof CommercialOverviewFilters
  label: string
  value: string
}

/**
 * Filtros diferentes do estado inicial, já com nome e valor legíveis.
 *
 * Cidade e vendedor viajam por id, então o nome vem das listas da página. Se um
 * id não estiver mais na lista, o próprio id aparece: melhor mostrar o recorte
 * cru do que esconder que existe um filtro aplicado.
 */
function listActiveFilters(
  filters: CommercialOverviewFilters,
  cities: readonly CommercialCity[],
  sellers: readonly CommercialSellerOption[],
): ActiveFilter[] {
  const initial = initialCommercialOverviewFilters()
  const active: ActiveFilter[] = []

  if (filters.startDate !== initial.startDate) {
    active.push({ field: 'startDate', label: 'Início', value: formatIsoAsBrDate(filters.startDate) })
  }
  if (filters.endDate !== initial.endDate) {
    active.push({ field: 'endDate', label: 'Fim', value: formatIsoAsBrDate(filters.endDate) })
  }
  if (filters.cityId !== null) {
    const city = cities.find((item) => item.id === filters.cityId)
    active.push({ field: 'cityId', label: 'Cidade', value: city?.name ?? filters.cityId })
  }
  if (filters.team !== 'todos') {
    active.push({ field: 'team', label: 'Time', value: teamLabels[filters.team] })
  }
  if (filters.sellerId !== null) {
    const seller = sellers.find((item) => item.id === filters.sellerId)
    active.push({ field: 'sellerId', label: 'Vendedor', value: seller?.name ?? filters.sellerId })
  }

  return active
}

type OverviewFiltersProps = {
  cities: readonly CommercialCity[]
  filters: CommercialOverviewFilters
  onChange: (filters: CommercialOverviewFilters) => void
  sellers: readonly CommercialSellerOption[]
  /**
   * Estado visual inicial da área expandida. O painel abre recolhido; o valor
   * existe para os testes de renderização estática exercitarem o estado
   * expandido, já que a suíte não tem ambiente de DOM para acionar o controle.
   */
  defaultExpanded?: boolean
}

/**
 * Painel recolhível dos cinco filtros da Visão Geral Comercial, no MESMO padrão
 * da Visão Geral de OS: resumo sempre visível com período e chips do que está
 * aplicado, e os controles em grupos de negócio na área expandida, Período
 * (Início, Fim) e Operação (Cidade, Time, Vendedor).
 *
 * O painel é o conteúdo da faixa fixa da página (`PageStickyHeader`), e não um
 * card solto: sem moldura nem canto próprio, com o respiro horizontal de 26px
 * alinhado ao conteúdo do `main`. Superfície e borda inferior vêm da faixa, e
 * por isso ele fica FORA do contêiner `commercial-overview`, que redefine as
 * superfícies do tema escuro só para os painéis da página.
 *
 * A quantidade de vendas do recorte não aparece aqui de propósito: ela repetia
 * o KPI `Vendas ativadas`, exibido logo abaixo.
 */
export function OverviewFilters({
  cities,
  defaultExpanded = false,
  filters,
  onChange,
  sellers,
}: OverviewFiltersProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const contentId = useId()

  const activeFilters = listActiveFilters(filters, cities, sellers)
  // O período já aparece por extenso no resumo permanente, então Início e Fim
  // alterados mantêm o Limpar filtros disponível mas não viram chip repetido.
  const chips = activeFilters.filter(
    (active) => active.field !== 'startDate' && active.field !== 'endDate',
  )
  const period = `${formatIsoAsBrDate(filters.startDate)} a ${formatIsoAsBrDate(filters.endDate)}`

  return (
    <section aria-labelledby={titleId} className="commercial-overview-filters">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-[26px] py-3">
        <span id={titleId} className="text-[13.5px] font-semibold text-[var(--text-heading)]">
          Filtros da análise
        </span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">{period}</span>
        {/* Os filtros aplicados aparecem identificados direto nos chips, no
            resumo sempre visível: nada de contador de ativos, e nenhuma linha
            extra quando o painel está recolhido. */}
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip.field}
                className="commercial-filter-chip max-w-[260px] truncate rounded-full border border-transparent bg-[var(--accent-weak)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--accent)]"
                title={`${chip.label}: ${chip.value}`}
              >
                {chip.label}: {chip.value}
              </li>
            ))}
          </ul>
        ) : null}
        {/* Ações da faixa, agrupadas e estáveis à direita: limpar aparece
            diante de QUALQUER alteração (datas incluídas) e expandir/recolher
            está sempre presente, por último. */}
        <div className="ml-auto flex flex-none items-center gap-x-1">
          {activeFilters.length > 0 ? (
            <ClearFiltersButton onClick={() => onChange(initialCommercialOverviewFilters())} />
          ) : null}
          <button
            aria-controls={contentId}
            aria-expanded={expanded}
            className="commercial-filter-action flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? 'Recolher filtros' : 'Expandir filtros'}
            <ChevronDown aria-hidden="true" className={expanded ? 'rotate-180' : undefined} size={14} />
          </button>
        </div>
      </div>
      {/* A área expandida permanece no DOM com `hidden` para o aria-controls do
          botão apontar sempre para um id existente. Oculta, ela sai do fluxo,
          da ordem de tabulação e da árvore de acessibilidade.

          `max-h` + rolagem interna valem só para viewport de pouca altura: em
          alturas comuns de desktop os cinco controles ficam bem abaixo de 45vh
          e nenhuma barra aparece. Quando a rolagem existe, o resumo e o botão
          de recolher continuam fora dela, sempre acessíveis. */}
      <div
        hidden={!expanded}
        id={contentId}
        className="max-h-[45vh] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-[var(--border)] px-[26px] py-4"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[minmax(272px,2fr)_3fr]">
          <FilterGroup legend="Período" columnsClass="sm:grid-cols-2">
            {/* Os calendários ficam presos à cobertura da base comercial e
                mantêm início e fim ordenados. A troca também reordena o par,
                para o caso de um valor digitado fora do seletor nativo. */}
            <DateField
              label="Início"
              max={filters.endDate}
              min={COMMERCIAL_PERIOD_START}
              value={filters.startDate}
              onChange={(startDate) => {
                if (!startDate) return
                onChange({
                  ...filters,
                  startDate,
                  endDate: startDate > filters.endDate ? startDate : filters.endDate,
                })
              }}
            />
            <DateField
              label="Fim"
              max={COMMERCIAL_PERIOD_END}
              min={filters.startDate}
              value={filters.endDate}
              onChange={(endDate) => {
                if (!endDate) return
                onChange({
                  ...filters,
                  startDate: endDate < filters.startDate ? endDate : filters.startDate,
                  endDate,
                })
              }}
            />
          </FilterGroup>
          <FilterGroup legend="Operação" columnsClass="sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Cidade"
              value={filters.cityId ?? 'todas'}
              onChange={(value) =>
                onChange({
                  ...filters,
                  cityId: value === 'todas' ? null : (value as CommercialCityId),
                })
              }
            >
              <option value="todas">Todas as cidades</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Time"
              value={filters.team}
              onChange={(value) => onChange({ ...filters, team: value as SalesPeriodTeamFilter })}
            >
              <option value="todos">{teamLabels.todos}</option>
              <option value="comercial">{teamLabels.comercial}</option>
              <option value="corporativo">{teamLabels.corporativo}</option>
            </SelectField>
            {/* Vendedor. A lista vem da base; com o serviço de BI ligado ela
                chega vazia, porque o contrato atual não recebe vendedor, e aí o
                seletor fica desabilitado em vez de oferecer um filtro sem
                efeito nenhum sobre os números. */}
            <SelectField
              disabled={sellers.length === 0}
              label="Vendedor"
              title={
                sellers.length === 0
                  ? 'O serviço de BI ainda não filtra a Visão Geral por vendedor.'
                  : undefined
              }
              value={filters.sellerId ?? 'todos'}
              onChange={(value) =>
                onChange({ ...filters, sellerId: value === 'todos' ? null : value })
              }
            >
              <option value="todos">Todos os vendedores</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </SelectField>
          </FilterGroup>
        </div>
      </div>
    </section>
  )
}

/**
 * Única ação de limpeza do painel, dentro do grupo de ações do resumo: sem
 * cópia no rodapé da área expandida, para existir um só `Limpar filtros` por
 * estado.
 */
function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="commercial-filter-action flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onClick={onClick}
      type="button"
    >
      <Trash2 aria-hidden="true" size={13} />
      Limpar filtros
    </button>
  )
}

function FilterGroup({
  children,
  columnsClass,
  legend,
}: {
  children: ReactNode
  columnsClass: string
  legend: string
}) {
  // `min-w-0` anula o `min-inline-size: min-content` nativo do fieldset, que
  // impediria os controles de encolher e criaria overflow horizontal.
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="p-0 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {legend}
      </legend>
      <div className={cn('mt-2 grid grid-cols-1 gap-3', columnsClass)}>{children}</div>
    </fieldset>
  )
}

const fieldControlClass =
  'h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-[12.5px] font-semibold text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60'

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

function DateField({
  label,
  max,
  min,
  onChange,
  value,
}: FieldProps & { max?: string; min?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</span>
      <input
        className={cn(fieldControlClass, 'font-mono')}
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required
        type="date"
        value={value}
      />
    </label>
  )
}

function SelectField({
  children,
  disabled = false,
  label,
  onChange,
  title,
  value,
}: FieldProps & {
  children: ReactNode
  disabled?: boolean
  title?: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        className={fieldControlClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        title={title}
        value={value}
      >
        {children}
      </select>
    </label>
  )
}
