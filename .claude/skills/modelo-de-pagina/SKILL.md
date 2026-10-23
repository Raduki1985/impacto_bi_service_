---
name: modelo-de-pagina
description: Esqueleto e comportamento de qualquer pagina de dashboard do IMPACTO BI, a partir da Visao Geral de OS, que e a pagina modelo desde 24/09/2026. Use SEMPRE antes de criar ou alterar uma Visao Geral, uma pagina de departamento, uma faixa de filtros, uma colecao de cards, um painel que abre lista no clique, uma janela de lista, uma planilha para baixar ou o tema escuro de uma pagina. Traz os componentes compartilhados reais de src/components, o que e da pagina e o que nao e, e as regras que cada um congela.
---

# Modelo de pagina do IMPACTO BI

A Visao Geral de OS (`src/Pages/Overview`) e a pagina modelo do portal, por
decisao do Mario em 24/09/2026. Toda pagina seguinte usa os MESMOS
componentes e comportamentos dela. O que ela tinha de reaproveitavel saiu
para `src/components`; o que ficou na pasta dela e o que so a OS sabe
(regras dos indicadores, paineis, textos).

Este skill e o mapa. O `graficos-impacto` continua sendo o criterio de
grafico, card e paleta; o `nova-pagina-departamento` continua sendo o
passo a passo de rota, sidebar e acesso. Em conflito, o que esta no codigo
vence.

## Regra zero

- Pagina nova NAO copia a Visao Geral de OS. Ela monta o esqueleto abaixo
  com os componentes compartilhados e escreve so o que e dela.
- Nada novo vira componente compartilhado sem passar pela pagina modelo
  primeiro, ou sem aprovacao explicita do Mario. Composicao candidata fica
  isolada na propria pagina.
- Nenhuma pagina precisa de classe de escopo para o tema escuro dos paineis
  executivos: cada componente carrega a propria superficie (ver "Tema escuro").

## O esqueleto, de cima para baixo

```
export function Pagina() {
  return (
    <ProvedorDaPagina>          // dados e filtros, exclusivo da pagina
      <PaginaBody />
    </ProvedorDaPagina>
  )
}

function PaginaBody() {
  useReportPageSourceStatus(...) // selo do cabecalho: carregando, indisponivel, atualizado em
  if (loading) return <PaginaSkeleton />   // esqueleto da propria pagina (PageSkeleton + pecas), desde 08/10/2026
  if (error)   return <PageStatePanel kind="error" title="Nao foi possivel ...">{mensagem}</PageStatePanel>
  return (
    <>
      <PageStickyHeader className="mb-3.5">
        <PaginaFilterPanel />    // FilterPanel + FilterGroup + campos
      </PageStickyHeader>
      <PaginaContent />
    </>
  )
}

function PaginaContent() {
  return (
    <div>
      <FaixaAoVivo />                                   // so quando existe "agora" (Hoje ao vivo)
      <SectionHeading title="Resultado do periodo" description={etiquetaDoPeriodo} action={baixarPlanilha} />
      <ExecutiveCardGrid ariaLabel="..." cards={cards} className="mb-4" />
      <ChartCard variant="executive" title subtitle><Chart ... /></ChartCard>   // o painel que responde "esta bom ou ruim"
      <SectionHeading title="Composicao do periodo" description="..." />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">           // paineis de composicao
        <ChartCard variant="executive" ...><Chart ... /></ChartCard>
      </div>
      <PaginaListDialog ref={listDialog} ... />          // a janela que o clique abre
    </div>
  )
}
```

A ordem das perguntas e a da Visao Geral de OS: o que esta acontecendo
agora (se houver), o que aconteceu no periodo e se esta bom ou ruim, onde
aconteceu e o que mais contribuiu. Falha da fonte NAO cai na base local:
com a fonte carregando ou indisponivel a pagina nao desenha indicador nenhum.

## Componentes compartilhados e o que cada um congela

### Pagina

- `components/dashboard/PageStatePanel.tsx`: painel de falha (`kind="error"`,
  `role=alert`). Mesma superficie dos paineis. Desde 08/10/2026 o carregando
  NAO usa mais este painel (decisao do Mario, opcao B).
