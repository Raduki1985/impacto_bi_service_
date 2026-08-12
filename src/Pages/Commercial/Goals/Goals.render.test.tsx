import { ClipboardList } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { KpiStoryCard } from '../../../components/dashboard/KpiStoryCard'
import type { CommercialGoalsFilters } from '../../../data/commercialTypes'
import { getCommercialDataset } from '../../../data/mockCommercialData'
import { buildCommercialGoalsSnapshot } from './commercialGoalsModel'
import { Goals } from './Goals'
import { GoalProgress } from './GoalProgress'
import { ContributionPanels, TeamSummaryPanel } from './GoalsPanels'

/**
 * Teste de fumaça da página.
 *
 * Não substitui a validação visual: ele garante que a árvore de componentes
 * renderiza sem erro em cada estado e que os textos que a regra de negócio exige
 * chegam à tela. A ordem dos casos importa, porque o primeiro depende de a base
 * ainda não ter sido montada neste arquivo.
 */
describe('página Metas e Desempenho', () => {
  it('mostra o estado de carregamento antes de a base existir', () => {
    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain('Carregando a base comercial')
    expect(html).toContain('role="status"')
  })

  it('renderiza os seis indicadores e as regras de negócio na tela', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    for (const kpi of [
      'Realizado da Meta',
      'Meta',
      'Atingimento da Meta',
      'Gap para Meta',
      'Supermeta',
      'Atingimento da Supermeta',
    ]) {
      expect(html).toContain(kpi)
    }

    // Julho de 2026 é o mês inicial, com meta abaixo de 100% e supermeta atingida.
    expect(html).toContain('Progresso de Julho de 2026')
    expect(html).toContain('795')
    expect(html).toContain('883')
    expect(html).toContain('99,4%')
    expect(html).toContain('100,3%')

    // Os dois numeradores precisam estar explicados na página.
    expect(html).toContain('Realizado total da supermeta')
    expect(html).toContain('Corporativo nunca entra na')
    expect(html).toContain('Contribuição de Colaboradores')
    expect(html).toContain('Resumo da equipe')
    expect(html).toContain('Atingiram a meta individual')
    expect(html).toContain('Não atingiram a meta individual')

    // Filtros da página, com o mês inicial selecionado.
    expect(html).toContain('Todas as cidades')
    expect(html).toContain('Todos os vendedores')
    expect(html).toContain('Julho de 2026')

    // Nenhum indicador quebrado chega à tela.
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })
})

/**
 * Leitura gerencial compartilhada.
 *
 * O overlay dentro do card cobria o valor no hover e criava rolagem própria em
 * cartão estreito. Nesta página a leitura é um painel único abaixo da fileira, e
 * os seis KPIs viram um grupo de seleção.
 */
describe('leitura gerencial compartilhada', () => {
  it('não desenha nenhum overlay de leitura dentro dos KPIs comerciais', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).not.toContain('kpi-story__reading')
    expect(html).not.toContain('kpi-story__r-title')
    expect(html).not.toContain('LEITURA GERENCIAL')

    // Sem overlay, nenhum card anuncia conteúdo expansível. A verificação é
    // sobre os cards, e não sobre a página: o filtro de vendedores tem um
    // dropdown legítimo, com `aria-expanded` próprio.
    const cards = html.match(/<article[^>]*>/g) ?? []

    expect(cards).toHaveLength(6)
    for (const card of cards) {
      expect(card).toContain('kpi-story--external')
      expect(card).not.toContain('aria-expanded')
    }
  })

  it('publica um único painel de leitura, controlado pelos seis KPIs', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html.match(/id="comercial-leitura-gerencial"/g) ?? []).toHaveLength(1)
    expect(html.match(/aria-controls="comercial-leitura-gerencial"/g) ?? []).toHaveLength(6)
    expect(html).toContain('aria-label="Leitura gerencial do indicador selecionado"')
    expect(html).toContain('aria-live="polite"')
  })

  it('marca os seis KPIs como seleção, com apenas o primeiro selecionado', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html.match(/aria-pressed="(true|false)"/g) ?? []).toHaveLength(6)
    expect(html.match(/aria-pressed="true"/g) ?? []).toHaveLength(1)
    expect(html.match(/kpi-story--external/g) ?? []).toHaveLength(6)
    expect(html.match(/kpi-story--external [^"]*is-selected/g) ?? []).toHaveLength(1)
  })

  it('abre com a leitura do primeiro indicador no painel', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain('Vendas ativas que contam para a meta normal.')
    expect(html).toContain('O que observar')
    expect(html).toContain('contrato ativo e data de ativação no mês')
    // A leitura dos demais indicadores só aparece quando eles são selecionados.
    expect(html).not.toContain('Patamar de superação do recorte.')
    expect(html).not.toContain('Quanto da supermeta já foi entregue.')
  })

  it('descreve a ação do card sem prometer um overlay que não existe', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain('no painel de leitura gerencial')
    expect(html).not.toContain('Ative para ver a leitura gerencial.')
  })
})

