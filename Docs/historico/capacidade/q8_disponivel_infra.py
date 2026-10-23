import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## tecnicos: disponivel, quando o cadastro mudou pela ultima vez, ultima OS executada")
run("""SELECT u.name, u.is_available, (u.updated_at AT TIME ZONE 'America/Sao_Paulo')::date AS cadastro_alterado_em,
       (SELECT max(so.scheduled_date) FROM public.service_orders so WHERE so.technician_id=u.id AND so.status IN ('completed','unproductive')) AS ultima_os,
       (SELECT count(DISTINCT so.scheduled_date) FROM public.service_orders so WHERE so.technician_id=u.id AND so.scheduled_date BETWEEN current_date-14 AND current_date-1 AND so.status IN ('completed','unproductive')) AS dias_14d
FROM auth.users u WHERE u.deleted_at IS NULL AND u.role='technician' AND u.status='active'
ORDER BY u.is_available, u.updated_at DESC""", limit=50)

print("\n## OS de infra: quem executa (desde 21/09)")
run("""SELECT COALESCE((SELECT min(t.name) FROM public.team_users tu JOIN public.teams t ON t.id=tu.team_id AND t.deleted_at IS NULL WHERE tu.user_id=so.technician_id),'Sem equipe') AS equipe_do_tecnico,
       count(*) AS os_infra, round(sum(soc.sla)::numeric,0) AS horas_sla
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1 AND soc.type IN ('infra','audit')
  AND so.status IN ('completed','unproductive')
GROUP BY 1 ORDER BY 2 DESC""")

print("\n## horas alem da escala ja realizadas (dias uteis desde 21/09): servico que terminou depois das 17h, sabado a tarde, domingo")
run("""SELECT CASE WHEN extract(dow from so.scheduled_date)=0 THEN 'domingo'
            WHEN extract(dow from so.scheduled_date)=6 AND (so.finished_at AT TIME ZONE 'America/Sao_Paulo')::time > '12:00' THEN 'sabado depois das 12h'
            WHEN extract(dow from so.scheduled_date) BETWEEN 1 AND 5 AND (so.finished_at AT TIME ZONE 'America/Sao_Paulo')::time > '17:00' THEN 'dia util depois das 17h'
            ELSE 'dentro da escala' END AS faixa,
       count(*) AS os,
       round(100.0*count(*)/sum(count(*)) OVER (),1) AS pct
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
  AND so.status IN ('completed','unproductive') AND so.finished_at IS NOT NULL AND soc.type NOT IN ('infra','audit')
GROUP BY 1 ORDER BY 2 DESC""")

print("\n## OS criadas no proprio dia, por dia da semana (desde 21/09, OS de cliente): a reserva do dia")
run("""SELECT to_char(so.scheduled_date,'Dy') AS dsem, count(*) AS os,
       round(100.0*count(*) FILTER (WHERE (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date = so.scheduled_date)/count(*),0) AS pct_criadas_no_dia,
       round(sum(soc.sla) FILTER (WHERE (so.created_at AT TIME ZONE 'America/Sao_Paulo')::date = so.scheduled_date)::numeric/count(DISTINCT so.scheduled_date),0) AS horas_no_dia_por_dia
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1 AND soc.type NOT IN ('infra','audit')
GROUP BY 1, extract(dow from so.scheduled_date) ORDER BY extract(dow from so.scheduled_date)""")
