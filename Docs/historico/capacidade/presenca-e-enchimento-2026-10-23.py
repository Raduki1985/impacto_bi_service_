# -*- coding: utf-8 -*-
"""
Medição de 23/10/2026 (leitura, SGI de produção pelo .env do serviço):

1) PRESENÇA: quanto o número de técnicos que de fato trabalharam varia por
   dia da semana e por turno, e qual o erro de estimar a presença de um dia
   pela mediana dos 4 mesmos dias da semana anteriores (a conta que o
   serviço já faz em `typical_presence`), comparado com o erro da régua do
   SGI (técnicos ativos do cadastro).
2) ENCHIMENTO: quanto da carga final de um dia já existia na véspera e na
   manhã do próprio dia, contando a OS a partir do momento em que ENTROU no
   dia (criação ou último reagendamento, o que for mais tarde), e a reserva
   de horas que chega depois das 17h da véspera.

Presença e carga seguem a regra do calendário para dia passado: OS
concluída, improdutiva ou em campo (`consumes`), horas = SLA da categoria.
Reusa a conexão somente leitura do serviço e o de-para de status de
`os_live.STATUS_KIND`. Nada é gravado no banco.

Rodar com o venv do serviço:
  .venv/Scripts/python.exe "<caminho absoluto deste arquivo>"
"""

import os
import statistics
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

SERVICO = r"C:\Users\Impacto Telecom\Documents\impacto-bi-service"
ARQUIVO = os.path.abspath(__file__)
sys.path.insert(0, SERVICO)
os.chdir(SERVICO)

from sqlalchemy import text  # noqa: E402

from app.db.sgi import sgi_connection  # noqa: E402
from app.services.bi.os_live import status_kind  # noqa: E402

SP = ZoneInfo("America/Sao_Paulo")
INICIO = date(2026, 8, 3)  # segunda-feira
REGIME = date(2026, 9, 21)  # manutenção entrou, volume dobrou
ONTEM = date(2026, 10, 22)
BACKTEST_DE = INICIO + timedelta(days=28)
HORAS_TURNO = 3.2
HORAS_DIA = 6.4
TURNOS = ("morning", "afternoon")
ROTULO = {"dia": "dia", "morning": "manhã", "afternoon": "tarde"}
REALIZADO = ("completed", "unproductive", "in-field")
DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
SAIDA = os.path.join(os.path.dirname(ARQUIVO), "presenca-e-enchimento-2026-10-23.txt")

CORTES = [
    ("véspera 08h", -1, 8),
    ("véspera 12h", -1, 12),
    ("véspera 14h", -1, 14),
    ("véspera 17h", -1, 17),
    ("véspera 20h", -1, 20),
    ("dia 00h", 0, 0),
    ("dia 08h", 0, 8),
    ("dia 10h", 0, 10),
    ("dia 12h", 0, 12),
    ("dia 14h", 0, 14),
]

SQL_SANIDADE = """
SELECT current_database() AS banco,
       current_setting('default_transaction_read_only') AS somente_leitura,
       current_setting('TimeZone') AS fuso
"""
SQL_TIPOS = """
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'service_orders'
  AND column_name IN ('created_at', 'rescheduled_at', 'scheduled_date')
ORDER BY column_name
"""
SQL_OS = """
SELECT so.scheduled_date AS dia, so.period AS turno, so.status AS status,
       so.technician_id::text AS tecnico, soc.sla AS sla, soc.type AS tipo,
       so.created_at AS criada, so.rescheduled_at AS reagendada
FROM public.service_orders so
JOIN public.service_order_categories soc ON soc.id = so.category_id
WHERE so.deleted_at IS NULL AND so.scheduled_date BETWEEN :a AND :b
"""
SQL_TECNICOS = """
SELECT u.id::text AS id, u.status AS status,
       (u.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS criado,
       (u.deleted_at AT TIME ZONE 'America/Sao_Paulo')::date AS excluido
FROM auth.users u
WHERE u.role = 'technician'
"""
SQL_FERIADOS = """
SELECT hd.day::int AS dia, hd.month::int AS mes, hd.team_ids::text[] AS equipes,
       hd.name AS nome, h.name AS grupo
FROM public.holiday_date hd
JOIN public.holiday h ON h.id = hd.holiday_id
WHERE hd.deleted_at IS NULL AND h.deleted_at IS NULL
"""

_linhas: list[str] = []


def out(s: str = "") -> None:
    print(s)
    _linhas.append(s)


def local(dt):
    """Data e hora em São Paulo, sem fuso, para comparar com os cortes."""
    if isinstance(dt, datetime) and dt.tzinfo is not None:
        return dt.astimezone(SP).replace(tzinfo=None)
    return dt


