import {
  DEFAULT_COMMERCIAL_MONTH,
  addDays,
  dayOfMonth,
  daysInMonth,
  formatIsoAsBrDate,
  isCommercialMonthKey,
  isoDateInMonth,
  monthKeyOf,
  previousCommercialMonth,
} from '../../../data/commercialCalendar'
import type {
  CommercialCityId,
  CommercialDataset,
  CommercialInstallation,
  CommercialInstallationPaymentTerm,
  CommercialMonthKey,
  CommercialSale,
  CommercialSaleStatus,
} from '../../../data/commercialTypes'
import { resolveGoalBasis } from '../Goals/commercialGoalsModel'

/**
 * Modelo de Comercial > Vendas por Período.
 *
 * O arquivo tem duas responsabilidades distintas, separadas de propósito:
 *
 * 1. `Vendas ativas iniciadas no período`, que é o bloco funcional desta
 *    página. Ele responde quantas vendas atualmente ativas começaram no
 *    período, quanto representam em valor mensal, quem vendeu, onde foram
 *    instaladas, por qual origem chegaram e quais registros compõem o
 *    resultado. Só entra aqui venda com status atual `ativa` e Data de Início
 *    dentro do período. Não existe fallback de data. A cobrança única do
 *    serviço de instalação entra neste bloco como indicador próprio, sempre
 *    separada do valor mensal contratado e do ticket médio mensal.
 *
 * 2. `buildSalesPeriodSnapshot`, a projeção que a Visão Geral consome como
 *    motor próprio (`Overview/overviewModel.ts`). Ela continua abrangendo
 *    TODOS os status e continua usando `eventDate`, porque os cards Contratos
 *    em fluxo, Meta Comercial e Supermeta Total daquela página dependem disso.
 *    Alterar a Visão Geral está fora do escopo deste bloco, então essa parte
 *    permanece com o comportamento atual.
 *
 * As duas partes derivam dos mesmos fatos, então uma mesma venda tem
 * exatamente o mesmo plano, valor e cidade nas duas páginas.
 */

export type SalesPeriodTeam = 'comercial' | 'corporativo'
export type SalesPeriodTeamFilter = 'todos' | SalesPeriodTeam

export const DEFAULT_SALES_PERIOD_START = isoDateInMonth(DEFAULT_COMMERCIAL_MONTH, 1)
export const DEFAULT_SALES_PERIOD_END = isoDateInMonth(
  DEFAULT_COMMERCIAL_MONTH,
  daysInMonth(DEFAULT_COMMERCIAL_MONTH),
)

export const commercialSaleStatusLabels: Record<CommercialSaleStatus, string> = {
  ativa: 'Ativa',
  pendente: 'Pendente',
  agendada: 'Agendada',
  assinada: 'Assinada',
  'aguardando-aprovacao': 'Aguardando aprovação',
  reprovada: 'Reprovada',
  cancelada: 'Cancelada',
  suspensa: 'Suspensa',
  expirada: 'Expirada',
  'bloqueio-administrativo': 'Bloqueio administrativo',
  'bloqueio-financeiro': 'Bloqueio financeiro',
  'nao-sincronizada': 'Não sincronizada',
}

export const commercialInstallationPaymentTermLabels: Record<
  CommercialInstallationPaymentTerm,
  string
> = {
  avista: 'À vista',
  'parcelado-2x': 'Parcelado em 2x',
  'parcelado-3x': 'Parcelado em 3x',
}

/* -------------------------------------------------------------------------- */
/* Projeção compartilhada dos fatos                                           */
/* -------------------------------------------------------------------------- */

export type SalesPeriodFact = {
  readonly id: string
  readonly contractCode: string
  readonly customerLabel: string
  readonly customerCpf: string
  readonly sellerId: string
  readonly sellerName: string
  /** Cidade do endereço onde a internet foi instalada. Nunca é origem comercial. */
  readonly cityId: CommercialCityId
  readonly cityName: string
  readonly team: SalesPeriodTeam
  readonly indicatorCpf: string | null
  readonly status: CommercialSaleStatus
  /**
   * Data usada exclusivamente pela projeção da Visão Geral, que precisa
   * posicionar no tempo também contratos ainda não ativados. O bloco de Vendas
   * por Período não usa este campo: ele trabalha somente com a Data de Início.
   */
  readonly eventDate: string
  readonly activatedAt: string | null
  readonly monthlyValue: number
  readonly planName: string
}

const COMMERCIAL_VALUES = [99.9, 109.9, 129.9, 159.9, 179.9] as const
const CORPORATE_VALUES = [199.9, 249.9, 299.9, 349.9] as const
const COMMERCIAL_PLANS = [
  '300 MB',
  '400 MB',
  '600 MB',
  '600 MB + serviços',
  '1 Giga',
] as const
const CORPORATE_PLANS = ['PME 300 MB', 'PME 600 MB', 'PME 1 Giga', 'Link Corporativo'] as const

