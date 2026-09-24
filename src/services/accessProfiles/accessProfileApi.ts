/**
 * Acesso HTTP às rotas de Perfis de Acesso do `impacto-bi-service` e tradução
 * de cada resposta para o domínio do portal.
 *
 * O serviço é a fonte da coleção: a lista da tela Perfis de acesso, o campo
 * Perfil de Acesso do cadastro de usuários e o perfil de cada usuário são as
 * linhas de `access`, pelo UUID. Não existe mais coleção local nem ponte de ids.
 *
 * Tradução entre os dois lados:
 *
 * | portal                       | serviço                         |
 * |------------------------------|---------------------------------|
 * | `name`, `description`        | `name`, `description`           |
 * | `departmentPageAccess`       | `menu_ids`                      |
 * | `lifecycle`, `homePage`      | não existem (derivados aqui)    |
 *
 * O destino do perfil saiu dos dois lados: `access_profile_system_id` foi
 * removida do serviço, e `audience` deixou de existir no domínio do portal.
 *
 * Nada aqui decide regra de negócio. Validação de vínculos, proteção de quem
 * ficaria sem perfil e Histórico continuam no `accessProfileRepository`, que é
 * quem chama estas funções.
 */

import { CoreApiError, fetchAllCorePages, requestCoreApi } from '../../data/api/coreApiClient'
import type { AccessProfile, DepartmentPageAccess } from '../../types/access'
import type {
  CoreAccess,
  CoreAccessCreate,
  CoreAccessUpdate,
  CorePage,
  CoreProfileMenuTree,
  CoreProfileType,
} from '../../types/coreApi'
import { departmentPageAccessFromMenus, fetchProfileMenuTree, resolveMenuIds } from '../profileMenus/profileMenuApi'
import { accessProfileFromCoreAccess } from './accessProfileApiMapper'

/* -------------------------------------------------------------------------- */
/* Catálogos do serviço                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Caches de processo dos dois catálogos do serviço.
 *
 * São três tipos de perfil fixos e uma árvore de menus que muda raramente, e as
 * duas são consultadas em toda leitura e em toda gravação. O cache vive só
 * enquanto a aba está aberta: um F5 o descarta inteiro.
 */
let profileTypesCache: Promise<CoreProfileType[]> | null = null
let menuTreeCache: Promise<CoreProfileMenuTree[]> | null = null

/** Descarta os caches. Usado nos testes e após alterar menus no serviço. */
export function clearCoreCatalogCache(): void {
  profileTypesCache = null
  menuTreeCache = null
}

/**
 * Tipos de perfil do serviço (`profile_types`), já em cache.
 *
 * É o catálogo do campo Perfil do Sistema do cadastro de usuários, e a origem
 * do UUID que cada perfil de acesso e cada usuário apontam.
 */
export async function loadCoreProfileTypes(): Promise<CoreProfileType[]> {
  profileTypesCache ??= requestCoreApi<CorePage<CoreProfileType>>('/profile-types', {
    // São três registros fixos; `size` alto evita depender da paginação.
    params: { size: 100 },
  })
    .then((page) => page.list)
    // Um catálogo que falhou não pode ficar preso no cache: a tentativa seguinte
    // precisa poder chamar o serviço de novo.
    .catch((cause: unknown) => {
      profileTypesCache = null
      throw cause
    })

  return profileTypesCache
}

/** Árvore de menus do serviço, já em cache. É o que a aba Acessos consome. */
export async function loadCoreMenuTree(): Promise<CoreProfileMenuTree[]> {
  menuTreeCache ??= fetchProfileMenuTree().catch((cause: unknown) => {
    menuTreeCache = null
    throw cause
  })

  return menuTreeCache
}

/*
 * `resolveProfileTypeIdByCode` existia aqui e foi REMOVIDA.
 *
 * Ela traduzia o código fixo de um tipo de perfil no UUID que a criação de
 * Perfil de Acesso enviava em `access_profile_system_id`. Esse campo não existe
 * mais no serviço. `loadCoreProfileTypes` continua, porque o cadastro de
 * USUÁRIOS ainda escolhe um tipo de perfil — ele é o que a pessoa é no sistema.
 */

/**
 * UUIDs dos menus, recusando a gravação quando alguma página concedida não tem
 * menu correspondente no serviço.
 *
 * Gravar só a parte que casou seria pior do que recusar: o formulário mostrou N
 * páginas marcadas, o serviço guardaria menos, e ninguém veria a diferença até
 * alguém reclamar de não enxergar uma tela.
 */
