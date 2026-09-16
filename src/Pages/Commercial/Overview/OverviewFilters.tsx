import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Trash2, X } from 'lucide-react'

import { DateField } from '../../../components/ui/DateField'
import { SearchSelectField } from '../../../components/ui/SearchSelectField'
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
  initialCommercialOverviewFiltersFor,
  type CommercialOverviewFilters,
  type CommercialPersonTypeFilter,
  type CommercialPersonTypeOption,
  type CommercialSellerOption,
} from './overviewModel'

/**
 * Rótulo de cada time como ele aparece no seletor e no chip do resumo. O valor
 * neutro é o `Todos` curto da Visão Geral de OS: o nome do campo já está no
 * rótulo logo acima do seletor.
 */
const teamLabels: Record<SalesPeriodTeamFilter, string> = {
  todos: 'Todos',
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
 * Cidade, vendedor e tipo de cliente viajam por id, então o nome vem das listas
 * da página. Se um id não estiver mais na lista, o próprio id aparece: melhor
 * mostrar o recorte cru do que esconder que existe um filtro aplicado.
 *
 * O recorte de abertura chega pronto porque ele depende da cobertura da fonte:
 * comparar com o da base sintética faria a página ligada ao serviço abrir com
 * Início e Fim sempre "alterados", e o `Limpar filtros` nunca sairia da tela.
 */
function listActiveFilters(
  filters: CommercialOverviewFilters,
  cities: readonly CommercialCity[],
  sellers: readonly CommercialSellerOption[],
  personTypes: readonly CommercialPersonTypeOption[],
  initial: CommercialOverviewFilters,
): ActiveFilter[] {
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
  if (filters.personType !== 'todos') {
    const personType = personTypes.find((item) => item.id === filters.personType)
    active.push({
      field: 'personType',
      label: 'Tipo de cliente',
      value: personType?.name ?? filters.personType,
    })
  }

  return active
}

/**
 * Os filtros com um campo devolvido ao valor inicial, para o "x" do chip:
 * tira só aquele filtro, enquanto `Limpar filtros` tira todos. Início e Fim
 * não têm chip, então não passam por aqui.
 */
function withoutFilter(
  filters: CommercialOverviewFilters,
  field: keyof CommercialOverviewFilters,
): CommercialOverviewFilters {
  const initial = initialCommercialOverviewFilters()

  switch (field) {
    case 'cityId':
      return { ...filters, cityId: initial.cityId }
    case 'team':
      return { ...filters, team: initial.team }
    case 'sellerId':
      return { ...filters, sellerId: initial.sellerId }
    case 'personType':
      return { ...filters, personType: initial.personType }
    default:
      return filters
  }
}

type OverviewFiltersProps = {
  cities: readonly CommercialCity[]
  filters: CommercialOverviewFilters
  onChange: (filters: CommercialOverviewFilters) => void
  /**
   * Tipos de cliente aceitos, na ordem do serviço. Lista vazia desabilita o
   * seletor: a fonte em uso não separa pessoa física de jurídica.
   */
  personTypes: readonly CommercialPersonTypeOption[]
  sellers: readonly CommercialSellerOption[]
  /**
   * Aviso sob o seletor de vendedor quando ele está habilitado, para a página
   * dizer o que a lista cobre (ligada ao serviço, o SGI só registra o vendedor
   * a partir de junho de 2026). Sem lista, o aviso é o de seletor desabilitado.
   */
  sellersHint?: string
  /**
   * Cobertura da base que prende os calendários. O padrão é a cobertura da
   * base sintética; ligada ao serviço de BI, a página passa a cobertura real
   * do banco, senão agosto em diante ficaria inalcançável no seletor.
   */
  periodStart?: string
  periodEnd?: string
  /**
   * Estado visual inicial da área expandida. O painel abre recolhido; o valor
   * existe para os testes de renderização estática exercitarem o estado
   * expandido, já que a suíte não tem ambiente de DOM para acionar o controle.
   */
  defaultExpanded?: boolean
}

/**
 * Painel recolhível dos seis filtros da Visão Geral Comercial, no MESMO padrão
 * da Visão Geral de OS: resumo sempre visível com período e chips do que está
 * aplicado, e os controles em grupos de negócio na área expandida, Período
 * (Início, Fim) e Operação (Cidade, Time, Vendedor, Tipo de cliente).
 *
 * O mesmo padrão vale para o que se vê: os campos têm a largura dos campos da
 * faixa de OS (Período com 2 das 8 partes da linha e cada seletor com 1), os
 * valores neutros são o `Todas`/`Todos` curto de lá, e o seletor desabilitado
 * explica o motivo em texto logo abaixo, como o Técnico faz na OS. Com quatro
 * seletores em Operação, o restante da linha fica vazio de propósito, em vez
 * de esticar os campos. No tema escuro, chip, anel de foco e ações da faixa
 * ficam no Verde Detalhes, pela mesma declaração da faixa de OS em
 * `styles.css`.
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
  periodEnd = COMMERCIAL_PERIOD_END,
  periodStart = COMMERCIAL_PERIOD_START,
  personTypes,
  sellers,
  sellersHint,
}: OverviewFiltersProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const contentId = useId()

  // Recorte de abertura da cobertura em vigor: dia 1 do mês corrente até hoje,
  // ou até a última data com dado. É o que `Limpar filtros` devolve e o que
  // define se Início e Fim contam como alterados.
  const initial = initialCommercialOverviewFiltersFor({ start: periodStart, end: periodEnd })
  const activeFilters = listActiveFilters(filters, cities, sellers, personTypes, initial)
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
            extra quando o painel está recolhido. Cada chip tem o "x" que tira
            só ele; Limpar filtros continua tirando todos. */}
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip.field}
                className="commercial-filter-chip flex max-w-[260px] items-center gap-1 rounded-full border border-transparent bg-[var(--accent-weak)] py-0.5 pr-1 pl-2.5 text-[11.5px] font-medium text-[var(--accent)]"
                title={`${chip.label}: ${chip.value}`}
              >
                <span className="truncate">
                  {chip.label}: {chip.value}
                </span>
                <button
                  aria-label={`Remover filtro ${chip.label}: ${chip.value}`}
                  className="commercial-filter-chip-remove flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={() => onChange(withoutFilter(filters, chip.field))}
                  type="button"
                >
                  <X aria-hidden="true" size={11} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {/* Ações da faixa, agrupadas e estáveis à direita: limpar aparece
            diante de QUALQUER alteração (datas incluídas) e expandir/recolher
            está sempre presente, por último. */}
        <div className="ml-auto flex flex-none items-center gap-x-1">
          {activeFilters.length > 0 ? (
            <ClearFiltersButton onClick={() => onChange(initial)} />
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
          alturas comuns de desktop os seis controles ficam bem abaixo de 45vh
          e nenhuma barra aparece. Quando a rolagem existe, o resumo e o botão
          de recolher continuam fora dela, sempre acessíveis. */}
      <div
        hidden={!expanded}
        id={contentId}
        className="max-h-[45vh] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-[var(--border)] px-[26px] py-4"
      >
        {/* A régua é a da faixa de OS: 8 partes na linha, 2 para Período e 6
            para Operação, com cada campo ocupando 1. Assim os controles têm a
            mesma largura nas duas Visões Gerais. */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 xl:grid-cols-[minmax(272px,2fr)_6fr]">
          <FilterGroup legend="Período" columnsClass="sm:grid-cols-2">
            {/* Os calendários ficam presos à cobertura da base comercial e
                mantêm início e fim ordenados. A troca também reordena o par,
                para o caso de um valor digitado fora do seletor nativo. */}
            <DateField
              label="Início"
              max={filters.endDate}
              min={periodStart}
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
              max={periodEnd}
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
          <FilterGroup legend="Operação" columnsClass="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              <option value="todas">Todas</option>
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
            {/* Vendedor. A lista vem da base: ligada ao serviço, é quem criou
                contrato no SGI. Se um serviço anterior não mandar a lista, o
                campo fica desabilitado e diz por quê logo abaixo, como o
                Técnico na Visão Geral de OS, em vez de oferecer um filtro sem
                efeito nenhum sobre os números.

                É um campo de escolha com digitação, e não o seletor comum dos
                outros dois: são mais de vinte nomes compridos, e o Mário pediu
                em 14/09/2026 que desse para digitar o nome. O campo tem a
                mesma largura dos vizinhos, o padrão da faixa. */}
            <SearchSelectField
              disabled={sellers.length === 0}
              hint={
                sellers.length === 0
                  ? 'O serviço de BI ainda não filtra a Visão Geral por vendedor.'
                  : sellersHint
              }
              label="Vendedor"
              onChange={(sellerId) => onChange({ ...filters, sellerId })}
              options={sellers}
              placeholder="Todos"
              value={filters.sellerId}
            />
            {/* Tipo de cliente. Quem classifica é a fonte, pelo documento do
                cliente no SGI: cadastro com CPF é pessoa física, com CNPJ é
                jurídica. Sem lista, o campo segue a mesma regra do Vendedor e
                fica desabilitado com o motivo à vista, em vez de prometer um
                recorte que não acontece.

                O aviso fala da FONTE, e não do serviço: aqui a lista vazia
                acontece nos dois lados, com um serviço anterior ao filtro e
                também na base sintética, que não classifica o cliente. Culpar
                o serviço seria mentira em metade dos casos. */}
            <SelectField
              disabled={personTypes.length === 0}
              hint={
                personTypes.length === 0
                  ? 'Os dados em uso não separam pessoa física de jurídica.'
                  : undefined
              }
              label="Tipo de cliente"
              value={filters.personType}
              onChange={(value) =>
                onChange({ ...filters, personType: value as CommercialPersonTypeFilter })
              }
            >
              <option value="todos">Todos</option>
              {personTypes.map((personType) => (
                <option key={personType.id} value={personType.id}>
                  {personType.name}
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

function SelectField({
  children,
  disabled = false,
  hint,
  label,
  onChange,
  value,
}: FieldProps & {
  children: ReactNode
  disabled?: boolean
  /**
   * Motivo visível logo abaixo do seletor, no mesmo padrão do Técnico na
   * Visão Geral de OS. Usado quando o seletor está desabilitado: um título
   * que só aparece ao passar o mouse não explicava nada a quem olha a tela.
   */
  hint?: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        className={fieldControlClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
      {hint === undefined ? null : (
        <span className="text-[10.5px] leading-tight text-[var(--text-secondary)]">{hint}</span>
      )}
    </label>
  )
}
