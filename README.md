# IMPACTO BI Web

Portal corporativo de dashboards da Impacto Telecom (Impacto Business Intelligence). Reúne as Visões Gerais e as páginas de análise de cada departamento, com os dados do banco SGI entregues pelo serviço de BI (`impacto-bi-service`, repositório separado).

## Stack

- React 19 e TypeScript 5.9
- Vite 8
- Tailwind CSS 4, com os tokens de tema em `src/styles.css`
- Radix UI (janelas e abas)
- ECharts 6, pelo `echarts-for-react`
- lucide-react (ícones)
- React Router 7
- Vitest 4 e ESLint 9

## Requisitos

- Node.js 20.19 ou 22.12 em diante, com npm, para o desenvolvimento local.
- Bun 1.3, que a esteira do GitLab e a imagem Docker usam.

## Como executar

```bash
npm install
npm run dev
```

O portal abre em `http://localhost:5173`. O login é demonstrativo: a senha não é conferida (ver "Segurança", abaixo).

Os mesmos comandos existem com Bun e no `Makefile` (`make install`, `make dev`, `make build`, `make lint`, `make preview` e os alvos `docker-*`).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Vite |
| `npm run lint` | Análise estática (ESLint) |
| `npm test` | Testes automatizados (Vitest) |
| `npm run build` | Checagem de tipos (`tsc -b`) e compilação de produção em `dist` |
| `npm run preview` | Serve a compilação de produção localmente |

A esteira do GitLab roda `lint` e `build` e depois gera a imagem Docker. Ela instala as dependências com `bun install --frozen-lockfile`: toda mudança de dependência precisa atualizar o `bun.lock`, senão a esteira falha. O `package-lock.json` atende quem usa npm localmente.

## Configuração

Crie um `.env.local` na raiz (ele não vai para o Git):

```bash
VITE_BI_API_URL=http://localhost:8000/api/core/v1
```

`VITE_BI_API_URL` é o endereço das rotas de BI do `impacto-bi-service`. Com ela:

- a Visão Geral de OS e a Gestão de Técnicos leem `GET /bi/os/overview/records`, e a faixa Hoje ao vivo lê a mesma rota a cada minuto, só com a última semana;
- a Visão Geral Comercial lê `GET /bi/commercial/overview` para os cards e os painéis, e `GET /bi/commercial/overview/records` para os contratos: a faixa Hoje ao vivo lê o dia com a esteira das vendas ainda sem sinal a cada minuto, a janela aberta pela Safra de vendas por mês e pela Evolução mensal lê o mês clicado, e a planilha do período lê o período inteiro;
- se o serviço falhar, a página mostra o erro e NÃO desenha indicador nenhum. Não existe queda automática para a base local: um número de estudo com cara de número do banco seria pior do que a ausência do indicador.

Sem ela, a Visão Geral de OS e a Gestão de Técnicos abrem sobre a base local sanitizada (`src/data/overviewOsFact.json`, de 06/04/2026 a 21/08/2026, sem nomes nem códigos reais) e a Visão Geral Comercial sobre a base sintética. As faixas Hoje ao vivo, as listas de OS e de contratos e as planilhas só existem com o serviço.

A variável é lida na COMPILAÇÃO: o Vite a embute no arquivo final. O `Dockerfile` e a esteira atuais não a definem, então uma imagem compilada sem ela abre essas páginas nas bases locais de estudo. Para produção, defina `VITE_BI_API_URL` no ambiente da compilação.

`VITE_ORDERS_API_URL` é legada e vale só para as páginas de OS que ainda usam dados simulados (`src/data/orderRepository.ts`): sem ela, ou se a chamada falhar, elas usam `src/data/mockOsData.ts`.

Os testes rodam sempre sobre as bases locais: o `vite.config.ts` zera `VITE_BI_API_URL` durante a suíte.

## Fontes de dados por página

| Página | Fonte |
| --- | --- |
| Ordens de Serviço, Visão Geral | Serviço de BI (ou base local sanitizada) |
| Ordens de Serviço, Técnicos | Serviço de BI (ou base local sanitizada) |
| Ordens de Serviço, demais páginas | Dados simulados, com aviso no cabeçalho |
| Comercial, Visão Geral | Serviço de BI (ou base sintética) |
| Comercial, Vendas por Período e Metas e Desempenho | Base sintética |
| Demais departamentos | Painel de etapa futura, sem dados |

Dado simulado ou sintético é sempre identificado como tal e nunca apresentado como número real.

## Estrutura

```text
src/
  Pages/
    Overview/               Visão Geral de OS, a página modelo do portal
    Technicians/            Gestão de Técnicos
    Commercial/             Visão Geral, Vendas por Período e Metas do Comercial
    <Departamento>/         pageConfig.ts e a Visão Geral de cada departamento
    Dashboard/              Layout autenticado e configuração das páginas de OS
    Users/, AccessProfilesPreview/, UserHistory/, Preferences/, MyProfile/
                            Configurações do portal
  components/
    charts/                 Chart (único ponto que desenha ECharts) e helpers de opções
    dashboard/              Cards executivos, painéis, lista, janela de lista, filtro de coluna
    filters/                Faixa de filtros e atalhos de período
    layout/                 Cabeçalho, faixa fixa de página, menu do usuário
    navigation/, routing/   Menu lateral por departamento e proteção de rotas
    ui/                     Campos de data e de escolha, pílulas, botão
  config/                   Catálogos de departamentos, páginas e perfis
  contexts/                 Autenticação, preferências, dados de OS, estado da fonte
  data/                     Tipos, agregados, filtros, datas, bases locais
  data/api/                 Leitura do serviço de BI
  lib/                      Formatadores pt-BR, planilha do Excel, regras de acesso
  services/                 Persistência local de usuários, perfis e preferências
  types/                    Tipos de acesso e histórico
  styles.css                Tokens de tema (claro e escuro) e regras globais
```

Cada modelo analítico e cada gerador de gráfico tem o teste ao lado (`*.test.ts`), e as páginas principais têm teste de renderização (`*.render.test.tsx`).

## Página modelo

A Visão Geral de OS é a página modelo do portal desde 24/09/2026. Página nova usa os mesmos componentes compartilhados de `src/components` (faixa de filtros, cards executivos, painéis, lista no clique, janela de lista, planilha) e escreve só o que é dela. As regras estão no `AGENTS.md`, seção "Padrão de página", e o sistema visual no `DESIGN.md`.

## Segurança

Autenticação, usuários, Perfis de Acesso e preferências ainda são locais, gravados no navegador: o login não confere senha e a persistência não é segurança de produção. A autenticação real depende do serviço de BI. Nenhuma credencial vai para o front-end.

## Documentação

- `AGENTS.md`: regras de produto, navegação, perfis e acessos, padrão de página, dados, validação e Git.
- `DESIGN.md`: sistema visual (tokens, temas, tipografia, componentes, gráficos).
- `TASK.md`: estado do projeto e próximos blocos.
