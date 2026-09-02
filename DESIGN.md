# Design System — Dashboard de Ordens de Serviço

Documentação do sistema visual do BI de Ordens de Serviço (OS Analytics).
Estilo: **light mode corporativo**, denso e analítico, inspirado em ferramentas
de BI (Power BI / Looker). Sóbrio, sem gradientes decorativos, sem emoji.

Arquivo único: `Dashboard OS.dc.html` (Design Component). Estilos são **inline**;
apenas resets, `@font-face`/fontes e utilitários de `:hover`/foco ficam no
`<helmet><style>`.

---

## 1. Cores

### Paleta institucional (Marketing, set/2026)
| Nome               | Hex       | Uso no portal                                   |
|--------------------|-----------|-------------------------------------------------|
| Azul Primário      | `#01225c` | Faixa da marca, fundos escuros, `theme-color`   |
| Azul Secundário    | `#002577` | Reserva para superfícies escuras da marca       |
| Azul Secundário 2  | `#062a92` | Reserva (sem uso no portal por enquanto)        |
| Azul Impacto Play  | `#003be2` | `--accent` da estrutura: botões, links, abas    |
| Verde Detalhes     | `#34d372` | Detalhes da estrutura, destaques do tema escuro |
| Cinza Claro        | `#eef0f4` | Fundo geral (hex do material veio com erro; ver nota) |

Nota: o material do Marketing lista o Cinza Claro com o mesmo hex do Azul
Primário (`#01225C`), um erro de digitação — o CMYK informado (7/4/4/0)
equivale a um cinza ~`#edf5f5`. O portal mantém o neutro `#eef0f4` já usado.

### Marca / Acento
O acento é uma variável de tema (`--accent`). Cada acento tem sua versão fraca
(`--accent-weak`, ~12% alpha) para fundos de chip, avatar e destaque de
aba/linha ativa.

| Token            | Valor      | Uso                                             |
|------------------|------------|-------------------------------------------------|
| `--accent`       | `#003be2`  | Padrão da ESTRUTURA: botões, links, aba ativa   |
| `--accent-weak`  | `accent+1f`| Fundo de avatar, chip ativo, barra de progresso base |

Os GRÁFICOS não seguem o `--accent`: o rebrand de set/2026 mudou só a
estrutura, e a paleta de dados original (`OS_CHART_ACCENT #2f6bff` etc.)
foi preservada de propósito — ver "Paletas de gráfico" abaixo.

### Neutros (texto e superfícies)
| Token / valor | Uso                                            |
|---------------|------------------------------------------------|
| `#101828`     | Títulos, números de KPI                        |
| `#1a2331`     | Texto de corpo forte                           |
| `#344054`     | Texto de rótulos / células                     |
| `#475467`     | Texto secundário, ícones de nav                |
| `#667085`     | Cabeçalhos de tabela, legendas                 |
| `#98a2b3`     | Texto terciário, placeholders, eixos           |
| `#b0b6c3`     | Rótulos de seção (uppercase), texto desabilitado |
| `#e4e7ee`     | Bordas de card / input / divisores fortes      |
| `#eef0f4`     | Divisores suaves, trilhos de barra             |
| `#f1f3f7`     | Linhas de grade de gráfico, bordas de linha    |
| `#fafbfc`     | Fundo de cabeçalho de tabela, chips, rodapés   |
| `#ffffff`     | Superfície de card, sidebar/topbar             |
| `#eef0f4`     | Fundo geral da aplicação (`body`)              |
| `#101828`     | Painel escuro do login                         |

### Semânticas (status)
| Estado        | Cor       | Fundo badge |
|---------------|-----------|-------------|
| Concluída / Ativo / positivo | `#16a34a` (texto `#16794a`) | `#dcfce7` |
| Fechada / neutro             | `#64748b` | `#f1f3f7`   |
| Improdutiva / erro / sair    | `#e5484d` | —           |
| Em Andamento / alerta        | `#f5a623` | —           |
| Cancelada                    | `#8b5cf6` | —           |
| Perfil Analista              | `#0369a1` | `#e0f2fe`   |

### Paletas de gráfico
- **Categórica (donut/stacked):** `#2f6bff`, `#00b3a4`, `#f5a623`, `#e5484d`, `#8b5cf6`, `#0ea5e9`, `#64748b`
- **Heatmaps:** escala sequencial `#eef3ff → #9dbcff → #3f79ff → #123a99`

---

## 2. Tipografia

Duas famílias, carregadas do Google Fonts.

| Família            | Uso                                              |
|--------------------|--------------------------------------------------|
| **IBM Plex Sans**  | Toda a interface: títulos, corpo, rótulos        |
| **IBM Plex Mono**  | Números (KPIs, tabelas, códigos, datas, chaves)  |

Pesos: 400 / 500 / 600 / 700.

