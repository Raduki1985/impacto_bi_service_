import { describe, expect, it } from 'vitest'

import {
  ACTIVATION_RULE,
  activationDelta,
  bandsReading,
  daysAmount,
  orLessDays,
} from './overviewActivationModel'
import { OVERVIEW_ACTIVATION_BANDS, type OverviewActivationBand } from './overviewModel'

/** Faixas na ordem oficial, com as contagens que o teste quiser. */
function bandsOf(counts: readonly number[]): OverviewActivationBand[] {
  const total = counts.reduce((sum, count) => sum + count, 0)

  return OVERVIEW_ACTIVATION_BANDS.map((band, index) => ({
    ...band,
    count: counts[index],
    share: total === 0 ? 0 : counts[index] / total,
  }))
}

describe('quantidade de dias por extenso', () => {
  it('concorda a unidade com o número', () => {
    expect(daysAmount(1)).toBe('1 dia')
    expect(daysAmount(2)).toBe('2 dias')
    expect(daysAmount(0)).toBe('0 dias')
  })

  it('usa vírgula decimal quando o valor do meio cai entre dois dias', () => {
    // Recorte com número par de ativações: o meio é a média dos dois centrais.
    expect(daysAmount(1.5)).toBe('1,5 dias')
  })

  it('escreve a espera do meio como um limite, e não como um número solto', () => {
    expect(orLessDays(1)).toBe('1 dia ou menos')
    expect(orLessDays(4)).toBe('4 dias ou menos')
    expect(orLessDays(0)).toBe('no mesmo dia')
  })
})

/**
 * A leitura gerencial precisa fechar a conta e dizer de onde até onde o tempo é
 * contado. As duas coisas nasceram de perguntas do Mário sobre a versão
 * anterior do card, que só mostrava o meio e a cauda.
 */
describe('leitura gerencial da espera', () => {
  it('dá um percentual a cada faixa, sem juntar duas na mesma conta', () => {
    // 34, 104, 101 e 76 ativações, 315 no total.
    expect(bandsReading(bandsOf([34, 104, 101, 76]))).toBe(
      'O sinal foi ligado no mesmo dia para {10,8%} dos clientes, em 1 dia para {33,0%}, ' +
        'em 2 a 3 dias para {32,1%} e em 4 dias ou mais para {24,1%}.',
    )
  })

  it('mantém a faixa vazia na frase, para os percentuais fecharem em 100%', () => {
    const frase = bandsReading(bandsOf([0, 10, 0, 0]))

    expect(frase).toContain('no mesmo dia para {0,0%}')
    expect(frase).toContain('em 1 dia para {100,0%}')
  })

  it('não escreve frase nenhuma quando não há ativação medida', () => {
    expect(bandsReading(bandsOf([0, 0, 0, 0]))).toBe('')
  })

  it('declara a régua do indicador sem citar a assinatura do contrato', () => {
    // A contagem começa na data da VENDA. Assinatura do contrato é outro campo,
    // e confundir os dois muda o que o card significa.
    expect(ACTIVATION_RULE).toBe(
      'A contagem vai do dia da venda até o dia em que o sinal do cliente foi ligado.',
    )
  })
})

/**
 * Duas regras do card moram aqui, e nenhuma delas aparece nos outros quatro:
 * demorar mais é piorar, e a comparação é dita em dias, nunca em porcentagem.
 * A porcentagem exagerava o que mudou: cair de 2 para 1 dia virava 50,0%.
 */
describe('comparação do tempo até a ativação', () => {
  it('trata a espera maior como desfavorável e a mostra em dias', () => {
    const delta = activationDelta(2, 1)

    expect(delta.tone).toBe('desfavoravel')
    expect(delta.label).toBe('▲ 1 dia vs. período anterior')
    expect(delta.accessibleLabel).toBe(
      'O tempo até a ativação aumentou 1 dia versus período anterior',
    )
  })

  it('trata a espera menor como favorável', () => {
    const delta = activationDelta(1, 3)

    expect(delta.tone).toBe('favoravel')
    expect(delta.label).toBe('▼ 2 dias vs. período anterior')
  })

  it('não publica porcentagem em lugar nenhum da comparação', () => {
    const delta = activationDelta(1, 2)

    expect(delta.label).not.toContain('%')
    expect(delta.accessibleLabel).not.toContain('%')
  })

  it('mantém a espera igual como neutra', () => {
    const delta = activationDelta(3, 3)

    expect(delta.tone).toBe('neutro')
    expect(delta.label).toBe('Estável vs. período anterior')
  })

  it('compara mesmo quando o período anterior ativava no mesmo dia', () => {
    // Em dias não existe divisão, então uma base zerada continua comparável.
    const delta = activationDelta(2, 0)

    expect(delta.tone).toBe('desfavoravel')
    expect(delta.label).toBe('▲ 2 dias vs. período anterior')
  })

  it('não compara sem período anterior', () => {
    const delta = activationDelta(2, null)

    expect(delta.tone).toBe('indisponivel')
    expect(delta.label).toBe('Sem período anterior')
  })
})
