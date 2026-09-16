import { formatNumber, formatPercent } from '../../../lib/formatters'
import type { OverviewAwaitingActivation, OverviewAwaitingStageId } from './overviewModel'

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
 * Todas são curtas de propósito: a 1280 px a leitura tem cerca de 156 px de
 * largura, e a leitura mais longa da fileira é quem manda na altura dos cinco
 * cards, mesmo fechada.
 */

/** A régua do card, dita uma vez na leitura gerencial. */
export const AWAITING_RULE = 'A conta usa a data da venda e a situação de hoje no SGI'

/** Ressalva do mês corrente, para quando a fonte não mede o prazo. */
const CURRENT_MONTH_NOTE = 'No mês em andamento inclui venda recente que ainda vai ativar.'

/**
 * Cada etapa dita por extenso no meio da frase, no gênero de "contratos".
 *
 * A grade do card usa os rótulos do status, no feminino de "assinatura". No
 * texto o sujeito é o contrato, e a cancelada ganha o complemento que a
 * distingue do cancelamento depois do sinal ligado, que não entra neste card.
 * Singular e plural, porque "1 cancelados" apareceu na tela e não é
 * português; zero fica no plural, como se fala.
 */
type Phrase = readonly [singular: string, plural: string]

const STAGE_PHRASES: Record<OverviewAwaitingStageId, Phrase> = {
  pendente: ['pendente', 'pendentes'],
  assinada: ['assinado', 'assinados'],
  agendada: ['agendado', 'agendados'],
  cancelada: ['cancelado antes de ativar', 'cancelados antes de ativar'],
}

/** Número em destaque seguido da frase no número certo. */
function countPhrase(count: number, [singular, plural]: Phrase): string {
  return `{${formatNumber(count)}} ${count === 1 ? singular : plural}`
}

/**
 * Etapas que têm prazo normal, e a frase de quem passou dele.
 *
 * A cancelada não entra: ela já saiu da fila. Os prazos são do serviço, que
 * é quem mede (7 dias para assinar, 4 dias para a visita seguinte), e a tela
 * só os repete no Observar, uma vez. Aparece "sem assinatura" e "sem visita
 * marcada" porque é isso que a produção mostrou em 16/09/2026: todo pendente
 * parado é contrato nunca assinado, e todo agendado parado é contrato cuja
 * visita improdutiva não gerou outra.
 */
const STALLED_STAGES = ['pendente', 'assinada', 'agendada'] as const
type StalledStageId = (typeof STALLED_STAGES)[number]
const STALLED_PHRASES: Record<StalledStageId, Phrase> = {
  pendente: ['pendente sem assinatura', 'pendentes sem assinatura'],
  assinada: ['assinado sem ordem de instalação', 'assinados sem ordem de instalação'],
  agendada: ['agendado sem visita marcada', 'agendados sem visita marcada'],
}

const OBSERVE_WITH_STALLED =
  'Prazo normal: assinatura em até 7 dias da venda e nova visita em até 4 dias da última ordem. Parado pede ação ou baixa no SGI.'
const OBSERVE_WITHOUT_STALLED =
  'Contrato parado há semanas em pendente ou agendada pede ação ou baixa no SGI.'

/**
 * Participação do que aguarda sobre o vendido, formatada.
 *
 * Sem venda no recorte não há divisão, e o zero aqui é guarda, não resultado:
 * quem chama escreve que nada foi vendido em vez de mostrar 0,0% de nada.
 */
export function awaitingShareLabel(sold: number, awaiting: number): string {
  return formatPercent(sold === 0 ? 0 : awaiting / sold)
}

/**
 * Título da leitura gerencial, em português também com zero e com um.
 *
 * "Vendidos" sem "contratos" repete a linha de detalhe da frente e poupa uma
 * linha: com "contratos" o título passava a três linhas a 1280 px.
 */
export function awaitingReadingTitle(sold: number, awaiting: number): string {
  if (sold === 0) return 'Nenhum contrato foi vendido no recorte.'
  if (awaiting === 0) return 'Nenhum contrato vendido no período aguarda ativação.'
  if (sold === 1) return 'O único contrato vendido no período aguarda ativação.'
  if (awaiting === 1) return `1 dos ${formatNumber(sold)} vendidos no período aguarda ativação.`
  return `${formatNumber(awaiting)} dos ${formatNumber(sold)} vendidos no período aguardam ativação.`
}

/**
 * Parados das três etapas com prazo, ou `null` quando a fonte não mede todas.
 *
 * Meia medida vale como ausência: com uma etapa sem número, a frase mentiria
 * por omissão, e a leitura volta à ressalva do mês em andamento.
 */
function stalledCounts(card: OverviewAwaitingActivation): Record<StalledStageId, number> | null {
  const counts = {} as Record<StalledStageId, number>
  for (const id of STALLED_STAGES) {
    const stage = card.stages.find((candidate) => candidate.id === id)
    if (stage === undefined || stage.stalled === null) return null
    counts[id] = stage.stalled
  }
  return counts
}

/**
 * Frase de quem passou do prazo normal, uma etapa por vez, na ordem da barra.
 *
 * `null` quando a fonte não mede. Com tudo em dia, diz isso de uma vez em vez
 * de listar três zeros: zero continua sendo resultado, só dito mais curto.
 */
export function awaitingStalledReading(card: OverviewAwaitingActivation): string | null {
  const counts = stalledCounts(card)
  if (counts === null) return null

  const total = STALLED_STAGES.reduce((sum, id) => sum + counts[id], 0)
  if (total === 0) return 'Nenhum contrato passou do prazo normal.'

  const parts = STALLED_STAGES.map((id) => countPhrase(counts[id], STALLED_PHRASES[id]))
  return `Parados além do prazo normal: ${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}.`
}

/**
 * Explicação da leitura gerencial: a régua, as quatro etapas e, por último, o
 * que passou do prazo normal, ou a ressalva do mês em andamento quando a
 * fonte não mede o prazo.
 *
 * Cada etapa leva o próprio número, na ordem da barra, sem juntar duas numa
 * conta só: junção obriga quem lê a desfazer a soma para saber de quem se fala
 * (regra do Mário, 16/09/2026, nascida no Tempo até a ativação). Com o prazo
 * medido, a ressalva do mês corrente sai: venda de ontem não conta como parada,
 * e é isso que ela existia para dizer.
 */
export function awaitingReadingText(card: OverviewAwaitingActivation): string {
  if (card.sold === 0) {
    return `${AWAITING_RULE}. Sem venda no recorte, não há contrato para aguardar ativação.`
  }

  const parts = card.stages.map((stage) => countPhrase(stage.count, STAGE_PHRASES[stage.id]))
  const list = `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`
  const tail = awaitingStalledReading(card) ?? CURRENT_MONTH_NOTE

  return `${AWAITING_RULE}: ${list}. ${tail}`
}

/** Bloco Observar: com o prazo medido ele diz a régua; sem ele, a orientação. */
export function awaitingObserve(card: OverviewAwaitingActivation): string {
  return stalledCounts(card) === null ? OBSERVE_WITHOUT_STALLED : OBSERVE_WITH_STALLED
}
