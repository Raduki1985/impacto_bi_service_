import { biAreas, type BiArea, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import { ADMIN_FULL_PERMISSION, ADMIN_USERS_READ_PERMISSION } from '../config/permissions'
import type { User } from '../data/dashboardTypes'

/**
 * Regra única de derivação dos acessos de um usuário. Recebe uma configuração
 * declarada por perfil e devolve os quatro campos que descrevem o acesso
 * (`permissions`, `permissionKeys`, `departments` e `departmentPageAccess`)
 * sempre coerentes entre si, para que nenhum consumidor mantenha uma versão
 * divergente da mesma regra.
 *
 * NADA AQUI ACRESCENTA ACESSO a uma seleção: o que entra é o que foi declarado,
 * conferido contra os catálogos. Quem traduz as concessões do
 * `impacto-bi-service` é `services/users/userApiMapper`, que usa este módulo.
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
 * Visão Geral. A primeira página de todo departamento no catálogo, e por isso a
 * página de entrada HABITUAL — mas não uma página obrigatória.
 *
 * Era imposta a todo departamento concedido, para garantir que o item do
 * departamento tivesse destino. Não é mais: a imposição mostrava na barra lateral
 * uma página que ninguém concedeu, e quem recebe só `status` de dez submenus deve
 * ver `status` e nada mais. O destino de entrada passou a ser escolhido entre as
 * páginas concedidas, por `firstAccessibleDepartmentPageKey`.
 *
 * A constante continua valendo como a chave da Visão Geral, que os catálogos e as
 * rotas (`visao-geral`) nomeiam.
 */
export const OVERVIEW_PAGE_KEY = 'overview'

/**
 * Inteligência (IA). Página comum como qualquer outra.
 *
 * A constante existia para a migração que a distribuía aos Analistas já
 * gravados; a migração saiu junto com as outras cinco. Quem a nomeia hoje é o
 * formulário de Perfis de Acesso, em `NON_DEFAULT_SELECTION_PAGE_KEYS`: ela e o
 * Modelo ficam fora da seleção sugerida, e são marcadas uma a uma.
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

/** Páginas escolhidas para um departamento de um Analista. */
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
  | { profile: 'Analista'; departments: readonly DepartmentPageSelection[] }

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

/** Departamento normalizado do Analista, já sem páginas inválidas. */
type NormalizedSelection = {
  area: BiArea
  pageKeys: string[]
}

/**
 * Normaliza a seleção: agrupa departamentos repetidos, ignora ids fora do
 * catálogo, descarta páginas que não existem naquele departamento e devolve as
 * páginas na ordem do catálogo. A ordem dos departamentos é a da entrada,
 * preservando a sequência escolhida.
 *
 * NADA É ACRESCENTADO. A Visão Geral era imposta a todo departamento concedido,
 * e o efeito era a barra lateral mostrar DUAS páginas para quem recebeu uma: um
 * perfil que concedia só `os.status` produzia `overview` e `status`. Um acesso
 * que ninguém concedeu não pode aparecer, então a imposição saiu — quem concede
 * uma página de dez recebe aquela página, e só ela.
 *
 * Com a imposição saiu também a recusa dos catálogos sem Visão Geral: ela existia
 * apenas porque a página imposta precisava existir. O que substitui a garantia de
 * "todo departamento tem destino de entrada" é `firstAccessibleDepartmentPageKey`,
 * que abre o departamento na primeira página CONCEDIDA em vez de supor a Visão
 * Geral.
 *
 * Departamento cuja seleção não deixou nenhuma página válida é descartado: ele
 * não tem o que mostrar, e mantê-lo deixaria um item de navegação vazio. Devolve
 * null quando nenhum departamento sobra.
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
    const pageKeys = collected.get(area.id) ?? new Set<string>()

    for (const pageKey of selection.pageKeys) {
      if (catalog.some((page) => page.key === pageKey)) pageKeys.add(pageKey)
    }

    // Sem nenhuma página válida não há departamento concedido.
    if (pageKeys.size === 0) continue

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
 * ATENÇÃO, antes de reutilizar os dois primeiros ramos: eles descrevem uma
 * CONFIGURAÇÃO DECLARADA, e não o usuário que entrou no portal. O acesso de quem
 * está autenticado vem sempre das concessões do Perfil de Acesso do serviço, por
 * `deriveUserAccessFromGrants`, e nos três perfis. Derivar um Administrador por
 * `{ profile: 'Administrador' }` lhe dá os onze departamentos — foi exatamente
 * isso que fazia a barra lateral de um Administrador com um único departamento
 * concedido mostrar todos eles.
 *
 * Administrador: `admin.full`, acesso global ao portal e catálogo inteiro,
 * inclusive o Modelo, sem depender de seleção granular.
 *
 * Executivo: todos os departamentos e todas as páginas comuns de cada um,
 * inclusive as que estão em desenvolvimento, mais `admin.users.read` e nenhuma
 * permissão de escrita. O Modelo entra apenas nos departamentos liberados
 * individualmente. Departamentos e páginas comuns não são configuráveis.
 *
 * Analista: apenas os departamentos e páginas informados, já
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
    profile: 'Analista',
    permissions: departments.join(', '),
    permissionKeys: departmentPermissionKeys(selections.map((selection) => selection.area)),
    departments,
    departmentPageAccess: selections.map((selection) => ({
      departmentId: selection.area.id,
      pageKeys: selection.pageKeys,
    })),
  }
}
/*
 * As SEIS MIGRAÇÕES que ficavam aqui foram REMOVIDAS:
 * `realignUserAccess`, `realignUsersAccess`, `ensureUserOverviewAccess`,
 * `ensureUsersOverviewAccess`, `ensureUserIntelligenceAccess` e
 * `ensureUsersIntelligenceAccess`, com os auxiliares `storedPageAccess`,
 * `grantedModelDepartmentIds` e `storedAccessConfig`.
 *
 * Elas realinhavam a base de usuários GRAVADA NO NAVEGADOR quando o catálogo de
 * páginas mudava: reaplicavam as páginas padrão de cada departamento e
 * acrescentavam a Visão Geral e a Inteligência (IA) a quem estava sem elas. Duas
 * razões para sair, e a segunda é a que importa:
 *
 * - não havia base para migrar. Os usuários vêm do `impacto-bi-service` desde que
 *   `services/users/userStorage` foi removido, e nenhuma das seis tinha chamador
 *   nem teste — eram código morto;
 * - o que elas faziam passou a ser PROIBIDO. Todas ACRESCENTAVAM acesso que
 *   ninguém concedeu, e é exatamente isso que o portal deixou de fazer quando a
 *   Visão Geral parou de ser imposta a todo departamento concedido. Chamar
 *   `ensureUserOverviewAccess` hoje reintroduziria o defeito: a barra lateral
 *   mostraria a Visão Geral a quem recebeu só `status`.
 *
 * Quem precisa saber a página de entrada de um departamento usa
 * `firstAccessibleDepartmentPageKey`, em `lib/accessControl`, que ESCOLHE entre as
 * páginas concedidas em vez de conceder uma.
 */
