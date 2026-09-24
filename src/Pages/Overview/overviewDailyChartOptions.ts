import type { EChartsOption } from 'echarts'

import { executiveCardColors } from '../../components/dashboard/executiveMetricCardModel'
import type { Theme } from '../../contexts/PreferencesContextCore'
import { formatNumber } from '../../lib/formatters'

/**
 * Opções do gráfico `Volume diário de OS`.
 *
 * Vive aqui, e não em `components/charts/chartOptions`, porque nem
 * `makeLineOptions` nem `makeBarOptions` são deste gráfico: os dois são
 * compartilhados por várias telas do portal, e este painel combina barra e
 * linha, com tooltip próprio. Mudar o helper comum levaria essa decisão para
 * páginas que não fazem parte do bloco.
 *
 * As TRÊS séries são QUANTIDADE de OS, no mesmo eixo da esquerda, decisão do
 * Mário: Total e Concluídas em barra, Improdutivas em linha. Não existe mais
 * eixo de percentual aqui; a taxa continua no card executivo
 * `Taxa Improdutividade`, que é onde ela é lida como indicador.
 *
 * As três aparecem SEMPRE, inclusive no período sem nenhuma improdutiva, em
 * que a linha fica deitada no zero. Esconder a série nesse caso foi testado na
 * tela e reprovado pelo Mário em 09/09/2026: o painel sem a linha e sem a
 * entrada na legenda parecia incompleto, e o gráfico deixava de responder se
 * não houve improdutiva ou se a série sumiu. A reta no zero é o resultado.
 *
 * Total e Concluídas ocupam a MESMA posição do dia, e nunca empilhadas:
 * Concluídas é subconjunto do Total, então somar as duas alturas contaria a
 * mesma OS duas vezes. A barra verde é mais estreita e encostada na borda
 * ESQUERDA da azul, desenho escolhido pelo Mário: a faixa azul que sobra à
 * direita e acima dela é o que não foi concluído no dia.
 *
 * Desde 24/09/2026 o dia ABRE a lista das OS dele, na mesma janela dos
 * Motivos e do Destino (pedido do Mário). A barra azul abre o Total do dia, a
 * verde as Concluídas, e o nome do dia no eixo também abre o Total. No mesmo
 * dia o Mário não conseguiu abrir os dias fracos: com duas OS a barra tem
 * poucos pixels, e o nome do dia some do eixo quando o período é longo. Desde
 * então o FUNDO da coluna do dia, a mesma faixa que o ponteiro pinta, também
 * abre o Total. A linha de Improdutivas não tem ponto para clicar fora do
 * recorte de um dia; as improdutivas do dia ficam a um atalho de distância
 * dentro da janela.
 */

/**
 * Nomes das três séries.
 *
 * São constantes porque aparecem em três lugares (série, legenda e tooltip) e
 * precisam ser sempre o mesmo texto: um rótulo divergente quebraria a ligação
 * entre a série e a sua entrada na legenda.
 *
 * `Improdutivas` era `Taxa de improdutividade` enquanto a série era percentual.
 * Agora ela conta OS, e o nome antigo prometeria uma leitura que o desenho não
 * entrega mais. Rótulo pendente de confirmação do Mário.
 */
export const DAILY_VOLUME_TOTAL_SERIES = 'Total'
export const DAILY_VOLUME_COMPLETED_SERIES = 'Concluídas'
export const DAILY_VOLUME_UNPRODUCTIVE_SERIES = 'Improdutivas'

/** Nome do gráfico, usado na descrição acessível. */
const CHART_NAME = 'Volume diário de OS'

/** Texto da descrição acessível quando o recorte não tem nenhum dia com OS. */
export const DAILY_VOLUME_EMPTY_MESSAGE = 'Sem dados no período'

/**
 * Nota exibida quando Total e Concluídas são integralmente iguais no recorte.
 *
 * Com `Status: Concluída`, toda OS do recorte é concluída: as duas séries têm
 * os mesmos valores e a barra verde chega à mesma altura da azul. A nota
 * explica a coincidência em vez de deslocar valores ou esconder séries.
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

/** Série do Volume diário que o clique abre; nula é o Total do dia. */
export type DailyVolumeSeries = 'completed' | 'unproductive'

/** Dia e série sob o clique. */
export type DailyVolumeClick = {
  readonly date: string
  readonly series: DailyVolumeSeries | null
}

