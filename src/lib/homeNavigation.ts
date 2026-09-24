import { biAreas, CORPORATE_OVERVIEW_PATH, type BiAreaId } from '../config/biAreas'
import type { User } from '../data/dashboardTypes'
import type { UserProfile } from '../types/access'
import { firstAccessibleDepartmentPageKey } from './accessControl'
import { departmentPagePath } from './departmentPageRoutes'
import { SETTINGS_ENTRY_PATH } from './settingsNavigation'

/**
 * Regra única da Página Inicial do portal.
 *
 * Existe para que login, logotipo e rotas de entrada não repitam, cada um do seu
 * jeito, a condicional de perfil: todos consomem estas funções.
 *
 * Duas decisões, e nada além delas:
 *
 * - quem abre a Visão Geral Executiva: ninguém enquanto ela estiver desligada,
 *   e apenas Administrador e Executivo quando voltar, pela regra aprovada do
 *   portal. O Analista nunca a abre;
 * - por qual departamento cada usuário começa: o escolhido por ele, quando ainda
 *   for válido; Ordens de Serviço, quando for permitido; e o primeiro permitido
 *   na ordem oficial de `biAreas` em qualquer outro caso.
 *
 * A página dentro do departamento é a primeira CONCEDIDA, por
 * `firstAccessibleDepartmentPageKey` — era sempre a Visão Geral, quando ela ainda
 * era imposta a todo departamento concedido. Não existe escolha de página aqui.
 *
 * Módulo puro: não lê nem grava armazenamento, não conhece React e não concede
 * acesso nenhum. A preferência entra por parâmetro, já lida por quem chamou, e
 * é sempre conferida contra os acessos atuais antes de valer. Os departamentos e
 * as rotas vêm de `biAreas`, `accessControl` e `departmentPageRoutes`: nenhuma
 * lista paralela é declarada.
 */

/**
 * Visão Geral Executiva ligada ou desligada, chave única do portal.
 *
 * Desligada em 23/09/2026, por decisão do Mário: ela será a última página a ser
 * implementada, e até lá ninguém começa nela. Enquanto estiver `false`, todo
 * usuário inicia na Visão Geral de um departamento permitido e todo usuário com
 * mais de um departamento escolhe qual, inclusive Administrador e Executivo.
 *
 * É uma chave, e não a remoção do caminho executivo, porque a decisão é
 * temporária: religar a página é voltar esta constante para `true`, sem
 * reescrever regra nenhuma. A rota `/dashboard/inicio` continua existindo nos
 * dois estados, porque é para ela que apontam todos os redirecionamentos do
 * portal; desligada, ela apenas encaminha para a Página Inicial de quem entrou.
 */
const CORPORATE_HOME_ENABLED = false

/**
 * Perfis do Sistema que iniciam na Visão Geral Executiva quando ela está ligada.
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
 * Departamento em que o portal abre quando o usuário ainda não escolheu nenhum.
 *
 * Ordens de Serviço, por decisão do Mário: é a Visão Geral mais completa do
 * portal hoje. Vale como preferência, e não como concessão: quem não tem a Visão
 * Geral de OS liberada continua caindo no primeiro departamento permitido, na
 * ordem oficial de `biAreas`.
 */
const DEFAULT_HOME_DEPARTMENT_ID: BiAreaId = 'os'

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
  if (!CORPORATE_HOME_ENABLED) return false

  return user !== null && CORPORATE_HOME_PROFILES.has(user.profile)
}

/**
 * Caminho em que o departamento ABRE para aquele usuário, ou null quando ele não
 * tem nenhuma página utilizável ali.
 *
 * A página vem de `firstAccessibleDepartmentPageKey`, e não é mais a Visão Geral
 * por suposição: um departamento em que só `status` foi concedido abre em Status.
 * É por isso que a entrada do portal, o clique na lista de dashboards e os
 * redirecionamentos das rotas chegam todos ao mesmo lugar.
 */
