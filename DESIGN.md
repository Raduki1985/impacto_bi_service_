# Sistema visual do IMPACTO BI Web

Como o portal se parece e por quê. Estilo corporativo, denso e analítico, na linha das ferramentas de BI: sóbrio, sem gradiente decorativo e sem emoji. Dois temas, claro (padrão) e escuro.

A referência viva é a Visão Geral de OS (`src/Pages/Overview`), a página modelo do portal desde 24/09/2026. Quando este documento e o código divergirem, vale o código, e o documento é corrigido junto.

## 1. Princípios

1. **Densidade com respiro**: muita informação, com hierarquia clara por tamanho, peso e cor.
2. **Cor com significado**: neutros dominam; cor é para acento, status e séries, e é fixa por item, nunca por posição.
3. **Números em mono**: todo valor quantitativo em IBM Plex Mono.
4. **Tokens primeiro**: superfície, borda e texto vêm dos tokens de `src/styles.css`, e é isso que faz o tema escuro funcionar sem regra por página.
5. **Estado nunca só pela cor**: sempre acompanhado de texto, ícone, seta ou marca.
6. **Formato pt-BR**: vírgula decimal e ponto de milhar, sempre pelos formatadores de `src/lib/formatters.ts`.

## 2. Temas e tokens

O tema claro é o padrão; `[data-theme="dark"]` na raiz sobrescreve só os tokens. O tema vem das preferências do usuário (menu do usuário, Aparência).

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--app-bg` | `#eef0f4` | `#0f172a` | Fundo geral |
| `--surface` | `#ffffff` | `#182230` | Superfície de painel, cabeçalho, faixa de filtros |
| `--surface-elevated` | `#ffffff` | `#1f2937` | Campos, caixas e listas sobre um painel |
| `--hover-bg` | `#f3f5f9` | `rgba(255,255,255,.06)` | Fundo de hover |
| `--border` | `#e4e7ee` | `#344054` | Bordas |
| `--divider` | `#eef0f4` | `#2b3648` | Divisórias internas |
| `--text-heading` | `#101828` | `#f2f4f7` | Títulos e valores |
| `--text-primary` | `#1a2331` | `#e9edf3` | Corpo forte |
| `--text-item` | `#344054` | `#dfe5ec` | Rótulos e campos |
| `--text-secondary` | `#475467` | `#cdd5df` | Texto de apoio |
| `--text-disabled` | `#c2c8d2` | `#5d6b7e` | Desabilitado |
| `--accent` | `#003be2` | `#003be2` | Acento da estrutura: links, foco, item ativo |
| `--accent-weak` | `#003be21f` | `#003be21f` | Fundo de chip e item ativo |

A faixa da marca, no topo, é `#182230` nos dois temas, e é ela que sustenta o logotipo branco e verde.

### Painéis executivos no escuro

Todo painel executivo carrega a classe `executive-panel`, que no escuro troca a superfície por uma mais clara, separada do fundo:

| Token | Escuro, dentro de `executive-panel` |
| --- | --- |
| `--surface` | `#1f2937` |
| `--surface-elevated` | `#263448` |
| `--border` | `#3b475a` |
| `--divider` | `#323e50` |

A classe vem dos próprios componentes (`ChartCard` executivo, `ExecutiveMetricCard`, `PageStatePanel`, `ListDialog`). Contêiner próprio de uma página que precise da mesma superfície recebe a classe (a faixa Hoje ao vivo, o contêiner da Visão Geral Comercial, os painéis de Vendas por Período). Página nenhuma redefine token global para si.

### Verde no escuro

No escuro o azul do acento não alcança contraste sobre as superfícies escuras. Chips acesos, ações de texto, anel de foco da faixa de filtros e da janela de lista e o item ativo do menu lateral passam ao Verde Detalhes `#34d372`. Os ganchos são `.impacto-chip`, `.impacto-text-action`, `.impacto-filter-panel` e `.impacto-list-dialog`, que vêm dos componentes. No claro o mesmo verde seria ilegível (1,96 de contraste sobre o branco), então tudo segue no azul.

## 3. Paleta institucional

Paleta do Marketing, setembro de 2026.

| Nome | Hex | Uso no portal |
| --- | --- | --- |
| Azul Primário | `#01225c` | `theme-color` da página, superfície da leitura gerencial no claro |
| Azul Secundário | `#002577` | Reserva |
| Azul Secundário 2 | `#062a92` | Reserva |
| Azul Impacto Play | `#003be2` | `--accent` da estrutura |
| Verde Detalhes | `#34d372` | Estado ativo e ações no tema escuro |
| Cinza Claro | `#eef0f4` | Fundo geral do tema claro |

O material do Marketing trouxe o Cinza Claro com o mesmo hex do Azul Primário, um erro de digitação; o CMYK informado (7/4/4/0) dá um cinza perto de `#edf5f5`, e o portal manteve o neutro `#eef0f4`.

## 4. Cores de dados

Os gráficos não seguem o `--accent`: o rebrand de setembro de 2026 mudou só a estrutura, e a paleta de dados foi preservada de propósito.

