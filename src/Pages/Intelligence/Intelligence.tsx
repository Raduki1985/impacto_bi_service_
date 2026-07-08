import { Sparkles } from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeStackedBarOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { WordCloud } from '../../components/dashboard/WordCloud'
import { dashboardData } from '../../data/dashboardAggregates'

export function Intelligence() {
  const { intelligence, wordCloud, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="flex items-start gap-3 rounded-xl border border-[#d6e2ff] bg-[#eef3ff] px-4 py-3.5 text-[12.5px] leading-6 text-[#33507f]">
        <Sparkles className="mt-0.5 flex-none text-[var(--accent)]" size={18} aria-hidden="true" />
        <div>
          As anotações dos técnicos são classificadas automaticamente por regras de palavras-chave em grupos operacionais. Base de <b>{intelligence.totalNotes}</b> anotações analisadas.
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.15fr_1fr]">
        <ChartCard title="Nuvem de palavras" subtitle="Termos mais frequentes nas anotações">
          <WordCloud words={wordCloud} />
        </ChartCard>
        <ChartCard title="Ranking de assuntos" subtitle="Classificação automática">
          <Chart height={300} option={makeBarOptions(charts.intelligenceBar.map(([label]) => label), charts.intelligenceBar.map(([, value]) => value), '#2f6bff', true)} />
        </ChartCard>
      </div>
      <ChartCard title="Tendência dos assuntos por semana" subtitle="Como cada grupo de problema evolui">
        <Chart height={320} option={makeStackedBarOptions(charts.intelligenceTrend.x, charts.intelligenceTrend.series)} />
      </ChartCard>
    </div>
  )
}
