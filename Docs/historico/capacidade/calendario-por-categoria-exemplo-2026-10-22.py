# -*- coding: utf-8 -*-
"""
Exemplo de 22/10/2026 (leitura, SGI de produção pelo .env do serviço): como
ficaria o calendário da Agenda filtrado por UMA categoria, turno a turno, de
hoje a +13 dias, pela régua da grade de datas do SGI (a mesma de
build_availability), ao lado da resposta geral do calendário de hoje.

Rodar com o venv do serviço, a partir da pasta do serviço:
  .venv/Scripts/python.exe "<este arquivo>"
"""

import math
import os
import sys
from collections import defaultdict
from datetime import timedelta

SERVICO = r"C:\Users\Impacto Telecom\Documents\impacto-bi-service"
sys.path.insert(0, SERVICO)
os.chdir(SERVICO)

from app.db.sgi import sgi_connection  # noqa: E402
from app.dependencies.utils import now_local, today_local  # noqa: E402
from app.services.bi.os_schedule import (  # noqa: E402
    _day_load,
    active_on,
    build_params,
    category_period,
    category_scope,
    closures_for,
    day_kind,
    period_cutoff,
    query_batch,
    weekend_closed,
)

CATEGORIAS = ("Instalação de 2 Câmeras", "Sem Conexão", "Fibra Instalação")
DIAS = 14
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calendario-por-categoria-exemplo-2026-10-22.txt")
SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def horas(h):
    m = round(h * 60)
    return f"{m // 60}h{m % 60:02d}" if m % 60 else f"{m // 60}h"


def main():
    hoje = today_local()
    agora = now_local()
    with sgi_connection() as conn:
        lote = query_batch(conn, hoje, hoje + timedelta(days=DIAS))
    params = build_params(lote.config, lote.periods)
    por_tecnico = params.hours_per_technician_period
    cats = {c.id: c for c in lote.categories}
    por_nome = {c.name: c for c in lote.categories if not c.deleted}
    por_dia = defaultdict(list)
    for o in lote.orders:
        por_dia[o.scheduled_date].append(o)

    linhas = [f"Leitura {agora:%d/%m %H:%M}, SGI de produção. Geral = horas livres do turno no calendário de hoje."]
    for nome in CATEGORIAS:
        c = por_nome[nome]
        linhas += ["", f"== {nome} (SLA {horas(c.sla_hours or 0)} por OS) =="]
        linhas.append(f"{'dia':10} {'turno':6} {'categoria (grade do SGI)':26} {'aptos':>5} {'consumo/capac.':>16}   geral")
        for n in range(DIAS):
            d = hoje + timedelta(days=n)
            tipo = day_kind(d, hoje)
            fechado_dia, equipes = closures_for(d, lote.closures)
            ativos = [t for t in active_on(d, lote) if not (set(t.team_ids) & equipes)]
            carga = _day_load(por_dia.get(d, []), tipo, cats, params.period_keys)
            for i, regra in enumerate(params.periods):
                rotulo = f"{SEMANA[d.weekday()]} {d.day:02d}/{d.month:02d}" if i == 0 else ""
                geral_cap = len(ativos) * por_tecnico
                geral_livre = geral_cap - carga.consumed_by_period.get(regra.key, 0.0)
                geral = f"{horas(max(geral_livre, 0))} livres"
                if fechado_dia or period_cutoff(tipo, regra, agora.hour) or weekend_closed(d, i, params):
                    resposta, conta = "Fechado", ""
                else:
                    escopo = category_scope(c, ativos, por_tecnico)
                    linha = category_period(escopo, carga, regra)
                    conta = f"{horas(linha.consumed_hours)}/{horas(linha.capacity_hours)}"
                    if linha.full:
                        resposta = "Cheio"
                    elif c.sla_hours:
                        resposta = f"Cabe mais {math.floor((linha.capacity_hours - linha.consumed_hours + 1e-9) / c.sla_hours)}"
                    else:
                        resposta = "Sem estimativa"
                    escopo_aptos = escopo.apt_technicians
                    conta = f"{escopo_aptos:>5} {conta:>16}"
                linhas.append(f"{rotulo:10} {regra.label:6} {resposta:26} {conta:>22}   {geral}")
    texto = "\n".join(linhas)
    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write(texto + "\n")
    print(texto)


if __name__ == "__main__":
    main()
