import { monthLabel } from '../../../data/commercialCalendar'
import type { CommercialMonthKey } from '../../../data/commercialTypes'
import { formatNumber } from '../../../lib/formatters'
import type { CommercialDailyPoint, CommercialMonthlyPoint } from './commercialGoalsModel'
import type { GoalsDailyComparison } from './goalsChartOptions'

/**
 * Alternativa acessível dos gráficos.
 *
 * O ECharts desenha em canvas: para um leitor de tela o gráfico é uma imagem
 * sem conteúdo, e nenhum valor da série é alcançável. Cada gráfico desta página
 * publica então os mesmos números em uma tabela `sr-only`, que fica fora da tela
 * mas dentro da árvore de acessibilidade, com cabeçalhos de coluna e de linha.
 *
 * Não há duplicação visual: a tabela nunca é pintada. Também não há duplicação
 * na leitura, porque o canvas não expõe texto algum.
 *
 * Fica aqui, e não no `Chart` compartilhado: o componente compartilhado não
 * conhece o significado das séries, e cada página precisa das próprias colunas.
 */

type TableRow = {
  readonly id: string
  readonly header: string
  readonly cells: readonly string[]
}

function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: readonly string[]
  rows: readonly TableRow[]
}) {
  return (
    /*
     * Contêiner oculto e ancorado na viewport. As duas coisas são necessárias,
     * e cada uma resolve um problema diferente.
     *
     * 1. Por que o `sr-only` fica aqui e nunca no próprio `<table>`.
     *
     * A regra é `position:absolute; width:1px; height:1px; overflow:hidden;
     * clip-path:inset(50%)`. Sobre uma caixa de tabela ela não segura nada: o
     * algoritmo de layout de tabela trata a largura declarada como mínimo e
     * expande a caixa até o conteúdo, `overflow` não se aplica a caixa de
     * tabela, e `clip-path` recorta apenas a pintura, jamais o layout. A tabela
     * ficava com o tamanho real e alargava o documento. Em um `<div>`, que é
     * contêiner de bloco, as três declarações valem: a caixa fica com 1px e o
     * `overflow:hidden` recorta a tabela sem deixar o transbordo subir.
     *
     * 2. Por que o contêiner é `fixed`, e não o `absolute` do `sr-only`.
     *
     * Sem `top` e `left` e sem ancestral posicionado, o elemento absoluto usa a
     * própria posição estática, que é a posição do gráfico dentro do conteúdo,
     * e o bloco containing dele é o documento, e não o `<main>`. Ou seja: ele
     * escapava da rolagem do `<main>` e ia parar lá embaixo em coordenadas de
     * documento, perto de y = 3.992 no mobile. Mesmo medindo 1px, isso estica o
     * `scrollHeight` do documento e cria a segunda barra vertical.
     *
     * `fixed` em `top:0; left:0` resolve na raiz: elemento fixo é posicionado
     * pela viewport e não entra na área rolável do documento. Com o `margin:-1px`
     * que o `sr-only` já aplica, a caixa ainda cai fora da tela, e
     * `pointer-events-none` garante que esse 1px no canto não intercepte clique
     * nenhum.
     *
     * `fixed` prevalece sobre o `absolute` do `sr-only` porque, no CSS
     * compilado, `.fixed` é declarada depois de `.sr-only`, e as duas têm a
     * mesma especificidade. Se um dia essa ordem mudar, a barra externa volta:
     * neste arquivo, trocar as classes por estilo explícito resolve.
     *
     * Nada é retirado da árvore de acessibilidade: sem `display:none`, sem
     * `hidden`, sem `visibility:hidden` e sem `aria-hidden`. A tabela segue
     * anunciada, navegável e com a semântica completa.
     */
    <div className="sr-only fixed left-0 top-0 pointer-events-none">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.header}</th>
              {row.cells.map((cell, index) => (
                <td key={columns[index + 1]}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Valor da série, com o motivo explícito quando não existe número. */
function seriesValue(value: number | null, missing: string): string {
  return value === null ? missing : formatNumber(value)
}

/**
 * Tabela equivalente de uma das duas comparações diárias.
 *
 * A evolução diária virou duas comparações visuais, cada uma com um realizado e
 * uma referência. A alternativa textual acompanha essa divisão: duas tabelas com
 * as mesmas colunas das linhas desenhadas, em vez de uma tabela larga que não
 * corresponde a nada na tela. Os quatro valores continuam publicados na íntegra.
 */
export function DailyChartTable({
  comparison,
  daily,
  month,
}: {
  comparison: GoalsDailyComparison
  daily: readonly CommercialDailyPoint[]
  month: CommercialMonthKey
}) {
  const label = monthLabel(month)
  const isGoal = comparison === 'meta'

  return (
    <ChartDataTable
      caption={
        isGoal
          ? `Comparação Meta normal na evolução diária acumulada de ${label}, com realizado da meta e ritmo esperado da meta.`
          : `Comparação Supermeta na evolução diária acumulada de ${label}, com realizado total e ritmo esperado da supermeta.`
      }
      columns={
        isGoal
          ? ['Dia', 'Realizado da meta', 'Ritmo esperado da meta']
          : ['Dia', 'Realizado total', 'Ritmo esperado da supermeta']
      }
      rows={daily.map((point) => ({
        id: String(point.day),
        header: `Dia ${String(point.day).padStart(2, '0')}`,
        cells: isGoal
          ? [seriesValue(point.goalAchieved, 'sem dado'), seriesValue(point.goalPace, 'sem meta')]
          : [
              seriesValue(point.totalAchieved, 'sem dado'),
              seriesValue(point.superGoalPace, 'sem meta'),
            ],
      }))}
    />
  )
}

/** Tabela equivalente do gráfico de histórico mensal. */
export function MonthlyChartTable({ monthly }: { monthly: readonly CommercialMonthlyPoint[] }) {
  return (
    <ChartDataTable
      caption="Histórico mensal de janeiro a julho de 2026, com realizado da meta, realizado total da supermeta, meta e supermeta."
      columns={[
        'Mês',
        'Realizado da meta',
        'Realizado total da supermeta',
        'Meta',
        'Supermeta',
      ]}
      rows={monthly.map((point) => ({
        id: point.month,
        header: point.selected
          ? `${monthLabel(point.month)}, mês selecionado`
          : monthLabel(point.month),
        cells: [
          formatNumber(point.goalAchieved),
          formatNumber(point.totalAchieved),
          seriesValue(point.goal, 'sem meta'),
          seriesValue(point.superGoal, 'sem meta'),
        ],
      }))}
    />
  )
}
