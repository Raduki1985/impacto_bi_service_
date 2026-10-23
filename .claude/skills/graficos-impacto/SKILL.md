---
name: graficos-impacto
description: Padrao visual e tecnico de graficos, cards de indicador e paineis do IMPACTO BI Web. Use SEMPRE antes de criar ou alterar qualquer grafico ECharts, card executivo, KPI, rosca, barra, linha, heatmap, tooltip, legenda, eixo, paleta ou painel de dashboard neste repositorio. Traz os tokens, helpers e componentes reais do projeto, e as regras de tema claro/escuro, formatacao pt-BR, acessibilidade e teste espelho.
---

# Graficos e cards do IMPACTO BI

Este skill descreve o que ja esta aprovado no codigo. Ele nao inventa direcao
visual: a identidade do portal esta fechada, e o trabalho e reusar, nao criar
uma variante nova por pagina.

## Relacao com o skill `dataviz`

O skill `dataviz` (built-in) traz o metodo: escolha da forma do grafico, formula
de cor, specs de marca, regras de legenda, eixo, tooltip e acessibilidade. Use
como referencia de raciocinio.

A paleta dele e placeholder e deve ser ignorada aqui. Cor, tipografia, tokens,
formatadores e componentes vem deste skill. Em qualquer conflito, o que esta no
codigo do repositorio vence.

## Regra zero: o que e template oficial

A **Visao Geral de OS** (`src/Pages/Overview`) e a pagina modelo do portal
desde 24/09/2026, por decisao do Mario: cards, paineis, faixa de filtros,
lista por clique e janela sairam dela para `src/components`, e toda pagina
nova monta o esqueleto do skill `modelo-de-pagina` com esses componentes. O
card executivo nasceu na **Visao Geral Comercial**
(`src/Pages/Commercial/Overview`), que continua sendo referencia de
composicao de card (velocimetro, barra de etapas).

- Ao decidir aparencia, espelhe a Visao Geral de OS; a Comercial e a segunda
  referencia. As duas usam os mesmos componentes, e nao classes parecidas.
- As demais paginas foram aproximadas por copia e ajuste. Nao trate nenhuma
  delas como padrao aprovado nem como referencia de "ja validado".
- Nada vira componente compartilhado sem passar pela pagina modelo primeiro,
  ou sem aprovacao explicita do Mario. Composicao candidata fica isolada na
  propria pagina.

## Onde mora cada gerador de opcoes

Duas camadas, e a escolha entre elas importa:

- `src/components/charts/chartOptions.ts`: helpers COMPARTILHADOS, usados por
  varias paginas. Alterar qualquer coisa aqui muda a aparencia de todas as telas
  que consomem. So mexa quando a mudanca for deliberadamente global.
  - `makeBarOptions(labels, values, color?, horizontal?)`
  - `makeDonutOptions(pairs, colors?)`
  - `makeStackedBarOptions(labels, series)`
  - `makeLineOptions(labels, series)`
  - `makeHeatmapOptions(x, y, data, max)`
  - `makeCalendarHeatmapOptions(range, data)`
- `src/Pages/<Pagina>/<pagina>XChartOptions.ts`: gerador especifico daquela
  pagina, exatamente para nao arrastar as demais telas junto. E o padrao da
  Visao Geral de OS: `overviewDailyChartOptions.ts`,
  `overviewStatusChartOptions.ts`, `overviewRankingChartOptions.ts`,
  `overviewServiceTypeChartOptions.ts`.

Regra pratica: se o grafico e mais uma instancia do padrao existente, use o
helper compartilhado. Se ele tem tooltip, legenda ou comportamento proprio, crie
um gerador na pasta da pagina e nao toque no compartilhado.

## Paleta

Nunca invente um hex novo. Os valores em uso:

- Acento de DADOS: `#2f6bff`, exportado como `OS_CHART_ACCENT`. E a cor padrao
  das barras. Nao confundir com o `--accent` da ESTRUTURA, que passou a
  `#003be2` no rebrand de set/2026: barras, fatias e rampas preservam a paleta
  de dados original de proposito.
