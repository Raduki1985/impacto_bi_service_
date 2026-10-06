import { formatDateBr, formatNumber, formatPercent } from '../../../lib/formatters'

/**
 * Textos do card Vendas ativadas.
 *
 * Moram aqui pelo mesmo motivo dos textos do Tempo até a ativação: são regras
 * de leitura decididas com o Mário, com casos de borda que a base sintética
 * nunca produz e que o teste cobre um a um.
 *
 * A régua mudou em 17/09/2026 (decisão do Mário, confirmada com o Caio, dev
 * do SGI): a venda vale pelo dia em que o sinal do cliente foi ligado, e fica
 * nesse dia mesmo que o contrato tenha sido cancelado ou bloqueado depois.
 * Antes o card exigia contrato ativo hoje, a régua do Vendas Ativas do SGI, e
 * isso encolhia os meses antigos: janeiro/2026 lia 582 quando 776 contratos
 * ligaram o sinal, porque quem cancelou ou ficou bloqueado desde então sumia
 * do mês. Cancelamento é assunto da futura página de clientes, não desta.
 *
 * A leitura separa a venda do próprio período da herdada, vendida antes de o
 * período começar. É o que liga este card à régua da data da venda (a Safra
 * de vendas por mês): em setembro/2026 (1 a 17) eram 378 ativadas e 311
 * vendidas já ativadas, e a diferença são as 67 herdadas. Desde 18/09/2026 a
 * divisão aparece também na FRENTE do card, decisão do Mário.
 *
 * Os textos foram reescritos em 06/10/2026, decisão do Mário, porque os
 * gestores não entendiam o card. "59 do período, 28 de vendas anteriores"
 * usava "período" para dois relógios (o 87 é ativação no período, o 59 é
 * VENDA no período), e "vendas anteriores" era lido como "ativadas antes".
 * Agora cada número carrega o próprio verbo, "ativadas" para o total e
 * "vendidas" para as parcelas, e a leitura diz as datas. A conta fecha à
 * vista: 87 ativadas = 59 vendidas no período + 28 vendidas antes dele. A
 * leitura gerencial conta na ordem que importa: a composição primeiro, a
 * régua depois, a variação por último. O vendido no período (114) entrou na
 * frente do card na manhã do mesmo dia e saiu à tarde: puxava a pergunta "e
 * as outras 55?", que é assunto da Safra.
 */

/** A régua do card ligado ao serviço, dita uma vez na leitura. */
export const ACTIVE_SALES_RULE =
  'Conta pelo dia do sinal ligado, mesmo que o contrato tenha sido cancelado ou bloqueado depois.'

/**
 * A régua da base sintética, que ainda exige contrato ativo hoje e não separa
 * a origem da venda. Sai junto com ela.
 */
export const ACTIVE_SALES_LOCAL_RULE =
  'Conta pelo dia em que o sinal do cliente foi ligado, com o contrato ainda ativo.'

/** `05/10` de uma data ISO, sem passar por `Date` (o fuso mudaria o dia). */
function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/**
 * O período para o meio da frase: `de 01 a 05/10`; num dia só, `em 05/10`;
 * entre meses, `de 28/09 a 05/10`; entre anos, as datas inteiras.
 */
export function signalPeriodPhrase(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return `em ${dayMonth(dateTo)}`
  if (dateFrom.slice(0, 7) === dateTo.slice(0, 7)) return `de ${dateFrom.slice(8, 10)} a ${dayMonth(dateTo)}`
  if (dateFrom.slice(0, 4) === dateTo.slice(0, 4)) return `de ${dayMonth(dateFrom)} a ${dayMonth(dateTo)}`

  return `de ${formatDateBr(dateFrom)} a ${formatDateBr(dateTo)}`
}

/** Título da leitura gerencial: quantos contratos ligaram o sinal, e quando. */
export function activeSalesReadingTitle(activeSales: number, dateFrom: string, dateTo: string): string {
  const quando = signalPeriodPhrase(dateFrom, dateTo)
  if (activeSales === 0) return `Nenhum contrato ligou o sinal ${quando}.`
  if (activeSales === 1) return `1 contrato ligou o sinal ${quando}.`

  return `${formatNumber(activeSales)} contratos ligaram o sinal ${quando}.`
}

/**
 * A composição das ativações por extenso, ou `null` sem ativação.
 *
 * Fonte única da divisão: a leitura gerencial a abre, e o nome acessível da
 * frente do card usa a mesma frase. Cada parcela diz "vendidos", e a herdada
 * diz antes de que dia: é o que separa VENDA no período de ATIVAÇÃO no
 * período. Fala português também com um, e não repete a conta quando uma das
 * parcelas é tudo.
 */
function originSentence(activeSales: number, soldEarlier: number, dateFrom: string): string | null {
  if (activeSales === 0) return null

  const own = activeSales - soldEarlier
  const antes = `antes de ${dayMonth(dateFrom)}`
  if (activeSales === 1) {
    return soldEarlier === 0
      ? 'A única ativação é de um contrato vendido no próprio período.'
      : `A única ativação é de um contrato vendido ${antes}.`
  }
  const total = `${formatNumber(activeSales)} ativações`
  if (soldEarlier === 0) return `Todas as ${total} são de contratos vendidos no próprio período.`
  if (own === 0) return `Todas as ${total} são de contratos vendidos ${antes}.`

  const proprias = own === 1 ? '1 é de contrato vendido' : `${formatNumber(own)} são de contratos vendidos`
  const herdadas = soldEarlier === 1 ? '1 de contrato vendido' : `${formatNumber(soldEarlier)} de contratos vendidos`

  return `Dessas ${total}, ${proprias} no próprio período e ${herdadas} ${antes}.`
}

