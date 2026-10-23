# Histórico de alterações expõe senha e CPF

Aberta em 14/10/2026. Situação: levada ao Caio nas perguntas de 14/10, sem
resposta registrada até 20/10/2026.

## O que acontece no banco

A tabela de histórico de alterações do SGI (`audit_logs`) grava o usuário
inteiro antes e depois de cada mudança, incluindo a senha cifrada (hash)
e o CPF. O usuário de leitura do BI (`bi_web`) consegue ler essa tabela.

## Por que importa

- Senha cifrada e CPF não precisam chegar ao BI. Qualquer leitura dessa
  tabela pelo BI aumenta o risco de vazamento.
- Essa tabela provavelmente tem a data de cada troca de status do técnico,
  que resolveria a pendência de 20/10/2026 (inativação sem data). Por causa
  deste risco, decidimos NÃO usar.

## Regra enquanto estiver aberta

Nunca ler nem imprimir os campos `before` e `after` inteiros dessa tabela.

## O que pedir

1. Tirar senha cifrada e CPF do que o `audit_logs` grava, ou
2. tirar do usuário `bi_web` a permissão de ler essa tabela e, se o BI
   precisar de alguma coisa dela, criar uma visão só com os campos
   necessários (por exemplo: usuário, campo alterado, valor novo, data).
