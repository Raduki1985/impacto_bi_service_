import { describe, expect, it } from 'vitest'

import { changeReadingWithPrevious, periodPhrase } from './overviewReadingPhrases'

describe('overviewReadingPhrases: o período por extenso', () => {
  it('escreve o período conforme o que ele atravessa', () => {
    expect(periodPhrase('2026-10-05', '2026-10-05')).toBe('em 05/10')
    expect(periodPhrase('2026-10-01', '2026-10-31')).toBe('de 01 a 31/10')
    expect(periodPhrase('2026-09-28', '2026-10-05')).toBe('de 28/09 a 05/10')
    expect(periodPhrase('2025-12-29', '2026-01-04')).toBe('de 29/12/2025 a 04/01/2026')
  })
})

describe('overviewReadingPhrases: variação com o número de trás do percentual', () => {
  const setembro = { long: 'versus setembro até o dia 5', within: 'em setembro até o dia 5' }
  const vendas = { one: 'venda', many: 'vendas' }

  it('diz o sentido, o tamanho, de quanto vinha e em que janela, na unidade do card', () => {
    expect(changeReadingWithPrevious(-0.088, setembro, 125, vendas)).toBe(
      'Recuou {8,8%}: eram {125} vendas em setembro até o dia 5.',
    )
    expect(changeReadingWithPrevious(0.1, setembro, 1234, vendas)).toBe(
      'Cresceu {10,0%}: eram {1.234} vendas em setembro até o dia 5.',
    )
    expect(changeReadingWithPrevious(0, setembro, 114, vendas)).toBe(
      'Ficou estável: também foram {114} vendas em setembro até o dia 5.',
    )
  })

  it('fala português com uma unidade anterior', () => {
    expect(changeReadingWithPrevious(1, setembro, 1, vendas)).toBe('Cresceu {100,0%}: era {1} venda em setembro até o dia 5.')
    expect(changeReadingWithPrevious(0, setembro, 1, vendas)).toBe(
      'Ficou estável: também foi {1} venda em setembro até o dia 5.',
    )
  })

  it('sem a janela conhecida, diz "no período anterior"; sem a contagem, só o percentual', () => {
    expect(changeReadingWithPrevious(0.25, undefined, 100, vendas)).toBe(
      'Cresceu {25,0%}: eram {100} vendas no período anterior.',
    )
    expect(changeReadingWithPrevious(-0.365, setembro, null, vendas)).toBe('Recuou {36,5%} versus setembro até o dia 5.')
    expect(changeReadingWithPrevious(0, undefined, null, vendas)).toBe('Ficou estável versus período anterior.')
  })
})
