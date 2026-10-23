# Estudo: página de agenda e capacidade de OS

Data: 14/10/2026 (quarta-feira), medições no SGI de produção em leitura,
entre 13h30 e 14h30. Estado: estudo e proposta. Nada implementado, nenhuma
régua aprovada. Consultas nos arquivos `q1` a `q7` desta pasta.

Pedido do Mário: uma página para os gestores verem o que está agendado e a
capacidade que existe, prevenir sobrecarga e entender a demanda. Origem:
Tatiane (09 e 13/10) quer saber quantas OS cabem por turno e por dia para
não agendar além da capacidade.

## 1. O que o SGI já tem e ninguém usava

- `technician_capacities` (348 linhas): quais CATEGORIAS cada técnico sabe
  fazer, com nível (`intermediate`). Não é capacidade em horas. Incompleto:
  Leonardo Cesar Neto, Anselmo Pinheiro e José Wellington (equipe Câmeras)
  estão sem nenhuma categoria.
- `territories` (10 ativos, polígono no mapa: Atibaia, Imperial + Maracanã,
  Bom Jesus dos Perdões, Caetetuba + Usina, Lucas, Alvinópolis, Terra Preta +
  Mairiporã, Tanque, Piracaia, Portão + Rosario, Joanópolis) e
  `technician_territories` (159 vínculos, com prioridade). Toda OS tem
  lat/lng (3.232 de 3.232 nos últimos 42 dias), então dá para colocar cada
  OS num território por SQL.
- `auth.users.is_available`: 35 técnicos disponíveis hoje (Terceirizada 10,
  Suporte Técnico 8, Câmeras 7, Infra 5, Suporte Lógico 2, sem equipe 3) e 8
  indisponíveis. Não é escala diária: é uma chave liga/desliga.
- `holiday` e `holiday_date`: feriados e também "ROTA FECHADA", "barramento",
  "CHUVA INTENSA ROTA FECHADA", por dia e opcionalmente por equipe
  (`team_ids`). Ou seja, o SGI já bloqueia agenda por dia e por equipe.
- Não existe: horas úteis por turno, escala ou folga por dia, limite de OS
  por dia ou por território, horário dentro do turno.
- Nos motivos de reagendamento aparecem "quebra de agenda" (14 vezes desde
  21/09) e "sem data disponível no sistema / no agendamento" (10 vezes).
  Então o SGI já recusa data em alguma situação. Perguntar ao Caio qual é a
  regra: se ela existe, o BI espelha, não inventa.

## 2. Fatos medidos

### Agenda futura (14/10, 14h)

| Dia            | OS  | Manhã | Tarde | Com técnico | Horas previstas |
|----------------|-----|-------|-------|-------------|-----------------|
| Hoje qua 14/10 | 106 | 40    | 66    | 90          | 137,7           |
| Qui 15/10      | 52  | 30    | 22    | 7           | 58,2            |
| Sex 16/10      | 36  | 22    | 14    | 3           | 41,7            |
| Sáb 17/10      | 27  | 27    | 0     | 5           | 31,4            |
| Semana seguinte| 13  |       |       | 4           | 20,0            |

Horas previstas = soma do SLA da categoria (horas de serviço no cliente).

A agenda enche na véspera. Das 106 OS de hoje, 28 nasceram hoje, 72 ontem,
17 anteontem. Em dia útil típico, a agenda do dia D tem, em média, 38% do
total na véspera às 10h, 51% às 14h, 64% às 17h, 73% às 20h e 78% às 8h do
próprio dia. Consequência direta para a página: ocupação de amanhã vista
hoje é parcial, e a tela precisa dizer isso.

Antecedência por tipo (OS criadas desde 21/09): manutenção e instalação,
26 a 30% no mesmo dia, 42 a 45% na véspera, p90 de 3 dias; mudança p50 1
dia, p90 4; câmeras p50 5 dias, p90 9; infra 78% no mesmo dia.

### Carga por dia (OS de cliente, sem infra, desde 21/09)

