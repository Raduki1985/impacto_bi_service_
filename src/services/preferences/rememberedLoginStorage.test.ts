import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  declineRememberedLogin,
  readRememberedLogin,
  rememberLoginEmail,
  REMEMBERED_LOGIN_STORAGE_KEY,
} from './rememberedLoginStorage'

/**
 * Testes da memória do último e-mail da tela de entrada.
 *
 * O armazenamento é substituído por uma implementação em memória instalada em
 * `globalThis.window`, o mesmo lugar que o módulo consulta: nenhum localStorage
 * real é tocado.
 *
 * O que está sendo verificado é o contrato da tela: quando a caixa aparece
 * marcada, quando o campo vem preenchido e o que a recusa apaga. A sessão não
 * entra aqui: ela é assunto de `services/auth/authService`.
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

describe('memória do último e-mail usado na entrada', () => {
  it('começa indeciso, sem nada gravado', () => {
    expect(readRememberedLogin()).toEqual({ status: 'undecided' })
    expect(memory.length).toBe(0)
  })

  it('guarda e relê o e-mail de quem entrou', () => {
    expect(rememberLoginEmail('pessoa@impactotelecom.com')).toBe(true)

    expect(readRememberedLogin()).toEqual({
      status: 'remembered',
      email: 'pessoa@impactotelecom.com',
    })
  })

  it('grava apenas o e-mail, em uma única chave', () => {
    rememberLoginEmail('pessoa@impactotelecom.com')

    expect(memory.length).toBe(1)
    expect(memory.getItem(REMEMBERED_LOGIN_STORAGE_KEY)).toBe('pessoa@impactotelecom.com')
  })

  it('troca o e-mail guardado quando outra pessoa entra', () => {
    rememberLoginEmail('primeira@impactotelecom.com')
    rememberLoginEmail('segunda@impactotelecom.com')

    expect(readRememberedLogin()).toEqual({
      status: 'remembered',
      email: 'segunda@impactotelecom.com',
    })
  })

  it('ignora espaços em volta do e-mail', () => {
    rememberLoginEmail('  pessoa@impactotelecom.com  ')

    expect(readRememberedLogin()).toEqual({
      status: 'remembered',
      email: 'pessoa@impactotelecom.com',
    })
  })

  it('não guarda e-mail vazio', () => {
    expect(rememberLoginEmail('   ')).toBe(false)
    expect(readRememberedLogin()).toEqual({ status: 'undecided' })
  })

  it('a recusa apaga o e-mail de quem entrou antes e permanece gravada', () => {
    rememberLoginEmail('pessoa@impactotelecom.com')

    expect(declineRememberedLogin()).toBe(true)

    expect(readRememberedLogin()).toEqual({ status: 'declined' })
    expect(memory.getItem(REMEMBERED_LOGIN_STORAGE_KEY)).toBe('')
  })

  it('marcar a caixa de novo volta a guardar o e-mail', () => {
    declineRememberedLogin()
    rememberLoginEmail('pessoa@impactotelecom.com')

    expect(readRememberedLogin()).toEqual({
      status: 'remembered',
      email: 'pessoa@impactotelecom.com',
    })
  })

  it('trata conteúdo em branco gravado à mão como recusa', () => {
    memory.setItem(REMEMBERED_LOGIN_STORAGE_KEY, '   ')

    expect(readRememberedLogin()).toEqual({ status: 'declined' })
  })

  it('não lança quando o armazenamento recusa a gravação', () => {
    memory.failAllWrites()

    expect(rememberLoginEmail('pessoa@impactotelecom.com')).toBe(false)
    expect(declineRememberedLogin()).toBe(false)
  })

  it('não lança sem window disponível', () => {
    delete globalWithWindow().window

    expect(readRememberedLogin()).toEqual({ status: 'undecided' })
    expect(rememberLoginEmail('pessoa@impactotelecom.com')).toBe(false)
    expect(declineRememberedLogin()).toBe(false)
  })
})
