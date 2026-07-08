# Migração do protótipo BI para React

## Objetivo

Replicar o protótipo em `demo/Dashboard OS.dc.html` dentro da estrutura atual React + Tailwind + Radix UI, mantendo o código simples, modular e fácil de manter.

O protótipo contém um BI de Ordens de Serviço com autenticação demonstrativa, navegação por áreas, filtros globais, páginas administrativas e gráficos ECharts. A migração deve transformar o HTML monolítico em páginas e componentes reutilizáveis.

## Diretrizes

- Manter uma página por domínio funcional dentro de `src/Pages`.
- Evitar lógica de dados dentro dos componentes visuais.
- Centralizar geração, agregação e formatação de dados em `src/data` e `src/lib`.
- Criar componentes pequenos para cards, tabelas, filtros, layout e gráficos.
- Usar Tailwind para estilos e Radix UI para primitives de menu, dialog, tabs, select e drawer quando necessário.
- Usar ECharts via pacote npm, preferencialmente com um wrapper React simples.
- Não migrar o runtime `support.js`; ele é apenas suporte do protótipo.
- Preservar a aparência geral do protótipo, mas adaptar para padrões React e responsividade.

## Dependências adicionadas

- [x] `echarts`
- [x] `echarts-for-react`
- [ ] `react-router-dom` não foi necessário nesta etapa; a navegação ficou por estado local.

Comando utilizado:

```bash
npm install echarts echarts-for-react
```

## Estrutura proposta

```text
src/
  App.tsx
  Pages/
    Login/
      Login.tsx
      index.ts
    Dashboard/
      DashboardLayout.tsx
      index.ts
    Overview/
      Overview.tsx
      index.ts
    Temporal/
      Temporal.tsx
      index.ts
    OperationalCalendar/
      OperationalCalendar.tsx
      index.ts
    OrderStatus/
      OrderStatus.tsx
      index.ts
    Categories/
      Categories.tsx
      index.ts
    Resolutions/
      Resolutions.tsx
      index.ts
    Unproductive/
      Unproductive.tsx
      index.ts
    ClosingReasons/
      ClosingReasons.tsx
      index.ts
    Technicians/
      Technicians.tsx
      index.ts
    Customers/
      Customers.tsx
      index.ts
    Quality/
      Quality.tsx
      index.ts
    Intelligence/
      Intelligence.tsx
      index.ts
    DimensionalModel/
      DimensionalModel.tsx
      index.ts
    Users/
      Users.tsx
      index.ts
    Permissions/
      Permissions.tsx
      index.ts
  components/
    charts/
      Chart.tsx
      chartOptions.ts
    layout/
      AppHeader.tsx
      AppNavigation.tsx
      FilterBar.tsx
      UserMenu.tsx
    dashboard/
      ChartCard.tsx
      KpiCard.tsx
      DataTable.tsx
      ProgressBar.tsx
      WordCloud.tsx
    ui/
      button.tsx
  data/
    mockOsData.ts
    mockAdminData.ts
    dashboardAggregates.ts
    dashboardTypes.ts
  lib/
    formatters.ts
    utils.ts
```

## Mapa de páginas do protótipo

| Página React | Protótipo `data-page` | Conteúdo |
| --- | --- | --- |
| `Login` | login inicial | Tela de entrada demonstrativa |
| `Overview` | `visao-geral` | KPIs, volume diário, status, categoria e resoluções |
| `Temporal` | `temporal` | OS por dia, semana, mês e evolução concluídas x improdutivas |
| `OperationalCalendar` | `calendario` | KPIs de calendário, heatmap diário e dia da semana x semana |
| `OrderStatus` | `status` | Donut, barras e status por período |
| `Categories` | `categorias` | Categoria por volume, participação, status e resolução |
| `Resolutions` | `resolucoes` | Ranking, participação e resolução por categoria |
| `Unproductive` | `improdutividade` | Motivos, período, técnico, categoria e evolução |
| `ClosingReasons` | `fechamento` | Motivos de fechamento e evolução semanal |
| `Technicians` | `tecnicos` | Top 10, ranking completo e heatmaps |
| `Customers` | `clientes` | Clientes atendidos, recorrência e tabela de reincidência |
| `Quality` | `qualidade` | Cruzamentos por categoria, resolução, improdutividade, status e técnico |
| `Intelligence` | `observacoes` | Nuvem de palavras, ranking de assuntos e tendência |
| `DimensionalModel` | `modelo` | Star schema e medidas calculadas |
| `Users` | `usuarios` | Lista paginada de usuários e drawer de cadastro |
| `Permissions` | `permissoes` | Cards de permissões e drawer de cadastro |

