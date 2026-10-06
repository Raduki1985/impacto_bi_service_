import { BiApiError, fetchFromBiApi } from './biApiClient'

/**
 * Contratos e contagens das listas da Visão Geral Comercial vindos da API.
 *
 * Desde 01/10/2026 (pedido do Mário para a página carregar menos, no molde da
 * Visão Geral de OS) o portal não baixa mais contratos em massa para contar e
 * recortar no navegador. O serviço conta e recorta, e o portal pede:
 *
 * - `/today`: as cinco caixas da faixa Hoje ao vivo, só números, a cada
 *   minuto (de ~240 KB para menos de 1 KB em produção);
 * - `/today/records`: os contratos de UMA caixa, quando a lista abre;
 * - `/period/summary`: o vendido no período, sem contratos (de ~590 KB por
 *   troca de filtro para ~200 bytes). Alimentou o botão de baixar do título
 *   e, por algumas horas de 06/10/2026, a linha de detalhe do card Vendas
 *   ativadas; a página não o lê mais, e a função fica para quem precisar;
 * - `/period/records`: os contratos da janela das vendas ativadas, no clique
 *   do ícone do card;
 * - `/month/records`: os contratos de uma barra da Safra ou da Evolução
 *   mensal, com a contagem de cada barra do mês, no clique.
 *
 * As regras (o que cada caixa conta, o prazo de cada etapa, a venda resolvida
 * fora do fluxo, os filtros da página, a régua do período e a fatia de cada
 * painel) moram no serviço (`commercial_live.py`), e cada contrato chega com
 * a marca de fora do prazo já decidida. A rota agregada
 * (`commercialOverviewApi`) continua sendo a fonte dos cards e painéis.
 *
 * A postura é a das demais fontes do portal: erro alto e explicado, nunca uma
 * faixa com número errado. A validação é de FORMA (texto presente, data ISO,
 * situação dentro do contrato); os valores vêm do banco do SGI via serviço.
 */

const COMMERCIAL_LIVE_PATH = '/bi/comercial/overview'

/** Etapas da fila de ativação (as do antigo card Aguardando Ativação), como o serviço as nomeia no registro. */
export const COMMERCIAL_SALE_STAGES = ['pendente', 'assinada', 'agendada', 'cancelada'] as const

export type CommercialSaleStage = (typeof COMMERCIAL_SALE_STAGES)[number]

/**
 * Provas de sinal ligado no próprio contrato da esteira, na ordem em que o
 * serviço as manda (decisão do Mário em 28/09/2026): OS de instalação
 * concluída, OS de Ativação Remota concluída ou encerrada, equipamento do
 * contrato online e fatura emitida.
 */
export const COMMERCIAL_SIGNAL_EVIDENCE = [
  'installation_completed',
  'remote_activation',
  'equipment_online',
  'invoice_issued',
] as const

export type CommercialSignalEvidence = (typeof COMMERCIAL_SIGNAL_EVIDENCE)[number]

export type CommercialSalePersonType = 'pf' | 'pj'

/**
 * Como uma venda da esteira se resolveu fora do fluxo do SGI (decisão do
 * Mário em 28/09/2026): `signal`, há prova de sinal neste contrato;
 * `replaced`, a venda foi refeita em outro contrato do cliente, no mesmo
 * endereço, que ligou o sinal; `both`, as duas.
 */
export const COMMERCIAL_OUTSIDE_FLOW = ['signal', 'replaced', 'both'] as const

export type CommercialOutsideFlow = (typeof COMMERCIAL_OUTSIDE_FLOW)[number]

