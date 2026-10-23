# Roteiro de apresentação: Ordens de Serviço

Visão Geral de OS e Gestão de Técnicos do IMPACTO BI. Escrito em 29/09/2026
a partir do que a tela mostra hoje. Arquivo local, dentro de `Docs`, fora do
Git.

## A frase que precisa ficar

> A página mostra, de cima para baixo, como está o dia agora, como foi o
> período, para onde foi cada OS e por que as visitas falharam. E mostra a
> tempo de agir: a OS sem técnico de hoje é a não executada de amanhã.

## Ficha da apresentação

| Item | Definição |
| --- | --- |
| Público | Gerência e diretoria |
| Duração | 20 minutos de tela, mais 10 de perguntas |
| Páginas | Ordens de Serviço, Visão Geral; Gestão de Técnicos se houver tempo |
| Fonte | SGI de produção, lido pelo serviço de BI; nada passa por planilha |
| Objetivo | Mostrar que a página responde às perguntas da operação e sair com as decisões da seção "O que pedir à diretoria" |

## Preparação, 15 minutos antes

- [ ] Abrir o portal pelo mesmo caminho que funcionou na apresentação do
      Comercial (pasta `impacto-bi-web-comercial`, portal na porta 5174,
      serviço na 8788; conferir se continuam no ar). Na develop atual o
      portal ainda não envia o login nas consultas de BI, e a página pode
      abrir sem dado nenhum.
- [ ] Conferir que a página está ligada ao SGI: o título "Hoje ao vivo"
      aparece verde, com o ponto pulsando, e a frase "leitura do serviço às
      HH:MM · atualiza a cada minuto".
- [ ] Conferir que o cabeçalho da página NÃO mostra a etiqueta "Dados
      simulados".
- [ ] Faixa de filtros limpa, com o atalho "Este mês" aceso.
- [ ] Zoom do navegador em 100%. A página foi medida em telas de 1366 e
      1440 de largura.
- [ ] Testar o tema claro e o escuro no projetor da sala e ficar com o que
      ler melhor de longe.
- [ ] Anotar os números do dia na tabela "Números do dia", mais abaixo. A
      faixa Hoje muda a cada minuto e o resto da página só muda ao
      recarregar.
- [ ] Escolher e ensaiar o filtro da demonstração (bloco 7).
- [ ] Ensaiar os cliques: virar um card, abrir uma fatia do Destino, abrir
      uma barra de Motivos, clicar no atalho "sem técnico".
- [ ] Tirar capturas de tela das partes principais. É o plano B: se o
      serviço não responder, a página avisa e não mostra número nenhum, de
      propósito, para não exibir dado errado.
- [ ] Fechar outras abas e silenciar notificações.

## Números do dia

Preencher na preparação, lendo a tela.

| Onde | Número | Valor |
| --- | --- | --- |
| Hoje ao vivo | Agenda do dia | |
| Hoje ao vivo | Concluídas até agora | |
| Hoje ao vivo | Sem técnico (canto da caixa A fazer) | |
| Resultado do período | Total de OS | |
| Resultado do período | OS Concluídas | |
| Resultado do período | Taxa de Conclusão e comparação | |
| Resultado do período | Taxa Improdutividade e comparação | |
| Motivos de improdutiva | Motivo mais comum e percentual | |
| Mês passado (atalho) | Taxa de Conclusão e Improdutividade | |

## Roteiro, bloco a bloco

### 1. Abertura (1 minuto)

**Na tela:** a Visão Geral de OS aberta no topo, sem clicar em nada.

**Fala sugerida:**

"Esta é a Visão Geral de Ordens de Serviço. Ela lê o SGI de produção
direto, sem planilha no meio. Foi montada para responder, de cima para
baixo: como está o dia agora, como foi o período, se está bom ou ruim, para
onde foi cada OS e onde agir. Vou seguir essa ordem."

### 2. Faixa de filtros (1 minuto e meio)

**Na tela:** apontar os atalhos Ontem, Esta semana, Semana passada, Este
mês e Mês passado. Clicar em "Mês passado", mostrar que a página inteira
muda, e voltar para "Este mês". Clicar em Expandir só para mostrar os
filtros, e recolher.

**Fala sugerida:**

"O período padrão vai do dia 1 até ontem. Hoje fica de fora de propósito:
de manhã as OS do dia ainda estão por fazer, e a taxa do mês parecia cair
sem ter caído. O dia de hoje tem uma faixa só dele, logo abaixo."

"Os filtros são Equipe, Técnico, Tipo de OS, Categoria, Cidade e Status. A
faixa fica presa no topo: mesmo rolando até o fim da página, dá para ver
qual recorte está na tela."

