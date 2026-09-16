import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { formatIsoAsBrDate } from '../../../data/commercialCalendar'
import type { CommercialCity, CommercialSeller } from '../../../data/commercialTypes'
import { OverviewFilters } from './OverviewFilters'
import {
  initialCommercialOverviewFilters,
  initialCommercialOverviewFiltersFor,
  type CommercialOverviewFilters,
  type CommercialPersonTypeOption,
} from './overviewModel'

const cities: readonly CommercialCity[] = [
  { id: 'atibaia', name: 'Atibaia' },
  { id: 'piracaia', name: 'Piracaia' },
]

const sellers: readonly CommercialSeller[] = [
  { id: 'vnd-01', name: 'Ana Paula', cityId: 'atibaia', segment: 'interno', active: true },
]

/**
 * Os botões de um mesmo dia nos calendários da faixa, um por campo de data.
 * Serve para ler o que a cobertura fez com aquele dia em cada um deles.
 */
function dias(html: string, iso: string): string[] {
  return html.match(new RegExp(`<button[^>]*data-iso="${iso}"[^>]*>`, 'g')) ?? []
}

const personTypes: readonly CommercialPersonTypeOption[] = [
  { id: 'pf', name: 'Pessoa física' },
  { id: 'pj', name: 'Pessoa jurídica' },
]

