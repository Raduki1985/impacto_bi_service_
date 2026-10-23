import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro, sgi_dev_ro
run = sgi_ro.run
run_dev = sgi_dev_ro.run

print("## disponivel x atividade no app: hora da ultima alteracao do cadastro, ultimo online, ultima localizacao (tecnicos ativos)")
run("""SELECT u.name, u.is_available,
       to_char(u.updated_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS cadastro_alterado,
       to_char(u.online_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS ultimo_online,
       to_char(u.last_location_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') AS ultima_localizacao,
       (SELECT to_char(max(so.started_motion_at) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') FROM public.service_orders so WHERE so.technician_id=u.id AND so.scheduled_date >= current_date-1) AS ultimo_deslocamento
FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'
ORDER BY u.is_available DESC, u.updated_at DESC""", limit=50)

print("\n## hora do dia em que o cadastro dos tecnicos foi alterado (ultima alteracao), ligados x desligados")
run("""SELECT u.is_available, extract(hour from u.updated_at AT TIME ZONE 'America/Sao_Paulo') AS hora, count(*)
FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'
GROUP BY 1,2 ORDER BY 1 DESC,2""", limit=40)

print("\n## agora (hora do banco em SP)")
run("SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS agora")

print("\n## tecnico-dias alem do limite legal de 2 h extras (ultimo servico terminou depois das 19h em dia util, depois das 14h no sabado), desde 21/09")
run("""WITH td AS (
  SELECT so.technician_id, so.scheduled_date AS dia, extract(dow from so.scheduled_date) AS dow,
         max(so.finished_at AT TIME ZONE 'America/Sao_Paulo')::time AS fim,
         min(so.started_motion_at AT TIME ZONE 'America/Sao_Paulo')::time AS inicio,
         count(*) AS os
  FROM public.service_orders so
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL AND so.finished_at IS NOT NULL
  GROUP BY 1,2,3)
SELECT CASE WHEN dow BETWEEN 1 AND 5 THEN 'dia util' WHEN dow=6 THEN 'sabado' ELSE 'domingo' END AS tipo_de_dia,
       count(*) AS tec_dias,
       count(*) FILTER (WHERE (dow BETWEEN 1 AND 5 AND fim > '17:00') OR (dow=6 AND fim > '12:00') OR dow=0) AS alem_da_escala,
       count(*) FILTER (WHERE (dow BETWEEN 1 AND 5 AND fim > '19:00') OR (dow=6 AND fim > '14:00')) AS alem_das_2h,
       round(100.0*count(*) FILTER (WHERE (dow BETWEEN 1 AND 5 AND fim > '19:00') OR (dow=6 AND fim > '14:00'))/count(*),1) AS pct_alem_das_2h,
       count(*) FILTER (WHERE (dow BETWEEN 1 AND 5 AND fim > '21:00') OR (dow=6 AND fim > '16:00')) AS alem_das_4h
FROM td GROUP BY 1 ORDER BY 1""")

print("\n## por dia: tecnicos em campo e quantos passaram das 19h (dias uteis desde 21/09)")
run("""WITH td AS (
  SELECT so.technician_id, so.scheduled_date AS dia,
         max(so.finished_at AT TIME ZONE 'America/Sao_Paulo')::time AS fim
  FROM public.service_orders so
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
    AND so.status IN ('completed','unproductive') AND so.technician_id IS NOT NULL AND so.finished_at IS NOT NULL
    AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5
  GROUP BY 1,2)
SELECT dia, to_char(dia,'Dy') AS dsem, count(*) AS tecnicos,
       count(*) FILTER (WHERE fim > '17:00') AS depois_17h,
       count(*) FILTER (WHERE fim > '19:00') AS depois_19h,
       count(*) FILTER (WHERE fim > '21:00') AS depois_21h
FROM td GROUP BY 1 ORDER BY 1""", limit=40)

print("\n## PRODUCAO: todas as tabelas")
run("""SELECT table_schema||'.'||table_name AS tabela FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE' ORDER BY 1""", limit=200)

print("\n## HOMOLOGACAO: todas as tabelas")
run_dev("""SELECT table_schema||'.'||table_name AS tabela FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE' ORDER BY 1""", limit=200)

print("\n## HOMOLOGACAO: motivos de reagendamento cadastrados (tabela reasons)")
run_dev("""SELECT type, label FROM public.reasons WHERE deleted_at IS NULL ORDER BY type, label""", limit=60)

print("\n## HOMOLOGACAO: colunas novas em service_orders e auth.users que nao existem em producao")
run_dev("""SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns
       WHERE (table_schema='public' AND table_name='service_orders') OR (table_schema='auth' AND table_name='users')
       ORDER BY table_name, ordinal_position""", limit=200)
