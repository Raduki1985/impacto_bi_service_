import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OverviewOsProvider } from '../../contexts/OverviewOsContext'
import {
  OverviewOsContext,
  type OverviewOsContextValue,
} from '../../contexts/OverviewOsContextCore'
import { buildOverviewOsData } from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_DATE_RANGE, OVERVIEW_OS_RECORDS } from '../../data/overviewOsData'
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
function contextValue(
  input: Partial<OverviewOsFilters>,
  technicians: readonly { id: string; name: string }[] = [],
): OverviewOsContextValue {
  const { filters, options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, {
    ...defaultOverviewOsFilters,
    ...input,
  })

  return {
    filters,
    options,
    filteredRecords: applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters),
    data: buildOverviewOsData(OVERVIEW_OS_RECORDS, filters),
    coverage: OVERVIEW_OS_DATE_RANGE,
    origin: 'local',
    status: 'ready',
    errorMessage: null,
    updatedAt: null,
    technicians,
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

  it('oferece os oito filtros, com Técnico depois de Equipe e sem Resolução', () => {
    expect((html.match(/<fieldset/g) ?? []).length).toBe(3)
    expect((html.match(/type="date"/g) ?? []).length).toBe(2)
    expect((html.match(/<select/g) ?? []).length).toBe(6)
    expect(html).not.toContain('>Resolução</span>')

    const labels = [
      'Início',
      'Fim',
      'Equipe',
      'Técnico',
      'Tipo de OS',
      'Categoria',
      'Cidade',
      'Status',
    ]
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

describe('filtros dependentes', () => {
  it('com Câmeras selecionada, Categoria oferece só as categorias da equipe', () => {
    const html = renderWithFilters({ team: 'Câmeras' }, { defaultExpanded: true })

    expect(html).not.toContain('>REPARO DE CTO</option>')
    expect(html).toContain('>instalação de 2 câmeras</option>')
  })

  it('com um tipo selecionado, Categoria oferece só as subdivisões dele', () => {
    const html = renderWithFilters({ serviceType: 'Infraestrutura' }, { defaultExpanded: true })

    expect(html).toContain('>REPARO DE CTO</option>')
    expect(html).not.toContain('>fibra instalação</option>')
  })

  it('só desabilita o seletor de Técnico, que depende do catálogo do serviço', () => {
    const html = renderWithFilters({ status: 'Expirada' }, { defaultExpanded: true })

    // Um único seletor desabilitado, o de Técnico, e ele diz o motivo. Os
    // demais campos sempre têm ao menos o valor neutro.
    expect((html.match(/disabled=""/g) ?? []).length).toBe(1)
    expect(html).toContain('Disponível quando o serviço enviar a lista de técnicos.')
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
    // A cadeia do provider reseta a categoria incompatível com Câmeras; o
    // painel nunca exibe um filtro que não está de fato aplicado.
    const html = renderWithFilters({
      team: 'Câmeras',
      category: 'REPARO DE CTO',
    })

    expect(html).toContain('Equipe: Câmeras')
    expect(html).not.toContain('Categoria: REPARO DE CTO')
  })

  it('a categoria aplicada aparece como chip, com o nome do filtro', () => {
    const html = renderWithFilters({ category: 'fibra instalação' })

    expect(html).toContain('Categoria: fibra instalação')
    expect(html).toContain(`>${formatNumber(562)}</b>`)
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

/**
 * Filtro de técnico.
 *
 * Ele é o único que depende de um catálogo do serviço: a OS carrega o
 * identificador, e o nome vem à parte. Sem catálogo o seletor fica
 * desabilitado, e com catálogo ele lista nomes, nunca identificadores.
 */
describe('filtro de técnico', () => {
  /** Dois técnicos reais do recorte padrão, com nome de mentira só para o teste. */
  const técnicos = [...new Set(OVERVIEW_OS_RECORDS.map((record) => record.technicianId))]
    .filter((id): id is string => id !== null)
    .slice(0, 2)
    .map((id, index) => ({ id, name: `Técnico de teste ${index + 1}` }))

  function renderComCatálogo(input: Partial<OverviewOsFilters> = {}) {
    return renderToStaticMarkup(
      <OverviewOsContext.Provider value={contextValue(input, técnicos)}>
        <OverviewFilterPanel defaultExpanded />
      </OverviewOsContext.Provider>,
    )
  }

  it('desabilita o seletor e explica quando o serviço não manda o catálogo', () => {
    const html = renderWithFilters({}, { defaultExpanded: true })

    expect(html).toContain('>Técnico</span>')
    expect(html).toContain('Disponível quando o serviço enviar a lista de técnicos.')
    expect((html.match(/disabled=""/g) ?? []).length).toBe(1)
  })

  it('lista nomes, e não identificadores, quando o catálogo chega', () => {
    const html = renderComCatálogo()

    expect(html).toContain('>Técnico de teste 1</option>')
    expect(html).not.toContain(`>${técnicos[0].id}</option>`)
    // Com catálogo, nenhum seletor da página fica desabilitado.
    expect(html).not.toContain('disabled=""')
    expect(html).not.toContain('Disponível quando o serviço enviar a lista de técnicos.')
  })

  it('guarda o identificador no valor da opção, que é o que a OS carrega', () => {
    const html = renderComCatálogo()

    expect(html).toContain(`value="${técnicos[0].id}"`)
  })

  it('mostra o nome do técnico no chip do filtro ativo', () => {
    const html = renderComCatálogo({ technicianId: técnicos[0].id })

    expect(html).toContain('Técnico: Técnico de teste 1')
    expect(html).not.toContain(`Técnico: ${técnicos[0].id}`)
  })
})
