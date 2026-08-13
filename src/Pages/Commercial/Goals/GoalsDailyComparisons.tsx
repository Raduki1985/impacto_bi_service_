import { Chart } from '../../../components/charts/Chart'
import type { CommercialMonthKey } from '../../../data/commercialTypes'
import type { CommercialDailyPoint } from './commercialGoalsModel'
import {
  goalsColors,
  goalsDailyScaleMax,
  makeGoalsDailyComparisonOptions,
  type GoalsDailyComparison,
} from './goalsChartOptions'
import { DailyChartTable } from './GoalsChartTable'

/**
 * Evolução diária acumulada, em duas faixas de desempenho.
 *
 * Quatro linhas no mesmo eixo obrigavam a pessoa a descobrir sozinha quais duas
 * se comparam entre si. Aqui cada faixa responde a uma pergunta e tem somente
 * duas linhas: o realizado daquele numerador e a referência daquele numerador.
 *
 * As duas faixas dividem os mesmos dias e o mesmo teto vertical. Isso é o que
 * torna a leitura lado a lado honesta: uma linha mais alta é de fato um número
 * maior, e não um eixo mais generoso.
 */
export function GoalsDailyComparisons({
  daily,
  month,
}: {
  daily: readonly CommercialDailyPoint[]
  month: CommercialMonthKey
}) {
  const scaleMax = goalsDailyScaleMax(daily)

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ComparisonBand
          accent={goalsColors.goalAchieved}
          comparison="meta"
          daily={daily}
          question="O realizado da meta está acompanhando o ritmo esperado da meta?"
          scaleMax={scaleMax}
          title="Meta normal"
        />
        <ComparisonBand
          accent={goalsColors.totalAchieved}
          comparison="supermeta"
          daily={daily}
          question="O realizado total está acompanhando o ritmo esperado da supermeta?"
          scaleMax={scaleMax}
          title="Supermeta"
        />
      </div>

      {/* Fora do tooltip e fora da área desenhada, de propósito: é a regra que
          diferencia os dois numeradores, e ela precisa estar disponível o tempo
          todo, e não só enquanto o ponteiro está sobre uma linha. */}
      <p className="mt-3 border-t border-[var(--divider)] pt-2.5 text-[11.5px] leading-[1.5] text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-item)]">Meta normal</span> soma Vendas
        Internas e Colaboradores.{' '}
        <span className="font-semibold text-[var(--text-item)]">Supermeta</span> usa o realizado
        total, que inclui também o Corporativo. As duas comparações usam os mesmos dias e a mesma
        escala vertical.
      </p>

      <DailyChartTable comparison="meta" daily={daily} month={month} />
      <DailyChartTable comparison="supermeta" daily={daily} month={month} />
    </div>
  )
}

/**
 * Uma faixa de desempenho.
 *
 * A borda esquerda colorida repete o idioma que a página já usa nos alertas e
 * amarra o título à cor da linha cheia do gráfico logo abaixo, sem criar uma
 * superfície nova sobre a superfície do cartão.
 */
function ComparisonBand({
  accent,
  comparison,
  daily,
  question,
  scaleMax,
  title,
}: {
  accent: string
  comparison: GoalsDailyComparison
  daily: readonly CommercialDailyPoint[]
  question: string
  scaleMax: number | undefined
  title: string
}) {
  return (
    <section
      className="min-w-0 rounded-xl border border-l-[3px] border-[var(--border)] px-3 py-2.5"
      style={{ borderLeftColor: accent }}
    >
      <h3 className="text-[12.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-item)]">
        {title}
      </h3>
      <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--text-secondary)]">{question}</p>
      <div className="mt-1.5">
        {/* 240px é o piso de legibilidade das 31 categorias, e fica abaixo da
            largura útil da faixa em 390px (cerca de 274px): em celular a faixa
            cabe inteira e o gráfico não abre rolagem horizontal própria. */}
        <Chart
          height={250}
          minWidth={240}
          option={makeGoalsDailyComparisonOptions(daily, comparison, scaleMax)}
        />
      </div>
    </section>
  )
}
