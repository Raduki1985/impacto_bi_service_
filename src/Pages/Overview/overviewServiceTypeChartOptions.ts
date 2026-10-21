import type { EChartsOption } from 'echarts'

import { OS_DONUT_PALETTE } from '../../components/charts/chartOptions'
import type { Theme } from '../../contexts/PreferencesContextCore'
import type { Pair } from '../../data/dashboardTypes'
import type { ServiceTypeSlice } from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_LEGACY_SERVICE_TYPE } from '../../data/overviewOsData'
import { statusColors } from '../../data/dashboardAggregates'
import { mixHexColors } from '../../lib/colorMix'
import { formatNumber, formatPercent } from '../../lib/formatters'

/**
 * Opções do gráfico `Composição por tipo de OS` da Visão Geral.
 *
 * Uma rosca com uma fatia por Tipo de OS do recorte. O tooltip de cada fatia
 * é o que dá utilidade ao gráfico: além da quantidade e da participação do
 * tipo, ele lista o ranking das categorias que compõem aquela fatia, então a
 * pergunta "o que há dentro de Instalação de Câmeras?" é respondida no próprio
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
 * Terracota da Infraestrutura.
 *
 * Existe porque a posição 3 da paleta das roscas é o vermelho `#e5484d`, que é
 * EXATAMENTE o mesmo do status `Improdutiva`. Os dois painéis ficam lado a lado
 * na Visão Geral, então o mesmo vermelho aparecia como um tipo de serviço em um
 * e como resultado ruim no outro. Vermelho e verde carregam julgamento no
 * portal inteiro e não devem virar identidade de tipo de serviço.
 *
 * Era o grafite `#334155` até 09/09/2026, e saiu por MEDIDA, não por gosto:
 * contra a superfície escura dos painéis (`#1f2937`) ele alcançava 1,42 de
 * contraste, e a fatia simplesmente não existia no tema escuro. Pior, ficava na
 * mesma família do `#64748b` da Retirada, que é a fatia vizinha: dois cinzas
 * encostados, um deles invisível.
 *
 * A terracota resolve os dois problemas de uma vez e é a única candidata que
 * passa do mínimo de 3,0 para elemento gráfico NOS DOIS temas: 3,40 sobre a
 * superfície escura e 4,31 sobre a clara. O cinza claro `#cbd5e1`, alternativa
 * óbvia, resolveria só o escuro e sumiria no claro, com 1,48. A cor continua
 * igual nos dois temas, como nas outras roscas.
 *
 * A faixa de terra é o que sobrou: azul, verde-azulado, âmbar e azul claro já
 * pertencem a outros tipos DESTA rosca; vermelho e verde julgam resultado; roxo,
 * lilás e rosa estavam descartados na identidade dos gráficos por decisão do
 * Mário, revogada por ele em 21/10/2026. Ela fica na vizinhança do `#b45309`
 * do status `Expirada`, desenhado no
 * painel ao lado, e isso é aceito: os dois gráficos têm legendas próprias, e o
 * âmbar `#f5a623` já é ao mesmo tempo um tipo aqui e o status `Em Andamento` lá.
 */
const INFRASTRUCTURE_COLOR = '#b5652f'

/**
 * Os dois tipos de câmera que o SGI passou a usar depois da paleta das roscas,
 * quando as categorias foram levadas para eles (Retirada de Câmeras em
 * 07/10/2026, Manutenção de Câmeras em 21/10/2026; os dois existiam no cadastro
 * de tipos desde 24/09/2026, sem uso),
 * escolhidos pelo Mário em 21/10/2026 sobre uma prévia da rosca nos dois
 * temas, com os volumes reais das quatro semanas anteriores.
 *
 * - Manutenção de Câmeras na fúcsia `#c026d3`: 4,71 sobre a superfície clara e
 *   3,12 sobre a escura, acima do mínimo de 3,0 nos dois. Fica perto do roxo
 *   da Mudança de Endereço, o que foi mostrado na prévia e aceito.
 * - Retirada de Câmeras no cinza esverdeado `#5b8a86`: cinza como a Retirada,
 *   puxado para o verde-azulado da Instalação de Câmeras. 3,87 e 3,79.
 */
