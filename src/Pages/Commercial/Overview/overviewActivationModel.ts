import { formatDecimal, formatNumber, formatPercent } from '../../../lib/formatters'
import {
  PREVIOUS_PERIOD_COMPARISON,
  type CommercialCardDelta,
  type CommercialComparison,
} from '../components/commercialCardModel'
import type { OverviewActivationBand, OverviewActivationBandId } from './overviewModel'

/**
 * Regras do card Tempo até a ativação.
 *
 * Ficam fora da página pelo mesmo motivo do velocímetro: são regra de negócio
 * com casos de borda próprios (espera de um dia, espera de zero dia, período
 * anterior ausente) e precisam de teste direto, sem passar pelo render inteiro
 * da Visão Geral.
 *
 * O indicador mede a distância entre a venda fechada e o sinal ligado, em dias,
 * nas vendas ativadas do recorte. Quem calcula é o serviço; aqui só se decide
 * como o número é dito e como a comparação é interpretada.
 *
 * Linguagem (decisão do Mário, 15/09/2026): o card é lido por gestão, não por
 * quem faz estatística. Nenhum texto usa mediana, percentil ou porcentagem de
 * dias. O valor do meio é dito como "metade dos clientes esperou X ou menos", a
 * distribuição vira faixas somando 100%, e a comparação com o período anterior
 * sai em DIAS, e não em porcentagem: de 2 para 1 dia, `50,0%` assusta mais do
 * que o fato merece, enquanto `1 dia` descreve exatamente o que mudou. É a
 * única comparação da página fora do padrão percentual, e é de propósito.
 */

/** `2 dias`, `1 dia`, `1,5 dias`: quantidade com a unidade concordando. */
export function daysAmount(value: number): string {
  const amount = Number.isInteger(value) ? formatNumber(value) : formatDecimal(value)

  return `${amount} ${value === 1 ? 'dia' : 'dias'}`
}

/**
 * Espera do valor do meio: `1 dia ou menos`.
 *
 * Zero dia vira `no mesmo dia`, que é a frase correta em português para quem
 * compra e é ativado na mesma data. `0 dias ou menos` diria a mesma coisa de um
 * jeito que ninguém fala.
 */
export function orLessDays(value: number): string {
  return value === 0 ? 'no mesmo dia' : `${daysAmount(value)} ou menos`
}

/**
 * Régua do indicador, primeira frase da leitura gerencial.
 *
 * Ela existe porque a pergunta apareceu de verdade (Mário, 16/09/2026): o card
 * conta a partir da data da VENDA, `contracted_at`, e não da assinatura do
 * contrato, `signed_at`, que é outro campo e outra tabela. As duas caem no
 * mesmo dia em 86% das ativações, mas isso não dispensa dizer qual é qual.
 */
export const ACTIVATION_RULE =
  'A contagem vai do dia da venda até o dia em que o sinal do cliente foi ligado.'

/**
 * Cada faixa dita por extenso, para caber no meio de uma frase.
 *
 * A grade do card usa rótulos curtos, `Mesmo dia`, `1 dia`, porque tem duas
 * colunas estreitas. No texto eles precisam da preposição, e a primeira faixa
 * pede `no` em vez de `em`.
 */
const BAND_PHRASES: Record<OverviewActivationBandId, string> = {
  'mesmo-dia': 'no mesmo dia',
  '1-dia': 'em 1 dia',
  '2-a-3-dias': 'em 2 a 3 dias',
  '4-dias-ou-mais': 'em 4 dias ou mais',
}

/**
 * Frase da leitura gerencial que descreve a fila inteira, faixa por faixa.
 *
 * Duas correções do Mário moram aqui. A primeira: a versão inicial dizia só o
 * meio e a cauda, e sobrava a pergunta "e a maior parte, esperou quanto?". A
 * segunda, em 16/09/2026: juntar faixas numa conta só, do tipo "75,9% até 3
 * dias", obriga quem lê a desfazer a soma para entender de quem se fala. Agora
 * cada faixa tem o seu percentual, na mesma ordem da barra, e os quatro fecham
 * em 100%.
 */
export function bandsReading(bands: readonly OverviewActivationBand[]): string {
  const total = bands.reduce((sum, band) => sum + band.count, 0)
  if (total === 0) return ''

  const parts = bands.map(
    (band) => `${BAND_PHRASES[band.id]} para {${formatPercent(band.count / total)}}`,
  )
  // `dos clientes` só no primeiro: ancora de quem é o percentual sem repetir a
  // mesma expressão quatro vezes na mesma frase.
  const [first, ...rest] = [`${parts[0]} dos clientes`, ...parts.slice(1)]
  if (rest.length === 0) return `O sinal foi ligado ${first}.`

  return `O sinal foi ligado ${[first, ...rest.slice(0, -1)].join(', ')} e ${rest[rest.length - 1]}.`
}