| Dia da semana | OS/dia | Manhã | Tarde | Técnicos em campo |
|---------------|--------|-------|-------|-------------------|
| Segunda       | 107    | 55    | 52    | 22                |
| Terça         | 126    | 61    | 65    | 26                |
| Quarta        | 127    | 61    | 66    | 27                |
| Quinta        | 137    | 67    | 70    | 27                |
| Sexta         | 121    | 61    | 60    | 27                |
| Sábado        | 88     | 70    | 18    | 23                |
| Domingo       | 22     | 15    | 7     | 4                 |

Antes de 21/09 eram cerca de 60 OS por dia com 16 a 17 técnicos; a
manutenção entrou no SGI em 21/09 e dobrou o volume. Demanda por semana
(OS criadas): 838, 832 e 856 nas três semanas cheias, cerca de 410
manutenção, 170 instalação, 90 câmeras, 68 mudança, 80 infra. Estável.

### Técnico-dia (427 técnico-dias úteis desde 21/09)

| Medida                                   | Valor                 |
|------------------------------------------|-----------------------|
| OS por técnico por dia                   | média 4,5, mediana 4, p90 7, máx 11 |
| Horas previstas (SLA) por técnico-dia    | média 5,7 h, p90 9 h  |
| Serviço real no cliente                  | 3,8 h                 |
| Deslocamento real                        | 1,9 h                 |
| Ocupado real (serviço + deslocamento)    | 5,7 h                 |
| Jornada (1º deslocamento ao último fim)  | mediana 9 h, p90 11,5 h |
| Início do dia                            | 08:00 (p10), 08:33 (mediana) |
| Fim do dia                               | 17:24 (mediana), 19:45 (p90) |

Achado que simplifica a régua: as horas previstas pela categoria (SLA)
empatam, na média, com o tempo ocupado real incluindo deslocamento (5,7 h
contra 5,7 h). O SLA superestima o serviço e esquece o deslocamento, e os
dois erros se cancelam. Logo "horas previstas" serve como unidade de carga
sem somar deslocamento à parte.

Por equipe (OS por técnico-dia, horas previstas por técnico-dia):
Terceirizada 3,9 e 6,3 h; Suporte Técnico 4,9 e 5,7 h; Câmeras 4,7 e
5,6 h; Suporte Lógico 6,9 e 4,8 h.

Distribuição de OS por técnico-dia: 1 OS 27, 2 OS 38, 3 OS 65, 4 OS 92,
5 OS 88, 6 OS 54, 7 OS 28, 8 OS 16, 9 OS 11, 10 OS 7, 11 OS 1.

### Turnos no relógio

| Turno marcado | Início do serviço p10 | mediana | p90   | Fora do turno |
|---------------|-----------------------|---------|-------|---------------|
| Manhã         | 08:47                 | 10:14   | 13:22 | 12,6% começam depois das 13h |
| Tarde         | 12:56                 | 15:46   | 18:07 | 11,6% começam depois das 18h |

"OS da manhã que só começou à tarde" varia por dia de 4% a 25% (30/09:
25%, 01/10: 18%, 06/10: 18%). É um sinal de turno estourado que já existe
no dado e não depende de régua nenhuma.

### Carga x resultado (dias úteis desde junho, OS de cliente)

| OS por técnico em campo | Dias | Concluída | Improdutiva | Não executada |
|-------------------------|------|-----------|-------------|---------------|
| menos de 4              | 48   | 82,6%     | 12,5%       | 4,9%          |
| 4 a 5                   | 42   | 81,1%     | 12,5%       | 6,3%          |
| 5 a 6                   | 7    | 79,0%     | 12,5%       | 8,3%          |

A não executada (expirada ou encerrada) sobe com a carga; a improdutiva
não muda. Ressalva: a faixa 5 a 6 é toda depois de 21/09, então mistura
carga com a mudança de regime. É indício, não prova.

### Exemplo de amanhã (15/10), por frente

