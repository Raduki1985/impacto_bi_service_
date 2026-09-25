# Guia: conectar o portal à API

Passo a passo para trocar os dados mockados do `impacto-bi-web` (front-end) pelas rotas
reais do `impacto-bi-service` (back-end).

Este documento é autocontido: assume que quem lê — pessoa ou IA — não participou de
nenhuma conversa anterior e não conhece nenhum dos dois projetos. Tudo o que é afirmado
aqui foi conferido no código em 22/09/2026.

---

## 0. Os dois projetos

| | Front-end | Back-end |
|---|---|---|
| Nome | `impacto-bi-web` | `impacto-bi-service` |
| Caminho | `C:\Users\sasak\Projetos\impacto-bi-web` | `C:\Users\sasak\Projetos\impacto-bi-service` |
| Stack | React 19 + TypeScript + Vite + React Router 7 + Tailwind 4 + Radix + ECharts | FastAPI + SQLAlchemy 2 + Pydantic 2 + Alembic |
| Testes | Vitest (`npm test`) | pytest (`make test`) |
| Porta padrão | 8080 | 8787 |
| Banco | nenhum (tudo em `sessionStorage`/`localStorage`) | PostgreSQL `impacto-bi-dev` |

O produto é um portal de BI. Usuários entram, e o que cada um enxerga depende de dois
conceitos distintos: o **Perfil do Sistema** (Administrador, Executivo, Analista) e o
**Perfil de Acesso** (quais departamentos e páginas ele vê).

Não existe biblioteca de HTTP no front (sem axios, sem react-query, sem Redux/Zustand).
O padrão da casa é `fetch` + Context do React. Mantenha assim.

---

## 1. De onde se está partindo

### Back-end: pronto

O banco `impacto-bi-dev` tem 7 tabelas, e os models/schemas/CRUD/controllers existem para
todas as que importam aqui:

| Tabela | Papel |
|---|---|
| `profile_types` | Perfil do Sistema. **Exatamente 3 linhas fixas**: `adm`, `analyst`, `executive` |
| `access` | Perfil de Acesso. Pertence a um `profile_type` |
| `profile_menu` | Árvore de menus do portal (auto-relacionada por `profile_menu_id`) |
| `access_profile_menu` | Liga Perfil de Acesso ↔ menu (N:N, PK composta) |
| `users` | Usuários, com soft delete e auditoria de autoria |
| `sessions` | Uma linha por token emitido. O `jti` do JWT é o `id` dela |
| `access_logs` | Auditoria de login, logout e troca de senha |

Não existe `notifications` no banco. A migration existe (`e2f4a7c1b903`) mas **não foi
aplicada de propósito**. Além das rotas `/notifications`, que obviamente falham, três
rotas de escrita gravam notificação como efeito colateral e quebram com
`500 relation "notifications" does not exist`:

| Rota | Situação |
|---|---|
| `POST /users/me/password` | **Quebra sempre** |
| `POST /auth/recover/reset` | **Quebra sempre** (é o fim do primeiro acesso e do reset de senha) |
| `POST /users` | Quebra **quando existe mais de um administrador ativo** |

O caso do `POST /users` é traiçoeiro: ele notifica os demais administradores, excluindo
quem disparou a ação. Com um único administrador na base não há ninguém a notificar,
nenhum `INSERT` acontece e a rota responde `201`. O segundo administrador faz a mesma
rota passar a responder `500`.

Nos três casos o registro principal **já foi gravado** antes da falha — o usuário é
criado, a senha é alterada — e só a notificação estoura. Ou seja: `500` aqui não
significa que nada aconteceu.

Enquanto isso não for resolvido, considere esses três fluxos indisponíveis. A correção é
uma linha (`alembic upgrade head`, no back-end), mas é **decisão de quem toca o back-end**,
não deste guia.

### Front-end: 100% mockado

Nada do portal fala com o back hoje, exceto as páginas de BI (Visão Geral de OS e
Comercial), que já usam `VITE_BI_API_URL` e consultam o ERP — **essas não são o assunto
deste guia e não devem ser alteradas.**

Arquivos que hoje sustentam o mock e que serão substituídos:

