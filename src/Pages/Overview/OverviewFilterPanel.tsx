import { useId, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'

import { useOverviewOs } from '../../contexts/useOverviewOs'
import { isValidISODate } from '../../data/dashboardFilters'
import { OVERVIEW_OS_DATE_RANGE } from '../../data/overviewOsData'
import { listActiveOverviewOsFilters, OVERVIEW_OS_ALL } from '../../data/overviewOsFilters'
import { formatNumber } from '../../lib/formatters'
import { cn } from '../../lib/utils'

/** 2026-08-01 → 01/08/2026, direto da string ISO confiável, sem passar por Date. */
function formatDateBR(iso: string) {
  if (!isValidISODate(iso)) return 'Data não definida'

  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

type OverviewFilterPanelProps = {
  /**
   * Estado visual inicial da área expandida. O painel abre recolhido; o valor
   * existe para os testes de renderização estática exercitarem o estado
   * expandido, já que a suíte não tem ambiente de DOM para acionar o controle.
   */
  defaultExpanded?: boolean
}

/**
 * Painel recolhível dos sete filtros aprovados, EXCLUSIVO da Visão Geral de
 * OS: substitui o antigo painel compartilhado, que saiu das demais páginas.
 * Os grupos seguem o significado de negócio: Período (Início, Fim), Operação
 * (Equipe, Tipo de OS, Cidade) e Resultado (Status, Resolução).
 *
 * As opções de cada seletor vêm do provedor da Visão Geral, já dependentes do
 * contexto dos campos anteriores: valor sem dado não aparece, e uma seleção
 * que ficou incompatível volta sozinha para o valor neutro.
 *
 * O painel é o conteúdo da faixa fixa da página (`PageStickyHeader`), e não um
 * card solto: sem moldura nem canto próprio, com o respiro horizontal de 26px
 * alinhado ao conteúdo do `main`. Superfície e borda inferior vêm da faixa.
 * Nada aqui usa rolagem horizontal: cabeçalho, chips e grupos quebram de linha.
 */
export function OverviewFilterPanel({ defaultExpanded = false }: OverviewFilterPanelProps) {
  const { filters, filteredRecords, options, resetFilters, setFilter } = useOverviewOs()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const contentId = useId()
  const emptyResolutionId = useId()

  const activeFilters = listActiveOverviewOsFilters(filters)
  // O período já aparece por extenso no resumo permanente, então Início e Fim
  // alterados mantêm o Limpar filtros disponível mas não viram chip repetido.
  const chips = activeFilters.filter(
    (active) => active.field !== 'dateFrom' && active.field !== 'dateTo',
  )
  const period = `${formatDateBR(filters.dateFrom)} a ${formatDateBR(filters.dateTo)}`
  // Sem nenhuma resolução preenchida no contexto, o seletor não tem o que
  // oferecer: fica no neutro, desabilitado e explicando o porquê.
  const resolutionEmpty = options.resolutions.length === 0

  return (
    <section aria-labelledby={titleId} className="os-overview-filters">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-[26px] py-3">
        <span id={titleId} className="text-[13.5px] font-semibold text-[var(--text-heading)]">
          Filtros da análise
        </span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">{period}</span>
        <span className="text-[12.5px] text-[var(--text-secondary)]">
          <b className="font-mono font-semibold text-[var(--text-item)]">
            {formatNumber(filteredRecords.length)}
          </b>{' '}
          OS
        </span>
        {/* Os filtros aplicados aparecem identificados direto nos chips, no
            resumo sempre visível: nada de contador de ativos, e nenhuma linha
            extra quando o painel está recolhido. */}
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip.field}
                className="os-filter-chip max-w-[260px] truncate rounded-full border border-transparent bg-[var(--accent-weak)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--accent)]"
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
          {activeFilters.length > 0 ? <ClearFiltersButton onClick={resetFilters} /> : null}
          <button
            aria-controls={contentId}
            aria-expanded={expanded}
            className="os-filter-action flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
          alturas comuns de desktop os sete controles ficam bem abaixo de 45vh
          e nenhuma barra aparece. Quando a rolagem existe, o resumo e o botão
          de recolher continuam fora dela, sempre acessíveis. */}
      <div
        hidden={!expanded}
        id={contentId}
        className="max-h-[45vh] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-[var(--border)] px-[26px] py-4"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[minmax(272px,2fr)_3fr_2fr]">
          <FilterGroup legend="Período" columnsClass="sm:grid-cols-2">
            {/* Os calendários ficam presos à cobertura real da fonte
                (06/04/2026 a 21/08/2026) e mantêm início e fim ordenados. */}
            <DateField
              label="Início"
              max={filters.dateTo}
              min={OVERVIEW_OS_DATE_RANGE.min}
              value={filters.dateFrom}
              onChange={(value) => setFilter('dateFrom', value)}
            />
            <DateField
              label="Fim"
              max={OVERVIEW_OS_DATE_RANGE.max}
              min={filters.dateFrom}
              value={filters.dateTo}
              onChange={(value) => setFilter('dateTo', value)}
            />
          </FilterGroup>
          <FilterGroup legend="Operação" columnsClass="sm:grid-cols-3">
            <SelectField
              label="Equipe"
              value={filters.team}
              options={[OVERVIEW_OS_ALL.team, ...options.teams]}
              onChange={(value) => setFilter('team', value)}
            />
            <SelectField
              label="Tipo de OS"
              value={filters.serviceType}
              options={[OVERVIEW_OS_ALL.serviceType, ...options.serviceTypes]}
              onChange={(value) => setFilter('serviceType', value)}
            />
            <SelectField
              label="Cidade"
              value={filters.city}
              options={[OVERVIEW_OS_ALL.city, ...options.cities]}
              onChange={(value) => setFilter('city', value)}
            />
          </FilterGroup>
          <FilterGroup legend="Resultado" columnsClass="sm:grid-cols-2">
            <SelectField
              label="Status"
              value={filters.status}
              options={[OVERVIEW_OS_ALL.status, ...options.statuses]}
              onChange={(value) => setFilter('status', value)}
            />
            <SelectField
              describedBy={resolutionEmpty ? emptyResolutionId : undefined}
              disabled={resolutionEmpty}
              label="Resolução"
              value={filters.resolution}
              options={[OVERVIEW_OS_ALL.resolution, ...options.resolutions]}
              onChange={(value) => setFilter('resolution', value)}
            >
              {resolutionEmpty ? (
                <span
                  className="text-[11px] text-[var(--text-secondary)]"
                  id={emptyResolutionId}
                >
                  Sem resoluções disponíveis no contexto filtrado.
                </span>
              ) : null}
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
      className="os-filter-action flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
  describedBy,
  disabled = false,
  label,
  onChange,
  options,
  value,
}: FieldProps & {
  children?: React.ReactNode
  describedBy?: string
  disabled?: boolean
  options: string[]
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        aria-describedby={describedBy}
        className={fieldControlClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {children}
    </label>
  )
}
