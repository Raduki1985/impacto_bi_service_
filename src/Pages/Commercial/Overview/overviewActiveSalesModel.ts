import { formatNumber } from '../../../lib/formatters'

/**
 * Textos do card Vendas ativadas.
 *
 * Moram aqui pelo mesmo motivo dos textos do Aguardando Ativação e do Tempo
 * até a ativação: são regras de leitura decididas com o Mário, com casos de
 * borda que a base sintética nunca produz e que o teste cobre um a um.
 *
 * A régua mudou em 17/09/2026 (decisão do Mário, confirmada com o Caio, dev
 * do SGI): a venda vale pelo dia em que o sinal do cliente foi ligado, e fica
 * nesse dia mesmo que o contrato tenha sido cancelado ou bloqueado depois.
 * Antes o card exigia contrato ativo hoje, a régua do Vendas Ativas do SGI, e
 * isso encolhia os meses antigos: janeiro/2026 lia 582 quando 776 contratos
 * ligaram o sinal, porque quem cancelou ou ficou bloqueado desde então sumia
 * do mês. Cancelamento é assunto da futura página de clientes, não desta.
 *
 * A leitura também separa a venda do próprio período da herdada, vendida
 * antes de o período começar. É o que liga este card ao Aguardando Ativação,
 * ao lado, que conta pela data da venda: em setembro/2026 (1 a 17) eram 378
 * ativadas e 311 vendidas já ativadas, e a diferença são as 67 herdadas.
 *
 * Desde 18/09/2026 essa divisão aparece também na FRENTE do card, na linha de
 * detalhe, decisão do Mário: ela é a ponte entre as duas réguas da página, e
 * ficava só na leitura gerencial, que depende de clique. A frase curta da
 * frente e a frase longa da leitura saem da mesma função, `originSentence`,
 * para nunca discordarem uma da outra.
 */

/** A régua do card ligado ao serviço, dita uma vez na leitura. */
export const ACTIVE_SALES_RULE =
  'Conta pelo dia em que o sinal do cliente foi ligado, mesmo que o contrato tenha sido cancelado ou bloqueado depois.'

/**
 * A régua da base sintética, que ainda exige contrato ativo hoje e não separa
 * a origem da venda. Sai junto com ela.
 */
export const ACTIVE_SALES_LOCAL_RULE =
  'Conta pelo dia em que o sinal do cliente foi ligado, com o contrato ainda ativo.'

function ownPart(own: number): string {
  return own === 1 ? '1 é do próprio período' : `${formatNumber(own)} são do próprio período`
}

function earlierPart(earlier: number): string {
  return earlier === 1
    ? '1 veio de venda de período anterior'
    : `${formatNumber(earlier)} vieram de vendas de períodos anteriores`
}

/**
 * A origem das ativações por extenso, ou `null` quando não há o que dividir.
 *
 * Fonte única da divisão: a leitura gerencial acrescenta a régua na frente
 * dela, e o nome acessível da frente do card usa a mesma frase. Fala português
 * também com zero e com um, e não repete a conta quando uma das parcelas é
 * tudo.
 */
function originSentence(activeSales: number, soldEarlier: number): string | null {
  if (activeSales === 0) return null

  const own = activeSales - soldEarlier
  if (activeSales === 1) {
    return soldEarlier === 0
      ? 'A única venda ativada é do próprio período.'
      : 'A única venda ativada veio de um período anterior.'
  }
  if (soldEarlier === 0) {
    return `Todas as ${formatNumber(activeSales)} são vendas do próprio período.`
  }
  if (own === 0) {
    return `Todas as ${formatNumber(activeSales)} vieram de vendas de períodos anteriores.`
  }
  return `Dessas ${formatNumber(activeSales)}, ${ownPart(own)} e ${earlierPart(soldEarlier)}.`
}

/**
 * Régua e origem das vendas ativadas do recorte, para a leitura do card.
 *
 * `soldEarlier` nulo é fonte que não separa a origem: sai só a régua dela.
 */
export function activeSalesRuleReading(activeSales: number, soldEarlier: number | null): string {
  if (soldEarlier === null) return ACTIVE_SALES_LOCAL_RULE

  const origem = originSentence(activeSales, soldEarlier)
  return origem === null ? ACTIVE_SALES_RULE : `${ACTIVE_SALES_RULE} ${origem}`
}

/**
 * Linha de detalhe da frente: de onde vieram as ativações do recorte.
 *
 * A frase é curta porque a linha tem cerca de 156 px a 1280 px, a mesma do
 * ticket médio e do progresso da safra nos cards vizinhos. Com as duas
 * parcelas, ela dá os dois números que somam o valor em destaque; com uma só,
 * afirma isso em vez de escrever um zero.
 *
 * `undefined` é ausência de linha, e não linha vazia: sem a medida da origem,
 * que é o caso da base sintética, ou sem nenhuma ativação no recorte, não
 * existe divisão a mostrar.
 */
export function activeSalesOriginDetail(
  activeSales: number,
  soldEarlier: number | null,
): string | undefined {
  if (soldEarlier === null || activeSales === 0) return undefined

  const own = activeSales - soldEarlier
  if (own === 0) {
    return activeSales === 1 ? 'De venda anterior' : 'Todas de vendas anteriores'
  }
  if (soldEarlier === 0) {
    return activeSales === 1 ? 'Vendida no período' : 'Todas vendidas no período'
  }
  const earlier =
    soldEarlier === 1 ? '1 de venda anterior' : `${formatNumber(soldEarlier)} de vendas anteriores`
  return `${formatNumber(own)} do período, ${earlier}`
}

/**
 * A mesma origem para leitor de tela.
 *
 * A linha de detalhe é telegráfica, então o nome acessível do card não a
 * repete: ele recebe a frase por extenso, a mesma da leitura gerencial.
 */
export function activeSalesOriginAccessible(
  activeSales: number,
  soldEarlier: number | null,
): string | undefined {
  if (soldEarlier === null) return undefined

  return originSentence(activeSales, soldEarlier) ?? undefined
}
