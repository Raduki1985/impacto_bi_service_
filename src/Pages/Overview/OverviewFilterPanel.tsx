import { useState } from 'react'

import { FilterGroup } from '../../components/filters/FilterGroup'
import { FilterPanel, type FilterPanelChip } from '../../components/filters/FilterPanel'
import {
  plainOptions,
  selectionChipValue,
  type FilterSelectOption,
} from '../../components/filters/filterSelectOptions'
import { MultiSelectField } from '../../components/filters/MultiSelectField'
import { PeriodPresets } from '../../components/filters/PeriodPresets'
import { DateField } from '../../components/ui/DateField'
import { useOverviewOs } from '../../contexts/useOverviewOs'
import { todayISO } from '../../data/defaultPeriod'
import {
  isOverviewOsSelectionField,
  listActiveOverviewOsFilters,
  OVERVIEW_OS_ALL,
} from '../../data/overviewOsFilters'
import {
  activePeriodPreset,
  periodPresetRange,
  periodRangeText,
  type PeriodPresetKey,
} from '../../data/periodPresets'

type OverviewFilterPanelProps = {
  /**
   * Estado visual inicial da área expandida. O painel abre recolhido; o valor
   * existe para os testes de renderização estática exercitarem o estado
   * expandido, já que a suíte não tem ambiente de DOM para acionar o controle.
   */
  defaultExpanded?: boolean
  /**
   * Data de hoje, para os atalhos de período. No portal vale o relógio; os
   * testes a fixam, senão "Ontem" mudaria de resposta a cada dia.
   */
  today?: string
}

/**
 * Faixa de filtros da Visão Geral de OS: os oito filtros dela sobre a faixa
 * de filtros do portal (`FilterPanel`). Os grupos seguem o significado de
 * negócio: Período (Início, Fim), Operação (Equipe, Técnico, Tipo de OS,
 * Categoria, Cidade) e Resultado (Status). Resolução saiu do painel; o
 * desfecho segue visível no ranking de resoluções.
 *
 * As opções de cada seletor vêm do provedor da Visão Geral, já dependentes do
 * contexto dos campos anteriores: valor sem dado não aparece, e uma opção
 * marcada que ficou incompatível sai sozinha da seleção.
 *
 * Desde 30/09/2026 os seis campos de escolha aceitam várias opções
 * (`MultiSelectField`, pedido do Mário). O chip de cada campo segue um só,
 * com as marcadas (`selectionChipValue`), e o "x" dele desmarca todas.
 *
 * O que é decisão desta página, e não da faixa: os atalhos de período ficam
 * na faixa sempre visível (decisão do Mário em 22/09/2026, o período é o
 * único filtro que a diretoria usa), e as datas só aparecem quando nenhum
 * atalho está aceso. Com atalho aceso elas eram repetição: o botão já nomeia
 * o período, a dica dele mostra as datas, e a etiqueta de "Resultado do
 * período" logo abaixo as escreve por extenso (apontado pelo Mário em
 * 23/09/2026). No personalizado elas ficam, porque a faixa é presa ao topo e,
 * com a página rolada até os gráficos de baixo, é o único lugar que ainda
 * diz o recorte.
 */
