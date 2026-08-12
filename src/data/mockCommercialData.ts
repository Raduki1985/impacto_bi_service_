/**
 * Base mockada do Comercial: 01/01/2026 a 31/07/2026.
 *
 * Totalmente determinística. Os volumes de venda ativa por vendedor, por
 * colaborador e por mês são fixtures explícitas; só a dispersão desses volumes
 * pelos dias do mês, as datas de criação e assinatura e a cidade das vendas
 * corporativas passam por um gerador pseudoaleatório de semente fixa. Recarregar
 * a aplicação não muda nenhum número.
 *
 * Os dados são sintéticos. Nenhum valor individual, cliente, contrato, CPF,
 * telefone, e-mail ou receita do SGI foi copiado para cá. Os únicos dados reais
 * são os nomes profissionais dos vendedores e as cidades de atuação, ambos
 * aprovados para o repositório.
 *
 * O que a base precisa provar, e prova por construção:
 *
 * - somente venda `ativa` com data de ativação entra no realizado;
 * - pendente, agendada e assinada sem ativação ficam fora;
 * - status não ativo com data de ativação (suspensa, bloqueios) também fica fora;
 * - a data de criação pode cair no mês anterior ao da ativação, e não é ela que
 *   atribui a venda ao mês;
 * - Colaboradores contribuem para o realizado sem ter meta própria;
 * - o Corporativo só entra no realizado total usado contra a supermeta;
 * - Terra Preta tem venda e não tem vendedor interno, logo não tem meta local.
 */

import {
  COMMERCIAL_MONTHS,
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  addDays,
  compareIsoDates,
  daysInMonth,
  isoDateInMonth,
  weekdayOf,
} from './commercialCalendar'
import type {
  CommercialCity,
  CommercialCityId,
  CommercialDataset,
  CommercialMonthKey,
  CommercialPartner,
  CommercialSale,
  CommercialSaleStatus,
  CommercialSeller,
} from './commercialTypes'

/* -------------------------------------------------------------------------- */
/* Catálogos                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cidades da base. "Tanque" e "Lucas" são referências internas de Atibaia e não
 * são cidades: quem vende lá é normalizado como Atibaia, e por isso não existem
 * aqui.
 */
const cities: readonly CommercialCity[] = [
  { id: 'atibaia', name: 'Atibaia' },
  { id: 'piracaia', name: 'Piracaia' },
  { id: 'bom-jesus-dos-perdoes', name: 'Bom Jesus dos Perdões' },
  { id: 'joanopolis', name: 'Joanópolis' },
  { id: 'mairipora', name: 'Mairiporã' },
  { id: 'terra-preta', name: 'Terra Preta' },
]

type SellerSeed = {
  readonly id: string
  readonly name: string
  readonly cityId: CommercialCityId | null
  /** Vendas ativas creditadas ao vendedor em cada mês, de janeiro a julho. */
  readonly monthlyActiveSales: readonly number[]
}

/**
 * Quinze vendedores internos, com meta individual de 50 vendas por mês.
 *
 * Os volumes mensais são fixtures: a soma por mês é o realizado interno do mês,
 * e a soma por cidade é o realizado interno daquela cidade. Julho traz sete
 * vendedores acima de 50 e oito abaixo, de propósito.
 */
