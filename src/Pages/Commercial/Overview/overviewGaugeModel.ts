import { PREVIOUS_PERIOD_LABEL } from '../../../components/dashboard/executiveMetricCardModel'
import { formatNumber, formatPercent } from '../../../lib/formatters'

/**
 * Modelo do velocímetro de Meta Comercial e Supermeta Total.
 *
 * O velocímetro é uma representação do atingimento, não uma regra nova. O que
 * este arquivo faz de próprio é normalizar a meta proporcional para vendas
 * inteiras e derivar TUDO dessa mesma meta efetiva: percentual, distância,
 * rodapé, leitura gerencial e texto acessível. Nada é arredondado só no texto.
 */

/** Fim da escala visual: 150%. */
export const GAUGE_MAX_ATTAINMENT = 1.5

/** Referência principal da escala: 100%. */
export const GAUGE_REFERENCE_ATTAINMENT = 1

/** Trecho do arco, em posição normalizada de 0 a 1 sobre a escala completa. */
export type OverviewGaugeArc = {
  readonly from: number
  readonly to: number
}

export type OverviewGaugeFooterCell = {
  readonly term: string
  readonly value: string
}

export type GaugeTone = 'positive' | 'negative' | 'neutral'

export type GaugeComparison = {
  /** Texto visual, com o mesmo rótulo dos demais cards executivos; o card o compacta se estiver estreito. */
  readonly label: string
  /**
   * Texto lido por leitor de tela.
   *
   * Diz a direção por extenso, porque o triângulo é decorativo e o SVG inteiro
   * é `aria-hidden`: sem esta frase o leitor receberia só a porcentagem.
   */
  readonly accessibleLabel: string
  readonly tone: GaugeTone
  /** Triângulo preenchido. `null` em estabilidade e nos estados neutros. */
  readonly direction: 'up' | 'down' | null
  /** Variação real, ou `null` quando não existe base anterior comparável. */
  readonly rate: number | null
}

export type GaugeGap = {
  /** Texto visual do centro do rodapé, sem repetir Meta ou Supermeta. */
  readonly label: string
  /** Mesma situação com o objetivo nomeado, para o texto acessível. */
  readonly accessibleLabel: string
  readonly tone: GaugeTone
  /** Triângulo preenchido. `null` no atingimento exato e nos estados neutros. */
  readonly direction: 'up' | 'down' | null
  /** Diferença inteira entre realizado e meta efetiva. `null` sem objetivo. */
  readonly value: number | null
  /** Texto lido por leitor de tela no lugar do triângulo. */
  readonly directionText: string | null
}

export type OverviewGaugeModel = {
  /** `neutral` não desenha marcador nem arco de progresso. */
  readonly kind: 'measured' | 'neutral'
  /** Atingimento real sobre a meta efetiva. `null` no estado neutro. */
  readonly attainment: number | null
  /** Texto principal do card. Nunca é limitado pela escala. */
  readonly percentLabel: string
  /** Posição do marcador na escala, de 0 a 1. `null` no estado neutro. */
  readonly marker: number | null
  /** Primeiro estágio, do início até 100%. */
  readonly base: OverviewGaugeArc | null
  /** Trecho de superação, acima de 100%. */
  readonly over: OverviewGaugeArc | null
  /** Posição da referência de 100% na escala. */
  readonly reference: number
  /** Realizado em vendas inteiras. */
  readonly achieved: number
  /** Meta efetiva inteira. É a única meta usada em todo o card. */
  readonly effectiveTarget: number | null
  readonly comparison: GaugeComparison
  /** Distância até o objetivo, exibida no centro do rodapé. */
  readonly gap: GaugeGap
  /** Colunas laterais do rodapé. O centro vem de `gap`. */
  readonly footer: {
    readonly left: OverviewGaugeFooterCell
    readonly right: OverviewGaugeFooterCell
  }
  readonly accessibleText: string
}