## Componentes reutilizáveis

- `DashboardLayout`: layout autenticado com header, navegação e área de conteúdo.
- `AppNavigation`: lista de páginas agrupadas por Geral, Operação, Pessoas e Análise.
- `AppHeader`: título, subtítulo, data de atualização e filtros.
- `FilterBar`: período, data inicial/final, técnico, categoria, status e resolução.
- `UserMenu`: avatar, menu de usuário, links para usuários/permissões e logout.
- `KpiCard`: card de indicador com título, valor, variação e cor.
- `ChartCard`: container padronizado para gráficos com título e subtítulo.
- `Chart`: wrapper único para renderizar ECharts.
- `DataTable`: tabela simples reutilizável para técnicos, clientes e usuários.
- `ProgressBar`: barras percentuais usadas em rankings.
- `WordCloud`: renderização simples da nuvem de palavras.

## Dados e regras

Migrar a lógica do script do protótipo para arquivos TypeScript:

- `mockOsData.ts`
  - Gerar dataset determinístico de OS entre `2026-04-01` e `2026-06-30`.
  - Manter técnicos, categorias, resoluções, motivos, períodos e clientes.
  - Exportar `orders`.

- `dashboardAggregates.ts`
  - Calcular KPIs globais.
  - Calcular séries diárias, semanais e mensais.
  - Calcular rankings de técnicos e clientes.
  - Calcular matrizes para heatmaps.
  - Calcular dados da IA: classificação, word cloud e tendências.

- `mockAdminData.ts`
  - Migrar usuários e permissões do protótipo.
  - Exportar listas prontas para `Users` e `Permissions`.

- `dashboardTypes.ts`
  - Tipar `Order`, `Status`, `Category`, `Technician`, `ChartSeries`, `Kpi`, `User` e `Permission`.

## Gráficos a migrar

Criar helpers em `components/charts/chartOptions.ts`:

- `makeBarOptions`
- `makeDonutOptions`
- `makeStackedBarOptions`
- `makeLineOptions`
- `makeHeatmapOptions`
- `makeCalendarHeatmapOptions`

Gráficos por página:

- `Overview`
  - `c-vg-dia`: linha total x concluídas
  - `c-vg-status`: donut por status
  - `c-vg-cat`: barras por categoria
  - `c-vg-res`: barras por resolução

- `Temporal`
  - `c-tmp-dia`: linha diária
  - `c-tmp-sem`: barras semanais
  - `c-tmp-mes`: barras mensais
  - `c-tmp-evol`: linha concluídas x improdutivas

- `OperationalCalendar`
  - `c-cal-heat`: heatmap calendário
  - `c-cal-dow`: heatmap dia da semana x semana

- `OrderStatus`
  - `c-st-donut`: donut por status
  - `c-st-bar`: barras por status
  - `c-st-periodo`: barras empilhadas por período

- `Categories`
  - `c-cat-bar`: barras por categoria
  - `c-cat-donut`: donut por categoria
  - `c-cat-status`: barras empilhadas categoria x status
  - `c-cat-resol`: heatmap categoria x resolução

- `Resolutions`
  - `c-res-bar`: barras por resolução
  - `c-res-donut`: donut por resolução
  - `c-res-cat`: barras empilhadas resolução x categoria

- `Technicians`
  - `c-tec-top`: barras top 10 técnicos
  - `c-tec-cat`: heatmap técnico x categoria
  - `c-tec-res`: heatmap técnico x resolução

- `Unproductive`
  - `c-imp-motivo`: barras por motivo
  - `c-imp-periodo`: donut por período
  - `c-imp-tec`: barras por técnico
  - `c-imp-cat`: barras por categoria
  - `c-imp-evol`: linha semanal

- `ClosingReasons`
  - `c-fech-bar`: barras por motivo
  - `c-fech-donut`: donut por motivo
  - `c-fech-evol`: linha semanal

- `Quality`
  - `c-qual-catres`: heatmap categoria x resolução
  - `c-qual-catimp`: heatmap categoria x improdutividade
  - `c-qual-statcat`: barras empilhadas status x categoria
  - `c-qual-stattec`: heatmap status x técnico

- `Intelligence`
  - `c-ia-bar`: barras por assunto
  - `c-ia-tend`: barras empilhadas por semana

## Plano de execução

### Fase 1 - Preparar base

