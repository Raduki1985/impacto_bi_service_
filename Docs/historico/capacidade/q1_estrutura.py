import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## tabelas com nome de agenda/escala/rota")
run("""
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND (table_name ~* 'sched|shift|roster|avail|calend|holiday|rout|zone|region|work|vacat|absen|slot|agenda|escal|capac|turn|team|technic')
ORDER BY 1,2
""")

print("\n## colunas de service_orders")
run("""
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='service_orders' ORDER BY ordinal_position
""", limit=120)

print("\n## colunas de teams / team_users")
run("""
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('teams','team_users') ORDER BY table_name, ordinal_position
""", limit=60)

print("\n## colunas de auth.users")
run("""
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position
""", limit=80)

print("\n## categorias: nome, tipo, sla (horas)")
run("""
SELECT soc.id, soc.name, soc.type, soc.sla, soc.deleted_at IS NOT NULL AS apagada,
       (SELECT count(*) FROM public.service_orders so WHERE so.category_id=soc.id AND so.deleted_at IS NULL AND so.scheduled_date >= current_date - 56) AS os_8sem
FROM public.service_order_categories soc ORDER BY os_8sem DESC
""", limit=80)

print("\n## equipes e quantos usuarios")
run("""
SELECT t.name, t.deleted_at IS NOT NULL AS apagada, count(tu.user_id) AS usuarios
FROM public.teams t LEFT JOIN public.team_users tu ON tu.team_id=t.id
GROUP BY 1,2 ORDER BY 3 DESC
""")

print("\n## valores de period e status nas OS de 2026")
run("""
SELECT period, status, count(*) FROM public.service_orders
WHERE deleted_at IS NULL AND scheduled_date >= '2026-06-01'
GROUP BY 1,2 ORDER BY 1,3 DESC
""", limit=60)
