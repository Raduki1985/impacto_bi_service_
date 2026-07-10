import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeLineOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { KpiCard } from '../../components/dashboard/KpiCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function Overview() {
  const dashboardData = useDashboardData()
  const { kpis, charts } = dashboardData
  const statusColors = charts.statusPairs.map(([status]) => charts.statusColors[status])

  return (
    <div>
      <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3.5">
        <KpiCard accent="blue" detailTone="neutral" icon="clipboard" label="Total de OS" value={kpis.total} helper={`${kpis.totalDelta.text} vs. mês anterior`} />
        <KpiCard accent="green" detailTone={kpis.completedDelta.positive ? 'positive' : 'negative'} icon="check" label="OS Concluídas" value={kpis.completed} helper={`${kpis.completedDelta.text} vs. mês anterior`} />
        <KpiCard accent="green" detailTone={kpis.completionDelta.positive ? 'positive' : 'negative'} icon="target" label="Taxa de Conclusão" value={kpis.completionRate} helper={`${kpis.completionDelta.text} vs. mês anterior`} valueTone="positive" />
        <KpiCard accent="red" detailTone={kpis.unproductiveDelta.positive ? 'positive' : 'negative'} icon="alert" label="Taxa Improdutividade" value={kpis.unproductiveRate} helper={`${kpis.unproductiveDelta.text} vs. mês anterior`} valueTone="negative" />
        <KpiCard accent="indigo" detailTone={kpis.timeDelta.positive ? 'positive' : 'negative'} icon="clock" label="Tempo Médio Atend." value={kpis.averageTime} helper={`${kpis.timeDelta.text} vs. mês anterior`} />
        <KpiCard accent="teal" detailTone="neutral" icon="users" label="Técnicos Ativos" value={kpis.activeTechnicians} helper="em campo no período" />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <ChartCard title="Volume diário de OS" subtitle="Total agendado x concluído - últimos 45 dias">
          <Chart height={280} option={makeLineOptions(charts.overviewDay.x, [
            { name: 'Total', data: charts.overviewDay.total, color: '#2f6bff', area: true },
            { name: 'Concluídas', data: charts.overviewDay.completed, color: '#16a34a' },
          ])} />
        </ChartCard>
        <ChartCard title="Distribuição por status" subtitle="Participação de cada status">
          <Chart height={280} option={makeDonutOptions(charts.statusPairs, statusColors)} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Volume por categoria" subtitle="Onde a operação mais atua">
          <Chart height={250} option={makeBarOptions(charts.categoryBar.labels, charts.categoryBar.values, '#2f6bff', true)} />
        </ChartCard>
        <ChartCard title="Resoluções mais frequentes" subtitle="Desfecho das OS concluídas">
          <Chart height={250} option={makeBarOptions(charts.resolutionPairs.map(([label]) => label), charts.resolutionPairs.map(([, value]) => value), '#00b3a4', true)} />
        </ChartCard>
      </div>
    </div>
  )
}
