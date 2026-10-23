# -*- coding: utf-8 -*-
"""
Medição de 22/10/2026 (leitura, SGI de produção pelo .env do serviço):
qual seria a "próxima agenda disponível" de cada categoria e de cada tipo
de OS, pela mesma régua do SGI que o serviço já espelha em os_schedule.py.

Reusa as funções puras do serviço (query_batch, build_params, active_on,
closures_for, consumes) e repete, para TODAS as categorias (o serviço só
calcula as que têm OS no dia), a conta da grade de datas do SGI:
capacidade dos aptos x 3h12, consumo compartilhado, cheio quando
consumo + SLA não cabe. Nada é gravado no banco: a sessão é somente leitura.

Rodar com o venv do serviço, a partir da pasta do serviço (o .env mora lá):
  cd impacto-bi-service
  .venv/Scripts/python.exe "<caminho deste arquivo>"
"""

import math
import os
import sys
from collections import defaultdict
from datetime import timedelta

SERVICO = r"C:\Users\Impacto Telecom\Documents\impacto-bi-service"
sys.path.insert(0, SERVICO)
os.chdir(SERVICO)

from sqlalchemy import text  # noqa: E402

from app.db.sgi import sgi_connection  # noqa: E402
from app.dependencies.utils import now_local, today_local  # noqa: E402
from app.services.bi import os_catalog as catalog  # noqa: E402
from app.services.bi.os_schedule import (  # noqa: E402
    ALWAYS_AVAILABLE_TYPES,
    ACTIVE_STATUSES,
    active_on,
    build_params,
    closures_for,
    consumes,
    day_kind,
    query_batch,
)

HORIZONTE = 28
SAIDA = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "proxima-agenda-por-categoria-2026-10-22.txt"
)

_CATEGORIAS_SQL = """
SELECT id::text AS id, name, type AS type_key, sla AS sla_hours,
       (deleted_at IS NOT NULL) AS deleted
FROM public.service_order_categories
"""

_RECENTES_SQL = """
SELECT so.category_id::text AS cid, count(*) AS n
FROM public.service_orders so
WHERE so.deleted_at IS NULL
  AND so.scheduled_date BETWEEN :a AND :b
GROUP BY 1
"""

DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def rotulo_dia(d):
    return f"{DIAS[d.weekday()]} {d.day:02d}/{d.month:02d}"


