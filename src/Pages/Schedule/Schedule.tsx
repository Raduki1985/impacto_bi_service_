import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { PageStatePanel } from '../../components/dashboard/PageStatePanel'
import { FilterGroup } from '../../components/filters/FilterGroup'
import { FilterPanel, type FilterPanelChip } from '../../components/filters/FilterPanel'
import { FilterSelectField } from '../../components/filters/FilterSelectField'
import { PageStickyHeader } from '../../components/layout/PageStickyHeader'
import { outlineChipClass } from '../../components/ui/chipStyles'
import { ChoiceChip } from '../../components/ui/ChoiceChip'
import { useReportPageSourceStatus } from '../../contexts/usePageSourceStatus'
import { isBiApiConfigured } from '../../data/api/biApiClient'
import type { OsSchedulePeriodRule, OsScheduleSource } from '../../data/api/osScheduleSource'
import { todayISO } from '../../data/defaultPeriod'
import { formatDateBr, formatIsoClock, formatNumber } from '../../lib/formatters'
import { cn } from '../../lib/utils'
import { ScheduleCalendar } from './ScheduleCalendar'
import { ScheduleAgendaDialog, type OpenAgenda } from './ScheduleAgendaDialog'
import {
  advanceBlockedReason,
  buildCalendar,
  buildRegistryLines,
  buildWeekSummary,
  DEFAULT_WEEKS,
  EXPANDED_WEEKS,
  formatHours,
  scheduleWindow,
  SHIFT_TONE_VAR,
  shortDay,
  type AgendaSelection,
  type RegistryLine,
  type SummarySegment,
  type WeekSummary,
} from './scheduleModel'
import { ScheduleRegistryDialog } from './ScheduleRegistryDialog'
import { SchedulePageSkeleton, ScheduleWeeksSkeleton, SUMMARY_GRID_CLASS } from './ScheduleSkeleton'
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
 * 1. A faixa de filtros, com os atalhos de 2 e 4 semanas (abre sempre com
 *    duas; a escolha não é guardada), as setas e o turno. Desde 22/10/2026
 *    a agenda é de hoje em diante (Mário): a seta para trás não passa da
 *    semana de hoje, e a seta para a frente anda enquanto houver OS marcada
 *    depois da primeira semana da tela (`advanceBlockedReason`). A faixa de
 *    título com a hora da leitura e a regra da capacidade saiu no mesmo dia,
 *    para a tela caber na TV; só o aviso de releitura que falhou volta, numa
 *    linha, quando acontece.
 * 2. As duas primeiras semanas na tela, um painel cada (esta e a próxima,
 *    ou as semanas à frente quando o calendário avança): as horas livres de
 *    hoje em diante em destaque, a ocupação da agenda com as marcadas e a
 *    capacidade, e os turnos nas palavras do card (com horas livres, com
 *    poucas horas livres, cheios, fechados).
 * 3. O calendário: cada dia com Manhã e Tarde, a capacidade no canto, a
 *    barra com o que está marcado e, embaixo, as horas livres em destaque
 *    (card de 20/10/2026). Sem legenda desde 19/10/2026, a pedido do Mário:
 *    cada turno já escreve o estado por extenso. A semana de hoje vem
 *    inteira, com o realizado dos dias que já passaram (Mário, 22/10/2026).
 * 4. O rodapé fechado com o cadastro de aptidões a corrigir no SGI.
 *
 * O clique num turno abre, no centro da tela, a janela da agenda daquele
 * turno, e o clique no nome do dia abre o dia inteiro (21/10/2026): as
 * categorias, o que o SGI recusa e o que ainda cabe, e a lista das OS com
 * filtro por coluna e Baixar Excel (`ScheduleAgendaDialog`). Até ali o turno
 * abria um detalhe embaixo do calendário, já aberto no primeiro turno de
 * amanhã; agora nada abre sozinho.
 *
 * Fica de fora, até a carga horária existir no SGI: a escala de 8 h, as
 * horas além da escala e o limite de 2 h extras (decisão do Mário em
 * 16/10/2026). Os limiares de 85% e 100% são provisórios (`scheduleModel.ts`).
 */
