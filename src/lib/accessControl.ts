import { biAreas, type BiArea, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import type { AuthUser } from '../types/user/userTypes'

/**
 * Regra pura de autorização de uma página de departamento.
 *
 * O acesso é SEMPRE avaliado pelo par departmentId + pageKey no mesmo registro
 * de `departmentPageAccess`, porque a mesma chave de página (overview, model)
 * existe em vários departamentos e conceder uma delas não pode liberar as outras.
 *
 * Não existe bypass, e isso vale inclusive para o Administrador. `admin.full`
 * concedia qualquer página aqui, o que fazia a barra lateral de um Administrador
 * mostrar os onze departamentos mesmo quando o Perfil de Acesso dele liberava só
 * um. O que o Administrador PODE FAZER continua vindo de `admin.full`; o que ele
 * VÊ vem do Perfil de Acesso cadastrado no serviço, como para qualquer perfil.
 *
 * O estado de desenvolvimento da página (`disabled`) não faz parte desta função:
 * ter permissão e a página estar pronta são condições independentes, tratadas
 * separadamente.
 */
export function hasDepartmentPageAccess(
  user: AuthUser | null,
  departmentId: BiAreaId,
  pageKey: string,
): boolean {
  if (!user) return false

  return (user.departmentPageAccess ?? []).some(
    (access) => access.departmentId === departmentId && access.pageKeys.includes(pageKey),
  )
}

/** Como uma página departamental deve se comportar para um usuário. */
export type DepartmentPageAccessState =
  | 'hidden'
  | 'enabled'
  | 'disabled'

/**
 * Combina a permissão do usuário com o catálogo de páginas do departamento.
 *
 * `hidden` cobre os dois casos em que a página não deve sequer ser exibida: ela
 * não existe no catálogo daquele departamento, ou o usuário não tem permissão
 * sobre ela. `disabled` é a página autorizada que ainda está em desenvolvimento,
 * e `enabled` é a página autorizada e disponível.
 *
 * `admin.full` continua sendo tratado apenas em `hasDepartmentPageAccess`: ele
 * concede permissão sobre qualquer página, mas não ignora o estado de
 * desenvolvimento nem torna válida uma página que não existe no catálogo.
 */
export function getDepartmentPageAccessState(
  user: AuthUser | null,
  departmentId: BiAreaId,
  pageKey: string,
): DepartmentPageAccessState {
  const page = departmentPages[departmentId].find((item) => item.key === pageKey)

  if (!page) return 'hidden'
  if (!hasDepartmentPageAccess(user, departmentId, pageKey)) return 'hidden'

  return page.disabled ? 'disabled' : 'enabled'
}

/**
 * Departamentos que o usuário realmente abre, na ordem oficial de `biAreas`.
 *
 * Um departamento entra na lista quando ao menos UMA página dele não está
 * escondida — concedida pelo Perfil de Acesso e presente no catálogo local. A
 * página apenas em desenvolvimento conta: ela aparece bloqueada na barra lateral,
 * como já aparecia, e esconder o departamento por causa dela faria o
 * departamento concedido desaparecer sem explicação.
 *
 * É a mesma pergunta que monta os itens da barra lateral, feita ao mesmo
 * `getDepartmentPageAccessState`, e é por isso que a lista nunca oferece um
 * departamento cujas páginas o portal recusaria em seguida.
 *
 * A permissão de departamento (`bi.*`) NÃO é consultada aqui de propósito: ela é
 * derivada dos mesmos vínculos, e conferir as duas deixaria duas respostas para a
 * mesma pergunta. Quem guarda as rotas continua usando a permissão, que é o que
 * o `RequirePermission` sabe ler.
 */
export function getAccessibleBiAreas(user: AuthUser | null): BiArea[] {
  return biAreas.filter((area) =>
    departmentPages[area.id].some(
      (page) => getDepartmentPageAccessState(user, area.id, page.key) !== 'hidden',
    ),
  )
}

/**
 * Página em que o departamento ABRE para aquele usuário: a primeira concedida e
 * disponível, na ordem do catálogo. null quando não há nenhuma.
 *
 * Substitui a suposição de que todo departamento abre na Visão Geral. A Visão
 * Geral era imposta a todo departamento concedido só para garantir este destino,
 * e a imposição mostrava na barra lateral uma página que ninguém concedeu. Quem
 * recebe apenas `status` de dez submenus abre o departamento em Status.
 *
 * Exige `enabled`, e não apenas "não escondida": a página em desenvolvimento é
 * visível e bloqueada, então ela não serve de destino — mandar o usuário para lá
 * seria abrir o departamento em uma tela que ele não pode usar.
 *
 * Mesma decisão que `resolveAccessProfileHomePage` toma para a página inicial de
 * um Perfil de Acesso, aplicada aqui a um departamento e a um usuário.
 */
export function firstAccessibleDepartmentPageKey(
  user: AuthUser | null,
  departmentId: BiAreaId,
): string | null {
  const page = departmentPages[departmentId].find(
    (item) => getDepartmentPageAccessState(user, departmentId, item.key) === 'enabled',
  )

  return page?.key ?? null
}
