import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'
import { formatDecimal, formatMinutes, formatNumber, formatPercent } from '../../lib/formatters'
import type { TechnicianRow, UnproductiveReasonRow } from './techniciansModel'

/**
 * Opções dos dois rankings da página de Técnicos: o desempenho por técnico e
 * os motivos das visitas improdutivas.
 *
 * Um gerador para os dois porque a leitura é a mesma: um valor por item,
 * ordenado, com o nome no eixo e o número na ponta da barra. O que muda é o
 * que a ponta escreve (média com uma casa decimal no ranking, contagem nos
 * motivos) e o conteúdo do tooltip.
 *
 * Vive na pasta da página, e não em `components/charts/chartOptions`, pela
 * mesma razão dos geradores da Visão Geral de OS: `makeBarOptions` continua
 * servindo as telas simuladas com a aparência que elas já têm, e uma mudança
 * aqui não pode repintar nenhuma delas.
 *
 * O ranking NÃO ordena por taxa de conclusão de propósito (decisão do Mário
 * em 21/09/2026): dos 729 motivos de improdutiva medidos no SGI entre junho e
 * setembro de 2026, 378 são cliente ausente e só 6 apontam para algo sob
 * controle do técnico. A taxa entra no tooltip como contexto.
 */

export const TECHNICIANS_EMPTY_MESSAGE = 'Sem visitas no período'

/** Estado vazio dos motivos: não houve visita improdutiva, que é resultado. */
export const NO_UNPRODUCTIVE_MESSAGE = 'Nenhuma visita improdutiva no período'

/** Limite de caracteres do nome no eixo; o nome inteiro segue no tooltip. */
export const LABEL_MAX_LENGTH = 24

/**
 * Limite visual do nome no eixo, em pixels, com reticências do próprio
 * ECharts. O limite de caracteres não controla largura: um nome curto em
 * letras largas ainda estoura a faixa que `containLabel` reservou.
 */
export const LABEL_MAX_WIDTH = 150

export function truncateTechnicianLabel(value: string): string {
  if (value.length <= LABEL_MAX_LENGTH) return value
  return `${value.slice(0, LABEL_MAX_LENGTH - 1).trimEnd()}…`
}

/**
 * Nome curto para o eixo: primeiro nome e o sobrenome inicial.
 *
 * O eixo de um ranking com dezoito técnicos não comporta nome completo sem
 * esmagar as barras. O nome inteiro continua no dado, no tooltip, na tabela e
 * na leitura acessível: encurtar aqui é desenho, nunca perda de informação.
 */
export function shortTechnicianName(name: string): string {
  const partes = name.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return name.trim()
  return `${partes[0]} ${partes[partes.length - 1]}`
}

const palette = {
  light: {
    category: '#344054',
    valueLabel: '#475467',
    splitLine: '#f1f3f7',
    empty: '#98a2b3',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
    tooltipMuted: '#c7cfdb',
  },
  dark: {
    category: '#dfe5ec',
    valueLabel: '#cdd5df',
    splitLine: 'rgba(159,174,196,0.14)',
    empty: '#a9b5c6',
    tooltipBackground: '#263448',
    tooltipBorder: '#46556b',
    tooltipText: '#f2f4f7',
    tooltipMuted: '#aab6c6',
  },
} as const

const baseTextStyle = { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }

/** Uma barra desenhada: o que o eixo mostra, o que a ponta escreve e o tooltip. */
type Bar = {
  readonly label: string
  readonly value: number
  readonly text: string
  readonly tooltip: string
}

function emptyOptions(message: string, name: string, theme: Theme): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  return {
    textStyle: baseTextStyle,
    animation: false,
    aria: { enabled: true, label: { enabled: true, description: `${name}. ${message}.` } },
    title: {
      text: message,
      left: 'center',
      top: 'middle',
      textStyle: { ...baseTextStyle, color: colors.empty, fontSize: 12.5, fontWeight: 'normal' },
    },
  }
}

/**
 * Montagem comum das duas barras horizontais.
 *
 * O eixo de categorias do ECharts desenha de baixo para cima, então a coleção
 * é invertida no desenho para o primeiro colocado ficar no topo. Rótulo,
 * tooltip e descrição acessível leem sempre da mesma lista, e por isso não
 * podem divergir entre si.
 */
function makeBarRanking(
  bars: readonly Bar[],
  color: string,
  description: string,
  theme: Theme,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const drawn = [...bars].reverse()

  return {
    textStyle: baseTextStyle,
    animation: false,
    aria: { enabled: true, label: { enabled: true, description } },
    grid: { left: 4, right: 62, top: 6, bottom: 6, containLabel: true },
    tooltip: {
      trigger: 'item',
      showDelay: 0,
      transitionDuration: 0,
      confine: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText, fontSize: 12, fontFamily: 'IBM Plex Sans' },
      padding: [7, 11],
      extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:280px',
      formatter: (params: unknown) => {
        const index = (params as { dataIndex?: number }).dataIndex
        return (typeof index === 'number' ? drawn[index]?.tooltip : undefined) ?? ''
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    yAxis: {
      type: 'category',
      data: drawn.map((bar) => bar.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: colors.category,
        fontSize: 11.5,
        fontWeight: 500,
        // A fonte precisa ser declarada aqui também: `containLabel` mede o
        // rótulo com a fonte do próprio eixo e desenha com a da página. Sem
        // isto a faixa sai estreita demais e o nome é amputado à esquerda.
        fontFamily: 'IBM Plex Sans, sans-serif',
        width: LABEL_MAX_WIDTH,
        overflow: 'truncate',
        ellipsis: '…',
        formatter: truncateTechnicianLabel,
      },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 15,
        // Em barra horizontal, `barMinHeight` age no comprimento: é o piso que
        // impede o valor pequeno de virar um borrão de menos de um pixel.
        barMinHeight: 4,
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'right',
          color: colors.valueLabel,
          fontSize: 11,
          fontWeight: 600,
          formatter: (params: { dataIndex: number }) => drawn[params.dataIndex]?.text ?? '',
        },
        data: drawn.map((bar) => ({
          value: bar.value,
          name: bar.label,
          itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        })),
      },
    ],
  }
}

