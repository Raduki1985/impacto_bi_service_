import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PageStatePanel } from './PageStatePanel'

/**
 * Teste espelho do painel de estado da página.
 *
 * O que ele protege: carregando é anunciado como estado, falha como alerta,
 * e o painel tem a superfície executiva para não parecer aviso de outro
 * sistema.
 */
describe('painel de estado da página', () => {
  it('carregando: título, frase de apoio e anúncio educado ao leitor de tela', () => {
    const html = renderToStaticMarkup(
      <PageStatePanel title="Carregando as ordens de serviço">
        Buscando os dados no serviço de BI.
      </PageStatePanel>,
    )

    expect(html).toContain('Carregando as ordens de serviço')
    expect(html).toContain('Buscando os dados no serviço de BI.')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('executive-panel')
  })

  it('falha: o painel é um alerta, e não um estado', () => {
    const html = renderToStaticMarkup(
      <PageStatePanel kind="error" title="Não foi possível carregar a Visão Geral">
        O serviço de BI não respondeu.
      </PageStatePanel>,
    )

    expect(html).toContain('role="alert"')
    expect(html).not.toContain('aria-live')
    expect(html).toContain('O serviço de BI não respondeu.')
  })
})
