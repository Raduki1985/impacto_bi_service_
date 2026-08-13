import { describe, expect, it } from 'vitest'

import {
  buildGaugeComparison,
  buildGaugeGap,
  buildOverviewGaugeModel,
  ceilSales,
  GAUGE_GEOMETRY,
  GAUGE_MAX_ATTAINMENT,
  GAUGE_SCALE,
  gaugeArcPath,
  gaugeLabelPoint,
  gaugePoint,
  gaugeRatio,
  type OverviewGaugeInput,
} from './overviewGaugeModel'

const meta = (overrides: Partial<OverviewGaugeInput> = {}): OverviewGaugeInput => ({
  indicator: 'Meta Comercial',
  targetTerm: 'Meta',
  achieved: 795,
  target: 800,
  previousAchieved: 770,
  corporateOnly: false,
  ...overrides,
})

const supermeta = (overrides: Partial<OverviewGaugeInput> = {}): OverviewGaugeInput => ({
  indicator: 'Supermeta Total',
  targetTerm: 'Supermeta',
  achieved: 883,
  target: 880,
  previousAchieved: 896,
  corporateOnly: false,
  ...overrides,
})

/** Nenhum texto do card pode conter fração de venda. */
function expectNoFractionalSales(text: string) {
  expect(text).not.toMatch(/\d+,\d+\s+vendas?/)
}

describe('overviewGauge: meta proporcional em vendas inteiras', () => {
  it('mantém a meta que já é inteira', () => {
    expect(ceilSales(794)).toBe(794)
    expect(ceilSales(800)).toBe(800)
    expect(ceilSales(0)).toBe(0)
  })

  it('arredonda para cima qualquer fração', () => {
    expect(ceilSales(794.1)).toBe(795)
    expect(ceilSales(794.9)).toBe(795)
    expect(ceilSales(794.001)).toBe(795)
  })

  it('devolve null para meta ausente ou inválida', () => {
    expect(ceilSales(null)).toBeNull()
    expect(ceilSales(undefined)).toBeNull()
    expect(ceilSales(Number.NaN)).toBeNull()
    expect(ceilSales(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('usa a meta efetiva inteira no percentual, na distância e no rodapé', () => {
    // 795 realizadas contra uma meta proporcional de 794,2 vira 795 de 795.
    const model = buildOverviewGaugeModel(meta({ achieved: 795, target: 794.2 }))

    expect(model.effectiveTarget).toBe(795)
    expect(model.attainment).toBe(1)
    expect(model.percentLabel).toBe('100,0%')
    expect(model.gap.value).toBe(0)
    expect(model.gap.label).toBe('Meta atingida')
    expect(model.footer.right.value).toBe('795 vendas')
  })

  it('não produz distância fracionada em nenhum texto do card', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 795, target: 794.2 }))

    expectNoFractionalSales(model.gap.label)
    expectNoFractionalSales(model.footer.left.value)
    expectNoFractionalSales(model.footer.right.value)
    expectNoFractionalSales(model.accessibleText)
    expect(model.gap.label).not.toContain('0,8')
    expect(model.gap.label).not.toContain('0,2')
  })

  it('mantém percentual, distância e rodapé coerentes com a mesma meta', () => {
    const casos = [794, 794.1, 794.9, 800, 812.4]

    casos.forEach((target) => {
      const model = buildOverviewGaugeModel(meta({ achieved: 795, target }))
      const efetiva = model.effectiveTarget as number

      expect(Number.isInteger(efetiva)).toBe(true)
      expect(model.attainment).toBe(795 / efetiva)
      expect(model.gap.value).toBe(795 - efetiva)
      expect(model.footer.right.value).toBe(`${efetiva} vendas`)
      expectNoFractionalSales(model.accessibleText)
    })
  })

  it('arredonda também o realizado, que nunca é fracionado', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 794.3, target: 800 }))

    expect(model.achieved).toBe(795)
    expect(model.footer.left.value).toBe('795 vendas')
  })
})