| Tipo        | OS | Horas previstas | Técnicos aptos e disponíveis |
|-------------|----|-----------------|------------------------------|
| Manutenção  | 30 | 22,6            | 14                           |
| Câmeras     | 17 | 28,0            | 4 (7 na equipe Câmeras)      |
| Instalação  | 3  | 3,7             | 18                           |
| Mudança     | 2  | 4,0             | 11                           |

Câmeras: 28 h para 4 técnicos aptos dá 7 h cada já com a agenda pela
metade. Ou o cadastro de aptidão está incompleto (3 técnicos sem nada) ou
amanhã estoura. É exatamente o tipo de aviso que a página deve dar.

## 3. Proposta de página

Nome provisório: "Agenda e capacidade" (a aprovar). Lugar: item do grupo
Geral de Ordens de Serviço, no lugar de "Calendário", que hoje mostra dado
fictício. Público: gestão de OS (Tatiane), Central/COP que agenda,
diretoria. Horizonte padrão: hoje até +6 dias, a única página que olha
para a frente.

Perguntas, de cima para baixo:

1. Quanto está marcado para os próximos dias e quanto cabe?
2. Em qual dia, turno e equipe a agenda passa da capacidade?
3. A demanda está mudando? Qual tipo cresce e com que antecedência?
4. Onde agir: dia e turno estourado, frente sem técnico apto, OS
   reagendada por quebra de agenda.

Esqueleto (modelo-de-pagina):

- Faixa "Próximos dias": uma caixa por dia (hoje a +6), com OS marcadas,
  horas previstas e ocupação em % da capacidade, na cor da régua (verde,
  âmbar, vermelho); dentro, manhã e tarde. Aviso "a agenda de amanhã ainda
  enche: a esta hora, num dia típico, tem 51% do total". Clique abre a
  lista das OS do dia com turno, categoria, horas previstas, equipe, técnico
  (ou Sem técnico), reagendada.
- Cards (4): OS nos próximos 7 dias; Horas previstas nos próximos 7 dias;
  Ocupação prevista de amanhã (% com a capacidade na definição); Dias e
  turnos acima da capacidade (quantos, quais).
- Painel principal "Carga por dia e turno": barras empilhadas manhã e tarde
  em horas previstas, últimos 7 dias (realizado) e próximos 7 (marcado),
  com a linha da capacidade do dia. Responde "está bom ou ruim".
- Composição: "Por equipe" (mapa de calor dias x equipes com ocupação %),
  "Por território" (OS futuras por território x técnicos do território,
  etapa 2), "Demanda criada por dia e tipo" (4 semanas), "Antecedência do
  agendamento" (mesmo dia, véspera, 2 a 3 dias, 4 ou mais).
- Sinais históricos (últimos 14 dias): OS da manhã que começaram à tarde,
  reagendadas por quebra de agenda. Dizem se a sobrecarga já aconteceu.

## 4. Régua de capacidade: o que recomendo e o que falta decidir

Unidade: horas previstas (SLA), não contagem de OS. Uma OS de 4 câmeras
pesa 2,67 h e uma Verificar Conexão 0,67 h; contar OS esconde isso. A
evidência do item 2 mostra que o SLA já absorve o deslocamento na média.

Capacidade do dia e turno = técnicos disponíveis no dia x horas úteis do
turno x fator de segurança. Ocupação = horas previstas / capacidade.

Decisões pendentes (Mário com Tatiane; Caio para o SGI):

1. Horas úteis de cada turno. Evidência: manhã roda das 08:47 às 13:22,
   tarde das 12:56 às 18:07, jornada mediana de 9 h, ocupado 5,7 h. Ponto
   de partida sugerido para a Tatiane validar: manhã 4 h, tarde 4,5 h.
2. Fator de segurança (folga). Sugestão 85%, a validar.
3. Quem conta como disponível no dia: o `is_available` do SGI (35 hoje),
   ou a escala real com folga, que só a Tatiane tem. Alternativa sem
   cadastro: mediana de técnicos em campo no mesmo dia da semana nas
   últimas 4 semanas (22 a 27 em dia útil, 23 no sábado). Recomendo
   começar pela mediana histórica como régua e mostrar o `is_available`
   como referência, até existir escala no SGI.