- Roscas de OS, na ordem em que as fatias recebem, exportada como
  `OS_DONUT_PALETTE`:
  `#2f6bff`, `#00b3a4`, `#f5a623`, `#e5484d`, `#8b5cf6`, `#0ea5e9`, `#64748b`.
  A mesma sequencia existe como `chartPalette` em
  `src/data/dashboardAggregates.ts`, usada como fallback de serie.
- Cor por status: `statusColors` em `src/data/dashboardAggregates.ts`. Status
  tem cor fixa, nunca por posicao.
- Rampa de heatmap: `#eef3ff`, `#9dbcff`, `#3f79ff`, `#123a99`.
- Verde da estrutura no tema escuro: `#34d372` (Verde Detalhes da paleta
  institucional; item ativo da sidebar, switch de aparencia, e os chips e
  acoes de texto dos componentes compartilhados, pelas classes
  `.impacto-chip` e `.impacto-text-action`). O verde dos KPI cards
  (`--kpi-ok`) segue `#00d776`, da paleta de dados original.
- Azul de filtro no tema escuro: `#7e9bff`. O azul da estrutura nao alcanca
  contraste sobre a superficie `#182230`, entao chips e acoes de filtro trocam
  para ele.
- Semantica de KPI: `--kpi-ok #00d776`, `--kpi-warn #ffb020`, `--kpi-bad #ff4d6a`,
  `--kpi-neutral #cbd5e1`, favoravel `#00a862`, desfavoravel `#e5384e`.

Regras de cor:

- **Cor fixa por item, nunca por posicao.** Filtrar o recorte muda tamanho e
  ordem das fatias e nao pode repintar nada. O padrao esta em
  `overviewServiceTypeChartOptions.ts`: um mapa nome para cor, uma funcao
  `serviceTypeColor(name)` e um guard no carregamento do modulo que lanca erro
  se algum item do catalogo ficar sem cor declarada. Replique esse guard em
  qualquer grafico com dominio fechado.
- Se precisar de uma variacao, derive de um token existente com
  `color-mix(in srgb, VAR x%, transparent)`, como o `styles.css` ja faz. Nao
  crie paleta paralela.
- Cor sozinha nunca carrega estado ou identidade. Sempre acompanhe de legenda,
  rotulo, anel, seta ou texto.
- **Cor de dado tem que enxergar NOS DOIS temas.** Como a cor de identidade e a
  mesma no claro e no escuro, mede antes de propor: contraste minimo 3,0 contra
  a superficie clara (`#ffffff`) E contra a escura (`#1f2937`). Foi o que tirou
  o grafite `#334155` da Infraestrutura em 09/09/2026: 1,42 no escuro, a fatia
  sumia no fundo do painel. O cinza claro `#cbd5e1` erra do outro lado, 1,48 no
  claro. A substituta e a terracota `#b5652f`, com 3,40 e 4,31. As cores vivas
  herdadas (ambar, ciano, teal, azul claro) ficam entre 2,0 e 2,8 no tema claro:
  e desvio conhecido da paleta historica, nao referencia para cor nova.

## Tipografia

- Texto e eixos: `IBM Plex Sans, sans-serif`, base 12px, cor `#475467` no claro.
- Numeros tabulares e valores: `IBM Plex Mono`, via classe `.font-mono`.
- Nao adicione fontes. As duas familias ja vem do import no topo do `styles.css`.

## Tema claro e escuro

- O tema vem de `usePreferences()` (`const { theme } = usePreferences()`) e e
  passado como parametro para o gerador de opcoes e para o componente. Geradores
  sao funcoes puras: nunca leiam o DOM, `document` ou media query para descobrir
  o tema.
- Padrao do gerador: um objeto `palette = { light: {...}, dark: {...} }` e
  `const colors = palette[theme === 'dark' ? 'dark' : 'light']`.
- No escuro, os paineis executivos usam superficie `#1f2937`, elevada
  `#263448`, borda `#3b475a` e divisor `#323e50`, pela classe
  `.executive-panel` que o `ChartCard` executivo, o `ExecutiveMetricCard`, o
  `PageStatePanel` e o `ListDialog` ja carregam. Conteiner proprio da pagina
  que precise da mesma superficie recebe a classe (`.os-today` a leva). Nunca
  redefina token global: as demais telas nao podem mudar de aparencia por
  causa de uma pagina. Token semantico da pagina (o ambar de atencao da faixa
  Hoje) continua escopado pela classe da pagina.
