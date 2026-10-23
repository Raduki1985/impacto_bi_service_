# Passagem: Agenda e capacidade, janelas no clique (21/10/2026)

Arquivo local, fora do Git (Docs está em .git/info/exclude). Ler por
inteiro antes de qualquer ação. O histórico da página está em
Docs/handoff-agenda-cards-2026-10-20.md e na memória
`capacidade-de-os-por-turno`.

## 0. ATUALIZAÇÃO, 21/10/2026 à tarde: janelas IMPLEMENTADAS e ENVIADAS

COMMITS (pedido do Mário, mensagem curta, sem coautoria): serviço 2b9b3cc
"feat(os): lista de OS do turno na agenda", portal ff5d35a "feat(os):
janela da agenda no clique do turno e do dia", ambos sobre a develop de
21/10 (serviço 0.0.63, portal 0.1.28). Branches feat/os-agenda-janelas
enviadas ao GitLab. Pedidos de junção NÃO abertos por mim: o Mário abre e
envia ao Caio pelos links pré-preenchidos em Docs/links-mr-agenda-janelas.txt.


Branch feat/os-agenda-janelas nos dois repositórios, criada de origin/develop
(portal 0.1.28, serviço 0.0.63), sem upstream, SEM commit. O PyCharm do
Mário roda a pasta do serviço: ela está nesta branch, que não tem a saída e
chegada nem os tipos de câmera (estão nos pedidos !36/!71 e no fix).

Decisões: as cinco recomendações valeram (card do Trello aceito pelo Mário e
"SIGAMOS AO TRABALHO"): categorias + lista, nome do dia abre o dia inteiro,
nada abre sozinho, colunas da agenda de hoje (TODAY_COLUMNS), consulta nova
no serviço.

Serviço: GET /bi/os/calendar/schedule/records?day=&period= (os_schedule.py:
schedule_records, query_day_period_keys, OsScheduleService.records/_load_day;
schema OsScheduleRecordsResponse). Lê as OS pela leitura da Visão Geral
(OsOverviewService.records(day, day)) e filtra com consumes; o turno pela
CHAVE crua (consulta própria), igual ao calendário (revisor-dados). 46 testes
da agenda ok; 4 falhas antigas em test_bi_os.py e test_bi_os_overview.py já
existem na develop (camelCase x snake_case).

Portal: ScheduleAgendaDialog.tsx (novo), buildAgendaDialog, buildDayLines e
agendaTitle no scheduleModel, ScheduleShiftDetail.tsx agora exporta
AgendaCategories (nome mantido), fetchOsScheduleList em osOverviewSource.ts
(lê kind e avisa se o dia virou), calendário com aria-haspopup, painel de
baixo e "primeiro turno de amanhã" removidos. Lint ok, 2.331 testes (só
DefinePassword falha, antiga), build ok. Visto com o serviço real em 21/10:
a lista fecha com o calendário no futuro, hoje, passado e dia inteiro
(prints Docs/historico/capacidade/janela-01 a janela-10).

Pendente: Mário ver na tela; commit e pedidos de junção quando ele pedir.
Depois que !71 entrar, passar o dia de hoje ao toPeriodOsRow da janela
(terceiro argumento), para o Detalhe não escrever a data em toda etapa.
Respostas do Mário (21/10, fim da tarde): (1) lista e Excel ficam, link para
a Visão Geral recusado (sem filtro de turno, número não fecha); (2) turno
fechado (hoje depois da hora limite, ou dia fechado no cadastro de feriados)
mostra "Fechado" em toda categoria, título "O SGI não agenda mais neste
turno/dia"; (3) "Sempre cabe" virou "SGI não limita" (infra e auditoria, que
a grade do SGI nunca recusa; não é OS sem SLA, essa é "Sem estimativa").
Implementado e visto na tela (janela-11 a janela-15). 2.332 testes, só
DefinePassword falha, antiga.

