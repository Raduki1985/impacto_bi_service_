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
 * Trecho do HTML de um campo de escolha, do rótulo dele até o rótulo do campo
 * seguinte. Desde 30/09/2026 os seis campos são o campo de escolha múltipla
 * do portal (`MultiSelectField`): um botão que mostra o valor e uma lista com
 * as opções, cada uma com `role="option"` e `aria-selected`.
 */
function campo(html: string, label: string): string {
  const start = html.indexOf(`>${label}</label>`)
  if (start === -1) throw new Error(`campo ${label} não encontrado`)
  const end = html.indexOf('</label>', start + label.length + '></label>'.length)

  return html.slice(start, end === -1 ? undefined : end)
}

/** Opções listadas num trecho do HTML, na ordem, com o nome e se estão marcadas. */
function opções(html: string): { label: string; selected: boolean }[] {
  return [
    ...html.matchAll(/<div aria-selected="(true|false)"[^>]*role="option"[^>]*>([\s\S]*?)<\/div>/g),
  ].map(([, selected, inner]) => ({
    label: inner.match(/<span class="truncate">([^<]*)<\/span>/)?.[1] ?? '',
    selected: selected === 'true',
  }))
}

/** Só os nomes das opções, na ordem da lista. */
function nomes(html: string): string[] {
  return opções(html).map((opção) => opção.label)
}

/** Abertura de cada botão de campo de escolha no trecho. */
function botõesDeEscolha(html: string): string[] {
  return html.match(/<button[^>]*aria-haspopup="dialog"[^>]*>/g) ?? []
}

/**
 * O botão de um campo: a tag de abertura, o texto que ele MOSTRA e o texto
 * que o leitor de tela lê, que fica numa parte invisível (`sr-only`) com
 * todas as marcadas por extenso.
 */
