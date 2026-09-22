import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'
import { statusColors } from '../../data/dashboardAggregates'
import type { Pair } from '../../data/dashboardTypes'
import { formatNumber, formatPercent } from '../../lib/formatters'
import { OS_OUTCOMES, type OsOutcomeGroup, type OsOutcomeKey } from './overviewModel'
import { serviceTypeMarker } from './overviewServiceTypeChartOptions'

/**
 * Opções do gráfico `Destino das OS do período` da Visão Geral.
 *
 * Vive na pasta da página, como os outros geradores dela, porque tem
 * legenda, tooltip e paleta próprios: uma barra de 100% por grupo de OS
 * (cliente e infraestrutura), dividida nas quatro saídas de uma OS. O que ele
 * congela, decidido com o Mário em 18/09/2026:
 *
 * - cada barra é um grupo inteiro, e o comprimento de cada fatia é a
 *   participação da saída naquele grupo. É o desenho que deixa ver, numa
 *   linha, que a infraestrutura tem outro ciclo: a fatia de "não executada"
 *   dela é enorme e a de cliente é pequena;
 * - a cor de cada saída é a cor semântica que o portal já usa para o status
 *   que a representa: o verde de Concluída, o vermelho de Improdutiva, o
 *   cinza de Encerrada para "não executada" e o azul de Agendada para "em
 *   aberto". Nenhuma cor nova, e cor fixa por saída, nunca por posição;
 * - a fatia carrega quantidade e participação quando cabe, só a quantidade
 *   quando cabe menos, e nada quando não cabe. O tooltip e a descrição
 *   acessível sempre trazem tudo, inclusive os status dentro de cada saída;
 * - grupo sem OS no recorte não vira barra vazia: some da lista e a descrição
 *   diz que ele não tem OS. Sem nenhum grupo, o painel avisa que não há dados;
 * - a ordem das fatias é a do fluxo de uma OS: o que aconteceu (concluída),
 *   o que falhou (improdutiva), o que não aconteceu (não executada) e o que
 *   ainda pode acontecer (em aberto). A regra "perda no piso" das barras
 *   mensais do Comercial existe para uma fatia negativa fina não virar tampa
 *   no TOPO de uma barra vertical; aqui a barra é horizontal, de 100%, e a
 *   última fatia é a neutra, então a ordem de leitura prevalece;
 * - a legenda não liga nem desliga fatia: numa barra de 100% tirar uma saída
 *   deixaria as outras somando menos que a barra, com os rótulos dizendo a
 *   participação de um grupo que a barra não mostra mais;
 * - o canto arredondado vai para a última fatia VISÍVEL de cada barra, com o
 *   piso e a busca calculados aqui, e não com os helpers das barras mensais
 *   do Comercial: lá o piso é de barra vertical com uns 190 px de área, e
 *   aqui a barra ocupa a largura do painel inteiro. A página de OS também não
 *   importa nada da pasta do Comercial.
 */

export const OUTCOME_COLORS: Readonly<Record<OsOutcomeKey, string>> = {
  completed: statusColors.Concluída,
  unproductive: statusColors.Improdutiva,
  notExecuted: statusColors.Encerrada,
  open: statusColors.Agendada,
  unknown: statusColors.Pendente,
}

// Guarda do domínio fechado: saída sem cor declarada é erro no carregamento,
// e não uma fatia que herda cor por posição.
for (const outcome of OS_OUTCOMES) {
  if (!OUTCOME_COLORS[outcome.key]) {
    throw new Error(`Destino das OS: a saída ${outcome.label} está sem cor declarada.`)
  }
}

export const OUTCOME_EMPTY_MESSAGE = 'Sem dados no período'
const CHART_NAME = 'Destino das OS do período'

/** Participação mínima para a fatia levar a quantidade escrita dentro dela. */
export const OUTCOME_COUNT_MIN_SHARE = 0.06
/** Participação mínima para a fatia levar também a participação escrita. */
export const OUTCOME_PERCENT_MIN_SHARE = 0.12
/**
 * Participação mínima para a fatia ser a que leva o canto arredondado.
 *
 * A barra ocupa a largura do painel: numa tela comum ela mede de 700 a
 * 1.400 px, então 0,5% são de 3 a 7 px, o suficiente para um raio de 4 px
 * fechar a barra. Abaixo disso a fatia é uma lasca e o canto vai para a
 * anterior, que é a que o olho vê terminar a barra. A lasca continua
 * desenhada, com o dado intacto, no tooltip e na descrição acessível.
 */
