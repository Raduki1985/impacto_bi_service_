/**
 * Contratos do `impacto-bi-service`, copiados dos schemas Pydantic do serviço.
 *
 * Este arquivo descreve o que o SERVIÇO fala, e não o que o portal pensa. Os
 * tipos de domínio do portal continuam em `types/access.ts` e não são tocados
 * aqui: os dois modelos são diferentes de propósito, e é a camada de serviço que
 * traduz um no outro.
 *
 * Por isso os nomes dos campos ficam em `snake_case`, exatamente como chegam no
 * JSON. Renomear para `camelCase` neste arquivo esconderia a diferença e faria a
 * tradução acontecer em dois lugares.
 *
 * Origem de cada bloco, para conferência:
 *
 * - `app/schemas/pagination.py`  → `CorePage`, `CorePaginationMeta`
 * - `app/core/exception_handlers.py` → `CoreErrorEnvelope`
 * - `app/schemas/auth.py`        → `CoreTokenResponse`
 * - `app/schemas/user.py`        → `CoreUser`, `CoreUserCreate`, `CoreUserUpdate`
 * - `app/schemas/profile_type.py` → `CoreProfileType`
 * - `app/schemas/profile_menu.py` → `CoreProfileMenu`, `CoreProfileMenuTree`
 * - `app/schemas/access.py`      → `CoreAccess`, `CoreAccessCreate`, `CoreAccessUpdate`
 */

/* -------------------------------------------------------------------------- */
/* Envelopes                                                                  */
/* -------------------------------------------------------------------------- */

/** Metadados de paginação do serviço. */
export type CorePaginationMeta = {
  total: number
  size: number
  /** Página atual. O serviço chama de `current`, e não de `page`. */
  current: number
  pages: number
  previous: boolean
  next: boolean
}

/**
 * Envelope padrão de toda listagem paginada do serviço.
 *
 * A chave dos itens é `list`, e não `items`, `data` ou `results`. É um detalhe
 * fácil de errar e que só aparece em tempo de execução, então ele está declarado
 * aqui uma vez e nunca mais é digitado à mão.
 */
export type CorePage<T> = {
  pagination: CorePaginationMeta
  list: T[]
}

/** Corpo de erro do serviço, igual em todos os códigos de falha. */
export type CoreErrorEnvelope = {
  error: {
    code: string
    message: string
    request_id: string
  }
}

/* -------------------------------------------------------------------------- */
/* Autenticação                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Resposta de `POST /auth/login`.
 *
 * A rota recebe FORMULÁRIO (`application/x-www-form-urlencoded`), e não JSON,
 * com os campos `username` e `password`: é o `OAuth2PasswordRequestForm` do
 * FastAPI. O e-mail vai em `username`.
 */
export type CoreTokenResponse = {
  access_token: string | null
  token_type: string
}

/** Resposta de `POST /auth/logout`. */
export type CoreLogoutResponse = {
  message: string
}

/* -------------------------------------------------------------------------- */
/* Usuários                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Situação do usuário no serviço, de `UserStatus`.
 *
 * Quatro valores, e o portal usa três: `blocked` não existe no domínio local e é
 * lido como `Inativo`. O serviço só autentica `active`.
 *
 * `pending` é o estado de entrada, e é quem nunca definiu senha. Ele vira
 * `active` sozinho no serviço quando a senha passa a existir, pelo link do
 * e-mail ou pelo cadastro feito por um Administrador. Nenhuma outra troca de
 * situação é automática.
 */
export type CoreUserStatus = 'pending' | 'inactive' | 'active' | 'blocked'

/** Tipo de perfil resumido, como vem dentro do usuário. */
export type CoreProfileTypeRef = {
  id: string
  code: string
  name: string
}

/** Perfil de acesso resumido, como vem dentro do usuário. Sem os menus. */
export type CoreAccessRef = {
  id: string
  name: string
}

/**
 * Resposta de `GET /users`, `GET /users/me`, `POST /users` e `PUT /users/{id}`.
 *
 * O usuário NÃO traz os menus do perfil de acesso: `access` é só id e nome. Quem
 * precisa dos departamentos e páginas concedidos busca `GET /access/{id}`.
 */