### 3. Hoje ao vivo (4 minutos)

**Na tela:** a faixa Hoje ao vivo. Apontar a hora da leitura e as caixas:
Agenda do dia, Concluídas, Em campo, A fazer, Improdutivas e Não
executadas.

**Fala sugerida:**

"Aqui é o agora. O SGI é relido a cada minuto, e a hora da última leitura
está aqui em cima. A Agenda do dia é tudo o que foi marcado para hoje, e as
caixas dividem essa agenda pela situação de cada OS."

**Momento principal:** o atalho "sem técnico", no canto da caixa A fazer.

"Este é o número mais importante da faixa. Medimos no SGI: das OS que
terminam o dia sem técnico, 94% viram não executadas. E quase toda
designação de técnico é feita no próprio dia, então ter OS sem técnico de
manhã é normal. Por isso existe uma régua de horário: até as 10h o número
fica cinza, é rotina. Depois das 10h para o turno da manhã, e das 15h para
o da tarde, ele fica âmbar e mostra só as atrasadas. Âmbar é hora de agir."

Clicar no atalho. A lista abre já filtrada nas OS sem técnico.

"A lista mostra código da OS, turno, tipo, categoria, cidade, equipe,
técnico, status e um detalhe. Cada coluna tem filtro e ordenação próprios.
Restaurar tabela volta ao começo."

Se houver OS de dias anteriores ainda abertas, o canto da caixa Em campo
mostra "1 de ontem" ou "N de dias anteriores". Clicar e mostrar.

**Atenção:**

- Se a apresentação for antes das 10h, o número estará cinza. Explique a
  régua em vez de esperar o âmbar.
- A faixa conta sempre o dia de hoje. Ela segue os filtros da página, menos
  período e status.

### 4. Resultado do período (5 minutos)