- **Acento de dados**: `#2f6bff` (`OS_CHART_ACCENT`), a cor padrão das barras.
- **Roscas de OS** (`OS_DONUT_PALETTE`), na ordem: `#2f6bff`, `#00b3a4`, `#f5a623`, `#e5484d`, `#8b5cf6`, `#0ea5e9`, `#64748b`.
- **Status de OS** (`statusColors`, cor fixa por status): Pendente `#94a3b8`, Agendada `#0ea5e9`, Reagendada `#6366f1`, Em Deslocamento `#06b6d4`, Técnico no Local `#14b8a6`, Em Andamento `#f5a623`, Pendente de Aprovação `#a855f7`, Concluída `#16a34a`, Cancelada `#8b5cf6`, Improdutiva `#e5484d`, Encerrada `#64748b`, Expirada `#b45309`, Provisionamento `#2f6bff`.
- **Identidade dos cards executivos** (`executiveCardColors`): green `#00a862`, blue `#2f7de1`, indigo `#4263eb`, violet `#8b5cf6`, amber `#d97706`, cyan `#0f9689`, red `#e5484d`. A cor é do indicador e não muda com o resultado.
- **Comparação com o período anterior**, só texto: favorável `#00844d` (claro) e `#34d399` (escuro); desfavorável `#b51d38` e `#ff8fa3`; neutro `#475467` e `#cdd5df`; indisponível `#5b6779` e `#aeb9c7`. Quem decide se subir é bom é o indicador, e não o sinal do número.
- **Atenção e ao vivo**, pares medidos nos dois temas: atenção `#b45309` (claro) e `#f5a623` (escuro); ao vivo `#00844d` e `#34d399`.
- **Infraestrutura** na rosca de tipos: terracota `#b5652f`.
- **Rampa de mapa de calor**: `#eef3ff`, `#9dbcff`, `#3f79ff`, `#123a99`.

Regras de cor de dado:

- cor fixa por item em domínio fechado, com uma checagem que acusa item sem cor declarada;
- contraste mínimo de 3,0 contra a superfície clara (`#ffffff`) e contra a escura (`#1f2937`), medido antes de propor;
- nenhuma cor nova de identidade em roxo, lilás ou rosa; as que existem na paleta histórica ficam;
- variação de cor sai de um token existente com `color-mix`, e não de um hex novo.

## 5. Tipografia

Duas famílias, do Google Fonts: **IBM Plex Sans** (400, 500, 600 e 700) em toda a interface e **IBM Plex Mono** (400, 500 e 600) nos números.

| Nível | Tamanho e peso |
| --- | --- |
| Título da página (cabeçalho) | 19px, 700 |
| Subtítulo da página | 12,5px |
| Título de painel e da faixa de filtros | 13,5px, 600 |
| Subtítulo de painel | 11px, entrelinha 1,45 |
| Título de faixa (`SectionHeading`) | 11px, 700, caixa alta |
| Rótulo do card executivo | 10,5px, 700, caixa alta, espaçamento 0,4px |
| Valor do card executivo | 23px, mono, 700 (18px quando passa de 12 caracteres) |
| Comparação e detalhe do card | 11px, 600 |
| Definição do indicador, na base do card | 11px |
| Campos da faixa de filtros | 12,5px, 600, altura 36px |
| Rótulo de campo | 11,5px, 500 |
| Chips e atalhos | 11,5px, 500 |
| Tabela | 12px; cabeçalho 600 |

## 6. Espaçamento e forma

- Conteúdo da página (`main`): 22px em cima, 26px dos lados, 40px embaixo. Com a faixa fixa de filtros, o respiro de cima sai do `main` e a faixa encosta no cabeçalho.
- Entre cards e painéis da mesma linha: 14px. Entre blocos: 16px. Título de faixa até o bloco: 10px.
- Painel: 16px em cima e embaixo, 18px dos lados. Card executivo: 14px em cima e embaixo, 16px dos lados.
- Cantos: 12px em painel, card e janela; 8px em campo, caixa e lista; 6px em ação de texto; pílula totalmente arredondada.
- Sombra discreta (`shadow-sm`) em painel e card; o card sobe 2px e ganha sombra maior no hover. Janela: `0 18px 48px rgba(16,24,40,.22)` sobre película `#101828` a 50%.
- Ícones lineares do `lucide-react`, entre 11px e 17px.

## 7. Estrutura de página

De cima para baixo, na ordem das perguntas do gestor:

1. **Faixa de filtros** presa ao topo (`PageStickyHeader` com `FilterPanel`): título, atalhos de período, período por extenso, chips dos filtros aplicados, Limpar filtros e Expandir.
2. **O que está acontecendo agora**, quando existe (a faixa Hoje ao vivo da OS).
3. **Resultado do período**: título de faixa com a etiqueta do período e, se houver, a planilha; a grade de cards executivos; e o painel que responde se está bom ou ruim (o Destino das OS).
4. **Composição do período**: título de faixa e os painéis de onde aconteceu e o que mais contribuiu, em duas colunas a partir do `lg`.
5. **Lista no clique**: o painel que conta abre, no centro da tela, a lista do que ele conta.