export type CommercialSaleRecord = {
  /** Código do contrato no SGI. */
  readonly id: string
  /** Situação atual no id do portal (`ativa`, `pendente`...); chave nova sai crua. */
  readonly status: string
  readonly statusKey: string | null
  /** Etapa da fila de ativação em que o contrato está hoje; null quando não aguarda. */
  readonly stage: CommercialSaleStage | null
  /** A venda conta como ativada pela regra da página: sinal ligado e situação fora da fila. */
  readonly activated: boolean
  /** Dia da venda (`contracted_at`, em UTC), ISO. */
  readonly contractedOn: string | null
  /** Dia da assinatura, ISO; null quando não registrada. Relógio do alerta da Assinada. */
  readonly signedOn: string | null
  /** Instante do registro da venda, ISO com fuso, como o serviço escreveu. */
  readonly createdAt: string | null
  /** Dia do sinal ligado (`started_at`, em UTC), ISO: a régua das ativadas. */
  readonly startedOn: string | null
  /** Instante do sinal ligado, ISO com fuso. */
  readonly startedAt: string | null
  readonly monthlyValue: number
  readonly planName: string
  readonly cityId: string
  readonly cityLabel: string
  readonly sellerId: string | null
  readonly sellerName: string | null
  /** Time principal do vendedor (`comercial`, `corporativo`) ou null. */
  readonly team: string | null
  /** Todos os times do vendedor: é por eles que o filtro de time recorta. */
  readonly teams: readonly string[]
  /** Venda com código de indicação: é da indicação, não do vendedor. */
  readonly indicated: boolean
  readonly customerKind: string | null
  readonly personType: CommercialSalePersonType | null
  readonly hasOpenOrder: boolean
  readonly hasInstallationOrder: boolean
  readonly hasUnproductiveOrder: boolean
  /** Dia da próxima visita marcada, ISO; null sem ordem aberta. */
  readonly nextVisitOn: string | null
  /** Data agendada da ÚLTIMA ordem do contrato, ISO; null sem ordem. Relógio do alerta da Agendada. */
  readonly lastVisitOn: string | null
  /** Chave do SGI do status dessa última ordem (`unproductive`, `closed`...); null sem ordem. */
  readonly lastOrderStatus: string | null
  /**
   * Só na esteira: provas de sinal ligado NESTE contrato. Com alguma, o
   * cliente já tem serviço e o SGI só não mudou a situação. Vazia fora da fila.
   */
  readonly signalEvidence: readonly CommercialSignalEvidence[]
  /**
   * Só na esteira: código do contrato do mesmo cliente, vendido no mesmo dia
   * ou depois, que ligou o sinal. A venda foi refeita nele. Null sem ele.
   */
  readonly replacedBy: string | null
  /**
   * Passou do prazo da etapa da esteira, em dias de trabalho, no dia da
   * consulta. Decidido pelo serviço; sempre falso fora da esteira e na venda
   * resolvida fora do fluxo.
   */
  readonly late: boolean
  /** A venda da esteira resolvida fora do fluxo do SGI, e como; null nas demais. */
  readonly outsideFlow: CommercialOutsideFlow | null
}

type ApiSaleRecord = Readonly<Record<string, unknown>>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function fail(message: string): never {
  throw new BiApiError(message)
}

function requiredText(value: unknown, field: string, index: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`A API devolveu ${field} vazio no contrato ${index + 1}.`)
  }
  return value
}

function nullableText(value: unknown, field: string, index: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value === '') {
    fail(`A API devolveu ${field} inválido no contrato ${index + 1}.`)
  }
  return value
}

function nullableDate(value: unknown, field: string, index: number): string | null {
  const text = nullableText(value, field, index)
  if (text !== null && !ISO_DATE.test(text)) {
    fail(`A API devolveu ${field} "${text}" fora do formato aaaa-mm-dd no contrato ${index + 1}.`)
  }
  return text
}

function requiredBoolean(value: unknown, field: string, index: number): boolean {
  if (typeof value !== 'boolean') {
    fail(`A API devolveu ${field} sem sim ou não no contrato ${index + 1}.`)
  }
  return value
}

function requiredAmount(value: unknown, field: string, index: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`A API devolveu ${field} inválido no contrato ${index + 1}.`)
  }
  return value
}

function stageOf(value: unknown, index: number): CommercialSaleStage | null {
  const text = nullableText(value, 'a etapa', index)
  if (text === null) return null
  const stage = COMMERCIAL_SALE_STAGES.find((known) => known === text)
  if (stage === undefined) {
    fail(`A API devolveu a etapa "${text}", que o portal não conhece, no contrato ${index + 1}.`)
  }
  return stage
}

function personTypeOf(value: unknown, index: number): CommercialSalePersonType | null {
  const text = nullableText(value, 'o tipo de cliente', index)
  if (text === null) return null
  if (text !== 'pf' && text !== 'pj') {
    fail(`A API devolveu o tipo de cliente "${text}", que o portal não conhece, no contrato ${index + 1}.`)
  }
  return text
}

