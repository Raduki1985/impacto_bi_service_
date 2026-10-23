# Continuação: padrão do card de KPI e pendências

Documento de passagem, escrito em 27/08/2026 para continuar o trabalho em outra IDE.
Fica em `Docs/`, que é invisível ao Git, então ele não aparece em `git status` e não
mexe na documentação versionada do projeto.

---

## 1. Onde o trabalho está agora

- **Branch:** `etapa/os-visao-geral-continuacao`
- **Situação:** 4 commits à frente da `origin`, árvore de trabalho limpa
- **Push:** ainda NÃO foi feito
- **Merge request:** não aberto

Commits desta rodada, do mais antigo para o mais novo:

| Commit | O que entregou |
| --- | --- |
| `525d1e1` | `fix(layout)`: barra superior acima do conteúdo, o menu do avatar parou de ser coberto pelo cabeçalho fixo das tabelas |
| `5422ba7` | `feat(login)`: sessão presa à aba (fechar a aba ou o navegador pede login), Lembrar-me passou a guardar só o último e-mail |
| `9ce8169` | `feat(cards)`: card executivo padronizado, minigráfico fora, definição do indicador na base |
| `66f01a8` | `refactor(dados)`: remoção das séries que só alimentavam o minigráfico |

Validação executada antes de cada commit: `npm run lint`, `npm test` (46 arquivos,
1420 testes) e `npm run build`, todos sem erro, mais conferência no navegador nos
temas claro e escuro.

---

## 2. O padrão do card, como ficou

Componente único: `src/components/dashboard/ExecutiveMetricCard.tsx`.

Anatomia da frente do card, igual nas três telas que o usam:

1. Título em maiúsculas, com ícone do indicador
2. Valor
3. Comparação com o período anterior
4. **Definição do indicador**, presa à base (prop `definition`)
5. Leitura gerencial completa, que abre no clique e cobre a frente

Variantes que continuam existindo, por terem escala própria: `gauge`
(velocímetro, com realizado e meta) e `pipeline` (composição do funil). A variante
`spark`, que desenhava o minigráfico, não desenha mais nada: sobrou o nome.

Telas que usam hoje: Visão Geral de OS, Visão Geral do Comercial e Vendas do período.

**Por que o minigráfico saiu:** três das cinco séries da OS repetiam o gráfico
"Volume diário de OS" logo abaixo, que tem eixo, datas e legenda; e todos os
minigráficos se ajustavam cada um ao próprio mínimo e máximo, então cards vizinhos
mostravam formas parecidas para grandezas diferentes. A direção do período continua
sendo dita pela comparação, que não tem como ser lida errado.

---

## 3. Passos que você vai executar

### Passo 1: conferir na tela

```bash
npm run dev
```

Confira, nesta ordem:

1. `/dashboard/visao-geral` (OS): cinco cards sem minigráfico, com a frase na base
2. `/dashboard/comercial/visao-geral`: dois cards de valor com a frase, velocímetros e funil intactos
3. `/dashboard/comercial/sales-period`: quatro cards com a frase
4. Abra o menu do avatar dentro de Configurações > Histórico: ele precisa ficar por cima da tabela
5. Feche a aba e abra de novo: precisa pedir login, com o e-mail preenchido

### Passo 2: push da branch

```bash
git status
git log --oneline -4
git push origin etapa/os-visao-geral-continuacao
```

Nada de `git add .`. A árvore já está limpa, então o push não deve levar nada além
dos 4 commits acima.

### Passo 3: merge request (opcional agora)

Se for abrir, revisor preferencial: Vagner; substituto: André.
Não faça merge sem revisão.

### Passo 4: Bloco 2, unificar o segundo card de KPI

O prompt técnico completo está na seção 5 deste documento, pronto para colar.

---

## 4. Decisões pendentes, que são suas

1. **Estilo das frases de definição.** A OS usa frase completa com ponto final
   ("Todas as ordens de serviço abertas no período."). O Comercial usa fragmento em
   minúscula, sem ponto ("soma do valor mensal das vendas do recorte"). As duas formas
   já estavam aprovadas em cada tela, então nada foi uniformizado por conta própria.
   Decida se padroniza e em qual das duas formas.

2. **Apelido do modelo.** `src/Pages/Commercial/components/commercialCardModel.ts`
   ainda reexporta `buildExecutiveDelta` como `buildCommercialDelta` e as cores como
   `commercialCardColors`. É usado em quatro arquivos do Comercial. Remover é
   renomeação mecânica, sem risco de comportamento, mas espalha o diff.

3. **Série morta antiga.** `src/data/dashboardAggregates.ts` calcula `kpiSparklines`
   (com `KpiSparklines` em `dashboardTypes.ts`) que NENHUMA tela consome, e já não
   consumia antes desta rodada. Não foi tocada porque é a base antiga do dashboard,
   usada pelas páginas de departamento. Vale remover junto do Bloco 2.

---

## 5. Prompt técnico do Bloco 2

Copie o bloco inteiro para a outra IDE.

