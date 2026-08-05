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

/** Perfil automático do Administrador. */
export const FULL_ACCESS_PROFILE_NAME = 'Acesso Total'

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
 * - `Acesso Total` e `Acesso Executivo` mantêm os nomes já aprovados.
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
