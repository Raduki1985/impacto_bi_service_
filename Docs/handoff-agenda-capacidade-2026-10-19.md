# Passagem de contexto: Agenda e capacidade de OS (19/10/2026)

## 0. ESTADO NO FIM DE 19/10/2026 (ler primeiro)

ENVIADO. Pedidos de merge abertos para a develop, sem descrição nem
revisor (o push cria o pedido vazio; não há glab na máquina):
- serviço !31 https://gitlab.com/impacto-business/impacto-bi-service/-/merge_requests/31
  branch feat/os-agenda-capacidade: commit único 70d9e20 "feat(os): agenda
  e capacidade" (rascunho + redesenho juntados) + merge da develop 0.0.60
  (e6094b3, correção dos motivos da tabela reasons). 36 testes da agenda
  passam; em tests/test_bi_os.py 2 falhas antigas de nome camelCase, que
  também falham na develop pura.
- portal !66 https://gitlab.com/impacto-business/impacto-bi-web/-/merge_requests/66
  commit único 6b0ebb0 + merge da develop 0.1.26 (53ff5fc). Lint, build ok;
  2.301 testes, só a falha antiga de DefinePassword.
- Ordem de mesclagem: serviço !31 ANTES do portal !66 (o portal lê a rota
  e o campo `technicians` novos).

Últimas mudanças antes do envio (19/10, noite):
- TÉCNICOS POR TURNO (serviço): passado conta quem trabalhou em cada
  turno; futuro usa a mediana do mesmo dia da semana TURNO A TURNO
  (`historico_turno`, `_present_in_period`, `_day_gauge`, parâmetro
  `period_presence` de `build_day`); hoje segue com o número do dia nos
  dois turnos (o "disponível" do app não diz turno). Capacidade do dia =
  soma dos turnos. Produção: sábado tarde 7 técnicos (22h24) em vez de 25
  (80h); dia útil tarde 23 a 27 contra manhã 28 a 30.
- Selo "DADOS SIMULADOS" fora do cabeçalho (AppHeader REAL_SOURCE_PAGES),
  legenda das pílulas retirada.

DECIDIDO EM 20/10/2026: as branches feat/os-agenda-capacidade (portal e
serviço) ficam CONGELADAS enquanto o Caio revisa !31 e !66: nada de
commit nem push nelas. O trabalho continua na branch
feat/os-agenda-capacidade-2, que o próprio Mário cria a partir da
feat/os-agenda-capacidade (no portal; no serviço só se a mudança
precisar). O pedido de merge da -2 só se abre depois que !31 e !66 forem
mesclados, para levar apenas as mudanças novas.

Pendentes para amanhã:
- Mário colar a descrição e escolher o revisor nos dois pedidos.
- Filtro por equipe: decisão dele entre (a) só hoje, (b) por território,
  (c) por tipo de serviço (recomendado agora). Ver "Sexta rodada".
- Três pontos do serviço para o Caio (item 5).
- Ele ainda não viu a página com o serviço real depois das últimas
  mudanças (reiniciar o serviço no PyCharm).

Arquivo local, fora do Git (Docs está em .git/info/exclude). Ler por
inteiro ao retomar, antes de qualquer ação. Estado real está no Git e no
código; este arquivo diz onde olhar e o que já foi decidido.

## 1. Em uma frase

A página "Agenda e capacidade" (Ordens de Serviço) foi RECONSTRUÍDA em
19/10/2026 como calendário de duas semanas (expansível a quatro), direto
para quem agenda (Tatiane e atendimento), sobre o mock que o Mário
aprovou em rumo. GRAVADA em 19/10 à noite, a pedido dele, "só para salvar
o progresso", SEM push: portal ccf3db2 "feat(os): agenda e capacidade em
calendário" sobre o rascunho a2a0381; serviço 27e67e8 "feat(os): cadastro
de aptidões por técnico na agenda" sobre o rascunho 842dc44. Validada por
lint, testes e build e conferida em prévia estática nos dois temas; ainda
NÃO foi vista pelo Mário na tela com o serviço real.

