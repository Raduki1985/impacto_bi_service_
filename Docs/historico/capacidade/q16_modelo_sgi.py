"""Reproduz a conta do SchedulingService.get_summary do SGI (SCHEDULING_SUMMARY.md)
sobre a agenda real, em leitura. Parametros: periodo 4 h, eficiencia 0,8 (defaults,
porque as chaves schedule-period-* nao existem na tabela config de producao)."""
import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

ACTIVE = "('scheduled','rescheduled','in_motion','arrived','difficulty','products_used','checklist','resolution','provision','syncing','unproductive_checklist','pending_approval')"

print("## chaves de config do modelo (se nao existirem, valem os defaults 4.0 e 0.8)")
run("""SELECT key, value FROM public.config WHERE key ~* 'schedule|weekend|efficiency|duration' ORDER BY key""")

print("\n## tecnicos ATIVOS na regra do SGI (role technician, status active) e quantos tem alguma aptidao")
run("""SELECT count(*) AS ativos, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.technician_capacities tc WHERE tc.technician_id=u.id AND tc.deleted_at IS NULL)) AS com_aptidao,
       count(*) FILTER (WHERE u.is_available) AS disponiveis_agora
FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'""")

print("\n## GERAL, proximos 7 dias, como o SGI calcula: consumo = SLA das OS ativas; capacidade = ativos x 3,2 h por periodo")
run(f"""WITH tech AS (SELECT count(*) AS n FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'),
os AS (SELECT so.scheduled_date AS dia, so.period, soc.sla FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date AND current_date+7 AND so.period IS NOT NULL AND so.status IN {ACTIVE})
SELECT dia, to_char(dia,'Dy') AS dsem, period, count(*) AS os_ativas, round(sum(sla)::numeric,1) AS consumo_h,
       round((SELECT n FROM tech)*3.2,1) AS capacidade_h, round((100*sum(sla)/((SELECT n FROM tech)*3.2))::numeric,0) AS ocupacao_pct
FROM os GROUP BY 1,2,3 ORDER BY 1,3""", limit=30)

print("\n## GERAL, ultimos 15 dias uteis, mesma conta (aproximacao: consumo = todas as OS do dia menos encerradas e expiradas)")
run("""WITH tech AS (SELECT count(*) AS n FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'),
os AS (SELECT so.scheduled_date AS dia, so.period, soc.sla FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-21 AND current_date-1 AND so.period IS NOT NULL
         AND so.status NOT IN ('closed','expired','pending') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5)
SELECT dia, to_char(dia,'Dy') AS dsem,
       round(sum(sla) FILTER (WHERE period='morning')::numeric,0) AS manha_h, round((100*sum(sla) FILTER (WHERE period='morning')/((SELECT n FROM tech)*3.2))::numeric,0) AS manha_pct,
       round(sum(sla) FILTER (WHERE period='afternoon')::numeric,0) AS tarde_h, round((100*sum(sla) FILTER (WHERE period='afternoon')/((SELECT n FROM tech)*3.2))::numeric,0) AS tarde_pct
FROM os GROUP BY 1,2 ORDER BY 1""", limit=30)

print("\n## POR CATEGORIA, proximos 7 dias: categorias que o SGI ve LOTADAS (ocupacao >= 100%) ou sem tecnico apto")
run(f"""WITH tech AS (SELECT u.id FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'),
cap AS (SELECT tc.technician_id, tc.service_order_category_id AS category_id FROM public.technician_capacities tc JOIN tech ON tech.id=tc.technician_id WHERE tc.deleted_at IS NULL),
os AS (SELECT so.scheduled_date AS dia, so.period, so.category_id, soc.sla FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date AND current_date+7 AND so.period IS NOT NULL AND so.status IN {ACTIVE}),
ct AS (SELECT DISTINCT dia, category_id FROM os),
cn AS (SELECT ct.dia, ct.category_id, count(DISTINCT cap.technician_id) AS tecnicos FROM ct LEFT JOIN cap ON cap.category_id=ct.category_id GROUP BY 1,2),
shared AS (SELECT DISTINCT ct.dia, ct.category_id AS c, cap2.category_id AS shared_id FROM ct JOIN cap ON cap.category_id=ct.category_id JOIN cap cap2 ON cap2.technician_id=cap.technician_id
           UNION SELECT dia, category_id, category_id FROM ct),
consumo AS (SELECT s.dia, s.c, os.period, sum(os.sla) AS consumo, count(*) FILTER (WHERE os.category_id=s.c) AS os_proprias
            FROM shared s JOIN os ON os.dia=s.dia AND os.category_id=s.shared_id GROUP BY 1,2,3)
SELECT c.dia, to_char(c.dia,'Dy') AS dsem, soc.name AS categoria, cn.tecnicos AS aptos, c.period, c.os_proprias, round(c.consumo::numeric,1) AS consumo_compartilhado_h,
       round((cn.tecnicos*3.2)::numeric,1) AS capacidade_h, round((100*c.consumo/NULLIF(cn.tecnicos*3.2,0))::numeric,0) AS ocupacao_pct
FROM consumo c JOIN cn ON cn.dia=c.dia AND cn.category_id=c.c JOIN public.service_order_categories soc ON soc.id=c.c
WHERE cn.tecnicos = 0 OR 100*c.consumo/NULLIF(cn.tecnicos*3.2,0) >= 100
ORDER BY c.dia, c.period, ocupacao_pct DESC NULLS FIRST""", limit=80)