/**
 * `KpiStoryCard` é compartilhado com Visão Geral, Improdutividade, Clientes e
 * Calendário Operacional. O modo externo é uma adição opcional: sem a prop, o
 * componente precisa continuar exatamente como essas páginas o usam.
 */
describe('retrocompatibilidade do KpiStoryCard', () => {
  const card = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      <KpiStoryCard
        icon={ClipboardList}
        leituraTexto="Texto com {destaque} da leitura."
        leituraTitulo="Título da leitura."
        nome="Total de OS"
        observar="O que observar neste indicador."
        setor="DEMANDA"
        valor="1.234"
        {...props}
      />,
    )

  it('mantém o overlay interno como comportamento padrão', () => {
    const html = card({})

    expect(html).toContain('kpi-story__reading')
    expect(html).toContain('LEITURA GERENCIAL')
    expect(html).toContain('Título da leitura.')
    expect(html).toContain('<b>destaque</b>')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Ative para ver a leitura gerencial.')
    expect(html).not.toContain('kpi-story--external')
    expect(html).not.toContain('aria-pressed')
    expect(html).not.toContain('aria-controls')
  })

  it('só troca de comportamento com o modo externo pedido explicitamente', () => {
    const html = card({ readingMode: 'external', readingPanelId: 'painel', selected: true })

    expect(html).not.toContain('kpi-story__reading')
    expect(html).not.toContain('aria-expanded')
    expect(html).toContain('kpi-story--external')
    expect(html).toContain('is-selected')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-controls="painel"')
    // O valor continua sendo o conteúdo principal do card nos dois modos.
    expect(html).toContain('1.234')
  })
})

/**
 * As duas comparações diárias.
 *
 * Quatro linhas no mesmo eixo não diziam quais delas se comparavam entre si.
 * Cada faixa passa a ter um realizado e a referência correspondente.
 */
describe('evolução diária em duas comparações', () => {
  it('publica as duas faixas com o título e a pergunta de cada uma', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain('Meta normal')
    expect(html).toContain('Supermeta')
    expect(html).toContain('O realizado da meta está acompanhando o ritmo esperado da meta?')
    expect(html).toContain(
      'O realizado total está acompanhando o ritmo esperado da supermeta?',
    )
  })

  it('mantém a explicação dos numeradores fora do tooltip, sempre visível', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain('soma Vendas Internas e Colaboradores.')
    expect(html).toContain('usa o realizado total, que inclui também o Corporativo.')
    expect(html).toContain('As duas comparações usam os mesmos dias e a mesma escala vertical.')
  })
})

/**
 * Composição do realizado.
 *
 * Rosca com o total no centro e a lista das três origens ao lado. Sem gauge:
 * Colaboradores e Corporativo não têm meta própria, então progresso seria uma
 * escala inventada.
 */
