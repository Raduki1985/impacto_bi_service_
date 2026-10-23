# Sumário de OS do SGI: o que aproveitar na Agenda e capacidade (20/10/2026)

Leitura apenas, feita em 20/10/2026 às 09h27, na tela
https://sgi.impactotelecom.com/service-orders, botão "Ver Sumário", mais
a captura do Mário do sábado 24/10 e a memória de cálculo do próprio SGI
(`SCHEDULING_SUMMARY-sgi-2026-10-14.md`, nesta pasta). Capturas sem dado
pessoal: `sgi-sumario-hoje.png`, `sgi-sumario-hoje-2.png`,
`sgi-sumario-hoje-3.png`; estrutura em texto em
`sgi-sumario-snapshot.yml`.

## 1. Conclusão

O Sumário do SGI responde "quão cheio está UM dia, agora". A nossa página
responde "a grade do SGI vai recusar?" e "cabe quanto?" em duas semanas,
para trás e para a frente. O desenho dele (um dia, muitas caixas) não
serve. Servem: a ordem das informações dentro do turno, três símbolos, o
vocabulário, e quatro lógicas que ele usa e nós ainda não mostramos.

## 2. Como o SGI monta o Sumário

De cima para baixo:

1. Data do sumário: um dia por vez, setas de dia anterior e seguinte (a de
   trás vem desligada: o SGI não volta ao passado), a data por extenso e
   um botão de atualizar.
2. Técnicos: Total de OS do dia, Tempo médio, e três estados: Ativos,
   Online e Disponível (ícones: pessoas, wi-fi, pessoa com marca).
3. Manhã e Tarde, um card cada: selo com a porcentagem ao lado do nome;
   "OS agendadas"; "Capacidade" e "Consumido"; linha "Consumo da
   capacidade 51,35% (Restam 65.39h)" com a barra.
4. Status das OS: sete caixas com contagem.
5. "Ocupação por tipo": na verdade é a participação de cada tipo no total
   de OS do dia (Manutenção 49 de 118 = 41,5%), não ocupação de capacidade.
6. "Ocupação por categoria": só categorias com OS ativa no dia; nome como
   selo, "SLA: 40m" ao lado, botão "Técnicos" (lista filtrada) e "Ver
   detalhes" (abre Manhã e Tarde com a mesma estrutura do item 3).

Números conferidos hoje (20/10, 09h27):

- Capacidade 134.40h = 42 técnicos do cadastro x 4 h x 0,8. Igual na
  manhã, na tarde e no sábado 24/10. O SGI não sabe que sábado à tarde
  trabalham 7.
- "OS agendadas" por turno conta só status ativo: 62 agendadas + 16
  reagendadas + 25 em andamento = 103 = 50 manhã + 53 tarde. As 9
  concluídas, 5 encerradas e 1 improdutiva já saíram da conta.
- Online 34 e Disponível 32 são de agora, mesmo olhando outro dia (a
  captura do sábado mostrou 42, 34 e 33).
- Soma das OS das 26 categorias listadas = 103. Bate com os turnos.
- Execução de CTO: 1 OS, 0 técnicos aptos. O SGI mostra 0% (parece livre)
  e a grade recusa. Câmera Offline: 12 OS com 1 apto.

## 3. Lógicas do SGI que enriquecem a nossa análise

a) Hoje, o SGI devolve a capacidade da OS concluída. Às 9h27 já tinham
   saído 10 OS da conta (9 concluídas e 1 improdutiva). Nossa página conta,
   para hoje, feito + a fazer. Resultado: para hoje, nosso "marcadas" é
   maior e nossa sobra é menor que a do SGI, e a diferença cresce ao longo
   do dia. A nossa regra é a certa para "cabe mais uma?": o tempo gasto na
   OS feita não volta. Mas quem usa os dois sistemas vai ver dois números.
   Recomendação: mostrar a conta do SGI no detalhe do turno, com a frase
   "o SGI devolve a capacidade das OS concluídas". O serviço já manda essa
   conta (régua do agendamento); o portal não a desenha.

b) Categoria sem técnico apto aparece no SGI com 0% e a grade recusa.
   Nossa página já marca "Cheio" (capacidade zero é cheio, regra no
   serviço). Manter, e é o melhor argumento para o rodapé do cadastro de
   aptidões.

