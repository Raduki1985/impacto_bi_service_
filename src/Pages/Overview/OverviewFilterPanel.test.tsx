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
  defaultOverviewOsFiltersFor,
  resolveOverviewOsFilters,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { OverviewFilterPanel } from './OverviewFilterPanel'

/**
 * Os botões de um mesmo dia nos calendários do painel, um por campo de data.
 * Serve para ler o que a cobertura fez com aquele dia em cada um deles.
 */
function diasDoCalendário(html: string, iso: string): string[] {
  return html.match(new RegExp(`<button[^>]*data-iso="${iso}"[^>]*>`, 'g')) ?? []
}

/**
 * O provider real abre no estado padrão, então os cenários com filtros
 * alterados montam o valor de contexto pela MESMA cadeia de funções dele:
 * resolve (saneamento + opções dependentes), apply e build. Assim o painel é
 * comprovadamente alimentado pelos registros reais da fonte sanitizada.
 */
function contextValue(
  input: Partial<OverviewOsFilters>,
  technicians: readonly { id: string; name: string }[] = [],
  coverage: OverviewOsCoverage = OVERVIEW_OS_DATE_RANGE,
): OverviewOsContextValue {
  const { filters, options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, {
    ...defaultOverviewOsFilters,
    ...input,
  })

  return {
    filters,
    options,
    records: OVERVIEW_OS_RECORDS,
    filteredRecords: applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters),
    data: buildOverviewOsData(OVERVIEW_OS_RECORDS, filters),
    coverage,
    origin: 'local',
    status: 'ready',
    errorMessage: null,
    updatedAt: null,
    generatedAt: null,
    technicians,
    setFilter: () => {},
    setPeriod: () => {},
    resetFilters: () => {},
  }
}

function renderWithFilters(
  input: Partial<OverviewOsFilters>,
  props: { defaultExpanded?: boolean; today?: string } = {},
  coverage?: OverviewOsCoverage,
) {
  return renderToStaticMarkup(
    <OverviewOsContext.Provider value={contextValue(input, [], coverage)}>
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
  })

  it('no padrão não há chip nem Limpar filtros, e Expandir filtros está presente', () => {
    const html = renderDefault()

    expect(html).not.toContain('os-filter-chip')
    expect(html).not.toContain('Limpar filtros')
    expect(html).toContain('Expandir filtros')
  })

  it('ligada ao serviço, o período padrão da cobertura real também não conta', () => {
    // A base do serviço vai até 10/09/2026, e a página abre em 01/09 a 10/09.
    // O Limpar filtros nascia visível porque o painel comparava com o padrão
    // do arquivo local (01/08 a 21/08). Apontado pelo Mário em 10/09/2026.
    const cobertura = { min: '2026-04-06', max: '2026-09-10' }
    const html = renderWithFilters(defaultOverviewOsFiltersFor(cobertura), {}, cobertura)

    expect(html).toContain('01/09/2026 a 10/09/2026')
    expect(html).not.toContain('Limpar filtros')
    expect(html).not.toContain('os-filter-chip')
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
    // Início e Fim são o campo de data do portal, e não mais o do navegador.
    expect((html.match(/placeholder="dd\/mm\/aaaa"/g) ?? []).length).toBe(2)
    expect((html.match(/<select/g) ?? []).length).toBe(6)
    expect(html).not.toContain('>Resolução</span>')

    const labels = [
      ['Início', 'label'],
      ['Fim', 'label'],
      ['Equipe', 'span'],
      ['Técnico', 'span'],
      ['Tipo de OS', 'span'],
      ['Categoria', 'span'],
      ['Cidade', 'span'],
      ['Status', 'span'],
    ]
    const positions = labels.map(([label, tag]) => html.indexOf(`>${label}</${tag}>`))
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('prende os calendários à cobertura real da fonte e mantém o intervalo ordenado', () => {
    // A cobertura agora aparece no próprio calendário: o dia de fora nasce
    // desligado. Fonte de 06/04 a 21/08, com o recorte padrão de agosto.
    // Início: mínimo da fonte e máximo no Fim selecionado; Fim: espelho.
    expect(diasDoCalendário(html, '2026-08-22').every((dia) => dia.includes('disabled'))).toBe(true)
    expect(diasDoCalendário(html, '2026-08-21').some((dia) => !dia.includes('disabled'))).toBe(true)
    // 31/07 é dia vizinho nos dois calendários: vivo no Início, morto no Fim,
    // que não pode terminar antes de 01/08.
    expect(diasDoCalendário(html, '2026-07-31').filter((dia) => dia.includes('disabled'))).toHaveLength(1)
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
    // demais campos sempre têm ao menos o valor neutro. A conta olha só os
    // seletores: os calendários também trazem dias desligados, que são outra
    // coisa.
    expect((html.match(/<select[^>]*\sdisabled=""/g) ?? []).length).toBe(1)
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
    // Cada chip tem o "x" que tira só ele, nomeado pelo filtro que remove.
    expect(html).toContain('aria-label="Remover filtro Equipe: Infra"')
    expect(html).toContain('aria-label="Remover filtro Cidade: Atibaia"')
    expect((html.match(/os-filter-chip-remove/g) ?? []).length).toBe(2)
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

  it('o resumo não repete a quantidade de OS ao lado do período', () => {
    // Retirada a pedido do Mário em 14/09/2026: o total do recorte já aparece
    // logo abaixo, no card Total de OS.
    for (const html of [renderDefault(), renderWithFilters({ team: 'Câmeras' })]) {
      expect(html).not.toContain('</b> OS')
      expect(html).not.toMatch(/>[\d.]+<\/b>/)
    }
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
    expect((html.match(/<select[^>]*\sdisabled=""/g) ?? []).length).toBe(1)
  })

  it('lista nomes, e não identificadores, quando o catálogo chega', () => {
    const html = renderComCatálogo()

    expect(html).toContain('>Técnico de teste 1</option>')
    expect(html).not.toContain(`>${técnicos[0].id}</option>`)
    // Com catálogo, nenhum seletor da página fica desabilitado.
    expect(html).not.toMatch(/<select[^>]*\sdisabled=""/)
    expect(html).not.toContain('Disponível quando o serviço enviar a lista de técnicos.')
  })

  it('guarda o identificador no valor da opção, que é o que a OS carrega', () => {
    const html = renderComCatálogo()

    expect(html).toContain(`value="${técnicos[0].id}"`)
  })

  it('lista os técnicos em ordem alfabética pelo nome, e não pelo identificador', () => {
    // Nomes dados na ordem inversa dos identificadores: se a lista seguisse
    // o identificador, "Zélia" viria antes de "Álvaro".
    const ids = [...new Set(OVERVIEW_OS_RECORDS.map((record) => record.technicianId))]
      .filter((id): id is string => id !== null)
      .sort()
      .slice(0, 4)
    const catálogo = [
      { id: ids[0], name: 'Zélia Souza' },
      { id: ids[1], name: 'Marcos Lima' },
      { id: ids[2], name: 'Álvaro Dias' },
    ]
    const html = renderToStaticMarkup(
      <OverviewOsContext.Provider value={contextValue({}, catálogo)}>
        <OverviewFilterPanel defaultExpanded />
      </OverviewOsContext.Provider>,
    )
    const ordem = ['Álvaro Dias', 'Marcos Lima', 'Zélia Souza'].map((name) =>
      html.indexOf(`>${name}</option>`),
    )

    expect(ordem.every((position) => position > -1)).toBe(true)
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b))
    // O quarto técnico não está no catálogo: aparece pelo identificador,
    // depois de todos os nomes.
    const semNome = html.indexOf(`>${ids[3]}</option>`)
    expect(semNome).toBeGreaterThan(ordem[2])
  })

  it('mostra o nome do técnico no chip do filtro ativo', () => {
    const html = renderComCatálogo({ technicianId: técnicos[0].id })

    expect(html).toContain('Técnico: Técnico de teste 1')
    expect(html).not.toContain(`Técnico: ${técnicos[0].id}`)
  })
})

