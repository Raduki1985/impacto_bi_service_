import { useState } from 'react'

import { PageStatePanel } from '../../components/dashboard/PageStatePanel'
import { SectionHeading } from '../../components/dashboard/SectionHeading'
import { FilterGroup } from '../../components/filters/FilterGroup'
import { FilterPanel, type FilterPanelChip } from '../../components/filters/FilterPanel'
import { FilterSelectField } from '../../components/filters/FilterSelectField'
import { PageStickyHeader } from '../../components/layout/PageStickyHeader'
import { ChoiceChip } from '../../components/ui/ChoiceChip'
import { useReportPageSourceStatus } from '../../contexts/usePageSourceStatus'
import { isBiApiConfigured } from '../../data/api/biApiClient'
import type { OsSchedulePeriodRule, OsScheduleSource } from '../../data/api/osScheduleSource'
import { todayISO } from '../../data/defaultPeriod'
import { formatDateBr, formatIsoClock, formatNumber } from '../../lib/formatters'
import { ScheduleCalendar } from './ScheduleCalendar'
import {
  buildCalendar,
  buildRegistryLines,
  buildShiftDetail,
  buildWeekSummary,
  DEFAULT_WEEKS,
  defaultSelection,
  EXPANDED_WEEKS,
  formatHours,
  scheduleWindow,
  shortDay,
  type RegistryLine,
  type ShiftSelection,
  type WeekSummary,
} from './scheduleModel'
import { ScheduleRegistryDialog } from './ScheduleRegistryDialog'
import { ScheduleShiftDetail } from './ScheduleShiftDetail'
import { SchedulePageSkeleton, SUMMARY_GRID_CLASS } from './ScheduleSkeleton'
import { useOsSchedule } from './useOsSchedule'

/**
 * Agenda e capacidade de OS: o que está marcado nas próximas semanas e
 * quanto ainda cabe em cada turno, para quem agenda não marcar além da
 * capacidade.
 *
 * Nasceu do pedido da Tatiane (09 e 13/10/2026) e do estudo de 14/10/2026,
 * que mostrou que o SGI já tem uma conta de capacidade, a que decide "sem
 * data disponível" na hora de agendar, e que ela erra em duas entradas:
 * conta os 42 técnicos do cadastro quando trabalham 26 a 31, e o cadastro
 * de quem sabe fazer o quê está incompleto. As contas vivem no serviço; aqui
 * é só desenho.
 *
 * Redesenhada em 19/10/2026 como CALENDÁRIO, por decisão do Mário sobre a
 * primeira versão (cards, gráfico de barras e tabela grande, que saíram). De
 * cima para baixo:
 *
 * 1. A faixa de título, com a janela lida, a hora da leitura, a regra da
 *    capacidade e a ação "Ver 4 semanas" (abre sempre com duas; a escolha
 *    não é guardada).
 * 2. Esta semana e a próxima em uma frase cada: o realizado, o marcado e
 *    quantos turnos estão com folga, quase cheios ou cheios.
 * 3. O calendário: cada dia com Manhã e Tarde, as horas marcadas em número
 *    grande, a barra de preenchimento e a pílula com a resposta em horas.
 *    Sem legenda desde 19/10/2026, a pedido do Mário: cada pílula já
 *    escreve o estado por extenso.
 * 4. O detalhe do turno clicado: o que o SGI recusa e o que ainda cabe, por
 *    categoria. Abre no primeiro turno de amanhã.
 * 5. O rodapé fechado com o cadastro de aptidões a corrigir no SGI.
 *
 * Fica de fora, até a carga horária existir no SGI: a escala de 8 h, as
 * horas além da escala e o limite de 2 h extras (decisão do Mário em
 * 16/10/2026). Os limiares de 85% e 100% são provisórios (`scheduleModel.ts`).
 */
export function Schedule() {
  return <ScheduleBody />
}