- [x] Adicionar dependência de gráficos.
- [x] Criar tipos em `src/data/dashboardTypes.ts`.
- [x] Migrar geração de dados para `src/data/mockOsData.ts`.
- [x] Migrar usuários e permissões para `src/data/mockAdminData.ts`.
- [x] Criar agregações em `src/data/dashboardAggregates.ts`.
- [x] Criar formatadores em `src/lib/formatters.ts`.
- [x] Validar com `npm run build`.

### Fase 2 - Criar layout autenticado

- [x] Criar `Login`.
- [x] Criar `DashboardLayout`.
- [x] Criar navegação por estado local ou `react-router-dom`.
- [x] Criar `AppHeader`.
- [x] Criar `FilterBar` estático inicialmente.
- [x] Criar `UserMenu`.
- [x] Substituir `Welcome` no `App.tsx` pelo fluxo `Login`/`DashboardLayout`.

### Fase 3 - Criar componentes base de BI

- [x] Criar `KpiCard`.
- [x] Criar `ChartCard`.
- [x] Criar `Chart`.
- [x] Criar helpers de opções ECharts.
- [x] Criar `DataTable`.
- [x] Criar `ProgressBar`.
- [x] Criar `WordCloud`.

### Fase 4 - Migrar páginas principais

- [x] Migrar `Overview`.
- [x] Migrar `Temporal`.
- [x] Migrar `OperationalCalendar`.
- [x] Migrar `OrderStatus`.
- [x] Migrar `Categories`.
- [x] Migrar `Resolutions`.

### Fase 5 - Migrar páginas de operação e pessoas

- [x] Migrar `Unproductive`.
- [x] Migrar `ClosingReasons`.
- [x] Migrar `Technicians`.
- [x] Migrar `Customers`.

### Fase 6 - Migrar análise e modelo

- [x] Migrar `Quality`.
- [x] Migrar `Intelligence`.
- [x] Migrar `DimensionalModel`.

### Fase 7 - Migrar administração

- [x] Migrar `Users` com paginação local.
- [x] Criar drawer de usuário com Radix Dialog.
- [x] Migrar `Permissions`.
- [x] Criar drawer de permissão com Radix Dialog.

### Fase 8 - Revisão e acabamento

- [x] Garantir responsividade em desktop e mobile.
- [x] Remover HTML inline remanescente do protótipo.
- [x] Garantir que textos longos não quebrem layout.
- [x] Revisar acessibilidade básica de botões, menus e dialogs.
- [x] Atualizar `README.md` com nova estrutura.
- [x] Rodar `npm run lint`.
- [x] Rodar `npm run build`.

Observação pós-migração: o build emite aviso de bundle grande por causa do ECharts. Em uma próxima melhoria, aplicar code splitting por página ou carregamento dinâmico dos gráficos.

## Critérios de aceite

- [x] O app abre com tela de login demonstrativa.
- [x] Após login, o usuário acessa o dashboard com navegação por páginas.
- [x] Cada página do protótipo possui um equivalente em `src/Pages`.
- [x] Os gráficos são renderizados via componente reutilizável.
- [x] Os dados mockados são gerados e agregados fora dos componentes visuais.
- [x] Usuários e permissões ficam em páginas separadas.
- [x] O projeto passa em `npm run lint` e `npm run build`.
- [x] O código permanece simples, tipado e sem dependência do `demo/support.js`.

## Status final da migração

- [x] Migração funcional concluída.
- [x] `README.md` atualizado com stack, comandos e estrutura.
- [x] `TASK.md` atualizado com fases e critérios concluídos.
- [x] Servidor local validado em `http://localhost:5173/`.

## Melhorias futuras

- [ ] Implementar filtros funcionais com estado global ou contexto.
- [ ] Adicionar roteamento com `react-router-dom` se as páginas precisarem de URL própria.
- [ ] Aplicar code splitting por página para reduzir o bundle inicial do ECharts.
- [ ] Substituir dados mockados por integração com API real.
- [ ] Criar testes unitários para agregações em `src/data/dashboardAggregates.ts`.
- [ ] Criar testes de renderização para páginas principais do dashboard.

## Observações importantes

- O nome exibido no projeto deve continuar como `Impacto Businness Intelligence`, conforme definido inicialmente.
- O protótipo usava o rótulo `OS Analytics`; a migração usa a identidade do projeto.
- Os filtros ficaram estáticos nesta entrega e estão listados como melhoria futura.
- A autenticação é demonstrativa, sem backend.
- O dataset mockado ficou isolado para futura substituição por API real.
