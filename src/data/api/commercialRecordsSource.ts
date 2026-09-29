import { BiApiError, fetchFromBiApi } from './biApiClient'

/**
 * Contratos da Visão Geral Comercial vindos da API, um por linha
 * (`GET /bi/commercial/overview/records`).
 *
 * É a fonte da faixa Hoje ao vivo daquela página (25/09/2026): o portal pede
 * o dia de hoje a cada minuto, separa as vendas do dia por situação e aponta
 * as ativações do dia que vieram de vendas anteriores. A rota agregada
 * (`commercialOverviewApi`) continua sendo a fonte dos cards e painéis; esta
 * responde QUAIS contratos, e a situação de cada um já vem decidida pelo
 * serviço, pelas mesmas contas dos cards (`stage` e `activated`).
 *
 * A postura é a das demais fontes do portal: erro alto e explicado, nunca uma
 * faixa com número errado. A validação é de FORMA (texto presente, data ISO,
 * situação dentro do contrato); os valores vêm do banco do SGI via serviço.
 */

const COMMERCIAL_RECORDS_PATH = '/bi/comercial/overview/records'

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
}

export type CommercialSalesDaySource = {
  readonly records: readonly CommercialSaleRecord[]
  /**
   * Com a esteira pedida, a data de venda a partir da qual ela vale (o início
   * da base comercial), ISO; null sem a esteira ou quando o serviço não diz.
   */
  readonly queueFrom: string | null
  /** Hora em que o serviço leu o banco, ISO com fuso; null quando ausente. */
  readonly generatedAt: string | null
  /** Data da última alteração em qualquer contrato, ISO; null quando ausente. */
  readonly updatedAt: string | null
}

type ApiSaleRecord = Readonly<Record<string, unknown>>

type ApiRecordsResponse = {
  readonly generated_at?: unknown
  readonly source?: { readonly updated_at?: unknown }
  readonly filters?: { readonly queue_from?: unknown }
  readonly records?: unknown
}

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
  }
}

/**
 * Busca os contratos vendidos ou ativados numa janela curta, já validados, e
 * com `includeQueue` a esteira inteira: toda venda da base comercial que
 * ainda está na fila, sem corte de idade (decisão do Mário em 25/09/2026).
 *
 * É a consulta da faixa Hoje ao vivo: o dia de hoje com a esteira, repetida
 * a cada minuto. Um dia sem contrato é resultado, não erro.
 */
export async function fetchCommercialSalesDay(
  dateISO: string,
  { dateToISO = dateISO, includeQueue = false }: { dateToISO?: string; includeQueue?: boolean } = {},
): Promise<CommercialSalesDaySource> {
  const response = await fetchFromBiApi<ApiRecordsResponse>(COMMERCIAL_RECORDS_PATH, {
    date_from: dateISO,
    date_to: dateToISO,
    // O parâmetro só viaja quando pedido: sem ele, o serviço responde só a janela.
    include_queue: includeQueue ? 'true' : null,
  })
  const rawRecords = response.records

  if (!Array.isArray(rawRecords)) {
    fail('A API respondeu sem a lista de contratos.')
  }

  const updatedAt = response.source?.updated_at
  const generatedAt = response.generated_at
  const queueFrom = response.filters?.queue_from
  return {
    records: rawRecords.map((item, index) => toSaleRecord(item as ApiSaleRecord, index)),
    queueFrom: typeof queueFrom === 'string' && ISO_DATE.test(queueFrom) ? queueFrom : null,
    generatedAt: typeof generatedAt === 'string' && generatedAt !== '' ? generatedAt : null,
    updatedAt: typeof updatedAt === 'string' && ISO_DATE.test(updatedAt) ? updatedAt : null,
  }
}
