import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'
import { statusColors } from '../../data/dashboardAggregates'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { formatNumber, formatPercent } from '../../lib/formatters'
import { groupOf, outcomeOf } from './overviewModel'

/**
 * Opções do painel `Motivos de improdutiva` da Visão Geral de OS.
 *
 * Entrou em 23/09/2026 no lugar de `Distribuição por status`, a pedido do
 * Mário: o painel antigo repetia os números do Destino das OS em outro corte
 * e não respondia nada novo. Este responde o "por quê" da improdutiva, que a
 * página só dizia na leitura do card.
 *
 * Vive na pasta da página, e não reaproveita o gerador da página de Técnicos,
 * porque tem regras próprias que lá não existem, e mudar aquele arquivo
 * repintaria a outra página. O que ele congela:
 *
 * - o motivo NÃO é texto livre na prática: o aplicativo do técnico oferece uma
 *   lista, e o serviço encurta cada frase (`normalize_unproductive_reason`).
 *   Medido em 23/09/2026: 775 improdutivas desde maio, 9 motivos distintos;
 * - o que a equipe digita fica fora do alcance: quem escolhe "especificar nas
 *   observações" escreve o motivo real num campo aberto, que não viaja no
 *   registro. Somado ao registro vazio, é uma em cada cinco improdutivas (21%
 *   a 28% por mês). Esses dois casos são barras CINZA, separadas e sempre no
 *   fim da lista: ausência de informação não disputa posição com motivo real;
 * - a base são TODAS as improdutivas do recorte, de cliente e de
 *   infraestrutura, com todos os filtros aplicados. Não é a base das taxas de
 *   propósito (pergunta do Mário em 23/09/2026): com a equipe Infra filtrada,
 *   a regra "só cliente" mostraria 1 improdutiva e esconderia as 10 de
 *   infraestrutura do mês. A divisão por grupo fica no subtítulo e no tooltip,
 *   e fecha com o card (cliente) e com o Destino (os dois grupos);
 * - fonte sem o campo (a base local de estudo) não vira "100% sem motivo
 *   registrado": o painel diz que o motivo não está disponível, a mesma
 *   cautela da leitura do card.
 */

/** Rótulo que o serviço dá a "especificar nas observações adicionais". */
export const REASON_NOT_SPECIFIED = 'Motivo não especificado'

/** Improdutiva em que o SGI não guardou motivo nenhum. */
export const REASON_MISSING = 'Sem motivo registrado'

/** Ordem fixa das duas barras sem motivo real, sempre depois das demais. */
const UNCLEAR_REASONS: readonly string[] = [REASON_NOT_SPECIFIED, REASON_MISSING]

/** Motivo real: o vermelho do status Improdutiva, o mesmo do card. */
export const REASON_COLOR = statusColors.Improdutiva
/**
 * Sem motivo real: o cinza de Encerrada, que já existe no portal e mede 4,76
 * contra a superfície clara e 3,08 contra a escura.
 */
export const REASON_UNCLEAR_COLOR = statusColors.Encerrada

export const REASONS_NO_SOURCE_MESSAGE = 'Motivo não disponível nesta fonte'
export const REASONS_EMPTY_MESSAGE = 'Nenhuma visita improdutiva no recorte'
export const REASONS_STATUS_FILTER_MESSAGE =
  'O filtro de Status deixa as improdutivas fora do recorte'

const CHART_NAME = 'Motivos de improdutiva'

export type ReasonRow = {
  readonly reason: string
  readonly count: number
  /** Participação sobre todas as improdutivas do recorte, de 0 a 1. */
  readonly share: number
  readonly customer: number
  readonly infrastructure: number
  /** Barra sem motivo real: cinza e no fim. */
  readonly unclear: boolean
}

export type ReasonSummary = {
  readonly total: number
  readonly customer: number
  readonly infrastructure: number
  /** Ao menos uma improdutiva do recorte tem motivo preenchido. */
  readonly hasReason: boolean
  readonly rows: readonly ReasonRow[]
}

