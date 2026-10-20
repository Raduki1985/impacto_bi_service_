import type { CSSProperties, ReactNode } from 'react'

import { tintedChipClass } from '../../components/ui/chipStyles'
import { formatNumber } from '../../lib/formatters'
import { cn } from '../../lib/utils'
import type { CalendarWeek, DayCell, ShiftCell, ShiftSelection, ShiftTone } from './scheduleModel'
import { CALENDAR_PANEL_CLASS, CALENDAR_WEEK_DIVIDER_CLASS, CALENDAR_WEEK_GRID_CLASS } from './ScheduleSkeleton'

/**
 * O calendário da Agenda e capacidade (19/10/2026): semanas em linhas, dias
 * em colunas de segunda a domingo, e dentro de cada dia um botão por turno
 * com a resposta em horas. Composição própria da página, fora de
 * `src/components`, como manda o modelo de página: nada daqui vira
 * compartilhado sem passar pela página modelo.
 *
 * Cor nunca carrega sozinha o estado: a pílula escreve a palavra ("Cabe mais
 * 59,8 h", "Quase cheio", "Cheio", "Livre", "Realizado") e a cor só a
 * acompanha. Os três tons vêm dos tokens da página (`.os-schedule` em
 * `styles.css`), medidos nos dois temas; o cinza é o texto secundário. O
 * acento de "hoje" e do turno aberto é o `--schedule-accent` da mesma classe:
 * o azul do portal no claro e o Verde Detalhes no escuro, onde o azul some
 * sobre a célula.
 *
 * O botão do turno abre o detalhe embaixo do calendário, como a caixa da
 * faixa Hoje ao vivo abre a lista: `aria-expanded` e `aria-controls` dizem ao
 * leitor de tela o que o clique faz, e o nome do dia vai escondido dentro do
 * botão, porque "Manhã, 79 OS" sozinho não diz de que dia é.
 */

const TONE_VAR: Record<ShiftTone, string> = {
  ok: 'var(--schedule-ok)',
  attention: 'var(--schedule-attention)',
  over: 'var(--schedule-over)',
  muted: 'var(--text-secondary)',
}

/** Cor, fundo e borda de uma pílula de estado, derivados de um token só. */
function toneStyle(tone: ShiftTone): CSSProperties {
  const color = TONE_VAR[tone]

  return {
    color,
    background: `color-mix(in srgb, ${color} 13%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 38%, transparent)`,
  }
}

/**
 * A pílula de estado: a mesma forma do chip do portal, pintada pelo tom. Ela
 * quebra linha quando a célula é estreita ("Quase cheio · sobram 7,2 h" num
 * sábado a 1366 px), em vez de vazar da célula.
 */
export function TonePill({ children, tone }: { children: ReactNode; tone: ShiftTone }) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium"
      style={toneStyle(tone)}
    >
      {children}
    </span>
  )
}

function ShiftButton({
  controls,
  dayLabel,
  onToggle,
  open,
  shift,
}: {
  controls: string
  dayLabel: string
  onToggle: () => void
  open: boolean
  shift: ShiftCell
}) {
  const past = shift.state === 'past'

  return (
    <button
      aria-controls={open ? controls : undefined}
      aria-expanded={open}
      className={cn(
        'mt-1.5 block w-full cursor-pointer rounded-lg border border-[var(--border)] px-2 py-1.5 text-left transition-colors hover:border-[var(--text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--schedule-accent)]',
        past ? 'bg-transparent' : 'bg-[var(--surface)]',
      )}
      onClick={onToggle}
      style={
        open
          ? {
              borderColor: 'var(--schedule-accent)',
              background: 'color-mix(in srgb, var(--schedule-accent) 7%, var(--surface))',
            }
          : undefined
      }
      type="button"
    >
      <span className="sr-only">{dayLabel}, </span>
      <span className="flex items-baseline justify-between gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
          {shift.period}
        </span>
        <span className="whitespace-nowrap text-[16px] font-semibold leading-none tabular-nums tracking-[-0.2px] text-[var(--text-heading)]">
          {shift.hours}
        </span>
      </span>
      <span aria-hidden="true" className="my-1.5 block h-[5px] overflow-hidden rounded bg-[var(--divider)]">
        <span
          className="block h-full rounded"
          style={{ width: `${shift.fillPercent}%`, background: TONE_VAR[shift.tone] }}
        />
      </span>
      {/* Altura fixa para a pílula de duas linhas ("Quase cheio · sobram 7,2 h"
          numa coluna estreita) e para a linha das horas, mesmo vazia: todo
          turno tem a mesma altura e os dias da semana ficam alinhados
          (pedido do Mário em 19/10/2026). */}
      <span className="flex min-h-[42px] items-start">
        <TonePill tone={shift.tone}>{shift.pill}</TonePill>
      </span>
      <span className="mt-1 block h-[15px] truncate text-[10.5px] tabular-nums leading-[15px] text-[var(--text-secondary)]">
        {shift.hoursNote}
      </span>
    </button>
  )
}

