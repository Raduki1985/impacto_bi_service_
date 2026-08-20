import { describe, expect, it } from 'vitest'

import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  COMMERCIAL_INSTALLATION_BASE_PRICE,
  COMMERCIAL_INSTALLATION_SERVICE_CODE,
  commercialInstallationOf,
} from '../../../data/mockCommercialInstallations'
import {
  ACTIVE_SALES_PAGE_SIZE,
  buildActiveSalesPage,
  buildActiveSalesSnapshot,
  classifyCommercialInstallation,
  initialActiveSalesFilters,
  salesPeriodOriginOf,
  type ActiveSalesFilters,
} from './salesPeriodModel'

const dataset = getCommercialDataset()
const salesById = new Map(dataset.sales.map((sale) => [sale.id, sale]))

function snapshotOf(overrides: Partial<ActiveSalesFilters> = {}) {
  return buildActiveSalesSnapshot(dataset, { ...initialActiveSalesFilters(), ...overrides })
}

const JULY = { periodStart: '2026-07-01', periodEnd: '2026-07-31' } as const
const JUNE = { periodStart: '2026-06-01', periodEnd: '2026-06-30' } as const

describe('regra temporal: somente vendas ativas iniciadas no período', () => {
  it('conta exatamente as vendas ativas com Data de Início dentro do recorte', () => {
    const snapshot = snapshotOf()
    const expected = dataset.sales.filter(
      (sale) =>
        sale.status === 'ativa' &&
        sale.activatedAt !== null &&
        sale.activatedAt >= JULY.periodStart &&
        sale.activatedAt <= JULY.periodEnd,
    )

    expect(snapshot.filters.periodStart).toBe(JULY.periodStart)
    expect(snapshot.filters.periodEnd).toBe(JULY.periodEnd)
    expect(snapshot.rows).toHaveLength(expected.length)
    // Julho de 2026 tem 883 vendas ativas na base, o mesmo realizado total que
    // Metas e Desempenho apura para o mês.
    expect(snapshot.metrics.activeSales).toBe(883)
  })

  it('mantém todas as linhas com status atual Ativa e Data de Início no período', () => {
    const snapshot = snapshotOf()

    expect(snapshot.rows.length).toBeGreaterThan(0)
    snapshot.rows.forEach((row) => {
      expect(row.status).toBe('ativa')
      expect(row.startDate >= JULY.periodStart).toBe(true)
      expect(row.startDate <= JULY.periodEnd).toBe(true)
      // A Data de Início vem do único campo de data da base mockada.
      expect(row.startDate).toBe(salesById.get(row.id)?.activatedAt)
    })
  })

  it('não usa a criação como substituta da Data de Início', () => {
    const juneIds = new Set(snapshotOf(JUNE).rows.map((row) => row.id))
    const startedInJulyCreatedInJune = dataset.sales.filter(
      (sale) =>
        sale.status === 'ativa' &&
        sale.activatedAt !== null &&
        sale.activatedAt >= JULY.periodStart &&
        sale.createdAt >= JUNE.periodStart &&
        sale.createdAt <= JUNE.periodEnd,
    )

    expect(startedInJulyCreatedInJune.length).toBeGreaterThan(0)
    expect(startedInJulyCreatedInJune.some((sale) => juneIds.has(sale.id))).toBe(false)
  })

  it('não usa a assinatura como substituta da Data de Início', () => {
    const ids = new Set(snapshotOf().rows.map((row) => row.id))
    const signedWithoutStart = dataset.sales.filter(
      (sale) =>
        sale.activatedAt === null &&
        sale.signedAt !== null &&
        sale.signedAt >= JULY.periodStart &&
        sale.signedAt <= JULY.periodEnd,
    )

    expect(signedWithoutStart.length).toBeGreaterThan(0)
    expect(signedWithoutStart.some((sale) => ids.has(sale.id))).toBe(false)
  })

  it('descarta contrato com data de início e status atual diferente de Ativa', () => {
    const ids = new Set(snapshotOf().rows.map((row) => row.id))
    const startedButNotActive = dataset.sales.filter(
      (sale) =>
        sale.status !== 'ativa' &&
        sale.activatedAt !== null &&
        sale.activatedAt >= JULY.periodStart &&
        sale.activatedAt <= JULY.periodEnd,
    )

    expect(startedButNotActive.length).toBeGreaterThan(0)
    expect(startedButNotActive.some((sale) => ids.has(sale.id))).toBe(false)
  })
})

