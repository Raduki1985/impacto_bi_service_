import { CoreApiError, requestCoreApi } from '../../data/api/coreApiClient'

/**
 * Os três caminhos de senha do portal que NÃO exigem sessão aberta.
 *
 * São rotas públicas do `impacto-bi-service`, e é por isso que moram fora do
 * `authSession`: nenhuma delas guarda token, nenhuma abre sessão e nenhuma toca
 * no usuário em memória. Quem acabou de definir a senha ainda precisa entrar
 * pelo formulário de login, com a senha nova.
 *
 * - PEDIR RECUPERAÇÃO (`POST /auth/recover`): o serviço responde 200 tanto para
 *   um e-mail cadastrado quanto para um desconhecido, de propósito. Uma resposta
 *   diferente para cada caso transformaria a tela em um verificador de quem tem
 *   conta no portal, e é exatamente isso que o serviço evita. A tela mostra a
 *   mesma frase nos dois casos;
 * - DEFINIR A SENHA NO PRIMEIRO ACESSO (`POST /auth/set-password`): token do
 *   e-mail de cadastro, gravado em `users.set_password`;
 * - REDEFINIR A SENHA (`POST /auth/recover/reset`): token do e-mail de
 *   recuperação, gravado em `users.password_recovery`.
 *
 * Os dois últimos são separados no serviço e continuam separados aqui: o token
 * de um é recusado com `401` no endpoint do outro, e trocar as chamadas
 * quebraria os dois fluxos de uma vez.
 */

/** Resposta das três rotas: só a frase de confirmação. */
type CoreMessageResponse = {
  message: string
}

/** Motivo da recusa, já traduzido para o que a tela precisa decidir. */
export type PasswordFlowFailureReason =
  /** Link inválido, já usado ou fora do prazo de 10 minutos. */
  | 'invalid-token'
  /** A senha não atende à regra de composição. */
  | 'weak-password'
  /** Serviço fora do ar, sem endereço configurado ou resposta irreconhecível. */
  | 'service-unavailable'

export type PasswordFlowResult =
  | { ok: true }
  | { ok: false; reason: PasswordFlowFailureReason; message: string | null }

/**
 * A parte legível de uma mensagem de validação do serviço.
 *
 * O serviço monta o texto do `422` com o caminho do campo e o rótulo do
 * Pydantic na frente: `body.password: Value error, A senha precisa ter no
 * mínimo 6 caracteres; ...`. Só o que vem depois da vírgula foi escrito para
 * ser lido por gente, e é a única parte que pode ir para a tela.
 *
 * Devolve null quando o formato não é esse, e aí quem chama usa a própria
 * frase: mostrar `body.password: ...` seria pior do que não mostrar nada.
 *
 * Exportada porque o cadastro da senha pelo administrador, em
 * `services/users/userRepository`, recebe o mesmo `422` do mesmo validador e
 * precisa limpá-lo do mesmo jeito.
 */
export function readableValidationMessage(message: string): string | null {
  const [, humanPart] = message.split(/Value error,\s*/)
  const text = humanPart?.trim() ?? ''

  return text === '' ? null : text
}

/**
 * Motivo da recusa a partir do que o serviço respondeu.
 *
 * `401` é sempre o token: as duas rotas de senha só respondem isso quando o
 * token não decodifica, não é do tipo esperado, não está mais na coluna ou já
 * venceu. A tela não distingue os quatro casos porque a saída é a mesma em
 * todos: pedir um link novo.
 *
 * `422` é a senha recusada pela regra de composição. A frase do serviço lista o
 * que faltou e é preservada, porque é mais precisa que qualquer texto fixo
 * daqui. Na prática ela quase nunca aparece: a tela aplica a mesma regra antes
 * de enviar, e só chega aqui se as duas divergirem.
 *
 * Exportada, como `loginFailureReasonFor` do `authSession`, para que a tradução
 * de cada resposta do serviço seja verificável sem subir rede nos testes.
 */
export function passwordFlowFailureFor(cause: unknown): {
  reason: PasswordFlowFailureReason
  message: string | null
} {
  if (!(cause instanceof CoreApiError)) return { reason: 'service-unavailable', message: null }

  if (cause.status === 401) return { reason: 'invalid-token', message: null }
  if (cause.status === 422) {
    return { reason: 'weak-password', message: readableValidationMessage(cause.message) }
  }

  return { reason: 'service-unavailable', message: null }
}

/**
 * Pede o e-mail com o link de recuperação.
 *
 * Só falha quando o serviço não pôde ser consultado. E-mail desconhecido NÃO é
 * falha: o serviço responde 200 sem enviar nada, e a tela diz a mesma frase.
 */
export async function requestPasswordRecovery(email: string): Promise<PasswordFlowResult> {
  try {
    await requestCoreApi<CoreMessageResponse>('/auth/recover', {
      method: 'POST',
      body: { email: email.trim() },
    })
    return { ok: true }
  } catch (cause) {
    // Um e-mail mal formado é recusado pelo `EmailStr` do serviço com 422, e não
    // pela regra de senha. A tela já valida o formato antes de enviar, então
    // aqui isso só aconteceria com um endereço que o navegador aceitou e o
    // serviço não: continua sendo algo a corrigir no campo.
    return { ok: false, ...passwordFlowFailureFor(cause) }
  }
}

/** Define a senha do primeiro acesso e ativa a conta. */
export async function setFirstAccessPassword(
  token: string,
  password: string,
): Promise<PasswordFlowResult> {
  try {
    await requestCoreApi<CoreMessageResponse>('/auth/set-password', {
      method: 'POST',
      body: { token, password },
    })
    return { ok: true }
  } catch (cause) {
    return { ok: false, ...passwordFlowFailureFor(cause) }
  }
}

/** Redefine a senha de quem já tinha uma e pediu recuperação. */
export async function resetPassword(
  token: string,
  password: string,
): Promise<PasswordFlowResult> {
  try {
    await requestCoreApi<CoreMessageResponse>('/auth/recover/reset', {
      method: 'POST',
      body: { token, password },
    })
    return { ok: true }
  } catch (cause) {
    return { ok: false, ...passwordFlowFailureFor(cause) }
  }
}
