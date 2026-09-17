import { formatNumber } from '../../../lib/formatters'
import type { OverviewAwaitingActivation, OverviewAwaitingStage } from './overviewModel'

/**
 * Textos do card Aguardando Ativação.
 *
 * Moram aqui, e não na página, pelo mesmo motivo dos textos do Tempo até a
 * ativação: são regras de leitura decididas com o Mário em 16/09/2026, com
 * casos de borda que a base sintética nunca produz (nada vendido, um contrato
 * só, nada aguardando) e que o teste precisa cobrir um a um. Quem lê é gestão,
 * então as frases falam de vendido e ativado, nunca de status ou de campo.
 *
 * As frases dizem "aguardam ativação", que é o nome do indicador, e nunca
 * "não foram ativados": reprovada, expirada e não sincronizada ficam fora da
 * conta por decisão, então o complemento do vendido não é só ativação. O texto
 * afirma o que o número conta, e nada além.
 *
 * O que a leitura faz, decisão do Mário em 17/09/2026: narra o fluxo em
 * AÇÕES. A frente mostra as etapas com o nome do status; a leitura traduz
 * cada uma no que falta acontecer: precisam de assinatura, precisam agendar,
 * têm visita marcada ou precisam reagendar depois de uma improdutiva,
 * desistiram. Fecha com quantas do período já ativaram.
 *
 * O card NÃO fala de prazo: prazo não é assunto deste card, que mostra onde a
 * venda está. Tempo é do card Tempo até a ativação, ao lado, e por isso
 * nenhuma frase aqui chama contrato de atrasado.
 *
 * Todas são curtas de propósito: a 1280 px a leitura tem cerca de 156 px de
 * largura, e a leitura mais longa da fileira é quem manda na altura dos cinco
 * cards, mesmo fechada.
 */

/** A régua do card, dita uma vez, no Observar. */
export const AWAITING_RULE = 'A conta usa a data da venda e a situação de hoje no SGI'

/**
 * Bloco Observar: a régua da conta e a ressalva que vale em qualquer recorte.
 *
 * A ressalva existe porque o número inclui venda de ontem, que vai ativar no
 * ritmo normal e não é problema. Sem prazo no card, é isso que a gestão
 * precisa saber para não ler a fila inteira como atraso.
 */
const OBSERVE = `${AWAITING_RULE}. Venda recente ainda vai ativar no ritmo normal.`

/**
 * Título da leitura gerencial, em português também com zero e com um.
 *
 * "Vendidos" sem "contratos" poupa uma linha: com a palavra inteira o título
 * passava a três linhas a 1280 px.
 */
export function awaitingReadingTitle(card: OverviewAwaitingActivation): string {
  const { sold, awaiting } = card

  if (sold === 0) return 'Nenhum contrato foi vendido no recorte.'
  if (awaiting === 0) return 'Nenhum contrato vendido no período aguarda ativação.'
  if (sold === 1) return 'O único contrato vendido no período aguarda ativação.'
  if (awaiting === 1) return `1 dos ${formatNumber(sold)} vendidos no período aguarda ativação.`
  return `${formatNumber(awaiting)} dos ${formatNumber(sold)} vendidos no período aguardam ativação.`
}

/** Número em destaque, no formato da leitura. */
function n(value: number): string {
  return `{${formatNumber(value)}}`
}

/** Frase da etapa Pendente: vendido, o cliente ainda não assinou. */
function pendingSentence(stage: OverviewAwaitingStage): string | null {
  if (stage.count === 0) return null
  return stage.count === 1
    ? `${n(1)} precisa de assinatura.`
    : `${n(stage.count)} precisam de assinatura.`
}

/** Frase da etapa Assinada: assinou, falta marcar a instalação. */
function signedSentence(stage: OverviewAwaitingStage): string | null {
  if (stage.count === 0) return null
  return stage.count === 1
    ? `${n(1)} assinou e precisa agendar.`
    : `${n(stage.count)} assinaram e precisam agendar.`
}