/**
 * Motivos das improdutivas do recorte.
 *
 * Motivos reais do mais frequente ao menos, empate em ordem alfabética para a
 * lista não trocar de posição a cada filtro; depois as barras sem motivo
 * real, na ordem fixa. Motivo novo que o aplicativo ganhar entra sozinho, com
 * o nome que veio.
 */
export function buildReasonSummary(records: readonly OverviewOsRecord[]): ReasonSummary {
  const unproductive = records.filter((record) => outcomeOf(record) === 'unproductive')
  const counts = new Map<string, { customer: number; infrastructure: number }>()
  let customer = 0

  for (const record of unproductive) {
    const reason = record.unproductiveReason?.trim() || REASON_MISSING
    const item = counts.get(reason) ?? { customer: 0, infrastructure: 0 }
    if (groupOf(record) === 'customer') {
      item.customer += 1
      customer += 1
    } else {
      item.infrastructure += 1
    }
    counts.set(reason, item)
  }

  const total = unproductive.length
  const rows = [...counts.entries()].map(([reason, item]): ReasonRow => {
    const count = item.customer + item.infrastructure

    return {
      reason,
      count,
      share: total === 0 ? 0 : count / total,
      customer: item.customer,
      infrastructure: item.infrastructure,
      unclear: UNCLEAR_REASONS.includes(reason),
    }
  })
  const clear = rows
    .filter((row) => !row.unclear)
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, 'pt-BR'))
  const unclear = UNCLEAR_REASONS.flatMap((reason) => rows.filter((row) => row.reason === reason))

  return {
    total,
    customer,
    infrastructure: total - customer,
    hasReason: unproductive.some((record) => (record.unproductiveReason ?? '').trim() !== ''),
    rows: [...clear, ...unclear],
  }
}

/** Mensagem do painel sem barras, ou null quando há o que desenhar. */
export function reasonsEmptyMessage(summary: ReasonSummary, statusFiltered: boolean): string | null {
  if (summary.total === 0) return statusFiltered ? REASONS_STATUS_FILTER_MESSAGE : REASONS_EMPTY_MESSAGE
  if (!summary.hasReason) return REASONS_NO_SOURCE_MESSAGE

  return null
}

/** Subtítulo do painel: quantas são, de que grupo, e que os filtros valem. */
export function reasonsSubtitle(summary: ReasonSummary): string {
  const filters = 'todos os filtros aplicados'
  const count = `${formatNumber(summary.total)} ${summary.total === 1 ? 'improdutiva' : 'improdutivas'}`
  if (summary.total === 0) return `Por que a visita falhou · ${filters}`
  if (summary.infrastructure === 0) return `${count} de cliente · ${filters}`
  if (summary.customer === 0) return `${count} de infraestrutura · ${filters}`

  return `${formatNumber(summary.customer)} de cliente · ${formatNumber(summary.infrastructure)} de infraestrutura · ${filters}`
}

/**
 * Altura do painel: 280 px até oito barras, e 30 px por barra a partir da
 * nona (nove barras dão 286). O Volume diário acompanha.
 */
export function reasonsChartHeight(rowCount: number): number {
  return Math.max(280, 16 + Math.max(0, Math.ceil(rowCount)) * 30)
}

/** Descrição acessível, da mesma lista que a tela desenha. */
export function buildReasonsDescription(
  summary: ReasonSummary,
  emptyMessage: string | null,
): string {
  if (emptyMessage !== null) return `${CHART_NAME}. ${emptyMessage}.`
  const items = summary.rows
    .map((row) => `${row.reason}: ${formatNumber(row.count)}, ${formatPercent(row.share)}`)
    .join('. ')

  const count = `${formatNumber(summary.total)} ${summary.total === 1 ? 'improdutiva' : 'improdutivas'}`

  return `${CHART_NAME}. ${count} no recorte. ${items}.`
}

