import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeLineOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { dashboardData } from '../../data/dashboardAggregates'

export function Temporal() {
  const { charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <ChartCard title="OS por dia" subtitle="Série diária completa do período (01/04 - 30/06)">
        <Chart height={300} option={makeLineOptions(charts.daily.x, [{ name: 'OS', data: charts.daily.total, color: '#2f6bff', area: true }])} />
      </ChartCard>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="OS por semana" subtitle="Agrupamento semanal">
          <Chart height={280} option={makeBarOptions(charts.weekly.x, charts.weekly.total)} />
        </ChartCard>
        <ChartCard title="OS por mês" subtitle="Comparação mensal">
          <Chart height={280} option={makeBarOptions(charts.monthly.x, charts.monthly.values, '#00b3a4')} />
        </ChartCard>
      </div>
      <ChartCard title="Evolução: concluídas x improdutivas" subtitle="Tendência semanal comparada">
        <Chart height={300} option={makeLineOptions(charts.evolution.x, [
          { name: 'Concluídas', data: charts.evolution.completed, color: '#16a34a' },
          { name: 'Improdutivas', data: charts.evolution.unproductive, color: '#e5484d' },
        ])} />
      </ChartCard>
    </div>
  )
}
