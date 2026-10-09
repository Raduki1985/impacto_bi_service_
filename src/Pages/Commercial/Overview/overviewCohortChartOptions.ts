import type { BarSeriesOption, EChartsOption } from 'echarts'

import type { Theme } from '../../../contexts/PreferencesContextCore'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  axisPointerColor,
  axisSkin,
  baseTextStyle,
  chartAnimation,
  drawnStackValues,
  formatAxisInteger,
  makeMonthlyAxisLabelFormatter,
  topStackIndex,
  tooltipRow,
  tooltipSkin,
} from './overviewChartOptions'
import type { OverviewCohortPoint } from './overviewModel'

/**
 * Gráfico do painel Evolução mensal das vendas.
 *
 * Vive na pasta da página, e não em `components/charts`, porque tem legenda,
 * tooltip e paleta próprios: quatro fatias fixas por mês vendido, com cor por
 * identidade e não por posição. O que ele congela, decidido com o Mário a
 * partir de 18/09/2026:
 *
 * - a régua é a data da venda, e não a do sinal ligado do painel Vendas ativadas por mês.
 *   Os dois gráficos mostram os mesmos meses com perguntas diferentes: lá, o
 *   que a operação entregou em cada mês; aqui, o que virou cada mês vendido;
 * - as fatias são "Ativou no mês", "Ativou depois", "Aguarda hoje" e
 *   "Cancelou", nesta ordem, de baixo para cima na pilha. Desde 28/09/2026
 *   (decisão do Mário) "Cancelou" junta a cancelada antes e depois do sinal
 *   ligado, e as duas de ativou contam só quem continua cliente: a pergunta
 *   do painel passou a ser quanto do vendido ficou, e até jul/2026 o SGI
 *   gravava a data de ativação já na venda, então os dois casos nem se
 *   separavam nos meses antigos. Antes era "Cancelou antes de ativar", e a
 *   cancelada depois do sinal ficava escondida dentro de ativou;
 * - o que não se encaixa nas quatro (`other`: reprovada, expirada,
 *   cortesia, ou ativa no SGI sem sinal ligado, as 3 de setembro de 2026)
 *   não é fatia: aparece no tooltip e na descrição acessível quando existe,
 *   e entra no número em cima da barra, que é o vendido. Em 02/10/2026 o
 *   Mário viu "Outras situações" como quinta fatia, com cor, e decidiu
 *   tirá-la da barra: alguns contratos por mês viravam mais uma faixa fina
 *   no topo, e a quinta cor não assentou com as outras;
 * - cada fatia puxa a identidade do card que ela representa (opção A das
 *   três renderizadas em 18/09/2026, escolha do Mário): o verde de Vendas
 *   ativadas para quem ativou no mês, o azul do Tempo até a ativação para
 *   quem ativou depois (esperou mais) e o âmbar da fila de ativação para
 *   quem aguarda. Dois verdes e dois âmbares, a primeira versão, não se
 *   separavam na barra. Desde 02/10/2026 (pedido do Mário), Cancelou é o
 *   vermelho desfavorável do portal, a perda do que foi vendido; de 18/09 a
 *   02/10/2026 foi o cinza neutro `#64748b`, a saída das listas. Todos são
 *   hexes que a página já usa, e cada um mede pelo menos 3,0 contra a
 *   superfície do próprio tema (claro sobre `#ffffff`: 3,10, 5,17, 3,19 e
 *   4,19; escuro sobre `#1f2937`: 7,68, 3,99, 5,60 e 4,56). O vermelho se
 *   separa do âmbar que fica embaixo dele (distância de cor 51 no claro e 61
 *   no escuro). É o mesmo vermelho do bloqueio nas listas e no card dos 90
 *   dias, onde a cancelada segue cinza. A cor nunca identifica sozinha: nome
 *   na legenda, tooltip e descrição acessível acompanham;
 * - o período da página não recorta nem destaca os meses: todos ficam
 *   acesos. Um destaque por período foi testado e descartado pelo Mário no
 *   mesmo dia; o subtítulo do painel diz que o período não vale aqui;
 * - a barra empilha na ordem do fluxo, a mesma da legenda e do tooltip, com
 *   a cancelada no TOPO (pedido do Mário em 28/09/2026). De 18/09 a
 *   28/09/2026 ela ficou no piso: com 1 venda em setembro e 3 em agosto, no
 *   topo ela virava uma tampa cinza reta sobre a fatia grande, que o Mário
 *   viu como "comportamento estranho". A altura mínima abaixo acabou com a
 *   tampa: a cancelada de cima passa a ser uma fatia de verdade, com o
 *   canto arredondado e o total em cima dela;
 * - cada barra leva em cima o vendido do mês, porque ele é o número
 *   principal do painel e não pode depender do ponteiro: o mesmo do
 *   tooltip e do "Todas" da janela. Até 02/10/2026
 *   o rótulo era a soma das quatro fatias, e com outras situações no mês a
 *   barra dizia 704 e o tooltip 707 (setembro). Alguns contratos não mudam
 *   a altura de forma visível. Com uma fatia desligada na legenda o rótulo
 *   volta a ser a soma do que sobrou, para dizer o que a barra mede
 *   (`cohortBarLabel`);
 * - toda fatia com valor tem altura mínima desenhada (`drawnStackValues`,
 *   28/09/2026, pedido do Mário), para dar para ver e clicar a cancelada de
 *   setembro ou o "aguarda" de maio. O mínimo sai da fatia grande do mesmo
 *   mês, então a barra segue com a altura real; tooltip, rótulo e janela
 *   leem os valores reais.
 */