async function resolveMenuIdsOrThrow(
  departmentPageAccess: readonly DepartmentPageAccess[],
): Promise<string[]> {
  const { menuIds, unmatched } = resolveMenuIds(await loadCoreMenuTree(), departmentPageAccess)

  if (unmatched.length) {
    throw new CoreApiError(
      `O serviço não publicou menu para ${unmatched.length} página(s) selecionada(s): ` +
        `${unmatched.join(', ')}. Cadastre os menus em profile_menu antes de gravar.`,
    )
  }

  return menuIds
}

/* -------------------------------------------------------------------------- */
/* Tradução                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Linhas de `access` como `AccessProfile` do portal.
 *
 * Nenhuma linha é descartada. O descarte existia por causa do TIPO do perfil:
 * um perfil de tipo que o portal não reconhecia não podia ser recebido por
 * ninguém e não virava opção em lugar nenhum. O tipo saiu do serviço, e o que
 * sobra em cada linha — nome e menus — o portal sempre entende.
 */
function translateCoreAccesses(
  accesses: readonly CoreAccess[],
  tree: readonly CoreProfileMenuTree[],
): AccessProfile[] {
  return accesses.map((access) =>
    accessProfileFromCoreAccess(
      access,
      departmentPageAccessFromMenus(
        tree,
        access.menus.map((menu) => menu.id),
      ),
    ),
  )
}

/** Um perfil do serviço, traduzido. */
async function translateOne(access: CoreAccess): Promise<AccessProfile> {
  return accessProfileFromCoreAccess(
    access,
    departmentPageAccessFromMenus(
      await loadCoreMenuTree(),
      access.menus.map((menu) => menu.id),
    ),
  )
}

/* -------------------------------------------------------------------------- */
/* Chamadas                                                                   */
/* -------------------------------------------------------------------------- */

/** Todos os perfis de acesso (`access`), com os menus de cada um. Qualquer perfil lê. */
export function fetchAllCoreAccesses(): Promise<CoreAccess[]> {
  return fetchAllCorePages<CoreAccess>('/access')
}

/**
 * Coleção completa do serviço, já no domínio do portal e na ordem do serviço.
 *
 * É a lista da tela Perfis de acesso e o catálogo do campo Perfil de Acesso do
 * cadastro de usuários.
 */
export async function loadAccessProfilesFromApi(): Promise<AccessProfile[]> {
  const [accesses, tree] = await Promise.all([fetchAllCoreAccesses(), loadCoreMenuTree()])

  return translateCoreAccesses(accesses, tree)
}

/** Campos que o formulário do portal preenche e que o serviço aceita. */
export type CoreAccessProfileInput = {
  name: string
  description?: string
  departmentPageAccess: readonly DepartmentPageAccess[]
}

/** Descrição como o serviço a espera: null quando vazia. */
function descriptionPayload(description: string | undefined): string | null {
  const trimmed = description?.trim() ?? ''

  return trimmed === '' ? null : trimmed
}

/**
 * Cria o perfil no serviço. Exige um Administrador autenticado: a rota está
 * protegida por `require_admin`.
 */
export async function createAccessProfileOnApi(
  input: CoreAccessProfileInput,
): Promise<AccessProfile> {
  const payload: CoreAccessCreate = {
    name: input.name.trim(),
    description: descriptionPayload(input.description),
    menu_ids: await resolveMenuIdsOrThrow(input.departmentPageAccess),
  }

  return translateOne(await requestCoreApi<CoreAccess>('/access', { method: 'POST', body: payload }))
}

/** Edita o perfil no serviço: nome, descrição e a lista de menus. */
export async function updateAccessProfileOnApi(
  id: string,
  input: CoreAccessProfileInput,
): Promise<AccessProfile> {
  const payload: CoreAccessUpdate = {
    name: input.name.trim(),
    description: descriptionPayload(input.description),
    menu_ids: await resolveMenuIdsOrThrow(input.departmentPageAccess),
  }

  return translateOne(
    await requestCoreApi<CoreAccess>(`/access/${id}`, { method: 'PUT', body: payload }),
  )
}

/**
 * Exclui o perfil no serviço. O serviço recusa com 409 quando há usuários
 * vinculados a ele lá.
 */
export function deleteAccessProfileOnApi(id: string): Promise<void> {
  return requestCoreApi<void>(`/access/${id}`, { method: 'DELETE' })
}
