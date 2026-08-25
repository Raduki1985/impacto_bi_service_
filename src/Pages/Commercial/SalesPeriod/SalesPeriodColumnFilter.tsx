import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDown,
  ArrowDown01,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUp01,
  ArrowUpAZ,
  ArrowUpNarrowWide,
  CalendarArrowDown,
  CalendarArrowUp,
  Filter,
  FilterX,
  type LucideIcon,
} from 'lucide-react'

import { formatIsoAsBrDate } from '../../../data/commercialCalendar'
import {
  isDateRangeInvalid,
  matchesOptionSearch,
  parseCurrencyInput,
  parseDateInput,
  salesTableSortSpec,
  type SalesTableOption,
  type SalesTableSort,
  type SalesTableSortKey,
  type SalesTableSortSpec,
} from './salesPeriodTableModel'

/**
 * Filtros e ordenação locais nos cabeçalhos da tabela.
 *
 * A experiência é a conhecida do Excel e da matriz do Power BI, adaptada aos
 * tokens do IMPACTO BI: um botão discreto depois do título abre um painel
 * compacto com a ordenação da coluna, o recorte adequado ao tipo do dado e as
 * ações Aplicar e Cancelar.
 *
 * O painel é publicado em portal com posição fixa. Sem isso, a rolagem
 * horizontal da tabela recortaria o painel, que é justamente o contêiner onde
 * ele precisa aparecer por inteiro.
 */

const DEFAULT_PANEL_WIDTH = 268
/** O painel de valor carrega dois campos e dois botões largos de ordenação. */
export const VALUE_PANEL_WIDTH = 320
const VIEWPORT_MARGIN = 8

/** Distância entre o gatilho e a borda do painel. */
const TRIGGER_GAP = 6
/** Abaixo disso o painel prefere abrir para cima, em vez de espremer. */
const MIN_SPACE_BELOW = 260

type PanelPosition = {
  /** Só uma das âncoras verticais é usada: `top` abre para baixo, `bottom` para cima. */
  readonly top?: number
  readonly bottom?: number
  readonly left: number
  readonly width: number
  readonly maxHeight: number
}

const panelClass =
  'fixed z-50 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 shadow-[0_14px_34px_-16px_rgba(13,27,49,.5)]'
const actionClass =
  'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
const primaryActionClass = `${actionClass} bg-[var(--accent)] text-white hover:opacity-90`
const secondaryActionClass = `${actionClass} border border-[var(--border)] text-[var(--text-item)] hover:bg-[var(--hover-bg)]`
const linkActionClass = `${actionClass} text-[var(--accent)] hover:bg-[var(--hover-bg)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent`
const inputClass =
  'w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
const legendClass =
  'mb-1 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]'
const errorClass = 'text-[10.5px] font-semibold text-[#b51d38]'

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

/* -------------------------------------------------------------------------- */
/* Cabeçalho                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cabeçalho com botão de filtro.
 *
 * O título e o botão dividem a mesma linha com o título truncado: como a tabela
 * usa larguras fixas, o botão nunca altera a largura da coluna.
 */