export type CoreUser = {
  id: string
  name: string
  email: string
  status: CoreUserStatus
  /** `status === 'active'` e não excluído. Calculado pelo serviço. */
  is_active: boolean
  last_access: string | null
  profile_system_id: string
  access_profile_id: string | null
  profile_type: CoreProfileTypeRef | null
  access: CoreAccessRef | null
  /**
   * Até quando vale o link de primeiro acesso enviado por e-mail, em ISO.
   *
   * É uma DATA, nunca o token: o valor do link só existe no e-mail, e o serviço
   * guarda apenas o hash dele em `users.set_password`. Serve para o portal saber
   * se ainda há convite em uso antes de oferecer um reenvio.
   *
   * `null` significa que não há convite pendente. Definir a senha limpa a coluna
   * no serviço, então quem já entrou no portal chega sempre com nulo.
   *
   * NÃO serve mais para saber se a pessoa tem senha: quem responde isso é
   * `status === 'pending'`. Esta data responde outra pergunta, e só ela: até
   * quando o link ATUAL vale, para o portal não oferecer um reenvio que derrubaria
   * um e-mail que alguém pode estar abrindo naquele instante.
   */
  set_password_expire: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Corpo de `POST /users`.
 *
 * `status` é opcional no serviço, e omitido ele sai da senha: sem `password` o
 * usuário nasce `pending`, com `password` nasce `active`. O portal manda
 * `pending` explícito, porque é o único cadastro que ele faz.
 *
 * As duas combinações contraditórias respondem `422`: `pending` com senha, e
 * qualquer outra situação sem senha.
 */
export type CoreUserCreate = {
  name: string
  email: string
  profile_system_id: string
  access_profile_id?: string | null
  status?: CoreUserStatus
  password?: string | null
}

/**
 * Corpo de `PUT /users/{id}`. Todo campo é opcional: o que não for enviado não
 * é alterado. `access_profile_id: null` enviado explicitamente retira o perfil.
 *
 * Duas recusas de situação vivem aqui: `status: 'pending'` nunca é aceito (não se
 * devolve um usuário a pendente, isso exigiria apagar a senha), e mudar a situação
 * de quem ESTÁ `pending` só passa se `password` vier na mesma chamada. É por
 * isso que o cadastro da senha pelo Administrador manda os dois campos juntos.
 */
export type CoreUserUpdate = {
  name?: string
  email?: string
  profile_system_id?: string
  access_profile_id?: string | null
  status?: CoreUserStatus
  password?: string | null
}

/**
 * Corpo de `POST /users/{id}/password`, a troca de senha de uma conta que JÁ
 * tem senha.
 *
 * `current_password` é a senha de QUEM ESTÁ AUTENTICADO, e nunca a da conta
 * trocada: na própria conta as duas coincidem, e quando um Administrador troca
 * a senha de outra pessoa é a dele que vai aqui. Serve de confirmação de
 * identidade, para que uma sessão aberta e esquecida não vire poder de trocar
 * senhas. O serviço recusa com `400` quando ela não confere.
 *
 * É o que separa esta rota do campo `password` de `CoreUserUpdate`, que grava a
 * PRIMEIRA senha de quem ainda não tem nenhuma e não pede confirmação alguma.
 *
 * `new_password` passa pela mesma regra de composição dos links por e-mail, e
 * volta `422` quando não atende.
 */
export type CoreUserPasswordChange = {
  current_password: string
  new_password: string
}

/* -------------------------------------------------------------------------- */
/* Tipos de perfil (Perfil do Sistema)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Códigos fixos dos três tipos de perfil do serviço, de `ProfileTypeCode`.
 *
 * São três registros criados por seed e sem CRUD no portal. O código é a chave
 * estável; o `id` é um UUID que muda de ambiente para ambiente e por isso nunca
 * pode ser escrito no código do portal.
 */
export type CoreProfileTypeCode = 'adm' | 'analyst' | 'executive'

export type CoreProfileType = {
  id: string
  code: string
  name: string
  created_at: string
  updated_at: string
}

/* -------------------------------------------------------------------------- */
/* Menus                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Item de menu do serviço, que é a unidade concedida por um perfil de acesso.
 *
 * `id` é o UUID usado em `menu_ids`. `menu_id` é a chave textual do menu, e é
 * por ela que o portal reconhece um departamento ou uma página do catálogo
 * local: o UUID muda de ambiente para ambiente, a chave não.
 *
 * `profile_menu_id` é o pai. Nulo significa raiz.
 */
export type CoreProfileMenu = {
  id: string
  name: string
  position: number
  menu_id: string
  icon: string | null
  profile_menu_id: string | null
  created_at: string
  updated_at: string
}

/** Resposta de `GET /profile-menus/tree`: as raízes, cada uma com os filhos. */
export type CoreProfileMenuTree = CoreProfileMenu & {
  children: CoreProfileMenuTree[]
}

/**
 * Corpo de `POST /profile-menus`.
 *
 * `profile_menu_id` decide a natureza do item: ausente ou nulo cria um menu
 * RAIZ (o pai), preenchido cria um FILHO daquele pai. É o único campo que
 * separa os dois, e é por isso que ele não tem um segundo indicador ao lado.
 *
 * `menu_id` é a chave textual, e o serviço recusa com 409 uma que já exista.
 */
export type CoreProfileMenuCreate = {
  name: string
  position: number
  menu_id: string
  icon?: string | null
  profile_menu_id?: string | null
}

/**
 * Corpo de `PUT /profile-menus/{id}`.
 *
 * Todo campo é opcional: o que não for enviado não é alterado. `profile_menu_id`
 * enviado explicitamente como `null` PROMOVE o item a raiz — o serviço usa
 * `model_fields_set` para distinguir "não mandei" de "mandei nulo".
 *
 * ATENÇÃO: `icon: null` NÃO limpa o ícone no serviço; ele trata nulo como
 * "não alterar" (`if icon is not None`). Para esvaziar o ícone, o portal manda
 * string vazia.
 */
export type CoreProfileMenuUpdate = {
  name?: string
  position?: number
  menu_id?: string
  icon?: string | null
  profile_menu_id?: string | null
}

/* -------------------------------------------------------------------------- */
/* Perfis de acesso                                                           */
/* -------------------------------------------------------------------------- */

/** Resposta de `GET/POST/PUT /access`. */
/**
 * Resposta de `GET /access`, `POST /access` e `PUT /access/{id}`.
 *
 * `access_profile_system_id` e `profile_type` estiveram aqui e saíram: a coluna
 * foi removida de `access` no serviço. Um perfil de acesso é NOME e MENUS.
 */
export type CoreAccess = {
  id: string
  name: string
  description: string | null
  menus: CoreProfileMenu[]
  users_count: number
  created_at: string
  updated_at: string
}

/** Corpo de `POST /access`. Só o nome é obrigatório. */
export type CoreAccessCreate = {
  name: string
  description?: string | null
  menu_ids: string[]
}

/**
 * Corpo de `PUT /access/{id}`.
 *
 * Todo campo é opcional no serviço: o que não for enviado não é alterado.
 * `menu_ids` ausente preserva os menus atuais; `menu_ids: []` retira todos.
 */
export type CoreAccessUpdate = {
  name?: string
  description?: string | null
  access_profile_system_id?: string
  menu_ids?: string[]
}