/**
 * Atalhos de período (22/09/2026): cinco botões acima das datas, o atalho
 * ativo nomeado no resumo, e o que cai fora da cobertura desabilitado.
 */
describe('atalhos de período', () => {
  const cobertura = { min: '2026-04-06', max: '2026-09-21' }
  const hoje = '2026-09-22'

  it('mostra os cinco atalhos na faixa RECOLHIDA', () => {
    // Na faixa sempre visível, e não na área expandida: o diretor troca o
    // período sem abrir nada.
    const html = renderWithFilters(defaultOverviewOsFiltersFor(cobertura, hoje), { today: hoje }, cobertura)
    const faixa = html.slice(0, html.indexOf('hidden=""'))

    for (const label of ['Ontem', 'Esta semana', 'Semana passada', 'Este mês', 'Mês passado']) {
      expect(faixa).toContain(`>${label}</button>`)
    }
    expect(faixa).toContain('aria-label="Atalhos de período"')
    expect(html).not.toContain('Personalizado')
  })

  it('com atalho aceso as datas saem da faixa: o botão já nomeia, e a dica dele as mostra', () => {
    // Pedido do Mário em 23/09/2026: a etiqueta de "Resultado do período",
    // logo abaixo, já escreve o período por extenso.
    const html = renderWithFilters(
      defaultOverviewOsFiltersFor(cobertura, hoje),
      { today: hoje },
      cobertura,
    )

    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
    expect(html).toMatch(/aria-pressed="true"[^>]*title="01\/09\/2026 a 21\/09\/2026"[^>]*>Este mês</)
    expect(html).not.toContain('>01/09/2026 a 21/09/2026<')
  })

  it('um dia só, personalizado, mostra o dia da semana em vez de repetir a data', () => {
    // 17/09/2026 é quinta-feira, e não bate com atalho nenhum numa terça.
    const html = renderWithFilters({ dateFrom: '2026-09-17', dateTo: '2026-09-17' }, { today: hoje }, cobertura)

    expect(html).toContain('>quinta-feira, 17/09/2026<')
    expect(html).not.toContain('17/09/2026 a 17/09/2026')
  })

  it('período fora dos atalhos não acende nenhum: as datas sozinhas dizem que é personalizado', () => {
    const html = renderWithFilters(
      { dateFrom: '2026-09-03', dateTo: '2026-09-10' },
      { today: hoje },
      cobertura,
    )

    // Visíveis na faixa, e não só na dica de um botão.
    expect(html).toContain('>03/09/2026 a 10/09/2026<')
    expect(html).not.toContain('aria-pressed="true"')
  })

  it('atalho fora da cobertura da fonte fica desabilitado, com o motivo', () => {
    // A base local termina em 21/08/2026: nenhum dos cinco atalhos de
    // setembro cabe nela, e agosto inteiro passa do dia 21.
    const html = renderWithFilters({}, { today: hoje })

    expect((html.match(/Sem dados nesse período/g) ?? []).length).toBe(5)
  })
})