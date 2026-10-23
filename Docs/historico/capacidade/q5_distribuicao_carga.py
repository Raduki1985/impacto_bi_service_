import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## tecnico-dia desde 21/09 (dias uteis): OS executadas, horas no cliente+deslocamento, jornada")
run("""WITH td AS (
  SELECT so.technician_id, so.scheduled_date AS dia,
         count(*) AS os,
         sum(soc.sla) AS sla_h,
         sum(EXTRACT(EPOCH FROM (so.finished_at-so.started_at)))/3600.0 AS exec_h,
         sum(EXTRACT(EPOCH FROM (so.arrived_at-so.started_motion_at)))/3600.0 AS desloc_h,
         EXTRACT(EPOCH FROM (max(so.finished_at) - min(so.started_motion_at)))/3600.0 AS jornada_h
  FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL
    AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
  GROUP BY 1,2)
SELECT count(*) AS tec_dias,
       round(avg(os),2) AS os_media, percentile_cont(0.5) WITHIN GROUP (ORDER BY os) AS os_p50,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY os) AS os_p90, max(os) AS os_max,
       round(avg(sla_h)::numeric,2) AS sla_h_media, round((percentile_cont(0.9) WITHIN GROUP (ORDER BY sla_h))::numeric,2) AS sla_h_p90,
       round(avg(exec_h)::numeric,2) AS exec_h_media, round(avg(desloc_h)::numeric,2) AS desloc_h_media,
       round(avg(exec_h+desloc_h)::numeric,2) AS ocupado_h_media,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY jornada_h))::numeric,2) AS jornada_p50,
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY jornada_h))::numeric,2) AS jornada_p90
FROM td""")

print("\n## distribuicao de OS por tecnico-dia (dias uteis desde 21/09)")
run("""WITH td AS (
  SELECT so.technician_id, so.scheduled_date AS dia, count(*) AS os
  FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL
    AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
  GROUP BY 1,2)
SELECT os, count(*) AS tec_dias FROM td GROUP BY 1 ORDER BY 1""")

print("\n## por equipe, desde 21/09, dias uteis: tecnicos/dia, OS/tecnico-dia, horas")
run("""WITH base AS (
  SELECT so.technician_id, so.scheduled_date AS dia, so.status, soc.sla,
         EXTRACT(EPOCH FROM (so.finished_at-so.started_at))/3600.0 AS exec_h,
         EXTRACT(EPOCH FROM (so.arrived_at-so.started_motion_at))/3600.0 AS desloc_h,
         COALESCE((SELECT min(t.name) FROM public.team_users tu JOIN public.teams t ON t.id=tu.team_id AND t.deleted_at IS NULL WHERE tu.user_id=so.technician_id),'Sem equipe') AS equipe
  FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL
    AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5),
td AS (SELECT equipe, technician_id, dia, count(*) AS os, sum(sla) AS sla_h, sum(exec_h) AS exec_h, sum(desloc_h) AS desloc_h FROM base GROUP BY 1,2,3)
SELECT equipe, count(DISTINCT technician_id) AS tecnicos, round(count(*)::numeric/count(DISTINCT dia),1) AS tec_por_dia,
       sum(os) AS os, round(avg(os),2) AS os_por_tec_dia, round(avg(sla_h)::numeric,2) AS sla_h_tec_dia,
       round(avg(exec_h)::numeric,2) AS exec_h_tec_dia, round(avg(desloc_h)::numeric,2) AS desloc_h_tec_dia
FROM td GROUP BY 1 ORDER BY os DESC""")

print("\n## antecedencia: criacao -> data agendada, OS criadas desde 21/09, por tipo")
run("""SELECT soc.type,
       count(*) AS os,
       round(100.0*count(*) FILTER (WHERE (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date = so.scheduled_date)/count(*),1) AS pct_mesmo_dia,
       round(100.0*count(*) FILTER (WHERE so.scheduled_date - (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date = 1)/count(*),1) AS pct_vespera,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY so.scheduled_date - (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS dias_p50,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY so.scheduled_date - (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date) AS dias_p90
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.created_at >= '2026-09-21' AND so.scheduled_date IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC""")