export function ColumnFilterHeader({
  align = 'left',
  children,
  filtered,
  label,
  panelWidth = DEFAULT_PANEL_WIDTH,
  sort = null,
}: {
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
  filtered: boolean
  label: string
  panelWidth?: number
  sort?: SalesTableSortSpec | null
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<PanelPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /** Marca que o painel chegou a abrir, para só então devolver o foco. */
  const wasOpenRef = useRef(false)
  const panelId = useId()

  const place = useCallback(() => {
    const trigger = triggerRef.current
    if (trigger === null) return

    const rect = trigger.getBoundingClientRect()
    // A largura pedida é um teto: em tela estreita o painel encolhe até caber
    // entre as margens, em vez de vazar para fora da viewport.
    const width = Math.min(panelWidth, window.innerWidth - VIEWPORT_MARGIN * 2)
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN
    // Alinha pela borda do botão e recolhe para dentro da viewport, para o
    // painel nunca nascer cortado nas colunas da direita ou em tela estreita.
    const preferredLeft = align === 'right' ? rect.right - width : rect.left
    const left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft))

    // Com pouco espaço abaixo, o painel abre para cima. A âncora vertical muda
    // de `top` para `bottom` para não depender de medir a altura do conteúdo, e
    // o teto de altura fecha o caso em que nenhum dos lados comporta o painel
    // inteiro: aí ele rola por dentro, sem nunca ultrapassar a viewport.
    const spaceBelow = window.innerHeight - rect.bottom - TRIGGER_GAP - VIEWPORT_MARGIN
    const spaceAbove = rect.top - TRIGGER_GAP - VIEWPORT_MARGIN
    const openUp = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow

    setPosition(
      openUp
        ? {
            bottom: window.innerHeight - rect.top + TRIGGER_GAP,
            left,
            width,
            maxHeight: Math.max(spaceAbove, MIN_SPACE_BELOW / 2),
          }
        : {
            top: rect.bottom + TRIGGER_GAP,
            left,
            width,
            maxHeight: Math.max(spaceBelow, MIN_SPACE_BELOW / 2),
          },
    )
  }, [align, panelWidth])

  /**
   * Fecha sem tocar em ref: `close` é entregue ao conteúdo do painel durante o
   * render, e ler ref nesse ponto é proibido. A devolução do foco fica no
   * efeito abaixo, que roda depois do fechamento.
   */
  const close = useCallback(() => {
    setOpen(false)
    setPosition(null)
  }, [])

  // Devolve o foco ao gatilho quando o painel fecha, seja por Escape, por
  // Aplicar, por Cancelar ou por clique fora.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    triggerRef.current?.focus()
  }, [open])

  // Reposiciona junto da rolagem da tabela e da janela. A captura é necessária
  // porque o scroller da tabela não borbulha o evento até o documento.
  useEffect(() => {
    if (!open) return

    const handleReposition = () => place()
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) === true) return
      if (triggerRef.current?.contains(target) === true) return
      // Clique fora não rouba o foco de volta: quem clicou já escolheu para
      // onde ir. A devolução do foco vale para Escape, Aplicar e Cancelar.
      // Como o pointerdown chega antes do clique, abrir outra coluna fecha
      // esta antes de a próxima nascer: nunca há dois painéis visíveis.
      wasOpenRef.current = false
      setOpen(false)
      setPosition(null)
    }

    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open, place])

  /**
   * Escape fecha o painel.
   *
   * O handler fica no contêiner do cabeçalho, e não no painel: pelo portal, os
   * eventos do painel sobem por aqui do mesmo jeito, e assim Escape também
   * funciona com o foco ainda no gatilho, que é onde ele fica nos painéis sem
   * campo de autofoco.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open || event.key !== 'Escape') return

    event.stopPropagation()
    close()
  }

  const SortIcon = sort === null ? null : sort.direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <div
      className={`flex min-w-0 items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Título primeiro e ícone depois em todas as colunas, inclusive na
          numérica alinhada à direita. Com larguras fixas e título truncado, o
          ícone nunca altera a largura da coluna. */}
      <ColumnLabel filtered={filtered} label={label} />
      {SortIcon === null || sort === null ? null : (
        <span className="flex-none text-[var(--accent)]" title={`Ordenado: ${sort.label}`}>
          <SortIcon aria-hidden="true" size={11} />
          <span className="sr-only">Ordenação ativa: {sort.label}.</span>
        </span>
      )}
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={describeColumnState(label, filtered, sort)}
        className={`flex-none rounded p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          filtered
            ? 'text-[var(--accent)]'
            : 'text-[var(--text-secondary)] opacity-60 hover:opacity-100'
        }`}
        onClick={() => {
          if (open) {
            setOpen(false)
            setPosition(null)
            return
          }
          place()
          setOpen(true)
        }}
        ref={triggerRef}
        type="button"
      >
        {filtered ? (
          <FilterX aria-hidden="true" size={12} />
        ) : (
          <Filter aria-hidden="true" size={12} />
        )}
      </button>

      {open && position !== null && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-label={`Filtrar e ordenar a coluna ${label}`}
              className={panelClass}
              id={panelId}
              ref={panelRef}
              role="dialog"
              style={{
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width: position.width,
                maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
                maxHeight: position.maxHeight,
              }}
            >
              {children(close)}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/**
 * Estado real da coluna para leitores de tela.
 *
 * Filtro e ordenação são anunciados separadamente: uma coluna só ordenada nunca
 * é chamada de coluna com filtro ativo.
 */
function describeColumnState(
  label: string,
  filtered: boolean,
  sort: SalesTableSortSpec | null,
): string {
  const parts = [`Filtrar e ordenar ${label}`]
  if (filtered) parts.push('Filtro ativo nesta coluna')
  if (sort !== null) parts.push(`Ordenação ativa nesta coluna: ${sort.label}`)

  return `${parts.join('. ')}.`
}

/**
 * Nome da coluna.
 *
 * O asterisco acompanha o ícone colorido para que a marcação de filtro ativo
 * não dependa somente da cor. A seta de ordenação, ao lado, cumpre o mesmo
 * papel para a ordenação.
 */
function ColumnLabel({ filtered, label }: { filtered: boolean; label: string }) {
  return (
    <span className="min-w-0 truncate" title={label}>
      {label}
      {filtered ? (
        <>
          <span aria-hidden="true"> *</span>
          <span className="sr-only"> (com filtro ativo)</span>
        </>
      ) : null}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Bloco de ordenação, comum a todos os painéis                                */
/* -------------------------------------------------------------------------- */

/**
 * Ordenação da coluna.
 *
 * Só uma ordenação existe na tabela inteira, então escolher aqui substitui a de
 * qualquer outra coluna. Clicar na opção já ativa a remove e devolve a ordem
 * padrão da página.
 *
 * Os botões podem quebrar linha: em painel estreito eles empilham em vez de
 * vazar para fora da borda.
 */
function SortSection({
  onSortChange,
  sort,
  sortKeys,
}: {
  onSortChange: (sort: SalesTableSort) => void
  sort: SalesTableSort
  sortKeys: SortKeys
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={legendClass}>Ordenar</legend>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {sortKeys.map((key) => (
          <SortButton
            active={sort === key}
            icon={SORT_ICONS[key]}
            key={key}
            label={salesTableSortSpec(key)?.label ?? key}
            onClick={() => onSortChange(sort === key ? null : key)}
          />
        ))}
      </div>
    </fieldset>
  )
}

function SortButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      // `min-w-0` com `basis` pequena é o que permite o botão encolher dentro
      // do painel: sem isso o conteúdo mínimo empurra a linha para fora da
      // borda, que era o estouro do painel de valor.
      className={`flex min-w-0 flex-1 basis-[120px] items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10.5px] font-semibold leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-weak)] text-[var(--accent)]'
          : 'border-[var(--border)] text-[var(--text-item)] hover:bg-[var(--hover-bg)]'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="flex-none" size={13} />
      <span className="min-w-0 flex-1 break-words">{label}</span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Painéis por tipo de dado                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Painel de lista com busca e seleção múltipla.
 *
 * A seleção fica em rascunho até Aplicar: Cancelar devolve exatamente o estado
 * anterior, como no Excel. Lista vazia de seleção significa "sem filtro".
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
  const [draft, setDraft] = useState<readonly string[]>(selected)
  const [search, setSearch] = useState('')
  const visible = searchable
    ? options.filter((option) => matchesOptionSearch(option, search))
    : options
  const allVisibleSelected =
    visible.length > 0 && visible.every((option) => draft.includes(option.value))

  const toggle = (value: string) => {
    setDraft((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SortSection onSortChange={onSortChange} sort={sort} sortKeys={sortKeys} />

      {searchable ? (
        <input
          aria-label={searchLabel}
          autoFocus
          className={inputClass}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchLabel}
          type="search"
          value={search}
        />
      ) : null}

      <div className="flex items-center justify-between gap-1">
        <button
          className={linkActionClass}
          disabled={visible.length === 0}
          onClick={() => {
            const values = visible.map((option) => option.value)
            setDraft((current) =>
              allVisibleSelected
                ? current.filter((item) => !values.includes(item))
                : [...new Set([...current, ...values])],
            )
          }}
          type="button"
        >
          {allVisibleSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
        </button>
        <button
          className={linkActionClass}
          disabled={draft.length === 0}
          onClick={() => setDraft([])}
          type="button"
        >
          Limpar
        </button>
      </div>

      <div className="max-h-[210px] overflow-y-auto rounded-lg border border-[var(--divider)] p-1">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-[11px] text-[var(--text-secondary)]">
            Nenhum valor corresponde à busca.
          </p>
        ) : (
          visible.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-[var(--text-item)] hover:bg-[var(--hover-bg)] focus-within:ring-2 focus-within:ring-[var(--accent)]"
              key={option.value}
            >
              <input
                checked={draft.includes(option.value)}
                className="h-3.5 w-3.5 flex-none accent-[var(--accent)]"
                onChange={() => toggle(option.value)}
                type="checkbox"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate" title={option.label}>
                  {option.label}
                </span>
                {option.hint ? (
                  <span className="block truncate font-mono text-[10px] text-[var(--text-secondary)]">
                    {option.hint}
                  </span>
                ) : null}
              </span>
            </label>
          ))
        )}
      </div>

      <PanelActions
        onApply={() => onApply(draft)}
        onCancel={onCancel}
        summary={
          draft.length === 0
            ? 'Sem filtro'
            : `${draft.length} ${draft.length === 1 ? 'selecionado' : 'selecionados'}`
        }
      />
    </div>
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
      <SortSection
        onSortChange={onSortChange}
        sort={sort}
        sortKeys={['data-desc', 'data-asc']}
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={legendClass}>Intervalo de datas</legend>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            aria-label="Data inicial"
            className={inputClass}
            onChange={(event) => setFromText(event.target.value)}
            type="date"
            value={fromText}
          />
          <span aria-hidden="true" className="text-[11px] text-[var(--text-secondary)]">
            a
          </span>
          <input
            aria-label="Data final"
            className={inputClass}
            onChange={(event) => setToText(event.target.value)}
            type="date"
            value={toText}
          />
        </div>
      </fieldset>

      {invalid ? (
        <p className={errorClass} role="alert">
          A data inicial não pode ser posterior à data final.
        </p>
      ) : (
        <p className="text-[10.5px] text-[var(--text-secondary)]">
          {describeDateRange(fromDate, toDate)}
        </p>
      )}

      <PanelActions
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
      <SortSection
        onSortChange={onSortChange}
        sort={sort}
        sortKeys={['contrato-asc', 'contrato-desc']}
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={legendClass}>Pesquisar contrato</legend>
        <input
          aria-label="Pesquisar contrato"
          autoFocus
          className={inputClass}
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

      <PanelActions
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
      <SortSection
        onSortChange={onSortChange}
        sort={sort}
        sortKeys={['valor-desc', 'valor-asc']}
      />

      <fieldset className="min-w-0 border-0 p-0">
        <legend className={legendClass}>Faixa de valor</legend>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            aria-label="Valor mínimo"
            className={inputClass}
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
            className={inputClass}
            inputMode="decimal"
            onChange={(event) => setMaxText(event.target.value)}
            placeholder="Máximo"
            type="text"
            value={maxText}
          />
        </div>
      </fieldset>

      {error === null ? null : (
        <p className={errorClass} role="alert">
          {error}
        </p>
      )}

      <PanelActions
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

function PanelActions({
  applyDisabled = false,
  onApply,
  onCancel,
  secondary,
  summary,
}: {
  applyDisabled?: boolean
  onApply: () => void
  onCancel: () => void
  secondary?: { disabled: boolean; label: string; onClick: () => void }
  summary?: string
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-[var(--divider)] pt-2">
      {summary ? (
        <span className="text-[10.5px] text-[var(--text-secondary)]">{summary}</span>
      ) : null}
      {secondary ? (
        <button
          className={linkActionClass}
          disabled={secondary.disabled}
          onClick={secondary.onClick}
          type="button"
        >
          {secondary.label}
        </button>
      ) : null}
      <span className="ml-auto flex gap-1.5">
        <button className={secondaryActionClass} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button
          className={`${primaryActionClass} disabled:cursor-default disabled:opacity-50`}
          disabled={applyDisabled}
          onClick={onApply}
          type="button"
        >
          Aplicar
        </button>
      </span>
    </div>
  )
}