- Tooltip: fundo `#1a2331` no claro e `#263448` com borda `#46556b` no escuro.

## Painel e wrapper

- Painel de grafico: `ChartCard` de `src/components/dashboard/ChartCard.tsx`.
  - `variant="executive"` para paginas novas e para tudo que acompanha os cards
    executivos. Ele usa tokens de tema, `rounded-xl`, sombra discreta e ja
    carrega a classe `executive-panel`, a superficie do tema escuro. Nenhuma
    classe de escopo da pagina e necessaria.
  - `variant="default"` e o painel historico com superficie branca e textos
    fixos. Nao mude.
  - Na variante executiva o `className` SOMA, e serve so para identificar o
    painel (o teste da pagina o localiza por ela), nunca para escopar tema.
- Renderizacao: sempre o wrapper `Chart` de
  `src/components/charts/Chart.tsx`. Ele ja aplica `notMerge` e `lazyUpdate`,
  redesenha sozinho quando as fontes terminam de carregar (rotulo medido com
  a fonte errada saia amputado), e aceita `height`, `minWidth`, `onEvents`
  (clique em barra, fatia e rotulo) e `onCategoryClick` (clique no fundo da
  faixa de uma categoria, para barra de dois pixels). Nao instancie
  `ReactECharts` direto, e nao repita o efeito de fontes na pagina.
- Card de indicador: `ExecutiveMetricCard`, com o modelo visual separado em
  `executiveMetricCardModel.ts`. A colecao e `ExecutiveCardGrid`, que guarda o
  estado "um card aberto por vez" e o clique fora; a pagina so entrega a lista
  de cards.
- Painel que abre lista no clique, janela e planilha: skill `modelo-de-pagina`.

## Card executivo: altura e largura

Padrao do portal, aprovado pelo Mario em 09/09/2026. Vale para
`ExecutiveMetricCard` e para qualquer card de indicador novo.

- Largura: a pagina decide as colunas por breakpoint na propria grade. O card
  nunca decide a propria largura.
- Altura: sai do conteudo. Frente e leitura gerencial ficam empilhadas na
  mesma celula de uma grade de uma coluna, e o card tem a altura da face mais
  alta; a grade da pagina iguala os cards da mesma linha. Nenhum piso fixo
  dentro do componente.
- Piso (`minHeight`) e decisao da PAGINA, para fileiras que precisam
  acompanhar um card mais alto em outra linha: as duas paginas comerciais
  passam 206 por causa do velocimetro. A Visao Geral de OS nao passa piso.
- Faixas fixas so onde alinham numeros entre cards: valor (30px) e comparacao
  (24px). Nao mexa nelas por pagina.
- Orcamento de texto, porque altura variavel so funciona com limite: titulo
  ate 2 linhas, valor 1 linha, comparacao 1 linha, definicao ate 2 linhas;
  leitura: titulo 2, explicacao 3, observar 2.
- Comparacao: rotulo `vs. periodo anterior` (`PREVIOUS_PERIOD_LABEL`), nunca
  `p.p.`, que se le como pontos percentuais. O card troca sozinho para
  `vs. periodo ant.` quando a face tem menos de 156px de largura util
  (container query em `@container`). O texto acessivel continua
  `versus periodo anterior`.
- Nada especifico de uma pagina dentro do componente compartilhado.

## Formatacao

Sempre `src/lib/formatters.ts`, nunca `toLocaleString` solto nem `toFixed` cru:

- `formatNumber(value)`: `Intl.NumberFormat('pt-BR')`.
- `formatPercent(value)`: recebe **fracao de 0 a 1** e devolve com virgula
  decimal, por exemplo `12,4%`. Passar `12.4` aqui e o erro classico.
- `formatDecimal(value, digits?)`, `formatMinutes(value)`, `initials(name)`.

Meses e dias da semana em portugues abreviado, como em
`makeCalendarHeatmapOptions` (`Jan`, `Fev`, ... e `D S T Q Q S S`).

