import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  type LucideIcon,
} from 'lucide-react'

import { ColumnFilterHeader, ColumnListPanel, ColumnSortSection } from './ColumnFilter'
import type { ListSortDirection, ListTableOption } from './listTableModel'

/**
 * Cabeçalho de coluna da lista do portal (`ListTable`).
 *
 * A casca, o bloco de ordenação e o painel de lista vêm de `ColumnFilter`, o
 * mesmo que a tabela de Vendas por Período usa desde 22/09/2026. O que este
 * arquivo faz é traduzir o vocabulário da lista para o dele: toda coluna
 * filtra por lista de valores, então não existe painel de faixa de data nem
 * de valor. A coluna de data ordena com os nomes e os ícones de calendário
 * de Vendas por Período ("Mais recente primeiro"), e não com os de texto.
 *
 * Nasceu como `TodayOsColumnFilter` na Visão Geral de OS e virou o cabeçalho
 * de qualquer lista em 24/09/2026. Três formatos de coluna, decididos pela
 * lista de colunas da tabela:
 *
 * 1. ordena e filtra, que é a maioria;
 * 2. só ordena, caso do código da OS: uma lista com 142 códigos não recorta
 *    nada, então o painel abre apenas com os dois sentidos;
 * 3. nem uma coisa nem outra, caso de `Detalhe`, que só mostra o título.
 */

/** Painel estreito: aqui ele carrega uma lista curta, não dois campos. */
const PANEL_WIDTH = 248

type SortChoice = {
  readonly direction: ListSortDirection
  readonly label: string
  readonly icon: LucideIcon
}

/** Sentidos de uma coluna de texto, na ordem do painel. */
const TEXT_SORT: readonly SortChoice[] = [
  { direction: 'asc', label: 'Crescente', icon: ArrowUpAZ },
  { direction: 'desc', label: 'Decrescente', icon: ArrowDownAZ },
]

/** Sentidos da data, com a mais recente primeiro, como em Vendas por Período. */
const DATE_SORT: readonly SortChoice[] = [
  { direction: 'desc', label: 'Mais recente primeiro', icon: CalendarArrowDown },
  { direction: 'asc', label: 'Mais antiga primeiro', icon: CalendarArrowUp },
]

export function ListColumnHeader({
  filtered,
  label,
  onApply,
  onSortChange,
  options,
  panelContainer,
  searchable = false,
  selected,
  sort,
  sortKind = 'text',
  sortable,
}: {
  filtered: boolean
  label: string
  onApply: (selected: readonly string[]) => void
  /** Sentido escolhido, ou null para voltar à ordem padrão da lista. */
  onSortChange: (direction: ListSortDirection | null) => void
  /** Null na coluna que só ordena, como o código da OS. */
  options: readonly ListTableOption[] | null
  /** Onde o painel nasce; ausente, no fim da página, como sempre. */
  panelContainer?: HTMLElement | null
  searchable?: boolean
  selected: readonly string[]
  /** Ordenação ATIVA nesta coluna, ou null quando a ordem é a de outra. */
  sort: ListSortDirection | null
  /** A coluna é de data: ordena com os nomes de calendário. */
  sortKind?: 'text' | 'date'
  sortable: boolean
}) {
  if (!sortable && options === null) {
    return (
      <span className="block truncate" title={label}>
        {label}
      </span>
    )
  }

  const choices = sortKind === 'date' ? DATE_SORT : TEXT_SORT
  const activeChoice = choices.find((choice) => choice.direction === sort)

  return (
    <ColumnFilterHeader
      filtered={filtered}
      label={label}
      panelContainer={panelContainer}
      panelWidth={PANEL_WIDTH}
      sort={
        activeChoice === undefined
          ? null
          : { direction: activeChoice.direction, label: activeChoice.label }
      }
    >
      {(close) => {
        // Clicar no sentido já ativo desliga a ordenação e devolve a ordem
        // padrão da lista. A escolha vale na hora e fecha o painel: ordenação
        // não tem o que confirmar.
        const sortSection = sortable ? (
          <ColumnSortSection
            choices={choices.map((choice) => ({
              key: choice.direction,
              label: choice.label,
              icon: choice.icon,
              active: sort === choice.direction,
            }))}
            onSelect={(key) => {
              const direction = key as ListSortDirection
              onSortChange(sort === direction ? null : direction)
              close()
            }}
          />
        ) : undefined

        if (options === null) return sortSection

        return (
          <ColumnListPanel
            onApply={(values) => {
              onApply(values)
              close()
            }}
            onCancel={close}
            // A contagem ao lado do valor é do recorte já filtrado pelas
            // outras colunas: ela diz quantas linhas aparecem ao marcá-lo.
            options={options.map((option) => ({
              value: option.value,
              label: option.value,
              count: option.count,
            }))}
            searchable={searchable}
            searchLabel={`Buscar em ${label}`}
            selected={selected}
            sortSection={sortSection}
          />
        )
      }}
    </ColumnFilterHeader>
  )
}
