import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeStackedBarOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function OrderStatus() {
  const dashboardData = useDashboardData()
  const { charts } = dashboardData
  const colors = charts.statusPairs.map(([status]) => charts.statusColors[status])

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Distribuição por status" subtitle="Participação percentual">
          <Chart height={300} option={makeDonutOptions(charts.statusPairs, colors)} />
        </ChartCard>
        <ChartCard title="Quantidade por status" subtitle="Contagem absoluta">
          <Chart height={300} option={makeBarOptions(charts.statusPairs.map(([label]) => label), charts.statusPairs.map(([, value]) => value), '#2f6bff', true)} />
        </ChartCard>
      </div>
      <ChartCard title="Status por período do dia" subtitle="Manhã, tarde e noite">
        <Chart height={300} option={makeStackedBarOptions(charts.statusPeriod.x, charts.statusPeriod.series)} />
      </ChartCard>
    </div>
  )
}
