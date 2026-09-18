import { describe, expect, it } from 'vitest'

import {
  AWAITING_RULE,
  awaitingObserve,
  awaitingReadingText,
  awaitingReadingTitle,
} from './overviewAwaitingModel'
import { OVERVIEW_AWAITING_STAGES, type OverviewAwaitingActivation } from './overviewModel'

type Four<T> = readonly [T, T, T, T]

/** Um card com as contagens dadas, na ordem oficial das etapas. */
function cardWith(
  sold: number,
  counts: Four<number>,
  scheduledVisit: Four<number | null> = [null, null, null, null],
  needsReschedule: Four<number | null> = [null, null, null, null],
): OverviewAwaitingActivation {
  const awaiting = counts.reduce((total, count) => total + count, 0)

  return {
    sold,
    awaiting,
    stages: OVERVIEW_AWAITING_STAGES.map((stage, index) => ({
      ...stage,
      count: counts[index],
      share: awaiting === 0 ? 0 : counts[index] / awaiting,
      scheduledVisit: scheduledVisit[index],
      needsReschedule: needsReschedule[index],
    })),
  }
}

/**
 * Título da leitura gerencial: o volume que aguarda, e nada de prazo. Prazo
 * não é assunto deste card (decisão do Mário em 17/09/2026), então nenhuma
 * frase chama contrato de atrasado.
 */
describe('awaitingReadingTitle', () => {
  it('diz quantos dos vendidos aguardam ativação, com o nome do indicador', () => {
    expect(awaitingReadingTitle(cardWith(826, [47, 2, 24, 3]))).toBe(
      '76 dos 826 vendidos no período aguardam ativação.',
    )
  })

  it('escreve o milhar em pt-BR', () => {
    expect(awaitingReadingTitle(cardWith(1145, [100, 30, 30, 5]))).toBe(
      '165 dos 1.145 vendidos no período aguardam ativação.',
    )
  })

  it('fica em português com um só', () => {
    expect(awaitingReadingTitle(cardWith(826, [1, 0, 0, 0]))).toBe(
      '1 dos 826 vendidos no período aguarda ativação.',
    )
    expect(awaitingReadingTitle(cardWith(1, [1, 0, 0, 0]))).toBe(
      'O único contrato vendido no período aguarda ativação.',
    )
  })

  it('com nada aguardando, não afirma que tudo foi ativado', () => {
    // Reprovada, expirada e não sincronizada ficam fora da conta, então o
    // complemento do vendido não é só ativação: a frase diz o que o número
    // conta, e nada além.
    expect(awaitingReadingTitle(cardWith(826, [0, 0, 0, 0]))).toBe(
      'Nenhum contrato vendido no período aguarda ativação.',
    )
    expect(awaitingReadingTitle(cardWith(826, [47, 2, 24, 3]))).not.toContain('ativados')
  })

  it('sem venda, diz isso em vez de zero por cento', () => {
    expect(awaitingReadingTitle(cardWith(0, [0, 0, 0, 0]))).toBe(
      'Nenhum contrato foi vendido no recorte.',
    )
  })

  it('nunca fala de prazo ou atraso', () => {
    const textos = [
      awaitingReadingTitle(cardWith(826, [47, 2, 24, 3], [0, 0, 10, 0], [0, 0, 5, 1])),
      awaitingReadingText(cardWith(826, [47, 2, 24, 3], [0, 0, 10, 0], [0, 0, 5, 1])),
      awaitingObserve(),
    ]

    textos.forEach((texto) => {
      expect(texto).not.toMatch(/prazo|atras|parad|travad/i)
    })
  })
})

/**
 * Explicação: o fluxo em ações, uma frase por etapa, e quanto já ativou.
 */