/** Linha do tooltip: rótulo à esquerda, valor à direita, com o nome truncando. */
function tooltipLine(label: string, value: string, mutedColor: string): string {
  return (
    '<div style="display:flex;gap:10px;align-items:baseline">' +
    `<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${mutedColor}">${label}</span>` +
    `<span style="flex:none;margin-left:auto;font-weight:600">${value}</span>` +
    '</div>'
  )
}

/** Concluídas por dia, com uma casa decimal, como a ponta da barra escreve. */
export function formatPerDay(value: number): string {
  return formatDecimal(value, 1)
}

/** Descrição acessível do ranking, da mesma coleção que a tela desenha. */
export function buildRankingDescription(
  name: string,
  rows: readonly TechnicianRow[],
  emptyMessage: string = TECHNICIANS_EMPTY_MESSAGE,
): string {
  if (rows.length === 0) return `${name}. ${emptyMessage}.`

  const itens = rows
    .map(
      (row) =>
        `${row.name}: ${formatPerDay(row.completedPerDay)} concluídas por dia, ` +
        `${formatNumber(row.completed)} em ${formatNumber(row.daysWorked)} dias`,
    )
    .join('. ')

  return `${name}, ordenado por visitas concluídas por dia trabalhado. ${itens}.`
}

export type TechnicianRankingInput = {
  /** Nome do gráfico, só para a leitura acessível. */
  readonly name: string
  readonly rows: readonly TechnicianRow[]
  /** Cor de identidade da frente, igual nos dois temas. */
  readonly color: string
  readonly theme: Theme
  /**
   * Texto do estado vazio desta frente.
   *
   * Existe porque vazio aqui tem DOIS significados diferentes: ninguém
   * trabalhou nesta frente, ou trabalhou mas ninguém alcançou o piso de dias
   * em campo. Dizer "sem visitas" no segundo caso contradiria a contagem de
   * técnicos que o próprio painel mostra no subtítulo.
   */
  readonly emptyMessage?: string
}

/**
 * Ranking de técnicos de uma frente de trabalho.
 *
 * Só recebe quem passou do piso de dias em campo: quem está abaixo continua na
 * tabela da página, e ficaria no topo daqui com uma visita única concluída.
 */
export function makeTechnicianRankingOptions({
  color,
  emptyMessage = TECHNICIANS_EMPTY_MESSAGE,
  name,
  rows,
  theme,
}: TechnicianRankingInput): EChartsOption {
  if (rows.length === 0) return emptyOptions(emptyMessage, name, theme)

  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const bars = rows.map((row) => ({
    label: shortTechnicianName(row.name),
    value: row.completedPerDay,
    text: formatPerDay(row.completedPerDay),
    tooltip:
      `<div style="margin-bottom:4px;font-weight:600">${row.name}</div>` +
      tooltipLine('Concluídas por dia', formatPerDay(row.completedPerDay), colors.tooltipMuted) +
      tooltipLine('Concluídas', formatNumber(row.completed), colors.tooltipMuted) +
      tooltipLine('Dias em campo', formatNumber(row.daysWorked), colors.tooltipMuted) +
      tooltipLine('Visitas', formatNumber(row.visits), colors.tooltipMuted) +
      tooltipLine('Taxa de conclusão', formatPercent(row.completionRate), colors.tooltipMuted) +
      (row.serviceMinutes === null
        ? ''
        : tooltipLine(
            'Tempo por serviço',
            formatMinutes(row.serviceMinutes),
            colors.tooltipMuted,
          )) +
      (row.travelMinutes === null
        ? ''
        : tooltipLine('Deslocamento', formatMinutes(row.travelMinutes), colors.tooltipMuted)),
  }))

  return makeBarRanking(bars, color, buildRankingDescription(name, rows), theme)
}

/** Descrição acessível dos motivos, da mesma coleção ordenada. */
export function buildReasonsDescription(rows: readonly UnproductiveReasonRow[]): string {
  if (rows.length === 0) return `Motivos das visitas improdutivas. ${NO_UNPRODUCTIVE_MESSAGE}.`

  const itens = rows
    .map((row) => `${row.reason}: ${formatNumber(row.count)} visitas, ${formatPercent(row.share)}`)
    .join('. ')

  return `Motivos das visitas improdutivas. ${itens}.`
}

export type UnproductiveReasonsInput = {
  readonly rows: readonly UnproductiveReasonRow[]
  readonly color: string
  readonly theme: Theme
}

/** Motivos das visitas improdutivas do recorte, do mais frequente ao menos. */
export function makeUnproductiveReasonsOptions({
  color,
  rows,
  theme,
}: UnproductiveReasonsInput): EChartsOption {
  if (rows.length === 0) {
    return emptyOptions(NO_UNPRODUCTIVE_MESSAGE, 'Motivos das visitas improdutivas', theme)
  }

  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const bars = rows.map((row) => ({
    label: row.reason,
    value: row.count,
    text: formatNumber(row.count),
    tooltip:
      `<div style="margin-bottom:4px;font-weight:600">${row.reason}</div>` +
      tooltipLine('Visitas', formatNumber(row.count), colors.tooltipMuted) +
      tooltipLine('Das improdutivas', formatPercent(row.share), colors.tooltipMuted),
  }))

  return makeBarRanking(bars, color, buildReasonsDescription(rows), theme)
}
