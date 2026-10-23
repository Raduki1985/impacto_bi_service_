# Visão Geral de OS, contexto para continuar

Escrito em 22/09/2026 e atualizado em 23/09/2026 à tarde, para abrir um
chat novo sem perder o fio. Arquivo local, dentro de `Docs`, que é
invisível ao Git.

## Primeira coisa a fazer no chat novo

O trabalho de 23/09 foi GUARDADO na develop em 23/09 à tarde, em três
commits, ENVIADOS ao servidor em 23/09 à noite:
`2ed62ff` Visão Executiva desligada e página inicial; `2b5222a` leitura
gerencial, taxas em pontos, período e faixa Hoje (assuntos 2 e 3 juntos,
estavam nas mesmas linhas); `974b455` Motivos de improdutiva no lugar da
Distribuição por status.

Depois, ainda em 23/09, GUARDADO e ENVIADO também:
`9e8b606` regras dos cards e opção "Sem equipe"; `18a7913` seletor de
técnico em ordem alfabética; `dd4329b` acertos da revisão.

Regras que esses commits congelam:
- Status filtrado: taxas "Não se aplica", comparação "Com Status
  filtrado"; Total e Concluídas seguem filtrados;
- recorte vazio: taxas "Sem OS", comparação "Sem comparação";
- base das taxas: cliente; infraestrutura só sem nenhuma OS de cliente,
  ou com Equipe/Técnico filtrado cuja frente é infraestrutura (mais OS de
  infra do que de cliente). Descartadas: "grupo com mais OS" e corte de
  10% (a equipe Infra teve 47% de cliente em junho);
- Equipe ou Técnico filtrado: detalhe avisa ", sem as OS sem técnico";
- "Sem equipe" no fim do filtro Equipe, vale também para Hoje ao vivo.

A equipe da OS é lida do cadastro ATUAL do SGI: em 23/09 às 17h18 o
Mário vinculou o Antonio Neto à Terceirizada e o histórico dele mudou
junto. "Sem equipe" de cliente em 01 a 22/09 ficou em 70 OS e 10,0%.
Sobra um técnico sem equipe no SGI: Josué Fernando da Silva, 3 OS.

Decidido à noite: OS sem técnico NÃO ganha equipe no BI. Equipe mede
pessoas, Tipo de OS mede o serviço. Próximo gráfico, depois de sexta:
Destino por tipo de OS. Revisores de dados e gráficos rodaram: nada
bloqueia; correções pequenas feitas SEM COMMIT (leitura com Status,
singular, comentários, teste de Técnico), depois guardadas em dd4329b.

ENVIADO ao servidor em 23/09 à noite: develop em dd4329b, seis commits
(2ed62ff a dd4329b). Pedido de merge develop -> main NÃO pôde ser aberto
por mim (a credencial do Git não tem permissão de API); o Mário abre pelo
link pronto em Docs/mr-develop-main-2026-09-23.txt, revisor Vagner. Em aberto para o Mário: card de
Improdutividade conta "Motivo não especificado" como motivo principal,
o painel não.

## Onde paramos

### Guardado e enviado ao servidor (develop, origin/develop)

- `ef64adc` filtro de coluna compartilhado entre as tabelas do portal
- `d4d83b5` Visão Geral com Hoje ao vivo, taxas sobre OS de cliente e
  destino das OS
- `58f5acd` Gestão de Técnicos sobre a fonte real do SGI
- `2ab5019` atalhos de período, comparação nomeada e sinais de ação
- `433292c` Destino das OS: fatia mínima de 2% da barra, cantos
  arredondados nas duas pontas, início fixo da barra (largura fixa para
  o rótulo do grupo) e só a quantidade dentro da fatia. O percentual saiu
  da barra e ficou no tooltip; o número aparece quando a fatia desenhada
  comporta, medido na hora de desenhar, e some em vez de vazar.

### Feito em 23/09, funcionando, SEM COMMIT

17 arquivos, cerca de mil linhas, com três assuntos misturados na mesma
pasta. Conferência automática sobre esse conjunto em 23/09 às 14h30:
2.079 verificações, nenhuma falhou. Lint e compilação não foram rodados
depois disso.

Recomendação: três commits separados, um por assunto, para qualquer um
poder ser desfeito sem levar os outros.

1. **Visão Geral Executiva desligada e página inicial** (`App.tsx`,
   `DashboardLayout.tsx`, `Preferences.tsx`, `homeNavigation.ts` e
   teste). Entrada pela Visão Geral de OS; seletor de página inicial
   para todo perfil com mais de um departamento; chave única
   `CORPORATE_HOME_ENABLED`.
2. **Leitura gerencial dos cards** (`overviewModel.ts` e teste,
   `executiveMetricCardModel.ts`, parte de `Overview.tsx`). Leitura
   calculada com os números do recorte (`buildOverviewReadings`), OS
   Concluídas com comparação neutra, taxas comparadas em p.p.
3. **Período, semana incompleta e legenda sem técnico**
   (`OverviewFilterPanel.tsx`, `TodayStrip.tsx`, `todayOsModel.ts`,
   `TodayOsTable.test.tsx`, `styles.css`, parte de `Overview.tsx`).