4. "Rota" é equipe ou território? O SGI tem os dois. Recomendo equipe na
   etapa 1 (já chega ao portal) e território na etapa 2 (serviço calcula
   ponto dentro do polígono).
5. Infra fica fora da conta (técnicos próprios, 78% das OS criadas no dia).
6. Limiares de cor: sugestão até 85% verde, 85 a 100% âmbar, acima de 100%
   vermelho. Decisão do Mário.
7. Caio: como o SGI decide "sem data disponível" ao agendar? Existe limite
   por dia, turno ou território? Também: aptidões (`technician_capacities`)
   incompletas na equipe Câmeras.

## 5. O que depende do serviço (André / Caio)

Já chega ao portal pela rota de registros: OS futuras com data, turno,
tipo, categoria, horas previstas (SLA), equipe, técnico, status,
reagendamento. Com isso a etapa 1 (faixa, cards, carga por dia e turno,
por equipe, sinais históricos) sai no portal com régua histórica.

Faltam para a etapa 2:

- `created_at` da OS no registro (demanda por dia e antecedência).
- Território da OS, calculado no SQL pelo lat/lng dentro do polígono.
- Catálogo de técnicos com `is_available`, equipes e categorias aptas.
- Bloqueios de rota e feriados por dia e equipe (`holiday_date`).
- Parâmetros da régua (horas por turno, fator) em lugar configurável, para
  não ficar escrito no código do portal.

## 6. Complemento de 14/10/2026 à tarde, com as respostas do Mário

Mário informou: escala de 44 h semanais, 08h às 17h de segunda a sexta e
sábado 08h às 12h; nem sempre respeitada, a demanda manda e hora extra é
comum; técnicos trabalham de segunda a sábado e fazem domingo sob demanda;
infra fica para decidir junto; regra de "sem data disponível" desconhecida.

Medições complementares (`q8_disponivel_infra.py`):

- Fora da escala já realizado (OS de cliente desde 21/09): 25,8% das OS
  terminam fora da escala: 17,8% depois das 17h em dia útil, 5,2% sábado
  depois das 12h, 2,8% domingo.
- Reserva do dia (OS criadas no próprio dia): segunda 34% (47 h/dia), terça
  a sexta 21 a 25% (35 a 46 h/dia), sábado 19% (20 h), domingo 26%.
- `is_available`: os 35 ligados tiveram o cadastro alterado hoje; os 8
  desligados foram alterados hoje ou ontem e fizeram OS ontem (Kelvis: 14
  dias seguidos, desligado em 13/10). Parece a escala do dia, mantida
  diariamente. Confirmar com o Caio se é manual (folga) ou pelo app.
- Infra desde 21/09: 104 OS executadas, 71 pela equipe Infra (311 h), 23
  por Suporte Técnico (84 h), 8 por Terceirizada (16 h). Técnicos de
  cliente gastam cerca de 7 h por dia em infra.

Régua revisada: capacidade contratada = técnicos presentes x 8 h em dia
útil (4 h manhã, 4 h tarde), 4 h no sábado (só manhã), 0 no domingo.
Reserva do dia pela medição por dia da semana, não por fator fixo.
Sobrecarga = horas previstas acima da escala; mostrar como "horas além da
escala", não como erro, porque a empresa decide fazer hora extra.

## 7. Complemento de 14/10/2026, fim da tarde: o que o SGI guarda de agenda

Consultas `q9` a `q15`. Produção em leitura, homologação em leitura.

Parâmetros de agenda na tabela `config` do SGI (valores, não segredos):
`morning-period-start-time` = 8, `morning-period-scheduling-limit-time` =
11, `afternoon-period-start-time` = 13, `afternoon-period-scheduling-
limit-time` = 16, `service-order-auto-distribution-enabled` = true. Ou
seja: manhã começa 8h e aceita agendamento para o próprio dia até 11h;
tarde começa 13h e aceita até 16h; a distribuição automática de OS está
ligada. NÃO existe chave de limite de OS por dia, turno, equipe ou
território, e o maior volume já marcado num turno (90 de manhã, 87 à
tarde) não mostra teto. "Sem data disponível" no reagendamento é,
portanto, o corte de horário do mesmo dia ou juízo de quem agenda; a
confirmar com o Caio em uma linha.

