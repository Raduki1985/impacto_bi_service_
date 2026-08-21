import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeStackedBarOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { useDashboardData } from '../../contexts/useDashboardData'

/** Paleta padrão dos gráficos, com cinza neutro reservado à fatia `Outras`. */
const sharePalette = ['#2f6bff', '#00b3a4', '#f5a623', '#e5484d', '#8b5cf6', '#0ea5e9', '#64748b']
const OTHERS_COLOR = '#94a3b8'

export function Resolutions() {
  const dashboardData = useDashboardData()
  const { charts } = dashboardData
  // Projeções visuais do recorte filtrado: o ranking mostra o Top 10 exato e a
  // participação soma o restante em `Outras`, sem perder nenhum total. O
  // catálogo completo e o filtro Resolução continuam com as 29 resoluções.
  const topLabels = charts.resolutionTopPairs.map(([label]) => label)
  const topValues = charts.resolutionTopPairs.map(([, value]) => value)
  const shareColors = charts.resolutionTopWithOthers.map(([label], index) =>
    label === 'Outras' ? OTHERS_COLOR : sharePalette[index % sharePalette.length],
  )

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <ChartCard title="Resoluções mais utilizadas" subtitle="Ranking absoluto · Top 10">
          <Chart height={300} option={makeBarOptions(topLabels, topValues, '#2f6bff', true)} />
        </ChartCard>
        <ChartCard title="Participação por resolução" subtitle="Percentual · Top 10 + Outras">
          <Chart height={300} option={makeDonutOptions(charts.resolutionTopWithOthers, shareColors)} />
        </ChartCard>
      </div>
      <ChartCard title="Resolução por categoria" subtitle="Barras empilhadas · Top 10 + Outras">
        <Chart height={340} option={makeStackedBarOptions(charts.resolutionCategoryTop.x, charts.resolutionCategoryTop.series)} />
      </ChartCard>
    </div>
  )
}
