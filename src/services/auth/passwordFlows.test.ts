import { describe, expect, it } from 'vitest'

import { CoreApiError } from '../../data/api/coreApiClient'
import { passwordFlowFailureFor } from './passwordFlows'

/**
 * Tradução das recusas das rotas públicas de senha.
 *
 * A troca de mensagens com o serviço não é exercitada aqui: sem
 * `VITE_CORE_API_URL` nos testes, toda chamada é recusada antes da rede. O que
 * importa verificar é o que a tela recebe de cada resposta, porque é isso que
 * decide entre "peça um link novo" e "corrija a senha".
 */

describe('motivo da recusa pelo que o serviço respondeu', () => {
  it('401 é sempre o link, sem detalhar por quê', () => {
    // O serviço responde 401 para token ilegível, do tipo errado, já usado e
    // vencido. A saída é a mesma nos quatro, então a tela não os separa.
    expect(passwordFlowFailureFor(new CoreApiError('Token inválido ou expirado', 401))).toEqual({
      reason: 'invalid-token',
      message: null,
    })
  })

  it('422 é a senha, e preserva a frase do serviço sem o prefixo técnico', () => {
    const cause = new CoreApiError(
      'body.password: Value error, A senha precisa conter ao menos um número.',
      422,
    )

    expect(passwordFlowFailureFor(cause)).toEqual({
      reason: 'weak-password',
      message: 'A senha precisa conter ao menos um número.',
    })
  })

  it('422 fora do formato esperado não leva texto técnico para a tela', () => {
    expect(passwordFlowFailureFor(new CoreApiError('body.password: field required', 422))).toEqual({
      reason: 'weak-password',
      message: null,
    })
  })

  it('serviço indisponível para falha de rede, erro do servidor e falha desconhecida', () => {
    expect(passwordFlowFailureFor(new CoreApiError('Não foi possível falar com o serviço.'))).toEqual(
      { reason: 'service-unavailable', message: null },
    )
    expect(passwordFlowFailureFor(new CoreApiError('Falhou', 500))).toEqual({
      reason: 'service-unavailable',
      message: null,
    })
    expect(passwordFlowFailureFor(new Error('qualquer coisa'))).toEqual({
      reason: 'service-unavailable',
      message: null,
    })
  })
})