export function ScheduleBody() {
  // A janela é calculada pelo relógio de quem olha; o "hoje" que marca o
  // calendário é o do serviço, que vem na resposta.
  const range = scheduleWindow(todayISO())
  const state = useOsSchedule(isBiApiConfigured, range)

  useReportPageSourceStatus(
    !isBiApiConfigured || state.data === null
      ? state.status === 'loading'
        ? 'loading'
        : 'unavailable'
      : 'ready',
    state.data === null ? null : formatDateBr(state.data.generatedAt.slice(0, 10)),
  )

  // Sem serviço não existe agenda nenhuma para mostrar: esta página não tem
  // base local de estudo, porque capacidade de amanhã não se simula.
  if (!isBiApiConfigured) {
    return (
      <PageStatePanel kind="error" title="A Agenda e capacidade lê o serviço de BI">
        Sem o endereço do serviço configurado neste ambiente, a página não tem agenda para mostrar.
      </PageStatePanel>
    )
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return <SchedulePageSkeleton />
  }

  if (state.data === null) {
    return (
      <PageStatePanel kind="error" title="Não foi possível carregar a agenda">
        {state.errorMessage ?? 'O serviço de BI não respondeu.'}
      </PageStatePanel>
    )
  }

  return <ScheduleContent source={state.data} staleMessage={state.status === 'error' ? state.errorMessage : null} />
}

/** Destino do clique num turno e do rodapé, para o `aria-controls`. */
const DETAIL_ID = 'os-schedule-shift-detail'

/** A ação de texto do portal, com o respiro da ação de faixa da Visão Geral de OS (Baixar OS em Excel). */
const TEXT_ACTION_CLASS =
  'impacto-text-action cursor-pointer rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

/**
 * O corpo da página sobre uma leitura do serviço. Exportado para o teste de
 * fumaça desenhar a página com uma agenda sintética.
 */
export function ScheduleContent({
  initialWeeks = DEFAULT_WEEKS,
  source,
  staleMessage = null,
}: {
  /** Quantas semanas abrir; o teste usa para provar as quatro. */
  initialWeeks?: number
  source: OsScheduleSource
  /** A última releitura falhou: os números são da leitura anterior. */
  staleMessage?: string | null
}) {
  const [weeks, setWeeks] = useState(initialWeeks)
  const [periodFilter, setPeriodFilter] = useState<string | null>(null)
  const [selection, setSelection] = useState<ShiftSelection | null>(() => defaultSelection(source))
  const [registryOpen, setRegistryOpen] = useState(false)

  const calendar = buildCalendar(source, weeks, periodFilter)
  const summaries = calendar.slice(0, 2).map((week) => buildWeekSummary(week))
  // O turno aberto que o filtro escondeu não mostra detalhe: a escolha
  // volta a valer quando o filtro sai.
  const detail =
    selection === null || periodFilter === null || selection.periodKey === periodFilter
      ? buildShiftDetail(source, selection)
      : null
  const registryLines = buildRegistryLines(source)
  const readAt = formatIsoClock(source.generatedAt)
  const description = [
    `${shortDay(calendar[0].start)} a ${shortDay(calendar[calendar.length - 1].end)}`,
    readAt === null ? 'agenda do SGI' : `agenda do SGI lida às ${readAt}`,
    staleMessage === null ? null : 'o serviço não respondeu na última tentativa, os números são desta leitura',
    `capacidade pela conta com os técnicos presentes, ${formatHours(source.parameters.hoursPerTechnicianPeriod)} por técnico por turno`,
    'clique num turno para ver as categorias',
  ]
    .filter((parte): parte is string => parte !== null)
    .join(' · ')

  // O mesmo turno clicado de novo fecha o detalhe, como a caixa do Hoje ao vivo.
  const toggleSelection = (next: ShiftSelection) =>
    setSelection((current) =>
      current !== null && current.iso === next.iso && current.periodKey === next.periodKey ? null : next,
    )

  return (
    <>
      <PageStickyHeader className="mb-3.5">
        <ScheduleFilterPanel
          onPeriodChange={setPeriodFilter}
          onWeeksChange={setWeeks}
          periodFilter={periodFilter}
          periods={source.parameters.periods}
          weeks={weeks}
        />
      </PageStickyHeader>
      <div className="os-schedule">
        <SectionHeading description={description} title="Agenda por turno" />
        <div className={`${SUMMARY_GRID_CLASS} mb-3.5`}>
          {summaries.map((summary) => (
            <WeekSummaryPanel key={summary.title} summary={summary} />
          ))}
        </div>
        <ScheduleCalendar controls={DETAIL_ID} onSelect={toggleSelection} selection={selection} weeks={calendar} />
        {detail === null ? null : <ScheduleShiftDetail detail={detail} id={DETAIL_ID} />}
        <RegistryFooter lines={registryLines} onOpen={() => setRegistryOpen(true)} />
        <ScheduleRegistryDialog
          historyDays={source.historyDays}
          onOpenChange={setRegistryOpen}
          open={registryOpen}
          readAt={readAt}
          rows={registryLines}
          today={source.today}
        />
      </div>
    </>
  )
}

