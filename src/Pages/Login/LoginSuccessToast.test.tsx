import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'

import {LoginSuccessToast} from './LoginSuccessToast'

/**
 * Teste espelho do aviso de entrada aceita.
 *
 * O que ele protege: o aviso confirma a entrada e diz em qual conta, é
 * anunciado como estado e não como alerta, tem um Fechar de verdade e carrega
 * o gancho `session-toast`, que é de onde saem o verde medido dos dois temas e a
 * animação de entrada.
 *
 * O tempo de tela não é conferido aqui: ele vive em um efeito, e
 * `renderToStaticMarkup` não roda efeito nenhum.
 */
describe('aviso de login realizado', () => {
    const html = renderToStaticMarkup(
        <LoginSuccessToast onDismiss={() => undefined} userName="Mário Sasaki"/>,
    )

    it('confirma a entrada e diz em qual conta', () => {
        expect(html).toContain('Login realizado com sucesso')
        expect(html).toContain('Você entrou como Mário Sasaki.')
    })

    it('é anunciado como estado, e não como interrupção', () => {
        expect(html).toContain('role="status"')
        expect(html).toContain('aria-live="polite"')
        expect(html).not.toContain('role="alert"')
    })

    it('pode ser fechado antes do tempo', () => {
        expect(html).toContain('aria-label="Fechar aviso"')
    })

    /**
     * Sem a classe, o ícone perde a cor (a variável não existe fora dela) e o
     * aviso entra sem animação. As duas coisas vêm do bloco `session-toast` de
     * `src/styles.css`.
     */
    it('carrega o gancho do visual dos dois temas', () => {
        expect(html).toContain('session-toast')
        expect(html).toContain('var(--session-toast-accent)')
    })

    /**
     * A faixa cobre a largura da tela para posicionar o cartão, então ela NÃO
     * pode receber clique: o painel embaixo continua sendo usado com o aviso
     * ainda visível. Só o cartão volta a receber o ponteiro, por causa do
     * Fechar.
     */
    it('não rouba o clique do painel que está atrás', () => {
        expect(html).toContain('pointer-events-none')
        expect(html).toContain('pointer-events-auto')
    })
})