def quantil(vals, p):
    if not vals:
        return None
    s = sorted(vals)
    k = (len(s) - 1) * p
    f = int(k)
    c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def num(x, nd=0):
    if x is None:
        return "-"
    return f"{x:.{nd}f}".replace(".", ",")


def horas(h):
    if h is None:
        return "-"
    sinal = "-" if h < 0 else ""
    m = int(round(abs(h) * 60))
    return f"{sinal}{m // 60}h{m % 60:02d}" if m % 60 else f"{sinal}{m // 60}h"


def rotulo(d: date) -> str:
    return f"{DIAS[d.weekday()]} {d.day:02d}/{d.month:02d}"


def main() -> None:
    with sgi_connection() as conn:
        san = conn.execute(text(SQL_SANIDADE)).mappings().one()
        tipos = conn.execute(text(SQL_TIPOS)).mappings().all()
        os_rows = conn.execute(text(SQL_OS), {"a": INICIO, "b": ONTEM}).mappings().all()
        tecs = conn.execute(text(SQL_TECNICOS)).mappings().all()
        fers = conn.execute(text(SQL_FERIADOS)).mappings().all()

    out(f"Presença e enchimento da agenda, medido em {date.today():%d/%m/%Y}")
    out(f"banco={san['banco']} somente_leitura={san['somente_leitura']} fuso={san['fuso']}")
    out("colunas: " + ", ".join(f"{t['column_name']}={t['data_type']}" for t in tipos))
    out(f"janela {INICIO:%d/%m} a {ONTEM:%d/%m}: {len(os_rows)} OS não apagadas; regime atual desde {REGIME:%d/%m}")

    feriados = {(f["dia"], f["mes"]): f["nome"] or f["grupo"] for f in fers if not f["equipes"]}

    def feriado(d: date):
        return feriados.get((d.day, d.month))

    def ativos_em(d: date) -> int:
        return sum(
            1
            for t in tecs
            if t["status"] == "active"
            and (t["criado"] is None or t["criado"] <= d)
            and (t["excluido"] is None or t["excluido"] > d)
        )

    # --- agregação por dia e turno --------------------------------------------
    pres: dict[tuple, set] = defaultdict(set)
    carga: dict[tuple, float] = defaultdict(float)
    qtd: dict[tuple, int] = defaultdict(int)
    entradas: dict[date, list] = defaultdict(list)
    sem_sla = 0
    for r in os_rows:
        if status_kind(r["status"]) not in REALIZADO:
            continue
        d = r["dia"]
        sla = float(r["sla"]) if r["sla"] is not None else 0.0
        if r["sla"] is None:
            sem_sla += 1
        carga[(d, "dia")] += sla
        qtd[(d, "dia")] += 1
        if r["turno"] in TURNOS:
            carga[(d, r["turno"])] += sla
            qtd[(d, r["turno"])] += 1
        if r["tecnico"]:
            pres[(d, "dia")].add(r["tecnico"])
            if r["turno"] in TURNOS:
                pres[(d, r["turno"])].add(r["tecnico"])
        criada = local(r["criada"])
        reag = local(r["reagendada"])
        momentos = [m for m in (criada, reag) if m is not None]
        entradas[d].append((max(momentos) if momentos else None, criada, sla))

    todos = [INICIO + timedelta(days=i) for i in range((ONTEM - INICIO).days + 1)]
    uteis = [d for d in todos if feriado(d) is None]

    def p(d: date, chave: str) -> int:
        return len(pres.get((d, chave), ()))

    out(f"OS realizadas sem horas previstas (pesam zero): {sem_sla}")
    out("feriados gerais do cadastro na janela: " + ", ".join(
        f"{rotulo(d)} ({feriado(d)})" for d in todos if feriado(d) is not None) or "nenhum")

    # --- A1: presença por dia da semana -----------------------------------------
    for titulo, ini in (("janela inteira", INICIO), ("regime atual", REGIME)):
        out()
        out(f"== A1. Presença por dia da semana, {titulo} ({ini:%d/%m} a {ONTEM:%d/%m}, sem feriado geral) ==")
        out("dia   n | presentes no dia: min p10 med p90 max | manhã med (min-max) | tarde med (min-max) | ativos cadastro med | presença/ativos")
        for w in range(7):
            ds = [d for d in uteis if d.weekday() == w and d >= ini]
            if not ds:
                continue
            vd = [p(d, "dia") for d in ds]
            vm = [p(d, "morning") for d in ds]
            vt = [p(d, "afternoon") for d in ds]
            va = [ativos_em(d) for d in ds]
            razao = statistics.median(vd) / statistics.median(va) * 100 if statistics.median(va) else None
            out(
                f"{DIAS[w]:>3} {len(ds):>3} | {min(vd):>3} {num(quantil(vd, 0.1)):>4} {num(statistics.median(vd)):>4} "
                f"{num(quantil(vd, 0.9)):>4} {max(vd):>4} | {num(statistics.median(vm)):>4} ({min(vm)}-{max(vm)})"
                f" | {num(statistics.median(vt)):>4} ({min(vt)}-{max(vt)}) | {num(statistics.median(va)):>4} | {num(razao)}%"
            )

    # --- A2: erro do estimador (mediana dos 4 mesmos dias anteriores) -----------
    def estimativa(d: date, chave: str, semanas: int):
        anteriores = [p(d - timedelta(days=7 * k), chave) for k in range(1, semanas + 1)
                      if d - timedelta(days=7 * k) >= INICIO and feriado(d - timedelta(days=7 * k)) is None]
        return statistics.median(anteriores) if anteriores else None

    grupos = (("seg a sex", range(0, 5)), ("sábado", [5]), ("domingo", [6]))
    for semanas in (4, 8):
        de = INICIO + timedelta(days=7 * semanas)
        out()
        out(f"== A2. Erro de estimar a presença pela mediana dos {semanas} mesmos dias da semana anteriores"
            f" (dias de {de:%d/%m} a {ONTEM:%d/%m}, sem feriado geral) ==")
        out("grupo      | onde  |  n | viés | erro médio abs | p90 abs | máx abs || em horas: erro médio | p90 | máx || régua do SGI (ativos - presentes): média | mín | máx | em horas média")
        for nome, ws in grupos:
            for chave in ("dia", "morning", "afternoon"):
                erros = []
                sgi = []
                for d in uteis:
                    if d < de or d.weekday() not in ws:
                        continue
                    e = estimativa(d, chave, semanas)
                    if e is None:
                        continue
                    erros.append(p(d, chave) - e)
                    if chave == "dia":
                        sgi.append(ativos_em(d) - p(d, "dia"))
                if not erros:
                    continue
                fator = HORAS_DIA if chave == "dia" else HORAS_TURNO
                absd = [abs(x) for x in erros]
                extra = ""
                if sgi:
                    extra = (f" || {num(statistics.mean(sgi), 1):>5} | {min(sgi):>3} | {max(sgi):>3} | "
                             f"{horas(statistics.mean(sgi) * HORAS_DIA)}")
                out(
                    f"{nome:<10} | {ROTULO[chave]:<5} | {len(erros):>2} | {num(statistics.mean(erros), 1):>4} | "
                    f"{num(statistics.mean(absd), 1):>14} | {num(quantil(absd, 0.9), 1):>7} | {num(max(absd)):>7} || "
                    f"{horas(statistics.mean(absd) * fator):>20} | {horas(quantil(absd, 0.9) * fator):>6} | "
                    f"{horas(max(absd) * fator):>6}{extra}"
                )

    out()
    out("== A2b. Dias atípicos: presença do dia 4 ou mais técnicos longe da estimativa de 4 semanas ==")
    out("dia        | presentes | estimado | erro | horas realizadas | feriado do cadastro")
    for d in todos:
        if d < BACKTEST_DE:
            continue
        e = estimativa(d, "dia", 4)
        if e is None:
            continue
        erro = p(d, "dia") - e
        if abs(erro) >= 4 or feriado(d) is not None:
            out(f"{rotulo(d):<10} | {p(d, 'dia'):>9} | {num(e):>8} | {num(erro):>4} | {horas(carga.get((d, 'dia'), 0.0)):>16} | {feriado(d) or ''}")

    # --- A3: ocupação com presentes x com a régua do SGI ------------------------
    for titulo, ini in (("regime atual", REGIME), ("janela inteira", INICIO)):
        out()
        out(f"== A3. Ocupação do dia (horas previstas realizadas / capacidade), {titulo}, sem feriado geral ==")
        out("dia   n | com os presentes x 6h24: min med máx | com os ativos do cadastro x 6h24: min med máx | horas realizadas med")
        for w in range(7):
            ds = [d for d in uteis if d.weekday() == w and d >= ini and p(d, "dia") > 0]
            if not ds:
                continue
            op = [carga[(d, "dia")] / (p(d, "dia") * HORAS_DIA) * 100 for d in ds]
            og = [carga[(d, "dia")] / (ativos_em(d) * HORAS_DIA) * 100 for d in ds]
            hs = [carga[(d, "dia")] for d in ds]
            out(
                f"{DIAS[w]:>3} {len(ds):>3} | {num(min(op)):>4}% {num(statistics.median(op)):>4}% {num(max(op)):>4}% | "
                f"{num(min(og)):>4}% {num(statistics.median(og)):>4}% {num(max(og)):>4}% | {horas(statistics.median(hs))}"
            )
        turnos_pct = []
        for d in uteis:
            if d < ini or d.weekday() == 6:
                continue
            for t in TURNOS:
                if p(d, t) > 0:
                    turnos_pct.append(carga[(d, t)] / (p(d, t) * HORAS_TURNO) * 100)
        if turnos_pct:
            acima = sum(1 for x in turnos_pct if x > 100)
            out(f"turnos de seg a sáb com presentes: {len(turnos_pct)}, ocupação mediana {num(statistics.median(turnos_pct))}%, "
                f"p90 {num(quantil(turnos_pct, 0.9))}%, máx {num(max(turnos_pct))}%, acima de 100%: {acima} ({num(acima / len(turnos_pct) * 100)}%)")

    # --- B: enchimento do dia ---------------------------------------------------
    grupos_b = (("segunda", [0]), ("ter a sex", range(1, 5)), ("sábado", [5]), ("domingo", [6]))

    def corte(d: date, desloc: int, hora: int) -> datetime:
        return datetime.combine(d + timedelta(days=desloc), datetime.min.time()) + timedelta(hours=hora)

    for titulo, ini in (("regime atual", REGIME), ("janela inteira", INICIO)):
        out()
        out(f"== B1. Quanto da carga final do dia (horas previstas realizadas) já tinha ENTRADO no dia, {titulo}, sem feriado geral ==")
        out("entrada = criação ou último reagendamento, o que for mais tarde. Média entre os dias; entre parênteses, só pela criação (régua de 14/10).")
        out("grupo     |  n | " + " | ".join(f"{c[0]:>11}" for c in CORTES))
        for nome, ws in grupos_b:
            ds = [d for d in uteis if d >= ini and d.weekday() in ws and carga.get((d, "dia"), 0) > 0]
            if not ds:
                continue
            cols = []
            for _, desloc, hora in CORTES:
                shares = []
                shares_cri = []
                for d in ds:
                    lim = corte(d, desloc, hora)
                    tot = carga[(d, "dia")]
                    ent = sum(sla for (m, _c, sla) in entradas[d] if m is not None and m <= lim)
                    cri = sum(sla for (_m, c, sla) in entradas[d] if c is not None and c <= lim)
                    shares.append(ent / tot * 100)
                    shares_cri.append(cri / tot * 100)
                cols.append(f"{num(statistics.mean(shares)):>4}% ({num(statistics.mean(shares_cri)):>3}%)")
            out(f"{nome:<9} | {len(ds):>2} | " + " | ".join(cols))

    out()
    out(f"== B2. Reserva do dia: horas previstas que entraram DEPOIS das 17h da véspera, regime atual ({REGIME:%d/%m} a {ONTEM:%d/%m}) ==")
    out("dia   n | horas depois das 17h da véspera: min med p90 máx | % da carga final: med máx | carga final med | OS que entraram por reagendamento no dia: % med")
    for w in range(7):
        ds = [d for d in uteis if d >= REGIME and d.weekday() == w and carga.get((d, "dia"), 0) > 0]
        if not ds:
            continue
        res = []
        pct = []
        fin = []
        reag = []
        for d in ds:
            lim = corte(d, -1, 17)
            tot = carga[(d, "dia")]
            ent = sum(sla for (m, _c, sla) in entradas[d] if m is not None and m <= lim)
            res.append(tot - ent)
            pct.append((tot - ent) / tot * 100)
            fin.append(tot)
            n_tot = len(entradas[d])
            n_reag = sum(1 for (m, c, _s) in entradas[d] if m is not None and c is not None and m > c)
            reag.append(n_reag / n_tot * 100 if n_tot else 0)
        out(
            f"{DIAS[w]:>3} {len(ds):>3} | {horas(min(res)):>6} {horas(statistics.median(res)):>6} {horas(quantil(res, 0.9)):>6} {horas(max(res)):>6} | "
            f"{num(statistics.median(pct)):>4}% {num(max(pct)):>4}% | {horas(statistics.median(fin)):>7} | {num(statistics.median(reag))}%"
        )

    out()
    out("Caveats: OS que saiu do dia por reagendamento não é descontada do que já tinha entrado (a reserva real é um pouco menor);")
    out("presença por turno conta técnico com OS realizada no turno; técnico sem OS no turno mas em campo não aparece.")

    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write("\n".join(_linhas) + "\n")
    print(f"\nsaída gravada em {SAIDA}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    main()
