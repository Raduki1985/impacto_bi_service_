import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ListDialogHeader } from './ListDialog'

/**
 * Teste espelho do cabeçalho da janela de lista.
 *
 * A casca da janela usa portal, que só existe no navegador; o cabeçalho é o
 * que dá para desenhar aqui, dentro do contexto do `Dialog.Root`, que é o
 * que o título e o Fechar exigem. O que ele protege: a janela diz de onde
 * veio e de que recorte, tem o Fechar, e aceita os atalhos da página.
 */
describe('cabeçalho da janela de lista', () => {
  it('escreve o título, a linha de contexto e o Fechar, com os atalhos da página depois', () => {
    const html = renderToStaticMarkup(
      <Dialog.Root open>
        <ListDialogHeader
          description="Setembro de 2026, até o dia 23 · sem outros filtros"
          title="Motivos de improdutiva"
        >
          <span>atalhos</span>
        </ListDialogHeader>
      </Dialog.Root>,
    )

    expect(html).toContain('Motivos de improdutiva')
    expect(html).toContain('Setembro de 2026, até o dia 23 · sem outros filtros')
    expect(html).toContain('Fechar')
    expect(html.indexOf('Fechar')).toBeLessThan(html.indexOf('atalhos'))
  })
})
