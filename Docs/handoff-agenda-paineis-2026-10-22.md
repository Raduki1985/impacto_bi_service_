# Passagem: Agenda e capacidade, painéis de semana (22/10/2026)

Arquivo local, fora do Git (Docs está em .git/info/exclude). Ler por
inteiro antes de qualquer ação. A história anterior (janelas no clique,
abas) está em Docs/handoff-agenda-janelas-2026-10-21.md, seção 0, e na
memória `capacidade-de-os-por-turno`.

## 1. Estado dos repositórios às 10h de 22/10/2026

- Serviço: branch develop, 0.0.66, limpo. Nada a fazer nele nesta etapa.
- Portal: branch `feat/os-agenda-paineis-semana`, criada PELO MÁRIO a
  partir da develop 0.1.32 (ele quer aprender Git: dar o passo a passo,
  não executar por ele; memória `user-aprendendo-git`). SEM commit, com 8
  arquivos alterados, todos em src/Pages/Schedule:
  Schedule.tsx, ScheduleCalendar.tsx, ScheduleSkeleton.tsx,
  ScheduleAgendaDialog.tsx, scheduleModel.ts e os três testes
  (Schedule.render, ScheduleAgendaDialog, scheduleModel).
- Lint ok, build ok, 2.375 verificações: só DefinePassword falha (antiga).
- Visto na tela com o serviço real, nos dois temas e em 1280 px:
  Docs/historico/capacidade/paineis2-claro.png, paineis2-escuro.png,
  paineis2-notebook.png.

## 2. O que foi feito nesta branch (implementado e validado, sem commit)

Painéis "Esta semana" e "Próxima semana", refeitos a partir de uma prévia
que o Mário trouxe (feita no GPT) e das quatro recomendações que ele
aceitou:

1. Horas livres = soma do que os cards escrevem como "livres"
   (`shiftFreeHours`), e NÃO capacidade menos marcadas; quando há turno
   cheio, uma nota explica: "1 turno cheio: 7h12 além da capacidade" (e/ou
   "42min de sobra que não cabe uma OS").
2. Sem a coluna "Ocupação por dia" da prévia (o calendário já mostra).
3. Palavras do card: "Horas livres de hoje em diante" (ou "Horas livres"
   quando a semana não tem passado), "Marcadas", "Capacidade", "turnos
   com horas livres / com poucas horas livres / cheios / fechados / sem
   estimativa".
4. Porcentagem inteira, arredondada para baixo antes de 100%, como o card.

Desenho (Schedule.tsx, `WeekSummaryPanel`): nome da semana e os dias
contados ("22 a 24/10", `daysRange`); à esquerda o destaque em
`--schedule-ok` (verde) e "494h55 realizadas até ontem"; à direita
"Ocupação da agenda 29%", barra na cor do estado (`SHIFT_TONE_VAR`, que
saiu do calendário para o modelo) e os quadrinhos Marcadas/Capacidade
(só turnos ainda abertos: fechados e sem estimativa ficam fora); embaixo
os turnos e as notas. Semana no passado: só "Realizadas". Fora da
leitura: "Semana fora da leitura".

Também nesta branch: a janela da Agenda passou a mandar `source.today`
ao `toPeriodOsRow`, então o Detalhe não escreve a data na etapa de hoje
("Saiu às 08h27"; "15/10 · chegou às 17h05" só em outro dia).

Revisor de dados passou (sem bloqueio); ajustes dele aplicados: turno sem
OS e sem estimativa conta como "sem estimativa"; testes de cheio pela OS
média, de horas quebradas (31min + 31min = 1h01) e do painel no render.

DECISÕES DO MÁRIO em 22/10 às 10h ("confere"), implementadas e vistas na
tela com o serviço real (paineis3-claro.png, paineis3-escuro.png,
paineis3-notebook.png em Docs/historico/capacidade):
- painéis lado a lado, sem "ocupação por dia" (nem coluna nem linha: a
  grade já mostra manhã e tarde);
- contadores de turno zerados somem ("6 turnos com horas livres"; a
  palavra "turnos" vai no primeiro grupo que aparece);