/** O que as barras cinza significam, dito no tooltip. */
const UNCLEAR_EXPLANATION: Readonly<Record<string, string>> = {
  [REASON_NOT_SPECIFIED]:
    'O técnico escolheu especificar nas observações: o motivo real ficou em texto livre no SGI.',
  [REASON_MISSING]: 'O SGI não guardou motivo nesta visita.',
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

/** Largura máxima do nome no eixo; o nome inteiro segue no tooltip. */
const LABEL_MAX_WIDTH = 170

function line(label: string, value: string, muted: string): string {
  return (
    '<div style="display:flex;gap:10px;align-items:baseline">' +
    `<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${muted}">${label}</span>` +
    `<span style="flex:none;margin-left:auto;font-weight:600">${value}</span>` +
    '</div>'
  )
}

/** Tooltip de uma barra: quantidade, participação e, havendo infraestrutura, a divisão. */
export function buildReasonTooltip(row: ReasonRow, muted: string): string {
  const color = row.unclear ? REASON_UNCLEAR_COLOR : REASON_COLOR
  const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></span>`
  let html =
    `<div style="margin-bottom:4px;font-weight:600">${marker}${row.reason}</div>` +
    line('Visitas', formatNumber(row.count), muted) +
    line('Das improdutivas', formatPercent(row.share), muted)
  if (row.infrastructure > 0) {
    html +=
      line('De cliente', formatNumber(row.customer), muted) +
      line('De infraestrutura', formatNumber(row.infrastructure), muted)
  }
  const explanation = UNCLEAR_EXPLANATION[row.reason]
  if (explanation !== undefined) {
    html += `<div style="margin-top:4px;white-space:normal;color:${muted}">${explanation}</div>`
  }

  return html
}

export function makeReasonsOptions(
  summary: ReasonSummary,
  theme: Theme,
  statusFiltered: boolean,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const emptyMessage = reasonsEmptyMessage(summary, statusFiltered)
  const description = buildReasonsDescription(summary, emptyMessage)

  if (emptyMessage !== null) {
    return {
      textStyle: baseTextStyle,
      animation: false,
      aria: { enabled: true, label: { enabled: true, description } },
      title: {
        text: emptyMessage,
        left: 'center',
        top: 'middle',
        textStyle: { ...baseTextStyle, color: colors.empty, fontSize: 12.5, fontWeight: 'normal' },
      },
    }
  }

  // O eixo de categorias desenha de baixo para cima: invertida, a lista sai
  // com o motivo mais frequente no topo e as barras cinza embaixo.
  const drawn = [...summary.rows].reverse()

  return {
    textStyle: baseTextStyle,
    animation: false,
    aria: { enabled: true, label: { enabled: true, description } },
    grid: { left: 4, right: 48, top: 6, bottom: 6, containLabel: true },
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
        const row = typeof index === 'number' ? drawn[index] : undefined

        return row === undefined ? '' : buildReasonTooltip(row, colors.tooltipMuted)
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
      data: drawn.map((row) => row.reason),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: colors.category,
        fontSize: 11.5,
        fontWeight: 500,
        // Declarada aqui também: `containLabel` mede com a fonte do eixo.
        fontFamily: 'IBM Plex Sans, sans-serif',
        width: LABEL_MAX_WIDTH,
        overflow: 'truncate',
        ellipsis: '…',
      },
    },
    series: [
      {
        type: 'bar',
        name: CHART_NAME,
        barMaxWidth: 15,
        barMinHeight: 4,
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'right',
          color: colors.valueLabel,
          fontSize: 11,
          fontWeight: 600,
          formatter: (params: { dataIndex: number }) => {
            const row = drawn[params.dataIndex]

            return row === undefined ? '' : formatNumber(row.count)
          },
        },
        data: drawn.map((row) => ({
          value: row.count,
          name: row.reason,
          itemStyle: {
            color: row.unclear ? REASON_UNCLEAR_COLOR : REASON_COLOR,
            borderRadius: [0, 4, 4, 0],
          },
        })),
      },
    ],
  }
}
