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
import { ArrowDownAZ, ArrowUpAZ, Filter, FilterX } from 'lucide-react'

import {
  matchesOptionSearch,
  parseCurrencyInput,
  type SalesTableOption,
  type SalesTableSort,
} from './salesPeriodTableModel'

/**
 * Filtros locais nos cabeçalhos da tabela.
 *
 * A experiência é a conhecida do Excel e da matriz do Power BI, adaptada aos
 * tokens do IMPACTO BI: um botão discreto ao lado do título abre um painel
 * compacto com busca, seleção múltipla e as ações Aplicar e Cancelar.
 *
 * O painel é publicado em portal com posição fixa. Sem isso, a rolagem
 * horizontal da tabela recortaria o painel, que é justamente o contêiner onde
 * ele precisa aparecer por inteiro.
 */

const PANEL_WIDTH = 268
const VIEWPORT_MARGIN = 8

type PanelPosition = { readonly top: number; readonly left: number }

const panelClass =
  'fixed z-50 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 shadow-[0_14px_34px_-16px_rgba(13,27,49,.5)]'
const actionClass =
  'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
const primaryActionClass = `${actionClass} bg-[var(--accent)] text-white hover:opacity-90`
const secondaryActionClass = `${actionClass} border border-[var(--border)] text-[var(--text-item)] hover:bg-[var(--hover-bg)]`
const linkActionClass = `${actionClass} text-[var(--accent)] hover:bg-[var(--hover-bg)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent`
const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

/**
 * Cabeçalho com botão de filtro.
 *
 * O título e o botão dividem a mesma linha com o título truncado: como a tabela
 * usa larguras fixas, o botão nunca altera a largura da coluna.
 */
export function ColumnFilterHeader({
  active,
  align = 'left',
  children,
  label,
}: {
  active: boolean
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
  label: string
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
    const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN
    // Alinha pela borda do botão e recolhe para dentro da viewport, para o
    // painel nunca nascer cortado nas colunas da direita ou em tela estreita.
    const preferredLeft = align === 'right' ? rect.right - PANEL_WIDTH : rect.left
    setPosition({
      top: Math.min(rect.bottom + 6, window.innerHeight - VIEWPORT_MARGIN),
      left: Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft)),
    })
  }, [align])

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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  }

  return (
    <div className={`flex min-w-0 items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      {/* O ícone fica sempre do lado interno da coluna: depois do título nas
          colunas à esquerda e antes dele na coluna numérica, alinhada à
          direita. Com larguras fixas, ele nunca altera a largura da coluna. */}
      {align === 'right' ? null : <ColumnLabel active={active} label={label} />}
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-label={
          active ? `Filtrar ${label}. Filtro ativo nesta coluna.` : `Filtrar ${label}`
        }
        className={`flex-none rounded p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          active
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
        {active ? (
          <FilterX aria-hidden="true" size={12} />
        ) : (
          <Filter aria-hidden="true" size={12} />
        )}
      </button>
      {align === 'right' ? <ColumnLabel active={active} label={label} /> : null}

      {open && position !== null && typeof document !== 'undefined'
        ? createPortal(
            <div
              aria-label={`Filtro da coluna ${label}`}
              className={panelClass}
              id={panelId}
              onKeyDown={handleKeyDown}
              ref={panelRef}
              role="dialog"
              style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
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
 * Nome da coluna.
 *
 * O asterisco acompanha o ícone colorido para que a marcação de filtro ativo
 * não dependa somente da cor.
 */
function ColumnLabel({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="min-w-0 truncate" title={label}>
      {label}
      {active ? (
        <>
          <span aria-hidden="true"> *</span>
          <span className="sr-only"> (com filtro ativo)</span>
        </>
      ) : null}
    </span>
  )
}

/**
 * Painel de lista com busca e seleção múltipla.
 *
 * A seleção fica em rascunho até Aplicar: Cancelar devolve exatamente o estado
 * anterior, como no Excel. Lista vazia de seleção significa "sem filtro".
 */
export function ListFilterPanel({
  onApply,
  onCancel,
  options,
  searchLabel,
  searchable = true,
  selected,
}: {
  onApply: (selected: readonly string[]) => void
  onCancel: () => void
  options: readonly SalesTableOption[]
  searchLabel: string
  searchable?: boolean
  selected: readonly string[]
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
    <div className="flex flex-col gap-2">
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
 * Painel do valor mensal contratado: ordenação e faixa.
 *
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
    <div className="flex flex-col gap-2">
      <fieldset className="border-0 p-0">
        <legend className="mb-1 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
          Ordenar
        </legend>
        <div className="flex gap-1.5">
          <SortButton
            active={sort === 'valor-asc'}
            icon={ArrowUpAZ}
            label="Do menor para o maior"
            onClick={() => onSortChange(sort === 'valor-asc' ? null : 'valor-asc')}
          />
          <SortButton
            active={sort === 'valor-desc'}
            icon={ArrowDownAZ}
            label="Do maior para o menor"
            onClick={() => onSortChange(sort === 'valor-desc' ? null : 'valor-desc')}
          />
        </div>
      </fieldset>

      <fieldset className="border-0 p-0">
        <legend className="mb-1 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
          Faixa de valor
        </legend>
        <div className="flex items-center gap-1.5">
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
        <p className="text-[10.5px] font-semibold text-[#b51d38]" role="alert">
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

function SortButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof ArrowUpAZ
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={`flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-weak)] text-[var(--accent)]'
          : 'border-[var(--border)] text-[var(--text-item)] hover:bg-[var(--hover-bg)]'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="flex-none" size={13} />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}

function PanelActions({
  onApply,
  onCancel,
  secondary,
  summary,
}: {
  onApply: () => void
  onCancel: () => void
  secondary?: { disabled: boolean; label: string; onClick: () => void }
  summary?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[var(--divider)] pt-2">
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
        <button className={primaryActionClass} onClick={onApply} type="button">
          Aplicar
        </button>
      </span>
    </div>
  )
}