function sequenceOf(saleId: string): number {
  const match = saleId.match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function teamOf(sale: CommercialSale): SalesPeriodTeam {
  return sale.channel === 'corporativo' ? 'corporativo' : 'comercial'
}

function valueOf(sequence: number, team: SalesPeriodTeam): number {
  const values = team === 'corporativo' ? CORPORATE_VALUES : COMMERCIAL_VALUES
  return values[sequence % values.length]
}

function planOf(sequence: number, team: SalesPeriodTeam): string {
  const plans = team === 'corporativo' ? CORPORATE_PLANS : COMMERCIAL_PLANS
  return plans[sequence % plans.length]
}

function syntheticCpf(sequence: number): string {
  const middle = String(Math.floor(sequence / 1000) % 1000).padStart(3, '0')
  const end = String(sequence % 1000).padStart(3, '0')
  return `000.${middle}.${end}-00`
}

function eventDateOf(sale: CommercialSale): string {
  return sale.activatedAt ?? sale.signedAt ?? sale.createdAt
}

/**
 * Projeção analítica da mesma venda usada por Metas e Desempenho.
 *
 * Cliente, CPF, contrato, plano e valor são atributos sintéticos
 * determinísticos do esboço: nenhum deles foi extraído do SGI e nenhum
 * identifica pessoa real.
 */
export function buildSalesPeriodFacts(dataset: CommercialDataset): SalesPeriodFact[] {
  const sellers = new Map(dataset.sellers.map((seller) => [seller.id, seller]))
  const cities = new Map(dataset.cities.map((city) => [city.id, city.name]))

  return dataset.sales.map((sale) => {
    const sequence = sequenceOf(sale.id)
    const seller = sellers.get(sale.creatorId)
    const team = teamOf(sale)

    return {
      id: sale.id,
      contractCode: `#${String(1_300_000 + sequence).padStart(8, '0')}`,
      customerLabel: `Cliente ${String(sequence).padStart(4, '0')}`,
      customerCpf: syntheticCpf(sequence),
      sellerId: sale.creatorId,
      sellerName: seller?.name ?? 'Vendedor não catalogado',
      cityId: sale.cityId,
      cityName: cities.get(sale.cityId) ?? 'Cidade não catalogada',
      team,
      indicatorCpf: sale.indicationCode,
      status: sale.status,
      eventDate: eventDateOf(sale),
      activatedAt: sale.activatedAt,
      monthlyValue: valueOf(sequence, team),
      planName: planOf(sequence, team),
    }
  })
}

function inclusiveDays(startDate: string, endDate: string): number {
  let count = 0
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) count += 1
  return count
}

/**
 * Período anterior comparável.
 *
 * Mês fechado compara com o mês fechado anterior. Qualquer outro intervalo
 * compara com a mesma quantidade de dias imediatamente anteriores. Devolve
 * null quando esse período anterior não cabe inteiro na base, e nesse caso
 * nenhuma comparação é exibida.
 */
function previousPeriodRange(
  dataset: CommercialDataset,
  periodStart: string,
  periodEnd: string,
): { readonly periodStart: string; readonly periodEnd: string } | null {
  const startMonth = monthKeyOf(periodStart)
  const endMonth = monthKeyOf(periodEnd)

  if (startMonth === endMonth && isCommercialMonthKey(startMonth)) {
    const isWholeMonth =
      dayOfMonth(periodStart) === 1 &&
      periodEnd === isoDateInMonth(startMonth, daysInMonth(startMonth))

    if (isWholeMonth) {
      const previousMonth = previousCommercialMonth(startMonth)
      if (previousMonth === null) return null

      return {
        periodStart: isoDateInMonth(previousMonth, 1),
        periodEnd: isoDateInMonth(previousMonth, daysInMonth(previousMonth)),
      }
    }
  }

  const days = inclusiveDays(periodStart, periodEnd)
  const end = addDays(periodStart, -1)
  const start = addDays(end, -(days - 1))

  if (start < dataset.periodStart) return null
  return { periodStart: start, periodEnd: end }
}

/* -------------------------------------------------------------------------- */
/* Bloco funcional: vendas ativas iniciadas no período                        */
/* -------------------------------------------------------------------------- */

/**
 * Origem comercial da venda.
 *
 * Duas categorias, exclusivas e exaustivas. Indicação tem precedência porque
 * toda venda também possui uma vendedora responsável: sem a precedência, a
 * mesma venda cairia nas duas origens e a soma deixaria de fechar com o total.
 *
 * Cidade, operadora anterior e responsável pelo evento não são origem.
 */
export type SalesPeriodOrigin = 'indicacao' | 'vendedores'
export type SalesPeriodOriginFilter = 'todas' | SalesPeriodOrigin

export const salesPeriodOriginLabels: Record<SalesPeriodOrigin, string> = {
  indicacao: 'Indicação',
  vendedores: 'Vendedores',
}

export function salesPeriodOriginOf(indicationCode: string | null): SalesPeriodOrigin {
  return indicationCode !== null && indicationCode.trim() !== '' ? 'indicacao' : 'vendedores'
}

