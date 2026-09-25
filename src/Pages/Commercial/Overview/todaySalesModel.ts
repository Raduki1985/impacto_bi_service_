import type { LiveBoxCorner } from '../../../components/dashboard/LiveStrip'
import type {
  CommercialSaleRecord,
  CommercialSaleStage,
} from '../../../data/api/commercialRecordsSource'
import { daysBetween, shiftISODate, weekdayOf } from '../../../data/isoDate'
import { formatDateBr, formatIsoClock, formatNumber } from '../../../lib/formatters'
import { commercialSaleStatusLabels } from '../SalesPeriod/salesPeriodModel'
import type { CommercialOverviewFilters } from './overviewModel'

/**
 * Modelo da faixa "Hoje ao vivo" da Visão Geral Comercial: a ESTEIRA das
 * vendas, desenhada com o Mário em 25/09/2026 depois de mapearmos juntos o
 * fluxo da venda e quem age em cada etapa.
 *
 * A venda conta quando o sinal liga, e costuma levar 1 dia para ativar. Por
 * isso o dia comercial tem duas turmas, e o quadro as separa, da esquerda
 * para a direita, na ordem em que o contrato anda:
 *
 * - ENTROU HOJE: Vendidas, os contratos fechados hoje;
 * - NA ESTEIRA: Pendentes (o cliente ainda não assinou; quem cobra é o
 *   vendedor), Assinadas (falta marcar a instalação; quem marca é o próprio
 *   cliente pelo app ou o COP) e Agendadas (instalação marcada; a visita que
 *   dá errado é assunto da Central). A esteira vale para TODA venda da base
 *   comercial ainda sem sinal, sem corte de idade: o medo do Mário é a venda
 *   que se perde por meses por esquecimento, e em 25/09/2026 mais da metade
 *   da fila de 2026 tinha mais de 30 dias;
 * - VIROU CLIENTE HOJE: Ativadas, os sinais ligados hoje, quase todos de
 *   vendas de dias anteriores.
 *
 * O alerta de cada etapa da esteira é "a próxima coisa não aconteceu no
 * prazo" (regra do Mário, 25/09/2026), em DIAS DE TRABALHO, porque a empresa
 * não trabalha no domingo: Pendente, 2 dias depois da venda sem assinatura;
 * Assinada, 2 dias depois da assinatura sem instalação marcada; Agendada, 1
 * dia depois da data da visita sem sinal e sem outra visita marcada. O dia
 * da visita em si NÃO acende alerta: até as 15h só 70% das instalações do
 * dia estão concluídas (setembro/2026), e o dia corrente é da faixa de OS.
 * Feriado conta como dia de trabalho: o portal ainda não tem o calendário.
 *
 * A situação de cada contrato vem do serviço, pelas mesmas contas dos cards
 * (`stage` e `activated`); este modelo só distribui, mede o prazo e escreve.
 * Os filtros da página valem aqui, MENOS o período: a faixa é sempre de hoje.
 */

export type TodaySalesBoxKey = 'sold' | 'pending' | 'signed' | 'scheduled' | 'activated'

/** Caixas da esteira, as que têm prazo. */
export type TodaySalesQueueBoxKey = Extract<TodaySalesBoxKey, 'pending' | 'signed' | 'scheduled'>

/** A caixa é da esteira, e por isso tem prazo e atalho de fora do prazo. */
export function isQueueBoxKey(key: TodaySalesBoxKey): key is TodaySalesQueueBoxKey {
  return key === 'pending' || key === 'signed' || key === 'scheduled'
}

export type TodaySalesGroup = 'in' | 'queue' | 'out'

/** As cinco caixas, na ordem do fluxo, cada uma no seu grupo. */
export const TODAY_SALES_BOXES = [
  { key: 'sold', label: 'Vendidas', group: 'in' },
  { key: 'pending', label: 'Pendentes', group: 'queue' },
  { key: 'signed', label: 'Assinadas', group: 'queue' },
  { key: 'scheduled', label: 'Agendadas', group: 'queue' },
  { key: 'activated', label: 'Ativadas', group: 'out' },
] as const satisfies readonly { key: TodaySalesBoxKey; label: string; group: TodaySalesGroup }[]

