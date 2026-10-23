import sys
sys.path.insert(0, r"C:\Users\Impacto Telecom\Documents\Impacto Telecom - Business Intelligence\impacto-bi-web\Docs\historico\sla-reagendamento")
import sgi_ro
run = sgi_ro.run

# Só colunas seguras: nunca o json inteiro (ele carrega hash de senha e documento).
print("## mudancas REAIS do campo is_available (antes diferente de depois), ultimos 30 dias: volume")
run("""SELECT count(*) AS mudancas, count(DISTINCT object_id) AS tecnicos,
       count(*) FILTER (WHERE user_id = object_id) AS pelo_proprio_usuario,
       count(*) FILTER (WHERE user_id <> object_id) AS por_outra_pessoa,
       count(*) FILTER (WHERE user_id IS NULL) AS sem_autor
FROM public.audit_logs a
WHERE a.entity='auth.users' AND a.created_at >= now() - interval '30 days'
  AND (a.before->>'is_available') IS DISTINCT FROM (a.after->>'is_available')""")

print("\n## quem faz a mudanca (cargo de quem alterou) e para qual valor")
run("""SELECT u.role AS cargo_de_quem_alterou, (a.user_id = a.object_id) AS o_proprio, a.after->>'is_available' AS virou, count(*)
FROM public.audit_logs a LEFT JOIN auth.users u ON u.id = a.user_id
WHERE a.entity='auth.users' AND a.created_at >= now() - interval '30 days'
  AND (a.before->>'is_available') IS DISTINCT FROM (a.after->>'is_available')
GROUP BY 1,2,3 ORDER BY 4 DESC""")

print("\n## hora do dia das mudancas reais, separando ligou e desligou (ultimos 30 dias)")
run("""SELECT extract(hour from a.created_at AT TIME ZONE 'America/Sao_Paulo') AS hora,
       count(*) FILTER (WHERE a.after->>'is_available' = 'true') AS ligou,
       count(*) FILTER (WHERE a.after->>'is_available' = 'false') AS desligou
FROM public.audit_logs a
WHERE a.entity='auth.users' AND a.created_at >= now() - interval '30 days'
  AND (a.before->>'is_available') IS DISTINCT FROM (a.after->>'is_available')
GROUP BY 1 ORDER BY 1""", limit=30)

print("\n## mudancas por tecnico por dia: quantas vezes liga e desliga num dia tipico")
run("""WITH m AS (
  SELECT a.object_id, (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia, count(*) AS n
  FROM public.audit_logs a
  WHERE a.entity='auth.users' AND a.created_at >= now() - interval '30 days'
    AND (a.before->>'is_available') IS DISTINCT FROM (a.after->>'is_available')
  GROUP BY 1,2)
SELECT n AS mudancas_no_dia, count(*) AS tecnico_dias FROM m GROUP BY 1 ORDER BY 1""", limit=20)

print("\n## as 20 ultimas mudancas reais (nome do tecnico, quem alterou, valor novo, quando)")
run("""SELECT to_char(a.created_at AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') AS quando,
       t.name AS tecnico, CASE WHEN a.user_id = a.object_id THEN 'ele mesmo' ELSE COALESCE(u.name,'sem autor') END AS quem_alterou,
       a.after->>'is_available' AS virou
FROM public.audit_logs a LEFT JOIN auth.users t ON t.id = a.object_id LEFT JOIN auth.users u ON u.id = a.user_id
WHERE a.entity='auth.users' AND (a.before->>'is_available') IS DISTINCT FROM (a.after->>'is_available')
ORDER BY a.created_at DESC LIMIT 20""", limit=20)

print("\n## auditoria de OS: o que fica gravado quando uma OS e CRIADA? chaves do json 'after' (uma OS recente)")
run("""SELECT k FROM public.audit_logs a, jsonb_object_keys(a.after) k
       WHERE a.entity='service_orders' AND a.action::text='create' ORDER BY a.created_at DESC, k LIMIT 60""", limit=60)
