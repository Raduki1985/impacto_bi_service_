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
 * congela, decidido com o Mário em 18/09/2026 e ajustado em 22/09/2026:
 *
 * - cada barra é um grupo inteiro, e o comprimento de cada fatia é a
 *   participação da saída naquele grupo. É o desenho que deixa ver, numa
 *   linha, que a infraestrutura tem outro ciclo: a fatia de "não executada"
 *   dela é enorme e a de cliente é pequena;
 * - toda saída com OS ocupa pelo menos `OUTCOME_MIN_DRAWN_SHARE` da barra
 *   (22/09/2026). Uma OS em mil virava uma lasca de um pixel, que não se via
 *   nem se apontava com o mouse. A geometria cede, o número não: rótulo,
 *   tooltip e descrição acessível usam a participação real, e as demais
 *   fatias encolhem na proporção para a barra seguir somando 100%;
 * - a cor de cada saída é a cor semântica que o portal já usa para o status
 *   que a representa: o verde de Concluída, o vermelho de Improdutiva, o
 *   cinza de Encerrada para "não executada" e o azul de Agendada para "em
 *   aberto". Nenhuma cor nova, e cor fixa por saída, nunca por posição;
 * - dentro da fatia vai só a QUANTIDADE de OS (22/09/2026). A participação
 *   saiu: ela já está no tooltip, e com ela dentro da barra as fatias médias
 *   ficavam sem texto nenhum por falta de espaço. Com o número sozinho, quase
 *   toda fatia consegue mostrar o seu. O tooltip e a descrição acessível
 *   seguem trazendo tudo, participação e os status dentro de cada saída;
 * - quem decide se o número cabe é a MEDIDA da fatia desenhada, não uma faixa
 *   de porcentagem (22/09/2026). A participação não diz quantos pixels a
 *   fatia tem: os mesmos 7% são 23 px numa tela estreita e 93 px numa larga.
 *   A conta é feita na hora de desenhar, quando a largura da fatia e a do
 *   texto já existem, e o número some em vez de vazar para a fatia vizinha;
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
 * - as duas pontas da barra são arredondadas (22/09/2026): a primeira fatia
 *   com OS leva o canto esquerdo e a última leva o direito. Se a barra tem
 *   uma fatia só, ela leva os dois. Como toda fatia com OS tem o mínimo
 *   desenhado, não existe mais lasca sem espaço para o raio;
 * - o eixo dos grupos reserva largura FIXA para o rótulo (22/09/2026). Com a
 *   reserva automática da biblioteca, o começo da barra andava conforme o
 *   total do grupo tinha mais ou menos dígitos, e barras de 100% que começam
 *   em lugares diferentes não se comparam. A largura cabe o maior rótulo
 *   plausível ("Infraestrutura · 12.345", 122 px medidos); acima disso o
 *   texto é cortado com reticências, e o tooltip e a descrição seguem
 *   inteiros.
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

/** Largura desenhada mínima de uma fatia com OS, como fração da barra. */
export const OUTCOME_MIN_DRAWN_SHARE = 0.02
/** Respiro de cada lado entre o número e a borda da fatia, em pixels. */
export const OUTCOME_LABEL_PADDING = 4
/** Raio do canto nas pontas da barra, em pixels. */
const BAR_RADIUS = 4
/** Largura reservada ao rótulo do grupo, em pixels; ver o comentário de bloco. */
export const OUTCOME_AXIS_LABEL_WIDTH = 128
/** Rótulo, mais a folga entre ele e a barra. */
export const OUTCOME_GRID_LEFT = OUTCOME_AXIS_LABEL_WIDTH + 12

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
  /** Participação real no grupo, de 0 a 1: é o que o texto diz. */
  readonly share: number
  /** Largura desenhada, de 0 a 1, com o mínimo aplicado: é o que a barra mostra. */
  readonly drawnShare: number
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

/** Texto dentro da fatia: a quantidade de OS. Saída zerada não tem barra. */
export function outcomeSliceLabel(count: number): string {
  return count > 0 ? formatNumber(count) : ''
}

/**
 * O número cabe dentro da fatia desenhada?
 *
 * Recebe as duas larguras já medidas na tela, em pixels: a da fatia e a do
 * texto. Não cabendo, o número não é desenhado, e o valor continua no
 * tooltip e na descrição acessível.
 */
