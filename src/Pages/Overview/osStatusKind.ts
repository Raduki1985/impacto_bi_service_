/**
 * Situação de uma OS a partir da CHAVE de status do SGI.
 *
 * A Visão Geral lê o status em cinco situações, e não em treze rótulos:
 * concluída, improdutiva, não executada, em campo e a fazer. É a leitura que
 * o gestor faz da agenda ("quantas já foram, quantas estão na rua, quantas
 * faltam, quantas falharam"), e ela vale igual para o dia de hoje e para o
 * destino das OS do período, então mora num módulo só.
 *
 * A classificação é pela chave (`status_key`), nunca pelo rótulo traduzido,
 * pelo mesmo motivo dos quatro indicadores: rótulo é apresentação e pode ser
 * renomeado sem ninguém perceber; a chave é a identidade no banco (decisão de
 * 08/09/2026). Chave desconhecida ou ausente não é escondida nem chutada: vira
 * "sem classificação", contada e visível, para uma chave nova do SGI aparecer
 * como pendência em vez de sumir do total.
 *
 * O que cada situação significa no SGI (medido em produção em 18/09/2026):
 *
 * - não executada: `closed` é o encerramento manual (desistência, ativação
 *   remota, duplicada), `expired` é a OS que passou do dia sem visita, que o
 *   SGI depois converte em `closed`, e `cancelled` não ocorre na base;
 * - em campo: do deslocamento ao provisionamento, inclusive a espera de
 *   aprovação do checklist, que é trabalho já feito aguardando conferência;
 * - a fazer: agendada, reagendada ou ainda pendente.
 */

export type OsStatusKind =
  | 'completed'
  | 'unproductive'
  | 'not-executed'
  | 'in-field'
  | 'to-do'
  | 'unknown'

const KIND_BY_STATUS_KEY: Readonly<Record<string, OsStatusKind>> = {
  completed: 'completed',
  unproductive: 'unproductive',
  closed: 'not-executed',
  expired: 'not-executed',
  cancelled: 'not-executed',
  canceled: 'not-executed',
  pending: 'to-do',
  scheduled: 'to-do',
  rescheduled: 'to-do',
  in_motion: 'in-field',
  arrived: 'in-field',
  in_progress: 'in-field',
  products_used: 'in-field',
  resolution: 'in-field',
  difficulty: 'in-field',
  syncing: 'in-field',
  checklist: 'in-field',
  pending_approval: 'in-field',
  unproductive_checklist: 'in-field',
  provision: 'in-field',
  provisioning: 'in-field',
}

/** Situação da OS pela chave do SGI; `unknown` para chave nula ou fora da lista. */
export function osStatusKind(statusKey: string | null): OsStatusKind {
  if (statusKey === null) return 'unknown'

  return KIND_BY_STATUS_KEY[statusKey] ?? 'unknown'
}

/** Chaves reconhecidas, para o teste espelho garantir que nenhuma ficou de fora. */
export const KNOWN_STATUS_KEYS: readonly string[] = Object.keys(KIND_BY_STATUS_KEY)
