# Investigação e planejamento: Bloqueio Financeiro na Visão Geral Comercial

Data: 15/10/2026  
Projetos envolvidos:

- Portal: `C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web`
- Serviço: `C:\Users\Impacto Telecom\Documents\impacto-bi-service`

## Objetivo deste documento

Registrar a conversa, as evidências encontradas e o planejamento proposto para corrigir a lentidão e a ausência eventual de informação no card **Bloqueio ou cancelamento em 90 dias**, chamado inicialmente de Bloqueio Financeiro.

O documento foi criado para confronto com uma análise independente do Claude Code. Ele descreve o estado apurado até agora. Nenhuma correção foi implementada nesta investigação.

## Situação atual do trabalho

- Diagnóstico: concluído por leitura do portal e do serviço.
- Causa do card permanecer sem informação: confirmada no código.
- Desempenho atual da consulta no banco de produção: não medido.
- Solução: proposta e planejada, ainda não implementada.
- Código alterado: nenhum.
- Git: nenhuma ação mutável executada.

## Resumo da conversa

### Pedido inicial do Mário

Investigar por que o card de Bloqueio Financeiro da Visão Geral Comercial apresenta certa lentidão e, algumas vezes, carrega sem dados. As hipóteses iniciais eram:

- card pesado no navegador;
- quantidade elevada de cálculos;
- consulta ruim no banco;
- outra falha no caminho dos dados.

### Resultado da investigação

O card não é pesado no navegador. Ele recebe do serviço somente totais já calculados e executa operações simples: soma, divisão, comparação e formatação. A barra do card é feita com elementos HTML e duas partes. Não usa ECharts e não percorre a lista de contratos.

O trabalho relevante ocorre no serviço, que consulta o histórico de bloqueio e desbloqueio dos contratos para descobrir a situação de cada venda no 90º dia após o sinal ligado.

A causa comprovada para o card permanecer em **Sem dado** é a combinação de dois comportamentos:

1. O serviço inicia a leitura do histórico em segundo plano e entrega o restante da Visão Geral sem aguardar essa leitura.
2. Quando a leitura termina, a tela que já está aberta não consulta novamente o serviço.

Assim, o resultado pode estar pronto no serviço e o card continuar em **Sem dado** até que o usuário atualize a página ou altere algum filtro.

### Solução apresentada na conversa

A recomendação foi criar um estado explícito para o indicador e permitir que a tela acompanhe o processamento até o resultado ficar pronto. O serviço deve informar se o histórico está sendo preparado, está pronto, falhou temporariamente ou não pode ser medido por falta de cobertura. A tela deve consultar um andamento leve e atualizar o card automaticamente.

Também foi recomendado eliminar uma consulta completa desnecessária na abertura: atualmente a página começa com o período da base fictícia, encerrado em julho de 2026, e depois corrige para o período da fonte real, o que pode provocar duas consultas completas em sequência.

### Mudança de autonomia

No início da conversa, o repositório `impacto-bi-service` estava limitado a leitura e qualquer alteração deveria ser encaminhada ao André.

Mário informou que André não está mais na empresa e autorizou autonomia para alterar também o serviço. Para esta correção, o trabalho pode abranger os dois projetos, com implementação e validação local. Publicação, ações mutáveis de Git e mudanças fora do escopo continuam sem autorização automática.

## Evidências no portal

### O card é leve

Arquivos principais:

- `src/Pages/Commercial/Overview/overviewMaturityModel.ts`
- `src/Pages/Commercial/Overview/Overview.tsx`
- `src/Pages/Commercial/Overview/commercialOverviewApi.ts`

O navegador recebe um bloco com:

- quantidade de dias;
- início e fim da janela de ativações;
- total de vendas avaliadas;
- total em bloqueio financeiro;
- total cancelado.

O percentual é calculado como:

```text
(bloqueadas + canceladas) / vendas avaliadas
```

Não existe leitura de histórico, cálculo por contrato ou gráfico pesado dentro do card.

### O valor nulo vira Sem dado