/**
 * Composição e régua das vendas ativadas do recorte, para a leitura do card.
 * A composição vem primeiro: é o que o gestor pergunta.
 *
 * `soldEarlier` nulo é fonte que não separa a origem: sai só a régua dela.
 */
export function activeSalesRuleReading(activeSales: number, soldEarlier: number | null, dateFrom: string): string {
  if (soldEarlier === null) return ACTIVE_SALES_LOCAL_RULE

  const origem = originSentence(activeSales, soldEarlier, dateFrom)
  return origem === null ? ACTIVE_SALES_RULE : `${origem} ${ACTIVE_SALES_RULE}`
}

/**
 * A variação por último, com o número de trás do percentual (pedido do Mário
 * em 06/10/2026: "recuou 36,5%" sozinho não diz de quanto para quanto) e
 * nomeando a janela comparada (`em setembro até o dia 5`), como a frente do
 * card já faz. Sem a janela conhecida, "no período anterior". As chaves
 * destacam os números na leitura. Sem taxa (período anterior vazio ou
 * inexistente) a frase é a de todos os cards, e não passa por aqui; sem a
 * contagem anterior, só o percentual e a janela.
 */
export function activeSalesChangeReading(
  rate: number,
  comparison: { readonly long: string; readonly within: string } | undefined,
  previous: number | null,
): string {
  if (previous === null) {
    const versus = comparison?.long ?? 'versus período anterior'
    if (rate > 0) return `Cresceu {${formatPercent(rate)}} ${versus}.`
    if (rate < 0) return `Recuou {${formatPercent(Math.abs(rate))}} ${versus}.`

    return `Ficou estável ${versus}.`
  }

  const janela = comparison?.within ?? 'no período anterior'
  const eram = previous === 1 ? 'era {1} ativação' : `eram {${formatNumber(previous)}} ativações`
  if (rate > 0) return `Cresceu {${formatPercent(rate)}}: ${eram} ${janela}.`
  if (rate < 0) return `Recuou {${formatPercent(Math.abs(rate))}}: ${eram} ${janela}.`

  return `Ficou estável: ${previous === 1 ? 'também foi {1} ativação' : `também foram {${formatNumber(previous)}} ativações`} ${janela}.`
}

const OBSERVE_GENERIC = 'Evolução do volume de vendas ativadas frente ao período anterior.'
const OBSERVE_SAFRA = 'O destino das vendas de cada mês está na Safra.'

/**
 * O OBSERVAR: quanto do resultado é herança de vendas de antes do período,
 * que é o que o gestor usa, e onde está o resto da história. Sem a medida da
 * origem (base sintética) ou sem ativação, o genérico de antes.
 */
export function activeSalesObserve(activeSales: number, soldEarlier: number | null): string {
  if (soldEarlier === null || activeSales === 0) return OBSERVE_GENERIC

  const total = formatNumber(activeSales)
  if (soldEarlier === 0) {
    const todas = activeSales === 1 ? 'A única ativação é' : `Todas as ${total} ativações são`
    return `${todas} de venda do próprio período. ${OBSERVE_SAFRA}`
  }
  if (soldEarlier === activeSales) {
    const todas = activeSales === 1 ? 'A única ativação vem de venda' : `Todas as ${total} ativações vêm de vendas`
    return `${todas} de antes do período. ${OBSERVE_SAFRA}`
  }
  const parcela = `${formatNumber(soldEarlier)} das ${total} ativações (${formatPercent(soldEarlier / activeSales)})`
  const vem = soldEarlier === 1 ? 'vem de venda' : 'vêm de vendas'

  return `${parcela} ${vem} de antes do período. ${OBSERVE_SAFRA}`
}

/** As duas linhas de detalhe da frente; a segunda só existe com venda herdada. */
export type ActiveSalesOriginLines = {
  readonly main: string
  readonly note?: string
}

/**
 * Linhas de detalhe da frente: de onde vieram as ativações do recorte.
 *
 * Duas linhas curtas com a mesma estrutura, só muda o "quando" (decisão do
 * Mário em 06/10/2026): "59 vendidas no período" e "28 vendidas antes do
 * período". Lendo de cima para baixo, 87 ativadas, 59 delas vendidas no
 * período, 28 vendidas antes, e a soma fecha à vista. Uma ideia por linha,
 * porque numa linha só o texto quebrava no meio em tela de notebook.
 *
 * `undefined` é ausência de linha, e não linha vazia: sem a medida da origem,
 * que é o caso da base sintética, ou sem ativação no recorte, não existe
 * divisão a mostrar. Quando uma parcela é tudo, a linha afirma o caso inteiro
 * em vez de escrever zero.
 */
export function activeSalesOriginDetail(
  activeSales: number,
  soldEarlier: number | null,
): ActiveSalesOriginLines | undefined {
  if (soldEarlier === null || activeSales === 0) return undefined

  const own = activeSales - soldEarlier
  if (soldEarlier === 0) return { main: activeSales === 1 ? 'Vendida no período' : 'Todas vendidas no período' }
  if (own === 0) return { main: activeSales === 1 ? 'Vendida antes do período' : 'Todas vendidas antes do período' }

  return {
    main: `${formatNumber(own)} ${own === 1 ? 'vendida' : 'vendidas'} no período`,
    note: `${formatNumber(soldEarlier)} ${soldEarlier === 1 ? 'vendida' : 'vendidas'} antes do período`,
  }
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
  dateFrom: string,
): string | undefined {
  if (soldEarlier === null) return undefined

  return originSentence(activeSales, soldEarlier, dateFrom) ?? undefined
}
