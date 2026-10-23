import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

for t in ('technician_capacities','technician_territories','regions','plan_regions','holiday','holiday_date'):
    print(f"\n## colunas de {t}")
    run(f"""SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema='public' AND table_name='{t}' ORDER BY ordinal_position""", limit=60)
    print(f"## linhas de {t}")
    run(f"SELECT count(*) AS n, count(*) FILTER (WHERE deleted_at IS NULL) AS vivas FROM public.{t}" if t not in ('holiday_date','plan_regions') else f"SELECT count(*) AS n FROM public.{t}")

print("\n## technician_capacities: conteudo (ate 60)")
run("""SELECT tc.*, u.name AS tecnico FROM public.technician_capacities tc
       LEFT JOIN auth.users u ON u.id = tc.technician_id ORDER BY u.name LIMIT 60""", limit=60)

print("\n## technician_territories: conteudo (ate 60)")
run("""SELECT tt.*, u.name AS tecnico FROM public.technician_territories tt
       LEFT JOIN auth.users u ON u.id = tt.technician_id ORDER BY u.name LIMIT 60""", limit=60)

print("\n## regions")
run("SELECT * FROM public.regions ORDER BY 1 LIMIT 40", limit=40)

print("\n## holiday + holiday_date (2026)")
run("""SELECT h.*, hd.* FROM public.holiday h LEFT JOIN public.holiday_date hd ON hd.holiday_id = h.id
       ORDER BY 1 LIMIT 40""", limit=40)

print("\n## usuarios tecnicos: role, role_type, status, is_available")
run("""SELECT u.role, u.role_type, u.status, u.is_available, count(*) AS n,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.service_orders so WHERE so.technician_id=u.id AND so.scheduled_date >= current_date-28)) AS com_os_28d
       FROM auth.users u WHERE u.deleted_at IS NULL GROUP BY 1,2,3,4 ORDER BY n DESC""", limit=40)

print("\n## tecnicos com OS nos ultimos 28 dias, por equipe, disponibilidade")
run("""SELECT u.name, u.is_available, u.status, u.role_type,
       (SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM public.team_users tu JOIN public.teams t ON t.id=tu.team_id AND t.deleted_at IS NULL WHERE tu.user_id=u.id) AS equipes,
       count(DISTINCT so.scheduled_date) AS dias, count(*) AS os
       FROM auth.users u JOIN public.service_orders so ON so.technician_id=u.id AND so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-28 AND current_date-1
       GROUP BY 1,2,3,4 ORDER BY os DESC""", limit=60)