export const COHORT_SERIES = [
  { id: 'activatedInMonth', name: 'Ativou no mês' },
  { id: 'activatedLater', name: 'Ativou depois' },
  { id: 'awaiting', name: 'Aguarda hoje' },
  { id: 'cancelled', name: 'Cancelou' },
] as const satisfies readonly { id: keyof OverviewCohortPoint; name: string }[]

export type CohortSeriesId = (typeof COHORT_SERIES)[number]['id']

/**
 * Ordem de EMPILHAMENTO, do piso para o topo. Desde 28/09/2026 é a mesma da
 * legenda e do tooltip, com a cancelada no topo; continua separada porque a
 * pilha já teve ordem própria e pode voltar a ter. As duas listas têm as
 * mesmas quatro fatias, e o teste espelho garante isso.
 */
export const COHORT_STACK_ORDER = [
  'activatedInMonth',
  'activatedLater',
  'awaiting',
  'cancelled',
] as const satisfies readonly CohortSeriesId[]

// Exportada desde 25/09/2026: as listas de contratos pintam a situação (ativa,
// cancelada) com as mesmas cores da safra, para a situação ter uma cor só, e
// os atalhos da janela da Evolução mensal das vendas levam a cor da fatia que
// abrem.
export const cohortPalette: Record<'light' | 'dark', Record<CohortSeriesId, string>> = {
  light: {
    activatedInMonth: '#00a862',
    activatedLater: '#2563eb',
    awaiting: '#d97706',
    cancelled: '#e5384e',
  },
  dark: {
    activatedInMonth: '#00d776',
    activatedLater: '#3b82f6',
    awaiting: '#e8890b',
    cancelled: '#ff4d6a',
  },
}

