import { describe, expect, it } from 'vitest'

import { usersService } from './usersServices'

/**
 * Guardas do cadastro de senha pelo administrador, o segundo caminho do
 * primeiro acesso.
 *
 * Sem `VITE_CORE_API_URL` nos testes, toda chamada é recusada antes da rede. É
 * exatamente o que permite verificar a ORDEM das guardas: o que é recusado sem
 * tocar o serviço foi decidido pelo portal, e o que volta como falha de serviço
 * chegou até a chamada. Uma senha fraca não pode gastar uma ida ao serviço, e
 * muito menos ser gravada.
 */

describe('senha recusada antes de qualquer chamada', () => {
  it.each([
    ['curta demais', 'Aa1!a'],
    ['sem maiúscula', 'senhanova1!'],
    ['sem minúscula', 'SENHANOVA1!'],
    ['sem número', 'SenhaNova!'],
    ['sem caractere especial', 'SenhaNova1'],
    ['vazia', ''],
  ])('recusa senha %s sem falar com o serviço', async (_caso, senha) => {
    expect(await usersService.setUserPassword('u-1', senha)).toEqual({ ok: false, reason: 'weak-password' })
  })

  it('recusa id em branco', async () => {
    expect(await usersService.setUserPassword('   ', 'SenhaNova1!')).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })
})

describe('senha aceita pela regra', () => {
  it('segue para o serviço, e aí sim depende dele', async () => {
    // Prova o outro lado da ordem: com uma senha válida a função não recusa por
    // conta própria, e a falha que volta é a do serviço indisponível neste
    // ambiente de teste.
    const result = await usersService.setUserPassword('u-1', 'SenhaNova1!')

    expect(result).toEqual({
      ok: false,
      reason: 'service-failure',
      message: expect.stringContaining('não está configurado'),
    })
  })
})
