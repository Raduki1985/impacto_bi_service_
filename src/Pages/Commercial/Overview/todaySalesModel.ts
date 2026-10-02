import type { LiveBoxCorner } from '../../../components/dashboard/LiveStrip'
import type {
  CommercialOutsideFlow,
  CommercialSaleRecord,
  CommercialSaleStage,
  CommercialSignalEvidence,
  CommercialTodayBoxKey,
  CommercialTodayCount,
} from '../../../data/api/commercialRecordsSource'
import { daysBetween } from '../../../data/isoDate'
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
 *   comercial ainda não ativada, sem corte de idade: o medo do Mário é a venda
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
 * A venda da esteira que já se resolveu FORA do fluxo do SGI não conta como
 * fora do prazo (decisão do Mário em 28/09/2026): o cliente tem sinal por este
 * contrato, ou a venda foi refeita em outro contrato dele, no mesmo endereço,
 * que já ligou o sinal. Não há venda atrasada, há cadastro a corrigir no SGI;
 * o contrato continua na caixa, que espelha a situação do SGI, e o Detalhe
 * diz o motivo. Medido no dia: dos 261 fora do prazo, 17 tinham sinal e 31
 * eram refeitas, 8 delas em outro endereço, que continuam contando (pode ser
 * mudança ou segundo ponto).
 *
 * Desde 01/10/2026 tudo isso é decidido no SERVIÇO (`commercial_live.py`),
 * no molde da Visão Geral de OS: o que cada caixa conta, o prazo de cada
 * etapa, a venda resolvida fora do fluxo, os filtros da página (todos, MENOS
 * o período: a faixa é sempre de hoje) e a ordem de cada lista. A faixa
 * recebe as contagens a cada minuto e os contratos de uma caixa só quando a
 * lista abre, cada um com a marca de fora do prazo pronta. Este modelo só
 * nomeia e escreve.
 */

export type TodaySalesBoxKey = CommercialTodayBoxKey

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

/** Caixa da esteira em que o contrato está hoje, pela etapa que o serviço decidiu; null fora da fila. */
export function queueBoxOf(record: CommercialSaleRecord): TodaySalesQueueBoxKey | null {
  if (record.stage === null || record.stage === 'cancelada') return null

  return QUEUE_BOX_BY_STAGE[record.stage]
}

/** Como uma venda da esteira se resolveu fora do fluxo do SGI (o serviço decide). */
export type OutsideFlowKind = CommercialOutsideFlow

/** A agendada tem visita marcada para hoje ou depois: o Detalhe diz a visita. */
function hasVisitAhead(record: CommercialSaleRecord, today: string): boolean {
  return record.nextVisitOn !== null && record.nextVisitOn >= today
}

export type TodaySalesBox = {
  readonly key: TodaySalesBoxKey
  readonly label: string
  readonly group: TodaySalesGroup
  readonly count: number
  /** Fora do prazo, nas caixas da esteira; null nas outras duas. */
  readonly late: number | null
  /** Prazo da etapa em dias de trabalho, como o serviço mede; null fora da esteira. */
  readonly deadlineDays: number | null
  /** Linha abaixo do número. */
  readonly detail: string
}

export type TodaySalesSummary = {
  readonly boxes: readonly TodaySalesBox[]
  /** Nenhum contrato em caixa nenhuma: a faixa diz isso em vez de cinco zeros. */
  readonly empty: boolean
}

function boxDetail(count: CommercialTodayCount): string {
  switch (count.key) {
    case 'sold':
      return count.count === 1 ? 'contrato fechado hoje' : 'contratos fechados hoje'
    case 'pending':
      return 'sem assinatura'
    case 'signed':
      return 'sem instalação marcada'
    case 'scheduled': {
      const visits = count.visitsToday ?? 0

      return visits === 0 ? 'nenhuma visita hoje' : `${formatNumber(visits)} com visita hoje`
    }
    case 'activated': {
      if (count.count === 0) return 'nenhum sinal ligado ainda'
      const earlier = count.soldEarlier ?? 0

      return earlier === 0 ? 'vendidas hoje' : `${formatNumber(earlier)} de dias anteriores`
    }
  }
}