/** As séries do dia, como os agregados da página as entregam. */
type DailyVolumeData = {
  readonly x: readonly string[]
  readonly iso: readonly string[]
  readonly total: readonly number[]
  readonly completed: readonly number[]
  readonly unproductive: readonly number[]
}

/**
 * Dia e série sob o clique, ou null fora de uma barra com OS.
 *
 * A série é lida pelo NOME, e não pela posição, para a ordem de pintura das
 * séries poder mudar sem trocar o que o clique abre. O nome do dia no eixo
 * chega pelo texto e abre o Total. Série zerada no dia não abre janela vazia.
 */
export function dailyVolumeFromChartClick(
  day: DailyVolumeData,
  params: unknown,
): DailyVolumeClick | null {
  if (typeof params !== 'object' || params === null) return null
  const { componentType, dataIndex, seriesName, value } = params as {
    componentType?: unknown
    dataIndex?: unknown
    seriesName?: unknown
    value?: unknown
  }

  let index: number
  let series: DailyVolumeSeries | null
  if (componentType === 'series' && typeof dataIndex === 'number') {
    index = dataIndex
    if (seriesName === DAILY_VOLUME_TOTAL_SERIES) series = null
    else if (seriesName === DAILY_VOLUME_COMPLETED_SERIES) series = 'completed'
    else if (seriesName === DAILY_VOLUME_UNPRODUCTIVE_SERIES) series = 'unproductive'
    else return null
  } else if (componentType === 'xAxis' && typeof value === 'string') {
    index = day.x.indexOf(value)
    series = null
  } else {
    return null
  }

  return dayAt(day, index, series)
}

/**
 * Total do dia na posição `index` do eixo, ou null fora dos dias do recorte.
 *
 * É o clique no fundo da coluna do dia, fora das barras (`onCategoryClick` do
 * `Chart`): ali não existe série sob o ponteiro, e o dia abre inteiro.
 */
export function dailyVolumeFromDayIndex(day: DailyVolumeData, index: number): DailyVolumeClick | null {
  return dayAt(day, index, null)
}

/** Dia e série da posição, desde que a série tenha OS naquele dia. */
function dayAt(
  day: DailyVolumeData,
  index: number,
  series: DailyVolumeSeries | null,
): DailyVolumeClick | null {
  const date = day.iso[index]
  const count =
    series === null ? day.total[index] : series === 'completed' ? day.completed[index] : day.unproductive[index]
  if (date === undefined || !(count > 0)) return null

  return { date, series }
}

/** Convite ao clique, só com dia para clicar e com a lista ligada. */
export const DAILY_VOLUME_CLICK_HINT = 'clique numa barra ou no dia para ver as OS'

/**
 * Subtítulo do painel: a nota do recorte, quando existe (status filtrado ou
 * séries coincidentes), e o convite ao clique quando há dia para clicar e a
 * lista está ligada (`clickable` falso na base local de estudo). Sem nenhum
 * dos dois o painel segue sem subtítulo, como sempre foi no recorte padrão.
 */
export function dailyVolumeSubtitle(
  note: string | undefined,
  clickable: boolean,
  dayCount: number,
): string | undefined {
  const hint = clickable && dayCount > 0 ? DAILY_VOLUME_CLICK_HINT : undefined
  if (note === undefined) {
    return hint === undefined ? undefined : `${hint.charAt(0).toUpperCase()}${hint.slice(1)}`
  }

  return hint === undefined ? note : `${note} · ${hint}`
}

/**
 * Nota do painel diário quando um status está selecionado no filtro.
 *
 * Um recorte de um único status torna parte das séries verdadeira por
 * definição, e não por medição: com `Concluída`, Total e Concluídas coincidem;
 * com `Improdutiva`, Concluídas é zero e Improdutivas repete o Total; com
 * qualquer outro status, Concluídas e Improdutivas ficam em zero. A nota
 * explica o que o desenho degenerado significa, em vez de deixar séries
 * chapadas sem causa declarada. Os valores continuam intactos: nada é
 * escondido nem deslocado.
 */
export function dailyVolumeStatusNote(status: string): string {
  if (status === 'Concluída') return DAILY_VOLUME_COINCIDENT_MESSAGE

  if (status === 'Improdutiva') {
    return (
      'Recorte limitado ao status Improdutiva: Concluídas fica em 0 e ' +
      'Improdutivas repete o Total por definição'
    )
  }

  return `Recorte limitado ao status ${status}: Concluídas e Improdutivas ficam em 0 por definição`
}

