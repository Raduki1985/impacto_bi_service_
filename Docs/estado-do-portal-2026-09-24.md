# IMPACTO BI Web, estado do portal em 24/09/2026

Arquivo local, dentro de `Docs`, que é invisível ao Git. Retrato do portal em
24/09/2026, o mesmo dia em que o Mário encerrou o congelamento da
documentação e o `README.md`, o `AGENTS.md`, o `TASK.md` e o `DESIGN.md`
versionados foram reescritos a partir dele. Para o estado atual valem os
documentos versionados; este fica como registro da data.

## O que o portal é hoje

Portal corporativo de dashboards da Impacto Telecom. React 19, TypeScript,
Vite 8, Tailwind 4, Radix UI (janelas e abas), ECharts 6 e Vitest 4. Roda
com `npm run dev`; a conferência automática é `npm run lint`, `npm test` e
`npm run build`.

Duas frentes de dado:

- **Ligado ao serviço de BI** (`impacto-bi-service`, do André, que lê o banco
  SGI): a Visão Geral de OS, a Gestão de Técnicos e a Visão Geral Comercial.
  O endereço vem de `VITE_BI_API_URL` no `.env.local`; sem ele, a Visão Geral
  de OS abre sobre a base local sanitizada (`src/data/overviewOsFact.json`,
  06/04/2026 a 21/08/2026, sem nome, código real, turno ou motivo) e o
  Comercial sobre a base sintética.
- **Simulado**: as demais páginas de OS (`mockOsData.ts`) e as Visões Gerais
  dos outros departamentos, que ainda mostram o painel de etapa futura
  (`UpcomingDashboard`). Nunca apresentar como número real.

Falha do serviço não cai na base local: a página avisa e não desenha
indicador nenhum.

## Página modelo

Desde 24/09/2026 a **Visão Geral de OS** (`src/Pages/Overview`) é a página
modelo do portal, por decisão do Mário. O esqueleto, os componentes e as
regras estão no skill local `.claude/skills/modelo-de-pagina/SKILL.md`. Em
resumo, de cima para baixo: faixa de filtros presa ao topo (atalhos de
período, chips, área expandida), Hoje ao vivo (só ligada ao serviço),
Resultado do período (quatro cards executivos com leitura gerencial e o
Destino das OS), Composição do período (seis painéis), e o clique em painel
abre a janela de lista com filtro por coluna e planilha do Excel.

## Componentes compartilhados (`src/components`)

Saíram da página modelo em 24/09/2026 e são a única forma aprovada de montar
página nova:

| Componente | Arquivo | O que faz |
| --- | --- | --- |
| Painel de estado | `dashboard/PageStatePanel.tsx` | carregando ou falha da fonte |
| Faixa fixa | `layout/PageStickyHeader.tsx` | faixa presa ao topo do `main` |
| Título de faixa | `dashboard/SectionHeading.tsx` | rótulo, frase e uma ação |
| Faixa de filtros | `filters/FilterPanel.tsx`, `FilterGroup.tsx`, `FilterSelectField.tsx`, `PeriodPresets.tsx` | resumo com chips, Limpar, Expandir; atalhos de período |
| Campos | `ui/DateField.tsx`, `ui/SearchSelectField.tsx` | data com calendário; escolha com digitação |
| Cards | `dashboard/ExecutiveCardGrid.tsx`, `ExecutiveMetricCard.tsx` | coleção com um aberto por vez; card com leitura gerencial |
| Painel de gráfico | `dashboard/ChartCard.tsx` (`variant="executive"`) | título, subtítulo e superfície do tema escuro |
| Gráfico | `charts/Chart.tsx` | único ponto que desenha ECharts; redesenha após as fontes; clique em barra e no fundo do dia |
| Janela de lista | `dashboard/ListDialog.tsx` | janela central de altura fixa, com cabeçalho e Fechar |
| Lista | `dashboard/ListTable.tsx`, `listTableModel.ts`, `ListColumnHeader.tsx`, `ColumnFilter.tsx` | tabela com filtro e ordenação por coluna, Restaurar e Baixar Excel |
| Pílulas | `ui/ChoiceChip.tsx`, `ui/chipStyles.ts` | atalho de pressionar; pílula tingida |
| Planilha | `lib/xlsxWriter.ts`, `lib/downloadFile.ts` | .xlsx montado no navegador, com aba de recorte |
| Datas e atalhos | `data/isoDate.ts`, `data/periodPresets.ts` | contas de data sem fuso; Ontem, Esta semana, Semana passada, Este mês, Mês passado |

