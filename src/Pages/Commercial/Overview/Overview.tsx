import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  BadgeDollarSign,
  CircleCheckBig,
  Clock3,
  Lightbulb,
  MapPin,
  Medal,
  Share2,
  Target,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../../components/charts/Chart'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { usePreferences } from '../../../contexts/usePreferences'
import type { CommercialCityId, CommercialDataset } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import type { SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import { OverviewFilters } from './OverviewFilters'
import {
  buildTeamDetail,
  initialMonthlyLegendSelection,
  makeOverviewMonthlyOptions,
  makeOverviewTeamOptions,
} from './overviewChartOptions'
import { OverviewGauge, OverviewGaugeFooter } from './OverviewGauge'
import { buildOverviewGaugeModel, type OverviewGaugeModel } from './overviewGaugeModel'
import {
  buildCommercialOverviewSnapshot,
  initialCommercialOverviewFilters,
  type CommercialOverviewFilters,
  type CommercialOverviewSnapshot,
  type OverviewBreakdown,
} from './overviewModel'

const panelClass =
  'min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4'
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Amarelo da leitura gerencial, igual em todos os cinco cards.
 *
 * É o mesmo `#ffb020` já registrado no portal como `--kpi-warn`. A lâmpada
 * sinaliza que existe leitura gerencial, então nunca herda o tom do indicador.
 */
const READING_LAMP = '#ffb020'

/**
 * Paleta da leitura gerencial, invertida por tema.
 *
 * No tema claro a leitura continua escura, como aprovado. No tema escuro ela
 * passa a usar uma superfície cinza-azulada clara, e todos os textos mudam
 * junto: nada de texto branco sobre fundo claro. O verde e o amarelo também
 * escurecem no tema escuro para manterem contraste sobre a superfície clara,
 * continuando reconhecíveis como verde Impacto e amarelo da lâmpada.
 */
const readingTheme = {
  light: {
    surface: 'linear-gradient(155deg,#0c2038,#081524)',
    lamp: '#ffb020',
    eyebrow: '#00a862',
    title: '#ffffff',
    body: '#b9c8dc',
    highlight: '#8ab4ff',
    divider: 'rgba(255,255,255,0.10)',
    observeLabel: '#54d98c',
    observeText: '#cad5e4',
  },
  dark: {
    surface: 'linear-gradient(155deg,#eef4f8,#dfe9f1)',
    lamp: '#c97f00',
    eyebrow: '#00774a',
    title: '#0f2942',
    body: '#3d5670',
    highlight: '#1a4fae',
    divider: 'rgba(15,41,66,0.16)',
    observeLabel: '#0a7047',
    observeText: '#3d5670',
  },
} as const

/** Destaque de item selecionado pelo filtro superior: borda, fundo e rótulo. */
const selectedRowClass = 'border-[var(--accent)] bg-[var(--accent-weak)]'

type CardTone = 'green' | 'blue' | 'indigo' | 'violet' | 'amber'

const cardColors: Record<CardTone, string> = {
  green: '#00a862',
  blue: '#2f7de1',
  indigo: '#4263eb',
  violet: '#8b5cf6',
  amber: '#d97706',
}

/**
 * Label discreto do item destacado pelo filtro superior.
 *
 * O visual mostra apenas `FILTRO`, sem preenchimento sólido. O texto acessível
 * completo continua no `sr-only`, junto do `aria-current` da linha.
 */
function FilterTag({ description }: { description: string }) {
  return (
    <>
      <span aria-hidden="true" className="overview-filter-tag">
        Selecionado
      </span>
      <span className="sr-only">{description}</span>
    </>
  )
}

export function Overview() {
  const { theme } = usePreferences()
  const [dataset, setDataset] = useState<CommercialDataset | null>(() => peekCommercialDataset())
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CommercialOverviewFilters>(
    initialCommercialOverviewFilters,
  )

  useEffect(() => {
    if (dataset !== null || error !== null) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      try {
        const built = getCommercialDataset()
        if (!cancelled) setDataset(built)
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Falha desconhecida ao montar a base comercial mockada.',
          )
        }
      }
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [dataset, error])

  const snapshot = useMemo(
    () =>
      dataset === null ? null : buildCommercialOverviewSnapshot(dataset, filters),
    [dataset, filters],
  )

  if (error !== null) return <StatePanel title="Não foi possível montar a Visão Geral">{error}</StatePanel>
  if (dataset === null || snapshot === null) {
    return <StatePanel title="Montando a Visão Geral">Preparando os indicadores executivos.</StatePanel>
  }

  const monthlyRangeLabel = describeMonthlyRange(snapshot.monthly)

  return (
    // `commercial-overview` escopa as superfícies mais claras do tema escuro e
    // os campos de data desta página, sem tocar nos tokens globais do portal.
    <div className="commercial-overview flex flex-col gap-4">
      <OverviewFilters cities={dataset.cities} filters={filters} onChange={setFilters} />

      <ExecutiveCards snapshot={snapshot} team={filters.team} theme={theme} />

      <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <CitiesPanel rows={snapshot.topCities} selectedCityId={filters.cityId} />
        <TeamPanel
          rows={snapshot.teams}
          selectedTeam={filters.team}
          theme={theme}
          total={snapshot.teamComparisonTotal}
        />
        <OriginsPanel rows={snapshot.origins} />
      </div>

      {/* O painel do gráfico ocupa metade da linha; cada ranking fica com um
          quarto. Abaixo de xl os três voltam a empilhar, sem rolagem lateral. */}
      <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[2fr_1fr_1fr]">
        {/* A chave remonta o painel quando o filtro global de time muda, o que
            devolve a legenda ao estado inicial. Sem isso o usuário poderia
            filtrar Comercial com a série Comercial desligada na legenda. */}
        <MonthlyPanel
          key={filters.team}
          monthly={snapshot.monthly}
          team={filters.team}
          theme={theme}
        />
        <SellerRanking snapshot={snapshot} theme={theme} />
        <PlansRanking snapshot={snapshot} />
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        Visão executiva com dados sintéticos. O recorte dos indicadores e rankings é{' '}
        {snapshot.periodLabel}; o histórico mensal mostra {monthlyRangeLabel} com cidade e time
        aplicados. Vendas por cidade, Vendas por time e Origem das vendas são comparativos: cada
        um ignora o filtro da própria dimensão e apenas destaca a seleção. Nenhum valor foi
        extraído do SGI.
      </p>
    </div>
  )
}

