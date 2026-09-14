import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'
import type { Pair } from '../../data/dashboardTypes'
import { mixHexColors } from '../../lib/colorMix'
import { formatNumber, formatPercent } from '../../lib/formatters'

/**
 * Opções do gráfico `Distribuição por status`.
 *
 * Vive aqui pelo mesmo motivo de `overviewDailyChartOptions`: `makeDonutOptions`
 * é compartilhado com outras páginas, entre elas a rosca de Status, e continua
 * intacto. Este painel trocou a rosca por barras horizontais porque comparar
 * cinco fatias de rosca é impreciso: em barra a diferença entre dois status é
 * um comprimento, e a quantidade fica escrita na própria linha, sem depender
 * de tooltip nem de legenda. A participação segue no tooltip e na leitura
 * acessível, onde não disputa espaço com a quantidade.
 */

/**
 * Cor de um status sem entrada na paleta oficial.
 *
 * A paleta é sempre a recebida em `charts.statusColors`, que é a fonte única de
 * cor semântica do portal: aqui não existe uma segunda tabela com os mesmos
 * status. Esta constante cobre apenas o caso de a base trazer um status novo,
 * ainda não cadastrado na paleta: ele aparece em cinza neutro, com o nome e os
 * números corretos, em vez de sumir do gráfico ou herdar a cor de outro.
 */
const FALLBACK_COLOR = '#94a3b8'

/** Texto exibido quando o recorte não tem nenhum valor representável. */
export const STATUS_EMPTY_MESSAGE = 'Sem dados no período'

/** Nome do gráfico, usado na descrição acessível. */
const CHART_NAME = 'Distribuição por status'

/**
 * Altura aprovada da primeira linha de gráficos, em pixels, e a quantidade de
 * status que cabe nela com folga.
 *
 * Cinco status é o que a base traz hoje, e em 280 px cada linha fica com uns
 * 56 px: barra de 20 px, nome e rótulo com respiro. O catálogo oficial, porém,
 * permite treze status, e empilhar treze linhas na mesma altura espremeria as
 * barras até os nomes se encostarem.
 */
export const STATUS_CHART_MIN_HEIGHT = 280
const STATUS_COMFORTABLE_COUNT = 5

/**
 * Espaço acrescentado por status acima do confortável.
 *
 * Menor que os 56 px por linha da altura mínima porque a folga de cinco status
 * é generosa: 34 px por status extra mantêm cada linha em pelo menos 42 px, o
 * suficiente para a barra de 20 px e para o nome no eixo. Com os treze status
 * do catálogo o painel chega a 552 px, sem sobreposição.
 */
const STATUS_ROW_HEIGHT = 34

/**
 * Altura necessária para a comparação entre status, a partir de quantos status
 * o recorte tem.
 *
 * Determinística e sem estado: a mesma quantidade devolve sempre a mesma
 * altura. Nunca encolhe abaixo do mínimo aprovado, então nem o estado vazio nem
 * um recorte de um status só reduzem o painel. É esta função que a página usa
 * para os DOIS gráficos da primeira linha, e é por isso que os cards continuam
 * alinhados quando a distribuição cresce.
 */
export function statusDistributionHeight(statusCount: number): number {
  if (!Number.isFinite(statusCount) || statusCount <= STATUS_COMFORTABLE_COUNT) {
    return STATUS_CHART_MIN_HEIGHT
  }

  const extra = Math.ceil(statusCount) - STATUS_COMFORTABLE_COUNT

  return STATUS_CHART_MIN_HEIGHT + extra * STATUS_ROW_HEIGHT
}

/** Uma linha do gráfico, com tudo o que a tela e o leitor de tela precisam. */
export type StatusDistributionRow = {
  readonly status: string
  readonly value: number
  /** Participação sobre a soma dos valores recebidos, de 0 a 1. */
  readonly share: number
  readonly color: string
  /**
   * Rótulo direto na ponta da barra: SÓ a quantidade, no padrão `1.510`.
   *
   * A participação continua calculada em `share` e continua legível no tooltip
   * e na descrição acessível. Fora da barra ela saiu porque a linha carregava
   * dois números para a mesma informação, e o comprimento da barra já é a
   * participação desenhada.
   */
  readonly label: string
}

