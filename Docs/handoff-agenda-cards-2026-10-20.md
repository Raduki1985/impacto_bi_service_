# Passagem: Agenda e capacidade, cards dos turnos (20/10/2026)

Arquivo local, fora do Git (Docs está em .git/info/exclude). Ler por
inteiro antes de qualquer ação. Só o que está valendo; o histórico antigo
da página está em Docs/handoff-agenda-capacidade-2026-10-19.md.

## 1. Onde o trabalho está

- Portal, branch `feat/os-agenda-capacidade-2` (criada pelo Mário a partir
  da `feat/os-agenda-capacidade`). As branches `feat/os-agenda-capacidade`
  dos dois repositórios estão CONGELADAS enquanto o Caio revisa os pedidos
  de merge !31 (serviço) e !66 (portal). O pedido da -2 só se abre depois
  que os dois forem mesclados.
- Mudanças de 20/10 na -2, SEM commit, ainda não vistas pelo Mário na tela
  com o serviço real (lint, testes e build ok; só a falha antiga de
  DefinePassword.test.tsx):
  - nome do dia e linha dos técnicos centralizados no cartão do dia;
  - volta no tempo: setas "Semana anterior" / "Hoje" / "Semana seguinte"
    na faixa de filtros, até 8 semanas antes da semana de hoje
    (`MAX_PAST_WEEKS`), nunca além da semana de hoje; chip "Semanas: x a y"
    e Limpar filtros voltam para hoje; troca de semanas mostra só os
    resumos e o calendário em cinza; falha mostra aviso no lugar do
    calendário; voltar para hoje reabre o primeiro turno de amanhã.
  - Arquivos: src/Pages/Schedule/{Schedule.tsx, ScheduleCalendar.tsx,
    ScheduleSkeleton.tsx, scheduleModel.ts, useOsSchedule.ts} e os testes.
  - Serviço: nada mudou, ele já aceita qualquer janela de até 45 dias.

## 2. Card dos turnos: IMPLEMENTADO em 20/10, sem commit, falta ver na tela

Referência visual: Docs/historico/capacidade/preview-cards-v10-*.png,
bloco "Pedido: porcentagem dentro da barra" (prévias v7 a v10, geradas
por gera_preview_v9.cjs e gera_preview_v10.cjs a partir da v8).

O que o Mário aprovou, nesta ordem, e está no código:
- Topo do dia: "SEG 19/10 · [ícone] 29"; hoje "HOJE 20/10" no acento, sem
  selo. Segunda linha em todo dia (alinha a semana): hoje "● Agora: 32
  disponíveis" (ponto só pulsa quando a última leitura chegou); outros
  dias "Feriado" e "N sem turno". Hoje, feriado e sem turno ficam só na
  dica do mouse.
- Turno: nome e "cap. 124h48"; barra de 18 px da v7 com a OCUPAÇÃO dentro
  ("78%", aprovado na rodada 10; abaixo de 100% arredonda para baixo);
  sem capacidade, a barra escreve as horas marcadas.
  Parte vazia da barra sem fundo, só o contorno da borda (rodada 11,
  preview-cards-v11-*): o cinza do realizado sumia no trilho cinza.
- Resposta embaixo, centralizada, sem pílula ("mistura", rodada 9):
  "53h48 livres" (número 13,5 px na cor do estado, "livres" cinza),
  "só 5h48 livres" (âmbar), "excedeu 7h12" e "Cheio" (vermelho), turno
  sem OS "92h48 livres" em cinza, "Sem técnico previsto" quando a
  capacidade do turno é 0, "Fechado às 11h", "Feriado", "Realizado".
- Dica do turno: "97h30 marcadas de 124h48 de capacidade (78%)"; no Cheio
  pela OS média, "Sobram 42min, menos que uma OS média (2h23)".
- Detalhe: "1h20 cada" em destaque em todas as linhas de categoria.
- Palavra "livres": o Sumário do SGI escreve "Restam"; escolhida mesmo
  assim (linguagem de quem agenda, cabe no notebook; "para agendar"
  corta).

Revisores (20/10) tratados: dica do "nobody" e capacidade 0, OS média sem
"do turno", porcentagem para baixo, ocupação do serviço na dica, leitor de
tela sem leitura dupla, altura fixa da linha do turno, comentários velhos.

PENDENTE com o Mário:
- Resumo da semana ainda diz "N turnos em que ainda cabe, N quase cheios,
  N cheios", palavras que o card não usa mais; turno sem OS fica fora da
  contagem.
- "Sem técnico previsto" deve cortar no notebook (uns 95 px por turno na
  largura mínima): encurtar para "Sem técnico"?
- Hoje, "N sem turno" só na dica do mouse: aceitar?
- Vermelho em texto pequeno: 4,19 no claro, 3,7 com o turno aberto
  (passa o 3,0 da skill, abaixo de 4,5).