| Arquivo | O que faz hoje |
|---|---|
| `src/contexts/AuthContext.tsx` | Provedor de sessão |
| `src/contexts/AuthContextCore.ts` | Tipos `AuthContextValue`, `LoginResult`, `LoginFailureReason` |
| `src/contexts/useAuth.ts` | Hook de consumo |
| `src/services/auth/authSession.ts` | Login sem senha; grava só `user.id` no `sessionStorage` |
| `src/services/users/userRepository.ts` | CRUD de usuários em memória/armazenamento |
| `src/services/users/userStorage.ts` | Leitura/gravação da coleção de usuários |
| `src/services/accessProfiles/accessProfileRepository.ts` | CRUD de Perfis de Acesso |
| `src/services/accessProfiles/accessProfileStorage.ts` | Persistência dos perfis |
| `src/services/accessProfiles/initialAccessProfiles.ts` | Sementes do mock |
| `src/config/accessProfileCatalog.ts` | Catálogo estático de departamentos/páginas |

Arquivo que já existe e serve de **modelo de estilo** para o novo cliente HTTP:
`src/data/api/biApiClient.ts`.

> O `authSession.ts` diz de si mesmo, em comentário, que "ISTO NÃO É SEGURANÇA": ele não
> confere senha nenhuma. Substituí-lo é o ponto central deste trabalho.

---

## 2. Subir os dois lados

### Back-end

```bash
cd C:\Users\sasak\Projetos\impacto-bi-service
pip install -r requirements-dev.txt
make env                       # cria o .env a partir de env.local, com SECRET_KEY aleatória
```

Edite o `.env` gerado e aponte `DATABASE_URL` para o `impacto-bi-dev`. O `.env` é
ignorado pelo git; o `env.local` é versionado e **não pode receber segredo nenhum**.

O banco já está migrado até a revisão `b7c3d5e91af2`. **Não rode `alembic upgrade head`
nem `make migrate` contra ele** — isso criaria a `notifications`, que está fora do escopo.

Falta um administrador. Sem ele não há como autenticar, e não existe cadastro público:

```bash
SEED_ADMIN_EMAIL=voce@empresa.com SEED_ADMIN_PASSWORD=suasenha SEED_ADMIN_NAME="Seu Nome" python -m app.db.seed
```

O seed é idempotente. Ele confere os 3 tipos de perfil, cria um Perfil de Acesso
"Administração" no tipo `adm` e o usuário admin ligado a ele.

```bash
make run     # uvicorn em http://localhost:8787
```

Confira: `http://localhost:8787/api/core/health` e `http://localhost:8787/api/core/docs`
(Swagger com todas as rotas).

### Front-end

```bash
cd C:\Users\sasak\Projetos\impacto-bi-web
npm install
```

Crie um `.env.local` (ignorado pelo git):

```
VITE_CORE_API_URL=http://localhost:8787/api/core/v1
```

```bash
npm run dev
```

CORS já está liberado no back (`CORS_ALLOW_ORIGIN_REGEX=.*` no `env.local`), então o
navegador não vai bloquear. Em produção isso precisa ser restringido.

---

## 3. O contrato da API

### Endereço base

```
http://localhost:8787/api/core/v1
```

Use uma variável nova, `VITE_CORE_API_URL`. **Não reaproveite `VITE_BI_API_URL`**: ela
aponta para as rotas `/bi`, que leem o ERP e têm outro ciclo de vida.

### Autenticação

Login é OAuth2 password flow. O corpo é **`application/x-www-form-urlencoded`**, não JSON,
e o campo do e-mail chama-se `username`:

```
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=admin@empresa.com&password=suasenha
```

```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```

Todas as demais rotas exigem o cabeçalho:

```
Authorization: Bearer <access_token>
```

O JWT vale 24 h por padrão (`ACCESS_TOKEN_EXPIRE=1440`, em minutos). **Não existe refresh
token**: quando expira, a pessoa loga de novo.

O `jti` do token é o id de uma linha em `sessions`. `POST /auth/logout` revoga essa linha,
e a partir daí o mesmo token responde `401 Sessão encerrada ou expirada`. Ou seja: logout
invalida de verdade, no servidor — descartar o token no cliente não basta e não é o
comportamento esperado.

### Envelope de paginação

Toda listagem responde neste formato (`app/schemas/pagination.py`):

```json
{
  "pagination": { "total": 42, "size": 10, "current": 1, "pages": 5, "previous": false, "next": true },
  "list": [ { "...": "..." } ]
}
```

