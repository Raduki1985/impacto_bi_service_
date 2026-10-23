import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

print("## colunas de config, audit_logs, enum_types, user_sessions")
run("""SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE (table_schema='public' AND table_name IN ('config','audit_logs','enum_types')) OR (table_schema='auth' AND table_name='user_sessions')
       ORDER BY table_name, ordinal_position""", limit=80)

print("\n## config: conteudo inteiro (valores longos cortados em 200 caracteres)")
run("""SELECT * FROM public.config LIMIT 60""", limit=60)

print("\n## enum_types: conteudo")
run("""SELECT * FROM public.enum_types ORDER BY 1 LIMIT 120""", limit=120)

print("\n## audit_logs: volume e tipos")
run("""SELECT count(*) AS n, min(created_at) AS primeiro, max(created_at) AS ultimo FROM public.audit_logs""")
