import { pageFromSlug, pageSlugs } from '../Pages/Dashboard/pageConfig'
import { COMMERCIAL_ACCESS_PERMISSION, commercialOverviewPath } from '../Pages/Commercial/pageConfig'

export type BiAreaId = 'os' | 'comercial'

export type BiArea = {
  id: BiAreaId
  label: string
  overviewPath: string
  requiredPermission: string | null
  matchesPath: (pathname: string) => boolean
}

/** Contexto visual da navegação: uma BiArea selecionável ou um contexto administrativo somente informativo. */
export type NavigationContextId = BiAreaId | 'admin'

export type NavigationContext = {
  id: NavigationContextId
  label: string
}

const ADMIN_CONTEXT: NavigationContext = { id: 'admin', label: 'Administração' }

/** Páginas do dashboard que pertencem ao contexto administrativo, não a Ordens de Serviço. */
const adminPageSlugs = new Set<string>([pageSlugs.users, pageSlugs.permissions])

function osPageSlugFromPath(pathname: string): string | null {
  const match = /^\/dashboard\/([^/]+)\/?$/.exec(pathname)
  return match ? match[1] : null
}

function isAdminPath(pathname: string): boolean {
  const slug = osPageSlugFromPath(pathname)
  return slug !== null && adminPageSlugs.has(slug)
}

export const biAreas: BiArea[] = [
  {
    id: 'os',
    label: 'Ordens de Serviço',
    overviewPath: `/dashboard/${pageSlugs.overview}`,
    requiredPermission: null,
    matchesPath: (pathname) => {
      if (isAdminPath(pathname)) return false
      const slug = osPageSlugFromPath(pathname)
      return slug !== null && pageFromSlug(slug) !== null
    },
  },
  {
    id: 'comercial',
    label: 'Comercial',
    overviewPath: commercialOverviewPath,
    requiredPermission: COMMERCIAL_ACCESS_PERMISSION,
    matchesPath: (pathname) => pathname.startsWith('/dashboard/comercial'),
  },
]

export function getActiveBiArea(pathname: string): BiArea | null {
  return biAreas.find((area) => area.matchesPath(pathname)) ?? null
}

/** Identifica o contexto visual atual da navegação, incluindo Administração (não selecionável no dropdown). */
export function getActiveNavigationContext(pathname: string): NavigationContext | null {
  if (isAdminPath(pathname)) return ADMIN_CONTEXT

  const area = getActiveBiArea(pathname)
  return area ? { id: area.id, label: area.label } : null
}