describe('awaitingReadingText', () => {
  it('narra o que cada etapa precisa, na ordem da barra, e fecha com o que ativou', () => {
    // Setembro de 2026 em produção: 392 vendidas, 84 aguardando; das 40
    // agendadas, 22 com visita marcada e 12 improdutivas sem nova visita.
    const texto = awaitingReadingText(
      cardWith(392, [40, 3, 40, 1], [0, 0, 22, 0], [0, 0, 12, 0]),
    )

    expect(texto).toBe(
      '{40} precisam de assinatura. {3} assinaram e precisam agendar. Das {40} agendadas, {22} têm visita marcada e {18} esperam nova visita, {12} delas para reagendar depois de improdutiva. {1} desistiu antes de instalar. Outras {308} já ativaram.',
    )
  })

  it('etapa zerada não entra: a frente já mostra o zero', () => {
    const texto = awaitingReadingText(cardWith(100, [5, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))

    expect(texto).toBe('{5} precisam de assinatura. Outras {95} já ativaram.')
  })

  it('sem a medida da fonte, a agendada diz só a contagem', () => {
    // Base sintética: sem ordem de serviço ligada à venda.
    expect(awaitingReadingText(cardWith(826, [47, 2, 24, 3]))).toBe(
      '{47} precisam de assinatura. {2} assinaram e precisam agendar. {24} estão agendadas. {3} desistiram antes de instalar. Outras {750} já ativaram.',
    )
  })

  it('meia medida na agendada vale como ausência', () => {
    expect(awaitingReadingText(cardWith(100, [0, 0, 10, 0], [0, 0, 4, 0]))).toContain(
      '{10} estão agendadas.',
    )
  })

  it('fica em português com uma venda em cada situação', () => {
    const texto = awaitingReadingText(cardWith(9, [1, 1, 2, 1], [0, 0, 1, 0], [0, 0, 1, 0]))

    expect(texto).toBe(
      '{1} precisa de assinatura. {1} assinou e precisa agendar. Das {2} agendadas, {1} tem visita marcada e {1} espera nova visita, 1 delas para reagendar depois de uma improdutiva. {1} desistiu antes de instalar. Outras {4} já ativaram.',
    )
  })

  it('com uma agendada só, escreve a situação dela sem lista', () => {
    expect(awaitingReadingText(cardWith(10, [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]))).toBe(
      'A única agendada tem visita marcada. Outras {9} já ativaram.',
    )
    expect(awaitingReadingText(cardWith(10, [0, 0, 1, 0], [0, 0, 0, 0], [0, 0, 1, 0]))).toBe(
      'A única agendada espera nova visita depois de uma visita improdutiva. Outras {9} já ativaram.',
    )
  })

  it('agendadas todas com visita marcada não citam espera nem reagendamento', () => {
    expect(awaitingReadingText(cardWith(50, [0, 0, 10, 0], [0, 0, 10, 0], [0, 0, 0, 0]))).toBe(
      'Das {10} agendadas, {10} têm visita marcada. Outras {40} já ativaram.',
    )
  })

  it('diz quando nada do período ativou, em vez de calar', () => {
    expect(awaitingReadingText(cardWith(4, [2, 1, 1, 0]))).toBe(
      '{2} precisam de assinatura. {1} assinou e precisa agendar. {1} está agendada. Nenhuma venda do período ativou ainda.',
    )
  })

  it('fica em português quando sobra uma venda ativada só', () => {
    expect(awaitingReadingText(cardWith(5, [2, 1, 1, 0]))).toContain(
      'A outra venda do período já ativou.',
    )
  })

  it('sem venda, explica em vez de listar zeros', () => {
    expect(awaitingReadingText(cardWith(0, [0, 0, 0, 0]))).toBe(
      'Sem venda no recorte, não há contrato para aguardar ativação.',
    )
  })

  it('não usa travessão em nenhuma frase', () => {
    const textos = [
      awaitingReadingText(cardWith(826, [47, 2, 24, 3])),
      awaitingReadingText(cardWith(826, [47, 2, 24, 3], [0, 0, 10, 0], [0, 0, 5, 1])),
      awaitingReadingText(cardWith(0, [0, 0, 0, 0])),
      awaitingReadingTitle(cardWith(826, [47, 2, 24, 3])),
      awaitingReadingTitle(cardWith(0, [0, 0, 0, 0])),
      awaitingObserve(),
    ]

    textos.forEach((texto) => {
      expect(texto).not.toMatch(/[–—]/)
    })
  })
})

describe('awaitingObserve', () => {
  it('leva a régua da conta e a ressalva da venda recente', () => {
    expect(awaitingObserve()).toBe(
      `${AWAITING_RULE}. Venda recente ainda vai ativar no ritmo normal.`,
    )
  })
})
