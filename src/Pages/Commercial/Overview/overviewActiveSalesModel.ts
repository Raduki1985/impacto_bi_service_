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
 * antes de o período começar. É o que liga este card à régua da data da
 * venda (o card Aguardando Ativação até 28/09/2026, hoje a Safra de vendas
 * por mês): em setembro/2026 (1 a 17) eram 378 ativadas e 311 vendidas já
 * ativadas, e a diferença são as 67 herdadas.
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

/** As duas linhas de detalhe da frente; a segunda só existe com venda herdada. */
export type ActiveSalesOriginLines = {
  readonly main: string
  readonly note?: string
}

/**
 * O vendido no período, quando ele pode entrar na conta: lido, maior que zero
 * e nunca menor que as ativações do próprio período, que saem dele. Se as
 * duas leituras discordarem, a linha volta ao texto sem o vendido em vez de
 * escrever uma conta impossível.
 */
function usableSold(own: number, soldInPeriod: number | null): number | null {
  if (soldInPeriod === null || soldInPeriod <= 0 || soldInPeriod < own) return null
  return soldInPeriod
}

/** A primeira linha com o vendido: quantas das vendidas no período ativaram. */
function soldLine(own: number, sold: number): string {
  if (sold === 1) {
    return own === 1 ? 'A única vendida no período' : 'A única vendida no período não ativou'
  }
  const total = formatNumber(sold)
  if (own === sold) return `Todas as ${total} vendidas no período`
  if (own === 0) return `Nenhuma das ${total} vendidas no período ativou`
  return `${formatNumber(own)} das ${total} vendidas no período`
}

/**
 * Linhas de detalhe da frente: de onde vieram as ativações do recorte.
 *
 * Desde 06/10/2026, decisão do Mário, a primeira linha diz também quantas
 * vendas foram fechadas no período (`soldInPeriod`), o mesmo N do "Baixar as
 * N vendidas em Excel" do título: o número do botão não aparecia em card
 * nenhum, e ninguém achava de onde ele vinha. A venda herdada vai para a
 * segunda linha, uma ideia em cada uma, porque numa linha só eram três
 * números e duas comparações diferentes, e ela quebrava no meio em tela de
 * notebook. A conta que fecha o valor em destaque continua à vista: as
 * ativações do período mais as herdadas.
 *
 * Sem o vendido (ainda lendo, ou na base sintética), a primeira linha diz só
 * as ativações do período, e a disposição em duas linhas não muda.
 *
 * `undefined` é ausência de linha, e não linha vazia: sem a medida da origem,
 * que é o caso da base sintética, ou sem ativação e sem venda no recorte, não
 * existe divisão a mostrar.
 */
export function activeSalesOriginDetail(
  activeSales: number,
  soldEarlier: number | null,
  soldInPeriod: number | null = null,
): ActiveSalesOriginLines | undefined {
  if (soldEarlier === null) return undefined

  const own = activeSales - soldEarlier
  const earlier =
    soldEarlier === 0
      ? undefined
      : soldEarlier === 1
        ? '1 de venda anterior'
        : `${formatNumber(soldEarlier)} de vendas anteriores`
  const sold = usableSold(own, soldInPeriod)
  if (sold !== null) return { main: soldLine(own, sold), note: earlier }

  if (activeSales === 0) return undefined
  if (own === 0) {
    return { main: activeSales === 1 ? 'De venda anterior' : 'Todas de vendas anteriores' }
  }
  if (soldEarlier === 0) {
    return { main: activeSales === 1 ? 'Vendida no período' : 'Todas vendidas no período' }
  }
  return { main: `${formatNumber(own)} do período`, note: earlier }
}

/** O vendido por extenso, para o leitor de tela. */
function soldSentence(own: number, sold: number): string {
  if (sold === 1) {
    return own === 1
      ? 'A única venda do período já ativou.'
      : 'A única venda do período ainda não ativou.'
  }
  const ativaram = own === 0 ? 'nenhuma ativou' : own === 1 ? '1 já ativou' : `${formatNumber(own)} já ativaram`
  return `Das ${formatNumber(sold)} vendas do período, ${ativaram}.`
}

/**
 * A mesma origem para leitor de tela.
 *
 * A linha de detalhe é telegráfica, então o nome acessível do card não a
 * repete: ele recebe a frase por extenso, a mesma da leitura gerencial, e o
 * vendido no período em frase própria quando ele é conhecido.
 */
export function activeSalesOriginAccessible(
  activeSales: number,
  soldEarlier: number | null,
  soldInPeriod: number | null = null,
): string | undefined {
  if (soldEarlier === null) return undefined

  const own = activeSales - soldEarlier
  const sold = usableSold(own, soldInPeriod)
  const parts = [
    originSentence(activeSales, soldEarlier),
    sold === null ? null : soldSentence(own, sold),
  ].filter((part): part is string => part !== null)
  return parts.length === 0 ? undefined : parts.join(' ')
}