- quadrinho "Capacidade restante" na semana com dias passados e
  "Capacidade total" na que não começou (`capacityLabel` no modelo);
- horas sem ponto de milhar ("1587h48"), decidido;
- palavras do card, porcentagem inteira e "22 a 24/10" mantidos.
Valores sempre da leitura atual, nunca fixados do print. Suíte após a
mudança: 2.373 ok, só DefinePassword falha (antiga); lint e build ok.

LEITURA EM TV (Mário, 22/10 às 10h30), implementada, sem commit, vista em
1920x1080 e 1280 px nos dois temas (paineis4-tv-*.png e
paineis4-notebook-*.png). Só tamanho de texto secundário; nada de
disposição, número principal, cor, texto ou cálculo:
- SectionHeading (componente compartilhado) ganhou `size="large"`
  (12,5/13 px; o padrão 11/11,5 segue nas outras páginas), usado só na
  faixa "Agenda por turno". Teste no SectionHeading.test.tsx.
- Painéis de semana: título 10,5→12; dias 11→12,5; rótulos 11,5→13;
  rótulo dos quadrinhos 10,5→12; linha dos turnos 12→13,5; notas 11→12,5.
  Números (26, 18, 15 px) iguais.
- Grade: cabeçalho do dia 11→11,5 (12,5 a partir de 1536 px); nome do
  turno, "cap." e linha de baixo do dia (Agora/OS sem turno/selo) só sobem
  a partir de 1536 px (10,5→11,5; 11,5→12 e 10→10,5; 10,5→12), porque em
  1280 px "MANHÃ cap. 134h24" e "Agora: 35 disponíveis" não cabem;
  resposta do turno: "só"/"livres" 11→12, "Realizado"/"Cheio" 12→13,
  horas 13,5 iguais; "Sem agenda" 11,5→13; ícone de pessoa 11→12.
- Alturas fixas (h-5, h-4, 17 px, 18 px) não mudaram; esqueleto intacto.
- Pré-existente, não mexido: em 1280 px o "cap. 134h24" já encostava na
  borda do botão do turno (sobra 5 px além da borda), desde antes.
Suíte: 2.374 ok, só DefinePassword; lint e build ok.

QUADRINHOS (22/10, 11h), ESTADO FINAL, implementado, sem commit, visto em
1920x1080 e 1280x800 nos dois temas (paineis6-*.png):
- Quadrinhos Marcadas/Capacidade: rótulo em cima à esquerda, valor embaixo
  à direita; recuo igual nos quatro (10 px dos lados, 6 px em cima e
  embaixo); SEM altura fixa: 50 px como antes, e só os de "Esta semana"
  crescem no notebook (66 px) porque "Capacidade / restante" quebra.
  Rótulo 12 px (13 a partir de 1536 px, sem mudar a altura).
- "Agenda por turno": 13,5/14 px (tamanho grande do título de faixa).
- Rodapé do cadastro de aptidões 11,5→12,5.
- Grade igual à rodada anterior (a de 10h30).
- Alturas conferidas: cards semanais 180 px na TV (iguais a antes), 196 no
  notebook; cartão do dia 224 px nas duas larguras.
- DECISÃO DO MÁRIO: uma rodada intermediária (10h45) tinha posto altura
  fixa de 74 px nos quadrinhos e linhas mais altas na grade da TV; ele
  recusou ("eu pedi isso?"), e tudo voltou. Não crescer card sem pedido.
- Ponto de atenção: em 1280 px "HOJE 22/10 · 42" passa 1 px de cada lado
  da faixa dele (desde a rodada de 10h30, 11,5 px), dentro da margem do
  cartão, sem corte.
- Captura do tema escuro: a janela do Playwright fica em segundo plano e
  congela a transição de cor; injetar um estilo sem transição antes de
  trocar o tema.
Suíte: 2.374 ok, só DefinePassword; lint e build ok.

HOJE EM DIANTE (22/10, 11h10), pedido do Mário ("aprovado" nos painéis +
três ajustes), implementado, sem commit, visto com o serviço real
(paineis7-*.png, inclusive paineis7-tv-avancado.png):
- Dias do canto dos painéis saíram (`WeekSummary.range` e `daysRange`
  apagados). Semana mais à frente leva as datas no nome: "Semana de 02/11
  a 08/11" (`CalendarWeek.name`).