- `components/dashboard/PageSkeleton.tsx` (08/10/2026): o carregando. A pagina
  monta o proprio desenho em cinza com as pecas (`PageSkeleton` com a frase
  para o leitor de tela, `SkeletonFilterBar`, `SkeletonSectionHeading`,
  `SkeletonCardGrid`, `SkeletonChartCard` em `columns`, `rows` ou `table`,
  `SkeletonLiveStrip`), na mesma ordem, grade e altura dos componentes reais,
  num arquivo `<Pagina>Skeleton.tsx` ao lado da pagina, com teste espelho que
  conta cards e paineis. Primeira carga: a pagina inteira; troca de periodo:
  so o periodo, porque filtros e faixa ao vivo continuam na tela. Exemplo:
  `src/Pages/Overview/OverviewSkeleton.tsx`. Sem numero nenhum no esqueleto.
  Cor e brilho: `.impacto-skeleton` em `styles.css`, texto secundario
  misturado com transparente, que serve sobre qualquer fundo nos dois temas.
  A faixa de filtros em cinza mora no `PageStickyHeader`, como a real. Lista buscando: passe
  `loadingMessage` a `ListTable` (ou `TodayOsTable`, `TodaySalesTable`), que
  desenha colunas reais e linhas em cinza e tira o "0 OS" do titulo; nunca
  o texto "Buscando" no `emptyMessage`.
- `components/layout/PageStickyHeader.tsx`: faixa presa ao topo do `main`,
  `z-[1]`, sem offset de cabecalho. E onde a faixa de filtros mora.
- `components/dashboard/SectionHeading.tsx`: titulo de faixa em caixa alta,
  frase de apoio (texto ou etiqueta) e no maximo UMA acao a direita.
- `contexts/usePageSourceStatus.ts`: a pagina informa ao selo do cabecalho
  se esta carregando, indisponivel ou atualizada, e a data real da fonte.

### Faixa de filtros (`components/filters`)

- `FilterPanel.tsx`: resumo sempre visivel (titulo, atalhos, periodo, chips
  com o "x" que tira so aquele filtro, Limpar filtros, Expandir/Recolher) e
  area expandida oculta no DOM com `hidden`. Um unico Limpar por estado, so
  quando a pagina passa `onClear`; a pagina decide, porque so ela sabe o
  recorte padrao (com a cobertura real da fonte, nao a do arquivo local).
- `FilterGroup.tsx`: grupo com nome de negocio (Periodo, Operacao,
  Resultado). Regua dos campos: 8 partes na linha, 2 para Periodo e 6 para
  o resto; cada campo ocupa 1 e nunca muda de largura pelo conteudo.
- `FilterSelectField.tsx` mais `filterSelectOptions.ts` (`plainOptions`):
  seletor com rotulo, e a frase abaixo que explica um seletor desabilitado.
  Lista longa com digitacao usa o `MultiSelectField` com `searchInField`
  (digita-se no proprio campo, onde esta o `Todos`; e o Vendedor do
  Comercial); o `components/ui/SearchSelectField` ficou sem uso em
  02/10/2026. Campo e opcoes levam a maozinha; so onde se digita vale o
  cursor de texto.
- `MultiSelectField.tsx` (desde 30/09/2026, pedido do Mario): campo que
  aceita varias opcoes, com busca no topo da lista e o check nas marcadas.
  E o padrao da faixa quando marcar mais de uma faz sentido (na OS, os seis
  campos de escolha; no Comercial, Cidade e Vendedor desde 02/10/2026). O filtro guarda uma lista, e lista vazia e o neutro;
  no campo cabe a primeira etiqueta e um "+N"; no chip do resumo,
  `selectionChipValue` (ate duas por extenso, depois "A +2"). Time e Tipo
  de cliente, duas opcoes cada, seguem seletor simples por decisao do Mario
  (no Time, Todos ainda inclui as vendas sem time). Datas
  usam `components/ui/DateField`, presas a cobertura da fonte.
- `PeriodPresets.tsx` com `data/periodPresets.ts`: Ontem, Esta semana,
  Semana passada, Este mes, Mes passado, todos em dias fechados; atalho fora
  da cobertura fica desabilitado com o motivo, nunca some; o aceso e
  derivado das datas (`activePeriodPreset`) com memoria do ultimo clicado;
  o periodo por extenso (`periodRangeText`) escreve o dia da semana quando
  e um dia so. As contas de data ficam em `data/isoDate.ts`.
- Valores neutros curtos, com concordancia: `Todas` para Equipe, Categoria
  e Cidade, `Todos` para Tipo de OS e Status.

