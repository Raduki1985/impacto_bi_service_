import { formatDecimal, formatNumber, formatPercent } from '../../../lib/formatters'
import {
  PREVIOUS_PERIOD_LABEL,
  PREVIOUS_PERIOD_LONG,
  type CommercialCardDelta,
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
 * Comparação do Tempo até a ativação, em dias, o único indicador da página em
 * que subir é piorar.
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
 */
export function activationDelta(
  current: number,
  previous: number | null,
): CommercialCardDelta {
  const subject = 'O tempo até a ativação'

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
      label: `Estável ${PREVIOUS_PERIOD_LABEL}`,
      accessibleLabel: `${subject} ficou estável ${PREVIOUS_PERIOD_LONG}`,
      tone: 'neutro',
    }
  }

  const longer = difference > 0
  const amount = daysAmount(Math.abs(difference))

  return {
    label: `${longer ? '▲' : '▼'} ${amount} ${PREVIOUS_PERIOD_LABEL}`,
    accessibleLabel: `${subject} ${longer ? 'aumentou' : 'diminuiu'} ${amount} ${PREVIOUS_PERIOD_LONG}`,
    // Demorar mais é desfavorável, e é aqui que a página inverte o sentido que
    // todos os outros cards usam.
    tone: longer ? 'desfavoravel' : 'favoravel',
  }
}
