import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'

import {LogoutSuccessToast} from './LogoutSuccessToast'

/**
 * Teste espelho do aviso de sessão encerrada.
 *
 * O que ele protege: a saída é confirmada em palavras — sem o aviso, a tela de
 * login de quem acabou de sair é idêntica à de quem nunca entrou —, o aviso é
 * anunciado como estado e não como alerta, tem um Fechar de verdade e carrega
 * o gancho `session-toast`, de onde saem o verde medido dos dois temas e a
 * animação de entrada.
 *
 * O nome de quem saiu NÃO aparece, e isso é regra, não esquecimento: a conta
 * anterior deixou de ser o assunto, e escrevê-la na tela de login entregaria a
 * um navegador compartilhado o nome de quem acabou de sair.
 *
 * O tempo de tela não é conferido aqui: ele vive em um efeito, e
 * `renderToStaticMarkup` não roda efeito nenhum.
 */
describe('aviso de sessão encerrada', () => {
    const html = renderToStaticMarkup(<LogoutSuccessToast onDismiss={() => undefined}/>)

    it('confirma que a sessão acabou e diz como voltar', () => {
        expect(html).toContain('Sessão encerrada com sucesso')
        expect(html).toContain('Entre de novo para voltar ao portal.')
    })

    it('é anunciado como estado, e não como interrupção', () => {
        expect(html).toContain('role="status"')
        expect(html).toContain('aria-live="polite"')
        expect(html).not.toContain('role="alert"')
    })

    it('pode ser fechado antes do tempo', () => {
        expect(html).toContain('aria-label="Fechar aviso"')
    })

    it('carrega o gancho do visual dos dois temas', () => {
        expect(html).toContain('session-toast')
        expect(html).toContain('var(--session-toast-accent)')
    })

    it('não rouba o clique da tela que está atrás', () => {
        expect(html).toContain('pointer-events-none')
        expect(html).toContain('pointer-events-auto')
    })
})