describe('indicadores do recorte', () => {
  it('deriva valor mensal contratado e ticket médio das próprias linhas', () => {
    const snapshot = snapshotOf()
    const total = snapshot.rows.reduce((sum, row) => sum + row.monthlyValue, 0)

    expect(snapshot.metrics.monthlyContractedValue).toBeCloseTo(total, 6)
    expect(snapshot.metrics.averageTicket).toBeCloseTo(total / snapshot.rows.length, 6)
  })

  it('compara o mês fechado com o mês fechado anterior', () => {
    const snapshot = snapshotOf()
    const june = snapshotOf(JUNE)

    expect(snapshot.metrics.previousActiveSales).toBe(june.metrics.activeSales)
    expect(snapshot.metrics.activeSalesChangeRate).toBeCloseTo(
      (snapshot.metrics.activeSales - june.metrics.activeSales) / june.metrics.activeSales,
      6,
    )
  })

  it('compara intervalo livre com a mesma quantidade de dias anteriores', () => {
    const snapshot = snapshotOf({ periodStart: '2026-07-01', periodEnd: '2026-07-10' })
    const previous = snapshotOf({ periodStart: '2026-06-21', periodEnd: '2026-06-30' })

    expect(snapshot.daily).toHaveLength(10)
    expect(snapshot.metrics.previousActiveSales).toBe(previous.metrics.activeSales)
  })

  it('não inventa comparação sem período anterior completo na base', () => {
    const snapshot = snapshotOf({ periodStart: '2026-01-01', periodEnd: '2026-01-31' })

    expect(snapshot.metrics.previousActiveSales).toBeNull()
    expect(snapshot.metrics.activeSalesChangeRate).toBeNull()
    expect(snapshot.metrics.monthlyContractedValueChangeRate).toBeNull()
    expect(snapshot.metrics.averageTicketChangeRate).toBeNull()
  })
})

describe('origem das vendas', () => {
  it('classifica pela presença do código de indicação, com precedência da indicação', () => {
    const snapshot = snapshotOf()

    snapshot.rows.forEach((row) => {
      const sale = salesById.get(row.id)
      const indicated = sale?.indicationCode !== null && sale?.indicationCode !== undefined

      expect(row.origin).toBe(indicated ? 'indicacao' : 'vendedores')
      // A venda indicada continua tendo vendedora responsável: é justamente
      // por isso que a indicação precisa ter precedência.
      expect(row.sellerId).toBe(sale?.creatorId)
      expect(row.sellerName.length).toBeGreaterThan(0)
    })
  })

  it('trata código de indicação vazio como venda de vendedor', () => {
    expect(salesPeriodOriginOf(null)).toBe('vendedores')
    expect(salesPeriodOriginOf('')).toBe('vendedores')
    expect(salesPeriodOriginOf('   ')).toBe('vendedores')
    expect(salesPeriodOriginOf('000.000.001-00')).toBe('indicacao')
  })

  it('soma as duas origens exatamente no total de vendas ativas do recorte', () => {
    const snapshot = snapshotOf()
    const indicated = snapshot.origins.find((slice) => slice.origin === 'indicacao')
    const sellers = snapshot.origins.find((slice) => slice.origin === 'vendedores')

    expect(indicated?.activeSales).toBe(64)
    expect(sellers?.activeSales).toBe(819)
    expect((indicated?.activeSales ?? 0) + (sellers?.activeSales ?? 0)).toBe(
      snapshot.metrics.activeSales,
    )
    expect((indicated?.share ?? 0) + (sellers?.share ?? 0)).toBeCloseTo(1, 6)
    expect(
      (indicated?.monthlyContractedValue ?? 0) + (sellers?.monthlyContractedValue ?? 0),
    ).toBeCloseTo(snapshot.metrics.monthlyContractedValue, 6)
  })

  it('não coloca nenhuma venda nas duas origens', () => {
    const indicated = snapshotOf({ origin: 'indicacao' })
    const sellers = snapshotOf({ origin: 'vendedores' })
    const indicatedIds = new Set(indicated.rows.map((row) => row.id))
    const sellerIds = new Set(sellers.rows.map((row) => row.id))

    expect(sellers.rows.some((row) => indicatedIds.has(row.id))).toBe(false)
    expect(indicated.rows.every((row) => row.origin === 'indicacao')).toBe(true)
    expect(sellers.rows.every((row) => row.origin === 'vendedores')).toBe(true)
    expect(indicatedIds.size + sellerIds.size).toBe(snapshotOf().metrics.activeSales)
  })
})

