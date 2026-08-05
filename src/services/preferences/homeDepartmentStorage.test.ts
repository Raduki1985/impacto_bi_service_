import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  HOME_DEPARTMENT_STORAGE_KEY,
  readStoredHomeDepartments,
  withoutHomeDepartment,
  writeStoredHomeDepartments,
} from './homeDepartmentStorage'

/**
 * Testes da persistência mockada do departamento inicial.
 *
 * O armazenamento é substituído por uma implementação em memória instalada em
 * `globalThis.window`, o mesmo lugar que o módulo consulta: nenhum localStorage
 * real é tocado.
 */

class MemoryStorage {
  private entries = new Map<string, string>()
  private failWrites = false

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('Armazenamento cheio (simulado)')

    this.entries.set(key, value)
  }

  failAllWrites(): void {
    this.failWrites = true
  }
}

type GlobalWithWindow = { window?: { localStorage: unknown } }

function globalWithWindow(): GlobalWithWindow {
  return globalThis as unknown as GlobalWithWindow
}

let memory: MemoryStorage

beforeEach(() => {
  memory = new MemoryStorage()
  globalWithWindow().window = { localStorage: memory }
})

afterEach(() => {
  delete globalWithWindow().window
})

/* -------------------------------------------------------------------------- */
/* Leitura e escrita                                                          */
/* -------------------------------------------------------------------------- */