## Legenda, eixo e tooltip

- Legenda sempre presente quando existe mais de uma serie ou fatia, com
  `icon: 'circle'`, `itemWidth: 9` ou `10`, `itemHeight` igual.
- Rotulo de eixo longo e truncado apenas na exibicao, com
  `truncateAxisLabel(max)`. O nome completo continua no dado, no tooltip e na
  leitura acessivel. Nunca trunque o dado em si.
- Rotulo direto dentro da fatia so quando ela tem espaco. O corte em uso e 6%
  de participacao (`DIRECT_LABEL_MIN_SHARE`); abaixo disso a identidade fica na
  legenda.
- **Tooltip nunca mostra linha zerada** (pedido do Mario em 28/09/2026, para
  todos os graficos). A linha com valor zero sai da caixa; se nao sobra
  nenhuma, o formatador devolve `''` e a caixa nem abre. A serie continua
  desenhada e na legenda (ver "Serie zerada nao e serie ausente"): a regra e
  so da caixa do mouse. "sem dado" (nulo) nao e zero e continua. Os
  geradores compartilhados usam `makeAxisTooltipFormatter`. Excecao
  consciente: o ranking de tecnicos, onde "Concluidas 0" e "Taxa 0%" sao a
  informacao do tecnico e nao uma serie vazia.
- Tooltip com `confine: true` quando o conteudo e rico, `border-radius: 8px`,
  sombra `0 6px 18px rgba(0,0,0,.18)` e largura maxima quando lista itens.
- Marcador do tooltip: circulo de 10px na cor da serie com 6px de respiro. Se o
  conteudo tiver linhas que o ECharts nao marca sozinho, gere o marcador com a
  mesma funcao para tudo alinhar no mesmo eixo.
- Nome longo dentro do tooltip: `min-width: 0` mais `overflow: hidden` e
  `text-overflow: ellipsis` no NOME, e `flex: none` no numero. Sem isso o nome
  empurra o valor para fora da caixa.

## Animacao

- Entrada e troca de filtro instantaneas: `animationDuration: 0` e
  `animationDurationUpdate: 0`. A fatia nasce no tamanho final, sem varrer o
  circulo a cada recorte.
- O que ganha movimento e so a transicao de estado:
  `stateAnimation: { duration: 260, easing: 'cubicOut' }`, com `animation: true`.
  Por isso nao se usa `animation: false` quando existe hover.
- CSS de card respeita `prefers-reduced-motion: reduce`.

## Acessibilidade

- Opcoes de grafico com conteudo proprio declaram
  `aria: { enabled: true, label: { enabled: true, description } }`, e a
  descricao e derivada da MESMA colecao que a tela desenha, por uma funcao
  exportada e testavel (`buildXDescription`).
- Foco visivel em qualquer elemento interativo. O card executivo responde a
  `:focus-visible` igual ao hover.
- Estado nunca depende so de cor.

## Barra empilhada: canto e rotulo

Padrao da casa fechado com o Mario em 18/09/2026, nos dois graficos mensais
da Visao Geral Comercial. Vale para qualquer barra empilhada nova.

- **Base reta, topo arredondado.** A barra nasce na linha do eixo, entao a
  base nao leva canto. So o topo recebe `borderRadius [3, 3, 0, 0]`.
- **O canto e por BARRA, nunca fixo na ultima serie.** A serie do topo vale
  zero na maioria dos meses em composicao real, e o topo sai reto. Use
  `topStackIndex(values, chartMax)` e `stackedBarRadius(values, index,
  chartMax)` de `src/Pages/Commercial/Overview/overviewChartOptions.ts`:
  recebem os valores da pilha na ordem de empilhamento, com zero no que esta
  desligado na legenda.
