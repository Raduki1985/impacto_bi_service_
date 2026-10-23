import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro, sgi_dev_ro

print("## PRODUCAO: colunas com nome de semana, dia, hora, turno, janela, limite, capacidade em qualquer tabela")
sgi_ro.run("""SELECT table_schema||'.'||table_name AS tabela, column_name, data_type FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog','information_schema')
         AND column_name ~* 'week|weekday|dow|shift|turn|window|limit|capac|slot|max_|quota|hours|start_time|end_time'
       ORDER BY 1,2""", limit=80)

print("\n## HOMOLOGACAO: mesma busca")
sgi_dev_ro.run("""SELECT table_schema||'.'||table_name AS tabela, column_name, data_type FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog','information_schema')
         AND column_name ~* 'week|weekday|dow|shift|turn|window|limit|capac|slot|max_|quota|hours|start_time|end_time'
       ORDER BY 1,2""", limit=80)

print("\n## HOMOLOGACAO: janela de horario nas OS (scheduled_window_start/end) ja esta preenchida?")
sgi_dev_ro.run("""SELECT count(*) AS os, count(scheduled_window_start) AS com_janela,
       min(scheduled_window_start) AS menor_inicio, max(scheduled_window_end) AS maior_fim
       FROM public.service_orders WHERE deleted_at IS NULL""")

print("\n## HOMOLOGACAO: janelas distintas usadas")
sgi_dev_ro.run("""SELECT period, scheduled_window_start, scheduled_window_end, count(*)
       FROM public.service_orders WHERE deleted_at IS NULL AND scheduled_window_start IS NOT NULL
       GROUP BY 1,2,3 ORDER BY 1,2""", limit=30)

print("\n## enum weekdays: todas as linhas (producao)")
sgi_ro.run("""SELECT key, value, created_at FROM public.enum_types WHERE type='weekdays' ORDER BY created_at, key""", limit=20)