/**
 * Ordena os status e calcula a participação de cada um.
 *
 * A ordenação é decrescente por quantidade, com desempate pela posição de
 * origem: dois status com o mesmo volume mantêm a ordem de negócio que veio dos
 * agregados. O desempate é explícito, e não confiado à estabilidade do `sort`
 * do motor.
 *
 * A coleção recebida nunca é ordenada no lugar: `map` cria um array novo antes
 * do `sort`, então `charts.statusPairs` continua na ordem de origem para quem
 * mais o consumir.
 *
 * O denominador é a soma dos valores EFETIVAMENTE recebidos, e não um total
 * calculado em outro lugar. É isso que faz a participação continuar correta com
 * qualquer filtro aplicado: se o recorte tem 664 OS, é sobre 664 que os
 * percentuais fecham.
 */
export function buildStatusDistributionRows(
  pairs: readonly Pair[],
  statusColors: Readonly<Record<string, string>>,
): { readonly rows: readonly StatusDistributionRow[]; readonly total: number } {
  const total = pairs.reduce((sum, [, value]) => sum + value, 0)

  if (total <= 0 || !Number.isFinite(total)) return { rows: [], total: 0 }

  const rows = pairs
    .map((pair, index) => ({ pair, index }))
    .sort((a, b) => b.pair[1] - a.pair[1] || a.index - b.index)
    .map(({ pair: [status, value] }) => {
      const share = value / total

      return {
        status,
        value,
        share,
        color: statusColors[status] ?? FALLBACK_COLOR,
        label: formatNumber(value),
      }
    })

  return { rows, total }
}

/** Descrição acessível, derivada das mesmas linhas que a tela desenha. */
export function buildStatusDistributionDescription(
  rows: readonly StatusDistributionRow[],
  selectedStatus: string | null = null,
): string {
  if (rows.length === 0) return `${CHART_NAME}. ${STATUS_EMPTY_MESSAGE}.`

  const parts = rows.map(
    (row) => `${row.status}: ${formatNumber(row.value)} OS, ${formatPercent(row.share)}`,
  )

  // Com um status filtrado, a distribuição é deliberadamente contextual: o
  // leitor de tela recebe a mesma explicação que o destaque visual transmite.
  const context =
    selectedStatus === null
      ? ''
      : ` O status ${selectedStatus} está selecionado no filtro e aparece em destaque; ` +
        `os demais status permanecem como contexto comparativo do recorte.`

  return `${CHART_NAME}. ${parts.join('. ')}.${context}`
}

/** Paleta do entorno do gráfico, resolvida por tema. */
const palette = {
  light: {
    category: '#344054',
    valueLabel: '#475467',
    splitLine: '#f1f3f7',
    empty: '#98a2b3',
    // Superfície do painel, usada só para misturar a cor da barra esmaecida.
    surface: '#ffffff',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
  },
  dark: {
    category: '#dfe5ec',
    valueLabel: '#cdd5df',
    splitLine: 'rgba(159,174,196,0.14)',
    empty: '#a9b5c6',
    surface: '#1f2937',
    // Mesma superfície elevada do tooltip do `Volume diário de OS`: sobre o
    // painel escuro uma caixa mais escura que o fundo desapareceria.
    tooltipBackground: '#263448',
    tooltipBorder: '#46556b',
    tooltipText: '#f2f4f7',
  },
} as const

const baseTextStyle = { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }

/**
 * Painel vazio.
 *
 * Sem valores representáveis não existe eixo, escala nem denominador: qualquer
 * participação seria uma divisão por zero. Em vez de desenhar barras de
 * comprimento zero ou um percentual inválido, o painel diz que o recorte não
 * tem dados e mantém a própria altura.
 */
function emptyOption(theme: Theme): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']

  return {
    textStyle: baseTextStyle,
    animation: false,
    aria: {
      enabled: true,
      label: { enabled: true, description: `${CHART_NAME}. ${STATUS_EMPTY_MESSAGE}.` },
    },
    title: {
      text: STATUS_EMPTY_MESSAGE,
      left: 'center',
      top: 'middle',
      textStyle: { ...baseTextStyle, color: colors.empty, fontSize: 12.5, fontWeight: 'normal' },
    },
  }
}

/**
 * Presença da cor nas barras NÃO selecionadas quando um status está filtrado. O
 * valor mantém as barras visíveis e legíveis nos dois temas: elas são o
 * contexto comparativo, não podem sumir nem zerar.
 *
 * É MISTURA de cor, e não opacidade. Esmaecer por transparência deixava a barra
 * translúcida, e as linhas de grade do eixo, desenhadas atrás dela, apareciam
 * como riscos verticais dentro da barra.
 */
const DIMMED_BAR_RATIO = 0.4

/**
 * Comprimento mínimo, em pixels, de uma barra com valor positivo.
 *
 * Recurso de visibilidade, e não de dado: um status com participação muito
 * pequena existe no recorte e precisa ser visto, mas a barra dele mede menos de
 * um pixel na escala do maior status. Quatro pixels é o suficiente para a barra
 * se ler como barra ao lado do nome, e curto o bastante para não competir com
 * quem tem volume de verdade.
 */