/**
 * Frase da etapa Agendada, a única com duas situações dentro.
 *
 * Com a medida da fonte, separa quem tem visita marcada de quem espera nova
 * visita, e diz quantas dessas precisam reagendar depois de uma improdutiva.
 * Sem a medida, diz só a contagem: meia medida não vira frase.
 */
function scheduledSentence(stage: OverviewAwaitingStage): string | null {
  if (stage.count === 0) return null

  const { count, scheduledVisit, needsReschedule } = stage
  if (scheduledVisit === null || needsReschedule === null) {
    return count === 1 ? `${n(1)} está agendada.` : `${n(count)} estão agendadas.`
  }

  const waiting = count - scheduledVisit
  const parts: string[] = []
  if (scheduledVisit > 0) {
    parts.push(
      scheduledVisit === 1 ? `${n(1)} tem visita marcada` : `${n(scheduledVisit)} têm visita marcada`,
    )
  }
  if (waiting > 0) {
    parts.push(waiting === 1 ? `${n(1)} espera nova visita` : `${n(waiting)} esperam nova visita`)
  }

  const head =
    count === 1 ? `A única agendada ${parts[0]?.replace(/^\{1\} /, '')}` : `Das ${n(count)} agendadas, ${parts.join(' e ')}`
  // Com uma agendada só, "1 delas" não faz sentido: a frase diz direto.
  const reschedule =
    needsReschedule === 0
      ? ''
      : count === 1
        ? ' depois de uma visita improdutiva'
        : needsReschedule === 1
          ? ', 1 delas para reagendar depois de uma improdutiva'
          : `, ${n(needsReschedule)} delas para reagendar depois de improdutiva`

  return `${head}${reschedule}.`
}

/** Frase da etapa Cancelada: desistiu antes de instalar. */
function cancelledSentence(stage: OverviewAwaitingStage): string | null {
  if (stage.count === 0) return null
  return stage.count === 1
    ? `${n(1)} desistiu antes de instalar.`
    : `${n(stage.count)} desistiram antes de instalar.`
}

const STAGE_SENTENCES = {
  pendente: pendingSentence,
  assinada: signedSentence,
  agendada: scheduledSentence,
  cancelada: cancelledSentence,
} as const

/**
 * Explicação da leitura gerencial: o fluxo em ações e quanto já ativou.
 *
 * Uma frase por etapa com contrato, na ordem da barra, dizendo o que falta
 * acontecer. Etapa zerada não entra: a frente já mostra o zero, e a frase
 * existe para dizer o que fazer. Fecha com as vendas do período que já
 * ligaram, que é o mesmo número que o painel de vendas do SGI mostra como
 * `Ativas`.
 */
export function awaitingReadingText(card: OverviewAwaitingActivation): string {
  if (card.sold === 0) {
    return 'Sem venda no recorte, não há contrato para aguardar ativação.'
  }

  const partes: string[] = []
  for (const stage of card.stages) {
    const sentence = STAGE_SENTENCES[stage.id](stage)
    if (sentence !== null) partes.push(sentence)
  }

  // O outro lado da mesma conta, que o card não dizia em lugar nenhum: o
  // gestor via quantos faltam e tinha que subtrair de cabeça para saber
  // quantos já ligaram. Zero também é dito: é resultado, não ausência.
  const ativados = card.sold - card.awaiting
  if (ativados === 0) partes.push('Nenhuma venda do período ativou ainda.')
  if (ativados === 1) partes.push('A outra venda do período já ativou.')
  if (ativados > 1) partes.push(`Outras ${n(ativados)} já ativaram.`)

  return partes.join(' ')
}

/** Bloco Observar: a régua e a ressalva, iguais em qualquer fonte. */
export function awaitingObserve(): string {
  return OBSERVE
}
