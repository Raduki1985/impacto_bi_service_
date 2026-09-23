import type {
  AccessProfileHistoryAction,
  AccessProfileHistoryEvent,
  HistoryEvent,
  UserHistoryAction,
  UserHistoryEvent,
} from '../../types/userHistory'

/**
 * Único ponto do projeto autorizado a tocar o localStorage do Histórico.
 *
 * A coleção é ÚNICA e guarda os dois domínios: eventos de usuários, gravados
 * pelo `userRepository`, e eventos de Perfis de Acesso, gravados pelo
 * `accessProfileRepository`. Os eventos antigos, anteriores ao Histórico
 * unificado, não têm o campo `targetType` e continuam válidos exatamente como
 * estão: a validação aceita as duas formas e nada é convertido na leitura.
 *
 * Os eventos nascem depois de o serviço confirmar a alteração que descrevem, e
 * são a única coisa que continua no navegador: usuários e Perfis de Acesso
 * vivem no `impacto-bi-service`.
 *
 * O conteúdo persistido é dado externo: pode ter sido escrito por uma versão
 * antiga, editado à mão ou truncado. Por isso a coleção inteira é validada
 * campo a campo antes de ser devolvida, e nada é corrigido em silêncio. Nada é
 * apagado, reinicializado ou semeado por este módulo: conteúdo inválido é
 * reportado como falha e permanece intocado no armazenamento.
 */

/** Coleção de eventos do Histórico. Mesmo padrão de nomenclatura das demais chaves. */
export const USER_HISTORY_STORAGE_KEY = 'impacto-bi.userHistory'

/** null quando indisponível (SSR, modo privado ou bloqueio do navegador). */
export function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const USER_HISTORY_ACTIONS: readonly UserHistoryAction[] = [
  'created',
  'updated',
  'deactivated',
  'reactivated',
]

const ACCESS_PROFILE_HISTORY_ACTIONS: readonly AccessProfileHistoryAction[] = [
  'access-profile-created',
  'access-profile-updated',
  'access-profile-deleted',
]

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isUserHistoryAction(value: unknown): value is UserHistoryAction {
  return USER_HISTORY_ACTIONS.some((action) => action === value)
}

function isAccessProfileHistoryAction(value: unknown): value is AccessProfileHistoryAction {
  return ACCESS_PROFILE_HISTORY_ACTIONS.some((action) => action === value)
}

/** Formato exato produzido por `new Date().toISOString()`: YYYY-MM-DDTHH:mm:ss.sssZ. */
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * Timestamp no mesmo formato ISO canônico em que o sistema grava, sem aceitar
 * variações. Só o padrão não basta: o Date normaliza datas impossíveis em
 * silêncio (2026-02-31 vira 2026-03-03), então o valor precisa sobreviver ao
 * round-trip e voltar idêntico de toISOString.
 */
function isValidTimestamp(value: unknown): boolean {
  if (!isNonEmptyString(value) || !ISO_TIMESTAMP_PATTERN.test(value)) return false

  const date = new Date(value)

  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

/**
 * Campos comuns a qualquer evento: identidade, data, responsável e detalhes.
 * Nenhum deles é opcional, porque um registro sem data ou sem responsável seria
 * exibido no Histórico como um acontecimento que ninguém consegue situar.
 */
function hasHistoryEventBase(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false

  const event = value as Record<string, unknown>

  return (
    isNonEmptyString(event.id) &&
    isValidTimestamp(event.occurredAt) &&
    isNonEmptyString(event.actorUserId) &&
    isNonEmptyString(event.actorName) &&
    Array.isArray(event.details) &&
    event.details.every((detail) => typeof detail === 'string')
  )
}

/**
 * Evento de usuário, nas duas formas que existem no armazenamento: sem
 * `targetType`, como as versões anteriores gravavam, ou com `targetType: 'user'`.
 */
function isUserHistoryEvent(value: unknown): value is UserHistoryEvent {
  if (!hasHistoryEventBase(value)) return false

  return (
    (value.targetType === undefined || value.targetType === 'user') &&
    isUserHistoryAction(value.action) &&
    isNonEmptyString(value.targetUserId) &&
    isNonEmptyString(value.targetUserName)
  )
}

/** Evento de Perfil de Acesso: `targetType` explícito e alvo próprio. */
function isAccessProfileHistoryEvent(value: unknown): value is AccessProfileHistoryEvent {
  if (!hasHistoryEventBase(value)) return false

  return (
    value.targetType === 'access-profile' &&
    isAccessProfileHistoryAction(value.action) &&
    isNonEmptyString(value.targetAccessProfileId) &&
    isNonEmptyString(value.targetAccessProfileName)
  )
}

/** Um evento só é aceito com todos os campos presentes e no formato certo. */
function isHistoryEvent(value: unknown): value is HistoryEvent {
  return isUserHistoryEvent(value) || isAccessProfileHistoryEvent(value)
}

/** Cópia defensiva: nenhuma referência interna escapa para quem lê. */
function cloneEvent(event: HistoryEvent): HistoryEvent {
  return { ...event, details: [...event.details] }
}

export function cloneUserHistoryEvents(events: readonly HistoryEvent[]): HistoryEvent[] {
  return events.map(cloneEvent)
}

/**
 * Coleção persistida de eventos.
 *
 * `[]` quando a chave ainda não existe, ou seja, nenhum evento foi registrado.
 * `null` quando a leitura falhou: armazenamento inacessível, JSON inválido,
 * conteúdo que não é um array ou qualquer evento fora do formato. A distinção
 * importa porque quem grava um evento novo precisa recusar a operação em vez de
 * sobrescrever um histórico que não conseguiu ler.
 */
export function readStoredUserHistory(): HistoryEvent[] | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(USER_HISTORY_STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    const events: unknown[] = parsed
    if (!events.every(isHistoryEvent)) return null

    return cloneUserHistoryEvents(events)
  } catch {
    return null
  }
}

/** Grava a coleção inteira. Devolve false quando o armazenamento recusou. */
export function writeStoredUserHistory(events: readonly HistoryEvent[]): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(USER_HISTORY_STORAGE_KEY, JSON.stringify(cloneUserHistoryEvents(events)))
    return true
  } catch {
    return false
  }
}

/**
 * Acrescenta um evento ao fim da coleção.
 *
 * Um Histórico ilegível recusa a gravação em vez de substituí-lo por uma lista
 * de um item só: devolve false, e quem chamou decide o que fazer. As operações
 * do portal tratam isso como registro perdido, e não como alteração perdida,
 * porque o serviço já confirmou a alteração antes de o evento existir.
 */
export function appendStoredUserHistoryEvent(event: HistoryEvent): boolean {
  const history = readStoredUserHistory()
  if (!history) return false

  return writeStoredUserHistory([...history, event])
}
