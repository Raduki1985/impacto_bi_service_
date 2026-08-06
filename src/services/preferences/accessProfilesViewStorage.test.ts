import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ACCESS_PROFILES_VIEW_STORAGE_KEY,
  DEFAULT_ACCESS_PROFILES_VIEW,
  isAccessProfilesView,
  readStoredAccessProfilesView,
  writeStoredAccessProfilesView,
} from './accessProfilesViewStorage'

/**
 * Testes da persistência da visualização escolhida em Perfis de acesso.
 *
 * O armazenamento é substituído por uma implementação em memória instalada em
 * `globalThis.window`, o mesmo lugar que o módulo consulta e o mesmo arranjo já
 * usado nos testes do departamento inicial: nenhum localStorage real é tocado.
 */

class MemoryStorage {
  private entries = new Map<string, string>()
  private failWrites = false
  private failReads = false

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('Leitura recusada (simulado)')

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

  failAllReads(): void {
    this.failReads = true
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
/* Contrato do módulo                                                         */
/* -------------------------------------------------------------------------- */

describe('contrato', () => {
  it('usa o padrão de nomenclatura das demais chaves do portal', () => {
    expect(ACCESS_PROFILES_VIEW_STORAGE_KEY).toBe('impacto-bi.access-profiles-view')
  })

  it('tem grade como visualização padrão', () => {
    expect(DEFAULT_ACCESS_PROFILES_VIEW).toBe('grid')
  })
})

describe('isAccessProfilesView', () => {
  it('aceita somente list e grid', () => {
    expect(isAccessProfilesView('list')).toBe(true)
    expect(isAccessProfilesView('grid')).toBe(true)
  })

  it('recusa qualquer outro conteúdo', () => {
    for (const value of ['', ' grid', 'GRID', 'cards', 'tabela', null, undefined, 1, {}, []]) {
      expect(isAccessProfilesView(value)).toBe(false)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Leitura                                                                    */
/* -------------------------------------------------------------------------- */

describe('readStoredAccessProfilesView', () => {
  it('devolve grade quando nada foi gravado', () => {
    expect(readStoredAccessProfilesView()).toBe('grid')
  })

  it('devolve a escolha gravada', () => {
    memory.setItem(ACCESS_PROFILES_VIEW_STORAGE_KEY, 'list')

    expect(readStoredAccessProfilesView()).toBe('list')

    memory.setItem(ACCESS_PROFILES_VIEW_STORAGE_KEY, 'grid')

    expect(readStoredAccessProfilesView()).toBe('grid')
  })

  it('devolve grade quando o valor gravado não é reconhecido', () => {
    for (const invalid of ['tabela', 'GRID', ' list', '', '"grid"', '{"view":"list"}']) {
      memory.setItem(ACCESS_PROFILES_VIEW_STORAGE_KEY, invalid)

      expect(readStoredAccessProfilesView()).toBe('grid')
    }
  })

  it('não reescreve nem apaga um valor inválido que encontrou', () => {
    memory.setItem(ACCESS_PROFILES_VIEW_STORAGE_KEY, 'tabela')

    readStoredAccessProfilesView()

    expect(memory.getItem(ACCESS_PROFILES_VIEW_STORAGE_KEY)).toBe('tabela')
  })

  it('devolve grade quando o armazenamento está indisponível', () => {
    delete globalWithWindow().window

    expect(readStoredAccessProfilesView()).toBe('grid')
  })

  it('devolve grade quando a leitura do armazenamento lança', () => {
    memory.setItem(ACCESS_PROFILES_VIEW_STORAGE_KEY, 'list')
    memory.failAllReads()

    expect(readStoredAccessProfilesView()).toBe('grid')
  })
})

/* -------------------------------------------------------------------------- */
/* Escrita                                                                    */
/* -------------------------------------------------------------------------- */

describe('writeStoredAccessProfilesView', () => {
  it('grava a escolha e confirma', () => {
    expect(writeStoredAccessProfilesView('list')).toBe(true)
    expect(memory.getItem(ACCESS_PROFILES_VIEW_STORAGE_KEY)).toBe('list')
  })

  it('grava texto puro, sem envelope JSON', () => {
    writeStoredAccessProfilesView('grid')

    expect(memory.getItem(ACCESS_PROFILES_VIEW_STORAGE_KEY)).toBe('grid')
  })

  it('substitui a escolha anterior em vez de acumular', () => {
    writeStoredAccessProfilesView('list')
    writeStoredAccessProfilesView('grid')

    expect(memory.getItem(ACCESS_PROFILES_VIEW_STORAGE_KEY)).toBe('grid')
    expect(memory.length).toBe(1)
  })

  it('devolve false, sem lançar, quando o armazenamento recusa', () => {
    memory.failAllWrites()

    expect(() => writeStoredAccessProfilesView('list')).not.toThrow()
    expect(writeStoredAccessProfilesView('list')).toBe(false)
  })

  it('devolve false, sem lançar, quando o armazenamento está indisponível', () => {
    delete globalWithWindow().window

    expect(() => writeStoredAccessProfilesView('list')).not.toThrow()
    expect(writeStoredAccessProfilesView('list')).toBe(false)
  })

  it('mantém a leitura coerente com o que foi gravado', () => {
    writeStoredAccessProfilesView('list')

    expect(readStoredAccessProfilesView()).toBe('list')
  })
})