describe('overviewGauge: posição visual na escala de 0% a 150%', () => {
  it('mapeia 0%, 100% e 150% nos extremos e na referência', () => {
    expect(gaugeRatio(0)).toBe(0)
    expect(gaugeRatio(1)).toBeCloseTo(2 / 3, 10)
    expect(gaugeRatio(GAUGE_MAX_ATTAINMENT)).toBe(1)
  })

  it('limita apenas a posição visual, nunca o percentual real', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 1_600, target: 800 }))

    expect(model.marker).toBe(1)
    expect(model.attainment).toBe(2)
    expect(model.percentLabel).toBe('200,0%')
  })

  it('prende o marcador em zero quando nada foi realizado', () => {
    expect(gaugeRatio(-4)).toBe(0)
    const model = buildOverviewGaugeModel(meta({ achieved: 0, target: 800 }))

    expect(model.marker).toBe(0)
    expect(model.percentLabel).toBe('0,0%')
  })

  it('coloca a referência de 100% sempre em dois terços da escala', () => {
    expect(buildOverviewGaugeModel(meta()).reference).toBeCloseTo(2 / 3, 10)
    expect(buildOverviewGaugeModel(meta({ corporateOnly: true })).reference).toBeCloseTo(
      2 / 3,
      10,
    )
  })
})

describe('overviewGauge: estágios do arco', () => {
  it('desenha somente o primeiro estágio abaixo de 100%', () => {
    const model = buildOverviewGaugeModel(meta())

    expect(model.kind).toBe('measured')
    expect(model.over).toBeNull()
    expect(model.base).toEqual({ from: 0, to: gaugeRatio(795 / 800) })
  })

  it('acrescenta o trecho de superação acima de 100%', () => {
    const model = buildOverviewGaugeModel(supermeta())

    expect(model.base).toEqual({ from: 0, to: gaugeRatio(1) })
    expect(model.over?.from).toBeCloseTo(2 / 3, 10)
    expect(model.over?.to).toBeGreaterThan(2 / 3)
  })

  it('não cria trecho de superação no atingimento exato', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 800, target: 800 }))

    expect(model.over).toBeNull()
    expect(model.marker).toBeCloseTo(2 / 3, 10)
  })

  it('trava o fim da superação no limite da escala', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 8_000, target: 800 }))

    expect(model.over).toEqual({ from: 2 / 3, to: 1 })
  })
})

describe('overviewGauge: rodapé de três áreas', () => {
  it('usa Realizado à esquerda e Meta à direita no card da Meta', () => {
    const model = buildOverviewGaugeModel(meta())

    expect(model.footer.left).toEqual({ term: 'Realizado', value: '795 vendas' })
    expect(model.footer.right).toEqual({ term: 'Meta', value: '800 vendas' })
    expect(model.gap.label).toBe('Faltam 5 vendas')
    expect(model.gap.direction).toBe('down')
  })

  it('usa Realizado à esquerda e Supermeta à direita no card da Supermeta', () => {
    const model = buildOverviewGaugeModel(supermeta())

    expect(model.footer.left).toEqual({ term: 'Realizado', value: '883 vendas' })
    expect(model.footer.right).toEqual({ term: 'Supermeta', value: '880 vendas' })
    expect(model.gap.label).toBe('3 vendas acima')
    expect(model.gap.direction).toBe('up')
  })

  it('concorda em número quando há apenas uma venda', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 1, target: 1 }))

    expect(model.footer.left.value).toBe('1 venda')
    expect(model.footer.right.value).toBe('1 venda')
  })

  it('não repete o objetivo no centro, que já está no rótulo lateral', () => {
    const abaixo = buildOverviewGaugeModel(meta())
    const acima = buildOverviewGaugeModel(supermeta())

    expect(abaixo.gap.label).not.toContain('da meta')
    expect(acima.gap.label).not.toContain('da supermeta')
    // O rótulo lateral continua nomeando o objetivo do card.
    expect(abaixo.footer.right.term).toBe('Meta')
    expect(acima.footer.right.term).toBe('Supermeta')
  })
})

