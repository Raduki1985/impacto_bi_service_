import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '../../lib/utils'
import {
  acceptsTyping,
  brDateFromIso,
  buildCalendarWeeks,
  clampToLimits,
  draftWithPending,
  isoFromBrDate,
  isSelectable,
  localToday,
  MONTH_SHORT_NAMES,
  monthHasSelectableDay,
  monthKey,
  monthOf,
  monthTitle,
  neighbourSegment,
  pickerYears,
  sameDayInMonth,
  segmentAtCursor,
  SEGMENT_RANGES,
  shiftMonth,
  stepSegment,
  typeInSegment,
  WEEKDAY_INITIALS,
  type DateSegment,
} from './dateFieldModel'

type CalendarView = 'days' | 'months'

type DateFieldProps = {
  label: string
  /** Data em `AAAA-MM-DD`. É o formato que os filtros guardam. */
  value: string
  min?: string
  max?: string
  onChange: (isoDate: string) => void
  /**
   * Hoje, em `AAAA-MM-DD`, para o botão `Hoje` e a marca do dia na grade. O
   * padrão é o relógio de quem está usando; os testes passam um valor fixo.
   */
  today?: string
  /**
   * Vista inicial do calendário. Existe para os testes de renderização
   * estática exercitarem o seletor de ano e mês, que só aparece ao clicar no
   * título, já que a suíte não tem ambiente de DOM para acionar o controle.
   */
  defaultView?: CalendarView
}

const controlClass =
  'h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] pl-2.5 pr-8 text-[12.5px] font-semibold text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

/**
 * Campo de data do portal: digitação por partes e um calendário próprio.
 *
 * Substitui o `input type="date"` do navegador nas faixas de filtro. O motivo é
 * de identidade: no campo nativo, o realce do dia e o calendário são desenhados
 * pelo navegador, sempre no azul do sistema, e nenhuma regra da página alcança
 * aquelas cores. Foi o que o Mário apontou em 10/09/2026, depois de a lista dos
 * seletores entrar na paleta. Aqui tudo é markup da página, então o calendário
 * segue o acento como o resto: verde no tema escuro, azul no claro.
 *
 * O comportamento é o do campo que saiu, medido nele e completado pelo que o
 * Mário pediu no mesmo dia: o campo edita dia, mês e ano em partes; o título
 * do calendário abre a lista de anos com os meses de cada um; trocar de mês,
 * pelas setas, pelo teclado ou por essa lista, leva a data junto para o mesmo
 * dia do destino, e o último dia do mês puxa o último dia do destino (28/02
 * vira 31/03); e `Hoje` escolhe o dia de hoje quando ele cabe na cobertura.
 *
 * O calendário usa `popover`, o recurso do próprio HTML: ele sobe para a camada
 * de cima da tela e escapa da rolagem interna da faixa de filtros, que cortaria
 * um bloco comum. De brinde vem o fechamento com Esc e com clique fora, sem
 * código nosso.
 *
 * O valor continua sendo `AAAA-MM-DD` para quem usa o campo, exatamente como o
 * campo nativo entregava, então nenhuma página precisou mudar as contas.
 */
