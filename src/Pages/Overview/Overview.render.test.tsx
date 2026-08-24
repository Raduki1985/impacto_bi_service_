import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { buildDeltaFromKpi } from '../../components/dashboard/executiveMetricCardModel'
import { DashboardDataProvider } from '../../contexts/DashboardDataContext'
import { PreferencesProvider } from '../../contexts/PreferencesContext'
import {
  buildOverviewOsData,
  OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
} from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_RECORDS } from '../../data/overviewOsData'
import { defaultOverviewOsFilters } from '../../data/overviewOsFilters'
import { formatNumber } from '../../lib/formatters'
import { OrderStatus } from '../OrderStatus'
import { Overview } from './Overview'

/**
 * Teste de fumaça da Visão Geral de OS sobre a fonte REAL sanitizada.
 *
 * A página carrega o próprio provedor: renderizá-la sozinha prova que os
 * 4.465 registros reais, os sete filtros e os agregados vivem DENTRO da
 * Visão Geral, sem depender do fluxo compartilhado das demais páginas. Os
 * valores esperados saem dos MESMOS agregados que alimentam a página.
 */
function render() {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <Overview />
    </PreferencesProvider>,
  )
}

/** Os mesmos dados que o provedor entrega à página no recorte padrão. */
const expectedData = buildOverviewOsData(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)

/** Ordem aprovada dos cinco cards, confirmada no DOM e não só no código. */
const CARD_LABELS = [
  'Total de OS',
  'OS Concluídas',
  'Técnicos Ativos',
  'Taxa de Conclusão',
  'Taxa Improdutividade',
] as const

/** Trecho de um único card, do rótulo dele até o fim do próprio `article`. */
function cardOf(html: string, label: string): string {
  const start = html.indexOf(label)
  expect(start).toBeGreaterThan(-1)

  return html.slice(start, html.indexOf('</article>', start))
}

describe('cards executivos da Visão Geral de OS', () => {
  it('apresenta exatamente cinco cards, na ordem aprovada do DOM', () => {
    const html = render()

    expect((html.match(/<article/g) ?? []).length).toBe(5)

    const positions = CARD_LABELS.map((label) => html.indexOf(label))
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1)
    }
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1])
    }
  })

  it('exibe os totais REAIS do período padrão: 1.248, 959, 33, 76,8% e 10,7%', () => {
    const html = render()

    expect(html).toContain('Total de OS: 1.248.')
    expect(html).toContain('OS Concluídas: 959.')
    expect(html).toContain('Técnicos Ativos: 33.')
    expect(html).toContain('Taxa de Conclusão: 76,8%.')
    expect(html).toContain('Taxa Improdutividade: 10,7%.')

    // E os valores vêm comprovadamente dos agregados da fonte real.
    expect(expectedData.kpis.total).toBe('1.248')
    expect(html).toContain(`Total de OS: ${expectedData.kpis.total}.`)
    expect(html).toContain(`Técnicos Ativos: ${formatNumber(expectedData.kpis.activeTechnicians)}.`)

    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })

  it('compara com o período anterior real de mesma duração (11/07 a 31/07)', () => {
    const html = render()

    // Agora existe janela anterior coberta: os quatro cards comparáveis exibem
    // percentual real, e o aviso de ausência sai do recorte padrão.
    expect((html.match(/vs\. p\.p\./g) ?? []).length).toBe(4)
    expect(html).toContain('▲ 12,4%')
    expect(html).toContain('▲ 9,0%')
    expect(html).toContain('▼ 3,1%')
    expect(html).toContain('▼ 12,4%')
    expect(html).not.toContain('Sem período anterior')
    expect(html).not.toContain(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    // Técnicos Ativos segue sem comparação, com o contexto curto de sempre.
    expect(cardOf(html, 'Técnicos Ativos:')).toContain('Em campo no período')
  })

  it('interpreta a queda da improdutividade como favorável e a da conclusão como desfavorável', () => {
    const html = render()

    const unproductiveCard = cardOf(html, 'Taxa Improdutividade:')
    expect(unproductiveCard).toContain('recuou 12,4%')
    expect(unproductiveCard).toContain('Resultado favorável.')

    const completionCard = cardOf(html, 'Taxa de Conclusão:')
    expect(completionCard).toContain('recuou 3,1%')
    expect(completionCard).toContain('Resultado desfavorável.')
  })

  it('desenha um minigráfico real e decorativo em cada um dos cinco cards', () => {
    const html = render()

    for (const label of CARD_LABELS) {
      expect(cardOf(html, `${label}:`)).toContain('executive-spark-')
    }
    expect((html.match(/inset-x-4 bottom-2/g) ?? []).length).toBe(5)
  })
})

