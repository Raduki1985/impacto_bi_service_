# Para a Caio: contrato x ordem de serviço no SGI, o que o BI encontrou

Data: 16/09/2026, banco de produção, leitura. Levantamento do BI (Mário).
Cada item tem um CSV ao lado com os números de contrato, sem dado de
cliente. A coluna "motivo" dos CSVs é o texto livre gravado na própria
ordem de serviço.

## 1. Contratos ativos sem data de ativação

20 contratos vendidos desde jul/2026 estão `active` com `started_at` nulo.
17 deles têm OS de instalação `completed` com `finished_at`; só 7 têm
`approved_at`. Lista: `contratos-ativos-sem-data-ativacao-2026-09-16.csv`.

Desde ago/2026 o `started_at` normalmente vem 1 a 2 minutos depois do
`finished_at` da OS de instalação. Pergunta: que caminho leva o contrato a
`active` sem gravar `started_at`? Para o BI esses 20 ficam fora de Vendas
ativadas (agosto: 737 contados contra 750 ativos de verdade).

## 2. Junho: 118 contratos "Assinada" que já estão instalados

Dos 118 contratos vendidos em jun/2026 com status `signed`, 112 têm OS de
instalação `completed` e todos os 118 têm `started_at`. O status nunca
avançou para `active`. Maio tem mais 2. De julho em diante o caso não
aparece. Lista: `caio-junho-assinados-com-instalacao-concluida-2026-09-16.csv`.

## 3. O status do contrato não acompanha a ordem de serviço

Medido nas OS de 2026:

- Depois de uma visita `unproductive`, o SGI cria uma OS nova (outra linha,
  raramente com `parent_id`): nos 195 contratos que passaram por
  improdutiva e depois ativaram, 179 ganharam OS nova, 131 em até 1 dia,
  90% em até 4 dias. O contrato fica `scheduled` o tempo todo, e continua
  `scheduled` mesmo quando a OS nova nunca é criada.
- OS `closed` é fechamento manual, com `closing_reason` em texto livre; só
  47 das 165 de instalação têm `finished_at`. Quando o motivo é desistência
  ("cliente cancelou", "vai mudar de endereço", "a pedido da vendedora"), o
  contrato continua `scheduled` em vez de ir para `cancelled`. Quando o
  motivo é "instalação já feita", "ativação remota" ou "feito via Voalle",
  o contrato deveria estar `active`.
- Resultado: 47 contratos `scheduled` sem nenhuma OS aberta, de qualquer
  tipo (jul 9, ago 24, set 14), a maioria há semanas. Lista com a última
  OS, o status dela, o motivo e os dias desde o último evento:
  `caio-agendados-sem-ordem-aberta-2026-09-16.csv`.

Status de OS que o BI trata como abertos: `scheduled`, `rescheduled`,
`in_motion`, `arrived`, `checklist`, `provision`, `pending_approval`,
`pending`. Se faltar algum, avise.

## 4. Pendente nunca assinado fica pendente para sempre

Todo contrato `pending` da base está sem assinatura e sem OS: mar 1, mai
20, jun 39, jul 36, ago 47, set 38. Entre os que ativam, 90% assinam em até
1 dia da venda. O domínio de status tem `expired`, mas nenhum contrato o
usa. Pergunta de regra, para o Mário e para você: contrato sem assinatura
expira? Com quantos dias?

## 5. O que o BI pede para ter no banco

Enquanto isso o BI vai calcular por fora, no serviço de BI, um sinalizador
"tem ordem aberta" e "dias desde a última ordem" por contrato, varrendo
`service_orders`. O pedido para o SGI, na forma que for mais simples para
vocês:

a) o status do contrato acompanhar a ordem: voltar de `scheduled` para
   `signed` quando a última OS ficou improdutiva ou encerrada e não existe
   OS aberta; ir para `cancelled` quando a OS é encerrada por desistência;
   ir para `active`, com `started_at`, quando a OS de instalação conclui,
   inclusive nos 112 casos do item 2; ou

b) um campo no contrato com a situação da última OS de instalação (id,
   status, data do último evento) e um sinalizador de OS aberta, para o BI
   e o Relatório de Vendas lerem sem varrer `service_orders`.

## Consultas usadas (leitura)

Contratos ativos sem `started_at` (item 1):

```sql
SELECT s.code, (s.contracted_at AT TIME ZONE 'UTC')::date AS venda, s.status
FROM public.subscriptions s
WHERE s.deleted_at IS NULL AND s.status = 'active' AND s.started_at IS NULL
  AND s.external_code IS NOT NULL
  AND (s.contracted_at AT TIME ZONE 'UTC')::date >= '2026-06-01'
ORDER BY 2;
```

Junho, assinados com instalação concluída (item 2):

```sql
SELECT s.code, s.status, s.started_at,
       MAX(so.finished_at) FILTER (WHERE so.type = 'installation'
                                     AND so.status = 'completed') AS instalada_em
FROM public.subscriptions s
LEFT JOIN public.service_orders so ON so.subscription_id = s.id AND so.deleted_at IS NULL
WHERE s.deleted_at IS NULL AND s.status = 'signed' AND s.external_code IS NOT NULL
  AND (s.contracted_at AT TIME ZONE 'UTC')::date BETWEEN '2026-06-01' AND '2026-06-30'
GROUP BY 1, 2, 3
ORDER BY 1;
```

Agendados sem OS aberta (item 3):

```sql
WITH abertas AS (
  SELECT subscription_id FROM public.service_orders
  WHERE deleted_at IS NULL
    AND status IN ('scheduled','rescheduled','in_motion','arrived','checklist',
                   'provision','pending_approval','pending')
  GROUP BY 1
)
SELECT s.code, (s.contracted_at AT TIME ZONE 'UTC')::date AS venda
FROM public.subscriptions s
LEFT JOIN abertas a ON a.subscription_id = s.id
WHERE s.deleted_at IS NULL AND s.status = 'scheduled' AND s.external_code IS NOT NULL
  AND (s.contracted_at AT TIME ZONE 'UTC')::date >= '2026-07-01'
  AND a.subscription_id IS NULL
ORDER BY 2;
```