A chave dos itens é **`list`**, não `items`/`data`/`results`. O total fica dentro de
`pagination`, não na raiz.

Parâmetros comuns: `page` (≥1, padrão 1) e `size` (1–100, padrão 10).

A única listagem fora desse envelope é `GET /users/me/sessions`, que devolve um array puro.

### Envelope de erro

```json
{
  "error": {
    "code": "HTTP_ERROR",
    "message": "Sessão encerrada ou expirada",
    "request_id": "72af4287-2134-4708-9734-66a335fb0bb0"
  }
}
```

A mensagem vem em português e é adequada para exibir. O `request_id` serve para casar com
o log do servidor — vale registrar no console quando houver falha.

### Códigos que o front precisa tratar

| Código | Quando | O que fazer |
|---|---|---|
| `401` | Credenciais inválidas, token expirado ou sessão revogada | Limpar a sessão e mandar para o login |
| `403 Conta inativa` | `status != 'active'` ou soft delete | Mensagem específica, não "senha errada" |
| `403 Usuário sem perfil de acesso` | `access_profile_id` é `NULL` | Mensagem específica: só um Administrador resolve |
| `403 Permissão insuficiente` | Rota exige `adm` e o usuário não é | Esconder a ação na interface antes de chegar aqui |
| `404` | Id inexistente | — |
| `409` | E-mail duplicado, vínculo existente, tipo de perfil fixo | Mostrar a `message` da resposta |
| `422` | Validação do Pydantic | Mapear para os campos do formulário |

Os três `403` são motivos diferentes e precisam continuar diferentes até a tela — é
exatamente o que o `LoginFailureReason` do front já modela hoje.

---

## 4. Mapa de domínio: front ↔ back

Esta é a parte que mais engana. Os nomes não batem.

| Conceito no front | Tabela/rota no back | Observações |
|---|---|---|
| Perfil do Sistema (`user.profile`) | `profile_types` / `GET /profile-types` | 3 linhas fixas. `adm` = Administrador, `executive` = Executivo, `analyst` = Analista |
| Perfil de Acesso (`user.accessProfileId`) | `access` / `/access` | O campo `access_profile_system_id` é o "Destinado a" |
| `Acesso do Sistema` (id `acp-system`) | uma linha de `access` com `access_profile_system_id` = id do tipo `adm` | No back é um registro normal; a proteção dele é regra de interface |
| Departamentos e páginas (`departmentId + pageKey`) | `profile_menu` / `/profile-menus` | Árvore: departamento é nó pai, página é filho. `menu_id` é a chave estável da rota |
| Vínculo perfil ↔ páginas | `access_profile_menu` / `/access-profile-menus` | Também sai pronto em `AccessOut.menus` |
| Usuário | `users` / `/users` | — |
| `user.status` (`'Ativo'` \| `'Inativo'`) | `users.status` (`active` \| `inactive` \| `blocked`) | **São três valores no back, dois no front.** Decida o que fazer com `blocked` |
| Login mockado (só e-mail) | `POST /auth/login` (e-mail + senha) | O front hoje não tem campo de senha funcional |

### A regra que mais quebra integração

Um usuário tem `profile_system_id` **e** `access_profile_id`, e o banco exige por chave
estrangeira composta que o Perfil de Acesso pertença àquele Perfil do Sistema:

```
users(access_profile_id, profile_system_id) → access(id, access_profile_system_id)
```

Consequência prática: **nunca troque um sem o outro.** Mudar o Perfil do Sistema de um
usuário sem trocar o Perfil de Acesso junto devolve erro. Ao montar a tela, filtre a lista
de Perfis de Acesso por `profile_type_id` assim que o Perfil do Sistema for escolhido:

```
GET /access?profile_type_id=<id do tipo escolhido>
```

### Tipos de perfil são fixos

`adm`, `analyst` e `executive` são criados por seed e o back recusa (`409`) apagá-los ou
trocar o `code` deles — o código da aplicação referencia esses três valores. O portal deve
apenas **ler** `GET /profile-types`, para preencher o seletor. Não construa tela de CRUD
de tipo de perfil.

O que é cadastrável no front é o **Perfil de Acesso** (`/access`).

---

## 5. Rotas disponíveis

Tudo abaixo é prefixado por `/api/core/v1`. "Admin" significa que o usuário autenticado
precisa ser do tipo `adm`; "Autenticado" basta o token.

