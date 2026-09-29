import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { UpdateAvailableToast } from './UpdateAvailableToast'

/**
 * Teste espelho do aviso de versão nova.
 *
 * O que ele protege é o que separa este aviso do de sessão: ele diz QUAL
 * versão saiu, oferece a ação de atualizar e NÃO oferece um Fechar. O Fechar
 * de volta seria a maneira mais fácil de o aviso deixar de cumprir a função,
 * porque quem o dispensasse seguiria o dia no arquivo antigo sem saber.
 *
 * O recarregamento em si não é conferido aqui: ele vive em um clique, e
 * `renderToStaticMarkup` não liga ouvinte nenhum.
 */
describe('aviso de versão nova', () => {
  const html = renderToStaticMarkup(<UpdateAvailableToast version="0.2.0" />)

  it('diz qual versão está publicada', () => {
    expect(html).toContain('Nova versão disponível')
    expect(html).toContain('0.2.0')
  })

  it('oferece a ação de atualizar', () => {
    expect(html).toContain('Atualizar agora')
    expect(html).toContain('type="button"')
  })

  it('não oferece um Fechar', () => {
    // Sem saída pelo descarte: a única saída é recarregar.
    expect(html).not.toContain('Fechar aviso')
  })

  it('é anunciado como estado, e não como interrupção', () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('role="alert"')
  })

  it('carrega o gancho update-toast, de onde vem a animação de entrada', () => {
    expect(html).toContain('update-toast')
  })
})
