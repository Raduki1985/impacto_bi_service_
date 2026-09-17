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
 * Régua e origem das vendas ativadas do recorte, para a leitura do card.
 *
 * `soldEarlier` nulo é fonte que não separa a origem: sai só a régua dela.
 * Com a medida, a frase diz quantas são do próprio período e quantas vieram
 * de vendas de períodos anteriores, em português também com zero e com um, e
 * sem repetir a conta quando uma das parcelas é tudo.
 */
export function activeSalesRuleReading(activeSales: number, soldEarlier: number | null): string {
  if (soldEarlier === null) return ACTIVE_SALES_LOCAL_RULE
  if (activeSales === 0) return ACTIVE_SALES_RULE

  const own = activeSales - soldEarlier
  if (activeSales === 1) {
    return soldEarlier === 0
      ? `${ACTIVE_SALES_RULE} A única venda ativada é do próprio período.`
      : `${ACTIVE_SALES_RULE} A única venda ativada veio de um período anterior.`
  }
  if (soldEarlier === 0) {
    return `${ACTIVE_SALES_RULE} Todas as ${formatNumber(activeSales)} são vendas do próprio período.`
  }
  if (own === 0) {
    return `${ACTIVE_SALES_RULE} Todas as ${formatNumber(activeSales)} vieram de vendas de períodos anteriores.`
  }
  return `${ACTIVE_SALES_RULE} Dessas ${formatNumber(activeSales)}, ${ownPart(own)} e ${earlierPart(soldEarlier)}.`
}