### Auth

| Método | Rota | Acesso | Observação |
|---|---|---|---|
| POST | `/auth/login` | pública | form-urlencoded: `username`, `password` |
| POST | `/auth/logout` | Autenticado | Revoga a sessão do token |
| POST | `/auth/recover` | pública | Dispara o e-mail de recuperação. Com `ENV=local` devolve `reset_url` na resposta |
| POST | `/auth/set-password` | pública | `{ token, password }`. Primeiro acesso: define a senha e **ativa** a conta |
| POST | `/auth/recover/reset` | pública | `{ token, password }`. Só redefinição de senha |

> **Primeiro acesso e redefinição são rotas separadas.** Cada uma só aceita o token do
> próprio e-mail e responde `401` para o token da outra. O portal decide qual chamar
> pela ROTA em que a pessoa caiu (`/set-password` ou `/reset-password`), nunca pelo
> conteúdo do token.

> **Senha recusada responde `422`** nas duas rotas: no mínimo 6 caracteres, com ao menos
> uma letra maiúscula, uma minúscula, um número e um caractere especial. O portal aplica
> a mesma regra antes de enviar, em `src/lib/passwordPolicy.ts`. O token **não** é
> consumido em um `422`, então dá para corrigir a senha e reenviar com o mesmo link.

> `/auth/recover/reset` grava uma notificação ao final e **falha** enquanto a tabela
> `notifications` não existir — veja a seção 1. A senha chega a ser alterada antes do erro.

### Conta própria

| Método | Rota | Acesso |
|---|---|---|
| GET | `/users/me` | Autenticado |
| PUT | `/users/me` | Autenticado |
| POST | `/users/me/password` | Autenticado |
| GET | `/users/me/sessions` | Autenticado (array puro) |
| DELETE | `/users/me/sessions` | Autenticado (encerra as outras) |
| DELETE | `/users/me/sessions/{id}` | Autenticado |
| POST | `/users/me/delete` | Autenticado |

### Usuários

| Método | Rota | Acesso |
|---|---|---|
| GET | `/users` | Admin |
| POST | `/users` | Admin |
| GET | `/users/{id}` | Admin |
| PUT | `/users/{id}` | Admin |
| POST | `/users/{id}/first-access` | Admin (reenvia o e-mail; gera um token novo e **derruba** o anterior) |
| DELETE | `/users/{id}` | Admin (soft delete) |

Filtros de `GET /users`: `page`, `size`, `search` (nome ou e-mail), `profile_system_id`,
`access_profile_id`, `status`.

### Tipos de perfil (somente leitura no portal)

| Método | Rota | Acesso |
|---|---|---|
| GET | `/profile-types` | Autenticado |
| GET | `/profile-types/{id}` | Autenticado |
| POST · PUT · DELETE | `/profile-types` | Admin — e bloqueado para os 3 fixos |

### Perfis de acesso

| Método | Rota | Acesso |
|---|---|---|
| GET | `/access` | Autenticado |
| POST | `/access` | Admin |
| GET | `/access/{id}` | Autenticado |
| PUT | `/access/{id}` | Admin |
| DELETE | `/access/{id}` | Admin |

Filtros de `GET /access`: `page`, `size`, `search`, `profile_type_id`.

### Menus

| Método | Rota | Acesso |
|---|---|---|
| GET | `/profile-menus` | Autenticado (lista plana, paginada) |
| GET | `/profile-menus/tree` | Autenticado (**árvore completa, sem paginação**) |
| POST · PUT · DELETE | `/profile-menus` | Admin |
| GET · POST · DELETE | `/access-profile-menus` | GET autenticado, escrita Admin |

---

## 6. Formatos de resposta

### `UserOut` — `/users`, `/users/me`

```json
{
  "id": "06bb5ba8-ead7-4767-88b1-dca346575ba7",
  "name": "Maria Silva",
  "email": "maria@empresa.com",
  "status": "active",
  "is_active": true,
  "last_access": "2026-09-22T12:00:00Z",
  "profile_system_id": "337bd35e-...",
  "access_profile_id": "88ce75c6-...",
  "profile_type": { "id": "337bd35e-...", "code": "adm", "name": "Administrador" },
  "access": { "id": "88ce75c6-...", "name": "Administração" },
  "created_at": "2026-09-01T10:00:00Z",
  "updated_at": "2026-09-20T09:30:00Z"
}
```