function signalEvidenceOf(value: unknown, index: number): CommercialSignalEvidence[] {
  // Obrigatória, como a situação: sem ela a faixa contaria como fora do prazo
  // a venda que já tem sinal, e o número voltaria a ser o de antes de 28/09.
  if (!Array.isArray(value)) {
    fail(`A API respondeu sem as provas de sinal do contrato ${index + 1}: sem elas a faixa não separa o que já tem sinal.`)
  }
  return value.map((item: unknown) => {
    const evidence = COMMERCIAL_SIGNAL_EVIDENCE.find((known) => known === item)
    if (evidence === undefined) {
      fail(`A API devolveu a prova de sinal "${String(item)}", que o portal não conhece, no contrato ${index + 1}.`)
    }
    return evidence
  })
}

function teamsOf(value: unknown, index: number): string[] {
  if (!Array.isArray(value)) {
    fail(`A API devolveu os times do vendedor fora do formato de lista no contrato ${index + 1}.`)
  }
  return value.map((team, position) =>
    requiredText(team, `o time ${position + 1} do vendedor`, index),
  )
}

/** Converte um contrato da API na projeção que a faixa consome. */
function toSaleRecord(raw: ApiSaleRecord, index: number): CommercialSaleRecord {
  // Situação e ativação são OBRIGATÓRIAS: é por elas que as caixas contam, e
  // um serviço anterior a esta rota não responde por ela. Sem os dois campos
  // a faixa contaria tudo como "outras situações" sem erro nenhum.
  if (!('stage' in raw) || !('activated' in raw)) {
    fail(`A API respondeu sem a situação do contrato ${index + 1}: sem ela a faixa não pode contar.`)
  }
  // O contrato que refez a venda também (28/09/2026): nulo é resposta, mas a
  // chave ausente é serviço anterior, e as refeitas voltariam ao fora do
  // prazo sem erro nenhum.
  if (!('replaced_by' in raw)) {
    fail(
      `A API respondeu sem o campo da venda refeita no contrato ${index + 1}: sem ele a faixa não separa as vendas refeitas.`,
    )
  }

  return {
    id: requiredText(raw.id, 'o código do contrato', index),
    status: requiredText(raw.status, 'a situação', index),
    statusKey: nullableText(raw.status_key, 'a chave da situação', index),
    stage: stageOf(raw.stage, index),
    activated: requiredBoolean(raw.activated, 'a ativação', index),
    contractedOn: nullableDate(raw.contracted_on, 'o dia da venda', index),
    signedOn: nullableDate(raw.signed_on, 'o dia da assinatura', index),
    createdAt: nullableText(raw.created_at, 'a hora da venda', index),
    startedOn: nullableDate(raw.started_on, 'o dia do sinal ligado', index),
    startedAt: nullableText(raw.started_at, 'a hora do sinal ligado', index),
    monthlyValue: requiredAmount(raw.monthly_value, 'o valor mensal', index),
    planName: requiredText(raw.plan_name, 'o plano', index),
    cityId: requiredText(raw.city_id, 'o id da cidade', index),
    cityLabel: requiredText(raw.city_label, 'a cidade', index),
    sellerId: nullableText(raw.seller_id, 'o identificador do vendedor', index),
    sellerName: nullableText(raw.seller_name, 'o nome do vendedor', index),
    team: nullableText(raw.team, 'o time', index),
    teams: teamsOf(raw.teams, index),
    indicated: requiredBoolean(raw.indicated, 'a indicação', index),
    customerKind: nullableText(raw.customer_kind, 'a classificação do cliente', index),
    personType: personTypeOf(raw.person_type, index),
    hasOpenOrder: requiredBoolean(raw.has_open_order, 'a ordem aberta', index),
    hasInstallationOrder: requiredBoolean(raw.has_installation_order, 'a ordem de instalação', index),
    hasUnproductiveOrder: requiredBoolean(raw.has_unproductive_order, 'a ordem improdutiva', index),
    nextVisitOn: nullableDate(raw.next_visit_on, 'a próxima visita', index),
    lastVisitOn: nullableDate(raw.last_visit_on, 'a última visita', index),
    lastOrderStatus: nullableText(raw.last_order_status, 'o status da última visita', index),
    signalEvidence: signalEvidenceOf(raw.signal_evidence, index),
    replacedBy: nullableText(raw.replaced_by, 'o código do contrato substituto', index),
    late: requiredBoolean(raw.late, 'o fora do prazo', index),
    outsideFlow: outsideFlowOf(raw.outside_flow, index),
  }
}