describe('overviewGauge: distância até o objetivo', () => {
  it('mostra vendas faltantes inteiras com triângulo para baixo', () => {
    const gap = buildGaugeGap({
      achieved: 795,
      target: 800,
      targetTerm: 'Meta',
      corporateOnly: false,
    })

    expect(gap.label).toBe('Faltam 5 vendas')
    expect(gap.accessibleLabel).toBe('Faltam 5 vendas para a meta')
    expect(gap.tone).toBe('negative')
    expect(gap.direction).toBe('down')
    expect(gap.value).toBe(-5)
    expect(gap.directionText).toBe('Abaixo da meta.')
  })

  it('usa o singular quando falta exatamente uma venda', () => {
    const gap = buildGaugeGap({
      achieved: 799,
      target: 800,
      targetTerm: 'Meta',
      corporateOnly: false,
    })

    expect(gap.label).toBe('Falta 1 venda')
    expect(gap.label).not.toBe('Faltam 1 vendas')
    expect(gap.accessibleLabel).toBe('Falta 1 venda para a meta')
    expect(gap.direction).toBe('down')
  })

  it('mostra vendas acima inteiras com triângulo para cima', () => {
    const gap = buildGaugeGap({
      achieved: 883,
      target: 880,
      targetTerm: 'Supermeta',
      corporateOnly: false,
    })

    expect(gap.label).toBe('3 vendas acima')
    expect(gap.accessibleLabel).toBe('3 vendas acima da supermeta')
    expect(gap.tone).toBe('positive')
    expect(gap.direction).toBe('up')
    expect(gap.value).toBe(3)
  })

  it('usa o singular quando existe exatamente uma venda acima', () => {
    const gap = buildGaugeGap({
      achieved: 881,
      target: 880,
      targetTerm: 'Supermeta',
      corporateOnly: false,
    })

    expect(gap.label).toBe('1 venda acima')
    expect(gap.label).not.toBe('1 vendas acima')
    expect(gap.accessibleLabel).toBe('1 venda acima da supermeta')
  })

  it('usa Meta atingida no empate exato, sem triângulo e sem zero', () => {
    const gap = buildGaugeGap({
      achieved: 800,
      target: 800,
      targetTerm: 'Meta',
      corporateOnly: false,
    })

    expect(gap.label).toBe('Meta atingida')
    expect(gap.label).not.toBe('0 vendas acima')
    expect(gap.direction).toBeNull()
    expect(gap.tone).toBe('positive')
    expect(gap.value).toBe(0)
  })

  it('usa Supermeta atingida no empate exato da Supermeta', () => {
    const gap = buildGaugeGap({
      achieved: 880,
      target: 880,
      targetTerm: 'Supermeta',
      corporateOnly: false,
    })

    expect(gap.label).toBe('Supermeta atingida')
    expect(gap.direction).toBeNull()
  })

  it('mantém os textos neutros completos, sem triângulo', () => {
    const corporativoMeta = buildGaugeGap({
      achieved: 0,
      target: null,
      targetTerm: 'Meta',
      corporateOnly: true,
    })
    const corporativoSuper = buildGaugeGap({
      achieved: 88,
      target: null,
      targetTerm: 'Supermeta',
      corporateOnly: true,
    })
    const semMeta = buildGaugeGap({
      achieved: 795,
      target: null,
      targetTerm: 'Meta',
      corporateOnly: false,
    })

    expect(corporativoMeta.label).toBe('Sem meta própria')
    expect(corporativoSuper.label).toBe('Indicador consolidado')
    expect(semMeta.label).toBe('Sem meta para o recorte')
    ;[corporativoMeta, corporativoSuper, semMeta].forEach((gap) => {
      expect(gap.direction).toBeNull()
      expect(gap.tone).toBe('neutral')
      expect(gap.value).toBeNull()
      expect(gap.accessibleLabel).toBe(gap.label)
    })
  })
})

