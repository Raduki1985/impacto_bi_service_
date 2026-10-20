import type { CSSProperties, ReactNode } from 'react'
import { Lock, User } from 'lucide-react'

import { formatNumber } from '../../lib/formatters'
import { cn } from '../../lib/utils'
import {
  answerText,
  shortDay,
  type AnswerPart,
  type CalendarWeek,
  type DayCell,
  type DayLock,
  type ShiftCell,
  type ShiftSelection,
  type ShiftTone,
} from './scheduleModel'
import { CALENDAR_PANEL_CLASS, CALENDAR_WEEK_DIVIDER_CLASS, CALENDAR_WEEK_GRID_CLASS } from './ScheduleSkeleton'

/**
 * O calendário da Agenda e capacidade (19/10/2026): semanas em linhas, dias
 * em colunas de segunda a domingo, e dentro de cada dia um botão por turno
 * com a resposta em horas. Composição própria da página, fora de
 * `src/components`, como manda o modelo de página: nada daqui vira
 * compartilhado sem passar pela página modelo.
 *
 * O card do turno é o das prévias de 20/10/2026 (rodadas 7 a 9, aprovadas
 * pelo Mário, e a 10, que trocou as horas da barra pela ocupação): a
 * capacidade no canto, a barra com a ocupação dentro ("78%") e,
 * embaixo, centralizada, a resposta para quem agenda, com as horas livres em
 * destaque ("53h48 livres"). Cor nunca carrega sozinha o estado: a resposta
 * escreve a palavra ("só", "excedeu", "Cheio", "Realizado") e a cor só a
 * acompanha. Os três tons vêm dos tokens da página (`.os-schedule` em
 * `styles.css`), medidos nos dois temas; o cinza é o texto secundário. O
 * acento de "hoje" e do turno aberto é o `--schedule-accent` da mesma classe:
 * o azul do portal no claro e o Verde Detalhes no escuro, onde o azul some
 * sobre a célula.
 *
 * O botão do turno abre o detalhe embaixo do calendário, como a caixa da
 * faixa Hoje ao vivo abre a lista: `aria-expanded` e `aria-controls` dizem ao
 * leitor de tela o que o clique faz, e o nome do dia vai escondido dentro do
 * botão, porque "Manhã, 53h48 livres" sozinho não diz de que dia é.
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
 * A pílula de estado do detalhe do turno ("Cabe mais 12", "Cheio"): a mesma
 * forma do chip do portal, pintada pelo tom. Ela quebra linha quando a
 * coluna é estreita, em vez de vazar.
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

/** O desenho de cada pedaço da resposta; o número é o mais forte do turno. */
const ANSWER_PART_CLASS: Record<AnswerPart['kind'], string> = {
  hours: 'text-[13.5px] font-bold',
  qualifier: 'text-[11px] font-semibold',
  unit: 'text-[11px] text-[var(--text-secondary)]',
  word: 'min-w-0 truncate text-[12px] font-bold',
}

/**
 * A resposta embaixo da barra, numa linha de altura fixa para os turnos da
 * semana ficarem alinhados. O leitor de tela recebe a frase inteira de uma
 * vez, porque o espaço entre pedaços de um `flex` não tem garantia de
 * chegar até ele.
 */
