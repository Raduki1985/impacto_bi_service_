import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
from sgi_ro import run

print("## quanto da agenda de um dia util ja existia na vespera, por hora (dias uteis desde 21/09, OS de cliente)")
run("""WITH os AS (
  SELECT so.scheduled_date AS dia, so.created_at AT TIME ZONE 'America/Sao_Paulo' AS criada
  FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
  WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN '2026-09-22' AND current_date-1
    AND soc.type NOT IN ('infra','audit') AND extract(dow from so.scheduled_date) BETWEEN 2 AND 5),
tot AS (SELECT dia, count(*) AS total FROM os GROUP BY 1)
SELECT h.hora,
       round(100.0*avg(c.n::numeric/t.total),0) AS pct_medio_da_agenda_final
FROM (VALUES ('vespera 10h', interval '14 hours'), ('vespera 14h', interval '10 hours'), ('vespera 17h', interval '7 hours'), ('vespera 20h', interval '4 hours'), ('mesmo dia 8h', interval '-8 hours')) AS h(hora, antes)
CROSS JOIN tot t
JOIN LATERAL (SELECT count(*) AS n FROM os WHERE os.dia=t.dia AND os.criada <= (t.dia::timestamp - h.antes)) c ON true
GROUP BY h.hora, h.antes ORDER BY h.antes DESC""")

print("\n## OS criadas por dia (demanda), ultimas 4 semanas, por tipo")
run("""SELECT date_trunc('week', so.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS semana,
       count(*) AS criadas,
       count(*) FILTER (WHERE soc.type='maintenance') AS manutencao,
       count(*) FILTER (WHERE soc.type='installation') AS instalacao,
       count(*) FILTER (WHERE soc.type='security_installation') AS cameras,
       count(*) FILTER (WHERE soc.type='address_change') AS mudanca,
       count(*) FILTER (WHERE soc.type IN ('infra','audit')) AS infra
FROM public.service_orders so JOIN public.service_order_categories soc ON soc.id=so.category_id
WHERE so.deleted_at IS NULL AND so.created_at >= '2026-09-14'
GROUP BY 1 ORDER BY 1""")