`profile_type` e `access` vêm aninhados e já resolvidos — não é preciso uma segunda
chamada para descobrir o nome do perfil.

`is_active` é **derivado** (`status == 'active'` e sem soft delete), não é uma coluna.
Para filtrar na API, use `status`.

Não existe senha na resposta, e nunca existirá.

### `AccessOut` — `/access`

```json
{
  "id": "88ce75c6-...",
  "name": "Operações Técnicas",
  "description": "Acesso às páginas técnicas.",
  "access_profile_system_id": "337bd35e-...",
  "profile_type": { "id": "...", "code": "analyst", "name": "Analista" },
  "menus": [ { "id": "...", "name": "Ordens de Serviço", "position": 1, "menu_id": "os", "icon": null, "profile_menu_id": null } ],
  "users_count": 7,
  "created_at": "...",
  "updated_at": "..."
}
```

`menus` já vem ordenado por `(position, name)`. `users_count` poupa uma contagem no front.

Em `POST`/`PUT /access` o vínculo com menus é enviado como `menu_ids: string[]` — a API
sincroniza `access_profile_menu` sozinha. Não é preciso chamar `/access-profile-menus`
para o caso comum.

### `ProfileMenuTreeOut` — `/profile-menus/tree`

Mesmos campos de um menu, mais `children: ProfileMenuTreeOut[]`. Use esta rota para montar
a navegação lateral: ela já devolve a árvore pronta, sem paginação e sem montagem manual.

---

## 7. Passo a passo

Cada bloco abaixo é independente e testável. Faça um de cada vez, rodando `npm test` e
`npm run lint` ao final de cada um. **Não comece o bloco seguinte com o anterior quebrado.**

### Bloco 1 — Cliente HTTP

Crie `src/data/api/coreApiClient.ts`, espelhando a estrutura de `biApiClient.ts`
(normalização da base, timeout com `AbortController`, erro traduzido numa classe própria).
O que muda em relação ao `biApiClient`:

- injeta `Authorization: Bearer <token>` quando existe token;
- aceita `method`, corpo JSON e corpo form-urlencoded;
- lê o envelope de erro `{ error: { message } }` e usa a `message` do servidor;
- num `401`, dispara a limpeza da sessão e o redirecionamento para o login, **em um lugar
  só** — se cada tela tratar o próprio 401, o comportamento vai divergir.

Esqueleto:

```ts
export class CoreApiError extends Error {
  readonly status: number | null
  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'CoreApiError'
    this.status = status
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  json?: unknown
  form?: Record<string, string>
  params?: Record<string, string | number | null | undefined>
  token?: string | null
}

export async function callCoreApi<T>(path: string, options: Options = {}): Promise<T> {
  // monta URL + query, aplica timeout, injeta o Bearer,
  // converte !response.ok em CoreApiError lendo body.error.message,
  // devolve null quando o status for 204.
}
```

Ponto de atenção: `DELETE` responde **204 sem corpo**. Chamar `response.json()` nesse caso
estoura. Trate o 204 antes de tentar converter.

### Bloco 2 — Guardar o token

O `authSession.ts` hoje grava apenas `user.id` no `sessionStorage`. Agora o que precisa
sobreviver ao F5 é o **token**.

Mantenha o `sessionStorage` e o comportamento já decidido pelo produto: fechar a aba
pede login de novo. Guarde só o token; o usuário vem sempre de `GET /users/me`.

Não coloque o token no `localStorage` sem uma decisão explícita de negócio — isso muda o
tempo de vida da sessão e contraria o que o módulo atual documenta.

### Bloco 3 — Login de verdade

1. `src/Pages/Login/Login.tsx` precisa de um campo de senha funcional.
2. `AuthContext.login` passa a ser `async (email, password) => Promise<LoginResult>`.
   Todos os chamadores viram `await`.
3. O fluxo: `POST /auth/login` → guarda o token → `GET /users/me` → converte a resposta
   para o tipo `User` do front → guarda no estado.
4. Mapeie os erros para os `LoginFailureReason` que já existem:

| Resposta do back | `LoginFailureReason` |
|---|---|
| `401 Credenciais inválidas` | `invalid-credentials` |
| `403 Conta inativa` | `invalid-credentials` (ou um motivo novo, se o produto quiser distinguir) |
| `403 Usuário sem perfil de acesso` | `access-profile-required` |
| Rede fora / timeout | `access-profile-unavailable` ou um motivo novo de indisponibilidade |