describe('leitura e escrita da preferência', () => {
  it('devolve coleção vazia quando a chave ainda não existe', () => {
    expect(readStoredHomeDepartments()).toEqual({})
    expect(memory.length).toBe(0)
  })

  it('grava e relê a escolha de um usuário', () => {
    expect(writeStoredHomeDepartments({ 'usr-008': 'cop' })).toBe(true)
    expect(readStoredHomeDepartments()).toEqual({ 'usr-008': 'cop' })
  })

  it('usa a chave de armazenamento do portal', () => {
    writeStoredHomeDepartments({ 'usr-008': 'cop' })

    expect(memory.getItem(HOME_DEPARTMENT_STORAGE_KEY)).toBe('{"usr-008":"cop"}')
  })

  it('substitui apenas a escolha do usuário informado, mantendo as demais', () => {
    writeStoredHomeDepartments({ 'usr-008': 'cop', 'usr-014': 'cobranca' })

    const current = readStoredHomeDepartments()

    expect(writeStoredHomeDepartments({ ...current, 'usr-008': 'gestao-frota' })).toBe(true)
    expect(readStoredHomeDepartments()).toEqual({
      'usr-008': 'gestao-frota',
      'usr-014': 'cobranca',
    })
  })

  it('mantém as escolhas de usuários diferentes independentes no mesmo navegador', () => {
    writeStoredHomeDepartments({
      'usr-008': 'cop',
      'usr-014': 'cobranca',
      'usr-015': 'retencao',
    })

    const stored = readStoredHomeDepartments()

    expect(stored['usr-008']).toBe('cop')
    expect(stored['usr-014']).toBe('cobranca')
    expect(stored['usr-015']).toBe('retencao')
  })

  it('não toca no armazenamento durante a leitura', () => {
    writeStoredHomeDepartments({ 'usr-008': 'cop' })

    const before = memory.getItem(HOME_DEPARTMENT_STORAGE_KEY)

    readStoredHomeDepartments()

    expect(memory.getItem(HOME_DEPARTMENT_STORAGE_KEY)).toBe(before)
    expect(memory.length).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* Descarte da escolha                                                        */
/* -------------------------------------------------------------------------- */

describe('remoção da escolha de um usuário', () => {
  it('remove a entrada do usuário e preserva as dos demais', () => {
    const preferences = { 'usr-008': 'cop', 'usr-014': 'cobranca', 'usr-015': 'retencao' }

    expect(withoutHomeDepartment(preferences, 'usr-014')).toEqual({
      'usr-008': 'cop',
      'usr-015': 'retencao',
    })
  })

  it('devolve a mesma referência quando não há nada a remover', () => {
    // É o que permite a quem chama não atualizar estado à toa, e é o que impede
    // ciclo quando a remoção é disparada por um efeito.
    const preferences = { 'usr-008': 'cop' }

    expect(withoutHomeDepartment(preferences, 'usr-999')).toBe(preferences)
    expect(withoutHomeDepartment({}, 'usr-008')).toEqual({})
  })

  it('não altera a coleção recebida', () => {
    const preferences = { 'usr-008': 'cop', 'usr-014': 'cobranca' }

    withoutHomeDepartment(preferences, 'usr-008')

    expect(preferences).toEqual({ 'usr-008': 'cop', 'usr-014': 'cobranca' })
  })

  it('grava a coleção já sem a entrada removida', () => {
    writeStoredHomeDepartments({ 'usr-008': 'cop', 'usr-014': 'cobranca' })

    const next = withoutHomeDepartment(readStoredHomeDepartments(), 'usr-008')

    expect(writeStoredHomeDepartments(next)).toBe(true)
    expect(memory.getItem(HOME_DEPARTMENT_STORAGE_KEY)).toBe('{"usr-014":"cobranca"}')
    expect(readStoredHomeDepartments()).toEqual({ 'usr-014': 'cobranca' })
  })

  it('não faz a escolha removida reaparecer em nenhuma leitura seguinte', () => {
    // Recuperar o acesso ao departamento mais tarde não reativa a escolha
    // antiga: ela não está mais gravada em lugar nenhum.
    writeStoredHomeDepartments({ 'usr-008': 'cop', 'usr-014': 'cobranca' })
    writeStoredHomeDepartments(withoutHomeDepartment(readStoredHomeDepartments(), 'usr-008'))

    expect(readStoredHomeDepartments()['usr-008']).toBeUndefined()
    expect(readStoredHomeDepartments()['usr-008']).toBeUndefined()
    expect(readStoredHomeDepartments()).toEqual({ 'usr-014': 'cobranca' })
  })

  it('mantém a remoção correta em memória mesmo quando a gravação falha', () => {
    writeStoredHomeDepartments({ 'usr-008': 'cop', 'usr-014': 'cobranca' })

    const next = withoutHomeDepartment(readStoredHomeDepartments(), 'usr-008')

    memory.failAllWrites()

    expect(writeStoredHomeDepartments(next)).toBe(false)
    // O estado em memória é a fonte durante a sessão: a remoção continua valendo
    // mesmo com o armazenamento intacto por causa da falha.
    expect(next).toEqual({ 'usr-014': 'cobranca' })
    expect(readStoredHomeDepartments()).toEqual({ 'usr-008': 'cop', 'usr-014': 'cobranca' })
  })
})

/* -------------------------------------------------------------------------- */
/* Conteúdo fora de forma                                                     */
/* -------------------------------------------------------------------------- */

describe('conteúdo fora de forma', () => {
  it('devolve coleção vazia para JSON inválido, sem lançar', () => {
    memory.setItem(HOME_DEPARTMENT_STORAGE_KEY, '{ isto não é json')

    expect(readStoredHomeDepartments()).toEqual({})
    expect(memory.getItem(HOME_DEPARTMENT_STORAGE_KEY)).toBe('{ isto não é json')
  })

  it('devolve coleção vazia para conteúdo que não é um objeto', () => {
    for (const raw of ['[]', '"cobranca"', '42', 'null', 'true']) {
      memory.setItem(HOME_DEPARTMENT_STORAGE_KEY, raw)

      expect(readStoredHomeDepartments()).toEqual({})
    }
  })

  it('descarta a entrada fora de forma sem perder as válidas', () => {
    memory.setItem(
      HOME_DEPARTMENT_STORAGE_KEY,
      JSON.stringify({
        'usr-008': 'cop',
        'usr-009': 42,
        'usr-010': null,
        'usr-011': '',
        'usr-012': '   ',
        'usr-013': ['cobranca'],
        'usr-014': 'cobranca',
      }),
    )

    expect(readStoredHomeDepartments()).toEqual({ 'usr-008': 'cop', 'usr-014': 'cobranca' })
  })

  it('não confere catálogo nem acesso: a validação é da regra da Página Inicial', () => {
    // O armazenamento devolve o que está gravado. Um departamento que não existe
    // mais é descartado depois, por `resolveHomeDepartmentId`, e nunca vira
    // acesso.
    memory.setItem(
      HOME_DEPARTMENT_STORAGE_KEY,
      JSON.stringify({ 'usr-008': 'departamento-que-nao-existe' }),
    )

    expect(readStoredHomeDepartments()).toEqual({ 'usr-008': 'departamento-que-nao-existe' })
  })
})

/* -------------------------------------------------------------------------- */
/* Armazenamento indisponível                                                 */
/* -------------------------------------------------------------------------- */

describe('armazenamento indisponível', () => {
  it('lê como coleção vazia e recusa a escrita sem lançar', () => {
    delete globalWithWindow().window

    expect(readStoredHomeDepartments()).toEqual({})
    expect(writeStoredHomeDepartments({ 'usr-008': 'cop' })).toBe(false)
  })

  it('responde falha de escrita sem lançar quando o armazenamento recusa', () => {
    memory.failAllWrites()

    expect(writeStoredHomeDepartments({ 'usr-008': 'cop' })).toBe(false)
    expect(memory.getItem(HOME_DEPARTMENT_STORAGE_KEY)).toBeNull()
  })
})
