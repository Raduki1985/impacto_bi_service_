# Roteiro de apresentação: Visão Geral Comercial

Visão Geral Comercial do IMPACTO BI. Escrito em 29/09/2026 a partir do que a
tela mostra hoje. Arquivo local, dentro de `Docs`, fora do Git. Mesmo
formato do roteiro de OS (`roteiro-apresentacao-os-2026-09-29.md`).

## A frase que precisa ficar

> A venda só conta quando o sinal do cliente liga. A página mostra o que
> entrou hoje, onde cada venda está parada e quem precisa agir, o que o
> período entregou e o que acontece com a venda depois que ela vira cliente.

## Ficha da apresentação

| Item | Definição |
| --- | --- |
| Público | Gerente comercial e diretoria |
| Duração | 20 minutos de tela, mais 10 de perguntas |
| Página | Comercial, Visão Geral |
| Fonte | SGI de produção, lido pelo serviço de BI; nada passa por planilha |
| Objetivo | Mostrar que a página responde às perguntas da venda e sair com as decisões da seção "O que pedir à diretoria" |

## Preparação, 15 minutos antes

- [ ] Abrir o portal pelo mesmo caminho da apresentação anterior (pasta
      `impacto-bi-web-comercial`, portal na porta 5174, serviço na 8788;
      conferir se continuam no ar). Na develop atual o portal ainda não
      envia o login nas consultas de BI, e a página pode abrir sem dado.
- [ ] Entrar com um usuário Administrador ou Executivo. Só esses perfis têm
      o olho que mostra os valores em R$. Com Analista, os R$ ficam
      escondidos o tempo todo.
- [ ] Abrir a página uma vez e esperar tudo carregar. Logo depois que o
      serviço é ligado, o card "Bloqueio ou cancelamento em 90 dias" mostra
      "Sem dado" por alguns segundos, até a leitura do histórico terminar.
- [ ] Conferir que a página está ligada ao SGI: título "Hoje ao vivo" verde,
      com o ponto pulsando, e a frase "leitura do serviço às HH:MM ·
      atualiza a cada minuto". O texto no pé da página deve dizer "base
      entregue pelo serviço de BI", e não "dados sintéticos".
- [ ] Faixa de filtros limpa, com o atalho "Este mês" aceso.
- [ ] Decidir antes se os R$ serão mostrados. Eles abrem escondidos. Se a
      plateia puder ver valores, abrir o olho só na hora do card de valor.
- [ ] Zoom do navegador em 100%. Testar tema claro e escuro no projetor da
      sala e ficar com o que ler melhor de longe.
- [ ] Anotar os números do dia na tabela "Números do dia", mais abaixo.
- [ ] Ensaiar os cliques: um "fora do prazo" da esteira, virar um card,
      abrir um mês da Safra, abrir um mês da Evolução mensal.
- [ ] Tirar capturas de tela das partes principais. É o plano B: se o
      serviço não responder, a página avisa e não mostra número.
- [ ] Fechar outras abas e silenciar notificações.

## Números do dia

Preencher na preparação, lendo a tela.

| Onde | Número | Valor |
| --- | --- | --- |
| Hoje ao vivo | Vendidas hoje | |
| Hoje ao vivo | Ativadas hoje, e quantas de dias anteriores | |
| Hoje ao vivo | Pendentes, e quantas fora do prazo | |
| Hoje ao vivo | Assinadas, e quantas fora do prazo | |
| Hoje ao vivo | Agendadas, e quantas fora do prazo | |
| Resultado do período | Vendas ativadas e comparação | |
| Resultado do período | Novos Clientes e percentual | |
| Resultado do período | Tempo até a ativação | |
| Resultado do período | Bloqueio ou cancelamento em 90 dias e comparação | |
| Safra | Mês passado: vendidas, ativou no mês, ativou depois, aguarda, cancelou | |

## Roteiro, bloco a bloco

### 1. Abertura (1 minuto)

**Na tela:** a Visão Geral Comercial aberta no topo, sem clicar em nada.

**Fala sugerida:**

"Esta é a Visão Geral Comercial. Ela lê o SGI de produção direto. Uma regra
guia a página inteira: a venda conta quando o sinal do cliente liga, e não
quando o contrato é fechado. Por isso o número principal é venda ativada.
De cima para baixo: o que aconteceu hoje, o que o período entregou, o que
virou cada mês vendido e onde a venda vem."

### 2. Faixa de filtros (1 minuto e meio)

