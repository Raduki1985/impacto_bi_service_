import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BadgeDollarSign,
  Building2,
  CircleCheckBig,
  Clock3,
  Handshake,
  RotateCcw,
  Target,
  Trophy,
  UserRoundCheck,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../../components/charts/Chart'
import { formatIsoAsBrDate } from '../../../data/commercialCalendar'
import type { CommercialDataset, CommercialSaleStatus } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import { SalesPeriodFilters } from './SalesPeriodFilters'
import {
  commercialSaleStatusLabels,
  buildSalesPeriodSnapshot,
  initialSalesPeriodFilters,
  salesPeriodTeamLabels,
  type SalesPeriodFact,
  type SalesPeriodSellerRank,
  type SalesPeriodSnapshot,
} from './salesPeriodModel'
import {
  makeSalesPeriodDailyOptions,
  makeSalesPeriodStatusOptions,
} from './salesPeriodChartOptions'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const panelClass =
  'min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4'

/** Comercial > Vendas por Período. Todos os valores são parte da base sintética do mock. */
export function SalesPeriod() {
  const [dataset, setDataset] = useState<CommercialDataset | null>(() => peekCommercialDataset())
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState(initialSalesPeriodFilters)

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
    () => (dataset === null ? null : buildSalesPeriodSnapshot(dataset, filters)),
    [dataset, filters],
  )

  if (error !== null) return <StatePanel title="Não foi possível montar o mock">{error}</StatePanel>
  if (dataset === null || snapshot === null) {
    return <StatePanel title="Montando o esboço">Preparando os dados comerciais sintéticos.</StatePanel>
  }

  return (
    <div className="flex flex-col gap-4">
      <SalesPeriodFilters
        activeSales={snapshot.metrics.activeSales}
        cities={dataset.cities}
        filters={filters}
        onChange={setFilters}
        partners={dataset.partners}
      />

      <KpiGrid snapshot={snapshot} />

      <GoalAndOrigins snapshot={snapshot} />

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.55fr_1fr]">
        <Panel
          subtitle={`Vendas ativadas e valor mensal por dia, de ${snapshot.periodLabel}.`}
          title="Evolução diária das vendas"
        >
          <Chart height={290} minWidth={600} option={makeSalesPeriodDailyOptions(snapshot.daily)} />
        </Panel>

        <Panel
          subtitle={`${formatNumber(snapshot.metrics.totalContracts)} contratos no recorte, incluindo etapas anteriores e posteriores à ativação.`}
          title="Distribuição por status"
        >
          {snapshot.statusDistribution.length > 0 ? (
            <Chart height={290} minWidth={390} option={makeSalesPeriodStatusOptions(snapshot.statusDistribution)} />
          ) : (
            <EmptyPanel>Nenhum contrato corresponde aos filtros selecionados.</EmptyPanel>
          )}
        </Panel>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.7fr)]">
        <SellerRanking sellers={snapshot.topSellers} />
        <SalesTable rows={snapshot.tableRows} total={snapshot.facts.length} />
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        Esboço com dados sintéticos para validar a matriz funcional. Clientes, CPFs, contratos,
        planos e valores não foram extraídos do SGI. Base mockada atualizada em{' '}
        {formatIsoAsBrDate(dataset.referenceDate)}.
      </p>
    </div>
  )
}

