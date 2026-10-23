import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## tecnicos com OS nos ultimos 28 dias, por equipe, disponibilidade, aptidoes e territorios")
run("""SELECT u.name, u.is_available, u.status, u.role_type,
       (SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM public.team_users tu JOIN public.teams t ON t.id=tu.team_id AND t.deleted_at IS NULL WHERE tu.user_id=u.id) AS equipes,
       (SELECT count(*) FROM public.technician_capacities tc WHERE tc.technician_id=u.id AND tc.deleted_at IS NULL) AS categorias_aptas,
       (SELECT string_agg(te.name, ', ' ORDER BY tt.priority) FROM public.technician_territories tt JOIN public.territories te ON te.id=tt.territory_id WHERE tt.technician_id=u.id AND tt.deleted_at IS NULL) AS territorios,
       count(DISTINCT so.scheduled_date) AS dias, count(*) AS os
       FROM auth.users u JOIN public.service_orders so ON so.technician_id=u.id AND so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date-28 AND current_date-1
       GROUP BY u.id, 1,2,3,4 ORDER BY os DESC""", limit=60)

print("\n## holiday_date: datas, horario e equipes")
run("""SELECT hd.name, hd.day, hd.month, hd.start_time, hd.end_time, hd.deleted_at IS NOT NULL AS apagada, h.deleted_at IS NOT NULL AS pai_apagado,
       (SELECT string_agg(t.name, ', ') FROM public.teams t WHERE t.id = ANY(hd.team_ids)) AS equipes
       FROM public.holiday_date hd JOIN public.holiday h ON h.id=hd.holiday_id ORDER BY hd.month::int, hd.day::int""", limit=40)

print("\n## chaves do json address (OS dos ultimos 7 dias)")
run("""SELECT k, count(*) FROM public.service_orders so, json_object_keys(so.address) k
       WHERE so.deleted_at IS NULL AND so.scheduled_date >= current_date-7 GROUP BY 1 ORDER BY 2 DESC""", limit=30)

print("\n## OS por bairro (14 dias futuros)")
run("""SELECT so.address->>'neighborhood' AS bairro, count(*) FROM public.service_orders so
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date AND current_date+14
       GROUP BY 1 ORDER BY 2 DESC""", limit=25)

print("\n## OS com lat/lng preenchidos (28 dias)")
run("""SELECT count(*) AS os, count(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL) AS com_coord
       FROM public.service_orders WHERE deleted_at IS NULL AND scheduled_date BETWEEN current_date-28 AND current_date+14""")

print("\n## OS futuras caem em qual territorio (pelo lat/lng dentro do poligono)")
run("""SELECT te.name AS territorio, count(*) AS os
       FROM public.service_orders so
       LEFT JOIN public.territories te ON te.deleted_at IS NULL AND te.status='active' AND so.lat IS NOT NULL AND point(so.lat, so.lng) <@ te.area
       WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN current_date AND current_date+14
       GROUP BY 1 ORDER BY 2 DESC""", limit=30)