/**
 * Mínimo de ativações medidas para a comparação com o período anterior valer
 * (decisão do Mário, 16/09/2026).
 *
 * Nasceu de um caso real: no dia 16/09/2026, com o filtro na data de hoje, o
 * recorte tinha UMA ativação, de um contrato vendido 12 dias antes. O número
 * estava certo, mas a seta anunciava piora de 10,5 dias frente ao dia
 * anterior, quando o que mudou foi o tamanho da amostra, de 28 clientes para
 * 1. Abaixo do mínimo o card troca a seta pela quantidade de clientes que
 * entraram na conta, que é a informação de que quem lê precisa ali.
 *
 * Cinco é o corte: no volume real de ativações da empresa, de 14 a 33 por dia
 * útil, ele só aparece em recorte de poucas horas ou em filtro muito estreito,
 * que são exatamente os casos em que o valor do meio oscila sem ter havido
 * mudança nenhuma na operação.
 */
export const ACTIVATION_MIN_SAMPLE = 5

/** `1 cliente`, `3 clientes`: a base da medida com a unidade concordando. */
function measuredAmount(measured: number): string {
  return `${formatNumber(measured)} ${measured === 1 ? 'cliente' : 'clientes'}`
}

/**
 * Faixa de comparação quando o período comparado existe e não teve ativação
 * (decisão do Mário em 25/09/2026). Vale para todos os cards da fileira: sem
 * ativação antes não há variação, porque não se divide por zero, mas dizer
 * "Sem período anterior" seria falso. O texto nomeia a janela (`Sem ativação
 * no domingo 13/09`), e a leitura acessível repete com o assunto do card.
 */
export function emptyPreviousDelta(subject: string, text: string): CommercialCardDelta {
  return {
    label: text,
    accessibleLabel: `${subject}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
    tone: 'indisponivel',
  }
}

/**
 * Comparação do Tempo até a ativação, em dias, o único indicador da página em
 * que subir é piorar.
 *
 * Em recorte pequeno ela não sai: no lugar dela a faixa mostra de quantos
 * clientes o número em destaque saiu, ver `ACTIVATION_MIN_SAMPLE`.
 *
 * Vive só na faixa de comparação da frente do card. A leitura gerencial NÃO a
 * repete em texto (decisão do Mário, 16/09/2026): ali o espaço é para explicar
 * como a conta é feita e como os clientes se dividem, e a seta acima já diz o
 * que mudou frente ao período anterior.
 *
 * O card executivo nunca deduz semântica a partir do sinal do número, então o
 * tom é declarado aqui, como a Visão Geral de OS já faz com a improdutividade.
 *
 * A diferença é dita em dias, e não em porcentagem, porque a espera é um número
 * pequeno e inteiro: cair de 2 para 1 dia é `50,0%`, um tamanho que não
 * corresponde ao que mudou na vida do cliente. Em dias não existe divisão, e
 * por isso um período anterior com espera zero continua comparável, diferente
 * dos cards de volume.
 *
 * `comparison` diz com o que se compara (`vs. agosto até o dia 24`), como nos
 * outros cards da fileira; sem ele vale o genérico `vs. período anterior`.
 */
export function activationDelta(
  current: number,
  previous: number | null,
  measured: number,
  comparison: CommercialComparison = PREVIOUS_PERIOD_COMPARISON,
  /**
   * Frase do período comparado sem ativação (`Sem ativação no domingo
   * 13/09`). Sem ativação não há espera medida, e o card diz isso em vez de
   * "Sem período anterior" (decisão do Mário em 25/09/2026).
   */
  emptyPrevious?: string,
): CommercialCardDelta {
  const subject = 'O tempo até a ativação'

  // Poucos clientes medidos: a seta sairia de uma amostra que não descreve a
  // operação, então o espaço dela diz o tamanho da base.
  if (measured < ACTIVATION_MIN_SAMPLE) {
    return {
      label: `${measuredAmount(measured)} no período`,
      accessibleLabel: `${subject} saiu de ${measuredAmount(measured)} no período, poucos para comparar com o período anterior`,
      tone: 'indisponivel',
    }
  }

  if (previous === null && emptyPrevious !== undefined) {
    return emptyPreviousDelta(subject, emptyPrevious)
  }

  if (previous === null) {
    return {
      label: 'Sem período anterior',
      accessibleLabel: `${subject}: não há período anterior comparável`,
      tone: 'indisponivel',
    }
  }

  const difference = current - previous
  if (difference === 0) {
    return {
      label: `Estável ${comparison.label}`,
      accessibleLabel: `${subject} ficou estável ${comparison.long}`,
      tone: 'neutro',
    }
  }

  const longer = difference > 0
  const amount = daysAmount(Math.abs(difference))

  return {
    label: `${longer ? '▲' : '▼'} ${amount} ${comparison.label}`,
    accessibleLabel: `${subject} ${longer ? 'aumentou' : 'diminuiu'} ${amount} ${comparison.long}`,
    // Demorar mais é desfavorável, e é aqui que a página inverte o sentido que
    // todos os outros cards usam.
    tone: longer ? 'desfavoravel' : 'favoravel',
  }
}
