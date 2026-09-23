import { ADMIN_FULL_PERMISSION, ADMIN_USERS_READ_PERMISSION } from '../../config/permissions'
import type { User } from '../../data/dashboardTypes'
import { initials } from '../../lib/formatters'
import { deriveUserAccess, type DerivedUserAccess } from '../../lib/userAccessRules'
import type {
  DepartmentPageAccess,
  UserAuditMetadata,
  UserProfile,
  UserStatus,
} from '../../types/access'
import type {
  CoreProfileType,
  CoreProfileTypeCode,
  CoreUser,
  CoreUserStatus,
} from '../../types/coreApi'

/**
 * Tradução do que o `impacto-bi-service` devolve sobre usuários para o domínio
 * do portal: o usuário e o tipo de perfil. O perfil de acesso é traduzido em
 * `accessProfiles/accessProfileApiMapper`.
 *
 * Os dois lados não têm o mesmo formato, e a tradução é a razão de este módulo
 * existir:
 *
 * | serviço                         | portal                                   |
 * |---------------------------------|------------------------------------------|
 * | `id` (UUID)                     | `id`                                     |
 * | `profile_type.code`             | `profile` (Administrador, Executivo...)  |
 * | `status` (active/inactive/...)  | `status` (Ativo, Inativo)                |
 * | `last_access` (ISO)             | `lastAccess` (`dd/MM/yyyy HH:mm`)        |
 * | `access_profile_id` (UUID)      | `accessProfileId` (o mesmo UUID)         |
 * | menus do perfil de acesso       | `departments`, `departmentPageAccess`... |
 *
 * A última linha chega por CONTEXTO, e não do usuário: o serviço não devolve os
 * menus dentro do usuário. Quem chama os busca e entrega prontos.
 *
 * O perfil de acesso do usuário É o da tabela `access` do serviço, pelo UUID:
 * o cadastro de usuários escolhe entre os perfis que o serviço tem, e o portal
 * não traduz mais esse vínculo para a coleção local do navegador.
 *
 * Módulo puro: não lê nem grava armazenamento e não chama o serviço. É o que
 * permite testá-lo sem rede.
 */

/* -------------------------------------------------------------------------- */
/* Perfil do Sistema                                                          */
/* -------------------------------------------------------------------------- */

/** Código do tipo de perfil do serviço para cada Perfil do Sistema do portal. */
export const PROFILE_TYPE_CODE_BY_USER_PROFILE: Record<UserProfile, CoreProfileTypeCode> = {
  Administrador: 'adm',
  Executivo: 'executive',
  Analista: 'analyst',
}

const USER_PROFILE_BY_CODE: Record<CoreProfileTypeCode, UserProfile> = {
  adm: 'Administrador',
  executive: 'Executivo',
  analyst: 'Analista',
}

/**
 * Perfil do Sistema a partir do código do serviço, ou null quando o código não
 * é um dos três conhecidos. Caixa e espaços são tolerados, porque o serviço
 * compara o código sem diferenciar caixa.
 */
export function userProfileFromCode(code: string | null | undefined): UserProfile | null {
  if (typeof code !== 'string') return null

  const normalized = code.trim().toLowerCase()

  return normalized in USER_PROFILE_BY_CODE
    ? USER_PROFILE_BY_CODE[normalized as CoreProfileTypeCode]
    : null
}

/**
 * Opção do campo Perfil do Sistema: uma linha de `profile_types` do serviço.
 *
 * O `id` é o UUID enviado ao serviço; o `name` é o texto exibido, o da tabela;
 * o `profile` é a leitura do portal para aquele código, e é por ele que as
 * regras locais (cores, compatibilidade, proteção do último Administrador)
 * continuam funcionando.
 */
export type SystemProfileOption = {
  id: string
  code: CoreProfileTypeCode
  name: string
  profile: UserProfile
}

/**
 * Tipo de perfil do serviço como opção do formulário, ou null quando o código
 * não é um dos três que o portal sabe ler. Um tipo desconhecido não vira opção:
 * o portal não teria como derivar acesso nenhum para quem o recebesse.
 */