function render(
  input: Partial<CommercialOverviewFilters> = {},
  props: {
    defaultExpanded?: boolean
    periodEnd?: string
    periodStart?: string
    personTypes?: readonly CommercialPersonTypeOption[]
    sellers?: readonly CommercialSeller[]
    sellersHint?: string
  } = {},
) {
  return renderToStaticMarkup(
    <OverviewFilters
      cities={cities}
      defaultExpanded={props.defaultExpanded}
      filters={{ ...initialCommercialOverviewFilters(), ...input }}
      onChange={() => {}}
      periodEnd={props.periodEnd}
      periodStart={props.periodStart}
      personTypes={props.personTypes ?? personTypes}
      sellers={props.sellers ?? sellers}
      sellersHint={props.sellersHint}
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

  it('o recorte de abertura da cobertura do banco também não conta como alterado', () => {
    // Ligada ao serviço, a página abre no mês corrente da cobertura real. Se a
    // comparação continuasse sendo com julho da base sintética, o Limpar
    // filtros nasceria visível sem nada filtrado.
    const cobertura = { start: '2026-01-01', end: '2026-09-09' }
    const abertura = initialCommercialOverviewFiltersFor(cobertura)
    const html = render(abertura, { periodStart: cobertura.start, periodEnd: cobertura.end })

    expect(html).toContain(
      `${formatIsoAsBrDate(abertura.startDate)} a ${formatIsoAsBrDate(abertura.endDate)}`,
    )
    expect(html).not.toContain('Limpar filtros')
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

  it('os campos têm a largura dos campos da faixa de OS: 8 partes na linha, 2 para Período', () => {
    // Mesma régua da Visão Geral de OS. Com quatro seletores em Operação, o
    // restante da linha fica vazio em vez de esticar os campos.
    const html = render({}, { defaultExpanded: true })

    expect(html).toContain('xl:grid-cols-[minmax(272px,2fr)_6fr]')
    expect(html).toContain('xl:grid-cols-6')
  })
})

describe('estado expandido', () => {
  const html = render({}, { defaultExpanded: true })

  it('oferece os seis filtros em dois grupos de negócio', () => {
    expect((html.match(/<fieldset/g) ?? []).length).toBe(2)
    // Início e Fim são o campo de data do portal, e não mais o do navegador.
    expect((html.match(/placeholder="dd\/mm\/aaaa"/g) ?? []).length).toBe(2)
    // Cidade, Time e Tipo de cliente são seletores comuns; Vendedor é o campo
    // de escolha com digitação, que também se lê pelo teclado.
    expect((html.match(/<select/g) ?? []).length).toBe(3)
    expect((html.match(/role="combobox"/g) ?? []).length).toBe(1)

    const labels = [
      ['Início', 'label'],
      ['Fim', 'label'],
      ['Cidade', 'span'],
      ['Time', 'span'],
      ['Vendedor', 'label'],
      ['Tipo de cliente', 'span'],
    ]
    const positions = labels.map(([label, tag]) => html.indexOf(`>${label}</${tag}>`))
    for (const position of positions) expect(position).toBeGreaterThan(-1)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('prende os calendários à cobertura da base e mantém o intervalo ordenado', () => {
    // A cobertura aparece no próprio calendário: o dia de fora nasce
    // desligado. Base sintética de 01/01 a 31/07, com o padrão de julho.
    // Início: mínimo da base e máximo no Fim selecionado; Fim: espelho.
    expect(dias(html, '2026-08-01').every((dia) => dia.includes('disabled'))).toBe(true)
    // 30/06 é dia vizinho nos dois calendários: vivo no Início, morto no Fim,
    // que não pode terminar antes de 01/07.
    expect(dias(html, '2026-06-30').filter((dia) => dia.includes('disabled'))).toHaveLength(1)
    expect((html.match(/required=""/g) ?? []).length).toBe(2)
  })

  it('com a cobertura real do banco, o Fim alcança os meses depois de julho', () => {
    // Ligada ao serviço de BI, a página passa a cobertura de `source.period`
    // (01/01 a 09/09/2026 em 10/09/2026); sem isso agosto e setembro ficavam
    // inalcançáveis no calendário.
    const ligado = render(
      {},
      { defaultExpanded: true, periodStart: '2026-01-01', periodEnd: '2026-09-09' },
    )

    // 01/08 fecha a última semana de julho: preso à base ele morre, e com a
    // cobertura real do banco ele passa a ser escolhível no Fim.
    expect(dias(ligado, '2026-08-01').some((dia) => !dia.includes('disabled'))).toBe(true)
  })

  it('publica as cidades e os vendedores recebidos, com o valor neutro curto na frente', () => {
    // O neutro é o `Todas`/`Todos` da Visão Geral de OS: o nome do campo já
    // está no rótulo logo acima do seletor.
    expect(html.indexOf('>Todas</option>')).toBeLessThan(html.indexOf('>Atibaia</option>'))
    expect(html).toContain('>Piracaia</option>')
    // Vendedor é o campo de escolha com digitação: o neutro é o texto do campo
    // vazio, e os nomes são as opções da lista.
    expect(html).toContain('placeholder="Todos"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('>Ana Paula</div>')
    expect(html).not.toContain('Todas as cidades')
    expect(html).not.toContain('Todos os times')
    expect(html).not.toContain('Todos os vendedores')
  })

  it('sem vendedor na lista o seletor fica desabilitado, com o motivo visível embaixo', () => {
    // Mesmo padrão do Técnico na Visão Geral de OS: o motivo é texto logo
    // abaixo do seletor, e não um título que só aparece ao passar o mouse.
    const semVendedores = render({}, { defaultExpanded: true, sellers: [] })

    expect(semVendedores).toContain('disabled=""')
    expect(semVendedores).toContain('O serviço de BI ainda não filtra a Visão Geral por vendedor.')
    expect(semVendedores).not.toContain('title="O serviço de BI')
    // Com vendedores na lista, nenhum aviso.
    expect(html).not.toContain('ainda não filtra a Visão Geral por vendedor')
  })

  it('com vendedores na lista, mostra o aviso de cobertura que a página passar', () => {
    const aviso = 'O SGI registra o vendedor desde junho de 2026.'
    const comAviso = render({}, { defaultExpanded: true, sellersHint: aviso })

    expect(comAviso).toContain(aviso)
    expect(comAviso).not.toContain('ainda não filtra a Visão Geral por vendedor')
    // Sem lista, vale o aviso de seletor desabilitado, e não o de cobertura.
    const semVendedores = render({}, { defaultExpanded: true, sellers: [], sellersHint: aviso })
    expect(semVendedores).not.toContain(aviso)
    expect(semVendedores).toContain('ainda não filtra a Visão Geral por vendedor')
    // Sem aviso passado, nada aparece sob o seletor habilitado.
    expect(render({}, { defaultExpanded: true })).not.toContain(aviso)
  })

  it('sem tipo de cliente no catálogo o seletor fica desabilitado, com o motivo embaixo', () => {
    // A base sintética não classifica o cliente: o campo diz por que não
    // funciona, em vez de oferecer um recorte que a fonte ignora.
    const semTipos = render({}, { defaultExpanded: true, personTypes: [] })

    // O aviso fala da fonte: a lista vazia tanto vem de um serviço antigo
    // quanto da base sintética, que não classifica o cliente.
    expect(semTipos).toContain('Os dados em uso não separam pessoa física de jurídica.')
    expect(html).toContain('>Pessoa jurídica</option>')
    expect(html).not.toContain('não separam pessoa física de jurídica')
  })
})

describe('filtros diferentes do padrão', () => {
  it('identifica os filtros direto nos chips, com nome e valor legíveis', () => {
    const html = render({
      cityId: 'atibaia',
      team: 'corporativo',
      sellerId: 'vnd-01',
      personType: 'pj',
    })

    expect(html).toContain('Cidade: Atibaia')
    expect(html).toContain('Time: Corporativo')
    expect(html).toContain('Vendedor: Ana Paula')
    expect(html).toContain('Tipo de cliente: Pessoa jurídica')
    expect(html).toContain('Limpar filtros')
    // Cada chip tem o "x" que tira só ele, nomeado pelo filtro que remove.
    expect(html).toContain('aria-label="Remover filtro Cidade: Atibaia"')
    expect(html).toContain('aria-label="Remover filtro Time: Corporativo"')
    expect(html).toContain('aria-label="Remover filtro Vendedor: Ana Paula"')
    expect(html).toContain('aria-label="Remover filtro Tipo de cliente: Pessoa jurídica"')
    expect((html.match(/commercial-filter-chip-remove/g) ?? []).length).toBe(4)
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