const CAMERA_MAINTENANCE_COLOR = '#c026d3'
const CAMERA_PICKUP_COLOR = '#5b8a86'

/**
 * Cor de identidade de cada tipo, FIXA por tipo e não por posição: filtrar o
 * recorte muda o tamanho e a ordem das fatias, mas nunca repinta um tipo.
 *
 * As cores são as da paleta das roscas das demais páginas de OS (Status,
 * Categorias, Resoluções), sem literal próprio, e quase na mesma sequência em
 * que aquelas roscas as distribuem: os tipos mais frequentes da fonte recebem
 * as primeiras posições. A exceção é o par âmbar e roxo, que o Mário trocou de
 * dono depois de ver a rosca na tela.
 * Três exceções, todas com razão registrada: a Infraestrutura sai do vermelho
 * da posição 3, que é semântico em toda a página, e vai para a terracota que
 * enxerga nos dois temas; os dois tipos de câmera que o SGI ganhou depois da
 * paleta têm cor própria, medida e escolhida pelo Mário (bloco acima); o tipo
 * legado, resíduo da implantação do SGI, fica no cinza neutro do status
 * `Pendente`. A cor é igual nos dois temas, como nas outras roscas.
 */
const SERVICE_TYPE_COLORS: Readonly<Record<string, string>> = {
  Instalação: OS_DONUT_PALETTE[0],
  'Instalação de Câmeras': OS_DONUT_PALETTE[1],
  'Manutenção de Câmeras': CAMERA_MAINTENANCE_COLOR,
  'Retirada de Câmeras': CAMERA_PICKUP_COLOR,
  // Âmbar e roxo trocaram de dono em 09/09/2026, a pedido do Mário: a
  // Manutenção ficou com o âmbar e a Mudança de Endereço com o roxo.
  'Mudança de Endereço': OS_DONUT_PALETTE[4],
  Infraestrutura: INFRASTRUCTURE_COLOR,
  Manutenção: OS_DONUT_PALETTE[2],
  Auditoria: OS_DONUT_PALETTE[5],
  Retirada: OS_DONUT_PALETTE[6],
  [OVERVIEW_OS_LEGACY_SERVICE_TYPE]: statusColors.Pendente,
}

/**
 * Cor de identidade de um tipo, igual em qualquer recorte e em qualquer tema.
 *
 * Tipo sem cor declarada (uma chave crua do SGI, ou um rótulo novo do de-para)
 * cai no cinza neutro do legado em vez de derrubar o gráfico: a fatia aparece,
 * contável, e ganhar cor própria é ajuste de apresentação, não de dado. A
 * página não valida mais o mapa contra o catálogo simulado (decisão de
 * 08/09/2026): a lista de tipos vem da fonte.
 */
