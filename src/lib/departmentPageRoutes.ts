import { biAreas, type BiAreaId } from '../config/biAreas'
import { departmentPages, type DepartmentPageDefinition } from '../config/departmentPages'
import { pageSlugs, type PageKey } from '../Pages/Dashboard/pageConfig'
import { OVERVIEW_PAGE_KEY } from './userAccessRules'

/**
 * Resolução de caminho das páginas departamentais.
 *
 * Uma única regra para os onze departamentos, derivada dos catálogos que já
 * existem (`biAreas`, `departmentPages` e os `pageConfig`): nenhuma lista
 * paralela de páginas, nomes ou rotas é declarada aqui. Uma página nova entra no
 * catálogo e passa a ter caminho sozinha.
 *
 * O segmento do departamento na URL é o próprio id do catálogo
 * (`/dashboard/cobranca/...`), que é o formato já publicado no portal.
 *
 * O segmento da página é a chave da página, com duas exceções que vêm dos
 * catálogos e não de uma escolha nova:
 *
 * - a Visão Geral mantém o slug `visao-geral` já publicado nos dez
 *   departamentos, para nenhuma rota atual mudar de endereço;
 * - Ordens de Serviço mantém a tabela de slugs própria (`pageSlugs`), que é
 *   anterior a este modelo e continua sendo a fonte das rotas reais dela.
 *
 * Módulo puro: não conhece React, rota nem armazenamento, e não decide acesso.
 * Quem pode abrir a página continua sendo assunto de `accessControl`.
 */

/** Raiz das rotas do portal. O segmento seguinte é sempre o id do departamento. */
const DEPARTMENT_PATH_PREFIX = '/dashboard'

const departmentIds: ReadonlySet<string> = new Set(biAreas.map((area) => area.id))

/** true quando a chave pertence à tabela de slugs de Ordens de Serviço. */
function isOrdersServicePageKey(pageKey: string): pageKey is PageKey {
  return Object.prototype.hasOwnProperty.call(pageSlugs, pageKey)
}

/**
 * Departamento do catálogo a partir do segmento da URL, ou null quando o
 * segmento não nomeia nenhum departamento. Ausência de segmento também devolve
 * null, e não erro: a rota genérica recebe o que estiver na URL.
 */
export function findDepartmentIdBySlug(slug: string | undefined): BiAreaId | null {
  if (!slug) return null

  return departmentIds.has(slug) ? (slug as BiAreaId) : null
}

/** Página do catálogo daquele departamento, ou null quando a chave não existe nele. */
export function findDepartmentPageByKey(
  departmentId: BiAreaId,
  pageKey: string | undefined,
): DepartmentPageDefinition | null {
  if (!pageKey) return null

  return departmentPages[departmentId].find((page) => page.key === pageKey) ?? null
}

/**
 * Segmento da página na URL, ou null quando a chave não está no catálogo do
 * departamento. A validação vem antes da montagem de propósito: uma chave
 * desconhecida não pode virar caminho.
 */
export function departmentPageSlug(departmentId: BiAreaId, pageKey: string): string | null {
  if (!findDepartmentPageByKey(departmentId, pageKey)) return null

  if (departmentId === 'os') {
    return isOrdersServicePageKey(pageKey) ? pageSlugs[pageKey] : null
  }

  return pageKey === OVERVIEW_PAGE_KEY ? pageSlugs.overview : pageKey
}

/** Caminho completo da página, ou null quando ela não existe naquele departamento. */
export function departmentPagePath(departmentId: BiAreaId, pageKey: string): string | null {
  const slug = departmentPageSlug(departmentId, pageKey)

  return slug === null ? null : `${DEPARTMENT_PATH_PREFIX}/${departmentId}/${slug}`
}

/** Página do departamento pelo segmento da URL, ou null quando o slug não é de nenhuma. */
export function findDepartmentPageBySlug(
  departmentId: BiAreaId,
  slug: string | undefined,
): DepartmentPageDefinition | null {
  if (!slug) return null

  return (
    departmentPages[departmentId].find(
      (page) => departmentPageSlug(departmentId, page.key) === slug,
    ) ?? null
  )
}

/**
 * Chave da página que o caminho aponta dentro do departamento, ou null.
 *
 * É o que identifica o item ativo da sidebar. Só reconhece o caminho de uma
 * página daquele departamento: um caminho de outro departamento, com segmentos a
 * mais ou com slug desconhecido devolve null, em vez de marcar um item ao acaso.
 */
export function departmentPageKeyFromPath(
  departmentId: BiAreaId,
  pathname: string,
): string | null {
  const prefix = `${DEPARTMENT_PATH_PREFIX}/${departmentId}/`
  if (!pathname.startsWith(prefix)) return null

  const slug = pathname.slice(prefix.length).replace(/\/$/, '')
  if (!slug || slug.includes('/')) return null

  return findDepartmentPageBySlug(departmentId, slug)?.key ?? null
}
