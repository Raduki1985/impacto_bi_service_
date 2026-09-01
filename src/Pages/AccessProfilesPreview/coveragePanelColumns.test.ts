import { describe, expect, it } from 'vitest'

import { coveragePanelColumns } from './coveragePanelColumns'

/**
 * Regra de colunas do painel de cobertura.
 *
 * O painel só é montado depois de medir a âncora do label, então esta decisão
 * não aparece em renderização estática: o teste é da função pura que a página
 * consome.
 *
 * O caso que motivou o teste é real e apareceu lado a lado na tela de Perfis de
 * acesso: `Acesso Executivo` no Comercial tem uma página liberada e dez
 * negadas, e abria um painel estreito e altíssimo, enquanto `Operações
 * Técnicas` na Auditoria Técnica, com oito liberadas, abria em duas colunas.
 */
describe('colunas do painel de cobertura', () => {
  it('mantém uma coluna enquanto nenhuma seção passa do limite', () => {
    expect(coveragePanelColumns({ granted: 6, pending: 6, denied: 6 })).toEqual({
      granted: false,
      pending: false,
      denied: false,
      wide: false,
    })
  })

  it('divide a seção das liberadas, como sempre fez', () => {
    // Operações Técnicas na Auditoria Técnica: oito liberadas e uma negada.
    const columns = coveragePanelColumns({ granted: 8, pending: 0, denied: 1 })

    expect(columns.granted).toBe(true)
    expect(columns.denied).toBe(false)
    expect(columns.wide).toBe(true)
  })

  it('divide também a seção das negadas, que antes ficava sempre em uma coluna', () => {
    // Acesso Executivo no Comercial: uma liberada e dez negadas.
    const columns = coveragePanelColumns({ granted: 1, pending: 0, denied: 10 })

    expect(columns.denied).toBe(true)
    // Uma página liberada não vira duas colunas só porque a outra seção virou.
    expect(columns.granted).toBe(false)
    // E o painel usa a largura maior, senão as duas colunas não caberiam.
    expect(columns.wide).toBe(true)
  })

  it('divide a seção das páginas em desenvolvimento pelo mesmo critério', () => {
    const columns = coveragePanelColumns({ granted: 0, pending: 7, denied: 0 })

    expect(columns.pending).toBe(true)
    expect(columns.wide).toBe(true)
  })

  it('trata o limite como inclusivo, e o valor anterior como coluna única', () => {
    expect(coveragePanelColumns({ granted: 0, pending: 0, denied: 7 }).denied).toBe(true)
    expect(coveragePanelColumns({ granted: 0, pending: 0, denied: 6 }).denied).toBe(false)
  })

  it('não alarga o painel quando não há nada para listar', () => {
    expect(coveragePanelColumns({ granted: 0, pending: 0, denied: 0 }).wide).toBe(false)
  })
})
