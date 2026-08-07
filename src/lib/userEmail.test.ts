import { describe, expect, it } from 'vitest'

import { isValidUserEmail } from './userEmail'

describe('e-mail de usuário', () => {
  it.each([
    'usuario@impactotelecom.com',
    'nome.sobrenome@impactotelecom.com.br',
    'nome+marcador@dominio.com',
  ])('aceita o formato corporativo válido %s', (email) => {
    expect(isValidUserEmail(email)).toBe(true)
  })

  it.each([
    '',
    'usuario',
    'usuario@dominio',
    '@dominio.com',
    'usuario@.com',
    'usuario@-dominio.com',
    'usuario@dominio-.com',
    '.usuario@dominio.com',
    'usuario.@dominio.com',
    'usu..ario@dominio.com',
    'usuario@dominio..com',
    'usuario@dominio.c',
    'usuario @dominio.com',
  ])('recusa o formato inválido %s', (email) => {
    expect(isValidUserEmail(email)).toBe(false)
  })

  it('tolera espaços somente nas pontas, que são removidos antes da gravação', () => {
    expect(isValidUserEmail('  Usuario@ImpactoTelecom.com  ')).toBe(true)
  })
})
