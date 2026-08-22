import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DashboardDataProvider } from '../../contexts/DashboardDataContext'
import { PreferencesProvider } from '../../contexts/PreferencesContext'
import { buildDashboardData } from '../../data/dashboardAggregates'
import {
  applyDashboardFilters,
  applyPreviousPeriodFilters,
  defaultDashboardFilters,
} from '../../data/dashboardFilters'
import { orders } from '../../data/mockOsData'
import { formatNumber } from '../../lib/formatters'
import { Overview } from './Overview'

/**
 * Teste de fumaça da Visão Geral de OS.
 *
 * Existe por causa da adoção do card executivo compartilhado: ele prova que os
 * cinco indicadores aprovados continuam completos, na ordem aprovada e com os
 * valores dos MESMOS agregados de sempre, que cada card ganhou minigráfico
 * real, e que a comparação não inventa percentual quando o recorte padrão não
 * tem período anterior com dados. Também guarda a saída do card de tempo médio
 * e a identidade amarela transferida para a Taxa Improdutividade.
 */
function render() {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <DashboardDataProvider>
        <Overview />
      </DashboardDataProvider>
    </PreferencesProvider>,
  )
}

/** Os mesmos dados que o provider entrega à página no recorte padrão. */
function expectedData() {
  const filteredRows = applyDashboardFilters(orders, defaultDashboardFilters)
  const previousRows = applyPreviousPeriodFilters(orders, defaultDashboardFilters)
  return buildDashboardData(filteredRows, { previousRows })
}

/** Ordem aprovada dos cinco cards, confirmada no DOM e não só no código. */
const CARD_LABELS = [
  'Total de OS',
  'OS Concluídas',
  'Técnicos Ativos',
  'Taxa de Conclusão',
  'Taxa Improdutividade',
] as const

