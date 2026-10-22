import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PanelTabPanel, PanelTabs } from './PanelTabs'

/**
 * Teste espelho das abas do portal: a aba escolhida é anunciada como tal, cada
 * aba aponta para o próprio conteúdo, a contagem sai em pt-BR e a aba não
 * escolhida fica montada e escondida, para não perder o que a pessoa fez nela.
 */

function render(activeId: 'a' | 'b') {
  return renderToStaticMarkup(
    <>
      <PanelTabs
        activeId={activeId}
        ariaLabel="Partes"
        baseId="teste"
        onChange={() => undefined}
        tabs={[
          { id: 'a', label: 'Categorias', count: 1234 },
          { id: 'b', label: 'OS' },
        ]}
      />
      <PanelTabPanel active={activeId === 'a'} baseId="teste" tabId="a">
        conteúdo A
      </PanelTabPanel>
      <PanelTabPanel active={activeId === 'b'} baseId="teste" tabId="b">
        conteúdo B
      </PanelTabPanel>
    </>,
  )
}

describe('abas do portal', () => {
  it('marca a aba escolhida e liga cada aba ao seu conteúdo', () => {
    const html = render('a')
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Partes"')
    expect(html).toMatch(/aria-controls="teste-a-painel" aria-selected="true"/)
    expect(html).toMatch(/aria-controls="teste-b-painel" aria-selected="false"/)
    expect(html).toContain('aria-labelledby="teste-a-aba"')
    expect(html).toContain('id="teste-a-painel"')
    // O conteúdo recebe o foco pelo Tab, para rolar sem mouse.
    expect(html).toMatch(/id="teste-a-painel" role="tabpanel" tabindex="0"/)
  })

  it('escreve a contagem em pt-BR e deixa sem número a aba que não tem', () => {
    const html = render('a')
    expect(html).toContain('Categorias<span class="font-mono">1.234</span>')
    expect(html).toMatch(/>OS<\/button>/)
  })

  it('a aba não escolhida continua montada, escondida', () => {
    const html = render('b')
    expect(html).toMatch(/hidden="" id="teste-a-painel"/)
    expect(html).toContain('conteúdo A')
    expect(html).not.toMatch(/hidden="" id="teste-b-painel"/)
    // O gancho do tema escuro, que pinta a aba ativa de verde.
    expect(html).toContain('impacto-tabs')
  })
})