function KpiGrid({ snapshot }: { snapshot: SalesPeriodSnapshot }) {
  const { metrics } = snapshot
  const activeChangeReading =
    metrics.activeSalesChangeRate === null
      ? 'Ainda não há uma base anterior comparável.'
      : metrics.activeSalesChangeRate > 0
        ? `O volume cresceu ${formatPercent(metrics.activeSalesChangeRate)} frente ao período anterior.`
        : metrics.activeSalesChangeRate < 0
          ? `O volume recuou ${formatPercent(Math.abs(metrics.activeSalesChangeRate))} frente ao período anterior.`
          : 'O volume ficou estável frente ao período anterior.'
  const commercialGoalReading =
    metrics.goal === null
      ? 'Este recorte não possui meta própria de volume.'
      : metrics.goalAchieved >= metrics.goal
        ? `O Comercial superou a meta proporcional em ${formatNumber(metrics.goalAchieved - metrics.goal)} vendas.`
        : `Faltaram ${formatNumber(metrics.goal - metrics.goalAchieved)} vendas para a meta proporcional de ${formatNumber(metrics.goal)}.`
  const activeComparison: KpiComparison =
    metrics.previousActiveSales === null
      ? { text: 'Sem período anterior', tone: 'neutral' }
      : metrics.activeSalesChangeRate === null
        ? { text: 'Sem base percentual anterior', tone: 'neutral' }
        : {
            text: `${metrics.activeSalesChangeRate > 0 ? '+' : ''}${formatPercent(metrics.activeSalesChangeRate)} vs período anterior`,
            tone:
              metrics.activeSalesChangeRate > 0
                ? 'positive'
                : metrics.activeSalesChangeRate < 0
                  ? 'negative'
                  : 'neutral',
          }
  const cards: readonly KpiProps[] = [
    {
      comparison: activeComparison,
      icon: CircleCheckBig,
      label: 'Vendas ativadas',
      reading: `${formatNumber(metrics.activeSales)} vendas foram ativadas, equivalentes a ${formatPercent(metrics.activationRate ?? 0)} dos ${formatNumber(metrics.totalContracts)} contratos. ${activeChangeReading}`,
      value: formatNumber(metrics.activeSales),
      progress:
        metrics.activationRate === null
          ? undefined
          : {
              label: `Ativado/contratado · ${formatNumber(metrics.activeSales)} de ${formatNumber(metrics.totalContracts)}`,
              value: metrics.activationRate,
              valueLabel: formatPercent(metrics.activationRate),
            },
      tone: 'green',
    },
    {
      icon: BadgeDollarSign,
      label: 'Valor vendas ativadas',
      reading: `As ativações adicionaram ${currency.format(metrics.monthlyRevenue)} em valor mensal, com ticket médio de ${currency.format(metrics.averageTicket)} por venda.`,
      value: currency.format(metrics.monthlyRevenue),
      detail: 'soma dos valores mensais ativados no período',
      tone: 'green',
    },
    {
      icon: UsersRound,
      label: 'Vendas Comercial',
      reading: `O Comercial respondeu por ${formatPercent(metrics.activeSales === 0 ? 0 : metrics.commercialSales / metrics.activeSales)} das ativações. ${commercialGoalReading}`,
      value: formatNumber(metrics.commercialSales),
      detail: 'vendas ativadas do Comercial',
      tone: 'cyan',
    },
    {
      icon: Building2,
      label: 'Vendas Corporativas',
      reading: `O Corporativo respondeu por ${formatPercent(metrics.activeSales === 0 ? 0 : metrics.corporateSales / metrics.activeSales)} das ativações. Esse volume compõe somente o realizado da Supermeta.`,
      value: formatNumber(metrics.corporateSales),
      detail: 'vendas ativadas do Corporativo',
      tone: 'slate',
    },
    {
      icon: RotateCcw,
      label: 'Retornaram à base',
      reading: `${formatNumber(metrics.returnedCustomers)} clientes retornaram com nova ativação, representando ${formatPercent(metrics.activeSales === 0 ? 0 : metrics.returnedCustomers / metrics.activeSales)} das vendas ativadas.`,
      value: formatNumber(metrics.returnedCustomers),
      detail: 'com nova venda ativada',
      tone: 'amber',
    },
    {
      icon: Clock3,
      label: 'Em andamento',
      reading: `${formatNumber(metrics.pipelineSales)} contratos seguem no fluxo, equivalentes a ${formatPercent(metrics.totalContracts === 0 ? 0 : metrics.pipelineSales / metrics.totalContracts)} do recorte. Acompanhe a conversão para ativação.`,
      value: formatNumber(metrics.pipelineSales),
      detail: 'pendente, assinada, agendada ou em aprovação',
      tone: 'slate',
    },
  ]

  return (
    <section
      aria-label="Indicadores principais de vendas por período"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
    >
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </section>
  )
}

