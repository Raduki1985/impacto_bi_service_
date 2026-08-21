import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'

/**
 * Opções do gráfico `Volume diário de OS`.
 *
 * Vive aqui, e não em `components/charts/chartOptions`, porque `makeLineOptions`
 * é compartilhado por vários gráficos do portal: suavização, tooltip animado e
 * destaque no hover são o comportamento esperado por eles. Este gráfico adotou a
 * linguagem dos cards executivos de OS, e mudar o helper comum levaria essa
 * decisão para telas que não fazem parte do bloco.
 *
 * O que muda em relação ao helper comum: linhas retas, nenhuma animação, nenhum
 * destaque no hover e paleta de eixos, grade, legenda e tooltip resolvida pelo
 * tema. Os dados, os nomes das séries e as cores continuam exatamente os mesmos.
 */

/**
 * Nomes das duas séries.
 *
 * São constantes porque aparecem em três lugares (série, legenda e tooltip) e
 * precisam ser sempre o mesmo texto: um rótulo divergente quebraria a ligação
 * entre a linha e a sua entrada na legenda.
 */
export const DAILY_VOLUME_TOTAL_SERIES = 'Total'
export const DAILY_VOLUME_COMPLETED_SERIES = 'Concluídas'

/**
 * Cores aprovadas das séries, iguais nos dois temas.
 *
 * Total permanece no azul do portal e Concluídas no verde: identidade da série,
 * não do resultado. Como são as mesmas dos minigráficos e do restante da página,
 * não recebem variação por tema; o que se adapta é o entorno (eixos, grade,
 * legenda e tooltip), que é o que precisa de contraste contra a superfície.
 */
export const DAILY_VOLUME_COLORS = {
  total: '#2f6bff',
  completed: '#16a34a',
} as const

/**
 * Preenchimento sob a linha Total.
 *
 * Só o Total tem área, e bem discreta: as duas séries estão na mesma escala e
 * não são empilhadas, então a área serve para dar volume ao total, nunca para
 * sugerir soma entre as séries. Concluídas fica só com a linha, que assim
 * permanece legível por cima do preenchimento.
 */
const TOTAL_AREA_OPACITY = 0.1

/** Paleta do entorno do gráfico, resolvida por tema. */
const palette = {
  light: {
    axisLabel: '#98a2b3',
    axisLine: '#e4e7ee',
    splitLine: '#f1f3f7',
    legendText: '#667085',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
    axisPointer: 'rgba(26,35,49,0.28)',
  },
  dark: {
    axisLabel: '#a9b5c6',
    axisLine: '#3b475a',
    splitLine: 'rgba(159,174,196,0.16)',
    legendText: '#cdd5df',
    // Superfície elevada, e não quase preta: sobre o painel escuro do card um
    // tooltip mais escuro que o fundo desapareceria. A borda separa a caixa da
    // superfície mesmo quando ela cobre uma área clara do gráfico.
    tooltipBackground: '#263448',
    tooltipBorder: '#46556b',
    tooltipText: '#f2f4f7',
    axisPointer: 'rgba(233,237,243,0.32)',
  },
} as const

type DailyVolumeTooltipItem = {
  readonly axisValueLabel?: string
  readonly marker?: string
  readonly seriesName?: string
  readonly value?: unknown
}

/**
 * Conteúdo do tooltip: a data do ponto e os dois valores do dia.
 *
 * Nada além disso é montado aqui. O formatador existe para dar ao número o
 * alinhamento à direita e o peso que o formato padrão do ECharts não tem, e não
 * para acrescentar leitura, comparação ou unidade que o gráfico não possui.
 */
