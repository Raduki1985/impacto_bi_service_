import { useState } from 'react'
import {
  ArrowDown01,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUp01,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  CalendarArrowDown,
  CalendarArrowUp,
  type LucideIcon,
} from 'lucide-react'

import {
  ColumnListPanel,
  ColumnPanelActions,
  ColumnSortSection,
} from '../../../components/dashboard/ColumnFilter'
import { columnFilterClass } from '../../../components/dashboard/columnFilterStyles'
import { formatIsoAsBrDate } from '../../../data/commercialCalendar'
import {
  isDateRangeInvalid,
  parseCurrencyInput,
  parseDateInput,
  salesTableSortSpec,
  type SalesTableOption,
  type SalesTableSort,
  type SalesTableSortKey,
} from './salesPeriodTableModel'

/**
 * Painéis de filtro dos cabeçalhos da tabela de Vendas por Período.
 *
 * A casca do cabeçalho (abrir, posicionar, fechar), o bloco de ordenação, o
 * painel de lista e as ações vivem em `components/dashboard/ColumnFilter`
 * desde 22/09/2026, quando a lista de OS da Visão Geral passou a usar a mesma
 * experiência e o Mário aprovou promover o padrão a componente do portal.
 *
 * O que continua aqui é o que só existe NESTA tabela: o intervalo de datas da
 * Data de Início, a pesquisa direta do Contrato e a faixa do valor mensal. São
 * painéis de tipo de dado, com regra de negócio própria (faixa invertida
 * recusada, busca de contrato sem o `#`), e levá-los para o componente
 * compartilhado seria inventar necessidade que nenhuma outra tabela tem.
 */

/** O painel de valor carrega dois campos e dois botões largos de ordenação. */
export const VALUE_PANEL_WIDTH = 320

/* -------------------------------------------------------------------------- */
/* Catálogo de ordenações                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ícone de cada ordenação.
 *
 * Só o ícone vive aqui. Coluna, sentido e rótulo saem do modelo, para painel,
 * cabeçalho e resumo do bloco nunca divergirem sobre o mesmo estado.
 */
const SORT_ICONS: Record<SalesTableSortKey, LucideIcon> = {
  'data-desc': CalendarArrowDown,
  'data-asc': CalendarArrowUp,
  'contrato-asc': ArrowUp01,
  'contrato-desc': ArrowDown01,
  'cliente-asc': ArrowUpAZ,
  'cliente-desc': ArrowDownAZ,
  'vendedor-asc': ArrowUpAZ,
  'vendedor-desc': ArrowDownAZ,
  'cidade-asc': ArrowUpAZ,
  'cidade-desc': ArrowDownAZ,
  'plano-asc': ArrowUpAZ,
  'plano-desc': ArrowDownAZ,
  'valor-desc': ArrowDownWideNarrow,
  'valor-asc': ArrowUpNarrowWide,
  'origem-asc': ArrowUpAZ,
  'origem-desc': ArrowDownAZ,
}

/** As duas opções de uma coluna, na ordem em que aparecem no painel. */
type SortKeys = readonly [SalesTableSortKey, SalesTableSortKey]

/**
 * Bloco de ordenação desta tabela.
 *
 * Traduz as duas chaves da coluna para as opções que o componente
 * compartilhado desenha. Clicar na opção já ativa a remove e devolve a ordem
 * padrão da página, comportamento que a tabela tem desde que o painel nasceu.
 */
