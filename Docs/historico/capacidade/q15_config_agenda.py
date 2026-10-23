import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

print("## config: parametros de agenda e distribuicao (valores nao sao segredo)")
run("""SELECT key, value, (updated_at AT TIME ZONE 'America/Sao_Paulo')::date AS alterado_em
       FROM public.config
       WHERE key IN ('morning-period-start-time','morning-period-scheduling-limit-time',
                     'afternoon-period-start-time','afternoon-period-scheduling-limit-time',
                     'service-order-auto-distribution-enabled','recording-limit-time','can-upload-service-order-photo')
       ORDER BY key""")

print("\n## designacao de tecnico: automatica (sem autor) ou manual, OS desde 21/09")
run("""SELECT CASE WHEN so.attributed_by IS NULL THEN 'automatica (sem autor)' ELSE 'manual (com autor)' END AS designacao,
       count(*) AS os, count(*) FILTER (WHERE so.attributed_at IS NOT NULL) AS com_data,
       round(100.0*count(*) FILTER (WHERE so.attributed_at::date = so.scheduled_date)/NULLIF(count(*) FILTER (WHERE so.attributed_at IS NOT NULL),0),0) AS pct_no_proprio_dia
FROM public.service_orders so
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1 AND so.technician_id IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC""")

print("\n## hora em que o tecnico e designado (attributed_at), OS desde 21/09")
run("""SELECT extract(hour from so.attributed_at AT TIME ZONE 'America/Sao_Paulo') AS hora, count(*)
FROM public.service_orders so
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1 AND so.attributed_at IS NOT NULL
GROUP BY 1 ORDER BY 1""", limit=30)

print("\n## OS por dia e turno: maior volume ja marcado num unico turno (dias uteis desde 21/09), para ver se existe teto")
run("""SELECT so.period, max(n) AS maximo, round(avg(n),0) AS media
FROM (SELECT so.scheduled_date, so.period, count(*) AS n FROM public.service_orders so
      WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-21' AND current_date-1
        AND extract(dow from so.scheduled_date) BETWEEN 1 AND 5 AND so.period IS NOT NULL
      GROUP BY 1,2) so
GROUP BY 1 ORDER BY 1""")
