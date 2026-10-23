# Reunião com Vagner, 18/09/2026, 15h
# Status do IMPACTO BI

Arquivo local de apoio. Não versionar.

--------------------------------------------------------------------------
## 0. Mensagem em 30 segundos (abra com isso)
--------------------------------------------------------------------------

A Visão Geral Comercial já lê o banco SGI de verdade, pelo serviço do
André, e bate com o Relatório de Vendas do SGI. Nas últimas duas semanas
fechamos as regras de negócio que faltavam (o que é venda ativada, PF x PJ,
data da venda) e trocamos os cards que dependiam de dado que não existe
(meta) por indicadores que o gestor consegue agir em cima.

Hoje existem duas frentes:
1. Um pacote pronto esperando o André mesclar em produção (develop -> main),
   nos dois repositórios.
2. Um card em andamento, "Vendas do período", ainda não fechado.

O que eu preciso do Vagner: prioridade do próximo bloco e, se possível,
destravar o merge com o André.

--------------------------------------------------------------------------
## 1. O que já está em produção (branch main)
--------------------------------------------------------------------------

Portal (impacto-bi-web), último merge em main: 16/09/2026.
Serviço (impacto-bi-service), último merge em main: 17/09/2026.

Estrutura do portal:
- Login, perfis de acesso, usuários, histórico de usuários, preferências.
- Sidebar por departamento, Visão Geral corporativa.
- Visão Geral de OS (Ordens de Serviço) com filtros, calendário operacional,
  técnicos, improdutivas, motivos de encerramento, auditoria técnica etc.
- Visão Geral Comercial ligada ao serviço.

Como falar da origem dos dados, sem enrolar:
- Comercial: dado REAL, vindo do banco SGI pelo serviço do André.
- OS: dado real, mas em foto congelada (um arquivo extraído do banco que
  viaja dentro do próprio site). Não é ao vivo ainda.
- Demais páginas de departamento: dado mockado, servem de layout e de
  proposta de indicador. Nunca apresentar como número real.

--------------------------------------------------------------------------
## 2. Pronto, esperando ir para produção
--------------------------------------------------------------------------

Estão na develop dos dois repositórios, com MR aberto develop -> main em
18/09/2026:
- Portal: MR !33 (13 commits à frente da main).
- Serviço: MR !5 (8 commits à frente da main).
- Quem mescla é o André. Eu não tenho o botão de merge.

O que esse pacote entrega na Visão Geral Comercial:
- Vendas ativadas pela regra correta: venda só conta como ativada quando
  o sinal foi ligado (OS de instalação concluída, ou data de início com
  status pós-ativação). Antes usava uma data que não significava ativação.
- Linha de origem nas ativações: "X do período, Y de vendas anteriores".
  Medimos que 8 a 10% das vendas ativam só no mês seguinte, então
  separar isso evita ler crescimento falso.
- Cortesia fora da venda ativada.
- Filtro de tipo de cliente (PF x PJ), pelo tipo de documento.
- Filtro de vendedor com campo de digitação, ligado ao serviço.
- Card "Tempo até a ativação" (dias entre contrato e sinal ligado), no
  lugar da Meta Comercial, que ficou suspensa por falta de meta definida.
- Card "Novos Clientes" com composição.
- Card "Aguardando Ativação" narrando o fluxo por etapa.
- Evolução mensal das vendas sem a divisão por time.
- Painel "Safra de vendas por mês": cada barra é um mês de venda, dividida
  em ativada, aguardando e cancelada, com o total vendido em cima. Foi
  mesclado na develop hoje, depois da abertura dos MRs, então os MRs já
  carregam a Safra também. Vale avisar o André.
- Filtro de data próprio e cobertura real do banco no Comercial.
- Identidade: sidebar branca com faixa escura, filtros de OS no verde.

Estado: implementado e validado com a conferência automática do projeto.
Não está em produção enquanto o André não mesclar.

--------------------------------------------------------------------------
## 3. Em andamento agora (não commitado)
--------------------------------------------------------------------------

Branch feat/vendas-do-periodo, 8 arquivos alterados, ainda fora do Git.

O card "Aguardando Ativação" está virando "Vendas do período":
- Destaque no total vendido no período.
- Barra com as três saídas da venda (ativada, aguardando, cancelada), nas
  mesmas cores da Safra, para os dois lerem igual.
- Etapas do fluxo só na leitura em frase, sem prazo. Prazo/SLA é outra
  conversa, não é assunto desse card.

Estado: em construção. Não afirmar que está pronto. Se perguntarem
quando: é fechamento de card, não é bloco novo, previsão de dias e não
de semanas.

--------------------------------------------------------------------------
## 4. Decisões de regra de negócio já tomadas (para o Vagner validar)
--------------------------------------------------------------------------

