import { biAreas, CORPORATE_OVERVIEW_PATH, type BiAreaId } from '../config/biAreas'
import type { User } from '../data/dashboardTypes'
import type { UserProfile } from '../types/access'
import { getDepartmentPageAccessState } from './accessControl'
import { departmentPagePath } from './departmentPageRoutes'
import { SETTINGS_ENTRY_PATH } from './settingsNavigation'
import { OVERVIEW_PAGE_KEY } from './userAccessRules'

/**
 * Regra única da Página Inicial do portal.
 *
 * Existe para que login, logotipo e rotas de entrada não repitam, cada um do seu
 * jeito, a condicional de perfil: todos consomem estas funções.
 *
 * Duas decisões, e nada além delas:
 *
 * - quem abre a Visão Geral Executiva: apenas Administrador e Executivo, pela
 *   regra aprovada do portal. O Analista nunca a abre;
 * - por qual departamento o Analista começa: o escolhido por ele, quando ainda
 *   for válido, e o primeiro permitido na ordem oficial de `biAreas` em qualquer
 *   outro caso.
 *
 * A página dentro do departamento é sempre a Visão Geral. Não existe escolha de
 * página aqui.
 *
 * Módulo puro: não lê nem grava armazenamento, não conhece React e não concede
 * acesso nenhum. A preferência entra por parâmetro, já lida por quem chamou, e
 * é sempre conferida contra os acessos atuais antes de valer. Os departamentos e
 * as rotas vêm de `biAreas`, `accessControl` e `departmentPageRoutes`: nenhuma
 * lista paralela é declarada.
 */

/**
 * Perfis do Sistema que iniciam na Visão Geral Executiva.
 *
 * Declarado como conjunto, e não como `!== 'Analista'`, de propósito: um perfil
 * gravado que não seja nenhum dos três oficiais precisa cair no caminho
 * departamental, que é o mais restrito, em vez de herdar a página executiva por
 * ser diferente de Analista.
 */
const CORPORATE_HOME_PROFILES: ReadonlySet<UserProfile> = new Set<UserProfile>([
  'Administrador',
  'Executivo',
])

/**
 * Único perfil que escolhe o departamento inicial.
 *
 * Administrador e Executivo abrem a Visão Geral Executiva e não têm o que
 * escolher; qualquer outro valor gravado no campo perfil não é um perfil do
 * portal e não recebe preferência nenhuma.
 */
const HOME_DEPARTMENT_CHOICE_PROFILE: UserProfile = 'Analista'

/**
 * Destino seguro de quem não abre a Visão Geral Executiva e também não tem
 * nenhuma Visão Geral departamental concedida.
 *
 * É a aba Meu perfil, que todo usuário autenticado alcança e que não mostra
 * dado de departamento nenhum. Não concede acesso e não é um estado esperado:
 * descreve um usuário com acesso inconsistente, e existe para o portal não
 * ficar sem destino nem cair na página executiva.
 */
export const FALLBACK_HOME_PATH = SETTINGS_ENTRY_PATH

/** true quando o usuário inicia na Visão Geral Executiva. */
export function usesCorporateHome(user: User | null): boolean {
  return user !== null && CORPORATE_HOME_PROFILES.has(user.profile)
}

/**
 * Departamentos cuja Visão Geral o usuário realmente abre hoje, na ordem oficial
 * de `biAreas`.
 *
 * A pergunta é feita ao `accessControl`, pelo par `departmentId + pageKey`, e
 * não ao texto de `user.departments`: é o mesmo critério que decide a sidebar e
 * o acesso direto por URL, então a lista nunca oferece um destino que o portal
 * recusaria em seguida.
 */
export function accessibleHomeDepartmentIds(user: User | null): BiAreaId[] {
  return biAreas
    .filter((area) => getDepartmentPageAccessState(user, area.id, OVERVIEW_PAGE_KEY) === 'enabled')
    .map((area) => area.id)
}

/**
 * Departamento inicial efetivo, ou null quando o usuário não tem nenhuma Visão
 * Geral departamental concedida.
 *
 * A preferência só vale enquanto continuar permitida: um departamento que saiu
 * do catálogo, que nunca foi concedido ou que deixou de ser é simplesmente
 * ignorado, e o primeiro permitido assume o lugar dele. Uma escolha inválida
 * nunca vira acesso, e ganhar departamentos novos não muda uma escolha que
 * continua válida.
 */
export function resolveHomeDepartmentId(
  user: User | null,
  preferredDepartmentId: string | null,
): BiAreaId | null {
  const available = accessibleHomeDepartmentIds(user)
  if (available.length === 0) return null

  const preferred = available.find((departmentId) => departmentId === preferredDepartmentId)

  return preferred ?? available[0]
}

/**
 * Caminho inicial efetivo do usuário.
 *
 * Administrador e Executivo recebem a Visão Geral Executiva. O Analista recebe a
 * Visão Geral do departamento inicial efetivo, montada por `departmentPagePath`,
 * e não por uma segunda tabela de rotas. Sem nenhuma Visão Geral concedida, o
 * destino é o seguro.
 */
export function resolveHomePath(user: User | null, preferredDepartmentId: string | null): string {
  if (usesCorporateHome(user)) return CORPORATE_OVERVIEW_PATH

  const departmentId = resolveHomeDepartmentId(user, preferredDepartmentId)
  if (departmentId === null) return FALLBACK_HOME_PATH

  return departmentPagePath(departmentId, OVERVIEW_PAGE_KEY) ?? FALLBACK_HOME_PATH
}

/**
 * true quando o usuário pode escolher o departamento inicial.
 *
 * A escolha é do Analista, e o perfil oficial é exigido por afirmação, e não pela
 * ausência de acesso executivo: um perfil gravado fora dos três oficiais, ou um
 * valor legado ainda não normalizado, também não abre a Visão Geral Executiva, e
 * um critério pela negativa entregaria o seletor a ele. Falta ainda haver
 * escolha a fazer: com um único departamento permitido o portal já abre nele.
 */
export function canChooseHomeDepartment(user: User | null): boolean {
  if (user === null || user.profile !== HOME_DEPARTMENT_CHOICE_PROFILE) return false

  return accessibleHomeDepartmentIds(user).length > 1
}

/**
 * true quando a escolha gravada precisa ser descartada de vez.
 *
 * `resolveHomeDepartmentId` já ignora uma escolha que deixou de ser permitida,
 * mas ignorar não basta: ela continuaria gravada e voltaria a valer sozinha se o
 * departamento fosse concedido de novo. Este é o sinal para quem guarda a
 * preferência apagá-la, e vale para qualquer perfil, porque o critério é apenas
 * a escolha não estar mais entre os departamentos permitidos.
 *
 * Módulo puro: aqui nada é apagado. Sem usuário ou sem escolha gravada não há
 * o que descartar.
 */
export function shouldDiscardHomeDepartment(
  user: User | null,
  storedDepartmentId: string | null,
): boolean {
  if (user === null || storedDepartmentId === null) return false

  return !accessibleHomeDepartmentIds(user).some(
    (departmentId) => departmentId === storedDepartmentId,
  )
}