As regras de comportamento de cada peça estão no `AGENTS.md`, seção "Padrão de página".

## 8. Componentes

- **Faixa de filtros** (`components/filters`): resumo sempre visível e área expandida em grupos de negócio (Período, Operação, Resultado). Campo nunca muda de largura pelo conteúdo: régua de 8 partes na linha, 2 para Período e 1 para cada campo. Lista longa vira campo com digitação (`SearchSelectField`); data usa o calendário do portal (`DateField`).
- **Atalhos de período e chips** (`ChoiceChip`, `chipStyles`): pílula com borda quando apagada e tingida no acento quando acesa (`aria-pressed`). O chip de filtro ativo tem o "x" que tira só aquele filtro.
- **Card executivo** (`ExecutiveMetricCard` na `ExecutiveCardGrid`): título em caixa alta com o ícone do indicador numa caixa de 32px, valor, comparação, detalhe e definição presa à base. O clique vira o card e mostra a leitura gerencial: título, texto com trechos em destaque e OBSERVAR. A leitura usa o Azul Primário `#01225c` no claro e uma superfície clara no escuro, com a lâmpada amarela (`#ffb020` no claro, `#c97f00` no escuro). Um card aberto por vez; clique fora fecha.
- **Painel de gráfico** (`ChartCard`, variante `executive`): título, subtítulo e o gráfico. A variante `default` é o painel histórico das páginas simuladas e não muda.
- **Lista** (`ListTable`): cabeçalho com a contagem ("Concluídas: 797 OS", ou "12 de 797 OS" com filtro de coluna), Baixar Excel, Restaurar tabela e Fechar; colunas de largura fixa com filtro e ordenação no cabeçalho; cabeçalho preso na rolagem; superfície elevada.
- **Janela de lista** (`ListDialog`): centro da tela, altura fixa de 88% da janela do navegador, título, linha de contexto (período e filtros da página), Fechar e os atalhos de seleção.
- **Painel de estado** (`PageStatePanel`): carregando ou falha da fonte, com a superfície dos painéis.
- **Título de faixa** (`SectionHeading`): rótulo em caixa alta, frase do que a faixa responde e no máximo uma ação à direita.
- **Botões** (`components/ui/button.tsx`): primário no cinza da faixa da marca (`#182230`), secundário com borda, fantasma. Ações de texto no acento dentro de faixas e listas.

## 9. Gráficos (ECharts)

- Sempre pelo `Chart` (`components/charts/Chart.tsx`), que já redesenha quando as fontes terminam de carregar e oferece clique em barra e no fundo da categoria.
- Gerador de opções por painel, na pasta da página, recebendo o tema por parâmetro, com a paleta de claro e escuro dentro dele e teste ao lado. Os helpers de `chartOptions.ts` servem às páginas simuladas; mudar um deles muda todas.
- Eixos e grade no claro: rótulo `#98a2b3`, linha do eixo `#e4e7ee`, grade `#f1f3f7`, legenda `#667085`. No escuro: `#a9b5c6`, `#3b475a`, `rgba(159,174,196,.16)` e `#cdd5df`.
- Tooltip `#1a2331` no claro e `#263448` com borda `#46556b` no escuro, cantos de 8px, `confine` quando o conteúdo é rico; nome longo corta com reticências e o número nunca sai da caixa.
- Legenda com marcador circular de 9 a 10px quando há mais de uma série. Rótulo longo corta só na exibição; o nome inteiro fica no dado, no tooltip e na descrição acessível. Rótulo dentro da fatia só quando ela ocupa ao menos 6% do desenho; abaixo disso a identidade fica na legenda.
- Entrada e troca de filtro sem animação; só a transição de estado anima (260ms).
- Recorte vazio mostra um título centralizado ("Sem dados no período"), em `#98a2b3` no claro e `#a9b5c6` no escuro. Série que existe e vale zero continua desenhada.
- Barra empilhada: base reta, topo arredondado na fatia de cima de cada barra, perda no piso da pilha e o total em cima da barra.
- Toda opção declara a descrição acessível (`aria`), derivada da mesma coleção que o gráfico desenha.

## 10. Acessibilidade

- Foco visível em todo elemento interativo: anel de 2px no acento (verde no escuro).
- `aria-pressed` nos atalhos e chips de escolha, `aria-expanded` no que abre e fecha, `role="status"` e `role="alert"` nos estados de carregamento e falha.
- A janela de lista prende o foco, entra pelo título e fecha com Esc; com um painel de coluna aberto, o Esc fecha só o painel.
- Movimento reduzido: transições e o pulso do "ao vivo" param para quem pediu menos movimento ao sistema.

## 11. Texto

- Português do Brasil, sentence case, verbo ativo.
- Nenhum travessão nem meia-risca em texto exibido: vírgula, dois pontos ou ponto.
- Partes de um subtítulo separadas por ` · `.
- Ausência escrita por extenso ("Sem técnico", "Sem equipe", "Sem turno"): ela é resposta, e vira opção de filtro.
- Números, percentuais, datas e horas sempre pelos formatadores de `src/lib/formatters.ts`.
