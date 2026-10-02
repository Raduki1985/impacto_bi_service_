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
 * topo e mostra o ✓ nas marcadas.
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
 * - a lista é um `popover`, como o calendário e o campo com digitação: sobe
 *   para a camada de cima da tela, escapa da rolagem da faixa e fecha com
 *   Esc e com clique fora sem código nosso. O visual é o da lista aberta dos
 *   seletores da faixa (`impacto-choice-list`, em `styles.css`).
 */
export function MultiSelectField({
  disabled = false,
  hint,
  label,
  onChange,
  options,
  placeholder,
  value,
}: MultiSelectFieldProps) {
  const buttonId = useId()
  const labelId = useId()
  const summaryId = useId()
  const listId = useId()
  const hintId = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = new Set(value)
  const selectedLabels = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
  const rows = multiSelectRows(options, placeholder, query)
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0))
  const optionId = (index: number) => `${listId}-${index}`

  // Enquanto a lista está aberta ela acompanha o campo: a faixa de filtros é
  // fixa no topo e a página rola por baixo dela. Mesma conta do campo com
  // digitação e do calendário.
  useEffect(() => {
    if (!open) return

    const place = () => {
      const list = listRef.current
      const anchor = anchorRef.current
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

  function toggle(row: { readonly value: string | null }) {
    onChange(toggleMultiSelectValue(value, row.value))
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(Math.min(Math.max(activeIndex + step, 0), Math.max(rows.length - 1, 0)))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[activeIndex]
      if (row !== undefined) toggle(row)
    }
  }

  const summary = selectedLabels.join(', ')

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        className="text-[11.5px] font-medium text-[var(--text-secondary)]"
        htmlFor={buttonId}
        id={labelId}
      >
        {label}
      </label>
      {/* O nome que o leitor de tela ouve: o rótulo e, em seguida, tudo o que
          está marcado por extenso, já que o campo só mostra a primeira
          etiqueta e o "+N". */}
      <button
        aria-controls={listId}
        aria-describedby={hint === undefined ? undefined : hintId}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${summaryId}`}
        className={cn(filterControlClass, 'flex cursor-default items-center gap-1 pr-8 text-left relative')}
        disabled={disabled}
        id={buttonId}
        popoverTarget={listId}
        ref={anchorRef}
        title={summary === '' ? undefined : summary}
        type="button"
      >
        <span className="sr-only" id={summaryId}>
          {summary === '' ? placeholder : summary}
        </span>
        {selectedLabels.length === 0 ? (
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
        )}
        {/* A seta é a dos seletores da faixa: mesmo chevron, mesma cor, gira
            com a lista aberta. */}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'absolute right-2.5 text-[var(--text-secondary)] transition-transform duration-150',
            open && 'rotate-180',
          )}
          size={14}
        />
      </button>
      {hint === undefined ? null : (
        <span className="text-[10.5px] leading-tight text-[var(--text-secondary)]" id={hintId}>
          {hint}
        </span>
      )}
      {/* `popover` sobe a lista para a camada de cima da tela. Ao abrir, o
          foco vai para a busca; ao fechar, a busca se apaga e o navegador
          devolve o foco ao campo. As opções marcam no `mousedown`, para a
          busca não perder o foco. Sair dela com Tab fecha a lista, como no
          campo com digitação. */}
      <div
        aria-label={`Escolher ${label}`}
        className="impacto-choice-list impacto-multi-choice-list"
        id={listId}
        onBlur={(event) => {
          const next = event.relatedTarget
          if (next instanceof Node && event.currentTarget.contains(next)) return
          // O clique no próprio campo já fecha a lista pelo `popoverTarget`;
          // fechar aqui também faria o clique reabri-la.
          if (next === anchorRef.current) return
          if (listRef.current?.matches(':popover-open')) listRef.current.hidePopover()
        }}
        onToggle={(event) => {
          const opening = event.newState === 'open'
          setOpen(opening)
          setActive(0)
          if (opening) searchRef.current?.focus()
          else setQuery('')
        }}
        popover="auto"
        ref={listRef}
        role="dialog"
      >
        <div className="impacto-choice-search">
          <Search aria-hidden="true" size={14} />
          <input
            aria-activedescendant={open && rows[activeIndex] !== undefined ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            aria-controls={`${listId}-options`}
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
        <div
          aria-label={`Lista de ${label}`}
          aria-multiselectable="true"
          id={`${listId}-options`}
          role="listbox"
        >
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
