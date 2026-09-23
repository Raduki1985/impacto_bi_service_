import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  buildDeltaFromKpi,
  executiveCardColors,
  executiveDeltaColors,
} from '../../components/dashboard/executiveMetricCardModel'
import { DashboardDataProvider } from '../../contexts/DashboardDataContext'
import { PreferencesProvider } from '../../contexts/PreferencesContext'
import {
  buildOverviewOsData,
  OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
} from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_RECORDS } from '../../data/overviewOsData'
import { defaultOverviewOsFilters } from '../../data/overviewOsFilters'
import { OrderStatus } from '../OrderStatus'
import { Overview } from './Overview'
import { buildOverviewKpis } from './overviewModel'
import { outcomeChartHeight } from './overviewOutcomeChartOptions'
import { statusDistributionHeight } from './overviewStatusChartOptions'

/**
 * Teste de fumaça da Visão Geral de OS sobre a fonte REAL sanitizada.
 *
 * A página carrega o próprio provedor: renderizá-la sozinha prova que os
 * registros reais, os sete filtros, a faixa de hoje, os indicadores com as
 * taxas sobre OS de cliente, o destino das OS e os painéis de composição
 * vivem DENTRO da Visão Geral, sem depender do fluxo compartilhado das demais
 * páginas. Os valores esperados saem do MESMO modelo que alimenta a página.
 */
function render() {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <Overview />
    </PreferencesProvider>,
  )
}

const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)
const expectedData = buildOverviewOsData(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)

/** Ordem aprovada dos quatro cards, confirmada no DOM e não só no código. */
const CARD_LABELS = [
  'Total de OS',
  'OS Concluídas',
  'Taxa de Conclusão',
  'Taxa Improdutividade',
] as const

/** Trecho de um único card, do rótulo dele até o fim do próprio `article`. */
function cardOf(html: string, label: string): string {
  const start = html.indexOf(label)
  expect(start).toBeGreaterThan(-1)

  return html.slice(start, html.indexOf('</article>', start))
}

describe('faixa Hoje ao vivo', () => {
  it('com a base local avisa que não existe hoje e não desenha número nenhum', () => {
    const html = render()

    expect(html).toContain('Hoje ao vivo')
    expect(html).toContain('Disponível com o portal ligado ao serviço de BI')
    expect(html).toContain('termina em 21/08/2026')
    expect(html).not.toContain('Agenda do dia')
    expect(html).not.toContain('atualiza a cada minuto')
  })

  it('vem antes dos indicadores do período', () => {
    const html = render()

    expect(html.indexOf('Hoje ao vivo')).toBeLessThan(html.indexOf('Resultado do período'))
    expect(html.indexOf('Resultado do período')).toBeLessThan(html.indexOf('Total de OS'))
  })
})