export type OverviewGaugeInput = {
  /** Nome do indicador, usado no nome acessível. */
  readonly indicator: string
  /** Rótulo estrutural do objetivo: `Meta` ou `Supermeta`. */
  readonly targetTerm: string
  readonly achieved: number
  /** Meta proporcional bruta, que pode vir fracionada. */
  readonly target: number | null
  /** Mesmo numerador do indicador no período anterior comparável. */
  readonly previousAchieved: number | null
  /** `true` somente no recorte exclusivo do Corporativo. */
  readonly corporateOnly: boolean
}

const NOT_APPLICABLE = 'Não se aplica'
const NO_GOAL = 'Sem meta'

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Normalização única de quantidades de vendas.
 *
 * Não existe venda fracionada, mas a meta proporcional é uma conta de dias e
 * produz frações. Para representar a meta em vendas, o próximo inteiro é o
 * único valor honesto: `794,0` continua `794`, `794,1` e `794,9` viram `795`.
 *
 * Esta é a ÚNICA função de arredondamento do card. Percentual, distância,
 * rodapé, leitura gerencial e texto acessível derivam todos do valor que ela
 * devolve, e por isso nunca divergem entre si.
 */
export function ceilSales(value: number | null | undefined): number | null {
  if (!isUsableNumber(value)) return null
  return Math.ceil(value)
}

/**
 * Posição normalizada de um atingimento na escala de 0% a 150%.
 *
 * Limita SOMENTE a posição visual. O percentual textual continua sendo o valor
 * real: 180% de atingimento encosta o marcador no fim da escala, mas o card
 * segue mostrando 180,0%.
 */
export function gaugeRatio(attainment: number): number {
  if (!Number.isFinite(attainment)) return 0
  if (attainment <= 0) return 0
  if (attainment >= GAUGE_MAX_ATTAINMENT) return 1
  return attainment / GAUGE_MAX_ATTAINMENT
}

function salesLabel(value: number): string {
  return `${formatNumber(value)} ${value === 1 ? 'venda' : 'vendas'}`
}

/** Expressão completa lida por leitor de tela. */
const PREVIOUS_PERIOD_LONG = 'em relação ao período anterior'

const NO_PREVIOUS_LABEL = 'Sem período anterior'
const NO_COMPARISON_LABEL = 'Sem comparação neste recorte'

/**
 * Compara o realizado do indicador com o mesmo realizado do período anterior.
 *
 * Cada card passa o próprio numerador: a Meta Comercial compara vendas do
 * Comercial, a Supermeta compara o total ativado. Sem base anterior, ou com
 * base anterior igual a zero, nenhum percentual é inventado.
 *
 * O texto visual usa o mesmo rótulo dos demais cards executivos,
 * `vs. período anterior`, e o próprio card o compacta quando está estreito; o
 * acessível fala crescimento ou queda por extenso, porque nem o triângulo nem
 * a cor chegam ao leitor de tela.
 */
export function buildGaugeComparison(input: {
  readonly current: number
  readonly previous: number | null
  readonly corporateOnly: boolean
}): GaugeComparison {
  if (input.corporateOnly) {
    return {
      label: NO_COMPARISON_LABEL,
      accessibleLabel: 'sem comparação neste recorte',
      tone: 'neutral',
      direction: null,
      rate: null,
    }
  }

  const missingBase: GaugeComparison = {
    label: NO_PREVIOUS_LABEL,
    accessibleLabel: 'sem período anterior comparável',
    tone: 'neutral',
    direction: null,
    rate: null,
  }

  if (
    !isUsableNumber(input.current) ||
    !isUsableNumber(input.previous) ||
    input.previous === 0
  ) {
    return missingBase
  }

  const rate = (input.current - input.previous) / input.previous
  if (!Number.isFinite(rate)) return missingBase
  if (rate > 0) {
    return {
      label: `${formatPercent(rate)} ${PREVIOUS_PERIOD_LABEL}`,
      accessibleLabel: `crescimento de ${formatPercent(rate)} ${PREVIOUS_PERIOD_LONG}`,
      tone: 'positive',
      direction: 'up',
      rate,
    }
  }
  if (rate < 0) {
    return {
      label: `${formatPercent(Math.abs(rate))} ${PREVIOUS_PERIOD_LABEL}`,
      accessibleLabel: `queda de ${formatPercent(Math.abs(rate))} ${PREVIOUS_PERIOD_LONG}`,
      tone: 'negative',
      direction: 'down',
      rate,
    }
  }
  return {
    label: `Estável ${PREVIOUS_PERIOD_LABEL}`,
    accessibleLabel: `resultado estável ${PREVIOUS_PERIOD_LONG}`,
    tone: 'neutral',
    direction: null,
    rate: 0,
  }
}

