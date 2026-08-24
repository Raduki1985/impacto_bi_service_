import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OverviewOsProvider } from '../../contexts/OverviewOsContext'
import {
  OverviewOsContext,
  type OverviewOsContextValue,
} from '../../contexts/OverviewOsContextCore'
import { buildOverviewOsData } from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_RECORDS } from '../../data/overviewOsData'
import {
  applyOverviewOsFilters,
  defaultOverviewOsFilters,
  resolveOverviewOsFilters,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { formatNumber } from '../../lib/formatters'
import { OverviewFilterPanel } from './OverviewFilterPanel'

/**
 * O provider real abre no estado padrão, então os cenários com filtros
 * alterados montam o valor de contexto pela MESMA cadeia de funções dele:
 * resolve (saneamento + opções dependentes), apply e build. Assim o painel é
 * comprovadamente alimentado pelos registros reais da fonte sanitizada.
 */
function contextValue(input: Partial<OverviewOsFilters>): OverviewOsContextValue {
  const { filters, options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, {
    ...defaultOverviewOsFilters,
    ...input,
  })

  return {
    filters,
    options,
    filteredRecords: applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters),
    data: buildOverviewOsData(OVERVIEW_OS_RECORDS, filters),
    setFilter: () => {},
    resetFilters: () => {},
  }
}

function renderWithFilters(
  input: Partial<OverviewOsFilters>,
  props: { defaultExpanded?: boolean } = {},
) {
  return renderToStaticMarkup(
    <OverviewOsContext.Provider value={contextValue(input)}>
      <OverviewFilterPanel {...props} />
    </OverviewOsContext.Provider>,
  )
}

/** Estado padrão pelo provider real, como na página. */
function renderDefault(props: { defaultExpanded?: boolean } = {}) {
  return renderToStaticMarkup(
    <OverviewOsProvider>
      <OverviewFilterPanel {...props} />
    </OverviewOsProvider>,
  )
}

describe('estado recolhido', () => {
  it('inicia recolhido, resumindo o mês mais recente da base real', () => {
    const html = renderDefault()

    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('hidden=""')
    expect(html).toContain('Filtros da análise')
    expect(html).toContain('01/08/2026 a 21/08/2026')
    expect(html).toContain(`>${formatNumber(1248)}</b>`)
  })

  it('no padrão não há chip nem Limpar filtros, e Expandir filtros está presente', () => {
    const html = renderDefault()

    expect(html).not.toContain('os-filter-chip')
    expect(html).not.toContain('Limpar filtros')
    expect(html).toContain('Expandir filtros')
  })

  it('não existe contagem de filtros ativos em nenhum estado', () => {
    for (const html of [
      renderDefault(),
      renderDefault({ defaultExpanded: true }),
      renderWithFilters({ team: 'Infra', city: 'Atibaia' }),
      renderWithFilters({ team: 'Infra' }, { defaultExpanded: true }),
    ]) {
      expect(html).not.toContain('filtro ativo')
      expect(html).not.toContain('filtros ativos')
    }
  })

  it('não usa rolagem horizontal em nenhum contêiner', () => {
    for (const html of [renderDefault(), renderDefault({ defaultExpanded: true })]) {
      expect(html).not.toContain('overflow-x-auto')
    }
  })
})

describe('integração à faixa fixa da página', () => {
  it('sem moldura de card própria: superfície e borda externa vêm da faixa', () => {
    for (const html of [renderDefault(), renderDefault({ defaultExpanded: true })]) {
      expect(html).not.toContain('rounded-xl')
      expect(html).not.toContain('shadow')
      // O respiro horizontal alinha ao conteúdo do `main` (26px).
      expect(html).toContain('px-[26px]')
    }
  })

  it('a área expandida só rola internamente em viewport de pouca altura', () => {
    const html = renderDefault({ defaultExpanded: true })

    // Em alturas comuns de desktop os controles ficam bem abaixo de 45vh e
    // nenhuma barra interna aparece; o eixo horizontal segue travado.
    expect(html).toContain('max-h-[45vh]')
    expect(html).toContain('overflow-y-auto')
    expect(html).toContain('overflow-x-hidden')
    expect(html).toContain('overscroll-contain')
  })
})