Exemplo de ligacao: `src/Pages/Overview/OverviewFilterPanel.tsx` (OS, com
atalhos e datas so no recorte personalizado) e
`src/Pages/Commercial/Overview/OverviewFilters.tsx` (Comercial: desde
25/09/2026, na branch feat/comercial-hoje-ao-vivo, com os mesmos atalhos e o
periodo padrao ate ontem, e SEM o periodo por extenso no resumo, nem no
recorte personalizado, porque a etiqueta de Resultado do periodo ja o
escreve, pedido do Mario em 25/09/2026; Cidade e Vendedor com varias opcoes
desde 02/10/2026, e o servico recebe o parametro repetido).

### Cards de indicador

- `components/dashboard/ExecutiveCardGrid.tsx`: a colecao. Um card aberto
  por vez, clique fora fecha, tema das preferencias. Colunas por
  `columnsClass` (padrao das paginas de OS: `sm:grid-cols-2 lg:grid-cols-4`).
- `components/dashboard/ExecutiveMetricCard.tsx` e
  `executiveMetricCardModel.ts`: o card, com frente (titulo, valor,
  comparacao, detalhe, definicao na base) e leitura gerencial no clique
  (titulo, texto com `{destaque}`, OBSERVAR). Comparacao via
  `buildDeltaFromKpi` (sentido conhecido pelos agregados) ou
  `buildExecutiveDelta` (crescer e favoravel). Cor e identidade fixa do
  indicador; bom ou ruim e papel da comparacao.
- A leitura gerencial e CALCULADA sobre o recorte, no modelo da pagina
  (`buildOverviewReadings` em `overviewModel.ts` e o exemplo): os numeros
  que ela escreve sao os que o card mostra.

### Paineis e graficos

- `components/dashboard/ChartCard.tsx` com `variant="executive"`: titulo,
  subtitulo e superficie do tema escuro sozinho. `className` na variante
  executiva SOMA, e serve so para identificar o painel (teste), nunca para
  escopar tema.
- `components/charts/Chart.tsx`: o unico lugar que desenha ECharts. Ja
  redesenha quando as fontes terminam de carregar (rotulo de eixo medido
  com a fonte errada saia amputado), aceita `onEvents` (clique em barra,
  fatia, rotulo) e `onCategoryClick` (clique no fundo da faixa de um dia,
  para dia com barra de dois pixels).
- Gerador de opcoes por painel em `<pagina>XChartOptions.ts`, com
  `xFromChartClick(params)` devolvendo o que o clique abre, e teste espelho.
  Criterio visual: skill `graficos-impacto`.

### O numero vira lista

O clique num painel abre, no centro da tela, a lista do que o numero conta,
com filtro por coluna e planilha para baixar. E a ponte entre o numero e a
acao, e so existe com o portal ligado ao servico (a base local de estudo e
anonima).

- `components/dashboard/ListDialog.tsx`: a janela (Radix Dialog, altura
  fixa de 88vh, centro por flex, foco na janela, o painel do filtro de
  coluna nasce dentro dela). `ListDialogHeader` da o titulo, a linha de
  contexto (periodo pelo nome e filtros da pagina, porque a janela vai para
  o projetor sem a faixa) e o Fechar; os atalhos de selecao entram como
  `children`, com `components/ui/ChoiceChip`.
- `components/dashboard/ListTable.tsx` com `listTableModel.ts` e
  `ListColumnHeader.tsx`: a tabela. A pagina declara as colunas
  (`ListColumn`: chave, nome, largura fixa, filtra, ordena, `text(row)`,
  `compare`, `searchable`, `sortKind`) e as regras (`missing`: textos de
  ausencia que vao para o fim; `tieBreak`). O texto da celula e o mesmo
  pelo qual a coluna filtra e ordena; opcoes no contexto das outras
  colunas, como no Excel; recorte e ordenacao sao da lista aberta, e trocar
  de selecao remonta a tabela (`key`). `Baixar Excel` leva as linhas
  visiveis, na ordem da tela. Na coluna de data (`sortKind: 'date'`), texto
  que nao e data vai para o fim sozinho.
- Tabela propria da pagina, fora da `ListTable` (a de Tecnicos e o
  exemplo): cabecalho preso com `sticky top-0 z-[1]` exige `isolate` no
  conteiner que rola, senao ele passa por cima da faixa fixa de filtros.
- `lib/xlsxWriter.ts` e `lib/downloadFile.ts`: a planilha .xlsx montada no
  navegador, como Tabela do Excel com cabecalho congelado, data como data,
  e uma segunda aba dizendo de que recorte ela saiu. A pagina so declara
  colunas e linhas (exemplo: `osListExport.ts`).
