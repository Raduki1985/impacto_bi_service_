import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

print("## audit_logs: 5 registros mais recentes, para ver o formato")
run("""SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 5""", limit=5)

print("\n## audit_logs: registros que mencionam is_available (quantos, primeiro, ultimo)")
run("""SELECT count(*) AS n, min(created_at) AS primeiro, max(created_at) AS ultimo
       FROM public.audit_logs a WHERE a::text ILIKE '%is_available%'""")

print("\n## audit_logs: os 25 mais recentes que mencionam is_available")
run("""SELECT a.* FROM public.audit_logs a WHERE a::text ILIKE '%is_available%' ORDER BY created_at DESC LIMIT 25""", limit=25)

print("\n## audit_logs: por hora do dia, mudancas que mencionam is_available (ultimos 30 dias)")
run("""SELECT extract(hour from a.created_at AT TIME ZONE 'America/Sao_Paulo') AS hora, count(*)
       FROM public.audit_logs a WHERE a::text ILIKE '%is_available%' AND a.created_at >= now() - interval '30 days'
       GROUP BY 1 ORDER BY 1""", limit=30)
