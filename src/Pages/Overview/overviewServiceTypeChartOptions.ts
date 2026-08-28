import type { EChartsOption } from 'echarts'

import { OS_DONUT_PALETTE } from '../../components/charts/chartOptions'
import type { Theme } from '../../contexts/PreferencesContextCore'
import type { Pair } from '../../data/dashboardTypes'
import { OS_SERVICE_TYPES } from '../../data/mockOsCatalog'
import type { ServiceTypeSlice } from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_LEGACY_SERVICE_TYPE } from '../../data/overviewOsData'
import { statusColors } from '../../data/dashboardAggregates'
import { formatNumber, formatPercent } from '../../lib/formatters'

/**
 * Opções do gráfico `Composição por tipo de OS` da Visão Geral.
 *
 * Uma rosca com uma fatia por Tipo de OS do recorte. O tooltip de cada fatia
 * é o que dá utilidade ao gráfico: além da quantidade e da participação do
 * tipo, ele lista o ranking das categorias que compõem aquela fatia, então a
 * pergunta "o que há dentro de Instalação de Câmera?" é respondida no próprio
 * gráfico, sem trocar de filtro.
 *
 * Vive aqui, e não em `components/charts/chartOptions`, pelo mesmo motivo dos
 * outros geradores desta página: os gráficos compartilhados seguem com a
 * aparência que as demais telas já têm.
 */

/** Texto exibido quando o recorte não tem nenhuma OS. */
export const SERVICE_TYPE_EMPTY_MESSAGE = 'Sem dados no período'

/**
 * Quantas categorias o tooltip lista por extenso antes de resumir o resto.
 *
 * Cinco: é o topo que se lê de relance sem o tooltip virar uma tabela, e o
 * bastante para cobrir a maior parte de qualquer tipo da fonte. O que sobra
 * vira a linha de resumo do fim.
 */
export const SERVICE_TYPE_TOOLTIP_LIMIT = 5

/**
 * Cor de identidade de cada tipo, FIXA por tipo e não por posição: filtrar o
 * recorte muda o tamanho e a ordem das fatias, mas nunca repinta um tipo.
 *
 * As cores são as da paleta das roscas das demais páginas de OS (Status,
 * Categorias, Resoluções), sem literal próprio, na mesma sequência em que
 * aquelas roscas as distribuem: os tipos mais frequentes da fonte recebem as
 * primeiras posições, então no recorte padrão a rosca abre igual às outras.
 * Só o tipo legado, resíduo da implantação do SGI, fica no cinza neutro do
 * status `Pendente`. A cor é igual nos dois temas, como nas outras roscas.
 */
const SERVICE_TYPE_COLORS: Readonly<Record<string, string>> = {
  Instalação: OS_DONUT_PALETTE[0],
  'Instalação de Câmera': OS_DONUT_PALETTE[1],
  'Mudança de Endereço': OS_DONUT_PALETTE[2],
  Infraestrutura: OS_DONUT_PALETTE[3],
  Manutenção: OS_DONUT_PALETTE[4],
  Auditoria: OS_DONUT_PALETTE[5],
  Retirada: OS_DONUT_PALETTE[6],
  [OVERVIEW_OS_LEGACY_SERVICE_TYPE]: statusColors.Pendente,
}

// Todo tipo do catálogo tem cor declarada: um tipo novo sem entrada aqui
// quebra na carga do módulo, e não vira uma fatia sem cor em produção.
for (const type of OS_SERVICE_TYPES) {
  if (!(type in SERVICE_TYPE_COLORS)) {
    throw new Error(`Tipo de OS sem cor na composição por tipo: ${type}`)
  }
}

/** Cor de identidade de um tipo, igual em qualquer recorte e em qualquer tema. */
export function serviceTypeColor(name: string): string {
  // Tipo fora do catálogo não existe na fonte validada; se um dia existir,
  // ele cai no cinza do legado em vez de derrubar o gráfico.
  return SERVICE_TYPE_COLORS[name] ?? statusColors.Pendente
}

/** Uma fatia como a tela desenha e o tooltip descreve. */
export type ServiceTypeRow = {
  readonly name: string
  readonly value: number
  /** Participação no total do recorte, de 0 a 1. */
  readonly share: number
  readonly categories: readonly Pair[]
}

/**
 * Descarta fatias sem valor e calcula a participação de cada uma sobre o
 * total das que sobraram. A ordem de entrada (decrescente, dos agregados) é
 * preservada: a rosca começa pela maior fatia.
 */
export function buildServiceTypeRows(slices: readonly ServiceTypeSlice[]): ServiceTypeRow[] {
  const valid = slices.filter((slice) => Number.isFinite(slice.value) && slice.value > 0)
  const total = valid.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return []

  return valid.map((slice) => ({
    name: slice.name,
    value: slice.value,
    share: slice.value / total,
    categories: slice.categories,
  }))
}