`is_available` confirmado como o botão "pronto para receber OS" do app:
3.847 mudanças reais em 30 dias, 46 técnicos, 99,8% pelo próprio técnico,
2 a 8 vezes por dia, liga às 7h e 8h, desliga das 16h às 19h. Não é
escala. O primeiro "ligou" do dia serve como presença real do dia (hoje e
passado); para amanhã não existe nada.

Designação de técnico desde 21/09: 1.870 manuais com autor (87% no
próprio dia) e 576 automáticas sem autor; hora da designação concentra às
8h e às 14h (início de cada turno).

Limite legal de 2 h extras (dado do Mário): dias úteis, 19,7% dos
técnico-dias terminam o último serviço depois das 19h (92 de 468); sábado,
40% depois das 14h (28 de 70); além de 4 h extras: 16 técnico-dias úteis e
17 de sábado. Por dia útil, 4 a 9 técnicos passam das 19h.

Homologação (sgi-dev): `service_orders` ganhou `scheduled_window_start` e
`scheduled_window_end` (hora), ainda em teste (4 OS), então o agendamento
por janela de hora dentro do turno está vindo. A lista `reasons` de
reagendamento traz "Indisponibilidade de rota", "Quebra de agenda
técnica", "Sem data disponível no agendamento", "Sem horário disponível
no período solicitado" e "Encaixe na agenda". Tabelas de ponto
(`time_marks`, `time_mark_categories`) existem nas duas bases e estão
vazias: marcação de ponto com foto e localização está a caminho.

Segurança, levar ao Caio: `audit_logs` grava o cadastro inteiro do usuário
em `before` e `after`, inclusive o hash bcrypt da senha e o CPF, e o
usuário de leitura `bi_web` lê essa tabela. O arquivo de saída que capturou
esses trechos foi apagado; os scripts desta pasta só selecionam colunas
seguras.

Decisão do Mário em 14/10: hora extra até 2 h por dia (legislação). Régua
proposta: verde até a escala (8 h dia útil, 4 h sábado), âmbar até a
escala mais 2 h, vermelho acima; card "técnico-dias acima do limite
legal" no histórico.

## 8. Complemento de 14/10/2026, noite: a memória de cálculo do SGI

O Mário recebeu `SCHEDULING_SUMMARY.md` (cópia nesta pasta,
`SCHEDULING_SUMMARY-sgi-2026-10-14.md`), a memória de cálculo do resumo
de agendamento do SGI (`SchedulingService.get_summary`), que também
alimenta a grade de datas disponíveis (`get_available_dates`).

O modelo do SGI:

- capacidade por turno = técnicos ATIVOS (role technician, status active,
  todos, sem olhar presença) x duração do turno x eficiência; chaves em
  `config`: `schedule-period-duration-hours` = 4,
  `schedule-period-efficiency` = 0,8, logo 3,2 h por técnico por turno;
  `weekend-scheduling-enabled` = true; `max-so-for-scheduled-subscription`
  = 2;
- consumo = soma do SLA da categoria das OS em status ativo (scheduled,
  rescheduled, em andamento, pending_approval); concluída, encerrada,
  improdutiva e expirada liberam a agenda;
- ocupação = consumo / capacidade, com teto de 100%;
- por categoria C: capacidade só dos técnicos com aptidão em C
  (`technician_capacities`), consumo de TODAS as categorias que esses
  técnicos atendem (compartilhado, pessimista por desenho, §9.3 do
  documento); categoria sem OS não aparece; proficiência não entra;
- datas disponíveis: libera o dia e turno só se consumido + SLA da OS
  cabe na capacidade da categoria; feriado geral bloqueia o dia; feriado
  de equipe (rota fechada) tira os técnicos da equipe da capacidade;
  corte de 11h e 16h para o mesmo dia.