const READING_TITLES = [
  'Todas as ordens de serviço abertas no período.',
  'Ordens efetivamente finalizadas no período.',
  'Técnicos que atuaram em campo no período.',
  'Percentual das OS do período que foram concluídas.',
  'Fatia das OS que não geraram resultado produtivo.',
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

    // Cada card executivo é um `article`; os painéis de gráfico são `section`.
    expect((html.match(/<article/g) ?? []).length).toBe(5)

    // A primeira ocorrência de cada rótulo está no `aria-label` do próprio
    // card, então posições crescentes provam a ordem visual no DOM.
    const positions = CARD_LABELS.map((label) => html.indexOf(label))
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1)
    }
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index]).toBeGreaterThan(positions[index - 1])
    }
  })

  it('não exibe mais o card de tempo médio, nem no conteúdo acessível', () => {
    const html = render()

    expect(html).not.toContain('Tempo Médio Atend.')
    expect(html).not.toContain('Tempo médio para concluir cada atendimento.')
    expect(html).not.toContain('tempo médio de atendimento')
  })

  it('mantém cada um dos cinco cards como botão de leitura gerencial', () => {
    const html = render()

    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBe(5)
    expect((html.match(/Leitura gerencial/g) ?? []).length).toBe(5)
    expect((html.match(/OBSERVAR/g) ?? []).length).toBe(5)
    expect((html.match(/Ative para ver a leitura gerencial\./g) ?? []).length).toBe(5)
  })

  it('preserva os nomes e os valores dos agregados de sempre', () => {
    const html = render()
    const { kpis } = expectedData()

    expect(html).toContain(`Total de OS: ${kpis.total}.`)
    expect(html).toContain(`OS Concluídas: ${kpis.completed}.`)
    expect(html).toContain(`Técnicos Ativos: ${formatNumber(kpis.activeTechnicians)}.`)
    expect(html).toContain(`Taxa de Conclusão: ${kpis.completionRate}.`)
    expect(html).toContain(`Taxa Improdutividade: ${kpis.unproductiveRate}.`)

    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).not.toContain('undefined')
  })

  it('preserva os textos gerenciais aprovados, com destaques sem chaves', () => {
    const html = render()

    for (const title of READING_TITLES) {
      expect(html).toContain(title)
    }
    // O trecho entre chaves vira destaque e as chaves não chegam à tela.
    expect(html).toContain('conclusão')
    expect(html).not.toContain('{conclusão}')
    expect(html).toContain('Crescer o total sem crescer a conclusão vira acúmulo de backlog.')
    expect(html).toContain('Abra por motivo e por técnico para atacar a causa raiz.')
  })

  it('usa a identidade amarela na Taxa Improdutividade, sem vermelho', () => {
    const card = cardOf(render(), 'Taxa Improdutividade:')

    // `#d97706` é o `amber` oficial da paleta compartilhada: colore a caixa do
    // ícone de alerta e o minigráfico via `executiveCardColors[tone]`.
    expect(card).toContain('#d97706')
    // Nenhum destaque vermelho de identidade sobra no card: a interpretação da
    // comparação continua vindo dos agregados, não da cor do indicador.
    expect(card).not.toContain('#e5484d')
  })

  it('mantém Técnicos Ativos violeta e sem julgamento', () => {
    const card = cardOf(render(), 'Técnicos Ativos:')

    expect(card).toContain('#8b5cf6')
    expect(card).toContain('Em campo no período')
  })

  it('desenha um minigráfico real e decorativo em cada um dos cinco cards', () => {
    const html = render()

    for (const label of CARD_LABELS) {
      expect(cardOf(html, `${label}:`)).toContain('executive-spark-')
    }
    // Exatamente cinco: a faixa `inset-x-4 bottom-2` é exclusiva do sparkline.
    expect((html.match(/inset-x-4 bottom-2/g) ?? []).length).toBe(5)
    // Decorativo: o svg é escondido do leitor de tela; o valor e a comparação
    // continuam no nome acessível do card.
    expect((html.match(/<svg aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })

  it('não inventa percentual no recorte padrão, que não tem período anterior', () => {
    const html = render()

    // A base mockada cobre só 01/08 a 21/08: a janela anterior (julho) não tem
    // OS, então os quatro cards comparáveis dizem isso em vez de exibir número.
    expect((html.match(/Sem período anterior/g) ?? []).length).toBe(4)
    expect((html.match(/não há período anterior comparável/g) ?? []).length).toBe(4)
    expect(html).not.toContain('vs. p.p.')
    // O rótulo antigo saiu junto com o card antigo.
    expect(html).not.toContain('N/A')
    // Técnicos Ativos segue sem comparação, com o contexto curto de sempre.
    expect(cardOf(html, 'Técnicos Ativos:')).toContain('Em campo no período')
  })

  it('anuncia a comparação no foco pela descrição acessível de cada card', () => {
    const html = render()
    const articleTags = html.match(/<article[^>]*>/g) ?? []

    // Os cinco cards ligam a comparação como descrição: o aria-label substitui
    // o nome calculado pelos filhos, então sem o aria-describedby o foco não
    // anunciaria a comparação nem a interpretação.
    expect(articleTags.filter((tag) => tag.includes('aria-describedby')).length).toBe(5)
    // Recorte padrão sem período anterior: a indisponibilidade é anunciada.
    expect((html.match(/Comparação indisponível\./g) ?? []).length).toBe(4)
    expect(cardOf(html, 'Técnicos Ativos:')).toContain(
      'técnicos em campo no período. Resultado neutro.',
    )
  })

  it('não reserva uma sexta coluna na grade de telas muito largas', () => {
    const html = render()

    expect(html).toContain('2xl:grid-cols-5')
    expect(html).not.toContain('2xl:grid-cols-6')
    // As larguras menores seguem com a progressão de sempre.
    expect(html).toContain('sm:grid-cols-2')
    expect(html).toContain('lg:grid-cols-3')
  })

  it('escopa a coleção para os ajustes de tema escuro dos cards', () => {
    const html = render()

    expect(html).toContain('os-executive-cards')
    // O restante da página continua fora do escopo da coleção.
    expect(html).toContain('Volume diário de OS')
    expect(html).toContain('Distribuição por status')
  })
})

/**
 * Painéis de gráfico da página.
 *
 * Os quatro adotam a variante executiva, cada um com o próprio escopo de tema.
 * O teste guarda tanto a adoção quanto a separação: nenhum painel pode herdar o
 * escopo de outro, porque é o escopo que carrega a superfície escura.
 */
describe('painéis de gráfico da Visão Geral de OS', () => {
  /** Trecho de um painel, do título dele até o fim da própria `section`. */
  function panelOf(html: string, title: string): string {
    const start = html.lastIndexOf('<section', html.indexOf(title))
    expect(start).toBeGreaterThan(-1)

    return html.slice(start, html.indexOf('</section>', start))
  }

  const paineis = [
    {
      escopo: 'os-daily-volume',
      subtitulo: 'Total agendado x concluído - últimos 45 dias',
      titulo: 'Volume diário de OS',
    },
    {
      escopo: 'os-status-distribution',
      subtitulo: 'Participação de cada status',
      titulo: 'Distribuição por status',
    },
    {
      escopo: 'os-category-volume',
      subtitulo: 'Onde a operação mais atua',
      titulo: 'Volume por categoria',
    },
    {
      escopo: 'os-resolution-ranking',
      subtitulo: 'Desfecho das OS concluídas · Top 10',
      titulo: 'Resoluções mais frequentes',
    },
  ]

  for (const { escopo, subtitulo, titulo } of paineis) {
    it(`usa a variante executiva com o escopo do próprio painel: ${titulo}`, () => {
      const panel = panelOf(render(), titulo)

      expect(panel).toContain(escopo)
      expect(panel).toContain('bg-[var(--surface)]')
      expect(panel).toContain('shadow-sm')
      expect(panel).toContain('text-[var(--text-heading)]')
      // Nenhum painel branco sobrou entre os gráficos da página.
      expect(panel).not.toContain('bg-white')
      // Nome e subtítulo aprovados seguem intactos.
      expect(panel).toContain(titulo)
      expect(panel).toContain(subtitulo)
    })
  }

  it('não deixa nenhum painel herdar o escopo de outro', () => {
    const html = render()

    for (const { escopo, titulo } of paineis) {
      const panel = panelOf(html, titulo)

      for (const outro of paineis) {
        if (outro.escopo === escopo) continue
        expect(panel).not.toContain(outro.escopo)
      }
    }
  })

  it('agrupa os dois rankings sob o escopo comum de tema', () => {
    const html = render()

    // `os-ranking` é o escopo compartilhado da superfície escura; o escopo
    // individual identifica cada painel.
    for (const titulo of ['Volume por categoria', 'Resoluções mais frequentes']) {
      expect(panelOf(html, titulo)).toContain('os-ranking')
    }
    for (const titulo of ['Volume diário de OS', 'Distribuição por status']) {
      expect(panelOf(html, titulo)).not.toContain('os-ranking')
    }
  })

  it('mantém os dois rankings lado a lado na grade de telas largas', () => {
    const html = render()
    const start = html.indexOf('Volume por categoria')
    const grade = html.lastIndexOf('lg:grid-cols-2', start)

    expect(grade).toBeGreaterThan(-1)
    expect(grade).toBeLessThan(start)
  })
})
