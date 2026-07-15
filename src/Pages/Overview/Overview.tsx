import { AlertTriangle, CheckCircle2, ClipboardList, Target, TimerReset, UsersRound } from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeDonutOptions, makeLineOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { KpiStoryCard } from '../../components/dashboard/KpiStoryCard'
import { useDashboardData } from '../../contexts/useDashboardData'
import type { KpiDelta } from '../../data/dashboardTypes'

/**
 * Deriva status + tendência a partir de um KpiDelta já existente, sem inventar
 * regras de negócio: usa apenas o sinal `positive` já calculado no projeto.
 * Sem período anterior com dados, fica neutro.
 */
function statusFromDelta(delta: KpiDelta) {
  if (!delta.available) return { status: 'neutral', tendencia: 'neutro' } as const
  return delta.positive
    ? ({ status: 'ok', tendencia: 'favoravel' } as const)
    : ({ status: 'bad', tendencia: 'desfavoravel' } as const)
}

/** Rótulo da comparação: "N/A" quando não há período anterior com dados. */
function periodDelta(delta: KpiDelta) {
  return delta.available ? `${delta.text} vs. período anterior` : 'N/A'
}

export function Overview() {
  const dashboardData = useDashboardData()
  const { kpis, charts } = dashboardData
  const statusColors = charts.statusPairs.map(([status]) => charts.statusColors[status])

  const completed = statusFromDelta(kpis.completedDelta)
  const completion = statusFromDelta(kpis.completionDelta)
  const unproductive = statusFromDelta(kpis.unproductiveDelta)
  const time = statusFromDelta(kpis.timeDelta)

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3.5 [grid-auto-rows:1fr] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiStoryCard
          setor="DEMANDA"
          icon={ClipboardList}
          nome="Total de OS"
          valor={kpis.total}
          delta={periodDelta(kpis.totalDelta)}
          status="neutral"
          tendencia="neutro"
          leituraTitulo="Todas as ordens de serviço abertas no período."
          leituraTexto="É o tamanho da operação. Sozinho não diz se vai bem: leia junto de {conclusão} e {improdutividade}."
          observar="Crescer o total sem crescer a conclusão vira acúmulo de backlog."
        />
        <KpiStoryCard
          setor="ENTREGA"
          icon={CheckCircle2}
          nome="OS Concluídas"
          valor={kpis.completed}
          delta={periodDelta(kpis.completedDelta)}
          status={completed.status}
          tendencia={completed.tendencia}
          leituraTitulo="Ordens efetivamente finalizadas no período."
          leituraTexto="Mede a capacidade real de entrega. Avança junto do {volume}? Então a operação está {escalando}."
          observar="A distância entre Total e Concluídas é o que ficou pendente."
        />
        <KpiStoryCard
          setor="EFICIÊNCIA"
          icon={Target}
          nome="Taxa de Conclusão"
          valor={kpis.completionRate}
          delta={periodDelta(kpis.completionDelta)}
          status={completion.status}
          tendencia={completion.tendencia}
          leituraTitulo="Percentual das OS do período que foram concluídas."
          leituraTexto="Termômetro de eficiência. Queda persistente aponta {gargalo} de capacidade ou {improdutividade} alta."
          observar="Leia junto da improdutividade: uma costuma explicar a outra."
        />
        <KpiStoryCard
          setor="QUALIDADE"
          icon={AlertTriangle}
          nome="Taxa Improdutividade"
          valor={kpis.unproductiveRate}
          delta={periodDelta(kpis.unproductiveDelta)}
          status={unproductive.status}
          tendencia={unproductive.tendencia}
          leituraTitulo="Fatia das OS que não geraram resultado produtivo."
          leituraTexto="Cada ponto é {deslocamento e tempo pagos} sem entrega. Puxa a taxa de conclusão para baixo."
          observar="Abra por motivo e por técnico para atacar a causa raiz."
        />
        <KpiStoryCard
          setor="PRODUTIVIDADE"
          icon={TimerReset}
          nome="Tempo Médio Atend."
          valor={kpis.averageTime}
          delta={periodDelta(kpis.timeDelta)}
          status={time.status}
          tendencia={time.tendencia}
          leituraTitulo="Tempo médio para concluir cada atendimento."
          leituraTexto="Tempo alto reduz OS por dia e {atrasa a fila}. Cair é bom, desde que não derrube a qualidade."
          observar="Veja se é complexidade real da OS ou fila mal distribuída no dia."
        />
        <KpiStoryCard
          setor="EQUIPE"
          icon={UsersRound}
          nome="Técnicos Ativos"
          valor={kpis.activeTechnicians}
          delta="em campo no período"
          status="neutral"
          tendencia="neutro"
          leituraTitulo="Técnicos que atuaram em campo no período."
          leituraTexto="Base de capacidade da operação. Serve para {dimensionar} a produtividade e a carga por técnico."
          observar="Poucos técnicos com muita OS = risco de fila e de improdutividade."
        />
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
