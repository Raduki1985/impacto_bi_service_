import { describe, expect, it } from 'vitest'

import { COMMERCIAL_MONTHS, monthKeyOf } from '../../../data/commercialCalendar'
import type {
  CommercialDataset,
  CommercialGoalsFilters,
  CommercialMonthKey,
  CommercialSale,
} from '../../../data/commercialTypes'
import { buildCommercialDataset, getCommercialDataset } from '../../../data/mockCommercialData'
import {
  CONSOLIDATED_MONTHLY_GOAL,
  CONSOLIDATED_MONTHLY_SUPER_GOAL,
  INTERNAL_SELLER_MONTHLY_GOAL,
  buildCommercialGoalsSnapshot,
  indexPartnersByCode,
  isCountedSale,
  resolveGoalBasis,
  resolveSaleCredit,
  superGoalFor,
  validateCommercialDataset,
} from './commercialGoalsModel'

/**
 * Testes das regras de meta do Comercial.
 *
 * A base mockada é a fonte dos números agregados: os volumes por vendedor e por
 * colaborador são fixtures explícitas, então os totais mensais são exatos e
 * podem ser afirmados. Regras que a base não exercita de propósito (contrato
 * ativo sem data de ativação, indicação inválida) são testadas com fatos
 * montados à mão.
 */

const dataset = getCommercialDataset()

const JULY: CommercialMonthKey = '2026-07'

/** Realizado da meta mês a mês: Vendas Internas + Colaboradores. */
const EXPECTED_GOAL_ACHIEVED = [712, 685, 760, 805, 742, 820, 795]

/** Realizado total mês a mês: o anterior mais o Corporativo. */
const EXPECTED_TOTAL_ACHIEVED = [773, 743, 826, 857, 805, 894, 883]

function filters(overrides: Partial<CommercialGoalsFilters> = {}): CommercialGoalsFilters {
  return { month: JULY, cityId: null, sellerIds: [], ...overrides }
}

function sale(overrides: Partial<CommercialSale> = {}): CommercialSale {
  return {
    id: 'VD-TESTE-1',
    creatorId: 'vnd-ana-maria',
    indicationCode: null,
    cityId: 'atibaia',
    channel: 'interno',
    status: 'ativa',
    createdAt: '2026-06-25',
    signedAt: '2026-06-28',
    activatedAt: '2026-07-03',
    ...overrides,
  }
}

/** Base mínima com os catálogos reais e apenas os fatos informados. */
function datasetWith(sales: readonly CommercialSale[]): CommercialDataset {
  return { ...dataset, sales }
}

/* -------------------------------------------------------------------------- */
/* Constantes de negócio                                                      */
/* -------------------------------------------------------------------------- */

describe('constantes de meta', () => {
  it('mantém a meta consolidada em 800 e a supermeta em 880', () => {
    expect(CONSOLIDATED_MONTHLY_GOAL).toBe(800)
    expect(CONSOLIDATED_MONTHLY_SUPER_GOAL).toBe(880)
  })

  it('calcula supermeta como 110% da meta, sem sujeira de ponto flutuante', () => {
    expect(superGoalFor(50)).toBe(55)
    expect(superGoalFor(100)).toBe(110)
    expect(superGoalFor(400)).toBe(440)
    expect(superGoalFor(800)).toBe(880)
  })

  it('mantém a meta individual do vendedor interno em 50', () => {
    expect(INTERNAL_SELLER_MONTHLY_GOAL).toBe(50)
  })
})

/* -------------------------------------------------------------------------- */
/* Contabilização da venda                                                    */
/* -------------------------------------------------------------------------- */