/** Descrição acessível, derivada da mesma coleção que a tela desenha. */
export function buildServiceTypeDescription(
  rows: readonly ServiceTypeRow[],
  selectedServiceType: string | null = null,
): string {
  if (rows.length === 0) return `Composição por tipo de OS. ${SERVICE_TYPE_EMPTY_MESSAGE}.`

  // Com um tipo filtrado, a composição é deliberadamente contextual: o leitor
  // de tela recebe a mesma explicação que o destaque visual transmite.
  const context =
    selectedServiceType === null
      ? ''
      : ` O tipo ${selectedServiceType} está selecionado no filtro e aparece em destaque; ` +
        `os demais tipos permanecem como contexto comparativo do recorte.`

  return (
    'Composição por tipo de OS. ' +
    rows
      .map((row) => `${row.name}: ${formatNumber(row.value)} OS, ${formatPercent(row.share)}`)
      .join('. ') +
    '.' +
    context
  )
}

/**
 * Pontinho colorido do tipo, no MESMO desenho do marcador que o ECharts monta
 * nos tooltips dos outros gráficos da página (o do volume diário, por
 * exemplo): um círculo de 10px na cor da série, com respiro à direita.
 *
 * O gerador é próprio, e não o `params.marker` do ECharts, porque as
 * categorias de dentro da fatia não são séries do gráfico e não recebem
 * marcador nenhum da biblioteca: com um só gerador o cabeçalho e as linhas do
 * ranking ficam alinhados no mesmo eixo, em vez de o ranking começar recuado
 * em relação ao título.
 */
export function serviceTypeMarker(color: string): string {
  return (
    '<span style="display:inline-block;margin-right:6px;border-radius:10px;width:10px;height:10px;' +
    `background-color:${color}"></span>`
  )
}

/**
 * Conteúdo do tooltip de uma fatia: o tipo com quantidade e participação, e
 * abaixo o ranking das categorias que o compõem. Passado do limite, o resto
 * vira uma linha de resumo, para o tooltip não crescer além da tela.
 *
 * O pontinho da cor da fatia abre o cabeçalho, como nos demais tooltips do
 * portal: a identidade do que está sendo lido não fica só na fatia sob o
 * ponteiro. As linhas do ranking não repetem esse ponto nem numeram os itens:
 * a ordem já é a da própria lista, e os dois enfeites competiam com o nome da
 * categoria, que é o que se lê ali.
 */
export function buildServiceTypeTooltip(row: ServiceTypeRow): string {
  const listed = row.categories.slice(0, SERVICE_TYPE_TOOLTIP_LIMIT)
  const rest = row.categories.length - listed.length
  const color = serviceTypeColor(row.name)

  const header =
    '<div style="display:flex;align-items:center;margin-bottom:4px;font-weight:600">' +
    `${serviceTypeMarker(color)}${row.name}</div>` +
    // O recuo alinha o texto ao nome do tipo, que começa depois do pontinho.
    `<div style="margin-bottom:6px;padding-left:16px">${formatNumber(row.value)} OS · ${formatPercent(row.share)} do recorte</div>`
  // Todo o bloco abaixo do cabeçalho alinha no mesmo eixo do nome do tipo,
  // que começa depois do pontinho.
  const rankingTitle =
    '<div style="margin-bottom:2px;padding-left:16px;font-size:11px;opacity:.8">' +
    'Categorias que compõem</div>'
  const ranking = listed
    .map(
      ([category, count]) =>
        '<div style="display:flex;align-items:center;gap:10px;justify-content:space-between;' +
        'padding-left:16px;line-height:17px">' +
        // `min-width:0` + `overflow` truncam o NOME, e só ele: sem isso um
        // nome longo (`mudança de endereço de 2 câmeras - Instalação`)
        // empurrava o número para fora da caixa e os dois se sobrepunham. O
        // corte é só de exibição: o nome íntegro continua no dado da fatia.
        '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        `${category}</span>` +
        `<span style="flex:none;font-weight:600;white-space:nowrap">${formatNumber(count)}</span></div>`,
    )
    .join('')
  const noun = rest === 1 ? 'categoria' : 'categorias'
  const more =
    rest > 0
      ? `<div style="margin-top:2px;padding-left:16px;font-size:11px;opacity:.8">e mais ${formatNumber(rest)} ${noun}</div>`
      : ''

  return header + rankingTitle + ranking + more
}

const palette = {
  light: {
    legend: '#344054',
    surface: '#ffffff',
    empty: '#98a2b3',
    tooltipBackground: '#1a2331',
    tooltipBorder: '#1a2331',
    tooltipText: '#ffffff',
  },
  dark: {
    legend: '#dfe5ec',
    surface: '#1f2937',
    empty: '#a9b5c6',
    tooltipBackground: '#263448',
    tooltipBorder: '#46556b',
    tooltipText: '#f2f4f7',
  },
} as const

const baseTextStyle = { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 }

/** Fatias menores que isto não recebem rótulo direto: o nome fica na legenda. */
const DIRECT_LABEL_MIN_SHARE = 0.06

/**
 * Quanto a fatia sob o ponteiro cresce para fora, em pixels.
 *
 * É o mesmo destaque da rosca `Participação por categoria` de OS >
 * Categorias, o valor padrão do ECharts. Cabe no card: o raio externo da
 * rosca é 84% do meio da altura, então sobram 16% para o crescimento sem a
 * fatia encostar na borda.
 */