## 2. Onde está cada coisa

Portal `impacto-bi-web`, branch `feat/os-agenda-capacidade` (local, NÃO
enviada), um commit a2a0381 "feat(os): página agenda e capacidade
(rascunho, só local)" sobre a 0.1.24:
Estado em 19/10/2026 à noite, já no commit ccf3db2 (árvore limpa):
- `src/data/api/osScheduleSource.ts` (+ .test.ts): lê a rota do serviço;
  `fetchOsSchedule` ganhou a janela `date_from`/`date_to`
  (`scheduleQueryParams`).
- `src/Pages/Schedule/useOsSchedule.ts`: leitura a cada 5 min, mantém a
  última boa; recebe a janela e relê quando ela muda.
- `src/Pages/Schedule/scheduleModel.ts`: REESCRITO. Janela
  (`scheduleWindow`: uma semana antes da semana de hoje até uma semana
  depois da 4ª, 42 dias, para o hoje do navegador e o do serviço poderem
  divergir um dia; "Ver 4 semanas" só revela), estado do turno
  (`shiftState`: past, closed = feriado mesmo com OS, cutoff = turno de
  hoje já fechado pela `limitHour` do SGI contra a hora de `generatedAt`,
  free, nobody = OS com zero técnico previsto, unknown, ok, attention,
  over; limiares `OCCUPATION_ATTENTION` 0,85 e `OCCUPATION_FULL` 1, com
  100% exato já cheio), pílula (`shiftPill`: "Cabe mais X h", "Quase cheio
  · sobram X h" ou "sem sobra", "Cheio · passou X h" ou "sem sobra",
  "Fechado às 11h", "Sem técnico previsto", "Feriado", "Livre", "Sem
  estimativa", "Realizado"), grade (`buildCalendar`), resumo da semana
  (`buildWeekSummary`: "N turnos em que ainda cabe, N quase cheios, N
  cheios", OS sem turno à parte), detalhe (`buildShiftDetail`,
  `fitsInShift` com a tolerância do serviço, `ALWAYS_ACCEPTED_TYPES` por
  rótulo do catálogo), rodapé (`buildRegistryRows`). `formatHours` usa
  espaço inseparável antes do h (escrito como ` `: o caractere
  literal reprova no lint).
- `src/Pages/Schedule/Schedule.tsx`: REESCRITO. Faixa "Agenda por turno"
  (SectionHeading, ação "Ver 4 semanas" / "Ver 2 semanas"), dois painéis
  de resumo, legenda, calendário, detalhe e rodapé fechado com a tabela
  do cadastro de aptidões (abre ao clicar).
- `src/Pages/Schedule/ScheduleCalendar.tsx`: NOVO. Grade de 7 colunas,
  célula do dia (hoje com acento, feriado, N técnicos com a origem na
  dica de mouse), botão por turno (OS, barra, pílula, horas, "SGI recusa
  N categorias"), `TonePill`.
- `src/Pages/Schedule/ScheduleShiftDetail.tsx`: NOVO. Painel do turno:
  recusadas, cabe por categoria, "Sempre cabe" (infra e auditoria); dia
  passado lista o realizado.
- `src/Pages/Schedule/ScheduleSkeleton.tsx` (+ .test): REESCRITO, espelha
  o calendário; exporta as classes de grade que a página usa.
- `src/Pages/Schedule/scheduleFixture.testing.ts`: agenda sintética de 4
  semanas (hoje sexta 16/10/2026) cobrindo cada estado de turno.
- `scheduleModel.test.ts`, `Schedule.render.test.tsx`: REESCRITOS.
- `src/Pages/Schedule/scheduleChartOptions.ts` (+ .test.ts): APAGADOS.
- `src/App.tsx`, `src/Pages/Dashboard/pageConfig.ts`: sem mudança; a
  página ocupa o item `calendar` de OS (chave de acesso mantida, menu
  `os.calendar`), título "Agenda e capacidade", endereço
  `/dashboard/os/agenda-capacidade`, o antigo `/dashboard/os/calendario`
  redireciona.
- `src/styles.css`: bloco `.os-schedule` com `--schedule-accent` (azul do
  portal no claro, #34d372 no escuro), `--schedule-ok` (#00844d / #34d399),
  `--schedule-attention` (#b45309 / #f5a623) e `--schedule-over` (#e5384e /
  #ff4d6a), todos pares já medidos no portal; cinza é `--text-secondary`.
- `src/Pages/OperationalCalendar/` APAGADA em 19/10 (a página Calendário
  antiga, de dados mockados; nada a importava), com a autorização dele de
  tirar o que é mock ou legado desta página. Volta com
  `git checkout -- src/Pages/OperationalCalendar` se ele mudar de ideia.
- Prévia visual estática, sem login: `Docs/historico/capacidade/
  preview-calendario.html` mais `preview-calendario-claro.png` e
  `-escuro.png`, geradas em 19/10 sobre a fixture e o CSS compilado do
  build. Para regenerar: teste temporário que renderiza `ScheduleContent`
  com `makeScheduleFixture()` via `renderToStaticMarkup` e grava o HTML
  apontando para `/dist/assets/<css do build>`; abrir em
  http://localhost:5173/Docs/historico/capacidade/preview-calendario.html
  e trocar `data-theme` do `<html>` para `dark`.

Serviço `impacto-bi-service`, branch `feat/os-agenda-capacidade` (local,
NÃO enviada), um commit 842dc44 "feat(os): agenda e capacidade (rascunho,
só local)" sobre a 0.0.58:
- `app/services/bi/os_schedule.py`, schemas `OsSchedule*` em
  `app/schemas/bi_os.py`, rota `GET /bi/os/calendar/schedule` em
  `app/api/v1/bi_os.py`, `tests/test_bi_os_schedule.py` (33 testes).
  FICA TUDO: o calendário usa os mesmos números. Janela padrão hoje-7 a
  hoje+6, aceita até 45 dias, histórico de 28 dias antes de hoje.

A develop dos dois repositórios andou depois das branches: portal 0.1.26,
serviço 0.0.59. Antes do pedido de merge, trazer a develop para dentro de
cada branch (merge) e juntar o commit de rascunho com o redesenho num
commit só por repositório (os rascunhos nunca foram enviados, é seguro).
Só com pedido do Mário.

## 3. O que o serviço calcula (não reinventar)

Reproduz a memória de cálculo do SGI (`SCHEDULING_SUMMARY.md`, cópia em
`Docs/historico/capacidade/SCHEDULING_SUMMARY-sgi-2026-10-14.md`):
capacidade por turno = técnicos x 4 h x 0,8 (chaves lidas da tabela
`config` do SGI), consumo = horas previstas (SLA da categoria) das OS que
ocupam agenda, ocupação sem teto. Duas réguas: `scheduler` (42 técnicos
ativos do cadastro, o que o SGI enxerga) e `operation` (técnicos
presentes: no passado quem executou, hoje designados ou disponíveis no
app, futuro mediana do mesmo dia da semana em 4 semanas). Por categoria,
a grade do SGI: capacidade só dos aptos, consumo compartilhado, `full`
quando mais uma OS não cabe; infra e auditoria nunca `full`. Passado conta
só o realizado; hoje conta feito + a fazer; futuro só status ativo.
`registry`: aptidão cadastrada x quem executou em 28 dias.

## 4. O redesenho aprovado em rumo (19/10/2026)

Mock pronto e visto pelo Mário: `Docs/historico/capacidade/
mock-agenda-calendario.html` (gerado por `gera_mock_calendario.py` a
partir de `agenda-mock-dados.json`, números reais), imagens
`mock-agenda-calendario-claro.png` e `-escuro.png`. Abrir pelo portal
local: http://localhost:5173/Docs/historico/capacidade/mock-agenda-calendario.html

Desenho:
- cabeçalho de seção com a ação "Ver 4 semanas" (abre sempre com 2
  semanas; 4 só ao clicar, sem guardar);
- duas frases de resumo (esta semana e a próxima) em palavras;
- legenda com as pílulas do portal, cada estado com nome: Cabe, Quase
  cheio, Cheio, Sem estimativa, Realizado;
- calendário segunda a sábado com domingo pequeno, duas semanas, cada dia
  com Manhã e Tarde: OS marcadas em número grande, barra fina de
  preenchimento, pílula com a resposta ("Cabe mais 59,8 h" / "Quase cheio
  · sobram 5,0 h" / "Cheio · passou 6,0 h" / "Livre" / "Sem estimativa"),
  horas em letra pequena ("36,2 h de 96,0 h"), e "SGI recusa N categorias"
  quando houver; hoje com borda do acento e pílula HOJE; dia passado
  apagado com pílula Realizado; feriado marcado;
- clique num turno abre embaixo o detalhe: "O que o SGI já recusa" (cheias,
  com aptos e OS) e "O que ainda cabe, por categoria" ("Cabe mais 15 Fibra
  Instalação, 1,5 h cada": sobra da categoria dividida pelo SLA dela);
- rodapé fechado: "Cadastro de aptidões a corrigir no SGI: N categorias";
- saem os quatro cards, o gráfico de barras e a tabela grande.

Decisões do Mário: número principal do turno em HORAS (não em OS, porque
cada categoria tem o seu tempo); OS só no detalhe, por categoria; duas
semanas com expansão para quatro; pílulas com a identidade do portal.

Respostas do Mário (19/10, fim da tarde), já aplicadas:
- "SGI recusa N categorias" na célula: RETIRADO (ele mandou tirar e eu
  concordei: o número é ruidoso, 23 de 30 hoje, quase todo por cadastro de
  aptidão incompleto, e o detalhe lista as categorias pelo nome).
  `refusedCategoriesIn` e `ShiftCell.refusedCategories` saíram do modelo.
- turno sem OS "Livre": cinza, confirmado.
- cor da pílula e da barra por estado, sempre com a palavra: confirmado
  "por ora".
- limiares 85% e 100% (`OCCUPATION_ATTENTION` e `OCCUPATION_FULL` em
  scheduleModel.ts: abaixo de 85% cabe, de 85% a menos de 100% quase
  cheio, 100% ou mais cheio): explicados a ele; o 85% segue provisório
  até ele escolher outro número ou tirar a faixa "quase cheio" depois de
  ver dados reais.
- "Fechado às 11h" / "Fechado às 16h" e "Sem técnico previsto": ok por ora.
- "folha em branco": ele autorizou tirar o que é mock ou legado desta
  página. Saiu a frase fixa da próxima semana ("a agenda enche de 1 a 3
  dias antes..."), medida em 14/10 e que envelheceria; saiu a pasta
  `src/Pages/OperationalCalendar` (ver item 2). Nome "Agenda e
  capacidade" no cabeçalho e "Agenda por turno" na faixa ficaram.
- tabela do cadastro de aptidões no rodapé: ele não sabia o que era;
  explicada, fica como está até ele decidir.
- os três pontos do serviço (item 5) vão ao Caio depois.

Segunda rodada (19/10, fim do dia):
- Células com altura fixa, FEITO: cabeçalho do dia em duas linhas fixas
  (dia + Hoje/Feriado; técnicos + "N OS sem turno"), turno com espaço
  fixo para pílula de duas linhas e para a linha de horas, grade com
  mínimo de 980 px (abaixo disso rola para o lado). Medido na prévia a
  1366 px: os 26 turnos com 111 px, nenhuma linha de horas cortada.
- EM DISCUSSÃO, nada implementado: (a) "Cheio quando não cabe mais OS"
  em vez de só em 100%. Proposta levada: cheio quando a sobra do turno é
  menor que a OS média do turno (horas marcadas / OS marcadas), número
  tirado do dado e não inventado; turno com poucas OS usaria a média do
  dia. Não usar a grade do SGI por categoria para isso (pessimista,
  marcaria cheio demais). (b) Rodapé do cadastro achado "cru": proposta
  de janela padrão do portal (ListDialog) com uma linha por categoria,
  "1 de 8 cadastrados, faltam 7", ordem por volume de OS, nomes de quem
  executa sem aptidão (exige o serviço mandar os nomes, hoje só manda a
  contagem) e Excel. Pergunta em aberto: quem corrige o cadastro no SGI.

Terceira rodada (19/10, noite):
- Mário: quem corrige o cadastro de aptidões são os GESTORES dos técnicos.
  Logo a lista útil é por técnico e equipe, para mandar a cada gestor;
  exige o serviço mandar nomes e equipe (hoje só contagem). Não feito.
- FEITO: faixa de filtros no padrão da Visão Geral (PageStickyHeader +
  FilterPanel "Filtros da agenda"): atalhos "2 semanas" / "4 semanas" no
  lugar do "Ver 4 semanas" (abre em 2, não guarda) e campo Turno (Todos,
  Manhã, Tarde), com chip e Limpar. O filtro de turno vale para o
  calendário e para as horas do resumo. Equipe e tipo de serviço ficaram
  de fora: o serviço não manda capacidade por equipe ou tipo, e filtrar só
  as horas marcadas contra a capacidade de todos mostraria folga falsa.
- FEITO: número grande do turno em HORAS ("97,5 h"), com a legenda
  embaixo da pílula ("marcadas de 124,8 h" / "realizadas de 89,6 h" /
  "marcadas" sem estimativa). OS só no detalhe por categoria. Resumo da
  semana também em horas ("674,0 h realizadas até ontem · 228,5 h
  marcadas..."). Cabeçalho do dia: "Feriado · 28 técnicos · 1 sem turno"
  na segunda linha (a pílula Feriado não cabia ao lado da data).
- Medido a 1366 px: dia com 137 px, nada fora da célula, turnos todos com
  111 px. Suíte: 2.293 ok, só a falha antiga de DefinePassword.
- Regra "Cheio pela OS média" explicada de novo ao Mário, aguardando OK
  (e o N de OS médias para "quase cheio", se ele trocar o 85%).

Quarta rodada (19/10, noite), respostas do Mário: "Cheio pela OS média"
ele ainda não decidiu e pediu minha opinião (dada: recomendo adotar);
cadastro de aptidões: autorizou mudar o serviço; horas sem decimal.
- FEITO no SERVIÇO (branch feat/os-agenda-capacidade, sem commit): cada
  linha do `registry` ganhou `technicians` (id, name, teams pelo nome,
  active, orders) com quem executou a categoria sem a aptidão, do que mais
  executou ao que menos (desempate nome e id). Nova consulta `_PEOPLE_SQL`
  (auth.users + team_users, só os ids das OS lidas, inclui quem já saiu
  como inativo) e `RawPerson`/`people` no `ScheduleBatch`; schema
  `OsScheduleRegistryTechnician`. 34 testes do serviço passam (3 rodadas,
  depois de corrigir um empate de ordem). Conferido na produção, só
  leitura: 50 categorias a corrigir, 164 pares categoria x técnico, 39
  técnicos (38 ativos), todos com nome, 11 ativos sem equipe cadastrada.
- FEITO no PORTAL: horas em relógio ("97h30", "40min", "0h") pelo
  `formatClockMinutes`, que saiu de todayOsTableModel para lib/formatters
  (a lista de OS continua importando de onde importava). O rodapé abre a
  janela de lista do portal (`ScheduleRegistryDialog` +
  `scheduleRegistryModel`): uma linha por técnico e categoria, colunas
  Técnico, Equipe, Categoria, Tipo, OS sem aptidão, Situação, Aptos no
  cadastro, filtro por coluna, busca e Baixar Excel
  (cadastro-aptidoes-sgi-AAAA-MM-DD.xlsx, aba Aptidoes + aba Filtros).
  Rodapé: "Cadastro de aptidões a corrigir no SGI: N categorias e N
  técnicos". A fonte aceita resposta sem `technicians` (lista vazia).
- Suíte do portal: 2.297 ok, 1 falha antiga; lint e build ok.
- Pendente: o pedido de merge do serviço agora leva esta mudança (antes
  o serviço não mudava no redesenho).

Quinta rodada (19/10, noite): "CHEIO PELA OS MÉDIA" ADOTADO pelo Mário e
implementado (scheduleModel.ts): `averageOrderHours` = horas marcadas /
OS marcadas do turno, ou do dia inteiro quando o turno tem menos de
`AVERAGE_MIN_ORDERS` (5) OS; `occupationState(ocupação, sobra, OS média)`
devolve cheio quando a ocupação chega a 100% OU a sobra é menor que uma
OS média; pílula "Cheio · sobram 42min" nesse caso (e "passou X" / "sem
sobra" como antes). Quase cheio segue de 85% até aí. Commits locais sem
push: portal ccf3db2, serviço 27e67e8. Suíte 2.300 ok, 1 falha antiga.

Sexta rodada (19/10, noite), "cara de produto final", SEM commit ainda
(entra na junção do passo 2):
- Selo "DADOS SIMULADOS" saiu do cabeçalho: `calendar` entrou em
  REAL_SOURCE_PAGES (AppHeader.tsx), com teste.
- Legenda das pílulas retirada (pedido do Mário), da página e do
  esqueleto.
- FILTRO POR EQUIPE: pedido do Mário, NÃO feito, decisão dele. Medido na
  produção em 19/10 (só leitura): das OS ativas de amanhã a +13 dias, 13
  de 149 têm técnico (20/10: 5 de 79); hoje 45 de 47. A OS não guarda
  equipe, a equipe vem do técnico, e o SGI só designa técnico no dia
  (distribuição automática). Logo o futuro não tem equipe. Técnicos
  ativos: 37 em uma equipe, 5 sem equipe, nenhum em duas. Caminhos
  levados a ele: (a) equipe só em hoje; (b) equipe pelo território (OS
  tem lat/lng, SGI tem territories e technician_territories), etapa
  maior, precisa definir território = equipe; (c) filtro por tipo de
  serviço, que a OS futura tem (categoria), contra a capacidade dos aptos.
- Arquivos de análise: Temp/agenda-checagem/equipe_futuro.py (fora do
  repositório).

Fora desta versão (carga horária não existe no SGI, feature futura):
escala de 8 h, horas além da escala, limite de 2 h extras.

## 5. Como rodar na máquina do Mário

- Serviço: ele roda pelo PyCharm (uvicorn --port 8787 --reload, só
  127.0.0.1). O `.env` do serviço saiu do Git na 0.0.59; o local foi
  recriado por mim em 16/10 (sem a chave órfã SET_PASSWORD_TOKEN_EXPIRE,
  com o SGI de produção em leitura). Mudou o .env: reiniciar no PyCharm.
  Nunca dois serviços na 8787.
- Portal: `npm run dev` (5173), `.env.local` aponta para localhost:8787.
  Trocou de branch: F5 no navegador.
- Testes do serviço: NUNCA rodar dois pytest ao mesmo tempo (test.db
  compartilhado). Falhas pré-existentes na branch: 33 (env.local ausente,
  nomes camelCase antigos) e dois módulos test_bi_commercial*.py que não
  coletam (IndentationError, commit a58407b). No portal,
  DefinePassword.test.tsx falha desde 3f6fdbe ("1 dia" x "10 minutos").
- Revisores (`revisor-convencoes`, `revisor-dados`, `revisor-graficos`)
  rodaram de novo no redesenho em 19/10 e os achados foram tratados na
  mesma sessão: feriado com OS e turno de hoje fechado não respondem
  "cabe"; 100% é cheio; zero técnico é "Sem técnico previsto"; janela de
  42 dias; concordância com 1 técnico; "Rota fechada" em maiúscula;
  "só instalação de câmeras marca"; "N turnos em que ainda cabe" (mesma
  palavra da legenda); ` ` em vez do caractere literal (bloqueava o
  lint); vazio em `text-secondary`; pílula em 11,5 px como o chip do
  portal; ação da faixa com `py-0.5`; esqueleto nas alturas reais com 28
  turnos contados; `title` nos nomes truncados do cadastro; comentário
  explicando a tabela própria do cadastro; "Sem estimativa" no lugar de
  "Sem conta". Ficaram como observação (decisão de produto): tabela do
  cadastro poderia ser `ListTable` (filtro e Excel); título da faixa
  "Agenda por turno" em vez de "Agenda e capacidade" do mock.
- Para o Mário levar ao Caio (serviço, fora do escopo do redesenho):
  (1) a régua da operação (`operation`) não desconta a equipe com rota
  fechada, só a régua do agendamento desconta (os_schedule.py, presença
  típica alimenta `operation` sem o desconto); (2) `categories` só traz
  as categorias com OS no dia, então "SGI recusa N categorias" não vê
  categoria sem OS que a grade também recusa (a legenda avisa; mudar
  seria devolver todas); (3) infra e auditoria chegam só pelo rótulo do
  tipo, uma flag na resposta tiraria o acoplamento com o catálogo.
- Validação de 19/10 após a reconstrução: `npm run lint` limpo; `npm test`
  2.281 passam, 1 falha (DefinePassword, antiga), 1 pulado; `npm run
  build` ok (aviso de tamanho conhecido). A tela com o serviço real exige
  login do Mário no navegador (o Playwright não guarda sessão).
- Ferramenta: o terminal da sessão corta comandos acima de ~10 mil
  caracteres (heredoc grande falha com "unexpected EOF"); arquivo grande
  vai pela ferramenta de escrita. `sed` com ` ` no texto de troca
  perde a barra; troca de texto com escape vai por script Node.

## 6. Coisas resolvidas que NÃO devem ser refeitas

- Ambientes do portal: o site de testes chamava o serviço de produção.
  Resolvido na develop em 16/10 (713a916 .env.staging para business-dev;
  Caio 8c8614c, Dockerfile com `bun --no-env-file`). business-dev 0.1.26
  já embute business-dev. A branch da agenda é anterior e não tem isso:
  vem com o merge da develop.
- `audit_logs` do SGI expõe hash de senha e CPF ao usuário bi_web: levado
  ao Caio nas perguntas de 14/10 (sem resposta registrada).
- Mensagens para a Tatiane e para o Caio (ver a memória
  `capacidade-de-os-por-turno`): sem resposta registrada até 19/10.

## 7. Próximo passo

1. Mário abre http://localhost:5173/dashboard/os/agenda-capacidade com o
   serviço rodando (F5 depois de trocar de branch) e confere: duas
   semanas a partir da segunda-feira desta semana, hoje marcado, o
   detalhe aberto no primeiro turno de amanhã, "Ver 4 semanas", o rodapé
   abrindo a tabela do cadastro, e o tema escuro.
2. Pendências respondidas em 19/10 (item 4). Falta só ele decidir o
   número do limiar de "quase cheio" (85% provisório) depois de ver dados
   reais, e levar os três pontos do serviço ao Caio (item 5). Esta etapa
   pode começar em chat novo: tudo o que importa está neste arquivo e na
   memória `capacidade-de-os-por-turno`.
3. Commits já gravados (portal ccf3db2 e serviço 27e67e8, sem push). Com
   o pedido dele: trazer a develop para cada branch (portal 0.1.26, serviço
   0.0.59), juntar rascunho e redesenho num commit só por repositório (os
   dois são locais, é seguro), push e pedidos de merge, serviço antes do
   portal (o portal lê o campo `technicians` novo; sem o serviço no ar, a
   lista do cadastro abre vazia, sem erro).
