import { describe, expect, it } from 'vitest'

import { buildVersionFileUrl, readPublishedVersion } from './publishedVersionSource'

/**
 * Os dois pontos em que o aviso de versão nova falharia CALADO: perguntando a
 * um endereço que o cache já conhece, e lendo um corpo que não é o que se
 * espera. Nenhum dos dois quebra a tela, e é justamente por isso que ninguém
 * perceberia.
 */
describe('buildVersionFileUrl', () => {
  it('leva o cache-buster do momento', () => {
    expect(buildVersionFileUrl(1_700_000_000_000)).toBe('/version.json?t=1700000000000')
  })

  it('muda de endereço a cada pergunta', () => {
    // É a razão de existir do `?t=`. Se duas perguntas seguidas usassem o
    // mesmo endereço, um proxy que ignore o `Cache-Control` devolveria o
    // carimbo antigo para sempre, e o portal concluiria que está atualizado.
    expect(buildVersionFileUrl(1)).not.toBe(buildVersionFileUrl(2))
  })
})

describe('readPublishedVersion', () => {
  it('lê o carimbo que a compilação publica', () => {
    expect(readPublishedVersion({ version: '0.1.0' })).toBe('0.1.0')
  })

  it('recusa corpo sem versão utilizável', () => {
    // O último é o caso mais provável de todos: quando o `version.json` não
    // existe, o servidor cai no atalho da SPA e devolve o `index.html`.
    expect(readPublishedVersion({})).toBeNull()
    expect(readPublishedVersion({ version: '   ' })).toBeNull()
    expect(readPublishedVersion({ version: 3 })).toBeNull()
    expect(readPublishedVersion(null)).toBeNull()
    expect(readPublishedVersion('<!doctype html>')).toBeNull()
  })
})
