import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button } from './button'

/**
 * Teste espelho do botão em gravação.
 *
 * O que ele protege: enquanto a chamada ao serviço está no ar, o botão PROVA
 * que algo está acontecendo, recusa o segundo clique e conta a mesma coisa a
 * quem usa leitor de tela. Sem isso a tela fica idêntica à de antes do clique,
 * e quem salvou tenta de novo — o que criaria o registro duas vezes.
 */
describe('botão com gravação em andamento', () => {
  const emGravacao = renderToStaticMarkup(<Button loading>Salvando...</Button>)
  const parado = renderToStaticMarkup(<Button>Salvar usuário</Button>)

  it('mostra o giro enquanto grava', () => {
    expect(emGravacao).toContain('animate-spin')
  })

  it('não mostra giro nenhum fora da gravação', () => {
    expect(parado).not.toContain('animate-spin')
  })

  /** O segundo clique gravaria o mesmo registro de novo. */
  it('recusa o segundo clique', () => {
    expect(emGravacao).toContain('disabled')
  })

  it('anuncia a espera a quem usa leitor de tela', () => {
    expect(emGravacao).toContain('aria-busy="true"')
    expect(parado).not.toContain('aria-busy')
  })

  /**
   * O esmaecimento de 50% do desabilitado comum apagaria justamente o giro. O
   * botão está trabalhando, e não indisponível.
   */
  it('não esmaece como um botão indisponível', () => {
    expect(emGravacao).toContain('disabled:opacity-100')
    expect(emGravacao).not.toContain('disabled:opacity-50')
  })

  /** `loading` some com `asChild`: o Slot do Radix aceita um filho só. */
  it('não acrescenta o giro quando o botão empresta o estilo a outro elemento', () => {
    const emprestado = renderToStaticMarkup(
      <Button asChild loading>
        <a href="/x">Abrir</a>
      </Button>,
    )

    expect(emprestado).not.toContain('animate-spin')
    expect(emprestado).toContain('Abrir')
  })
})
