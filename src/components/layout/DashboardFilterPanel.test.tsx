import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DashboardDataProvider } from '../../contexts/DashboardDataContext'
import {
  DashboardDataContext,
  type DashboardDataContextValue,
} from '../../contexts/DashboardDataContextCore'
import { buildDashboardData } from '../../data/dashboardAggregates'
import {
  applyDashboardFilters,
  applyPreviousPeriodFilters,
  buildFilterOptions,
  defaultDashboardFilters,
  type DashboardFilters,
} from '../../data/dashboardFilters'
import { orders } from '../../data/mockOsData'
import { formatNumber } from '../../lib/formatters'
import { DashboardFilterPanel } from './DashboardFilterPanel'

/**
 * O provider real só abre no estado padrão, então os cenários com filtros
 * alterados montam o mesmo valor de contexto pela MESMA cadeia de funções do
 * provider: applyDashboardFilters sobre as ordens mockadas. Assim a quantidade
 * de OS exibida é comprovadamente `filteredRows.length` do recorte.
 */
function contextValue(filters: DashboardFilters): DashboardDataContextValue {
  const filteredRows = applyDashboardFilters(orders, filters)
  const previousRows = applyPreviousPeriodFilters(orders, filters)

  return {
    data: buildDashboardData(filteredRows, { previousRows }),
    filters,
    options: buildFilterOptions(),
    rows: orders,
    filteredRows,
    loading: false,
    setFilter: () => {},
    resetFilters: () => {},
  }
}

function renderWithFilters(
  overrides: Partial<DashboardFilters>,
  props: { defaultExpanded?: boolean } = {},
) {
  return renderToStaticMarkup(
    <DashboardDataContext.Provider value={contextValue({ ...defaultDashboardFilters, ...overrides })}>
      <DashboardFilterPanel {...props} />
    </DashboardDataContext.Provider>,
  )
}

/** Estado padrão pelo provider real, como nas páginas. */
function renderDefault(props: { defaultExpanded?: boolean } = {}) {
  return renderToStaticMarkup(
    <DashboardDataProvider>
      <DashboardFilterPanel {...props} />
    </DashboardDataProvider>,
  )
}

const defaultCount = applyDashboardFilters(orders, defaultDashboardFilters).length

describe('estado recolhido', () => {
  it('inicia recolhido, com aria-expanded falso e a área expandida oculta', () => {
    const html = renderDefault()

    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('aria-expanded="true"')
    expect(html).toContain('hidden=""')
    expect(html).toContain('Expandir filtros')
  })

  it('o botão de expansão controla a área expandida por id', () => {
    const html = renderDefault()

    const controls = html.match(/aria-controls="([^"]+)"/)
    expect(controls).not.toBeNull()
    if (controls) expect(html).toContain(`id="${controls[1]}"`)
  })

  it('resume período legível e quantidade de OS de filteredRows.length', () => {
    const html = renderDefault()

    expect(html).toContain('Filtros da análise')
    expect(html).toContain('01/08/2026 a 21/08/2026')
    expect(html).toContain(`>${formatNumber(defaultCount)}</b>`)
  })

  it('no padrão não há chip, contagem de ativos nem Limpar filtros', () => {
    const html = renderDefault()

    expect(html).not.toContain('filtro ativo')
    expect(html).not.toContain('filtros ativos')
    expect(html).not.toContain('Limpar filtros')
    expect(html).not.toContain('Equipe:')
  })

  it('não usa rolagem horizontal em nenhum contêiner', () => {
    for (const html of [renderDefault(), renderDefault({ defaultExpanded: true })]) {
      expect(html).not.toContain('overflow-x-auto')
    }
  })
})

describe('estado expandido', () => {
  const html = renderDefault({ defaultExpanded: true })

  it('marca aria-expanded verdadeiro e revela a área controlada', () => {
    expect(html).toContain('aria-expanded="true"')
    expect(html).not.toContain('hidden=""')
    expect(html).toContain('Recolher filtros')
  })

  it('agrupa os sete filtros em Período, Operação e Resultado', () => {
    expect((html.match(/<fieldset/g) ?? []).length).toBe(3)

    const legends = ['Período', 'Operação', 'Resultado'].map((legend) => html.indexOf(legend))
    for (const position of legends) expect(position).toBeGreaterThan(-1)
    expect(legends).toEqual([...legends].sort((a, b) => a - b))
  })

  it('preserva os sete filtros aprovados, na ordem aprovada', () => {
    expect((html.match(/type="date"/g) ?? []).length).toBe(2)
    expect((html.match(/<select/g) ?? []).length).toBe(5)

    const labels = ['Início', 'Fim', 'Equipe', 'Tipo de OS', 'Cidade', 'Status', 'Resolução']
    const positions = labels.map((label) => html.indexOf(`>${label}</span>`))
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('mantém o intervalo obrigatório e ordenado nos calendários', () => {
    expect(html).toContain('max="2026-08-21"')
    expect(html).toContain('min="2026-08-01"')
    expect((html.match(/required=""/g) ?? []).length).toBe(2)
  })

  it('publica as opções dos catálogos normalizados', () => {
    expect(html).toContain('Infra')
    expect(html).toContain('Piracaia')
    expect(html).toContain('Instalação Realizada')
  })
})

describe('filtros diferentes do padrão', () => {
  it('gera contagem de ativos, chips informativos e Limpar filtros', () => {
    const html = renderWithFilters({ team: 'Infra', city: 'Atibaia' })

    expect(html).toContain('2 filtros ativos')
    expect(html).toContain('Equipe: Infra')
    expect(html).toContain('Cidade: Atibaia')
    expect(html).toContain('title="Equipe: Infra"')
    expect(html).toContain('Limpar filtros')
  })

  it('atualiza a quantidade de OS para o recorte filtrado', () => {
    const filters = { ...defaultDashboardFilters, team: 'Infra' as const }
    const expected = applyDashboardFilters(orders, filters).length

    expect(expected).toBeLessThan(defaultCount)
    expect(renderWithFilters({ team: 'Infra' })).toContain(`>${formatNumber(expected)}</b>`)
  })

  it('data alterada conta como ativo e muda o período, sem virar chip', () => {
    const html = renderWithFilters({ dateFrom: '2026-08-05' })

    expect(html).toContain('1 filtro ativo')
    expect(html).toContain('05/08/2026 a 21/08/2026')
    expect(html).toContain('Limpar filtros')
    expect(html).not.toContain('Início:')
  })

  it('o controle expandido reflete o valor aplicado do contexto', () => {
    const html = renderWithFilters({ team: 'Infra' }, { defaultExpanded: true })

    expect(html).toMatch(/<option[^>]*selected[^>]*>Infra<\/option>/)
  })
})
