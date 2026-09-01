import type { EChartsOption } from 'echarts'

import { executiveCardColors } from '../../components/dashboard/executiveMetricCardModel'
import type { Theme } from '../../contexts/PreferencesContextCore'
import { formatNumber, formatPercent } from '../../lib/formatters'

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
 *
 * O painel lê DUAS grandezas diferentes: quantidade de OS por dia, no eixo da
 * esquerda, e percentual de improdutividade do dia, no eixo da direita. É por
 * isso que existem dois eixos de valor: jogar um percentual entre 0 e 100 na
 * mesma escala de um volume que passa de 90 OS achataria a linha contra o
 * chão do gráfico e faria o número ser lido como quantidade.
 */

/**
 * Nomes das três séries.
 *
 * São constantes porque aparecem em três lugares (série, legenda e tooltip) e
 * precisam ser sempre o mesmo texto: um rótulo divergente quebraria a ligação
 * entre a linha e a sua entrada na legenda. O tooltip ainda usa o nome da série
 * de improdutividade para decidir o formato do valor, então ele é a chave da
 * separação entre quantidade e percentual.
 */
export const DAILY_VOLUME_TOTAL_SERIES = 'Total'
export const DAILY_VOLUME_COMPLETED_SERIES = 'Concluídas'
export const DAILY_VOLUME_UNPRODUCTIVE_SERIES = 'Taxa de improdutividade'

/** Nome do gráfico, usado na descrição acessível. */
const CHART_NAME = 'Volume diário de OS'

/** Texto da descrição acessível quando o recorte não tem nenhum dia com OS. */
export const DAILY_VOLUME_EMPTY_MESSAGE = 'Sem dados no período'

/**
 * Nota exibida quando Total e Concluídas são integralmente iguais no recorte.
 *
 * Com `Status: Concluída`, toda OS do recorte é concluída: as duas séries têm
 * os mesmos valores e a linha verde cobre a azul por inteiro. A nota explica a
 * sobreposição em vez de deslocar valores ou esconder séries.
 */
export const DAILY_VOLUME_COINCIDENT_MESSAGE = 'Total e Concluídas coincidem neste recorte'

/**
 * Verifica se as duas séries de quantidade são integralmente iguais.
 *
 * Verdadeiro somente com dados: recorte vazio não tem coincidência a explicar.
 * Comprimentos diferentes contam como séries diferentes, ainda que os
 * agregados publiquem as duas coleções sempre no mesmo tamanho.
 */
export function dailySeriesCoincide(
  total: readonly number[],
  completed: readonly number[],
): boolean {
  if (total.length === 0 || total.length !== completed.length) return false

  return total.every((value, index) => value === completed[index])
}

/**
 * Nota do painel diário quando um status está selecionado no filtro.
 *
 * Um recorte de um único status torna parte das séries verdadeira por
 * definição, e não por medição: com `Concluída`, Total e Concluídas coincidem;
 * com `Improdutiva`, Concluídas é zero e a taxa fica em 100% em todos os dias;
 * com qualquer outro status, Concluídas e a taxa ficam em zero. A nota explica
 * o que o desenho degenerado significa, em vez de deixar linhas chapadas sem
 * causa declarada. Os valores continuam intactos: nada é escondido nem
 * deslocado.
 */
export function dailyVolumeStatusNote(status: string): string {
  if (status === 'Concluída') return DAILY_VOLUME_COINCIDENT_MESSAGE

  if (status === 'Improdutiva') {
    return (
      'Recorte limitado ao status Improdutiva: Concluídas fica em 0 e a taxa ' +
      'de improdutividade em 100% por definição'
    )
  }

  return (
    `Recorte limitado ao status ${status}: Concluídas e a taxa de ` +
    'improdutividade ficam em 0 por definição'
  )
}

/**
 * Diâmetro dos marcadores do recorte de UM único dia, por série.
 *
 * Com um só ponto não existe segmento de linha, e `symbol: 'none'` deixava o
 * painel visualmente vazio. O marcador do Total é o maior e o de Concluídas o
 * menor: como a série verde é pintada por cima da azul, quando as duas caem na
 * mesma coordenada o ponto verde fica visível dentro do anel azul, e nenhuma
 * das duas some. A taxa fica no meio termo, no próprio eixo direito.
 */