describe('contabilização da venda', () => {
  it('conta somente contrato ativo com data de ativação', () => {
    expect(isCountedSale(sale())).toBe(true)
  })

  it('não conta venda pendente', () => {
    expect(isCountedSale(sale({ status: 'pendente', activatedAt: null }))).toBe(false)
  })

  it('não conta venda assinada e ainda não ativa', () => {
    expect(isCountedSale(sale({ status: 'assinada', signedAt: '2026-07-02', activatedAt: null }))).toBe(
      false,
    )
  })

  it('não conta contrato ativo sem data de ativação', () => {
    expect(isCountedSale(sale({ activatedAt: null }))).toBe(false)
  })

  it('não conta status com data de ativação preenchida fora de ativo', () => {
    expect(isCountedSale(sale({ status: 'suspensa' }))).toBe(false)
    expect(isCountedSale(sale({ status: 'bloqueio-financeiro' }))).toBe(false)
    expect(isCountedSale(sale({ status: 'cancelada' }))).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Crédito da venda                                                           */
/* -------------------------------------------------------------------------- */

describe('crédito da venda', () => {
  const partnersByCode = indexPartnersByCode(dataset.partners)
  const validCode = dataset.partners[0].indicationCode

  it('credita ao criador quando não há indicação', () => {
    expect(resolveSaleCredit(sale(), partnersByCode)).toEqual({
      kind: 'seller',
      sellerId: 'vnd-ana-maria',
    })
  })

  it('credita ao colaborador quando a indicação é válida', () => {
    expect(resolveSaleCredit(sale({ indicationCode: validCode }), partnersByCode)).toEqual({
      kind: 'partner',
      partnerId: dataset.partners[0].id,
    })
  })

  it('não aceita silenciosamente um código de indicação inválido', () => {
    expect(resolveSaleCredit(sale({ indicationCode: 'IND-INEXISTENTE' }), partnersByCode)).toEqual({
      kind: 'unknown',
      indicationCode: 'IND-INEXISTENTE',
    })
  })
})

/* -------------------------------------------------------------------------- */
/* Base da meta                                                               */
/* -------------------------------------------------------------------------- */

describe('base da meta', () => {
  it('usa a meta empresarial fixa sem cidade e sem vendedor', () => {
    const basis = resolveGoalBasis(dataset.sellers, filters())

    expect(basis.scope).toBe('consolidado')
    expect(basis.goal).toBe(800)
    expect(basis.superGoal).toBe(880)
    expect(basis.eligibleInternalSellers).toHaveLength(15)
  })

  it('não reduz a meta consolidada para a soma das metas individuais', () => {
    const basis = resolveGoalBasis(dataset.sellers, filters())

    expect(basis.eligibleInternalSellers.length * INTERNAL_SELLER_MONTHLY_GOAL).toBe(750)
    expect(basis.goal).toBe(800)
  })

  it('calcula a meta local pela quantidade de vendedores internos da cidade', () => {
    const expected: Record<string, number> = {
      atibaia: 400,
      mairipora: 100,
      piracaia: 100,
      'bom-jesus-dos-perdoes': 100,
      joanopolis: 50,
    }

    for (const [cityId, goal] of Object.entries(expected)) {
      const basis = resolveGoalBasis(
        dataset.sellers,
        filters({ cityId: cityId as CommercialGoalsFilters['cityId'] }),
      )

      expect(basis.scope).toBe('cidade')
      expect(basis.goal).toBe(goal)
      expect(basis.superGoal).toBe(superGoalFor(goal))
    }
  })

  it('deixa Terra Preta sem meta local, por não ter vendedor interno', () => {
    const basis = resolveGoalBasis(dataset.sellers, filters({ cityId: 'terra-preta' }))

    expect(basis.scope).toBe('sem-meta')
    expect(basis.goal).toBeNull()
    expect(basis.superGoal).toBeNull()
  })

  it('dá meta 50 e supermeta 55 a um vendedor interno', () => {
    const basis = resolveGoalBasis(dataset.sellers, filters({ sellerIds: ['vnd-ana-maria'] }))

    expect(basis.goal).toBe(50)
    expect(basis.superGoal).toBe(55)
  })

  it('multiplica a meta pela quantidade de internos selecionados', () => {
    const basis = resolveGoalBasis(
      dataset.sellers,
      filters({ sellerIds: ['vnd-ana-maria', 'vnd-bruna-raquelini', 'vnd-dayane-ferreira'] }),
    )

    expect(basis.goal).toBe(150)
    expect(basis.superGoal).toBe(165)
  })

  it('não cria meta nem denominador zero para o Corporativo isolado', () => {
    const basis = resolveGoalBasis(dataset.sellers, filters({ sellerIds: ['vnd-arthur-lopes'] }))

    expect(basis.scope).toBe('sem-meta')
    expect(basis.goal).toBeNull()
    expect(basis.superGoal).toBeNull()
    expect(basis.selectedCorporateSellers).toHaveLength(1)
  })

  it('conta somente os internos quando a seleção mistura interno e Corporativo', () => {
    const basis = resolveGoalBasis(
      dataset.sellers,
      filters({ sellerIds: ['vnd-ana-maria', 'vnd-arthur-lopes', 'vnd-leticia-castro'] }),
    )

    expect(basis.goal).toBe(50)
    expect(basis.eligibleInternalSellers).toHaveLength(1)
    expect(basis.selectedCorporateSellers).toHaveLength(2)
  })

  it('aplica cidade e vendedor como interseção real', () => {
    const compatible = resolveGoalBasis(
      dataset.sellers,
      filters({ cityId: 'atibaia', sellerIds: ['vnd-ana-maria', 'vnd-dayane-ferreira'] }),
    )

    expect(compatible.goal).toBe(50)
    expect(compatible.incompatibleSelection).toBe(false)

    const incompatible = resolveGoalBasis(
      dataset.sellers,
      filters({ cityId: 'joanopolis', sellerIds: ['vnd-ana-maria'] }),
    )

    expect(incompatible.goal).toBeNull()
    expect(incompatible.incompatibleSelection).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Realizado sobre a base mockada                                             */
/* -------------------------------------------------------------------------- */

describe('realizado do mês selecionado', () => {
  const snapshot = buildCommercialGoalsSnapshot(dataset, filters())

  it('separa os dois numeradores em julho de 2026', () => {
    expect(snapshot.internalAchieved).toBe(731)
    expect(snapshot.partnerAchieved).toBe(64)
    expect(snapshot.corporateAchieved).toBe(88)
    expect(snapshot.goalAchieved).toBe(795)
    expect(snapshot.totalAchieved).toBe(883)
  })

  it('mantém o Corporativo fora do realizado da meta e dentro do realizado total', () => {
    expect(snapshot.goalAchieved).toBe(snapshot.internalAchieved + snapshot.partnerAchieved)
    expect(snapshot.totalAchieved).toBe(snapshot.goalAchieved + snapshot.corporateAchieved)
  })

  it('deixa a meta abaixo de 100% e a supermeta atingida em julho', () => {
    expect(snapshot.goal).toBe(800)
    expect(snapshot.superGoal).toBe(880)
    expect(snapshot.gapToGoal).toBe(5)
    expect(snapshot.surplusOverGoal).toBe(0)
    expect(snapshot.goalAttainment).toBeCloseTo(795 / 800, 10)
    expect(snapshot.superGoalAttainment).toBeCloseTo(883 / 880, 10)
    expect(snapshot.gapToSuperGoal).toBe(0)
  })

  it('classifica a equipe apenas entre atingiu e não atingiu', () => {
    expect(snapshot.attainedSellers).toHaveLength(7)
    expect(snapshot.notAttainedSellers).toHaveLength(8)
    expect(snapshot.attainedSellers.length + snapshot.notAttainedSellers.length).toBe(
      snapshot.eligibleInternalSellers.length,
    )
    expect(snapshot.attainedSellers.every((item) => item.activeSales >= 50)).toBe(true)
    expect(snapshot.notAttainedSellers.every((item) => item.activeSales < 50)).toBe(true)
  })

  it('não inclui Corporativo nem Colaboradores no resumo da equipe', () => {
    const ids = snapshot.eligibleInternalSellers.map((seller) => seller.id)

    expect(ids).not.toContain('vnd-arthur-lopes')
    expect(ids).not.toContain('vnd-leticia-castro')
    expect(snapshot.eligibleInternalSellers.every((seller) => seller.segment === 'interno')).toBe(true)
  })

  it('mede a participação dos Colaboradores no realizado da meta', () => {
    expect(snapshot.partnerShareOfGoalAchieved).toBeCloseTo(64 / 795, 10)
  })

  it('compara com o mês anterior e registra a queda', () => {
    expect(snapshot.previousMonth).toBe('2026-06')
    expect(snapshot.previousGoalAchieved).toBe(820)
    expect(snapshot.goalAchievedChange).toBe(-25)
    expect(snapshot.alerts.some((alert) => alert.id === 'queda-mes-anterior')).toBe(true)
  })

  it('produz alertas determinísticos para meta, supermeta, equipe e Corporativo', () => {
    const ids = snapshot.alerts.map((alert) => alert.id)

    expect(ids).toContain('meta-nao-atingida')
    expect(ids).toContain('supermeta-atingida')
    expect(ids).toContain('vendedores-na-meta')
    expect(ids).toContain('corporativo-supermeta')
  })

  it('acumula a evolução diária e o ritmo esperado por dias corridos', () => {
    expect(snapshot.daily).toHaveLength(31)

    const last = snapshot.daily[snapshot.daily.length - 1]

    expect(last.goalAchieved).toBe(795)
    expect(last.totalAchieved).toBe(883)
    expect(last.goalPace).toBe(800)
    expect(last.superGoalPace).toBe(880)

    const middle = snapshot.daily[14]

    expect(middle.goalPace).toBeCloseTo((800 * 15) / 31, 1)
    expect(middle.superGoalPace).toBeCloseTo((880 * 15) / 31, 1)
  })

  it('mantém o acumulado diário sempre crescente', () => {
    const values = snapshot.daily.map((point) => point.goalAchieved ?? 0)

    expect(values.every((value, index) => index === 0 || value >= values[index - 1])).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Histórico mensal                                                           */
/* -------------------------------------------------------------------------- */

describe('histórico mensal', () => {
  const snapshot = buildCommercialGoalsSnapshot(dataset, filters())

  it('mantém os sete meses do período, mesmo com um mês selecionado', () => {
    expect(snapshot.monthly).toHaveLength(7)
    expect(snapshot.monthly.map((point) => point.month)).toEqual([...COMMERCIAL_MONTHS])
    expect(snapshot.monthly.filter((point) => point.selected)).toHaveLength(1)
  })

  it('reproduz o realizado da meta e o realizado total de cada mês', () => {
    expect(snapshot.monthly.map((point) => point.goalAchieved)).toEqual(EXPECTED_GOAL_ACHIEVED)
    expect(snapshot.monthly.map((point) => point.totalAchieved)).toEqual(EXPECTED_TOTAL_ACHIEVED)
  })

  it('cobre os cenários de mês abaixo da meta, na meta e na supermeta', () => {
    const [january, , , april, , june] = snapshot.monthly

    expect(january.goalAchieved).toBeLessThan(800)
    expect(april.goalAchieved).toBeGreaterThanOrEqual(800)
    expect(april.totalAchieved).toBeLessThan(880)
    expect(june.goalAchieved).toBeGreaterThanOrEqual(800)
    expect(june.totalAchieved).toBeGreaterThanOrEqual(880)
  })
})

/* -------------------------------------------------------------------------- */
/* Filtros                                                                    */
/* -------------------------------------------------------------------------- */

describe('filtros', () => {
  it('responde ao filtro de cidade com meta local e realizado local', () => {
    const snapshot = buildCommercialGoalsSnapshot(dataset, filters({ cityId: 'atibaia' }))

    expect(snapshot.goal).toBe(400)
    expect(snapshot.superGoal).toBe(440)
    expect(snapshot.internalAchieved).toBe(390)
    expect(snapshot.partnerAchieved).toBe(31)
    expect(snapshot.goalAchieved).toBe(421)
    expect(snapshot.surplusOverGoal).toBe(21)
    expect(snapshot.gapToGoal).toBe(0)
    expect(snapshot.eligibleInternalSellers).toHaveLength(8)
  })

  it('mostra realizado e nenhuma meta em Terra Preta', () => {
    const snapshot = buildCommercialGoalsSnapshot(dataset, filters({ cityId: 'terra-preta' }))

    expect(snapshot.goal).toBeNull()
    expect(snapshot.superGoal).toBeNull()
    expect(snapshot.goalAttainment).toBeNull()
    expect(snapshot.superGoalAttainment).toBeNull()
    expect(snapshot.gapToGoal).toBeNull()
    expect(snapshot.eligibleInternalSellers).toHaveLength(0)
    expect(snapshot.partnerAchieved).toBe(4)
    expect(snapshot.hasResults).toBe(true)
  })

  it('avalia um vendedor interno contra a própria meta', () => {
    const attained = buildCommercialGoalsSnapshot(
      dataset,
      filters({ sellerIds: ['vnd-ana-maria'] }),
    )

    expect(attained.goal).toBe(50)
    expect(attained.goalAchieved).toBe(54)
    expect(attained.surplusOverGoal).toBe(4)
    expect(attained.gapToGoal).toBe(0)
    expect(attained.attainedSellers).toHaveLength(1)

    const missed = buildCommercialGoalsSnapshot(
      dataset,
      filters({ sellerIds: ['vnd-larissa-aparecida'] }),
    )

    expect(missed.goalAchieved).toBe(38)
    expect(missed.gapToGoal).toBe(12)
    expect(missed.notAttainedSellers).toHaveLength(1)
  })

  it('exclui as vendas de colaborador quando o filtro Vendedor está ativo', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      dataset,
      filters({ sellerIds: ['vnd-ana-maria'] }),
    )

    expect(snapshot.partnerAchieved).toBe(0)
    expect(snapshot.goalAchieved).toBe(snapshot.internalAchieved)
  })

  it('não compara o Corporativo isolado com meta nem produz percentual', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      dataset,
      filters({ sellerIds: ['vnd-arthur-lopes'] }),
    )

    expect(snapshot.goal).toBeNull()
    expect(snapshot.goalAttainment).toBeNull()
    expect(snapshot.superGoalAttainment).toBeNull()
    expect(snapshot.goalAchieved).toBe(0)
    expect(snapshot.corporateAchieved).toBe(48)
    expect(snapshot.totalAchieved).toBe(48)
    expect(snapshot.alerts.some((alert) => alert.id === 'sem-meta')).toBe(true)
  })

  it('soma o Corporativo apenas ao realizado total quando misturado com interno', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      dataset,
      filters({ sellerIds: ['vnd-ana-maria', 'vnd-arthur-lopes'] }),
    )

    expect(snapshot.goal).toBe(50)
    expect(snapshot.goalAchieved).toBe(54)
    expect(snapshot.corporateAchieved).toBe(48)
    expect(snapshot.totalAchieved).toBe(102)
  })

  it('devolve recorte vazio quando cidade e vendedor não se cruzam', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      dataset,
      filters({ cityId: 'joanopolis', sellerIds: ['vnd-ana-maria'] }),
    )

    expect(snapshot.incompatibleSelection).toBe(true)
    expect(snapshot.hasResults).toBe(false)
    expect(snapshot.goal).toBeNull()
    expect(snapshot.goalAchieved).toBe(0)
    expect(snapshot.alerts.some((alert) => alert.id === 'selecao-incompativel')).toBe(true)
  })

  it('mantém o histórico completo mesmo com filtros aplicados', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      dataset,
      filters({ cityId: 'atibaia', month: '2026-02' }),
    )

    expect(snapshot.monthly).toHaveLength(7)
    expect(snapshot.monthly.every((point) => point.goal === 400)).toBe(true)
    expect(snapshot.monthly.find((point) => point.selected)?.month).toBe('2026-02')
  })
})

/* -------------------------------------------------------------------------- */
/* Regras com fatos montados                                                  */
/* -------------------------------------------------------------------------- */

describe('regras aplicadas a fatos individuais', () => {
  it('atribui a venda pela data de ativação, e não pela criação', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      datasetWith([sale({ createdAt: '2026-06-20', signedAt: '2026-06-24', activatedAt: '2026-07-02' })]),
      filters(),
    )

    expect(snapshot.goalAchieved).toBe(1)
    expect(snapshot.daily[1].goalAchieved).toBe(1)
    expect(snapshot.monthly.find((point) => point.month === '2026-06')?.goalAchieved).toBe(0)
  })

  it('mantém fora do realizado a venda pendente e a assinada sem ativação', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      datasetWith([
        sale({ id: 'VD-A', status: 'pendente', signedAt: null, activatedAt: null }),
        sale({ id: 'VD-B', status: 'assinada', activatedAt: null }),
        sale({ id: 'VD-C' }),
      ]),
      filters(),
    )

    expect(snapshot.goalAchieved).toBe(1)
    expect(snapshot.totalAchieved).toBe(1)
  })

  it('credita ao colaborador a venda indicada, sem criar meta para ele', () => {
    const code = dataset.partners[0].indicationCode
    const snapshot = buildCommercialGoalsSnapshot(
      datasetWith([sale({ id: 'VD-IND', indicationCode: code })]),
      filters(),
    )

    expect(snapshot.partnerAchieved).toBe(1)
    expect(snapshot.internalAchieved).toBe(0)
    expect(snapshot.goalAchieved).toBe(1)
    expect(snapshot.goal).toBe(800)
    expect(snapshot.attainedSellers).toHaveLength(0)
  })

  it('descarta a venda com código de indicação inválido', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      datasetWith([sale({ id: 'VD-BAD', indicationCode: 'IND-INEXISTENTE' })]),
      filters(),
    )

    expect(snapshot.goalAchieved).toBe(0)
    expect(snapshot.totalAchieved).toBe(0)
  })

  it('nunca produz gap negativo, NaN ou divisão por zero', () => {
    const above = buildCommercialGoalsSnapshot(
      datasetWith(
        Array.from({ length: 60 }, (_unused, index) =>
          sale({ id: `VD-${index}`, creatorId: 'vnd-ana-maria' }),
        ),
      ),
      filters({ sellerIds: ['vnd-ana-maria'] }),
    )

    expect(above.gapToGoal).toBe(0)
    expect(above.surplusOverGoal).toBe(10)
    expect(above.goalAttainment).toBeCloseTo(60 / 50, 10)

    const empty = buildCommercialGoalsSnapshot(datasetWith([]), filters({ cityId: 'terra-preta' }))

    expect(empty.goalAttainment).toBeNull()
    expect(empty.partnerShareOfGoalAchieved).toBeNull()
    expect(Number.isNaN(empty.goalAchieved)).toBe(false)
    expect(empty.hasResults).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Concordância dos textos gerados                                            */
/* -------------------------------------------------------------------------- */

describe('concordância de número nos alertas e na leitura', () => {
  const alertById = (snapshot: ReturnType<typeof buildCommercialGoalsSnapshot>, id: string) =>
    snapshot.alerts.find((alert) => alert.id === id)

  it('usa singular no título quando há um único vendedor interno elegível', () => {
    const snapshot = buildCommercialGoalsSnapshot(dataset, filters({ cityId: 'joanopolis' }))

    expect(snapshot.eligibleInternalSellers).toHaveLength(1)
    expect(alertById(snapshot, 'vendedores-na-meta')?.title).toBe(
      '1 de 1 vendedor interno na meta',
    )
  })

  it('usa singular ao descrever um único vendedor abaixo da meta', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      dataset,
      filters({ sellerIds: ['vnd-larissa-aparecida'] }),
    )

    expect(alertById(snapshot, 'vendedores-na-meta')?.title).toBe(
      '0 de 1 vendedor interno na meta',
    )
    expect(alertById(snapshot, 'vendedores-na-meta')?.detail).toContain(
      '1 vendedor ficou abaixo dela',
    )
  })

  it('usa singular quando falta uma única venda para a meta', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      datasetWith(
        Array.from({ length: 49 }, (_unused, index) => sale({ id: `VD-${index}` })),
      ),
      filters({ sellerIds: ['vnd-ana-maria'] }),
    )

    expect(snapshot.gapToGoal).toBe(1)
    expect(alertById(snapshot, 'meta-nao-atingida')?.detail).toContain(
      'Falta 1 venda para a meta de 50.',
    )
    expect(snapshot.story.text).toContain('1 venda abaixo da meta de 50')
  })

  it('usa singular ao descrever uma única venda ativa do Corporativo', () => {
    const snapshot = buildCommercialGoalsSnapshot(
      datasetWith([sale({ id: 'VD-CORP', creatorId: 'vnd-arthur-lopes', channel: 'corporativo' })]),
      filters(),
    )

    expect(snapshot.corporateAchieved).toBe(1)
    expect(alertById(snapshot, 'corporativo-supermeta')?.detail).toContain(
      '1 venda ativa do Corporativo entrou no realizado total',
    )
    expect(snapshot.story.text).toContain('O Corporativo somou 1 venda ativa')
  })

  it('mantém o plural nas quantidades diferentes de 1', () => {
    const snapshot = buildCommercialGoalsSnapshot(dataset, filters())

    expect(alertById(snapshot, 'meta-nao-atingida')?.detail).toContain(
      'Faltam 5 vendas para a meta de 800.',
    )
    expect(alertById(snapshot, 'vendedores-na-meta')?.title).toBe(
      '7 de 15 vendedores internos na meta',
    )
    expect(alertById(snapshot, 'vendedores-na-meta')?.detail).toContain(
      '8 vendedores ficaram abaixo dela',
    )
    expect(alertById(snapshot, 'corporativo-supermeta')?.detail).toContain(
      '88 vendas ativas do Corporativo entraram no realizado total',
    )
    expect(snapshot.story.watch).toContain('caiu 25 vendas')
  })
})

