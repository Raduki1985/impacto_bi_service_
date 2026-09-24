# Estado do projeto e próximos blocos

Atualizado em 24/09/2026. Este arquivo diz o que existe e o que vem a seguir; regras permanentes ficam no `AGENTS.md` e o sistema visual no `DESIGN.md`. O plano original da migração do protótipo, concluída em julho de 2026, continua no histórico do Git deste arquivo.

## O que existe

- **Estrutura do portal**: departamentos no cabeçalho, menu lateral próprio de cada departamento, rotas derivadas dos catálogos (`src/config`), Perfis do Sistema (Administrador, Executivo, Analista), Perfis de Acesso, Usuários, Histórico e Preferências, com tema claro e escuro.
- **Login e cadastros no serviço** (24/09/2026): login com senha conferida pelo `impacto-bi-service`, primeiro acesso e recuperação de senha por e-mail, e Usuários, Perfis de Acesso e Menu Itens gravados no serviço. As preferências de tela continuam no navegador.
- **Visão Geral Executiva**: desligada desde 23/09/2026 por uma chave única (`CORPORATE_HOME_ENABLED`). Cada usuário entra na Visão Geral do departamento inicial escolhido em Preferências; sem escolha, Ordens de Serviço.
- **Ordens de Serviço, Visão Geral**: ligada ao serviço de BI. Hoje ao vivo (a agenda do dia, lida a cada minuto), quatro indicadores com leitura gerencial calculada sobre o recorte, taxas sobre as OS de cliente, Destino das OS, Motivos de improdutiva, Volume diário e composição por tipo, cidade, categoria e resolução. O clique num painel abre a lista das OS daquele pedaço, com filtro por coluna e planilha do Excel. É a página modelo do portal desde 24/09/2026.
- **Ordens de Serviço, Técnicos**: ligada ao serviço, com a mesma faixa de filtros da Visão Geral.
- **Ordens de Serviço, demais páginas**: dados simulados, com o aviso no cabeçalho.
- **Comercial, Visão Geral**: ligada ao serviço; os números batem com o Relatório de Vendas do SGI (venda ativada pelo sinal ligado, PF e PJ pelo documento, vendedor, safra de vendas por mês, tempo até a ativação).
- **Comercial, Vendas por Período e Metas e Desempenho**: base sintética.
- **Demais departamentos**: Visão Geral com o painel de etapa futura.
- **Componentes compartilhados** (24/09/2026): faixa de filtros com atalhos de período, grade de cards executivos, painel de estado, título de faixa, lista com filtro por coluna, janela de lista e planilha do Excel, extraídos da Visão Geral de OS (ver `AGENTS.md`, "Padrão de página").

## Próximos blocos

Dependem do serviço de BI:

1. Campos novos nos registros de OS: o cliente da OS e a data de criação. Sem eles não existem os painéis de retrabalho e de espera até a visita.
2. A rota agregada da Visão Geral de OS ainda usa a regra antiga de período e comparação; o portal usa a rota de registros.
3. Preferências no serviço: tema, menu lateral e departamento inicial ainda ficam no navegador.

No portal:

4. Levar as demais páginas de OS para a fonte real, montadas no padrão da página modelo.
5. Visões Gerais dos demais departamentos: definir indicadores e fonte com o Mário, e montar no padrão da página modelo.
6. Visão Geral Executiva: será a última página feita; religar a chave quando estiver pronta.
7. Unificar os cards de indicador: `Customers`, `OperationalCalendar`, `Unproductive` e Metas e Desempenho ainda usam o `KpiStoryCard`. Metas usa a leitura em painel externo, que o card executivo não tem: decidir antes de migrar.
8. Meta comercial: o card está suspenso até existir a regra do número.

Adiados, com decisão pendente do Mário:

- referência de hora na faixa Hoje ao vivo ("num dia típico, a esta hora, X% do dia já está concluído");
- evolução mensal das taxas de conclusão e improdutividade, na Visão Geral ou na Evolução Temporal;
- detalhe de uma OS ao clicar na linha da lista, com a linha do tempo da OS (depende do serviço);
- página "Operação do dia", com quadro por técnico ou mapa.

Limpeza de cadastro no SGI (o portal se corrige sozinho quando ela acontece): cidades fora do cadastro, motivo de improdutiva "especificar nas observações" e vazio, técnico sem equipe.

## Pendências técnicas conhecidas

- A esteira do GitLab roda `lint` e `build`, mas não roda `npm test`.
- A compilação avisa que o arquivo do ECharts passa de 500 kB; dividir o carregamento dos gráficos é melhoria futura.
- `src/Pages/Overview/overviewStatusChartOptions.ts` e o teste dele não são usados desde que o painel "Distribuição por status" deu lugar a "Motivos de improdutiva" (23/09/2026).
- Os rótulos de ordem alfabética da tabela de Vendas por Período (`salesPeriodTableModel.ts`) ainda ligam as letras com meia-risca, fora da regra de texto do portal.
