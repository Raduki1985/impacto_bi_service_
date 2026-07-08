import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeStackedBarOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { dashboardData } from '../../data/dashboardAggregates'

export function Resolutions() {
  const { charts } = dashboardData
  const labels = charts.resolutionPairs.map(([label]) => label)
  const values = charts.resolutionPairs.map(([, value]) => value)

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Resoluções mais utilizadas" subtitle="Ranking absoluto">
          <Chart height={300} option={makeBarOptions(labels, values, '#2f6bff', true)} />
        </ChartCard>
        <ChartCard title="Participação por resolução" subtitle="Percentual">
          <Chart height={300} option={makeDonutOptions(charts.resolutionPairs)} />
        </ChartCard>
      </div>
      <ChartCard title="Resolução por categoria" subtitle="Barras empilhadas">
        <Chart height={340} option={makeStackedBarOptions(charts.resolutionCategory.x, charts.resolutionCategory.series)} />
      </ChartCard>
    </div>
  )
}