/** Uma venda atualmente ativa, com a Data de Início dentro do período. */
export type ActiveSaleRow = {
  readonly id: string
  /** Data de Início da venda. Nunca nula: é o critério de entrada no bloco. */
  readonly startDate: string
  readonly contractCode: string
  readonly customerLabel: string
  readonly customerCpf: string
  readonly sellerId: string
  readonly sellerName: string
  /** Cidade do endereço onde a internet foi instalada. */
  readonly cityId: CommercialCityId
  readonly cityName: string
  readonly planName: string
  /** Valor mensal contratado. Não é receita reconhecida. */
  readonly monthlyValue: number
  /** Status atual da assinatura. Neste bloco é sempre `ativa`. */
  readonly status: CommercialSaleStatus
  readonly origin: SalesPeriodOrigin
}

export type ActiveSalesFilters = {
  readonly periodStart: string
  readonly periodEnd: string
  /** Cidade de instalação. `null` significa todas. */
  readonly cityId: CommercialCityId | null
  /** `null` significa todos os vendedores. */
  readonly sellerId: string | null
  readonly origin: SalesPeriodOriginFilter
  /** `null` significa todos os planos. */
  readonly planName: string | null
}

/* -------------------------------------------------------------------------- */
/* Instalações                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Situação da cobrança de instalação de uma venda.
 *
 * São três e só três, exclusivas entre si. Venda SEM registro de instalação não
 * recebe classificação nenhuma: ela não é isenta, ela simplesmente não tem o
 * dado, e converter uma coisa na outra inflaria a isenção do recorte.
 */
export type ActiveSalesInstallationStatus = 'integral' | 'desconto' | 'isenta'

/**
 * Classifica uma instalação, ou devolve `null` quando o registro é inválido.
 *
 * Mesma postura do resto do bloco: nada é normalizado silenciosamente. Um
 * registro impossível é rejeitado e fica fora de todas as contagens, em vez de
 * ser corrigido para um valor plausível que ninguém informou.
 *
 * Regras de validade, na ordem:
 *
 * - preço-base e valor final precisam ser números finitos e não negativos;
 * - o valor final não ultrapassa o preço-base no cenário atual;
 * - instalação isenta não possui condição de pagamento;
 * - instalação com valor final maior que zero precisa ter condição de pagamento.
 *
 * O valor final zero decide antes da comparação com o preço-base: uma
 * instalação de preço-base zero e valor final zero é isenta, e não integral.
 */
export function classifyCommercialInstallation(
  installation: CommercialInstallation,
): ActiveSalesInstallationStatus | null {
  const { basePrice, finalPrice, paymentTerm } = installation

  if (!Number.isFinite(basePrice) || basePrice < 0) return null
  if (!Number.isFinite(finalPrice) || finalPrice < 0) return null
  if (finalPrice > basePrice) return null

  if (finalPrice === 0) return paymentTerm === null ? 'isenta' : null
  if (paymentTerm === null) return null

  return finalPrice === basePrice ? 'integral' : 'desconto'
}

/** Uma condição de pagamento na distribuição das instalações cobradas. */
export type ActiveSalesInstallationTermSlice = {
  readonly term: CommercialInstallationPaymentTerm
  readonly label: string
  readonly installations: number
  readonly contractedValue: number
  /** Participação na quantidade de instalações com valor final maior que zero. */
  readonly share: number
}

/**
 * Indicadores da cobrança única de instalação, sobre as MESMAS vendas do
 * recorte já filtrado da página.
 *
 * Nada aqui se soma ao valor mensal contratado nem ao ticket médio mensal:
 * mensalidade é recorrente, instalação é cobrança única.
 *
 * Duas reconciliações são garantidas por construção:
 *
 * - `potentialValue` = `contractedValue` + `discountValue`;
 * - `fullCharge` + `partialDiscount` + `waived` = `withData`.
 */
export type ActiveSalesInstallationMetrics = {
  /** Vendas do recorte com registro de instalação válido. */
  readonly withData: number
  /** Vendas do recorte sem registro de instalação, ou com registro inválido. */
  readonly withoutData: number
  /** Soma dos preços-base. É o valor potencial das instalações. */
  readonly potentialValue: number
  /** Soma dos valores finais. É o valor contratado, e não valor recebido. */
  readonly contractedValue: number
  /** Diferença entre preço-base e valor final, concedida em desconto. */
  readonly discountValue: number
  readonly fullCharge: number
  readonly partialDiscount: number
  readonly waived: number
  /** Isentas sobre instalações com dado. `null` quando não há dado nenhum. */
  readonly waivedShare: number | null
  /** Somente instalações com valor final maior que zero, da maior para a menor. */
  readonly paymentTerms: readonly ActiveSalesInstallationTermSlice[]
  readonly previousContractedValue: number | null
  readonly contractedValueChangeRate: number | null
}

