import { AlertTriangle, Tag, XCircle } from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeLineOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { KpiStoryCard } from '../../components/dashboard/KpiStoryCard'
import { useDashboardData } from '../../contexts/useDashboardData'

export function Unproductive() {
  const dashboardData = useDashboardData()
  const { kpis, unproductive, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 [grid-auto-rows:1fr] sm:grid-cols-2 lg:grid-cols-3">
        <KpiStoryCard
          setor="IMPRODUTIVIDADE"
          icon={XCircle}
          nome="Total improdutivas"
          valor={kpis.unproductive}
          delta="OS sem resultado produtivo"
          status="bad"
          tendencia="neutro"
          leituraTitulo="Total de OS que terminaram improdutivas."
          leituraTexto="Volume direto de {esforço desperdiçado}. Cada uma é deslocamento e tempo sem entrega ao cliente."
          observar="Acompanhe a evolução semanal: a tendência importa mais que o número isolado."
        />
        <KpiStoryCard
          setor="IMPRODUTIVIDADE"
          icon={AlertTriangle}
          nome="Taxa de improdutividade"
          valor={kpis.unproductiveRate}
          delta="do total de OS do período"
          status="bad"
          tendencia="neutro"
          leituraTitulo="Percentual de improdutivas sobre o total de OS."
          leituraTexto="Normaliza o volume pelo tamanho da operação. É a métrica que {compara períodos} de forma justa."
          observar="Meça contra a meta interna; acima dela, priorize os motivos do topo."
        />
        <KpiStoryCard
          setor="IMPRODUTIVIDADE"
          icon={Tag}
          nome="Motivo mais comum"
          valor={unproductive.topReason}
          delta={`${unproductive.topReasonPercent} das improdutivas`}
          status="warn"
          tendencia="neutro"
          leituraTitulo="Principal motivo de improdutividade do período."
          leituraTexto="Mostra {onde atacar primeiro}. Concentração alta num motivo é oportunidade rápida de correção."
          observar="Se for 'cliente ausente', reforce a confirmação prévia do agendamento."
        />
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