describe('card executivo com período anterior incompleto', () => {
  it('mostra o motivo específico no lugar do aviso padrão, com leitura acessível', () => {
    const incomplete = buildOverviewOsData(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-04-06',
      dateTo: '2026-04-30',
    })
    const delta = buildDeltaFromKpi(incomplete.kpis.totalDelta, 'O total de OS', 'neutro')

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

describe('painel de filtros e gráficos da página', () => {
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
    expect(html).toContain(`>${formatNumber(1248)}</b>`)
  })

  it('prende o painel em uma faixa sticky opaca, contínua ao cabeçalho', () => {
    const html = render()

    const stripStart = html.indexOf('page-sticky-header')
    expect(stripStart).toBeGreaterThan(-1)

    // A faixa envolve o painel: as classes estruturais dela vêm antes do
    // título do painel, e o painel vive dentro dela.
    const strip = html.slice(stripStart, html.indexOf('Filtros da análise'))
    // `page-sticky-header` aciona a regra estrutural que zera o respiro
    // superior do `main`, então o `sticky top-0` encosta no cabeçalho sem
    // nenhum offset de altura.
    expect(strip).toContain('sticky top-0')
    expect(strip).toContain('bg-[var(--surface)]')
    expect(strip).toContain('border-b')
    // A margem negativa espelha o respiro horizontal do `main`: a faixa ocupa
    // a largura útil inteira.
    expect(strip).toContain('-mx-[26px]')

    // A faixa é o cabeçalho da página: vem antes dos indicadores e gráficos.
    expect(stripStart).toBeLessThan(html.indexOf('Total de OS'))
  })

  it('a faixa não é mais um card solto: sem canto arredondado nem sombra própria', () => {
    const html = render()
    const stripStart = html.indexOf('page-sticky-header')
    // Da abertura da faixa ao fim da `section` do painel: os cards e gráficos
    // abaixo continuam com os cantos e sombras que sempre tiveram.
    const panel = html.slice(stripStart, html.indexOf('</section>', stripStart))

    expect(panel).not.toContain('rounded-xl')
    expect(panel).not.toContain('shadow')
    // O conteúdo do painel alinha ao respiro horizontal da página.
    expect(panel).toContain('px-[26px]')
  })

  const paineis = [
    {
      escopo: 'os-daily-volume',
      subtitulo: 'Total agendado x concluído - últimos 45 dias',
      titulo: 'Volume diário de OS',
    },
    {
      escopo: 'os-status-distribution',
      subtitulo: 'Comparação entre status no contexto dos demais filtros',
      titulo: 'Distribuição por status',
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
      expect(panel).toContain(subtitulo)
      expect(panel).not.toContain('bg-white')
    })
  }

})

describe('isolamento entre a Visão Geral e as demais páginas de OS', () => {
  it('as demais páginas seguem na simulação, sem o painel da Visão Geral', () => {
    const html = renderToStaticMarkup(
      <PreferencesProvider>
        <DashboardDataProvider>
          <OrderStatus />
        </DashboardDataProvider>
      </PreferencesProvider>,
    )

    // Nenhum filtro da Visão Geral e nenhum rótulo da fonte real.
    expect(html).not.toContain('Filtros da análise')
    expect(html).not.toContain('Limpar filtros')
    expect(html).not.toContain(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    // Nem a faixa fixa, nem um espaço reservado dela: a estrutura sticky
    // pertence só à Visão Geral, e sem a classe o `main` conserva o respiro
    // superior de sempre.
    expect(html).not.toContain('page-sticky-header')
    expect(html).not.toContain('sticky top-0')
    // A página continua renderizando os painéis simulados de sempre.
    expect(html).toContain('Distribuição por status')
    expect(html).toContain('Quantidade por status')
    expect(html).toContain('Status por período do dia')
  })
})