/**
 * Diâmetro do marcador de Improdutivas no recorte de UM único dia.
 *
 * Só ela precisa disso: com um único dia não existe segmento de linha para
 * desenhar, e `symbol: 'none'` deixaria a série vermelha invisível. As duas
 * quantidades em barra aparecem sozinhas em qualquer recorte.
 *
 * O diâmetro considera o anel: descontada a borda, ainda sobra miolo vermelho
 * suficiente para o ponto ser lido como a cor da série, e não como uma bolinha
 * clara em cima da barra.
 */
export const SINGLE_DAY_RATE_SYMBOL_SIZE = 11

/** Espessura do anel do marcador, na cor da superfície do painel. */
export const SINGLE_DAY_RATE_SYMBOL_RING = 2

/**
 * Largura das barras de quantidade, em percentual da faixa reservada ao dia.
 *
 * A verde é mais estreita e fica DENTRO da azul, encostada na borda esquerda:
 * é o desenho que o Mário escolheu, comparado na tela com as duas lado a lado.
 * O teto em pixels evita a barra gorda demais quando o filtro deixa poucos dias
 * no recorte: com um único dia a faixa é o painel inteiro, e sem teto a barra
 * viraria um bloco de parede a parede.
 */
export const DAILY_VOLUME_BAR = {
  total: { width: 62, maxWidth: 46 },
  completed: { width: 32, maxWidth: 24 },
} as const

/**
 * Recuo que traz a barra verde para dentro da azul.
 *
 * O `barGap` do ECharts é medido em percentual da largura da barra anterior, e
 * `-100%` recua uma largura inteira: a verde volta para o começo exato da azul,
 * as duas encostam na mesma borda esquerda e a sobra azul fica à direita e
 * acima. É esse alinhamento, e não o centrado, que foi aprovado.
 */
export const DAILY_VOLUME_BAR_GAP = '-100%'

/**
 * Arredondamento do topo das barras, em pixels.
 *
 * Discreto de propósito: com o período inteiro na tela as barras ficam
 * estreitas, e um raio maior comeria a ponta justamente onde o valor é lido. As
 * duas barras usam o mesmo, para o topo da verde não parecer de outra família.
 */
const BAR_TOP_RADIUS = [2, 2, 0, 0] as const

/**
 * Cores aprovadas das séries, iguais nos dois temas.
 *
 * Total permanece no azul do portal e Concluídas no verde: identidade da série,
 * não do resultado. Como são as mesmas do restante da página, não recebem
 * variação por tema; o que se adapta é o entorno (eixos, grade, legenda e
 * tooltip), que é o que precisa de contraste contra a superfície.
 *
 * O vermelho das improdutivas vem da paleta compartilhada dos cards
 * executivos, sem literal próprio: é o MESMO vermelho semântico que pinta a
 * barra do status `Improdutiva` nos gráficos de OS, então a improdutividade
 * tem uma cor só no portal inteiro.
 */
export const DAILY_VOLUME_COLORS = {
  total: '#2f6bff',
  completed: '#16a34a',
  unproductive: executiveCardColors.red,
} as const

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
 * das opções, a partir da série TOTAL, e vira `max` fixo do eixo. Sem isso o
 * ECharts recalcularia a escala ao ocultar Total pela legenda, e as mesmas
 * Concluídas passariam a ocupar toda a altura do painel, sugerindo um
 * crescimento que não existe.
 *
 * O teto acompanha os DADOS, nunca a legenda: mudar o período ou um filtro
 * muda o pico do recorte e portanto a escala; ligar e desligar séries não muda
 * nada. E ele nunca é fixado num valor global, o que achataria os recortes
 * pequenos contra o chão do gráfico.
 *
 * Concluídas entra apenas como rede de segurança, para o caso de Total chegar
 * vazio ou sem nenhum valor representável: as outras duas séries são
 * subconjunto do Total, então em operação normal o pico do Total já cobre o
 * painel inteiro.
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

/**
 * Paleta do entorno do gráfico, resolvida por tema.
 *
 * Só o entorno muda entre claro e escuro: eixos, grade, legenda, tooltip e a
 * faixa que marca o dia consultado. As cores das séries são as mesmas nos dois
 * temas, porque são identidade da série e não do fundo.
 */