const MIN_ROUNDED_SHARE = 0.005

/**
 * Altura do painel para a quantidade de barras desenhadas.
 *
 * A grade reserva 6 px em cima e 30 px embaixo para a legenda; cada barra
 * fica com 56 px de faixa, ou seja 26 px de barra e 30 px de respiro, o
 * mesmo ritmo das barras horizontais da distribuição por status. Com dois
 * grupos são 164 px.
 */
export function outcomeChartHeight(rowCount: number): number {
  const rows = Math.max(1, Math.ceil(rowCount))

  return 52 + rows * 56
}

export type OutcomeSlice = {
  readonly key: OsOutcomeKey
  readonly name: string
  readonly count: number
  /** Participação no grupo, de 0 a 1. */
  readonly share: number
  readonly color: string
  /** Texto dentro da fatia; vazio quando não cabe. */
  readonly label: string
  readonly statuses: readonly Pair[]
}

export type OutcomeRow = {
  readonly group: string
  readonly total: number
  readonly slices: readonly OutcomeSlice[]
}

export function outcomeSliceLabel(count: number, share: number): string {
  if (share >= OUTCOME_PERCENT_MIN_SHARE) return `${formatNumber(count)} · ${formatPercent(share)}`
  if (share >= OUTCOME_COUNT_MIN_SHARE) return formatNumber(count)

  return ''
}

/**
 * Linhas do gráfico: um grupo com OS por linha, e as mesmas fatias em todas.
 *
 * "Sem classificação" só entra quando alguma OS do recorte caiu nela: a fatia
 * existe para uma chave nova do SGI aparecer, e não para ocupar a legenda
 * todo dia com zero. As outras quatro saídas estão sempre na legenda, mesmo
 * valendo zero: zero é resultado, não ausência de dado.
 */
export function buildOutcomeRows(groups: readonly OsOutcomeGroup[]): OutcomeRow[] {
  const present = groups.filter((group) => group.total > 0)
  const hasUnknown = present.some((group) => group.counts.unknown > 0)
  const outcomes = OS_OUTCOMES.filter((outcome) => outcome.key !== 'unknown' || hasUnknown)

  return present.map((group) => ({
    group: group.label,
    total: group.total,
    slices: outcomes.map((outcome) => {
      const count = group.counts[outcome.key]
      const share = count / group.total

      return {
        key: outcome.key,
        name: outcome.label,
        count,
        share,
        color: OUTCOME_COLORS[outcome.key],
        label: outcomeSliceLabel(count, share),
        statuses: group.statuses[outcome.key],
      }
    }),
  }))
}

/** Descrição acessível, derivada das mesmas linhas que a tela desenha. */
export function buildOutcomeDescription(
  rows: readonly OutcomeRow[],
  groups: readonly OsOutcomeGroup[],
): string {
  if (rows.length === 0) return `${CHART_NAME}. ${OUTCOME_EMPTY_MESSAGE}.`

  const parts = rows.map((row) => {
    const slices = row.slices
      .map((slice) => `${slice.name} ${formatNumber(slice.count)} (${formatPercent(slice.share)})`)
      .join(', ')

    return `${row.group}: ${formatNumber(row.total)} OS; ${slices}`
  })
  const missing = groups
    .filter((group) => group.total === 0)
    .map((group) => `${group.label}: sem OS no recorte`)

  return `${CHART_NAME}. ${[...parts, ...missing].join('. ')}.`
}

/** Índice da última fatia visível de uma barra, que é a que leva o canto. */
export function lastVisibleSliceIndex(slices: readonly OutcomeSlice[]): number | null {
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    if (slices[index].share >= MIN_ROUNDED_SHARE) return index
  }

  return null
}

const palette = {
  light: {
    category: '#344054',
    legend: '#475467',
    empty: '#98a2b3',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
  },
  dark: {
    category: '#dfe5ec',
    legend: '#cdd5df',
    empty: '#a9b5c6',
    tooltipBackground: '#263448',
    tooltipBorder: '#46556b',
    tooltipText: '#f2f4f7',
  },
} as const

const baseTextStyle = { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }

function emptyOption(theme: Theme): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']

  return {
    textStyle: baseTextStyle,
    animation: false,
    aria: {
      enabled: true,
      label: { enabled: true, description: `${CHART_NAME}. ${OUTCOME_EMPTY_MESSAGE}.` },
    },
    title: {
      text: OUTCOME_EMPTY_MESSAGE,
      left: 'center',
      top: 'middle',
      textStyle: { ...baseTextStyle, color: colors.empty, fontSize: 12.5, fontWeight: 'normal' },
    },
  }
}

/**
 * Conteúdo do tooltip de uma fatia, com os status que ela contém.
 *
 * O cabeçalho abre com o pontinho na cor da fatia, o MESMO marcador dos
 * outros tooltips da página (`serviceTypeMarker`, da rosca de tipos): com
 * quatro ou cinco fatias na barra, a cor diz qual delas está sob o ponteiro.
 */
export function buildOutcomeTooltip(row: OutcomeRow, slice: OutcomeSlice): string {
  const head =
    `<div style="margin-bottom:2px;font-weight:600">${serviceTypeMarker(slice.color)}${row.group} · ${slice.name}</div>` +
    `<div>${formatNumber(slice.count)} OS · ${formatPercent(slice.share)} de ${formatNumber(row.total)}</div>`
  // Os status só são listados quando dizem algo além do nome da saída: uma
  // saída com um único status de mesmo nome repetiria a linha de cima.
  const explains =
    slice.statuses.length > 1 ||
    (slice.statuses.length === 1 && slice.statuses[0][0] !== slice.name)
  if (!explains) return head

  const lines = slice.statuses
    .map(
      ([status, count]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px">` +
        `<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${status}</span>` +
        `<span style="flex:none">${formatNumber(count)}</span></div>`,
    )
    .join('')

  return `${head}<div style="margin-top:4px;opacity:.85">${lines}</div>`
}

export function makeOutcomeOptions(groups: readonly OsOutcomeGroup[], theme: Theme): EChartsOption {
  const rows = buildOutcomeRows(groups)
  if (rows.length === 0) return emptyOption(theme)

  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  // O eixo de categorias desenha de baixo para cima: invertido, o primeiro
  // grupo (OS de cliente) fica no topo. Rótulos, tooltip e descrição leem
  // desta mesma coleção.
  const drawn = [...rows].reverse()
  const outcomes = rows[0].slices.map((slice) => slice.name)

  return {
    textStyle: baseTextStyle,
    animation: false,
    aria: {
      enabled: true,
      label: { enabled: true, description: buildOutcomeDescription(rows, groups) },
    },
    grid: { left: 4, right: 12, top: 6, bottom: 30, containLabel: true },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      data: outcomes,
      // Só identifica: numa barra de 100% desligar uma saída não tem leitura
      // (ver o comentário de bloco).
      selectedMode: false,
      textStyle: { color: colors.legend, fontSize: 11.5 },
    },
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
        const { dataIndex, seriesIndex } = params as { dataIndex?: number; seriesIndex?: number }
        const row = typeof dataIndex === 'number' ? drawn[dataIndex] : undefined
        const slice = row !== undefined && typeof seriesIndex === 'number' ? row.slices[seriesIndex] : undefined
        if (row === undefined || slice === undefined) return ''

        return buildOutcomeTooltip(row, slice)
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: drawn.map((row) => `${row.group} · ${formatNumber(row.total)}`),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.category, fontSize: 11.5, fontWeight: 500 },
    },
    series: outcomes.map((name, seriesIndex) => ({
      type: 'bar',
      name,
      stack: 'destino',
      barMaxWidth: 26,
      // A cor da SÉRIE é o que a legenda lê; a cor por item, abaixo, é a
      // mesma e existe só para carregar o canto arredondado da última fatia.
      itemStyle: { color: rows[0].slices[seriesIndex].color },
      emphasis: { disabled: true },
      label: {
        show: true,
        position: 'inside',
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 600,
        formatter: (params: { dataIndex: number }) =>
          drawn[params.dataIndex]?.slices[seriesIndex]?.label ?? '',
      },
      data: drawn.map((row) => {
        const slice = row.slices[seriesIndex]
        const rounded = lastVisibleSliceIndex(row.slices) === seriesIndex

        return {
          value: slice.share,
          name: slice.name,
          itemStyle: { color: slice.color, borderRadius: rounded ? [0, 4, 4, 0] : 0 },
        }
      }),
    })),
  }
}