export function formatDailyVolumeTooltip(params: unknown): string {
  const items = (Array.isArray(params) ? params : [params]).filter(
    (item): item is DailyVolumeTooltipItem => typeof item === 'object' && item !== null,
  )
  const title = items[0]?.axisValueLabel ?? ''
  const rows = items.map((item) => {
    const value = Array.isArray(item.value) ? item.value[item.value.length - 1] : item.value

    return (
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;line-height:17px">' +
      `<span style="display:flex;align-items:center;min-width:0">${item.marker ?? ''}${item.seriesName ?? ''}</span>` +
      `<span style="font-weight:600;white-space:nowrap">${String(value ?? '')}</span>` +
      '</div>'
    )
  })

  return `<div style="margin-bottom:4px;font-weight:600">${title}</div>${rows.join('')}`
}

export function makeDailyVolumeOptions(
  labels: readonly string[],
  total: readonly number[],
  completed: readonly number[],
  theme: Theme,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const axisLabel = { color: colors.axisLabel, fontSize: 10.5 }

  return {
    textStyle: { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 },
    // Nenhuma animação: nem a de entrada, nem a de atualização quando os
    // filtros mudam a série. O gráfico é uma leitura de valores, e a linha
    // deslizando até a posição final atrasa essa leitura sem informar nada.
    // A preferência de redução de movimento do sistema continua valendo para o
    // resto da página; aqui simplesmente não há movimento para reduzir.
    animation: false,
    tooltip: {
      trigger: 'axis',
      // Consulta instantânea: sem atraso para aparecer e sem transição ao mudar
      // de dia, o valor acompanha o ponteiro em vez de persegui-lo.
      showDelay: 0,
      transitionDuration: 0,
      // `triggerOn` fica no padrão do ECharts, que é `mousemove|click`: o
      // mousemove atende o ponteiro do mouse e o click atende o toque, onde
      // hover não existe. Declarar o mesmo valor aqui não passa pelo tipo desta
      // versão, que só aceita a forma com mousewheel, e essa forma abriria o
      // tooltip ao rolar a página.
      // Em telas estreitas a caixa fica dentro do gráfico em vez de vazar.
      confine: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText, fontSize: 12, fontFamily: 'IBM Plex Sans' },
      padding: [7, 11],
      extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18)',
      // O ponteiro do eixo é o que liga a caixa ao dia consultado. É a única
      // marca que aparece com o ponteiro do mouse, e não altera as séries.
      axisPointer: { type: 'line', lineStyle: { color: colors.axisPointer, width: 1 } },
      formatter: formatDailyVolumeTooltip,
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: colors.legendText, fontSize: 11.5 },
    },
    grid: { left: 10, right: 18, top: 20, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...labels],
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisTick: { show: false },
      axisLabel,
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: colors.splitLine } },
      axisLabel,
    },
    series: [
      {
        name: DAILY_VOLUME_TOTAL_SERIES,
        type: 'line',
        // Sem suavização: a curva inventava valores entre dois dias e suavizava
        // justamente os picos, que é o que se procura num volume diário.
        smooth: false,
        // `symbol: 'none'`, e não `showSymbol: false`: com `showSymbol` o
        // ECharts continua desenhando o símbolo do ponto quando o ponteiro do
        // eixo passa por ele, e `emphasis.disabled` não impede isso. Sem
        // símbolo definido não há o que aparecer, no repouso ou no hover.
        symbol: 'none',
        // Nenhum destaque: sem isto o ECharts engrossa a linha ao passar o
        // mouse sobre ela ou sobre a entrada da legenda.
        emphasis: { disabled: true },
        data: [...total],
        lineStyle: { width: 2.4, color: DAILY_VOLUME_COLORS.total },
        itemStyle: { color: DAILY_VOLUME_COLORS.total },
        areaStyle: { color: DAILY_VOLUME_COLORS.total, opacity: TOTAL_AREA_OPACITY },
      },
      {
        name: DAILY_VOLUME_COMPLETED_SERIES,
        type: 'line',
        smooth: false,
        symbol: 'none',
        emphasis: { disabled: true },
        data: [...completed],
        lineStyle: { width: 2.4, color: DAILY_VOLUME_COLORS.completed },
        itemStyle: { color: DAILY_VOLUME_COLORS.completed },
      },
    ],
  }
}
