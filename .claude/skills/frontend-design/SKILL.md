---
name: frontend-design
description: Direcao visual intencional ao construir ou remodelar UI neste projeto. Use ao criar uma tela nova, redesenhar uma existente, ou decidir paleta, tipografia e layout. Aponta para o documento canonico versionado do repositorio.
---

# Frontend Design (ponteiro para o documento canonico)

O conteudo oficial deste skill NAO vive aqui. Ele vive no arquivo versionado do
repositorio:

```
.agents/skills/frontend-design/SKILL.md
```

Esse arquivo e um guia generico de terceiros, com licenca propria
(`LICENSE.txt` ao lado), entao ele nao e movido, copiado nem editado. Este
ponteiro existe apenas porque o Claude Code so carrega skills de
`.claude/skills/`. A direcao visual do portal esta no `DESIGN.md` e no skill
`modelo-de-pagina`.

## O que fazer ao acionar este skill

1. Leia `.agents/skills/frontend-design/SKILL.md` por inteiro antes de escrever
   qualquer codigo ou propor qualquer direcao visual. Ele e a fonte da verdade.
2. Siga o processo descrito la: brainstorm, exploracao, plano com tokens de cor,
   tipo, layout e elemento assinatura, critica do plano contra o brief, e so
   entao a implementacao.
3. Se o arquivo canonico nao existir mais no caminho acima, avise em vez de
   improvisar uma direcao visual generica.

## Precedencia dentro deste projeto

O documento canonico e um guia de design geral, escrito para telas novas com
liberdade estetica. O IMPACTO BI ja tem identidade fechada e componentes
aprovados, entao:

- Para qualquer grafico, card de indicador, painel de dashboard ou tela do
  portal, o skill `graficos-impacto` vence. Ele carrega os tokens, os helpers e
  os componentes reais deste repositorio.
- O documento canonico se aplica quando existe espaco de decisao visual real,
  por exemplo uma tela institucional, uma landing, um fluxo novo sem
  equivalente no portal.
- Em conflito entre os dois, prevalece o que ja esta aprovado no codigo.