function GoalAndOrigins({ snapshot }: { snapshot: SalesPeriodSnapshot }) {
  const { metrics } = snapshot
  const originCards: readonly KpiProps[] = [
    {
      icon: UserRoundCheck,
      label: 'Vendas de vendedores',
      reading: `${formatNumber(metrics.sellerSales)} ativações não possuem CPF indicador, ou ${formatPercent(metrics.activeSales === 0 ? 0 : metrics.sellerSales / metrics.activeSales)} do total. O crédito fica com o vendedor vinculado.`,
      value: formatNumber(metrics.sellerSales),
      detail: 'vendas ativadas sem CPF indicador',
      tone: 'blue',
    },
    {
      icon: Handshake,
      label: 'Vendas por indicação',
      reading: `${formatNumber(metrics.indicatedSales)} ativações vieram por indicação, ou ${formatPercent(metrics.activeSales === 0 ? 0 : metrics.indicatedSales / metrics.activeSales)} do total. O CPF é o identificador disponível no mock.`,
      value: formatNumber(metrics.indicatedSales),
      detail:
        metrics.activeSales === 0
          ? '0,0% das vendas ativadas'
          : `${formatPercent(metrics.indicatedSales / metrics.activeSales)} das vendas ativadas`,
      tone: 'cyan',
    },
  ]

  return (
    <section
      aria-label="Meta, supermeta e origem das vendas"
      className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]"
    >
      <GoalSummaryCard snapshot={snapshot} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-1">
        {originCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  )
}

