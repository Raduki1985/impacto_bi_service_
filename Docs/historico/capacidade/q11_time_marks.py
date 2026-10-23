import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

print("## colunas de time_marks, time_mark_categories, time_mark_files")
run("""SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name IN ('time_marks','time_mark_categories','time_mark_files')
       ORDER BY table_name, ordinal_position""", limit=60)

print("\n## time_mark_categories: conteudo")
run("""SELECT * FROM public.time_mark_categories ORDER BY 1 LIMIT 40""", limit=40)

print("\n## time_marks: volume, primeiro e ultimo registro, usuarios distintos")
run("""SELECT count(*) AS n, min(created_at) AS primeiro, max(created_at) AS ultimo, count(DISTINCT user_id) AS usuarios
       FROM public.time_marks""")

print("\n## time_marks: amostra dos 30 mais recentes (sem dados pessoais alem do nome)")
run("""SELECT tm.*, u.name AS usuario FROM public.time_marks tm LEFT JOIN auth.users u ON u.id = tm.user_id
       ORDER BY tm.created_at DESC LIMIT 30""", limit=30)