export const SERVICE_TYPE_HOVER_SCALE = 10

/**
 * Como a rosca anima.
 *
 * A ENTRADA e a troca de filtro continuam instantâneas, como nos demais
 * gráficos desta página: a fatia já nasce no tamanho final, sem varrer o
 * círculo a cada mudança de recorte. O que ganha movimento é só a transição
 * de ESTADO, isto é, o crescimento da fatia sob o ponteiro, que o ECharts
 * governa por `stateAnimation` e só executa com a animação ligada. Daí a
 * animação ficar ligada com as duas durações zeradas, em vez de `false`.
 */
/**
 * Opacidade das fatias NÃO selecionadas quando um tipo está filtrado.
 *
 * O mesmo valor da distribuição por status, e pelo mesmo motivo: as demais
 * fatias são o contexto comparativo, então precisam continuar visíveis e
 * legíveis nos dois temas. Nenhum valor muda, apenas a ênfase.
 */
export const DIMMED_SLICE_OPACITY = 0.4

export const SERVICE_TYPE_ANIMATION = {
  animation: true,
  animationDuration: 0,
  animationDurationUpdate: 0,
  stateAnimation: { duration: 260, easing: 'cubicOut' },
} as const

export function makeServiceTypeOptions(
  slices: readonly ServiceTypeSlice[],
  theme: Theme,
  selectedServiceType: string | null = null,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const rows = buildServiceTypeRows(slices)

  if (rows.length === 0) {
    return {
      textStyle: baseTextStyle,
      animation: false,
      aria: {
        enabled: true,
        label: { enabled: true, description: buildServiceTypeDescription(rows) },
      },
      title: {
        text: SERVICE_TYPE_EMPTY_MESSAGE,
        left: 'center',
        top: 'middle',
        textStyle: { ...baseTextStyle, color: colors.empty, fontSize: 12.5, fontWeight: 'normal' },
      },
    }
  }

  const byName = new Map(rows.map((row) => [row.name, row]))

  return {
    textStyle: baseTextStyle,
    ...SERVICE_TYPE_ANIMATION,
    aria: {
      enabled: true,
      label: {
        enabled: true,
        description: buildServiceTypeDescription(rows, selectedServiceType),
      },
    },
    tooltip: {
      trigger: 'item',
      showDelay: 0,
      transitionDuration: 0,
      confine: true,
      backgroundColor: colors.tooltipBackground,
      borderColor: colors.tooltipBorder,
      textStyle: { color: colors.tooltipText, fontSize: 12, fontFamily: 'IBM Plex Sans' },
      padding: [8, 12],
      extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:320px',
      formatter: (params: unknown) => {
        const name = (params as { name?: string }).name
        const row = typeof name === 'string' ? byName.get(name) : undefined
        return row === undefined ? '' : buildServiceTypeTooltip(row)
      },
    },
    // Legenda sempre presente: a identidade das fatias nunca depende só da
    // cor. Vertical à direita, com rolagem se um dia houver mais tipos do que
    // a altura do card comporta.
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 0,
      top: 'middle',
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
      textStyle: { color: colors.legend, fontSize: 11.5, fontFamily: 'IBM Plex Sans, sans-serif' },
      formatter: (name: string) => {
        const row = byName.get(name)
        return row === undefined ? name : `${name}  ${formatPercent(row.share)}`
      },
    },
    series: [
      {
        type: 'pie',
        // Rosca deslocada à esquerda para deixar a coluna da legenda livre.
        radius: ['52%', '84%'],
        center: ['34%', '50%'],
        // A fatia sob o ponteiro cresce para fora, como na rosca de OS >
        // Categorias: o ponteiro passa a ter uma resposta no próprio desenho,
        // e não só no tooltip. Sem `focus`, as demais fatias continuam com a
        // cor cheia, também como lá.
        emphasis: { scale: true, scaleSize: SERVICE_TYPE_HOVER_SCALE },
        // Separador de 2px na cor da superfície entre fatias adjacentes.
        itemStyle: { borderColor: colors.surface, borderWidth: 2, borderRadius: 3 },
        // Rótulo direto só nas fatias com espaço para ele; as pequenas ficam
        // identificadas pela legenda.
        label: {
          show: true,
          position: 'inside',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: 600,
          formatter: (params: { name?: string }) => {
            const row = typeof params.name === 'string' ? byName.get(params.name) : undefined
            if (row === undefined || row.share < DIRECT_LABEL_MIN_SHARE) return ''
            return formatPercent(row.share)
          },
        },
        labelLine: { show: false },
        // Com um tipo selecionado no filtro, ele mantém a cor plena e os demais
        // perdem só a ênfase, nunca o valor: as fatias seguem com a quantidade
        // e a participação verdadeiras do contexto.
        data: rows.map((row) => ({
          name: row.name,
          value: row.value,
          itemStyle: {
            color: serviceTypeColor(row.name),
            opacity:
              selectedServiceType !== null && row.name !== selectedServiceType
                ? DIMMED_SLICE_OPACITY
                : 1,
          },
        })),
      },
    ],
  }
}