export const SINGLE_DAY_SYMBOL_SIZES = {
  total: 10,
  completed: 6,
  unproductiveRate: 7,
} as const

/**
 * Cores aprovadas das séries, iguais nos dois temas.
 *
 * Total permanece no azul do portal e Concluídas no verde: identidade da série,
 * não do resultado. Como são as mesmas dos minigráficos e do restante da página,
 * não recebem variação por tema; o que se adapta é o entorno (eixos, grade,
 * legenda e tooltip), que é o que precisa de contraste contra a superfície.
 *
 * O vermelho da improdutividade vem da paleta compartilhada dos cards
 * executivos, sem literal próprio: é o MESMO vermelho semântico que pinta a
 * barra do status `Improdutiva` nos gráficos de OS, então a improdutividade
 * tem uma cor só no portal inteiro, seja ela contada como status ou lida como
 * taxa diária.
 */
export const DAILY_VOLUME_COLORS = {
  total: '#2f6bff',
  completed: '#16a34a',
  unproductiveRate: executiveCardColors.red,
} as const

/**
 * Preenchimento das três séries.
 *
 * Total e Concluídas recebem área, SOBREPOSTAS e nunca empilhadas: Concluídas é
 * um subconjunto do Total, então somar as duas alturas contaria a mesma OS duas
 * vezes. Como as duas partem do mesmo chão do eixo esquerdo, a área verde fica
 * dentro da azul e a faixa azul que sobra acima dela é exatamente o que não foi
 * concluído no dia.
 *
 * A improdutividade também recebe área, a partir do zero do eixo DIREITO, e com
 * a MESMA intensidade da área azul do Total: as três séries do painel têm o
 * mesmo peso visual, e a taxa não fica em segundo plano só por estar na outra
 * escala. Quem separa uma leitura da outra é a cor e o eixo, não a opacidade.
 */
type AreaGradient = {
  readonly type: 'linear'
  readonly x: number
  readonly y: number
  readonly x2: number
  readonly y2: number
  // Coleção mutável de propósito: é a forma que o tipo `LinearGradientObject`
  // do ECharts aceita, e uma versão `readonly` não passa na atribuição.
  readonly colorStops: { offset: number; color: string }[]
}

/** Opacidade no topo e na base da área, por série. */
type AreaAlpha = readonly [top: number, bottom: number]

/**
 * Cor oficial da série com transparência.
 *
 * A cor NÃO é redigitada em rgba: ela é derivada de `DAILY_VOLUME_COLORS`, que
 * por sua vez é a paleta da página. Assim a área nunca descola da linha que
 * acompanha, nem quando a cor da série mudar.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '')
  const channels = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16))

  return `rgba(${channels.join(',')},${alpha})`
}

/**
 * Gradiente vertical da área, do topo do desenho para a base.
 *
 * Mesmo idioma do minigráfico dos cards executivos: mais presente junto da
 * linha e dissolvendo em direção ao eixo, para o preenchimento dar volume à
 * série sem virar um bloco chapado que esconde a série de baixo.
 */
function areaGradient(color: string, [top, bottom]: AreaAlpha): AreaGradient {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(color, top) },
      { offset: 1, color: withAlpha(color, bottom) },
    ],
  }
}

/**
 * Menor teto aceito no eixo de quantidade.
 *
 * Um recorte vazio, zerado ou de uma OS só ainda precisa de uma escala com
 * divisões inteiras e legíveis: sem este piso o eixo nasceria em 0 a 0, ou em
 * 0 a 1 com marcas de 0,2 OS, que é uma escala degenerada para contagem.
 */
export const QUANTITY_AXIS_MIN_MAX = 5

/** Divisões visuais buscadas no eixo de quantidade. */
const QUANTITY_AXIS_DIVISIONS = 5

/**
 * Menor número redondo maior ou igual ao valor, na família 1, 2, 5 e 10 vezes
 * potências de dez. É o passo convencional de escala: qualquer outro número
 * produziria marcas como 17 ou 23, que ninguém lê de relance.
 */
function niceStep(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power

  if (fraction <= 1) return power
  if (fraction <= 2) return 2 * power
  if (fraction <= 5) return 5 * power

  return 10 * power
}

