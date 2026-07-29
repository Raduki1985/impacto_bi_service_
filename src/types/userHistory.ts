/**
 * Evento do Histórico de usuários. Registro imutável do que aconteceu, não uma
 * referência ao estado atual: nomes do alvo e do responsável são copiados no
 * momento do evento, e os detalhes são textos prontos. Assim o histórico
 * continua legível mesmo depois de o usuário mudar de nome, de perfil ou de
 * acessos, e nenhuma leitura precisa recompor o que foi alterado.
 */

/**
 * `created` existe para a criação real de usuários, ainda não implementada, e
 * por isso nenhum evento com essa ação é gerado hoje.
 */
export type UserHistoryAction = 'created' | 'updated' | 'deactivated' | 'reactivated'

export type UserHistoryEvent = {
  id: string
  action: UserHistoryAction
  /** ISO 8601, o mesmo timestamp gravado na auditoria do usuário. */
  occurredAt: string
  targetUserId: string
  /** Nome do usuário afetado no momento do evento. */
  targetUserName: string
  actorUserId: string
  /** Nome do responsável no momento do evento. */
  actorName: string
  /** Textos simples e legíveis, um por alteração; vazio quando não se aplica. */
  details: string[]
}