const palette = {
  light: {
    axisLabel: '#98a2b3',
    axisLine: '#e4e7ee',
    splitLine: '#f1f3f7',
    legendText: '#667085',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
    // Faixa translúcida atrás da coluna do dia consultado. Bem leve: ela indica
    // qual dia o tooltip está lendo e não pode escurecer a barra que o usuário
    // está justamente tentando comparar com as vizinhas.
    axisPointer: 'rgba(26,35,49,0.06)',
    // Cor da superfície do painel, usada como anel do marcador de Improdutivas
    // no recorte de um dia: ali o ponto vermelho cai em cima da barra, e sem o
    // anel ele se confunde com o preenchimento dela.
    symbolRing: '#ffffff',
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
    axisPointer: 'rgba(233,237,243,0.08)',
    // Mesma superfície escura dos painéis executivos de OS.
    symbolRing: '#1f2937',
  },
} as const

/**
 * Dias da semana em português, na ordem de `Date.getDay()`, que começa no
 * domingo. Minúsculos, como se escrevem no meio da frase; quem abre um texto
 * com eles põe a maiúscula, como o título do tooltip.
 */
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/**
 * Dia da semana de uma data `aaaa-mm-dd`, como os agregados publicam.
 *
 * A data é montada com componentes LOCAIS, e não por `new Date(texto)`: o
 * caminho por UTC deslocaria o dia para o anterior no nosso fuso, e o tooltip
 * anunciaria a segunda como domingo. Texto fora do formato, ou data que
 * transborda o mês, devolve string vazia, e o título fica só com a data em vez
 * de mostrar um dia da semana errado.
 */
export function weekdayOfISO(dateISO: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO)
  if (!parts) return ''

  const [year, month, day] = parts.slice(1).map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return ''
  }

  return WEEKDAYS[date.getDay()]
}

/**
 * Título do tooltip: o dia da semana, quando dá para saber, e a data do dia.
 *
 * O dia da semana vem PRIMEIRO desde 24/09/2026 (pedido do Mário), com
 * maiúscula por abrir o título, como no título da página em recorte de um dia
 * ("Segunda-feira, 21/09/2026"). É ele que separa a queda de sábado e domingo,
 * que é rotina, da queda no meio da semana, que é problema. Vem da data
 * completa publicada pelos agregados, porque o rótulo do eixo tem só dia e
 * mês.
 */
