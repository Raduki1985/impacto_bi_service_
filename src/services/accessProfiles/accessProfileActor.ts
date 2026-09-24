/**
 * Responsável por uma operação sobre Perfis de Acesso.
 *
 * Chega de fora, do usuário autenticado da tela, e é o que permite ao
 * repositório recusar uma gravação que ninguém identificado pediu. Módulo puro,
 * sem armazenamento e sem rede.
 *
 * Ele já foi também o autor copiado para o Histórico gravado no navegador. Esse
 * Histórico foi removido, e nada o substitui enquanto o `impacto-bi-service` não
 * expuser auditoria: o responsável hoje serve apenas à validação da operação.
 */
export type AccessProfileActor = { id: string; name: string }

/** Responsável com id e nome preenchidos, ou null: operação sem responsável não passa. */
export function normalizeActor(
  actor: AccessProfileActor | null | undefined,
): AccessProfileActor | null {
  const id = actor?.id.trim() ?? ''
  const name = actor?.name.trim() ?? ''

  return id && name ? { id, name } : null
}