**Na tela:** apontar os atalhos Ontem, Esta semana, Semana passada, Este
mês e Mês passado. Clicar em "Mês passado" e voltar para "Este mês".
Expandir a faixa só para mostrar os filtros, e recolher.

**Fala sugerida:**

"O período padrão vai do dia 1 até ontem, como na página de OS. O dia de
hoje tem uma faixa só dele, logo abaixo."

"Os filtros são Cidade, Time, Vendedor e Tipo de cliente, pessoa física ou
jurídica. O filtro de vendedor só tem dado a partir de junho de 2026: antes
disso o SGI não gravava quem fez a venda."

### 3. Hoje ao vivo, a esteira (4 minutos)

**Na tela:** a faixa Hoje ao vivo, em três grupos, na ordem em que o
contrato anda.

**Fala sugerida:**

"Aqui é o agora, relido a cada minuto. À esquerda, o que entrou hoje:
Vendidas. À direita, o que virou cliente hoje: Ativadas, e a linha de baixo
da caixa diz quantas são de vendas de dias anteriores, porque a venda
costuma levar um dia para ativar. No meio, a esteira: toda venda de 2026 que ainda não
ativou, sem esconder nada, esteja ela parada há um dia ou há meses."

"Cada etapa da esteira tem um dono. Pendente é o cliente que ainda não
assinou, e quem cobra é o vendedor. Assinada é a instalação que falta
marcar, pelo próprio cliente no aplicativo ou pelo COP. Agendada é a
instalação marcada; se a visita dá errado, quem age é a Central."

**Momento principal:** o canto "N fora do prazo" de cada caixa da esteira.

"Fora do prazo quer dizer que a próxima etapa não aconteceu no tempo
combinado. Pendente: 2 dias de trabalho depois da venda sem assinatura.
Assinada: 2 dias depois da assinatura sem instalação marcada. Agendada: 1
dia depois da data da visita sem sinal e sem outra visita marcada. Domingo
não conta."

Clicar no "fora do prazo" de Pendentes. A lista abre com a venda mais
antiga em cima.

"A lista traz contrato, data e hora da venda, vendedor, time, cidade,
plano, valor, tipo de cliente, situação e um detalhe dizendo há quanto
tempo a etapa espera. Cada coluna filtra e ordena, e Baixar Excel leva
exatamente o que está na lista."

**Se aparecer "Com sinal, falta ativar" ou "Refeita no ..." no Detalhe:**

"Essas não são venda atrasada, são cadastro a corrigir no SGI: o cliente já
tem sinal, ou a venda foi refeita em outro contrato no mesmo endereço. Por
isso ficam na caixa, que espelha o SGI, mas não contam como fora do
prazo."

**Atenção:**

- A faixa segue os filtros da página, menos o período. Filtrar um vendedor
  mostra a esteira dele.
- Feriado ainda conta como dia de trabalho: o portal não tem calendário de
  feriados.

### 4. Resultado do período (5 minutos)

**Na tela:** a etiqueta do período no título e os cinco cards.

**Fala sugerida, card a card:**

- **Vendas ativadas:** "Vendas com o sinal ligado no período. Conta pelo
  dia do sinal, mesmo que o contrato tenha sido cancelado ou bloqueado
  depois. A linha de baixo separa as vendas do próprio período das que
  vieram de vendas anteriores, quase todas do mês de antes."
- **Valor Vendas Ativadas:** "O valor mensal que essas ativações somam, e o
  ticket médio. Os valores abrem escondidos; só Administrador e Executivo
  têm o olho para mostrar." Abrir o olho só se a plateia puder ver.
- **Novos Clientes:** "Quantas ativações são de gente que nunca foi
  cliente. É o crescimento real da base. Os dois blocos abaixo mostram o
  resto: cliente da base que fez outro contrato, e cliente que voltou
  depois de cancelar."
- **Tempo até a ativação:** "Quanto o cliente espera entre fechar a venda e
  ter o sinal ligado. O número é a espera típica: metade dos clientes
  esperou isso ou menos. A barra mostra todos, em faixas: mesmo dia, 1 dia,
  2 a 3 dias, 4 dias ou mais. Aqui subir é piorar, e a comparação é em
  dias."
- **Bloqueio ou cancelamento em 90 dias:** "O que acontece depois que a
  venda vira cliente. Das vendas que completaram 90 dias com sinal ligado,
  quantas estavam em bloqueio financeiro ou canceladas no 90º dia. O
  período de setembro julga quem ligou o sinal em junho; a linha de baixo
  diz as datas. Aqui também subir é piorar, e a comparação é em pontos
  percentuais."