export function departmentEntryPath(user: User | null, departmentId: BiAreaId): string | null {
  const pageKey = firstAccessibleDepartmentPageKey(user, departmentId)
  if (pageKey === null) return null

  return departmentPagePath(departmentId, pageKey)
}

/**
 * Departamentos que o usuário realmente ABRE hoje, na ordem oficial de `biAreas`.
 *
 * O critério era a Visão Geral estar concedida. Deixou de ser: a Visão Geral não é
 * mais imposta a todo departamento concedido, então exigi-la excluiria daqui um
 * departamento em que a pessoa recebeu outras páginas. O critério agora é HAVER
 * destino — qualquer página concedida e disponível serve.
 *
 * A pergunta é feita ao `accessControl`, pelo par `departmentId + pageKey`, e
 * não ao texto de `user.departments`: é o mesmo critério que decide a sidebar e
 * o acesso direto por URL, então a lista nunca oferece um destino que o portal
 * recusaria em seguida.
 */
export function accessibleHomeDepartmentIds(user: User | null): BiAreaId[] {
  return biAreas
    .filter((area) => firstAccessibleDepartmentPageKey(user, area.id) !== null)
    .map((area) => area.id)
}

/**
 * Departamento inicial efetivo, ou null quando o usuário não tem nenhuma Visão
 * Geral departamental concedida.
 *
 * A preferência só vale enquanto continuar permitida: um departamento que saiu
 * do catálogo, que nunca foi concedido ou que deixou de ser é simplesmente
 * ignorado, e o padrão assume o lugar dele. Uma escolha inválida nunca vira
 * acesso, e ganhar departamentos novos não muda uma escolha que continua válida.
 *
 * Sem escolha válida, o padrão é Ordens de Serviço, e o primeiro permitido na
 * ordem oficial de `biAreas` é o último recurso, para quem não abre a Visão
 * Geral de OS.
 */
export function resolveHomeDepartmentId(
  user: User | null,
  preferredDepartmentId: string | null,
): BiAreaId | null {
  const available = accessibleHomeDepartmentIds(user)
  if (available.length === 0) return null

  const preferred = available.find((departmentId) => departmentId === preferredDepartmentId)
  if (preferred) return preferred

  const byDefault = available.find((departmentId) => departmentId === DEFAULT_HOME_DEPARTMENT_ID)

  return byDefault ?? available[0]
}

/**
 * Caminho inicial efetivo do usuário.
 *
 * Com a Visão Geral Executiva desligada, todo usuário recebe a Visão Geral do
 * departamento inicial efetivo, montada por `departmentPagePath`, e não por uma
 * segunda tabela de rotas. Religada, Administrador e Executivo voltam a receber
 * a página executiva. Sem nenhuma Visão Geral concedida, o destino é o seguro.
 */
export function resolveHomePath(user: User | null, preferredDepartmentId: string | null): string {
  if (usesCorporateHome(user)) return CORPORATE_OVERVIEW_PATH

  const departmentId = resolveHomeDepartmentId(user, preferredDepartmentId)
  if (departmentId === null) return FALLBACK_HOME_PATH

  return departmentEntryPath(user, departmentId) ?? FALLBACK_HOME_PATH
}

/**
 * true quando o usuário pode escolher o departamento inicial.
 *
 * Escolhe quem começa por um departamento, e não um perfil específico: com a
 * Visão Geral Executiva desligada isso inclui Administrador e Executivo, e
 * quando ela voltar os dois deixam de escolher sozinhos, sem tocar nesta regra.
 * O critério não concede nada: a lista oferecida é a dos departamentos que o
 * `accessControl` já libera para aquele usuário.
 *
 * Falta ainda haver escolha a fazer: com um único departamento permitido o
 * portal já abre nele, e o seletor não aparece.
 */
export function canChooseHomeDepartment(user: User | null): boolean {
  if (user === null || usesCorporateHome(user)) return false

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