## 3. Descartado ou adiado

- Botão "Atualizar": descartado.
- Linha com a conta do SGI no detalhe do turno: adiada ("pensar depois").
  O Mário entendeu a diferença: o SGI devolve as horas quando a OS é
  concluída, conta os 42 técnicos do cadastro e o Sumário ignora a hora
  do dia.
- Barra azul, barra de cor cheia, barra cinza, porcentagem fora da barra:
  recusadas.

## 4. Ideia do Mário, sem detalhe

Janelas centrais (padrão das janelas de lista do portal) abrindo ao clicar
no dia ou no turno, no lugar do detalhe que hoje abre embaixo do
calendário. Detalhar com ele antes de implementar.

## 4b. Régua do SGI e Disponível (20/10, fim da tarde), sem commit

- Caio mesclou !31 (serviço 0.0.61) e !66 (portal 0.1.27) na develop.
- Decisão do Mário: capacidade pela régua do SGI, ativos do cadastro x
  3h12 por turno, rota fechada descontada. OS contadas do nosso jeito
  (hoje o dia inteiro; o SGI devolve as concluídas). Portal lê
  `scheduler` no lugar de `operation`; textos "técnicos ativos no
  cadastro do SGI".
- Dias passados: ativos daquele dia pela data de criação e de exclusão
  (opção B, `active_on` no serviço). Inativação não tem data: segue o
  cadastro atual, aviso na dica. Medido: 37 em 24/08, 42 desde 05/10.
- "Agora: N disponíveis" na regra do SGI: online (aplicativo 5 min e
  localização 10 min) e botão ligado. Em 20/10: 42 ativos, 36 botão,
  33 online, 31 disponíveis.
- Serviço: branch feat/os-agenda-regua-sgi (de origin/develop), sem
  commit; 37 testes da agenda ok. O PyCharm do Mário roda essa pasta.
- Portal: -2 sem commit; precisa trazer a develop (0.1.27) antes do
  pedido de merge.
- Pendências do banco em Docs/Pendências do Banco (README + 2 arquivos).

## 4c. Trava de rota e selo do dia (20/10, noite), sem commit

- O gestor de OS cadastra "feriado" no SGI para TRAVAR a rota (chuva,
  barramento) e depois exclui; a equipe trabalha no que já estava marcado.
- Serviço: dias passados NÃO descontam rota travada (B); de hoje em diante
  segue o SGI (A). Cada dia traz `closures` (nome, grupo, equipes) (C).
  06/10 voltou a 42. 39 testes ok.
- Portal: selo âmbar na segunda linha do dia (no dia de hoje, no pé do
  card): cadeado + equipe ("Terceirizada"), cadeado + nome cadastrado
  ("Chuva intensa rota fechada"), feriado do calendário sem cadeado
  ("Feriado · Aparecida"). Turno de dia fechado diz "Fechado". Prévia
  aprovada: preview-cards-v12-* (opção 1).
- Pendência: Docs/Pendências do Banco/2026-10-20-rota-fechada-terceirizada-em-06-10.md
  (trava sem ano se repete todo ano; excluída some do histórico).

## 4d. Enviado em 20/10/2026

Portal: 47ef67e e merge da develop (0790e6c), MR !67. Serviço: fd48f46, MR !32.
Os dois para a develop, com descrição, assign caioherrera. Aguardando o Caio.

## 4e. Branch nova para os resumos de semana (20/10, noite)

feat/os-agenda-resumo-semana, criada sobre a -2 (0790e6c = develop 0.1.27
+ !67), porque a develop ainda não tem o card novo: !67 e !32 seguem
abertos. Quando !67 entrar, esta branch mostra só a diferença dos
resumos. Objetivo: os dois painéis "Esta semana" e "Próxima semana"
(buildWeekSummary e WeekSummaryPanel), que ainda dizem "N turnos em que
ainda cabe, N quase cheios, N cheios", palavras que o card não usa mais.
Ele viu a página com o serviço real em 20/10 à noite (print: 42 ativos,
"Agora: 18 disponíveis", 134h24 por turno). Sem commit.

## 5. Próximo passo

1. Mário confere na tela (F5 em http://localhost:5173/dashboard/os/agenda-capacidade,
   serviço na 8787) o card novo e a volta de 8 semanas, nos dois temas.
2. Responder as pendências do item 2.
3. Commit na -2 só quando ele pedir; pedido de merge só depois de !31 e !66.

## 6. Lições desta sessão

- Quando o Mário manda um print, reabrir a imagem e copiar o que está nela
  antes de propor. Em 20/10 a barra foi errada duas vezes por leitura
  apressada.
- Prévias: HTML em Docs/historico/capacidade usando o CSS do build
  (`/dist/assets/...`), servido com `py -m http.server 8765` na raiz do
  repositório e fotografado pelo Playwright em 142 px por dia (notebook)
  e 221 px (monitor), nos dois temas.