Em `commercialOverviewApi.ts`, a ausência do bloco `maturity` é aceita e convertida para `null`.

Em `Overview.tsx`, `maturity === null` monta o card com **Sem dado**, sem comparação e sem barra.

Esse estado é diferente de:

- recorte válido sem vendas, exibido como **Sem vendas**;
- vendas avaliadas sem bloqueio nem cancelamento, exibidas como **0,0%**.

Portanto, o problema não é divisão por zero nem confusão entre ausência de bloqueios e ausência de informação.

### A tela não tenta novamente

A consulta da Visão Geral ocorre ao montar a página e quando os filtros mudam. Se a resposta chega com `maturity: null`, ela é tratada como resposta bem-sucedida. Não há acompanhamento automático específico para esse indicador.

O selo geral da fonte ainda pode ficar como pronto porque ele considera a existência do restante do resumo, e não a disponibilidade do histórico do card.

### Requisições anteriores não são interrompidas ao trocar filtros

Quando os filtros mudam, a tela impede que o resultado antigo seja aplicado, mas não encerra de imediato a requisição anterior. O cliente HTTP só possui o limite geral de 30 segundos.

Mudanças rápidas de filtro podem deixar mais de uma consulta completa em andamento. O impacto real disso no ambiente em uso ainda precisa ser medido.

### A abertura pode consultar dois períodos

O filtro inicial do portal usa a cobertura da base fictícia:

```text
2026-01-01 a 2026-07-31
```

Depois da primeira resposta, a tela descobre a cobertura real, corrige o período e dispara outra consulta.

Em outubro de 2026, isso pode significar uma consulta de julho seguida por outra do período correto. A existência dessa sequência está confirmada no código. O tempo adicional não foi medido.

## Evidências no serviço

Arquivo principal:

`app/services/bi/commercial_overview.py`

### Funcionamento do histórico

A classe `BlockedAtMaturity` guarda a última lista válida de contratos bloqueados no 90º dia.

O comportamento atual é:

- sem leitura pronta, inicia a consulta em segundo plano e devolve ausência imediatamente;
- uma leitura válida pode ser renovada após 30 minutos;
- uma leitura com seis horas deixa de valer;
- a consulta SQL tem limite de 60 segundos;
- após falha, o serviço aguarda cinco minutos antes de permitir outra tentativa;
- uma leitura válida anterior é preservada enquanto ainda puder ser usada;
- o resultado fica somente na memória do processo;
- reiniciar o serviço perde o resultado guardado;
- não existe agendamento independente, a leitura começa ou renova quando uma chamada da Visão Geral chega ao serviço.

Isso explica por que a primeira abertura depois de reiniciar o serviço, ou depois de longa inatividade, pode apresentar **Sem dado** mesmo quando a consulta está saudável.

### O resultado vazio não fica preso no cache do resumo

A disponibilidade do histórico participa da identificação usada pelo cache da Visão Geral. Quando a leitura termina, uma nova requisição consegue receber o indicador preenchido.

Isso evita que o serviço continue devolvendo para sempre uma resposta montada antes da leitura. Porém, não atualiza o navegador que já recebeu a resposta anterior.

### Trabalho executado pela consulta

A consulta do histórico:

- lê eventos de bloqueio e desbloqueio desde o início da base;
- materializa esse conjunto;
- cruza os eventos com contratos;
- ordena os eventos para identificar o último estado até o fim do 90º dia;
- produz uma lista compartilhada de contratos bloqueados, sem depender do período ou dos demais filtros escolhidos na tela.

O código também configura a consulta para evitar alguns caminhos por índice, cruzamento linha a linha e paralelismo. Essas decisões foram tomadas com base em medições anteriores.

Comentários de 28/09/2026 registram aproximadamente 1,4 milhão de linhas no histórico e execução entre 6 e 14 segundos em determinada condição. Esses números são históricos e não representam medição realizada nesta investigação.

