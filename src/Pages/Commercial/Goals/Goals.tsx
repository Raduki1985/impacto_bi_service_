import { useEffect, useMemo, useState } from 'react'

import { Chart } from '../../../components/charts/Chart'
import { KpiStoryCard } from '../../../components/dashboard/KpiStoryCard'
import { DEFAULT_COMMERCIAL_MONTH, formatIsoAsBrDate } from '../../../data/commercialCalendar'
import type { CommercialDataset, CommercialGoalsFilters } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import {
  buildCommercialGoalsSnapshot,
  initialCommercialGoalsFilters,
  validateCommercialDataset,
  type CommercialGoalsSnapshot,
} from './commercialGoalsModel'
import { GoalProgress } from './GoalProgress'
import { GoalsDailyComparisons } from './GoalsDailyComparisons'
import { GoalsFilters } from './GoalsFilters'
import {
  AlertsPanel,
  ChartPanel,
  ConsistencyPanel,
  ContributionPanels,
  EmptyStatePanel,
  ErrorPanel,
  KpiReadingPanel,
  KPI_READING_PANEL_ID,
  LoadingPanel,
  StoryPanel,
  TeamSummaryPanel,
} from './GoalsPanels'
import { makeGoalsMonthlyOptions } from './goalsChartOptions'
import { MonthlyChartTable } from './GoalsChartTable'
import { buildCommercialKpiCards } from './goalsKpiCards'

/**
 * Comercial > Metas e Desempenho.
 *
 * Responde a uma pergunta: estamos atingindo a meta comercial de volume e como
 * esse desempenho evolui ao longo do período?
 *
 * Toda a regra vive em `commercialGoalsModel`, que é puro e testado. Aqui ficam
 * apenas estado dos filtros, estados de tela e composição visual. Os dados são
 * uma base mockada determinística de 01/01/2026 a 31/07/2026, e não uma extração
 * do SGI.
 */
export function Goals() {
  const [dataset, setDataset] = useState<CommercialDataset | null>(() => peekCommercialDataset())
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CommercialGoalsFilters>(() =>
    initialCommercialGoalsFilters(DEFAULT_COMMERCIAL_MONTH),
  )

  /**
   * Montagem da base.
   *
   * A base tem granularidade individual, então a primeira visita realmente monta
   * milhares de fatos: o estado de carregamento existe por isso, e não por
   * enfeite. Visitas seguintes reaproveitam a base já construída na sessão e
   * entram direto no conteúdo.
   */
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

  const issues = useMemo(
    () => (dataset === null ? [] : validateCommercialDataset(dataset)),
    [dataset],
  )

  const snapshot = useMemo(
    () => (dataset === null ? null : buildCommercialGoalsSnapshot(dataset, filters)),
    [dataset, filters],
  )

  if (error !== null) return <ErrorPanel message={error} />
  if (dataset === null || snapshot === null) return <LoadingPanel />

  return (
    <div className="flex flex-col gap-4">
      <GoalsFilters
        activeSales={snapshot.totalAchieved}
        cities={dataset.cities}
        filters={filters}
        onChange={setFilters}
        sellers={dataset.sellers}
      />

      <ConsistencyPanel issues={issues} />

      {snapshot.incompatibleSelection ? (
        <EmptyStatePanel
          description="Nenhum vendedor selecionado atua na cidade escolhida. Cidade e vendedor são aplicados juntos, como interseção real, então este recorte não tem meta nem realizado. Ajuste um dos dois filtros."
          title="Cidade e vendedor não se cruzam"
        />
      ) : (
        <>
          <KpiSection snapshot={snapshot} />

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.25fr_1fr]">
            <GoalProgress snapshot={snapshot} />
            <StoryPanel story={snapshot.story} />
          </div>

          <AlertsPanel alerts={snapshot.alerts} />

          <ChartPanel
            subtitle={`Duas comparações com os mesmos dias corridos e a mesma escala vertical: cada uma confronta um realizado com o ritmo esperado correspondente. Base atualizada em ${formatIsoAsBrDate(dataset.referenceDate)}.`}
            title={`Evolução diária acumulada de ${snapshot.monthLabel}`}
          >
            <GoalsDailyComparisons daily={snapshot.daily} month={snapshot.month} />
          </ChartPanel>

          <ChartPanel
            subtitle={`Janeiro a julho de 2026, com os filtros de cidade e vendedor aplicados. ${snapshot.monthLabel} está destacado, e os demais meses continuam visíveis.`}
            title="Histórico mensal de meta e realizado"
          >
            <Chart height={300} minWidth={560} option={makeGoalsMonthlyOptions(snapshot.monthly)} />
            <MonthlyChartTable monthly={snapshot.monthly} />
          </ChartPanel>

          <TeamSummaryPanel cities={dataset.cities} snapshot={snapshot} />

          <ContributionPanels snapshot={snapshot} />
        </>
      )}
    </div>
  )
}

/**
 * Fileira de KPIs com uma única leitura gerencial abaixo.
 *
 * Seis overlays independentes escondiam o valor exatamente onde o ponteiro
 * estava e faziam a leitura aparecer e sumir a cada movimento do mouse. Aqui os
 * cards só selecionam, e o texto vive em um painel permanente: o número fica
 * sempre visível, a leitura fica sempre disponível, e existe um lugar só para
 * procurá-la.
 *
 * O primeiro indicador começa selecionado para que o painel nunca apareça vazio.
 * Como os `id` dos cards não dependem do filtro, trocar de mês, cidade ou
 * vendedor atualiza o texto sem devolver a seleção ao primeiro card.
 */
function KpiSection({ snapshot }: { snapshot: CommercialGoalsSnapshot }) {
  const cards = useMemo(() => buildCommercialKpiCards(snapshot), [snapshot])
  const [selectedId, setSelectedId] = useState(() => cards[0].id)
  const selected = cards.find((card) => card.id === selectedId) ?? cards[0]

  return (
    <div className="flex flex-col gap-3.5">
      <div
        aria-label="Indicadores comerciais. Ative um indicador para ler a leitura gerencial dele."
        className="grid grid-cols-1 gap-3.5 [grid-auto-rows:1fr] sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
        role="group"
      >
        {cards.map((card) => (
          <KpiStoryCard
            delta={card.delta}
            icon={card.icon}
            key={card.id}
            leituraTexto={card.leituraTexto}
            leituraTitulo={card.leituraTitulo}
            nome={card.nome}
            observar={card.observar}
            onSelect={() => setSelectedId(card.id)}
            readingMode="external"
            readingPanelId={KPI_READING_PANEL_ID}
            selected={card.id === selected.id}
            setor={card.setor}
            status={card.status}
            tendencia={card.tendencia}
            valor={card.valor}
          />
        ))}
      </div>

      <KpiReadingPanel card={selected} />
    </div>
  )
}
