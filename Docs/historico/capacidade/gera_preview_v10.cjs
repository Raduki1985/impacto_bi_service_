// Gera a prévia da rodada 10 a partir da 9: a mistura aprovada, com horas ou com porcentagem dentro da barra.
const fs = require('fs')
const path = require('path')
const dir = __dirname
let s = fs.readFileSync(path.join(dir, 'preview-cards-v9-2026-10-20.html'), 'utf8')

const troca = (a, b) => {
  if (s.split(a).length !== 2) throw new Error(`não achei: ${a.slice(0, 80)}`)
  s = s.replace(a, b)
}

troca('rodada 9 (20/10/2026)', 'rodada 10 (20/10/2026)')
troca('rodada 9: entre a pílula centralizada (4) e o número em destaque (3)',
  'rodada 10: o que vai dentro da barra, horas marcadas ou porcentagem')
troca("    if (posicao === 'frase-centro') {", "    if (posicao === 'frase-centro' || posicao === 'frase-centro-pct') {")
troca('<span class="txt">${t.horas}</span>', '<span class="txt">${posicao === \'frase-centro-pct\' ? `${t.pct}%` : t.horas}</span>')

const i = s.indexOf('raiz.innerHTML =')
const j = s.indexOf("if (params.get('tema')")
const raiz = `raiz.innerHTML =
  bloco(\`Aprovado: horas marcadas dentro da barra · \${tela}\`,
    'Como está implementado: capacidade no canto, horas marcadas na barra, horas livres embaixo.', largura, 'frase-centro', 'livres') +
  bloco(\`Pedido: porcentagem dentro da barra · \${tela}\`,
    'Capacidade no canto, quanto está tomado na barra, horas livres embaixo. As horas marcadas vão para a dica do mouse.', largura, 'frase-centro-pct', 'livres')

`
s = s.slice(0, i) + raiz + s.slice(j)
fs.writeFileSync(path.join(dir, 'preview-cards-v10-2026-10-20.html'), s)
console.log('ok')