Tema escuro: `.executive-panel` é a superfície dos painéis executivos e vem
dos próprios componentes; `.impacto-chip`, `.impacto-text-action`,
`.impacto-filter-panel` e `.impacto-list-dialog` são os ganchos que o escuro
pinta de verde. Nenhuma página precisa de classe de escopo para isso.

## Páginas e estado de cada uma

| Departamento | Página | Estado |
| --- | --- | --- |
| Ordens de Serviço | Visão Geral | modelo do portal, ligada ao serviço |
| Ordens de Serviço | Gestão de Técnicos | ligada ao serviço, mesma faixa de filtros e provedor da Visão Geral |
| Ordens de Serviço | demais páginas | simuladas, com o aviso de dados simulados no cabeçalho |
| Comercial | Visão Geral | ligada ao serviço; bate com o Relatório de Vendas do SGI |
| Comercial | Vendas por Período, Metas | base sintética |
| Demais departamentos | Visão Geral | painel de etapa futura |
| Portal | Visão Geral Executiva | desligada (`CORPORATE_HOME_ENABLED`); entrada pela Visão Geral do departamento inicial, escolhido em Preferências |
| Configurações | Usuários, Perfis de Acesso, Histórico, Preferências | funcionais, persistência local (não é segurança de produção) |

Regras de negócio decididas com medição no SGI estão na memória do projeto e
nos comentários de bloco dos modelos (`overviewModel.ts`, `todayOsModel.ts`,
`osListModel.ts`, `overviewOsFilters.ts`).

## Estrutura de pastas

```
src/
  Pages/<Departamento>/         pageConfig, Overview e páginas próprias
  Pages/Overview/               Visão Geral de OS (página modelo)
  Pages/Technicians/            Gestão de Técnicos
  components/charts/            Chart e helpers compartilhados de opções
  components/dashboard/         cards, painéis, lista, janela, filtro de coluna
  components/filters/           faixa de filtros e atalhos de período
  components/layout/            cabeçalho, faixa fixa, menu do usuário
  components/ui/                campos, pílulas, botão
  contexts/                     provedores: auth, preferências, OS, fonte da página
  data/                         tipos, agregados, filtros, datas, bases locais
  data/api/                     leitura do serviço de BI
  lib/                          formatadores, planilha, regras de acesso
  config/                       catálogos de departamentos e páginas
```

## Documentação

- Versionada, reescrita em 24/09/2026 no fim do congelamento: `README.md`,
  `AGENTS.md` (sem as seções antigas do Codex), `TASK.md` e `DESIGN.md`. O
  guia `.agents/skills/frontend-design/SKILL.md` é de terceiros e não se edita.
- Local, fora do Git: `CLAUDE.md` (como trabalhar com o Mário), os skills em
  `.claude/skills` (`modelo-de-pagina`, `graficos-impacto`,
  `nova-pagina-departamento`, `frontend-design`), os agentes revisores em
  `.claude/agents`, e esta pasta `Docs` (handoffs por data, histórico).

## Git

`main` é produção (quem mescla é o André); `develop` recebe os pedidos de
merge; trabalho novo nasce em branch própria (`feat/...`, `fix/...`,
`refactor/...`). Nunca `git add .`; nunca versionar os logs do Vite nem as
capturas `.png` soltas na raiz. Vagner é o revisor preferencial.