- Faixa "Agenda por turno" saiu inteira. O aviso de releitura que falhou
  morava nela: virou uma linha só quando falha ("O serviço não respondeu
  na última tentativa: os números são da leitura das 14h32."). O
  SectionHeading compartilhado voltou ao original (o `size` some).
- "Retire OS passadas": na primeira versão deixei em branco os dias desta
  semana que já passaram; o Mário NÃO gostou ("não gostei de ter tirado os
  dias anteriores da semana atual") e explicou que "de hoje em diante" é
  a navegação: a seta para trás não passa da semana de hoje. DESFEITO:
  a semana de hoje volta inteira, com o realizado nos dias passados
  (`beforeToday`, `data-calendar-past` e o branco do esqueleto apagados).
  O realizado até ontem continua fora do painel (`WeekSummary.realized`
  apagado), sem ele ter pedido de volta.
- Setas: para trás até a semana de hoje ("A agenda começa hoje"); para a
  frente enquanto houver OS marcada depois da PRIMEIRA semana da tela
  (`advanceBlockedReason`; apagada diz "Não há OS marcadas de 23/11 a
  20/12", até o fim da leitura). Primeira versão media pelo último dia e,
  com 4 semanas, parava numa semana vazia dizendo que não havia OS
  adiante (revisor de dados); medir pela primeira semana dá o mesmo
  alcance nos dois atalhos (quatro semanas além da primeira linha). Na
  produção em 22/10 anda até a tela que começa em 16/11 (há OS no feriado
  de 20/11), igual com 2 e 4 semanas. `MAX_PAST_WEEKS` apagado. Seta com
  leitura que falhou diz "Não foi possível carregar estas semanas".
- Nome do painel virou h2 (a faixa h2 saiu). Capturas finais em
  paineis8-*.png (TV e notebook, dois temas).
- Cabe sem rolar: TV 1920x1080 sim (área da página 933 px, conteúdo 933,
  rodapé termina a 942 de 1080). Notebook 1280x800 não: conteúdo 866 px
  para 653 visíveis, faltam 213 px. Com zoom do navegador em 80% (equivale
  a 1600x1000) cabe; em 90% faltam 93 px.
- Para o Mário saber: a hora da leitura e a regra "3h12 por técnico por
  turno" sumiram com a faixa (o selo do topo só traz a data); no domingo
  a primeira linha fica só com o domingo; a seta conta OS de qualquer
  turno, mesmo com o filtro de turno.
Suíte: 2.375 ok, só DefinePassword; lint e build ok. Revisores de dados e
de convenções passaram; ajustes aplicados (seta pela primeira semana,
motivo próprio para falha, esqueleto, h2, comentários).

## 3. Próximo passo

1. O Mário aprova na tela (F5 em
   http://localhost:5173/dashboard/os/agenda-capacidade; o portal pode
   estar desligado: `npm run dev` na pasta do portal; o serviço roda no
   PyCharm dele, na develop 0.0.66).
2. Passo a passo para ELE gravar e enviar (não fazer por ele):
   - `git status` (conferir os 8 arquivos), `git add src/Pages/Schedule`,
     `git commit -m "feat(os): painéis de semana da agenda"` (título
     curto, sem corpo, sem coautoria), `git push -u origin
     feat/os-agenda-paineis-semana`.
   - Pedido de junção no GitLab para a develop, revisor Caio, descrição
     no formato "## O que muda / ## Depende de / ## Testes". Depende de
     nada no serviço.
3. Ele AINDA VAI PEDIR REVISÃO DOS CARDS DO TRELLO criados em 21/10
   (os dois da Agenda: "CALENDÁRIO DE CAPACIDADE POR TURNO" e "JANELAS NO
   CLIQUE DO DIA E DO TURNO"). Formato na memória `formato-card-trello`:
   título em caixa alta "BI | DEPARTAMENTO | PÁGINA | ASSUNTO",
   "**Descrição**" em parágrafo e "**Descrição da solução**" em tópicos
   do que a tela faz, sem arquivo, passo a passo ou nomes. O card das
   janelas precisa ganhar as abas Categorias/OS, "Fechado" no turno
   fechado e "SGI não limita"; provavelmente cabe um card novo para os
   painéis de semana.

## 4. Outros pendentes da Agenda

- Planilha Excel das listas de OS sem colunas de saída e chegada: pergunta
  em aberto ao Mário.
- Agenda por tipo de OS e capacidade pela equipe: sem decisão.
- Expiração da meia-noite do SGI parada desde 06/10: já com o Caio, não
  cobrar.

## 5. Como retomar

Mensagem sugerida: "Leia Docs/handoff-agenda-paineis-2026-10-22.md. Quero
revisar os cards do Trello da Agenda e depois gravar os painéis de semana."

RODADA DE 22/10, 11h50 (sem commit, capturas paineis9-tv945-*.png):
- Horas dos painéis de semana por extenso: `formatSummaryHours`
  ("495h27min", "672h", "42min"); o calendário segue curto ("97h30").
  Cabe no notebook: "1612h48min" usa 90 de 94 px do quadrinho.
- Barra de rolagem com tudo visível: era o respiro de 40 px embaixo do
  `main` (DashboardLayout, pb-10). Navegador maximizado numa TV de 1080 dá
  ~1920x945 de área útil; o rodapé terminava a 3 px da borda e o respiro
  sobrava 37 px. Correção só nesta página: `main:has(.os-schedule) {
  padding-bottom: 0 }` em styles.css, no padrão do `main:has(.page-sticky-
  header)`. Medido: 1080 e 945 sem barra; 930 rola 12 px (aí o rodapé
  fica mesmo de fora); notebook 1280x800 rola 173 px, como antes.
- "1 OS sem turno": pergunta do Mário, respondida com dado, SEM mudança:
  21/09 a 04/11, 8 OS sem turno em 3.592 (0,2%), todas Instalação /
  Ativação Remota, Concluída, sem técnico, só em dias passados.
  Recomendação levada: tirar da célula do dia e da nota do painel; elas
  seguem na lista do dia inteiro. Aguardando "confere".
Suíte: 2.374 ok, só DefinePassword; lint e build ok.

22/10, fim da manhã: o Mário NÃO gostou do "min" no fim ("ficou
estranho"). Voltou o formato curto do portal nos painéis ("475h46",
"672h"; abaixo de 1 h segue "42min", padrão da coluna SLA).
`formatSummaryHours` apagado. Barra de rolagem continua resolvida (945
sem barra). "OS sem turno" segue aguardando o "confere" dele.

22/10, 13h40: "OS sem turno" RESOLVIDO ("confere" do Mário): saiu da célula
do dia (DaySub, selo e dica de hoje) e da nota do painel; campo
`DayCell.withoutPeriod` apagado. Continua na janela do dia inteiro (lista
e nota da janela, `uncountedNote`). Captura paineis11-tv945-claro.png.
Suíte: 2.374 ok, só DefinePassword; lint e build ok. Próximo passo: o
Mário aprovar e gravar (passo a passo dele), 10 arquivos: 9 da Agenda e
src/styles.css.

22/10, 13h50: Mário encerrou ("concluímos") e vai gravar ele mesmo. Develop
sem mudança (origin/develop = c1aee3f = base da branch). Conferência final
do diff limpa (sem travessão, console, TODO ou arquivo solto). Passo a
passo entregue: git status, git add src/Pages/Schedule src/styles.css,
git status, git commit -m "feat(os): paineis de semana da agenda", git log
--oneline -1, git push -u origin feat/os-agenda-paineis-semana, pedido de
junção pelo link em Docs/links-mr-agenda-paineis.txt (revisor Caio).
Depois: conferir com git status e git log. Cards do Trello da Agenda
ainda pendentes.

22/10, tarde: o Mário GRAVOU e ENVIOU ele mesmo: commit 051cb86
"feat(os): paineis de semana da agenda" (10 arquivos, sem coautoria),
branch em dia com origin. Pedido de junção para a develop com o texto do
chat (revisor Caio). Card do Trello desta task escrito no chat.
Pendente: revisão dos dois cards do Trello de 21/10 da Agenda.

22/10: MERGE APROVADO pelo Caio. develop = fd047a6 "0.1.33 [version]",
com o merge 03683a7 do 051cb86. Próximo: Mário atualizar a develop local
(passo a passo dado) e decidir a próxima tarefa; revisar os 2 cards do
Trello de 21/10 da Agenda.

22/10, fim: o Mário disse "tudo feito": develop local atualizada e os dois
cards do Trello de 21/10 revisados por ele. Nada pendente desta etapa.
Pendências antigas da Agenda continuam: Excel das listas sem saída e
chegada (pergunta aberta) e agenda por tipo de OS (sem decisão).

## 6. 22/10 à tarde: agenda por tipo de OS (proposta, sem decisão)

Pedido do Mário: filtro por tipo de OS e "próxima agenda disponível para
cada tipo", construindo junto. Medição em produção (leitura, 14h24), script
e resultado em Docs/historico/capacidade/proxima-agenda-por-categoria-
2026-10-22.{py,txt}: a grade do SGI decide por CATEGORIA (74 vivas, 62 com
OS), e dentro do mesmo tipo a próxima data varia (Instalação de Câmeras:
1 câmera hoje, 2 a 6 câmeras só sáb 24/10). O serviço só calcula as
categorias com OS no dia (`com_os` em build_day): para a próxima data é
preciso calcular todas.

Proposta levada: terceiro painel "Próxima agenda disponível" ao lado dos
painéis de semana (mesma altura, TV sem rolar), uma linha por tipo (mais
cedo em que alguma categoria cabe, "N de M categorias", "demais até",
"K sem técnico apto"), clique abre janela de lista com as categorias do
tipo; filtro "Tipo de OS" na faixa, que reduz o painel e a aba Categorias
da janela; calendário continua geral. Decisões pendentes: regra da linha
do tipo e se o filtro muda o calendário. Branch sugerida
feat/os-agenda-tipo-de-os nos dois repositórios (ele cria). Memória:
agenda-por-tipo-de-os-proposta-2026-10-22.

22/10, 15h20: "confere" do Mário nas duas recomendações e IMPLEMENTADO, sem
commit, nas branches feat/os-agenda-tipo-de-os (criadas por ele; portal
sobre fd047a6 0.1.33, serviço sobre 9c6075c 0.0.66).
- Serviço (3 arquivos): os_schedule.py ganhou RawCategory.deleted,
  _day_load, CategoryScope/category_scope/category_period (extraídos de
  build_day, mesma conta), period_cutoff, weekend_closed e
  build_availability (próxima agenda de cada categoria viva, de hoje ao
  fim da janela); schemas OsScheduleNextSlot e OsScheduleCategoryAvailability,
  campo `availability` na resposta (lista vazia por padrão). 56 testes ok.
  O uvicorn do PyCharm roda com --reload: já serve o campo novo.
- Portal (14 arquivos, 3 novos): osScheduleSource lê `availability`
  (vazia no serviço antigo); scheduleModel: whenLabel, slotLabel,
  buildAvailability (linha por tipo: mais cedo + "N de M categorias" +
  "demais até" + "sem técnico apto" + "sem data até dd/mm"; dica com as
  categorias por data) e filtro de tipo em buildShiftDetail/buildDayLines/
  buildAgendaDialog; Schedule.tsx: campo "Tipo de OS" na faixa (só quando o
  serviço manda a lista), painel NextAvailabilityPanel (3 colunas de
  quadrinhos, nome em cima e turno embaixo; com filtro, as categorias do
  tipo e o resumo embaixo do título), janela ScheduleAvailabilityDialog
  (ListDialog + ListTable, abre recortada pelo tipo clicado, Excel);
  scheduleAvailabilityModel (colunas e planilha); janela do turno com a
  nota "Só as categorias de X, pelo filtro Tipo de OS da página" e a lista
  de OS aberta com o recorte da coluna Tipo; esqueleto com a 3ª coluna.
- Validação: lint ok; suíte 2.392 ok, só DefinePassword (antiga); tsc e
  build ok. Visto com o serviço real: TV 1920x1080 cabe sem rolar (main
  933/933; os painéis de semana foram de 180 para 195 px porque a 3ª
  coluna de 540 px faz "Capacidade restante" quebrar em 2 linhas, como no
  notebook); notebook 1280x800 rola 379 px (antes 173); com filtro de tipo
  o painel cresce (13 categorias = 308 px) e a TV rola 105 px. Capturas
  proxima-agenda1..5 em Docs/historico/capacidade (claro, escuro, notebook,
  janela das categorias, filtro + janela do turno). Medição em produção
  às 14h24: proxima-agenda-por-categoria-2026-10-22.{py,txt}.
- Decisões minhas a confirmar com ele: quadrinhos 3x3 em vez de linhas
  (a linha cortava "Manutenção de Câmeras" na TV); dia da semana em
  minúscula no quadrinho ("sáb 24/10 · Tarde", como "hoje"/"amanhã");
  Ativação Remota aparece como "Sem técnico apto" (0 aptos no cadastro).
- Revisor de convenções: sem bloqueio (observações: cópia de
  compareNumbers/filtersText já existente no padrão; String() nas colunas
  numéricas é o padrão da ListTable; plural inútil removido). Revisor de
  dados: em andamento.
- Próximo: Mário ver na tela (F5), aprovar; depois o passo a passo de
  commit nos dois repositórios ("feat(os): proxima agenda por tipo de OS")
  e pedidos de junção para a develop, revisor Caio, serviço e portal
  juntos (o portal sem o serviço novo só esconde o painel).

22/10, 15h45: revisor de dados passou com 3 ajustes, APLICADOS: (1) "OS
marcadas" agora vem do serviço (`scheduled_ahead` em availability), de hoje
ao fim da janela e com as OS sem turno (a soma no portal perdia a Ativação
Remota e os dias antes da janela quando a seta avançava); (2) a ordem da
lista desempata tipo fora do catálogo pelo nome do tipo; (3) testes novos
nos dois lados (SLA nulo, infra sem apto, hora nula, OS marcadas, tipo
estranho, empate de turno, tipo só sem apto). Observações dele sem mudança,
para o Mário decidir: turno com rota travada entra em "Turnos cheios antes"
(a trava zera os aptos); e o calendário não aplica o fim de semana
desligado da config do SGI (hoje ligado; lacuna anterior). Serviço 61
testes ok; portal lint, tsc e build ok, suíte 2.392 ok com 2 falhas
alheias (DefinePassword, antiga; overviewModel do Comercial por tempo sob
carga, passa sozinho).

22/10, 15h55: o Mário NÃO gostou da terceira coluna de quadrinhos e trouxe
uma prévia do Codex: FAIXA larga embaixo dos painéis de semana. "CONFERE"
dele com dois ajustes meus (a data em destaque, que a prévia não tinha, e
os 9 tipos lado a lado quando não há filtro) e "por ora eu aceito rolar"
na TV. Implementado (`NextAvailabilityStrip` + `TypeSummary` em
Schedule.tsx, `summary` no TypeAvailabilityRow do modelo, esqueleto):
- sem filtro: título, os tipos em linha (nome em cima, turno embaixo, cada
  um com a largura do próprio nome; quebram linha na tela estreita), "Ver
  categorias" à direita (ação de texto do portal, abre a janela inteira);
  clique no tipo abre a janela recortada por ele.
- com filtro: "PRÓXIMA AGENDA DISPONÍVEL · TIPO", a data em destaque
  (18 px; vermelho quando "Sem data até dd/mm"), "3 de 13 categorias" com
  "demais até sáb 24/10 (Tarde)" embaixo, "1 sem técnico apto" / "N sem
  data" em vermelho com ícone de alerta, "Ver categorias".
- os painéis de semana voltaram à largura e altura de antes (179 px,
  "Capacidade restante" numa linha). Faixa 62 px (54 com filtro).
- Medido com o serviço real em 1920x945 (TV maximizada): rola 73 px sem
  filtro (aceito), 180 px com a faixa de filtros expandida. Capturas
  proxima-agenda7-tv945-faixa.png e proxima-agenda8-tv945-faixa-filtro
  (claro e escuro).
- Nome mantido "Próxima agenda disponível" (a prévia dizia "Próxima
  disponibilidade"; ele não escolheu). Ícone de calendário da prévia não
  entrou. Lint, tsc, build ok; suíte 2.393 ok (só DefinePassword).
  Revisores rodaram na versão anterior (quadrinhos); a faixa só trocou a
  apresentação e separou o resumo em partes no modelo.
Próximo: ele aprovar; passo a passo de commit nos dois repositórios.

22/10, 16h10: o Mário perguntou se o filtro devia ser por categoria.
Resposta: os dois servem (tipo para o gestor, categoria para quem marca e é
a unidade da grade do SGI); recomendado manter Tipo e acrescentar Categoria.
Calendário por categoria explicado com dado real
(Docs/historico/capacidade/calendario-por-categoria-exemplo-2026-10-22.
{py,txt}: Instalação de 2 Câmeras cheia sex 23/10 com 76h livres no geral)
e deixado para TASK SEPARADA (serviço calcular a categoria em todos os
dias; card do turno em OS; decisões: fim de semana que o SGI oferece,
painéis de semana). "confere" só para o campo Categoria nesta branch.
IMPLEMENTADO, sem commit, NÃO visto na tela (ele não entrou no navegador
de teste):
- campo "Categoria" (SearchSelectField, "Todas") depois de Tipo de OS;
  opções do tipo escolhido ou todas, por nome; chip "Categoria: X"; Limpar
  filtros zera; trocar o tipo solta categoria de outro tipo (no clique, e
  derivado no desenho: categoria fora do tipo ou fora da leitura não vale).
- faixa com categoria (vence o tipo): data em destaque, "Cabe mais N", "4
  técnicos aptos · 1h20 cada · 64 OS marcadas"; dica com o tipo e os turnos
  cheios antes; "Ver categorias" abre a lista no tipo da categoria.
- janela do turno/dia: só a categoria, aviso "Só a categoria X, pelo
  filtro Categoria da página", lista de OS recortada pela coluna Categoria;
  categoria (ou tipo) sem OS no dia diz isso em vez de "a grade oferece".
- modelo: CategoryChoice e passesFilters; buildShiftDetail, buildDayLines,
  buildAgendaDialog com `choice`. Lint, tsc, build ok; suíte 2.397 ok, só
  DefinePassword.

22/10, 16h20: tirado o nome "AGENDA" do grupo da faixa de filtros (pedido do Mário com print). FilterGroup compartilhado ganhou `legendHidden` (nome só para leitor de tela, sem o espaço); as outras faixas não mudam. Teste no FilterPanel.test.tsx. Não visto na tela por mim.

22/10, 16h40: pedidos do Mário, feitos, sem commit, NÃO vistos na tela real
(o login do navegador de teste não foi feito):
- FAIXA "Próxima agenda disponível" RETIRADA ("não é necessária"): saiu da
  página e do esqueleto. Os filtros Tipo de OS e Categoria ficam e recortam
  a janela do turno/dia; o calendário segue geral.
- Ficaram SEM USO, aguardando autorização para apagar (não apago arquivo
  sem pedido): ScheduleAvailabilityDialog.tsx (+ .test.tsx) e
  scheduleAvailabilityModel.ts (janela "Ver categorias"); no modelo, as
  linhas por tipo (headline/summary/tooltip de buildAvailability); no
  serviço, o cálculo da próxima agenda (`next`, full_before etc.), que hoje
  só serve para a lista de categorias dos filtros.
- Campo Categoria abria e fechava: causa PROVADA no Chromium (página
  mínima): `popover="auto"` fecha no fim do clique, e o campo abre a lista
  no foco (botão do mouse descendo). SearchSelectField passou a
  `popover="manual"` (fecha no blur, Esc e escolha). Só a Agenda usa esse
  campo hoje.
- Setinha do campo com a mãozinha (`cursor-pointer`), como o seletor comum.
- Suíte 2.398 ok (só DefinePassword), lint, tsc e build ok.

22/10, 17h: DESTAQUE DA PRÓXIMA VAGA no calendário ("CONFERE" do Mário),
implementado, sem commit, visto com o serviço real (proxima-vaga1-tv-claro,
-tv-escuro, -notebook-claro e proxima-vaga2-tv-sem-apto.png):
- com a categoria escolhida: turno da vaga com a borda do "Hoje" e selo
  "Próxima vaga · cabe N" sobre a borda (só "Próxima vaga" abaixo de 1536
  px); tarja vermelha de 3 px no topo dos turnos abertos antes da vaga
  (sem vaga: todos os abertos); nada depois da vaga; passado, feriado e
  turno de hoje fechado sem marca; linha acima do calendário com a vaga por
  extenso e o que a tarja quer dizer; fora da tela, "Ir para a semana"
  (não anda sozinho). Modelo: buildCategoryHighlight, shiftKey,
  CategoryMark; calendário: ShiftButton com `data-category-mark`.
- apagados com autorização: ScheduleAvailabilityDialog.tsx (+ teste) e
  scheduleAvailabilityModel.ts; saíram do modelo o resumo por tipo e os
  campos sem uso da categoria (ficam id, nome, tipo, alwaysAvailable,
  status, next).
- revisores: dados achou o domingo sem OS (vaga no domingo, que o
  calendário mostra "Sem agenda": a frase culpava o filtro Turno). Corrigido
  com placement 'empty-day' e frase própria; testes novos (domingo, feriado
  futuro, calendário avançado, vaga sem SLA, sem vaga com marcas).
  Convenções: frases e comentários que ainda falavam da faixa, corrigidos.
- DECISÃO ABERTA para o Mário: domingo com vaga aparece só na frase (o
  card segue "Sem agenda"); sábado depois das 16h a vaga de quase tudo é o
  domingo, porque a config do SGI libera o fim de semana. Mostrar o domingo
  com a vaga? Também: no turno de hoje ainda aberto a tarja pode ser mais
  rígida que o SGI (o calendário conta as concluídas de hoje).
- Suíte 2.401 ok (só DefinePassword), lint, tsc e build ok.

22/10, fim da tarde: CALENDÁRIO POR CATEGORIA (pedido do Mário: "qnd eu
filtrasse a categoria ou o tipo de OS a capacidade se adequasse, assim como
seu percentual... dá falsa sensação"; domingo fica como está "enquanto não
temos escala"). Implementado, sem commit, NÃO visto na tela (ele não entrou
no navegador de teste); revisores interrompidos pelo fim da sessão.
- Serviço: rota GET /bi/os/calendar/schedule/category?category_id=&date_from=
  &date_to= (build_category_calendar, category_fits, _window); schemas
  OsScheduleCategoryInfo/CalendarPeriod/CalendarDay/CalendarResponse. 69
  testes ok. Rota no ar no uvicorn do PyCharm (sem login: 401). Conferido
  com produção (Docs/historico/capacidade/calendario-categoria-servico-
  2026-10-22.py): 2 câmeras, sex 23/10 cheia (99%/94% de 12h48 dos 4
  aptos) onde o geral dizia 42%/25%.
- Portal: fetchOsScheduleCategory + parseOsScheduleCategory,
  useOsScheduleCategory (releitura 5 min), toCategoryShift no modelo
  (capacidade dos aptos, % deles, "cabe mais N" ou "Cheio" pela regra do
  SGI, "Sem técnico apto", infra "SGI não limita"), cabeçalho do dia com os
  aptos, painéis de semana somando os turnos da categoria; cinza enquanto
  carrega, painel de erro na falha. A TARJA vermelha saiu (o card já diz
  "Cheio"); fica o selo "Próxima vaga". Só o tipo: calendário geral com a
  nota "o SGI não tem capacidade por tipo de OS. Escolha uma categoria".
- Suíte 2.408 ok (só DefinePassword), lint, tsc, build ok.
- PENDENTE: decisão do Mário sobre o tipo de OS (contar "cabe em N de M
  categorias" por turno, ou manter a nota); revisores; ele ver na tela.