- **Toda fatia com valor tem altura minima desenhada** (28/09/2026, pedido
  do Mario: barra clicavel tem que dar para ver e clicar).
  `drawnStackValues(values, chartMax)` sobe a fatia abaixo de
  `MIN_DRAWN_SLICE_SHARE` (4% do maior total, 6 a 9 px) e tira a diferenca
  das fatias grandes da MESMA barra, entao a altura da barra nao muda.
  Canto e rotulo se decidem sobre as alturas desenhadas, e o topo e sempre a
  ultima fatia com valor: acabou a lasca reta em cima da fatia arredondada
  (o Sem time de julho e agosto na Evolucao mensal). Tooltip, rotulo e
  clique leem SEMPRE o valor real, nunca o da serie. Barra simples (Volume
  diario de OS) usa `dailyVolumeDrawnBars`: minimo so no Total, e a verde
  sobe junto na mesma proporcao, sem minimo proprio. Destino das OS tem o
  seu (`OUTCOME_MIN_DRAWN_SHARE`) e Motivos usa `barMinHeight`.
  `barMinHeight` NAO serve para barra empilhada nem para serie com zero: a
  biblioteca desenha o zero com a altura minima.
- **A pilha segue a ordem do fluxo, com a perda no TOPO** (Safra, pedido do
  Mario em 28/09/2026). De 18/09 a 28/09 a cancelada ficou no piso porque,
  no topo, virava uma tampa fina e reta; com a altura minima ela e uma fatia
  de verdade, com canto e total. Nao repropor a perda no piso por causa da
  tampa. A legenda continua declarada com `legend.data`.
- **Rotulo do total em cima da barra**, na MESMA fatia que leva o canto, para
  os dois nunca cairem em lugares diferentes. Com uma fatia desligada na
  legenda, o rotulo mostra o que a barra mede, e nao o total do dado.
- **Eixo de quantidade em pt-BR** com `formatAxisInteger`: sem ele a
  biblioteca escreve `1,000`, que se le como decimal.

## Serie zerada nao e serie ausente

Serie que existe e vale zero CONTINUA desenhada, com a entrada dela na legenda.
Zero e resultado, nao ausencia de dado: some com a serie e o gestor deixa de
saber se nao houve nada ou se o grafico quebrou.

Testado e reprovado pelo Mario em 09/09/2026 no `Volume diario de OS`: ele
pediu para a linha de Improdutivas sumir quando o periodo nao tem nenhuma,
viu na tela e voltou atras, porque o painel sem a linha e sem a entrada na
legenda ficou parecendo incompleto. A linha deitada no zero e o resultado do
periodo. Nao reproponha esconder.

Nao confundir com dado NAO MEDIDO, que vira lacuna (`null`) e nunca zero, nem
com o recorte inteiro vazio, que e o caso abaixo.

## Estado vazio

Recorte sem dados nao renderiza grafico vazio. Devolva opcoes com um `title`
centralizado, por exemplo `Sem dados no periodo`, na cor `#98a2b3` no claro e
`#a9b5c6` no escuro, com `animation: false` e o `aria` correspondente.

## Copy

- Proibido travessao `—` e meia risca `–` em qualquer texto exibido. Use
  virgula, dois pontos ou ponto final. Vale tambem para comentario de codigo,
  por consistencia.
- Portugues, sentence case, verbo ativo. O rotulo diz o que acontece.

## Estrutura de arquivo e teste espelho

Todo gerador de opcoes de pagina segue o mesmo formato:

- Logica pura exportada e testavel separada da montagem das opcoes:
  `buildXRows(slices)`, `buildXDescription(rows)`, `buildXTooltip(row)`,
  `xColor(name)`, e so depois `makeXOptions(data, theme)`.
- Um `.test.ts` ao lado, com o mesmo nome. Isso ja e habito no repositorio:
  `overviewServiceTypeChartOptions.test.ts`, `overviewOsAggregates.test.ts`,
  `overviewOsFilters.test.ts`, `ChartCard.test.tsx`,
  `Overview.render.test.tsx`. Grafico novo sem teste espelho esta incompleto.
- Comentario de bloco no topo explicando POR QUE o gerador vive naquela pasta e
  que decisao ele congela. E o estilo de comentario do repositorio: explica a
  razao, nao repete o codigo.

## Antes de encerrar

```
npm run lint
npm run test
npm run build
```

Os tres precisam passar. O build ja emite aviso de bundle grande por causa do
ECharts; isso e conhecido e nao e regressao.