function ExecutiveCards({
  snapshot,
  team,
  theme,
}: {
  snapshot: CommercialOverviewSnapshot
  team: SalesPeriodTeamFilter
  theme: Theme
}) {
  // Um único identificador controla a coleção inteira: abrir um card fecha
  // automaticamente o anterior e nunca existem duas leituras abertas.
  const [openCard, setOpenCard] = useState<string | null>(null)
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (openCard === null) return
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node) !== true) {
        setOpenCard(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openCard])

  const { metrics } = snapshot
  // O filtro exclusivo do Corporativo chega explícito à coleção: é ele que
  // distingue "não se aplica" de uma meta simplesmente ausente no recorte.
  const corporateOnly = team === 'corporativo'
  const activeDelta = changeText(metrics.activeSalesChangeRate)
  const valueDelta = changeText(snapshot.monthlyValueChangeRate)
  // Os dois velocímetros são a única fonte de meta efetiva, percentual e
  // distância. A leitura gerencial abaixo lê deles, e não das métricas brutas,
  // para nunca divergir do que o card mostra.
  const goalGauge = buildOverviewGaugeModel({
    indicator: 'Meta Comercial',
    targetTerm: 'Meta',
    achieved: metrics.goalAchieved,
    target: metrics.goal,
    previousAchieved: snapshot.previousGoalAchieved,
    corporateOnly,
  })
  const superGoalGauge = buildOverviewGaugeModel({
    indicator: 'Supermeta Total',
    targetTerm: 'Supermeta',
    achieved: metrics.superGoalAchieved,
    target: metrics.superGoal,
    previousAchieved: snapshot.previousSuperGoalAchieved,
    corporateOnly,
  })
  const cards: ExecutiveCardProps[] = [
    {
      visual: 'spark',
      icon: CircleCheckBig,
      label: 'Vendas ativadas',
      value: formatNumber(metrics.activeSales),
      delta: activeDelta.label,
      deltaTone: activeDelta.tone,
      tone: 'green',
      points: snapshot.sparklines.activeSales,
      readingTitle: `${formatNumber(metrics.activeSales)} vendas foram ativadas no recorte.`,
      readingText: `${activeDelta.reading} A taxa de ativação foi de {${formatPercent(metrics.activationRate ?? 0)}}.`,
      observe: 'Evolução do volume e conversão dos contratos em ativação.',
    },
    {
      visual: 'spark',
      icon: BadgeDollarSign,
      label: 'Valor mensal ativado',
      value: currency.format(metrics.monthlyRevenue),
      delta: valueDelta.label,
      deltaTone: valueDelta.tone,
      tone: 'blue',
      points: snapshot.sparklines.monthlyValue,
      readingTitle: `${currency.format(metrics.monthlyRevenue)} em valor mensal ativado.`,
      readingText: `${valueDelta.reading} O ticket médio ficou em {${currency.format(metrics.averageTicket)}}.`,
      observe: 'Crescimento do valor recorrente e comportamento do ticket médio.',
    },
    {
      visual: 'gauge',
      icon: Target,
      label: 'Meta Comercial',
      value: goalGauge.percentLabel,
      gauge: goalGauge,
      tone: 'indigo',
      readingTitle: corporateOnly
        ? 'O time Corporativo não possui meta própria de volume.'
        : goalGauge.effectiveTarget === null
          ? 'O recorte não possui Meta Comercial definida.'
          : `${formatNumber(goalGauge.achieved)} de ${formatNumber(goalGauge.effectiveTarget)} vendas da Meta Comercial.`,
      readingText: corporateOnly
        ? 'Por isso, o atingimento da Meta Comercial não se aplica a este recorte.'
        : gaugeReadingText(goalGauge, {
            noGoal:
              'Sem uma meta válida para o recorte, nenhum percentual de atingimento é exibido.',
            exact: 'A Meta Comercial foi atingida exatamente.',
            above: (value) => `A Meta Comercial foi superada em {${value}}.`,
            below: (value) => `Ainda faltam {${value}} do Comercial para atingir a Meta.`,
          }),
      observe: corporateOnly
        ? 'A Meta Comercial considera somente as vendas do Comercial.'
        : 'O realizado considera o Comercial; o Corporativo não compõe este numerador.',
    },
    {
      visual: 'gauge',
      icon: Trophy,
      label: 'Supermeta Total',
      value: superGoalGauge.percentLabel,
      gauge: superGoalGauge,
      tone: 'violet',
      readingTitle: corporateOnly
        ? 'A Supermeta Total é consolidada.'
        : superGoalGauge.effectiveTarget === null
          ? 'O recorte não possui Supermeta definida.'
          : `${formatNumber(superGoalGauge.achieved)} de ${formatNumber(superGoalGauge.effectiveTarget)} vendas da Supermeta.`,
      readingText: corporateOnly
        ? 'Ela não se aplica ao recorte exclusivo do Corporativo, porque considera Comercial e Corporativo em conjunto.'
        : gaugeReadingText(superGoalGauge, {
            noGoal: 'Nenhum percentual é exibido sem uma meta válida para o recorte.',
            exact: 'A Supermeta Total foi atingida exatamente.',
            above: (value) => `A Supermeta Total foi superada em {${value}}.`,
            below: (value) => `Ainda faltam {${value}} no realizado total.`,
          }),
      observe: corporateOnly
        ? 'Consulte Todos os times para acompanhar o atingimento da Supermeta Total.'
        : 'O realizado total reúne Comercial e Corporativo.',
    },
    {
      visual: 'spark',
      icon: Clock3,
      label: 'Em andamento',
      value: formatNumber(metrics.pipelineSales),
      delta: `${formatPercent(metrics.totalContracts === 0 ? 0 : metrics.pipelineSales / metrics.totalContracts)} dos contratos`,
      deltaTone: 'neutral',
      tone: 'amber',
      points: snapshot.sparklines.pipeline,
      readingTitle: `${formatNumber(metrics.pipelineSales)} contratos ainda podem avançar.`,
      readingText: `Eles representam {${formatPercent(metrics.totalContracts === 0 ? 0 : metrics.pipelineSales / metrics.totalContracts)}} dos contratos do recorte.`,
      observe: 'Conversão de pendentes, assinados, agendados e aguardando aprovação.',
    },
  ]

  return (
    <section
      aria-label="Indicadores executivos da operação comercial"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      ref={containerRef}
    >
      {cards.map((card) => (
        <ExecutiveCard
          key={card.label}
          card={card}
          onToggle={() =>
            setOpenCard((current) => (current === card.label ? null : card.label))
          }
          open={openCard === card.label}
          theme={theme}
        />
      ))}
    </section>
  )
}