describe('filtros do bloco', () => {
  it('filtra pela cidade de instalação', () => {
    const snapshot = snapshotOf({ cityId: 'piracaia' })

    expect(snapshot.rows.length).toBeGreaterThan(0)
    expect(snapshot.rows.every((row) => row.cityId === 'piracaia')).toBe(true)
    expect(snapshot.rows.every((row) => row.cityName === 'Piracaia')).toBe(true)
  })

  it('filtra por vendedor sem inferir equipe ou segmento pelo nome', () => {
    const sellerId = 'vnd-ana-maria'
    const snapshot = snapshotOf({ sellerId })

    expect(snapshot.rows.length).toBeGreaterThan(0)
    expect(snapshot.rows.every((row) => row.sellerId === sellerId)).toBe(true)
  })

  it('filtra por plano', () => {
    const planName = snapshotOf().options.plans[0]
    const snapshot = snapshotOf({ planName })

    expect(snapshot.rows.length).toBeGreaterThan(0)
    expect(snapshot.rows.every((row) => row.planName === planName)).toBe(true)
  })

  it('combina os filtros como interseção', () => {
    const combined = snapshotOf({ cityId: 'atibaia', origin: 'indicacao' })
    const city = snapshotOf({ cityId: 'atibaia' })

    expect(combined.rows.length).toBeGreaterThan(0)
    expect(combined.rows.length).toBeLessThan(city.rows.length)
    expect(
      combined.rows.every((row) => row.cityId === 'atibaia' && row.origin === 'indicacao'),
    ).toBe(true)
  })

  it('devolve recorte vazio, e não erro, quando nada corresponde', () => {
    // Venda indicada é sempre do canal interno na base mockada, então nunca
    // recebe um plano corporativo: o cruzamento não tem nenhuma venda.
    const snapshot = snapshotOf({ origin: 'indicacao', planName: 'Link Corporativo' })

    expect(snapshot.rows).toHaveLength(0)
    expect(snapshot.metrics.activeSales).toBe(0)
    expect(snapshot.metrics.monthlyContractedValue).toBe(0)
    expect(snapshot.metrics.averageTicket).toBe(0)
    expect(snapshot.origins.every((slice) => slice.activeSales === 0 && slice.share === 0)).toBe(
      true,
    )
  })

  it('mantém as opções de vendedor e plano estáveis, fora do recorte atual', () => {
    const full = snapshotOf().options
    const filtered = snapshotOf({ cityId: 'terra-preta', origin: 'indicacao' }).options

    expect(full.sellers.length).toBeGreaterThan(1)
    expect(filtered.sellers).toEqual(full.sellers)
    expect(filtered.plans).toEqual(full.plans)
    expect([...full.plans]).toEqual([...full.plans].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    expect(full.sellers.map((seller) => seller.name)).toEqual(
      [...full.sellers.map((seller) => seller.name)].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    )
  })
})

describe('ordenação e evolução diária', () => {
  it('ordena por Data de Início decrescente com desempate estável', () => {
    const rows = snapshotOf().rows

    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1]
      const current = rows[index]

      expect(previous.startDate >= current.startDate).toBe(true)
      if (previous.startDate === current.startDate) {
        expect(previous.id > current.id).toBe(true)
      }
    }
  })

  it('distribui a evolução pela Data de Início, fechando com os indicadores', () => {
    const snapshot = snapshotOf()
    const daily = snapshot.daily

    expect(daily).toHaveLength(31)
    expect(daily.reduce((sum, point) => sum + point.activeSales, 0)).toBe(
      snapshot.metrics.activeSales,
    )
    expect(daily.reduce((sum, point) => sum + point.monthlyContractedValue, 0)).toBeCloseTo(
      snapshot.metrics.monthlyContractedValue,
      6,
    )
    daily.forEach((point) => {
      const sameDay = snapshot.rows.filter((row) => row.startDate === point.date)
      expect(point.activeSales).toBe(sameDay.length)
    })
  })
})