Replay do modelo sobre a agenda real (`q16`, `q17`), produção em leitura:

- 42 técnicos ativos, 39 com alguma aptidão, 32 disponíveis no momento.
- Ocupação geral do SGI nos últimos 15 dias úteis: manhã 55 a 93%, tarde
  49 a 80%, dia 54 a 79%. Refeita com os técnicos PRESENTES no dia (26 a
  31) e os mesmos 3,2 h por turno: 78 a 115%. Com a escala de 8 h e os
  presentes: 62 a 92%. Os dias acima de 100% na conta com presentes são
  os dias com 4 a 9 técnicos passando das 19h. Conclusão: a fórmula do
  SGI é boa, o que infla a capacidade é contar 42 quando trabalham 28.
- Por categoria: 48% dos dia-turno-categoria aparecem LOTADOS na conta do
  SGI (382 de 801). Verificar Conexão (5 aptos) lotada em 28 de 28,
  Readequação de Fibra (3 aptos) 26 de 26, Instalação de Segundo Ponto
  (4) 24 de 24, Configuração de Apps (2 aptos, 356% de ocupação média),
  Execução de CTO (0 aptos, nunca cabe). Se o cadastro de aptidões fosse
  completado com quem executou nos últimos 28 dias, os lotados SOBEM
  para 91%, porque o consumo compartilhado cresce junto: o modelo por
  categoria é estruturalmente pessimista e não serve de régua para o
  gestor; serve para mostrar o que o agendamento vai recusar.
- Cadastro de aptidões x execução real (28 dias): Fibra Instalação 12
  aptos, 16 executaram (4 sem aptidão); Câmera Offline 1 apto, 8
  executaram; Configuração de Câmeras 1 e 7; Instalação de Segundo Ponto
  4 e 11; Readequação de Fibra 3 e 10; Execução de CTO 0 e 4.
- Quem cria as OS desde 21/09: usuários internos 52%, vendedores 23%,
  administradores 18%, sem autor 7%; nenhuma criada por cliente pelo app.
  Então a grade de datas disponíveis governa o canal do cliente e a tela
  do atendente; falta saber se o interno pode marcar por cima.

Consequências para a página:

1. Decisões 1 e 2 fecham pelo SGI: turno de 4 h e eficiência 0,8 (nossa
   reserva do dia medida, 21 a 34%, bate com os 20% de folga do SGI). O
   BI lê os parâmetros da tabela `config`, nunca escreve no código.
2. Três camadas: "régua do agendamento" (o modelo do SGI espelhado, por
   dia, turno e categoria, mostrando o que o agendamento recusa); "régua
   da operação" (mesma fórmula com técnicos presentes, escala de 8 h e
   limite de 2 h extras); "qualidade do cadastro" (aptidões cadastradas x
   quem executa, categorias sem apto).
3. Rota: o modelo do SGI não tem equipe nem território; a equipe entra
   só no bloqueio de rota fechada. A pergunta à Tatiane continua.

## 9. Primeira versão implementada em 16/10/2026

Branch `feat/os-agenda-capacidade` nos dois repositórios (criadas pelo
Mário), sem commit. Decisão do Mário no mesmo dia: a carga horária dos
técnicos ainda não existe no SGI e virá numa feature futura, então a
escala de 8 h, as horas além da escala e o limite de 2 h extras ficaram
fora; a régua é a conta do SGI (4 h x 0,8 por turno, lidos da config) com
os técnicos presentes.

Serviço: `app/services/bi/os_schedule.py` (consultas, regras puras e
`OsScheduleService`), schemas `OsSchedule*` em `app/schemas/bi_os.py`,
rota `GET /bi/os/calendar/schedule` em `app/api/v1/bi_os.py` (o segmento é
`calendar` porque `require_menu_access` cobra o menu `os.calendar` pelo
caminho), testes em `tests/test_bi_os_schedule.py` (o exemplo §6 do
documento do SGI é o gabarito: 78,13%, 36,46%, 70,31% e os 100% da
Manutenção batem). Produção: 0,3 s, 151 KB. Turnos saem na ordem do
relógio (o cadastro do SGI traz a tarde antes da manhã).