export function DateField({
  defaultView = 'days',
  label,
  max,
  min,
  onChange,
  today,
  value,
}: DateFieldProps) {
  const inputId = useId()
  const calendarId = useId()
  const calendarRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const yearListRef = useRef<HTMLDivElement>(null)
  /** Pedido de foco para um dia da grade, feito pelas teclas; o efeito atende. */
  const focusDayRef = useRef(false)

  /**
   * A parte da data em edição e os números já digitados nela, como no campo do
   * navegador. O texto na tela é sempre o valor de fora com esses números por
   * cima, então `Limpar filtros` aparece no campo na hora, sem nenhum efeito
   * sincronizando texto.
   */
  const [segment, setSegment] = useState<DateSegment>('day')
  const [pending, setPending] = useState('')
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<CalendarView>(defaultView)
  const [visibleMonth, setVisibleMonth] = useState(() => monthOf(value))
  const [focusedDay, setFocusedDay] = useState(value)
  const [expandedYear, setExpandedYear] = useState<number | null>(() => Number(value.slice(0, 4)))

  const limits = { max, min }
  const todayIso = today ?? localToday()
  const text = draftWithPending(value, segment, pending)
  const weeks = buildCalendarWeeks(visibleMonth, limits)
  const previousMonth = shiftMonth(visibleMonth, -1)
  const nextMonth = shiftMonth(visibleMonth, 1)
  const years = pickerYears(visibleMonth, limits)

  // Enquanto o calendário está aberto ele acompanha o campo: a faixa de filtros
  // é fixa no topo e a página rola por baixo dela. A lista de anos tem outra
  // altura, por isso a conta refaz ao trocar de vista.
  useEffect(() => {
    if (!open) return

    const place = () => {
      const calendar = calendarRef.current
      const anchor = anchorRef.current
      if (calendar === null || anchor === null) return

      const box = anchor.getBoundingClientRect()
      const width = calendar.offsetWidth
      const height = calendar.offsetHeight
      // Abre para baixo, e para cima quando não couber. Nunca passa da borda
      // direita da janela.
      const top = box.bottom + height + 8 > window.innerHeight ? box.top - height - 6 : box.bottom + 6
      const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8))

      calendar.style.top = `${Math.max(8, top)}px`
      calendar.style.left = `${left}px`
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)

    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, view])

  /**
   * A parte em edição fica destacada dentro do campo, como o navegador faz com
   * dia, mês e ano. É o que dá o alvo das setas e do número digitado.
   */
  useEffect(() => {
    const input = inputRef.current
    if (input === null || document.activeElement !== input) return

    const [inicio, fim] = SEGMENT_RANGES[segment]
    input.setSelectionRange(inicio, fim)
  }, [segment, pending, value])

  // O dia que as teclas alcançaram recebe o foco de verdade, senão o teclado
  // moveria o destaque sem levar o leitor de tela junto. As setas de mês
  // clicadas com o mouse não pedem isso: o foco fica no botão, para o clique
  // seguinte cair no mesmo lugar.
  useEffect(() => {
    if (!open || view !== 'days' || !focusDayRef.current) return

    focusDayRef.current = false
    calendarRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusedDay}"]`)?.focus()
  }, [focusedDay, open, view])

  // O ano aberto entra na área visível da lista, senão uma cobertura longa
  // deixaria o ano do filtro escondido lá embaixo.
  useEffect(() => {
    if (view !== 'months') return

    yearListRef.current?.querySelector('[data-expanded]')?.scrollIntoView({ block: 'nearest' })
  }, [expandedYear, view])

  function openCalendar() {
    const start = isSelectable(value, min, max) ? value : (min ?? value)

    focusDayRef.current = true
    setVisibleMonth(monthOf(start))
    setFocusedDay(start)
    setView('days')
    setOpen(true)
    calendarRef.current?.showPopover()
  }

  function closeCalendar(devolveFoco: boolean) {
    calendarRef.current?.hidePopover()
    setOpen(false)
    setView('days')
    if (devolveFoco) inputRef.current?.focus()
  }

  function choose(isoDate: string) {
    onChange(isoDate)
    setPending('')
    closeCalendar(true)
  }

  /**
   * Troca o mês visível e leva a data junto, na regra do Mário: o mesmo dia no
   * mês de destino, com o último dia puxando o último dia. O dia que a
   * cobertura não alcança fica preso ao limite dela. Vale para as setas, para
   * PageUp e PageDown na grade e para o seletor de ano e mês.
   */
  function goToMonth(targetMonth: string, options: { from?: string; focus?: boolean } = {}) {
    if (!monthHasSelectableDay(targetMonth, limits)) return

    const destino = clampToLimits(sameDayInMonth(options.from ?? value, targetMonth), min, max)

    focusDayRef.current = options.focus === true
    setVisibleMonth(targetMonth)
    setFocusedDay(destino)
    setView('days')
    if (destino !== value) onChange(destino)
  }

  /** O título alterna entre a grade de dias e a lista de anos com seus meses. */
  function toggleView() {
    if (view === 'days') setExpandedYear(Number(visibleMonth.slice(0, 4)))
    setView(view === 'days' ? 'months' : 'days')
  }

  /**
   * Teclado do campo, no mesmo desenho do campo nativo: setas de lado trocam a
   * parte, as de cima e de baixo somam nela, o número preenche e passa adiante,
   * e Alt com a seta de baixo abre o calendário.
   */
  function handleFieldKeys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      openCalendar()
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      setSegment(neighbourSegment(segment, event.key === 'ArrowLeft' ? -1 : 1))
      setPending('')
      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const proxima = stepSegment(value, segment, event.key === 'ArrowUp' ? 1 : -1, limits)
      setPending('')
      if (proxima !== value) onChange(proxima)
      return
    }

    // Apagar limpa os números em digitação e devolve a parte como ela estava:
    // o filtro nunca fica sem data, e é por isso que o campo não esvazia.
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      setPending('')
      return
    }

    if (!/^\d$/.test(event.key)) return

    event.preventDefault()
    const resultado = typeInSegment(value, segment, pending, event.key, limits)
    setPending(resultado.pending)
    if (resultado.isoDate !== value) onChange(resultado.isoDate)
    if (resultado.done) setSegment(neighbourSegment(segment, 1))
  }

  /** Colar continua valendo: é o único caminho que entrega a data inteira. */
  function handlePaste(entrada: string) {
    if (!acceptsTyping(entrada)) return

    const iso = isoFromBrDate(entrada)
    if (iso !== null && isSelectable(iso, min, max)) {
      setPending('')
      onChange(iso)
    }
  }

  /** O clique escolhe a parte, como no campo nativo. */
  function handleCursor() {
    const input = inputRef.current
    if (input === null) return

    const alvo = segmentAtCursor(input.selectionStart ?? 0)
    if (alvo === segment) return

    setSegment(alvo)
    setPending('')
  }

  /** Sair do campo descarta o que estava em digitação: o valor de fora manda. */
  function handleBlur() {
    setPending('')
  }

  /**
   * Teclado da grade: setas andam por dia e por semana, PageUp e PageDown
   * trocam o mês levando a data junto, como as setas do cabeçalho.
   */
  function handleGridKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (view !== 'days') return

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      goToMonth(event.key === 'PageUp' ? previousMonth : nextMonth, {
        focus: true,
        from: focusedDay,
      })
      return
    }

    // As setas só andam quando o foco está num dia: sobre as ações do
    // cabeçalho e do rodapé elas continuam sendo as setas de sempre.
    if (!(event.target instanceof HTMLElement) || event.target.dataset.iso === undefined) return

    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    const passo = passos[event.key]
    if (passo === undefined) return

    event.preventDefault()
    const [ano, mes, dia] = focusedDay.split('-').map(Number)
    const destino = new Date(Date.UTC(ano, mes - 1, dia + passo)).toISOString().slice(0, 10)
    if (!isSelectable(destino, min, max)) return

    focusDayRef.current = true
    setFocusedDay(destino)
    setVisibleMonth(monthOf(destino))
  }

  return (
    <div className="impacto-date-field flex min-w-0 flex-col gap-1">
      <label className="text-[11.5px] font-medium text-[var(--text-secondary)]" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative" ref={anchorRef}>
        <input
          aria-describedby={calendarId}
          autoComplete="off"
          className={cn(controlClass, 'font-mono')}
          id={inputId}
          inputMode="numeric"
          onBlur={handleBlur}
          // A digitação é toda pelo teclado, parte por parte; o `onChange` só
          // chega aqui quando alguém cola a data inteira.
          onChange={(event) => handlePaste(event.target.value)}
          onClick={handleCursor}
          // Entrar pelo Tab começa no dia, como no campo do navegador.
          onFocus={() => setSegment('day')}
          onKeyDown={handleFieldKeys}
          onSelect={handleCursor}
          placeholder="dd/mm/aaaa"
          ref={inputRef}
          required
          type="text"
          value={text}
        />
        <button
          aria-controls={calendarId}
          aria-expanded={open}
          aria-label={`Escolher ${label} no calendário`}
          className="impacto-date-trigger absolute inset-y-0 right-0 flex w-8 cursor-pointer items-center justify-center rounded-r-lg text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={() => (open ? closeCalendar(true) : openCalendar())}
          type="button"
        >
          <CalendarDays aria-hidden="true" size={14} />
        </button>
      </div>
      {/* `popover` sobe o calendário para a camada de cima da tela: assim ele
          não é cortado pela rolagem interna da faixa, e ganha o fechamento com
          Esc e com clique fora sem nenhum código nosso. */}
      <div
        aria-label={`Calendário de ${label}`}
        className="impacto-calendar"
        id={calendarId}
        onKeyDown={handleGridKeys}
        onToggle={(event) => {
          const aberto = event.newState === 'open'
          setOpen(aberto)
          if (!aberto) setView('days')
        }}
        popover="auto"
        ref={calendarRef}
        role="dialog"
      >
        <div className="impacto-calendar-head">
          <button
            aria-expanded={view === 'months'}
            className="impacto-calendar-title"
            onClick={toggleView}
            title="Escolher mês e ano"
            type="button"
          >
            {monthTitle(visibleMonth)}
            <ChevronDown
              aria-hidden="true"
              className={view === 'months' ? 'rotate-180' : undefined}
              size={13}
            />
          </button>
          {view === 'days' ? (
            <div className="impacto-calendar-nav-group">
              <button
                aria-label="Mês anterior"
                className="impacto-calendar-nav"
                disabled={!monthHasSelectableDay(previousMonth, limits)}
                onClick={() => goToMonth(previousMonth)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={15} />
              </button>
              <button
                aria-label="Próximo mês"
                className="impacto-calendar-nav"
                disabled={!monthHasSelectableDay(nextMonth, limits)}
                onClick={() => goToMonth(nextMonth)}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={15} />
              </button>
            </div>
          ) : null}
        </div>
        {view === 'days' ? (
          <table className="impacto-calendar-grid">
            <thead>
              <tr>
                {WEEKDAY_INITIALS.map((inicial, indice) => (
                  <th key={`${inicial}-${indice}`} scope="col">
                    {inicial}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0].iso}>
                  {week.map((dia) => (
                    <td key={dia.iso}>
                      <button
                        aria-current={dia.iso === todayIso ? 'date' : undefined}
                        aria-label={`${brDateFromIso(dia.iso)}${dia.iso === value ? ', selecionado' : ''}`}
                        className="impacto-calendar-day"
                        data-iso={dia.iso}
                        data-outside={dia.currentMonth ? undefined : 'true'}
                        data-selected={dia.iso === value ? 'true' : undefined}
                        data-today={dia.iso === todayIso ? 'true' : undefined}
                        disabled={!dia.selectable}
                        onClick={() => choose(dia.iso)}
                        tabIndex={dia.iso === focusedDay ? 0 : -1}
                        type="button"
                      >
                        {dia.day}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* A lista de anos do campo que saiu: cada ano abre com os seus doze
             meses, e o mês fora da cobertura fica desligado. Escolher um mês
             volta à grade de dias já naquele mês. */
          <div aria-label="Ano e mês" className="impacto-calendar-years" ref={yearListRef} role="group">
            {years.map((year) => {
              const expanded = year === expandedYear

              return (
                <div
                  className="impacto-calendar-year"
                  data-expanded={expanded ? 'true' : undefined}
                  key={year}
                >
                  <button
                    aria-expanded={expanded}
                    className="impacto-calendar-year-row"
                    onClick={() => setExpandedYear(expanded ? null : year)}
                    type="button"
                  >
                    {year}
                    <ChevronDown
                      aria-hidden="true"
                      className={expanded ? 'rotate-180' : undefined}
                      size={12}
                    />
                  </button>
                  {expanded ? (
                    <div className="impacto-calendar-months">
                      {MONTH_SHORT_NAMES.map((nome, indice) => {
                        const month = monthKey(year, indice + 1)

                        return (
                          <button
                            aria-label={monthTitle(month)}
                            className="impacto-calendar-month"
                            data-month={month}
                            data-selected={month === monthOf(value) ? 'true' : undefined}
                            disabled={!monthHasSelectableDay(month, limits)}
                            key={month}
                            onClick={() => goToMonth(month)}
                            type="button"
                          >
                            {nome}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        <div className="impacto-calendar-foot">
          <button
            className="impacto-calendar-today"
            disabled={!isSelectable(todayIso, min, max)}
            onClick={() => choose(todayIso)}
            type="button"
          >
            Hoje
          </button>
        </div>
      </div>
    </div>
  )
}