- Ligacao de referencia na OS: `osListModel.ts` (o que cada clique abre e a
  regra e a MESMA do painel clicado, sobre os mesmos registros, para o
  numero da janela fechar com o da barra), `todayOsTableModel.ts` (colunas
  e ausencias), `TodayOsTable.tsx` (celula de status com o ponto de cor e
  a marca de atencao), `OsListDialog.tsx` (selecao e atalhos).

### Pilulas e acoes de texto

- `components/ui/chipStyles.ts`: `tintedChipClass` (pilula tingida no
  acento: filtro ativo, atalho aceso, etiqueta do periodo) e
  `outlineChipClass`. `components/ui/ChoiceChip.tsx` e o botao de
  pressionar com `aria-pressed`, aceso com a pilula tingida.
- Acao de texto no acento (Limpar filtros, Expandir, Restaurar tabela,
  Baixar Excel) leva a classe `impacto-text-action`.

### Abas

- `components/ui/PanelTabs.tsx` (21/10/2026, aprovado pelo Mario):
  `PanelTabs` e `PanelTabPanel`, abas no visual das Configuracoes, so com
  tokens globais, para partes da mesma tela que nao cabem juntas. Primeiro
  uso: a janela da Agenda e capacidade, abas Categorias e OS. Contagem
  opcional ao lado do nome; a aba nao escolhida fica montada e escondida
  (`hidden`), para guardar filtro de coluna e busca; o conteudo recebe foco
  pelo Tab. Sem setas, Home e End, como as das Configuracoes.
- Nao confundir com o `ModalTabs` do Perfil de Acesso
  (`Pages/AccessProfiles/accessProfilesUi.tsx`), que usa as cores de
  `.impacto-settings` e so vale la.

## Tema escuro

Uma regra de superficie, `styles.css`:

- `.executive-panel` e a classe que todo painel executivo carrega sozinho
  (`ChartCard` executivo, `ExecutiveMetricCard`, `PageStatePanel`,
  `ListDialog`). Contêiner proprio da pagina que precise da mesma
  superficie (a faixa Hoje ao vivo, o contêiner da Visao Geral Comercial)
  recebe a classe. NUNCA redefina token global em `:root` para uma pagina.
- `.impacto-chip`, `.impacto-text-action`, `.impacto-filter-panel`,
  `.impacto-list-dialog`, `.impacto-column-filter` (painel e cabecalho do
  filtro de coluna) e `.impacto-tabs` (abas do portal) sao os ganchos que o escuro pinta de Verde Detalhes
  `#34d372` (o azul do acento nao alcanca contraste sobre a superficie
  escura). Vem dos componentes; a pagina nao os declara. Botao cheio de
  verde leva o texto em `#0b1520`, nunca branco (1,96 sobre o verde).
- Token semantico DA PAGINA (o ambar de atencao e o verde de ao vivo da
  faixa Hoje) continua escopado pela classe da pagina (`.os-today`), com o
  par medido nos dois temas, como o skill `graficos-impacto` exige.

## Textos

- Portugues, sentence case, sem travessao. Subtitulo de painel separa as
  partes com ` · `. O subtitulo convida ao clique so quando a lista existe
  (`clique numa barra para ver as OS`), nunca com a base local.
- A frase de definicao do indicador e completa, com ponto final. O OBSERVAR
  diz onde agir, nao repete a definicao.
- Ausencia se escreve por extenso (`Sem tecnico`, `Sem equipe`, `Sem
  turno`): e resposta, e vira opcao de filtro.

## Teste espelho

Toda pagina tem `<Pagina>.render.test.tsx` com `renderToStaticMarkup`
dentro de `PreferencesProvider`, sobre a base local, e cada modelo e cada
gerador tem o `.test.ts` ao lado. O que o teste da pagina protege: ordem
das faixas, os cards na ordem aprovada (contagem de `<article`), cada
painel com titulo e subtitulo, alturas calculadas, e que com a base local a
lista e a planilha NAO sao oferecidas. Os componentes compartilhados tem
teste proprio; a pagina nao repete o que eles ja provam.

## Antes de encerrar

```
npm run lint
npm run test
npm run build
```

Depois, `revisor-convencoes`; `revisor-graficos` se houve grafico ou card;
`revisor-dados` se houve agregacao, filtro ou comparacao.