**Sobre a comparação:**

"Cada card diz com o que compara: 'vs. agosto até o dia 28' é o mês
anterior até o mesmo dia, recortes do mesmo tamanho."

**Clique:** virar o card de Vendas ativadas e o de 90 dias.

"Cada card vira e mostra a leitura, escrita com os números do recorte, e
um OBSERVAR com o que acompanhar."

**Planilha:** apontar "Baixar N contratos em Excel", no título da faixa.

"Todos os contratos vendidos ou ativados no período, cada um uma vez, com
uma coluna dizendo se foi vendido no período e outra se foi ativado."

### 5. Safra de vendas por mês (3 minutos)

**Na tela:** o painel Safra, logo abaixo dos cards.

**Fala sugerida:**

"A Safra responde: de tudo o que foi vendido em cada mês, o que virou? Cada
barra é um mês de venda, dividido em ativou no mês, ativou depois, aguarda
hoje e cancelou. O número em cima é o total vendido no mês."

"Aqui o período da página não vale: aparecem todos os meses, para comparar
um com o outro. Os demais filtros valem."

"O mês em andamento sempre parece pior, porque ainda vai ativar no ritmo
normal. Nos meses de junho a agosto, 91% a 94% das vendas chegaram a ligar
o sinal; quem cancelou depois aparece hoje na fatia Cancelou."

**Clique:** a fatia "Aguarda hoje" do mês passado. A janela abre com os
contratos.

"Essa é a venda que ficou para trás. Com o nome do vendedor, a situação e o
detalhe."

### 6. Onde a venda vem (2 minutos)

**Na tela:** Vendas por cidade, Vendas por time e Origem das vendas.

**Fala sugerida:**

- **Cidade e time:** "Ranking completo do período. Filtrar uma cidade ou um
  time destaca a linha, sem sumir com as outras, para não perder a
  comparação."
- **Origem das vendas:** "Venda de vendedor ou por indicação. Só é
  indicação quando existe o CPF de quem indicou, e venda indicada não conta
  para o vendedor."

### 7. Evolução mensal e rankings (2 minutos)

**Na tela:** Evolução mensal das vendas, Top 5 Vendedores e Top 5 Planos.

**Fala sugerida:**

- **Evolução mensal:** "Ativações por mês, separadas em Comercial,
  Corporativo e Sem time. O número em cima é o total do mês. Clicar num mês
  abre as ativações dele."
- **Top 5 Vendedores:** "Ranking por vendas ativadas no recorte."
- **Top 5 Planos:** "Os planos que mais ativaram."

**Atenção:** com o olho dos R$ aberto, a linha de valor da Evolução mensal
passa por cima dos totais das barras. Para ler os totais, deixe os R$
fechados neste momento.

### 8. Fechamento (2 minutos)

**Fala sugerida:**

"Resumindo: a esteira mostra hoje onde a venda parou e quem precisa agir;
os cards dizem o que o período entregou; a Safra mostra o que virou cada
mês vendido; e o card de 90 dias começa a medir a qualidade da venda depois
que ela vira cliente."

**Próximos passos, todos ainda propostas, sem data:**

- Nome definitivo do card de 90 dias.
- Meta comercial, quando a regra for definida.
- Página de clientes, com carteira e cancelamento, que não são assunto
  desta página.
- Comissão, a tratar em outro momento.

## O que pedir à diretoria

1. **Regra da meta comercial.** O card de meta saiu em 15/09 porque a
   empresa ainda não tem a regra definida. Ele volta quando ela existir.
2. **Nome do card de 90 dias.** "Bloqueio ou cancelamento em 90 dias" é
   provisório.
3. **Encerrar no SGI a venda que não vai ativar.** Hoje o SGI não tem esse
   caminho: a venda que morre fica pendente, assinada ou agendada para
   sempre, e a esteira nunca limpa sozinha. Precisa de um encerramento com
   motivo de lista. O desconto de comissão da venda que não ativa também
   depende disso. É pedido para a equipe do SGI.
4. **Cadastro de equipe no SGI.** Vendedoras sem equipe no SGI caem em "Sem
   time" e ficam fora do Comercial.

## Perguntas prováveis

