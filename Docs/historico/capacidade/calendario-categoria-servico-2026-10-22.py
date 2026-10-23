# -*- coding: utf-8 -*-
"""Confere build_category_calendar do serviço com o SGI de produção (só leitura), 22/10/2026."""
import os
import sys
from datetime import timedelta

SERVICO = r"C:\Users\Impacto Telecom\Documents\impacto-bi-service"
sys.path.insert(0, SERVICO)
os.chdir(SERVICO)

from app.db.sgi import sgi_connection  # noqa: E402
from app.dependencies.utils import today_local  # noqa: E402
from app.services.bi.os_schedule import build_category_calendar, build_params, query_batch  # noqa: E402

hoje = today_local()
inicio, fim = hoje - timedelta(days=hoje.weekday()), hoje + timedelta(days=13)
with sgi_connection() as conn:
    lote = query_batch(conn, inicio, fim)
alvo = next(c for c in lote.categories if c.name == "Instalação de 2 Câmeras" and not c.deleted)
cat, dias = build_category_calendar(lote, build_params(lote.config, lote.periods), alvo.id, inicio, fim, hoje)
print(f"{cat.name}, SLA {cat.sla_hours} h")
for d in dias:
    linha = " | ".join(
        f"{p.period}: {p.consumed_hours:5.1f}/{p.capacity_hours:4.1f} h "
        f"{'' if p.occupation is None else f'{p.occupation*100:3.0f}%'} "
        f"{'CHEIO' if p.full else f'cabe {p.fits}'}"
        for p in d.periods
    )
    print(f"{d.day:%a %d/%m} {d.kind:6} aptos {d.apt_technicians}  {linha}")