export type ActiveSalesMetrics = {
  readonly activeSales: number
  /** Soma de `monthlyValue`. É valor contratado, e não receita. */
  readonly monthlyContractedValue: number
  readonly averageTicket: number
  readonly previousActiveSales: number | null
  readonly activeSalesChangeRate: number | null
  readonly previousMonthlyContractedValue: number | null
  readonly monthlyContractedValueChangeRate: number | null
  readonly previousAverageTicket: number | null
  readonly averageTicketChangeRate: number | null
  /** Cobrança única das instalações. Nunca é misturada aos campos acima. */
  readonly installations: ActiveSalesInstallationMetrics
}

export type ActiveSalesOriginSlice = {
  readonly origin: SalesPeriodOrigin
  readonly label: string
  readonly activeSales: number
  readonly monthlyContractedValue: number
  /** Participação no total de vendas ativas do recorte. */
  readonly share: number
}

export type ActiveSalesDailyPoint = {
  readonly date: string
  readonly day: number
  readonly activeSales: number
  readonly monthlyContractedValue: number
  /** Cobrança única contratada em instalações no dia. Não entra no valor mensal. */
  readonly installationContractedValue: number
}

/**
 * Opções dos filtros de vendedor e plano.
 *
 * Derivadas do universo inteiro de vendas ativas, e não do recorte atual: uma
 * opção que desaparecesse ao ser aplicada deixaria o filtro imprevisível.
 */
export type ActiveSalesOptions = {
  readonly sellers: readonly { readonly id: string; readonly name: string }[]
  readonly plans: readonly string[]
}

export type ActiveSalesSnapshot = {
  readonly filters: ActiveSalesFilters
  readonly periodLabel: string
  /** Todas as vendas do recorte, já ordenadas. A paginação é aplicada na página. */
  readonly rows: readonly ActiveSaleRow[]
  readonly metrics: ActiveSalesMetrics
  readonly daily: readonly ActiveSalesDailyPoint[]
  readonly origins: readonly ActiveSalesOriginSlice[]
  readonly options: ActiveSalesOptions
}

/** Mesma quantidade por página já usada na tabela de Usuários do portal. */
export const ACTIVE_SALES_PAGE_SIZE = 10

export function initialActiveSalesFilters(): ActiveSalesFilters {
  return {
    periodStart: DEFAULT_SALES_PERIOD_START,
    periodEnd: DEFAULT_SALES_PERIOD_END,
    cityId: null,
    sellerId: null,
    origin: 'todas',
    planName: null,
  }
}

/**
 * Vendas atualmente ativas, com Data de Início.
 *
 * ADAPTAÇÃO TEMPORÁRIA DO MOCK: a Data de Início vem do valor legado
 * `sale.activatedAt`. A base sintética compartilhada ainda conflita ativação e
 * início em um único campo, e criar uma data nova nela está fora do escopo
 * deste bloco. O valor é lido aqui como Data de Início do protótipo, e nada na
 * página afirma que houve transição de status no período. A integração futura
 * com Sales/SGI deve mapear o campo real `startsAt` neste ponto, sem tocar no
 * restante do bloco.
 *
 * Não existe fallback: venda sem esse valor simplesmente não participa. Criação
 * e assinatura nunca substituem a Data de Início.
 */
export function buildActiveSaleRows(dataset: CommercialDataset): ActiveSaleRow[] {
  return buildSalesPeriodFacts(dataset).flatMap((fact) => {
    const startDate = fact.activatedAt
    if (fact.status !== 'ativa' || startDate === null) return []

    return [
      {
        id: fact.id,
        startDate,
        contractCode: fact.contractCode,
        customerLabel: fact.customerLabel,
        customerCpf: fact.customerCpf,
        sellerId: fact.sellerId,
        sellerName: fact.sellerName,
        cityId: fact.cityId,
        cityName: fact.cityName,
        planName: fact.planName,
        monthlyValue: fact.monthlyValue,
        status: fact.status,
        origin: salesPeriodOriginOf(fact.indicatorCpf),
      },
    ]
  })
}

/** Todos os filtros funcionam como interseção. */
function matchesActiveSalesFilters(row: ActiveSaleRow, filters: ActiveSalesFilters): boolean {
  if (row.startDate < filters.periodStart || row.startDate > filters.periodEnd) return false
  if (filters.cityId !== null && row.cityId !== filters.cityId) return false
  if (filters.sellerId !== null && row.sellerId !== filters.sellerId) return false
  if (filters.origin !== 'todas' && row.origin !== filters.origin) return false
  if (filters.planName !== null && row.planName !== filters.planName) return false

  return true
}

/** Data de Início decrescente, com o identificador da venda como desempate estável. */
function sortActiveSaleRows(rows: readonly ActiveSaleRow[]): ActiveSaleRow[] {
  return [...rows].sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || b.id.localeCompare(a.id),
  )
}

function sumMonthlyValue(rows: readonly ActiveSaleRow[]): number {
  return rows.reduce((total, row) => total + row.monthlyValue, 0)
}

function changeRate(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null
  return (current - previous) / previous
}

/** Instalação de cada venda, indexada pelo identificador da própria venda. */
type InstallationLookup = ReadonlyMap<string, CommercialInstallation>