/**
 * Teto do eixo de quantidade para o recorte recebido.
 *
 * Pura e determinística: mesmas coleções, mesmo teto. É calculada na montagem
 * das opções, a partir da série TOTAL, e vira `max` fixo do eixo esquerdo. Sem
 * isso o ECharts recalcularia a escala ao ocultar Total pela legenda, e as
 * mesmas Concluídas passariam a ocupar toda a altura do painel, sugerindo um
 * crescimento que não existe.
 *
 * O teto acompanha os DADOS, nunca a legenda: mudar o período ou um filtro
 * muda o pico do recorte e portanto a escala; ligar e desligar séries não muda
 * nada. E ele nunca é fixado num valor global, o que achataria os recortes
 * pequenos contra o chão do gráfico.
 *
 * Concluídas entra apenas como rede de segurança, para o caso de Total chegar
 * vazio ou sem nenhum valor representável: Concluídas é subconjunto do Total,
 * então em operação normal o pico do Total já cobre as duas séries.
 */
export function quantityAxisMax(
  total: readonly number[],
  completed: readonly number[] = [],
): number {
  const fromTotal = finiteOf(total)
  const values = fromTotal.length > 0 ? fromTotal : finiteOf(completed)
  // O acumulador começa em zero: valor negativo, que a contagem de OS não
  // produz, não puxa o teto para baixo do chão do eixo.
  const peak = values.reduce((maior, value) => Math.max(maior, value), 0)

  if (peak <= 0) return QUANTITY_AXIS_MIN_MAX

  // Passo mínimo de uma OS: a escala de uma contagem não se divide em frações.
  const step = Math.max(1, niceStep(peak / QUANTITY_AXIS_DIVISIONS))

  return Math.max(QUANTITY_AXIS_MIN_MAX, Math.ceil(peak / step) * step)
}

/** Escala do eixo direito: percentual cheio, sempre de 0% a 100%. */
const RATE_AXIS_MAX = 100
/**
 * Intervalo do eixo direito. Cinco faixas é o mesmo número de divisões que o
 * eixo de quantidades usa por padrão, então os rótulos de percentual caem na
 * altura das linhas de grade em vez de flutuar entre elas.
 */
const RATE_AXIS_INTERVAL = 20

/**
 * Paleta do entorno do gráfico, resolvida por tema.
 *
 * As opacidades das áreas moram aqui, junto do resto do que depende do tema: a
 * COR das áreas continua vindo da paleta das séries, e o que muda entre claro e
 * escuro é só quanto dela passa. No tema escuro a transparência precisa ser um
 * pouco maior para a área não desaparecer contra a superfície do painel.
 */