const ALL_PERIODS = ''

/**
 * A faixa de filtros, a mesma da Visão Geral de OS (`FilterPanel` dentro do
 * `PageStickyHeader`). Só entra o que a leitura do serviço sabe responder
 * hoje: o horizonte (atalhos de 2 e 4 semanas, no lugar do antigo "Ver 4
 * semanas"; abre sempre em 2 e a escolha não é guardada) e o turno. Equipe e
 * tipo de serviço ficam de fora até o serviço mandar a capacidade separada
 * por eles: filtrar só as horas marcadas, contra a capacidade de todos,
 * mostraria um turno vazio que não está.
 */
function ScheduleFilterPanel({
  onPeriodChange,
  onWeeksChange,
  periodFilter,
  periods,
  weeks,
}: {
  onPeriodChange: (value: string | null) => void
  onWeeksChange: (weeks: number) => void
  periodFilter: string | null
  periods: readonly OsSchedulePeriodRule[]
  weeks: number
}) {
  const active = periods.find((period) => period.key === periodFilter)
  const chips: FilterPanelChip[] =
    active === undefined
      ? []
      : [{ key: 'period', label: 'Turno', value: active.label, onRemove: () => onPeriodChange(null) }]

  return (
    <FilterPanel
      chips={chips}
      onClear={active === undefined ? undefined : () => onPeriodChange(null)}
      shortcuts={
        <div aria-label="Horizonte" className="flex items-center gap-1.5" role="group">
          {[DEFAULT_WEEKS, EXPANDED_WEEKS].map((option) => (
            <ChoiceChip key={option} onClick={() => onWeeksChange(option)} pressed={weeks === option}>
              {option} semanas
            </ChoiceChip>
          ))}
        </div>
      }
      title="Filtros da agenda"
    >
      <FilterGroup columnsClass="sm:grid-cols-2 lg:grid-cols-4" legend="Agenda">
        <FilterSelectField
          label="Turno"
          onChange={(value) => onPeriodChange(value === ALL_PERIODS ? null : value)}
          options={[
            { value: ALL_PERIODS, label: 'Todos' },
            ...periods.map((period) => ({ value: period.key, label: period.label })),
          ]}
          value={periodFilter ?? ALL_PERIODS}
        />
      </FilterGroup>
    </FilterPanel>
  )
}

/** Uma semana em uma frase, com os números em destaque. */
function WeekSummaryPanel({ summary }: { summary: WeekSummary }) {
  return (
    <section
      aria-label={summary.title}
      className="executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
    >
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">{summary.title}</h3>
      <p className="mt-0.5 text-[13px] text-[var(--text-heading)]">
        {summary.segments.map((segment, index) =>
          segment.emphasis ? (
            <strong className="font-mono font-semibold" key={index}>
              {segment.text}
            </strong>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
    </section>
  )
}

/**
 * O rodapé fechado: quantas categorias e técnicos têm o cadastro de aptidões
 * a corrigir no SGI. O clique abre a janela de lista do portal, uma linha
 * por técnico e categoria, com filtro por equipe e Excel, porque quem corrige
 * o cadastro são os gestores de cada equipe (Mário, 19/10/2026).
 */
function RegistryFooter({ lines, onOpen }: { lines: readonly RegistryLine[]; onOpen: () => void }) {
  const categories = new Set(lines.map((line) => line.category)).size
  const technicians = new Set(lines.map((line) => line.technician)).size

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-x-1.5 px-0.5 text-[11.5px] text-[var(--text-secondary)]">
      {lines.length === 0 ? (
        <span className="font-semibold">Cadastro de aptidões: nenhuma categoria a corrigir no SGI</span>
      ) : (
        <button className={TEXT_ACTION_CLASS} onClick={onOpen} type="button">
          Cadastro de aptidões a corrigir no SGI: {formatNumber(categories)}{' '}
          {categories === 1 ? 'categoria' : 'categorias'} e {formatNumber(technicians)}{' '}
          {technicians === 1 ? 'técnico' : 'técnicos'}
        </button>
      )}
      <span>· quem executa sem estar cadastrado como apto; filtre pela equipe para o gestor dela</span>
    </div>
  )
}