describe('overviewGauge: comparação com o período anterior', () => {
  it('usa o realizado comercial atual e anterior na Meta Comercial', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 795, previousAchieved: 770 }))

    expect(model.comparison.tone).toBe('positive')
    expect(model.comparison.direction).toBe('up')
    expect(model.comparison.rate).toBeCloseTo((795 - 770) / 770, 10)
    expect(model.comparison.label).toBe('3,2% vs. p.p.')
  })

  it('usa o realizado total atual e anterior na Supermeta', () => {
    const model = buildOverviewGaugeModel(supermeta({ achieved: 883, previousAchieved: 896 }))

    expect(model.comparison.tone).toBe('negative')
    expect(model.comparison.direction).toBe('down')
    expect(model.comparison.label).toBe('1,5% vs. p.p.')
  })

  it('marca estabilidade sem triângulo', () => {
    const comparison = buildGaugeComparison({
      current: 800,
      previous: 800,
      corporateOnly: false,
    })

    expect(comparison.tone).toBe('neutral')
    expect(comparison.direction).toBeNull()
    expect(comparison.rate).toBe(0)
    expect(comparison.label).toBe('Estável vs. p.p.')
  })

  it('não inventa percentual sem base anterior nem com base zero', () => {
    ;[null, 0].forEach((previous) => {
      const comparison = buildGaugeComparison({ current: 795, previous, corporateOnly: false })

      expect(comparison.label).toBe('Sem período anterior')
      expect(comparison.direction).toBeNull()
      expect(comparison.rate).toBeNull()
    })
  })

  it('abrevia o período anterior apenas no texto visual', () => {
    const casos = [
      { current: 795, previous: 770 },
      { current: 883, previous: 896 },
      { current: 800, previous: 800 },
    ]

    casos.forEach((caso) => {
      const comparison = buildGaugeComparison({ ...caso, corporateOnly: false })

      expect(comparison.label).toContain('vs. p.p.')
      expect(comparison.label).not.toContain('período anterior')
      expect(comparison.accessibleLabel).toContain('período anterior')
      expect(comparison.accessibleLabel).not.toContain('p.p.')
    })
  })

  it('protege contra NaN e Infinity nos dois lados', () => {
    const casos: { current: number; previous: number | null }[] = [
      { current: Number.NaN, previous: 700 },
      { current: 700, previous: Number.NaN },
      { current: Number.POSITIVE_INFINITY, previous: 700 },
      { current: 700, previous: Number.POSITIVE_INFINITY },
    ]

    casos.forEach((caso) => {
      const comparison = buildGaugeComparison({ ...caso, corporateOnly: false })

      expect(comparison.rate).toBeNull()
      expect(comparison.label).toBe('Sem período anterior')
    })
  })

  it('não cria comparação no recorte exclusivo do Corporativo', () => {
    const comparison = buildGaugeComparison({ current: 88, previous: 70, corporateOnly: true })

    expect(comparison.tone).toBe('neutral')
    expect(comparison.direction).toBeNull()
    expect(comparison.rate).toBeNull()
    expect(comparison.label).toBe('Sem comparação neste recorte')
    expect(comparison.label).not.toMatch(/%/)
  })
})