const internalSellerSeeds: readonly SellerSeed[] = [
  {
    id: 'vnd-ana-maria',
    name: 'Ana Maria dos Santos',
    cityId: 'atibaia',
    monthlyActiveSales: [48, 47, 51, 55, 51, 56, 54],
  },
  {
    id: 'vnd-barbara-dominique',
    name: 'Barbara Dominique Santos Brito',
    cityId: 'atibaia',
    monthlyActiveSales: [42, 40, 45, 48, 44, 49, 47],
  },
  {
    id: 'vnd-bruna-raquelini',
    name: 'Bruna Raquelini Rodrigues Silva',
    cityId: 'atibaia',
    monthlyActiveSales: [46, 45, 49, 52, 48, 53, 51],
  },
  {
    id: 'vnd-camila-cardoso',
    name: 'Camila Cardoso Magalhães',
    cityId: 'atibaia',
    monthlyActiveSales: [39, 37, 41, 44, 40, 43, 43],
  },
  {
    id: 'vnd-cristina-hernandez',
    name: 'Cristina Hernandez Materniano',
    cityId: 'atibaia',
    monthlyActiveSales: [51, 48, 54, 57, 52, 58, 56],
  },
  {
    id: 'vnd-giovanna-bordin',
    name: 'Giovanna Bordin da Cunha',
    cityId: 'atibaia',
    monthlyActiveSales: [44, 42, 47, 50, 46, 51, 49],
  },
  {
    id: 'vnd-larissa-aparecida',
    name: 'Larissa Aparecida Almeida da Conceição',
    cityId: 'atibaia',
    monthlyActiveSales: [34, 33, 36, 37, 35, 37, 38],
  },
  {
    id: 'vnd-nayara-soares',
    name: 'Nayara Soares dos Santos',
    cityId: 'atibaia',
    monthlyActiveSales: [47, 46, 50, 53, 49, 54, 52],
  },
  {
    id: 'vnd-francielle-aparecida',
    name: 'Francielle Aparecida Malaquias Poco',
    cityId: 'mairipora',
    monthlyActiveSales: [45, 43, 48, 51, 47, 52, 50],
  },
  {
    id: 'vnd-tailane-rodrigues',
    name: 'Tailane Rodrigues Oliveira',
    cityId: 'mairipora',
    monthlyActiveSales: [40, 39, 43, 46, 42, 47, 45],
  },
  {
    id: 'vnd-dayane-ferreira',
    name: 'Dayane Ferreira Ferri Alves',
    cityId: 'joanopolis',
    monthlyActiveSales: [48, 46, 51, 54, 50, 55, 53],
  },
  {
    id: 'vnd-maisa-fernanda',
    name: 'Maisa Fernanda Moreira dos Santos',
    cityId: 'piracaia',
    monthlyActiveSales: [43, 41, 46, 49, 45, 50, 48],
  },
  {
    id: 'vnd-sabrina-oliveira',
    name: 'Sabrina de Oliveira',
    cityId: 'piracaia',
    monthlyActiveSales: [37, 35, 39, 40, 38, 41, 41],
  },
  {
    id: 'vnd-carolina-carvalho',
    name: 'Carolina de Carvalho Doce',
    cityId: 'bom-jesus-dos-perdoes',
    monthlyActiveSales: [50, 47, 53, 56, 51, 57, 55],
  },
  {
    id: 'vnd-jenifer-bianca',
    name: 'Jenifer Bianca Pinto Dias',
    cityId: 'bom-jesus-dos-perdoes',
    monthlyActiveSales: [44, 42, 47, 50, 46, 51, 49],
  },
]

/**
 * Corporativo: sem meta individual de volume e sem cidade de alocação. As vendas
 * são distribuídas pelas cidades da base, e é a cidade do fato que responde ao
 * filtro.
 */
const corporateSellerSeeds: readonly SellerSeed[] = [
  {
    id: 'vnd-arthur-lopes',
    name: 'Arthur Lopes',
    cityId: null,
    monthlyActiveSales: [33, 32, 36, 28, 34, 40, 48],
  },
  {
    id: 'vnd-leticia-castro',
    name: 'Letícia Castro de Oliveira',
    cityId: null,
    monthlyActiveSales: [28, 26, 30, 24, 29, 34, 40],
  },
]

type PartnerSeed = CommercialPartner & { readonly monthlyActiveSales: readonly number[] }

/**
 * Colaboradores. Anônimos e com CPFs de indicação obviamente sintéticos:
 * nenhum identificador pertence a uma pessoa real. O formato existe apenas para
 * o filtro e a leitura visual do mock reproduzirem a regra aprovada do BI.
 */