export function systemProfileOptionFromCore(type: CoreProfileType): SystemProfileOption | null {
  const profile = userProfileFromCode(type.code)
  if (profile === null) return null

  return {
    id: type.id,
    code: type.code.trim().toLowerCase() as CoreProfileTypeCode,
    name: type.name.trim(),
    profile,
  }
}

/* -------------------------------------------------------------------------- */
/* Situação e último acesso                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Só `active` entra no portal; `inactive` e `blocked` são os dois lidos como
 * `Inativo`, porque o domínio local não distingue bloqueio de desativação.
 */
export function userStatusFromCore(status: CoreUserStatus): UserStatus {
  return status === 'active' ? 'Ativo' : 'Inativo'
}

/** Texto de quem nunca entrou, o mesmo que o cadastro local sempre usou. */
export const NEVER_ACCESSED_LABEL = 'Nunca acessou'

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * `dd/MM/yyyy HH:mm` no fuso local, que é o formato que a tabela de Usuários
 * lê para montar o dia da semana. Ausência, texto vazio e data que o navegador
 * não entende viram `Nunca acessou`, e não uma data inventada.
 */
export function formatLastAccess(lastAccess: string | null): string {
  if (lastAccess === null || lastAccess.trim() === '') return NEVER_ACCESSED_LABEL

  const date = new Date(lastAccess)
  if (Number.isNaN(date.getTime())) return NEVER_ACCESSED_LABEL

  return (
    `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
  )
}

/* -------------------------------------------------------------------------- */
/* Acesso expandido                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Acesso que o usuário não recebeu de menu nenhum: perfil mantido, e nenhum
 * departamento. É a leitura honesta de um perfil de acesso ainda sem menus no
 * serviço, e não uma concessão inventada para a navegação não ficar vazia.
 */
function emptyAccess(profile: UserProfile, permissionKeys: string[] = []): DerivedUserAccess {
  return { profile, permissions: '', permissionKeys, departments: [], departmentPageAccess: [] }
}

/**
 * Campos expandidos de acesso a partir do que o perfil de acesso do serviço
 * concede.
 *
 * OS TRÊS PERFIS derivam os departamentos e as páginas das MESMAS concessões, as
 * do Perfil de Acesso cadastrado no serviço. O que o Perfil do Sistema muda é só
 * o que se pode FAZER, e isso são permissões administrativas:
 *
 * | perfil        | departamentos e páginas | permissões administrativas |
 * |---------------|-------------------------|----------------------------|
 * | Administrador | as concedidas           | `admin.full`               |
 * | Executivo     | as concedidas           | `admin.users.read`         |
 * | Analista      | as concedidas           | nenhuma                    |
 *
 * O Administrador recebia aqui o catálogo INTEIRO, ignorando as concessões, e o
 * resultado era um Administrador cujo Perfil de Acesso liberava só Ordens de
 * Serviço enxergando os onze departamentos na barra lateral. Deixou de receber:
 * o cadastro de Perfis de Acesso só tem sentido se ele valer para quem o recebeu,
 * e um Administrador sem menu nenhum concedido é uma pessoa que administra o
 * portal sem abrir dashboard nenhum — estranho de configurar, mas é o que o
 * cadastro diz, e o portal não inventa acesso para consertar isso.
 *
 * Diferença deliberada: nenhum dos três é erro sem departamento concedido. O
 * serviço autenticou a pessoa, e o portal a recebe com a navegação vazia, que é o
 * retrato real de um perfil de acesso sem menus.
 */
export function deriveUserAccessFromGrants(
  userProfile: UserProfile,
  grants: readonly DepartmentPageAccess[],
): DerivedUserAccess {
  /**
   * As concessões são normalizadas pela regra do Analista em qualquer perfil: é
   * ela que confere os pares contra o catálogo local, descarta o que o portal não
   * publica e ordena as páginas. O perfil informado volta no resultado logo
   * abaixo — aqui `Analista` é o modo de derivar, não o perfil da pessoa.
   */
  const granted = deriveUserAccess({
    profile: 'Analista',
    departments: grants.map((access) => ({
      departmentId: access.departmentId,
      pageKeys: access.pageKeys,
    })),
  })

  /** Permissões administrativas de cada Perfil do Sistema. */
  const adminPermissionKeys: Record<UserProfile, string[]> = {
    Administrador: [ADMIN_FULL_PERMISSION],
    Executivo: [ADMIN_USERS_READ_PERMISSION],
    Analista: [],
  }

  const adminKeys = adminPermissionKeys[userProfile]

  if (!granted) return emptyAccess(userProfile, adminKeys)

  return {
    profile: userProfile,
    permissions: granted.permissions,
    permissionKeys: [...new Set([...granted.permissionKeys, ...adminKeys])],
    departments: granted.departments,
    departmentPageAccess: granted.departmentPageAccess,
  }
}

/* -------------------------------------------------------------------------- */
/* Usuário                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Usuário que o serviço devolveu em um formato que o portal não sabe ler.
 *
 * É diferente de uma falha de rede: o serviço respondeu, e a resposta é que não
 * cabe no domínio. Erro próprio para quem trata a falha dizer isso à pessoa em
 * vez de mandar conferir a conexão.
 */
export class CoreUserMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoreUserMappingError'
  }
}

/** O que o tradutor precisa receber além do usuário do serviço. */
export type CoreUserMappingContext = {
  /** Departamentos e páginas concedidos pelo perfil de acesso no serviço. */
  grants: readonly DepartmentPageAccess[]
}

/** Auditoria com o que o serviço expõe: datas. Quem criou e alterou não vem. */
function auditFrom(core: CoreUser): Partial<UserAuditMetadata> | undefined {
  const audit: Partial<UserAuditMetadata> = {}

  if (core.created_at) audit.createdAt = core.created_at
  if (core.updated_at) audit.updatedAt = core.updated_at

  return Object.keys(audit).length ? audit : undefined
}

/**
 * `User` do portal a partir do usuário do serviço e do contexto já resolvido.
 *
 * Lança `CoreUserMappingError` quando o tipo de perfil não é um dos três
 * conhecidos: um usuário sem Perfil do Sistema não tem como aparecer na tabela
 * nem entrar no portal, e escondê-lo em silêncio seria pior do que recusar.
 */
export function mapCoreUser(core: CoreUser, context: CoreUserMappingContext): User {
  const profile = userProfileFromCode(core.profile_type?.code)

  if (profile === null) {
    throw new CoreUserMappingError(
      `O serviço devolveu o usuário ${core.email} com um tipo de perfil que o portal não ` +
        `reconhece (${core.profile_type?.code ?? 'sem tipo'}).`,
    )
  }

  const name = core.name.trim()

  return {
    id: core.id,
    name,
    email: core.email.trim().toLowerCase(),
    ...deriveUserAccessFromGrants(profile, context.grants),
    // O UUID da tabela `access`, e não um id local: é ele que o catálogo do
    // formulário usa, e é ele que volta ao serviço na edição.
    accessProfileId: core.access_profile_id,
    status: userStatusFromCore(core.status),
    audit: auditFrom(core),
    lastAccess: formatLastAccess(core.last_access),
    initials: initials(name),
  }
}


/**
 * Ordem de criação, do mais antigo para o mais novo.
 *
 * O serviço lista do mais novo para o mais antigo; o portal sempre mostrou a
 * base na ordem de cadastro, com o usuário recém-criado na última página. A
 * tabela depende disso para saltar até ele depois de salvar. Sem data de
 * criação, o usuário vai para o fim, e empates mantêm a ordem recebida.
 */
export function compareByCreation(first: CoreUser, second: CoreUser): number {
  const a = first.created_at ?? ''
  const b = second.created_at ?? ''

  if (a === b) return 0
  if (a === '') return 1
  if (b === '') return -1

  return a < b ? -1 : 1
}
