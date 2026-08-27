import type { LoginFailureReason } from '../../contexts/AuthContextCore'
import type { User } from '../../data/dashboardTypes'
import {
  resolveAccessProfileAssignment,
  storedAccessProfileId,
} from '../accessProfiles/accessProfileAssignment'
import { findUserById, findUserByEmail } from '../users/userRepository'

/**
 * Sessão mockada do portal: quem está autenticado agora e como isso sobrevive a
 * um F5.
 *
 * Duas coisas moram aqui, e nada além delas:
 *
 * - a AUTORIZAÇÃO de um usuário, que é a mesma pergunta em dois momentos
 *   diferentes (entrar pelo formulário e voltar depois de recarregar a página).
 *   Ela existe uma vez só neste módulo justamente porque as duas respostas
 *   precisam ser idênticas: um usuário que não poderia entrar hoje também não
 *   pode voltar amanhã só porque o navegador guardou o id dele;
 * - a PERSISTÊNCIA do identificador, que é o mínimo necessário para reencontrar
 *   essa pessoa depois.
 *
 * O QUE É GRAVADO: somente `user.id`. Nada de senha, nome, e-mail, perfil,
 * permissões ou token. O identificador é uma chave de busca, e não uma
 * credencial: ele não prova nada e não autoriza nada por si. Toda a autorização
 * acontece de novo, contra os repositórios, a cada restauração.
 *
 * `user.id` e não o e-mail, porque o e-mail é editável em Meu perfil: uma sessão
 * apontando para um e-mail trocado deixaria de encontrar a própria pessoa.
 *
 * ISTO NÃO É SEGURANÇA. Não existe verificação de senha, assinatura, expiração
 * nem servidor: qualquer pessoa com acesso ao navegador pode escrever um id na
 * chave e ser reconhecida como aquele usuário. É persistência de conveniência
 * para um portal mockado, e continua sendo o que o AGENTS.md descreve como
 * autenticação não real.
 */

/* -------------------------------------------------------------------------- */
/* Armazenamento do identificador                                             */
/* -------------------------------------------------------------------------- */

/** Mesmo padrão de nomenclatura das demais chaves do portal. */
export const AUTH_SESSION_STORAGE_KEY = 'impacto-bi.auth-session'

/**
 * A sessão vive SOMENTE no `sessionStorage`, e isso é regra, não opção.
 *
 * O `sessionStorage` pertence à aba: recarregar a página (F5) mantém a sessão,
 * e fechar a aba ou o navegador apaga. É exatamente o comportamento pedido:
 * quem fecha a aba entra de novo pelo formulário.
 *
 * O `localStorage` foi abandonado de propósito. Era ele que sustentava o antigo
 * `Lembrar-me`, e era ele o motivo de a sessão sobreviver ao fechamento da aba.
 * A única coisa que o portal ainda faz com ele é APAGAR a chave gravada por
 * versões anteriores, para que nenhuma sessão antiga continue valendo.
 *
 * Limite conhecido, e que não depende deste código: se o próprio navegador
 * restaurar a aba fechada (Ctrl+Shift+T, ou a opção de continuar de onde
 * parou), ele devolve junto o `sessionStorage` daquela aba, e a sessão volta.
 * Fechar a aba e abrir uma nova, que é o caso normal, sempre pede login.
 */

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Armazenamento do antigo `Lembrar-me`, mantido aqui apenas para ser limpo. */
function getLegacyDeviceStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Apaga a sessão que uma versão anterior tenha deixado no `localStorage`.
 *
 * Sem isso, quem já estava logado com `Lembrar-me` continuaria logado para
 * sempre neste navegador: a chave antiga sobreviveria ao fechamento da aba e o
 * portal nunca a removeria, mesmo já não a lendo mais.
 */
function removeLegacyDeviceSession(): void {
  const storage = getLegacyDeviceStorage()
  if (!storage) return

  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY)
  } catch {
    // Armazenamento indisponível não derruba a sessão em memória.
  }
}

/** Identificador gravado na aba, ou null. Texto vazio é ausência. */
export function readStoredAuthUserId(): string | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (typeof raw !== 'string') return null

    const normalized = raw.trim()

    return normalized ? normalized : null
  } catch {
    return null
  }
}