const partnerSeeds: readonly PartnerSeed[] = [
  {
    id: 'col-01',
    label: 'Colaborador 01',
    indicationCode: '000.000.001-00',
    cityId: 'atibaia',
    monthlyActiveSales: [14, 14, 16, 17, 15, 18, 17],
  },
  {
    id: 'col-02',
    label: 'Colaborador 02',
    indicationCode: '000.000.002-00',
    cityId: 'atibaia',
    monthlyActiveSales: [12, 12, 13, 14, 13, 14, 14],
  },
  {
    id: 'col-03',
    label: 'Colaborador 03',
    indicationCode: '000.000.003-00',
    cityId: 'mairipora',
    monthlyActiveSales: [9, 9, 10, 10, 9, 11, 11],
  },
  {
    id: 'col-04',
    label: 'Colaborador 04',
    indicationCode: '000.000.004-00',
    cityId: 'piracaia',
    monthlyActiveSales: [8, 8, 9, 9, 8, 10, 9],
  },
  {
    id: 'col-05',
    label: 'Colaborador 05',
    indicationCode: '000.000.005-00',
    cityId: 'bom-jesus-dos-perdoes',
    monthlyActiveSales: [7, 7, 8, 9, 8, 9, 9],
  },
  {
    id: 'col-06',
    label: 'Colaborador 06',
    indicationCode: '000.000.006-00',
    cityId: 'terra-preta',
    monthlyActiveSales: [4, 4, 4, 4, 5, 4, 4],
  },
]

/**
 * Vendas que não entram no realizado, proporcionais ao volume ativo do mesmo
 * vendedor no mês.
 *
 * As três últimas linhas têm data de ativação e mesmo assim ficam fora: status
 * ativo é condição obrigatória, e ter data de ativação não basta.
 */
const notCountedProfiles: readonly {
  readonly status: CommercialSaleStatus
  readonly rate: number
  readonly signed: boolean
  readonly activated: boolean
}[] = [
  { status: 'pendente', rate: 0.09, signed: false, activated: false },
  { status: 'assinada', rate: 0.06, signed: true, activated: false },
  { status: 'agendada', rate: 0.05, signed: true, activated: false },
  { status: 'aguardando-aprovacao', rate: 0.03, signed: true, activated: false },
  { status: 'reprovada', rate: 0.02, signed: true, activated: false },
  { status: 'cancelada', rate: 0.03, signed: true, activated: false },
  { status: 'expirada', rate: 0.01, signed: true, activated: false },
  { status: 'nao-sincronizada', rate: 0.01, signed: false, activated: false },
  { status: 'suspensa', rate: 0.02, signed: true, activated: true },
  { status: 'bloqueio-financeiro', rate: 0.02, signed: true, activated: true },
  { status: 'bloqueio-administrativo', rate: 0.01, signed: true, activated: true },
]

/** Pesos da cidade das vendas corporativas, que atuam em toda a região. */
const corporateCityWeights: readonly { readonly cityId: CommercialCityId; readonly weight: number }[] =
  [
    { cityId: 'atibaia', weight: 42 },
    { cityId: 'mairipora', weight: 14 },
    { cityId: 'piracaia', weight: 12 },
    { cityId: 'bom-jesus-dos-perdoes', weight: 12 },
    { cityId: 'joanopolis', weight: 8 },
    { cityId: 'terra-preta', weight: 12 },
  ]

/* -------------------------------------------------------------------------- */
/* Gerador determinístico                                                     */
/* -------------------------------------------------------------------------- */

/** Semente fixa da base inteira. Trocá-la muda todos os detalhes de data. */
const DATASET_SEED = 'impacto-comercial-2026'

/** Hash FNV-1a: transforma um rótulo estável em semente numérica estável. */
function seedFrom(text: string): number {
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

/** mulberry32: pequeno, puro e reprodutível. */
function createRandom(label: string): () => number {
  let state = seedFrom(`${DATASET_SEED}:${label}`)

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const difference =
    Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)

  return Math.round(difference / 86400000)
}

/**
 * Distribui um total exato pelos dias do mês.
 *
 * Fim de semana pesa menos que dia útil, e cada dia recebe uma variação
 * determinística. O resto da divisão é entregue pelos maiores restos, então a
 * soma da distribuição é sempre igual ao total pedido.
 */
function distributeAcrossDays(
  total: number,
  month: CommercialMonthKey,
  random: () => number,
): number[] {
  const days = daysInMonth(month)
  const counts = new Array<number>(days).fill(0)
  if (total <= 0) return counts

  const weights: number[] = []

  for (let day = 1; day <= days; day += 1) {
    const weekday = weekdayOf(isoDateInMonth(month, day))
    const base = weekday === 0 ? 0.15 : weekday === 6 ? 0.55 : 1

    weights.push(base * (0.75 + random() * 0.5))
  }

  const weightSum = weights.reduce((accumulator, weight) => accumulator + weight, 0)
  const exact = weights.map((weight) => (total * weight) / weightSum)

  exact.forEach((value, index) => {
    counts[index] = Math.floor(value)
  })

  let remainder = total - counts.reduce((accumulator, value) => accumulator + value, 0)

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (let position = 0; remainder > 0; position += 1, remainder -= 1) {
    counts[byFraction[position % byFraction.length].index] += 1
  }

  return counts
}