Isso é o que mais vale mostrar. Foi medido no banco, não chutado.

- Venda conta pela data de contratação (contracted_at), igual ao SGI.
  Essa data é meia-noite em UTC. Converter para horário de SP joga a venda
  para o dia anterior, então o BI mantém UTC para bater com o SGI.
- Venda ativada = sinal ligado. Regra em 3 níveis: OS de instalação
  concluída; senão data de início com status pós-ativação; senão não é
  ativada.
- PF x PJ pelo tipo de documento (CPF ou CNPJ).
- Cliente novo contado pelo código do cliente é confiável: cadastro
  duplicado por CPF é 0,25%.
- Indicação de cliente não é venda do vendedor.
- Vendedor só existe no banco a partir de 2026. Antes disso o filtro fica
  vazio, não é erro.
- Meta comercial: suspensa até alguém definir meta. O card foi trocado.
- Bairro descartado como filtro (dado ruim).
- Fluxo da OS: pendente = sem assinatura; agendada nunca volta; reagendar
  gera OS nova; encerrada é manual com motivo livre. Nova visita após
  improdutiva leva até 7 dias em 90% dos casos (fato medido, não é meta).

Pergunta para ele: alguma dessas regras conflita com o que a diretoria
espera ver? Em especial a meta e a definição de ativada.

--------------------------------------------------------------------------
## 5. Riscos e pendências (fale antes que perguntem)
--------------------------------------------------------------------------

- Merge depende do André. Dois MRs parados travam tudo o que vem depois.
- OS ainda é foto congelada. Ligar OS ao serviço é o próximo bloco grande
  e depende de rota nova no serviço do André.
- Banco: hoje o portal em desenvolvimento aponta para o banco de dev do
  SGI. Produção do BI vai precisar do acesso de leitura ao banco de
  produção configurado no serviço, sem credencial no portal.
- Segurança: perfis e permissões existem no portal, mas a persistência
  ainda é local (mockada). Não é segurança de produção. Autenticação de
  verdade precisa vir do serviço.
- Meta comercial sem dono. Sem meta, não tem "bom ou ruim" no Comercial.
- Documentação versionada (README, AGENTS, TASK, DESIGN) está congelada
  por orientação dos devs até a fase de conexão ao banco. Está
  desatualizada de propósito.

--------------------------------------------------------------------------
## 6. O que eu preciso sair da reunião sabendo
--------------------------------------------------------------------------

1. Prioridade do próximo bloco. Opções reais:
   a) Ligar a Visão Geral de OS ao serviço (dado ao vivo), tirando a foto
      congelada do site. Recomendo esta, é o que dá mais valor e menos
      retrabalho.
   b) Aprofundar o Comercial (drill por vendedor, por plano, cancelamento).
   c) Iniciar outro departamento com dado real.
2. Quem define a meta comercial e quando. Sem isso o card fica suspenso.
3. Se o Vagner pode pedir ao André para mesclar os MRs !33 e !5, ou se
   ele mesmo revisa. Vagner é o revisor preferencial.
4. Quando entra a autenticação real (login pelo serviço) na fila do André.
5. Data alvo para o BI Comercial ir para uso real dos gestores.

--------------------------------------------------------------------------
## 7. Roteiro de fala (ordem sugerida, 15 minutos)
--------------------------------------------------------------------------

1. Mensagem de 30 segundos (item 0).
2. Mostrar a Visão Geral Comercial na tela, com a develop rodando, e
   comparar um número com o Relatório de Vendas do SGI. Isso é a prova.
3. Passar pelas regras decididas (item 4). Pedir validação.
4. Pacote esperando merge (item 2) e o card em andamento (item 3).
5. Riscos (item 5), curto.
6. Fechar com as 5 perguntas (item 6). Sair com prioridade definida.

Dicas:
- Não abrir arquivo, log ou código na reunião. Só a tela do portal.
- Se ele perguntar "está pronto?": o Comercial está pronto para uso
  interno assim que o André mesclar. O resto não.
- Se ele perguntar "por que a meta sumiu?": não sumiu, foi suspensa
  porque ninguém definiu meta; o código está guardado e volta quando
  houver número.
- Diferenciar sempre: em produção, pronto esperando merge, em andamento,
  proposta.

--------------------------------------------------------------------------
## 8. Números úteis de bolso
--------------------------------------------------------------------------

- 13 commits do portal e 8 do serviço esperando merge.
- 8 a 10% das vendas de um mês ativam só no mês seguinte.
- Cerca de 9% das ativações de um mês vêm de vendas de meses anteriores.
- Cadastro duplicado por CPF: 0,25%, irrelevante.
- Nova visita após improdutiva: até 7 dias em 90% dos casos.
- Vendedor no banco só a partir de 2026.