export function sliceLabelFits(sliceWidth: number, labelWidth: number): boolean {
  return labelWidth + 2 * OUTCOME_LABEL_PADDING <= sliceWidth
}

/**
 * Larguras desenhadas a partir das participações reais, que somam 1.
 *
 * Toda participação positiva abaixo do mínimo sobe até ele; as demais
 * encolhem na mesma proporção para a soma continuar em 1. Uma fatia que só
 * cai abaixo do mínimo DEPOIS de ceder espaço também é elevada, por isso o
 * cálculo repete até nenhuma ficar abaixo. Zero continua zero.
 */
export function drawnShares(shares: readonly number[]): number[] {
  const raised = new Set<number>()

  for (;;) {
    const reserved = raised.size * OUTCOME_MIN_DRAWN_SHARE
    const free = shares.reduce((sum, share, index) => (raised.has(index) ? sum : sum + share), 0)
    const scale = free > 0 ? Math.max(0, 1 - reserved) / free : 0
    const drawn = shares.map((share, index) =>
      raised.has(index) ? OUTCOME_MIN_DRAWN_SHARE : share * scale,
    )
    const below = drawn.findIndex(
      (value, index) => !raised.has(index) && value > 0 && value < OUTCOME_MIN_DRAWN_SHARE,
    )
    if (below === -1) return drawn
    raised.add(below)
  }
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

  return present.map((group) => {
    const shares = outcomes.map((outcome) => group.counts[outcome.key] / group.total)
    const drawn = drawnShares(shares)

    return {
      group: group.label,
      total: group.total,
      slices: outcomes.map((outcome, index) => {
        const count = group.counts[outcome.key]
        const share = shares[index]
        const drawnShare = drawn[index]

        return {
          key: outcome.key,
          name: outcome.label,
          count,
          share,
          drawnShare,
          color: OUTCOME_COLORS[outcome.key],
          label: outcomeSliceLabel(count),
          statuses: group.statuses[outcome.key],
        }
      }),
    }
  })
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

/** Índice da primeira fatia desenhada de uma barra, que leva o canto esquerdo. */
export function firstVisibleSliceIndex(slices: readonly OutcomeSlice[]): number | null {
  const index = slices.findIndex((slice) => slice.drawnShare > 0)

  return index === -1 ? null : index
}

/** Índice da última fatia desenhada de uma barra, que leva o canto direito. */
export function lastVisibleSliceIndex(slices: readonly OutcomeSlice[]): number | null {
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    if (slices[index].drawnShare > 0) return index
  }

  return null
}

/**
 * Raio de cada canto da fatia, na ordem da biblioteca: superior esquerdo,
 * superior direito, inferior direito, inferior esquerdo.
 */
export function sliceBorderRadius(slices: readonly OutcomeSlice[], index: number): number[] {
  const left = firstVisibleSliceIndex(slices) === index ? BAR_RADIUS : 0
  const right = lastVisibleSliceIndex(slices) === index ? BAR_RADIUS : 0

  return [left, right, right, left]
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
    // Reserva fixa à esquerda, e não `containLabel`: ver o comentário de bloco.
    grid: { left: OUTCOME_GRID_LEFT, right: 12, top: 6, bottom: 30, containLabel: false },
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
      axisLabel: {
        color: colors.category,
        fontSize: 11.5,
        fontWeight: 500,
        margin: 8,
        width: OUTCOME_AXIS_LABEL_WIDTH,
        overflow: 'truncate',
      },
    },
    series: outcomes.map((name, seriesIndex) => ({
      type: 'bar',
      name,
      stack: 'destino',
      barMaxWidth: 26,
      // A cor da SÉRIE é o que a legenda lê; a cor por item, abaixo, é a
      // mesma e existe só para carregar os cantos arredondados das pontas.
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
      // A biblioteca não oferece "esconder" aqui, e tamanho zero é como se
      // apaga um rótulo que não cabe: o texto segue no tooltip e na
      // descrição acessível, e nada vaza para a fatia vizinha.
      labelLayout: (params: { rect: { width: number }; labelRect: { width: number } }) =>
        sliceLabelFits(params.rect.width, params.labelRect.width) ? {} : { fontSize: 0 },
      data: drawn.map((row) => {
        const slice = row.slices[seriesIndex]

        return {
          value: slice.drawnShare,
          name: slice.name,
          itemStyle: { color: slice.color, borderRadius: sliceBorderRadius(row.slices, seriesIndex) },
        }
      }),
    })),
  }
}