describe('composição do realizado', () => {
  const snapshotOf = (overrides: Partial<CommercialGoalsFilters>) =>
    buildCommercialGoalsSnapshot(getCommercialDataset(), {
      month: '2026-07',
      cityId: null,
      sellerIds: [],
      ...overrides,
    })

  it('detalha as três origens com quantidade e percentual', () => {
    const html = renderToStaticMarkup(<ContributionPanels snapshot={snapshotOf({})} />)

    expect(html).toContain('Composição do realizado')
    expect(html).toContain('Vendas Internas')
    expect(html).toContain('Colaboradores')
    expect(html).toContain('Corporativo')
    expect(html).toContain('entra na meta normal')
    expect(html).toContain('somente supermeta')
    expect(html).toContain('%')
    expect(html).not.toContain('NaN')
  })

  it('preserva os cards de contribuição de Colaboradores e Corporativo', () => {
    const html = renderToStaticMarkup(<ContributionPanels snapshot={snapshotOf({})} />)

    expect(html).toContain('Contribuição de Colaboradores')
    expect(html).toContain('Contribuição do Corporativo')
  })

  it('não desenha rosca nem divide por zero com realizado total zerado', () => {
    const snapshot = snapshotOf({ cityId: 'terra-preta', sellerIds: ['vnd-ana-maria'] })
    const html = renderToStaticMarkup(<ContributionPanels snapshot={snapshot} />)

    expect(snapshot.totalAchieved).toBe(0)
    expect(html).toContain('não há composição para exibir')
    expect(html).toContain('sem base')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })
})

/**
 * Resumo da equipe.
 *
 * As duas listas crescem com o recorte e usam a rolagem principal do dashboard.
 * Uma barra própria aqui competia com a do `<main>` e escondia parte da equipe.
 */
describe('resumo da equipe sem rolagem interna', () => {
  it('não limita a altura nem cria rolagem vertical nas listas', () => {
    const dataset = getCommercialDataset()
    const snapshot = buildCommercialGoalsSnapshot(dataset, {
      month: '2026-07',
      cityId: null,
      sellerIds: [],
    })
    const html = renderToStaticMarkup(
      <TeamSummaryPanel cities={dataset.cities} snapshot={snapshot} />,
    )

    expect(html).not.toContain('max-h-[264px]')
    expect(html).not.toContain('overflow-y-auto')
    expect(html).not.toContain('overflow-y-scroll')
    // Os vendedores continuam todos listados.
    expect(html.match(/<li /g) ?? []).toHaveLength(snapshot.eligibleInternalSellers.length)
  })
})

/**
 * Alternativa acessível dos gráficos.
 *
 * O ECharts desenha em canvas, então o único caminho de leitura das séries é a
 * tabela `sr-only` que acompanha cada gráfico. Com a evolução diária dividida em
 * duas comparações, são três tabelas: uma por comparação e a do histórico.
 */
