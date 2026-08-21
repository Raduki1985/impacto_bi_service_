import { useId, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'

import { useDashboardContext } from '../../contexts/useDashboardData'
import { isValidISODate, listActiveDashboardFilters } from '../../data/dashboardFilters'
import { formatNumber } from '../../lib/formatters'
import { cn } from '../../lib/utils'

/** 2026-08-01 → 01/08/2026, direto da string ISO confiável, sem passar por Date. */
function formatDateBR(iso: string) {
  if (!isValidISODate(iso)) return 'Data não definida'

  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

type DashboardFilterPanelProps = {
  /**
   * Estado visual inicial da área expandida. O painel abre recolhido nas
   * páginas de OS; o valor existe para os testes de renderização estática
   * exercitarem o estado expandido, já que a suíte não tem ambiente de DOM
   * para acionar o controle.
   */
  defaultExpanded?: boolean
}

/**
 * Painel recolhível dos sete filtros aprovados das páginas analíticas de OS,
 * agrupados por significado de negócio: Período (Início, Fim), Operação
 * (Equipe, Tipo de OS, Cidade) e Resultado (Status, Resolução).
 *
 * Vive dentro do conteúdo rolável, antes da página, e rola junto com ela. O
 * estado dos filtros continua no `DashboardDataProvider`, acima das páginas:
 * aqui só existe o estado visual de expansão, reiniciado a cada troca de
 * página pela `key` que o fluxo do dashboard de OS aplica ao painel.
 *
 * Nada aqui usa rolagem horizontal: cabeçalho, chips e grupos quebram de
 * linha com `flex-wrap` ou grade responsiva.
 */
export function DashboardFilterPanel({ defaultExpanded = false }: DashboardFilterPanelProps) {
  const { filters, filteredRows, options, resetFilters, setFilter } = useDashboardContext()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const contentId = useId()

  const activeFilters = listActiveDashboardFilters(filters)
  // O período já aparece por extenso no resumo permanente, então datas
  // alteradas contam no total de ativos mas não viram chip repetido.
  const chips = activeFilters.filter(
    (active) => active.field !== 'dateFrom' && active.field !== 'dateTo',
  )
  const period = `${formatDateBR(filters.dateFrom)} a ${formatDateBR(filters.dateTo)}`

  return (
    <section
      aria-labelledby={titleId}
      className="mb-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-[18px] py-3">
        <span id={titleId} className="text-[13.5px] font-semibold text-[var(--text-heading)]">
          Filtros da análise
        </span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">{period}</span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">
          <b className="font-mono font-semibold text-[var(--text-item)]">
            {formatNumber(filteredRows.length)}
          </b>{' '}
          OS
        </span>
        {activeFilters.length > 0 ? (
          <span className="rounded-full bg-[var(--accent-weak)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--accent)]">
            {activeFilters.length === 1
              ? '1 filtro ativo'
              : `${activeFilters.length} filtros ativos`}
          </span>
        ) : null}
        <button
          aria-controls={contentId}
          aria-expanded={expanded}
          className="ml-auto flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Recolher filtros' : 'Expandir filtros'}
          <ChevronDown aria-hidden="true" className={expanded ? 'rotate-180' : undefined} size={14} />
        </button>
      </div>
      {!expanded && activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--border)] px-[18px] py-2.5">
          {chips.length > 0 ? (
            <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <li
                  key={chip.field}
                  className="max-w-[260px] truncate rounded-full bg-[var(--accent-weak)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--accent)]"
                  title={`${chip.label}: ${chip.value}`}
                >
                  {chip.label}: {chip.value}
                </li>
              ))}
            </ul>
          ) : null}
          <ClearFiltersButton className="ml-auto" onClick={resetFilters} />
        </div>
      ) : null}
      {/* A área expandida permanece no DOM com `hidden` para o aria-controls do
          botão apontar sempre para um id existente. Oculta, ela sai do fluxo,
          da ordem de tabulação e da árvore de acessibilidade. */}
      <div hidden={!expanded} id={contentId} className="border-t border-[var(--border)] px-[18px] py-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[minmax(272px,2fr)_3fr_2fr]">
          <FilterGroup legend="Período" columnsClass="sm:grid-cols-2">
            <DateField
              label="Início"
              max={filters.dateTo}
              value={filters.dateFrom}
              onChange={(value) => setFilter('dateFrom', value)}
            />
            <DateField
              label="Fim"
              min={filters.dateFrom}
              value={filters.dateTo}
              onChange={(value) => setFilter('dateTo', value)}
            />
          </FilterGroup>
          <FilterGroup legend="Operação" columnsClass="sm:grid-cols-3">
            <SelectField
              label="Equipe"
              value={filters.team}
              options={['Todas', ...options.teams]}
              onChange={(value) => setFilter('team', value)}
            />
            <SelectField
              label="Tipo de OS"
              value={filters.serviceType}
              options={['Todos', ...options.serviceTypes]}
              onChange={(value) => setFilter('serviceType', value)}
            />
            <SelectField
              label="Cidade"
              value={filters.city}
              options={['Todas', ...options.cities]}
              onChange={(value) => setFilter('city', value)}
            />
          </FilterGroup>
          <FilterGroup legend="Resultado" columnsClass="sm:grid-cols-2">
            <SelectField
              label="Status"
              value={filters.status}
              options={['Todos', ...options.statuses]}
              onChange={(value) => setFilter('status', value)}
            />
            <SelectField
              label="Resolução"
              value={filters.resolution}
              options={['Todas', ...options.resolutions]}
              onChange={(value) => setFilter('resolution', value)}
            />
          </FilterGroup>
        </div>
        {activeFilters.length > 0 ? (
          <div className="mt-3 flex justify-end">
            <ClearFiltersButton onClick={resetFilters} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ClearFiltersButton({ className, onClick }: { className?: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        className,
      )}
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
  children: React.ReactNode
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
  'h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-[12.5px] font-semibold text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

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
  label,
  onChange,
  options,
  value,
}: FieldProps & { options: string[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        className={fieldControlClass}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