def main():
    hoje = today_local()
    agora = now_local()
    with sgi_connection() as conn:
        lote = query_batch(conn, hoje, hoje + timedelta(days=HORIZONTE))
        categorias = conn.execute(text(_CATEGORIAS_SQL)).mappings().all()
        recentes = {
            r["cid"]: int(r["n"])
            for r in conn.execute(
                text(_RECENTES_SQL), {"a": hoje - timedelta(days=28), "b": hoje - timedelta(days=1)}
            ).mappings()
        }
    params = build_params(lote.config, lote.periods)
    por_tecnico = params.hours_per_technician_period
    cats = {c["id"]: c for c in categorias}
    por_dia = defaultdict(list)
    for o in lote.orders:
        por_dia[o.scheduled_date].append(o)

    vivas = [c for c in categorias if not c["deleted"]]
    # OS marcadas (status ativo) nos próximos 14 dias, por categoria.
    a_frente = defaultdict(int)
    for o in lote.orders:
        if hoje <= o.scheduled_date <= hoje + timedelta(days=13) and o.status_key in ACTIVE_STATUSES:
            a_frente[o.category_id] += 1

    # resultado[cid] = dict(primeira=(dia, turno, cabe), primeira_sem_domingo=..., cheios_antes=n, aptos=n)
    resultado = {}
    for c in vivas:
        resultado[c["id"]] = {
            "primeira": None,
            "primeira_util": None,
            "cheios_antes": 0,
            "fechados_antes": 0,
            "aptos_hoje": 0,
        }

    linhas_saida = []
    out = linhas_saida.append
    out(f"Medição em {agora:%d/%m/%Y %H:%M} (hora de São Paulo), SGI de produção, somente leitura")
    out(f"Horas por técnico por turno: {por_tecnico:.2f} ({params.period_duration_hours} h x {params.efficiency})")
    out(f"Fim de semana liberado no SGI: {params.weekend_enabled}")
    out(f"Turnos: " + ", ".join(f"{r.label} (início {r.start_hour}h, limite {r.limit_hour}h)" for r in params.periods))
    out(f"Técnicos ativos no cadastro: {len(lote.technicians)}; categorias não apagadas: {len(vivas)} de {len(categorias)}")
    out("")

    for n in range(HORIZONTE):
        d = hoje + timedelta(days=n)
        tipo = day_kind(d, hoje)
        fechado, equipes_fechadas = closures_for(d, lote.closures)
        ativos = [t for t in active_on(d, lote) if not (set(t.team_ids) & equipes_fechadas)]
        ordens = por_dia.get(d, [])
        for regra in params.periods:
            corte = tipo == "today" and regra.limit_hour is not None and agora.hour >= regra.limit_hour
            horas_por_cat = defaultdict(float)
            for o in ordens:
                if o.period_key != regra.key or not consumes(o.status_key, tipo):
                    continue
                cat = cats.get(o.category_id or "")
                horas = float(cat["sla_hours"]) if cat is not None and cat["sla_hours"] is not None else 0.0
                horas_por_cat[o.category_id] += horas
            for c in vivas:
                r = resultado[c["id"]]
                if r["primeira"] is not None and r["primeira_util"] is not None:
                    continue
                aptos = [t for t in ativos if c["id"] in t.category_ids]
                if n == 0 and regra is params.periods[0]:
                    r["aptos_hoje"] = len(aptos)
                compartilhadas = {c["id"]}
                for t in aptos:
                    compartilhadas.update(t.category_ids)
                cap = len(aptos) * por_tecnico
                consumo = sum(horas_por_cat.get(x, 0.0) for x in compartilhadas)
                sla = float(c["sla_hours"] or 0.0)
                sempre = (c["type_key"] or "") in ALWAYS_AVAILABLE_TYPES
                cheio = (not sempre) and (cap <= 0 or consumo + sla > cap + 1e-9)
                if fechado or corte:
                    if r["primeira"] is None:
                        r["fechados_antes"] += 1
                    continue
                if cheio:
                    if r["primeira"] is None:
                        r["cheios_antes"] += 1
                    continue
                cabe = None
                if sla > 0 and cap > 0:
                    cabe = max(0, math.floor((cap - consumo + 1e-9) / sla))
                achado = (d, regra.label, cabe, len(aptos), consumo, cap)
                if r["primeira"] is None:
                    r["primeira"] = achado
                if r["primeira_util"] is None and d.weekday() != 6:
                    r["primeira_util"] = achado

    # Agrupa por tipo, na ordem do catálogo do portal.
    por_tipo = defaultdict(list)
    for c in vivas:
        rotulo, _ = catalog.normalize_service_type(c["type_key"])
        por_tipo[rotulo].append(c)
    ordem = {label: i for i, label in enumerate(catalog.OS_SERVICE_TYPES)}

    def fmt(achado):
        if achado is None:
            return "nunca nos 28 dias"
        d, turno, cabe, aptos, consumo, cap = achado
        quando = "HOJE" if d == hoje else ("amanhã" if d == hoje + timedelta(days=1) else rotulo_dia(d))
        extra = "" if cabe is None else f", cabe mais {cabe}"
        return f"{quando} · {turno}{extra}"

    out("=" * 100)
    out("POR CATEGORIA (ordem: tipo, depois a próxima agenda mais distante primeiro)")
    out("=" * 100)
    for tipo in sorted(por_tipo, key=lambda t: (ordem.get(t, 99), t)):
        lista = por_tipo[tipo]
        out("")
        out(f"## {tipo}: {len(lista)} categorias")
        out(f"{'categoria':44} {'SLA':>6} {'aptos':>5} {'OS 28d':>6} {'OS 14d+':>7}  {'próxima (grade do SGI)':34} {'cheios antes':>12}")

        def chave(c):
            r = resultado[c["id"]]
            p = r["primeira"]
            return (0 if p is None else 1, -(p[0].toordinal() if p else 0), -(recentes.get(c["id"], 0)))

        for c in sorted(lista, key=chave):
            r = resultado[c["id"]]
            sla = "-" if c["sla_hours"] is None else f"{float(c['sla_hours']):.2f}"
            out(
                f"{c['name'][:44]:44} {sla:>6} {r['aptos_hoje']:>5} {recentes.get(c['id'], 0):>6} {a_frente.get(c['id'], 0):>7}  "
                f"{fmt(r['primeira']):34} {r['cheios_antes']:>12}"
            )
            if r["primeira"] is not None and r["primeira_util"] is not None and r["primeira"] != r["primeira_util"]:
                out(f"{'':44} {'':6} {'':5} {'':6} {'':7}  (sem domingo: {fmt(r['primeira_util'])})")

    out("")
    out("=" * 100)
    out("POR TIPO: o que uma linha por tipo teria de dizer")
    out("=" * 100)
    out(f"{'tipo':24} {'cats':>4} {'c/ OS 28d':>9} {'0 aptos':>7}  {'mais cedo (alguma categoria cabe)':40} {'mais tarde (todas cabem)':34}")
    for tipo in sorted(por_tipo, key=lambda t: (ordem.get(t, 99), t)):
        lista = por_tipo[tipo]
        ativas = [c for c in lista if recentes.get(c["id"], 0) > 0 or a_frente.get(c["id"], 0) > 0]
        base = ativas if ativas else lista
        zero = [c for c in base if resultado[c["id"]]["aptos_hoje"] == 0 and (c["type_key"] or "") not in ALWAYS_AVAILABLE_TYPES]
        achados = [resultado[c["id"]]["primeira"] for c in base]
        com_data = [a for a in achados if a is not None]
        cedo = min(com_data, key=lambda a: (a[0], a[1])) if com_data else None
        tarde = max(com_data, key=lambda a: (a[0], a[1])) if com_data else None
        nunca = len(achados) - len(com_data)
        tarde_txt = fmt(tarde) + (f" (+{nunca} nunca)" if nunca else "")
        out(f"{tipo:24} {len(lista):>4} {len(ativas):>9} {len(zero):>7}  {fmt(cedo):40} {tarde_txt:34}")
    out("")
    out("Leitura: 'cats' = categorias não apagadas do tipo; 'c/ OS 28d' = com OS nos últimos 28 dias ou marcadas nos próximos 14;")
    out("'0 aptos' = dessas, quantas não têm nenhum técnico apto hoje (a grade do SGI nunca as oferece).")
    out("'mais cedo' e 'mais tarde' olham só as categorias com OS (ou todas, quando o tipo não tem nenhuma com OS).")

    texto = "\n".join(linhas_saida)
    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write(texto + "\n")
    print(texto)


if __name__ == "__main__":
    main()