**Na tela:** a etiqueta do período no título (por exemplo "Setembro de
2026, até o dia 28") e os quatro cards.

**Fala sugerida, card a card:**

- **Total de OS:** "OS agendadas para o período, em qualquer status. A linha
  de baixo separa cliente e infraestrutura. A comparação fica cinza porque
  volume acompanha a agenda: não é bom nem ruim."
- **OS Concluídas:** "Visita feita e serviço entregue. Também em cinza, pelo
  mesmo motivo: menos OS concluídas num mês com menos agenda não é queda de
  desempenho."
- **Taxa de Conclusão:** "Aqui mora o bom ou ruim. A taxa é calculada só
  sobre as OS de cliente. A infraestrutura fica de fora porque tem outro
  ciclo: boa parte dela expira sem técnico. Misturando as duas, a taxa de
  01 a 18/09 caía de 79% para 69,6%, e a gente estaria medindo outra
  coisa."
- **Taxa Improdutividade:** "O técnico foi e não conseguiu executar.
  Também só sobre OS de cliente."

**Sobre a comparação:**

"Cada card diz com o que compara: 'vs. agosto até o dia 28' é o mês
anterior até o mesmo dia, para comparar recortes do mesmo tamanho. Nas
taxas, a diferença vem em pontos percentuais: de 84,5% para 82,3% são 2,2
pontos, e não 2,2%."

**Clique:** virar o card de Taxa de Conclusão.

"Cada card vira e mostra a leitura gerencial, escrita com os números do
recorte que está na tela, e um OBSERVAR, que diz onde agir. Aqui ela abre
quantas OS não concluíram e por quê, e o OBSERVAR aponta de volta para o
'sem técnico' da faixa de hoje."

Virar também o de Improdutividade, que cita o motivo mais comum.

**Planilha:** apontar "Baixar N OS em Excel", no título da faixa.

"Todas as OS do recorte, com os filtros aplicados, numa planilha pronta
para tabela dinâmica."

### 5. Destino das OS (2 minutos)

**Na tela:** o painel Destino das OS do período. Uma barra de 100% para
cliente e outra para infraestrutura, divididas em concluída, improdutiva,
não executada e em aberto.

**Fala sugerida:**

"Esta barra responde para onde foi cada OS. Cliente e infraestrutura
separados, cada um com o próprio ciclo. Não executada junta encerrada,
expirada e cancelada: é a OS que ninguém visitou. A expirada o SGI faz
sozinho, à meia-noite. A encerrada é alguém fechando à mão."

**Clique:** a fatia "Não executadas" de cliente. A janela abre com as OS.

"Cada fatia abre a lista daquelas OS. A janela tem filtro por coluna, e o
Baixar Excel leva exatamente o que ela mostra."

### 6. Composição do período (3 minutos)

**Na tela:** rolar até Composição do período.

**Fala sugerida, painel a painel:**

- **Volume diário de OS:** "Total e concluídas em barra, improdutivas em
  linha. O que procurar: dia com barra alta e conclusão baixa. Clicar no
  dia abre as OS daquele dia."
- **Motivos de improdutiva:** "Por que a visita falhou. Cliente ausente é
  cerca de metade de todas as improdutivas: não é problema de técnico, é de
  confirmação com o cliente antes da visita. As barras cinza no fim são as
  improdutivas sem motivo que a gente consiga ler, porque o técnico
  escreveu o motivo em texto livre." Clicar numa barra e mostrar a lista.
- **Composição por tipo de OS:** "Passando o mouse na fatia, aparecem as
  categorias que compõem aquele tipo."
- **Volume por cidade, Volume por categoria e Resoluções mais frequentes:**
  "Onde a operação atua e como as OS concluídas terminaram."

"Um detalhe: quando se filtra uma cidade, o painel de cidades não some. A
cidade escolhida fica em destaque no meio das outras, para não perder a
comparação. O mesmo vale para tipo e categoria."

### 7. Demonstração de filtro (2 minutos)

**Na tela:** aplicar o filtro escolhido na preparação. Sugestão: o tipo de
OS ou a equipe com a maior improdutividade do mês. Mostrar que cards,
Destino e Motivos respondem juntos. Depois, Limpar.

**Fala sugerida:**

"Tudo responde ao mesmo recorte. Se eu filtro esta equipe, vejo a taxa
dela, o destino das OS dela e os motivos dela."

**Se alguém pedir para filtrar Status:** os cards de taxa mostram "Não se
aplica". "Com um status só, a taxa seria sempre 0% ou 100%, então a página
prefere não mostrar número."

**Se filtrar Equipe ou Técnico:** o detalhe das taxas avisa "sem as OS sem
técnico". "OS sem técnico não tem equipe. Por isso, somando as equipes, a
taxa fica maior do que a da empresa."

### 8. Gestão de Técnicos (3 minutos, opcional)

**Na tela:** menu Ordens de Serviço, Gestão de Técnicos. Mesma faixa de
filtros.

**Fala sugerida:**

- **Cards:** "Técnicos em campo, concluídas por dia de campo, tempo por
  visita e ocupação do dia. Concluídas por dia divide pelos dias em que o
  técnico saiu, e não pelos dias do mês: quem tirou férias não aparece pior
  por isso."
- **Ranking por frente de trabalho:** "Quem faz câmera não é comparado com
  quem faz internet. Só entra no ranking quem tem pelo menos 5 dias de
  campo no período."
- **Por que a visita não aconteceu:** "Contexto da operação, e não
  avaliação do técnico. A improdutiva fica fora do ranking de propósito."

**Atenção:**

- Estes cards ainda não têm comparação com o período anterior. A regra
  dessa comparação não foi definida.
- A tabela mostra nome de técnico. Se a plateia for ampla, decidir antes se
  é o caso de exibir isso no telão.

### 9. Fechamento (2 minutos)

**Fala sugerida:**

"Resumindo: o dia, o período, o destino de cada OS e o porquê, na mesma
página, lendo o SGI direto. O que ela já deixou claro: a OS sem técnico é o
aviso antecipado da não executada, e metade das improdutivas é cliente
ausente."

**Próximos passos, todos ainda propostas, sem data:**

- Destino por tipo de OS, o próximo gráfico combinado.
- Evolução mês a mês das duas taxas, para mostrar a tendência.
- Retrabalho (cliente com duas visitas ou mais) e espera até a visita.
  Dependem de dois campos novos no serviço de BI, trabalho com o André.
- Referência de horário na faixa Hoje: "num dia típico, a esta hora, X%
  concluído".
- Detalhe de uma OS com a linha do tempo dela. Também depende do serviço.

## O que pedir à diretoria

1. **Régua de bom ou ruim.** Existe meta de Taxa de Conclusão e de
   Improdutividade? Hoje a página compara só com o período anterior. Como
   referência, a média dos três meses fechados (junho a agosto) foi 80,5% de
   conclusão e 13,5% de improdutividade.
2. **Equipe gravada na OS, no SGI.** Hoje a equipe vem do cadastro atual do
   técnico: trocar a equipe de um técnico reescreve o histórico inteiro
   dele, e OS sem técnico não tem equipe nenhuma.
3. **Lista fechada de motivo de encerramento, no SGI.** Hoje é texto livre
   (registros só com um ponto, "duplicada" escrito de quatro jeitos), e por
   isso não entra na tela.
4. **Prioridade entre os próximos passos** do bloco 9.

## Perguntas prováveis

**"Esse número bate com o SGI?"**
Sim. Em 22/09 conferimos agenda do dia, total do período, concluídas, OS de
cliente e de infraestrutura contra o banco, e bateram. Um dia passado pode
mudar entre uma leitura e outra porque o próprio SGI muda o status depois,
por exemplo quando alguém encerra à mão uma OS expirada.

**"Por que a infraestrutura não entra na taxa?"**
Porque tem outro ciclo. Em setembro, até o dia 22, 61% das OS de
infraestrutura não foram executadas, quase todas expiradas sem técnico.
Misturar derrubava a taxa em cerca de dez pontos. Ela aparece no Total, nas
Concluídas e com barra própria no Destino.

**"Por que o período para em ontem?"**
Com hoje dentro, de manhã a taxa do mês cai por estrutura, não por
resultado: as OS de hoje ainda estão por fazer. O dia de hoje tem a faixa
própria.

**"A não executada é falta de técnico ou agenda cheia demais?"**
O SGI não registra o porquê. A página só afirma o que está gravado: a OS
expirou sem técnico ou foi encerrada à mão. Não especular.

**"Por que a equipe 'Sem equipe' tem taxa tão baixa?"**
Porque é quase só OS que ninguém pegou, o mesmo problema do "sem técnico".
Não é uma equipe com desempenho ruim.

**"O que é 'Motivo não especificado'?"**
O técnico escolheu, no aplicativo, a opção "especificar nas observações", e
o motivo real ficou em texto livre no SGI.

**"Por que o histórico de um técnico mudou?"**
A equipe vem do cadastro atual. Se ele mudou de equipe, o histórico todo
passa a contar na equipe nova. Ver o pedido 2 à diretoria.

**"De quanto em quanto tempo atualiza?"**
A faixa Hoje ao vivo, a cada minuto. O resto da página é lido quando a
página abre; para atualizar, recarregar.

**"Dá para levar para o Excel?"**
Sim: "Baixar N OS em Excel" no título do Resultado do período, e "Baixar
Excel" em cada lista aberta pelo clique.

**"E as outras páginas do menu de Ordens de Serviço?"**
Só a Visão Geral e a Gestão de Técnicos leem o SGI. As demais ainda usam
dados simulados, com a etiqueta "Dados simulados" no cabeçalho, e não devem
ser mostradas como número real.

## O que não dizer

- Não mostrar página com a etiqueta "Dados simulados" como se fosse real.
- Não dizer que a não executada é falta de técnico ou de capacidade: o SGI
  não registra o motivo.
- Não tratar improdutiva como culpa do técnico: cerca de metade é cliente
  ausente.
- Não comparar técnicos de frentes diferentes.
- Não falar "queda de 2%" quando o card diz "2 p.p.".
- Não prometer data para os próximos passos: parte depende do serviço de BI.

## Números de apoio, medidos no SGI de produção

Medição, não meta. Usar como contexto na fala, com a data.

| Fato | Número | Medido em |
| --- | --- | --- |
| Taxa de Conclusão de cliente, jun, jul, ago | 75,3%, 81,3%, 84,5% | 22/09/2026 |
| Taxa Improdutividade de cliente, jun, jul, ago | 16,0%, 13,2%, 11,4% | 22/09/2026 |
| OS sem técnico no fim do dia que viraram não executadas | 137 de 145 (94%), em 14 dias | 22/09/2026 |
| OS designadas no próprio dia da visita | 999 de 1.112 em setembro | 22/09/2026 |
| Parte das conclusões do dia já feita às 10h, 12h, 15h e 18h | 12%, 35%, 63%, 90% | 22/09/2026 |
| Cliente ausente entre os motivos de improdutiva | 49,7% de 777 OS | 22/09/2026 |
| Clientes com duas visitas ou mais em setembro | 21% | 22/09/2026 |
| OS de infraestrutura não executadas em setembro | 61% de 231 | 22/09/2026 |
| Improdutividade por tipo: câmeras, instalação, mudança, infra | 19,1%, 11,6%, 10,4%, 3,7% | 18/09/2026 |
| Técnicos em campo por dia útil em setembro | 17 a 24 | 18/09/2026 |

A tendência de junho a agosto é o gancho do fechamento: conclusão subindo
e improdutividade caindo três meses seguidos. Conferir o mês de setembro
com o atalho "Mês passado" quando ele fechar.