function buildInstallationLookup(dataset: CommercialDataset): InstallationLookup {
  return new Map(
    dataset.installations.map((installation) => [installation.saleId, installation]),
  )
}

/** Instalações válidas das vendas informadas, já classificadas. */
function classifiedInstallationsOf(
  installations: InstallationLookup,
  rows: readonly ActiveSaleRow[],
): { installation: CommercialInstallation; status: ActiveSalesInstallationStatus }[] {
  return rows.flatMap((row) => {
    const installation = installations.get(row.id)
    if (installation === undefined) return []

    const status = classifyCommercialInstallation(installation)

    return status === null ? [] : [{ installation, status }]
  })
}

/** Valor final de uma venda. Zero também quando não há dado ou ele é inválido. */
function installationContractedValueOf(
  installations: InstallationLookup,
  saleId: string,
): number {
  const installation = installations.get(saleId)
  if (installation === undefined) return 0

  return classifyCommercialInstallation(installation) === null ? 0 : installation.finalPrice
}

function sumInstallationContractedValue(
  installations: InstallationLookup,
  rows: readonly ActiveSaleRow[],
): number {
  return rows.reduce(
    (total, row) => total + installationContractedValueOf(installations, row.id),
    0,
  )
}

function buildInstallationTermSlices(
  charged: readonly CommercialInstallation[],
): ActiveSalesInstallationTermSlice[] {
  const byTerm = new Map<
    CommercialInstallationPaymentTerm,
    { installations: number; contractedValue: number }
  >()

  charged.forEach((installation) => {
    // Só chega aqui instalação com valor final maior que zero, que por
    // validação sempre possui condição de pagamento.
    const term = installation.paymentTerm
    if (term === null) return

    const current = byTerm.get(term)
    byTerm.set(term, {
      installations: (current?.installations ?? 0) + 1,
      contractedValue: (current?.contractedValue ?? 0) + installation.finalPrice,
    })
  })

  return [...byTerm.entries()]
    .map(([term, totals]) => ({
      term,
      label: commercialInstallationPaymentTermLabels[term],
      installations: totals.installations,
      contractedValue: totals.contractedValue,
      share: charged.length === 0 ? 0 : totals.installations / charged.length,
    }))
    .sort(
      (a, b) =>
        b.installations - a.installations ||
        b.contractedValue - a.contractedValue ||
        a.label.localeCompare(b.label, 'pt-BR'),
    )
}

function buildInstallationMetrics(
  installations: InstallationLookup,
  rows: readonly ActiveSaleRow[],
  previousRows: readonly ActiveSaleRow[] | null,
): ActiveSalesInstallationMetrics {
  const classified = classifiedInstallationsOf(installations, rows)
  const potentialValue = classified.reduce((total, item) => total + item.installation.basePrice, 0)
  const contractedValue = classified.reduce(
    (total, item) => total + item.installation.finalPrice,
    0,
  )
  const countOf = (status: ActiveSalesInstallationStatus): number =>
    classified.filter((item) => item.status === status).length
  const waived = countOf('isenta')
  const previousContractedValue =
    previousRows === null ? null : sumInstallationContractedValue(installations, previousRows)

  return {
    withData: classified.length,
    withoutData: rows.length - classified.length,
    potentialValue,
    contractedValue,
    // Diferença, e não uma segunda soma: é o que garante a reconciliação
    // potencial = contratado + descontos em qualquer recorte.
    discountValue: potentialValue - contractedValue,
    fullCharge: countOf('integral'),
    partialDiscount: countOf('desconto'),
    waived,
    waivedShare: classified.length === 0 ? null : waived / classified.length,
    paymentTerms: buildInstallationTermSlices(
      classified
        .filter((item) => item.installation.finalPrice > 0)
        .map((item) => item.installation),
    ),
    previousContractedValue,
    contractedValueChangeRate: changeRate(contractedValue, previousContractedValue),
  }
}

function buildActiveSalesMetrics(
  installations: InstallationLookup,
  rows: readonly ActiveSaleRow[],
  previousRows: readonly ActiveSaleRow[] | null,
): ActiveSalesMetrics {
  const monthlyContractedValue = sumMonthlyValue(rows)
  const averageTicket = rows.length === 0 ? 0 : monthlyContractedValue / rows.length
  const previousActiveSales = previousRows?.length ?? null
  const previousMonthlyContractedValue =
    previousRows === null ? null : sumMonthlyValue(previousRows)
  const previousAverageTicket =
    previousRows === null || previousRows.length === 0
      ? null
      : sumMonthlyValue(previousRows) / previousRows.length

  return {
    activeSales: rows.length,
    monthlyContractedValue,
    averageTicket,
    previousActiveSales,
    activeSalesChangeRate: changeRate(rows.length, previousActiveSales),
    previousMonthlyContractedValue,
    monthlyContractedValueChangeRate: changeRate(
      monthlyContractedValue,
      previousMonthlyContractedValue,
    ),
    previousAverageTicket,
    averageTicketChangeRate: changeRate(averageTicket, previousAverageTicket),
    installations: buildInstallationMetrics(installations, rows, previousRows),
  }
}