```markdown
### Objetivo

Fazer o portal ter UM único componente de card de KPI. Hoje existem dois fazendo a
mesma coisa com props e visual diferentes: `ExecutiveMetricCard`, já padronizado, e
`KpiStoryCard`, usado em quatro telas. Ao final, as telas que hoje usam
`KpiStoryCard` devem usar `ExecutiveMetricCard`, com a mesma anatomia das demais, e
`KpiStoryCard` deve deixar de existir.

### Contexto confirmado

- Componente alvo: `src/components/dashboard/ExecutiveMetricCard.tsx`.
  Props principais: `label`, `value`, `icon`, `tone`, `delta`, `definition`,
  `detail`, `footer`, `children`, `variant` ('spark' | 'gauge' | 'pipeline'),
  `readingTitle`, `readingText`, `observe`, `open`, `onToggle`, `theme`,
  `accessibleText`.
- A frente do card é: título com ícone, valor, comparação, definição na base e
  leitura gerencial no clique.
- Componente a ser absorvido: `src/components/dashboard/KpiStoryCard.tsx`.
  Props próprias: `setor`, `nome`, `valor`, `delta` (string), `status`
  ('ok' | 'warn' | 'bad' | 'neutral'), `tendencia`, `icon`, `readingMode`
  ('overlay' | 'external'), `readingPanelId`, `onSelect`, `id`.
- Consumidores atuais de `KpiStoryCard`, com a quantidade de cards em cada um:
  - `src/Pages/Customers/Customers.tsx` (3)
  - `src/Pages/OperationalCalendar/OperationalCalendar.tsx` (3)
  - `src/Pages/Unproductive/Unproductive.tsx` (3)
  - `src/Pages/Commercial/Goals/Goals.tsx` (1)
  - `src/Pages/Commercial/Goals/GoalsPanels.tsx` importa `KpiReadingText` do mesmo
    módulo, sem usar o card.
- OBSTÁCULO REAL, precisa de decisão antes de migrar: `Goals.tsx` usa
  `readingMode="external"`, em que o card não desenha a leitura dentro dele e vira
  um seletor, com o texto aparecendo em um painel externo compartilhado
  (`readingPanelId`, `onSelect`, `KPI_READING_PANEL_ID`). `ExecutiveMetricCard` só
  tem o modo sobreposto. Ou o modo externo é levado para o componente único, ou a
  tela de Metas passa a usar o modo sobreposto, o que muda o comportamento dela.
  Não escolha sozinho: apresente as duas opções com o impacto de cada uma.

### Escopo permitido

- `src/components/dashboard/ExecutiveMetricCard.tsx` e o modelo dele.
- `src/components/dashboard/KpiStoryCard.tsx` (remoção ao final).
- As quatro páginas consumidoras listadas acima e os testes correspondentes.
- Testes novos ou ajustados que provem a migração.
- Opcional, se autorizado: remover o apelido `commercialCardModel.ts` e a série
  morta `kpiSparklines` de `dashboardAggregates.ts` / `dashboardTypes.ts`.

Demais arquivos: somente leitura.

### Regras da implementação

- Um componente só ao final. Nada de manter os dois com uma camada de compatibilidade.
- Cada card migrado precisa manter: valor, comparação, leitura gerencial, cor de
  identidade e o comportamento de teclado e leitor de tela que já existiam.
- Não inventar texto de indicador. Nome, definição e leitura gerencial de cada card
  são os que já estão nas páginas. Se faltar definição para algum card, LISTE os
  casos e peça aprovação do texto em vez de escrever por conta própria.
- Não mudar nome de indicador.
- Não usar travessão longo em texto de interface nem em comentário.
- Comentários em português, explicando o porquê da decisão, no mesmo padrão dos
  arquivos vizinhos.
- Não alterar arquivos .md versionados do projeto (README, AGENTS, TASK, DESIGN).
- `react-hooks/set-state-in-effect` é erro de lint no projeto: nada de setState
  síncrono no corpo de `useEffect`.

### Fora do escopo

- Telas administrativas (Usuários e Perfis de acesso). Os indicadores de lá são
  contadores de cadastro, não KPI de negócio, e devem continuar como estão.
- Reintroduzir minigráfico em qualquer card.
- Mexer nas variantes `gauge` e `pipeline`.
- Qualquer alteração de rota, permissão ou dado.

### Critérios de aceite

- `KpiStoryCard.tsx` não existe mais e nenhum arquivo o importa.
- As quatro páginas renderizam os mesmos indicadores de antes, com a anatomia do
  card padrão.
- A leitura gerencial continua acessível pelo teclado, com o mesmo texto de antes.
- Nenhuma regressão visual nos temas claro e escuro.
- A tela de Metas continua funcionando conforme a decisão tomada sobre o modo de
  leitura externo.

### Validação

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run dev` e conferência das quatro telas nos dois temas.

### Autonomia e análise crítica

Inspecione os arquivos antes de propor mudança, siga os padrões que já existem no
projeto, não pergunte o que dá para verificar no repositório e não amplie o escopo.
Pare e peça decisão apenas diante de bloqueio real, como o modo de leitura externo
da tela de Metas ou falta de texto aprovado para alguma definição.

### Relatório final obrigatório

Status, arquivos alterados, resumo do que mudou e por quê, comandos executados com
o resultado de cada um, pendências que ficaram e confirmação de que o escopo foi
respeitado.
```

---

## 6. Regras do projeto que valem em qualquer IDE

- Português do Brasil, sem travessão longo em texto de interface.
- `git add` sempre por arquivo, nunca `git add .`.
- Nunca versionar `.vite-dev.stderr.log` nem `.vite-dev.stdout.log`.
- Branch, commit, push, merge request e merge exigem autorização explícita sua.
- Documentação .md versionada está congelada até a fase de conexão com o banco.
- Não tratar a autenticação atual como segurança: ela é mockada e não confere senha.
