import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  multiSelectRows,
  plainOptions,
  selectionChipValue,
  toggleMultiSelectValue,
} from './filterSelectOptions'
import { MultiSelectField } from './MultiSelectField'

/**
 * O campo é exercitado por renderização estática, como o resto da suíte: não
 * há ambiente de DOM para abrir a lista e clicar. O que se confere é o que o
 * campo escreve em cada estado, e as regras de marcar, buscar e resumir, que
 * moram em funções puras em `filterSelectOptions.ts`.
 */
const tipos = plainOptions(['Instalação', 'Infraestrutura', 'Manutenção', 'Auditoria'])

function render(props: Partial<Parameters<typeof MultiSelectField>[0]> = {}) {
  return renderToStaticMarkup(
    <MultiSelectField
      label="Tipo de OS"
      onChange={() => {}}
      options={tipos}
      placeholder="Todos"
      value={[]}
      {...props}
    />,
  )
}

describe('campo de escolha múltipla', () => {
  it('sem nada marcado, o campo escreve o neutro e a linha dele vem marcada', () => {
    const html = render()

    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*>.*<span aria-hidden="true" class="truncate">Todos<\/span>/)
    // O leitor de tela ouve o rótulo e o neutro.
    expect(html).toMatch(/<span class="sr-only"[^>]*>Todos<\/span>/)
    expect(html).toContain('aria-multiselectable="true"')
    expect(html).toMatch(/aria-selected="true"[^>]*>.*?Todos<\/span><\/div>/)
    expect(html).toContain('placeholder="Buscar..."')
  })

  it('com uma marcada, mostra a etiqueta dela, sem contador', () => {
    const html = render({ value: ['Manutenção'] })

    expect(html).toMatch(/<button[^>]*title="Manutenção"/)
    expect(html).toContain('>Manutenção</span>')
    expect(html).not.toMatch(/>\+\d+</)
  })

  it('com várias, mostra a primeira na ordem da lista e o "+N" das demais', () => {
    // A ordem da etiqueta é a da lista de opções, e não a do clique.
    const html = render({ value: ['Auditoria', 'Manutenção'] })

    expect(html).toMatch(/<button[^>]*title="Manutenção, Auditoria"/)
    expect(html).toContain('>+1</span>')
    // O "+1" é só visual: o leitor de tela ouve todas as marcadas por extenso,
    // pelo nome do botão (rótulo e resumo).
    expect(html).toMatch(/<span class="sr-only" id="([^"]+)">Manutenção, Auditoria<\/span>/)
    const summaryId = html.match(/<span class="sr-only" id="([^"]+)">/)?.[1]
    expect(html).toMatch(new RegExp(`aria-labelledby="[^"]+ ${summaryId}"`))
  })

  it('marca na lista todas as escolhidas, e não o neutro', () => {
    const html = render({ value: ['Manutenção', 'Auditoria'] })
    const selected = [...html.matchAll(/aria-selected="true"/g)]

    expect(selected).toHaveLength(2)
    expect(html).toMatch(/aria-selected="false"[^>]*>.*?Todos<\/span><\/div>/)
  })

  it('desabilitado, explica o motivo em texto logo abaixo', () => {
    const html = render({ disabled: true, hint: 'Disponível quando o serviço enviar a lista.', options: [] })

    expect(html).toMatch(/<button[^>]*disabled=""/)
    expect(html).toContain('Disponível quando o serviço enviar a lista.')
  })

  it('tem a mesma altura e largura dos seletores da faixa', () => {
    const html = render()

    expect(html).toContain('h-9 w-full min-w-0')
  })
})

describe('regras do campo de escolha múltipla', () => {
  it('clicar numa opção a marca ou desmarca, sem mexer nas outras', () => {
    expect(toggleMultiSelectValue([], 'Manutenção')).toEqual(['Manutenção'])
    expect(toggleMultiSelectValue(['Manutenção'], 'Auditoria')).toEqual(['Manutenção', 'Auditoria'])
    expect(toggleMultiSelectValue(['Manutenção', 'Auditoria'], 'Manutenção')).toEqual(['Auditoria'])
  })

  it('clicar no neutro desmarca tudo', () => {
    expect(toggleMultiSelectValue(['Manutenção', 'Auditoria'], null)).toEqual([])
  })

  it('a busca ignora acento e caixa, e tira o neutro da lista', () => {
    expect(multiSelectRows(tipos, 'Todos', '').map((row) => row.label)).toEqual([
      'Todos',
      'Instalação',
      'Infraestrutura',
      'Manutenção',
      'Auditoria',
    ])
    expect(multiSelectRows(tipos, 'Todos', 'MANUTENCAO').map((row) => row.label)).toEqual(['Manutenção'])
    expect(multiSelectRows(tipos, 'Todos', 'in').map((row) => row.label)).toEqual([
      'Instalação',
      'Infraestrutura',
    ])
    expect(multiSelectRows(tipos, 'Todos', 'xyz')).toEqual([])
  })

  it('o chip do resumo escreve até duas por extenso, e a partir de três abrevia', () => {
    expect(selectionChipValue(['Manutenção'])).toBe('Manutenção')
    expect(selectionChipValue(['Manutenção', 'Auditoria'])).toBe('Manutenção, Auditoria')
    expect(selectionChipValue(['Manutenção', 'Auditoria', 'Retirada'])).toBe('Manutenção +2')
  })
})