describe('overviewGauge: direção da comparação para leitor de tela', () => {
  it('diz crescimento por extenso, sem depender do triângulo nem da cor', () => {
    const comparison = buildGaugeComparison({
      current: 795,
      previous: 770,
      corporateOnly: false,
    })

    expect(comparison.accessibleLabel).toBe(
      'crescimento de 3,2% em relação ao período anterior',
    )
  })

  it('diz queda por extenso', () => {
    const comparison = buildGaugeComparison({
      current: 883,
      previous: 896,
      corporateOnly: false,
    })

    expect(comparison.accessibleLabel).toBe('queda de 1,5% em relação ao período anterior')
  })

  it('diz estabilidade por extenso', () => {
    const comparison = buildGaugeComparison({
      current: 800,
      previous: 800,
      corporateOnly: false,
    })

    expect(comparison.accessibleLabel).toBe(
      'resultado estável em relação ao período anterior',
    )
  })

  it('diz a ausência de base anterior sem inventar percentual', () => {
    ;[null, 0].forEach((previous) => {
      const comparison = buildGaugeComparison({ current: 795, previous, corporateOnly: false })

      expect(comparison.accessibleLabel).toBe('sem período anterior comparável')
      expect(comparison.accessibleLabel).not.toMatch(/%/)
    })
  })

  it('leva a direção até o nome acessível do card', () => {
    const crescimento = buildOverviewGaugeModel(meta({ previousAchieved: 770 }))
    const queda = buildOverviewGaugeModel(supermeta({ previousAchieved: 896 }))

    expect(crescimento.accessibleText).toContain('crescimento de 3,2%')
    expect(queda.accessibleText).toContain('queda de 1,5%')
    // A abreviação é só do desenho: ela nunca chega ao leitor de tela.
    expect(crescimento.accessibleText).not.toContain('p.p.')
    expect(queda.accessibleText).not.toContain('p.p.')
  })
})

describe('overviewGauge: recorte exclusivo do Corporativo', () => {
  it('mostra Não se aplica e nenhum marcador nos dois cards', () => {
    const metaModel = buildOverviewGaugeModel(
      meta({ corporateOnly: true, target: null, achieved: 0 }),
    )
    const superModel = buildOverviewGaugeModel(
      supermeta({ corporateOnly: true, target: null }),
    )

    ;[metaModel, superModel].forEach((model) => {
      expect(model.kind).toBe('neutral')
      expect(model.percentLabel).toBe('Não se aplica')
      expect(model.marker).toBeNull()
      expect(model.base).toBeNull()
      expect(model.over).toBeNull()
      expect(model.attainment).toBeNull()
      expect(model.effectiveTarget).toBeNull()
    })
  })

  it('usa o rodapé neutro completo em cada card', () => {
    const metaModel = buildOverviewGaugeModel(meta({ corporateOnly: true, target: null }))
    const superModel = buildOverviewGaugeModel(
      supermeta({ corporateOnly: true, target: null }),
    )

    expect(metaModel.footer.left).toEqual({ term: 'Recorte', value: 'Corporativo' })
    expect(metaModel.gap.label).toBe('Sem meta própria')
    expect(metaModel.footer.right).toEqual({ term: 'Meta', value: 'Não se aplica' })

    expect(superModel.gap.label).toBe('Indicador consolidado')
    expect(superModel.footer.right).toEqual({ term: 'Supermeta', value: 'Não se aplica' })
  })

  it('explica o motivo no nome acessível, sem percentual', () => {
    const model = buildOverviewGaugeModel(meta({ corporateOnly: true, target: null }))

    expect(model.accessibleText).toContain('não se aplica ao recorte exclusivo do Corporativo')
    expect(model.accessibleText).not.toMatch(/%/)
    expectNoFractionalSales(model.accessibleText)
  })

  it('ignora qualquer meta recebida no recorte Corporativo', () => {
    const model = buildOverviewGaugeModel(meta({ corporateOnly: true, target: 800 }))

    expect(model.kind).toBe('neutral')
    expect(model.percentLabel).toBe('Não se aplica')
    expect(model.effectiveTarget).toBeNull()
  })
})