describe('alternativa acessível dos gráficos', () => {
  it('publica uma tabela por comparação diária, com realizado e referência', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain(
      'Comparação Meta normal na evolução diária acumulada de Julho de 2026, com realizado da meta e ritmo esperado da meta.',
    )
    expect(html).toContain(
      'Comparação Supermeta na evolução diária acumulada de Julho de 2026, com realizado total e ritmo esperado da supermeta.',
    )
    expect(html.match(/<th scope="row">Dia 01<\/th>/g) ?? []).toHaveLength(2)
    expect(html.match(/<th scope="row">Dia 31<\/th>/g) ?? []).toHaveLength(2)
    expect(html).toContain('Ritmo esperado da supermeta')
  })

  it('publica os sete meses do histórico e marca o mês selecionado', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).toContain(
      'Histórico mensal de janeiro a julho de 2026, com realizado da meta, realizado total da supermeta, meta e supermeta.',
    )
    expect(html).toContain('<th scope="row">Janeiro de 2026</th>')
    expect(html).toContain('<th scope="row">Julho de 2026, mês selecionado</th>')
  })

  /**
   * O `sr-only` precisa ficar no contêiner, e não no `<table>`.
   *
   * Sobre a caixa de tabela a regra não recorta nada: a largura de 1px vira
   * mínimo, `overflow` não se aplica e `clip-path` só afeta a pintura. A tabela
   * continuava com o tamanho real, absoluta, e criava uma segunda barra de
   * rolagem no documento. Em um `<div>` as três declarações valem, e o
   * transbordo para de chegar aos ancestrais.
   */
  it('mantém cada tabela dentro de um contêiner fora da tela', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)
    const wrapped =
      html.match(/<div class="sr-only fixed left-0 top-0 pointer-events-none"><table>/g) ?? []

    expect(wrapped).toHaveLength(3)
  })

  /**
   * Ancoragem na viewport.
   *
   * O `sr-only` sozinho posiciona por `absolute` sem deslocamento, então o
   * contêiner cai na posição estática do gráfico, em coordenadas de documento, e
   * estica o `scrollHeight` do documento mesmo medindo 1px. `fixed` em top e
   * left zero tira a caixa da área rolável, e `pointer-events-none` impede que
   * esse 1px no canto intercepte clique.
   */
  it('ancora o contêiner na viewport, fora da área rolável do documento', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)
    const containers = html.match(/<div class="[^"]*"><table>/g) ?? []

    expect(containers).toHaveLength(3)

    for (const container of containers) {
      expect(container).toContain('sr-only')
      expect(container).toContain('fixed')
      expect(container).toContain('top-0')
      expect(container).toContain('left-0')
      expect(container).toContain('pointer-events-none')
      // `absolute` traria de volta a posição estática do conteúdo.
      expect(container).not.toContain('absolute')
    }
  })

  it('não aplica sr-only diretamente no elemento table', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)
    const tables = html.match(/<table[^>]*>/g) ?? []

    expect(tables).toHaveLength(3)
    expect(tables.every((table) => table === '<table>')).toBe(true)
    expect(html).not.toContain('<table class="sr-only">')
  })

  it('preserva a semântica e todas as linhas das três tabelas', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    // 31 dias de julho em cada comparação mais os sete meses do histórico.
    expect(html.match(/<th scope="row">/g) ?? []).toHaveLength(69)
    expect(html.match(/<caption>/g) ?? []).toHaveLength(3)
    expect(html.match(/<thead>/g) ?? []).toHaveLength(3)
    expect(html.match(/<tbody>/g) ?? []).toHaveLength(3)
    // Três colunas em cada comparação diária e cinco no histórico.
    expect(html.match(/<th scope="col">/g) ?? []).toHaveLength(11)
  })

  it('não retira as tabelas da árvore de acessibilidade', () => {
    getCommercialDataset()

    const html = renderToStaticMarkup(<Goals />)

    expect(html).not.toContain('aria-hidden="true"><table')
    expect(html).not.toContain('hidden><table')
    expect(html).not.toContain('display:none')
    expect(html).not.toContain('visibility:hidden')
  })
})

/**
 * Estados que dependem do recorte. O progresso é renderizado direto com o
 * snapshot do modelo, porque o filtro correspondente é estado interno da página.
 */
describe('estados do recorte', () => {
  const snapshotOf = (overrides: Partial<CommercialGoalsFilters>) =>
    buildCommercialGoalsSnapshot(getCommercialDataset(), {
      month: '2026-07',
      cityId: null,
      sellerIds: [],
      ...overrides,
    })

  it('mostra sem meta, e não zero por cento, com somente o Corporativo', () => {
    const html = renderToStaticMarkup(
      <GoalProgress snapshot={snapshotOf({ sellerIds: ['vnd-arthur-lopes'] })} />,
    )

    expect(html).toContain('Sem meta')
    expect(html).toContain('Sem meta individual de volume para comparar.')
    expect(html).not.toContain('0,0%')
    expect(html).not.toContain('NaN')
  })

  it('mostra a cidade sem meta local com o realizado preservado', () => {
    const snapshot = snapshotOf({ cityId: 'terra-preta' })
    const html = renderToStaticMarkup(<GoalProgress snapshot={snapshot} />)

    expect(snapshot.goal).toBeNull()
    expect(html).toContain('não tem vendedor interno elegível')
    expect(html).toContain('Sem meta')
  })

  it('explica que o Corporativo selecionado só entra na supermeta', () => {
    const html = renderToStaticMarkup(
      <GoalProgress snapshot={snapshotOf({ sellerIds: ['vnd-ana-maria', 'vnd-arthur-lopes'] })} />,
    )

    expect(html).toContain('O Corporativo selecionado contribui apenas para a supermeta.')
  })

  it('mostra estado neutro no resumo da equipe sem vendedor interno elegível', () => {
    const dataset = getCommercialDataset()
    const html = renderToStaticMarkup(
      <TeamSummaryPanel cities={dataset.cities} snapshot={snapshotOf({ cityId: 'terra-preta' })} />,
    )

    expect(html).toContain('Nenhum vendedor interno elegível no recorte atual.')
  })
})
