import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeLineOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function ClosingReasons() {
  const dashboardData = useDashboardData()
  const { charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Motivos de fechamento" subtitle="Quantidade por motivo">
          <Chart height={300} option={makeBarOptions(charts.closingReason.map(([label]) => label), charts.closingReason.map(([, value]) => value), '#64748b', true)} />
        </ChartCard>
        <ChartCard title="Participação" subtitle="Percentual por motivo">
          <Chart height={300} option={makeDonutOptions(charts.closingReason, ['#64748b', '#8b5cf6', '#f5a623', '#e5484d'])} />
        </ChartCard>
      </div>
      <ChartCard title="Evolução dos fechamentos" subtitle="Volume semanal">
        <Chart height={300} option={makeLineOptions(charts.closingEvolution.x, [{ name: 'Fechamentos', data: charts.closingEvolution.values, color: '#64748b', area: true }])} />
      </ChartCard>
    </div>
  )
}
