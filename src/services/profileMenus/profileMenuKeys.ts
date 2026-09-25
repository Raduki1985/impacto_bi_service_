/**
 * A convenção da chave `menu_id`, em um lugar só.
 *
 * `menu_id` é a coluna textual que liga um menu do `impacto-bi-service` ao
 * catálogo do portal. O UUID não serve para isso: ele é gerado pelo banco e
 * muda de ambiente para ambiente, então escrevê-lo no código quebraria em
 * produção.
 *
 * - menu RAIZ: a chave é o id do departamento do portal — `os`, `comercial`,
 *   `auditoria-tecnica`;
 * - menu FILHO: a chave é o id do departamento, um PONTO, e a chave da página
 *   naquele departamento — `comercial.overview`, `os.model`.
 *
 * ## Por que o filho é qualificado
 *
 * Porque `menu_id` é único na tabela `profile_menu` INTEIRA, e não dentro de um
 * mesmo pai: o serviço recusa com 409 uma segunda linha com a mesma chave. Quase
 * todo departamento do portal tem uma página `overview`, então a chave crua
 * `overview` só poderia existir para UM departamento — o primeiro a ser
 * cadastrado — e todos os outros ficariam sem como nomear a própria visão geral.
 * O prefixo é o que torna a chave da página única no serviço sem inventar nomes
 * diferentes para a mesma página em cada departamento.
 *
 * ## A forma crua ainda é aceita na leitura
 *
 * `pageKeyFromChildMenuId` aceita o filho sem prefixo e o trata como a página de
 * mesmo nome. É compatibilidade com os menus cadastrados antes de a convenção se
 * firmar, e não uma segunda forma válida: o que o portal PRODUZ é sempre a
 * qualificada. Como a chave é única no serviço, no máximo um departamento pode
 * ter um filho cru, então aceitar os dois não cria ambiguidade.
 */

/** O ponto que separa o departamento da página dentro de `menu_id`. */
export const MENU_KEY_SEPARATOR = '.'

/** `menu_id` que o portal grava para a página de um departamento. */
export function childMenuId(departmentId: string, pageKey: string): string {
  return `${departmentId}${MENU_KEY_SEPARATOR}${pageKey}`
}

/**
 * Chave da página a partir do `menu_id` do filho, sabendo o departamento do pai.
 *
 * O departamento vem do menu RAIZ, e não é extraído do texto da chave: ids de
 * departamento contêm hífen (`auditoria-tecnica`) e chaves de página também
 * (`technical-compliance`), então cortar no primeiro separador acertaria por
 * acaso. Com o pai em mãos, a leitura é exata.
 */
export function pageKeyFromChildMenuId(departmentId: string, menuId: string): string {
  const prefixo = `${departmentId}${MENU_KEY_SEPARATOR}`

  return menuId.startsWith(prefixo) ? menuId.slice(prefixo.length) : menuId
}
