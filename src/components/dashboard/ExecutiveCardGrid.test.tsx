import { ClipboardList, Target } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../contexts/PreferencesContext'
import { ExecutiveCardGrid, type ExecutiveGridCard } from './ExecutiveCardGrid'

/**
 * Teste espelho da grade de cards executivos.
 *
 * O que ele protege: a grade desenha um card por item, todos fechados ao
 * abrir (a regra "um aberto por vez" começa sem nenhum), com o nome acessível
 * da coleção e as colunas que a página escolheu.
 */
const cards: ExecutiveGridCard[] = [
  {
    id: 'total',
    accessibleText: 'Total de OS: 1.248.',
    icon: ClipboardList,
    label: 'Total de OS',
    readingText: 'O total do recorte foi {1.248}.',
    readingTitle: '1.248 OS no período.',
    tone: 'blue',
    value: '1.248',
    variant: 'spark',
  },
  {
    id: 'rate',
    accessibleText: 'Taxa de Conclusão: 81,3%.',
    definition: 'Percentual das OS de cliente concluídas.',
    icon: Target,
    label: 'Taxa de Conclusão',
    readingText: 'Quatro em cada cinco visitas {entregaram}.',
    readingTitle: '81,3% das OS de cliente concluídas.',
    tone: 'indigo',
    value: '81,3%',
    variant: 'spark',
  },
]

function render(props: Partial<Parameters<typeof ExecutiveCardGrid>[0]> = {}) {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <ExecutiveCardGrid ariaLabel="Indicadores de teste" cards={cards} {...props} />
    </PreferencesProvider>,
  )
}

describe('grade de cards executivos', () => {
  it('desenha um card fechado por item, na coleção nomeada', () => {
    const html = render()

    expect(html).toContain('aria-label="Indicadores de teste"')
    expect((html.match(/<article[^>]*aria-expanded="false"/g) ?? []).length).toBe(2)
    expect(html).not.toContain('aria-expanded="true"')
    expect(html.indexOf('Total de OS')).toBeLessThan(html.indexOf('Taxa de Conclusão'))
    expect(html).toContain('Percentual das OS de cliente concluídas.')
  })

  it('as colunas são as da página, com o padrão das páginas de OS', () => {
    expect(render()).toContain('grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4')
    expect(render({ columnsClass: 'sm:grid-cols-2 xl:grid-cols-5', className: 'mb-4' })).toContain(
      'grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5 mb-4',
    )
  })

  it('cada card leva a superfície executiva, sem escopo da página', () => {
    expect((render().match(/<article[^>]*executive-panel/g) ?? []).length).toBe(2)
  })

  it('card marcado como carregando sai em cinza na vaga dele, sem clique, e se anuncia', () => {
    // 15/10/2026: o card dos 90 dias do Comercial espera a leitura do
    // histórico enquanto os vizinhos já mostram os números.
    const html = render({
      cards: [cards[0], { ...cards[1], accessibleText: 'Taxa de Conclusão: calculando.', loading: true }],
    })

    expect((html.match(/<article[^>]*aria-expanded="false"/g) ?? []).length).toBe(1)
    expect(html).toContain('data-skeleton="card"')
    expect(html).toContain('<span class="sr-only">Taxa de Conclusão: calculando.</span>')
    expect(html).not.toContain('81,3%')
    expect(html.indexOf('Total de OS')).toBeLessThan(html.indexOf('data-skeleton="card"'))
  })
})
