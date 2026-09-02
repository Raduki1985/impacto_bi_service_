import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CommercialCity, CommercialSeller } from '../../../data/commercialTypes'
import { OverviewFilters } from './OverviewFilters'
import {
  initialCommercialOverviewFilters,
  type CommercialOverviewFilters,
} from './overviewModel'

const cities: readonly CommercialCity[] = [
  { id: 'atibaia', name: 'Atibaia' },
  { id: 'piracaia', name: 'Piracaia' },
]

const sellers: readonly CommercialSeller[] = [
  { id: 'vnd-01', name: 'Ana Paula', cityId: 'atibaia', segment: 'interno', active: true },
]

function render(
  input: Partial<CommercialOverviewFilters> = {},
  props: { defaultExpanded?: boolean; sellers?: readonly CommercialSeller[] } = {},
) {
  return renderToStaticMarkup(
    <OverviewFilters
      cities={cities}
      defaultExpanded={props.defaultExpanded}
      filters={{ ...initialCommercialOverviewFilters(), ...input }}
      onChange={() => {}}
      sellers={props.sellers ?? sellers}
    />,
  )
}

describe('estado recolhido', () => {
  it('inicia recolhido, resumindo o período padrão da base comercial', () => {
    const html = render()

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('hidden=""')
    expect(html).toContain('Filtros da análise')
    expect(html).toContain('01/07/2026 a 31/07/2026')
  })

  it('no padrão não há chip nem Limpar filtros, e Expandir filtros está presente', () => {
    const html = render()

    expect(html).not.toContain('commercial-filter-chip')
    expect(html).not.toContain('Limpar filtros')
    expect(html).toContain('Expandir filtros')
  })

  it('não existe contagem de filtros ativos em nenhum estado', () => {
    for (const html of [render(), render({ team: 'comercial' }, { defaultExpanded: true })]) {
      expect(html).not.toContain('filtro ativo')
      expect(html).not.toContain('filtros ativos')
    }
  })
})

describe('integração à faixa fixa da página', () => {
  it('sem moldura de card própria: superfície e borda externa vêm da faixa', () => {
    for (const html of [render(), render({}, { defaultExpanded: true })]) {
      expect(html).not.toContain('rounded-xl')
      expect(html).not.toContain('shadow')
      // O respiro horizontal alinha ao conteúdo do `main` (26px).
      expect(html).toContain('px-[26px]')
    }
  })

  it('a área expandida só rola internamente em viewport de pouca altura', () => {
    const html = render({}, { defaultExpanded: true })

    expect(html).toContain('max-h-[45vh]')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('overflow-x-hidden')
    expect(html).not.toContain('overflow-x-auto')
  })
})

describe('estado expandido', () => {
  const html = render({}, { defaultExpanded: true })

  it('oferece os cinco filtros em dois grupos de negócio', () => {
    expect((html.match(/<fieldset/g) ?? []).length).toBe(2)
    expect((html.match(/type="date"/g) ?? []).length).toBe(2)
    expect((html.match(/<select/g) ?? []).length).toBe(3)

    const labels = ['Início', 'Fim', 'Cidade', 'Time', 'Vendedor']
    const positions = labels.map((label) => html.indexOf(`>${label}</span>`))
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('prende os calendários à cobertura da base e mantém o intervalo ordenado', () => {
    // Início: mínimo da base e máximo no Fim selecionado; Fim: espelho.
    expect(html).toContain('min="2026-01-01"')
    expect(html).toContain('max="2026-07-31"')
    expect(html).toContain('min="2026-07-01"')
    expect((html.match(/required=""/g) ?? []).length).toBe(2)
  })

  it('publica as cidades e os vendedores recebidos, com o valor neutro na frente', () => {
    expect(html.indexOf('>Todas as cidades</option>')).toBeLessThan(
      html.indexOf('>Atibaia</option>'),
    )
    expect(html).toContain('>Piracaia</option>')
    expect(html).toContain('>Ana Paula</option>')
  })

  it('sem vendedor na lista o seletor fica desabilitado, com o motivo no título', () => {
    const semVendedores = render({}, { defaultExpanded: true, sellers: [] })

    expect(semVendedores).toContain('disabled=""')
    expect(semVendedores).toContain('O serviço de BI ainda não filtra a Visão Geral por vendedor.')
  })
})

describe('filtros diferentes do padrão', () => {
  it('identifica os filtros direto nos chips, com nome e valor legíveis', () => {
    const html = render({ cityId: 'atibaia', team: 'corporativo', sellerId: 'vnd-01' })

    expect(html).toContain('Cidade: Atibaia')
    expect(html).toContain('Time: Corporativo')
    expect(html).toContain('Vendedor: Ana Paula')
    expect(html).toContain('Limpar filtros')
  })

  it('mostra os mesmos chips com o painel recolhido e expandido', () => {
    for (const html of [
      render({ cityId: 'piracaia' }),
      render({ cityId: 'piracaia' }, { defaultExpanded: true }),
    ]) {
      expect(html).toContain('Cidade: Piracaia')
    }
  })

  it('renderiza um único Limpar filtros por estado, antes de Expandir/Recolher', () => {
    const recolhido = render({ team: 'comercial' })
    const expandido = render({ team: 'comercial' }, { defaultExpanded: true })

    expect((recolhido.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect((expandido.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect(recolhido.indexOf('Limpar filtros')).toBeLessThan(recolhido.indexOf('Expandir filtros'))
    expect(expandido.indexOf('Limpar filtros')).toBeLessThan(expandido.indexOf('Recolher filtros'))
  })

  it('período alterado atualiza o resumo e oferece Limpar, sem chip redundante', () => {
    const html = render({ startDate: '2026-07-05' })

    expect(html).toContain('05/07/2026 a 31/07/2026')
    expect(html).toContain('Limpar filtros')
    expect(html).not.toContain('commercial-filter-chip')
    expect(html).not.toContain('Início:')
    expect(html).not.toContain('Fim:')
  })

  it('id sem correspondência na lista ainda aparece como filtro aplicado', () => {
    const html = render({ sellerId: 'vnd-99' })

    expect(html).toContain('Vendedor: vnd-99')
  })
})

describe('legibilidade no tema escuro', () => {
  it('publica os ganchos escopados que o tema escuro estiliza', () => {
    const html = render({ team: 'comercial' }, { defaultExpanded: true })

    expect(html).toContain('commercial-overview-filters')
    expect(html).toContain('commercial-filter-chip')
    expect((html.match(/commercial-filter-action/g) ?? []).length).toBe(2)
  })
})
