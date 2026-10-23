# O SGI não tem trava de rota: o gestor usa o cadastro de feriados

Aberta em 20/10/2026 (começou como "rota da Terceirizada fechada em
06/10"). Situação: aberta, não enviada ao Caio.

## O que acontece

O gestor de ordens de serviço cadastra "feriados" no SGI para TRAVAR a
rota: o SGI para de aceitar OS naquele dia (todas as equipes ou só as
escolhidas), e a equipe continua trabalhando no que já estava marcado.
Depois ele exclui o registro. Histórico lido em 20/10/2026:

| Nome cadastrado            | Dia            | Equipe       | Criado | Excluído |
|----------------------------|----------------|--------------|--------|----------|
| Barramento da rota         | 03/09          | todas        | 28/08  | 11/09    |
| CHUVA INTENSA ROTA FECHADA | 01, 02 e 09/09 | todas        | 01/09  | 22/09    |
| barramento da rota         | 11/09          | todas        | 11/09  | 22/09    |
| ROTA FECHADA               | 22/09          | todas        | 14/09  | 22/09    |
| INDEPENCIA DO BRASIL       | 06/10          | Terceirizada | 01/09  | ainda ativo |

Em 06/10 a Terceirizada trabalhou com a rota travada: 10 técnicos, 43 OS
concluídas e 1 improdutiva.

## Por que é pendência do banco

1. O cadastro de feriados grava só dia e mês, sem ano. Trava esquecida
   se repete todo ano: a de 06/10 vai travar a Terceirizada de novo em
   06/10/2027 se ninguém excluir.
2. Quando o gestor exclui a trava, ela some do passado. Não dá para saber
   depois que o dia esteve travado.
3. O nome é texto livre: o dado não separa feriado de verdade de trava.
   Só o grupo "Fixos (padrão do sistema)" garante que é feriado do
   calendário.

## O que o portal faz (20/10/2026)

- De hoje em diante, segue o SGI: a equipe da rota travada sai da
  capacidade, porque o SGI não aceita OS para ela.
- Nos dias passados, a trava não tira a equipe da capacidade: ela
  trabalhou, e as travas excluídas já não aparecem.
- O dia ganha um selo âmbar: cadeado com a equipe ("Terceirizada") ou com
  o nome cadastrado ("Chuva intensa rota fechada"); feriado do calendário
  vai sem cadeado ("Feriado · Aparecida"). O texto inteiro fica na dica.

## O que pedir

1. (recomendado) Uma trava de rota de verdade no SGI: data completa (com
   ano), equipe, motivo, e quem travou. Separada do cadastro de feriados.
2. Enquanto não existir: combinar com o gestor de excluir a trava logo
   depois do dia, e conferir a de 06/10 (Terceirizada), que segue ativa.

## Texto sugerido para o Caio

Caio, o gestor de OS cadastra feriado no SGI para travar a rota (chuva,
barramento, agenda cheia). Como o feriado é só dia e mês, a trava se
repete todo ano se ninguém excluir: a de 06/10 da Terceirizada, criada
em 01/09, continua ativa e vai travar 06/10/2027. E quando ela é
excluída, some do histórico. Dá para pensar numa trava de rota com data
completa, equipe e motivo, separada dos feriados?