export const STATUS_BAR_MIN_LENGTH = 4

export function makeStatusDistributionOptions(
  pairs: readonly Pair[],
  statusColors: Readonly<Record<string, string>>,
  theme: Theme,
  selectedStatus: string | null = null,
): EChartsOption {
  const { rows } = buildStatusDistributionRows(pairs, statusColors)

  if (rows.length === 0) return emptyOption(theme)

  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  // O eixo de categorias do ECharts desenha de baixo para cima, então a ordem
  // é invertida no desenho para o maior status aparecer no topo. Rótulo,
  // tooltip e descrição acessível leem TODOS desta mesma coleção invertida, e
  // por isso não têm como divergir entre si.
  const drawn = [...rows].reverse()

  return {
    textStyle: baseTextStyle,
    // Sem animação de entrada nem de atualização quando um filtro muda a
    // distribuição: a barra já nasce no comprimento final.
    animation: false,
    aria: {
      enabled: true,
      label: {
        enabled: true,
        description: buildStatusDistributionDescription(rows, selectedStatus),
      },
    },
    // A margem direita é reservada para o rótulo `1.510`, que fica fora da
    // barra: sem ela o número do maior status sairia da área de desenho. São
    // 48 px porque o rótulo agora é só a quantidade; com o percentual junto a
    // reserva precisava de quase o dobro. `containLabel` cuida apenas do eixo
    // de categorias, à esquerda.
    grid: { left: 4, right: 48, top: 6, bottom: 6, containLabel: true },
    tooltip: {
      // Por item, e não por eixo: no eixo o ECharts desenha uma faixa cinza
      // sobre a linha inteira, que é exatamente a mudança visual no hover que
      // este painel não deve ter.
      trigger: 'item',
      showDelay: 0,
      transitionDuration: 0,
      confine: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText, fontSize: 12, fontFamily: 'IBM Plex Sans' },
      padding: [7, 11],
      extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18)',
      formatter: (params: unknown) => {
        const index = (params as { dataIndex?: number }).dataIndex
        const row = typeof index === 'number' ? drawn[index] : undefined
        if (row === undefined) return ''

        return (
          `<div style="margin-bottom:2px;font-weight:600">${row.status}</div>` +
          `<div>${formatNumber(row.value)} OS · ${formatPercent(row.share)} do total</div>`
        )
      },
    },
    xAxis: {
      type: 'value',
      // Sem números no eixo: a quantidade já está escrita na ponta de cada
      // barra, e repeti-la na escala seria o mesmo valor em dois lugares.
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: colors.splitLine } },
    },
    yAxis: {
      type: 'category',
      data: drawn.map((row) => row.status),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.category, fontSize: 11.5, fontWeight: 500 },
    },
    series: [
      {
        type: 'bar',
        // Espessura moderada: com cinco status em 280 px sobra folga entre as
        // linhas, e com menos status as barras não engordam até virarem blocos.
        // Acima de cinco status quem cresce é a altura do painel, dada por
        // `statusDistributionHeight`, e não a espessura da barra.
        barMaxWidth: 20,
        // Comprimento mínimo desenhado. Em barra HORIZONTAL o `barMinHeight` do
        // ECharts age no eixo de VALOR, ou seja, no comprimento: um status de
        // 1 OS em 1.248 daria menos de um pixel e apareceria como um risco
        // quebrado ao lado do nome. O dado não muda em lugar nenhum: `value`,
        // rótulo, tooltip, descrição acessível e denominador continuam com o
        // número real, e só barras abaixo de 4 px recebem este piso.
        barMinHeight: STATUS_BAR_MIN_LENGTH,
        // Nenhum destaque: sem isto o ECharts clareia a barra sob o ponteiro.
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'right',
          color: colors.valueLabel,
          fontSize: 11,
          fontWeight: 600,
          formatter: (params: { dataIndex: number }) => drawn[params.dataIndex]?.label ?? '',
        },
        // Com um status selecionado no filtro, ele mantém a cor plena e os
        // demais perdem só a ênfase, nunca o valor: as barras seguem com a
        // quantidade e a participação verdadeiras do contexto.
        data: drawn.map((row) => ({
          value: row.value,
          name: row.status,
          itemStyle: {
            color:
              selectedStatus !== null && row.status !== selectedStatus
                ? mixHexColors(row.color, colors.surface, DIMMED_BAR_RATIO)
                : row.color,
            borderRadius: [0, 4, 4, 0],
          },
        })),
      },
    ],
  }
}