5. `logout` passa a chamar `POST /auth/logout` antes de limpar o armazenamento local. Se a
   chamada falhar, limpe assim mesmo — mas registre.

### Bloco 4 — Restaurar a sessão

`restoreAuthenticatedUser()` hoje relê o usuário do mock. Passa a ser: se há token
guardado, chama `GET /users/me`; qualquer erro apaga o token e devolve `null`.

Isso introduz algo que o mock não tinha: a restauração vira **assíncrona**. O provedor
precisa de um estado de carregamento, e a proteção de rotas não pode mandar para o login
enquanto ele estiver pendente — senão todo F5 numa rota interna joga a pessoa para fora.
Leia o comentário de `restoreAuthenticatedUser` antes de mexer: ele explica por que hoje a
decisão acontece antes da primeira renderização.

### Bloco 5 — Usuários

Substitua o corpo de `src/services/users/userRepository.ts` por chamadas à API, mantendo
a assinatura das funções sempre que possível (as telas já as consomem).

| Função atual | Rota |
|---|---|
| `listUsers()` | `GET /users` |
| `findUserById(id)` | `GET /users/{id}` |
| `createUser(...)` | `POST /users` |
| `updateUserBasicData` · `updateUserDetails` · `updateUserAccess` | `PUT /users/{id}` |
| `activateUser` / `deactivateUser` | `PUT /users/{id}` com `{ "status": "active" \| "inactive" }` |
| — | `DELETE /users/{id}` (soft delete; não existe equivalente no mock) |
| `resendFirstAccess(id)` | `POST /users/{id}/first-access` |
| `setUserPassword(id, senha)` | `PUT /users/{id}` com `{ password, status: "active" }` |

Duas diferenças que exigem decisão de produto, não improviso:

- **As funções viram assíncronas.** Toda tela que as chama precisa lidar com carregamento
  e erro. É o maior custo deste bloco.
- **A lista agora é paginada no servidor.** O mock devolvia tudo. Ou a tela ganha
  paginação real, ou passa `size=100` e assume o limite — e `size` não aceita mais que 100.

Sobre criar usuário: `password` é opcional. Sem senha, o usuário nasce `inactive` e o back
envia o e-mail de primeiro acesso — é o fluxo desenhado, e é preferível a inventar uma
senha na interface. Criar já `active` **exige** senha; sem ela o back devolve `422`.

Atenção ao efeito colateral descrito na seção 1: `POST /users` volta a falhar assim que
existir um segundo administrador ativo, e `POST /users/me/password` já falha hoje. Valide
esses dois fluxos contra o back antes de dar o bloco por concluído — o `201` que você vê
numa base com um único administrador não prova que a rota funciona.

### Bloco 6 — Perfis de acesso

| Função atual | Rota |
|---|---|
| `listAccessProfiles()` | `GET /access` |
| `findAccessProfileById(id)` | `GET /access/{id}` |
| `createAccessProfile(...)` | `POST /access` |
| `updateAccessProfile(...)` | `PUT /access/{id}` |
| — | `DELETE /access/{id}` |

`getSystemAccessProfile()` hoje devolve um perfil derivado do catálogo, com id fixo
`acp-system`. No back ele é uma linha normal de `access` cujo `access_profile_system_id`
aponta para o tipo `adm`. Resolva-o por consulta (`GET /access?profile_type_id=<adm>`), não
por id fixo — o UUID do banco não é `acp-system`.

As regras de interface do `Acesso do Sistema` (badge `Sistema`, não editável, não
excluível) continuam valendo e continuam sendo responsabilidade do front: o back não
protege essa linha.

O "Destinado a" do formulário é o `access_profile_system_id`. O back **permite** alterá-lo
no `PUT`; a regra de que o destino é imutável após a criação é do produto e vive no front.

### Bloco 7 — Menus e navegação

`src/config/accessProfileCatalog.ts` é um catálogo estático de departamentos e páginas.
A tabela `profile_menu` é a versão dele no banco, e hoje está **vazia** (0 linhas).

