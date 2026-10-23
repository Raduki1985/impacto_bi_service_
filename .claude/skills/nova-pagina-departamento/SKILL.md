---
name: nova-pagina-departamento
description: Passo a passo para criar uma pagina nova dentro de um departamento do IMPACTO BI, ou um departamento inteiro novo. Use ao acrescentar item de sidebar, rota, Visao Geral, dashboard proprio, permissao de acesso ou pageConfig. Cobre a ordem correta dos catalogos, o que deriva sozinho, o que precisa ser registrado a mao e a migracao de acesso que a base ja persistida exige.
---

# Pagina nova de departamento

O portal tem onze departamentos com a mesma estrutura. Quase tudo deriva de
catalogos: rota, slug, item de sidebar e acesso padrao saem sozinhos de duas
listas. O erro comum e criar lista paralela, e o resultado e uma pagina que
aparece na sidebar mas nao abre, ou abre para quem nao deveria.

Antes de escrever conteudo visual, use os skills `modelo-de-pagina` (o
esqueleto da pagina e os componentes compartilhados) e `graficos-impacto`
(grafico, card e paleta).

# Principio

Catalogo unico. `biAreas` e `departmentPages` sao a fonte da verdade dos
departamentos e das paginas. `departmentPages` nao declara nada: ele DERIVA dos
`pageConfig` de cada departamento. Quem monta caminho, sidebar e acesso le
desses catalogos, entao um segundo mapa de rotas ou de nomes e sempre erro.

Ter rota nunca e ter acesso. A rota resolve o endereco;
`getDepartmentPageAccessState` decide se abre.

# Cenario A: pagina nova em departamento que ja existe

E o caso comum. Comece pelo unico arquivo obrigatorio.

## A1. Acrescentar o item no `pageConfig` do departamento

Em `src/Pages/<Departamento>/pageConfig.ts`, dentro de
`<departamento>NavigationItems`:

```ts
{ key: 'contracts-loyalty', label: 'Contratos e Fidelidade', icon: FileSignature, disabled: false }
```

- Acrescente a `key` tambem na union `<Departamento>PageKey`.
- **A `key` vira o segmento da URL.** Nao ha tabela de slugs para os
  departamentos: `departmentPageSlug` devolve a propria chave, com duas
  excecoes que ja existem, a Visao Geral que mantem `visao-geral` e Ordens de
  Servico que tem a tabela `pageSlugs` propria. Entao a chave precisa ser
  kebab-case, minuscula, sem acento e sem espaco.
- `label` e o nome exibido na sidebar e no cabecalho. Portugues, sem travessao.
- `icon` vem do `lucide-react`. Confirme que o nome existe no pacote antes de
  importar, e escolha um icone que nao colida com o de outro item do mesmo
  departamento.
- `disabled: true` enquanto o dashboard nao existe. O item aparece visivel e
  bloqueado, que e o estado `disabled` do modelo de acesso. Nao e erro e nao e
  ausencia: a pagina existe e ainda nao esta pronta.

## A2. O que deriva sozinho, e voce nao deve tocar

- `src/config/departmentPages.ts` monta o registro a partir dos `pageConfig`.
- `src/lib/departmentPageRoutes.ts` monta caminho, slug e chave a partir do
  caminho.
- A rota generica `/dashboard/:departmentSlug/:pageSlug` no `App.tsx` ja atende
  a pagina nova. Ela fica atras de todas as rotas literais na ordenacao do React
  Router, entao nada existente muda de endereco.
- `getAccessibleDepartmentSidebarItems` filtra a sidebar pelo acesso.
- `userAccessRules` deriva o acesso padrao do Analista do proprio catalogo. A
  unica pagina fora do acesso padrao e o Modelo Dimensional
  (`MODEL_PAGE_KEY`), que so entra quando o Administrador libera.
- Sem componente proprio registrado, a rota renderiza `UpcomingDashboard`, o
  painel unico de "sera exibido aqui em uma etapa futura". Nao crie um
  placeholder proprio por pagina.

## A3. Migracao para quem ja tem acesso gravado

Este e o passo que se esquece. O acesso padrao derivado vale para usuario novo.
Quem ja esta persistido no armazenamento tem a lista de `pageKeys` gravada e NAO
recebe a pagina nova sozinho.

O precedente esta em `src/lib/userAccessRules.ts`, na constante
`INTELLIGENCE_PAGE_KEY` e na funcao de migracao que insere a chave na posicao
correta da ordem do catalogo para cada Analista ja gravado. Se a pagina nova
deve chegar aos Analistas existentes, siga esse mesmo padrao, com teste.

Se a pagina nasce restrita, nao migre: ela simplesmente nao entra no acesso de
ninguem ate o Administrador conceder.

## A4. Dashboard real da pagina

Enquanto e `UpcomingDashboard`, nada mais e preciso. Para a pagina ganhar
conteudo proprio:

1. Crie `src/Pages/<Departamento>/<Pagina>/` com o componente, um `index.ts`
   que reexporta, e um `<pagina>PageMeta.ts` com a chave da pagina e a data da
   base, no padrao de `salesPeriodPageMeta.ts` e `goalsPageMeta.ts`.
   A data existe porque cada base tem a sua; sem ela o cabecalho mantem a
   padrao. O componente segue o esqueleto do skill `modelo-de-pagina`, com os
   componentes compartilhados de `src/components`, e nao uma copia da Visao
   Geral de OS.
2. No `App.tsx`, declare o `lazy(() => import(...))` junto dos demais.
3. Registre em `departmentSpecializedPages`, indexado pelo par departamento e
   chave da pagina, com `Component` e `updatedAt`.
4. Troque `disabled` para `false` no `pageConfig`.

Entrar nesse registro nao concede acesso nenhum. A rota, a permissao do
departamento e `getDepartmentPageAccessState` continuam decidindo antes.

# Cenario B: departamento novo

Mais raro e mais invasivo. A ordem importa, porque os catalogos se importam
entre si.

1. `src/Pages/<Departamento>/pageConfig.ts`: constante de permissao
   (`bi.<slug>.access`), caminho da Visao Geral, titulo e subtitulo, union de
   chaves de pagina, constante da chave da Visao Geral e o array de itens de
   navegacao.
2. `src/Pages/<Departamento>/Overview/`: componente da Visao Geral mais
   `index.ts`. Enquanto nao ha dashboard, replique o painel simples que as dez
   Visoes Gerais ja usam, com o texto de etapa futura.
3. `src/config/biAreas.ts`: acrescente o id na union `BiAreaId` e a entrada em
   `biAreas`, com `label`, `overviewPath`, `requiredPermission` e `matchesPath`.
   Mantenha a ordem alfabetica ja usada no array.
4. `src/config/departmentPages.ts`: importe os itens do novo `pageConfig` e
   acrescente a chave. O `satisfies Record<BiAreaId, ...>` acusa se faltar.
5. `App.tsx`: `lazy` da Visao Geral, entrada em `departmentNavigationItems`,
   entrada em `departmentOverviews`, icone em `biAreaIcons` e a rota fixa da
   Visao Geral, envolvida em `RequirePermission` com `redirectTo` para a Visao
   Geral Executiva, no mesmo formato das outras dez.
6. Perfis de acesso: a colecao inicial deriva de `biAreas` e `departmentPages`,
   entao o departamento novo entra sozinho. Confira os testes de
   `initialAccessProfiles` e de `accessProfileRules`, que contam departamentos.
7. Rode a suite inteira. Varios testes afirmam a lista de departamentos e a
   ordem dos ids `acp-NNN`, e vao acusar o que voce esqueceu.

Ordens de Servico nao segue este modelo: ela tem rotas, componentes e tabela de
slugs proprios, e passa pelo `DashboardRoute`, nao pelo `DepartmentPageRoute`.
Nao tente unificar as duas.

# Anatomia de uma pasta de pagina

```
src/Pages/<Departamento>/
  pageConfig.ts              permissao, caminho, titulos, chaves, itens da sidebar
  Overview/
    Overview.tsx             componente da Visao Geral: provedor, estado, faixa, conteudo
    OverviewFilterPanel.tsx  a faixa de filtros da pagina sobre FilterPanel
    overviewModel.ts         indicadores e leituras, com o .test.ts ao lado
    overview*ChartOptions.ts geradores especificos da pagina, um .test.ts ao lado
    OverviewListDialog.tsx   a janela de lista, se um painel abre lista no clique
    overviewListModel.ts     o que cada clique abre; overviewListExport.ts, a planilha
    Overview.render.test.tsx teste de renderizacao
    index.ts                 reexporta
  <Pagina>/
    <Pagina>.tsx
    index.ts
    <pagina>PageMeta.ts      chave da pagina e data da base
```

E a anatomia da Visao Geral de OS (`src/Pages/Overview`), a pagina modelo.
Modelo analitico separado do componente, como `overviewModel.ts` na OS e
`overviewGaugeModel.ts` no Comercial. O componente monta a tela, o modelo
calcula e e ele que recebe teste.

# Regras que valem em qualquer cenario

- Nenhuma lista paralela de paginas, nomes, icones ou rotas. Se voce precisou
  declarar a mesma pagina em dois lugares, um dos dois esta errado.
- Acesso nunca vem da rota. `RequirePermission` protege o departamento e
  `getDepartmentPageAccessState` decide a pagina, pelo par departamento e chave.
  A mesma chave existe em varios departamentos, e conceder uma nao libera as
  outras.
- Sem acesso, o portal tenta a Visao Geral do proprio departamento e, se ela
  tambem nao estiver concedida, volta para a Visao Geral Executiva. Mantenha
  esse encadeamento.
- A Visao Geral e obrigatoria em todo departamento concedido: e a porta de
  entrada da area. Para tirar a Visao Geral, tira-se o departamento inteiro.
- Conteudo visual segue o skill `graficos-impacto`. Nao invente card, painel ou
  paleta por departamento.
- Texto em portugues, sem travessao, sentence case.

# Antes de encerrar

```
npm run lint
npm run test
npm run build
```

Depois, rode o agent `revisor-convencoes`, e o `revisor-graficos` se a pagina
ganhou grafico ou card.