Portal: `src/data/api/osScheduleSource.ts`, `src/Pages/Schedule/`
(página, modelo, gerador do gráfico, hook de leitura a cada 5 min,
esqueleto, fixture sintética e testes espelho). A página ocupa o item
`calendar` de Ordens de Serviço: chave de acesso mantida, título "Agenda e
capacidade", endereço `/dashboard/os/agenda-capacidade`, o antigo
`/dashboard/os/calendario` redireciona. `src/Pages/OperationalCalendar`
ficou sem uso e não foi apagada (decisão do Mário).

Limiares de cor provisórios: abaixo de 85% verde, de 85% a 100% âmbar,
acima de 100% vermelho (`scheduleModel.ts`).

Fora da primeira versão, por decisão ou por falta de insumo: faixa de
filtros, demanda criada por dia e antecedência, visão por território,
escala e hora extra, janela de horário dentro do turno.

Achados fora do escopo, não alterados: no serviço, `tests/test_bi_commercial.py`
e `tests/test_bi_commercial_records.py` chegaram à branch com erro de
indentação (commit a58407b) e não coletam; no portal,
`src/Pages/Auth/DefinePassword.test.tsx` falha porque a tela diz "1 dia"
e o teste espera "10 minutos".

## 10. Revisão dos três revisores em 16/10/2026 e o que mudou

Corrigido no serviço: o histórico passou a ser 28 dias antes de HOJE (era
antes do início da janela, 35 dias na janela padrão); infra e auditoria
nunca saem como "cheias", porque a grade do SGI libera esses tipos todo dia
(§8 do documento); no passado só conta o realizado (concluída, improdutiva
ou em campo), porque OS que ficou "agendada" num dia que passou não
aconteceu e o SGI parou de expirar em outubro; hoje conta o que aconteceu e
o que ainda vai acontecer (o SGI lê só o ativo e a ocupação dele cai ao
longo do dia). Testes novos: mediana com poucas ocorrências e contagem par,
dia sem OS na janela, zero técnicos ativos, empate por nome, histórico de
28 dias.

Corrigido no portal: títulos "Categorias de hoje/amanhã/dia"; ausências em
sentence case ("Sem técnico apto", "Sem base", "Sem turno"); o aviso de
releitura falha foi para a frase da faixa ao vivo, que perde o ponto verde;
cards com cor FIXA de identidade e o estado em palavras no detalhe (cabe,
perto do limite, acima da capacidade); definição e leitura gerencial
distintas, a leitura calculada sobre a agenda; sem número do estudo em
texto de tela; barra empilhada com o total na fatia do topo; dias passados
sobre faixa sombreada em vez de barra esmaecida (medido: qualquer mistura
do azul ou do teal com a superfície cai abaixo de 3,0 em um dos temas);
tooltip com o total recuado e o título em negrito; cores pelos tokens do
portal; marca "cheio" no par de atenção medido (`--schedule-attention`,
escopado em `.os-schedule`); card de horas diz em quantos dias a capacidade
foi estimada; subtítulo das categorias avisa OS sem turno e sem horas
previstas; teste da fonte `osScheduleSource.test.ts`.

Decisões que ficaram com o Mário: a cor por ocupação nas CAIXAS da faixa
(a casa pinta por identidade; a cor hoje tem o estado em palavras ao lado);
os limiares 85% e 100%; que comparação cabe nos cards de uma página que
olha para a frente; a regra de "hoje" e do "passado" descritas acima; o
fechamento de rota por dia e mês sem ano e sem hora (igual ao SGI?);
`weekend-scheduling-enabled` e as horas limite (11h e 16h) ainda não entram
no "cheio"; a pasta OperationalCalendar órfã; a sidebar mistura "Agenda e
capacidade" (sentence case) com "Visão Geral" (title case).
