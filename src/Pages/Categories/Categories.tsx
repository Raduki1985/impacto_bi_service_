import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeHeatmapOptions, makeStackedBarOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function Categories() {
  const dashboardData = useDashboardData()
  const { charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="OS por categoria" subtitle="Volume absoluto">
          <Chart height={300} option={makeBarOptions(charts.categoryBar.labels, charts.categoryBar.values, '#2f6bff', true)} />
        </ChartCard>
        <ChartCard title="Participação por categoria" subtitle="Percentual do total">
          <Chart height={300} option={makeDonutOptions(charts.categoryBar.labels.map((label, index) => [label, charts.categoryBar.values[index]]))} />
        </ChartCard>
      </div>
      <ChartCard title="Categoria x Status" subtitle="Composição de status por categoria">
        <Chart height={320} option={makeStackedBarOptions(charts.categoryStatus.x, charts.categoryStatus.series)} />
      </ChartCard>
      <ChartCard title="Categoria x Resolução" subtitle="Matriz de calor de desfechos · Top 10 + Outras">
        <Chart height={340} option={makeHeatmapOptions(charts.categoryResolution.x, charts.categoryResolution.y, charts.categoryResolution.data, charts.categoryResolution.max)} />
      </ChartCard>
    </div>
  )
}