const QUEUE_BOX_BY_STAGE: Readonly<Record<Exclude<CommercialSaleStage, 'cancelada'>, TodaySalesQueueBoxKey>> = {
  pendente: 'pending',
  assinada: 'signed',
  agendada: 'scheduled',
}

/**
 * Prazo de cada etapa da esteira, em dias de trabalho (regra do Mário em
 * 25/09/2026). Medido no SGI no mesmo dia: 87,5% dos clientes assinam no dia
 * da venda e 95,6% até o dia seguinte; a OS de instalação nasce até 1 dia
 * depois da venda em 90% dos contratos.
 */
export const QUEUE_DEADLINE_DAYS: Readonly<Record<TodaySalesQueueBoxKey, number>> = {
  pending: 2,
  signed: 2,
  scheduled: 1,
}

/**
 * Dias de trabalho entre duas datas: os dias DEPOIS de `from` até `to`,
 * inclusive, sem contar domingo. Vendeu na sexta, na segunda são 2 (sábado
 * e segunda). Zero quando `to` não passa de `from`.
 */
export function workingDaysSince(from: string, to: string): number {
  const total = daysBetween(from, to)
  let count = 0
  for (let offset = 1; offset <= total; offset += 1) {
    if (weekdayOf(shiftISODate(from, offset)) !== 0) count += 1
  }

  return count
}

/** Caixa da esteira em que o contrato está hoje; null quando ele não está na fila. */
export function queueBoxOf(record: CommercialSaleRecord): TodaySalesQueueBoxKey | null {
  if (record.stage === null || record.stage === 'cancelada') return null

  return QUEUE_BOX_BY_STAGE[record.stage]
}

/** A agendada tem visita marcada para hoje ou depois: ela está andando. */
function hasVisitAhead(record: CommercialSaleRecord, today: string): boolean {
  return record.nextVisitOn !== null && record.nextVisitOn >= today
}

/**
 * De quando o prazo da etapa conta: a venda na Pendente, a assinatura na
 * Assinada (a venda, quando a assinatura não foi registrada) e a última
 * visita na Agendada (a venda, quando nunca houve ordem). Null quando a
 * etapa não tem relógio: a agendada com visita marcada à frente.
 */
function deadlineStartOf(record: CommercialSaleRecord, today: string): string | null {
  switch (queueBoxOf(record)) {
    case 'pending':
      return record.contractedOn
    case 'signed':
      return record.signedOn ?? record.contractedOn
    case 'scheduled':
      return hasVisitAhead(record, today) ? null : (record.lastVisitOn ?? record.contractedOn)
    case null:
      return null
  }
}

/** A etapa passou do prazo: a próxima coisa não aconteceu a tempo. */
export function isLate(record: CommercialSaleRecord, today: string): boolean {
  const box = queueBoxOf(record)
  const start = deadlineStartOf(record, today)
  if (box === null || start === null) return false

  return workingDaysSince(start, today) >= QUEUE_DEADLINE_DAYS[box]
}

/** Contrato na caixa: o que cada uma conta, pelas duas réguas da página e pela fila. */
export function inBox(record: CommercialSaleRecord, box: TodaySalesBoxKey, today: string): boolean {
  switch (box) {
    case 'sold':
      return record.contractedOn === today
    case 'activated':
      return record.activated && record.startedOn === today
    default:
      return queueBoxOf(record) === box
  }
}

export type TodaySalesBox = {
  readonly key: TodaySalesBoxKey
  readonly label: string
  readonly group: TodaySalesGroup
  readonly count: number
  /** Fora do prazo, nas caixas da esteira; null nas outras duas. */
  readonly late: number | null
  /** Linha abaixo do número. */
  readonly detail: string
}

export type TodaySalesSummary = {
  readonly boxes: readonly TodaySalesBox[]
  /** Nenhum contrato em caixa nenhuma: a faixa diz isso em vez de cinco zeros. */
  readonly empty: boolean
}

function boxDetail(box: TodaySalesBoxKey, rows: readonly CommercialSaleRecord[], today: string): string {
  switch (box) {
    case 'sold':
      return rows.length === 1 ? 'contrato fechado hoje' : 'contratos fechados hoje'
    case 'pending':
      return 'sem assinatura'
    case 'signed':
      return 'sem instalação marcada'
    case 'scheduled': {
      const visits = rows.filter((row) => row.nextVisitOn === today).length

      return visits === 0 ? 'nenhuma visita hoje' : `${formatNumber(visits)} com visita hoje`
    }
    case 'activated': {
      if (rows.length === 0) return 'nenhum sinal ligado ainda'
      const earlier = rows.filter((row) => row.contractedOn !== null && row.contractedOn < today).length

      return earlier === 0 ? 'vendidas hoje' : `${formatNumber(earlier)} de dias anteriores`
    }
  }
}

