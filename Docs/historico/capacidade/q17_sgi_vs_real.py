import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

print("## ocupacao geral do SGI (42 ativos x 3,2 h) x refeita com os tecnicos PRESENTES no dia, ultimos 15 dias uteis")
run("""WITH tech AS (SELECT count(*) AS n FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'),
os AS (SELECT so.scheduled_date AS dia, so.period, soc.sla, so.technician_id, so.status,
              (so.finished_at AT TIME ZONE 'America/Sao_Paulo')::time AS fim
       FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-21 AND current_date-1
         AND so.status NOT IN ('closed','expired','pending') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5),
pres AS (SELECT dia, count(DISTINCT technician_id) FILTER (WHERE status IN ('completed','unproductive')) AS presentes,
                count(DISTINCT technician_id) FILTER (WHERE fim > '19:00') AS depois_19h
         FROM os GROUP BY 1)
SELECT o.dia, to_char(o.dia,'Dy') AS dsem, round(sum(o.sla)::numeric,0) AS horas_previstas_dia, p.presentes,
       round((100*sum(o.sla)/((SELECT n FROM tech)*6.4))::numeric,0) AS ocup_sgi_pct,
       round((100*sum(o.sla)/(p.presentes*6.4))::numeric,0) AS ocup_presentes_pct,
       round((100*sum(o.sla)/(p.presentes*8.0))::numeric,0) AS ocup_escala_8h_pct,
       p.depois_19h AS tecnicos_apos_19h
FROM os o JOIN pres p ON p.dia=o.dia WHERE o.period IS NOT NULL GROUP BY 1,2,p.presentes,p.depois_19h ORDER BY 1""", limit=30)

print("\n## categorias LOTADAS na conta do SGI: hoje (aptidao cadastrada) x se o cadastro incluisse quem executou nos ultimos 28 dias")
run("""WITH tech AS (SELECT u.id FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'),
cap_cad AS (SELECT tc.technician_id, tc.service_order_category_id AS category_id FROM public.technician_capacities tc JOIN tech ON tech.id=tc.technician_id WHERE tc.deleted_at IS NULL),
cap_exec AS (SELECT DISTINCT so.technician_id, so.category_id FROM public.service_orders so JOIN tech ON tech.id=so.technician_id
             WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-28 AND current_date-1 AND so.status IN ('completed','unproductive')),
cap_corr AS (SELECT * FROM cap_cad UNION SELECT * FROM cap_exec),
os AS (SELECT so.scheduled_date AS dia, so.period, so.category_id, soc.sla FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-21 AND current_date-1 AND so.period IS NOT NULL
         AND so.status NOT IN ('closed','expired','pending') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5),
ct AS (SELECT DISTINCT dia, category_id FROM os),
calc AS (
  SELECT 'cadastro atual' AS cenario, ct.dia, ct.category_id, os.period,
         (SELECT count(DISTINCT c.technician_id) FROM cap_cad c WHERE c.category_id=ct.category_id) AS aptos,
         sum(os.sla) AS consumo
  FROM ct JOIN os ON os.dia=ct.dia AND os.category_id IN (SELECT c2.category_id FROM cap_cad c1 JOIN cap_cad c2 ON c2.technician_id=c1.technician_id WHERE c1.category_id=ct.category_id UNION SELECT ct.category_id)
  GROUP BY 1,2,3,4
  UNION ALL
  SELECT 'cadastro corrigido', ct.dia, ct.category_id, os.period,
         (SELECT count(DISTINCT c.technician_id) FROM cap_corr c WHERE c.category_id=ct.category_id),
         sum(os.sla)
  FROM ct JOIN os ON os.dia=ct.dia AND os.category_id IN (SELECT c2.category_id FROM cap_corr c1 JOIN cap_corr c2 ON c2.technician_id=c1.technician_id WHERE c1.category_id=ct.category_id UNION SELECT ct.category_id)
  GROUP BY 1,2,3,4)
SELECT cenario, count(*) AS dia_turnos_categoria,
       count(*) FILTER (WHERE aptos = 0 OR 100*consumo/NULLIF(aptos*3.2,0) >= 100) AS lotados,
       round(100.0*count(*) FILTER (WHERE aptos = 0 OR 100*consumo/NULLIF(aptos*3.2,0) >= 100)/count(*),0) AS pct_lotados
FROM calc GROUP BY 1 ORDER BY 1""")

print("\n## quem cria as OS: usuario interno ou cliente pelo app (OS criadas desde 21/09)")
run("""SELECT CASE WHEN u.customer_id IS NOT NULL THEN 'cliente (app)' WHEN u.role IS NULL THEN 'sem autor' ELSE u.role END AS quem_criou,
       count(*) AS os, round(100.0*count(*)/sum(count(*)) OVER (),0) AS pct
FROM public.service_orders so LEFT JOIN auth.users u ON u.id = so.created_by
WHERE so.deleted_at IS NULL AND so.created_at >= '2026-09-21'
GROUP BY 1 ORDER BY 2 DESC""")