function SalesSortSection({
  onSortChange,
  sort,
  sortKeys,
}: {
  onSortChange: (sort: SalesTableSort) => void
  sort: SalesTableSort
  sortKeys: SortKeys
}) {
  return (
    <ColumnSortSection
      choices={sortKeys.map((key) => ({
        key,
        label: salesTableSortSpec(key)?.label ?? key,
        icon: SORT_ICONS[key],
        active: sort === key,
      }))}
      onSelect={(key) => onSortChange(sort === key ? null : (key as SalesTableSortKey))}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Painéis por tipo de dado                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Painel de lista com busca e seleção múltipla.
 *
 * É o painel compartilhado com o bloco de ordenação desta tabela montado por
 * cima: as colunas de cliente, vendedor, cidade, plano e origem não têm nada
 * de próprio além das duas chaves de ordenação.
 */
export function ListFilterPanel({
  onApply,
  onCancel,
  onSortChange,
  options,
  searchLabel,
  searchable = true,
  selected,
  sort,
  sortKeys,
}: {
  onApply: (selected: readonly string[]) => void
  onCancel: () => void
  onSortChange: (sort: SalesTableSort) => void
  options: readonly SalesTableOption[]
  searchLabel: string
  searchable?: boolean
  selected: readonly string[]
  sort: SalesTableSort
  sortKeys: SortKeys
}) {
  return (
    <ColumnListPanel
      onApply={onApply}
      onCancel={onCancel}
      options={options}
      searchable={searchable}
      searchLabel={searchLabel}
      selected={selected}
      sortSection={
        <SalesSortSection onSortChange={onSortChange} sort={sort} sortKeys={sortKeys} />
      }
    />
  )
}

/**
 * Painel da Data de Início: ordenação e intervalo.
 *
 * O intervalo é aberto dos dois lados: preencher só uma ponta recorta a partir
 * dela. Data inicial posterior à final é recusada com aviso, como na faixa de
 * valor, para a tabela nunca esvaziar em silêncio.
 *
 * Este recorte vale só para a tabela. O período da página continua sendo o dos
 * filtros superiores.
 */
export function DateFilterPanel({
  from,
  onApply,
  onCancel,
  onSortChange,
  sort,
  to,
}: {
  from: string | null
  onApply: (range: { from: string | null; to: string | null }) => void
  onCancel: () => void
  onSortChange: (sort: SalesTableSort) => void
  sort: SalesTableSort
  to: string | null
}) {
  const [fromText, setFromText] = useState(from ?? '')
  const [toText, setToText] = useState(to ?? '')

  const fromDate = parseDateInput(fromText)
  const toDate = parseDateInput(toText)
  // A faixa invertida é sinalizada durante a digitação e bloqueia o Aplicar, em
  // vez de esperar o clique para só então recusar.
  const invalid = isDateRangeInvalid(fromDate, toDate)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SalesSortSection
        onSortChange={onSortChange}
        sort={sort}
        sortKeys={['data-desc', 'data-asc']}
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={columnFilterClass.legend}>Intervalo de datas</legend>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            aria-label="Data inicial"
            className={columnFilterClass.input}
            onChange={(event) => setFromText(event.target.value)}
            type="date"
            value={fromText}
          />
          <span aria-hidden="true" className="text-[11px] text-[var(--text-secondary)]">
            a
          </span>
          <input
            aria-label="Data final"
            className={columnFilterClass.input}
            onChange={(event) => setToText(event.target.value)}
            type="date"
            value={toText}
          />
        </div>
      </fieldset>

      {invalid ? (
        <p className={columnFilterClass.error} role="alert">
          A data inicial não pode ser posterior à data final.
        </p>
      ) : (
        <p className="text-[10.5px] text-[var(--text-secondary)]">
          {describeDateRange(fromDate, toDate)}
        </p>
      )}

      <ColumnPanelActions
        applyDisabled={invalid}
        onApply={() => onApply({ from: fromDate, to: toDate })}
        onCancel={onCancel}
        secondary={{
          disabled: fromText === '' && toText === '',
          label: 'Limpar datas',
          onClick: () => {
            setFromText('')
            setToText('')
          },
        }}
      />
    </div>
  )
}

/** Resumo do intervalo em formato brasileiro, com as faixas abertas nomeadas. */
function describeDateRange(from: string | null, to: string | null): string {
  if (from === null && to === null) return 'Sem filtro de data'
  if (from !== null && to === null) return `A partir de ${formatIsoAsBrDate(from)}`
  if (from === null && to !== null) return `Até ${formatIsoAsBrDate(to)}`

  return `De ${formatIsoAsBrDate(from ?? '')} a ${formatIsoAsBrDate(to ?? '')}`
}

/**
 * Painel do Contrato: ordenação e pesquisa direta.
 *
 * Contrato é identificador, não valor financeiro nem categoria: uma lista com
 * centenas de códigos não ajudaria ninguém. A busca é parcial e vale com ou sem
 * o `#`, porque o `#` é decoração de exibição.
 */
export function ContractFilterPanel({
  onApply,
  onCancel,
  onSortChange,
  search,
  sort,
}: {
  onApply: (search: string) => void
  onCancel: () => void
  onSortChange: (sort: SalesTableSort) => void
  search: string
  sort: SalesTableSort
}) {
  const [draft, setDraft] = useState(search)

  return (
    // Um `form` aqui submeteria de verdade e recarregaria a página. O painel é
    // um diálogo, e não um envio: Enter aplica pelo próprio campo.
    <div className="flex min-w-0 flex-col gap-2">
      <SalesSortSection
        onSortChange={onSortChange}
        sort={sort}
        sortKeys={['contrato-asc', 'contrato-desc']}
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={columnFilterClass.legend}>Pesquisar contrato</legend>
        <input
          aria-label="Pesquisar contrato"
          autoFocus
          className={columnFilterClass.input}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onApply(draft.trim())
          }}
          placeholder="Ex.: 1300042"
          type="search"
          value={draft}
        />
      </fieldset>

      <p className="text-[10.5px] text-[var(--text-secondary)]">
        Busca parcial, com ou sem o caractere #.
      </p>

      <ColumnPanelActions
        onApply={() => onApply(draft.trim())}
        onCancel={onCancel}
        secondary={{
          disabled: draft === '',
          label: 'Limpar',
          onClick: () => setDraft(''),
        }}
      />
    </div>
  )
}