function outsideFlowOf(value: unknown, index: number): CommercialOutsideFlow | null {
  const text = nullableText(value, 'a venda resolvida fora do fluxo', index)
  if (text === null) return null
  const kind = COMMERCIAL_OUTSIDE_FLOW.find((known) => known === text)
  if (kind === undefined) {
    fail(`A API devolveu a venda resolvida fora do fluxo "${text}", que o portal não conhece, no contrato ${index + 1}.`)
  }
  return kind
}

function recordsOf(value: unknown): CommercialSaleRecord[] {
  if (!Array.isArray(value)) {
    fail('A API respondeu sem a lista de contratos.')
  }
  return value.map((item, index) => toSaleRecord(item as ApiSaleRecord, index))
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function isoDateOrNull(value: unknown): string | null {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null
}

function countOf(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`A API devolveu ${field} fora do formato de contagem.`)
  }
  return value
}

function nullableCountOf(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : countOf(value, field)
}

// --- Filtros da página ------------------------------------------------------------

/**
 * Os filtros da página que valem nas listas: tudo menos o período, que cada
 * consulta recorta do seu jeito. É a forma de `CommercialOverviewFilters`.
 */
export type CommercialSalesFilters = {
  /** Cidades marcadas; lista vazia significa todas. */
  readonly cityIds: readonly string[]
  readonly team: string
  /** Vendedores marcados; lista vazia significa todos. */
  readonly sellerIds: readonly string[]
  readonly personType: string
}

/**
 * Os filtros como o serviço os recebe; o neutro não viaja. Cidade e vendedor
 * vão como parâmetro repetido, um por opção marcada.
 */
function filterParams(filters: CommercialSalesFilters) {
  return {
    city_id: filters.cityIds,
    team: filters.team === 'todos' ? null : filters.team,
    seller_id: filters.sellerIds,
    person_type: filters.personType === 'todos' ? null : filters.personType,
  }
}

// --- Hoje ao vivo -------------------------------------------------------------------

/** As cinco caixas da faixa, na ordem do fluxo, como o serviço as nomeia. */
export const COMMERCIAL_TODAY_BOXES = ['sold', 'pending', 'signed', 'scheduled', 'activated'] as const

export type CommercialTodayBoxKey = (typeof COMMERCIAL_TODAY_BOXES)[number]

/** Uma caixa contada pelo serviço. */
export type CommercialTodayCount = {
  readonly key: CommercialTodayBoxKey
  readonly count: number
  /** Fora do prazo, só nas três caixas da esteira; null nas outras. */
  readonly late: number | null
  /** Prazo da etapa em dias de trabalho, só na esteira; null nas outras. */
  readonly deadlineDays: number | null
  /** Agendadas com visita hoje; só na caixa Agendadas. */
  readonly visitsToday: number | null
  /** Ativadas hoje de vendas de dias anteriores; só na caixa Ativadas. */
  readonly soldEarlier: number | null
}

export type CommercialTodayCountsSource = {
  readonly boxes: readonly CommercialTodayCount[]
  /** Data de venda a partir da qual a esteira vale, ISO; null quando o serviço não diz. */
  readonly queueFrom: string | null
  /** Hora em que o serviço leu o banco, ISO com fuso; null quando ausente. */
  readonly generatedAt: string | null
}

type ApiTodayResponse = {
  readonly generated_at?: unknown
  readonly queue_from?: unknown
  readonly boxes?: unknown
}

function todayBoxOf(raw: unknown, index: number): CommercialTodayCount {
  const box = (raw ?? {}) as Readonly<Record<string, unknown>>
  const key = COMMERCIAL_TODAY_BOXES.find((known) => known === box.key)
  if (key === undefined) {
    fail(`A API devolveu a caixa "${String(box.key)}", que o portal não conhece, na posição ${index + 1}.`)
  }
  return {
    key,
    count: countOf(box.count, `a contagem da caixa ${key}`),
    late: nullableCountOf(box.late, `o fora do prazo da caixa ${key}`),
    deadlineDays: nullableCountOf(box.deadline_days, `o prazo da caixa ${key}`),
    visitsToday: nullableCountOf(box.visits_today, `as visitas de hoje da caixa ${key}`),
    soldEarlier: nullableCountOf(box.sold_earlier, `as vendas anteriores da caixa ${key}`),
  }
}