`Overview.tsx` e o teste de tela dele têm pedaços dos assuntos 2 e 3: vai
precisar separar por trecho, ou juntar 2 e 3 num commit só se a
separação ficar arriscada.

Detalhes do assunto 3, que só estão aqui:

- a etiqueta do período em "Resultado do período" tem o formato do
  atalho aceso da faixa (pílula azul clara; verde no tema escuro);
- a faixa de filtros só mostra as datas quando NENHUM atalho está aceso
  (recorte personalizado). Com atalho aceso, o botão nomeia o período e
  a dica dele mostra as datas;
- semana incompleta compara os MESMOS dias da semana anterior, e o card
  diz: "vs. semana anterior até terça". Semana completa segue "vs.
  semana anterior";
- legenda "sem técnico": antes da hora dos turnos, total do dia em cinza
  ("35 sem técnico"); entre 10h e 15h, só as atrasadas em âmbar com o
  turno ("8 sem técnico (manhã)"); depois das 15h, tudo que sobrou. O
  clique abre a lista filtrada por "Sem técnico" e pelo turno da legenda;
- a caixa A fazer conta sempre o dia de hoje, nunca o período dos
  filtros; as sem técnico de dias passados já expiraram e aparecem no
  Destino como não executadas.

## Decisões de 23/09/2026

- **A gestão mandou manter os filtros.** Todos os sete ficam na faixa:
  período, Equipe, Técnico, Tipo de OS, Categoria, Cidade e Status. O
  item "tirar o filtro Status" do handoff anterior está descartado. Não
  repropor remover filtro: quando um filtro distorcer um card, a solução
  é no card.
- **Motivos de improdutiva ficam para depois.** O Mário adiou em 22/09.
  Para a apresentação, "Distribuição por status" fica onde está. O card
  de Improdutividade já cita o motivo mais comum na leitura.
- **Visão Geral Executiva desligada** até ser a última página feita.
- **Taxas comparadas em p.p.**, Total e Concluídas em percentual.

## Próxima avaliação: filtros e cards

O que avaliar: com os sete filtros mantidos, cada card e cada painel da
página continua dizendo a verdade em qualquer combinação de filtro?

Por que: hoje os quatro cards aplicam TODOS os filtros
(`buildOverviewKpis` em `overviewModel.ts` chama
`applyOverviewOsFilters`). Os painéis de composição não: cada um ignora o
filtro que o reduziria a uma barra só (`applyOverviewOsFiltersExcept...`
em `src/data/overviewOsFilters.ts`). Ou seja, a página já tem duas
regras, e os cards ficaram do lado que distorce.

Casos conhecidos, a confirmar na tela:

- **Status = Concluída**: Taxa de Conclusão 100%, Improdutividade 0%.
  Status = Improdutiva: o inverso. É o caso que fez a gestão discutir o
  filtro.
- **Tipo de OS = Infraestrutura**: as taxas mudam de base e passam a ser
  sobre todas as OS, porque não há OS de cliente no recorte. Já existe
  aviso no detalhe do card; conferir se é claro o bastante.
- **Técnico**: filtrar um técnico some com as OS sem técnico, que são a
  maior fonte de "não executada" (94% das que terminam o dia sem técnico
  viram expirada ou encerrada). A taxa do técnico sobe por construção.
  Conferir se a leitura do card não conclui algo falso disso.
- **Recorte vazio** em qualquer filtro: o que cada card e painel mostra.
- **Faixa Hoje ao vivo**: responde aos filtros ou não? Hoje a caixa A
  fazer conta sempre o dia inteiro; ver se as outras seguem a mesma
  regra e se a tela deixa isso claro.

Entregável da avaliação: uma tabela filtro por card e painel, dizendo o
que acontece hoje, se distorce, e uma recomendação para cada distorção.
Sem alterar código até o Mário decidir.

Caminhos possíveis para o Status nos cards, a avaliar e não decididos:

- as taxas ignoram o filtro Status, como o gráfico de status já faz, e
  o card avisa que a taxa é do recorte sem o filtro de status;
- com Status filtrado, as taxas mostram "não se aplica" e o Total e as
  Concluídas seguem filtrados;
- manter como está e explicar na leitura do card.

## Por que a página é como é

Análise de 22/09/2026, com medição no SGI de produção (leitura):

- **OS sem técnico no fim do dia vira não executada.** Em catorze dias,
  145 OS terminaram o dia sem técnico e 137 delas (94%) viraram expirada
  ou encerrada.
- **A designação é feita no próprio dia da visita**: 999 de 1.112 OS de
  setembro. Às 8h só um terço das designações do dia aconteceu, ao
  meio-dia 71%, às 15h 96%. OS sem técnico de manhã é rotina.
- **Horário real dos turnos** (o SGI só guarda o rótulo): a visita da
  manhã começa, na metade das vezes, até 10h12; a da tarde até 15h18.
- **Curva do dia**: às 10h, 12% das conclusões do dia já aconteceram; ao
  meio-dia 35%; às 15h 63%; às 18h 90%.