describe('paginação da tabela', () => {
  const rows = snapshotOf().rows

  it('mantém o tamanho de página e cobre todos os registros filtrados', () => {
    const totalPages = Math.ceil(rows.length / ACTIVE_SALES_PAGE_SIZE)
    const first = buildActiveSalesPage(rows, 0)
    const last = buildActiveSalesPage(rows, totalPages - 1)
    const seen = new Set<string>()

    expect(first.rows).toHaveLength(ACTIVE_SALES_PAGE_SIZE)
    expect(first.from).toBe(1)
    expect(first.to).toBe(ACTIVE_SALES_PAGE_SIZE)
    expect(first.totalPages).toBe(totalPages)
    expect(last.to).toBe(rows.length)

    for (let page = 0; page < totalPages; page += 1) {
      buildActiveSalesPage(rows, page).rows.forEach((row) => seen.add(row.id))
    }
    expect(seen.size).toBe(rows.length)
  })

  it('corrige a página pedida para o intervalo válido', () => {
    expect(buildActiveSalesPage(rows, -5).page).toBe(0)
    expect(buildActiveSalesPage(rows, 99_999).page).toBe(
      Math.ceil(rows.length / ACTIVE_SALES_PAGE_SIZE) - 1,
    )
  })

  it('não quebra a navegação com a lista vazia', () => {
    const empty = buildActiveSalesPage([], 3)

    expect(empty.page).toBe(0)
    expect(empty.totalPages).toBe(1)
    expect(empty.total).toBe(0)
    expect(empty.from).toBe(0)
    expect(empty.to).toBe(0)
    expect(empty.rows).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/* Instalações                                                                */
/* -------------------------------------------------------------------------- */

describe('classificação da instalação', () => {
  const base = {
    saleId: 'VD-2026-00001',
    serviceCode: COMMERCIAL_INSTALLATION_SERVICE_CODE,
    basePrice: 150,
  }

  it('separa integral, com desconto e isenta', () => {
    expect(
      classifyCommercialInstallation({ ...base, finalPrice: 150, paymentTerm: 'avista' }),
    ).toBe('integral')
    expect(
      classifyCommercialInstallation({ ...base, finalPrice: 90, paymentTerm: 'parcelado-2x' }),
    ).toBe('desconto')
    expect(classifyCommercialInstallation({ ...base, finalPrice: 0, paymentTerm: null })).toBe(
      'isenta',
    )
  })

  it('rejeita valores impossíveis em vez de normalizá-los', () => {
    const invalidos = [
      { basePrice: -1, finalPrice: 0, paymentTerm: null },
      { basePrice: 150, finalPrice: -1, paymentTerm: 'avista' as const },
      { basePrice: 150, finalPrice: 200, paymentTerm: 'avista' as const },
      { basePrice: Number.NaN, finalPrice: 150, paymentTerm: 'avista' as const },
      { basePrice: 150, finalPrice: Number.POSITIVE_INFINITY, paymentTerm: 'avista' as const },
    ]

    invalidos.forEach((caso) => {
      expect(classifyCommercialInstallation({ ...base, ...caso })).toBeNull()
    })
  })

  it('exige condição de pagamento apenas quando existe valor a cobrar', () => {
    // Isenta com condição e cobrada sem condição são registros inválidos.
    expect(
      classifyCommercialInstallation({ ...base, finalPrice: 0, paymentTerm: 'avista' }),
    ).toBeNull()
    expect(
      classifyCommercialInstallation({ ...base, finalPrice: 150, paymentTerm: null }),
    ).toBeNull()
  })
})

describe('mock de instalações', () => {
  it('é determinístico e vinculado à venda pelo identificador', () => {
    const [sale] = dataset.sales
    const primeira = commercialInstallationOf(sale.id)
    const segunda = commercialInstallationOf(sale.id)

    expect(primeira).toEqual(segunda)
    if (primeira !== null) {
      expect(primeira.saleId).toBe(sale.id)
      expect(primeira.serviceCode).toBe('00603')
      expect(primeira.basePrice).toBe(COMMERCIAL_INSTALLATION_BASE_PRICE)
    }
  })

  it('deixa parte das vendas sem dado, sem transformar isso em isenção', () => {
    const semDado = dataset.sales.filter((sale) => commercialInstallationOf(sale.id) === null)

    expect(semDado.length).toBeGreaterThan(0)
    // A base só guarda as instalações que existem.
    expect(dataset.installations).toHaveLength(dataset.sales.length - semDado.length)
    expect(dataset.installations.length).toBeLessThan(dataset.sales.length)
  })

  it('exercita os três estados de cobrança na base inteira', () => {
    const estados = new Set(
      dataset.installations.map((installation) =>
        classifyCommercialInstallation(installation),
      ),
    )

    expect(estados).toEqual(new Set(['integral', 'desconto', 'isenta']))
  })
})

describe('indicadores de instalação do recorte', () => {
  it('apura somente as vendas do recorte, com potencial pelo preço-base', () => {
    const { installations } = snapshotOf().metrics
    const rows = snapshotOf().rows

    expect(installations.withData + installations.withoutData).toBe(rows.length)
    expect(installations.potentialValue).toBeCloseTo(
      installations.withData * COMMERCIAL_INSTALLATION_BASE_PRICE,
      6,
    )
  })

  it('reconcilia potencial, contratado e descontos', () => {
    const { installations } = snapshotOf().metrics

    expect(installations.contractedValue + installations.discountValue).toBeCloseTo(
      installations.potentialValue,
      6,
    )
    expect(installations.discountValue).toBeGreaterThan(0)
  })

  it('reconcilia as contagens com as instalações que possuem dado', () => {
    const { installations } = snapshotOf().metrics

    expect(
      installations.fullCharge + installations.partialDiscount + installations.waived,
    ).toBe(installations.withData)
    expect(installations.waivedShare).toBeCloseTo(
      installations.waived / installations.withData,
      10,
    )
  })

  it('não deixa instalação isenta participar da condição de pagamento', () => {
    const { installations } = snapshotOf().metrics
    const cobradas = installations.fullCharge + installations.partialDiscount
    const porCondicao = installations.paymentTerms.reduce(
      (total, slice) => total + slice.installations,
      0,
    )

    expect(porCondicao).toBe(cobradas)
    expect(installations.paymentTerms.length).toBeGreaterThan(1)
    installations.paymentTerms.forEach((slice) => {
      expect(slice.contractedValue).toBeGreaterThan(0)
      expect(slice.share).toBeCloseTo(slice.installations / cobradas, 10)
    })
  })

  it('fecha o contratado com a soma dos valores finais das próprias linhas', () => {
    const snapshot = snapshotOf()
    const porLinha = snapshot.rows.reduce((total, row) => {
      const installation = commercialInstallationOf(row.id)
      if (installation === null) return total

      return classifyCommercialInstallation(installation) === null
        ? total
        : total + installation.finalPrice
    }, 0)

    expect(snapshot.metrics.installations.contractedValue).toBeCloseTo(porLinha, 6)
    // A evolução diária publica a mesma cobrança única.
    expect(
      snapshot.daily.reduce((sum, point) => sum + point.installationContractedValue, 0),
    ).toBeCloseTo(porLinha, 6)
  })

  it('não mistura a cobrança única com a mensalidade nem com o ticket médio', () => {
    const { metrics } = snapshotOf()
    const mensal = metrics.monthlyContractedValue

    expect(metrics.installations.contractedValue).not.toBeCloseTo(mensal, 2)
    expect(metrics.averageTicket).toBeCloseTo(mensal / metrics.activeSales, 6)
  })

  it('compara o mês fechado com o mês fechado anterior', () => {
    const julho = snapshotOf().metrics.installations
    const junho = snapshotOf(JUNE).metrics.installations

    expect(julho.previousContractedValue).toBeCloseTo(junho.contractedValue, 6)
    expect(julho.contractedValueChangeRate).toBeCloseTo(
      (julho.contractedValue - junho.contractedValue) / junho.contractedValue,
      10,
    )
  })

  it('não inventa percentual sem período anterior comparável', () => {
    const { installations } = snapshotOf({
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    }).metrics

    expect(installations.previousContractedValue).toBeNull()
    expect(installations.contractedValueChangeRate).toBeNull()
  })

  it('devolve o estado vazio sem apurar isenção em recorte sem vendas', () => {
    const { installations } = snapshotOf({
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      planName: 'Plano inexistente',
    }).metrics

    expect(installations.withData).toBe(0)
    expect(installations.withoutData).toBe(0)
    expect(installations.waived).toBe(0)
    expect(installations.waivedShare).toBeNull()
    expect(installations.contractedValue).toBe(0)
    expect(installations.potentialValue).toBe(0)
    expect(installations.paymentTerms).toHaveLength(0)
  })
})