type ExecutiveCardBase = {
  icon: LucideIcon
  label: string
  /** Valor frontal já formatado. Nos velocímetros é o percentual real. */
  value: string
  tone: CardTone
  readingTitle: string
  readingText: string
  observe: string
}

/** Card com minigráfico de área, o formato original dos KPIs de volume. */
type SparkCardProps = ExecutiveCardBase & {
  visual: 'spark'
  delta: string
  deltaTone: 'positive' | 'negative' | 'neutral'
  points: readonly number[]
}

/**
 * Card com velocímetro, usado por Meta Comercial e Supermeta Total.
 *
 * Comparação e distância vivem dentro do próprio modelo do velocímetro, para
 * não existir uma segunda fonte de meta efetiva no card.
 */
type GaugeCardProps = ExecutiveCardBase & {
  visual: 'gauge'
  gauge: OverviewGaugeModel
}

type ExecutiveCardProps = SparkCardProps | GaugeCardProps

function ExecutiveCard({
  card,
  open,
  onToggle,
  theme,
}: {
  card: ExecutiveCardProps
  open: boolean
  onToggle: () => void
  theme: Theme
}) {
  const { icon: Icon, label, value, tone, readingTitle, readingText, observe } = card
  const color = cardColors[tone]
  const isGauge = card.visual === 'gauge'
  const reading = readingTheme[theme === 'dark' ? 'dark' : 'light']
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <article
      aria-expanded={open}
      aria-label={`${isGauge ? card.gauge.accessibleText : `${label}: ${value}.`} ${open ? 'Ative para fechar a leitura gerencial.' : 'Ative para ver a leitura gerencial.'}`}
      // A altura mínima acompanha o card mais alto da fileira, que é o do
      // velocímetro. Como os itens do grid esticam, os cinco continuam
      // alinhados e do mesmo tamanho.
      className="group relative flex min-h-[206px] cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-[var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      onClick={onToggle}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-2">
        {/* O título quebra em duas linhas em vez de truncar. Como a altura da
            linha é definida pelo ícone de 36px, duas linhas de 10px cabem sem
            mudar a altura do cabeçalho nem desalinhar os cards. */}
        <p className="flex min-w-0 items-start gap-1 text-[10px] font-bold uppercase leading-[1.15] tracking-[0.4px] text-[var(--text-secondary)]">
          <span className="min-w-0 break-words">{label}</span>
          {/* Indicação discreta de que existe leitura gerencial. O hover apenas
              revela a lâmpada; abrir a leitura continua sendo uma ação. O
              amarelo é fixo nos cinco cards: a lâmpada identifica a leitura
              gerencial, não o indicador, então não herda a cor do card. */}
          <Lightbulb
            aria-hidden="true"
            className="mt-[-1px] flex-none opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            size={12}
            style={{ color: READING_LAMP }}
          />
        </p>
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
          style={{ background: `${color}1a`, color }}
        >
          <Icon aria-hidden="true" size={18} />
        </span>
      </div>
      {card.visual === 'gauge' ? (
        <>
          {/* Ordem do card: título, velocímetro com o percentual e a comparação
              logo abaixo dele, e o rodapé de três áreas. Nenhuma linha solta
              entre o título e o arco. */}
          <OverviewGauge baseColor={color} model={card.gauge} />
          <OverviewGaugeFooter model={card.gauge} />
        </>
      ) : (
        <>
          <p className={`mt-1.5 whitespace-nowrap font-mono font-bold tracking-[-0.8px] text-[var(--text-heading)] ${value.length > 12 ? 'text-[18px]' : 'text-[23px]'}`}>
            {value}
          </p>
          <p className={`mt-1.5 text-[10.5px] font-semibold ${toneClass(card.deltaTone)}`}>
            {card.delta}
          </p>
          <Sparkline color={color} points={card.points} />
        </>
      )}

      <div
        aria-hidden={!open}
        className={`absolute inset-0 flex flex-col px-4 py-3.5 transition duration-200 motion-reduce:transition-none ${open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0 motion-reduce:translate-y-0'}`}
        style={{ backgroundImage: reading.surface, color: reading.body }}
      >
        {/* Duas funções cromáticas distintas: a lâmpada continua amarela, que é
            o sinal de "existe leitura gerencial"; o título fica verde, que é a
            identidade da própria leitura. */}
        <p
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.85px]"
          style={{ color: reading.eyebrow }}
        >
          <Lightbulb
            aria-hidden="true"
            className="flex-none"
            size={11}
            style={{ color: reading.lamp }}
          />
          Leitura gerencial
        </p>
        <p className="mt-2 text-[12px] font-bold leading-[1.35]" style={{ color: reading.title }}>
          {readingTitle}
        </p>
        <p className="mt-1.5 text-[10.5px] leading-[1.4]" style={{ color: reading.body }}>
          <ReadingText highlight={reading.highlight} text={readingText} />
        </p>
        <p
          className="mt-auto border-t pt-2 text-[9.8px] leading-[1.35]"
          style={{ borderColor: reading.divider, color: reading.observeText }}
        >
          <b style={{ color: reading.observeLabel }}>OBSERVAR: </b>
          {observe}
        </p>
      </div>
    </article>
  )
}

