import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react'

import {
  ColumnFilterHeader,
  ColumnListPanel,
  ColumnSortSection,
} from '../../components/dashboard/ColumnFilter'
import type { TodayOsSortDirection, TodayTableOption } from './todayOsTableModel'

/**
 * Cabeçalho das colunas da lista de OS de hoje.
 *
 * A casca, o bloco de ordenação e o painel de lista vêm do componente
 * compartilhado do portal (`components/dashboard/ColumnFilter`), o mesmo que a
 * tabela de Vendas por Período usa desde 22/09/2026. O que este arquivo faz é
 * traduzir o vocabulário desta lista para o dele: aqui toda coluna é texto,
 * então a ordenação tem só dois sentidos e não existe painel de data nem de
 * faixa de valor.
 *
 * Três formatos de coluna, decididos por `TODAY_COLUMNS`:
 *
 * 1. ordena e filtra, que é a maioria;
 * 2. só ordena, caso do código da OS: uma lista com 142 códigos não recorta
 *    nada, então o painel abre apenas com os dois sentidos;
 * 3. nem uma coisa nem outra, caso de `Detalhe`, que só mostra o título.
 */

/** Painel estreito: aqui ele carrega uma lista curta, não dois campos. */
const PANEL_WIDTH = 248

const SORT_LABEL: Readonly<Record<TodayOsSortDirection, string>> = {
  asc: 'Crescente',
  desc: 'Decrescente',
}

export function TodayColumnHeader({
  filtered,
  label,
  options,
  onApply,
  onSortChange,
  searchable,
  selected,
  sort,
  sortable,
}: {
  filtered: boolean
  label: string
  /** Null na coluna que só ordena, como o código da OS. */
  options: readonly TodayTableOption[] | null
  onApply: (selected: readonly string[]) => void
  /** Sentido escolhido, ou null para voltar à ordem padrão da lista. */
  onSortChange: (direction: TodayOsSortDirection | null) => void
  searchable: boolean
  selected: readonly string[]
  /** Ordenação ATIVA nesta coluna, ou null quando a ordem é a de outra. */
  sort: TodayOsSortDirection | null
  sortable: boolean
}) {
  if (!sortable && options === null) {
    return (
      <span className="block truncate" title={label}>
        {label}
      </span>
    )
  }

  return (
    <ColumnFilterHeader
      filtered={filtered}
      label={label}
      panelWidth={PANEL_WIDTH}
      sort={sort === null ? null : { direction: sort, label: SORT_LABEL[sort] }}
    >
      {(close) => {
        // Clicar no sentido já ativo desliga a ordenação e devolve a ordem
        // padrão da lista, turno, técnico e código. A escolha vale na hora e
        // fecha o painel: ordenação não tem o que confirmar.
        const sortSection = (
          <ColumnSortSection
            choices={[
              { key: 'asc', label: SORT_LABEL.asc, icon: ArrowUpAZ, active: sort === 'asc' },
              {
                key: 'desc',
                label: SORT_LABEL.desc,
                icon: ArrowDownAZ,
                active: sort === 'desc',
              },
            ]}
            onSelect={(key) => {
              const direction = key as TodayOsSortDirection
              onSortChange(sort === direction ? null : direction)
              close()
            }}
          />
        )

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
