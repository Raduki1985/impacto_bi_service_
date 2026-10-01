export const ADMIN_FULL_PERMISSION = 'adm'
export const ADMIN_USERS_READ_PERMISSION = 'admin.users.read'
export const ADMIN_USERS_WRITE_PERMISSION = 'admin.users.write'
export const ADMIN_PERMISSIONS_MANAGE_PERMISSION = 'admin.permissions.manage'
export const ORDERS_SERVICE_ACCESS_PERMISSION = 'bi.ordens-servico.access'

/**
 * Prefixo das permissões ADMINISTRATIVAS: as que descrevem o que a pessoa pode
 * FAZER no portal (gerir usuários, perfis de acesso, menus).
 *
 * As permissões de departamento (`bi.*`) são de outra natureza: descrevem o que
 * a pessoa pode VISUALIZAR, e vêm do Perfil de Acesso cadastrado no
 * `impacto-bi-service`.
 */
const ADMIN_PERMISSION_PREFIX = 'admin.'

/**
 * true quando a permissão é administrativa, e por isso está coberta por
 * `admin.full`.
 *
 * Existe porque `admin.full` NÃO é mais um bypass global. Ele concede as
 * permissões administrativas em bloco — é isso que faz do Administrador um
 * Administrador — mas não concede departamento nenhum: o que o Administrador
 * enxerga no BI é exatamente o que o Perfil de Acesso dele libera, igual a
 * qualquer outro perfil.
 *
 * Era um bypass global, e o efeito disso era um Administrador cujo Perfil de
 * Acesso liberava só Ordens de Serviço enxergando os onze departamentos na barra
 * lateral, porque `hasPermission` respondia true para qualquer chave. Os dois
 * eixos (o que a pessoa FAZ e o que ela VÊ) são independentes por definição no
 * domínio, e agora também são independentes na verificação.
 */
export function isAdministrativePermission(permissionKey: string): boolean {
  return permissionKey.startsWith(ADMIN_PERMISSION_PREFIX)
}