/** Contagem, valor mensal contratado e instalações por Data de Início, dia a dia. */
function buildActiveSalesDaily(
  installations: InstallationLookup,
  periodStart: string,
  periodEnd: string,
  rows: readonly ActiveSaleRow[],
): ActiveSalesDailyPoint[] {
  const byDate = new Map<
    string,
    { activeSales: number; monthlyContractedValue: number; installationContractedValue: number }
  >()

  rows.forEach((row) => {
    const current = byDate.get(row.startDate)
    byDate.set(row.startDate, {
      activeSales: (current?.activeSales ?? 0) + 1,
      monthlyContractedValue: (current?.monthlyContractedValue ?? 0) + row.monthlyValue,
      installationContractedValue:
        (current?.installationContractedValue ?? 0) +
        installationContractedValueOf(installations, row.id),
    })
  })

  const points: ActiveSalesDailyPoint[] = []
  for (let date = periodStart; date <= periodEnd; date = addDays(date, 1)) {
    const current = byDate.get(date)
    points.push({
      date,
      day: dayOfMonth(date),
      activeSales: current?.activeSales ?? 0,
      monthlyContractedValue: current?.monthlyContractedValue ?? 0,
      installationContractedValue: current?.installationContractedValue ?? 0,
    })
  }

  return points
}

/**
 * Composição por origem.
 *
 * As duas fatias sempre existem, mesmo zeradas, e sempre somam o total de
 * vendas ativas do recorte: cada venda é classificada uma única vez.
 */
function buildActiveSalesOrigins(rows: readonly ActiveSaleRow[]): ActiveSalesOriginSlice[] {
  return (['indicacao', 'vendedores'] as const).map((origin) => {
    const originRows = rows.filter((row) => row.origin === origin)

    return {
      origin,
      label: salesPeriodOriginLabels[origin],
      activeSales: originRows.length,
      monthlyContractedValue: sumMonthlyValue(originRows),
      share: rows.length === 0 ? 0 : originRows.length / rows.length,
    }
  })
}

function buildActiveSalesOptions(rows: readonly ActiveSaleRow[]): ActiveSalesOptions {
  const sellers = new Map<string, string>()
  const plans = new Set<string>()

  rows.forEach((row) => {
    sellers.set(row.sellerId, row.sellerName)
    plans.add(row.planName)
  })

  return {
    sellers: [...sellers.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    plans: [...plans].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }
}

export function buildActiveSalesSnapshot(
  dataset: CommercialDataset,
  filters: ActiveSalesFilters,
): ActiveSalesSnapshot {
  const allRows = buildActiveSaleRows(dataset)
  const rows = sortActiveSaleRows(
    allRows.filter((row) => matchesActiveSalesFilters(row, filters)),
  )
  const previousRange = previousPeriodRange(dataset, filters.periodStart, filters.periodEnd)
  const previousRows =
    previousRange === null
      ? null
      : allRows.filter((row) =>
          matchesActiveSalesFilters(row, {
            ...filters,
            periodStart: previousRange.periodStart,
            periodEnd: previousRange.periodEnd,
          }),
        )

  const installations = buildInstallationLookup(dataset)

  return {
    filters,
    periodLabel: `${formatIsoAsBrDate(filters.periodStart)} a ${formatIsoAsBrDate(filters.periodEnd)}`,
    rows,
    metrics: buildActiveSalesMetrics(installations, rows, previousRows),
    daily: buildActiveSalesDaily(installations, filters.periodStart, filters.periodEnd, rows),
    origins: buildActiveSalesOrigins(rows),
    options: buildActiveSalesOptions(allRows),
  }
}

export type ActiveSalesPage = {
  /** Página efetivamente exibida, já corrigida para o intervalo válido. */
  readonly page: number
  readonly totalPages: number
  readonly total: number
  /** Primeiro e último registro exibidos, em contagem humana. Zero na lista vazia. */
  readonly from: number
  readonly to: number
  readonly rows: readonly ActiveSaleRow[]
}

/**
 * Recorte de uma página da tabela.
 *
 * A página pedida é corrigida para dentro do intervalo válido em vez de virar
 * estado novo: com o conjunto encolhendo por filtro, o próprio render devolve
 * uma página existente, sem `setState` em efeito.
 */
export function buildActiveSalesPage(
  rows: readonly ActiveSaleRow[],
  requestedPage: number,
  pageSize: number = ACTIVE_SALES_PAGE_SIZE,
): ActiveSalesPage {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(requestedPage, 0), totalPages - 1)
  const start = page * pageSize

  return {
    page,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + pageSize),
    rows: rows.slice(start, start + pageSize),
  }
}

/* -------------------------------------------------------------------------- */
/* Projeção consumida pela Visão Geral                                        */
/* -------------------------------------------------------------------------- */

