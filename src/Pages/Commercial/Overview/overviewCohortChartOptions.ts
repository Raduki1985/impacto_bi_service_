import type { BarSeriesOption, EChartsOption } from 'echarts'

import type { Theme } from '../../../contexts/PreferencesContextCore'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  axisPointerColor,
  axisSkin,
  baseTextStyle,
  chartAnimation,
  formatAxisInteger,
  makeMonthlyAxisLabelFormatter,
  tooltipRow,
  tooltipSkin,
} from './overviewChartOptions'
import type { OverviewCohortPoint } from './overviewModel'

/**
 * Gráfico do painel Safra de vendas por mês.
 *
 * Vive na pasta da página, e não em `components/charts`, porque tem legenda,
 * tooltip e paleta próprios: quatro fatias fixas por mês vendido, com cor por
 * identidade e não por posição. O que ele congela, decidido com o Mário em
 * 18/09/2026:
 *
 * - a régua é a data da venda, a mesma do card Aguardando Ativação, e não a
 *   do sinal ligado da Evolução mensal. Os dois gráficos mostram os mesmos
 *   meses com perguntas diferentes: lá, o que a operação entregou em cada
 *   mês; aqui, o que virou cada mês vendido;
 * - as fatias são "Ativou no mês", "Ativou depois", "Aguarda hoje" e
 *   "Cancelou antes de ativar", nesta ordem, de baixo para cima na pilha. O
 *   que não se encaixa (`other`: reprovada, expirada, cortesia) não vira
 *   fatia, porque é zero na base hoje e só ocuparia legenda; aparece no
 *   tooltip e na descrição acessível quando existir, para a soma nunca
 *   esconder nada;
 * - cada fatia puxa a identidade do card que ela representa (opção A das
 *   três renderizadas em 18/09/2026, escolha do Mário): o verde de Vendas
 *   ativadas para quem ativou no mês, o azul do Tempo até a ativação para
 *   quem ativou depois (esperou mais), o âmbar de Aguardando Ativação para
 *   quem aguarda, e cinza para quem cancelou antes, a saída neutra que o
 *   card dá à cancelada. Dois verdes e dois âmbares, a primeira versão, não
 *   se separavam na barra. Todos são hexes que a página já usa, e cada um
 *   mede pelo menos 3,0 contra a superfície do próprio tema (claro sobre
 *   `#ffffff`: 3,10, 5,17, 3,19 e 4,76; escuro sobre `#1f2937`: 7,68, 3,99,
 *   5,60 e 3,08; medidos em 18/09/2026). A cor nunca identifica sozinha:
 *   nome na legenda, tooltip e descrição acessível acompanham;
 * - o período da página não recorta nem destaca os meses: todos ficam
 *   acesos. Um destaque por período foi testado e descartado pelo Mário no
 *   mesmo dia; o subtítulo do painel diz que o período não vale aqui.
 */

export const COHORT_SERIES = [
  { id: 'activatedInMonth', name: 'Ativou no mês' },
  { id: 'activatedLater', name: 'Ativou depois' },
  { id: 'awaiting', name: 'Aguarda hoje' },
  { id: 'cancelledBefore', name: 'Cancelou antes de ativar' },
] as const satisfies readonly { id: keyof OverviewCohortPoint; name: string }[]

export type CohortSeriesId = (typeof COHORT_SERIES)[number]['id']

const cohortPalette: Record<'light' | 'dark', Record<CohortSeriesId, string>> = {
  light: {
    activatedInMonth: '#00a862',
    activatedLater: '#2563eb',
    awaiting: '#d97706',
    cancelledBefore: '#64748b',
  },
  dark: {
    activatedInMonth: '#00d776',
    activatedLater: '#3b82f6',
    awaiting: '#e8890b',
    cancelledBefore: '#64748b',
  },
}

// Guarda do domínio fechado, como em `overviewServiceTypeChartOptions`: fatia
// sem cor declarada é erro no carregamento, e não uma cor herdada por posição.
for (const theme of ['light', 'dark'] as const) {
  for (const series of COHORT_SERIES) {
    if (!cohortPalette[theme][series.id]) {
      throw new Error(`Safra de vendas: a fatia ${series.name} está sem cor no tema ${theme}.`)
    }
  }
}

export function cohortColor(id: CohortSeriesId, theme: Theme): string {
  return cohortPalette[theme === 'dark' ? 'dark' : 'light'][id]
}

/** Fatia da parcela no vendido do mês, de 0 a 1; zero quando nada foi vendido. */
export function cohortShare(point: OverviewCohortPoint, id: CohortSeriesId): number {
  return point.sold === 0 ? 0 : point[id] / point.sold
}

/** Nada vendido em mês nenhum: o painel mostra o aviso em vez de eixos vazios. */
export function isCohortEmpty(points: readonly OverviewCohortPoint[]): boolean {
  return points.every((point) => point.sold === 0)
}

/** Estado inicial da legenda: as quatro fatias ligadas. */
export function initialCohortLegendSelection(): Record<string, boolean> {
  return Object.fromEntries(COHORT_SERIES.map((series) => [series.name, true]))
}

/**
 * Cantos de uma fatia, mês a mês: a primeira fatia visível com valor
 * arredonda a base da pilha e a última arredonda o topo, como as barras da
 * Evolução mensal. Um raio fixo na última série deixaria o topo reto sempre
 * que ela vale zero, o caso normal de "cancelou antes". Fatia desligada na
 * legenda não conta, senão o topo ficaria reto ao desligá-la.
 */