Antes de ligar a navegação à API, alguém precisa popular `profile_menu` com a árvore real
do portal, usando `menu_id` como a chave estável que casa com as rotas do React Router.
Enquanto isso não acontecer, mantenha o catálogo estático e **não** conecte este bloco.
Ligar uma navegação a uma tabela vazia apaga o menu inteiro do portal.

Quando for a hora: `GET /profile-menus/tree` devolve a árvore pronta, e os menus de um
perfil já vêm em `AccessOut.menus`.

### Bloco 8 — Remover o mock

Só depois de todos os blocos acima estarem funcionando: apague
`userStorage.ts`, `accessProfileStorage.ts`, `initialAccessProfiles.ts` e os testes que
existem apenas para exercitar o armazenamento local.

Não apague antes. Enquanto um bloco estiver pela metade, o mock é o que mantém o portal de
pé.

---

## 8. Armadilhas

1. **Chave estrangeira composta.** Trocar `profile_system_id` sem trocar `access_profile_id`
   junto devolve erro. Envie os dois no mesmo `PUT`.
2. **`is_active` não é coluna.** É derivado de `status`. Filtre por `status`.
3. **A chave dos itens é `list`.** Não `items`, `data` nem `results`.
4. **Login é form-urlencoded, e o campo é `username`.** Mandar JSON devolve `422`.
5. **`DELETE` responde `204` sem corpo.** `response.json()` estoura.
6. **Logout revoga no servidor.** Não basta apagar o token no cliente.
7. **`notifications` não existe no banco.** Derruba `POST /users/me/password` e
   `POST /auth/recover/reset` sempre, e `POST /users` a partir do segundo administrador
   ativo. Em todos, o registro principal já foi gravado antes do `500`.
8. **`profile_menu` está vazia.** Não conecte a navegação ainda.
9. **Não rode `alembic upgrade head` / `make migrate`** contra o `impacto-bi-dev`.
10. **Não reaproveite `VITE_BI_API_URL`.** É outra API, com outro ciclo de vida.
11. **Soft delete libera o e-mail.** O índice único é parcial
    (`UNIQUE (lower(email)) WHERE deleted_at IS NULL`): um e-mail excluído pode ser
    recadastrado, e um usuário excluído não volta em listagem nenhuma.
12. **Os testes do front não podem chamar a API.** O `vite.config.ts` já zera
    `VITE_BI_API_URL` nos testes; faça o mesmo com `VITE_CORE_API_URL`, ou a suíte passa a
    depender do `.env.local` da máquina de quem roda.

---

## 9. Como validar

```bash
# back-end
cd C:\Users\sasak\Projetos\impacto-bi-service
make test        # esperado: 514 passando

# front-end
cd C:\Users\sasak\Projetos\impacto-bi-web
npm run lint
npm test
npm run build
```

Observação sobre o back: `tests/test_bi_os.py` tem **5 falhas pré-existentes**, sem relação
com autenticação ou cadastro. Elas já falhavam antes deste trabalho. Não as trate como
regressão do que você fizer aqui.

Teste manual mínimo, na ordem, depois de cada bloco de autenticação:

1. login com senha certa → entra;
2. login com senha errada → mensagem de credencial inválida;
3. F5 numa rota interna → permanece na rota, sem piscar o login;
4. logout → volta ao login, e o botão "voltar" do navegador não devolve a sessão;
5. usuário sem Perfil de Acesso → mensagem específica de permissão, não de senha.

---

## 10. Regras da casa

O `AGENTS.md` da raiz deste repositório é a fonte de verdade sobre como trabalhar aqui, e
tem precedência sobre este guia em caso de conflito. Os pontos que mais afetam esta
integração:

- Alterações de rotas e proteções são blocos próprios, tratados isoladamente.
- Perfis do Sistema oficiais são Administrador, Executivo e Analista. `Gestor` e
  `Usuário Departamental` são nomes legados e só aparecem em leitura de compatibilidade.
- `Acesso do Sistema` é o nome oficial aprovado; `Acesso Total` não deve mais ser usado.
- Não afirme que autenticação mockada é segurança de produção; confirme no repositório
  antes de descrever o estado de qualquer recurso.
- Não invente nome de tabela, coluna ou indicador. Se faltar informação, consulte a
  documentação do back em `impacto-bi-service/docs/` — em especial `api.md`,
  `authentication.md`, `models.md` e `database.md` — ou o Swagger em
  `http://localhost:8787/api/core/docs`.
