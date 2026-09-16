import { describe, expect, it } from 'vitest'

import {
  AWAITING_RULE,
  awaitingObserve,
  awaitingReadingText,
  awaitingReadingTitle,
  awaitingShareLabel,
  awaitingStalledReading,
} from './overviewAwaitingModel'
import { OVERVIEW_AWAITING_STAGES, type OverviewAwaitingActivation } from './overviewModel'

type Four<T> = readonly [T, T, T, T]

/** Um card com as contagens dadas, na ordem oficial das etapas. */
function cardWith(
  sold: number,
  counts: Four<number>,
  stalled: Four<number | null> = [null, null, null, null],
): OverviewAwaitingActivation {
  const awaiting = counts.reduce((total, count) => total + count, 0)

  return {
    sold,
    awaiting,
    stages: OVERVIEW_AWAITING_STAGES.map((stage, index) => ({
      ...stage,
      count: counts[index],
      share: awaiting === 0 ? 0 : counts[index] / awaiting,
      stalled: stalled[index],
    })),
  }
}

describe('awaitingShareLabel', () => {
  it('divide o que aguarda pelo vendido, em percentual pt-BR', () => {
    // Agosto de 2026 em produção: 76 de 826 vendidos.
    expect(awaitingShareLabel(826, 76)).toBe('9,2%')
  })

  it('não divide por zero sem venda', () => {
    expect(awaitingShareLabel(0, 0)).toBe('0,0%')
  })
})

describe('awaitingReadingTitle', () => {
  it('diz quantos dos vendidos aguardam ativação, com o nome do indicador', () => {
    expect(awaitingReadingTitle(826, 76)).toBe(
      '76 dos 826 vendidos no período aguardam ativação.',
    )
  })

  it('escreve o milhar em pt-BR', () => {
    expect(awaitingReadingTitle(1145, 165)).toBe(
      '165 dos 1.145 vendidos no período aguardam ativação.',
    )
  })

  it('fica em português com um só', () => {
    expect(awaitingReadingTitle(826, 1)).toBe('1 dos 826 vendidos no período aguarda ativação.')
    expect(awaitingReadingTitle(1, 1)).toBe('O único contrato vendido no período aguarda ativação.')
  })

  it('com nada aguardando, não afirma que tudo foi ativado', () => {
    // Reprovada, expirada e não sincronizada ficam fora da conta, então o
    // complemento do vendido não é só ativação: a frase diz o que o número
    // conta, e nada além.
    expect(awaitingReadingTitle(826, 0)).toBe(
      'Nenhum contrato vendido no período aguarda ativação.',
    )
    expect(awaitingReadingTitle(1, 0)).toBe('Nenhum contrato vendido no período aguarda ativação.')
    expect(awaitingReadingTitle(826, 76)).not.toContain('ativados')
  })

  it('sem venda, diz isso em vez de zero por cento', () => {
    expect(awaitingReadingTitle(0, 0)).toBe('Nenhum contrato foi vendido no recorte.')
  })
})

describe('awaitingReadingText', () => {
  it('dá a régua e as quatro etapas, cada uma com o próprio número, na ordem da barra', () => {
    // Agosto de 2026 em produção, antes de o serviço medir o prazo.
    expect(awaitingReadingText(cardWith(826, [47, 2, 24, 3]))).toBe(
      `${AWAITING_RULE}: {47} pendentes, {2} assinados, {24} agendados e {3} cancelados antes de ativar. No mês em andamento inclui venda recente que ainda vai ativar.`,
    )
  })

  it('mantém a etapa zerada na frase: zero é resultado, não ausência', () => {
    // Julho de 2026 em produção: nenhuma cancelada antes de ativar.
    expect(awaitingReadingText(cardWith(790, [36, 2, 11, 0]))).toContain(
      '{0} cancelados antes de ativar',
    )
  })

  it('sem venda, explica em vez de listar zeros', () => {
    expect(awaitingReadingText(cardWith(0, [0, 0, 0, 0]))).toBe(
      `${AWAITING_RULE}. Sem venda no recorte, não há contrato para aguardar ativação.`,
    )
  })

  it('com o prazo medido, troca a ressalva do mês pelos parados de cada etapa', () => {
    // Setembro de 2026 em produção, 16/09: parados além do prazo normal.
    const texto = awaitingReadingText(cardWith(355, [38, 2, 48, 1], [24, 0, 14, null]))

    expect(texto).toBe(
      `${AWAITING_RULE}: {38} pendentes, {2} assinados, {48} agendados e {1} cancelado antes de ativar. Parados além do prazo normal: {24} pendentes sem assinatura, {0} assinados sem ordem de instalação e {14} agendados sem visita marcada.`,
    )
    expect(texto).not.toContain('mês em andamento')
  })

  it('fica em português com um só em cada etapa', () => {
    expect(awaitingReadingText(cardWith(10, [1, 1, 1, 1], [1, 1, 1, null]))).toBe(
      `${AWAITING_RULE}: {1} pendente, {1} assinado, {1} agendado e {1} cancelado antes de ativar. Parados além do prazo normal: {1} pendente sem assinatura, {1} assinado sem ordem de instalação e {1} agendado sem visita marcada.`,
    )
  })

  it('não usa travessão em nenhuma frase', () => {
    const textos = [
      awaitingReadingText(cardWith(826, [47, 2, 24, 3])),
      awaitingReadingText(cardWith(826, [47, 2, 24, 3], [40, 1, 20, null])),
      awaitingReadingText(cardWith(0, [0, 0, 0, 0])),
      awaitingReadingTitle(826, 76),
      awaitingReadingTitle(0, 0),
      awaitingObserve(cardWith(826, [47, 2, 24, 3])),
      awaitingObserve(cardWith(826, [47, 2, 24, 3], [40, 1, 20, null])),
    ]

    textos.forEach((texto) => {
      expect(texto).not.toMatch(/[–—]/)
    })
  })
})

describe('awaitingStalledReading', () => {
  it('é nula quando a fonte não mede o prazo', () => {
    expect(awaitingStalledReading(cardWith(826, [47, 2, 24, 3]))).toBeNull()
  })

  it('meia medida vale como ausência: uma etapa sem número cala a frase inteira', () => {
    expect(awaitingStalledReading(cardWith(826, [47, 2, 24, 3], [40, null, 20, null]))).toBeNull()
  })

  it('ignora a cancelada, que não tem prazo, mesmo que venha número', () => {
    expect(awaitingStalledReading(cardWith(826, [47, 2, 24, 3], [40, 1, 20, 3]))).toBe(
      'Parados além do prazo normal: {40} pendentes sem assinatura, {1} assinado sem ordem de instalação e {20} agendados sem visita marcada.',
    )
  })

  it('com tudo em dia, diz de uma vez em vez de listar três zeros', () => {
    expect(awaitingStalledReading(cardWith(355, [10, 1, 40, 0], [0, 0, 0, null]))).toBe(
      'Nenhum contrato passou do prazo normal.',
    )
  })
})

describe('awaitingObserve', () => {
  it('sem o prazo medido, orienta sem número', () => {
    expect(awaitingObserve(cardWith(826, [47, 2, 24, 3]))).toBe(
      'Contrato parado há semanas em pendente ou agendada pede ação ou baixa no SGI.',
    )
  })

  it('com o prazo medido, diz a régua uma vez', () => {
    expect(awaitingObserve(cardWith(826, [47, 2, 24, 3], [47, 0, 24, null]))).toBe(
      'Prazo normal: assinatura em até 7 dias da venda e nova visita em até 4 dias da última ordem. Parado pede ação ou baixa no SGI.',
    )
  })
})