c) Teto de 100%: o SGI esconde o excesso ("100,00% (Excedeu 1.44h)").
   Nós mostramos quanto passou. Manter.

d) Três estados de técnico, com regra precisa: Online = aplicativo aberto
   nos últimos 5 min e localização nos últimos 10 min; Disponível = online
   e botão ligado. O nosso serviço já manda "disponíveis agora"
   (`available_now`, só o botão, sem exigir online) e o portal lê mas não
   mostra. Cabe no card de hoje: "39 em campo · 32 disponíveis agora". Sem
   mexer no serviço. Os números podem diferir um pouco dos do SGI porque o
   nosso não exige o aplicativo aberto.

e) Tempo médio real: o SGI guarda a duração real de cada OS
   (`duration_in_minutes`) e mostra a média do dia (26 min hoje às 9h27).
   A nossa régua usa o previsto (SLA). Comparar previsto x real por turno
   nos dias passados diria se o 0,8 e os SLAs das categorias estão
   calibrados. Precisa do serviço ler a duração real. Não sei o que o SGI
   mede exatamente nessa duração; conferir com o Caio antes de usar.

f) Tipos de serviço: o SGI resume o dia em seis tipos (Manutenção,
   Instalação, Instalação de câmera, Mudança de endereço, Infraestrutura,
   Retirada de câmera). É o vocabulário do filtro "por tipo de serviço"
   que ficou pendente no lugar do filtro por equipe. O serviço já manda o
   tipo de cada categoria; falta a capacidade por tipo.

g) Reagendadas: 16 OS de hoje foram remarcadas para hoje. Sinal de
   instabilidade da agenda, útil no detalhe do dia. Precisa do serviço
   separar o status. Baixa prioridade.

h) Prioridade da OS (Normal, Baixa) aparece em cada card do SGI. Não muda
   a conta de capacidade. Só observação.

## 4. Disposição e símbolos para trazer (não a cor)

1. Ícone de pessoas para técnicos: é o mesmo símbolo do SGI em "Ativos".
   Quem usa os dois sistemas lê igual.
2. Selo de porcentagem ao lado do nome do turno ("MANHÃ 51%").
3. Vocabulário "Restam" e "Excedeu" nas pílulas, "Capacidade" na dica.
4. Botão "Atualizar" ao lado da hora da leitura. O serviço guarda a
   resposta por 60 s, então o botão funciona de verdade (no máximo uma
   leitura nova por minuto). A releitura automática de 5 min continua.
5. SLA ao lado do nome em todas as linhas de categoria do detalhe. Hoje só
   aparece nas que cabem ("40min cada"); nas recusadas e nas realizadas
   não.
6. Botão "Técnicos" por categoria: abrir a lista do cadastro de aptidões já
   filtrada pela categoria clicada no detalhe, como o SGI faz.
7. Ordem interna do card de turno: contagem, capacidade e consumo, barra
   com "restam". A nossa proposta de 20/10 segue a mesma ordem, mais
   compacta: horas marcadas, barra com "de 92h48", pílula "Restam".

## 5. O que não trazer

- Cor única (tudo azul, de 13% a estourado).
- Teto de 100%.
- Um dia por vez.
- Três caixas de técnicos por dia (cabe na dica do mouse).
- Status das OS e "Ocupação por tipo" no card (já estão na Visão Geral e
  no Hoje ao vivo; o nome "ocupação" ali engana).
- Aba "Expirada 272" com filtro Hoje: confirma que a aba ignora a data.

## 6. Recomendação, em ordem

Sem mexer no serviço (cabe na branch feat/os-agenda-capacidade-2):

1. "N disponíveis agora" no card de hoje.
2. Botão Atualizar com a hora da leitura.
3. SLA em todas as linhas do detalhe.
4. Conta do SGI no detalhe do turno, com a explicação da diferença.
5. Ícone de pessoas, selo de porcentagem, pílulas "Restam" e "Excedeu"
   (prévia dos cards de 20/10).

Com o serviço (decisão do Mário, para depois):

6. Previsto x real nos dias passados (duração real da OS).
7. Filtro por tipo de serviço com os seis tipos do SGI.
8. Reagendadas no detalhe do dia.
