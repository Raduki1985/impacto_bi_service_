import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SectionHeading } from './SectionHeading'

/**
 * Teste espelho do título de faixa.
 *
 * O que ele protege: o rótulo é um título de verdade (h2) em caixa alta, a
 * frase de apoio vem ao lado, e a ação, quando existe, fica encostada à
 * direita, depois do texto.
 */
describe('título de faixa', () => {
  it('escreve o título como h2 e a frase de apoio ao lado', () => {
    const html = renderToStaticMarkup(
      <SectionHeading description="Os quatro indicadores do recorte" title="Resultado do período" />,
    )

    expect(html).toMatch(/<h2[^>]*uppercase[^>]*>Resultado do período<\/h2>/)
    expect(html).toContain('Os quatro indicadores do recorte')
    expect(html).not.toContain('ml-auto')
  })

  it('a ação, quando existe, vem depois do texto e encostada à direita', () => {
    const html = renderToStaticMarkup(
      <SectionHeading
        action={<button type="button">Baixar</button>}
        description={<span>Setembro de 2026</span>}
        title="Resultado do período"
      />,
    )

    expect(html).toContain('ml-auto')
    expect(html.indexOf('Setembro de 2026')).toBeLessThan(html.indexOf('Baixar'))
  })
})
