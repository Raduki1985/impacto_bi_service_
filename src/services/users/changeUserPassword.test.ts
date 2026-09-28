import { describe, expect, it } from 'vitest'

import { changeUserPassword } from './userRepository'

/**
 * Guardas da troca de senha de um usuário pelo cadastro.
 *
 * Mesma leitura de `setUserPassword.test.ts`: sem `VITE_CORE_API_URL` nos
 * testes, toda chamada é recusada antes da rede, e é isso que deixa ver a ORDEM
 * das guardas. O que é recusado sem tocar o serviço foi decisão do portal; o que
 * volta como falha de serviço chegou até a chamada.
 *
 * Aqui há uma divisão a mais para provar: a senha de confirmação, que é a de
 * quem está trocando, não é julgada pelo portal em momento nenhum. Quem guarda o
 * hash é o serviço, e é ele quem recusa.
 */

describe('senha nova recusada antes de qualquer chamada', () => {
  it.each([
    ['curta demais', 'Aa1!a'],
    ['sem maiúscula', 'senhanova1!'],
    ['sem minúscula', 'SENHANOVA1!'],
    ['sem número', 'SenhaNova!'],
    ['sem caractere especial', 'SenhaNova1'],
    ['vazia', ''],
  ])('recusa senha nova %s sem falar com o serviço', async (_caso, senha) => {
    const result = await changeUserPassword('u-1', {
      newPassword: senha,
      authenticatedPassword: 'SenhaDoAdmin1!',
    })

    expect(result).toEqual({ ok: false, reason: 'weak-password' })
  })

  it('recusa id em branco', async () => {
    const result = await changeUserPassword('   ', {
      newPassword: 'SenhaNova1!',
      authenticatedPassword: 'SenhaDoAdmin1!',
    })

    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })
})

describe('o que o portal não julga', () => {
  it('leva a senha de confirmação ao serviço mesmo vazia, porque conferi-la não é papel dele', async () => {
    // O diálogo já impede a confirmação com o campo vazio; o repositório não
    // repete a guarda para não passar a ideia de que sabe a senha de alguém.
    const result = await changeUserPassword('u-1', {
      newPassword: 'SenhaNova1!',
      authenticatedPassword: '',
    })

    expect(result).toEqual({
      ok: false,
      reason: 'service-failure',
      message: expect.stringContaining('não está configurado'),
    })
  })

  it('segue para o serviço quando a senha nova passa na régua', async () => {
    const result = await changeUserPassword('u-1', {
      newPassword: 'SenhaNova1!',
      authenticatedPassword: 'SenhaDoAdmin1!',
    })

    expect(result).toEqual({
      ok: false,
      reason: 'service-failure',
      message: expect.stringContaining('não está configurado'),
    })
  })
})
