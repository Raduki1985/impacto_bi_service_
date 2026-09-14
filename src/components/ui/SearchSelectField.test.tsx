import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SearchSelectField } from './SearchSelectField'

/**
 * O campo é exercitado por renderização estática, como o resto da suíte: não
 * há ambiente de DOM para digitar ou abrir a lista, então o que se confere é
 * o que o campo escreve na tela para cada estado, e a lista via `defaultOpen`.
 */
const vendedores = [
  { id: 'v-ana', name: 'Ana Maria dos Santos' },
  { id: 'v-camila', name: 'Camila Cardoso Magalhães' },
  { id: 'v-leticia', name: 'Letícia Castro de Oliveira' },
]

function render(props: Partial<Parameters<typeof SearchSelectField>[0]> = {}) {
  return renderToStaticMarkup(
    <SearchSelectField
      label="Vendedor"
      onChange={() => {}}
      options={vendedores}
      value={null}
      {...props}
    />,
  )
}

describe('campo de escolha com digitação', () => {
  it('é um campo de texto com o neutro como texto de campo vazio', () => {
    const html = render()

    expect(html).toContain('role="combobox"')
    expect(html).toContain('type="text"')
    expect(html).toContain('placeholder="Todos"')
    expect(html).toContain('value=""')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Abrir a lista de Vendedor"')
  })

  it('mostra o nome inteiro da opção escolhida no campo', () => {
    const html = render({ value: 'v-camila' })

    expect(html).toContain('value="Camila Cardoso Magalhães"')
    // A opção escolhida fica marcada na lista.
    expect(html).toMatch(/aria-selected="true"[^>]*>Camila Cardoso Magalhães</)
  })

  it('lista o neutro e depois as opções, na ordem recebida, com o neutro destacado', () => {
    const html = render({ defaultOpen: true })

    expect(html).toContain('role="listbox"')
    // Primeira linha é o valor neutro, como na lista dos seletores comuns; sem
    // escolha ela é a marcada e a destacada.
    expect(html).toMatch(/aria-selected="true"[^>]*data-active=""[^>]*>Todos</)
    expect(html.indexOf('>Todos</div>')).toBeLessThan(html.indexOf('>Ana Maria dos Santos</div>'))
    expect(html.indexOf('>Ana Maria dos Santos</div>')).toBeLessThan(
      html.indexOf('>Camila Cardoso Magalhães</div>'),
    )
    expect(html).toContain('aria-expanded="true"')
  })

  it('desabilitado, explica o motivo em texto logo abaixo', () => {
    const html = render({ disabled: true, hint: 'Sem lista de vendedores.', options: [] })

    expect(html).toContain('disabled=""')
    expect(html).toContain('Sem lista de vendedores.')
    // Sem opções a lista só tem o neutro; o aviso de "nenhum nome" é para a
    // digitação que não casa com ninguém.
    expect(html).toContain('>Todos</div>')
    expect(html).not.toContain('Nenhum nome com essas letras.')
  })

  it('a seta é a dos seletores da faixa: sem reação de cor nem de cursor ao mouse', () => {
    const html = render()

    expect(html).toMatch(/<button[^>]*aria-label="Abrir a lista de Vendedor"[^>]*cursor-default/)
    expect(html).not.toContain('cursor-pointer')
    expect(html).not.toContain('hover:')
  })

  it('aceita outro texto neutro', () => {
    expect(render({ placeholder: 'Qualquer um' })).toContain('placeholder="Qualquer um"')
  })

  it('escreve o neutro na cor do valor, e não no cinza de campo vazio', () => {
    // Em repouso o campo precisa ler igual aos seletores vizinhos da faixa.
    const html = render()

    expect(html).toContain('placeholder:text-[var(--text-item)]')
    expect(html).toContain('placeholder:opacity-100')
  })
})
