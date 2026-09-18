import type { BarSeriesOption, EChartsOption } from 'echarts'

import type { Theme } from '../../../contexts/PreferencesContextCore'
import { formatPercent } from '../../../lib/formatters'
import type { SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import type { OverviewBreakdown, OverviewMonthlyPoint } from './overviewModel'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const detailCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integer = new Intl.NumberFormat('pt-BR')

/**
 * Rótulo do eixo vertical de quantidade, em pt-BR: `1.000`, e não `1,000`,
 * que a biblioteca escreve sozinha e que aqui se lê como decimal. O mesmo
 * formatador vale para a Evolução mensal e para a Safra de vendas por mês,
 * para os dois eixos da página serem iguais (pedido do Mário em 18/09/2026).
 */
export function formatAxisInteger(value: number): string {
  return integer.format(value)
}

/**
 * Tipografia dos gráficos desta página.
 *
 * A biblioteca de gráficos NÃO herda a fonte da página: sem esta declaração ela
 * desenha eixo, legenda e tooltip na fonte padrão dela, e não na IBM Plex Sans
 * do portal. É a mesma linha que os quatro geradores da Visão Geral de OS já
 * carregam, e é o que fazia esta página parecer de outro sistema mesmo com as
 * cores certas.
 */
export const baseTextStyle = { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }

/**
 * Como os gráficos desta página animam.
 *
 * Entrada e troca de filtro instantâneas, como na Visão Geral de OS: a barra e
 * a fatia já nascem no tamanho final, sem subir de novo a cada recorte. O que
 * ganha movimento é só a transição de ESTADO, isto é, a fatia crescendo sob o
 * ponteiro, que a biblioteca governa por `stateAnimation` e só executa com a
 * animação ligada. Por isso as durações ficam zeradas em vez de `animation:
 * false`.
 */
export const chartAnimation = {
  animation: true,
  animationDuration: 0,
  animationDurationUpdate: 0,
  stateAnimation: { duration: 260, easing: 'cubicOut' },
} as const

/**
 * Caixa do tooltip, idêntica à da Visão Geral de OS.
 *
 * Superfície escura, texto claro, canto arredondado e sombra. `showDelay` e
 * `transitionDuration` zerados fazem a caixa aparecer parada no lugar em vez de
 * deslizar atrás do ponteiro, que é o comportamento padrão da biblioteca.
 */
const tooltipPalette = {
  light: { background: '#1a2331', border: '#1a2331', text: '#ffffff' },
  dark: { background: '#263448', border: '#46556b', text: '#f2f4f7' },
} as const

/** Faixa discreta do dia ou do mês sob o ponteiro, na mesma cor usada em OS. */
export const axisPointerColor = {
  light: 'rgba(26,35,49,0.06)',
  dark: 'rgba(233,237,243,0.08)',
} as const

/**
 * Quanto uma fatia precisa valer, em relação ao maior total do gráfico, para
 * o topo arredondado aparecer nela.
 *
 * A conta é geométrica: a área de desenho dos painéis desta página tem cerca
 * de 190 px de altura, então o raio de 3 px equivale a mais ou menos 1,6% do
 * maior mês. Arredondado para 2%, com folga.
 *
 * Sem esse piso, o topo aparece reto quando a última fatia com valor é
 * minúscula: na Safra de vendas por mês, setembro fecha com 1 cancelada e
 * agosto com 3, menos de meio pixel cada, e o arredondamento acontecia nessa
 * lasca invisível (visto na tela em 18/09/2026).
 */
export const MIN_ROUNDED_SLICE_SHARE = 0.02

/**
 * Qual fatia fecha a pilha de uma barra na tela: a última com valor que é
 * grande o bastante para mostrar a curva. `null` quando não há barra.
 *
 * Recebe os valores da pilha na ordem de empilhamento, do piso para o topo,
 * já com zero nas fatias desligadas na legenda, e `chartMax`, o maior total
 * do gráfico, que é a régua do piso.
 */
export function topStackIndex(values: readonly number[], chartMax = 0): number | null {
  const visible = values
    .map((value, index) => ({ value, index }))
    .filter((slice) => slice.value > 0)
  if (visible.length === 0) return null

  const floor = chartMax * MIN_ROUNDED_SLICE_SHARE
  const rounded = visible.filter((slice) => slice.value >= floor)
  const scale = rounded.length > 0 ? rounded : visible

  return scale[scale.length - 1].index
}

/**
 * Canto de uma fatia de barra empilhada, o padrão da casa desde 18/09/2026:
 * a barra nasce na linha do eixo, então a base fica RETA e só o topo é
 * arredondado, na fatia que de fato fecha a pilha.
 *
 * Um raio fixo na última série deixa o topo reto sempre que ela vale zero, o
 * que acontece na maioria dos meses em composições como a Safra de vendas
 * por mês e a Evolução mensal. Por isso o canto é calculado por barra.
 */
export function stackedBarRadius(
  values: readonly number[],
  index: number,
  chartMax = 0,
): number | number[] {
  return topStackIndex(values, chartMax) === index ? [3, 3, 0, 0] : 0
}

/**
 * Cores de eixo e grade dos gráficos de barras desta página, por tema. Uma
 * fonte só para a Evolução mensal e a Safra de vendas por mês.
 */
export function axisSkin(theme: Theme) {
  const dark = theme === 'dark'

  return {
    textColor: dark ? '#cdd5df' : '#667085',
    gridColor: dark ? 'rgba(203,213,225,.13)' : 'rgba(129,143,164,.16)',
    axisColor: dark ? 'rgba(203,213,225,.24)' : 'rgba(129,143,164,.25)',
  }
}

export function tooltipSkin(theme: Theme) {
  const colors = tooltipPalette[theme === 'dark' ? 'dark' : 'light']

  return {
    showDelay: 0,
    transitionDuration: 0,
    confine: true,
    backgroundColor: colors.background,
    borderColor: colors.border,
    textStyle: { color: colors.text, fontSize: 12, fontFamily: 'IBM Plex Sans' },
    // Sem `as const` aqui: a tupla travada não é aceita pelo tipo de `padding`
    // da biblioteca, que espera um vetor comum de números.
    padding: [7, 11],
  }
}

export const COMMERCIAL_SERIES = 'Comercial'
export const CORPORATE_SERIES = 'Corporativo'
/**
 * Terceira barra do gráfico mensal (17/09/2026): venda de vendedor sem equipe
 * no SGI ou sem vendedor registrado. Mesmo nome do bloco "Sem time" do painel
 * Vendas por time, para a pessoa ligar um ao outro.
 */
export const UNASSIGNED_SERIES = 'Sem time'
export const MONTHLY_VALUE_SERIES = 'Valor mensal'

/**
 * Paleta das séries, resolvida por tema.
 *
 * Cada série carrega a própria cor porque o filtro de time remove séries do
 * gráfico, e uma paleta por índice trocaria as cores.
 *
 * Comercial usa o azul de dados do Comercial, `#2f7de1` — o MESMO das barras,
 * ícones e rankings desta página e das barras de Vendas por período. Ele é
 * igual nos dois temas: a cor da série é identidade do gráfico, não decoração
 * de superfície. É distinto de propósito do azul das barras de OS (`#2f6bff`,
 * `OS_CHART_ACCENT`) e do acento da estrutura (`#003be2`, rebrand set/2026);
 * o antigo `#4d95ef` do tema escuro saiu por não bater com o resto da página.
 *
 * Corporativo usa o verde institucional Impacto: `#00a862` no tema claro, que é
 * a variação com contraste sobre branco, e `#00d776` no escuro, o verde do
 * logo. Como o Corporativo assumiu o verde, a linha Valor mensal saiu do verde
 * e foi para laranja, que se separa bem do azul e do verde nos dois temas e não
 * é usado em nenhum estado negativo da página (negativo é vermelho `#d32744`).
 *
 * A cor nunca é o único identificador: nome da série, rótulo da legenda e texto
 * acessível acompanham cada uma.
 */
export const OVERVIEW_SERIES_COLORS = {
  comercial: { light: '#2f7de1', dark: '#2f7de1' },
  corporativo: { light: '#00a862', dark: '#00d776' },
  monthlyValue: { light: '#e06a00', dark: '#ff9f43' },
  /**
   * "Sem time": vendedor sem vínculo em `team_users` no SGI, ou venda sem
   * vendedor registrado, que o serviço reporta em `quality` e nunca assume
   * como Comercial. Pinta o bloco e a fatia de Vendas por time e, desde
   * 17/09/2026, a terceira barra do gráfico mensal. Cinza neutro da paleta
   * de dados (a última cor da rosca de OS), igual nos dois temas: 4,76 sobre
   * `#ffffff` e 3,08 sobre `#1f2937`, medidos em 10/09/2026. Pintar de azul
   * afirmaria um time que o cadastro não tem.
   */
  semTime: { light: '#64748b', dark: '#64748b' },
} as const

type SeriesColorKey = keyof typeof OVERVIEW_SERIES_COLORS

export function overviewSeriesColor(key: SeriesColorKey, theme: Theme): string {
  return OVERVIEW_SERIES_COLORS[key][theme === 'dark' ? 'dark' : 'light']
}

/** Cor do time para rosca, rótulos e blocos, sempre pela mesma fonte. */
export function overviewTeamColor(teamId: string, theme: Theme): string {
  if (teamId === 'corporativo') return overviewSeriesColor('corporativo', theme)
  if (teamId === 'comercial') return overviewSeriesColor('comercial', theme)
  // Qualquer outro id é o "Sem time" do serviço (`sem-time`): nunca herda o
  // azul do Comercial por descuido.
  return overviewSeriesColor('semTime', theme)
}

type TooltipItem = {
  readonly axisValue?: unknown
  readonly axisValueLabel?: string
  readonly marker?: string
  readonly seriesName?: string
  readonly value?: unknown
}

function numericValue(value: unknown): number {
  const normalized = Array.isArray(value) ? value[value.length - 1] : value
  return Number(normalized)
}

/** Linha "rótulo à esquerda, número à direita" sem `float`: o `float` escapava
 *  da caixa do tooltip em painéis estreitos e quebrava o alinhamento. */
export function tooltipRow(left: string, right: string): string {
  return (
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;line-height:17px">' +
    `<span style="display:flex;align-items:center;min-width:0">${left}</span>` +
    `<span style="font-weight:600;white-space:nowrap">${right}</span>` +
    '</div>'
  )
}

export function formatOverviewMonthlyTooltip(params: unknown): string {
  const items = (Array.isArray(params) ? params : [params]).filter(
    (item): item is TooltipItem => typeof item === 'object' && item !== null,
  )
  // `axisValue` é o rótulo completo da coleção (`Jul/26`). O eixo pode encurtar
  // o texto para caber em doze meses; o tooltip continua mostrando o mês inteiro.
  const first = items[0]
  const title =
    typeof first?.axisValue === 'string' ? first.axisValue : (first?.axisValueLabel ?? '')
  const rows = items.map((item) => {
    const value = numericValue(item.value)
    const formatted =
      item.seriesName === MONTHLY_VALUE_SERIES
        ? detailCurrency.format(value)
        : `${integer.format(value)} vendas`

    return tooltipRow(`${item.marker ?? ''}${item.seriesName ?? ''}`, formatted)
  })

  return (
    '<div style="min-width:150px">' +
    `<div style="margin-bottom:4px;font-weight:600">${title}</div>` +
    rows.join('') +
    '</div>'
  )
}

export type OverviewDetailRow = {
  readonly term: string
  readonly value: string
}

export type TeamDetail = {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly activeSales: number
  readonly share: string
  /** Ticket médio já formatado. Vem antes do valor mensal na leitura. */
  readonly averageTicket: OverviewDetailRow
  /** Fechamento financeiro do bloco. É sempre a última informação. */
  readonly monthlyValue: OverviewDetailRow
  /** Todas as linhas na mesma ordem exibida na tela. */
  readonly rows: readonly OverviewDetailRow[]
  readonly accessibleText: string
}

/**
 * Leitura permanente de um time no painel Vendas por time.
 *
 * A ordem das linhas é a ordem da tela: vendas ativadas, participação, ticket
 * médio e, por último, valor mensal. O texto acessível segue a mesma sequência.
 *
 * O ticket médio é o valor mensal ativado dividido pelas ativações do próprio
 * time. Sem ativações não existe divisão possível, e nenhum valor é inventado.
 */
export function buildTeamDetail(row: OverviewBreakdown, theme: Theme): TeamDetail {
  const share = formatPercent(row.share)
  const averageTicket: OverviewDetailRow = {
    term: 'Ticket médio',
    value:
      row.activeSales === 0
        ? 'Sem ativações'
        : detailCurrency.format(row.monthlyValue / row.activeSales),
  }
  const monthlyValue: OverviewDetailRow = {
    term: 'Valor mensal',
    value: detailCurrency.format(row.monthlyValue),
  }
  const rows: OverviewDetailRow[] = [
    { term: 'Vendas ativadas', value: integer.format(row.activeSales) },
    { term: 'Participação', value: share },
    averageTicket,
    monthlyValue,
  ]

  return {
    id: row.id,
    label: row.label,
    color: overviewTeamColor(row.id, theme),
    activeSales: row.activeSales,
    share,
    averageTicket,
    monthlyValue,
    rows,
    accessibleText: `${row.label}: ${rows
      .map((item) => `${item.term} ${item.value}`)
      .join('; ')}.`,
  }
}

/**
 * Rosca de Vendas por time.
 *
 * Responde ao ponteiro como a rosca da Visão Geral de OS: a fatia sob o mouse
 * cresce para fora e o tooltip mostra o time, a quantidade e a participação.
 * Antes ela era inerte, sem hover e sem tooltip, e era o único desenho da
 * página que não devolvia nada ao ponteiro.
 *
 * O tooltip NÃO substitui os blocos abaixo do gráfico: eles continuam com todos
 * os detalhes permanentemente visíveis, que é o que atende quem não usa mouse.
 * O hover é uma consulta rápida, não a única forma de ler o dado.
 */
export function makeOverviewTeamOptions(
  rows: readonly OverviewBreakdown[],
  total: number,
  theme: Theme,
  selectedTeam: SalesPeriodTeamFilter = 'todos',
): EChartsOption {
  const headingColor = theme === 'dark' ? '#f2f4f7' : '#101828'
  const textColor = theme === 'dark' ? '#cdd5df' : '#667085'

  const byName = new Map(rows.map((row) => [row.label, row]))

  return {
    textStyle: baseTextStyle,
    ...chartAnimation,
    title: {
      text: integer.format(total),
      subtext: total === 1 ? 'ativação' : 'ativações',
      left: 'center',
      top: 'center',
      itemGap: 2,
      textStyle: {
        color: headingColor,
        fontSize: 22,
        fontWeight: 700,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      },
      subtextStyle: { color: textColor, fontSize: 10.5 },
    },
    tooltip: {
      trigger: 'item',
      ...tooltipSkin(theme),
      extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:250px',
      formatter: (params: unknown) => {
        const name = (params as { name?: string }).name
        const row = typeof name === 'string' ? byName.get(name) : undefined
        if (row === undefined) return ''

        return (
          '<div style="min-width:130px">' +
          `<div style="margin-bottom:4px;font-weight:600">${row.label}</div>` +
          tooltipRow('Vendas ativadas', integer.format(row.activeSales)) +
          tooltipRow('Participação', formatPercent(row.share)) +
          '</div>'
        )
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['66%', '90%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        // A fatia sob o ponteiro cresce para fora, como na Composição por tipo
        // de OS. Sem `focus`, as demais continuam com a cor cheia.
        emphasis: { scale: true, scaleSize: 6 },
        data: rows.map((row) => ({
          name: row.label,
          value: row.activeSales,
          itemStyle: {
            color: overviewTeamColor(row.id, theme),
            borderWidth: 0,
            // O time selecionado no filtro superior também é reforçado na rosca.
            // O destaque nunca é só a cor: o bloco abaixo ganha borda, fundo e
            // o rótulo "Selecionado".
            opacity: selectedTeam === 'todos' || selectedTeam === row.id ? 1 : 0.38,
          },
        })),
      },
    ],
  }
}

/**
 * Encurta o rótulo do eixo quando toda a coleção pertence ao mesmo ano.
 *
 * `Jan/26` a `Dez/26` não cabem lado a lado em doze meses, e o ano repetido não
 * informa nada. Com anos diferentes na coleção o rótulo completo é preservado,
 * sem nenhum ajuste manual. O ano continua no tooltip e no rodapé da página.
 *
 * Recebe qualquer coleção com rótulo de mês: a Evolução mensal e, desde
 * 18/09/2026, a Safra de vendas por mês, que mostra os mesmos meses.
 */
export function makeMonthlyAxisLabelFormatter(
  monthly: readonly { readonly label: string }[],
): ((value: string) => string) | undefined {
  const years = new Set(
    monthly.map((point) => point.label.split('/')[1]).filter((year) => year !== undefined),
  )
  if (years.size !== 1) return undefined
  return (value: string) => value.split('/')[0]
}

/** Estado inicial da legenda do gráfico mensal: tudo visível. */
export function initialMonthlyLegendSelection(): Record<string, boolean> {
  return {
    [COMMERCIAL_SERIES]: true,
    [CORPORATE_SERIES]: true,
    [UNASSIGNED_SERIES]: true,
    [MONTHLY_VALUE_SERIES]: true,
  }
}

/** As três barras do gráfico mensal: os dois times e a venda sem time. */
export type MonthlyTeams = {
  readonly commercial: boolean
  readonly corporate: boolean
  readonly unassigned: boolean
}

/**
 * Quais barras compõem a linha Valor mensal.
 *
 * Com pelo menos uma barra visível, a linha soma exatamente as visíveis. Com
 * nenhuma barra visível não existe recorte a representar, então a linha volta
 * ao total integral permitido pelo filtro superior, em vez de cair a zero:
 * `Todos os times` devolve o consolidado com a venda sem time, `Comercial`
 * devolve o Comercial inteiro e `Corporativo` devolve o Corporativo inteiro.
 */
export function resolveMonthlyValueTeams(
  allowed: MonthlyTeams,
  visible: MonthlyTeams,
): MonthlyTeams {
  if (visible.commercial || visible.corporate || visible.unassigned) return visible
  return allowed
}

/**
 * Valor mensal ponto a ponto, somando as barras recebidas.
 *
 * Os valores por grupo vêm da fonte, fato a fato. Nada é rateado por
 * percentual nem estimado.
 */
export function monthlyValueSeries(
  monthly: readonly OverviewMonthlyPoint[],
  teams: MonthlyTeams,
): number[] {
  return monthly.map(
    (point) =>
      (teams.commercial ? point.commercialValue : 0) +
      (teams.corporate ? point.corporateValue : 0) +
      (teams.unassigned ? point.unassignedValue : 0),
  )
}

export function makeOverviewMonthlyOptions(
  monthly: readonly OverviewMonthlyPoint[],
  theme: Theme,
  team: SalesPeriodTeamFilter = 'todos',
  legendSelection: Record<string, boolean> = initialMonthlyLegendSelection(),
): EChartsOption {
  const { textColor, gridColor, axisColor } = axisSkin(theme)
  const commercialColor = overviewSeriesColor('comercial', theme)
  const corporateColor = overviewSeriesColor('corporativo', theme)
  const unassignedColor = overviewSeriesColor('semTime', theme)
  const valueColor = overviewSeriesColor('monthlyValue', theme)

  // O filtro global define quais séries existem no gráfico; a legenda define
  // quais das existentes estão ligadas. Sem nenhuma barra ligada, a linha volta
  // ao total permitido pelo filtro superior.
  //
  // A venda sem time só existe em `Todos os times`: o filtro de time exige o
  // vínculo do vendedor com a equipe, então Comercial e Corporativo sozinhos
  // nunca a contêm, e desenhá-la ali seria uma barra sempre vazia.
  const hasCommercial = team !== 'corporativo'
  const hasCorporate = team !== 'comercial'
  const hasUnassigned = team === 'todos'
  const allowed = {
    commercial: hasCommercial,
    corporate: hasCorporate,
    unassigned: hasUnassigned,
  }
  const visible = {
    commercial: hasCommercial && legendSelection[COMMERCIAL_SERIES] !== false,
    corporate: hasCorporate && legendSelection[CORPORATE_SERIES] !== false,
    unassigned: hasUnassigned && legendSelection[UNASSIGNED_SERIES] !== false,
  }
  const valueTeams = resolveMonthlyValueTeams(allowed, visible)

  // Pilha de um mês, do piso para o topo, com zero no que está fora do
  // recorte ou desligado na legenda: é o que decide qual fatia leva o topo
  // arredondado, pela mesma regra da Safra de vendas por mês.
  const stackOf = (point: OverviewMonthlyPoint): number[] => [
    visible.commercial ? point.commercialSales : 0,
    visible.corporate ? point.corporateSales : 0,
    visible.unassigned ? point.unassignedSales : 0,
  ]
  const monthlyMax = Math.max(
    0,
    ...monthly.map((point) => stackOf(point).reduce((total, value) => total + value, 0)),
  )
  const barData = (point: OverviewMonthlyPoint, value: number, index: number) => ({
    value,
    itemStyle: { borderRadius: stackedBarRadius(stackOf(point), index, monthlyMax) },
  })

  const bars: BarSeriesOption[] = []

  if (hasCommercial) {
    bars.push({
      name: COMMERCIAL_SERIES,
      type: 'bar',
      stack: 'vendas',
      barMaxWidth: 24,
      itemStyle: { color: commercialColor },
      data: monthly.map((point) => barData(point, point.commercialSales, 0)),
    })
  }

  if (hasCorporate) {
    bars.push({
      name: CORPORATE_SERIES,
      type: 'bar',
      stack: 'vendas',
      barMaxWidth: 24,
      itemStyle: { color: corporateColor },
      data: monthly.map((point) => barData(point, point.corporateSales, 1)),
    })
  }

  if (hasUnassigned) {
    // Desenhada mesmo zerada, com a entrada na legenda: zero venda sem time é
    // resultado, e é o que a página vai mostrar quando o cadastro do SGI
    // estiver completo. Sem esta barra, os meses anteriores a junho/2026, em
    // que nenhum contrato tem vendedor registrado, apareciam sem venda nenhuma.
    bars.push({
      name: UNASSIGNED_SERIES,
      type: 'bar',
      stack: 'vendas',
      barMaxWidth: 24,
      itemStyle: { color: unassignedColor },
      data: monthly.map((point) => barData(point, point.unassignedSales, 2)),
    })
  }

  return {
    textStyle: baseTextStyle,
    ...chartAnimation,
    // A margem direita subiu de 68 para 72 junto com o corpo dos rótulos: é ali
    // que fica o eixo em reais, o texto mais largo do gráfico.
    grid: { left: 46, right: 72, top: 44, bottom: 30 },
    legend: {
      top: 2,
      right: 0,
      // Ponto redondo do mesmo tamanho para todas as séries, como na Visão
      // Geral de OS: a legenda é uma lista de nomes com a cor ao lado, e não
      // uma miniatura do desenho de cada série.
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: textColor, fontSize: 11.5 },
      // O estado visual da legenda vem do mesmo objeto que recalcula a linha,
      // então marca e valor nunca divergem.
      selected: legendSelection,
    },
    tooltip: {
      trigger: 'axis',
      ...tooltipSkin(theme),
      // A faixa do mês sob o ponteiro é a marca certa para barra: uma linha
      // vertical cairia no meio da coluna e cortaria a barra ao meio. A cor é
      // declarada porque o cinza padrão da biblioteca é forte demais e cobre o
      // mês inteiro.
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: axisPointerColor[theme === 'dark' ? 'dark' : 'light'] },
      },
      extraCssText:
        'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:250px;white-space:normal',
      formatter: formatOverviewMonthlyTooltip,
    },
    xAxis: {
      type: 'category',
      // Os meses vêm da coleção recebida: sete hoje, doze quando a fonte
      // entregar doze, sem nenhum rótulo fixo no gráfico.
      data: monthly.map((point) => point.label),
      axisLabel: {
        color: textColor,
        fontSize: 10.5,
        interval: 0,
        hideOverlap: true,
        margin: 9,
        formatter: makeMonthlyAxisLabelFormatter(monthly),
      },
      axisLine: { lineStyle: { color: axisColor } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: textColor, fontSize: 10.5, formatter: formatAxisInteger },
        splitLine: { lineStyle: { color: gridColor } },
      },
      {
        type: 'value',
        axisLabel: {
          color: textColor,
          fontSize: 10.5,
          formatter: (value: number) => currency.format(value),
        },
        splitLine: { show: false },
      },
    ],
    series: [
      ...bars,
      {
        name: MONTHLY_VALUE_SERIES,
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: valueColor },
        lineStyle: { width: 2.5, color: valueColor },
        // Sem preenchimento sob a linha. A área laranja a 6% lavava o quadro
        // inteiro de creme e era o que dava o tom amarelado neste painel, que
        // nenhum gráfico da Visão Geral de OS tem. A linha continua identificada
        // por cor, ponto, legenda e tooltip.
        data: monthlyValueSeries(monthly, valueTeams),
      },
    ],
  }
}
