import { CalendarCheck, CalendarClock, Gauge } from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { makeCalendarHeatmapOptions, makeHeatmapOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { KpiStoryCard } from '../../components/dashboard/KpiStoryCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function OperationalCalendar() {
  const dashboardData = useDashboardData()
  const { calendar, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 [grid-auto-rows:1fr] sm:grid-cols-2 lg:grid-cols-3">
        <KpiStoryCard
          setor="CALENDÁRIO"
          icon={CalendarCheck}
          nome="Dia de maior demanda"
          valor={calendar.peak}
          delta={`${calendar.peakQuantity} OS registradas`}
          status="neutral"
          tendencia="neutro"
          leituraTitulo="Dia com o maior volume de OS no período."
          leituraTexto="Revela o {pico de carga} da operação. Use para escalar equipe e evitar fila nos dias quentes."
          observar="Pico recorrente no mesmo dia da semana pede reforço fixo de escala."
        />
        <KpiStoryCard
          setor="CALENDÁRIO"
          icon={CalendarClock}
          nome="Dia mais crítico"
          valor={calendar.critical}
          delta={`${calendar.criticalQuantity} improdutivas`}
          status="bad"
          tendencia="neutro"
          leituraTitulo="Dia com mais OS improdutivas no período."
          leituraTexto="Concentra as {falhas de execução}. Costuma coincidir com pico de demanda ou escala reduzida."
          observar="Compare com o dia de maior demanda. Se baterem, o gargalo é capacidade."
        />
        <KpiStoryCard
          setor="CALENDÁRIO"
          icon={Gauge}
          nome="Média diária"
          valor={`${calendar.average} OS/dia`}
          delta="dias úteis do período"
          status="neutral"
          tendencia="neutro"
          leituraTitulo="Média de OS realizadas por dia útil."
          leituraTexto="Linha de base do {ritmo diário}. Serve de referência para medir os picos e vales do calendário."
          observar="Dias muito abaixo da média podem indicar ociosidade ou falta de agendamento."
        />
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