export function cohortBarRadius(
  point: OverviewCohortPoint,
  id: CohortSeriesId,
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
): number | number[] {
  const visible = COHORT_SERIES.filter(
    (series) => point[series.id] > 0 && legendSelection[series.name] !== false,
  ).map((series) => series.id)
  const isFirst = visible[0] === id
  const isLast = visible[visible.length - 1] === id

  if (isFirst && isLast) return 3
  if (isFirst) return [0, 0, 3, 3]
  if (isLast) return [3, 3, 0, 0]
  return 0
}

/**
 * Marcador do tooltip, gerado aqui e não pela biblioteca: as linhas que ela
 * não marca sozinha (o vendido do título e as outras situações) precisam
 * alinhar no mesmo eixo das quatro fatias.
 */
function marker(color: string): string {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;flex:none"></span>`
}

/** Recuo do tamanho do marcador, para a linha sem fatia alinhar com as outras. */
const MARKER_SPACER = '<span style="display:inline-block;width:16px;flex:none"></span>'

/**
 * Tooltip de um mês: o vendido no título e cada fatia com quantidade e
 * participação, na ordem da legenda. "Outras situações" só entra quando
 * existe, e sem marcador, porque não é fatia; o recuo mantém o nome alinhado.
 */
export function buildCohortTooltip(point: OverviewCohortPoint, theme: Theme): string {
  const rows = COHORT_SERIES.map((series) =>
    tooltipRow(
      `${marker(cohortColor(series.id, theme))}${series.name}`,
      `${formatNumber(point[series.id])} (${formatPercent(cohortShare(point, series.id))})`,
    ),
  )
  if (point.other > 0) {
    rows.push(tooltipRow(`${MARKER_SPACER}Outras situações`, formatNumber(point.other)))
  }
  const sold = point.sold === 1 ? '1 vendida' : `${formatNumber(point.sold)} vendidas`

  return (
    '<div style="min-width:200px">' +
    `<div style="margin-bottom:4px;font-weight:600">${point.label}: ${sold}</div>` +
    rows.join('') +
    '</div>'
  )
}

/** Formatador do tooltip por eixo: acha o mês pelo índice do ponto. */
export function cohortTooltipFormatter(
  points: readonly OverviewCohortPoint[],
  theme: Theme,
): (params: unknown) => string {
  return (params: unknown): string => {
    const first = (Array.isArray(params) ? params[0] : params) as
      | { dataIndex?: unknown }
      | undefined
    const index = typeof first?.dataIndex === 'number' ? first.dataIndex : -1
    const point = points[index]
    return point === undefined ? '' : buildCohortTooltip(point, theme)
  }
}

/**
 * Descrição acessível, derivada da mesma coleção que o gráfico desenha: um
 * mês por frase, com o vendido, as quatro parcelas e, quando existirem, as
 * outras situações, para as parcelas lidas fecharem com o vendido como no
 * tooltip.
 */
export function buildCohortDescription(points: readonly OverviewCohortPoint[]): string {
  if (isCohortEmpty(points)) return 'Safra de vendas por mês: nenhuma venda na base.'

  const frases = points.map((point) => {
    const partes = COHORT_SERIES.map(
      (series) => `${series.name.toLowerCase()} ${formatNumber(point[series.id])}`,
    )
    if (point.other > 0) partes.push(`outras situações ${formatNumber(point.other)}`)
    return `${point.label}: ${formatNumber(point.sold)} vendidas, ${partes.join(', ')}.`
  })

  return `Safra de vendas por mês. ${frases.join(' ')}`
}

export function makeOverviewCohortOptions(
  points: readonly OverviewCohortPoint[],
  theme: Theme,
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
): EChartsOption {
  const { textColor, gridColor, axisColor } = axisSkin(theme)
  const description = buildCohortDescription(points)

  if (isCohortEmpty(points)) {
    return {
      textStyle: baseTextStyle,
      animation: false,
      title: {
        text: 'Sem vendas na base',
        left: 'center',
        top: 'center',
        textStyle: {
          color: theme === 'dark' ? '#a9b5c6' : '#98a2b3',
          fontSize: 12,
          fontWeight: 500,
        },
      },
      aria: { enabled: true, label: { enabled: true, description } },
    }
  }

  const bars: BarSeriesOption[] = COHORT_SERIES.map((series) => ({
    name: series.name,
    type: 'bar',
    stack: 'safra',
    barMaxWidth: 24,
    itemStyle: { color: cohortColor(series.id, theme) },
    // O canto é por mês, e não por série: o topo arredondado vai para a
    // fatia que de fato fecha a pilha.
    data: points.map((point) => ({
      value: point[series.id],
      itemStyle: { borderRadius: cohortBarRadius(point, series.id, legendSelection) },
    })),
  }))

  return {
    textStyle: baseTextStyle,
    ...chartAnimation,
    aria: { enabled: true, label: { enabled: true, description } },
    grid: { left: 46, right: 16, top: 44, bottom: 30 },
    legend: {
      top: 2,
      right: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: textColor, fontSize: 11.5 },
      // A seleção vem do painel: as opções são remontadas a cada filtro ou
      // troca de tema, e sem isso a fatia desligada voltaria sozinha.
      selected: legendSelection,
    },
    tooltip: {
      trigger: 'axis',
      ...tooltipSkin(theme),
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: axisPointerColor[theme === 'dark' ? 'dark' : 'light'] },
      },
      extraCssText:
        'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:280px;white-space:normal',
      formatter: cohortTooltipFormatter(points, theme),
    },
    xAxis: {
      type: 'category',
      data: points.map((point) => point.label),
      axisLabel: {
        color: textColor,
        fontSize: 10.5,
        interval: 0,
        hideOverlap: true,
        margin: 9,
        formatter: makeMonthlyAxisLabelFormatter(points),
      },
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      // O mesmo rótulo de milhar da Evolução mensal, em pt-BR.
      axisLabel: { color: textColor, fontSize: 10.5, formatter: formatAxisInteger },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: bars,
  }
}