export function serviceTypeColor(name: string): string {
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

/**
 * O que motiva o destaque de fatias na rosca: o próprio filtro Tipo de OS, ou
 * o filtro Categoria, que destaca o tipo (ou os tipos, no caso raro de uma
 * categoria viver sob mais de um) que contém a categoria escolhida. A rosca
 * ignora os dois filtros no dado, então a seleção vira ênfase, nunca corte.
 * Desde 30/09/2026 os dois filtros aceitam várias opções: todos os tipos
 * marcados, ou todos os que contêm alguma categoria marcada, ficam em
 * destaque.
 */
export type ServiceTypeHighlight =
  | { readonly kind: 'service-type'; readonly serviceTypes: readonly string[] }
  | {
      readonly kind: 'category'
      readonly categories: readonly string[]
      readonly serviceTypes: readonly string[]
    }

/** Fatias que ficam em cor plena; null quando nada está destacado. */
function highlightedTypes(highlight: ServiceTypeHighlight | null): ReadonlySet<string> | null {
  if (highlight === null) return null
  // Categoria sem tipo conhecido no contexto não apaga a rosca inteira: sem
  // fatia identificável, nenhuma perde a ênfase.
  return highlight.serviceTypes.length > 0 ? new Set(highlight.serviceTypes) : null
}

/** `A, B e C` em pt-BR, para as leituras acessíveis de destaque. */
export function listPtBr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/** Descrição acessível, derivada da mesma coleção que a tela desenha. */
export function buildServiceTypeDescription(
  rows: readonly ServiceTypeRow[],
  highlight: ServiceTypeHighlight | null = null,
): string {
  if (rows.length === 0) return `Composição por tipo de OS. ${SERVICE_TYPE_EMPTY_MESSAGE}.`

  // Com um tipo ou uma categoria filtrada, a composição é deliberadamente
  // contextual: o leitor de tela recebe a mesma explicação do destaque visual.
  let context = ''
  if (highlight?.kind === 'service-type' && highlight.serviceTypes.length > 0) {
    context =
      (highlight.serviceTypes.length === 1
        ? ` O tipo ${highlight.serviceTypes[0]} está selecionado no filtro e aparece em destaque; `
        : ` Os tipos ${listPtBr(highlight.serviceTypes)} estão selecionados no filtro e aparecem em destaque; `) +
      `os demais tipos permanecem como contexto comparativo do recorte.`
  } else if (highlight?.kind === 'category' && highlight.serviceTypes.length > 0) {
    const plural = highlight.serviceTypes.length > 1
    const oneCategory = highlight.categories.length === 1
    context =
      (oneCategory
        ? ` A categoria ${highlight.categories[0]} está selecionada no filtro e `
        : ` As categorias ${listPtBr(highlight.categories)} estão selecionadas no filtro e `) +
      (plural
        ? `os tipos ${listPtBr(highlight.serviceTypes)}, que ${oneCategory ? 'a contêm' : 'as contêm'}, aparecem em destaque; `
        : `o tipo ${highlight.serviceTypes[0]}, que ${oneCategory ? 'a contém' : 'as contém'}, aparece em destaque; `) +
      `os demais tipos permanecem como contexto comparativo do recorte.`
  }

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

/**
 * Rótulo direto de uma fatia, ou vazio quando ela não tem espaço para ele.
 *
 * `drawnPercent` é o tamanho da fatia no desenho atual, de 0 a 100, como o
 * ECharts o calcula: sem isolamento ele equivale à participação no recorte, e
 * com isolamento ele acompanha a redistribuição do círculo. Ausente, o corte
 * cai para a participação no recorte, que é o comportamento de sempre.
 */
export function serviceTypeDirectLabel(
  row: ServiceTypeRow | undefined,
  drawnPercent?: number,
): string {
  if (row === undefined) return ''

  const drawnShare =
    typeof drawnPercent === 'number' && Number.isFinite(drawnPercent)
      ? drawnPercent / 100
      : row.share

  return drawnShare < DIRECT_LABEL_MIN_DRAWN_SHARE ? '' : formatPercent(row.share)
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

/**
 * Fatias menores que isto não recebem rótulo direto: o nome fica na legenda.
 *
 * O corte é sobre o tamanho DESENHADO da fatia, e não sobre a participação dela
 * no recorte. São coisas diferentes quando alguém clica na legenda para isolar
 * tipos: as fatias que sobram se redistribuem no círculo inteiro, e uma que
 * valia 1,8% do recorte passa a ocupar quase toda a rosca. Pelo tamanho no
 * recorte ela continuaria sem rótulo, com espaço de sobra para ele.
 *
 * O NÚMERO escrito continua sendo a participação real no recorte, a mesma da
 * legenda, do tooltip e da leitura acessível: isolar muda o desenho, e não o
 * que cada tipo representa no período filtrado.
 */
export const DIRECT_LABEL_MIN_DRAWN_SHARE = 0.06

/**
 * Ângulo mínimo desenhado por fatia, em graus.
 *
 * Recurso de visibilidade, e não de dado, como o comprimento mínimo das barras
 * da distribuição por status. Sem ele, uma fatia pequena não sobrevive ao
 * próprio separador: o contorno de 2 px na cor da superfície é descontado dos
 * DOIS lados de toda fatia, então quem tem menos de 0,7% do recorte perde para
 * o contorno a área inteira e simplesmente não aparece. Medido na página, com
 * `Auditoria` em 0,2%: zero pixel da cor dela no anel, embora a legenda e o
 * tooltip trouxessem os números certos.
 *
 * Cinco graus são 1,4% do círculo, o que deixa cerca de 6 px de fatia visível
 * depois do separador. O ângulo extra sai proporcionalmente das demais fatias,
 * que cedem 1,2% do tamanho delas, imperceptível na maior. Nenhum número muda:
 * rótulo, legenda, tooltip e leitura acessível continuam saindo de `row.share`,
 * calculado sobre os dados, e não da geometria desenhada.
 */
export const SERVICE_TYPE_MIN_ANGLE = 5

/**
 * Quanto a fatia sob o ponteiro cresce para fora, em pixels.
 *
 * O padrão do ECharts, 10 px, é o que a rosca `Participação por categoria` de
 * OS > Categorias usa, e nesta rosca ficou exagerado: com raio externo de
 * 117 px, dez pixels são quase um décimo do desenho, e a fatia saltava em vez
 * de responder ao ponteiro. Seis pixels mantêm a resposta visível e não
 * transformam o movimento no assunto do painel.
 *
 * Continua cabendo no card com folga: o raio externo é 84% do meio da altura,
 * então restam 16%, uns 22 px, antes de a fatia encostar na borda.
 */
export const SERVICE_TYPE_HOVER_SCALE = 6

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
 * Presença da cor nas fatias NÃO destacadas quando um tipo ou uma categoria
 * está no filtro.
 *
 * O mesmo valor da distribuição por status, e pelo mesmo motivo: as demais
 * fatias são o contexto comparativo, então precisam continuar visíveis e
 * legíveis nos dois temas. Nenhum valor muda, apenas a ênfase.
 *
 * É MISTURA de cor, e não opacidade, pelo mesmo motivo das barras: forma opaca
 * não deixa passar nada do que estiver desenhado atrás dela.
 */
export const DIMMED_SLICE_RATIO = 0.4

export const SERVICE_TYPE_ANIMATION = {
  animation: true,
  animationDuration: 0,
  animationDurationUpdate: 0,
  stateAnimation: { duration: 260, easing: 'cubicOut' },
} as const

export function makeServiceTypeOptions(
  slices: readonly ServiceTypeSlice[],
  theme: Theme,
  highlight: ServiceTypeHighlight | null = null,
): EChartsOption {
  const colors = palette[theme === 'dark' ? 'dark' : 'light']
  const rows = buildServiceTypeRows(slices)
  const highlighted = highlightedTypes(highlight)

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
        description: buildServiceTypeDescription(rows, highlight),
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
        // Piso de visibilidade da fatia pequena. Só a geometria muda.
        minAngle: SERVICE_TYPE_MIN_ANGLE,
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
          // `percent` é o tamanho da fatia no desenho ATUAL, em percentual, e
          // por isso acompanha o isolamento pela legenda; `share` é a
          // participação no recorte, que é o que o rótulo escreve.
          formatter: (params: { name?: string; percent?: number }) =>
            serviceTypeDirectLabel(
              typeof params.name === 'string' ? byName.get(params.name) : undefined,
              params.percent,
            ),
        },
        labelLine: { show: false },
        // Com um tipo ou uma categoria no filtro, a fatia destacada mantém a
        // cor plena e as demais perdem só a ênfase, nunca o valor: as fatias
        // seguem com a quantidade e a participação verdadeiras do contexto.
        data: rows.map((row) => ({
          name: row.name,
          value: row.value,
          itemStyle: {
            color:
              highlighted !== null && !highlighted.has(row.name)
                ? mixHexColors(serviceTypeColor(row.name), colors.surface, DIMMED_SLICE_RATIO)
                : serviceTypeColor(row.name),
          },
        })),
      },
    ],
  }
}