/* -------------------------------------------------------------------------- */
/* Consistência e determinismo da base                                        */
/* -------------------------------------------------------------------------- */

describe('base mockada', () => {
  it('não tem inconsistência', () => {
    expect(validateCommercialDataset(dataset)).toEqual([])
  })

  it('reporta contrato ativo sem data de ativação e indicação desconhecida', () => {
    const issues = validateCommercialDataset(
      datasetWith([
        sale({ id: 'VD-1', activatedAt: null }),
        sale({ id: 'VD-2', indicationCode: 'IND-INEXISTENTE' }),
      ]),
    )

    expect(issues.map((issue) => issue.id).sort()).toEqual([
      'ativa-sem-ativacao',
      'indicacao-desconhecida',
    ])
  })

  it('tem granularidade individual, com identificador único por venda', () => {
    const counted = dataset.sales.filter(isCountedSale)

    // 5.781 vendas contabilizadas é a soma dos realizados totais dos sete meses.
    expect(counted).toHaveLength(EXPECTED_TOTAL_ACHIEVED.reduce((sum, value) => sum + value, 0))
    expect(dataset.sales.length).toBeGreaterThan(counted.length)
    expect(new Set(dataset.sales.map((item) => item.id)).size).toBe(dataset.sales.length)
  })

  it('cobre janeiro a julho de 2026 e nada fora disso', () => {
    const months = new Set(
      dataset.sales
        .filter((item) => item.activatedAt !== null)
        .map((item) => monthKeyOf(item.activatedAt as string)),
    )

    expect([...months].sort()).toEqual([...COMMERCIAL_MONTHS])
  })

  it('tem venda criada no mês anterior ao da ativação', () => {
    const crossMonth = dataset.sales.filter(
      (item) =>
        item.activatedAt !== null && monthKeyOf(item.createdAt) !== monthKeyOf(item.activatedAt),
    )

    expect(crossMonth.length).toBeGreaterThan(0)
  })

  it('tem venda não contabilizada de cada situação prevista', () => {
    const statuses = new Set(dataset.sales.map((item) => item.status))

    expect(statuses.has('pendente')).toBe(true)
    expect(statuses.has('assinada')).toBe(true)
    expect(statuses.has('agendada')).toBe(true)
    expect(statuses.has('suspensa')).toBe(true)
    expect(statuses.has('bloqueio-financeiro')).toBe(true)

    const activatedButNotActive = dataset.sales.filter(
      (item) => item.status !== 'ativa' && item.activatedAt !== null,
    )

    expect(activatedButNotActive.length).toBeGreaterThan(0)
  })

  it('não muda entre construções', () => {
    const first = buildCommercialDataset()
    const second = buildCommercialDataset()

    expect(first.sales.length).toBe(second.sales.length)
    expect(first.sales[0]).toEqual(second.sales[0])
    expect(first.sales[first.sales.length - 1]).toEqual(second.sales[second.sales.length - 1])

    const firstSnapshot = buildCommercialGoalsSnapshot(first, filters())
    const secondSnapshot = buildCommercialGoalsSnapshot(second, filters())

    expect(firstSnapshot.goalAchieved).toBe(secondSnapshot.goalAchieved)
    expect(firstSnapshot.totalAchieved).toBe(secondSnapshot.totalAchieved)
  })

  it('mantém os quinze vendedores internos e os dois corporativos', () => {
    const internal = dataset.sellers.filter((seller) => seller.segment === 'interno')
    const corporate = dataset.sellers.filter((seller) => seller.segment === 'corporativo')

    expect(internal).toHaveLength(15)
    expect(corporate.map((seller) => seller.name).sort()).toEqual([
      'Arthur Lopes',
      'Letícia Castro de Oliveira',
    ])
  })

  it('aloca Giovanna e Larissa em Atibaia e não cria Tanque nem Lucas como cidade', () => {
    const byName = new Map(dataset.sellers.map((seller) => [seller.name, seller]))

    expect(byName.get('Giovanna Bordin da Cunha')?.cityId).toBe('atibaia')
    expect(byName.get('Larissa Aparecida Almeida da Conceição')?.cityId).toBe('atibaia')

    const cityNames = dataset.cities.map((city) => city.name)

    expect(cityNames).not.toContain('Tanque')
    expect(cityNames).not.toContain('Lucas')
    expect(cityNames).toHaveLength(6)
  })
})