/**
 * As cinco caixas da faixa Hoje ao vivo, só contagens, com os filtros da
 * página menos o período. É a consulta repetida a cada minuto.
 */
export async function fetchCommercialTodayCounts(
  dayISO: string,
  filters: CommercialSalesFilters,
): Promise<CommercialTodayCountsSource> {
  const response = await fetchFromBiApi<ApiTodayResponse>(`${COMMERCIAL_LIVE_PATH}/today`, {
    day: dayISO,
    ...filterParams(filters),
  })
  if (!Array.isArray(response.boxes)) {
    fail('A API respondeu sem as caixas da faixa Hoje ao vivo.')
  }
  const boxes = response.boxes.map(todayBoxOf)
  // As cinco, uma vez cada: a faixa desenha as cinco sempre.
  if (COMMERCIAL_TODAY_BOXES.some((key) => boxes.filter((box) => box.key === key).length !== 1)) {
    fail('A API respondeu sem as cinco caixas da faixa Hoje ao vivo.')
  }

  return {
    boxes: COMMERCIAL_TODAY_BOXES.map((key) => boxes.find((box) => box.key === key)!),
    queueFrom: isoDateOrNull(response.queue_from),
    generatedAt: textOrNull(response.generated_at),
  }
}

export type CommercialSalesListSource = {
  /** Os contratos, na ordem em que o serviço os manda, que é a da lista. */
  readonly records: readonly CommercialSaleRecord[]
  /** Hora em que o serviço leu o banco, ISO com fuso; null quando ausente. */
  readonly generatedAt: string | null
}

type ApiListResponse = {
  readonly generated_at?: unknown
  readonly records?: unknown
}

/**
 * Os contratos de uma caixa da faixa Hoje ao vivo, ou só os fora do prazo
 * (`late`, o atalho do canto), pedidos quando a lista abre.
 */
export async function fetchCommercialTodayBox(
  dayISO: string,
  box: CommercialTodayBoxKey,
  late: boolean,
  filters: CommercialSalesFilters,
): Promise<CommercialSalesListSource> {
  const response = await fetchFromBiApi<ApiListResponse>(`${COMMERCIAL_LIVE_PATH}/today/records`, {
    day: dayISO,
    box,
    // Só viaja quando pedido: sem ele, a caixa inteira.
    late: late ? 'true' : null,
    ...filterParams(filters),
  })

  return { records: recordsOf(response.records), generatedAt: textOrNull(response.generated_at) }
}

// --- Contratos do período, a janela do card Vendas ativadas -------------------------

export type CommercialPeriodRange = { readonly dateFrom: string; readonly dateTo: string }

export type CommercialPeriodCountSource = {
  /** Contratos vendidos no período, pela data da venda. */
  readonly sold: number
  readonly generatedAt: string | null
}

/**
 * O serviço conta também os vendidos OU ativados (`count`) e os ativados
 * (`activated`); esta leitura traz só os vendidos.
 */
type ApiPeriodSummaryResponse = {
  readonly generated_at?: unknown
  readonly sold?: unknown
}

/** Quantos contratos foram vendidos no período, sem os contratos. Sem consumidor na página desde 06/10/2026. */
export async function fetchCommercialPeriodCount(
  range: CommercialPeriodRange,
  filters: CommercialSalesFilters,
): Promise<CommercialPeriodCountSource> {
  const response = await fetchFromBiApi<ApiPeriodSummaryResponse>(`${COMMERCIAL_LIVE_PATH}/period/summary`, {
    start_date: range.dateFrom,
    end_date: range.dateTo,
    ...filterParams(filters),
  })

  return {
    sold: countOf(response.sold, 'a contagem de vendas do período'),
    generatedAt: textOrNull(response.generated_at),
  }
}

/** Um contrato do período, com a régua por que entrou: a janela do card fica com os ativados. */
export type CommercialPeriodSaleRecord = CommercialSaleRecord & {
  /** Vendido no período: fecha com o vendido da Safra quando o período é um mês. */
  readonly soldInPeriod: boolean
  /** Ativado no período: fecha com o card Vendas ativadas. */
  readonly activatedInPeriod: boolean
}

