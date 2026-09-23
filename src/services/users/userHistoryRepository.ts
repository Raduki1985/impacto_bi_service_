import type { HistoryEvent } from '../../types/userHistory'
import { readStoredUserHistory } from './userHistoryStorage'

/**
 * Acesso de leitura ao Histórico. Somente leitura por definição: os eventos
 * nascem nas operações do `userRepository` e do `accessProfileRepository`,
 * gravados depois de o serviço confirmar a alteração que descrevem, e nunca
 * são editados ou removidos depois.
 *
 * A coleção é única e mistura os dois domínios: quem lê recebe eventos de
 * usuários e de Perfis de Acesso na mesma lista, ordenados apenas pelo momento
 * em que aconteceram.
 */

/**
 * Resultado explícito da listagem: a página precisa distinguir "ainda não há
 * eventos", que é um estado normal, de "não foi possível ler", que é falha de
 * armazenamento. Nenhum evento fictício é criado em nenhum dos casos.
 */
export type UserHistoryListResult =
  | {
      ok: true
      events: HistoryEvent[]
    }
  | {
      ok: false
      reason: 'storage-failure'
    }

/**
 * Eventos do mais recente para o mais antigo. Empates de horário mantêm o
 * último registrado à frente: a coleção é gravada em ordem de acontecimento,
 * então inverter antes de ordenar por data resolve o desempate sem depender de
 * campo adicional (a ordenação do JavaScript é estável).
 *
 * Devolve cópias, como o repositório de usuários: nada do que sai daqui pode
 * alterar a coleção persistida.
 */
export function listUserHistoryEvents(): UserHistoryListResult {
  const stored = readStoredUserHistory()
  if (!stored) return { ok: false, reason: 'storage-failure' }

  const events = stored
    .reverse()
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))

  return { ok: true, events }
}
