import {UserStatus} from "../types/user/userTypes";

/**
 * Fonte de verdade das cores da situação do usuário, compartilhada pelo badge da
 * tabela de Usuários e pelo chip da lista de usuários dos Perfis de acesso.
 *
 * Existe pelo mesmo motivo de `profileColorClasses`: as duas telas já diziam
 * usar "as mesmas cores da tabela de Usuários" e cada uma escrevia os literais
 * por conta própria. Quando `Pendente` entrou, só uma delas ganhou a cor nova, e
 * a outra passou a pintar de cinza um estado que não é cinza. Com um mapa só,
 * uma situação nova aparece nas duas telas de uma vez, ou em nenhuma.
 *
 * A leitura das cores:
 *
 * - verde é quem ENTRA no portal;
 * - âmbar é o cadastro que falta terminar, e não uma falha: é o mesmo âmbar do
 *   indicador "Sem perfil definido" da aba Perfis de acesso;
 * - cinza é quem está fora por decisão de um Administrador.
 *
 * Cada entrada é uma classe de `src/styles.css`, com o par de cada tema, como
 * em `profileColorClasses`.
 */
export const userStatusColorClasses: Record<UserStatus, string> = {
    active: 'impacto-user-status-active',
    pending: 'impacto-user-status-pending',
    inactive: 'impacto-user-status-inactive',
    /*blocked: 'impacto-user-status-inactive',*/
}
