import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## hora real de inicio do servico por turno marcado (dias uteis desde 21/09, OS de cliente concluidas ou improdutivas)")
run("""SELECT so.period,
       count(*) AS os,
       to_char(percentile_cont(0.1) WITHIN GROUP (ORDER BY (so.started_at AT TIME ZONE 'America/Sao_Paulo')::time), 'HH24:MI') AS inicio_p10,
       to_char(percentile_cont(0.5) WITHIN GROUP (ORDER BY (so.started_at AT TIME ZONE 'America/Sao_Paulo')::time), 'HH24:MI') AS inicio_p50,
       to_char(percentile_cont(0.9) WITHIN GROUP (ORDER BY (so.started_at AT TIME ZONE 'America/Sao_Paulo')::time), 'HH24:MI') AS inicio_p90,
       round(100.0*count(*) FILTER (WHERE so.period='morning' AND (so.started_at AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00')/NULLIF(count(*) FILTER (WHERE so.period='morning'),0),1) AS pct_manha_comecou_a_tarde,
       round(100.0*count(*) FILTER (WHERE so.period='afternoon' AND (so.started_at AT TIME ZONE 'America/Sao_Paulo')::time >= '18:00')/NULLIF(count(*) FILTER (WHERE so.period='afternoon'),0),1) AS pct_tarde_comecou_apos_18
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
  AND so.status IN ('completed','unproductive') AND so.started_at IS NOT NULL
  AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
GROUP BY 1 ORDER BY 1""")

print("\n## por dia: OS de manha que so comecaram a tarde (sinal de turno estourado) x carga do dia")
run("""WITH d AS (
  SELECT so.scheduled_date AS dia,
         count(*) AS os,
         count(DISTINCT so.technician_id) FILTER (WHERE so.status IN ('completed','unproductive')) AS tecnicos,
         count(*) FILTER (WHERE so.period='morning' AND so.started_at IS NOT NULL) AS manha_exec,
         count(*) FILTER (WHERE so.period='morning' AND (so.started_at AT TIME ZONE 'America/Sao_Paulo')::time >= '13:00') AS manha_tarde,
         count(*) FILTER (WHERE so.status IN ('expired','closed')) AS nao_exec,
         count(*) FILTER (WHERE so.status='unproductive') AS improd
  FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
  GROUP BY 1)
SELECT dia, to_char(dia,'Dy') AS dsem, os, tecnicos, round(os::numeric/tecnicos,1) AS os_por_tec,
       manha_exec, manha_tarde, round(100.0*manha_tarde/NULLIF(manha_exec,0),1) AS pct_manha_estourou,
       nao_exec, improd
FROM d ORDER BY dia""", limit=40)

print("\n## tecnicos disponiveis hoje no cadastro (is_available) por equipe, contra os que executaram OS em dia util tipico")
run("""SELECT COALESCE((SELECT min(t.name) FROM public.team_users tu JOIN public.teams t ON t.id=tu.team_id AND t.deleted_at IS NULL WHERE tu.user_id=u.id),'Sem equipe') AS equipe,
       count(*) FILTER (WHERE u.is_available) AS disponiveis,
       count(*) FILTER (WHERE NOT u.is_available) AS indisponiveis,
       count(*) FILTER (WHERE u.is_available AND EXISTS (SELECT 1 FROM public.service_orders so WHERE so.technician_id=u.id AND so.scheduled_date BETWEEN current_date-14 AND current_date-1)) AS disp_com_os_14d
FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'
GROUP BY 1 ORDER BY 2 DESC""")

print("\n## amanha: OS marcadas por tipo x tecnicos aptos (categoria) disponiveis")
run("""SELECT soc.type, count(*) AS os_amanha, round(sum(soc.sla)::numeric,1) AS horas_sla,
       (SELECT count(DISTINCT tc.technician_id) FROM public.technician_capacities tc JOIN auth.users u ON u.id=tc.technician_id AND u.deleted_at IS NULL AND u.status='active' AND u.is_available
         JOIN public.service_order_categories c2 ON c2.id=tc.service_order_category_id WHERE tc.deleted_at IS NULL AND c2.type=soc.type) AS tecnicos_aptos_disponiveis
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date = current_date+1 AND so.status NOT IN ('completed','closed','expired','unproductive')
GROUP BY 1 ORDER BY 2 DESC""")

print("\n## reagendamentos no historico: a OS foi empurrada para frente quantos dias? (desde 21/09)")
run("""SELECT CASE WHEN so.rescheduled_at IS NULL THEN 'nao' ELSE 'sim' END AS reagendada,
       count(*) AS os,
       round(100.0*count(*) FILTER (WHERE so.status IN ('expired','closed'))/count(*),1) AS pct_nao_exec,
       round(100.0*count(*) FILTER (WHERE so.status='unproductive')/count(*),1) AS pct_improd
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1 AND soc.type NOT IN ('infra','audit')
GROUP BY 1""")

print("\n## motivos de reagendamento que falam de agenda/tecnico/capacidade (desde 21/09, texto livre)")
run("""SELECT lower(trim(h.reason)) AS motivo, count(*) FROM public.service_order_history h
WHERE h.type='rescheduled' AND h.deleted_at IS NULL AND h.created_at >= '2026-09-21'
  AND lower(h.reason) ~ 'agenda|t[eé]cnico|capac|rota|lotad|cheia|sem equipe|falta de'
GROUP BY 1 ORDER BY 2 DESC""", limit=25)
