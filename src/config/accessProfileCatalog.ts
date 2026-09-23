/**
 * Nomes aprovados dos Perfis de Acesso que valem para o portal inteiro.
 *
 * Existe para que as telas e as regras que falam de Perfil de Acesso não
 * precisem conhecer umas às outras para concordar sobre o nome oficial de um
 * perfil.
 *
 * Os perfis em si vivem no `impacto-bi-service`, na tabela `access`; a semente
 * local que criava uma coleção inicial a partir destes nomes foi removida. O
 * que sobra aqui é o vocabulário de apresentação e das regras do domínio.
 *
 * O padrão de nome aprovado para os Perfis de Acesso é este:
 *
 * - perfil exclusivo de um departamento usa somente o rótulo oficial do
 *   departamento (`COP`, `Comercial`, `Auditoria Técnica`), sem prefixo;
 * - perfil multidepartamental recebe nome próprio;
 * - `Acesso do Sistema` e `Acesso Executivo` mantêm os nomes já aprovados.
 *
 * Módulo de dados: não importa nada, então não arrasta nenhum outro módulo
 * para quem o utiliza.
 */

/**
 * Nome aprovado do perfil do Administrador. Substituiu `Acesso Total`, que não
 * deve mais aparecer como texto de interface nem como regra ativa.
 *
 * O identificador da constante segue `FULL_ACCESS_PROFILE_NAME` porque é o nome
 * já importado pelas regras e pelos testes, e renomeá-lo seria uma refatoração
 * sem efeito para quem usa o portal.
 */
export const FULL_ACCESS_PROFILE_NAME = 'Acesso do Sistema'

/** Nome aprovado do perfil padrão do Executivo. */
export const EXECUTIVE_ACCESS_PROFILE_NAME = 'Acesso Executivo'