/**
 * Filtros da projeção compartilhada.
 *
 * Não são os filtros desta página, que estão em `ActiveSalesFilters`. Quem
 * monta este recorte é a Visão Geral, com o próprio filtro superior de data,
 * cidade e time.
 */
export type CommercialFactFilters = {
  readonly startDate: string
  readonly endDate: string
  readonly cityId: CommercialCityId | null
  readonly team: SalesPeriodTeamFilter
  /**
   * Vendedor selecionado, ou `null` para todos. Opcional porque só a Visão
   * Geral filtra por vendedor: as demais telas que montam estes filtros não
   * declaram o campo e continuam vendo todos os vendedores.
   */
  readonly sellerId?: string | null
}

export type SalesPeriodMetrics = {
  readonly totalContracts: number
  readonly activeSales: number
  readonly activeSalesChangeRate: number | null
  readonly activationRate: number | null
  readonly commercialSales: number
  readonly corporateSales: number
  /**
   * Composição por origem do recorte da Visão Geral. Continua aqui porque
   * aquela página concilia o painel Origem das vendas com estes dois campos.
   */
  readonly indicatedSales: number
  readonly sellerSales: number
  readonly monthlyRevenue: number
  readonly averageTicket: number
  readonly pipelineSales: number
  readonly goal: number | null
  readonly superGoal: number | null
  readonly goalAchieved: number
  readonly superGoalAchieved: number
}

export type SalesPeriodSellerRank = {
  readonly position: number
  readonly sellerId: string
  readonly sellerName: string
  /**
   * `null` somente quando a origem não sabe o time do vendedor, o que acontece
   * com quem não tem vínculo de equipe no SGI. A base sintética nunca produz
   * este caso: todo fato dela nasce com time. Assumir Comercial no lugar do
   * vazio inventaria dado de cadastro.
   */
  readonly team: SalesPeriodTeam | null
  readonly activeSales: number
  readonly monthlyRevenue: number
  readonly share: number
}

export type SalesPeriodSnapshot = {
  readonly filters: CommercialFactFilters
  readonly facts: readonly SalesPeriodFact[]
  readonly metrics: SalesPeriodMetrics
  readonly topSellers: readonly SalesPeriodSellerRank[]
}

const PIPELINE_STATUSES: ReadonlySet<CommercialSaleStatus> = new Set([
  'pendente',
  'assinada',
  'agendada',
  'aguardando-aprovacao',
])

