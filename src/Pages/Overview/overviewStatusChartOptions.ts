import type { EChartsOption } from 'echarts'

import type { Theme } from '../../contexts/PreferencesContextCore'
import type { Pair } from '../../data/dashboardTypes'
import { formatNumber, formatPercent } from '../../lib/formatters'

/**
 * Opções do gráfico `Distribuição por status`.
 *
 * Vive aqui pelo mesmo motivo de `overviewDailyChartOptions`: `makeDonutOptions`
 * é compartilhado com outras páginas, entre elas a rosca de Status, e continua
 * intacto. Este painel trocou a rosca por barras horizontais porque comparar
 * cinco fatias de rosca é impreciso: em barra a diferença entre dois status é
 * um comprimento, e a quantidade e a participação ficam escritas na própria
 * linha, sem depender de tooltip nem de legenda.
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

/** Uma linha do gráfico, com tudo o que a tela e o leitor de tela precisam. */
export type StatusDistributionRow = {
  readonly status: string
  readonly value: number
  /** Participação sobre a soma dos valores recebidos, de 0 a 1. */
  readonly share: number
  readonly color: string
  /** Rótulo direto na ponta da barra, no padrão `531 · 80,0%`. */
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
        label: `${formatNumber(value)} · ${formatPercent(share)}`,
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
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
  },
  dark: {
    category: '#dfe5ec',
    valueLabel: '#cdd5df',
    splitLine: 'rgba(159,174,196,0.14)',
    empty: '#a9b5c6',
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
 * Opacidade das barras NÃO selecionadas quando um status está filtrado. O
 * valor mantém as barras visíveis e legíveis nos dois temas: elas são o
 * contexto comparativo, não podem sumir nem zerar.
 */
const DIMMED_BAR_OPACITY = 0.4

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
    // A margem direita é reservada para o rótulo `1.510 · 82,9%`, que fica fora
    // da barra: sem ela o texto do maior status sairia da área de desenho.
    // `containLabel` cuida apenas do eixo de categorias, à esquerda.
    grid: { left: 4, right: 92, top: 6, bottom: 6, containLabel: true },
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
        barMaxWidth: 20,
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
            color: row.color,
            borderRadius: [0, 4, 4, 0],
            opacity:
              selectedStatus !== null && row.status !== selectedStatus
                ? DIMMED_BAR_OPACITY
                : 1,
          },
        })),
      },
    ],
  }
}
