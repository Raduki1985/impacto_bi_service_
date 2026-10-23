import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## tabelas com territor/setting/config/param")
run("""SELECT table_schema, table_name FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_name ~* 'territor|setting|config|param|limit|quota'
       ORDER BY 1,2""")

print("\n## colunas de territories (se existir)")
run("""SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name ~* 'territor' ORDER BY table_name, ordinal_position""", limit=60)

print("\n## territorios: nome e quantos tecnicos")
run("""SELECT t.*, (SELECT count(*) FROM public.technician_territories tt WHERE tt.territory_id=t.id AND tt.deleted_at IS NULL) AS tecnicos
       FROM public.territories t ORDER BY 1 LIMIT 40""", limit=40)

print("\n## usuarios: role, role_type, status, is_available")
run("""SELECT u.role, u.role_type, u.status, u.is_available, count(*) AS n,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.service_orders so WHERE so.technician_id=u.id AND so.scheduled_date >= current_date-28)) AS com_os_28d
       FROM auth.users u WHERE u.deleted_at IS NULL GROUP BY 1,2,3,4 ORDER BY n DESC""", limit=40)

print("\n## tecnicos com OS nos ultimos 28 dias, por equipe e disponibilidade")
run("""SELECT u.name, u.is_available, u.status, u.role_type,
       (SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM public.team_users tu JOIN public.teams t ON t.id=tu.team_id AND t.deleted_at IS NULL WHERE tu.user_id=u.id) AS equipes,
       (SELECT count(*) FROM public.technician_capacities tc WHERE tc.technician_id=u.id AND tc.deleted_at IS NULL) AS categorias_aptas,
       (SELECT count(*) FROM public.technician_territories tt WHERE tt.technician_id=u.id AND tt.deleted_at IS NULL) AS territorios,
       count(DISTINCT so.scheduled_date) AS dias, count(*) AS os
       FROM auth.users u JOIN public.service_orders so ON so.technician_id=u.id AND so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-28 AND current_date-1
       GROUP BY 1,2,3,4 ORDER BY os DESC""", limit=60)

print("\n## holiday_date: team_ids e nomes")
run("""SELECT hd.name, hd.day, hd.month, hd.start_time, hd.end_time, hd.deleted_at IS NOT NULL AS apagada, h.deleted_at IS NOT NULL AS pai_apagado,
       (SELECT string_agg(t.name, ', ') FROM public.teams t WHERE t.id = ANY(hd.team_ids)) AS equipes
       FROM public.holiday_date hd JOIN public.holiday h ON h.id=hd.holiday_id ORDER BY hd.month::int, hd.day::int""", limit=40)

print("\n## OS por territorio? bairro no endereco (14 dias futuros)")
run("""SELECT so.address->>'neighborhood' AS bairro, count(*) FROM public.service_orders so
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date AND current_date+14
       GROUP BY 1 ORDER BY 2 DESC""", limit=25)

print("\n## chaves do json address")
run("""SELECT k, count(*) FROM public.service_orders so, json_object_keys(so.address) k
       WHERE so.deleted_at IS NULL AND so.scheduled_date >= current_date-7 GROUP BY 1 ORDER BY 2 DESC""", limit=30)