/**
 * Distância entre o realizado e a meta EFETIVA inteira.
 *
 * Como a meta já chega inteira, a diferença também é inteira: nunca aparece
 * `0,8 venda acima` nem `0,2 venda abaixo`. O atingimento exato não usa
 * triângulo, porque não existe direção a apontar.
 *
 * As duas direções usam a MESMA construção, `N vendas abaixo` e `N vendas
 * acima`, e o triângulo do rodapé completa a leitura. Só o atingimento exato
 * foge da forma, porque ali não há distância a informar: o texto nomeia o
 * objetivo do card, `Meta atingida` ou `Supermeta atingida`.
 *
 * O texto visual não repete `da meta` nem `da supermeta`: o rótulo lateral do
 * rodapé já diz qual é o objetivo do card, e a repetição só roubava largura do
 * centro. O texto acessível continua nomeando o objetivo, porque ali não existe
 * a coluna ao lado para dar o contexto.
 */
export function buildGaugeGap(input: {
  readonly achieved: number
  /** Meta efetiva, já inteira. */
  readonly target: number | null
  readonly targetTerm: string
  readonly corporateOnly: boolean
}): GaugeGap {
  const term = input.targetTerm
  const lowerTerm = term.toLowerCase()

  if (input.corporateOnly) {
    const label = term === 'Supermeta' ? 'Indicador consolidado' : 'Sem meta própria'
    return {
      label,
      accessibleLabel: label,
      tone: 'neutral',
      direction: null,
      value: null,
      directionText: null,
    }
  }
  if (!isUsableNumber(input.target) || !isUsableNumber(input.achieved)) {
    return {
      label: 'Sem meta para o recorte',
      accessibleLabel: 'Sem meta para o recorte',
      tone: 'neutral',
      direction: null,
      value: null,
      directionText: null,
    }
  }

  const value = input.achieved - input.target
  if (value === 0) {
    return {
      label: `${term} atingida`,
      accessibleLabel: `${term} atingida`,
      tone: 'positive',
      direction: null,
      value: 0,
      directionText: `${term} atingida.`,
    }
  }
  if (value > 0) {
    return {
      label: `${salesLabel(value)} acima`,
      accessibleLabel: `${salesLabel(value)} acima da ${lowerTerm}`,
      tone: 'positive',
      direction: 'up',
      value,
      directionText: `Acima da ${lowerTerm}.`,
    }
  }

  const missing = Math.abs(value)
  return {
    // Mesma forma do caso acima, com a direção invertida. Antes o texto era
    // `Faltam 5 vendas`, e o card vizinho dizia `3 vendas acima`: duas frases
    // com estruturas diferentes para a mesma medida. `salesLabel` já resolve o
    // singular e o plural nos dois lados.
    label: `${salesLabel(missing)} abaixo`,
    accessibleLabel: `${salesLabel(missing)} abaixo da ${lowerTerm}`,
    tone: 'negative',
    direction: 'down',
    value,
    directionText: `Abaixo da ${lowerTerm}.`,
  }
}

