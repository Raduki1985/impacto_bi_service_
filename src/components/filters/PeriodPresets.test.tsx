import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PeriodPresets } from './PeriodPresets'

/**
 * Teste espelho dos atalhos de período na faixa.
 *
 * O que ele protege: os cinco botões na ordem aprovada, o aceso marcado por
 * `aria-pressed` (e não só por cor), a dica com o período por extenso, e o
 * atalho fora da cobertura desabilitado com o motivo, em vez de sumir.
 */
const hoje = '2026-09-22'

function render(props: Partial<Parameters<typeof PeriodPresets>[0]> = {}) {
  return renderToStaticMarkup(
    <PeriodPresets
      active={null}
      coverage={{ min: '2026-04-06', max: '2026-09-21' }}
      onSelect={() => {}}
      today={hoje}
      {...props}
    />,
  )
}

describe('atalhos de período', () => {
  it('mostra os cinco atalhos na ordem aprovada, num grupo nomeado', () => {
    const html = render()
    const positions = ['Ontem', 'Esta semana', 'Semana passada', 'Este mês', 'Mês passado'].map(
      (label) => html.indexOf(`>${label}</button>`),
    )

    expect(html).toContain('aria-label="Atalhos de período"')
    expect(positions.every((position) => position > -1)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('o atalho aceso é o que a página diz, marcado por aria-pressed e com a pílula tingida', () => {
    const html = render({ active: 'thisMonth' })

    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
    expect(html).toMatch(/aria-pressed="true"[^>]*title="01\/09\/2026 a 21\/09\/2026"[^>]*>Este mês</)
    expect(html).toMatch(/aria-pressed="true"[^>]*class="impacto-chip[^"]*"/)
  })

  it('a dica de cada atalho é o período por extenso, com o dia da semana num dia só', () => {
    const html = render()

    // Ontem, 21/09/2026, é segunda-feira.
    expect(html).toMatch(/title="segunda-feira, 21\/09\/2026"[^>]*>Ontem</)
    expect(html).toMatch(/title="14\/09\/2026 a 20\/09\/2026"[^>]*>Semana passada</)
  })

  it('atalho fora da cobertura fica desabilitado, visível e com o motivo', () => {
    // A cobertura termina em 21/08: nenhum atalho de setembro cabe nela.
    const html = render({ coverage: { min: '2026-04-06', max: '2026-08-21' } })

    expect((html.match(/Sem dados nesse período/g) ?? []).length).toBe(5)
    expect((html.match(/disabled=""/g) ?? []).length).toBe(5)
    expect(html).toContain('>Mês passado</button>')
  })
})
