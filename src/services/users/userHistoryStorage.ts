import type {
  AccessProfileHistoryAction,
  AccessProfileHistoryEvent,
  HistoryEvent,
  UserHistoryAction,
  UserHistoryEvent,
} from '../../types/userHistory'
import { USER_HISTORY_STORAGE_KEY, getStorage } from './userStorage'

/**
 * Leitura da coleção de eventos do Histórico. A gravação não mora aqui: ela
 * acontece junto com a coleção que foi alterada, em `writeStoredUsersWithEntries`,
 * porque a alteração e o evento que a descreve precisam ser persistidos na
 * mesma operação.
 *
 * A coleção é ÚNICA e guarda os dois domínios: eventos de usuários, gravados
 * pelo `userRepository`, e eventos de Perfis de Acesso, gravados por
 * `accessProfileAssignment`. Os eventos antigos, anteriores ao Histórico
 * unificado, não têm o campo `targetType` e continuam válidos exatamente como
 * estão: a validação aceita as duas formas e nada é convertido na leitura.
 *
 * O conteúdo persistido é dado externo: pode ter sido escrito por uma versão
 * antiga, editado à mão ou truncado. Por isso a coleção inteira é validada
 * campo a campo antes de ser devolvida, e nada é corrigido em silêncio. Nada é
 * apagado, reinicializado ou semeado por este módulo: conteúdo inválido é
 * reportado como falha e permanece intocado no armazenamento.
 */

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
 * round-trip e voltar idêntico de toISOString. Isso descarta de uma vez datas
 * inexistentes, formatos ambíguos, datas sem hora, horas sem milissegundos e
 * offsets diferentes de Z, que o sistema nunca produz.
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
 * Qualquer outro valor no campo não é um evento de usuário.
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

/**
 * Um evento só é aceito com todos os campos presentes e no formato certo, em
 * uma das duas formas conhecidas. Um registro incompleto seria exibido no
 * Histórico como um acontecimento sem responsável, sem alvo ou sem data, o que é
 * pior do que assumir a falha.
 */
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
 *
 * A validação é da coleção inteira, e não item a item: um único evento inválido
 * invalida a leitura, em vez de descartar aquele registro em silêncio.
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
