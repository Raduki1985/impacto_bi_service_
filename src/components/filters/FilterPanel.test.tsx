import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FilterGroup } from './FilterGroup'
import { FilterPanel, type FilterPanelChip } from './FilterPanel'
import { FilterSelectField } from './FilterSelectField'
import { plainOptions } from './filterSelectOptions'

/**
 * Teste espelho da faixa de filtros do portal.
 *
 * O que ele protege é a promessa da faixa: resumo sempre visível com período
 * e chips, um "x" por chip, um único Limpar filtros antes de Expandir, a
 * área expandida presente no DOM mas oculta, e os ganchos que o tema escuro
 * pinta de verde.
 */

const chips: FilterPanelChip[] = [
  { key: 'team', label: 'Equipe', value: 'Infra', onRemove: () => {} },
  { key: 'city', label: 'Cidade', value: 'Atibaia', onRemove: () => {} },
]

function render(props: Partial<Parameters<typeof FilterPanel>[0]> = {}) {
  return renderToStaticMarkup(
    <FilterPanel period="01/09/2026 a 21/09/2026" {...props}>
      <FilterGroup legend="Operação" columnsClass="sm:grid-cols-2">
        <FilterSelectField
          label="Equipe"
          onChange={() => {}}
          options={plainOptions(['Todas', 'Infra', 'Câmeras'])}
          value="Todas"
        />
        <FilterSelectField
          disabled
          hint="Disponível quando o serviço enviar a lista de técnicos."
          label="Técnico"
          onChange={() => {}}
          options={plainOptions(['Todos'])}
          value="Todos"
        />
      </FilterGroup>
    </FilterPanel>,
  )
}

describe('resumo sempre visível', () => {
  it('abre recolhida, com o título padrão e o período por extenso', () => {
    const html = render()

    expect(html).toContain('Filtros da análise')
    expect(html).toContain('01/09/2026 a 21/09/2026')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('hidden=""')
    expect(html).toContain('Expandir filtros')
    expect(html).not.toContain('Limpar filtros')
    expect(html).not.toContain('impacto-chip')
  })

  it('identifica os filtros aplicados nos chips, cada um com o "x" que tira só ele', () => {
    const html = render({ chips, onClear: () => {} })

    expect(html).toContain('Equipe: Infra')
    expect(html).toContain('Cidade: Atibaia')
    expect(html).toContain('aria-label="Remover filtro Equipe: Infra"')
    expect(html).toContain('aria-label="Remover filtro Cidade: Atibaia"')
    expect((html.match(/impacto-chip-remove/g) ?? []).length).toBe(2)
    expect(html).not.toContain('filtros ativos')
  })

  it('mostra um único Limpar filtros, antes de Expandir, só quando a página o oferece', () => {
    const html = render({ onClear: () => {} })

    expect((html.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect(html.indexOf('Limpar filtros')).toBeLessThan(html.indexOf('Expandir filtros'))
  })

  it('aceita atalhos antes do período e um título próprio', () => {
    const html = render({ shortcuts: <span>atalhos</span>, title: 'Filtros das vendas' })

    expect(html).toContain('Filtros das vendas')
    expect(html.indexOf('atalhos')).toBeLessThan(html.indexOf('01/09/2026 a 21/09/2026'))
  })
})

describe('ação da página na linha do resumo', () => {
  it('aparece à direita, antes de Limpar filtros, só quando a página passa', () => {
    const html = render({ action: <button type="button">Mostrar valores</button>, onClear: () => {} })

    expect(html.indexOf('Mostrar valores')).toBeGreaterThan(-1)
    expect(html.indexOf('Mostrar valores')).toBeLessThan(html.indexOf('Limpar filtros'))
    expect(render()).not.toContain('Mostrar valores')
  })
})

describe('área expandida', () => {
  it('expandida, mostra os grupos e os campos, com o motivo do campo desabilitado', () => {
    const html = render({ defaultExpanded: true })

    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Recolher filtros')
    expect(html).toContain('<fieldset')
    expect(html).toContain('>Operação</legend>')
    expect(html).toContain('>Equipe</span>')
    expect(html).toContain('>Infra</option>')
    expect(html).toMatch(/<select[^>]*\sdisabled=""/)
    expect(html).toContain('Disponível quando o serviço enviar a lista de técnicos.')
  })

  it('só rola internamente em viewport de pouca altura, e nunca na horizontal', () => {
    const html = render({ defaultExpanded: true })

    expect(html).toContain('max-h-[45vh]')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('overflow-x-hidden')
    expect(html).not.toContain('overflow-x-auto')
  })
})

describe('integração à faixa fixa da página', () => {
  it('sem moldura própria: superfície e borda vêm da faixa, com o respiro do main', () => {
    const html = render()

    expect(html).not.toContain('rounded-xl')
    expect(html).not.toContain('shadow')
    expect(html).toContain('px-[26px]')
  })

  it('publica os ganchos que o tema escuro pinta de verde', () => {
    const html = render({ chips, onClear: () => {} })

    expect(html).toContain('impacto-filter-panel')
    expect(html).toContain('impacto-chip')
    expect((html.match(/impacto-text-action/g) ?? []).length).toBe(2)
  })
})
