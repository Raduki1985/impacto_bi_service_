import type { BiAreaId } from './biAreas'

/**
 * Regras aprovadas dos Perfis de Acesso que valem para o portal inteiro.
 *
 * Existe para que as telas que falam de Perfil de Acesso (hoje Usuários e
 * Perfis de acesso) não precisem conhecer uma à outra para concordar sobre o
 * nome oficial de um perfil ou sobre quais departamentos formam a combinação
 * técnica. Uma tela importar o modelo de apresentação da outra acoplaria duas
 * rotas independentes e faria a primeira carregar o modelo inteiro da segunda.
 *
 * Guarda somente o que é de fato compartilhado: nomes aprovados e a combinação
 * técnica, em ids do catálogo. Deliberadamente NÃO guarda identidades de
 * seletor, ids de linha, textos de descrição, montagem de opções, nem qualquer
 * decisão de apresentação: isso continua sendo assunto de cada página, porque é
 * cada página que decide como exibir.
 *
 * Módulo de dados: a única importação é de tipo, apagada na compilação, então
 * ele não arrasta nenhum outro módulo para quem o utiliza.
 */

/**
 * Perfil automático do Administrador, mantido e derivado pelo portal.
 *
 * Nome oficial aprovado: `Acesso do Sistema`. Ele substituiu `Acesso Total`, que
 * não deve mais aparecer como texto de interface nem como regra ativa. A troca
 * é só de nome: o perfil continua sendo o mesmo, com o mesmo id técnico
 * (`acp-system`), derivado dos catálogos a cada leitura e nunca persistido, de
 * modo que não existe dado gravado com o nome antigo para migrar.
 *
 * O identificador da constante segue `FULL_ACCESS_PROFILE_NAME` porque é o nome
 * já importado pelo armazenamento e pela tela Usuários, e renomeá-lo seria uma
 * refatoração sem efeito para quem usa o portal.
 */
export const FULL_ACCESS_PROFILE_NAME = 'Acesso do Sistema'

/** Perfil padrão do Executivo. */
export const EXECUTIVE_ACCESS_PROFILE_NAME = 'Acesso Executivo'

/**
 * Perfil da combinação técnica aprovada.
 *
 * Nome próprio, e não `Acesso` seguido de uma lista: o perfil reúne cinco
 * departamentos, e nenhum deles o nomeia sozinho.
 *
 * O padrão de nome aprovado para os Perfis de Acesso é este:
 *
 * - perfil exclusivo de um departamento usa somente o rótulo oficial do
 *   departamento (`COP`, `Comercial`, `Auditoria Técnica`), sem prefixo, e por
 *   isso não tem constante própria: o nome é o `label` de `biAreas`;
 * - perfil multidepartamental recebe nome próprio aprovado, declarado aqui;
 * - `Acesso do Sistema` e `Acesso Executivo` mantêm os nomes já aprovados.
 */
export const TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME = 'Operações Técnicas'

/**
 * Departamentos da combinação técnica aprovada, declarados pelos ids do
 * catálogo e não pelos rótulos exibidos: o rótulo é texto de apresentação e já
 * mudou antes, o id é a chave estável.
 */
export const TECHNICAL_OPERATIONS_DEPARTMENT_IDS: readonly BiAreaId[] = [
  'os',
  'suporte-tecnico',
  'cop',
  'auditoria-tecnica',
  'gestao-frota',
]