/** As cinco caixas, com nome, grupo e texto, sobre as contagens do serviço. */
export function buildTodaySalesSummary(counts: readonly CommercialTodayCount[]): TodaySalesSummary {
  const boxes = TODAY_SALES_BOXES.map((box): TodaySalesBox => {
    const count = counts.find((item) => item.key === box.key) ?? {
      key: box.key,
      count: 0,
      late: box.group === 'queue' ? 0 : null,
      deadlineDays: null,
      visitsToday: null,
      soldEarlier: null,
    }

    return {
      key: box.key,
      label: box.label,
      group: box.group,
      count: count.count,
      late: box.group === 'queue' ? (count.late ?? 0) : null,
      deadlineDays: box.group === 'queue' ? count.deadlineDays : null,
      detail: boxDetail(count),
    }
  })

  return { boxes, empty: boxes.every((box) => box.count === 0) }
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
  /**
   * A frase inteira por trás de um Detalhe curto que não se explica sozinho
   * (a venda resolvida fora do fluxo do SGI), para a dica da célula; null nos
   * demais.
   */
  readonly detailNote: string | null
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

/** Cada prova de sinal por extenso, para a dica do Detalhe. */
const SIGNAL_EVIDENCE_TEXT: Readonly<Record<CommercialSignalEvidence, string>> = {
  installation_completed: 'instalação concluída',
  remote_activation: 'OS de Ativação Remota concluída ou encerrada',
  equipment_online: 'equipamento online',
  invoice_issued: 'fatura emitida',
}

/** `a`, `a e b`, `a, b e c`. */
const EVIDENCE_LIST = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

/**
 * A visita marcada à frente da agendada: o texto da lista (`Visita hoje`,
 * `Visita em 30/09`) e o dia por extenso para a dica; null sem ela.
 */
function visitAheadOf(record: CommercialSaleRecord, today: string): { text: string; day: string } | null {
  if (!hasVisitAhead(record, today) || record.nextVisitOn === null) return null
  if (record.nextVisitOn === today) return { text: 'Visita hoje', day: 'hoje' }
  const day = dayMonthOf(record.nextVisitOn)

  return { text: `Visita em ${day}`, day }
}

/** O Detalhe curto e a frase inteira de cada jeito de a venda se resolver fora do fluxo. */
function outsideFlowTexts(kind: OutsideFlowKind, record: CommercialSaleRecord): { detail: string; note: string } {
  const evidence = EVIDENCE_LIST.format(record.signalEvidence.map((item) => SIGNAL_EVIDENCE_TEXT[item]))

  switch (kind) {
    case 'signal':
      return {
        detail: 'Com sinal, falta ativar',
        note:
          `O cliente já tem sinal por este contrato (${evidence}), mas o SGI não mudou a situação ` +
          'para Ativa. Não conta como fora do prazo: a correção é no SGI.',
      }
    case 'replaced':
      // A dica nomeia os DOIS contratos ("este", logo depois do código do
      // outro, podia ser lido como ele) e não manda encerrar às cegas: no
      // mesmo endereço, o outro pode ser um serviço a mais, de outro plano.
      return {
        detail: `Refeita no ${record.replacedBy}`,
        note:
          `A venda foi refeita no contrato ${record.replacedBy}, do mesmo cliente e no mesmo ` +
          `endereço, que já está com sinal. Não conta como fora do prazo: confira no SGI se o ` +
          `contrato ${record.id} sobrou e, se sim, encerre.`,
      }
    case 'both':
      // Mandar ativar este sem olhar o outro deixaria o cliente com dois
      // contratos ativos e duas cobranças.
      return {
        detail: 'Com sinal e refeita',
        note:
          `Este contrato tem sinal (${evidence}), e a venda também foi refeita no contrato ` +
          `${record.replacedBy}, do mesmo cliente e no mesmo endereço, que já está com sinal. Não ` +
          'conta como fora do prazo: confira no SGI qual dos dois fica antes de ativar ou encerrar.',
      }
  }
}

/**
 * Detalhe da venda resolvida fora do fluxo do SGI, curto para caber na coluna,
 * e a frase inteira para a dica. Na agendada com visita marcada, a visita vem
 * primeiro, como nas demais (a caixa conta "N com visita hoje"), com o motivo
 * junto: visita em contrato que já tem sinal, ou refeito, é técnico indo à
 * toa. Null quando a venda não é desse caso.
 */
function outsideFlowDetail(record: CommercialSaleRecord, today: string): { detail: string; note: string } | null {
  const kind = record.outsideFlow
  if (kind === null) return null
  const texts = outsideFlowTexts(kind, record)
  const visit = visitAheadOf(record, today)
  if (visit === null) return texts

  return {
    detail: `${visit.text}, ${kind === 'replaced' ? 'refeita' : 'com sinal'}`,
    note: `Visita marcada para ${visit.day}: confira antes de mandar o técnico. ${texts.note}`,
  }
}

function detailOf(record: CommercialSaleRecord, today: string): string | null {
  if (record.activated && record.stage === null) {
    const clock = activationClockOf(record)
    if (record.startedOn !== null && record.startedOn !== today) return `Sinal em ${dayMonthOf(record.startedOn)}`

    return clock === null ? 'Sinal ligado' : `Sinal às ${clock}`
  }

  const outside = outsideFlowDetail(record, today)
  if (outside !== null) return outside.detail

  switch (queueBoxOf(record)) {
    case 'pending':
      return waitingText(record.contractedOn, today, 'assinar', 'Aguarda assinatura')
    case 'signed':
      return waitingText(record.signedOn ?? record.contractedOn, today, 'agendar', 'Aguarda agendamento')
    case 'scheduled':
      return visitAheadOf(record, today)?.text ?? lastVisitDetail(record)
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
    detailNote: outsideFlowDetail(record, today)?.note ?? null,
    // Decidido pelo serviço, no dia da consulta: o mesmo que a caixa contou.
    late: record.late,
    source: record,
  }
}

/**
 * Linhas da lista aberta, na ordem em que o serviço manda os contratos, que
 * é a da pergunta de cada caixa: nas Vendidas, a venda mais recente primeiro
 * (o que acabou de entrar); nas Ativadas, o sinal mais recente primeiro; na
 * esteira, a venda mais ANTIGA primeiro, porque é a que está esquecida há
 * mais tempo. Quem quiser outra ordem tem o cabeçalho de cada coluna.
 */
export function buildTodaySalesRows(records: readonly CommercialSaleRecord[], today: string): TodaySaleRow[] {
  return records.map((record) => toSaleRow(record, today))
}

/** Texto do atalho do canto, sem o clique: o que a caixa mostra e como o lê quem não vê. */
export type TodaySalesCornerText = Omit<LiveBoxCorner, 'onClick'>

/** `2 dias`, `1 dia`: o prazo da etapa como o serviço o mede. */
function daysText(days: number): string {
  return days === 1 ? '1 dia' : `${formatNumber(days)} dias`
}

/** O que cada prazo mede, por extenso, para a dica e a leitura acessível. */
const DEADLINE_SENTENCES: Readonly<
  Record<TodaySalesQueueBoxKey, (count: string, one: boolean, days: string) => string>
> = {
  pending: (count, one, days) =>
    one
      ? `1 venda sem assinatura há ${days} ou mais`
      : `${count} vendas sem assinatura há ${days} ou mais`,
  signed: (count, one, days) =>
    one
      ? `1 venda assinada há ${days} ou mais sem instalação marcada`
      : `${count} vendas assinadas há ${days} ou mais sem instalação marcada`,
  scheduled: (count, one) =>
    one
      ? '1 venda com a data da visita vencida, sem sinal e sem outra visita marcada'
      : `${count} vendas com a data da visita vencida, sem sinal e sem outra visita marcada`,
}

/**
 * Texto do atalho no canto de uma caixa da esteira: "181 fora do prazo", em
 * cor de atenção, no formato dos atalhos da faixa de OS (número mais uma
 * qualificação). A frase inteira, com o prazo que o serviço mede
 * (`deadlineDays`), vai para a dica e para a leitura acessível. Sem nenhum
 * contrato fora do prazo, não há atalho.
 */
export function lateCornerLabel(
  box: TodaySalesQueueBoxKey,
  late: number,
  deadlineDays: number,
): TodaySalesCornerText | null {
  if (late === 0) return null
  const count = formatNumber(late)
  const sentence = DEADLINE_SENTENCES[box](count, late === 1, daysText(deadlineDays))

  // A exceção de 28/09/2026 vai na dica: quem conferir no SGI acha mais
  // contratos parados na etapa do que o número do atalho.
  return {
    label: `${count} fora do prazo`,
    title: `${sentence}, sem contar domingo nem a venda com sinal ou refeita em outro contrato. Abrir a lista.`,
    accessibleLabel: `${sentence}, fora do prazo, ver na lista`,
    attention: true,
  }
}
