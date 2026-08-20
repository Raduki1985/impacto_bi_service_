import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'
import type { Pair } from '../../data/dashboardTypes'
import { formatNumber } from '../../lib/formatters'

/**
 * Opções dos dois rankings da Visão Geral de OS: `Volume por categoria` e
 * `Resoluções mais frequentes`.
 *
 * Um gerador só para os dois, porque são a mesma leitura: uma contagem por
 * item, ordenada, com o nome no eixo e a quantidade na ponta da barra. O que
 * muda entre eles é apenas o nome do gráfico, a coleção e a cor de identidade.
 *
 * Vive aqui, e não em `components/charts/chartOptions`, pelo mesmo motivo dos
 * outros geradores desta página: `makeBarOptions` continua servindo Categorias,
 * Resoluções, Técnicos e as demais telas, com a aparência que elas já têm.
 */

/** Texto exibido quando o recorte não tem nenhum valor representável. */
export const RANKING_EMPTY_MESSAGE = 'Sem dados no período'

/** Uma linha do ranking, com o que a tela e o leitor de tela precisam. */
export type RankingRow = {
  readonly label: string
  readonly value: number
  /** Quantidade formatada em pt-BR, exibida na ponta da barra. */
  readonly text: string
}

/**
 * Junta rótulos e valores paralelos em pares.
 *
 * `charts.categoryBar` entrega duas coleções separadas, enquanto
 * `charts.resolutionPairs` já vem em pares. Normalizar aqui deixa o gerador com
 * uma entrada só e evita espalhar essa costura pela página. Um rótulo sem valor
 * correspondente conta zero, em vez de virar `undefined` no gráfico; um valor
 * sem rótulo é descartado, porque uma barra sem nome não pode ser lida.
 */
export function toRankingPairs(
  labels: readonly string[],
  values: readonly number[],
): Pair[] {
  return labels.map((label, index) => [label, values[index] ?? 0])
}

/**
 * Ordena os itens do maior para o menor.
 *
 * O desempate é a posição de origem: itens com a mesma contagem mantêm a ordem
 * em que chegaram, que nas categorias é a ordem oficial dos metadados. O
 * critério é explícito, e não confiado à estabilidade do `sort` do motor.
 *
 * A coleção recebida nunca é ordenada no lugar: o `map` cria um array novo
 * antes do `sort`. `charts.categoryBar` e `charts.resolutionPairs` continuam
 * como chegaram para qualquer outro consumidor.
 *
 * Itens com valor zero são preservados quando existe algum valor positivo: o
 * agregado de categorias monta a lista a partir dos metadados, então uma
 * categoria sem OS no recorte é um fato do período, não um item a esconder.
 */
export function buildRankingRows(items: readonly Pair[]): readonly RankingRow[] {
  if (!items.some(([, value]) => Number.isFinite(value) && value > 0)) return []

  return items
    .map((pair, index) => ({ pair, index }))
    .sort((a, b) => b.pair[1] - a.pair[1] || a.index - b.index)
    .map(({ pair: [label, value] }) => ({
      label,
      value,
      text: formatNumber(value),
    }))
}

/** Descrição acessível, derivada da mesma coleção ordenada que a tela desenha. */
export function buildRankingDescription(name: string, rows: readonly RankingRow[]): string {
  if (rows.length === 0) return `${name}. ${RANKING_EMPTY_MESSAGE}.`

  return `${name}. ${rows.map((row) => `${row.label}: ${row.text} OS`).join('. ')}.`
}

/**
 * Paleta do entorno, resolvida por tema.
 *
 * Repete os valores já aprovados nos outros geradores desta página em vez de
 * importá-los: `overviewDailyChartOptions` e `overviewStatusChartOptions` são
 * arquivos fechados neste bloco, e criar uma dependência entre irmãos só para
 * compartilhar constantes acoplaria três gráficos independentes.
 *
 * A cor das barras NÃO entra aqui: ela é a identidade do gráfico, vem de quem
 * consome e é a mesma nos dois temas.
 */