/**
 * Painel do valor mensal contratado: ordenação e faixa.
 *
 * Maior valor vem primeiro porque é a leitura gerencial mais comum da coluna.
 * Faixa inválida é recusada com aviso visível e não aplica nada, para a tabela
 * nunca esvaziar em silêncio por causa de um limite digitado ao contrário.
 */
export function ValueFilterPanel({
  maxValue,
  minValue,
  onApply,
  onCancel,
  onSortChange,
  sort,
}: {
  maxValue: number | null
  minValue: number | null
  onApply: (range: { min: number | null; max: number | null }) => void
  onCancel: () => void
  onSortChange: (sort: SalesTableSort) => void
  sort: SalesTableSort
}) {
  const [minText, setMinText] = useState(minValue === null ? '' : String(minValue))
  const [maxText, setMaxText] = useState(maxValue === null ? '' : String(maxValue))
  const [error, setError] = useState<string | null>(null)

  const apply = () => {
    const min = parseCurrencyInput(minText)
    const max = parseCurrencyInput(maxText)

    if (min.kind === 'invalid' || max.kind === 'invalid') {
      setError('Informe um valor numérico, como 129,90.')
      return
    }

    const minNumber = min.kind === 'value' ? min.value : null
    const maxNumber = max.kind === 'value' ? max.value : null

    if (minNumber !== null && maxNumber !== null && minNumber > maxNumber) {
      setError('O valor mínimo não pode ser maior que o máximo.')
      return
    }

    setError(null)
    onApply({ min: minNumber, max: maxNumber })
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SalesSortSection
        onSortChange={onSortChange}
        sort={sort}
        sortKeys={['valor-desc', 'valor-asc']}
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={columnFilterClass.legend}>Faixa de valor</legend>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            aria-label="Valor mínimo"
            className={columnFilterClass.input}
            inputMode="decimal"
            onChange={(event) => setMinText(event.target.value)}
            placeholder="Mínimo"
            type="text"
            value={minText}
          />
          <span aria-hidden="true" className="text-[11px] text-[var(--text-secondary)]">
            a
          </span>
          <input
            aria-label="Valor máximo"
            className={columnFilterClass.input}
            inputMode="decimal"
            onChange={(event) => setMaxText(event.target.value)}
            placeholder="Máximo"
            type="text"
            value={maxText}
          />
        </div>
      </fieldset>

      {error === null ? null : (
        <p className={columnFilterClass.error} role="alert">
          {error}
        </p>
      )}

      <ColumnPanelActions
        onApply={apply}
        onCancel={onCancel}
        secondary={{
          disabled: minText === '' && maxText === '',
          label: 'Limpar faixa',
          onClick: () => {
            setMinText('')
            setMaxText('')
            setError(null)
          },
        }}
      />
    </div>
  )
}
