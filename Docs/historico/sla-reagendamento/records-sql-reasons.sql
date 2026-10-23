SELECT
    so.id::text              AS id,
    so.code                  AS code,
    so.scheduled_date        AS scheduled_date,
    so.period                AS period_key,
    so.technician_id::text   AS technician_id,
    tech.name                AS technician_name,
    -- Equipes do técnico no cadastro do SGI. Subconsulta escalar de propósito:
    -- um JOIN em team_users duplicaria a OS quando o técnico está em duas
    -- equipes (a tabela não tem unicidade por usuário).
    (SELECT array_agg(t.name ORDER BY t.name)
       FROM public.team_users tu
       JOIN public.teams t ON t.id = tu.team_id AND t.deleted_at IS NULL
      WHERE tu.user_id = so.technician_id) AS technician_team_names,
    so.type                  AS type_key,
    soc.name                 AS category,
    so.status                AS status_key,
    sor.label                AS resolution_raw,
    so.address               AS address,
    ca.city                  AS subscription_city,
    so.started_at            AS started_at,
    so.finished_at           AS finished_at,
    EXTRACT(EPOCH FROM (so.arrived_at - so.started_motion_at)) / 60.0 AS travel_minutes,
    so.difficulty_level      AS difficulty_key,
    -- Motivo da tabela reasons; OS antiga sem id cai no último texto do
    -- histórico, que a migração de 20/10/2026 não mexe.
    COALESCE(ur.label, uh.last_reason) AS unproductive_reason_raw,
    soc.sla                  AS sla_hours,
    so.rescheduled_at        AS rescheduled_at,
    reag.name                AS rescheduled_by_name,
    -- Usuário do SGI ligado a um cliente (login do aplicativo do cliente):
    -- em 13/10/2026 nenhum reagendamento veio por aí, todos são de
    -- colaboradores, mas a dica da lista distingue os dois por este campo.
    (reag.customer_id IS NOT NULL) AS rescheduled_by_customer,
    COALESCE(rr.label, rc.last_reason) AS rescheduling_reason_raw,
    COALESCE(rc.n, 0)        AS reschedule_count
FROM public.service_orders so
LEFT JOIN auth.users                      tech ON tech.id = so.technician_id
LEFT JOIN auth.users                      reag ON reag.id = so.rescheduled_by
LEFT JOIN public.service_order_categories soc  ON soc.id  = so.category_id
LEFT JOIN public.service_order_resolution sor  ON sor.id  = so.resolution_id
LEFT JOIN public.subscriptions            s    ON s.id    = so.subscription_id
LEFT JOIN public.customer_addresses       ca   ON ca.id   = s.customer_address_id
LEFT JOIN public.reasons                  ur   ON ur.id   = so.unproductive_reason_id
LEFT JOIN public.reasons                  rr   ON rr.id   = so.rescheduling_reason_id
-- Reagendamentos por OS, agrupados ANTES do join: a subconsulta correlacionada
-- (um COUNT por OS) levava 35 s em produção em 13/10/2026 contra 50 ms assim.
-- O mesmo agrupamento traz o motivo do último reagendamento.
LEFT JOIN (
    SELECT h.service_order_id,
           COUNT(*) AS n,
           (array_agg(h.reason ORDER BY h.created_at DESC))[1] AS last_reason
      FROM public.service_order_history h
     WHERE h.type = 'rescheduled' AND h.deleted_at IS NULL
     GROUP BY h.service_order_id
) rc ON rc.service_order_id = so.id
-- Motivo da última improdutiva registrada no histórico, pelo mesmo caminho.
LEFT JOIN (
    SELECT h.service_order_id,
           (array_agg(h.reason ORDER BY h.created_at DESC))[1] AS last_reason
      FROM public.service_order_history h
     WHERE h.type = 'unproductive' AND h.deleted_at IS NULL
     GROUP BY h.service_order_id
) uh ON uh.service_order_id = so.id
WHERE so.deleted_at IS NULL
  AND so.scheduled_date IS NOT NULL
  {filtros}
ORDER BY so.scheduled_date, so.created_at, so.code
