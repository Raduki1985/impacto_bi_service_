import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

import { cn } from '../../lib/utils'
import { filterControlClass } from './filterFieldStyles'
import {
  multiSelectRows,
  toggleMultiSelectValue,
  type FilterSelectOption,
} from './filterSelectOptions'

type MultiSelectFieldProps = {
  label: string
  options: readonly FilterSelectOption[]
  /** Valores marcados. Lista vazia é o valor neutro, escrito pelo `placeholder`. */
  value: readonly string[]
  onChange: (values: string[]) => void
  /** Texto do campo sem nada marcado, o valor neutro do filtro: `Todos`, `Todas`. */
  placeholder: string
  disabled?: boolean
  /** Motivo ou observação em texto logo abaixo do campo, como nos seletores da faixa. */
  hint?: string
  /**
   * Digitação no próprio campo, e não numa busca no topo da lista. Clicar no
   * campo abre a lista e o cursor fica onde estava o `Todos`, pronto para
   * filtrar pelo nome. É o caso do Vendedor da Visão Geral Comercial, mais de
   * vinte nomes compridos (pedido do Mário em 02/10/2026, retomando o campo
   * com digitação de 14/09/2026).
   */
  searchInField?: boolean
}

/** Etiqueta de uma opção marcada, dentro do campo. */
const tagClass =
  'min-w-0 truncate rounded-md border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--text-secondary)_10%,transparent)] px-1.5 py-px text-[11.5px] font-medium text-[var(--text-item)]'

/**
 * Campo de escolha múltipla da faixa de filtros.
 *
 * Nasceu em 30/09/2026 na Visão Geral de OS, a pedido do Mário: marcar mais
 * de uma opção no mesmo filtro (duas equipes, Manutenção e Auditoria,
 * Improdutiva e Encerrada). O desenho é o que ele trouxe de referência: as
 * marcadas viram etiquetas dentro do campo, a lista abre com uma busca no
 * topo e mostra o ✓ nas marcadas. Com `searchInField`, a busca é o próprio
 * campo.
 *
 * O que o campo congela:
 *
 * - largura fixa, a do padrão da faixa: o campo nunca cresce pelo conteúdo.
 *   Cabe a primeira etiqueta, cortada com reticências se for longa, e um
 *   "+N" com as demais. A lista completa está na dica do mouse e na lista;
 * - clicar numa opção marca ou desmarca SEM fechar a lista, para marcar
 *   várias de uma vez. Fecha com Esc, com clique fora ou no próprio campo;
 * - a primeira linha é o valor neutro (`Todos`): marcada quando nada está
 *   marcado, e escolhê-la desmarca tudo. Com texto na busca ela sai, e a
 *   lista mostra só o que casa, sem acento e sem caixa;
 * - a lista é um `popover`, como o calendário: sobe para a camada de cima da
 *   tela, escapa da rolagem da faixa e fecha com Esc e com clique fora sem
 *   código nosso. O visual é o da lista aberta dos seletores da faixa
 *   (`impacto-choice-list`, em `styles.css`);
 * - o mouse vira a mãozinha em cima do campo e das opções (pedido do Mário
 *   em 02/10/2026); só onde se digita vale o cursor de texto.
 */
