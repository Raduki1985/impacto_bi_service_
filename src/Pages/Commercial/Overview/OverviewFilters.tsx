import { useState } from 'react'

import { FilterGroup } from '../../../components/filters/FilterGroup'
import { FilterPanel, type FilterPanelChip } from '../../../components/filters/FilterPanel'
import { FilterSelectField } from '../../../components/filters/FilterSelectField'
import { PeriodPresets } from '../../../components/filters/PeriodPresets'
import { DateField } from '../../../components/ui/DateField'
import { SearchSelectField } from '../../../components/ui/SearchSelectField'
import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  formatIsoAsBrDate,
} from '../../../data/commercialCalendar'
import type { CommercialCity, CommercialCityId } from '../../../data/commercialTypes'
import { todayISO } from '../../../data/defaultPeriod'
import {
  activePeriodPreset,
  periodPresetRange,
  type PeriodPresetKey,
} from '../../../data/periodPresets'
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
  /**
   * Data de hoje, para os atalhos de período e o recorte de abertura. No
   * portal vale o relógio; os testes a fixam, senão "Ontem" mudaria de
   * resposta a cada dia.
   */
  today?: string
}

/**
 * Faixa de filtros da Visão Geral Comercial: os seis filtros dela sobre a
 * faixa de filtros do portal (`FilterPanel`), a mesma da Visão Geral de OS.
 * Os controles ficam em grupos de negócio na área expandida, Período (Início,
 * Fim) e Operação (Cidade, Time, Vendedor, Tipo de cliente).
 *
 * A régua é a da faixa de OS: 8 partes na linha, 2 para Período e 6 para
 * Operação, com cada campo ocupando 1. Assim os controles têm a mesma largura
 * nas duas Visões Gerais; com quatro seletores em Operação, o restante da
 * linha fica vazio de propósito, em vez de esticar os campos. Os valores
 * neutros são o `Todas`/`Todos` curto de lá, e o seletor desabilitado explica
 * o motivo em texto logo abaixo, como o Técnico faz na OS.
 *
 * A quantidade de vendas do recorte não aparece aqui de propósito: ela repetia
 * o KPI `Vendas ativadas`, exibido logo abaixo.
 *
 * Os atalhos de período são os da Visão Geral de OS, em dias fechados, e
 * entraram em 25/09/2026, quando o Mário decidiu que o período padrão desta
 * página também para em ontem.
 *
 * O período por extenso não aparece no resumo, nem com o recorte
 * personalizado (pedido do Mário em 25/09/2026): a etiqueta de Resultado do
 * período, logo abaixo, já o escreve. Aqui a Visão Geral Comercial difere da
 * de OS, que ainda o mostra quando nenhum atalho está aceso.
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
  today = todayISO(),
}: OverviewFiltersProps) {
  // Recorte de abertura da cobertura em vigor: dia 1 do mês corrente até
  // ontem, ou até a última data com dado. É o que `Limpar filtros` devolve e o
  // que define se Início e Fim contam como alterados.
  const coverage = { min: periodStart, max: periodEnd }
  const initial = initialCommercialOverviewFiltersFor({ start: periodStart, end: periodEnd }, today)
  const activeFilters = listActiveFilters(filters, cities, sellers, personTypes, initial)
  const range = { dateFrom: filters.startDate, dateTo: filters.endDate }

  // O atalho aceso é derivado das datas, com uma memória só: o último
  // clicado, para vencer quando dois atalhos dão o mesmo recorte (numa terça
  // "Esta semana" e "Ontem" são o mesmo dia). Recarregar ou mexer numa data
  // devolve a decisão às datas.
  const [chosenPreset, setChosenPreset] = useState<PeriodPresetKey | null>(null)
  const activePreset = activePeriodPreset(range, today, chosenPreset)
  // O período já está à vista, no atalho aceso e na etiqueta de Resultado do
  // período, então Início e Fim alterados mantêm o Limpar filtros disponível
  // mas não viram chip repetido.
  const chips: FilterPanelChip[] = activeFilters
    .filter((active) => active.field !== 'startDate' && active.field !== 'endDate')
    .map((active) => ({
      key: active.field,
      label: active.label,
      value: active.value,
      onRemove: () => onChange(withoutFilter(filters, active.field)),
    }))

  return (
    <FilterPanel
      chips={chips}
      defaultExpanded={defaultExpanded}
      onClear={activeFilters.length > 0 ? () => onChange(initial) : undefined}
      shortcuts={
        <PeriodPresets
          active={activePreset}
          coverage={coverage}
          onSelect={(key) => {
            const preset = periodPresetRange(key, today)
            setChosenPreset(key)
            onChange({ ...filters, startDate: preset.dateFrom, endDate: preset.dateTo })
          }}
          today={today}
        />
      }
    >
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
          <FilterSelectField
            label="Cidade"
            onChange={(value) =>
              onChange({
                ...filters,
                cityId: value === 'todas' ? null : (value as CommercialCityId),
              })
            }
            options={[
              { value: 'todas', label: 'Todas' },
              ...cities.map((city) => ({ value: city.id, label: city.name })),
            ]}
            value={filters.cityId ?? 'todas'}
          />
          <FilterSelectField
            label="Time"
            onChange={(value) => onChange({ ...filters, team: value as SalesPeriodTeamFilter })}
            options={[
              { value: 'todos', label: teamLabels.todos },
              { value: 'comercial', label: teamLabels.comercial },
              { value: 'corporativo', label: teamLabels.corporativo },
            ]}
            value={filters.team}
          />
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
          <FilterSelectField
            disabled={personTypes.length === 0}
            hint={
              personTypes.length === 0
                ? 'Os dados em uso não separam pessoa física de jurídica.'
                : undefined
            }
            label="Tipo de cliente"
            onChange={(value) =>
              onChange({ ...filters, personType: value as CommercialPersonTypeFilter })
            }
            options={[
              { value: 'todos', label: 'Todos' },
              ...personTypes.map((personType) => ({ value: personType.id, label: personType.name })),
            ]}
            value={filters.personType}
          />
        </FilterGroup>
      </div>
    </FilterPanel>
  )
}