describe('estado expandido', () => {
  const html = renderDefault({ defaultExpanded: true })

  it('preserva os sete filtros aprovados, na ordem e nos grupos aprovados', () => {
    expect((html.match(/<fieldset/g) ?? []).length).toBe(3)
    expect((html.match(/type="date"/g) ?? []).length).toBe(2)
    expect((html.match(/<select/g) ?? []).length).toBe(5)

    const labels = ['Início', 'Fim', 'Equipe', 'Tipo de OS', 'Cidade', 'Status', 'Resolução']
    const positions = labels.map((label) => html.indexOf(`>${label}</span>`))
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('prende os calendários à cobertura real da fonte e mantém o intervalo ordenado', () => {
    // Início: mínimo da fonte e máximo no Fim selecionado; Fim: espelho.
    expect(html).toContain('min="2026-04-06"')
    expect(html).toContain('max="2026-08-21"')
    expect(html).toContain('max="2026-08-21"')
    expect(html).toContain('min="2026-08-01"')
    expect((html.match(/required=""/g) ?? []).length).toBe(2)
  })

  it('publica só opções existentes no contexto: sem Retirada, Retiradas ou legado', () => {
    expect(html).not.toContain('>Retiradas</option>')
    expect(html).not.toContain('>Retirada</option>')
    expect(html).not.toContain('>Customer (legado)</option>')
    expect(html).toContain('>Instalação de Câmera</option>')
    expect(html).toContain('>Cidade não informada</option>')
    // Suporte Lógico não tem OS no mês padrão: também fica fora.
    expect(html).not.toContain('>Suporte Lógico</option>')
  })

  it('com o período completo o tipo legado passa a ser opção', () => {
    const fullRange = renderWithFilters({ dateFrom: '2026-04-06' }, { defaultExpanded: true })

    expect(fullRange).toContain('>Customer (legado)</option>')
  })
})

describe('filtros dependentes e resolução sem opções', () => {
  it('com Câmeras selecionada não oferece Atenuação da Rede', () => {
    const html = renderWithFilters({ team: 'Câmeras' }, { defaultExpanded: true })

    expect(html).not.toContain('>Atenuação da Rede</option>')
    expect(html).toContain('>Todas as Câmeras Instaladas</option>')
  })

  it('desabilita a Resolução e explica quando o contexto não tem resoluções', () => {
    // Expiradas não têm resolução preenchida na base real.
    const html = renderWithFilters({ status: 'Expirada' }, { defaultExpanded: true })

    expect(html).toContain('disabled=""')
    expect(html).toContain('Sem resoluções disponíveis no contexto filtrado.')
    expect(html).toMatch(/<select aria-describedby="[^"]+" [^>]*disabled=""/)
  })

  it('no padrão a Resolução fica habilitada e sem aviso', () => {
    const html = renderDefault({ defaultExpanded: true })

    expect(html).not.toContain('disabled=""')
    expect(html).not.toContain('Sem resoluções disponíveis no contexto filtrado.')
  })
})

describe('filtros diferentes do padrão', () => {
  it('identifica os filtros direto nos chips, com nome e valor', () => {
    const html = renderWithFilters({ team: 'Infra', city: 'Atibaia' })

    expect(html).toContain('Equipe: Infra')
    expect(html).toContain('Cidade: Atibaia')
    expect(html).toContain('Limpar filtros')
  })

  it('mostra os mesmos chips no resumo com o painel recolhido e expandido', () => {
    for (const html of [
      renderWithFilters({ team: 'Infra', status: 'Concluída' }),
      renderWithFilters({ team: 'Infra', status: 'Concluída' }, { defaultExpanded: true }),
    ]) {
      expect(html).toContain('Equipe: Infra')
      expect(html).toContain('Status: Concluída')
    }
  })

  it('não recria a antiga segunda linha exclusiva de chips quando recolhido', () => {
    // Os chips vivem no próprio resumo: com filtros ativos e painel recolhido,
    // a única divisória interna que existe é a da área expandida oculta. O
    // espaço no padrão evita casar com o `border-transparent` dos chips.
    const html = renderWithFilters({ team: 'Infra', city: 'Atibaia' })

    expect((html.match(/border-t /g) ?? []).length).toBe(1)
  })

  it('renderiza um único Limpar filtros por estado, antes de Expandir/Recolher', () => {
    const collapsed = renderWithFilters({ team: 'Infra' })
    const expanded = renderWithFilters({ team: 'Infra' }, { defaultExpanded: true })

    expect((collapsed.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect((expanded.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect(collapsed.indexOf('Limpar filtros')).toBeLessThan(collapsed.indexOf('Expandir filtros'))
    expect(expanded.indexOf('Limpar filtros')).toBeLessThan(expanded.indexOf('Recolher filtros'))
  })

  it('período alterado atualiza o resumo e oferece Limpar, sem chip redundante', () => {
    const html = renderWithFilters({ dateFrom: '2026-08-05' })

    expect(html).toContain('05/08/2026 a 21/08/2026')
    expect(html).toContain('Limpar filtros')
    expect(html).not.toContain('os-filter-chip')
    expect(html).not.toContain('Início:')
    expect(html).not.toContain('Fim:')
  })

  it('atualiza a quantidade de OS para o recorte filtrado real', () => {
    const expected = applyOverviewOsFilters(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      team: 'Câmeras',
    }).length

    expect(expected).toBe(298)
    expect(renderWithFilters({ team: 'Câmeras' })).toContain(`>${formatNumber(expected)}</b>`)
  })

  it('uma seleção incompatível chega saneada ao painel, sem valor escondido', () => {
    // A cadeia do provider reseta a resolução incompatível com Câmeras; o
    // painel nunca exibe um filtro que não está de fato aplicado.
    const html = renderWithFilters({
      team: 'Câmeras',
      resolution: 'Instalação + Segundo Ponto Executado',
    })

    expect(html).toContain('Equipe: Câmeras')
    expect(html).not.toContain('Resolução: Instalação + Segundo Ponto Executado')
  })
})

describe('legibilidade no tema escuro', () => {
  it('publica os ganchos escopados que o tema escuro estiliza', () => {
    const html = renderWithFilters({ team: 'Infra' }, { defaultExpanded: true })

    // A seção escopa as regras de `styles.css`; chips e ações carregam as
    // classes que trocam para o azul claro no escuro, sem tocar outras telas.
    expect(html).toContain('os-overview-filters')
    expect(html).toContain('os-filter-chip')
    expect((html.match(/os-filter-action/g) ?? []).length).toBe(2)
  })
})