/** As cinco caixas sobre os contratos já filtrados pela página. */
export function buildTodaySalesSummary(
  records: readonly CommercialSaleRecord[],
  today: string,
): TodaySalesSummary {
  const boxes = TODAY_SALES_BOXES.map((box): TodaySalesBox => {
    const rows = records.filter((record) => inBox(record, box.key, today))

    return {
      key: box.key,
      label: box.label,
      group: box.group,
      count: rows.length,
      late: box.group === 'queue' ? rows.filter((row) => isLate(row, today)).length : null,
      detail: boxDetail(box.key, rows, today),
    }
  })

  return { boxes, empty: boxes.every((box) => box.count === 0) }
}

/** Campos da página que valem para a faixa: tudo, menos o período. */
export const TODAY_SALES_FILTER_FIELDS = [
  'cityId',
  'team',
  'sellerId',
  'personType',
] as const satisfies readonly (keyof CommercialOverviewFilters)[]

/** Um filtro da página casa com o contrato? A mesma regra do serviço para a página agregada. */
function matchesTodaySalesField(
  record: CommercialSaleRecord,
  field: (typeof TODAY_SALES_FILTER_FIELDS)[number],
  filters: CommercialOverviewFilters,
): boolean {
  switch (field) {
    case 'cityId':
      return filters.cityId === null || record.cityId === filters.cityId
    case 'team':
      return filters.team === 'todos' || record.teams.includes(filters.team)
    case 'sellerId':
      // Venda com indicação é da indicação, não de quem a registrou: com um
      // vendedor escolhido ela fica de fora, como nos cards e no Top 5.
      return (
        filters.sellerId === null || (record.sellerId === filters.sellerId && !record.indicated)
      )
    case 'personType':
      return filters.personType === 'todos' || record.personType === filters.personType
  }
}

export function applyTodaySalesFilters(
  records: readonly CommercialSaleRecord[],
  filters: CommercialOverviewFilters,
): CommercialSaleRecord[] {
  return records.filter((record) =>
    TODAY_SALES_FILTER_FIELDS.every((field) => matchesTodaySalesField(record, field, filters)),
  )
}

/** true quando algum filtro que vale para hoje está diferente do neutro. */
export function hasTodaySalesFilters(filters: CommercialOverviewFilters): boolean {
  return (
    filters.cityId !== null ||
    filters.team !== 'todos' ||
    filters.sellerId !== null ||
    filters.personType !== 'todos'
  )
}

/**
 * Lista aberta: a de uma caixa inteira, ou só as fora do prazo, que é o que
 * o atalho do canto abre. A caixa continua marcada como aberta nas duas.
 */
export type TodaySalesSelection = {
  readonly box: TodaySalesBoxKey
  readonly late: boolean
}

/** Identidade da lista aberta: trocar de lista monta outra tabela. */
export function todaySalesSelectionKey(selection: TodaySalesSelection): string {
  return selection.late ? `${selection.box}:late` : selection.box
}

/** Nome da lista aberta, no cabeçalho da tabela. */
export function todaySalesListLabel(selection: TodaySalesSelection): string {
  const label = TODAY_SALES_BOXES.find((box) => box.key === selection.box)?.label ?? selection.box

  return selection.late ? `${label} fora do prazo` : label
}

/** Um contrato na lista que a caixa aberta mostra. */
export type TodaySaleRow = {
  /** Código do contrato no SGI, que é o que o gestor procura lá. */
  readonly id: string
  /** Dia da venda, ISO; null quando o contrato não tem. */
  readonly soldOn: string | null
  /** Hora em que a venda foi registrada (`14h32`); null quando o serviço não a tem. */
  readonly time: string | null
  readonly seller: string | null
  /** Time do vendedor por extenso; null sem time. */
  readonly team: string | null
  readonly city: string
  readonly plan: string
  readonly value: number
  readonly personType: 'pf' | 'pj' | null
  /** Situação por extenso (`Pendente`, `Ativa`...), o rótulo da página. */
  readonly status: string
  /** O que se sabe da etapa: a hora do sinal, a visita, há quanto tempo espera. */
  readonly detail: string | null
  /** Passou do prazo da etapa: a célula do Detalhe leva a marca de atenção. */
  readonly late: boolean
  readonly source: CommercialSaleRecord
}