/**
 * A segunda linha do dia: técnicos e OS sem turno; com `full`, a frase da
 * dica de mouse, com a origem da presença. Feriado vai na frente, em
 * destaque, porque a pílula não cabia ao lado da data.
 */
function daySubline(day: DayCell, full: boolean): string {
  const parts = [
    day.technicians === null
      ? null
      : full
        ? day.presenceText
        : `${formatNumber(day.technicians)} ${day.technicians === 1 ? 'técnico' : 'técnicos'}`,
    day.withoutPeriod > 0 ? `${formatNumber(day.withoutPeriod)} sem turno` : null,
  ].filter((part): part is string => part !== null)
  const text = parts.join(' · ')

  return full && day.closed ? `Feriado no cadastro do SGI · ${text}` : text
}

/**
 * Cabeçalho do dia em duas linhas de altura fixa: o dia com as marcas (Hoje,
 * Feriado) e, embaixo, os técnicos e as OS sem turno. Antes as marcas
 * empurravam "28 técnicos" para outra linha só em alguns dias, e as células
 * da mesma semana saíam desalinhadas.
 */
const DAY_HEAD_CLASS =
  'flex h-5 items-center gap-x-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]'
const DAY_SUB_CLASS = 'h-4 truncate text-[10.5px] leading-4 text-[var(--text-secondary)]'

function DayCard({
  controls,
  day,
  onSelect,
  selection,
}: {
  controls: string
  day: DayCell
  onSelect: (selection: ShiftSelection) => void
  selection: ShiftSelection | null
}) {
  if (day.empty !== null) {
    return (
      <div
        className="min-h-[150px] rounded-[10px] border border-dashed border-[var(--border)] p-2"
        data-calendar-day={day.iso}
      >
        <div className={DAY_HEAD_CLASS}>
          <span>{day.label}</span>
        </div>
        <div className={DAY_SUB_CLASS} />
        <p className="py-7 text-center text-[11.5px] text-[var(--text-secondary)]">
          {day.empty === 'sunday' ? 'Sem agenda' : 'Fora da leitura'}
        </p>
      </div>
    )
  }

  const past = day.kind === 'past'

  return (
    <div
      className={cn(
        'min-h-[150px] rounded-[10px] border border-[var(--border)] p-2',
        // O dia que já passou fica sobre um fundo sombreado, e não apagado:
        // esmaecer derrubava o contraste do texto (revisão de 16/10/2026).
        past
          ? 'bg-[color:color-mix(in_srgb,var(--text-secondary)_7%,var(--surface-elevated))]'
          : 'bg-[var(--surface-elevated)]',
        day.isToday && 'border-[var(--schedule-accent)] shadow-[inset_0_0_0_1px_var(--schedule-accent)]',
      )}
      data-calendar-day={day.iso}
    >
      <div className={DAY_HEAD_CLASS}>
        <span className={day.isToday ? 'text-[var(--schedule-accent)]' : undefined}>{day.label}</span>
        {day.isToday ? <span className={tintedChipClass}>Hoje</span> : null}
      </div>
      <div className={DAY_SUB_CLASS} title={daySubline(day, true)}>
        {day.closed ? <strong className="font-semibold text-[var(--text-heading)]">Feriado · </strong> : null}
        {daySubline(day, false)}
      </div>
      {day.shifts.map((shift) => (
        <ShiftButton
          controls={controls}
          dayLabel={day.label}
          key={shift.periodKey}
          onToggle={() => onSelect({ iso: day.iso, periodKey: shift.periodKey })}
          open={selection !== null && selection.iso === day.iso && selection.periodKey === shift.periodKey}
          shift={shift}
        />
      ))}
    </div>
  )
}

/** As semanas do calendário, uma por linha, dentro do painel executivo. */
export function ScheduleCalendar({
  controls,
  onSelect,
  selection,
  weeks,
}: {
  /** Identificador do detalhe que o clique abre, para o `aria-controls` dos turnos. */
  controls: string
  onSelect: (selection: ShiftSelection) => void
  selection: ShiftSelection | null
  weeks: readonly CalendarWeek[]
}) {
  return (
    <section aria-label="Calendário de agendamento" className={cn(CALENDAR_PANEL_CLASS, 'overflow-x-auto')}>
      {weeks.map((week, index) => (
        <div
          aria-label={week.title}
          className={cn(CALENDAR_WEEK_GRID_CLASS, index > 0 && CALENDAR_WEEK_DIVIDER_CLASS)}
          key={week.start}
          role="group"
        >
          {week.days.map((day) => (
            <DayCard controls={controls} day={day} key={day.iso} onSelect={onSelect} selection={selection} />
          ))}
        </div>
      ))}
    </section>
  )
}