- **Expirada é automática, encerrada é manual.** Os 417 eventos de
  expiração do histórico não têm usuário e acontecem à meia-noite.
- **Tendência das OS de cliente**: conclusão 75,3% em junho, 81,3% em
  julho, 84,5% em agosto; improdutividade 16,0%, 13,2%, 11,4%.
- **Motivos de improdutiva** (base inteira, 777 OS, medido em 22/09):
  cliente ausente 49,7%, "especificar nas observações" 18,9%, local sem
  condição 13,9%, cancelou na visita 5,0%, clima 4,9%, sem motivo 4,6%,
  acesso negado 1,9%, material 0,8%, equipamento 0,3%. O campo no banco
  é texto livre, sem trava; quem limita as opções é o aplicativo do
  técnico. Opção nova no aplicativo entra no gráfico sozinha, crua.
- **Retrabalho**: 21% dos clientes com OS em setembro tiveram duas ou
  mais visitas.

## Regras que a página congela

Período e comparação:

- período padrão do dia 1 até **ontem**; no dia 1, o mês anterior
  inteiro. Só nesta página; o Comercial segue até hoje;
- a comparação segue a natureza do recorte: um dia contra o mesmo dia da
  semana anterior; semana contra os mesmos dias da anterior; mês até um
  dia contra o mês anterior até o mesmo dia; mês inteiro contra mês
  inteiro; recorte livre contra a mesma duração terminando na véspera;
- os cards dizem com o que comparam.

Faixa Hoje ao vivo:

- lê a última semana do serviço a cada minuto, mas as seis caixas contam
  só hoje e somam 100% do dia;
- a hora vem do serviço, nunca do relógio do computador;
- OS de dias anteriores ainda abertas aparecem no canto da caixa Em
  campo ("1 de ontem") e não entram no número da caixa;
- toda cor de atenção usa um par medido nos dois temas.

## Pendente, para depois de sexta

1. **FEITO em 23/09 à tarde, sem commit**: painel "Motivos de
   improdutiva" no lugar de "Distribuição por status", gerador próprio
   `overviewReasonsChartOptions.ts`. Base: TODAS as improdutivas do
   recorte (cliente e infraestrutura), por causa do filtro Equipe Infra.
   Barras cinza no fim para "Motivo não especificado" e "Sem motivo
   registrado". Vai junto do commit do assunto 2 ou num quarto commit.
2. **Dois campos novos no serviço** (o cliente da OS e a data de
   criação), que o Mário autorizou eu fazer, com revisão do André. Sem
   eles não existem os painéis de retrabalho e de espera até a visita.
3. **Rota agregada do serviço** (a que o portal não usa) ficou com a
   regra antiga de período e comparação. Levar ao André junto com os
   dois campos.

## Adiado, com a razão

- **Referência de hora na faixa** ("num dia típico, a esta hora, 12% do
  dia já está concluído"): o Mário ainda não decidiu.
- **Evolução mensal das duas taxas**: decidir se entra na Visão Geral ou
  na página Evolução Temporal, que já existe no menu.
- **Detalhe de uma OS ao clicar na linha**: janela central, padrão de
  Usuários e Perfis de Acesso. Só vale com a linha do tempo da OS, que
  depende do serviço. Pergunta aberta: o SGI tem endereço próprio por OS,
  para um atalho "abrir no SGI"?
- **Página "Operação do dia"**: quando existir quadro por técnico ou
  mapa, a lista detalhada sai da Visão Geral e vai para lá.
- **Barra de rolagem que pisca** no painel Destino das OS ao abrir e
  fechar o menu lateral: o Mário viu, some sozinha, e pediu para deixar
  de lado.

## Limpeza pendente no SGI

O Mário disse que os dados sujos serão limpos:

- cidades fora do cadastro: Atiba, Portao, Bom Jesus dos Perdõe, São
  Paulo, Terra Preta; Jarinu e Campinas não estão no cadastro;
- motivo de improdutiva: "especificar nas observações adcionais" (com
  erro de digitação no próprio SGI) e vazio escondem o motivo real de
  quase uma em cada quatro improdutivas;
- técnico sem equipe, que aparece como "Sem equipe" nas listas.

Corrigido no SGI, o portal se corrige sozinho.

## Avisos práticos

- Apresentação para a diretoria: **sexta-feira, 25/09/2026**. Quinta à
  tarde é para ensaiar, não para mexer na tela.
- Para o ensaio: "Esta semana" em 23/09 mostrou alta de 84,9% no total
  de OS (257 contra 139). Não é tendência: segunda, 21/09, foi o maior
  dia do mês, com 136 OS.
- 23 capturas `.png` e um `.coverage` soltos na raiz do repositório, sem
  versionar. O Mário precisa decidir se apaga, move para
  `relatorios-sgi` ou coloca no `.gitignore`. Nunca dar stage neles.
- Fotos das rodadas em
  `Documents\Impacto Telecom - Business Intelligence\relatorios-sgi\investigacao-os\`.
- Login no portal local para conferir na tela: e-mail
  `marioramos@impactotelecom.com`, a senha não é verificada.
