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

export const COMMERCIAL_SERIES = 'Comercial'
export const CORPORATE_SERIES = 'Corporativo'
export const MONTHLY_VALUE_SERIES = 'Valor mensal'

/**
 * Paleta das séries, resolvida por tema.
 *
 * Cada série carrega a própria cor porque o filtro de time remove séries do
 * gráfico, e uma paleta por índice trocaria as cores.
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
  comercial: { light: '#2f7de1', dark: '#4d95ef' },
  corporativo: { light: '#00a862', dark: '#00d776' },
  monthlyValue: { light: '#e06a00', dark: '#ff9f43' },
} as const

type SeriesColorKey = keyof typeof OVERVIEW_SERIES_COLORS

export function overviewSeriesColor(key: SeriesColorKey, theme: Theme): string {
  return OVERVIEW_SERIES_COLORS[key][theme === 'dark' ? 'dark' : 'light']
}

/** Cor do time para rosca, rótulos e blocos, sempre pela mesma fonte. */
export function overviewTeamColor(teamId: string, theme: Theme): string {
  return overviewSeriesColor(teamId === 'corporativo' ? 'corporativo' : 'comercial', theme)
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
function tooltipRow(left: string, right: string): string {
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
 * Sem tooltip: os detalhes ficam permanentemente visíveis nos blocos abaixo do
 * gráfico, então um tooltip aqui apenas repetiria a mesma informação.
 */
export function makeOverviewTeamOptions(
  rows: readonly OverviewBreakdown[],
  total: number,
  theme: Theme,
  selectedTeam: SalesPeriodTeamFilter = 'todos',
): EChartsOption {
  const headingColor = theme === 'dark' ? '#f2f4f7' : '#101828'
  const textColor = theme === 'dark' ? '#cdd5df' : '#667085'

  return {
    animationDuration: 450,
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
      subtextStyle: { color: textColor, fontSize: 10 },
    },
    tooltip: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['66%', '90%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        silent: true,
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
 */
export function makeMonthlyAxisLabelFormatter(
  monthly: readonly OverviewMonthlyPoint[],
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
    [MONTHLY_VALUE_SERIES]: true,
  }
}

export type MonthlyTeams = {
  readonly commercial: boolean
  readonly corporate: boolean
}

/**
 * Quais times compõem a linha Valor mensal.
 *
 * Com pelo menos uma barra visível, a linha soma exatamente os times visíveis.
 * Com nenhuma barra visível não existe recorte a representar, então a linha
 * volta ao total integral permitido pelo filtro superior, em vez de cair a
 * zero: `Todos os times` devolve o consolidado, `Comercial` devolve o Comercial
 * inteiro e `Corporativo` devolve o Corporativo inteiro.
 */
export function resolveMonthlyValueTeams(
  allowed: MonthlyTeams,
  visible: MonthlyTeams,
): MonthlyTeams {
  if (visible.commercial || visible.corporate) return visible
  return allowed
}

/**
 * Valor mensal ponto a ponto, somando os times recebidos.
 *
 * Os valores por time são derivados dos fatos pelo modelo. Nada é rateado por
 * percentual nem estimado.
 */
export function monthlyValueSeries(
  monthly: readonly OverviewMonthlyPoint[],
  teams: MonthlyTeams,
): number[] {
  return monthly.map(
    (point) =>
      (teams.commercial ? point.commercialValue : 0) +
      (teams.corporate ? point.corporateValue : 0),
  )
}

export function makeOverviewMonthlyOptions(
  monthly: readonly OverviewMonthlyPoint[],
  theme: Theme,
  team: SalesPeriodTeamFilter = 'todos',
  legendSelection: Record<string, boolean> = initialMonthlyLegendSelection(),
): EChartsOption {
  const textColor = theme === 'dark' ? '#cdd5df' : '#667085'
  const gridColor = theme === 'dark' ? 'rgba(203,213,225,.13)' : 'rgba(129,143,164,.16)'
  const axisColor = theme === 'dark' ? 'rgba(203,213,225,.24)' : 'rgba(129,143,164,.25)'
  const commercialColor = overviewSeriesColor('comercial', theme)
  const corporateColor = overviewSeriesColor('corporativo', theme)
  const valueColor = overviewSeriesColor('monthlyValue', theme)

  // O filtro global define quais séries existem no gráfico; a legenda define
  // quais das existentes estão ligadas. Sem nenhuma barra ligada, a linha volta
  // ao total permitido pelo filtro superior.
  const hasCommercial = team !== 'corporativo'
  const hasCorporate = team !== 'comercial'
  const allowed = { commercial: hasCommercial, corporate: hasCorporate }
  const visible = {
    commercial: hasCommercial && legendSelection[COMMERCIAL_SERIES] !== false,
    corporate: hasCorporate && legendSelection[CORPORATE_SERIES] !== false,
  }
  const valueTeams = resolveMonthlyValueTeams(allowed, visible)
  const stacked = hasCommercial && hasCorporate

  const bars: BarSeriesOption[] = []

  if (hasCommercial) {
    bars.push({
      name: COMMERCIAL_SERIES,
      type: 'bar',
      stack: 'vendas',
      barMaxWidth: 24,
      itemStyle: {
        color: commercialColor,
        // Empilhado, o Comercial arredonda a base do conjunto; sozinho, o topo.
        borderRadius: stacked ? [0, 0, 3, 3] : [3, 3, 0, 0],
      },
      data: monthly.map((point) => point.commercialSales),
    })
  }

  if (hasCorporate) {
    bars.push({
      name: CORPORATE_SERIES,
      type: 'bar',
      stack: 'vendas',
      barMaxWidth: 24,
      itemStyle: { color: corporateColor, borderRadius: [3, 3, 0, 0] },
      data: monthly.map((point) => point.corporateSales),
    })
  }

  return {
    animationDuration: 450,
    grid: { left: 46, right: 68, top: 44, bottom: 30 },
    legend: {
      top: 2,
      right: 0,
      itemHeight: 8,
      itemWidth: 14,
      textStyle: { color: textColor, fontSize: 10 },
      // O estado visual da legenda vem do mesmo objeto que recalcula a linha,
      // então marca e valor nunca divergem.
      selected: legendSelection,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      extraCssText: 'max-width:250px;white-space:normal',
      formatter: formatOverviewMonthlyTooltip,
    },
    xAxis: {
      type: 'category',
      // Os meses vêm da coleção recebida: sete hoje, doze quando a fonte
      // entregar doze, sem nenhum rótulo fixo no gráfico.
      data: monthly.map((point) => point.label),
      axisLabel: {
        color: textColor,
        fontSize: 10,
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
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridColor } },
      },
      {
        type: 'value',
        axisLabel: {
          color: textColor,
          fontSize: 10,
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
        areaStyle: { color: valueColor, opacity: 0.06 },
        data: monthlyValueSeries(monthly, valueTeams),
      },
    ],
  }
}
