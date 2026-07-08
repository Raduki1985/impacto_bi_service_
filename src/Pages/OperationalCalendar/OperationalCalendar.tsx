import { Chart } from '../../components/charts/Chart'
import { makeCalendarHeatmapOptions, makeHeatmapOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { KpiCard } from '../../components/dashboard/KpiCard'
import { dashboardData } from '../../data/dashboardAggregates'

export function OperationalCalendar() {
  const { calendar, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <KpiCard label="Dia de maior demanda" value={calendar.peak} helper={`${calendar.peakQuantity} OS registradas`} />
        <KpiCard label="Dia mais crítico" value={calendar.critical} helper={`${calendar.criticalQuantity} improdutivas`} tone="danger" />
        <KpiCard label="Média diária" value={`${calendar.average} OS/dia`} helper="dias úteis do período" />
      </div>
      <ChartCard title="Heatmap de calendário" subtitle="Intensidade de OS por dia - identifique picos e vales">
        <Chart height={220} minWidth={760} option={makeCalendarHeatmapOptions(charts.calendarRange, charts.calendarDay)} />
      </ChartCard>
      <ChartCard title="Dia da semana x semana" subtitle="Padrões recorrentes de demanda">
        <Chart height={320} option={makeHeatmapOptions(charts.dayOfWeekByWeek.x, charts.dayOfWeekByWeek.y, charts.dayOfWeekByWeek.data, charts.dayOfWeekByWeek.max)} />
      </ChartCard>
    </div>
  )
}
