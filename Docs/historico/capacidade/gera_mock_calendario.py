"""Gera o mock estatico 'Agenda e capacidade' em formato de calendario, com os
numeros reais lidos do servico (agenda-mock-dados.json). So apresentacao."""
import json
from datetime import date, timedelta
from pathlib import Path

PASTA = Path(__file__).parent
dados = json.loads((PASTA / "agenda-mock-dados.json").read_text(encoding="utf-8"))
hoje = date.fromisoformat(dados["hoje"])
lido = dados["lido_em"][11:16]
por_dia = {d["dia"]: d for d in dados["dias"]}
SEMANAS = 2
DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]


def fmt_h(v):
    return f"{v:,.1f} h".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_n(v):
    return f"{v:,}".replace(",", ".")


def tone(ocup):
    if ocup is None:
        return "none"
    if ocup > 1:
        return "over"
    if ocup >= 0.85:
        return "near"
    return "ok"


def chip_turno(t, kind):
    if kind == "past":
        return '<span class="chip chip-past">Realizado</span>'
    ocup, cap, h = t["ocup_op"], t["cap_op"], t["h"]
    if t["os"] == 0:
        return '<span class="chip chip-muted">Livre</span>'
    tn = tone(ocup)
    if tn == "none":
        return '<span class="chip chip-muted">Sem estimativa</span>'
    sobra = cap - h
    if tn == "ok":
        return f'<span class="chip chip-ok">Cabe mais {fmt_h(sobra)}</span>'
    if tn == "near":
        return f'<span class="chip chip-near">Quase cheio · sobram {fmt_h(max(sobra, 0))}</span>'
    return f'<span class="chip chip-over">Cheio · passou {fmt_h(-sobra)}</span>'


def cheias_no_turno(d, turno):
    return sum(1 for c in d["categorias"] for t in c["turnos"] if t["t"] == turno and t["full"])


def bloco_turno(d, t, selecionado):
    tn = "past" if d["kind"] == "past" else tone(t["ocup_op"]) if t["os"] > 0 else "empty"
    largura = 0 if t["ocup_op"] is None else min(100, round(t["ocup_op"] * 100))
    cheias = cheias_no_turno(d, t["t"])
    extra = ""
    if cheias and d["kind"] != "past":
        extra = f'<div class="sgi">SGI recusa {cheias} categoria{"s" if cheias > 1 else ""}</div>'
    horas = "" if t["os"] == 0 else f'<div class="horas">{fmt_h(t["h"])} de {fmt_h(t["cap_op"]) if t["cap_op"] is not None else "?"}</div>'
    sel = " selected" if selecionado else ""
    return f"""
      <button class="turno tone-{tn}{sel}" type="button">
        <div class="turno-head"><span class="turno-nome">{t['t']}</span><span class="turno-os">{t['os']} OS</span></div>
        <div class="bar"><div class="fill" style="width:{largura}%"></div></div>
        <div class="chip-row">{chip_turno(t, d['kind'])}</div>
        {horas}{extra}
      </button>"""


def celula(dia):
    d = por_dia.get(str(dia))
    label = f"{DIAS[dia.weekday()]} {dia.day:02d}"
    classes = ["dia"]
    if dia == hoje:
        classes.append("hoje")
    if d is None or (d["os"] == 0 and dia.weekday() == 6):
        return f'<div class="{" ".join(classes)} vazio"><div class="dia-head"><span>{label}</span></div><div class="sem-agenda">Sem agenda</div></div>'
    if d["kind"] == "past":
        classes.append("passado")
    chips = []
    if dia == hoje:
        chips.append('<span class="chip chip-accent">Hoje</span>')
    if d["fechado"]:
        chips.append('<span class="chip chip-muted">Feriado</span>')
    presentes = "" if d["presentes"] is None else f'<span class="presentes" title="{d["base"]}">{d["presentes"]} técnicos</span>'
    turnos = "".join(bloco_turno(d, t, selecionado=(str(dia) == str(hoje + timedelta(days=1)) and t["t"] == "Manhã")) for t in d["turnos"])
    return f"""<div class="{' '.join(classes)}">
      <div class="dia-head"><span>{label}</span>{''.join(chips)}{presentes}</div>
      {turnos}
    </div>"""