/**
 * Grava o identificador na aba e limpa qualquer sessão antiga do dispositivo.
 *
 * Devolve false quando o armazenamento recusa (quota, modo privado,
 * indisponível), sem lançar: a sessão continua valendo em memória até o próximo
 * F5, do mesmo jeito que as demais preferências do portal.
 */
export function writeStoredAuthUserId(userId: string): boolean {
  removeLegacyDeviceSession()

  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(AUTH_SESSION_STORAGE_KEY, userId)

    return true
  } catch {
    return false
  }
}

/** Apaga a sessão da aba e a chave antiga. Usado no logout e na sessão inválida. */
export function clearStoredAuthUserId(): void {
  removeLegacyDeviceSession()

  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY)
  } catch {
    // Armazenamento indisponível não derruba a sessão em memória.
  }
}

/* -------------------------------------------------------------------------- */
/* Autorização                                                                */
/* -------------------------------------------------------------------------- */

export type AuthorizationResult =
  | { ok: true; user: User }
  | { ok: false; reason: LoginFailureReason }

/**
 * Decide se aquele cadastro pode entrar, em duas conferências e nesta ordem.
 *
 * A primeira é o cadastro: quem não existe ou está inativo não entra.
 *
 * A segunda é o Perfil de Acesso, e ela não olha o campo gravado isoladamente: o
 * vínculo é confrontado com a coleção real de Perfis de Acesso, e só autoriza
 * quando o perfil existe, está ativo e serve ao Perfil do Sistema do usuário. Com
 * isso, propriedade ausente, `null`, id inválido, perfil desativado, destino
 * incompatível e Administrador fora do `Acesso do Sistema` recusam a entrada pelo
 * mesmo caminho, sem nenhum deles precisar de uma verificação própria.
 *
 * Nenhuma senha é verificada em nenhum dos dois momentos: o portal continua
 * mockado.
 */
export function authorizeUser(candidate: User | null): AuthorizationResult {
  if (!candidate || candidate.status !== 'Ativo') {
    return { ok: false, reason: 'invalid-credentials' }
  }

  const assignment = resolveAccessProfileAssignment(
    storedAccessProfileId(candidate),
    candidate.profile,
  )

  if (!assignment.ok) {
    return {
      ok: false,
      reason:
        assignment.reason === 'access-profile-unavailable'
          ? 'access-profile-unavailable'
          : 'access-profile-required',
    }
  }

  return { ok: true, user: candidate }
}

/** Entrada pelo formulário: o e-mail resolve a pessoa, e a autorização decide. */
export function authorizeUserByEmail(email: string): AuthorizationResult {
  return authorizeUser(findUserByEmail(email))
}

/**
 * Usuário da sessão gravada, ou null.
 *
 * Chamada na montagem do provedor, ANTES de qualquer rota renderizar, e é isso
 * que faz o F5 permanecer na URL atual: a proteção de rotas nunca vê um estado
 * intermediário sem usuário, então não existe redirecionamento para o login a
 * desfazer depois.
 *
 * O usuário é CONSULTADO DE NOVO e reautorizado pela mesma regra da entrada. O id
 * gravado não é a sessão: ele só aponta para quem procurar. Entre um acesso e
 * outro a pessoa pode ter sido desativada, excluída, ter perdido o Perfil de
 * Acesso pela exclusão dele ou ter recebido um perfil incompatível, e em todos
 * esses casos a sessão gravada deixou de valer.
 *
 * Sessão que não vale é APAGADA da aba, e não apenas ignorada:
 * deixá-la ali faria o portal tentar restaurá-la em cada visita e manteria
 * gravado o vínculo de uma sessão que o portal já recusou. Inclui a recusa por
 * coleção ilegível, que é temporária: a alternativa seria manter um id que a
 * leitura seguinte também não conseguiria autorizar, e a pessoa entra de novo pelo
 * formulário.
 */
export function restoreAuthenticatedUser(): User | null {
  // A chave antiga do `Lembrar-me` morre já na primeira carga desta versão,
  // mesmo quando não há nada a restaurar: era ela que mantinha a pessoa logada
  // depois de fechar a aba, e ninguém deveria precisar passar pelo login para
  // se livrar dela.
  removeLegacyDeviceSession()

  const userId = readStoredAuthUserId()
  if (userId === null) return null

  const authorization = authorizeUser(findUserById(userId))

  if (!authorization.ok) {
    clearStoredAuthUserId()

    return null
  }

  return authorization.user
}