const palette = {
  light: {
    category: '#344054',
    valueLabel: '#475467',
    splitLine: '#f1f3f7',
    empty: '#98a2b3',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
  },
  dark: {
    category: '#dfe5ec',
    valueLabel: '#cdd5df',
    splitLine: 'rgba(159,174,196,0.14)',
    empty: '#a9b5c6',
    tooltipBackground: '#263448',
    tooltipBorder: '#46556b',
    tooltipText: '#f2f4f7',
  },
} as const

const baseTextStyle = { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }

export type RankingChartInput = {
  /** Nome do gráfico, usado apenas na descrição acessível. */
  readonly name: string
  readonly items: readonly Pair[]
  /** Cor única de identidade do gráfico, igual nos dois temas. */
  readonly color: string
  readonly theme: Theme
}

export function makeRankingOptions({
  color,
  items,
  name,
  theme,
}: RankingChartInput): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const rows = buildRankingRows(items)

  if (rows.length === 0) {
    return {
      textStyle: baseTextStyle,
      animation: false,
      aria: {
        enabled: true,
        label: { enabled: true, description: `${name}. ${RANKING_EMPTY_MESSAGE}.` },
      },
      title: {
        text: RANKING_EMPTY_MESSAGE,
        left: 'center',
        top: 'middle',
        textStyle: { ...baseTextStyle, color: colors.empty, fontSize: 12.5, fontWeight: 'normal' },
      },
    }
  }

  // O eixo de categorias do ECharts desenha de baixo para cima, então a ordem é
  // invertida no desenho para o maior item aparecer no topo. Rótulo, tooltip e
  // descrição acessível leem todos da mesma coleção, e não podem divergir.
  const drawn = [...rows].reverse()

  return {
    textStyle: baseTextStyle,
    // Sem animação de entrada nem de atualização por filtro: a barra já nasce
    // no comprimento final.
    animation: false,
    aria: {
      enabled: true,
      label: { enabled: true, description: buildRankingDescription(name, rows) },
    },
    // A margem direita é reservada para a quantidade, que fica fora da barra.
    // `containLabel` cuida apenas dos nomes, à esquerda, e é ele que garante
    // que `Equipamento Substituído` apareça inteiro em vez de truncado.
    grid: { left: 4, right: 56, top: 6, bottom: 6, containLabel: true },
    tooltip: {
      // Por item, e não por eixo: no eixo o ECharts desenha uma faixa cinza
      // sobre a linha inteira, que é uma mudança visual no hover.
      trigger: 'item',
      showDelay: 0,
      transitionDuration: 0,
      confine: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText, fontSize: 12, fontFamily: 'IBM Plex Sans' },
      padding: [7, 11],
      extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18)',
      formatter: (params: unknown) => {
        const index = (params as { dataIndex?: number }).dataIndex
        const row = typeof index === 'number' ? drawn[index] : undefined
        if (row === undefined) return ''

        return (
          `<div style="margin-bottom:2px;font-weight:600">${row.label}</div>` +
          `<div>${row.text} OS</div>`
        )
      },
    },
    xAxis: {
      type: 'value',
      // Sem números na escala: a quantidade já está escrita na ponta de cada
      // barra, e repeti-la no eixo seria o mesmo valor em dois lugares.
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    yAxis: {
      type: 'category',
      data: drawn.map((row) => row.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.category, fontSize: 11.5, fontWeight: 500 },
    },
    series: [
      {
        type: 'bar',
        // Espessura moderada: `Resoluções` chega a sete itens em 250 px, e uma
        // barra mais grossa fecharia o respiro entre as linhas.
        barMaxWidth: 16,
        // Nenhum destaque: sem isto o ECharts clareia a barra sob o ponteiro.
        emphasis: { disabled: true },
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: colors.valueLabel,
          fontSize: 11,
          fontWeight: 600,
          formatter: (params: { dataIndex: number }) => drawn[params.dataIndex]?.text ?? '',
        },
        data: drawn.map((row) => ({ value: row.value, name: row.label })),
      },
    ],
  }
}