export function Schedule() {
  return <ScheduleBody />
}

export function ScheduleBody() {
  // Semanas depois da semana de hoje (0 é hoje, 1 a próxima). Mora aqui, e
  // não no conteúdo, porque decide a janela que se pede ao serviço.
  const [weekOffset, setWeekOffset] = useState(0)
  // A janela é calculada pelo relógio de quem olha; o "hoje" que marca o
  // calendário é o do serviço, que vem na resposta.
  const range = scheduleWindow(todayISO(), EXPANDED_WEEKS, weekOffset)
  const state = useOsSchedule(isBiApiConfigured, range)

  // Leitura de outras semanas não é "atualizada": o selo espera as escolhidas.
  useReportPageSourceStatus(
    !isBiApiConfigured || state.data === null || !state.current
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

  if (state.data === null && (state.status === 'loading' || state.status === 'idle')) {
    return <SchedulePageSkeleton />
  }

  if (state.data === null) {
    return (
      <PageStatePanel kind="error" title="Não foi possível carregar a agenda">
        {state.errorMessage ?? 'O serviço de BI não respondeu.'}
      </PageStatePanel>
    )
  }

  // Leitura de outra janela: a faixa de filtros fica, as semanas esperam.
  const failed = state.status === 'error' ? state.errorMessage : null

  return (
    <ScheduleContent
      onWeekOffsetChange={setWeekOffset}
      source={state.data}
      staleMessage={state.current ? failed : null}
      weekOffset={weekOffset}
      weeksError={state.current ? null : failed}
      weeksLoading={!state.current && state.status === 'loading'}
    />
  )
}

/** A ação de texto do portal, com o respiro da ação de faixa da Visão Geral de OS (Baixar OS em Excel). */
const TEXT_ACTION_CLASS =
  'impacto-text-action cursor-pointer rounded-md px-2 py-0.5 text-[12.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

/**
 * O corpo da página sobre uma leitura do serviço. Exportado para o teste de
 * fumaça desenhar a página com uma agenda sintética.
 */
export function ScheduleContent({
  initialWeeks = DEFAULT_WEEKS,
  onWeekOffsetChange = () => undefined,
  source,
  staleMessage = null,
  weekOffset = 0,
  weeksError = null,
  weeksLoading = false,
}: {
  /** Quantas semanas abrir; o teste usa para provar as quatro. */
  initialWeeks?: number
  onWeekOffsetChange?: (weekOffset: number) => void
  source: OsScheduleSource
  /** A última releitura falhou: os números são da leitura anterior. */
  staleMessage?: string | null
  /** Semanas depois da semana de hoje em que o calendário começa (0 é hoje). */
  weekOffset?: number
  /** A leitura das semanas escolhidas falhou: `source` é de outras semanas. */
  weeksError?: string | null
  /** As semanas escolhidas ainda não chegaram: `source` é de outras semanas. */
  weeksLoading?: boolean
}) {
  const [weeks, setWeeks] = useState(initialWeeks)
  const [periodFilter, setPeriodFilter] = useState<string | null>(null)
  // A janela da agenda aberta, com a leitura do calendário de quando abriu:
  // a releitura de 5 minutos não mexe na janela que alguém está lendo.
  const [agenda, setAgenda] = useState<OpenAgenda | null>(null)
  const [registryOpen, setRegistryOpen] = useState(false)

  const calendar = buildCalendar(source, weeks, periodFilter, weekOffset)
  const summaries = calendar.slice(0, 2).map((week) => buildWeekSummary(week))
  // "Hoje" já aceso não pede outra leitura.
  const changeWeekOffset = (next: number) => {
    if (next !== weekOffset) onWeekOffsetChange(next)
  }
  const registryLines = buildRegistryLines(source)
  const readAt = formatIsoClock(source.generatedAt)
  const lastDay = calendar[calendar.length - 1].end
  // Enquanto as semanas novas não chegam (ou se a leitura delas falhou), a
  // leitura em mãos é de outras: a seta espera, em vez de responder pelo
  // que não é desta janela.
  const advanceReason = weeksLoading
    ? 'Carregando as semanas escolhidas'
    : weeksError !== null
      ? 'Não foi possível carregar estas semanas'
      : advanceBlockedReason(source, calendar[0].end)

  const openAgenda = (selection: AgendaSelection) => setAgenda({ selection, source })

  return (
    <>
      <PageStickyHeader className="mb-3.5">
        <ScheduleFilterPanel
          advanceReason={advanceReason}
          onPeriodChange={setPeriodFilter}
          onWeekOffsetChange={changeWeekOffset}
          onWeeksChange={setWeeks}
          periodFilter={periodFilter}
          periods={source.parameters.periods}
          rangeLabel={`${shortDay(calendar[0].start)} a ${shortDay(lastDay)}`}
          weekOffset={weekOffset}
          weeks={weeks}
        />
      </PageStickyHeader>
      <div className="os-schedule">
        {/* A faixa de título saiu em 22/10/2026; o aviso de releitura que
            falhou morava nela e não pode sumir junto: a página continua
            mostrando a leitura anterior, e quem olha precisa saber. */}
        {staleMessage === null ? null : (
          <p className="mb-2.5 px-0.5 text-[12.5px] text-[var(--text-secondary)]" role="status">
            O serviço não respondeu na última tentativa: os números são da leitura
            {readAt === null ? ' anterior' : ` das ${readAt}`}.
          </p>
        )}
        {weeksError !== null ? (
          <PageStatePanel kind="error" title="Não foi possível carregar estas semanas">
            {weeksError}
          </PageStatePanel>
        ) : weeksLoading ? (
          <ScheduleWeeksSkeleton weeks={weeks} />
        ) : (
          <>
            <div className={`${SUMMARY_GRID_CLASS} mb-3.5`}>
              {summaries.map((summary) => (
                <WeekSummaryPanel key={summary.title} summary={summary} />
              ))}
            </div>
            <ScheduleCalendar live={staleMessage === null} onOpen={openAgenda} weeks={calendar} />
          </>
        )}
        <RegistryFooter lines={registryLines} onOpen={() => setRegistryOpen(true)} />
        <ScheduleRegistryDialog
          historyDays={source.historyDays}
          onOpenChange={setRegistryOpen}
          open={registryOpen}
          readAt={readAt}
          rows={registryLines}
          today={source.today}
        />
        <ScheduleAgendaDialog
          agenda={agenda}
          onClose={() => setAgenda(null)}
          onSelect={(selection) => setAgenda((current) => (current === null ? null : { ...current, selection }))}
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
 * semanas"; abre sempre em 2 e a escolha não é guardada), as setas (desde
 * 22/10/2026 de hoje em diante: para trás até a semana de hoje, para a
 * frente enquanto houver OS marcada depois da primeira semana da tela) e
 * o turno. Equipe e tipo de serviço ficam de fora até o serviço mandar a capacidade separada
 * por eles: filtrar só as horas marcadas, contra a capacidade de todos,
 * mostraria um turno vazio que não está.
 */
function ScheduleFilterPanel({
  advanceReason,
  onPeriodChange,
  onWeekOffsetChange,
  onWeeksChange,
  periodFilter,
  periods,
  rangeLabel,
  weekOffset,
  weeks,
}: {
  /** Por que a seta para a frente está apagada; nulo quando ela anda (`advanceBlockedReason`). */
  advanceReason: string | null
  onPeriodChange: (value: string | null) => void
  onWeekOffsetChange: (weekOffset: number) => void
  onWeeksChange: (weeks: number) => void
  periodFilter: string | null
  periods: readonly OsSchedulePeriodRule[]
  /** As semanas na tela, `02/11 a 15/11`, para o chip de quando o calendário avançou. */
  rangeLabel: string
  weekOffset: number
  weeks: number
}) {
  const active = periods.find((period) => period.key === periodFilter)
  const chips: FilterPanelChip[] = [
    ...(weekOffset === 0
      ? []
      : [{ key: 'weeks', label: 'Semanas', value: rangeLabel, onRemove: () => onWeekOffsetChange(0) }]),
    ...(active === undefined
      ? []
      : [{ key: 'period', label: 'Turno', value: active.label, onRemove: () => onPeriodChange(null) }]),
  ]
  const clear = () => {
    onPeriodChange(null)
    if (weekOffset !== 0) onWeekOffsetChange(0)
  }

  return (
    <FilterPanel
      chips={chips}
      onClear={chips.length === 0 ? undefined : clear}
      shortcuts={
        <>
          <div aria-label="Horizonte" className="flex items-center gap-1.5" role="group">
            {[DEFAULT_WEEKS, EXPANDED_WEEKS].map((option) => (
              <ChoiceChip key={option} onClick={() => onWeeksChange(option)} pressed={weeks === option}>
                {option} semanas
              </ChoiceChip>
            ))}
          </div>
          {/* Esticadas: as setas têm ícone e não texto, e ficariam mais baixas que "Hoje". */}
          <div aria-label="Semanas" className="flex items-stretch gap-1.5" role="group">
            <WeekStepButton
              disabled={weekOffset <= 0}
              disabledReason="A agenda começa hoje"
              label="Semana anterior"
              onClick={() => onWeekOffsetChange(weekOffset - 1)}
            >
              <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
            </WeekStepButton>
            <ChoiceChip onClick={() => onWeekOffsetChange(0)} pressed={weekOffset === 0}>
              Hoje
            </ChoiceChip>
            <WeekStepButton
              disabled={advanceReason !== null}
              disabledReason={advanceReason ?? ''}
              label="Semana seguinte"
              onClick={() => onWeekOffsetChange(weekOffset + 1)}
            >
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            </WeekStepButton>
          </div>
        </>
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

/**
 * A seta de uma semana para trás ou para a frente: a pílula apagada do
 * `ChoiceChip`, mas um botão comum, porque andar uma semana é uma ação e não
 * uma escolha que fica acesa. No limite fica apagada, com o motivo na dica.
 */
function WeekStepButton({
  children,
  disabled,
  disabledReason,
  label,
  onClick,
}: {
  children: ReactNode
  disabled: boolean
  disabledReason: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        outlineChipClass,
        'flex cursor-pointer items-center px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        disabled && 'opacity-50',
      )}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? disabledReason : label}
      type="button"
    >
      {children}
    </button>
  )
}

/** Os pedaços de uma linha do resumo, com os números em destaque. */
function SummaryLine({ className, segments }: { className: string; segments: readonly SummarySegment[] }) {
  return (
    <p className={className}>
      {segments.map((segment, index) =>
        segment.emphasis ? (
          <strong className="font-mono font-semibold" key={index}>
            {segment.text}
          </strong>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  )
}

/**
 * Um quadrinho do resumo (Mário, 22/10/2026): o nome no canto de cima, à
 * esquerda, e o número no canto de baixo, à direita, com o mesmo recuo nos
 * quatro quadrinhos (10 px dos lados, 6 px em cima e embaixo). Sem altura
 * fixa: o quadrinho tem a altura de sempre e só cresce quando o nome quebra
 * em duas linhas ("Capacidade / restante" no notebook); o vizinho estica
 * junto, e o número desce para o canto.
 */
function SummaryFigure({ label, title, value }: { label: string; title: string; value: string }) {
  return (
    <div
      className="flex flex-col justify-between gap-0.5 rounded-lg bg-[color:color-mix(in_srgb,var(--text-secondary)_8%,var(--surface))] px-2.5 py-1.5"
      title={title}
    >
      <span className="block text-[12px] leading-4 text-[var(--text-secondary)] 2xl:text-[13px]">{label}</span>
      <strong className="block text-right text-[15px] font-bold leading-5 tabular-nums text-[var(--text-heading)]">
        {value}
      </strong>
    </div>
  )
}

/**
 * Um painel de semana (22/10/2026, a partir da prévia do Mário): à
 * esquerda, as horas livres em destaque, no verde das horas livres do card;
 * à direita, a ocupação da agenda com a barra na cor do estado e os
 * quadrinhos de marcadas e capacidade; embaixo, os turnos nas palavras do
 * card e as notas. A ocupação por dia da prévia ficou de fora: o calendário
 * logo abaixo já a mostra, turno a turno. Os dias no canto e o realizado
 * até ontem saíram na tarde de 22/10/2026, com a página só de hoje em diante.
 */
function WeekSummaryPanel({ summary }: { summary: WeekSummary }) {
  const { headline, occupation } = summary

  return (
    <section
      aria-label={summary.title}
      className="executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
    >
      <h2 className="text-[12px] font-bold uppercase tracking-[0.4px] text-[var(--text-heading)]">{summary.name}</h2>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="min-w-0">
          {headline === null ? null : (
            <>
              <span className="block text-[13px] text-[var(--text-secondary)]">{headline.label}</span>
              <strong
                className="mt-0.5 block text-[26px] font-bold leading-8 tabular-nums"
                style={{
                  color: headline.free && headline.value !== formatHours(0) ? 'var(--schedule-ok)' : 'var(--text-heading)',
                }}
              >
                {headline.value}
              </strong>
            </>
          )}
        </div>
        {occupation === null ? null : (
          <div className="min-w-0 sm:border-l sm:border-[var(--divider)] sm:pl-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-[var(--text-secondary)]">Ocupação da agenda</span>
              <strong className="text-[18px] font-bold tabular-nums text-[var(--text-heading)]">
                {formatNumber(occupation.percent)}%
              </strong>
            </div>
            <span
              aria-hidden="true"
              className="mt-1 block h-2 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--text-secondary)_16%,var(--surface))]"
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${occupation.fill}%`, background: SHIFT_TONE_VAR[occupation.tone] }}
              />
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SummaryFigure
                label="Marcadas"
                title="Horas marcadas nos turnos que ainda aceitam agendamento, de hoje em diante"
                value={occupation.scheduled}
              />
              <SummaryFigure
                label={occupation.capacityLabel}
                title="Capacidade dos turnos que ainda aceitam agendamento, de hoje em diante, pela conta do SGI"
                value={occupation.capacity}
              />
            </div>
          </div>
        )}
      </div>
      {summary.states.length === 0 ? null : (
        <SummaryLine className="mt-2.5 text-[13.5px] text-[var(--text-heading)]" segments={summary.states} />
      )}
      {summary.notes.length === 0 ? null : (
        <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{summary.notes.join(' · ')}</p>
      )}
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
    <div className="mt-3.5 flex flex-wrap items-center gap-x-1.5 px-0.5 text-[12.5px] text-[var(--text-secondary)]">
      {lines.length === 0 ? (
        <span className="font-semibold">Cadastro de aptidões: nenhuma categoria a corrigir no SGI</span>
      ) : (
        <button aria-haspopup="dialog" className={TEXT_ACTION_CLASS} onClick={onOpen} type="button">
          Cadastro de aptidões a corrigir no SGI: {formatNumber(categories)}{' '}
          {categories === 1 ? 'categoria' : 'categorias'} e {formatNumber(technicians)}{' '}
          {technicians === 1 ? 'técnico' : 'técnicos'}
        </button>
      )}
      <span>· quem executa sem estar cadastrado como apto; filtre pela equipe para o gestor dela</span>
    </div>
  )
}
