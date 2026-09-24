import type { Location } from 'react-router-dom'

/** Prefixo de todas as rotas do contexto de Configurações do Portal. */
const SETTINGS_PATH_PREFIX = '/dashboard/configuracoes'

/**
 * Meu perfil. A aba está comentada em `App.tsx`, mas a página e a rota
 * continuam de pé, e é isso que a torna o destino seguro: todo usuário
 * autenticado a alcança, sem depender de permissão nenhuma.
 *
 * Por isso ela deixou de ser a entrada das Configurações e virou apenas o
 * fundo do poço — quem chega às Configurações por um endereço que não existe,
 * e quem não tem nenhuma página inicial concedida.
 */
export const SETTINGS_PROFILE_PATH = `${SETTINGS_PATH_PREFIX}/meu-perfil`

/**
 * Aba aberta quando o usuário entra nas configurações pelo menu do usuário.
 *
 * Era Meu perfil, que abria para todo mundo. Com Meu perfil, Preferências e
 * Histórico comentados, entrar por uma aba invisível deixaria a barra sem
 * nenhuma aba marcada, então a entrada passou a ser Usuários, a primeira que
 * continua na barra. Quem não pode lê-la é mandado de volta pela própria rota,
 * como já acontecia com as demais abas administrativas.
 */
export const SETTINGS_ENTRY_PATH = `${SETTINGS_PATH_PREFIX}/usuarios`

/** Retorno seguro quando não há origem registrada (ex.: acesso direto pela URL). */
export const SETTINGS_FALLBACK_RETURN_PATH = '/dashboard/inicio'

/**
 * Página de origem guardada no history state. Ela acompanha a navegação entre as
 * abas de configuração para que fechar o contexto volte à página real anterior,
 * e não à aba visitada antes.
 */
export type SettingsReturnState = {
  settingsReturnTo: string
}

export function isSettingsPath(pathname: string) {
  return pathname === SETTINGS_PATH_PREFIX || pathname.startsWith(`${SETTINGS_PATH_PREFIX}/`)
}

/** Serializa pathname + search + hash para restaurar a origem por completo. */
function toReturnPath({ pathname, search, hash }: Location) {
  return `${pathname}${search}${hash}`
}

/** Aceita apenas caminhos internos que não pertençam ao próprio contexto de configurações. */
function readReturnPath(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null) return undefined

  const value = (state as Partial<SettingsReturnState>).settingsReturnTo

  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  if (value.startsWith(SETTINGS_PATH_PREFIX)) return undefined

  return value
}

/**
 * State enviado ao abrir as configurações ou ao trocar de aba: fora do contexto
 * registra a página atual; dentro dele apenas repassa a origem já registrada.
 */
export function settingsReturnState(location: Location): SettingsReturnState | undefined {
  const returnPath = isSettingsPath(location.pathname)
    ? readReturnPath(location.state)
    : toReturnPath(location)

  return returnPath ? { settingsReturnTo: returnPath } : undefined
}

/** Destino ao fechar as configurações, com fallback seguro. */
export function resolveSettingsReturnPath(state: unknown) {
  return readReturnPath(state) ?? SETTINGS_FALLBACK_RETURN_PATH
}

/**
 * Apenas o pathname da origem: identifica qual sidebar deve continuar visível
 * enquanto as configurações ocupam o conteúdo central. Search e hash pertencem
 * ao retorno e não influenciam o contexto exibido.
 */
export function resolveSettingsOriginPathname(state: unknown) {
  return resolveSettingsReturnPath(state).split(/[?#]/)[0]
}