Abas (21/10, fim da tarde, pedido do Mário): a janela tem duas abas,
"Categorias N" (abre primeiro, sempre) e "OS N"; a escolhida fica ao trocar
de turno; reabrir volta para Categorias. Peça NOVA do portal,
src/components/ui/PanelTabs.tsx (aprovada por ele: "nossa versão para o
portal sem remeter ao perfil de acesso"), só tokens globais, gancho escuro
.impacto-tabs em styles.css; o ModalTabs do Perfil de Acesso não foi tocado.
Skill modelo-de-pagina (local) ganhou a seção Abas. Visto na tela
(janela-16 a janela-18). 2.337 testes, só DefinePassword falha.

## 1. Estado dos repositórios no fim de 21/10/2026

Nada sem commit nos dois. Portal e serviço estão na branch
`feat/os-saida-e-chegada` (já enviada). A develop do servidor está em
portal 0.1.28 e serviço 0.0.63.

Pedidos de junção abertos para a develop, todos com o Mário de autor e o
Caio de revisor. O GitLab estava com problema para aceitar merge (Caio).

| Assunto | Serviço | Portal | Sobe junto com |
|---|---|---|---|
| Tipos de câmera como no SGI | fix/os-tipos-de-camera (3df0ab1) | fix/os-tipos-de-camera (0c67675) | o par |
| Lista na rosca de tipos | nada | feat/os-rosca-tipo-lista (53963e7) | depois do fix do portal |
| Saída e chegada no Detalhe | feat/os-saida-e-chegada (ac5fd74), !36 | feat/os-saida-e-chegada (1501ffb), !71 | o par |

Testado em cópia: os três juntos encaixam sem conflito, checagem de tipos
limpa e testes passando. As descrições dos pedidos !36 e !71 foram
reescritas pelo Mário no formato "## O que muda / ## Depende de /
## Testes" (texto no chat de 21/10).

## 2. Próximo trabalho: janelas no clique da Agenda (A DECIDIR)

Pedido do Mário em 21/10: as janelas que abrem ao clicar na agenda do dia
devem seguir o comportamento padrão do portal (janela de lista no centro
da tela, `ListDialog`, skill `modelo-de-pagina`). Branch nova a partir da
develop; os pedidos abertos não mexem em src/Pages/Schedule.

Hoje: clique no turno abre, embaixo do calendário, o `ScheduleShiftDetail`
(categorias: o que o SGI recusa e quanto cabe). Clique no nome do dia não
faz nada. A página já tem uma janela, `ScheduleRegistryDialog` (cadastro
de aptidões).

Proposta levada a ele (sem resposta ainda):
- clique no turno abre a janela; clique no nome do dia abre o dia inteiro;
- topo: "Agenda de qua 22/10 · Manhã", capacidade e horas livres, atalhos
  "Dia inteiro", "Manhã", "Tarde";
- bloco 1: as categorias, como o painel atual;
- bloco 2: lista das OS do turno (OS, tipo, categoria, técnico, cidade,
  status, SLA), filtro por coluna e Baixar Excel;
- o número da lista fecha com o do card: dia passado conta só realizadas
  (regra `consumes` do serviço em os_schedule.py);
- o painel de baixo do calendário sai.

Decisões pendentes:
1. Janela com categorias + lista de OS (recomendado) ou só a lista?
2. Clique no nome do dia abre o dia inteiro? (recomendado: sim)

Fonte das OS a investigar: `/bi/os/overview/period/records` com `panel=day`
serve para qualquer data, inclusive futura; turno e a regra de contagem do
card teriam que ser aplicados no portal, ou ganhar um painel próprio no
serviço. Conferir antes de decidir.

## 3. Outros pendentes

- 2 painéis do topo da Agenda ("Esta semana", "Próxima semana"): proposta
  levada em 21/10, sem resposta. Problemas: palavras diferentes do card
  ("ainda cabe" x "livres"), turno sem OS fora da contagem, falta o total
  de horas livres. Proposta: "410h livres de hoje em diante", "8 turnos
  livres · 2 com pouca folga · 1 cheio", realizadas e marcadas embaixo.
  Branch `feat/os-agenda-resumo-semana` existe local, igual à develop.
- Planilha Excel das listas de OS sem colunas de saída e chegada: pergunta
  em aberto ao Mário.
- Agenda por tipo de OS e capacidade pela equipe que trabalha: rumo
  conversado (tipos do SGI como estão, capacidade por quem executou cada
  tipo, mediana de 4 semanas), sem decisão.

## 4. Fatos novos de 21/10 que valem para a Agenda

- Princípio do Mário: o BI reflete o que o usuário do SGI cadastra. Nada
  de agrupamento próprio de tipos.
- O SGI tem 9 tipos de OS; os de câmera no plural. Em 21/10 a Tatiane
  levou as 9 categorias de manutenção de câmera para "Manutenção de
  Câmeras", e o SGI reescreveu o tipo das 355 OS, inclusive as antigas.
- Os devs recusaram gravar data de ativação/inativação do técnico: o
  caminho é a escala no SGI.
- Técnico é designado em média 42 min antes do turno: equipe da OS futura
  não existe; por tipo ou categoria, sim.
- Banco do SGI de produção recusou conexões ("too many clients") às 12h25
  de 21/10; às 12h49 voltou com 85 de 100 em uso. Mário avisado.
- Expiração da meia-noite do SGI parada desde 06/10: o Mário já falou com
  o Caio, sem card. Não cobrar de novo.

## 5. Como retomar

Mensagem sugerida para o novo chat: "Leia Docs/handoff-agenda-janelas-2026-10-21.md
e vamos planejar as janelas no clique da Agenda e capacidade."
