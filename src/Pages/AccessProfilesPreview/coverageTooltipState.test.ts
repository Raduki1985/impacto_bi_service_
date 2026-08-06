import { describe, expect, it } from 'vitest'

import {
  coverageTooltipReducer,
  initialCoverageTooltipState,
  isCoverageTooltipActive,
  type CoverageTooltipAction,
  type CoverageTooltipState,
} from './coverageTooltipState'

/**
 * Testes da exclusividade dos detalhamentos de cobertura.
 *
 * A regra inteira é pura, então ela é verificada aqui e não no navegador: o que
 * o navegador confirma depois é que os eventos chegam nesta ordem, e não o que
 * a regra faz com eles.
 */

/** Aplica uma sequência de ações, como a tela faria ao longo da interação. */
function run(...actions: readonly CoverageTooltipAction[]): CoverageTooltipState {
  return actions.reduce(coverageTooltipReducer, initialCoverageTooltipState)
}

const A = 'label-auditoria'
const B = 'label-cop'

describe('exclusividade dos detalhamentos de cobertura', () => {
  it('começa sem nenhum detalhamento aberto', () => {
    expect(initialCoverageTooltipState).toBeNull()
    expect(isCoverageTooltipActive(initialCoverageTooltipState, A)).toBe(false)
  })

  it('abrir um label torna só ele ativo', () => {
    const state = run({ type: 'claim', id: A })

    expect(isCoverageTooltipActive(state, A)).toBe(true)
    expect(isCoverageTooltipActive(state, B)).toBe(false)
  })

  it('abrir o segundo label tira a vez do primeiro', () => {
    const state = run({ type: 'claim', id: A }, { type: 'claim', id: B })

    expect(isCoverageTooltipActive(state, A)).toBe(false)
    expect(isCoverageTooltipActive(state, B)).toBe(true)
  })

  it('nunca existem dois ativos, por mais trocas que aconteçam', () => {
    const ids = [A, B, 'label-comercial', 'label-retencao', A, B]
    const state = ids.reduce<CoverageTooltipState>(
      (current, id) => coverageTooltipReducer(current, { type: 'claim', id }),
      initialCoverageTooltipState,
    )

    expect(ids.filter((id) => isCoverageTooltipActive(state, id))).toEqual([B, B])
    expect(new Set(ids.filter((id) => isCoverageTooltipActive(state, id))).size).toBe(1)
  })

  it('o fechamento atrasado do label antigo NÃO fecha o novo', () => {
    // É o caso do mouse que sai de A depois de já ter entrado em B: o
    // `mouseleave` de A chega quando B já assumiu.
    const state = run({ type: 'claim', id: A }, { type: 'claim', id: B }, { type: 'release', id: A })

    expect(isCoverageTooltipActive(state, B)).toBe(true)
    expect(isCoverageTooltipActive(state, A)).toBe(false)
  })

  it('o label antigo também não reabre sozinho depois que o novo fecha', () => {
    const state = run(
      { type: 'claim', id: A },
      { type: 'claim', id: B },
      { type: 'release', id: A },
      { type: 'release', id: B },
    )

    expect(state).toBeNull()
    expect(isCoverageTooltipActive(state, A)).toBe(false)
    expect(isCoverageTooltipActive(state, B)).toBe(false)
  })

  it('o próprio label fecha quando ainda é o ativo', () => {
    const state = run({ type: 'claim', id: A }, { type: 'release', id: A })

    expect(state).toBeNull()
  })

  it('fechar duas vezes seguidas não reabre nem quebra', () => {
    const state = run(
      { type: 'claim', id: A },
      { type: 'release', id: A },
      { type: 'release', id: A },
    )

    expect(state).toBeNull()
  })

  it('release de um label que nunca abriu não mexe no ativo', () => {
    const state = run({ type: 'claim', id: A }, { type: 'release', id: 'label-que-nao-abriu' })

    expect(isCoverageTooltipActive(state, A)).toBe(true)
  })

  it('releaseAll fecha o que estiver aberto, seja de quem for', () => {
    expect(run({ type: 'claim', id: A }, { type: 'releaseAll' })).toBeNull()
    expect(run({ type: 'releaseAll' })).toBeNull()
  })

  it('reabrir o mesmo label mantém a identidade dele', () => {
    const state = run({ type: 'claim', id: A }, { type: 'release', id: A }, { type: 'claim', id: A })

    expect(isCoverageTooltipActive(state, A)).toBe(true)
  })

  it('não trata id vazio como ativo', () => {
    // `useId` sempre produz um id, mas a comparação não pode aceitar o vazio
    // como equivalente a "ninguém aberto".
    expect(isCoverageTooltipActive(null, '')).toBe(false)
  })

  it('é uma função pura: o estado recebido não é alterado', () => {
    const before: CoverageTooltipState = A

    coverageTooltipReducer(before, { type: 'claim', id: B })
    coverageTooltipReducer(before, { type: 'release', id: A })

    expect(before).toBe(A)
  })
})