Não existe evidência suficiente para afirmar que a consulta atual esteja mal escrita, que falte índice ou que aumentar o limite resolva. Qualquer alteração na consulta deve partir do plano real de execução e de uma medição atual.

### O formato da resposta não informa a causa

O serviço devolve `maturity` com seis campos ou devolve valor nulo. Não informa:

- preparando;
- pronto;
- falhou;
- aguardando nova tentativa;
- leitura expirada;
- período fora da cobertura;
- horário da última leitura válida.

Por isso, o portal não consegue escolher corretamente entre **Calculando**, **Indisponível** e **Sem cobertura**.

## Regras de negócio que precisam ser preservadas

- O indicador mede as vendas ativadas que completaram 90 dias dentro do período selecionado.
- O período recorta o 90º dia, não o dia do sinal ligado.
- Cidade, time, vendedor e tipo de cliente continuam aplicados.
- Cancelamento ocorrido até o 90º dia tem prioridade sobre bloqueio, evitando dupla contagem.
- Cancelamento sem a venda ter se tornado cliente continua fora da base.
- Período que exige ativações anteriores ao início da base fica sem medição, pois medir apenas parte seria enganoso.
- Recorte válido sem vendas continua sendo **Sem vendas**.
- Recorte válido com vendas e nenhum bloqueio ou cancelamento continua sendo **0,0%**.
- O nome do indicador e sua fórmula não devem mudar sem decisão do Mário.
- A comparação com o período anterior precisa continuar usando a mesma regra.

## Planejamento recomendado

### Etapa 1: conferir o estado atual dos dois projetos

1. Ler integralmente os arquivos envolvidos e os testes próximos.
2. Conferir alterações preexistentes nos dois repositórios e preservá-las.
3. Confirmar as rotas, os modelos de resposta, o cache e a forma como o serviço é iniciado.
4. Ler as skills locais `modelo-de-pagina` e `graficos-impacto` antes de alterar o card ou seu estado visual.
5. Não fazer ação mutável de Git.

### Etapa 2: definir o formato de estado do histórico

Criar no serviço uma resposta explícita para o estado da leitura. Uma direção possível:

```text
status: pending | ready | unavailable | out_of_coverage
retry_after_seconds: número opcional
read_at: data e hora opcional
```

O formato final deve seguir o estilo atual dos modelos do serviço. O campo `maturity` pode continuar opcional para compatibilidade, mas o portal novo não deve depender apenas do valor nulo para decidir a mensagem.

O estado deve permitir distinguir:

- primeira leitura em andamento;
- renovação em andamento com leitura anterior ainda válida;
- falha com pausa antes da próxima tentativa;
- ausência por cobertura insuficiente;
- resultado pronto.

### Etapa 3: criar uma consulta leve de andamento

Adicionar uma rota pequena, protegida pelo mesmo acesso da Visão Geral Comercial, para consultar o estado do histórico sem recalcular todo o resumo e sem reler todas as vendas.

Essa rota deve:

- consultar apenas o estado guardado em memória;
- informar quando uma nova tentativa pode ocorrer;
- não iniciar leituras duplicadas;
- não carregar a base geral de vendas;
- não expor detalhes internos ou dados sensíveis.

Deve ser decidido no código se a própria rota de andamento pode iniciar a primeira leitura ou se a Visão Geral continua responsável por isso. A escolha precisa garantir uma leitura por vez.

### Etapa 4: acompanhar o processamento no portal

Quando o resumo chegar com estado `pending`:

1. Mostrar **Calculando** no card.
2. Manter os demais indicadores disponíveis.
3. Consultar o andamento em intervalo moderado.
4. Encerrar o acompanhamento quando ficar pronto, falhar, sair da página ou atingir o limite previsto.
5. Quando ficar pronto, atualizar o indicador. Se o contrato atual exigir, fazer uma única nova consulta do resumo para atualizar também o período anterior.

O acompanhamento deve:

- usar relógio simulado nos testes;
- cancelar o temporizador ao desmontar a página;
- impedir que resposta de filtros antigos seja aplicada ao recorte atual;
- não rodar quando a página usa dados fictícios;
- respeitar `retry_after_seconds` em caso de falha;
- permitir tentativa manual depois de uma falha ou do limite de acompanhamento.

### Etapa 5: corrigir a consulta inicial ao período fictício

Evitar uma consulta completa de julho apenas para descobrir a cobertura real.

Opções a avaliar no código atual:

1. Criar ou aproveitar uma rota leve de cobertura e catálogo antes do resumo.
2. Permitir que a primeira consulta do resumo seja feita sem datas e deixar o serviço aplicar o período padrão da fonte real.
3. Retornar cobertura por uma chamada já existente que não exija a agregação completa.

Recomendação inicial: preferir a opção que reutilize a regra de período já existente no serviço e evite duplicar no portal a lógica de datas. A escolha final depende da leitura do contrato atual e dos consumidores da rota.

Também é necessário impedir que a resposta dessa descoberta substitua uma escolha de período feita pelo usuário enquanto a chamada estava em andamento.

### Etapa 6: cancelar consultas superadas

Permitir que a página passe um sinal de cancelamento ao cliente HTTP. Ao mudar filtros ou sair da página, a requisição anterior deve ser encerrada no navegador.

Isso evita trabalho e respostas desnecessárias no portal. É preciso reconhecer que cancelar no navegador não garante que uma consulta já iniciada no servidor ou no banco seja interrompida. A proteção principal contra leitura histórica duplicada continua no serviço.

### Etapa 7: testes do serviço

Cobrir pelo menos:

- primeira leitura em andamento;
- leitura pronta;
- falha e pausa de cinco minutos;
- renovação mantendo a última leitura válida;
- expiração depois de seis horas;
- uma leitura por vez;
- rota de andamento sem carregar vendas;
- autenticação e autorização da nova rota;
- período fora da cobertura;
- comparação do período anterior;
- compatibilidade da resposta durante a transição entre versões.

Usar relógio e executor simulados. Não esperar minutos reais nos testes.

### Etapa 8: testes do portal

Cobrir pelo menos:

- primeira resposta pendente e atualização automática quando pronta;
- falha, limite de acompanhamento e tentativa manual;
- troca de filtros durante o acompanhamento;
- saída da página durante o acompanhamento;
- cancelamento da requisição superada;
- período fora da cobertura;
- recorte sem vendas;
- resultado de 0%;
- comparação com período anterior;
- modo de dados fictícios sem acompanhamento;
- abertura sem consulta completa desnecessária a julho.

### Etapa 9: validação

No portal:

```powershell
npm run lint
npm test
npm run build
```

No serviço:

1. Identificar os comandos oficiais e o ambiente virtual já existente.
2. Rodar primeiro os testes diretamente relacionados à Visão Geral Comercial.
3. Rodar as demais verificações proporcionais ao risco da alteração.
4. Não consultar nem alterar o banco real apenas para validar a lógica de estados.

Depois, fazer uma validação manual local com o portal e o serviço:

- simular o histórico pendente;
- verificar o texto **Calculando**;
- concluir a leitura;
- confirmar o aparecimento automático do número;
- trocar filtros durante o processo;
- simular falha e confirmar a tentativa manual;
- observar quantas chamadas completas são feitas na abertura.

### Etapa 10: revisões finais

Executar os revisores locais:

- `revisor-convencoes`;
- `revisor-dados`;
- `revisor-graficos`.

Corrigir achados relacionados ao escopo antes de encerrar.

## Compatibilidade e publicação

A implementação deve prever a convivência temporária entre versões:

- portal antigo com serviço novo não deve quebrar;
- portal novo deve tratar serviço antigo de forma segura durante a transição, se os projetos não forem publicados juntos;
- qualquer dependência obrigatória deve ser declarada no relatório final.

A direção preferida é manter `maturity` compatível e adicionar o estado novo. Mesmo assim, a solução completa exige portal e serviço atualizados. Se a recuperação automática depender da nova rota, publicar apenas o portal novo não resolve o problema.