describe('overviewGauge: meta ausente por outro motivo', () => {
  it('não afirma a causa quando a meta é nula fora do recorte Corporativo', () => {
    const model = buildOverviewGaugeModel(meta({ target: null }))

    expect(model.kind).toBe('neutral')
    expect(model.percentLabel).toBe('Sem meta')
    expect(model.accessibleText).toContain('sem meta definida para o recorte')
    expect(model.accessibleText).not.toContain('Corporativo')
    expect(model.footer.right).toEqual({ term: 'Meta', value: 'Sem objetivo definido' })
  })

  it('protege contra meta zero, sem divisão por zero nem NaN', () => {
    const model = buildOverviewGaugeModel(meta({ target: 0, achieved: 0 }))

    expect(model.kind).toBe('neutral')
    expect(model.marker).toBeNull()
    expect(model.percentLabel).toBe('Sem meta')
    expect(model.footer.left).toEqual({ term: 'Realizado', value: '0 vendas' })
  })

  it('protege contra NaN e Infinity na meta', () => {
    ;[Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY].forEach((target) => {
      const model = buildOverviewGaugeModel(meta({ target }))

      expect(model.kind).toBe('neutral')
      expect(model.marker).toBeNull()
      expect(model.percentLabel).not.toContain('NaN')
      expect(model.percentLabel).not.toContain('Infinity')
    })
  })

  it('nunca produz NaN em posição alguma do modelo', () => {
    const inputs: OverviewGaugeInput[] = [
      meta(),
      supermeta(),
      meta({ achieved: 0 }),
      meta({ target: null }),
      meta({ corporateOnly: true, target: null }),
      meta({ achieved: 9_600 }),
      meta({ target: 794.2 }),
    ]

    inputs.forEach((input) => {
      const model = buildOverviewGaugeModel(input)
      const numbers = [model.marker, model.base?.to, model.over?.to, model.reference]

      numbers.forEach((value) => {
        if (value !== null && value !== undefined) expect(Number.isFinite(value)).toBe(true)
      })
      expect(model.percentLabel).not.toContain('NaN')
      expectNoFractionalSales(model.accessibleText)
    })
  })
})

describe('overviewGauge: texto acessível completo', () => {
  it('informa percentual, comparação, distância, realizado e objetivo', () => {
    const model = buildOverviewGaugeModel(meta())

    expect(model.accessibleText).toBe(
      'Meta Comercial: 99,4% de atingimento, crescimento de 3,2% em relação ao período anterior. Faltam 5 vendas para a meta. Realizado 795 vendas de uma meta de 800 vendas.',
    )
  })

  it('informa a superação da Supermeta com o mesmo formato', () => {
    const model = buildOverviewGaugeModel(supermeta())

    expect(model.accessibleText).toContain('100,3% de atingimento')
    expect(model.accessibleText).toContain('queda de 1,5% em relação ao período anterior')
    expect(model.accessibleText).toContain('3 vendas acima da supermeta')
    expect(model.accessibleText).toContain('Realizado 883 vendas')
    expect(model.accessibleText).toContain('supermeta de 880 vendas')
  })
})

/** Limites do desenho, lidos do próprio `viewBox`. */
const [, , VIEW_WIDTH, VIEW_HEIGHT] = GAUGE_GEOMETRY.viewBox.split(' ').map(Number)

/** Raio do marcador do resultado somado à metade do contorno, como no SVG. */
const MARKER_OUTER_RADIUS = 6.5 + 2.4 / 2

/**
 * Avanço aproximado de um texto, em múltiplos do corpo da fonte.
 *
 * Não é métrica exata de fonte, e não precisa ser: serve para provar que os
 * rótulos da escala têm folga sobrando junto ao arco, não para posicioná-los.
 * Os valores são generosos de propósito, para o teste falhar antes da tela.
 */
const GLYPH_ADVANCE = { '0%': 1.6, '150%': 2.7 } as const

/** Altura aproximada das maiúsculas, acima da linha de base. */
const CAP_HEIGHT_RATIO = 0.75