print("\n## carga x resultado: dias uteis desde 01/06 (OS de cliente), faixa de OS por tecnico ativo no dia")
run("""WITH d AS (
  SELECT so.scheduled_date AS dia,
         count(*) AS os,
         count(DISTINCT so.technician_id) FILTER (WHERE so.status IN ('completed','unproductive')) AS tecnicos,
         count(*) FILTER (WHERE so.status='unproductive') AS improd,
         count(*) FILTER (WHERE so.status IN ('expired','closed')) AS nao_exec,
         count(*) FILTER (WHERE so.status='completed') AS concl
  FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-06-01' AND current_date-1
    AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
  GROUP BY 1)
SELECT CASE WHEN os::numeric/tecnicos < 4 THEN 'a) menos de 4 OS por tecnico'
            WHEN os::numeric/tecnicos < 5 THEN 'b) 4 a 5'
            WHEN os::numeric/tecnicos < 6 THEN 'c) 5 a 6'
            ELSE 'd) 6 ou mais' END AS faixa,
       count(*) AS dias, round(avg(os),0) AS os_media, round(avg(tecnicos),1) AS tec_media,
       round(100.0*sum(concl)/sum(os),1) AS pct_concl,
       round(100.0*sum(improd)/sum(os),1) AS pct_improd,
       round(100.0*sum(nao_exec)/sum(os),1) AS pct_nao_exec
FROM d WHERE tecnicos > 0 GROUP BY 1 ORDER BY 1""")

print("\n## perfil por dia da semana desde 21/09 (OS de cliente)")
run("""SELECT extract(dow from so.scheduled_date) AS dow, to_char(so.scheduled_date,'Dy') AS dsem, count(DISTINCT so.scheduled_date) AS dias,
       round(count(*)::numeric/count(DISTINCT so.scheduled_date),0) AS os_por_dia,
       round(count(*) FILTER (WHERE so.period='morning')::numeric/count(DISTINCT so.scheduled_date),0) AS manha,
       round(count(*) FILTER (WHERE so.period='afternoon')::numeric/count(DISTINCT so.scheduled_date),0) AS tarde,
       round((count(DISTINCT (so.scheduled_date, so.technician_id)) FILTER (WHERE so.status IN ('completed','unproductive')))::numeric/count(DISTINCT so.scheduled_date),1) AS tec_por_dia
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1 AND soc.type NOT IN ('infra','audit')
GROUP BY 1,2 ORDER BY 1""")

print("\n## quando as OS de HOJE foram criadas (antecedencia da agenda de hoje)")
run("""SELECT so.scheduled_date - (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dias_antes, count(*)
FROM public.service_orders so WHERE so.deleted_at IS NULL AND so.scheduled_date = current_date GROUP BY 1 ORDER BY 1""")

print("\n## horario real de inicio e fim do dia dos tecnicos (dias uteis desde 21/09), em SP")
run("""WITH td AS (
  SELECT so.technician_id, so.scheduled_date AS dia,
         min(so.started_motion_at AT TIME ZONE 'America/Sao_Paulo') AS inicio,
         max(so.finished_at AT TIME ZONE 'America/Sao_Paulo') AS fim
  FROM public.service_orders so
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL
    AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
  GROUP BY 1,2)
SELECT to_char(percentile_cont(0.1) WITHIN GROUP (ORDER BY inicio::time), 'HH24:MI') AS inicio_p10,
       to_char(percentile_cont(0.5) WITHIN GROUP (ORDER BY inicio::time), 'HH24:MI') AS inicio_p50,
       to_char(percentile_cont(0.5) WITHIN GROUP (ORDER BY fim::time), 'HH24:MI') AS fim_p50,
       to_char(percentile_cont(0.9) WITHIN GROUP (ORDER BY fim::time), 'HH24:MI') AS fim_p90
FROM td""")