export function buildOverviewGaugeModel(input: OverviewGaugeInput): OverviewGaugeModel {
  const reference = GAUGE_REFERENCE_ATTAINMENT / GAUGE_MAX_ATTAINMENT
  const achieved = ceilSales(input.achieved) ?? 0
  // Uma única normalização alimenta percentual, distância, rodapé e textos.
  const effectiveTarget = ceilSales(input.target)
  const comparison = buildGaugeComparison({
    current: input.achieved,
    previous: input.previousAchieved,
    corporateOnly: input.corporateOnly,
  })

  // O recorte exclusivo do Corporativo não tem meta própria nem participa
  // sozinho da consolidada. Ele não recebe percentual, marcador nem número de
  // comparação: apenas a explicação correta.
  if (input.corporateOnly) {
    const gap = buildGaugeGap({
      achieved,
      target: null,
      targetTerm: input.targetTerm,
      corporateOnly: true,
    })

    return {
      kind: 'neutral',
      attainment: null,
      percentLabel: NOT_APPLICABLE,
      marker: null,
      base: null,
      over: null,
      reference,
      achieved,
      effectiveTarget: null,
      comparison,
      gap,
      footer: {
        left: { term: 'Recorte', value: 'Corporativo' },
        right: { term: input.targetTerm, value: NOT_APPLICABLE },
      },
      accessibleText: `${input.indicator}: não se aplica ao recorte exclusivo do Corporativo. ${gap.accessibleLabel}.`,
    }
  }

  // Qualquer outra ausência de meta não afirma a causa: só informa que não há
  // objetivo válido para o recorte.
  if (effectiveTarget === null || effectiveTarget === 0) {
    const gap = buildGaugeGap({
      achieved,
      target: null,
      targetTerm: input.targetTerm,
      corporateOnly: false,
    })

    return {
      kind: 'neutral',
      attainment: null,
      percentLabel: NO_GOAL,
      marker: null,
      base: null,
      over: null,
      reference,
      achieved,
      effectiveTarget: null,
      comparison,
      gap,
      footer: {
        left: { term: 'Realizado', value: salesLabel(achieved) },
        right: { term: input.targetTerm, value: 'Sem objetivo definido' },
      },
      accessibleText: `${input.indicator}: sem meta definida para o recorte. Realizado ${salesLabel(
        achieved,
      )}, ${comparison.accessibleLabel}.`,
    }
  }

  // O atingimento é recalculado sobre a meta efetiva, não copiado do modelo.
  // É isso que faz o percentual, o rodapé e a distância fecharem entre si.
  const attainment = achieved / effectiveTarget
  const marker = gaugeRatio(attainment)
  const baseTo = gaugeRatio(Math.min(attainment, GAUGE_REFERENCE_ATTAINMENT))
  const gap = buildGaugeGap({
    achieved,
    target: effectiveTarget,
    targetTerm: input.targetTerm,
    corporateOnly: false,
  })

  return {
    kind: 'measured',
    attainment,
    percentLabel: formatPercent(attainment),
    marker,
    base: baseTo > 0 ? { from: 0, to: baseTo } : null,
    // Trecho de superação: existe apenas acima de 100%. É separado do primeiro
    // estágio porque a regra do indicador distingue atingir de superar, e não
    // porque o desenho o pinte de outra cor: no card os dois usam a cor do
    // indicador.
    over: attainment > GAUGE_REFERENCE_ATTAINMENT ? { from: reference, to: marker } : null,
    reference,
    achieved,
    effectiveTarget,
    comparison,
    gap,
    footer: {
      left: { term: 'Realizado', value: salesLabel(achieved) },
      right: { term: input.targetTerm, value: salesLabel(effectiveTarget) },
    },
    accessibleText: `${input.indicator}: ${formatPercent(attainment)} de atingimento, ${
      comparison.accessibleLabel
    }. ${gap.accessibleLabel}. Realizado ${salesLabel(achieved)} de uma ${input.targetTerm.toLowerCase()} de ${salesLabel(
      effectiveTarget,
    )}.`,
  }
}

/* -------------------------------------------------------------------------
   Geometria do semicírculo. Fica junto do modelo para poder ser testada sem
   renderizar o componente.

   O arco voltou a crescer, de raio 58 para 62. Como o SVG é escalado pela
   largura do card, cada unidade a mais aqui vira desenho maior em todas as
   resoluções, sem tocar no percentual central. O limite não foi o viewBox e sim
   a folga das pontas: acima de 62 o `150%`, agora maior, encostaria no traço.

   As três faixas verticais, de cima para baixo, são: rótulo `100%` e risco,
   arco com marcador e percentual central, e comparação. Elas não se encontram
   em nenhum atingimento.
------------------------------------------------------------------------- */