const TEAM_LABELS: Readonly<Record<string, string>> = {
  comercial: 'Comercial',
  corporativo: 'Corporativo',
}

export function teamLabelOf(team: string | null): string | null {
  if (team === null) return null

  return TEAM_LABELS[team] ?? team
}

function statusLabelOf(status: string): string {
  return (commercialSaleStatusLabels as Readonly<Record<string, string>>)[status] ?? status
}

/** `dd/mm` de uma data ISO: o ano não cabe no Detalhe. */
function dayMonthOf(iso: string): string {
  return formatDateBr(iso).slice(0, 5)
}

/**
 * Hora do sinal ligado, quando o SGI a gravou de verdade. Até agosto/2026 o
 * sinal vinha só com a data (meia-noite), e "às 00h00" seria mentira.
 */
function activationClockOf(record: CommercialSaleRecord): string | null {
  const clock = formatIsoClock(record.startedAt)

  return clock === null || clock === '00h00' ? null : clock
}

/**
 * Há quanto tempo a etapa espera, no calendário, que é como se fala: "12
 * dias sem assinar". No mesmo dia, o que a etapa aguarda. Curto de propósito:
 * a coluna Detalhe tem largura fixa, e a Situação ao lado já diz a etapa.
 */
function waitingText(from: string | null, today: string, doing: string, waiting: string): string {
  const days = from === null ? 0 : daysBetween(from, today)
  if (days <= 0) return waiting

  return days === 1 ? `1 dia sem ${doing}` : `${formatNumber(days)} dias sem ${doing}`
}

/** Status de ordem de serviço ainda aberta, a mesma lista do serviço. */
const OPEN_ORDER_STATUS_KEYS: ReadonlySet<string> = new Set([
  'pending',
  'scheduled',
  'rescheduled',
  'in_motion',
  'arrived',
  'checklist',
  'provision',
  'pending_approval',
])

/** O que aconteceu com a agendada que não tem visita à frente: a última visita dela. */
function lastVisitDetail(record: CommercialSaleRecord): string {
  if (record.lastVisitOn === null) return 'Sem visita marcada'
  const day = dayMonthOf(record.lastVisitOn)

  switch (record.lastOrderStatus) {
    case 'unproductive':
      return `Improdutiva em ${day}`
    case 'closed':
      return `OS encerrada em ${day}`
    case 'expired':
      return `OS vencida em ${day}`
    case 'completed':
      return 'Concluída, sem sinal'
    default:
      return record.lastOrderStatus !== null && OPEN_ORDER_STATUS_KEYS.has(record.lastOrderStatus)
        ? `Aberta desde ${day}`
        : `Última visita em ${day}`
  }
}

function detailOf(record: CommercialSaleRecord, today: string): string | null {
  if (record.activated && record.stage === null) {
    const clock = activationClockOf(record)
    if (record.startedOn !== null && record.startedOn !== today) return `Sinal em ${dayMonthOf(record.startedOn)}`

    return clock === null ? 'Sinal ligado' : `Sinal às ${clock}`
  }

  switch (queueBoxOf(record)) {
    case 'pending':
      return waitingText(record.contractedOn, today, 'assinar', 'Aguarda assinatura')
    case 'signed':
      return waitingText(record.signedOn ?? record.contractedOn, today, 'agendar', 'Aguarda agendamento')
    case 'scheduled': {
      if (record.nextVisitOn === today) return 'Visita hoje'
      if (hasVisitAhead(record, today) && record.nextVisitOn !== null) {
        return `Visita em ${dayMonthOf(record.nextVisitOn)}`
      }

      return lastVisitDetail(record)
    }
    case null:
      return null
  }
}

/**
 * Um contrato como linha de lista. Exportada desde 25/09/2026: a janela da
 * Safra e da Evolução mensal (`salesListModel`) mostra o contrato com o mesmo
 * texto, o mesmo Detalhe e a mesma marca de fora do prazo desta faixa.
 */
