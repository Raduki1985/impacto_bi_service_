# Para a Caio: sinal ligado, contrato parado e equipamento não registrado

Data: 25/09/2026, banco de produção, leitura. Levantamento do BI (Mário).
As listas vão em dois CSV ao lado, só com número de contrato e de ordem,
sem dado de cliente.

## 1. Contratos com sinal ligado que continuam Assinada ou Agendada

Lista: `caio-sinal-ligado-status-parado-2026-09-25.csv` (13 contratos,
conferidos às 17h de 25/09).

**Grupo A, instalação concluída e o contrato não virou ativo (5).**
`328422` e `331217` (`signed`, instalados em 05/06, parecem sobra do caso
de junho), `295018` (`scheduled`, instalado em 29/04, 4 faturas pagas),
`997965` (`scheduled`, maio) e `01636612` (`scheduled`, OS concluída em
17/09). Em `997965` e `01636612` a OS está `completed` com `finished_at`
nulo. O `01636612` é recente: o caminho de agendada para ativa ainda falha
em algum caso?

**Grupo B, vendas de maio e começo de junho sem nenhuma OS no SGI (4).**
`171809`, `620374`, `327577` e `388696`, todos `signed`, equipamento com
serial e `online`, `started_at` preenchido, e `388696` com fatura paga.
Pela data, a instalação foi pelo fluxo anterior às OS do SGI e o status
nunca foi atualizado.

**Grupo C, OS encerrada em vez de concluída (3).**
`01495824` e `01743193`: OS da categoria Ativação Remota encerradas
(`closed`) com motivo "cliente online" e "feita ativação remota". Só a OS
`completed` ativa o contrato, então os dois ficaram `scheduled`. Das 17 OS
de Ativação Remota encerradas desde junho, 15 contratos foram ativados
depois por outro caminho, e estes 2 não. No `01743193` o equipamento nem
foi registrado no contrato, então o SGI não mostra o sinal.
`01471235`: OS de instalação com segundo ponto encerrada sem motivo e sem
`closed_at`, equipamento `online`, fatura emitida.

**Grupo D, provável duplicidade (1).**
`01309145`: OS encerrada com "instalação já realizada em outro nome".
Candidato a cancelar, não a ativar.

## 2. Contratos ativos com instalação concluída e sem equipamento

Lista: `caio-ativos-sem-equipamento-2026-09-25.csv` (258 contratos).

Contratos vendidos de julho a setembro, hoje ativos, com OS de instalação
`completed` e nenhuma linha com `serial_number` em `customer_equipments`
para o contrato: jul 74, ago 109, set 75, cerca de 10% a 15% das ativações
de cada mês. Todos são planos de fibra, nenhum é só de câmera. Nenhum tem o
evento `equipment_provisioned` no histórico. 35 tiveram a OS concluída
pelo COP com `bypassed_provision`, e 16 têm o serial em outro contrato do
mesmo cliente. O restante não tem equipamento registrado em lugar nenhum.
Com isso a tela da assinatura não mostra sinal e o monitoramento não
enxerga esses clientes.

## 3. O que não dá para saber hoje

O SGI não registra quando nem por quem o contrato virou `active`. Os
`audit_logs` de `subscriptions` têm 119 alterações desde 21/05, nenhuma
para `active`, e o `subscription_history` não tem evento de ativação.
`subscription_approved` é a aprovação de viabilidade ou de desconto antes
da assinatura, não a ativação.

Hoje o BI só consegue descobrir o caminho de cada ativação pelas OS:

| Vendidas em, ativas hoje | jun | jul | ago | set |
|---|---|---|---|---|
| Total | 690 | 730 | 749 | 488 |
| Técnico instalou | 663 | 713 | 690 | 411 |
| Técnico instalou, COP concluiu com `bypassed_provision` | 0 | 0 | 35 | 67 |
| OS de Ativação Remota concluída | 0 | 2 | 6 | 7 |
| OS encerrada à mão com motivo de ativação | 23 | 6 | 10 | 0 |
| Só OS improdutiva ou encerrada sem motivo | 2 | 6 | 3 | 1 |
| Sem nenhuma OS | 2 | 3 | 5 | 2 |

As duas últimas linhas são contratos que viraram ativos sem que nenhuma OS
explique a ativação. O motivo de encerramento é texto livre e às vezes
traz nome de pessoa, por isso o BI não o usa como regra.

## 4. Pedidos

a) Corrigir o status dos 12 contratos dos grupos A, B e C e avaliar o
   `01309145`.

b) OS de Ativação Remota encerrada com o sinal ligado não pode deixar o
   contrato em `scheduled`: ou a OS é concluída, ou o encerramento com
   ativação também ativa o contrato.

c) Registrar a ativação: um evento no `subscription_history` (algo como
   `subscription_activated`) com usuário, data e caminho (OS de campo,
   Ativação Remota, liberação manual). É o que permitiria ao BI e ao
   Comercial saber quando o gestor liberou um contrato sem OS.

d) Registrar o equipamento nas instalações concluídas sem serial (item 2)
   e entender por que a conclusão da OS não gravou o equipamento no
   contrato.

## Consultas usadas (leitura)

Esteira com equipamento online, separando o que é equipamento copiado de
outro contrato do cliente:

```sql
SELECT s.code, s.status, e.status AS equipamento, e.last_update,
       EXISTS (SELECT 1 FROM public.subscriptions s2
               WHERE s2.customer_id = s.customer_id AND s2.id <> s.id
                 AND s2.deleted_at IS NULL
                 AND s2.status IN ('active','financial_blocked',
                                   'administrative_blocked','suspended')) AS cliente_tem_outro_ativo
FROM public.subscriptions s
JOIN public.customer_equipments e ON e.subscription_id = s.id AND e.deleted_at IS NULL
WHERE s.deleted_at IS NULL AND s.external_code IS NOT NULL
  AND s.status IN ('pending','signed','scheduled')
  AND (s.contracted_at AT TIME ZONE 'UTC')::date >= '2026-01-01'
  AND e.status = 'online'
ORDER BY s.status, s.contracted_at;
```

Ativos com instalação concluída e sem equipamento (item 2):

```sql
SELECT s.code, (s.contracted_at AT TIME ZONE 'UTC')::date AS venda, s.status
FROM public.subscriptions s
WHERE s.deleted_at IS NULL AND s.external_code IS NOT NULL
  AND s.status IN ('active','financial_blocked','administrative_blocked','suspended')
  AND (s.contracted_at AT TIME ZONE 'UTC')::date >= '2026-07-01'
  AND NOT EXISTS (SELECT 1 FROM public.customer_equipments e
                  WHERE e.subscription_id = s.id AND e.deleted_at IS NULL
                    AND e.serial_number IS NOT NULL)
  AND EXISTS (SELECT 1 FROM public.service_orders o
              WHERE o.subscription_id = s.id AND o.deleted_at IS NULL
                AND o.type = 'installation' AND o.status = 'completed')
ORDER BY 2, 1;
```