export function OverviewFilterPanel({
  defaultExpanded = false,
  today = todayISO(),
}: OverviewFilterPanelProps) {
  const { coverage, filters, options, resetFilters, setFilter, setPeriod, setSelection, technicians } =
    useOverviewOs()

  // Identificador para nome, usado no seletor e no chip do filtro ativo. Vazio
  // quando o serviço não manda o catálogo, e é esse vazio que desabilita o
  // seletor de técnico.
  const technicianNames = new Map(technicians.map((technician) => [technician.id, technician.name]))
  // A cobertura vai junto: o período padrão é o da fonte em uso, e sem ela a
  // página ligada ao serviço abriria com Início e Fim contados como alterados.
  const activeFilters = listActiveOverviewOsFilters(filters, coverage)

  // O período já aparece por extenso no resumo permanente, então Início e Fim
  // alterados mantêm o Limpar filtros disponível mas não viram chip repetido.
  // O chip do Técnico mostra o nome, e não o identificador que o filtro
  // guarda. Sem o catálogo o chip nem chega a existir, porque o seletor está
  // desabilitado. O "x" do chip devolve só aquele campo ao valor neutro.
  const chips: FilterPanelChip[] = activeFilters.flatMap((active) => {
    const field = active.field
    if (!isOverviewOsSelectionField(field)) return []
    const labels =
      field === 'technicianId'
        ? active.values.map((id) => technicianNames.get(id) ?? id)
        : active.values

    return [
      {
        key: field,
        label: active.label,
        value: selectionChipValue(labels),
        fullValue: labels.join(', '),
        onRemove: () => setSelection(field, []),
      },
    ]
  })

  // O atalho aceso é derivado das datas, com uma memória só: o último
  // clicado, para vencer quando dois atalhos dão o mesmo recorte (numa terça
  // "Esta semana" e "Ontem" são o mesmo dia). Recarregar ou mexer numa data
  // devolve a decisão às datas.
  const [chosenPreset, setChosenPreset] = useState<PeriodPresetKey | null>(null)
  const activePreset = activePeriodPreset(filters, today, chosenPreset)

  // Técnico. O filtro guarda o identificador que a OS carrega e a lista mostra
  // o nome do catálogo do serviço. Sem catálogo, que é o caso da base local
  // sanitizada, o seletor fica desabilitado e diz por quê: listar as chaves
  // anônimas dos técnicos não ajudaria ninguém a decidir nada.
  const technicianOptions: FilterSelectOption[] =
    technicianNames.size === 0
      ? []
      : byTechnicianName(options.technicians, technicianNames).map((id) => ({
          value: id,
          label: technicianNames.get(id) ?? id,
        }))

  return (
    <FilterPanel
      chips={chips}
      defaultExpanded={defaultExpanded}
      onClear={activeFilters.length > 0 ? resetFilters : undefined}
      period={activePreset === null ? periodRangeText(filters) : undefined}
      shortcuts={
        <PeriodPresets
          active={activePreset}
          coverage={coverage}
          onSelect={(key) => {
            setChosenPreset(key)
            setPeriod(periodPresetRange(key, today))
          }}
          today={today}
        />
      }
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
          <MultiSelectField
            label="Equipe"
            onChange={(values) => setSelection('team', values)}
            options={plainOptions(options.teams)}
            placeholder={OVERVIEW_OS_ALL.team}
            value={filters.team}
          />
          <MultiSelectField
            disabled={technicianNames.size === 0}
            hint={
              technicianNames.size === 0
                ? 'Disponível quando o serviço enviar a lista de técnicos.'
                : undefined
            }
            label="Técnico"
            onChange={(values) => setSelection('technicianId', values)}
            options={technicianOptions}
            placeholder={OVERVIEW_OS_ALL.technicianId}
            value={filters.technicianId}
          />
          <MultiSelectField
            label="Tipo de OS"
            onChange={(values) => setSelection('serviceType', values)}
            options={plainOptions(options.serviceTypes)}
            placeholder={OVERVIEW_OS_ALL.serviceType}
            value={filters.serviceType}
          />
          <MultiSelectField
            label="Categoria"
            onChange={(values) => setSelection('category', values)}
            options={plainOptions(options.categories)}
            placeholder={OVERVIEW_OS_ALL.category}
            value={filters.category}
          />
          <MultiSelectField
            label="Cidade"
            onChange={(values) => setSelection('city', values)}
            options={plainOptions(options.cities)}
            placeholder={OVERVIEW_OS_ALL.city}
            value={filters.city}
          />
        </FilterGroup>
        <FilterGroup legend="Resultado" columnsClass="sm:grid-cols-1">
          <MultiSelectField
            label="Status"
            onChange={(values) => setSelection('status', values)}
            options={plainOptions(options.statuses)}
            placeholder={OVERVIEW_OS_ALL.status}
            value={filters.status}
          />
        </FilterGroup>
      </div>
    </FilterPanel>
  )
}

/**
 * Técnicos do seletor em ordem alfabética pelo NOME, que é o que o gestor lê
 * (pedido do Mário em 23/09/2026). As opções chegam como identificadores, e
 * ordenar por eles embaralhava os nomes. Identificador sem nome no catálogo
 * vai para o fim, visível e sem competir com os nomes.
 */
function byTechnicianName(
  ids: readonly string[],
  names: ReadonlyMap<string, string>,
): string[] {
  return [...ids].sort((a, b) => {
    const nameA = names.get(a)
    const nameB = names.get(b)
    if (nameA === undefined || nameB === undefined) {
      return Number(nameA === undefined) - Number(nameB === undefined) || a.localeCompare(b, 'pt-BR')
    }

    return nameA.localeCompare(nameB, 'pt-BR') || a.localeCompare(b, 'pt-BR')
  })
}