export function toSaleRow(record: CommercialSaleRecord, today: string): TodaySaleRow {
  return {
    id: record.id,
    soldOn: record.contractedOn,
    time: formatIsoClock(record.createdAt),
    seller: record.sellerName,
    team: teamLabelOf(record.team),
    city: record.cityLabel,
    plan: record.planName,
    value: record.monthlyValue,
    personType: record.personType,
    status: statusLabelOf(record.status),
    detail: detailOf(record, today),
    late: isLate(record, today),
    source: record,
  }
}

const byPtBr = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

/** A mais recente primeiro, por um instante ISO; empate pelo código. */
function mostRecentFirst(instantOf: (record: CommercialSaleRecord) => string | null) {
  return (a: TodaySaleRow, b: TodaySaleRow) =>
    (instantOf(b.source) ?? '').localeCompare(instantOf(a.source) ?? '') || byPtBr(a.id, b.id)
}

/** A venda mais antiga primeiro: na esteira, a mais esquecida fica em cima. */
export function oldestSaleFirst(a: TodaySaleRow, b: TodaySaleRow): number {
  return (
    (a.soldOn ?? '').localeCompare(b.soldOn ?? '') ||
    (a.source.createdAt ?? '').localeCompare(b.source.createdAt ?? '') ||
    byPtBr(a.id, b.id)
  )
}

/**
 * Linhas da lista aberta, sobre os contratos já filtrados pela página.
 *
 * A ordem acompanha a pergunta de cada caixa: nas Vendidas, a venda mais
 * recente primeiro (o que acabou de entrar); nas Ativadas, o sinal mais
 * recente primeiro; na esteira, a venda mais ANTIGA primeiro, porque é a que
 * está esquecida há mais tempo. Quem quiser outra ordem tem o cabeçalho de
 * cada coluna.
 */
export function buildTodaySalesRows(
  records: readonly CommercialSaleRecord[],
  selection: TodaySalesSelection,
  today: string,
): TodaySaleRow[] {
  const rows = records
    .filter((record) => inBox(record, selection.box, today))
    .map((record) => toSaleRow(record, today))
    .filter((row) => !selection.late || row.late)

  if (selection.box === 'sold') return rows.sort(mostRecentFirst((record) => record.createdAt))
  if (selection.box === 'activated') return rows.sort(mostRecentFirst((record) => record.startedAt))

  return rows.sort(oldestSaleFirst)
}

/** Texto do atalho do canto, sem o clique: o que a caixa mostra e como o lê quem não vê. */
export type TodaySalesCornerText = Omit<LiveBoxCorner, 'onClick'>

/** O que cada prazo mede, por extenso, para a dica e a leitura acessível. */
const DEADLINE_SENTENCES: Readonly<Record<TodaySalesQueueBoxKey, (count: string, one: boolean) => string>> = {
  pending: (count, one) =>
    one
      ? '1 venda sem assinatura há 2 dias ou mais'
      : `${count} vendas sem assinatura há 2 dias ou mais`,
  signed: (count, one) =>
    one
      ? '1 venda assinada há 2 dias ou mais sem instalação marcada'
      : `${count} vendas assinadas há 2 dias ou mais sem instalação marcada`,
  scheduled: (count, one) =>
    one
      ? '1 venda com a data da visita vencida, sem sinal e sem outra visita marcada'
      : `${count} vendas com a data da visita vencida, sem sinal e sem outra visita marcada`,
}

/**
 * Texto do atalho no canto de uma caixa da esteira: "181 fora do prazo", em
 * cor de atenção, no formato dos atalhos da faixa de OS (número mais uma
 * qualificação). A frase inteira, com o prazo, vai para a dica e para a
 * leitura acessível. Sem nenhum contrato fora do prazo, não há atalho.
 */
export function lateCornerLabel(box: TodaySalesQueueBoxKey, late: number): TodaySalesCornerText | null {
  if (late === 0) return null
  const count = formatNumber(late)
  const sentence = DEADLINE_SENTENCES[box](count, late === 1)

  return {
    label: `${count} fora do prazo`,
    title: `${sentence}, sem contar domingo. Abrir a lista.`,
    accessibleLabel: `${sentence}, fora do prazo, ver na lista`,
    attention: true,
  }
}
