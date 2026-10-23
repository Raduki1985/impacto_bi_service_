import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## agenda futura (hoje em diante), por dia e turno")
run("""SELECT so.scheduled_date, to_char(so.scheduled_date,'Dy') AS dia, so.period,
       count(*) AS os,
       count(*) FILTER (WHERE so.technician_id IS NOT NULL) AS com_tecnico,
       count(*) FILTER (WHERE soc.type IN ('infra','audit')) AS infra,
       count(*) FILTER (WHERE soc.type = 'installation') AS instalacao,
       count(*) FILTER (WHERE soc.type = 'security_installation') AS cameras,
       count(*) FILTER (WHERE soc.type = 'maintenance') AS manutencao,
       count(*) FILTER (WHERE soc.type = 'address_change') AS mudanca,
       round(sum(soc.sla)::numeric,1) AS horas_sla,
       count(*) FILTER (WHERE so.rescheduled_at IS NOT NULL) AS reagendadas
       FROM public.service_orders so LEFT JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date >= current_date AND so.status NOT IN ('completed','closed','expired','unproductive')
       GROUP BY 1,2,3 ORDER BY 1,3""", limit=80)

print("\n## agenda futura por cidade (14 dias)")
run("""SELECT COALESCE(so.address->>'city', ca.city) AS cidade, count(*) AS os
       FROM public.service_orders so
       LEFT JOIN public.subscriptions s ON s.id=so.subscription_id LEFT JOIN public.customer_addresses ca ON ca.id=s.customer_address_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date AND current_date+14 AND so.status NOT IN ('completed','closed','expired','unproductive')
       GROUP BY 1 ORDER BY 2 DESC""", limit=30)

print("\n## carga historica por dia (8 semanas), OS de cliente (sem infra/audit)")
run("""WITH d AS (
  SELECT so.scheduled_date AS dia, so.period,
         count(*) AS os,
         count(*) FILTER (WHERE so.status='completed') AS concluidas,
         count(*) FILTER (WHERE so.status='unproductive') AS improd,
         count(*) FILTER (WHERE so.status IN ('expired','closed')) AS nao_exec,
         count(DISTINCT so.technician_id) FILTER (WHERE so.status IN ('completed','unproductive')) AS tecnicos,
         round(sum(soc.sla)::numeric,1) AS horas_sla,
         round((sum(EXTRACT(EPOCH FROM (so.finished_at-so.started_at)))/3600.0)::numeric,1) AS horas_exec,
         round((sum(EXTRACT(EPOCH FROM (so.arrived_at-so.started_motion_at)))/3600.0)::numeric,1) AS horas_desloc
  FROM public.service_orders so LEFT JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-56 AND current_date-1
    AND COALESCE(soc.type,'') NOT IN ('infra','audit')
  GROUP BY 1,2)
SELECT dia, to_char(dia,'Dy') AS dsem, period, os, concluidas, improd, nao_exec, tecnicos,
       round(os::numeric/NULLIF(tecnicos,0),1) AS os_por_tec, horas_sla, horas_exec, horas_desloc,
       round(horas_sla/NULLIF(tecnicos,0),1) AS sla_h_por_tec
FROM d ORDER BY dia, period""", limit=130)