const palette = {
  light: {
    axisLabel: '#98a2b3',
    axisLine: '#e4e7ee',
    splitLine: '#f1f3f7',
    legendText: '#667085',
    // Verde um pouco mais presente que o azul: ele é desenhado POR CIMA da
    // área azul, e com a mesma opacidade a mistura das duas apagaria a
    // fronteira entre o concluído e o total.
    totalArea: [0.3, 0.02] as AreaAlpha,
    completedArea: [0.38, 0.04] as AreaAlpha,
    // Mesma intensidade da área do Total: a taxa é uma das três leituras do
    // painel, e não uma nota de rodapé. Sozinha na tela, com as outras duas
    // desligadas na legenda, ela precisa do mesmo corpo que o azul tem.
    unproductiveArea: [0.3, 0.02] as AreaAlpha,
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
    totalArea: [0.34, 0.03] as AreaAlpha,
    completedArea: [0.44, 0.06] as AreaAlpha,
    unproductiveArea: [0.34, 0.03] as AreaAlpha,
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
 * Valor de uma linha do tooltip, no formato da grandeza da série.
 *
 * Quantidade sai inteira, no padrão de milhar brasileiro; a improdutividade sai
 * em percentual com vírgula. A série chega ao gráfico já em pontos percentuais,
 * porque é essa a escala do eixo direito, então aqui ela volta para proporção
 * antes de ser formatada: o tooltip nunca mostra a proporção crua.
 *
 * Valor ausente ou fora do formato numérico devolve string vazia, e a linha
 * inteira é descartada em vez de exibir `undefined`, `NaN` ou `Infinity`.
 */
function formatDailyVolumeValue(seriesName: string, value: unknown): string {
  const raw = Array.isArray(value) ? value[value.length - 1] : value
  if (raw === null || raw === undefined || raw === '') return ''

  const numeric = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(numeric)) return ''

  if (seriesName === DAILY_VOLUME_UNPRODUCTIVE_SERIES) {
    return formatPercent(numeric / RATE_AXIS_MAX)
  }

  return formatNumber(Math.round(numeric))
}

/**
 * Conteúdo do tooltip: a data do ponto e os valores do dia.
 *
 * Nada além disso é montado aqui. O formatador existe para dar ao número o
 * alinhamento à direita e o peso que o formato padrão do ECharts não tem, e
 * para separar as duas grandezas do painel, não para acrescentar leitura,
 * comparação ou unidade que o gráfico não possui.
 */
export function formatDailyVolumeTooltip(params: unknown): string {
  const items = (Array.isArray(params) ? params : [params]).filter(
    (item): item is DailyVolumeTooltipItem => typeof item === 'object' && item !== null,
  )
  const title = items[0]?.axisValueLabel ?? ''
  const rows = items
    .map((item) => ({
      item,
      text: formatDailyVolumeValue(item.seriesName ?? '', item.value),
    }))
    .filter(({ text }) => text !== '')
    .map(
      ({ item, text }) =>
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;line-height:17px">' +
        `<span style="display:flex;align-items:center;min-width:0">${item.marker ?? ''}${item.seriesName ?? ''}</span>` +
        `<span style="font-weight:600;white-space:nowrap">${text}</span>` +
        '</div>',
    )

  return `<div style="margin-bottom:4px;font-weight:600">${title}</div>${rows.join('')}`
}

/** Extremos e soma de uma coleção, ignorando valores não representáveis. */
function finiteOf(values: readonly number[]): number[] {
  return values.filter((value) => Number.isFinite(value))
}

/** Trecho da descrição acessível de uma série de QUANTIDADE. */
function describeCount(name: string, values: readonly number[]): string {
  const finite = finiteOf(values)
  if (finite.length === 0) return `${name}: sem quantidade no recorte.`

  const sum = finite.reduce((accumulated, value) => accumulated + value, 0)

  return (
    `${name}: quantidade de OS, de ${formatNumber(Math.min(...finite))} a ` +
    `${formatNumber(Math.max(...finite))} por dia, ${formatNumber(sum)} no período.`
  )
}

/** Trecho da descrição acessível da série de PERCENTUAL, em proporção de 0 a 1. */
function describeRate(name: string, values: readonly number[]): string {
  const finite = finiteOf(values)
  if (finite.length === 0) return `${name}: sem percentual no recorte.`

  return (
    `${name}: percentual das OS do dia, de ${formatPercent(Math.min(...finite))} a ` +
    `${formatPercent(Math.max(...finite))}.`
  )
}

/**
 * Descrição acessível, derivada dos mesmos números que a tela desenha.
 *
 * As três séries aparecem na ordem visual, e cada uma diz qual é a sua
 * grandeza: quem ouve a descrição não tem como confundir o percentual de
 * improdutividade com uma quantidade de OS, nem o contrário. A taxa entra aqui
 * como PROPORÇÃO de 0 a 1, a mesma forma publicada pelos agregados.
 */
export function buildDailyVolumeDescription(
  labels: readonly string[],
  total: readonly number[],
  completed: readonly number[],
  unproductiveRate: readonly number[],
): string {
  if (labels.length === 0) return `${CHART_NAME}. ${DAILY_VOLUME_EMPTY_MESSAGE}.`

  const period =
    labels.length === 1
      ? `1 dia com OS, em ${labels[0]}`
      : `${formatNumber(labels.length)} dias com OS, de ${labels[0]} a ${labels[labels.length - 1]}`

  return [
    `${CHART_NAME}.`,
    `${period}.`,
    describeCount(DAILY_VOLUME_TOTAL_SERIES, total),
    describeCount(DAILY_VOLUME_COMPLETED_SERIES, completed),
    describeRate(DAILY_VOLUME_UNPRODUCTIVE_SERIES, unproductiveRate),
  ].join(' ')
}

export function makeDailyVolumeOptions(
  labels: readonly string[],
  total: readonly number[],
  completed: readonly number[],
  unproductiveRate: readonly number[],
  theme: Theme,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const axisLabel = { color: colors.axisLabel, fontSize: 10.5 }
  // A taxa chega dos agregados como proporção de 0 a 1 e é convertida para
  // pontos percentuais aqui, na apresentação, porque é essa a escala do eixo
  // direito. O passeio pelos rótulos garante um ponto por dia mesmo se a
  // coleção chegar curta: dia sem taxa representável vira lacuna, e não zero.
  const ratePoints = labels.map((_, index) => {
    const value = unproductiveRate[index]
    return Number.isFinite(value) ? value * RATE_AXIS_MAX : null
  })
  // Teto do eixo esquerdo resolvido AQUI, na montagem das opções, a partir dos
  // dados recebidos: quando o gráfico chega à tela a escala já está decidida, e
  // a legenda não tem como mexer nela.
  const quantityMax = quantityAxisMax(total, completed)
  // Recorte de um único dia: sem segmento de linha para desenhar, cada série
  // vira um marcador circular visível, no diâmetro aprovado para ela. Com duas
  // ou mais datas o comportamento normal continua intacto, sem símbolo nenhum.
  const singleDay = labels.length === 1
  const symbolOf = (size: number) =>
    singleDay ? ({ symbol: 'circle', symbolSize: size } as const) : ({ symbol: 'none' } as const)

  return {
    textStyle: { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 },
    // Nenhuma animação: nem a de entrada, nem a de atualização quando os
    // filtros mudam a série. O gráfico é uma leitura de valores, e a linha
    // deslizando até a posição final atrasa essa leitura sem informar nada.
    // A preferência de redução de movimento do sistema continua valendo para o
    // resto da página; aqui simplesmente não há movimento para reduzir.
    animation: false,
    aria: {
      enabled: true,
      label: {
        enabled: true,
        description: buildDailyVolumeDescription(labels, total, completed, unproductiveRate),
      },
    },
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
      // Um ponto redondo para as TRÊS séries, do mesmo tamanho: a legenda é uma
      // lista de nomes com a cor de cada série ao lado, e não uma miniatura do
      // desenho. Sem `data` própria, a lista sai das séries, na ordem delas.
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: colors.legendText, fontSize: 11.5 },
    },
    grid: { left: 10, right: 18, top: 20, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      // Com duas ou mais datas as linhas encostam nas bordas do painel, como
      // sempre. Com UM único dia a folga entra: o dia ocupa a faixa inteira e o
      // marcador cai no centro do painel, em vez de meio cortado na borda
      // esquerda, parecendo defeito.
      boundaryGap: singleDay,
      data: [...labels],
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisTick: { show: false },
      // `interval: 'auto'` é o padrão do ECharts e está declarado porque agora
      // é ele que sustenta o período inteiro: com 95 dias no recorte completo,
      // o eixo rareia os rótulos sozinho. Nenhum dia é cortado da série para
      // caber, e o gráfico não ganha rolagem nem zoom por causa disso.
      axisLabel: { ...axisLabel, interval: 'auto', hideOverlap: true },
    },
    yAxis: [
      {
        // Eixo das QUANTIDADES, à esquerda: Total e Concluídas. É ele que
        // desenha a grade horizontal do painel.
        //
        // A escala é EXPLÍCITA, e não automática: o teto sai do pico do Total
        // do recorte, calculado antes de qualquer clique na legenda. Assim
        // esconder Total não reescala o painel e não infla visualmente as
        // Concluídas, e o eixo continua acompanhando os dados quando um filtro
        // muda o recorte. É também o que mantém a largura reservada à
        // esquerda: com todas as séries desligadas o eixo continua desenhando
        // os próprios rótulos, e o primeiro dia do eixo X não é mais cortado.
        type: 'value',
        min: 0,
        max: quantityMax,
        splitLine: { lineStyle: { color: colors.splitLine } },
        axisLabel,
      },
      {
        // Eixo do PERCENTUAL, à direita, fixo de 0% a 100%: a escala não se
        // ajusta ao recorte, então uma taxa de 11% é sempre lida como uma
        // faixa baixa do gráfico, e não como uma linha alta de um eixo curto.
        type: 'value',
        min: 0,
        max: RATE_AXIS_MAX,
        interval: RATE_AXIS_INTERVAL,
        // A grade já vem do eixo esquerdo: um segundo conjunto de linhas
        // dobraria as horizontais sobre o mesmo desenho.
        splitLine: { show: false },
        // Mesma cor e mesmo tamanho dos rótulos da esquerda, com o `%` que
        // separa as duas leituras. O eixo acompanha o de quantidades em vez de
        // disputar a atenção com ele.
        axisLabel: { ...axisLabel, formatter: '{value}%' },
      },
    ],
    // A ordem das séries é a ordem de pintura do ECharts, e é ela que monta a
    // sobreposição: o Total entra primeiro e fica ao fundo, Concluídas cobre
    // parte dele e a taxa fecha por cima, sempre visível. Nenhuma série tem
    // `stack`: as áreas se sobrepõem, não se somam.
    series: [
      {
        name: DAILY_VOLUME_TOTAL_SERIES,
        type: 'line',
        yAxisIndex: 0,
        // Sem suavização: a curva inventava valores entre dois dias e suavizava
        // justamente os picos, que é o que se procura num volume diário.
        smooth: false,
        // `symbol: 'none'`, e não `showSymbol: false`: com `showSymbol` o
        // ECharts continua desenhando o símbolo do ponto quando o ponteiro do
        // eixo passa por ele, e `emphasis.disabled` não impede isso. Sem
        // símbolo definido não há o que aparecer, no repouso ou no hover. A
        // exceção é o recorte de um único dia, em que o símbolo é o desenho.
        ...symbolOf(SINGLE_DAY_SYMBOL_SIZES.total),
        // Nenhum destaque: sem isto o ECharts engrossa a linha ao passar o
        // mouse sobre ela ou sobre a entrada da legenda.
        emphasis: { disabled: true },
        data: [...total],
        lineStyle: { width: 2.4, color: DAILY_VOLUME_COLORS.total },
        itemStyle: { color: DAILY_VOLUME_COLORS.total },
        areaStyle: { color: areaGradient(DAILY_VOLUME_COLORS.total, colors.totalArea) },
      },
      {
        name: DAILY_VOLUME_COMPLETED_SERIES,
        type: 'line',
        yAxisIndex: 0,
        smooth: false,
        ...symbolOf(SINGLE_DAY_SYMBOL_SIZES.completed),
        emphasis: { disabled: true },
        data: [...completed],
        lineStyle: { width: 2.4, color: DAILY_VOLUME_COLORS.completed },
        itemStyle: { color: DAILY_VOLUME_COLORS.completed },
        // Área verde POR CIMA da azul, no mesmo chão do eixo esquerdo: o que
        // aparece é a parcela concluída dentro do volume do dia. A linha segue
        // com a mesma espessura da linha do Total, então continua nítida
        // mesmo quando as duas séries quase se encostam.
        areaStyle: { color: areaGradient(DAILY_VOLUME_COLORS.completed, colors.completedArea) },
      },
      {
        name: DAILY_VOLUME_UNPRODUCTIVE_SERIES,
        type: 'line',
        // A única série do eixo direito: percentual, nunca quantidade.
        yAxisIndex: 1,
        smooth: false,
        ...symbolOf(SINGLE_DAY_SYMBOL_SIZES.unproductiveRate),
        emphasis: { disabled: true },
        data: ratePoints,
        // Linha contínua e da MESMA espessura das duas de volume: as três
        // séries do painel são leituras de primeira linha. Sem `type`, que é o
        // padrão sólido do ECharts: nenhuma propriedade extra é preciso para
        // desenhar uma linha inteira.
        lineStyle: { width: 2.4, color: DAILY_VOLUME_COLORS.unproductiveRate },
        itemStyle: { color: DAILY_VOLUME_COLORS.unproductiveRate },
        // Área a partir do zero do eixo direito, no mesmo idioma e na mesma
        // intensidade da área azul do Total.
        areaStyle: {
          color: areaGradient(DAILY_VOLUME_COLORS.unproductiveRate, colors.unproductiveArea),
        },
      },
    ],
  }
}