// Guarda do domínio fechado, como em `overviewServiceTypeChartOptions`: fatia
// sem cor declarada, ou fora da ordem de empilhamento, é erro no carregamento,
// e não uma cor herdada por posição nem uma fatia que some da barra.
for (const theme of ['light', 'dark'] as const) {
  for (const series of COHORT_SERIES) {
    if (!cohortPalette[theme][series.id]) {
      throw new Error(`Evolução mensal das vendas: a fatia ${series.name} está sem cor no tema ${theme}.`)
    }
  }
}
for (const series of COHORT_SERIES) {
  if (!COHORT_STACK_ORDER.includes(series.id)) {
    throw new Error(`Evolução mensal das vendas: a fatia ${series.name} está fora da ordem de empilhamento.`)
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
  return cohortTopSlice(point, legendSelection, chartMax) === id ? [3, 3, 0, 0] : 0
}

/**
 * Qual fatia fecha a barra de um mês na tela: a última da pilha que está
 * ligada na legenda, tem valor e é grande o bastante para mostrar a curva.
 * `null` quando o mês não tem barra.
 *
 * É ela que recebe o topo arredondado e o rótulo do total, para os dois
 * nunca caírem em lugares diferentes. A conta é feita sobre as alturas
 * desenhadas: com `chartMax`, toda fatia com valor tem o mínimo e comporta a
 * curva, então o topo é sempre a última fatia com valor.
 */
export function cohortTopSlice(
  point: OverviewCohortPoint,
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
  chartMax = 0,
): CohortSeriesId | null {
  const drawn = drawnStackValues(cohortStackValues(point, legendSelection), chartMax)
  const index = topStackIndex(drawn, chartMax)
  return index === null ? null : COHORT_STACK_ORDER[index]
}

/**
 * Os valores da pilha de um mês, na ordem de empilhamento e com zero no que
 * está desligado na legenda: a forma que os helpers de barra da página
 * esperam.
 */
function cohortStackValues(
  point: OverviewCohortPoint,
  legendSelection: Record<string, boolean>,
): number[] {
  return COHORT_STACK_ORDER.map((id) =>
    legendSelection[seriesName(id)] === false ? 0 : point[id],
  )
}

/**
 * A altura da barra de um mês: a soma das fatias ligadas na legenda, e não o
 * vendido do dado. Com tudo ligado os dois só diferem pelas outras
 * situações, que não são fatia.
 */
export function cohortVisibleTotal(
  point: OverviewCohortPoint,
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
): number {
  return COHORT_SERIES.reduce(
    (total, series) => total + (legendSelection[series.name] === false ? 0 : point[series.id]),
    0,
  )
}

/**
 * O número em cima da barra de um mês (02/10/2026, decisão do Mário). Com as
 * quatro fatias ligadas, o vendido do mês, o mesmo do título do tooltip e do
 * "Todas" da janela: as outras situações não são
 * fatia, mas são venda. Com alguma fatia desligada na legenda, a soma do que
 * sobrou, para o número dizer o que a barra mede.
 */
export function cohortBarLabel(
  point: OverviewCohortPoint,
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
): number {
  const allShown = COHORT_SERIES.every((series) => legendSelection[series.name] !== false)

  return allShown ? point.sold : cohortVisibleTotal(point, legendSelection)
}

/**
 * O maior mês do gráfico, contando só as fatias ligadas na legenda: é a
 * altura que o eixo precisa acomodar, e a régua do piso do arredondamento.
 */
export function cohortChartMax(
  points: readonly OverviewCohortPoint[],
  legendSelection: Record<string, boolean> = initialCohortLegendSelection(),
): number {
  return Math.max(0, ...points.map((point) => cohortVisibleTotal(point, legendSelection)))
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
 * Tooltip de um mês: o vendido no título e cada fatia com valor, com
 * quantidade e participação, na ordem da legenda. "Outras situações" só entra quando
 * existe, e sem marcador, porque não é fatia; o recuo mantém o nome alinhado.
 */
export function buildCohortTooltip(point: OverviewCohortPoint, theme: Theme): string {
  // Fatia zerada não entra, em nenhum gráfico do portal (pedido do Mário em
  // 28/09/2026): setembro não mostra "Ativou depois 0 (0,0%)". Mês sem venda
  // não abre caixa, porque sobraria um título dizendo zero.
  const rows = COHORT_SERIES.filter((series) => point[series.id] !== 0).map((series) =>
    tooltipRow(
      `${marker(cohortColor(series.id, theme))}${series.name}`,
      `${formatNumber(point[series.id])} (${formatPercent(cohortShare(point, series.id))})`,
    ),
  )
  if (point.other > 0) {
    rows.push(tooltipRow(`${MARKER_SPACER}Outras situações`, formatNumber(point.other)))
  }
  if (rows.length === 0) return ''
  const sold = point.sold === 1 ? '1 vendida' : `${formatNumber(point.sold)} vendidas`

  return (
    '<div style="min-width:200px">' +
    `<div style="margin-bottom:4px;font-weight:600">${point.label}: ${sold}</div>` +
    rows.join('') +
    '</div>'
  )
}

/**
 * O que o clique no gráfico abre (25/09/2026): o mês vendido e a fatia, ou o
 * mês inteiro (`series` nulo). A regra de quais contratos entram é da janela
 * (`salesListModel`); aqui só se traduz o clique.
 */
export type CohortChartClick = {
  readonly month: string
  readonly series: CohortSeriesId | null
}

/** O mês na posição do eixo, desde que ele tenha venda: mês vazio não abre lista vazia. */
function monthAt(points: readonly OverviewCohortPoint[], index: number): OverviewCohortPoint | null {
  const point = points[index]

  return point === undefined || point.sold === 0 ? null : point
}

/**
 * Clique numa fatia (o mês e a fatia) ou no nome do mês embaixo do eixo (o
 * mês inteiro). Fatia zerada não se desenha, então não se clica; o nulo cobre
 * qualquer outro alvo.
 */
export function cohortFromChartClick(
  points: readonly OverviewCohortPoint[],
  params: unknown,
): CohortChartClick | null {
  if (typeof params !== 'object' || params === null) return null
  const { componentType, dataIndex, seriesName: name, value } = params as {
    componentType?: unknown
    dataIndex?: unknown
    seriesName?: unknown
    value?: unknown
  }

  if (componentType === 'series' && typeof dataIndex === 'number') {
    const series = COHORT_SERIES.find((item) => item.name === name)
    const point = monthAt(points, dataIndex)
    if (series === undefined || point === null || point[series.id] === 0) return null

    return { month: point.month, series: series.id }
  }
  if (componentType === 'xAxis' && typeof value === 'string') {
    const point = monthAt(points, points.findIndex((item) => item.label === value))

    return point === null ? null : { month: point.month, series: null }
  }

  return null
}

/**
 * Clique no fundo da coluna de um mês, fora das fatias (`onCategoryClick` do
 * `Chart`): ali não há fatia sob o ponteiro, e o mês abre inteiro.
 */
export function cohortFromMonthIndex(
  points: readonly OverviewCohortPoint[],
  index: number,
): CohortChartClick | null {
  const point = monthAt(points, index)

  return point === null ? null : { month: point.month, series: null }
}

/**
 * Subtítulo do painel. O convite ao clique só entra quando existe o que
 * abrir: com o serviço ligado e algum mês com venda. A base sintética não
 * tem contrato, e a promessa seria falsa.
 */
export function cohortPanelSubtitle(
  points: readonly OverviewCohortPoint[] | null,
  listsAvailable: boolean,
): string {
  const base =
    'Vendas de cada mês pela data da venda e como estão hoje: ativou no mês, ativou depois, aguarda ou cancelou. Mostra todos os meses: o filtro de período não muda este gráfico; os demais filtros, sim.'
  const clickable = listsAvailable && points !== null && !isCohortEmpty(points)

  return clickable ? `${base} Clique numa barra ou no mês para ver os contratos.` : base
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
  if (isCohortEmpty(points)) return 'Evolução mensal das vendas: nenhuma venda na base.'

  const frases = points.map((point) => {
    const partes = COHORT_SERIES.map(
      (series) => `${series.name.toLowerCase()} ${formatNumber(point[series.id])}`,
    )
    if (point.other > 0) partes.push(`outras situações ${formatNumber(point.other)}`)
    return `${point.label}: ${formatNumber(point.sold)} vendidas, ${partes.join(', ')}.`
  })

  return `Evolução mensal das vendas. ${frases.join(' ')}`
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
  // recebe a ordem do fluxo logo abaixo, hoje a mesma.
  const bars: BarSeriesOption[] = COHORT_STACK_ORDER.map((id) => ({
    name: seriesName(id),
    type: 'bar',
    stack: 'safra',
    barMaxWidth: 24,
    itemStyle: { color: cohortColor(id, theme) },
    // Canto e rótulo são por mês, e não por série: os dois vão para a fatia
    // que de fato fecha a pilha na tela. A base fica reta sobre o eixo, e o
    // total vendido aparece em cima da barra (pedido do Mário em
    // 18/09/2026), para o número principal não depender do ponteiro.
    data: points.map((point) => {
      const isTop = cohortTopSlice(point, legendSelection, chartMax) === id
      const position = COHORT_STACK_ORDER.indexOf(id)
      const stack = cohortStackValues(point, legendSelection)
      const drawn = drawnStackValues(stack, chartMax)

      return {
        // Altura desenhada, com o mínimo de cada fatia; fatia desligada na
        // legenda não se desenha e fica com o valor real.
        value: stack[position] > 0 ? drawn[position] : point[id],
        itemStyle: { borderRadius: isTop ? [3, 3, 0, 0] : 0 },
        label: {
          show: isTop,
          position: 'top' as const,
          color: textColor,
          fontSize: 10.5,
          fontWeight: 600,
          formatter: () => formatNumber(cohortBarLabel(point, legendSelection)),
        },
      }
    }),
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
      // A legenda segue a ordem do fluxo, declarada à parte da pilha: do
      // sinal ligado para a fila e para a saída.
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
      // O nome do mês também abre a janela com o mês inteiro, como o nome do
      // dia no Volume diário da OS.
      triggerEvent: true,
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
      // O mesmo rótulo de milhar do painel Vendas ativadas por mês, em pt-BR.
      axisLabel: { color: textColor, fontSize: 10.5, formatter: formatAxisInteger },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: bars,
  }
}
