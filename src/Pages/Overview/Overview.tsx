import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Target,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { ChartCard } from '../../components/dashboard/ChartCard'
import {
  ExecutiveMetricCard,
  ExecutiveSparkline,
} from '../../components/dashboard/ExecutiveMetricCard'
import {
  buildDeltaFromKpi,
  executiveCardColors,
  type ExecutiveCardDelta,
  type ExecutiveCardTone,
} from '../../components/dashboard/executiveMetricCardModel'
import type { Theme } from '../../contexts/PreferencesContextCore'
import { useDashboardData } from '../../contexts/useDashboardData'
import { usePreferences } from '../../contexts/usePreferences'
import type { KpiSparklinePoint } from '../../data/dashboardTypes'
import { formatNumber } from '../../lib/formatters'
import { makeDailyVolumeOptions } from './overviewDailyChartOptions'
import { makeRankingOptions, toRankingPairs } from './overviewRankingChartOptions'
import { makeStatusDistributionOptions } from './overviewStatusChartOptions'

export function Overview() {
  const { theme } = usePreferences()
  const dashboardData = useDashboardData()
  const { kpis, kpiSparklines, charts } = dashboardData

  /**
   * Os cinco indicadores, na ordem e com os nomes, valores e textos gerenciais
   * já aprovados. A cor é identidade fixa do indicador e não muda com o
   * resultado: a interpretação favorável ou desfavorável mora na comparação,
   * cujo tom sai do `positive` já calculado nos agregados (`higherIsGood` por
   * indicador). Total e Técnicos permanecem neutros, como sempre foram.
   */
  const cards: OsExecutiveCard[] = [
    {
      icon: ClipboardList,
      label: 'Total de OS',
      value: kpis.total,
      delta: buildDeltaFromKpi(kpis.totalDelta, 'O total de OS', 'neutro'),
      tone: 'blue',
      points: kpiSparklines.total,
      readingTitle: 'Todas as ordens de serviço abertas no período.',
      readingText:
        'É o tamanho da operação. Sozinho não diz se vai bem: leia junto de {conclusão} e {improdutividade}.',
      observe: 'Crescer o total sem crescer a conclusão vira acúmulo de backlog.',
    },
    {
      icon: CheckCircle2,
      label: 'OS Concluídas',
      value: kpis.completed,
      delta: buildDeltaFromKpi(kpis.completedDelta, 'O volume de OS concluídas'),
      tone: 'green',
      points: kpiSparklines.completed,
      readingTitle: 'Ordens efetivamente finalizadas no período.',
      readingText:
        'Mede a capacidade real de entrega. Avança junto do {volume}? Então a operação está {escalando}.',
      observe: 'A distância entre Total e Concluídas é o que ficou pendente.',
    },
    {
      icon: UsersRound,
      label: 'Técnicos Ativos',
      value: formatNumber(kpis.activeTechnicians),
      // Sem comparação com o período anterior: o indicador nunca teve uma, e a
      // faixa recebe o mesmo contexto curto de sempre, em tom neutro.
      delta: {
        label: 'Em campo no período',
        accessibleLabel: 'técnicos em campo no período',
        tone: 'neutro',
      },
      tone: 'violet',
      points: kpiSparklines.activeTechnicians,
      readingTitle: 'Técnicos que atuaram em campo no período.',
      readingText:
        'Base de capacidade da operação. Serve para {dimensionar} a produtividade e a carga por técnico.',
      observe: 'Poucos técnicos com muita OS = risco de fila e de improdutividade.',
    },
    {
      icon: Target,
      label: 'Taxa de Conclusão',
      value: kpis.completionRate,
      delta: buildDeltaFromKpi(kpis.completionDelta, 'A taxa de conclusão'),
      tone: 'indigo',
      points: kpiSparklines.completionRate,
      readingTitle: 'Percentual das OS do período que foram concluídas.',
      readingText:
        'Termômetro de eficiência. Queda persistente aponta {gargalo} de capacidade ou {improdutividade} alta.',
      observe: 'Leia junto da improdutividade: uma costuma explicar a outra.',
    },
    {
      icon: AlertTriangle,
      label: 'Taxa Improdutividade',
      value: kpis.unproductiveRate,
      delta: buildDeltaFromKpi(kpis.unproductiveDelta, 'A taxa de improdutividade'),
      tone: 'amber',
      points: kpiSparklines.unproductiveRate,
      readingTitle: 'Fatia das OS que não geraram resultado produtivo.',
      readingText:
        'Cada ponto é {deslocamento e tempo pagos} sem entrega. Puxa a taxa de conclusão para baixo.',
      observe: 'Abra por motivo e por técnico para atacar a causa raiz.',
    },
  ]

  return (
    <div>
      <OsExecutiveCards cards={cards} theme={theme} />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        {/* `os-daily-volume` escopa a superfície escura deste painel, para ele
            acompanhar os cards executivos acima. Os demais gráficos da página
            continuam na variante padrão. */}
        <ChartCard
          className="os-daily-volume"
          subtitle="Total agendado x concluído - últimos 45 dias"
          title="Volume diário de OS"
          variant="executive"
        >
          <Chart
            height={280}
            option={makeDailyVolumeOptions(
              charts.overviewDay.x,
              charts.overviewDay.total,
              charts.overviewDay.completed,
              theme,
            )}
          />
        </ChartCard>
        {/* Barras horizontais no lugar da rosca: comparar cinco fatias é
            impreciso, e aqui a diferença entre dois status é um comprimento,
            com quantidade e participação escritas na própria linha. */}
        <ChartCard
          className="os-status-distribution"
          subtitle="Participação de cada status"
          title="Distribuição por status"
          variant="executive"
        >
          <Chart
            height={280}
            option={makeStatusDistributionOptions(charts.statusPairs, charts.statusColors, theme)}
          />
        </ChartCard>
      </div>
      {/* Os dois rankings compartilham o mesmo gerador: são a mesma leitura,
          uma contagem ordenada por item, e só mudam a coleção e a cor de
          identidade. `os-ranking` escopa a superfície escura dos dois. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard
          className="os-ranking os-category-volume"
          subtitle="Onde a operação mais atua"
          title="Volume por categoria"
          variant="executive"
        >
          <Chart
            height={250}
            option={makeRankingOptions({
              color: '#2f6bff',
              items: toRankingPairs(charts.categoryBar.labels, charts.categoryBar.values),
              name: 'Volume por categoria',
              theme,
            })}
          />
        </ChartCard>
        <ChartCard
          className="os-ranking os-resolution-ranking"
          subtitle="Desfecho das OS concluídas · Top 10"
          title="Resoluções mais frequentes"
          variant="executive"
        >
          {/* Projeção visual: só as 10 resoluções mais frequentes do recorte
              cabem legíveis aqui; o catálogo e o filtro seguem com as 29. */}
          <Chart
            height={250}
            option={makeRankingOptions({
              color: '#00b3a4',
              items: charts.resolutionTopPairs,
              name: 'Resoluções mais frequentes',
              theme,
            })}
          />
        </ChartCard>
      </div>
    </div>
  )
}