print("\n## POR CATEGORIA, ultimos 15 dias uteis: em quantos dia-turnos cada categoria ficou LOTADA na conta do SGI (aproximacao)")
run("""WITH tech AS (SELECT u.id FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'),
cap AS (SELECT tc.technician_id, tc.service_order_category_id AS category_id FROM public.technician_capacities tc JOIN tech ON tech.id=tc.technician_id WHERE tc.deleted_at IS NULL),
os AS (SELECT so.scheduled_date AS dia, so.period, so.category_id, soc.sla FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-21 AND current_date-1 AND so.period IS NOT NULL
         AND so.status NOT IN ('closed','expired','pending') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5),
ct AS (SELECT DISTINCT dia, category_id FROM os),
cn AS (SELECT ct.dia, ct.category_id, count(DISTINCT cap.technician_id) AS tecnicos FROM ct LEFT JOIN cap ON cap.category_id=ct.category_id GROUP BY 1,2),
shared AS (SELECT DISTINCT ct.dia, ct.category_id AS c, cap2.category_id AS shared_id FROM ct JOIN cap ON cap.category_id=ct.category_id JOIN cap cap2 ON cap2.technician_id=cap.technician_id
           UNION SELECT dia, category_id, category_id FROM ct),
consumo AS (SELECT s.dia, s.c, os.period, sum(os.sla) AS consumo, count(*) FILTER (WHERE os.category_id=s.c) AS os_proprias
            FROM shared s JOIN os ON os.dia=s.dia AND os.category_id=s.shared_id GROUP BY 1,2,3)
SELECT soc.name AS categoria, max(cn.tecnicos) AS aptos, count(*) AS dia_turnos_com_os,
       count(*) FILTER (WHERE cn.tecnicos = 0 OR 100*c.consumo/NULLIF(cn.tecnicos*3.2,0) >= 100) AS lotados,
       round(avg(100*c.consumo/NULLIF(cn.tecnicos*3.2,0))::numeric,0) AS ocupacao_media_pct,
       sum(c.os_proprias) AS os
FROM consumo c JOIN cn ON cn.dia=c.dia AND cn.category_id=c.c JOIN public.service_order_categories soc ON soc.id=c.c
GROUP BY 1 HAVING sum(c.os_proprias) >= 10 ORDER BY lotados DESC, os DESC""", limit=40)

print("\n## aptidao cadastrada x quem de fato executa (ultimos 28 dias), por categoria com 10+ OS")
run("""WITH exec AS (
  SELECT so.category_id, so.technician_id, count(*) AS os FROM public.service_orders so
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-28 AND current_date-1 AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL
  GROUP BY 1,2)
SELECT soc.name AS categoria,
       (SELECT count(*) FROM public.technician_capacities tc JOIN auth.users u ON u.id=tc.technician_id AND u.deleted_at IS NULL AND u.status='active' AND u.role='technician' WHERE tc.service_order_category_id=soc.id AND tc.deleted_at IS NULL) AS aptos_no_cadastro,
       count(DISTINCT e.technician_id) AS executaram_28d,
       count(DISTINCT e.technician_id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.technician_capacities tc WHERE tc.technician_id=e.technician_id AND tc.service_order_category_id=soc.id AND tc.deleted_at IS NULL)) AS executaram_sem_aptidao,
       sum(e.os) AS os_28d
FROM exec e JOIN public.service_order_categories soc ON soc.id=e.category_id
GROUP BY soc.id, soc.name HAVING sum(e.os) >= 10 ORDER BY os_28d DESC""", limit=40)
