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
 *   mesmo dia; o subtítulo do painel diz que o período não vale aqui;
 * - a barra empilha a cancelada no PISO, e não no topo, embora a legenda e
 *   o tooltip sigam a ordem do fluxo. É o que resolve a lasca do topo: a
 *   cancelada tem 1 venda em setembro e 3 em agosto, e no topo ela virava
 *   uma tampa cinza reta sobre a fatia grande, que o Mário viu como
 *   "comportamento estranho" (18/09/2026). No piso, ela encosta no eixo,
 *   onde uma fatia fina não destoa, e o topo fica sempre com uma fatia
 *   grande. Na leitura isso também se defende: a perda é o chão da barra,
 *   o que ativou é o corpo e o que ainda pode acontecer é o topo.
 */

export const COHORT_SERIES = [
  { id: 'activatedInMonth', name: 'Ativou no mês' },
  { id: 'activatedLater', name: 'Ativou depois' },
  { id: 'awaiting', name: 'Aguarda hoje' },
  { id: 'cancelledBefore', name: 'Cancelou antes de ativar' },
] as const satisfies readonly { id: keyof OverviewCohortPoint; name: string }[]

export type CohortSeriesId = (typeof COHORT_SERIES)[number]['id']

/**
 * Ordem de EMPILHAMENTO, do piso para o topo, que é diferente da ordem da
 * legenda e do tooltip: a cancelada vai para o piso pelo motivo dito acima.
 * As duas listas têm as mesmas quatro fatias, e o teste espelho garante isso.
 */
export const COHORT_STACK_ORDER = [
  'cancelledBefore',
  'activatedInMonth',
  'activatedLater',
  'awaiting',
] as const satisfies readonly CohortSeriesId[]

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
// sem cor declarada, ou fora da ordem de empilhamento, é erro no carregamento,
// e não uma cor herdada por posição nem uma fatia que some da barra.
for (const theme of ['light', 'dark'] as const) {
  for (const series of COHORT_SERIES) {
    if (!cohortPalette[theme][series.id]) {
      throw new Error(`Safra de vendas: a fatia ${series.name} está sem cor no tema ${theme}.`)
    }
  }
}
for (const series of COHORT_SERIES) {
  if (!COHORT_STACK_ORDER.includes(series.id)) {
    throw new Error(`Safra de vendas: a fatia ${series.name} está fora da ordem de empilhamento.`)
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
 * Quanto uma fatia precisa valer, em relação ao maior mês do gráfico, para o
 * topo arredondado aparecer nela.
 *
 * A conta é geométrica: a área de desenho tem cerca de 186 px de altura
 * (260 do painel menos as margens de cima e de baixo), então o raio de 3 px
 * equivale a mais ou menos 1,6% do maior mês. Arredondado para 2%, com
 * folga.
 *
 * Sem esse piso, o topo aparecia reto nos meses em que a última fatia com
 * valor é minúscula: setembro fecha com 1 cancelada e agosto com 3, menos de
 * meio pixel cada. O arredondamento acontecia nessa lasca invisível e a
 * fatia grande logo abaixo ficava reta (visto na tela em 18/09/2026).
 */
export const MIN_ROUNDED_SLICE_SHARE = 0.02

/** Nome da fatia na legenda, a partir do identificador dela. */
function seriesName(id: CohortSeriesId): string {
  return COHORT_SERIES.find((series) => series.id === id)?.name ?? id
}

/**
 * Cantos de uma fatia, mês a mês, na ordem de empilhamento: só o TOPO da
 * barra é arredondado, e ele vai para a fatia grande o bastante para mostrar
 * a curva. A base fica reta, apoiada na linha do eixo, porque é de lá que a
 * barra nasce (decisão do Mário em 18/09/2026).
 *
 * Um raio fixo na última série deixaria o topo reto sempre que ela valesse
 * zero, o que acontece em quase todo mês. Fatia desligada na legenda não
 * conta, senão o topo ficaria reto ao desligá-la.
 *
 * `chartMax` é o maior mês do gráfico, a régua do piso de tamanho. Sem ele,
 * qualquer fatia com valor serve, que é o bastante para quem só quer saber
 * qual fatia fecha a pilha.
 */
export function cohortBarRadius(
  point: OverviewCohortPoint,
  id: CohortSeriesId,
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
  chartMax = 0,
): number | number[] {
  const visible = COHORT_STACK_ORDER.filter(
    (seriesId) => point[seriesId] > 0 && legendSelection[seriesName(seriesId)] !== false,
  )
  if (visible.length === 0) return 0

  // A lasca que sobra acima do topo arredondado continua desenhada, com o
  // canto reto: ela tem menos de 3 px e some contra a curva de baixo.
  const floor = chartMax * MIN_ROUNDED_SLICE_SHARE
  const rounded = visible.filter((seriesId) => point[seriesId] >= floor)
  const scale = rounded.length > 0 ? rounded : visible

  return scale[scale.length - 1] === id ? [3, 3, 0, 0] : 0
}

/**
 * O maior mês do gráfico, contando só as fatias ligadas na legenda: é a
 * altura que o eixo precisa acomodar, e a régua do piso do arredondamento.
 */
export function cohortChartMax(
  points: readonly OverviewCohortPoint[],
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
): number {
  const totals = points.map((point) =>
    COHORT_SERIES.reduce(
      (total, series) =>
        total + (legendSelection[series.name] === false ? 0 : point[series.id]),
      0,
    ),
  )
  return Math.max(0, ...totals)
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

  const chartMax = cohortChartMax(points, legendSelection)
  // As séries nascem na ordem de empilhamento, do piso para o topo; a legenda
  // recebe a ordem do fluxo logo abaixo.
  const bars: BarSeriesOption[] = COHORT_STACK_ORDER.map((id) => ({
    name: seriesName(id),
    type: 'bar',
    stack: 'safra',
    barMaxWidth: 24,
    itemStyle: { color: cohortColor(id, theme) },
    // O canto é por mês, e não por série: o topo arredondado vai para a fatia
    // que de fato fecha a pilha na tela, e a base fica reta sobre o eixo.
    data: points.map((point) => ({
      value: point[id],
      itemStyle: { borderRadius: cohortBarRadius(point, id, legendSelection, chartMax) },
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
      // A legenda segue a ordem do fluxo, e não a da pilha: é assim que a
      // leitura do card Aguardando Ativação narra as etapas.
      data: COHORT_SERIES.map((series) => series.name),
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