def semana(inicio):
    return "".join(celula(inicio + timedelta(days=i)) for i in range(7))


segunda = hoje - timedelta(days=hoje.weekday())
grade = "".join(f'<div class="semana">{semana(segunda + timedelta(days=7 * s))}</div>' for s in range(SEMANAS))

# Resumo da semana em palavras.
def resumo(inicio):
    os_ = 0
    estados = {"ok": 0, "near": 0, "over": 0}
    for i in range(7):
        d = por_dia.get(str(inicio + timedelta(days=i)))
        if not d or d["kind"] == "past":
            continue
        os_ += d["os"]
        for t in d["turnos"]:
            if t["os"] > 0 and t["ocup_op"] is not None:
                estados[tone(t["ocup_op"])] += 1
    return os_, estados


os1, e1 = resumo(segunda)
os2, e2 = resumo(segunda + timedelta(days=7))

# Detalhe do turno escolhido: amanha de manha.
amanha = por_dia[str(hoje + timedelta(days=1))]
cheias, cabem = [], []
for c in amanha["categorias"]:
    t = next(x for x in c["turnos"] if x["t"] == "Manhã")
    if c["sla"] and t["cap"] > 0 and not t["full"]:
        n = int((t["cap"] - t["cons"]) // c["sla"]) if c["sla"] > 0 else 0
        cabem.append((c["nome"], n, c["sla"], c["aptos"]))
    elif t["full"]:
        cheias.append((c["nome"], c["aptos"], t["os"]))
cabem.sort(key=lambda x: x[1])
itens_cheias = "".join(
    f'<li><span class="chip chip-over">Cheio</span><span class="cat">{n}</span><span class="meta">{a} técnico{"s" if a != 1 else ""} apto{"s" if a != 1 else ""} · {o} OS marcada{"s" if o != 1 else ""}</span></li>'
    for n, a, o in cheias[:8]
)
itens_cabem = "".join(
    f'<li><span class="chip chip-ok">Cabe mais {n}</span><span class="cat">{nome}</span><span class="meta">{fmt_h(sla)} cada · {a} apto{"s" if a != 1 else ""}</span></li>'
    for nome, n, sla, a in cabem[:6]
)
registro = [r for r in dados["registro"] if r["executed_without_capability"] > 0 or r["apt_technicians"] == 0]

html = f"""<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8">
<title>Mock: Agenda e capacidade em calendário</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root {{ --app-bg:#eef0f4; --surface:#ffffff; --surface-elevated:#ffffff; --border:#e4e7ee; --divider:#eef0f4;
  --text-heading:#101828; --text-primary:#1a2331; --text-item:#344054; --text-secondary:#475467; --text-disabled:#c2c8d2;
  --accent:#003be2; --accent-weak:#003be21f; --chip:#003be2; --chip-bg:#003be21f;
  --ok:#00a862; --near:#b45309; --over:#e5384e; --muted:#6b7a90; --track:#eef0f4; }}
:root[data-theme="dark"] {{ --app-bg:#0f172a; --surface:#1f2937; --surface-elevated:#263448; --border:#3b475a; --divider:#323e50;
  --text-heading:#f2f4f7; --text-primary:#e9edf3; --text-item:#dfe5ec; --text-secondary:#cdd5df; --text-disabled:#5d6b7e;
  --accent:#34d372; --accent-weak:rgba(52,211,114,.16); --chip:#34d372; --chip-bg:rgba(52,211,114,.16);
  --ok:#34d399; --near:#f5a623; --over:#ff4d6a; --muted:#a9b5c6; --track:#323e50; }}
* {{ box-sizing:border-box }}
body {{ margin:0; background:var(--app-bg); color:var(--text-primary); font-family:"IBM Plex Sans",ui-sans-serif,system-ui,sans-serif; font-size:12px; -webkit-font-smoothing:antialiased }}
.page {{ width:1180px; margin:0 auto; padding:22px 0 30px }}
.heading {{ display:flex; align-items:baseline; gap:8px; margin:0 2px 10px; flex-wrap:wrap }}
.heading h2 {{ margin:0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-secondary) }}
.heading .desc {{ font-size:11.5px; color:var(--text-secondary) }}
.heading .action {{ margin-left:auto; font-size:11.5px; font-weight:600; color:var(--accent); cursor:pointer }}
.panel {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:0 1px 2px rgba(16,24,40,.05) }}
.resumo {{ display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px }}
.resumo .panel {{ padding:12px 16px }}
.resumo .titulo {{ font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-secondary); margin-bottom:4px }}
.resumo .frase {{ font-size:13px; color:var(--text-heading) }}
.resumo .frase strong {{ font-family:"IBM Plex Mono",monospace; font-weight:600 }}
.legenda {{ display:flex; gap:8px; align-items:center; margin:0 2px 10px; font-size:11.5px; color:var(--text-secondary) }}
.chip {{ display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:1px 9px; font-size:11px; font-weight:500; border:1px solid; white-space:nowrap }}
.chip-accent {{ color:var(--chip); background:var(--chip-bg); border-color:color-mix(in srgb,var(--chip) 38%,transparent) }}
.chip-ok {{ color:var(--ok); background:color-mix(in srgb,var(--ok) 13%,transparent); border-color:color-mix(in srgb,var(--ok) 38%,transparent) }}
.chip-near {{ color:var(--near); background:color-mix(in srgb,var(--near) 13%,transparent); border-color:color-mix(in srgb,var(--near) 38%,transparent) }}
.chip-over {{ color:var(--over); background:color-mix(in srgb,var(--over) 12%,transparent); border-color:color-mix(in srgb,var(--over) 38%,transparent) }}
.chip-muted, .chip-past {{ color:var(--muted); background:color-mix(in srgb,var(--muted) 12%,transparent); border-color:color-mix(in srgb,var(--muted) 38%,transparent) }}
.calendario {{ padding:14px }}
.semana {{ display:grid; grid-template-columns:repeat(7,1fr); gap:10px }}
.semana + .semana {{ margin-top:10px; padding-top:10px; border-top:1px solid var(--divider) }}
.dia {{ border:1px solid var(--border); border-radius:10px; background:var(--surface-elevated); padding:8px; min-height:150px }}
.dia.hoje {{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset }}
.dia.vazio {{ background:transparent; border-style:dashed }}
.dia-head {{ display:flex; align-items:center; gap:6px; margin-bottom:6px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-secondary) }}
.dia.hoje .dia-head > span:first-child {{ color:var(--accent) }}
.presentes {{ margin-left:auto; font-weight:500; text-transform:none; letter-spacing:0; color:var(--text-secondary) }}
.sem-agenda {{ padding:30px 0; text-align:center; color:var(--text-disabled); font-size:11.5px }}
.turno {{ display:block; width:100%; text-align:left; border:1px solid var(--border); background:var(--surface); border-radius:8px; padding:7px 8px 8px; margin-top:6px; cursor:pointer; font:inherit; color:inherit }}
.turno.selected {{ border-color:var(--accent); background:color-mix(in srgb,var(--accent) 7%,var(--surface)) }}
.turno-head {{ display:flex; align-items:baseline; justify-content:space-between; gap:6px }}
.turno-nome {{ font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-secondary) }}
.turno-os {{ font-family:"IBM Plex Mono",monospace; font-size:17px; font-weight:600; letter-spacing:-.4px; color:var(--text-heading) }}
.bar {{ height:5px; border-radius:4px; background:var(--track); overflow:hidden; margin:6px 0 6px }}
.fill {{ height:100%; border-radius:4px; background:var(--accent) }}
.tone-ok .fill {{ background:var(--ok) }} .tone-near .fill {{ background:var(--near) }} .tone-over .fill {{ background:var(--over) }} .tone-empty .fill, .tone-none .fill {{ background:var(--muted) }}
.chip-row {{ margin-bottom:4px }}
.horas {{ font-size:10.5px; color:var(--text-secondary); font-family:"IBM Plex Mono",monospace }}
.sgi {{ margin-top:3px; font-size:10.5px; font-weight:600; color:var(--near) }}
.detalhe {{ margin-top:14px; padding:14px 16px }}
.detalhe h3 {{ margin:0 0 2px; font-size:13.5px; font-weight:600; color:var(--text-heading) }}
.detalhe .sub {{ font-size:11.5px; color:var(--text-secondary); margin-bottom:10px }}
.cols {{ display:grid; grid-template-columns:1fr 1fr; gap:18px }}
.cols h4 {{ margin:0 0 6px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-secondary) }}
ul {{ list-style:none; margin:0; padding:0 }}
li {{ display:flex; align-items:center; gap:8px; padding:5px 0; border-top:1px solid var(--divider); font-size:12.5px }}
li .cat {{ font-weight:500; color:var(--text-heading) }}
li .meta {{ margin-left:auto; font-size:11px; color:var(--text-secondary); white-space:nowrap }}
.rodape {{ margin-top:14px; font-size:11.5px; color:var(--text-secondary); display:flex; gap:6px; align-items:center }}
.rodape .action {{ color:var(--accent); font-weight:600; cursor:pointer }}
</style>
</head>
<body>
<div class="page">
  <div style="display:flex;justify-content:flex-end;margin-bottom:6px"><button type="button" onclick="var r=document.documentElement;r.setAttribute('data-theme',r.getAttribute('data-theme')==='dark'?'light':'dark')" style="font:inherit;font-size:11px;padding:3px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);cursor:pointer">Alternar tema claro / escuro (só no mock)</button></div>
  <div class="heading">
    <h2>Agenda e capacidade</h2>
    <span class="desc">agenda do SGI lida às {lido} · capacidade pela conta com os técnicos presentes, {dados['parametros']['hours_per_technician_period']:.1f} h por técnico por turno · clique num turno para ver as categorias</span>
    <span class="action">Ver 4 semanas</span>
  </div>

  <div class="resumo">
    <div class="panel"><div class="titulo">Esta semana, {segunda.day:02d}/{segunda.month:02d} a {(segunda + timedelta(days=6)).day:02d}/{(segunda + timedelta(days=6)).month:02d}</div>
      <div class="frase"><strong>{fmt_n(os1)}</strong> OS marcadas · <strong>{e1['ok']}</strong> turnos com folga, <strong>{e1['near']}</strong> quase cheio{'s' if e1['near'] != 1 else ''}, <strong>{e1['over']}</strong> cheio{'s' if e1['over'] != 1 else ''}</div></div>
    <div class="panel"><div class="titulo">Próxima semana, {(segunda + timedelta(days=7)).day:02d}/{(segunda + timedelta(days=7)).month:02d} a {(segunda + timedelta(days=13)).day:02d}/{(segunda + timedelta(days=13)).month:02d}</div>
      <div class="frase"><strong>{fmt_n(os2)}</strong> OS marcadas · a agenda enche de 1 a 3 dias antes; só câmeras marca com mais antecedência</div></div>
  </div>

  <div class="legenda">Legenda:
    <span class="chip chip-ok">Cabe mais 24,0 h</span>
    <span class="chip chip-near">Quase cheio</span>
    <span class="chip chip-over">Cheio</span>
    <span class="chip chip-muted">Sem estimativa</span>
    <span class="chip chip-past">Realizado</span>
    <span style="margin-left:auto">"SGI recusa N categorias" é o que a grade de datas do SGI já não oferece naquele turno</span>
  </div>

  <div class="panel calendario">{grade}</div>

  <div class="panel detalhe">
    <h3>Terça-feira {(hoje + timedelta(days=1)).day:02d}/{(hoje + timedelta(days=1)).month:02d}, manhã</h3>
    <div class="sub">{amanha['turnos'][0]['os']} OS marcadas, {fmt_h(amanha['turnos'][0]['h'])} de {fmt_h(amanha['turnos'][0]['cap_op'])} · pela grade do SGI, capacidade só dos técnicos aptos em cada categoria</div>
    <div class="cols">
      <div><h4>O que o SGI já recusa neste turno</h4><ul>{itens_cheias}</ul></div>
      <div><h4>O que ainda cabe, por categoria</h4><ul>{itens_cabem}</ul></div>
    </div>
  </div>

  <div class="rodape"><span class="action">Cadastro de aptidões a corrigir no SGI: {len(registro)} categorias</span> · quem executa sem estar cadastrado como apto, ou categoria sem nenhum técnico apto</div>
</div>
</body>
</html>"""

(PASTA / "mock-agenda-calendario.html").write_text(html, encoding="utf-8")
print("ok", PASTA / "mock-agenda-calendario.html", "| semana 1:", os1, e1, "| semana 2:", os2, e2, "| cheias amanha manha:", len(cheias), "cabem:", len(cabem))