function pickCorporateCity(random: () => number): CommercialCityId {
  const total = corporateCityWeights.reduce((accumulator, item) => accumulator + item.weight, 0)
  let threshold = random() * total

  for (const item of corporateCityWeights) {
    threshold -= item.weight
    if (threshold <= 0) return item.cityId
  }

  return corporateCityWeights[corporateCityWeights.length - 1].cityId
}

type SaleDates = {
  readonly createdAt: string
  readonly signedAt: string | null
  readonly activatedAt: string | null
}

/**
 * Datas de uma venda a partir do dia de referência.
 *
 * A criação fica de 2 a 13 dias antes, e pode cair no mês anterior de propósito:
 * é o que prova que o realizado é atribuído pela ativação, e não pela criação.
 * O limite inferior é o início do período mockado.
 */
function buildSaleDates(
  referenceDate: string,
  random: () => number,
  options: { readonly signed: boolean; readonly activated: boolean },
): SaleDates {
  const lead = 2 + Math.floor(random() * 12)
  const rawCreatedAt = addDays(referenceDate, -lead)
  const createdAt = rawCreatedAt < COMMERCIAL_PERIOD_START ? COMMERCIAL_PERIOD_START : rawCreatedAt

  if (!options.signed) {
    return { createdAt, signedAt: null, activatedAt: null }
  }

  const gap = Math.max(daysBetween(createdAt, referenceDate), 0)
  const signedAt = addDays(createdAt, Math.floor(gap * (0.3 + random() * 0.4)))

  return {
    createdAt,
    signedAt,
    activatedAt: options.activated ? referenceDate : null,
  }
}

/* -------------------------------------------------------------------------- */
/* Construção da base                                                         */
/* -------------------------------------------------------------------------- */

function buildSellers(): CommercialSeller[] {
  return [
    ...internalSellerSeeds.map((seed) => ({
      id: seed.id,
      name: seed.name,
      cityId: seed.cityId,
      segment: 'interno' as const,
      active: true,
    })),
    ...corporateSellerSeeds.map((seed) => ({
      id: seed.id,
      name: seed.name,
      cityId: seed.cityId,
      segment: 'corporativo' as const,
      active: true,
    })),
  ]
}

function buildPartners(): CommercialPartner[] {
  return partnerSeeds.map(({ id, label, indicationCode, cityId }) => ({
    id,
    label,
    indicationCode,
    cityId,
  }))
}

