import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeLineOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { KpiCard } from '../../components/dashboard/KpiCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function Unproductive() {
  const dashboardData = useDashboardData()
  const { kpis, unproductive, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <KpiCard accent="red" icon="xCircle" label="Total improdutivas" value={kpis.unproductive} />
        <KpiCard accent="red" icon="alert" label="Taxa de improdutividade" value={kpis.unproductiveRate} valueTone="negative" />
        <KpiCard accent="orange" icon="tag" label="Motivo mais comum" value={unproductive.topReason} helper={`${unproductive.topReasonPercent} das improdutivas`} />
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Motivos de improdutividade" subtitle="Frequência dos motivos">
          <Chart height={300} option={makeBarOptions(charts.unproductiveReason.map(([label]) => label), charts.unproductiveReason.map(([, value]) => value), '#e5484d', true)} />
        </ChartCard>
        <ChartCard title="Improdutividade por período" subtitle="Manhã / tarde / noite">
          <Chart height={300} option={makeDonutOptions(charts.unproductivePeriod, ['#f5a623', '#2f6bff', '#8b5cf6'])} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Improdutividade por técnico" subtitle="Quem precisa de acompanhamento">
          <Chart height={340} option={makeBarOptions(charts.unproductiveTechnician.map(([label]) => label), charts.unproductiveTechnician.map(([, value]) => value), '#e5484d', true)} />
        </ChartCard>
        <ChartCard title="Improdutividade por categoria" subtitle="Categorias com maior falha">
          <Chart height={340} option={makeBarOptions(charts.unproductiveCategory.map(([label]) => label), charts.unproductiveCategory.map(([, value]) => value), '#f5a623', true)} />
        </ChartCard>
      </div>
      <ChartCard title="Evolução histórica da improdutividade" subtitle="Volume semanal">
        <Chart height={300} option={makeLineOptions(charts.unproductiveEvolution.x, [{ name: 'Improdutivas', data: charts.unproductiveEvolution.values, color: '#e5484d', area: true }])} />
      </ChartCard>
    </div>
  )
}