function Sparkline({ color, points }: { color: string; points: readonly number[] }) {
  const rawId = useId()
  const gradientId = `overview-spark-${rawId.replace(/:/g, '')}`
  const width = 180
  const height = 42
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = Math.max(max - min, 1)
  const coordinates = points.map((point, index) => ({
    x: points.length <= 1 ? 0 : (index / (points.length - 1)) * width,
    y: height - 5 - ((point - min) / range) * (height - 10),
  }))
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg aria-hidden="true" className="absolute inset-x-4 bottom-2 h-[46px] w-[calc(100%-2rem)]" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={area} />
      <polyline
        fill="none"
        points={line}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ReadingText({ highlight, text }: { highlight: string; text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\})/g).map((part, index) =>
        part.startsWith('{') && part.endsWith('}') ? (
          <b className="font-semibold" key={index} style={{ color: highlight }}>
            {part.slice(1, -1)}
          </b>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

/**
 * Ranking comparativo de cidades.
 *
 * O modelo já entrega o ranking completo do período, ignorando apenas o filtro
 * de cidade. Aqui `selectedCityId` serve só para destacar a linha: um ranking
 * reduzido a uma única cidade não compara nada.
 */
function CitiesPanel({
  rows,
  selectedCityId,
}: {
  rows: readonly OverviewBreakdown[]
  selectedCityId: CommercialCityId | null
}) {
  const max = Math.max(...rows.map((row) => row.activeSales), 1)
  return (
    <Panel
      subtitle="Ranking completo do período. O filtro de cidade destaca a linha, sem reduzir a comparação."
      title="Vendas por cidade"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const selected = row.id === selectedCityId
            return (
              <div
                aria-current={selected ? 'true' : undefined}
                className={`rounded-lg border px-2 py-1.5 ${selected ? selectedRowClass : 'border-transparent'}`}
                key={row.id}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-[var(--text-item)]">
                    <MapPin aria-hidden="true" className="flex-none text-[#2f7de1]" size={13} />
                    <span className="truncate" title={row.label}>{row.label}</span>
                    {selected ? (
                      <FilterTag description="Cidade selecionada no filtro superior." />
                    ) : null}
                  </span>
                  <span className="flex-none font-mono text-[var(--text-heading)]">
                    {formatNumber(row.activeSales)} · {formatPercent(row.share)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                  <div className="h-full rounded-full bg-[#2f7de1]" style={{ width: `${(row.activeSales / max) * 100}%` }} />
                </div>
                <p className="mt-1 text-right text-[9.5px] text-[var(--text-secondary)]">
                  {currency.format(row.monthlyValue)} mensais
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

/**
 * Comparativo dos dois times.
 *
 * O modelo ignora o filtro de time ao montar este painel, então Comercial e
 * Corporativo continuam lado a lado. `selectedTeam` só marca qual bloco recebe
 * borda, fundo e o rótulo "Selecionado".
 *
 * Os detalhes ficam permanentemente visíveis nos dois blocos: não existe mais
 * tooltip na rosca nem nos blocos, e nada depende de hover para ser lido.
 */
function TeamPanel({
  rows,
  selectedTeam,
  theme,
  total,
}: {
  rows: readonly OverviewBreakdown[]
  selectedTeam: SalesPeriodTeamFilter
  theme: Theme
  total: number
}) {
  const details = rows.map((row) => buildTeamDetail(row, theme))
  return (
    <Panel
      subtitle="Comercial e Corporativo sempre comparados. O filtro de time destaca o selecionado."
      title="Vendas por time"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-1 flex flex-col items-center">
          <p className="sr-only">
            {formatNumber(total)} ativações no recorte de data e cidade.{' '}
            {details.map((detail) => detail.accessibleText).join(' ')}
          </p>
          <div aria-hidden="true" className="w-full">
            <Chart
              height={176}
              option={makeOverviewTeamOptions(rows, total, theme, selectedTeam)}
            />
          </div>
          {/* `items-stretch` é o padrão do grid: os dois blocos terminam sempre
              na mesma altura. Dentro de cada um, `mt-auto` empurra o bloco
              financeiro para a base, então a sobra vertical vira respiro entre
              a participação e o fechamento, em vez de um vazio no rodapé. */}
          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            {details.map((detail) => {
              const selected = detail.id === selectedTeam
              return (
                <div
                  aria-current={selected ? 'true' : undefined}
                  className={`flex min-w-0 flex-col rounded-lg border px-2.5 py-3 ${selected ? selectedRowClass : 'border-[var(--divider)]'}`}
                  key={detail.id}
                >
                  <p className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ background: detail.color }}
                    />
                    <span className="truncate">{detail.label}</span>
                  </p>
                  {/* Em linha própria: o bloco de time tem cerca de metade de um
                      painel estreito, e o label ao lado do nome espremeria os
                      dois. */}
                  {selected ? (
                    <p className="mt-1.5">
                      <FilterTag description="Time selecionado no filtro superior." />
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[17px] font-bold leading-none text-[var(--text-heading)]">
                    {formatNumber(detail.activeSales)}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                    {detail.share} das ativações
                  </p>
                  {/* Rótulo em cima e número embaixo porque cada bloco ocupa
                      metade de um painel estreito: os dois na mesma linha
                      estourariam a coluna. Valor mensal fecha o bloco com
                      hierarquia maior que o Ticket médio. */}
                  <dl className="mt-auto space-y-2.5 border-t border-[var(--divider)] pt-2.5">
                    <div>
                      <dt className="text-[9.5px] uppercase tracking-[0.3px] text-[var(--text-secondary)]">
                        {detail.averageTicket.term}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[11px] font-semibold text-[var(--text-item)]">
                        {detail.averageTicket.value}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9.5px] uppercase tracking-[0.3px] text-[var(--text-secondary)]">
                        {detail.monthlyValue.term}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[12.5px] font-bold text-[var(--text-heading)]">
                        {detail.monthlyValue.value}
                      </dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Panel>
  )
}

/**
 * Origem das vendas.
 *
 * Vendedores e Indicação são origens da ativação, não times. O modelo monta
 * este painel ignorando o filtro de time, então trocar Comercial ou Corporativo
 * no controle superior não altera estes números. Data e cidade continuam
 * valendo.
 */
function OriginsPanel({ rows }: { rows: readonly OverviewBreakdown[] }) {
  return (
    <Panel
      subtitle="Crédito da ativação conforme a presença do CPF indicador, somando os dois times."
      title="Origem das vendas"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-5 space-y-3.5">
          {rows.map((row) => {
            const indicated = row.id === 'indicacao'
            const Icon = indicated ? Share2 : UsersRound
            return (
              <div className="rounded-xl border border-[var(--divider)] p-3" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-lg p-2 ${indicated ? 'bg-[#14b8a6]/10 text-[#0f9689]' : 'bg-[#2f7de1]/10 text-[#2f7de1]'}`}>
                    <Icon aria-hidden="true" size={17} />
                  </span>
                  <span className="font-mono text-[19px] font-bold text-[var(--text-heading)]">{formatNumber(row.activeSales)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[10.5px]">
                  <strong className="text-[var(--text-item)]">{row.label}</strong>
                  <span className="text-[var(--text-secondary)]">{formatPercent(row.share)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                  <div className={`h-full rounded-full ${indicated ? 'bg-[#14b8a6]' : 'bg-[#2f7de1]'}`} style={{ width: `${row.share * 100}%` }} />
                </div>
                <p className="mt-2 text-[9.5px] text-[var(--text-secondary)]">{currency.format(row.monthlyValue)} mensais</p>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

/**
 * Evolução mensal das vendas.
 *
 * A legenda do próprio gráfico liga e desliga Comercial e Corporativo. O estado
 * fica aqui para que a linha Valor mensal seja recalculada como a soma apenas
 * dos times visíveis, em vez de continuar exibindo o total consolidado.
 */
function MonthlyPanel({
  monthly,
  team,
  theme,
}: {
  monthly: CommercialOverviewSnapshot['monthly']
  team: SalesPeriodTeamFilter
  theme: Theme
}) {
  const [legendSelection, setLegendSelection] = useState(initialMonthlyLegendSelection)

  return (
    <Panel
      subtitle="Comercial e Corporativo em volume. O valor mensal soma os times visíveis na legenda; sem nenhum time visível, volta ao total do filtro superior."
      title="Evolução mensal das vendas"
    >
      <Chart
        height={306}
        onEvents={{
          legendselectchanged: (params) => {
            if (typeof params !== 'object' || params === null || !('selected' in params)) return
            const { selected } = params as { selected: unknown }
            if (typeof selected !== 'object' || selected === null) return
            setLegendSelection({ ...(selected as Record<string, boolean>) })
          },
        }}
        option={makeOverviewMonthlyOptions(monthly, theme, team, legendSelection)}
      />
    </Panel>
  )
}

/** Ouro, prata e bronze com contraste próprio em cada tema. */
const medalColors: Record<number, { readonly light: string; readonly dark: string; readonly name: string }> = {
  1: { light: '#a1740a', dark: '#f2c14e', name: 'medalha de ouro' },
  2: { light: '#596577', dark: '#cbd5e1', name: 'medalha de prata' },
  3: { light: '#96551f', dark: '#e0a06a', name: 'bronze' },
}

function SellerRanking({
  snapshot,
  theme,
}: {
  snapshot: CommercialOverviewSnapshot
  theme: Theme
}) {
  return (
    <Panel subtitle="Ranking por quantidade de vendas ativadas no recorte." title="Top 5 Vendedores">
      {snapshot.topSellers.length === 0 ? <EmptyPanel /> : (
        <ol className="mt-3 space-y-2">
          {snapshot.topSellers.map((seller) => {
            const medal = medalColors[seller.position]
            return (
              <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border border-[var(--divider)] px-2 py-1.5" key={seller.sellerId}>
                {medal === undefined ? (
                  <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{seller.position}º</span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Medal
                      aria-hidden="true"
                      size={16}
                      style={{ color: theme === 'dark' ? medal.dark : medal.light }}
                    />
                    {/* A posição continua no nome acessível mesmo virando ícone. */}
                    <span className="sr-only">{seller.position}º lugar, {medal.name}</span>
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold leading-tight text-[var(--text-item)]" title={seller.sellerName}>
                    {seller.sellerName}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] leading-tight text-[var(--text-secondary)]">{seller.team === 'comercial' ? 'Comercial' : 'Corporativo'} · {formatPercent(seller.share)}</p>
                </div>
                <div className="text-right">
                  <strong className="font-mono text-[13px] leading-tight text-[var(--text-heading)]">{formatNumber(seller.activeSales)}</strong>
                  <p className="whitespace-nowrap text-[9.5px] leading-tight text-[var(--text-secondary)]">{currency.format(seller.monthlyRevenue)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function PlansRanking({ snapshot }: { snapshot: CommercialOverviewSnapshot }) {
  const max = Math.max(...snapshot.topPlans.map((plan) => plan.activeSales), 1)
  return (
    <Panel subtitle="Planos ordenados por quantidade de vendas ativadas." title="Top 5 Planos">
      {snapshot.topPlans.length === 0 ? <EmptyPanel /> : (
        <ol className="mt-4 space-y-3">
          {snapshot.topPlans.map((plan) => (
            <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-1.5" key={plan.id}>
              <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{plan.position}º</span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <strong className="truncate text-[var(--text-item)]" title={plan.label}>{plan.label}</strong>
                  <span className="flex-none text-[10px] text-[var(--text-secondary)]">{formatPercent(plan.share)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                  <div className="h-full rounded-full bg-[#4263eb]" style={{ width: `${(plan.activeSales / max) * 100}%` }} />
                </div>
                {/* `truncate` em vez de `whitespace-nowrap`: dentro de uma
                    coluna `minmax(0,1fr)` o texto sem quebra transbordaria o
                    painel em vez de recortar. */}
                <p className="mt-1 truncate text-[9.5px] text-[var(--text-secondary)]" title={`${currency.format(plan.monthlyValue)} mensais`}>{currency.format(plan.monthlyValue)} mensais</p>
              </div>
              <strong className="font-mono text-[13px] text-[var(--text-heading)]">{formatNumber(plan.activeSales)}</strong>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function Panel({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className={panelClass}>
      <h2 className="text-[13.5px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-0.5 text-[11px] leading-[1.45] text-[var(--text-secondary)]">{subtitle}</p>
      {children}
    </section>
  )
}

function EmptyPanel() {
  return <p className="mt-5 rounded-lg bg-[var(--hover-bg)] p-4 text-center text-[11px] text-[var(--text-secondary)]">Nenhuma venda ativada corresponde aos filtros.</p>
}

function StatePanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={`${panelClass} py-10 text-center`}>
      <h2 className="text-[14px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{children}</p>
    </section>
  )
}

/**
 * Descreve o histórico exibido a partir da coleção recebida.
 *
 * Nada é fixado no texto: se a fonte passar a entregar doze meses, a frase
 * acompanha sem alteração de código.
 */
function describeMonthlyRange(monthly: CommercialOverviewSnapshot['monthly']): string {
  if (monthly.length === 0) return 'nenhum mês disponível'
  const first = monthly[0]
  const last = monthly[monthly.length - 1]
  const year = first.month.slice(0, 4)
  if (monthly.length === 1) return `${first.label} de ${year}`
  return `${first.label} a ${last.label} de ${year}`
}

function changeText(rate: number | null): { label: string; reading: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (rate === null) return { label: 'Sem período anterior', reading: 'Ainda não há base anterior comparável.', tone: 'neutral' }
  if (rate > 0) return { label: `▲ ${formatPercent(rate)} vs período anterior`, reading: `O indicador cresceu {${formatPercent(rate)}} frente ao período anterior.`, tone: 'positive' }
  if (rate < 0) return { label: `▼ ${formatPercent(Math.abs(rate))} vs período anterior`, reading: `O indicador recuou {${formatPercent(Math.abs(rate))}} frente ao período anterior.`, tone: 'negative' }
  return { label: 'Estável vs período anterior', reading: 'O indicador permaneceu estável frente ao período anterior.', tone: 'neutral' }
}

/** Verde para positivo, vermelho para negativo, secundário para neutro. */
function toneClass(tone: 'positive' | 'negative' | 'neutral'): string {
  if (tone === 'positive') return 'text-[#00a862]'
  if (tone === 'negative') return 'text-[#d32744]'
  return 'text-[var(--text-secondary)]'
}

/**
 * Frase da leitura gerencial derivada do próprio velocímetro.
 *
 * A distância vem de `gauge.gap`, que já foi calculada sobre a meta efetiva
 * inteira. Assim a leitura nunca contradiz o rodapé nem exibe fração de venda.
 */
function gaugeReadingText(
  gauge: OverviewGaugeModel,
  phrases: {
    readonly noGoal: string
    readonly exact: string
    readonly above: (value: string) => string
    readonly below: (value: string) => string
  },
): string {
  const gap = gauge.gap.value
  if (gap === null) return phrases.noGoal
  if (gap === 0) return phrases.exact
  const amount = `${formatNumber(Math.abs(gap))} ${Math.abs(gap) === 1 ? 'venda' : 'vendas'}`
  return gap > 0 ? phrases.above(amount) : phrases.below(amount)
}