export type CommercialPeriodSalesSource = {
  readonly records: readonly CommercialPeriodSaleRecord[]
  readonly generatedAt: string | null
}

/** Os contratos vendidos OU ativados no período, pedidos no clique do ícone do card, a venda mais recente primeiro. */
export async function fetchCommercialPeriodSales(
  range: CommercialPeriodRange,
  filters: CommercialSalesFilters,
): Promise<CommercialPeriodSalesSource> {
  const response = await fetchFromBiApi<ApiListResponse>(`${COMMERCIAL_LIVE_PATH}/period/records`, {
    start_date: range.dateFrom,
    end_date: range.dateTo,
    ...filterParams(filters),
  })
  if (!Array.isArray(response.records)) {
    fail('A API respondeu sem a lista de contratos.')
  }
  const raw = response.records as readonly ApiSaleRecord[]

  return {
    records: raw.map((item, index) => ({
      ...toSaleRecord(item, index),
      soldInPeriod: requiredBoolean(item.sold_in_period, 'a venda no período', index),
      activatedInPeriod: requiredBoolean(item.activated_in_period, 'a ativação no período', index),
    })),
    generatedAt: textOrNull(response.generated_at),
  }
}

// --- Janela da Safra e da Evolução mensal --------------------------------------------

/** O painel clicado: a Safra de vendas por mês ou a Evolução mensal das vendas. */
export type CommercialMonthPanel = 'cohort' | 'monthly'

/** Fatias da Safra, como o serviço as nomeia, na ordem da legenda. */
export const COMMERCIAL_COHORT_SLICES = [
  'activated_in_month',
  'activated_later',
  'awaiting',
  'cancelled',
  'other',
] as const

/** Grupos da Evolução mensal, como o serviço os nomeia, na ordem da legenda. */
export const COMMERCIAL_MONTHLY_SLICES = ['comercial', 'corporativo', 'unassigned'] as const

export type CommercialMonthSlice =
  | (typeof COMMERCIAL_COHORT_SLICES)[number]
  | (typeof COMMERCIAL_MONTHLY_SLICES)[number]

/** Um atalho da janela: a barra (null é o mês inteiro) e quantos contratos ela tem. */
export type CommercialMonthChipCount = {
  readonly slice: CommercialMonthSlice | null
  readonly count: number
}

export type CommercialMonthSalesSource = CommercialSalesListSource & {
  /** "Todas" e as barras do mês com contrato, na ordem da legenda; vazia sem contrato no mês. */
  readonly chips: readonly CommercialMonthChipCount[]
}

type ApiMonthResponse = ApiListResponse & { readonly chips?: unknown }

function monthChipOf(raw: unknown, panel: CommercialMonthPanel, index: number): CommercialMonthChipCount {
  const chip = (raw ?? {}) as Readonly<Record<string, unknown>>
  const known: readonly string[] = panel === 'cohort' ? COMMERCIAL_COHORT_SLICES : COMMERCIAL_MONTHLY_SLICES
  if (chip.slice !== null && (typeof chip.slice !== 'string' || !known.includes(chip.slice))) {
    fail(`A API devolveu a barra "${String(chip.slice)}", que o portal não conhece, no atalho ${index + 1}.`)
  }
  return {
    slice: chip.slice as CommercialMonthSlice | null,
    count: countOf(chip.count, `a contagem do atalho ${index + 1}`),
  }
}

/**
 * Os contratos de uma barra da Safra ou da Evolução mensal (`slice` nulo é o
 * mês inteiro), com a contagem de cada barra do mês para os atalhos.
 */
export async function fetchCommercialMonthSales(
  panel: CommercialMonthPanel,
  month: string,
  slice: CommercialMonthSlice | null,
  filters: CommercialSalesFilters,
): Promise<CommercialMonthSalesSource> {
  const response = await fetchFromBiApi<ApiMonthResponse>(`${COMMERCIAL_LIVE_PATH}/month/records`, {
    panel,
    month,
    slice,
    ...filterParams(filters),
  })
  if (!Array.isArray(response.chips)) {
    fail('A API respondeu sem os atalhos da janela de contratos.')
  }

  return {
    chips: response.chips.map((chip, index) => monthChipOf(chip, panel, index)),
    records: recordsOf(response.records),
    generatedAt: textOrNull(response.generated_at),
  }
}
