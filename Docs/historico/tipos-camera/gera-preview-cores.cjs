// Prévia das cores dos dois tipos novos de câmera na rosca "Composição por
// tipo de OS", nos dois temas. Volumes: OS das últimas 4 semanas (21/10/2026).
const fs = require('fs')
const path = require('path')

const base = [
  ['Manutenção', 1233, '#f5a623'],
  ['Instalação', 693, '#2f6bff'],
  ['Instalação de Câmeras', 376, '#00b3a4'],
  ['Manutenção de Câmeras', 281, null],
  ['Mudança de Endereço', 258, '#8b5cf6'],
  ['Infraestrutura', 145, '#b5652f'],
  ['Retirada', 19, '#64748b'],
  ['Retirada de Câmeras', 13, null],
  ['Auditoria', 1, '#0ea5e9'],
]

const options = [
  { title: 'Opção 1: família verde-azulada', maint: '#0d9488', pickup: '#5b8a86' },
  { title: 'Opção 2: rosa', maint: '#ec4899', pickup: '#5b8a86' },
  { title: 'Opção 3: fúcsia', maint: '#c026d3', pickup: '#5b8a86' },
]

const themes = {
  claro: { bg: '#f3f5f9', panel: '#ffffff', border: '#e4e7ec', text: '#344054', muted: '#667085' },
  escuro: { bg: '#111827', panel: '#1f2937', border: '#3b475a', text: '#e5e7eb', muted: '#a9b5c6' },
}

function arc(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = p(r1, a0)
  const [x1, y1] = p(r1, a1)
  const [x2, y2] = p(r0, a1)
  const [x3, y3] = p(r0, a0)
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`
}

function donut(rows, panel) {
  const total = rows.reduce((s, r) => s + r[1], 0)
  let a = 0
  const gap = 0.012
  const paths = rows.map(([, v, c]) => {
    const span = Math.max((v / total) * Math.PI * 2, 0.02)
    const d = arc(110, 110, 62, 100, a + gap / 2, a + span - gap / 2)
    a += span
    return `<path d="${d}" fill="${c}" stroke="${panel}" stroke-width="1"/>`
  })
  return `<svg width="220" height="220" viewBox="0 0 220 220">${paths.join('')}</svg>`
}

function legend(rows, t) {
  return rows
    .map(
      ([n, v, c]) =>
        `<div class="li"><span class="dot" style="background:${c}"></span><span style="color:${t.text}">${n}</span><span class="num" style="color:${t.muted}">${v.toLocaleString('pt-BR')}</span></div>`,
    )
    .join('')
}

let html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cores dos tipos de câmera</title>
<style>
body{margin:0;font-family:'IBM Plex Sans',Segoe UI,sans-serif;font-size:12px}
.theme{padding:18px 22px}
.theme h2{font-size:14px;margin:0 0 12px}
.row{display:flex;gap:16px}
.card{border-radius:12px;padding:14px 16px;width:420px;border:1px solid}
.card h3{font-size:13px;margin:0 0 4px}
.sub{margin:0 0 8px}
.body{display:flex;align-items:center;gap:10px}
.li{display:flex;align-items:center;gap:6px;margin:3px 0}
.dot{width:10px;height:10px;border-radius:10px;flex:none}
.num{margin-left:auto;padding-left:10px;font-family:'IBM Plex Mono',Consolas,monospace}
.leg{min-width:180px}
</style></head><body>`

for (const [name, t] of Object.entries(themes)) {
  html += `<div class="theme" style="background:${t.bg}"><h2 style="color:${t.text}">Tema ${name}</h2><div class="row">`
  for (const o of options) {
    const rows = base.map(([n, v, c]) => [
      n,
      v,
      n === 'Manutenção de Câmeras' ? o.maint : n === 'Retirada de Câmeras' ? o.pickup : c,
    ])
    html += `<div class="card" style="background:${t.panel};border-color:${t.border}">
<h3 style="color:${t.text}">${o.title}</h3>
<p class="sub" style="color:${t.muted}">Manutenção de Câmeras ${o.maint} · Retirada de Câmeras ${o.pickup}</p>
<div class="body">${donut(rows, t.panel)}<div class="leg">${legend(rows, t)}</div></div></div>`
  }
  html += `</div></div>`
}
html += `</body></html>`

fs.writeFileSync(path.join(__dirname, 'preview-cores.html'), html)
console.log('ok')
