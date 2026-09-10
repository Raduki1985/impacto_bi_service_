import { useId, useState } from 'react'
import { ChevronDown, Trash2, X } from 'lucide-react'

import { DateField } from '../../components/ui/DateField'
import { useOverviewOs } from '../../contexts/useOverviewOs'
import { isValidISODate } from '../../data/dashboardFilters'
import {
  listActiveOverviewOsFilters,
  OVERVIEW_OS_ALL,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
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
 * Painel recolhível dos oito filtros da Visão Geral de OS, EXCLUSIVO dela:
 * substitui o antigo painel compartilhado, que saiu das demais páginas. Os
 * grupos seguem o significado de negócio: Período (Início, Fim), Operação
 * (Equipe, Técnico, Tipo de OS, Categoria, Cidade) e Resultado (Status).
 * Resolução saiu do painel; o desfecho segue visível no ranking de resoluções.
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
  const { coverage, filters, filteredRecords, options, resetFilters, setFilter, technicians } =
    useOverviewOs()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const contentId = useId()

  // Identificador para nome, usado no seletor e no chip do filtro ativo. Vazio
  // quando o serviço não manda o catálogo, e é esse vazio que desabilita o
  // seletor de técnico.
  const technicianNames = new Map(technicians.map((technician) => [technician.id, technician.name]))
  // A cobertura vai junto: o período padrão é o da fonte em uso, e sem ela a
  // página ligada ao serviço abriria com Início e Fim contados como alterados.
  const activeFilters = listActiveOverviewOsFilters(filters, coverage)

  /** O "x" do chip devolve só aquele campo ao valor neutro. */
  function clearChip(field: keyof OverviewOsFilters) {
    if (field === 'dateFrom' || field === 'dateTo') return
    setFilter(field, OVERVIEW_OS_ALL[field])
  }
  // O período já aparece por extenso no resumo permanente, então Início e Fim
  // alterados mantêm o Limpar filtros disponível mas não viram chip repetido.
  const chips = activeFilters.filter(
    (active) => active.field !== 'dateFrom' && active.field !== 'dateTo',
  )
  const period = `${formatDateBR(filters.dateFrom)} a ${formatDateBR(filters.dateTo)}`

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
            extra quando o painel está recolhido. Cada chip tem o "x" que tira
            só ele; Limpar filtros continua tirando todos. */}
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips.map((chip) => {
              // O chip do Técnico mostra o nome, e não o identificador que o
              // filtro guarda. Sem o catálogo o chip nem chega a existir,
              // porque o seletor está desabilitado.
              const texto =
                chip.field === 'technicianId'
                  ? (technicianNames.get(chip.value) ?? chip.value)
                  : chip.value

              return (
                <li
                  key={chip.field}
                  className="os-filter-chip flex max-w-[260px] items-center gap-1 rounded-full border border-transparent bg-[var(--accent-weak)] py-0.5 pr-1 pl-2.5 text-[11.5px] font-medium text-[var(--accent)]"
                  title={`${chip.label}: ${texto}`}
                >
                  <span className="truncate">
                    {chip.label}: {texto}
                  </span>
                  <button
                    aria-label={`Remover filtro ${chip.label}: ${texto}`}
                    className="os-filter-chip-remove flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    onClick={() => clearChip(chip.field)}
                    type="button"
                  >
                    <X aria-hidden="true" size={11} />
                  </button>
                </li>
              )
            })}
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
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[minmax(272px,2fr)_5fr_minmax(160px,1fr)]">
          <FilterGroup legend="Período" columnsClass="sm:grid-cols-2">
            {/* Os calendários ficam presos à cobertura real da fonte em uso e
                mantêm início e fim ordenados. A cobertura vem do provedor
                porque deixou de ser fixa: o arquivo local cobre 06/04/2026 a
                21/08/2026, e a API traz a janela real do banco. */}
            <DateField
              label="Início"
              max={filters.dateTo}
              min={coverage.min}
              value={filters.dateFrom}
              onChange={(value) => setFilter('dateFrom', value)}
            />
            <DateField
              label="Fim"
              max={coverage.max}
              min={filters.dateFrom}
              value={filters.dateTo}
              onChange={(value) => setFilter('dateTo', value)}
            />
          </FilterGroup>
          <FilterGroup legend="Operação" columnsClass="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <SelectField
              label="Equipe"
              value={filters.team}
              options={[OVERVIEW_OS_ALL.team, ...options.teams]}
              onChange={(value) => setFilter('team', value)}
            />
            {/* Técnico. O filtro guarda o identificador que a OS carrega e a
                lista mostra o nome do catálogo do serviço. Sem catálogo, que é
                o caso da base local sanitizada, o seletor fica desabilitado e
                diz por quê: listar identificador não ajuda ninguém. */}
            <SelectField
              disabled={technicianNames.size === 0}
              label="Técnico"
              onChange={(value) => setFilter('technicianId', value)}
              optionLabel={(option) => technicianNames.get(option) ?? option}
              // Sem catálogo, o seletor oferece só o valor neutro: listar as chaves
              // anônimas dos técnicos não ajudaria ninguém a decidir nada.
              options={
                technicianNames.size === 0
                  ? [OVERVIEW_OS_ALL.technicianId]
                  : [OVERVIEW_OS_ALL.technicianId, ...options.technicians]
              }
              value={filters.technicianId}
            >
              {technicianNames.size === 0 ? (
                <span className="text-[10.5px] leading-tight text-[var(--text-secondary)]">
                  Disponível quando o serviço enviar a lista de técnicos.
                </span>
              ) : null}
            </SelectField>
            <SelectField
              label="Tipo de OS"
              value={filters.serviceType}
              options={[OVERVIEW_OS_ALL.serviceType, ...options.serviceTypes]}
              onChange={(value) => setFilter('serviceType', value)}
            />
            <SelectField
              label="Categoria"
              value={filters.category}
              options={[OVERVIEW_OS_ALL.category, ...options.categories]}
              onChange={(value) => setFilter('category', value)}
            />
            <SelectField
              label="Cidade"
              value={filters.city}
              options={[OVERVIEW_OS_ALL.city, ...options.cities]}
              onChange={(value) => setFilter('city', value)}
            />
          </FilterGroup>
          <FilterGroup legend="Resultado" columnsClass="sm:grid-cols-1">
            <SelectField
              label="Status"
              value={filters.status}
              options={[OVERVIEW_OS_ALL.status, ...options.statuses]}
              onChange={(value) => setFilter('status', value)}
            />
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

function SelectField({
  children,
  describedBy,
  disabled = false,
  label,
  onChange,
  optionLabel,
  options,
  value,
}: FieldProps & {
  children?: React.ReactNode
  describedBy?: string
  disabled?: boolean
  options: string[]
  /**
   * Texto de cada opção, quando ele não é o próprio valor. É o caso do
   * Técnico: o filtro guarda o identificador que a OS carrega e a lista
   * mostra o nome vindo do catálogo do serviço.
   */
  optionLabel?: (option: string) => string
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
            {optionLabel === undefined ? option : optionLabel(option)}
          </option>
        ))}
      </select>
      {children}
    </label>
  )
}