function matchesFactFilters(fact: SalesPeriodFact, filters: CommercialFactFilters): boolean {
  if (fact.eventDate < filters.startDate || fact.eventDate > filters.endDate) return false
  if (filters.cityId !== null && fact.cityId !== filters.cityId) return false
  if (filters.team !== 'todos' && fact.team !== filters.team) return false
  // Vendedor ausente no filtro significa todos: a Visão Geral é a única tela
  // que declara este campo hoje.
  //
  // Com um vendedor selecionado, a venda COM indicador fica de fora: pela
  // regra do negócio ela é da indicação, não dele. É o mesmo corte que o
  // ranking Top 5 Vendedores e o painel Origem das vendas usam, então o card
  // e o ranking mostram o mesmo número para o mesmo vendedor.
  if (filters.sellerId != null) {
    if (fact.sellerId !== filters.sellerId) return false
    if (fact.indicatorCpf !== null) return false
  }

  return true
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function selectedDaysInMonth(
  month: CommercialMonthKey,
  startDate: string,
  endDate: string,
): number {
  const monthStart = isoDateInMonth(month, 1)
  const monthEnd = isoDateInMonth(month, daysInMonth(month))
  const selectedStart = startDate > monthStart ? startDate : monthStart
  const selectedEnd = endDate < monthEnd ? endDate : monthEnd

  if (selectedStart > selectedEnd) return 0

  let count = 0
  for (let date = selectedStart; date <= selectedEnd; date = addDays(date, 1)) count += 1
  return count
}

function buildProportionalGoals(
  dataset: CommercialDataset,
  filters: CommercialFactFilters,
): { goal: number | null; superGoal: number | null } {
  // O Corporativo participa do realizado total da supermeta consolidada, mas não
  // possui meta própria de volume. Um recorte exclusivo dele não recebe meta inventada.
  if (filters.team === 'corporativo') return { goal: null, superGoal: null }

  // A meta acompanha a MESMA seleção de vendedores do recorte. Com um vendedor
  // filtrado, o realizado é só o dele: comparar esse realizado com a meta do
  // time inteiro mostraria 6% de atingimento para quem bateu a própria meta.
  // Sem vendedor selecionado, a lista vazia mantém a base consolidada de antes.
  const basis = resolveGoalBasis(dataset.sellers, {
    month: DEFAULT_COMMERCIAL_MONTH,
    cityId: filters.cityId,
    sellerIds: filters.sellerId == null ? [] : [filters.sellerId],
  })

  if (basis.goal === null || basis.superGoal === null) return { goal: null, superGoal: null }

  const monthlyGoal = basis.goal
  const monthlySuperGoal = basis.superGoal
  let goal = 0
  let superGoal = 0

  dataset.months.forEach((month) => {
    const selectedDays = selectedDaysInMonth(month, filters.startDate, filters.endDate)
    if (selectedDays === 0) return

    const fraction = selectedDays / daysInMonth(month)
    goal += monthlyGoal * fraction
    superGoal += monthlySuperGoal * fraction
  })

  return { goal: round1(goal), superGoal: round1(superGoal) }
}

function isActiveFact(fact: SalesPeriodFact): boolean {
  return fact.status === 'ativa' && fact.activatedAt !== null
}

function buildFactMetrics(
  dataset: CommercialDataset,
  facts: readonly SalesPeriodFact[],
  previousFacts: readonly SalesPeriodFact[] | null,
  filters: CommercialFactFilters,
): SalesPeriodMetrics {
  const active = facts.filter(isActiveFact)
  const previousActive = previousFacts?.filter(isActiveFact) ?? null
  const monthlyRevenue = active.reduce((total, fact) => total + fact.monthlyValue, 0)
  const commercialSales = active.filter((fact) => fact.team === 'comercial').length
  const corporateSales = active.filter((fact) => fact.team === 'corporativo').length
  const indicatedSales = active.filter(
    (fact) => salesPeriodOriginOf(fact.indicatorCpf) === 'indicacao',
  ).length
  const targets = buildProportionalGoals(dataset, filters)

  return {
    totalContracts: facts.length,
    activeSales: active.length,
    activeSalesChangeRate:
      previousActive === null || previousActive.length === 0
        ? null
        : (active.length - previousActive.length) / previousActive.length,
    activationRate: facts.length === 0 ? null : active.length / facts.length,
    commercialSales,
    corporateSales,
    indicatedSales,
    sellerSales: active.length - indicatedSales,
    monthlyRevenue,
    averageTicket: active.length === 0 ? 0 : monthlyRevenue / active.length,
    pipelineSales: facts.filter((fact) => PIPELINE_STATUSES.has(fact.status)).length,
    goal: targets.goal,
    superGoal: targets.superGoal,
    goalAchieved: commercialSales,
    superGoalAchieved: active.length,
  }
}

/**
 * Ranking de vendedores, inteiro.
 *
 * Conta somente a venda PRÓPRIA do vendedor, ou seja a que não tem CPF de
 * indicador. Regra de negócio do Mário: havendo indicador, a venda é da
 * indicação e não do vendedor. É o mesmo corte do painel Origem das vendas,
 * então o ranking e a origem passaram a falar do mesmo conjunto: a soma das
 * vendas próprias do período é o denominador da participação.
 *
 * Até 09/10/2026 parava no quinto colocado (era o Top 5). A pedido da
 * Tatiane, todo vendedor com venda própria no recorte entra, e o painel rola
 * por dentro para chegar aos de menor quantidade.
 */
function buildTopSellers(facts: readonly SalesPeriodFact[]): SalesPeriodSellerRank[] {
  const active = facts.filter(isActiveFact).filter((fact) => fact.indicatorCpf === null)
  const bySeller = new Map<string, Omit<SalesPeriodSellerRank, 'position' | 'share'>>()

  active.forEach((fact) => {
    const current = bySeller.get(fact.sellerId)

    bySeller.set(fact.sellerId, {
      sellerId: fact.sellerId,
      sellerName: fact.sellerName,
      team: fact.team,
      activeSales: (current?.activeSales ?? 0) + 1,
      monthlyRevenue: (current?.monthlyRevenue ?? 0) + fact.monthlyValue,
    })
  })

  return [...bySeller.values()]
    .sort(
      (a, b) =>
        b.activeSales - a.activeSales ||
        b.monthlyRevenue - a.monthlyRevenue ||
        a.sellerName.localeCompare(b.sellerName, 'pt-BR'),
    )
    .map((seller, index) => ({
      ...seller,
      position: index + 1,
      share: active.length === 0 ? 0 : seller.activeSales / active.length,
    }))
}

/**
 * Motor da Visão Geral.
 *
 * Abrange todos os status e usa `eventDate` de propósito: os cards Contratos em
 * fluxo, Meta Comercial e Supermeta Total daquela página precisam de contratos
 * que ainda não foram ativados. Vendas por Período não consome esta função.
 */
export function buildSalesPeriodSnapshot(
  dataset: CommercialDataset,
  filters: CommercialFactFilters,
): SalesPeriodSnapshot {
  const allFacts = buildSalesPeriodFacts(dataset)
  const facts = allFacts.filter((fact) => matchesFactFilters(fact, filters))
  const previousRange = previousPeriodRange(dataset, filters.startDate, filters.endDate)
  const previousFacts =
    previousRange === null
      ? null
      : allFacts.filter((fact) =>
          matchesFactFilters(fact, {
            ...filters,
            startDate: previousRange.periodStart,
            endDate: previousRange.periodEnd,
          }),
        )

  return {
    filters,
    facts,
    metrics: buildFactMetrics(dataset, facts, previousFacts, filters),
    topSellers: buildTopSellers(facts),
  }
}