### Escala (px)
| Nível              | Tamanho / peso        | Exemplo                       |
|--------------------|-----------------------|-------------------------------|
| Número de KPI      | 29 / 600 (mono)        | Total de OS                   |
| Título de página   | 19 / 700               | "Visão Geral"                 |
| Número KPI menor   | 21–24 / 600 (mono)     | cards secundários             |
| Título de card     | 13.5 / 600             | título de gráfico             |
| Corpo / célula     | 12.5–13 / 400–500      | tabelas, menus                |
| Rótulo             | 11.5–12 / 600          | subtítulos, cabeçalho tabela  |
| Micro / seção      | 10.5–11.5 / 700, `letter-spacing:.06–.08em`, uppercase | "GERAL", "ADMINISTRAÇÃO" |

`letter-spacing` levemente negativo (`-.015em`) em títulos grandes.

---

## 3. Espaçamento e forma

- **Grid de layout:** flex/grid com `gap` (nunca margens soltas entre irmãos).
- **Padding de card:** variável `--pad` = `16px 18px` (Confortável) / `11px 13px` (Compacto, via Tweaks).
- **Gap entre cards:** `14px`. Gap de grid de KPIs: `14px`.
- **Padding de conteúdo (main):** `22px 26px 40px`.
- **Raios:** card `12px` · input/badge-chip `8–10px` · botão `9px` · pill/badge `20px` · avatar `50%` (usuário) ou `8px` (KPI).
- **Bordas:** `1px solid #e6e8ee` (card) / `#e4e7ee` (controles).
- **Sombra:** cards `0 1px 2px rgba(16,24,40,.04)`; dropdown `0 14px 34px rgba(16,24,40,.16)`; drawer `-10px 0 34px rgba(16,24,40,.18)`.

---

## 4. Componentes

### KPI Card
Fundo branco, borda + sombra sutil. Rótulo uppercase 11.5px → número mono 29px →
delta comparativo ("+3,2% vs. mês anterior"). Número em cor semântica quando o
indicador é qualitativo (verde para conclusão, vermelho para improdutividade).

### Card de gráfico
Título 13.5/600 + subtítulo 12/#98a2b3 + contêiner de gráfico (ECharts) com
altura fixa (250–420px). Todos os gráficos usam tooltip escuro `#1a2331`,
grade `#f1f3f7`, eixos `#98a2b3`.

### Tabela analítica
Cabeçalho `#fafbfc`/#667085, linhas com borda-topo `#f1f3f7`, hover `#fafbfc`.
Números alinhados à direita em mono. Avatar circular com iniciais em
`--accent-weak`. Barras de progresso inline (trilho `#eef0f4`).

### Badges
Pill 20px, fundo semântico fraco + texto semântico forte. Status leva um "dot"
6px da mesma cor do texto.

### Navegação (tabs)
Barra horizontal no topo. Aba ativa: fundo `--accent-weak`, texto `--accent`,
peso 600. Inativa: texto `#475467`. Ícones lineares 15–17px, `stroke-width:1.9`.

### Chip de usuário + dropdown
No topo, alinhado à direita (space-between com a marca). Avatar quadrado 8px +
nome/perfil. Dropdown 242px: cabeçalho com e-mail, seção ADMINISTRAÇÃO (só
admin) e Sair (vermelho). Fecha por overlay `position:fixed;inset:0`.

### Botões
- **Primário:** fundo `--accent`, texto branco, 9px raio, peso 600.
- **Secundário:** borda `#e4e7ee`, texto `#475467`, fundo branco.
- **Ícone:** 30px quadrado, borda, ícone linear (editar `#667085`, excluir `#e5484d`).

### Inputs
`.inp`: borda `#dfe3ec`, raio 8px, foco = borda accent + halo `0 0 0 3px var(--accent-weak)`.

### Drawer (cadastro)
Painel lateral direito 452px, overlay escurecido. Cabeçalho + corpo rolável +
rodapé fixo com Cancelar / Salvar.

### Paginação
Rodapé de tabela `#fafbfc`: "Mostrando X–Y de Z" à esquerda; Anterior · números ·
Próxima à direita. Página ativa preenchida com accent; extremos desabilitados
(`opacity .45`, sem ponteiro).

---

## 5. Ícones
Somente **SVG lineares** (`stroke`, `fill:none`, `stroke-width` 1.9–2.2,
`stroke-linecap:round`). Sem biblioteca de ícones, sem emoji. Tamanhos 13–20px.

---

## 6. Gráficos (ECharts)
- Renderizador canvas; inicializados só quando o contêiner tem largura real
  (evita gráfico de largura 0 na primeira pintura), com retry até montar.
- Redesenham ao trocar de aba e em `resize`.
- Tipos: linha (com área), barra (vertical/horizontal), donut, barras
  empilhadas, heatmap e calendário.

---

## 7. Princípios
1. **Densidade com respiro** — muita informação, mas hierarquia clara por tamanho/cor.
2. **Cor com significado** — neutros dominam; cor só para acento, status e séries.
3. **Números em mono** — todo dado quantitativo em IBM Plex Mono, alinhado à direita.
4. **Sem ruído** — nada de gradiente decorativo, sombra pesada, emoji ou borda colorida gratuita.
5. **Inline-first** — estilos inline para pintar imediato; `<style>` só para o que não dá inline.
6. **Formato pt-BR** — números e percentuais com vírgula decimal e separador de milhar.