export const GAUGE_GEOMETRY = {
  centerX: 100,
  centerY: 84,
  radius: 62,
  trackWidth: 10,
  viewBox: '0 0 200 116',
  /** Linha de base do percentual central. */
  percentBaseline: 78,
  /** Linha de base da comparação, com folga clara em relação ao arco. */
  comparisonBaseline: 107,
  /** Linha de base dos limites 0% e 150%, ao lado das pontas do arco. */
  limitBaseline: 88,
  /** X do `0%`, ancorado pelo início do texto na borda esquerda do viewBox. */
  limitStartX: 2,
  /** X do `150%`, ancorado pelo fim do texto na borda direita do viewBox. */
  limitEndX: 198,
  /**
   * Quanto o risco de 100% entra na barra, medido da linha central do traço.
   * Igual à metade da espessura: ele começa na borda interna e atravessa.
   */
  referenceTickInset: 5,
  /**
   * Quanto o risco avança para fora da linha central do traço.
   *
   * Precisa passar do marcador do resultado, que tem raio 6,5 mais 1,2 de
   * contorno: é isso que mantém o risco visível quando o resultado é exatamente
   * 100% e o marcador cobre o ponto da escala.
   */
  referenceTickReach: 13,
  /**
   * Distância radial do rótulo `100%`, no topo do risco e livre do marcador.
   *
   * Caiu de 22 para 20 junto com o arco maior: o rótulo sai de um raio maior e,
   * mantido em 22, o texto encostaria na borda superior do viewBox.
   */
  referenceLabelOffset: 20,
} as const

/**
 * Aparência única da escala: risco de 100% e os três rótulos.
 *
 * Antes o `100%` usava peso 700 e o risco tinha 2,6 de espessura, enquanto
 * `0%` e `150%` ficavam em peso normal. O conjunto parecia mais escuro que os
 * limites, como se marcasse resultado em vez de escala. Com uma cor só, um peso
 * só e um risco fino, o 100% volta a ser reconhecido pela posição e pelo risco
 * que atravessa o arco, não por ser o texto mais pesado do desenho.
 *
 * A cor é o mesmo token do texto secundário, que já muda com o tema: escuro
 * sobre a superfície clara, claro sobre a escura. Nunca a cor do indicador,
 * porque escala não é resultado.
 */
export const GAUGE_SCALE = {
  color: 'var(--text-secondary)',
  fontSize: 10.5,
  fontWeight: 600,
  /** Espessura do risco radial de 100%. */
  tickWidth: 1.5,
} as const

/** Ponto do arco em uma posição normalizada, de 0 (esquerda) a 1 (direita). */
export function gaugePoint(ratio: number): { readonly x: number; readonly y: number } {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  const angle = Math.PI * (1 - clamped)
  return {
    x: GAUGE_GEOMETRY.centerX + GAUGE_GEOMETRY.radius * Math.cos(angle),
    y: GAUGE_GEOMETRY.centerY - GAUGE_GEOMETRY.radius * Math.sin(angle),
  }
}

/**
 * Ponto para rótulos, deslocado para fora do arco.
 *
 * É o que mantém o `100%` do checkpoint fora da faixa do arco, sem cobrir o
 * marcador quando o resultado fica próximo de 100%.
 */
export function gaugeLabelPoint(
  ratio: number,
  offset: number,
): { readonly x: number; readonly y: number } {
  const clamped = Math.min(Math.max(ratio, 0), 1)
  const angle = Math.PI * (1 - clamped)
  const radius = GAUGE_GEOMETRY.radius + offset
  return {
    x: GAUGE_GEOMETRY.centerX + radius * Math.cos(angle),
    y: GAUGE_GEOMETRY.centerY - radius * Math.sin(angle),
  }
}

/** Caminho SVG de um trecho do arco. Trecho vazio devolve string vazia. */
export function gaugeArcPath(from: number, to: number): string {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return ''
  const start = gaugePoint(from)
  const end = gaugePoint(to)
  const radius = GAUGE_GEOMETRY.radius
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}