**"Por que o número não bate com o Relatório de Vendas do SGI?"**
Porque as regras são diferentes, e as duas estão certas para o que medem.
A "Vendas Ativas" do SGI só conta o contrato que continua ativo hoje e
corta o dia pelo horário universal, três horas à frente de Brasília (a
ativação das 22h do dia 31 cai no mês seguinte); o BI conta a ativação
mesmo que o contrato tenha sido cancelado depois, e usa o horário de São
Paulo. A
diferença é pequena (agosto: 745 no BI, 737 no SGI). O "Total de Vendas" do
SGI é venda fechada: compare com o total da Safra, e não com Vendas
ativadas.

**"Por que o número principal é a ativada, e não a vendida?"**
Porque a venda conta quando o sinal liga. A vendida é a entrada, e aparece
na faixa de hoje e na Safra.

**"O card de 90 dias está falando de junho?"**
Sim. Ele julga as vendas que ligaram o sinal 90 dias antes do período,
porque é a idade em que o problema aparece. Olhar a situação de hoje faria
o mês antigo parecer pior só por ser antigo.

**"Por que bloqueio e cancelamento juntos?"**
O problema da venda aparece primeiro como bloqueio. Só o cancelamento
ficaria perto de 1% em qualquer mês e esconderia o risco. Venda cancelada
sem chegar a instalar fica fora da conta.

**"Por que tem venda de janeiro na esteira?"**
Porque o SGI não tem como encerrar a venda que não vai ativar. Ela fica lá
até alguém resolver. É o pedido 3 à diretoria.

**"Por que o filtro de vendedor não mostra nada antes de junho?"**
O SGI só passou a gravar quem fez a venda a partir de junho de 2026.

**"O que é 'Sem time'?"**
Vendas de vendedor sem equipe no cadastro do SGI, e vendas sem vendedor
registrado. É agrupamento provisório, não um time.

**"Venda por indicação conta para o vendedor?"**
Não. Com CPF de quem indicou, a venda é da indicação.

**"Por que os valores aparecem escondidos?"**
Regra da página: os R$ abrem escondidos, e só Administrador e Executivo
podem abrir. Analista não vê.

**"Cadê a meta?"**
Suspensa até a empresa definir a regra.

**"E cancelamento da carteira, comissão?"**
Carteira e cancelamento vão para a futura página de clientes. Comissão é
outro assunto, ainda não tratado.

## O que não dizer

- Não comparar Vendas ativadas com o "Total de Vendas" do SGI.
- Não dizer que o valor está protegido para o Analista em todo lugar. Hoje
  ele está escondido na tela; a proteção completa ainda depende do serviço
  de BI.
- Não chamar o card de 90 dias de inadimplência nem de cancelamento da
  carteira. Ele mede bloqueio financeiro ou cancelamento no 90º dia.
- Não tratar Assinada ou Agendada fora do prazo como culpa do vendedor: as
  duas dependem de outros times.
- Não ler o mês em andamento da Safra como queda: ele ainda vai ativar.
- Não prometer meta, comissão ou página de clientes com data.

## Números de apoio, medidos no SGI de produção

Medição, não meta. Usar como contexto na fala, com a data.

| Fato | Número | Medido em |
| --- | --- | --- |
| Vendas e ativações por dia útil | cerca de 31 e 27 | 24/09/2026 |
| Clientes que assinam no dia da venda, e até o dia seguinte | 87,5% e 95,6% | 25/09/2026 |
| Espera típica até a ativação, agosto | 1 dia | 15/09/2026 |
| Parte de cada mês vendido que só ativa no mês seguinte | 8% a 10% | 17/09/2026 |
| Vendas de junho a agosto que chegaram a ligar o sinal | 91% a 94% | 17/09/2026 |
| Ativações por mês do sinal: jan, fev, mar, abr, mai, jun, jul, ago | 776, 813, 815, 723, 650, 723, 749, 752 | 28/09/2026 |
| Bloqueio ou cancelamento no 90º dia, setembro até o dia 27 | 12,8% (76 de 594), contra 11,7% em agosto | 28/09/2026 |
| Clientes em bloqueio financeiro hoje, carteira toda | 2.231 | 28/09/2026 |
| Esteira fora do prazo: pendentes, assinadas, agendadas | 160, 12 e 48 | 28/09/2026 |

A esteira é o gancho do fechamento: a maior parte das pendentes fora do
prazo é venda que nunca andou, sem assinatura, sem instalação e sem
fatura. Quem pode destravar é o vendedor, e quem pode encerrar de vez é o
SGI, se ganhar esse caminho.
