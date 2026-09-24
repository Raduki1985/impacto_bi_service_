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
import { ArrowDown, ArrowUp, Filter, FilterX, type LucideIcon } from 'lucide-react'

import { formatNumber } from '../../lib/formatters'
import { matchesColumnOption, type ColumnFilterOption } from './columnFilterModel'
import { columnFilterActionClass, columnFilterClass } from './columnFilterStyles'

/**
 * Filtro e ordenação no cabeçalho de uma coluna de tabela.
 *
 * A experiência é a conhecida do Excel e da matriz do Power BI, adaptada aos
 * tokens do IMPACTO BI: um botão discreto depois do título abre um painel
 * compacto com a ordenação da coluna, o recorte adequado ao tipo do dado e as
 * ações Aplicar e Cancelar.
 *
 * Este arquivo guarda o que é IGUAL em qualquer tabela: a casca do cabeçalho
 * (abrir, posicionar, fechar, foco, Escape, clique fora), o bloco de
 * ordenação, o painel de lista com busca e a barra de ações. O painel de cada
 * TIPO de dado continua na página: data e faixa de valor só existem em Vendas
 * por Período, e criar opções para eles aqui seria inventar necessidade.
 *
 * Promovido a componente compartilhado em 22/09/2026, com aprovação do Mário,
 * quando a lista de OS da Visão Geral passou a precisar do mesmo
 * comportamento. Antes disso ele vivia só em Vendas por Período.
 *
 * O painel é publicado em portal com posição fixa. Sem isso, a rolagem
 * horizontal da tabela recortaria o painel, que é justamente o contêiner onde
 * ele precisa aparecer por inteiro.
 *
 * O portal vai para o fim da página, salvo quando a tabela mora numa janela
 * modal (a janela de OS da Visão Geral, 24/09/2026): ali o painel precisa
 * nascer DENTRO da janela, que prende o foco e trata como clique fora tudo
 * o que não é dela. Quem abre a janela entrega o contêiner em
 * `panelContainer`; as demais tabelas não passam nada e seguem iguais.
 */

const DEFAULT_PANEL_WIDTH = 268
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

/** Ordenação ativa na coluna, como o cabeçalho a anuncia. */
export type ColumnSortMark = {
  readonly direction: 'asc' | 'desc'
  /** Nome da ordenação para o leitor de tela, por exemplo `Mais recente`. */
  readonly label: string
}

/* -------------------------------------------------------------------------- */
/* Cabeçalho                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cabeçalho com botão de filtro.
 *
 * O título e o botão dividem a mesma linha com o título truncado: como as
 * tabelas usam larguras fixas, o botão nunca altera a largura da coluna.
 */
export function ColumnFilterHeader({
  align = 'left',
  children,
  filtered,
  label,
  panelContainer = null,
  panelWidth = DEFAULT_PANEL_WIDTH,
  sort = null,
}: {
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
  filtered: boolean
  label: string
  /** Onde o painel é publicado; nulo é o fim da página. */
  panelContainer?: HTMLElement | null
  panelWidth?: number
  sort?: ColumnSortMark | null
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
              className={columnFilterClass.panel}
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
            panelContainer ?? document.body,
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
  sort: ColumnSortMark | null,
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

/** Uma opção de ordenação no painel: o que ela faz e se está ligada. */
export type ColumnSortChoice = {
  readonly key: string
  readonly label: string
  readonly icon: LucideIcon
  readonly active: boolean
}

/**
 * Ordenação da coluna.
 *
 * Só uma ordenação existe na tabela inteira, então escolher aqui substitui a de
 * qualquer outra coluna. Clicar na opção já ativa a remove e devolve a ordem
 * padrão da página, e quem trata isso é a página, no `onSelect`.
 *
 * Os botões podem quebrar linha: em painel estreito eles empilham em vez de
 * vazar para fora da borda.
 */
export function ColumnSortSection({
  choices,
  onSelect,
}: {
  choices: readonly ColumnSortChoice[]
  onSelect: (key: string) => void
}) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className={columnFilterClass.legend}>Ordenar</legend>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {choices.map((choice) => (
          <SortButton
            active={choice.active}
            icon={choice.icon}
            key={choice.key}
            label={choice.label}
            onClick={() => onSelect(choice.key)}
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
/* Painel de lista, o recorte de coluna de texto                               */
/* -------------------------------------------------------------------------- */

/**
 * Painel de lista com busca e seleção múltipla.
 *
 * A seleção fica em rascunho até Aplicar: Cancelar devolve exatamente o estado
 * anterior, como no Excel. Lista vazia de seleção significa "sem filtro".
 */
export function ColumnListPanel({
  onApply,
  onCancel,
  options,
  searchLabel,
  searchable = true,
  selected,
  sortSection,
}: {
  onApply: (selected: readonly string[]) => void
  onCancel: () => void
  options: readonly ColumnFilterOption[]
  searchLabel: string
  searchable?: boolean
  selected: readonly string[]
  /** Bloco de ordenação já montado pela página, ou nada quando ela não ordena. */
  sortSection?: ReactNode
}) {
  const [draft, setDraft] = useState<readonly string[]>(selected)
  const [search, setSearch] = useState('')
  const visible = searchable
    ? options.filter((option) => matchesColumnOption(option, search))
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
      {sortSection}

      {searchable ? (
        <input
          aria-label={searchLabel}
          autoFocus
          className={columnFilterClass.input}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchLabel}
          type="search"
          value={search}
        />
      ) : null}

      <div className="flex items-center justify-between gap-1">
        <button
          className={columnFilterActionClass.link}
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
          className={columnFilterActionClass.link}
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
              {/* A contagem, quando a coluna a informa, é do recorte já
                  filtrado pelas outras colunas: ela diz quantas linhas
                  aparecem ao marcar o valor. Com separador de milhar desde
                  que a janela de OS do período passou a mostrar listas de
                  mais de mil linhas (24/09/2026). */}
              {option.count === undefined ? null : (
                <span className="flex-none font-mono text-[10px] text-[var(--text-secondary)]">
                  {formatNumber(option.count)}
                </span>
              )}
            </label>
          ))
        )}
      </div>

      <ColumnPanelActions
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

/* -------------------------------------------------------------------------- */
/* Ações do painel                                                              */
/* -------------------------------------------------------------------------- */

export function ColumnPanelActions({
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
          className={columnFilterActionClass.link}
          disabled={secondary.disabled}
          onClick={secondary.onClick}
          type="button"
        >
          {secondary.label}
        </button>
      ) : null}
      <span className="ml-auto flex gap-1.5">
        <button className={columnFilterActionClass.secondary} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button
          className={`${columnFilterActionClass.primary} disabled:cursor-default disabled:opacity-50`}
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