Antes da implementação, deve ser definido se os dois projetos serão publicados juntos. Nenhuma publicação foi autorizada nesta conversa.

## Pontos para o Claude Code confrontar

O Claude Code deve revisar criticamente estas conclusões:

1. Existe uma solução mais simples que uma rota de andamento sem repetir a consulta geral?
2. O estado do histórico deveria estar dentro da própria resposta da Visão Geral, em uma rota separada ou nas duas?
3. A rota de andamento deve iniciar a leitura ou apenas observá-la?
4. Como manter compatibilidade se portal e serviço forem publicados em momentos diferentes?
5. É seguro manter o resultado apenas na memória do processo no modo real de publicação?
6. O ambiente usa mais de um processo ou mais de uma instância? Se usa, cada processo pode manter estado diferente e iniciar sua própria leitura.
7. Existe uma rota leve de cobertura já pronta que elimine a primeira consulta a julho?
8. Cancelar a requisição no navegador produz benefício relevante no serviço atual?
9. Que métricas ou registros devem ser adicionados para medir duração, falha e frequência da leitura histórica sem expor dados?
10. O SQL atual deve permanecer intacto nesta correção ou alguma mudança é indispensável para o novo fluxo?

O confronto deve separar claramente:

- erro confirmado;
- risco provável;
- preferência de arquitetura;
- otimização que depende de medição.

## Validações já realizadas nesta investigação

No portal foram executadas 102 verificações direcionadas aos arquivos:

- `overviewMaturityModel.test.ts`;
- `commercialOverviewApi.test.ts`;
- `Overview.render.test.tsx`.

Resultado: 102 verificações aprovadas, nenhuma falhou.

Essas verificações comprovam fórmulas, conversão da resposta e apresentação dos estados existentes. Elas não medem o desempenho do banco e não cobrem recuperação automática após `maturity: null`.

Também foi executada uma simulação isolada, sem banco, da classe que guarda o histórico. Ela confirmou:

- primeira chamada sem leitura pronta devolve ausência e agenda a leitura;
- terminar a leitura não muda a resposta já entregue ao navegador;
- uma nova chamada recebe o resultado;
- depois de seis horas, a leitura expira e a próxima chamada volta a receber ausência enquanto uma nova leitura começa.

## Limitações da investigação

- O portal local estava na tela de login, sem sessão autenticada.
- Não foi usado login, senha ou credencial.
- Não houve consulta ao banco SGI.
- Não houve medição atual da consulta em produção.
- Não foram lidos registros de execução do serviço em produção.
- Não foi confirmado se a publicação real usa um ou vários processos ou instâncias.
- Não foram executados testes do serviço durante a investigação.
- Nenhuma correção foi implementada.

## Resultado esperado depois da correção

Ao abrir a Visão Geral Comercial após reinício ou expiração da leitura:

1. Os demais indicadores aparecem normalmente.
2. O card mostra **Calculando**.
3. O serviço executa somente uma leitura histórica.
4. A tela acompanha um estado leve.
5. Quando a leitura termina, o número aparece automaticamente.
6. Em falha, o card mostra uma mensagem clara e informa quando é possível tentar novamente.
7. Período sem cobertura, recorte sem vendas e resultado zero continuam distintos.
8. A abertura não faz uma consulta completa desnecessária ao período fictício de julho.

## Instrução pronta para o Claude Code

Analise este documento e confronte o diagnóstico e o planejamento com o código atual dos dois projetos. Não altere arquivos durante a primeira revisão. Para cada divergência, informe arquivo e linha, descreva o comportamento atual e classifique como erro confirmado, risco, preferência ou hipótese que exige medição. Dê atenção especial ao contrato de estado do histórico, à necessidade de uma rota leve, à compatibilidade entre versões, ao número real de processos do serviço e à eliminação da consulta inicial ao período fictício. Ao final, proponha o menor plano seguro que resolva o card preso em **Sem dado** sem multiplicar consultas ao SGI.