/** Um card da coleção executiva de OS: sempre valor + comparação + minigráfico. */
type OsExecutiveCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly tone: ExecutiveCardTone
  readonly value: string
  readonly delta: ExecutiveCardDelta
  readonly points: readonly KpiSparklinePoint[]
  readonly readingTitle: string
  readonly readingText: string
  readonly observe: string
}

function OsExecutiveCards({ cards, theme }: { cards: OsExecutiveCard[]; theme: Theme }) {
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

  return (
    <section
      aria-label="Indicadores executivos das ordens de serviço"
      // `os-executive-cards` escopa os ajustes de tema escuro a esta coleção,
      // sem tocar nos tokens globais nem nos gráficos abaixo. Cinco colunas só
      // entram onde cada card mantém valor, comparação e leitura gerencial
      // legíveis; antes disso a grade segura três por linha.
      className="os-executive-cards mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
      ref={containerRef}
    >
      {cards.map((card) => (
        <ExecutiveMetricCard
          // Só o valor: a comparação tem a própria leitura acessível dentro do
          // card, e repeti-la aqui faria o percentual ser anunciado duas vezes.
          accessibleText={`${card.label}: ${card.value}.`}
          delta={card.delta}
          icon={card.icon}
          key={card.label}
          label={card.label}
          observe={card.observe}
          onToggle={() =>
            setOpenCard((current) => (current === card.label ? null : card.label))
          }
          open={openCard === card.label}
          readingText={card.readingText}
          readingTitle={card.readingTitle}
          theme={theme}
          tone={card.tone}
          value={card.value}
          variant="spark"
        >
          <ExecutiveSparkline color={executiveCardColors[card.tone]} points={card.points} />
        </ExecutiveMetricCard>
      ))}
    </section>
  )
}
