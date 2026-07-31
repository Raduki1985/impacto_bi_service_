import { biAreas, type BiArea, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import { ADMIN_FULL_PERMISSION, ADMIN_USERS_READ_PERMISSION } from '../config/permissions'
import type { User } from '../data/dashboardTypes'
import type { DepartmentPageAccess } from '../types/access'

/**
 * Regra única de derivação dos acessos de um usuário. Recebe uma configuração
 * declarada por perfil e devolve os quatro campos que descrevem o acesso
 * (`permissions`, `permissionKeys`, `departments` e `departmentPageAccess`)
 * sempre coerentes entre si, para que a base mockada, o repositório e a
 * migração do armazenamento não mantenham versões divergentes da mesma regra.
 *
 * Os departamentos e as páginas vêm exclusivamente de `biAreas` e
 * `departmentPages`: nenhuma lista paralela é declarada aqui.
 *
 * Módulo puro: não lê nem grava estado, não conhece o armazenamento e não
 * decide quem pode aplicar a mudança (isso é do repositório).
 */

/**
 * Modelo dimensional. Única página fora do acesso padrão de qualquer perfil
 * não administrador: só entra quando o Administrador a libera por departamento.
 */
export const MODEL_PAGE_KEY = 'model'

/**
 * Visão Geral. Página de entrada de todo departamento e, por isso, obrigatória
 * em qualquer departamento concedido a um Usuário Departamental: o departamento
 * aparece na navegação e é para ela que o portal aponta ao entrar na área. Um
 * departamento concedido sem ela deixa um item visível sem destino autorizado.
 * Para retirar a Visão Geral, retira-se o departamento inteiro.
 */
export const OVERVIEW_PAGE_KEY = 'overview'

/**
 * Inteligência (IA). Página comum como qualquer outra: entra no acesso padrão de
 * todo departamento que a tenha no catálogo. A constante existe porque ela foi
 * acrescentada aos catálogos depois que já havia base persistida, e a migração
 * que a distribui aos Usuários Departamentais existentes precisa nomeá-la.
 */
export const INTELLIGENCE_PAGE_KEY = 'intelligence'

const ADMINISTRATOR_PERMISSIONS_TEXT = 'Todos os acessos'
const EXECUTIVE_PERMISSIONS_TEXT = 'Todos os departamentos, Usuários (leitura)'

/** Catálogo de departamentos indexado pelo id técnico e pelo rótulo exibido. */
const departmentById = new Map<string, BiArea>(biAreas.map((area) => [area.id, area]))
const departmentByLabel = new Map<string, BiArea>(biAreas.map((area) => [area.label, area]))

/** Departamento do catálogo, ou null quando o id não existe. */
export function findDepartment(departmentId: string): BiArea | null {
  return departmentById.get(departmentId.trim()) ?? null
}

/** Id técnico a partir do rótulo exibido, ou null fora do catálogo. */
export function departmentIdFromLabel(label: string): BiAreaId | null {
  return departmentByLabel.get(label.trim())?.id ?? null
}

/** Todas as páginas do departamento, inclusive o Modelo. */
export function allDepartmentPageKeys(departmentId: BiAreaId): string[] {
  return departmentPages[departmentId].map((page) => page.key)
}

/**
 * Páginas padrão de um departamento: o catálogo inteiro menos o Modelo.
 * `disabled` indica desenvolvimento, não ausência de permissão, por isso as
 * páginas em desenvolvimento fazem parte do padrão e ficam apenas bloqueadas
 * na interface.
 */
export function defaultDepartmentPageKeys(departmentId: BiAreaId): string[] {
  return departmentPages[departmentId].flatMap((page) =>
    page.key === MODEL_PAGE_KEY ? [] : [page.key],
  )
}

/** Páginas escolhidas para um departamento de um Usuário Departamental. */
export type DepartmentPageSelection = {
  departmentId: string
  pageKeys: readonly string[]
}

/**
 * Entrada de acesso por perfil. O formato impede estados inválidos por
 * construção: o Executivo não declara departamentos nem páginas comuns (são
 * fixos), e o Administrador não declara nada além do próprio perfil.
 */
export type UserAccessConfig =
  | { profile: 'Administrador' }
  | { profile: 'Executivo'; modelDepartmentIds?: readonly string[] }
  | { profile: 'Usuário Departamental'; departments: readonly DepartmentPageSelection[] }

/** Campos de um usuário que descrevem perfil e acesso, derivados em conjunto. */
export type DerivedUserAccess = Pick<
  User,
  'profile' | 'permissions' | 'permissionKeys' | 'departments' | 'departmentPageAccess'
>

/** Chaves técnicas dos departamentos informados, sem duplicatas. */
function departmentPermissionKeys(areas: readonly BiArea[]): string[] {
  const keys = new Set<string>()

  for (const area of areas) {
    if (area.requiredPermission) keys.add(area.requiredPermission)
  }

  return [...keys]
}

/** Ids do catálogo, descartando silenciosamente os desconhecidos. */
function knownDepartmentIds(departmentIds: readonly string[]): Set<string> {
  return new Set(
    departmentIds.flatMap((departmentId) => {
      const area = findDepartment(departmentId)
      return area ? [area.id] : []
    }),
  )
}

/** Departamento normalizado do Usuário Departamental, já sem páginas inválidas. */
type NormalizedSelection = {
  area: BiArea
  pageKeys: string[]
}

/**
 * Normaliza a seleção de um Usuário Departamental: agrupa departamentos
 * repetidos, ignora ids fora do catálogo, descarta páginas que não existem
 * naquele departamento, impõe a Visão Geral e devolve as páginas na ordem do
 * catálogo. A ordem dos departamentos é a da entrada, preservando a sequência
 * escolhida.
 *
 * Devolve null quando o resultado seria incoerente: nenhum departamento válido,
 * ou um departamento cujo catálogo não tem Visão Geral, porque conceder esse
 * departamento deixaria um item de navegação sem destino autorizado. Com a
 * Visão Geral imposta, um departamento selecionado nunca fica sem páginas: para
 * remover o último acesso, remove-se o departamento.
 */
function normalizeSelections(
  selections: readonly DepartmentPageSelection[],
): NormalizedSelection[] | null {
  const collected = new Map<BiAreaId, Set<string>>()
  const areas = new Map<BiAreaId, BiArea>()

  for (const selection of selections) {
    const area = findDepartment(selection.departmentId)
    if (!area) continue

    const catalog = departmentPages[area.id]
    if (!catalog.some((page) => page.key === OVERVIEW_PAGE_KEY)) return null

    const pageKeys = collected.get(area.id) ?? new Set<string>()

    // Departamento concedido implica Visão Geral, qualquer que seja a seleção.
    pageKeys.add(OVERVIEW_PAGE_KEY)

    for (const pageKey of selection.pageKeys) {
      if (catalog.some((page) => page.key === pageKey)) pageKeys.add(pageKey)
    }

    areas.set(area.id, area)
    collected.set(area.id, pageKeys)
  }

  if (!collected.size) return null

  const normalized: NormalizedSelection[] = []

  for (const [departmentId, pageKeys] of collected) {
    const area = areas.get(departmentId)
    if (!area) return null

    normalized.push({
      area,
      pageKeys: departmentPages[departmentId]
        .filter((page) => pageKeys.has(page.key))
        .map((page) => page.key),
    })
  }

  return normalized
}

/**
 * Deriva perfil e acessos a partir da configuração declarada.
 *
 * Administrador: `admin.full`, acesso global ao portal e catálogo inteiro,
 * inclusive o Modelo, sem depender de seleção granular.
 *
 * Executivo: todos os departamentos e todas as páginas comuns de cada um,
 * inclusive as que estão em desenvolvimento, mais `admin.users.read` e nenhuma
 * permissão de escrita. O Modelo entra apenas nos departamentos liberados
 * individualmente. Departamentos e páginas comuns não são configuráveis.
 *
 * Usuário Departamental: apenas os departamentos e páginas informados, já
 * normalizados contra o catálogo e sempre com a Visão Geral de cada
 * departamento concedido.
 *
 * Devolve null quando a configuração é inválida, sem lançar erro.
 */
export function deriveUserAccess(config: UserAccessConfig): DerivedUserAccess | null {
  if (config.profile === 'Administrador') {
    return {
      profile: 'Administrador',
      permissions: ADMINISTRATOR_PERMISSIONS_TEXT,
      permissionKeys: [ADMIN_FULL_PERMISSION],
      departments: biAreas.map((area) => area.label),
      departmentPageAccess: biAreas.map((area) => ({
        departmentId: area.id,
        pageKeys: allDepartmentPageKeys(area.id),
      })),
    }
  }

  if (config.profile === 'Executivo') {
    const modelDepartmentIds = knownDepartmentIds(config.modelDepartmentIds ?? [])

    return {
      profile: 'Executivo',
      permissions: EXECUTIVE_PERMISSIONS_TEXT,
      permissionKeys: [...departmentPermissionKeys(biAreas), ADMIN_USERS_READ_PERMISSION],
      departments: biAreas.map((area) => area.label),
      departmentPageAccess: biAreas.map((area) => ({
        departmentId: area.id,
        pageKeys: modelDepartmentIds.has(area.id)
          ? allDepartmentPageKeys(area.id)
          : defaultDepartmentPageKeys(area.id),
      })),
    }
  }

  const selections = normalizeSelections(config.departments)
  if (!selections) return null

  const departments = selections.map((selection) => selection.area.label)

  return {
    profile: 'Usuário Departamental',
    permissions: departments.join(', '),
    permissionKeys: departmentPermissionKeys(selections.map((selection) => selection.area)),
    departments,
    departmentPageAccess: selections.map((selection) => ({
      departmentId: selection.area.id,
      pageKeys: selection.pageKeys,
    })),
  }
}

/** Acesso por departamento de um usuário persistido, tolerante a JSON malformado. */
function storedPageAccess(user: User): DepartmentPageAccess[] {
  return Array.isArray(user.departmentPageAccess) ? user.departmentPageAccess : []
}

/** Departamentos em que o Modelo já estava liberado, para nunca ser retirado por uma migração. */
function grantedModelDepartmentIds(user: User): string[] {
  return storedPageAccess(user).flatMap((access) =>
    Array.isArray(access.pageKeys) && access.pageKeys.includes(MODEL_PAGE_KEY)
      ? [access.departmentId]
      : [],
  )
}

/**
 * Reconstrói a configuração de acesso de um usuário já armazenado a partir do
 * perfil e dos vínculos que ele tem hoje: os departamentos do Executivo e do
 * Administrador são fixos, e o Usuário Departamental mantém exatamente os
 * departamentos aos quais já pertence, recebendo as páginas padrão de cada um.
 * Liberações existentes do Modelo são preservadas em qualquer perfil.
 */
function storedAccessConfig(user: User): UserAccessConfig | null {
  if (user.profile === 'Administrador') return { profile: 'Administrador' }

  if (user.profile === 'Executivo') {
    return { profile: 'Executivo', modelDepartmentIds: grantedModelDepartmentIds(user) }
  }

  if (user.profile !== 'Usuário Departamental') return null

  const modelDepartmentIds = new Set(grantedModelDepartmentIds(user))
  const departments = Array.isArray(user.departments) ? user.departments : []

  return {
    profile: 'Usuário Departamental',
    departments: departments.flatMap((label) => {
      const departmentId = departmentIdFromLabel(label)
      if (!departmentId) return []

      const pageKeys = defaultDepartmentPageKeys(departmentId)

      return [
        {
          departmentId,
          pageKeys: modelDepartmentIds.has(departmentId)
            ? [...pageKeys, MODEL_PAGE_KEY]
            : pageKeys,
        },
      ]
    }),
  }
}

/**
 * Realinha um usuário já armazenado às regras vigentes, preservando todos os
 * campos que não descrevem acesso (id, nome, e-mail, iniciais, status, último
 * acesso e auditoria). Usuário cujo acesso não pode ser derivado (perfil
 * desconhecido ou nenhum departamento válido) volta intocado, para a migração
 * nunca destruir dados que não sabe reconstruir.
 */
export function realignUserAccess(user: User): User {
  const config = storedAccessConfig(user)
  const access = config ? deriveUserAccess(config) : null

  return access ? { ...user, ...access } : user
}

/** Aplica `realignUserAccess` a uma coleção inteira. */
export function realignUsersAccess(users: readonly User[]): User[] {
  return users.map(realignUserAccess)
}

/**
 * Acrescenta a Visão Geral aos departamentos já vinculados de um Usuário
 * Departamental que estejam sem ela.
 *
 * Diferente de `realignUserAccess`, não reaplica os padrões: nenhuma outra
 * página é reintroduzida e nenhuma é retirada, de modo que remoções feitas
 * manualmente pelo Administrador continuam valendo. Só as entradas que
 * realmente ganham a Visão Geral são reescritas, na ordem do catálogo; o
 * usuário volta intocado quando não há nada a acrescentar.
 *
 * Administrador e Executivo ficam de fora porque a própria derivação do perfil
 * já lhes dá a Visão Geral de todos os departamentos: o Administrador recebe o
 * catálogo inteiro, inclusive o Modelo, e o Executivo recebe todas as páginas
 * comuns, com o Modelo apenas onde tiver sido liberado individualmente.
 */
export function ensureUserOverviewAccess(user: User): User {
  if (user.profile !== 'Usuário Departamental') return user

  let changed = false

  const departmentPageAccess = storedPageAccess(user).map((access) => {
    const area = findDepartment(access.departmentId)
    if (!area) return access

    const catalog = departmentPages[area.id]
    if (!catalog.some((page) => page.key === OVERVIEW_PAGE_KEY)) return access

    const pageKeys = Array.isArray(access.pageKeys) ? access.pageKeys : []
    if (pageKeys.includes(OVERVIEW_PAGE_KEY)) return access

    changed = true

    return {
      ...access,
      pageKeys: catalog
        .filter((page) => page.key === OVERVIEW_PAGE_KEY || pageKeys.includes(page.key))
        .map((page) => page.key),
    }
  })

  return changed ? { ...user, departmentPageAccess } : user
}

/** Aplica `ensureUserOverviewAccess` a uma coleção inteira. */
export function ensureUsersOverviewAccess(users: readonly User[]): User[] {
  return users.map(ensureUserOverviewAccess)
}

/**
 * Acrescenta a Inteligência (IA) aos departamentos já vinculados de um Usuário
 * Departamental, nos catálogos que passaram a oferecê-la.
 *
 * Migração puramente aditiva, no mesmo espírito de `ensureUserOverviewAccess`:
 * nenhum departamento novo é concedido, nenhuma página retirada manualmente pelo
 * Administrador é reintroduzida e o Modelo continua fora, entrando apenas onde
 * já estivesse liberado. A chave entra na posição que ocupa no catálogo, antes
 * da primeira página concedida que venha depois dela, de modo que as demais
 * chaves ficam exatamente onde estavam, inclusive as que o catálogo atual não
 * reconhece. Entradas que não podem ser tratadas com segurança (departamento
 * fora do catálogo, catálogo sem a página, `pageKeys` malformado) voltam
 * intactas, e o usuário volta intocado quando não há nada a acrescentar.
 *
 * Idempotente: quem já tem a página não é reescrito. Administrador e Executivo
 * ficam de fora porque derivam o catálogo inteiro do perfil e já a enxergam.
 */
export function ensureUserIntelligenceAccess(user: User): User {
  if (user.profile !== 'Usuário Departamental') return user

  let changed = false

  const departmentPageAccess = storedPageAccess(user).map((access) => {
    const area = findDepartment(access.departmentId)
    if (!area) return access

    const catalogOrder = new Map(departmentPages[area.id].map((page, index) => [page.key, index]))
    const position = catalogOrder.get(INTELLIGENCE_PAGE_KEY)
    if (position === undefined) return access

    if (!Array.isArray(access.pageKeys)) return access

    const pageKeys = access.pageKeys
    if (pageKeys.includes(INTELLIGENCE_PAGE_KEY)) return access

    const next = pageKeys.findIndex((pageKey) => {
      const index = catalogOrder.get(pageKey)
      return index !== undefined && index > position
    })
    const insertAt = next === -1 ? pageKeys.length : next

    changed = true

    return {
      ...access,
      pageKeys: [
        ...pageKeys.slice(0, insertAt),
        INTELLIGENCE_PAGE_KEY,
        ...pageKeys.slice(insertAt),
      ],
    }
  })

  return changed ? { ...user, departmentPageAccess } : user
}

/** Aplica `ensureUserIntelligenceAccess` a uma coleção inteira. */
export function ensureUsersIntelligenceAccess(users: readonly User[]): User[] {
  return users.map(ensureUserIntelligenceAccess)
}