export function buildCommercialDataset(): CommercialDataset {
  const sellers = buildSellers()
  const partners = buildPartners()
  const sales: CommercialSale[] = []
  let sequence = 0

  const nextId = (): string => {
    sequence += 1

    return `VD-2026-${String(sequence).padStart(5, '0')}`
  }

  const pushSale = (sale: Omit<CommercialSale, 'id'>): void => {
    sales.push({ id: nextId(), ...sale })
  }

  /** Vendas creditadas ao próprio vendedor: sem código de indicação. */
  const pushSellerSales = (seed: SellerSeed, segment: 'interno' | 'corporativo'): void => {
    COMMERCIAL_MONTHS.forEach((month, monthIndex) => {
      const activeTotal = seed.monthlyActiveSales[monthIndex]
      const random = createRandom(`${seed.id}:${month}`)
      const perDay = distributeAcrossDays(activeTotal, month, random)

      perDay.forEach((count, dayIndex) => {
        for (let unit = 0; unit < count; unit += 1) {
          const activationDate = isoDateInMonth(month, dayIndex + 1)
          const dates = buildSaleDates(activationDate, random, { signed: true, activated: true })

          pushSale({
            creatorId: seed.id,
            indicationCode: null,
            cityId:
              segment === 'corporativo' ? pickCorporateCity(random) : (seed.cityId as CommercialCityId),
            channel: segment,
            status: 'ativa',
            ...dates,
          })
        }
      })

      notCountedProfiles.forEach((profile) => {
        const total = Math.round(activeTotal * profile.rate)

        for (let unit = 0; unit < total; unit += 1) {
          const referenceDate = isoDateInMonth(
            month,
            1 + Math.floor(random() * daysInMonth(month)),
          )
          const dates = buildSaleDates(referenceDate, random, {
            signed: profile.signed,
            activated: profile.activated,
          })

          pushSale({
            creatorId: seed.id,
            indicationCode: null,
            cityId:
              segment === 'corporativo' ? pickCorporateCity(random) : (seed.cityId as CommercialCityId),
            channel: segment,
            status: profile.status,
            ...dates,
          })
        }
      })
    })
  }

  internalSellerSeeds.forEach((seed) => pushSellerSales(seed, 'interno'))
  corporateSellerSeeds.forEach((seed) => pushSellerSales(seed, 'corporativo'))

  /**
   * Vendas indicadas por colaborador. O crédito vai para o colaborador do
   * código, então quem registrou a venda não altera nenhum indicador desta
   * página: o criador é escolhido entre os vendedores internos da mesma cidade
   * e, onde não existe nenhum (Terra Preta), entre todos os internos, sem que
   * isso aloque ninguém àquela cidade.
   */
  partnerSeeds.forEach((partner) => {
    const localSellers = internalSellerSeeds.filter((seed) => seed.cityId === partner.cityId)
    const creators = localSellers.length > 0 ? localSellers : internalSellerSeeds

    COMMERCIAL_MONTHS.forEach((month, monthIndex) => {
      const activeTotal = partner.monthlyActiveSales[monthIndex]
      const random = createRandom(`${partner.id}:${month}`)
      const perDay = distributeAcrossDays(activeTotal, month, random)
      let creatorIndex = 0

      const nextCreatorId = (): string => {
        const creator = creators[creatorIndex % creators.length]
        creatorIndex += 1

        return creator.id
      }

      perDay.forEach((count, dayIndex) => {
        for (let unit = 0; unit < count; unit += 1) {
          const activationDate = isoDateInMonth(month, dayIndex + 1)
          const dates = buildSaleDates(activationDate, random, { signed: true, activated: true })

          pushSale({
            creatorId: nextCreatorId(),
            indicationCode: partner.indicationCode,
            cityId: partner.cityId,
            channel: 'interno',
            status: 'ativa',
            ...dates,
          })
        }
      })

      // Indicação também gera venda que não fecha: pendente e assinada sem ativação.
      ;(['pendente', 'assinada'] as const).forEach((status, statusIndex) => {
        const total = Math.round(activeTotal * (statusIndex === 0 ? 0.1 : 0.06))

        for (let unit = 0; unit < total; unit += 1) {
          const referenceDate = isoDateInMonth(
            month,
            1 + Math.floor(random() * daysInMonth(month)),
          )
          const dates = buildSaleDates(referenceDate, random, {
            signed: status === 'assinada',
            activated: false,
          })

          pushSale({
            creatorId: nextCreatorId(),
            indicationCode: partner.indicationCode,
            cityId: partner.cityId,
            channel: 'interno',
            status,
            ...dates,
          })
        }
      })
    })
  })

  sales.sort((a, b) => {
    const left = a.activatedAt ?? a.createdAt
    const right = b.activatedAt ?? b.createdAt

    return compareIsoDates(left, right) || compareIsoDates(a.id, b.id)
  })

  return {
    referenceDate: COMMERCIAL_PERIOD_END,
    periodStart: COMMERCIAL_PERIOD_START,
    periodEnd: COMMERCIAL_PERIOD_END,
    months: COMMERCIAL_MONTHS,
    cities,
    sellers,
    partners,
    sales,
  }
}

let cachedDataset: CommercialDataset | null = null

/**
 * Base já construída, ou null quando ainda não foi construída nesta sessão.
 * A página usa isso para distinguir o primeiro carregamento das visitas
 * seguintes, sem reconstruir nada.
 */
export function peekCommercialDataset(): CommercialDataset | null {
  return cachedDataset
}

/** Base do Comercial, construída uma única vez por sessão. */
export function getCommercialDataset(): CommercialDataset {
  cachedDataset ??= buildCommercialDataset()

  return cachedDataset
}
