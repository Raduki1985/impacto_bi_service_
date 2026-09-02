import { describe, expect, it } from 'vitest'

import { mixHexColors } from './colorMix'

describe('mistura de cores sólidas', () => {
  it('devolve a própria cor quando ela está inteira', () => {
    expect(mixHexColors('#2f7de1', '#ffffff', 1)).toBe('#2f7de1')
  })

  it('devolve o fundo quando a cor desaparece', () => {
    expect(mixHexColors('#2f7de1', '#ffffff', 0)).toBe('#ffffff')
  })

  it('reproduz sobre o branco a mesma cor que a transparência aparentava', () => {
    // 40% de #2f7de1 sobre branco: 0,4*47 + 0,6*255 = 171,8 e assim por diante.
    // É exatamente o tom que a barra esmaecida tinha, agora sem translucidez.
    expect(mixHexColors('#2f7de1', '#ffffff', 0.4)).toBe('#accbf3')
  })

  it('escurece, em vez de clarear, quando o painel é escuro', () => {
    const claro = mixHexColors('#2f7de1', '#ffffff', 0.4)
    const escuro = mixHexColors('#2f7de1', '#1f2937', 0.4)

    expect(escuro).not.toBe(claro)
    // No tema escuro a mistura caminha para o fundo do painel, e não para o branco.
    expect(escuro).toBe('#254b7b')
  })

  it('prende a proporção ao intervalo válido, sem estourar canal', () => {
    expect(mixHexColors('#2f7de1', '#ffffff', 2)).toBe('#2f7de1')
    expect(mixHexColors('#2f7de1', '#ffffff', -1)).toBe('#ffffff')
  })

  it('aceita a cor com ou sem cerquilha', () => {
    expect(mixHexColors('2f7de1', 'ffffff', 0.4)).toBe('#accbf3')
  })

  it('devolve a cor intocada quando o formato não é o esperado', () => {
    // Nenhuma série some do gráfico por causa de um valor inesperado.
    expect(mixHexColors('rgba(0,0,0,.5)', '#ffffff', 0.4)).toBe('rgba(0,0,0,.5)')
    expect(mixHexColors('#fff', '#ffffff', 0.4)).toBe('#fff')
    expect(mixHexColors('#2f7de1', 'transparente', 0.4)).toBe('#2f7de1')
  })
})
