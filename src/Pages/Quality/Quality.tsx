import { Chart } from '../../components/charts/Chart'
import { makeHeatmapOptions, makeStackedBarOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { dashboardData } from '../../data/dashboardAggregates'

export function Quality() {
  const { charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Categoria x Resolução" subtitle="Matriz de calor">
          <Chart height={360} option={makeHeatmapOptions(charts.qualityCategoryResolution.x, charts.qualityCategoryResolution.y, charts.qualityCategoryResolution.data, charts.qualityCategoryResolution.max)} />
        </ChartCard>
        <ChartCard title="Categoria x Improdutividade" subtitle="Onde e por que falha">
          <Chart height={360} option={makeHeatmapOptions(charts.qualityCategoryUnproductive.x, charts.qualityCategoryUnproductive.y, charts.qualityCategoryUnproductive.data, charts.qualityCategoryUnproductive.max)} />
        </ChartCard>
      </div>
      <ChartCard title="Status x Categoria" subtitle="Composição empilhada">
        <Chart height={320} option={makeStackedBarOptions(charts.qualityStatusCategory.x, charts.qualityStatusCategory.series)} />
      </ChartCard>
      <ChartCard title="Status x Técnico" subtitle="Matriz de calor de desempenho">
        <Chart height={420} option={makeHeatmapOptions(charts.qualityStatusTechnician.x, charts.qualityStatusTechnician.y, charts.qualityStatusTechnician.data, charts.qualityStatusTechnician.max)} />
      </ChartCard>
    </div>
  )
}
