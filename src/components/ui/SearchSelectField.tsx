import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '../../lib/utils'

export type SearchSelectOption = {
  readonly id: string
  readonly name: string
}

/** Linha da lista: uma opção, ou o valor neutro (`id` nulo) na primeira linha. */
type SearchSelectRow = {
  readonly id: string | null
  readonly name: string
}

type SearchSelectFieldProps = {
  label: string
  options: readonly SearchSelectOption[]
  /** Id da opção escolhida. Nulo é o valor neutro: campo vazio com o `placeholder`. */
  value: string | null
  onChange: (id: string | null) => void
  /** Texto do campo vazio, o valor neutro do filtro: `Todos`. */
  placeholder?: string
  disabled?: boolean
  /** Motivo ou observação em texto logo abaixo do campo, como nos seletores da faixa. */
  hint?: string
  /**
   * Lista aberta desde o início. Existe para os testes de renderização
   * estática verem as opções e o destaque, já que a suíte não tem ambiente de
   * DOM para abrir a lista.
   */
  defaultOpen?: boolean
}

// O valor neutro é o texto de campo vazio, e o navegador o pinta mais claro
// que o valor escolhido. Aqui ele recebe a cor e a opacidade do texto normal:
// `Todos` precisa ler igual ao `Todas` do seletor de Cidade ao lado, porque
// nos dois casos é o filtro em repouso, não uma dica de preenchimento.
const controlClass =
  'h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] pl-2.5 pr-8 text-[12.5px] font-semibold text-[var(--text-item)] outline-none placeholder:text-[var(--text-item)] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60'

/** Comparação tolerante: sem acento, sem caixa, sem espaço sobrando. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Campo de escolha com digitação: um seletor em que também se digita o nome.
 *
 * Nasceu para o filtro Vendedor da Visão Geral Comercial, em 14/09/2026, a
 * pedido do Mário: a lista tem mais de vinte nomes compridos, e um seletor
 * comum obrigava a rolar a lista ou ficava fora do padrão de largura da faixa
 * para caber o nome. Aqui o campo tem a largura dos outros campos da faixa, o
 * nome escolhido aparece por inteiro nele, e quem prefere digitar filtra a
 * lista pelas letras, sem acento e sem caixa.
 *
 * A lista é um `popover`, como o calendário do campo de data: sobe para a
 * camada de cima da tela, escapa da rolagem interna da faixa e fecha com Esc e
 * com clique fora sem código nosso. O visual é o da lista aberta dos
 * seletores da faixa, definido em `styles.css` (`impacto-choice-list`), para
 * o campo não destoar dos vizinhos Cidade e Time.
 *
 * O que o campo devolve é o id da opção, nunca o texto digitado: texto que não
 * casa com nenhum nome não filtra nada, e ao sair do campo ele volta ao nome
 * escolhido, ou fica vazio quando não há escolha. Apagar o texto é escolher o
 * valor neutro.
 */
