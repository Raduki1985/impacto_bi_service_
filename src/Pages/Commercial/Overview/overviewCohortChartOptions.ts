import type { BarSeriesOption, EChartsOption } from 'echarts'

import type { Theme } from '../../../contexts/PreferencesContextCore'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  axisPointerColor,
  baseTextStyle,
  chartAnimation,
  makeMonthlyAxisLabelFormatter,
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
 *   do sinal ligado da Evolução mensal ao lado. Os dois gráficos mostram os
 *   mesmos meses com perguntas diferentes: ali, o que a operação entregou em
 *   cada mês; aqui, o que virou cada mês vendido;
 * - as fatias são "Ativou no mês", "Ativou depois", "Aguarda hoje" e
 *   "Cancelou antes de ativar", nesta ordem, de baixo para cima na pilha. O
 *   que não se encaixa (`other`: reprovada, expirada, cortesia) não vira
 *   fatia, porque é zero na base hoje e só ocuparia legenda; aparece no
 *   tooltip quando existir, para a soma nunca esconder nada;
 * - as cores espelham os dois cards vizinhos: o verde de Vendas ativadas para
 *   o que ativou (o degrau escuro para o que ativou depois) e o âmbar de
 *   Aguardando Ativação para o que aguarda e para o que cancelou antes (o
 *   degrau mais escuro, porque o degrau claro do card, `#fbbf24`, dá 1,67
 *   sobre branco e some no gráfico). Todos são hexes que a página já usa, e
 *   cada um mede pelo menos 3,0 contra a superfície do próprio tema (claro
 *   sobre `#ffffff`: 3,10, 4,76, 3,19 e 5,02; escuro sobre `#1f2937`: 7,68,
 *   4,74, 5,60 e 4,06; medidos em 18/09/2026). A cor nunca identifica
 *   sozinha: nome na legenda, tooltip e descrição acessível acompanham.
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
    activatedLater: '#00844d',
    awaiting: '#d97706',
    cancelledBefore: '#b45309',
  },
  dark: {
    activatedInMonth: '#00d776',
    activatedLater: '#00a862',
    awaiting: '#e8890b',
    cancelledBefore: '#c9700f',
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

/**
 * Marcador do tooltip, gerado aqui e não pela biblioteca: as linhas que ela
 * não marca sozinha (o vendido do título e as outras situações) precisam
 * alinhar no mesmo eixo das quatro fatias.
 */
function marker(color: string): string {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;flex:none"></span>`
}

function tooltipRow(left: string, right: string): string {
  return (
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;line-height:17px">' +
    `<span style="display:flex;align-items:center;min-width:0">${left}</span>` +
    `<span style="font-weight:600;white-space:nowrap;flex:none">${right}</span>` +
    '</div>'
  )
}

/**
 * Tooltip de um mês: o vendido no título e cada fatia com quantidade e
 * participação, na ordem da legenda. "Outras situações" só entra quando
 * existe, e sem marcador, porque não é fatia.
 */
export function buildCohortTooltip(point: OverviewCohortPoint, theme: Theme): string {
  const rows = COHORT_SERIES.map((series) =>
    tooltipRow(
      `${marker(cohortColor(series.id, theme))}${series.name}`,
      `${formatNumber(point[series.id])} (${formatPercent(cohortShare(point, series.id))})`,
    ),
  )
  if (point.other > 0) {
    rows.push(tooltipRow('Outras situações', formatNumber(point.other)))
  }
  const sold = point.sold === 1 ? '1 vendida' : `${formatNumber(point.sold)} vendidas`

  return (
    '<div style="min-width:200px">' +
    `<div style="margin-bottom:4px;font-weight:600">${point.label}: ${sold}</div>` +
    rows.join('') +
    '</div>'
  )
}

/** Rótulo do eixo vertical em pt-BR: `1.000`, e não `1,000`. */
export function formatCohortAxisLabel(value: number): string {
  return formatNumber(value)
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
 * mês por frase, com o vendido e as quatro parcelas.
 */
export function buildCohortDescription(points: readonly OverviewCohortPoint[]): string {
  if (isCohortEmpty(points)) return 'Safra de vendas por mês: nenhuma venda na base.'

  const frases = points.map((point) => {
    const partes = COHORT_SERIES.map(
      (series) => `${series.name.toLowerCase()} ${formatNumber(point[series.id])}`,
    )
    return `${point.label}: ${formatNumber(point.sold)} vendidas, ${partes.join(', ')}.`
  })

  return `Safra de vendas por mês. ${frases.join(' ')}`
}

export function makeOverviewCohortOptions(
  points: readonly OverviewCohortPoint[],
  theme: Theme,
): EChartsOption {
  const textColor = theme === 'dark' ? '#cdd5df' : '#667085'
  const gridColor = theme === 'dark' ? 'rgba(203,213,225,.13)' : 'rgba(129,143,164,.16)'
  const axisColor = theme === 'dark' ? 'rgba(203,213,225,.24)' : 'rgba(129,143,164,.25)'
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

  const last = COHORT_SERIES.length - 1
  const bars: BarSeriesOption[] = COHORT_SERIES.map((series, index) => ({
    name: series.name,
    type: 'bar',
    stack: 'safra',
    barMaxWidth: 24,
    itemStyle: {
      color: cohortColor(series.id, theme),
      // A primeira fatia arredonda a base da pilha e a última o topo; as do
      // meio ficam retas, como nas barras da Evolução mensal.
      borderRadius: index === 0 ? [0, 0, 3, 3] : index === last ? [3, 3, 0, 0] : 0,
    },
    data: points.map((point) => point[series.id]),
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
      // Milhar em pt-BR: com a escala passando de 1.000 a biblioteca escreveria
      // "1,000", com vírgula, que aqui se lê como um decimal.
      axisLabel: { color: textColor, fontSize: 10.5, formatter: formatCohortAxisLabel },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: bars,
  }
}