function botão(trecho: string): { tag: string; text: string; spoken: string } {
  const match = trecho.match(/(<button[^>]*aria-haspopup="dialog"[^>]*>)([\s\S]*?)<\/button>/)
  if (match === null) throw new Error('botão do campo não encontrado')
  const hidden = /<span class="sr-only"[^>]*>([^<]*)<\/span>/

  return {
    tag: match[1],
    text: match[2].replace(hidden, '').replace(/<[^>]+>/g, ''),
    spoken: match[2].match(hidden)?.[1] ?? '',
  }
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
    setSelection: () => {},
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

    expect(html).not.toContain('impacto-chip')
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
    expect(html).not.toContain('impacto-chip')
  })

  it('não existe contagem de filtros ativos em nenhum estado', () => {
    for (const html of [
      renderDefault(),
      renderDefault({ defaultExpanded: true }),
      renderWithFilters({ team: ['Infra'], city: ['Atibaia'] }),
      renderWithFilters({ team: ['Infra'] }, { defaultExpanded: true }),
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
    // Os seis de escolha são o campo de escolha múltipla, e não mais o
    // seletor nativo do navegador.
    expect(botõesDeEscolha(html)).toHaveLength(6)
    expect(html).not.toContain('<select')
    expect(html).not.toMatch(/>Resolução<\/(label|span)>/)

    const labels = [
      ['Início', 'label'],
      ['Fim', 'label'],
      ['Equipe', 'label'],
      ['Técnico', 'label'],
      ['Tipo de OS', 'label'],
      ['Categoria', 'label'],
      ['Cidade', 'label'],
      ['Status', 'label'],
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
    const todas = nomes(html)

    expect(todas).not.toContain('Retiradas')
    expect(todas).not.toContain('Retirada')
    expect(todas).not.toContain('Customer (legado)')
    expect(nomes(campo(html, 'Tipo de OS'))).toContain('Instalação de Câmera')
    expect(nomes(campo(html, 'Cidade'))).toContain('Cidade não informada')
    // Suporte Lógico não tem OS no mês padrão: também fica fora.
    expect(todas).not.toContain('Suporte Lógico')
  })

  it('com o período completo o tipo legado passa a ser opção', () => {
    const fullRange = renderWithFilters({ dateFrom: '2026-04-06' }, { defaultExpanded: true })

    expect(nomes(campo(fullRange, 'Tipo de OS'))).toContain('Customer (legado)')
  })

  it('sem nada marcado, cada campo mostra o valor neutro, e ele é a opção marcada', () => {
    const neutros = [
      ['Equipe', 'Todas'],
      ['Técnico', 'Todos'],
      ['Tipo de OS', 'Todos'],
      ['Categoria', 'Todas'],
      ['Cidade', 'Todas'],
      ['Status', 'Todos'],
    ]

    for (const [label, neutro] of neutros) {
      const trecho = campo(html, label)

      expect(botão(trecho).text).toBe(neutro)
      // Técnico sem catálogo não tem opção nenhuma além do neutro.
      const [primeira, ...demais] = opções(trecho)
      expect(primeira).toEqual({ label: neutro, selected: true })
      expect(demais.every((opção) => !opção.selected)).toBe(true)
    }
  })
})

describe('filtros dependentes', () => {
  it('com Câmeras selecionada, Categoria oferece só as categorias da equipe', () => {
    const html = renderWithFilters({ team: ['Câmeras'] }, { defaultExpanded: true })
    const categorias = nomes(campo(html, 'Categoria'))

    expect(categorias).not.toContain('REPARO DE CTO')
    expect(categorias).toContain('instalação de 2 câmeras')
  })

  it('com um tipo selecionado, Categoria oferece só as subdivisões dele', () => {
    const html = renderWithFilters({ serviceType: ['Infraestrutura'] }, { defaultExpanded: true })
    const categorias = nomes(campo(html, 'Categoria'))

    expect(categorias).toContain('REPARO DE CTO')
    expect(categorias).not.toContain('fibra instalação')
  })

  it('só desabilita o seletor de Técnico, que depende do catálogo do serviço', () => {
    const html = renderWithFilters({ status: ['Expirada'] }, { defaultExpanded: true })

    // Um único seletor desabilitado, o de Técnico, e ele diz o motivo. Os
    // demais campos sempre têm ao menos o valor neutro. A conta olha só os
    // seletores: os calendários também trazem dias desligados, que são outra
    // coisa.
    const desabilitados = botõesDeEscolha(html).filter((tag) => tag.includes(' disabled=""'))
    expect(desabilitados).toHaveLength(1)
    expect(botão(campo(html, 'Técnico')).tag).toContain(' disabled=""')
    expect(html).toContain('Disponível quando o serviço enviar a lista de técnicos.')
    expect(html).not.toContain('Sem resoluções disponíveis no contexto filtrado.')
  })
})

describe('filtros diferentes do padrão', () => {
  it('identifica os filtros direto nos chips, com nome e valor', () => {
    const html = renderWithFilters({ team: ['Infra'], city: ['Atibaia'] })

    expect(html).toContain('Equipe: Infra')
    expect(html).toContain('Cidade: Atibaia')
    expect(html).toContain('Limpar filtros')
    // Cada chip tem o "x" que tira só ele, nomeado pelo filtro que remove.
    expect(html).toContain('aria-label="Remover filtro Equipe: Infra"')
    expect(html).toContain('aria-label="Remover filtro Cidade: Atibaia"')
    expect((html.match(/impacto-chip-remove/g) ?? []).length).toBe(2)
  })

  it('mostra os mesmos chips no resumo com o painel recolhido e expandido', () => {
    for (const html of [
      renderWithFilters({ team: ['Infra'], status: ['Concluída'] }),
      renderWithFilters({ team: ['Infra'], status: ['Concluída'] }, { defaultExpanded: true }),
    ]) {
      expect(html).toContain('Equipe: Infra')
      expect(html).toContain('Status: Concluída')
    }
  })

  it('não recria a antiga segunda linha exclusiva de chips quando recolhido', () => {
    // Os chips vivem no próprio resumo: com filtros ativos e painel recolhido,
    // a única divisória interna que existe é a da área expandida oculta. O
    // espaço no padrão evita casar com o `border-transparent` dos chips.
    const html = renderWithFilters({ team: ['Infra'], city: ['Atibaia'] })

    expect((html.match(/border-t /g) ?? []).length).toBe(1)
  })

  it('renderiza um único Limpar filtros por estado, antes de Expandir/Recolher', () => {
    const collapsed = renderWithFilters({ team: ['Infra'] })
    const expanded = renderWithFilters({ team: ['Infra'] }, { defaultExpanded: true })

    expect((collapsed.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect((expanded.match(/Limpar filtros/g) ?? []).length).toBe(1)
    expect(collapsed.indexOf('Limpar filtros')).toBeLessThan(collapsed.indexOf('Expandir filtros'))
    expect(expanded.indexOf('Limpar filtros')).toBeLessThan(expanded.indexOf('Recolher filtros'))
  })

  it('período alterado atualiza o resumo e oferece Limpar, sem chip redundante', () => {
    const html = renderWithFilters({ dateFrom: '2026-08-05' })

    expect(html).toContain('05/08/2026 a 21/08/2026')
    expect(html).toContain('Limpar filtros')
    expect(html).not.toContain('impacto-chip')
    expect(html).not.toContain('Início:')
    expect(html).not.toContain('Fim:')
  })

  it('o resumo não repete a quantidade de OS ao lado do período', () => {
    // Retirada a pedido do Mário em 14/09/2026: o total do recorte já aparece
    // logo abaixo, no card Total de OS.
    for (const html of [renderDefault(), renderWithFilters({ team: ['Câmeras'] })]) {
      expect(html).not.toContain('</b> OS')
      expect(html).not.toMatch(/>[\d.]+<\/b>/)
    }
  })

  it('uma seleção incompatível chega saneada ao painel, sem valor escondido', () => {
    // A cadeia do provider reseta a categoria incompatível com Câmeras; o
    // painel nunca exibe um filtro que não está de fato aplicado.
    const html = renderWithFilters({
      team: ['Câmeras'],
      category: ['REPARO DE CTO'],
    })

    expect(html).toContain('Equipe: Câmeras')
    expect(html).not.toContain('Categoria: REPARO DE CTO')
  })

  it('o campo mostra o que está marcado, e a opção marcada fica assinalada na lista', () => {
    const html = renderWithFilters(
      { team: ['Câmeras'], category: ['REPARO DE CTO'] },
      { defaultExpanded: true },
    )
    const equipe = campo(html, 'Equipe')

    expect(botão(equipe).text).toBe('Câmeras')
    expect(opções(equipe).filter((opção) => opção.selected)).toEqual([
      { label: 'Câmeras', selected: true },
    ])
    // A categoria incompatível saiu: o campo volta ao neutro.
    expect(botão(campo(html, 'Categoria')).text).toBe('Todas')
  })

  it('a categoria aplicada aparece como chip, com o nome do filtro', () => {
    const html = renderWithFilters({ category: ['fibra instalação'] })

    expect(html).toContain('Categoria: fibra instalação')
  })

  it('duas opções no mesmo campo viram um chip só, com as duas por extenso', () => {
    const html = renderWithFilters({ city: ['Atibaia', 'Mairiporã'] })

    expect(html).toContain('Cidade: Atibaia, Mairiporã')
    expect(html).toContain('aria-label="Remover filtro Cidade: Atibaia, Mairiporã"')
    expect((html.match(/impacto-chip-remove/g) ?? []).length).toBe(1)
  })

  it('três ou mais opções encurtam o chip, e a lista inteira fica na dica e na leitura', () => {
    // Marcadas fora de ordem: o painel recebe na ordem da lista de opções.
    const html = renderWithFilters(
      { status: ['Encerrada', 'Improdutiva', 'Concluída'] },
      { defaultExpanded: true },
    )

    expect(html).toContain('Status: Concluída +2')
    expect(html).toContain('title="Status: Concluída, Improdutiva, Encerrada"')
    expect(html).toContain('aria-label="Remover filtro Status: Concluída, Improdutiva, Encerrada"')
    expect((html.match(/impacto-chip-remove/g) ?? []).length).toBe(1)

    // O campo mostra a primeira marcada e quantas faltam, com a lista na dica.
    const status = campo(html, 'Status')
    expect(botão(status).text).toBe('Concluída+2')
    expect(botão(status).tag).toContain('title="Concluída, Improdutiva, Encerrada"')
    expect(botão(status).tag).toContain('aria-expanded="false"')
    expect(
      opções(status)
        .filter((opção) => opção.selected)
        .map((opção) => opção.label),
    ).toEqual(['Concluída', 'Improdutiva', 'Encerrada'])
    // Com algo marcado, o neutro deixa de estar assinalado.
    expect(opções(status)[0]).toEqual({ label: 'Todos', selected: false })
  })
})

describe('legibilidade no tema escuro', () => {
  it('publica os ganchos escopados que o tema escuro estiliza', () => {
    const html = renderWithFilters({ team: ['Infra'] }, { defaultExpanded: true })

    // A seção escopa as regras de `styles.css`; chips e ações carregam as
    // classes compartilhadas que o tema escuro pinta de verde.
    expect(html).toContain('impacto-filter-panel')
    expect(html).toContain('impacto-chip')
    expect((html.match(/impacto-text-action/g) ?? []).length).toBe(2)
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

    expect(html).toContain('>Técnico</label>')
    expect(html).toContain('Disponível quando o serviço enviar a lista de técnicos.')
    const técnico = botão(campo(html, 'Técnico'))
    expect(técnico.tag).toContain(' disabled=""')
    expect(técnico.text).toBe('Todos')
    expect(botõesDeEscolha(html).filter((tag) => tag.includes(' disabled=""'))).toHaveLength(1)
  })

  it('lista nomes, e não identificadores, quando o catálogo chega', () => {
    const html = renderComCatálogo()
    const lista = nomes(campo(html, 'Técnico'))

    expect(lista).toContain('Técnico de teste 1')
    expect(lista).not.toContain(técnicos[0].id)
    // Com catálogo, nenhum seletor da página fica desabilitado.
    expect(botõesDeEscolha(html).some((tag) => tag.includes(' disabled=""'))).toBe(false)
    expect(html).not.toContain('Disponível quando o serviço enviar a lista de técnicos.')
  })

  it('guarda o identificador no filtro, que é o que a OS carrega, e mostra o nome', () => {
    // O campo não escreve mais o valor da opção no HTML: a prova é o filtro
    // receber o identificador e o campo marcar o técnico certo, pelo nome.
    const html = renderComCatálogo({ technicianId: [técnicos[0].id] })
    const trecho = campo(html, 'Técnico')

    expect(botão(trecho).text).toBe('Técnico de teste 1')
    expect(opções(trecho).filter((opção) => opção.selected)).toEqual([
      { label: 'Técnico de teste 1', selected: true },
    ])
    expect(html).not.toContain(`>${técnicos[0].id}<`)
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
    const lista = nomes(campo(html, 'Técnico'))
    const ordem = ['Álvaro Dias', 'Marcos Lima', 'Zélia Souza'].map((name) => lista.indexOf(name))

    expect(ordem.every((position) => position > -1)).toBe(true)
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b))
    // O quarto técnico não está no catálogo: aparece pelo identificador,
    // depois de todos os nomes.
    const semNome = lista.indexOf(ids[3])
    expect(semNome).toBeGreaterThan(ordem[2])
  })

  it('mostra o nome do técnico no chip do filtro ativo', () => {
    const html = renderComCatálogo({ technicianId: [técnicos[0].id] })

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