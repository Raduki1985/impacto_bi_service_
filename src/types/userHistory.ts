/**
 * Eventos do Histórico. Registro imutável do que aconteceu, não uma referência
 * ao estado atual: nomes do alvo e do responsável são copiados no momento do
 * evento, e os detalhes são textos prontos. Assim o histórico continua legível
 * mesmo depois de o alvo mudar de nome, de perfil ou de acessos, e nenhuma
 * leitura precisa recompor o que foi alterado.
 *
 * O Histórico deixou de ser exclusivo de usuários e passou a registrar também as
 * alterações dos Perfis de Acesso. A coleção continua sendo UMA só, na mesma
 * chave de armazenamento, porque a tela é uma área única e somente leitura.
 *
 * COMPATIBILIDADE DE LEITURA: os eventos gravados antes deste bloco não têm o
 * campo `targetType`. A ausência dele é a forma antiga de dizer "evento de
 * usuário", e por isso o campo é opcional no evento de usuário e obrigatório no
 * de Perfil de Acesso. Nenhum evento antigo precisa ser convertido, reescrito ou
 * descartado: a união é discriminada por um campo que só o domínio novo grava.
 */

/**
 * `created` existe para a criação real de usuários, ainda não implementada, e
 * por isso nenhum evento com essa ação é gerado hoje.
 */
export type UserHistoryAction = 'created' | 'updated' | 'deactivated' | 'reactivated'

/**
 * Ações do domínio dos Perfis de Acesso.
 *
 * Valores próprios, e não os mesmos textos das ações de usuário: um `created`
 * sozinho não diria se um usuário ou um Perfil de Acesso foi criado, e a tela
 * precisa distinguir os dois sem adivinhar pelo alvo.
 */
export type AccessProfileHistoryAction =
  | 'access-profile-created'
  | 'access-profile-updated'
  | 'access-profile-deleted'

/** Campos que todo evento tem, qualquer que seja o item afetado. */
type HistoryEventBase = {
  id: string
  /** ISO 8601, o mesmo timestamp gravado na operação que originou o evento. */
  occurredAt: string
  actorUserId: string
  /** Nome do responsável no momento do evento. */
  actorName: string
  /** Textos simples e legíveis, um por alteração; vazio quando não se aplica. */
  details: string[]
}

export type UserHistoryEvent = HistoryEventBase & {
  /**
   * Ausente nos eventos gravados antes do Histórico unificado, e é assim que
   * eles continuam válidos: sem este campo, o evento é de usuário.
   */
  targetType?: 'user'
  action: UserHistoryAction
  targetUserId: string
  /** Nome do usuário afetado no momento do evento. */
  targetUserName: string
}

export type AccessProfileHistoryEvent = HistoryEventBase & {
  targetType: 'access-profile'
  action: AccessProfileHistoryAction
  /** Id técnico do Perfil de Acesso afetado. */
  targetAccessProfileId: string
  /** Nome do Perfil de Acesso no momento do evento. */
  targetAccessProfileName: string
}

/** Qualquer evento da coleção única do Histórico. */
export type HistoryEvent = UserHistoryEvent | AccessProfileHistoryEvent

/** true quando o evento descreve uma alteração de Perfil de Acesso. */
export function isAccessProfileHistoryEvent(
  event: HistoryEvent,
): event is AccessProfileHistoryEvent {
  return event.targetType === 'access-profile'
}
