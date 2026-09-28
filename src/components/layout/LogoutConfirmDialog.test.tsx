import * as Dialog from '@radix-ui/react-dialog'
import {renderToStaticMarkup} from 'react-dom/server'
import {describe, expect, it} from 'vitest'

import {LogoutConfirmBody} from './LogoutConfirmDialog'

/**
 * Teste espelho da confirmação do Sair.
 *
 * A casca da janela usa portal, que só existe no navegador; o corpo é o que dá
 * para desenhar aqui, dentro do contexto do `Dialog.Root`, que é o que o
 * título e a descrição exigem. Ficam de fora, por isso, o papel
 * `alertdialog`, a recusa do clique fora e a prisão do foco — eles moram na
 * casca.
 *
 * O que ele protege: a janela PERGUNTA antes de encerrar, diz o custo de
 * confirmar, e oferece a saída de emergência primeiro.
 */
describe('confirmação de encerrar a sessão', () => {
    const html = renderToStaticMarkup(
        <Dialog.Root open>
            <LogoutConfirmBody onConfirm={() => undefined}/>
        </Dialog.Root>,
    )

    it('pergunta, em vez de encerrar', () => {
        expect(html).toContain('Encerrar sessão?')
    })

    /**
     * A descrição vira o `aria-describedby` da janela e é lida junto com o
     * título: é ali que a pergunta precisa estar, e não em um parágrafo que o
     * leitor de tela só alcançaria depois.
     */
    it('põe a pergunta na descrição, que é lida junto com o título', () => {
        expect(html).toContain('Deseja prosseguir com o encerramento da sessão?')
    })

    /**
     * O Cancelar vem PRIMEIRO na ordem de leitura, e é isso que faz o foco
     * nascer nele: quem abriu a janela sem querer sai dela com um Enter, sem
     * encerrar sessão nenhuma.
     */
    it('oferece o Cancelar antes da confirmação', () => {
        expect(html).toContain('Cancelar')
        expect(html).toContain('Encerrar sessão<')
        expect(html.indexOf('Cancelar')).toBeLessThan(html.indexOf('Encerrar sessão<'))
    })

    /** Dentro de uma janela, um botão sem `type` submeteria qualquer formulário. */
    it('não tem botão de submissão', () => {
        expect(html).not.toContain('type="submit"')
        expect(html.match(/<button/g)).toHaveLength(2)
    })
})