function GoalSummaryCard({ snapshot }: { snapshot: SalesPeriodSnapshot }) {
  const { metrics } = snapshot
  const hasGoal = metrics.goal !== null && metrics.superGoal !== null
  const goalAttainment = metrics.goalAttainment ?? 0
  const superGoalAttainment = metrics.superGoalAttainment ?? 0
  const clampedGoalAttainment = Math.min(Math.max(goalAttainment, 0), 1)
  const clampedSuperGoalAttainment = Math.min(Math.max(superGoalAttainment, 0), 1)
  const goalReached = metrics.goal !== null && metrics.goalAchieved >= metrics.goal
  const superGoalReached =
    metrics.superGoal !== null && metrics.superGoalAchieved >= metrics.superGoal
  const goalRemaining =
    metrics.goal === null ? null : Math.max(metrics.goal - metrics.goalAchieved, 0)
  const superGoalRemaining =
    metrics.superGoal === null
      ? null
      : Math.max(metrics.superGoal - metrics.superGoalAchieved, 0)
  const goalStageRatio =
    metrics.goal !== null && metrics.superGoal !== null && metrics.superGoal > 0
      ? Math.min(Math.max(metrics.goal / metrics.superGoal, 0), 1)
      : 0.8
  const goalStageAngle = Math.PI * (1 - goalStageRatio)
  const goalStageX = 100 + 75 * Math.cos(goalStageAngle)
  const goalStageY = 96 - 75 * Math.sin(goalStageAngle)
  const goalStagePath = `M 25 96 A 75 75 0 0 1 ${goalStageX} ${goalStageY}`
  const superGoalStagePath = `M ${goalStageX} ${goalStageY} A 75 75 0 0 1 175 96`
  return (
    <article className={`${panelClass} min-h-[322px] overflow-hidden`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.55px] text-[var(--text-secondary)]">
            Meta e Supermeta
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
            Acompanhamento consolidado do período
          </p>
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-lg bg-[#2f7de1]/10 p-2 text-[#2f7de1]">
            <Target aria-hidden="true" size={17} />
          </span>
          <span className="rounded-lg bg-[#8b5cf6]/10 p-2 text-[#8b5cf6]">
            <Trophy aria-hidden="true" size={17} />
          </span>
        </div>
      </div>

      <div className="mt-3 grid items-center gap-4 md:grid-cols-[minmax(210px,0.8fr)_minmax(260px,1.2fr)]">
        <div className="flex flex-col items-center">
          <svg
            aria-hidden="true"
            className="w-full max-w-[270px] overflow-visible"
            viewBox="0 0 220 118"
          >
            <path
              d="M 25 96 A 75 75 0 0 1 175 96"
              fill="none"
              pathLength="100"
              stroke="var(--divider)"
              strokeLinecap="round"
              strokeWidth="11"
            />
            {hasGoal ? (
              <>
                <path
                  d={goalStagePath}
                  fill="none"
                  pathLength="100"
                  stroke="#2f7de1"
                  strokeDasharray={`${clampedGoalAttainment * 100} 100`}
                  strokeLinecap="round"
                  strokeWidth="11"
                />
                <path
                  d={superGoalStagePath}
                  fill="none"
                  pathLength="100"
                  stroke="#8b5cf6"
                  strokeDasharray={`${clampedSuperGoalAttainment * 100} 100`}
                  strokeLinecap="round"
                  strokeWidth="11"
                />

                <circle
                  cx={goalStageX}
                  cy={goalStageY}
                  fill={goalReached ? '#2f7de1' : 'var(--surface)'}
                  r="8"
                  stroke="#2f7de1"
                  strokeWidth="3"
                />
                {goalReached ? (
                  <path
                    d={`m ${goalStageX - 3.5} ${goalStageY} 2.4 2.4 4.8 -5.4`}
                    fill="none"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                  />
                ) : (
                  <circle cx={goalStageX} cy={goalStageY} fill="#2f7de1" r="2.2" />
                )}

                <circle
                  cx="175"
                  cy="96"
                  fill={superGoalReached ? '#8b5cf6' : 'var(--surface)'}
                  r="8"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                />
                {superGoalReached ? (
                  <path
                    d="m 171.5 96 2.4 2.4 4.8 -5.4"
                    fill="none"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                  />
                ) : (
                  <circle cx="175" cy="96" fill="#8b5cf6" r="2.2" />
                )}
              </>
            ) : null}
          </svg>
          <div className="-mt-[68px] text-center">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.55px] text-[#2f7de1]">
                Meta
              </span>
              <strong className="font-mono text-[27px] tracking-[-1px] text-[var(--text-heading)]">
                {hasGoal ? formatPercent(goalAttainment) : 'Sem meta'}
              </strong>
            </div>
            {hasGoal ? (
              <p className="mt-0.5 text-[11px] font-semibold text-[#8b5cf6]">
                Supermeta {formatPercent(superGoalAttainment)}
              </p>
            ) : null}
          </div>
          {hasGoal ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#2f7de1]/10 px-2.5 py-1 text-[#2f7de1]">
                {goalReached ? <CircleCheckBig aria-hidden="true" size={11} /> : null}
                Meta: {goalReached ? 'atingida' : `faltam ${formatNumber(goalRemaining ?? 0)}`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#8b5cf6]/10 px-2.5 py-1 text-[#8b5cf6]">
                {superGoalReached ? <CircleCheckBig aria-hidden="true" size={11} /> : null}
                Supermeta:{' '}
                {superGoalReached
                  ? 'atingida'
                  : `faltam ${formatNumber(superGoalRemaining ?? 0)}`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[var(--divider)] px-4 py-3">
          <h3 className="text-[12px] font-semibold text-[var(--text-heading)]">
            Análise consolidada
          </h3>
          <GoalAnalysisRow label="Realizado Comercial" value={formatNumber(metrics.goalAchieved)} />
          <GoalAnalysisRow
            label="Meta proporcional"
            value={metrics.goal === null ? 'Sem meta' : formatNumber(metrics.goal)}
          />
          <GoalAnalysisRow label="Realizado total" value={formatNumber(metrics.superGoalAchieved)} />
          <GoalAnalysisRow
            label="Supermeta proporcional"
            value={metrics.superGoal === null ? 'Sem meta' : formatNumber(metrics.superGoal)}
          />
        </div>
      </div>
    </article>
  )
}

function GoalAnalysisRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[var(--divider)] pt-2.5 text-[11.5px]">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <strong className="font-mono text-[var(--text-item)]">{value}</strong>
    </div>
  )
}

type KpiProps = {
  comparison?: KpiComparison
  icon: LucideIcon
  label: string
  value: string
  detail?: string
  progress?: {
    label: string
    value: number
    valueLabel: string
  }
  reading: string
  tone: 'green' | 'blue' | 'violet' | 'amber' | 'cyan' | 'slate'
}

type KpiComparison = {
  text: string
  tone: 'positive' | 'negative' | 'neutral'
}

const kpiTones: Record<KpiProps['tone'], { background: string; color: string }> = {
  green: { background: 'rgba(0, 168, 98, 0.12)', color: '#00a862' },
  blue: { background: 'rgba(47, 125, 225, 0.12)', color: '#2f7de1' },
  violet: { background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' },
  amber: { background: 'rgba(239, 159, 39, 0.14)', color: '#b16a00' },
  cyan: { background: 'rgba(20, 184, 166, 0.13)', color: '#0f9689' },
  slate: { background: 'rgba(100, 116, 139, 0.13)', color: '#64748b' },
}

const comparisonClasses: Record<KpiComparison['tone'], string> = {
  positive: 'border-[#00a862]/25 bg-[#00a862]/10 text-[#00844d]',
  negative: 'border-[#d32744]/25 bg-[#d32744]/10 text-[#b51d38]',
  neutral: 'border-[var(--border)] bg-[var(--hover-bg)] text-[var(--text-secondary)]',
}

function KpiCard({
  comparison,
  detail,
  icon: Icon,
  label,
  progress,
  reading,
  tone,
  value,
}: KpiProps) {
  const colors = kpiTones[tone]

  return (
    <article
      aria-label={`${label}. ${reading}`}
      className={`${panelClass} group relative min-h-[154px] overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.55px] text-[var(--text-secondary)]">
            {label}
          </p>
          <p className="mt-2 font-mono text-[22px] font-bold tracking-[-0.8px] text-[var(--text-heading)]">
            {value}
          </p>
        </div>
        <span className="rounded-lg p-2" style={{ background: colors.background, color: colors.color }}>
          <Icon aria-hidden="true" size={17} />
        </span>
      </div>
      {comparison ? (
        <p
          className={`mt-2 inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold leading-none ${comparisonClasses[comparison.tone]}`}
        >
          {comparison.text}
        </p>
      ) : null}
      {detail ? (
        <p className="mt-2 text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">{detail}</p>
      ) : null}
      {progress ? (
        <div className="mt-3">
          <div
            aria-label={`${progress.label}: ${progress.valueLabel}`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.min(Math.max(progress.value * 100, 0), 100)}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--divider)]"
            role="progressbar"
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                background: colors.color,
                width: `${Math.min(Math.max(progress.value * 100, 0), 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-secondary)]">
            <span>{progress.label}</span>
            <strong className="font-mono text-[var(--text-item)]">{progress.valueLabel}</strong>
          </div>
        </div>
      ) : null}
      <KpiReadingOverlay reading={reading} />
    </article>
  )
}

function KpiReadingOverlay({ reading }: { reading: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex translate-y-3 flex-col justify-center bg-[#111c2d] px-[18px] py-4 opacity-0 shadow-[inset_0_0_0_1px_rgba(148,163,184,.18)] transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100"
    >
      <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#54d98c]">
        Leitura gerencial
      </p>
      <p className="mt-2 text-[12px] font-medium leading-[1.55] text-[#f1f5f9]">
        {reading}
      </p>
    </div>
  )
}

function Panel({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className={panelClass}>
      <h2 className="text-[13.5px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-0.5 text-[12px] leading-[1.45] text-[var(--text-secondary)]">{subtitle}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function SellerRanking({ sellers }: { sellers: readonly SalesPeriodSellerRank[] }) {
  return (
    <Panel
      subtitle="Ranking contextual das vendas ativadas. O ranking completo ficará na página Vendedores."
      title="Top 5 vendedores no período"
    >
      {sellers.length === 0 ? (
        <EmptyPanel>Nenhuma venda ativada para formar o ranking.</EmptyPanel>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {sellers.map((seller) => (
            <li
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-[var(--divider)] px-3 py-2.5"
              key={seller.sellerId}
            >
              <span className="font-mono text-[13px] font-bold text-[var(--accent)]">
                {seller.position}º
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-[var(--text-item)]">
                  {seller.sellerName}
                </p>
                <p className="mt-0.5 text-[10.5px] text-[var(--text-secondary)]">
                  {salesPeriodTeamLabels[seller.team]} · {formatPercent(seller.share)} do total
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[13px] font-bold text-[var(--text-heading)]">
                  {formatNumber(seller.activeSales)}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {currency.format(seller.monthlyRevenue)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function SalesTable({ rows, total }: { rows: readonly SalesPeriodFact[]; total: number }) {
  return (
    <Panel
      subtitle={
        total > rows.length
          ? `Exibindo os ${formatNumber(rows.length)} registros mais recentes de ${formatNumber(total)} contratos.`
          : `${formatNumber(total)} contratos correspondem aos filtros selecionados.`
      }
      title="Detalhamento das vendas"
    >
      {rows.length === 0 ? (
        <EmptyPanel>Nenhum contrato corresponde aos filtros selecionados.</EmptyPanel>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-[var(--divider)] text-[10px] font-bold uppercase tracking-[0.45px] text-[var(--text-secondary)]">
                <th className="px-2 py-2">Contrato</th>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Vendedor</th>
                <th className="px-2 py-2">Cidade</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Valor mensal</th>
                <th className="px-2 py-2">Origem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-[var(--divider)] last:border-0" key={row.id}>
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono font-semibold text-[var(--text-item)]">
                    {row.contractCode}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[var(--text-secondary)]">
                    {formatIsoAsBrDate(row.eventDate)}
                  </td>
                  <td className="max-w-[180px] px-2 py-2.5">
                    <p className="truncate font-semibold text-[var(--text-item)]">{row.customerLabel}</p>
                    <p className="font-mono text-[10px] text-[var(--text-secondary)]">{row.customerCpf}</p>
                  </td>
                  <td className="max-w-[180px] truncate px-2 py-2.5 text-[var(--text-item)]">
                    {row.sellerName}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[var(--text-secondary)]">{row.cityName}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[var(--text-secondary)]">
                    {salesPeriodTeamLabels[row.team]}
                  </td>
                  <td className="px-2 py-2.5"><StatusBadge status={row.status} /></td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono font-semibold text-[var(--text-item)]">
                    {currency.format(row.monthlyValue)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[var(--text-secondary)]">
                    {row.returnedToBase
                      ? 'Retornou à base'
                      : row.indicatorCpf
                        ? `Indicação ${row.indicatorCpf}`
                        : 'Venda direta'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

const statusTone: Partial<Record<CommercialSaleStatus, string>> = {
  ativa: 'border-[#00a862]/25 bg-[#00a862]/10 text-[#00844d]',
  pendente: 'border-[#ef9f27]/30 bg-[#ef9f27]/10 text-[#9a5d00]',
  assinada: 'border-[#2f7de1]/25 bg-[#2f7de1]/10 text-[#2568bc]',
  agendada: 'border-[#8b5cf6]/25 bg-[#8b5cf6]/10 text-[#7142d5]',
  'aguardando-aprovacao': 'border-[#ef9f27]/30 bg-[#ef9f27]/10 text-[#9a5d00]',
  cancelada: 'border-[#d32744]/25 bg-[#d32744]/10 text-[#b51d38]',
  reprovada: 'border-[#d32744]/25 bg-[#d32744]/10 text-[#b51d38]',
}

function StatusBadge({ status }: { status: CommercialSaleStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        statusTone[status] ?? 'border-[var(--border)] bg-[var(--hover-bg)] text-[var(--text-secondary)]'
      }`}
    >
      {commercialSaleStatusLabels[status]}
    </span>
  )
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-5 text-center text-[12px] text-[var(--text-secondary)]">
      {children}
    </div>
  )
}

function StatePanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={`${panelClass} flex min-h-[220px] flex-col items-center justify-center text-center`}>
      <UsersRound aria-hidden="true" className="text-[var(--accent)]" size={24} />
      <h2 className="mt-3 text-[14px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{children}</p>
    </section>
  )
}
