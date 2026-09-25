import { describe, expect, it } from 'vitest'

import {
  PASSWORD_MIN_LENGTH,
  isPasswordAccepted,
  passwordRequirements,
  unmetPasswordRequirements,
} from './passwordPolicy'

/**
 * Testes da regra de senha da TELA.
 *
 * O que está sendo verificado é o alinhamento com o `app/core/password.py` do
 * serviço: os mesmos casos passam e os mesmos casos falham dos dois lados. Uma
 * divergência aqui não quebra a segurança, porque quem recusa de verdade é o
 * serviço, mas produz o pior resultado possível para quem usa: o botão libera e
 * o serviço devolve 422.
 *
 * Os casos abaixo são deliberadamente os mesmos de `tests/test_password_policy.py`
 * do serviço.
 */

describe('senha aceita', () => {
  it.each(['SenhaNova1!', 'Aa1!aa', 'Ç4mpo#brav0', 'P@ssw0rd com espaço'])(
    'aceita %s',
    (senha) => {
      expect(isPasswordAccepted(senha)).toBe(true)
      expect(unmetPasswordRequirements(senha)).toEqual([])
    },
  )

  it('aceita exatamente no mínimo de caracteres', () => {
    expect('Aa1!aa'.length).toBe(PASSWORD_MIN_LENGTH)
    expect(isPasswordAccepted('Aa1!aa')).toBe(true)
  })
})

describe('senha recusada, e por quê', () => {
  it.each([
    ['Aa1!a', 'length'],
    ['senhanova1!', 'uppercase'],
    ['SENHANOVA1!', 'lowercase'],
    ['SenhaNova!', 'digit'],
    ['SenhaNova1', 'special'],
  ])('recusa %s por falta de %s', (senha, exigencia) => {
    expect(isPasswordAccepted(senha)).toBe(false)
    expect(unmetPasswordRequirements(senha)).toEqual([exigencia])
  })

  it('lista todas as exigências que faltaram, na ordem da tela', () => {
    expect(unmetPasswordRequirements('abc')).toEqual([
      'length',
      'uppercase',
      'digit',
      'special',
    ])
  })

  it('não conta acento como caractere especial', () => {
    // `ç` é letra minúscula, como o `islower()` do Python entende. Aceitá-la
    // como especial afrouxaria a regra sem avisar, e só na tela.
    expect(unmetPasswordRequirements('Senhaç1')).toEqual(['special'])
  })

  it('senha vazia falha em tudo', () => {
    expect(unmetPasswordRequirements('')).toEqual(
      passwordRequirements.map((rule) => rule.id),
    )
  })
})

describe('lista mostrada na tela', () => {
  it('descreve as cinco exigências, cada uma com um texto próprio', () => {
    expect(passwordRequirements.map((rule) => rule.id)).toEqual([
      'length',
      'uppercase',
      'lowercase',
      'digit',
      'special',
    ])

    const textos = passwordRequirements.map((rule) => rule.label)
    expect(new Set(textos).size).toBe(textos.length)
    expect(textos[0]).toContain(String(PASSWORD_MIN_LENGTH))
  })
})