export function MultiSelectField({
  disabled = false,
  hint,
  label,
  onChange,
  options,
  placeholder,
  searchInField = false,
  value,
}: MultiSelectFieldProps) {
  const fieldId = useId()
  const labelId = useId()
  const summaryId = useId()
  const listId = useId()
  const hintId = useId()
  const fieldRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  /** Campo com digitação em uso: as etiquetas saem e o campo vira a busca. */
  const [typing, setTyping] = useState(false)

  const selected = new Set(value)
  const selectedLabels = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
  const rows = multiSelectRows(options, placeholder, query)
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0))
  const optionId = (index: number) => `${listId}-${index}`
  const optionsId = `${listId}-options`

  // Enquanto a lista está aberta ela acompanha o campo: a faixa de filtros é
  // fixa no topo e a página rola por baixo dela. Mesma conta do calendário.
  useEffect(() => {
    if (!open) return

    const place = () => {
      const list = listRef.current
      const anchor = fieldRef.current
      if (list === null || anchor === null) return

      const box = anchor.getBoundingClientRect()
      list.style.minWidth = `${Math.max(box.width, 220)}px`
      const width = list.offsetWidth
      const height = list.offsetHeight
      const top = box.bottom + height + 8 > window.innerHeight ? box.top - height - 4 : box.bottom + 4
      const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8))

      list.style.top = `${Math.max(8, top)}px`
      list.style.left = `${left}px`
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)

    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, rows.length])

  // A opção destacada pelo teclado entra na área visível da lista.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function listIsOpen(): boolean {
    return listRef.current?.matches(':popover-open') ?? false
  }

  function openList() {
    if (!listIsOpen()) listRef.current?.showPopover()
  }

  function closeList() {
    if (listIsOpen()) listRef.current?.hidePopover()
  }

  function toggle(row: { readonly value: string | null }) {
    onChange(toggleMultiSelectValue(value, row.value))
    // No campo com digitação o texto sai depois de marcar: a lista volta
    // inteira, com o ✓ na marcada, e já se digita o próximo nome.
    if (searchInField && query !== '') {
      setQuery('')
      setActive(0)
    }
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!listIsOpen()) {
        openList()
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(Math.min(Math.max(activeIndex + step, 0), Math.max(rows.length - 1, 0)))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[activeIndex]
      if (listIsOpen() && row !== undefined) toggle(row)
      return
    }
    // No campo com digitação o Esc também apaga o que foi digitado.
    if (event.key === 'Escape' && searchInField) {
      setQuery('')
      closeList()
    }
    // E o Tab fecha a lista antes de o foco andar: aberta, ela é a próxima
    // parada do Tab, e o foco ficaria preso nela em vez de ir ao campo
    // seguinte da faixa.
    if (event.key === 'Tab' && searchInField) closeList()
  }

  const summary = selectedLabels.join(', ')

  // O que o campo fechado mostra: o neutro, ou a primeira marcada e o "+N".
  const shown =
    selectedLabels.length === 0 ? (
      <span aria-hidden="true" className="truncate">
        {placeholder}
      </span>
    ) : (
      <>
        <span aria-hidden="true" className={tagClass}>
          {selectedLabels[0]}
        </span>
        {selectedLabels.length > 1 ? (
          <span aria-hidden="true" className={cn(tagClass, 'flex-none')}>
            +{selectedLabels.length - 1}
          </span>
        ) : null}
      </>
    )

  // A seta é a dos seletores da faixa: mesmo chevron, mesma cor, gira com a
  // lista aberta.
  const chevron = (
    <ChevronDown
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] transition-transform duration-150',
        open && 'rotate-180',
        disabled && 'opacity-60',
      )}
      size={14}
    />
  )

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className="text-[11.5px] font-medium text-[var(--text-secondary)]"
        htmlFor={fieldId}
        id={labelId}
      >
        {label}
      </label>
      <div className="relative" ref={fieldRef}>
        {/* O nome que o leitor de tela ouve: o rótulo e, em seguida, tudo o
            que está marcado por extenso, já que o campo só mostra a primeira
            etiqueta e o "+N". */}
        <span className="sr-only" id={summaryId}>
          {summary === '' ? placeholder : summary}
        </span>
        {searchInField ? (
          <>
            {/* O campo é a busca. Em repouso ele mostra as etiquetas por cima
                e leva a mãozinha; em uso, as etiquetas saem e vale o cursor de
                texto. O clique dentro dele com a lista aberta fecharia a lista
                (clique fora do `popover`), e o `onClick` a reabre na hora. */}
            <input
              aria-activedescendant={open && rows[activeIndex] !== undefined ? optionId(activeIndex) : undefined}
              aria-autocomplete="list"
              aria-controls={optionsId}
              aria-describedby={hint === undefined ? undefined : hintId}
              aria-expanded={open}
              aria-labelledby={`${labelId} ${summaryId}`}
              autoComplete="off"
              className={cn(filterControlClass, 'pr-8', typing ? 'cursor-text' : 'cursor-pointer')}
              disabled={disabled}
              id={fieldId}
              onBlur={(event) => {
                setTyping(false)
                setQuery('')
                const next = event.relatedTarget
                if (next instanceof Node && listRef.current?.contains(next)) return
                closeList()
              }}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
                openList()
              }}
              onClick={openList}
              onFocus={() => {
                setTyping(true)
                openList()
              }}
              onKeyDown={handleKeys}
              placeholder={typing ? 'Buscar...' : ''}
              ref={searchRef}
              role="combobox"
              // Nome de pessoa não é texto para o corretor do navegador sublinhar.
              spellCheck={false}
              title={summary === '' ? undefined : summary}
              type="text"
              value={typing ? query : ''}
            />
            {typing ? null : (
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-y-0 left-2.5 right-8 flex min-w-0 items-center gap-1 text-[12.5px] font-semibold text-[var(--text-item)]',
                  disabled && 'opacity-60',
                )}
              >
                {shown}
              </span>
            )}
          </>
        ) : (
          <button
            aria-controls={listId}
            aria-describedby={hint === undefined ? undefined : hintId}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-labelledby={`${labelId} ${summaryId}`}
            className={cn(filterControlClass, 'flex cursor-pointer items-center gap-1 pr-8 text-left')}
            disabled={disabled}
            id={fieldId}
            popoverTarget={listId}
            ref={buttonRef}
            title={summary === '' ? undefined : summary}
            type="button"
          >
            {shown}
          </button>
        )}
        {chevron}
      </div>
      {hint === undefined ? null : (
        <span className="text-[10.5px] leading-tight text-[var(--text-secondary)]" id={hintId}>
          {hint}
        </span>
      )}
      {/* `popover` sobe a lista para a camada de cima da tela. Com a busca no
          topo, ao abrir o foco vai para ela; ao fechar, ela se apaga e o
          navegador devolve o foco ao campo; sair dela com Tab fecha a lista.
          Com a busca no campo, o foco nunca sai dele: o `mousedown` da lista
          não leva o foco, e as opções marcam nele. */}
      <div
        aria-label={`Escolher ${label}`}
        className={cn('impacto-choice-list', !searchInField && 'impacto-multi-choice-list')}
        id={listId}
        onBlur={(event) => {
          if (searchInField) return
          const next = event.relatedTarget
          if (next instanceof Node && event.currentTarget.contains(next)) return
          // O clique no próprio campo já fecha a lista pelo `popoverTarget`;
          // fechar aqui também faria o clique reabri-la.
          if (next === buttonRef.current) return
          closeList()
        }}
        onMouseDown={(event) => {
          if (searchInField) event.preventDefault()
        }}
        onToggle={(event) => {
          const opening = event.newState === 'open'
          setOpen(opening)
          setActive(0)
          if (searchInField) return
          if (opening) searchRef.current?.focus()
          else setQuery('')
        }}
        popover="auto"
        ref={listRef}
        role="dialog"
      >
        {searchInField ? null : (
          <div className="impacto-choice-search">
            <Search aria-hidden="true" size={14} />
            <input
              aria-activedescendant={open && rows[activeIndex] !== undefined ? optionId(activeIndex) : undefined}
              aria-autocomplete="list"
              aria-controls={optionsId}
              aria-label={`Buscar em ${label}`}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={handleKeys}
              placeholder="Buscar..."
              ref={searchRef}
              role="combobox"
              aria-expanded={open}
              spellCheck={false}
              type="text"
              value={query}
            />
          </div>
        )}
        <div aria-label={`Lista de ${label}`} aria-multiselectable="true" id={optionsId} role="listbox">
          {rows.length === 0 ? (
            <p className="impacto-choice-empty">Nenhuma opção com essas letras.</p>
          ) : (
            rows.map((row, index) => {
              const checked = row.value === null ? value.length === 0 : selected.has(row.value)

              return (
                <div
                  aria-selected={checked}
                  className={cn(
                    'impacto-choice-option impacto-multi-choice-option',
                    checked && 'impacto-choice-option-selected',
                  )}
                  data-active={index === activeIndex ? '' : undefined}
                  id={optionId(index)}
                  key={row.value ?? ''}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    setActive(index)
                    toggle(row)
                  }}
                  onMouseEnter={() => setActive(index)}
                  role="option"
                >
                  <span className="impacto-multi-choice-check">
                    {checked ? <Check aria-hidden="true" size={13} strokeWidth={2.5} /> : null}
                  </span>
                  <span className="truncate">{row.label}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
