// Gera a prévia da rodada 9 a partir da rodada 8: posição 4, posição 3 e a mistura das duas.
const fs = require('fs')
const path = require('path')
const dir = __dirname
let s = fs.readFileSync(path.join(dir, 'preview-cards-v8-2026-10-20.html'), 'utf8')

s = s.replace('rodada 8 (20/10/2026)', 'rodada 9 (20/10/2026)')
s = s.replace('rodada 8: onde fica a resposta do turno e como ela se escreve',
  'rodada 9: entre a pílula centralizada (4) e o número em destaque (3)')
s = s.replace('  .p-frase .so { font-size: 11px; font-weight: 600; }',
  '  .p-frase .so { font-size: 11px; font-weight: 600; }\n  .p-frase.centro { justify-content: center; }')

const novo = `    if (posicao === 'frase-centro') {
      // Rodada 9: a frase da posição 3, centralizada como a 4, com "livres", que cabe no notebook.
      const cor = \`color:\${TOM[tom]}\`
      if (t.estado === 'ok' || t.estado === 'empty') pe = \`<div class="p-frase centro"><b style="\${cor}">\${t.sobra}</b><span>livres</span></div>\`
      else if (t.estado === 'attention') pe = \`<div class="p-frase centro"><span class="so" style="\${cor}">só</span><b style="\${cor}">\${t.sobra}</b><span>livres</span></div>\`
      else if (t.estado === 'over') pe = \`<div class="p-frase centro"><span class="so" style="\${cor}">excedeu</span><b style="\${cor}">\${t.sobra}</b></div>\`
      else pe = \`<div class="p-frase centro"><b style="\${cor};font-size:12px">\${texto(t, termos)}</b></div>\`
    } else `
s = s.replace("    if (posicao === 'frase') {", novo + "if (posicao === 'frase') {")

const i = s.indexOf('raiz.innerHTML =')
const j = s.indexOf("if (params.get('tema')")
const raiz = `raiz.innerHTML =
  bloco(\`Posição 4: pílula centralizada, com "livres" · \${tela}\`,
    'A resposta fica numa pílula, como as do resto do portal, no meio do turno.', largura, 'centro', 'livres') +
  bloco(\`Posição 3: sem pílula, número em destaque, com "para agendar" · \${tela}\`,
    'A resposta vira o número mais forte do turno. No notebook a frase corta.', largura, 'frase', 'agendar') +
  bloco(\`Mistura das duas: número em destaque, centralizado, com "livres" · \${tela}\`,
    'O destaque da 3 com o alinhamento da 4. "livres" cabe no notebook. Excedido vira "excedeu 7h12" em vermelho.', largura, 'frase-centro', 'livres')

`
s = s.slice(0, i) + raiz + s.slice(j)
fs.writeFileSync(path.join(dir, 'preview-cards-v9-2026-10-20.html'), s)
console.log('ok', s.includes('frase-centro'))
