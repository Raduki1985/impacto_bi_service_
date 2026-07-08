# Impacto Businness Intelligence

Projeto com BI de dados para acompanhamento da operação.

## Sobre

O Impacto Businness Intelligence é uma aplicação web para centralizar indicadores, visões executivas e dados operacionais em uma experiência clara para acompanhamento da operação.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- ECharts

## Requisitos

- Node.js 20 ou superior
- npm

## Como executar

Instale as dependências:

```bash
make install
```

Inicie o ambiente de desenvolvimento:

```bash
make dev
```

Gere a build de produção:

```bash
make build
```

Visualize a build localmente:

```bash
make preview
```

## Scripts

- `npm run dev`: inicia o servidor de desenvolvimento.
- `npm run build`: compila TypeScript e gera a build de produção.
- `npm run lint`: executa a análise estática do projeto.
- `npm run preview`: serve a build de produção localmente.
- `make install`: instala dependências usando cache local do projeto.
- `make dev`: inicia o Vite com host `0.0.0.0`.
- `make build`: gera a build de produção.
- `make lint`: executa a análise estática.
- `make preview`: serve a build localmente.

## Estrutura inicial

```text
src/
  Pages/
    Dashboard/    Layout autenticado e configuração de páginas
    Login/        Tela demonstrativa de autenticação
    Overview/     Visão geral de KPIs e gráficos
    ...           Demais páginas do BI por domínio
  components/
    charts/       Wrapper e opções padronizadas do ECharts
    dashboard/    Cards, tabelas, rankings e elementos analíticos
    layout/       Header, navegação, filtros e menu de usuário
    ui/           Componentes reutilizáveis de interface
  data/             Dados mockados, tipos e agregações do BI
  lib/              Utilitários compartilhados
  App.tsx           Composição principal da aplicação
  main.tsx          Entrada da aplicação React
  styles.css        Estilos globais e Tailwind CSS
```

## Protótipo migrado

A pasta `demo/` contém o protótipo original usado como referência. A implementação React atual replica a estrutura em páginas separadas, com dados mockados isolados em `src/data` e gráficos reutilizáveis em `src/components/charts`.