function ShiftAnswer({ parts, tone }: { parts: readonly AnswerPart[]; tone: ShiftTone }) {
  return (
    <>
      <span className="sr-only">{answerText(parts)}</span>
      <span
        aria-hidden="true"
        className="flex h-[18px] items-baseline justify-center gap-1 overflow-hidden whitespace-nowrap tabular-nums"
      >
        {parts.map((part, index) => (
          <span
            className={ANSWER_PART_CLASS[part.kind]}
            key={index}
            style={part.kind === 'unit' ? undefined : { color: TONE_VAR[tone] }}
          >
            {part.text}
          </span>
        ))}
      </span>
    </>
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
  const tone = TONE_VAR[shift.tone]

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
      title={shift.tooltip}
      type="button"
    >
      <span className="sr-only">{dayLabel}, </span>
      <span className="flex h-[17px] items-baseline justify-between gap-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
          {shift.period}
        </span>
        {shift.capacity === null ? null : (
          <span
            aria-hidden="true"
            className="whitespace-nowrap text-[11.5px] font-semibold tabular-nums text-[var(--text-secondary)]"
          >
            <small className="mr-0.5 text-[10px] font-medium">cap.</small>
            {shift.capacity}
          </span>
        )}
      </span>
      <span className="sr-only">, </span>
      {/* A barra das prévias de 20/10/2026, que não muda: preenchimento suave
          na cor do estado (30% do tom sobre a superfície), linha cheia de 3 px
          do tom na base e a ocupação dentro, escura. Contraste medido
          na revisão de 20/10/2026: o texto passa de 6 nos dois temas (6,07 no
          pior caso, dia passado no escuro) e a linha da base fica acima de
          3,3 contra a parte vazia. A parte vazia não tem fundo, só o contorno
          fino da borda do portal (Mário, 20/10/2026, rodada 11 das prévias):
          com o trilho cinza, o preenchimento cinza do realizado sumia nele.
          As horas marcadas, a capacidade e a ocupação chegam ao leitor de
          tela pela dica (`title`), que vira a descrição do botão. */}
      <span
        aria-hidden="true"
        className="relative my-1.5 block h-[18px] overflow-hidden rounded-[5px] shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: `${shift.fillPercent}%`, background: `color-mix(in srgb, ${tone} 30%, var(--surface))` }}
        />
        <span className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${shift.fillPercent}%`, background: tone }} />
        <span className="relative block whitespace-nowrap pl-1.5 text-[12px] font-semibold leading-[18px] tabular-nums text-[var(--text-heading)]">
          {shift.barText}
        </span>
      </span>
      <ShiftAnswer parts={shift.answer} tone={shift.tone} />
    </button>
  )
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/**
 * `3 OS sem turno` (Mário, 20/10/2026: só "sem turno" não dizia o quê), ou
 * nulo quando todas as OS do dia têm turno.
 */
function withoutPeriodText(day: DayCell): string | null {
  return day.withoutPeriod > 0 ? `${formatNumber(day.withoutPeriod)} OS sem turno` : null
}

/**
 * Cabeçalho do dia em duas linhas de altura fixa, centradas no cartão como o
 * nome do dia num calendário (Mário, 20/10/2026). Na primeira, o dia e os
 * técnicos da conta: "SEG 19/10 · 29", com o ícone de pessoa; hoje se
 * escreve "HOJE 20/10" na cor de destaque. Na segunda, só no dia de hoje,
 * quantos deles estão com o botão de disponível ligado agora, com o ponto de
 * ao vivo do portal; nos outros dias, o selo de feriado ou de rota travada
 * e as OS sem turno. A linha existe em todo dia, mesmo vazia, para os turnos
 * da semana ficarem alinhados. A origem dos números vai na dica de mouse.
 */
const DAY_HEAD_CLASS =
  'flex h-5 items-center justify-center gap-x-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]'
const DAY_SUB_CLASS =
  'flex h-4 items-center justify-center gap-[3px] overflow-hidden whitespace-nowrap text-[10.5px] tabular-nums text-[var(--text-secondary)]'

function DayHead({ day }: { day: DayCell }) {
  return (
    <div className={DAY_HEAD_CLASS} title={day.techniciansText ?? undefined}>
      <span className={day.isToday ? 'text-[var(--schedule-accent)]' : undefined}>
        {day.isToday ? `Hoje ${shortDay(day.iso)}` : day.label}
      </span>
      {day.technicians === null ? null : (
        <>
          <span aria-hidden="true" className="font-normal opacity-60">
            ·
          </span>
          <span className="inline-flex items-center gap-[3px] tabular-nums">
            <User aria-hidden="true" size={11} strokeWidth={2.4} />
            {formatNumber(day.technicians)}
            <span className="sr-only"> {plural(day.technicians, 'técnico', 'técnicos')}</span>
          </span>
        </>
      )}
    </div>
  )
}

/**
 * O selo de feriado ou de rota travada (Mário, 20/10/2026, prévia v12), na
 * cor de atenção da página: o gestor de OS cadastra feriado no SGI para
 * travar a rota, e quem agenda precisa ver de longe que ali não entra OS. O
 * cadeado marca a trava; feriado do calendário vai sem ele. O nome cortado
 * aparece inteiro na dica de mouse.
 */
function LockSeal({ extra, lock }: { extra: string | null; lock: DayLock }) {
  // As OS sem turno não cabem ao lado do selo: vão junto na dica e no leitor de tela.
  const title = extra === null ? lock.title : `${lock.title} · ${extra}`

  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-[3px] rounded-full border px-1.5 text-[10.5px] font-semibold leading-[14px]"
      style={toneStyle('attention')}
      title={title}
    >
      {lock.locked ? <Lock aria-hidden="true" className="flex-none" size={10} strokeWidth={2.6} /> : null}
      <span className="sr-only">{title}</span>
      <span aria-hidden="true" className="truncate">
        {lock.label}
      </span>
    </span>
  )
}

function DaySub({ day, live }: { day: DayCell; live: boolean }) {
  const withoutPeriod = withoutPeriodText(day)
  if (day.availableNow !== null) {
    const title = [
      `${formatNumber(day.availableNow)} ${plural(day.availableNow, 'técnico disponível', 'técnicos disponíveis')} agora no SGI: online e com o botão de disponível ligado`,
      withoutPeriod,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ')

    return (
      <div className={DAY_SUB_CLASS} title={title}>
        {/* O ponto de ao vivo só pulsa quando a última leitura chegou, como na
            faixa Hoje ao vivo: com o serviço fora, o número é da leitura anterior. */}
        {live ? (
          <span
            aria-hidden="true"
            className="live-strip-dot mr-0.5 inline-block h-[7px] w-[7px] flex-none rounded-full"
            style={{ background: 'var(--schedule-ok)' }}
          />
        ) : null}
        <span>
          Agora: <strong className="font-bold text-[var(--text-heading)]">{formatNumber(day.availableNow)}</strong>{' '}
          {plural(day.availableNow, 'disponível', 'disponíveis')}
        </span>
      </div>
    )
  }

  // Com selo, as OS sem turno vão para a dica dele: os dois juntos não cabem
  // na coluna do notebook.
  if (day.lock !== null) {
    return (
      <div className={DAY_SUB_CLASS}>
        <LockSeal extra={withoutPeriod} lock={day.lock} />
      </div>
    )
  }

  return (
    <div className={DAY_SUB_CLASS}>
      {day.closed ? <strong className="font-semibold text-[var(--text-heading)]">Fechado</strong> : null}
      {day.closed && withoutPeriod !== null ? <span aria-hidden="true">·</span> : null}
      {withoutPeriod === null ? null : <span>{withoutPeriod}</span>}
    </div>
  )
}

function DayCard({
  controls,
  day,
  live,
  onSelect,
  selection,
}: {
  controls: string
  day: DayCell
  live: boolean
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
      <DayHead day={day} />
      <DaySub day={day} live={live} />
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
      {/* No dia de hoje a segunda linha é do "Agora", e o selo vai para o pé
          do card: os turnos da semana continuam alinhados, só sobra espaço
          embaixo nos vizinhos (opção 1 da prévia v12). */}
      {day.isToday && day.lock !== null ? (
        <div className={cn(DAY_SUB_CLASS, 'mt-1.5')}>
          <LockSeal extra={null} lock={day.lock} />
        </div>
      ) : null}
    </div>
  )
}

/** As semanas do calendário, uma por linha, dentro do painel executivo. */
export function ScheduleCalendar({
  controls,
  live,
  onSelect,
  selection,
  weeks,
}: {
  /** Identificador do detalhe que o clique abre, para o `aria-controls` dos turnos. */
  controls: string
  /** A última leitura chegou: o ponto de ao vivo do dia de hoje pulsa. */
  live: boolean
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
            <DayCard
              controls={controls}
              day={day}
              key={day.iso}
              live={live}
              onSelect={onSelect}
              selection={selection}
            />
          ))}
        </div>
      ))}
    </section>
  )
}