export function dailyVolumeTooltipTitle(label: string, dateISO: string | undefined): string {
  const weekday = dateISO ? weekdayOfISO(dateISO) : ''
  if (weekday === '') return label

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${label}`
}

type DailyVolumeTooltipItem = {
  readonly axisValueLabel?: string
  readonly dataIndex?: number
  readonly marker?: string
  readonly seriesName?: string
  readonly value?: unknown
}

/**
 * Valor de uma linha do tooltip.
 *
 * As três séries são contagem de OS, então todas saem inteiras, no padrão de
 * milhar brasileiro. Valor ausente ou fora do formato numérico devolve string
 * vazia, e a linha inteira é descartada em vez de exibir `undefined`, `NaN` ou
 * `Infinity`.
 */
function formatDailyVolumeValue(value: unknown): string {
  const raw = Array.isArray(value) ? value[value.length - 1] : value
  if (raw === null || raw === undefined || raw === '') return ''

  const numeric = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(numeric)) return ''

  return formatNumber(Math.round(numeric))
}

/**
 * Conteúdo do tooltip: o dia consultado e as quantidades daquele dia.
 *
 * O formatador recebe as datas completas do recorte para poder escrever o dia
 * da semana no título, e é por isso que ele é montado por uma fábrica em vez de
 * ser uma função solta. Fora isso não acrescenta leitura, comparação ou unidade
 * que o gráfico não tenha.
 */
export function makeDailyVolumeTooltipFormatter(isoDates: readonly string[]) {
  return function formatDailyVolumeTooltip(params: unknown): string {
    const items = (Array.isArray(params) ? params : [params]).filter(
      (item): item is DailyVolumeTooltipItem => typeof item === 'object' && item !== null,
    )
    const first = items[0]
    const index = first?.dataIndex
    const title = dailyVolumeTooltipTitle(
      first?.axisValueLabel ?? '',
      typeof index === 'number' ? isoDates[index] : undefined,
    )
    const rows = items
      .map((item) => ({ item, text: formatDailyVolumeValue(item.value) }))
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

/**
 * Descrição acessível, derivada dos mesmos números que a tela desenha.
 *
 * As três séries aparecem na ordem visual, e todas anunciam quantidade de OS,
 * que é o que o painel passou a mostrar.
 */
export function buildDailyVolumeDescription(
  labels: readonly string[],
  total: readonly number[],
  completed: readonly number[],
  unproductive: readonly number[],
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
    describeCount(DAILY_VOLUME_UNPRODUCTIVE_SERIES, unproductive),
  ].join(' ')
}

export function makeDailyVolumeOptions(
  labels: readonly string[],
  isoDates: readonly string[],
  total: readonly number[],
  completed: readonly number[],
  unproductive: readonly number[],
  theme: Theme,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const axisLabel = { color: colors.axisLabel, fontSize: 10.5 }
  // Um ponto por rótulo mesmo se a coleção chegar curta: dia sem valor
  // representável vira lacuna, e não um zero que não foi medido.
  const unproductivePoints = labels.map((_, index) => {
    const value = unproductive[index]
    return Number.isFinite(value) ? value : null
  })
  // Teto do eixo resolvido AQUI, na montagem das opções, a partir dos dados
  // recebidos: quando o gráfico chega à tela a escala já está decidida, e a
  // legenda não tem como mexer nela.
  const quantityMax = quantityAxisMax(total, completed)
  // Recorte de um único dia: a linha de Improdutivas não tem vizinho para
  // ligar, então ela vira um marcador circular visível, que abre as
  // improdutivas do dia. Com duas ou mais datas o comportamento normal
  // continua intacto, sem símbolo nenhum, e a linha deixa o clique passar:
  // o traço não diz de que dia é, e engoliria justamente o clique no fundo da
  // coluna, perto do chão, onde ficam os dias fracos. As barras não dependem
  // disso: elas aparecem em qualquer recorte.
  const unproductiveSymbol =
    labels.length === 1
      ? ({ symbol: 'circle', symbolSize: SINGLE_DAY_RATE_SYMBOL_SIZE } as const)
      : ({ symbol: 'none', silent: true } as const)

  return {
    textStyle: { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 },
    // Nenhuma animação: nem a de entrada, nem a de atualização quando os
    // filtros mudam a série. O gráfico é uma leitura de valores, e a barra
    // subindo até a altura final atrasa essa leitura sem informar nada.
    // A preferência de redução de movimento do sistema continua valendo para o
    // resto da página; aqui simplesmente não há movimento para reduzir.
    animation: false,
    aria: {
      enabled: true,
      label: {
        enabled: true,
        description: buildDailyVolumeDescription(labels, total, completed, unproductive),
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
      // O ponteiro do eixo é o que liga a caixa ao dia consultado. Com barras a
      // marca é a FAIXA do dia, e não uma linha vertical: a linha cairia no
      // meio da coluna e cortaria a barra ao meio. É a única marca que aparece
      // com o ponteiro do mouse, e não altera as séries.
      axisPointer: { type: 'shadow', shadowStyle: { color: colors.axisPointer } },
      formatter: makeDailyVolumeTooltipFormatter(isoDates),
    },
    legend: {
      bottom: 0,
      // Um ponto redondo para as TRÊS séries, do mesmo tamanho: a legenda é uma
      // lista de nomes com a cor de cada série ao lado, e não uma miniatura do
      // desenho. Sem `data` própria, a lista sai das séries, na ordem delas.
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      // A legenda ignora o anel do marcador de Improdutivas. Ele existe para
      // separar o ponto vermelho da barra que fica atrás, e num ícone de 9 px
      // comeria a borda do ponto, deixando esse menor que os outros dois.
      itemStyle: { borderWidth: 0 },
      textStyle: { color: colors.legendText, fontSize: 11.5 },
    },
    grid: { left: 10, right: 18, top: 20, bottom: 40, containLabel: true },
    xAxis: {
      type: 'category',
      // Folga sempre, que é o que barra exige: cada dia recebe uma FAIXA do
      // eixo, e a barra fica inteira dentro dela. Sem isso o ECharts centraria
      // a barra na marca do eixo e as do primeiro e do último dia sairiam pela
      // metade nas bordas do painel.
      boundaryGap: true,
      data: [...labels],
      // O nome do dia também abre a lista do Total daquele dia, como o fundo
      // da coluna: num dia com poucas OS a barra é curta demais para acertar
      // com o mouse.
      triggerEvent: true,
      axisLine: { lineStyle: { color: colors.axisLine } },
      axisTick: { show: false },
      // `interval: 'auto'` é o padrão do ECharts e está declarado porque é ele
      // que sustenta o período inteiro: com 95 dias no recorte completo, o eixo
      // rareia os rótulos sozinho. Nenhum dia é cortado da série para caber, e
      // o gráfico não ganha rolagem nem zoom por causa disso.
      axisLabel: { ...axisLabel, interval: 'auto', hideOverlap: true },
    },
    // Um eixo de valor só, porque as três séries são a mesma grandeza: contagem
    // de OS. Enquanto a improdutividade era percentual havia um segundo eixo à
    // direita, e ele saiu junto com ela.
    //
    // A escala é EXPLÍCITA, e não automática: o teto sai do pico do Total do
    // recorte, calculado antes de qualquer clique na legenda. Assim esconder
    // Total não reescala o painel e não infla visualmente as Concluídas, e o
    // eixo continua acompanhando os dados quando um filtro muda o recorte. É
    // também o que mantém a largura reservada à esquerda: com todas as séries
    // desligadas o eixo continua desenhando os próprios rótulos, e o primeiro
    // dia do eixo X não é cortado.
    yAxis: {
      type: 'value',
      min: 0,
      max: quantityMax,
      splitLine: { lineStyle: { color: colors.splitLine } },
      axisLabel,
    },
    // A ordem das séries é a ordem de pintura do ECharts: o Total entra
    // primeiro e fica ao fundo, Concluídas é desenhada dentro dele e
    // Improdutivas fecha por cima, sempre visível. Nenhuma série tem `stack`:
    // as barras se sobrepõem, não se somam.
    series: [
      {
        name: DAILY_VOLUME_TOTAL_SERIES,
        type: 'bar',
        barWidth: `${DAILY_VOLUME_BAR.total.width}%`,
        barMaxWidth: DAILY_VOLUME_BAR.total.maxWidth,
        // Nenhum destaque: sem isto o ECharts clareia a barra ao passar o
        // mouse sobre ela ou sobre a entrada da legenda.
        emphasis: { disabled: true },
        data: [...total],
        itemStyle: { color: DAILY_VOLUME_COLORS.total, borderRadius: [...BAR_TOP_RADIUS] },
      },
      {
        name: DAILY_VOLUME_COMPLETED_SERIES,
        type: 'bar',
        // Recuo de uma largura inteira: a verde volta para o começo da azul e
        // as duas encostam na mesma borda esquerda. A sobra azul à direita e
        // acima dela é o que não foi concluído no dia.
        barGap: DAILY_VOLUME_BAR_GAP,
        barWidth: `${DAILY_VOLUME_BAR.completed.width}%`,
        barMaxWidth: DAILY_VOLUME_BAR.completed.maxWidth,
        emphasis: { disabled: true },
        data: [...completed],
        itemStyle: { color: DAILY_VOLUME_COLORS.completed, borderRadius: [...BAR_TOP_RADIUS] },
      },
      {
        name: DAILY_VOLUME_UNPRODUCTIVE_SERIES,
        // Continua em LINHA, agora contando OS: a linha atravessa as colunas e
        // deixa ver o desenho do período, que uma terceira barra espremida na
        // faixa do dia não daria.
        type: 'line',
        // Sem suavização: a curva inventava valores entre dois dias e suavizava
        // justamente os picos, que é o que se procura num acompanhamento
        // diário.
        smooth: false,
        // `symbol: 'none'`, e não `showSymbol: false`: com `showSymbol` o
        // ECharts continua desenhando o símbolo do ponto quando o ponteiro do
        // eixo passa por ele, e `emphasis.disabled` não impede isso. Sem
        // símbolo definido não há o que aparecer, no repouso ou no hover. A
        // exceção é o recorte de um único dia, em que o símbolo é o desenho.
        ...unproductiveSymbol,
        emphasis: { disabled: true },
        data: unproductivePoints,
        // Linha contínua e sem preenchimento por baixo: sobre as barras a área
        // vermelha viraria um véu que apaga o volume do dia. Sem `type` no
        // traço, que é o padrão sólido do ECharts.
        lineStyle: { width: 2.4, color: DAILY_VOLUME_COLORS.unproductive },
        // O anel na cor do painel só aparece quando existe símbolo, ou seja no
        // recorte de um dia, e é ele que separa o ponto vermelho da barra que
        // fica atrás. A cor do ponto continua sendo a da série.
        itemStyle: {
          color: DAILY_VOLUME_COLORS.unproductive,
          borderColor: colors.symbolRing,
          borderWidth: SINGLE_DAY_RATE_SYMBOL_RING,
        },
        // A linha fica ACIMA das duas barras, sempre: sem isto ela some atrás
        // da coluna nos dias de volume alto.
        z: 3,
      },
    ],
  }
}
