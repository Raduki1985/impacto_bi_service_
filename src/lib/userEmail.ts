/**
 * Validação prática do e-mail usado como login do portal.
 *
 * Não tenta reproduzir toda a RFC de e-mail. Aceita os formatos corporativos
 * usuais, inclusive `nome+marcador@dominio.com.br`, e rejeita as formas que o
 * padrão anterior deixava passar, como pontos consecutivos, domínio iniciado
 * por hífen e final sem domínio válido.
 */
export function isValidUserEmail(value: string): boolean {
  const email = value.trim()
  if (email.length === 0 || email.length > 254) return false

  const parts = email.split('@')
  if (parts.length !== 2) return false

  const [local, domain] = parts
  if (local.length === 0 || local.length > 64 || domain.length === 0) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false

  const labels = domain.split('.')
  if (labels.length < 2) return false

  const validDomainLabel = /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/i
  if (labels.some((label) => !validDomainLabel.test(label))) return false

  const topLevelDomain = labels.at(-1)
  return topLevelDomain !== undefined && /^[A-Z]{2,63}$/i.test(topLevelDomain)
}