describe('overviewGauge: geometria e checkpoint de 100%', () => {
  it('mantém o arco maior inteiramente dentro do viewBox', () => {
    const { centerX, centerY, radius, trackWidth } = GAUGE_GEOMETRY
    const half = trackWidth / 2

    // O arco cresceu de 58 para 62: a borda externa do traço continua dentro do
    // desenho nas três direções que ele ocupa.
    expect(radius).toBeGreaterThan(58)
    expect(centerX - radius - half).toBeGreaterThan(0)
    expect(centerX + radius + half).toBeLessThan(VIEW_WIDTH)
    expect(centerY - radius - half).toBeGreaterThan(0)
  })

  it('usa a mesma aparência no risco de 100% e nos três rótulos da escala', () => {
    // Uma fonte só para risco, `0%`, `100%` e `150%`: é isso que impede o 100%
    // de voltar a parecer mais escuro que os limites.
    expect(GAUGE_SCALE.color).toBe('var(--text-secondary)')
    expect(GAUGE_SCALE.fontWeight).toBeLessThan(700)
    // O risco é referência de escala, não um segundo arco: bem mais fino que o
    // traço e mais fino que os 2,6 que ele tinha antes.
    expect(GAUGE_SCALE.tickWidth).toBeLessThan(2)
    expect(GAUGE_SCALE.tickWidth).toBeLessThan(GAUGE_GEOMETRY.trackWidth / 4)
  })

  it('deixa os limites 0% e 150% fora das pontas do arco', () => {
    const { centerX, limitEndX, limitStartX, radius, trackWidth } = GAUGE_GEOMETRY
    const half = trackWidth / 2
    // As pontas usam `strokeLinecap="round"`: o traço termina em um semicírculo
    // de meia espessura além do ponto do arco.
    const leftCap = centerX - radius - half
    const rightCap = centerX + radius + half

    expect(limitStartX + GAUGE_SCALE.fontSize * GLYPH_ADVANCE['0%']).toBeLessThan(leftCap)
    expect(limitEndX - GAUGE_SCALE.fontSize * GLYPH_ADVANCE['150%']).toBeGreaterThan(rightCap)
    // E dentro do desenho, dos dois lados.
    expect(limitStartX).toBeGreaterThan(0)
    expect(limitEndX).toBeLessThan(VIEW_WIDTH)
  })

  it('vai da esquerda ao topo e à direita do arco', () => {
    const { centerX, centerY, radius } = GAUGE_GEOMETRY

    expect(gaugePoint(0).x).toBeCloseTo(centerX - radius, 6)
    expect(gaugePoint(0).y).toBeCloseTo(centerY, 6)
    expect(gaugePoint(0.5).y).toBeCloseTo(centerY - radius, 6)
    expect(gaugePoint(1).x).toBeCloseTo(centerX + radius, 6)
  })

  it('limita a geometria à faixa visual', () => {
    expect(gaugePoint(-3)).toEqual(gaugePoint(0))
    expect(gaugePoint(7)).toEqual(gaugePoint(1))
  })

  it('devolve caminho vazio para trecho sem extensão', () => {
    const { radius } = GAUGE_GEOMETRY

    expect(gaugeArcPath(0.4, 0.4)).toBe('')
    expect(gaugeArcPath(0.8, 0.2)).toBe('')
    expect(gaugeArcPath(Number.NaN, 1)).toBe('')
    expect(gaugeArcPath(0, 1)).toMatch(
      new RegExp(`^M .+ A ${radius} ${radius} 0 0 1 .+$`),
    )
  })

  it('desenha o risco de 100% na direção radial, atravessando a barra', () => {
    const { referenceTickInset, referenceTickReach, trackWidth } = GAUGE_GEOMETRY
    const reference = buildOverviewGaugeModel(meta()).reference
    const start = gaugeLabelPoint(reference, -referenceTickInset)
    const end = gaugeLabelPoint(reference, referenceTickReach)
    const onArc = gaugePoint(reference)

    // Começa dentro da barra e termina fora dela: é um risco radial, não uma
    // linha vertical solta sobre o desenho.
    expect(referenceTickInset).toBe(trackWidth / 2)
    expect(Math.hypot(start.x - onArc.x, start.y - onArc.y)).toBeCloseTo(
      referenceTickInset,
      6,
    )
    expect(Math.hypot(end.x - onArc.x, end.y - onArc.y)).toBeCloseTo(referenceTickReach, 6)
    // Sobe e avança para a direita, como manda o ponto de 100% na escala.
    expect(end.y).toBeLessThan(start.y)
    expect(end.x).toBeGreaterThan(start.x)
  })

  it('mantém o risco visível quando o resultado é exatamente 100%', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 800, target: 800 }))
    const marker = gaugePoint(model.marker as number)
    const onArc = gaugePoint(model.reference)
    const end = gaugeLabelPoint(model.reference, GAUGE_GEOMETRY.referenceTickReach)

    // O marcador fica exatamente sobre o ponto de 100%, mas o risco avança além
    // do contorno dele e continua aparecendo.
    expect(marker).toEqual(onArc)
    expect(Math.hypot(end.x - marker.x, end.y - marker.y)).toBeGreaterThan(
      MARKER_OUTER_RADIUS + 3,
    )
  })

  it('posiciona o rótulo de 100% no topo do risco e dentro do desenho', () => {
    const { referenceLabelOffset, referenceTickReach } = GAUGE_GEOMETRY
    const label = gaugeLabelPoint(2 / 3, referenceLabelOffset)
    const end = gaugeLabelPoint(2 / 3, referenceTickReach)
    const onArc = gaugePoint(2 / 3)

    // Afastado do arco, acima da ponta do risco e centralizado sobre ele.
    expect(referenceLabelOffset).toBeGreaterThan(referenceTickReach)
    expect(label.y).toBeLessThan(end.y)
    expect(label.y).toBeLessThan(onArc.y)
    expect(label.x).toBeGreaterThan(onArc.x)
    // Sem encostar no limite do SVG, com folga para a altura do texto.
    expect(label.x).toBeGreaterThan(0)
    expect(label.x).toBeLessThan(VIEW_WIDTH)
    expect(label.y - GAUGE_SCALE.fontSize * CAP_HEIGHT_RATIO).toBeGreaterThan(0)
    expect(label.y).toBeLessThan(VIEW_HEIGHT)
  })

  it('não é encoberto pelo marcador quando o resultado fica em 100%', () => {
    const model = buildOverviewGaugeModel(meta({ achieved: 800, target: 800 }))
    const marker = gaugePoint(model.marker as number)
    const label = gaugeLabelPoint(model.reference, GAUGE_GEOMETRY.referenceLabelOffset)

    expect(Math.hypot(label.x - marker.x, label.y - marker.y)).toBeGreaterThan(
      MARKER_OUTER_RADIUS,
    )
  })

  it('mantém o percentual e a comparação em faixas separadas do desenho', () => {
    const { centerY, comparisonBaseline, percentBaseline, trackWidth } = GAUGE_GEOMETRY

    // A comparação fica abaixo do percentual, e ambos acima do fim do viewBox.
    expect(comparisonBaseline).toBeGreaterThan(percentBaseline)
    expect(comparisonBaseline).toBeLessThan(VIEW_HEIGHT)
    // A comparação também fica abaixo da base do arco, livre do traço.
    expect(comparisonBaseline).toBeGreaterThan(centerY + trackWidth / 2)
  })

  it('dá folga vertical entre o desenho e a comparação', () => {
    const { centerY, comparisonBaseline, limitBaseline, trackWidth } = GAUGE_GEOMETRY
    // Base do arco somada ao contorno do marcador: o ponto mais baixo do desenho.
    const drawingBottom = centerY + Math.max(trackWidth / 2, MARKER_OUTER_RADIUS)
    // A comparação usa fonte 13,5; o topo do texto fica cerca de 10 acima da
    // linha de base, e o rabo do `p` de `p.p.` fica cerca de 4 abaixo dela.
    const comparisonTop = comparisonBaseline - 10
    const comparisonBottom = comparisonBaseline + 4

    expect(comparisonTop - drawingBottom).toBeGreaterThan(5)
    expect(comparisonTop).toBeGreaterThan(limitBaseline)
    expect(comparisonBottom).toBeLessThan(VIEW_HEIGHT)
  })
})