export function SearchSelectField({
  defaultOpen = false,
  disabled = false,
  hint,
  label,
  onChange,
  options,
  placeholder = 'Todos',
  value,
}: SearchSelectFieldProps) {
  const inputId = useId()
  const listId = useId()
  const hintId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * Texto em digitação. Nulo significa "mostre o nome da opção escolhida", e é
   * o estado normal: assim `Limpar filtros` e o "x" do chip aparecem no campo
   * na hora, sem nenhum efeito sincronizando texto.
   */
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(defaultOpen)
  const [active, setActive] = useState(0)
  /**
   * Campo em uso. Com o cursor dentro, o valor neutro sai do campo: ele lê
   * como um valor escrito, e ver `Todos` ao lado do cursor parecia texto a
   * corrigir. Em repouso ele volta, porque ali é o filtro em repouso, igual
   * ao `Todas` do seletor de Cidade. A escolha atual continua visível, e
   * marcada, na primeira linha da lista, que abre junto.
   */
  const [focused, setFocused] = useState(false)

  const selected = options.find((option) => option.id === value) ?? null
  const text = draft ?? selected?.name ?? ''
  // Com o texto em digitação a lista mostra só o que casa; no estado normal
  // ela mostra tudo, para o botão da seta abrir a lista inteira, com o valor
  // neutro na primeira linha, como a lista dos seletores comuns da faixa.
  const query = draft === null ? '' : normalize(draft)
  const rows: readonly SearchSelectRow[] =
    query === ''
      ? [{ id: null, name: placeholder }, ...options]
      : options.filter((option) => normalize(option.name).includes(query))
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0))
  const optionId = (index: number) => `${listId}-${index}`

  // Enquanto a lista está aberta ela acompanha o campo: a faixa de filtros é
  // fixa no topo e a página rola por baixo dela. Mesma conta do calendário.
  useEffect(() => {
    if (!open) return

    const place = () => {
      const list = listRef.current
      const anchor = anchorRef.current
      if (list === null || anchor === null) return

      const box = anchor.getBoundingClientRect()
      list.style.minWidth = `${box.width}px`
      const width = list.offsetWidth
      const height = list.offsetHeight
      // Mesmo respiro de 4px que a lista dos seletores da faixa tem.
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

  function openList() {
    setActive(0)
    setOpen(true)
    listRef.current?.showPopover()
  }

  function closeList() {
    listRef.current?.hidePopover()
    setOpen(false)
  }

  function pick(row: SearchSelectRow) {
    onChange(row.id)
    setDraft(null)
    closeList()
    inputRef.current?.focus()
  }

  /** Sair do campo: nome completo digitado vale como escolha; o resto volta ao escolhido. */
  function commitDraft() {
    if (draft === null) return
    const typed = normalize(draft)
    const exact = options.find((option) => normalize(option.name) === typed) ?? null
    if (typed === '') onChange(null)
    else if (exact !== null && exact.id !== value) onChange(exact.id)
    setDraft(null)
  }

  function handleInput(next: string) {
    setDraft(next)
    setActive(0)
    // Apagar o texto é voltar ao valor neutro, na hora, sem esperar Enter.
    if (next.trim() === '' && value !== null) onChange(null)
    if (!open) openList()
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive(Math.min(Math.max(activeIndex + step, 0), Math.max(rows.length - 1, 0)))
      return
    }
    if (event.key === 'Enter') {
      if (!open) return
      event.preventDefault()
      const row = rows[activeIndex]
      if (row !== undefined) pick(row)
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setDraft(null)
      closeList()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-[11.5px] font-medium text-[var(--text-secondary)]" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative" ref={anchorRef}>
        <input
          aria-activedescendant={open && rows[activeIndex] !== undefined ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-describedby={hint === undefined ? undefined : hintId}
          aria-expanded={open}
          autoComplete="off"
          className={controlClass}
          disabled={disabled}
          id={inputId}
          onBlur={() => {
            setFocused(false)
            commitDraft()
            if (open) closeList()
          }}
          onChange={(event) => handleInput(event.target.value)}
          // Entrar no campo abre a lista, como clicar num seletor: quem chega
          // aqui quer escolher, digitando ou não.
          onFocus={() => {
            setFocused(true)
            if (!open) openList()
          }}
          onKeyDown={handleKeys}
          placeholder={focused ? '' : placeholder}
          ref={inputRef}
          role="combobox"
          // Nome de pessoa não é texto para o corretor do navegador sublinhar.
          spellCheck={false}
          type="text"
          value={text}
        />
        {/* A seta é a dos seletores da faixa: mesmo chevron, mesma cor, gira
            com a lista aberta e não reage ao mouse, nem de cor nem de cursor.
            Continua sendo um botão para abrir a lista sem digitar. */}
        <button
          aria-controls={listId}
          aria-expanded={open}
          aria-label={`Abrir a lista de ${label}`}
          className="absolute inset-y-0 right-0 flex w-8 cursor-default items-center justify-center rounded-r-lg text-[var(--text-secondary)] focus-visible:outline-none disabled:cursor-not-allowed"
          disabled={disabled}
          // `mousedown` com `preventDefault` mantém o foco no campo: o clique
          // não dispara o `blur` que fecharia a lista antes de abri-la.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current?.focus()
            if (open) closeList()
            else openList()
          }}
          tabIndex={-1}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('transition-transform duration-150', open && 'rotate-180')}
            size={14}
          />
        </button>
      </div>
      {hint === undefined ? null : (
        <span className="text-[10.5px] leading-tight text-[var(--text-secondary)]" id={hintId}>
          {hint}
        </span>
      )}
      {/* `popover` sobe a lista para a camada de cima da tela, como o
          calendário do campo de data. As opções escolhem no `mousedown`, para
          o campo não perder o foco (e fechar a lista) antes do clique. */}
      <div
        aria-label={`Lista de ${label}`}
        className="impacto-choice-list"
        id={listId}
        onToggle={(event) => setOpen(event.newState === 'open')}
        popover="auto"
        ref={listRef}
        role="listbox"
      >
        {rows.length === 0 ? (
          <p className="impacto-choice-empty">Nenhum nome com essas letras.</p>
        ) : (
          rows.map((row, index) => (
            <div
              aria-selected={row.id === value}
              className={cn('impacto-choice-option', row.id === value && 'impacto-choice-option-selected')}
              data-active={index === activeIndex ? '' : undefined}
              id={optionId(index)}
              key={row.id ?? ''}
              onMouseDown={(event) => {
                event.preventDefault()
                pick(row)
              }}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              {row.name}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
