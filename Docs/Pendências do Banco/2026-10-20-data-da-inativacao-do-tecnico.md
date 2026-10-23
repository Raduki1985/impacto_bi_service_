# Inativação do técnico não tem data no SGI

Aberta em 20/10/2026. Situação: RECUSADA em 21/10/2026. Os devs não vão
gravar o histórico de ativação e inativação: para eles o certo é a escala
dos técnicos, e esse histórico seria remendo. O limite abaixo continua até a
escala existir no SGI; quando ela chegar, a capacidade passa a usar quem está
escalado em cada dia e turno, e esta pendência perde o sentido.

## O que falta no banco

Na tabela de usuários do SGI (`auth.users`), ativo e inativo ficam numa
coluna só, `status`, que guarda apenas o estado de agora. Quando alguém
inativa ou reativa um técnico, o SGI troca o valor e não grava a data.

As outras duas mudanças do cadastro têm data: `created_at` (criação) e
`deleted_at` (exclusão; a linha não some, só ganha a data).

## Por que importa

Desde 20/10/2026 a Agenda e capacidade usa a régua do SGI: capacidade do
turno = técnicos ativos no cadastro x 3h12. Nos dias passados, o número
de ativos precisa ser o daquele dia, e não o de hoje.

Sem a data da inativação:

- quem for inativado some de todos os dias passados, inclusive dos dias
  em que trabalhou;
- quem for reativado aparece em todos os dias passados, inclusive no
  período em que esteve inativo.

Cada caso mexe 3h12 por turno nos dias passados. Em 20/10/2026 eram 7
técnicos inativos no cadastro, sem como saber desde quando.

## O que fizemos enquanto isso (opção B, 20/10/2026)

O serviço conta os ativos de cada dia passado pela data de criação e de
exclusão: entra quem já tinha sido criado, sai quem já tinha sido
excluído. A inativação segue o cadastro de hoje, e a dica do mouse do dia
avisa: "inativações não têm data e seguem o cadastro atual".

Medido em 20/10/2026 (cadastro de hoje x corrigido):

| Período         | Hoje | Corrigido |
|-----------------|------|-----------|
| 24/08 a 02/09   | 42   | 37        |
| 03/09 a 17/09   | 42   | 38        |
| 01/10 a 04/10   | 42   | 40        |
| 05/10 a 12/10   | 42   | 42        |
| 13/10           | 42   | 43        |
| 14/10 em diante | 42   | 42        |

Código: `active_on` em `app/services/bi/os_schedule.py` do serviço, branch
`feat/os-agenda-regua-sgi`.

## O que pedir

1. (recomendado) O SGI gravar a data da inativação e da reativação: uma
   coluna como `inactivated_at`, ou uma tabela de histórico de status com
   a data de cada troca. Resolve na origem e serve para qualquer relatório.
2. Alternativa só do BI: o serviço guardar todo dia quantos técnicos
   estão ativos (uma foto do dia). Vale só a partir do dia em que começar,
   e o serviço passa a guardar dado, o que é decisão do Caio.

Não usar a tabela de histórico de alterações (`audit_logs`) para isso: ver
a pendência de 14/10/2026.

## Texto sugerido para o Caio

Caio, na Agenda e capacidade a capacidade dos dias passados usa os
técnicos ativos de cada dia. O SGI grava a data de criação e de exclusão
do técnico, mas não a de inativação: o status só troca de valor. Com
isso, cada inativação tira o técnico de todos os dias passados. Dá para o
SGI gravar a data da inativação e da reativação (uma coluna ou um
histórico de status)?
