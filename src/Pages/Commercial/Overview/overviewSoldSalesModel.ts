import { formatDecimal, formatNumber } from '../../../lib/formatters'
import { changeReadingWithPrevious, periodPhrase } from './overviewReadingPhrases'

/**
 * Textos do card Total de Vendas (06/10/2026, decisão do Mário).
 *
 * O card nasceu porque a equipe perguntou onde estava o total vendido: o 114
 * tinha aparecido por algumas horas na frente do Vendas ativadas e sumido, e
 * nenhum card da página dizia quanto se vendeu. O nome é o do relatório do
 * SGI que todo mundo já usa, e a régua é a mesma dele: contrato pela data da
 * venda, ativado ou não. Por isso ele abre a fileira, na ordem do funil
 * (vendemos, ativamos, valor), em tom neutro, para o maior número não roubar
 * a cena do faturado ao lado.
 *
 * O que o card não faz, por decisão do Mário no mesmo dia: não fala de
 * ativação na frente ("59 já ativadas" repetia o card vizinho), e não diz o
 * destino das vendas, que é assunto da Safra. A leitura só avisa, com todas
 * as letras, que venda fechada não é venda faturada.
 */

/** Título da leitura gerencial: quantos contratos foram vendidos, e quando. */
export function soldSalesReadingTitle(sold: number, dateFrom: string, dateTo: string): string {
  const quando = periodPhrase(dateFrom, dateTo)
  if (sold === 0) return `Nenhum contrato foi vendido ${quando}.`
  if (sold === 1) return `1 contrato foi vendido ${quando}, pela data da venda.`

  return `${formatNumber(sold)} contratos foram vendidos ${quando}, pela data da venda.`
}

/** A ponte para o card do lado: o que separa vendido de faturado. */
export const SOLD_SALES_BRIDGE =
  'Venda fechada não é venda faturada: ela entra no faturamento quando o sinal é ligado, no card Vendas ativadas.'

const SOLD_UNIT = { one: 'venda', many: 'vendas' }

/**
 * A variação, com o número de trás do percentual. Sem taxa, o motivo: a
 * janela anterior existiu e não teve venda (zero é resposta, e o card não
 * diz que o período anterior não existe); a janela existe mas a fonte não
 * trouxe o vendido dela (serviço anterior a 06/10/2026); ou não há janela
 * comparável.
 */
export function soldSalesChangeReading(
  rate: number | null,
  comparison: { readonly long: string; readonly within: string } | undefined,
  previous: number | null,
): string {
  if (rate === null) {
    if (previous === 0) return 'O período comparado não teve venda, então não há variação para mostrar.'
    if (comparison !== undefined) return 'A fonte em uso não informa o vendido do período anterior.'

    return 'Ainda não há base anterior comparável.'
  }

  return changeReadingWithPrevious(rate, comparison, previous, SOLD_UNIT)
}

/** A leitura inteira: a ponte primeiro, a variação por último. */
export function soldSalesReadingText(
  rate: number | null,
  comparison: { readonly long: string; readonly within: string } | undefined,
  previous: number | null,
): string {
  return `${SOLD_SALES_BRIDGE} ${soldSalesChangeReading(rate, comparison, previous)}`
}

/**
 * Linha de detalhe da frente: o ritmo de venda, "22,8 vendas por dia, em 5
 * dias" (06/10/2026, decisão do Mário: dias corridos, uma casa decimal). É
 * o que o total sozinho não diz: 114 só faz sentido sabendo que são 5 dias,
 * e é o número que o gerente faz de cabeça. Dias corridos, e não dias
 * úteis, porque se vende todo dia (medido em produção, jul a set/2026:
 * sábado rende 40% de um dia de semana, domingo 16%), e a conta qualquer
 * um refaz. A casa decimal fica porque vão refazer na calculadora: "23"
 * para 114 em 5 dias seria apontado como erro. Num dia só a linha some: o
 * ritmo seria o próprio total. Sem venda, também: "Nenhum contrato foi
 * vendido" já está na leitura.
 */
export function soldSalesPaceDetail(sold: number, days: number): string | undefined {
  if (sold === 0 || days <= 1) return undefined

  const perDay = formatDecimal(sold / days, 1)
  const vendas = perDay === '1,0' ? '1 venda' : `${perDay} vendas`

  return `${vendas} por dia, em ${formatNumber(days)} dias`
}

/** O OBSERVAR: onde está o resto da história, que este card não conta de propósito. */
export const SOLD_SALES_OBSERVE =
  'O destino das vendas de cada mês, ativadas, em fluxo ou canceladas, está na Safra de vendas por mês.'