describe('cards executivos da Visão Geral de OS', () => {
  it('apresenta exatamente quatro cards, na ordem aprovada do DOM', () => {
    const html = render()

    expect((html.match(/<article/g) ?? []).length).toBe(4)
    expect(html).not.toContain('Técnicos Ativos')

    const positions = CARD_LABELS.map((label) => html.indexOf(label))
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1)
    }
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1])
    }
  })

  it('exibe os totais REAIS do período padrão, com as taxas das OS de cliente', () => {
    const html = render()

    expect(html).toContain('Total de OS: 1.248.')
    expect(html).toContain('OS Concluídas: 959.')
    expect(html).toContain('Taxa de Conclusão: 84,1%.')
    expect(html).toContain('Taxa Improdutividade: 11,8%.')

    // E os valores vêm comprovadamente do modelo da página.
    expect(html).toContain(`Taxa de Conclusão: ${kpis.completionRate}.`)
    expect(kpis.total).toBe(expectedData.kpis.total)

    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })

  it('escreve em cada card os números que sustentam o valor', () => {
    const html = render()

    expect(html).toContain('1.113 de cliente · 135 de infraestrutura')
    expect(html).toContain('936 de cliente · 23 de infraestrutura')
    expect(html).toContain('936 de 1.113 OS de cliente')
    expect(html).toContain('131 de 1.113 OS de cliente')
  })

  it('compara com o mês anterior até o mesmo dia (01/07 a 21/07), taxas pela base de cliente', () => {
    const html = render()

    // O card diz com o que compara, e não "período anterior": a base local
    // abre em 01 a 21/08, e a janela anterior é julho até o dia 21.
    expect((html.match(/vs\. julho até o dia 21/g) ?? []).length).toBe(4)
    expect(html).not.toContain('vs. período anterior')
    expect(html).toContain('versus julho até o dia 21')
    expect(html).toContain('▲ 19,4%')
    expect(html).toContain('▲ 13,6%')
    // Sobre OS de cliente a conclusão subiu e a improdutividade caiu; a
    // regra antiga mostrava queda de 4,9% na conclusão por causa da
    // infraestrutura expirada.
    expect(html).toContain('▲ 3,1 p.p. vs. julho até o dia 21')
    expect(html).toContain('▼ 1,4 p.p. vs. julho até o dia 21')
    expect(html).not.toContain('▼ 4,9%')
    expect(html).not.toContain('Sem período anterior')
    expect(html).not.toContain(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
  })

  it('o título da faixa nomeia o período, sem o aviso de dia em andamento', () => {
    const html = render()

    // A base local abre em 01 a 21/08/2026, e o título diz isso por extenso,
    // dentro da etiqueta de destaque.
    expect(html).toMatch(/class="os-period-title[^"]*">Agosto de 2026, até o dia 21</)
    expect(html).not.toContain('agendada no período')
    expect(html).not.toContain('inclui hoje, ainda em andamento')
  })

  it('interpreta a queda da improdutividade e a alta da conclusão como favoráveis', () => {
    const html = render()

    const unproductiveCard = cardOf(html, 'Taxa Improdutividade:')
    expect(unproductiveCard).toContain('recuou 1,4 pontos percentuais')
    expect(unproductiveCard).toContain('Resultado favorável.')
    // A identidade vermelha do indicador não contamina a leitura da
    // comparação: quem cai é a improdutividade, e cair é bom.
    expect(unproductiveCard).toContain(executiveDeltaColors.light.favoravel)
    expect(unproductiveCard).not.toContain(executiveDeltaColors.light.desfavoravel)

    const completionCard = cardOf(html, 'Taxa de Conclusão:')
    expect(completionCard).toContain('Resultado favorável.')
  })

  it('a alta de OS Concluídas é neutra, como a do Total: o volume acompanha a agenda', () => {
    const html = render()

    // Decisão do Mário em 23/09/2026: bom ou ruim é a Taxa de Conclusão. O
    // card diz a direção, mas não a julga.
    const completedCard = cardOf(html, 'OS Concluídas:')
    expect(completedCard).toContain('cresceu 13,6%')
    expect(completedCard).toContain('Resultado neutro.')
    expect(completedCard).toContain(executiveDeltaColors.light.neutro)
    expect(completedCard).not.toContain(executiveDeltaColors.light.favoravel)
  })

  it('a leitura gerencial escreve os números do recorte, e a frente guarda a definição', () => {
    const html = render()

    // Título e texto da leitura saem do modelo, com os números da base local.
    expect(html).toContain('1.248 OS marcadas, 65,7 por dia com agenda.')
    expect(html).toContain('959 OS entregues, 50,5 por dia com agenda.')
    expect(html).toContain('177 não concluíram: 131 improdutivas, 46 não executadas.')
    expect(html).toContain('131 visitas improdutivas: cada uma custa duas vezes.')
    // As chaves viram destaque, e nunca chegam ao HTML.
    expect(html).toContain('>23 de 135</b>')
    expect(html).not.toContain('{Taxa de Conclusão}')

    // A frente fecha com a definição, que não é mais a mesma frase da leitura.
    expect(cardOf(html, 'OS Concluídas:')).toContain(
      'OS em que a visita aconteceu e o serviço foi entregue.</p>',
    )
    expect(cardOf(html, 'Taxa Improdutividade:')).toContain(
      'Percentual das OS de cliente em que o técnico foi e não conseguiu executar.</p>',
    )
    expect(html).not.toContain('acúmulo de backlog')
  })

  it('veste a improdutividade de vermelho', () => {
    const html = render()
    /** Card inteiro, da abertura do `article` até o fechamento dele. */
    const articleOf = (label: string) => {
      const start = html.lastIndexOf('<article', html.indexOf(label))
      expect(start).toBeGreaterThan(-1)

      return html.slice(start, html.indexOf('</article>', start))
    }

    const unproductive = articleOf('Taxa Improdutividade:')
    expect(unproductive).toContain(executiveCardColors.red)
    expect(unproductive).not.toContain(executiveCardColors.amber)
  })

  it('não desenha minigráfico em card nenhum e fecha cada um com a definição do indicador', () => {
    const html = render()

    expect(html).not.toContain('executive-spark-')
    expect((html.match(/<p class="mt-auto pt-2 /g) ?? []).length).toBe(4)
    for (const label of CARD_LABELS) {
      expect(cardOf(html, `${label}:`)).toContain('<p class="mt-auto pt-2 ')
    }
    expect(cardOf(html, 'Total de OS:')).toContain(
      'OS agendadas para o período, em qualquer status.</p>',
    )
    expect(cardOf(html, 'Taxa de Conclusão:')).toContain(
      'Percentual das OS de cliente do período que foram concluídas.</p>',
    )
  })

  it('abre as quatro colunas já no lg: os cards dividem uma linha', () => {
    const html = render()

    expect(html).toContain('sm:grid-cols-2 lg:grid-cols-4')
    expect(html).not.toContain('lg:grid-cols-5')
  })
})

describe('card executivo com período anterior incompleto', () => {
  it('mostra o motivo específico no lugar do aviso padrão, com leitura acessível', () => {
    const incomplete = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-04-06',
      dateTo: '2026-04-30',
    })
    const delta = buildDeltaFromKpi(incomplete.totalDelta, 'O total de OS', 'neutro')

    expect(delta.label).toBe(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    expect(delta.tone).toBe('indisponivel')
    expect(delta.accessibleLabel).toBe(
      'O total de OS: comparação indisponível, o período anterior alcança datas sem cobertura da base',
    )
  })

  it('mantém o aviso padrão dos consumidores antigos quando não há motivo específico', () => {
    const delta = buildDeltaFromKpi({ text: 'N/A', positive: false, available: false }, 'A taxa')

    expect(delta.label).toBe('Sem período anterior')
    expect(delta.accessibleLabel).toBe('A taxa: não há período anterior comparável')
  })
})

describe('painel de filtros, destino e composição', () => {
  /** Trecho de um painel, do título dele até o fim da própria `section`. */
  function panelOf(html: string, title: string): string {
    const start = html.lastIndexOf('<section', html.indexOf(title))
    expect(start).toBeGreaterThan(-1)

    return html.slice(start, html.indexOf('</section>', start))
  }

  it('renderiza o painel dos sete filtros dentro da própria página', () => {
    const html = render()

    expect(html).toContain('Filtros da análise')
    expect(html).toContain('01/08/2026 a 21/08/2026')
  })

  it('prende o painel em uma faixa sticky opaca, contínua ao cabeçalho', () => {
    const html = render()

    const stripStart = html.indexOf('page-sticky-header')
    expect(stripStart).toBeGreaterThan(-1)

    const strip = html.slice(stripStart, html.indexOf('Filtros da análise'))
    expect(strip).toContain('sticky top-0')
    expect(strip).toContain('bg-[var(--surface)]')
    expect(strip).toContain('border-b')
    expect(strip).toContain('-mx-[26px]')

    // A faixa é o cabeçalho da página: vem antes de tudo o mais.
    expect(stripStart).toBeLessThan(html.indexOf('Hoje ao vivo'))
  })

  it('desenha o destino logo depois dos cards e a composição por último', () => {
    const html = render()

    expect(html).toContain('Destino das OS do período')
    expect(html.indexOf('Total de OS')).toBeLessThan(html.indexOf('Destino das OS do período'))
    expect(html.indexOf('Destino das OS do período')).toBeLessThan(
      html.indexOf('Composição do período'),
    )
    for (const title of [
      'Volume diário de OS',
      'Distribuição por status',
      'Composição por tipo de OS',
      'Volume por cidade',
      'Volume por categoria',
      'Resoluções mais frequentes',
    ]) {
      expect(html.indexOf(title)).toBeGreaterThan(html.indexOf('Composição do período'))
    }
  })

  const paineis: { escopo: string; subtitulo?: string; titulo: string }[] = [
    {
      escopo: 'os-outcome',
      subtitulo:
        'OS de cliente e de infraestrutura, com todos os filtros aplicados · passe o mouse para ver percentual e status',
      titulo: 'Destino das OS do período',
    },
    {
      // O painel diário não tem subtítulo no recorte padrão: ele mostra o
      // período filtrado inteiro, e nenhum texto o substitui.
      escopo: 'os-daily-volume',
      titulo: 'Volume diário de OS',
    },
    {
      escopo: 'os-status-distribution',
      subtitulo: 'Comparação entre status no contexto dos demais filtros',
      titulo: 'Distribuição por status',
    },
    {
      escopo: 'os-service-type-mix',
      subtitulo: 'Tipos no contexto dos demais filtros · passe o mouse para ver as categorias',
      titulo: 'Composição por tipo de OS',
    },
    {
      escopo: 'os-city-volume',
      subtitulo: 'Todas as cidades no contexto dos demais filtros',
      titulo: 'Volume por cidade',
    },
    {
      escopo: 'os-category-volume',
      subtitulo: 'Onde a operação mais atua · Top 10',
      titulo: 'Volume por categoria',
    },
    {
      escopo: 'os-resolution-ranking',
      subtitulo: 'Desfecho das OS concluídas · Top 10',
      titulo: 'Resoluções mais frequentes',
    },
  ]

  for (const { escopo, subtitulo, titulo } of paineis) {
    it(`mantém a variante executiva com o escopo do próprio painel: ${titulo}`, () => {
      const panel = panelOf(render(), titulo)

      expect(panel).toContain(escopo)
      expect(panel).toContain(titulo)
      if (subtitulo === undefined) {
        expect(panel).toContain('<div class="mb-2"></div>')
      } else {
        expect(panel).toContain(subtitulo)
      }
      expect(panel).not.toContain('bg-white')
    })
  }

  it('dá aos painéis as alturas calculadas: destino com duas barras, primeira linha igualada', () => {
    const html = render()
    const alturas = (html.match(/height:[0-9]+px/g) ?? []).map((style) =>
      Number(style.slice('height:'.length, -'px'.length)),
    )
    const esperada = statusDistributionHeight(expectedData.charts.statusPairs.length)

    // Destino: cliente e infraestrutura têm OS no recorte padrão, duas barras.
    expect(alturas[0]).toBe(outcomeChartHeight(2))
    // Volume diário e Distribuição por status dividem a linha da grade.
    expect(alturas.slice(1, 3)).toEqual([esperada, esperada])
    expect(esperada).toBe(280)
    // Segunda linha em 280 nos dois; terceira, os dois rankings Top 10 em 250.
    expect(alturas.slice(3)).toEqual([280, 280, 250, 250])
  })

  it('a composição por tipo e por cidade saem dos mesmos agregados do recorte', () => {
    const html = render()

    expect((html.match(/os-mix /g) ?? []).length).toBe(1)
    expect((html.match(/os-ranking /g) ?? []).length).toBe(3)
    const byType = expectedData.charts.serviceTypeSlices.reduce((sum, s) => sum + s.value, 0)
    const byCity = expectedData.charts.cityPairs.reduce((sum, [, v]) => sum + v, 0)
    expect(byType).toBe(1248)
    expect(byCity).toBe(1248)
  })
})

describe('isolamento entre a Visão Geral e as demais páginas de OS', () => {
  it('as demais páginas seguem na simulação, sem o painel nem a faixa da Visão Geral', () => {
    const html = renderToStaticMarkup(
      <PreferencesProvider>
        <DashboardDataProvider>
          <OrderStatus />
        </DashboardDataProvider>
      </PreferencesProvider>,
    )

    expect(html).not.toContain('Filtros da análise')
    expect(html).not.toContain('Limpar filtros')
    expect(html).not.toContain('Hoje ao vivo')
    expect(html).not.toContain('Destino das OS do período')
    expect(html).not.toContain(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    expect(html).not.toContain('page-sticky-header')
    expect(html).not.toContain('sticky top-0')
    expect(html).toContain('Distribuição por status')
    expect(html).toContain('Quantidade por status')
    expect(html).toContain('Status por período do dia')
  })
})

describe('comparação em pontos no card executivo', () => {
  it('diferença nula em pontos vira Estável, como a variação nula em percentual', () => {
    const delta = buildDeltaFromKpi(
      { text: '+0,0 p.p.', positive: true, available: true },
      'A taxa de conclusão',
      'direcional',
    )

    expect(delta.label).toBe('Estável vs. período anterior')
    expect(delta.tone).toBe('neutro')
  })

  it('escreve a queda em pontos, com o rótulo e a leitura acessível por extenso', () => {
    const delta = buildDeltaFromKpi(
      { text: '-1,9 p.p.', positive: false, available: true },
      'A taxa de conclusão',
      'direcional',
    )

    expect(delta.label).toBe('▼ 1,9 p.p. vs. período anterior')
    expect(delta.accessibleLabel).toBe('A taxa de conclusão recuou 1,9 pontos percentuais versus período anterior')
    expect(delta.tone).toBe('desfavoravel')
  })
})
