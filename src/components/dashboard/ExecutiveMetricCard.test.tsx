import { AlertTriangle } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  buildCommercialDelta,
  commercialCardColors,
} from '../../Pages/Commercial/components/commercialCardModel'
import type { KpiDelta } from '../../data/dashboardTypes'
import { ExecutiveMetricCard } from './ExecutiveMetricCard'
import {
  buildDeltaFromKpi,
  buildExecutiveDelta,
  compactPreviousPeriod,
  executiveCardColors,
} from './executiveMetricCardModel'

/**
 * A base compartilhada e o que sobrou da compatibilidade comercial.
 *
 * O comportamento completo do card (variantes, faixas fixas, leitura gerencial,
 * acessibilidade, temas) continua coberto por
 * `Pages/Commercial/components/commercialCard.test.tsx`, que hoje importa este
 * componente diretamente: o card tem UM nome no portal inteiro, e o apelido
 * comercial dele deixou de existir. O modelo ainda tem apelido, e aqui fica
 * provado que ele é o MESMO objeto, e não uma cópia paralela.
 */
describe('compatibilidade comercial da base compartilhada', () => {
  it('reexporta o mesmo modelo, sem cópia paralela', () => {
    expect(buildCommercialDelta).toBe(buildExecutiveDelta)
    expect(commercialCardColors).toBe(executiveCardColors)
  })

  it('mantém as cores de identidade originais e adiciona o vermelho semântico', () => {
    expect(executiveCardColors.green).toBe('#00a862')
    expect(executiveCardColors.amber).toBe('#d97706')
    // O vermelho do card de improdutividade é o mesmo da Improdutiva nos
    // gráficos de OS, e não um tom novo.
    expect(executiveCardColors.red).toBe('#e5484d')
  })

  it('a comparação por taxa aceita a leitura neutra: seta sem cor de julgamento', () => {
    // Total de Vendas (06/10/2026): vender mais ou menos não é bom nem ruim
    // sozinho; a direção fica, a cor não.
    const sobe = buildExecutiveDelta(0.149, 'O total de vendas', undefined, 'neutro')
    const desce = buildExecutiveDelta(-0.149, 'O total de vendas', undefined, 'neutro')

    expect(sobe.label).toBe('▲ 14,9% vs. período anterior')
    expect(sobe.tone).toBe('neutro')
    expect(desce.label).toBe('▼ 14,9% vs. período anterior')
    expect(desce.tone).toBe('neutro')
    // Sem pedir, continua direcional.
    expect(buildExecutiveDelta(0.149, 'O volume').tone).toBe('favoravel')
  })

  it('tem o tom neutro do Total de Vendas, e não o cinza de cancelada da página', () => {
    // 06/10/2026: o cinza #64748b já significa Sem time, Cancelou e Encerrada
    // no Comercial, e sobre a caixa do ícone no escuro fica abaixo de 3,0.
    expect(executiveCardColors.slate).toBe('#6b7a90')
    expect(executiveCardColors.slate).not.toBe('#64748b')
  })
})

function kpiDelta(overrides: Partial<KpiDelta> = {}): KpiDelta {
  return { text: '+12,3%', positive: true, available: true, ...overrides }
}

describe('comparação dos cards de OS derivada do KpiDelta', () => {
  it('mostra crescimento favorável com o rótulo visual e a forma acessível', () => {
    expect(buildDeltaFromKpi(kpiDelta(), 'O volume de OS concluídas')).toEqual({
      label: '▲ 12,3% vs. período anterior',
      accessibleLabel: 'O volume de OS concluídas cresceu 12,3% versus período anterior',
      tone: 'favoravel',
    })
  })

  it('trata redução como favorável quando os agregados dizem que cair é bom', () => {
    // Taxa de improdutividade e tempo médio: `positive` já vem do
    // `higherIsGood` dos agregados, e a direção continua visível na seta.
    expect(
      buildDeltaFromKpi(kpiDelta({ text: '-5,0%', positive: true }), 'A taxa de improdutividade'),
    ).toEqual({
      label: '▼ 5,0% vs. período anterior',
      accessibleLabel: 'A taxa de improdutividade recuou 5,0% versus período anterior',
      tone: 'favoravel',
    })
  })

  it('trata crescimento como desfavorável no indicador de sentido invertido', () => {
    expect(
      buildDeltaFromKpi(kpiDelta({ text: '+8,0%', positive: false }), 'O tempo médio'),
    ).toEqual({
      label: '▲ 8,0% vs. período anterior',
      accessibleLabel: 'O tempo médio cresceu 8,0% versus período anterior',
      tone: 'desfavoravel',
    })
  })

  it('mantém o indicador neutro sem julgamento, com a direção ainda visível', () => {
    const delta = buildDeltaFromKpi(kpiDelta({ text: '-2,0%', positive: false }), 'O total de OS', 'neutro')

    expect(delta.tone).toBe('neutro')
    expect(delta.label).toBe('▼ 2,0% vs. período anterior')
  })

  it('não inventa percentual sem período anterior comparável', () => {
    const delta = buildDeltaFromKpi(
      kpiDelta({ text: 'N/A', positive: false, available: false }),
      'O total de OS',
    )

    expect(delta.tone).toBe('indisponivel')
    expect(delta.label).toBe('Sem período anterior')
    expect(delta.label).not.toMatch(/%/)
    expect(delta.accessibleLabel).not.toMatch(/%/)
  })

  it('converte variação nula em Estável, na linguagem dos cards executivos', () => {
    expect(buildDeltaFromKpi(kpiDelta({ text: '+0,0%' }), 'O total de OS')).toEqual({
      label: 'Estável vs. período anterior',
      accessibleLabel: 'O total de OS ficou estável versus período anterior',
      tone: 'neutro',
    })
  })
})

function renderCard(props: Partial<Parameters<typeof ExecutiveMetricCard>[0]> = {}) {
  return renderToStaticMarkup(
    <ExecutiveMetricCard
      accessibleText="OS Concluídas: 531."
      icon={AlertTriangle}
      label="OS Concluídas"
      onToggle={() => {}}
      open={false}
      readingText="Mede a capacidade real de {entrega}."
      readingTitle="Ordens finalizadas no período."
      theme="light"
      tone="green"
      value="531"
      variant="spark"
      {...props}
    />,
  )
}

/**
 * Conteúdo da descrição acessível ligada por `aria-describedby`.
 *
 * Segue a referência de verdade: extrai o id anunciado no `article` e lê o
 * elemento com aquele id, em vez de procurar o texto solto no HTML. `null`
 * quando o card não liga descrição nenhuma.
 */
function describedText(html: string): string | null {
  const reference = html.match(/aria-describedby="([^"]+)"/)
  if (reference === null) return null
  const marker = `id="${reference[1]}"`
  const start = html.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const contentStart = html.indexOf('>', start) + 1
  return html.slice(contentStart, html.indexOf('</span>', contentStart))
}

/**
 * Anúncio da comparação no foco.
 *
 * O `aria-label` do card substitui o nome calculado pelos filhos, então o
 * `sr-only` da comparação não chegava ao foco. A correção liga esse mesmo texto
 * como descrição acessível, sem mudar o nome aprovado nem o texto visual.
 */
describe('descrição acessível da comparação', () => {
  const favoravel = buildExecutiveDelta(0.08, 'O volume de OS concluídas')

  it('anuncia comparação por extenso e interpretação junto do foco', () => {
    const html = renderCard({ delta: favoravel })
    const description = describedText(html)

    expect(description).toContain(
      'O volume de OS concluídas cresceu 8,0% versus período anterior',
    )
    expect(description).toContain('Resultado favorável.')
    // O nome do card não mudou: indicador, valor e orientação de abrir.
    expect(html).toContain('aria-label="OS Concluídas: 531. Ative para ver a leitura gerencial."')
  })

  it('publica a interpretação de cada tom na descrição', () => {
    expect(describedText(renderCard({ delta: buildExecutiveDelta(-0.031, 'O volume') }))).toContain(
      'Resultado desfavorável.',
    )
    expect(describedText(renderCard({ delta: buildExecutiveDelta(0, 'O volume') }))).toContain(
      'Resultado neutro.',
    )

    const indisponivel = describedText(renderCard({ delta: buildExecutiveDelta(null, 'O volume') }))
    expect(indisponivel).toContain('não há período anterior comparável')
    expect(indisponivel).toContain('Comparação indisponível.')
  })

  it('não inventa descrição em card sem comparação', () => {
    expect(renderCard({ delta: undefined })).not.toContain('aria-describedby')
  })

  it('não liga a descrição quando o nome do velocímetro já traz a comparação', () => {
    const html = renderCard({
      accessibleText:
        'Meta Comercial: 99,4% de atingimento, queda de 3,0% em relação ao período anterior.',
      children: <span>velocimetro</span>,
      delta: favoravel,
      value: undefined,
      variant: 'gauge',
    })

    // Sem descrição ligada, o foco anuncia a comparação uma única vez, pelo
    // nome. O conteúdo sr-only continua existindo para a navegação por leitura.
    expect(html).not.toContain('aria-describedby')
    expect(html).toContain('Resultado favorável.')
  })

  it('respeita a declaração explícita do consumidor sobre o próprio texto', () => {
    const sparkComTextoCompleto = renderCard({ delta: favoravel, deltaInAccessibleText: true })
    const gaugeSemComparacaoNoNome = renderCard({
      children: <span>velocimetro</span>,
      delta: favoravel,
      deltaInAccessibleText: false,
      value: undefined,
      variant: 'gauge',
    })

    expect(sparkComTextoCompleto).not.toContain('aria-describedby')
    expect(describedText(gaugeSemComparacaoNoNome)).toContain('Resultado favorável.')
  })

  it('mantém descrição e orientação corretas no estado aberto', () => {
    const html = renderCard({ delta: favoravel, open: true })

    expect(describedText(html)).toContain('Resultado favorável.')
    expect(html).toContain('Ative para fechar a leitura gerencial.')
    expect(html).toContain('aria-expanded="true"')
  })
})

describe('card executivo com tom vermelho semântico', () => {
  it('pinta a caixa do ícone com a identidade fixa do indicador', () => {
    const html = renderToStaticMarkup(
      <ExecutiveMetricCard
        accessibleText="Taxa Improdutividade: 12,0%."
        icon={AlertTriangle}
        label="Taxa Improdutividade"
        onToggle={() => {}}
        open={false}
        readingText="Cada ponto é {custo} sem entrega."
        readingTitle="Fatia das OS sem resultado."
        theme="light"
        tone="red"
        value="12,0%"
        variant="spark"
      />,
    )

    expect(html).toContain('#e5484d')
    expect(html).toContain('aria-expanded="false"')
  })
})

/**
 * Rótulo da comparação conforme a largura REAL do card.
 *
 * `vs. p.p.` saiu porque se lê como pontos percentuais. O rótulo completo é o
 * padrão, e a forma compacta só existe para o card estreito: as duas vão para
 * o HTML e a container query da face decide qual aparece, então o teste
 * prova a publicação das duas e a ausência de forma compacta onde ela não
 * cabe semanticamente.
 */
describe('rótulo da comparação conforme a largura do card', () => {
  it('troca só a expressão do período anterior pela forma compacta', () => {
    expect(compactPreviousPeriod('▲ 12,3% vs. período anterior')).toBe('▲ 12,3% vs. período ant.')
    expect(compactPreviousPeriod('Estável vs. período anterior')).toBe('Estável vs. período ant.')
    expect(compactPreviousPeriod('Sem período anterior')).toBe('Sem período anterior')
    expect(compactPreviousPeriod('Período anterior incompleto')).toBe('Período anterior incompleto')
  })

  it('publica as duas formas visuais, e a largura da face decide qual aparece', () => {
    const html = renderCard({ delta: buildExecutiveDelta(0.123, 'O volume') })

    expect(html).toContain('@max-[156px]:hidden">▲ 12,3% vs. período anterior<')
    expect(html).toContain('hidden @max-[156px]:inline">▲ 12,3% vs. período ant.<')
    // A face da frente é o contêiner medido pela container query.
    expect(html).toContain('@container col-start-1 row-start-1')
    // A forma acessível continua única e por extenso.
    expect(html).toContain('cresceu 12,3% versus período anterior')
    expect(html).not.toContain('p.p.')
  })

  it('não duplica rótulos que não têm forma compacta', () => {
    const html = renderCard({ delta: buildExecutiveDelta(null, 'O volume') })

    expect(html).toContain('>Sem período anterior<')
    expect(html).not.toContain('@max-[156px]:inline')
  })
})

/**
 * Altura do card executivo.
 *
 * A altura sai do conteúdo: frente e leitura gerencial ficam empilhadas na
 * mesma célula, e o card fica com a altura da face mais alta. O piso de 206px
 * deixou de morar no componente e virou decisão da página que precisa dele.
 */
describe('altura do card executivo', () => {
  it('sem piso, a altura sai do conteúdo: nenhuma altura mínima no card', () => {
    const html = renderCard()

    expect(html).not.toContain('min-height')
    expect(html).not.toContain('min-h-[')
  })

  it('aplica o piso informado pela página', () => {
    expect(renderCard({ minHeight: 206 })).toContain('style="min-height:206px"')
  })

  it('empilha frente e leitura na mesma célula, sem camada absoluta', () => {
    const html = renderCard()

    expect((html.match(/col-start-1 row-start-1/g) ?? []).length).toBe(2)
    expect(html).not.toContain('absolute inset-0')
  })
})

/**
 * Comparação nomeada (22/09/2026): a Visão Geral de OS diz com o que compara
 * no lugar de "período anterior"; os consumidores antigos seguem sem mudança.
 */
describe('comparação nomeada', () => {
  it('troca "período anterior" pelo período de fato, nas duas formas', () => {
    const delta = buildDeltaFromKpi(
      { text: '-4,9%', positive: false, available: true },
      'A taxa de conclusão',
      'direcional',
      { label: 'vs. agosto até o dia 21', long: 'versus agosto até o dia 21' },
    )

    expect(delta.label).toBe('▼ 4,9% vs. agosto até o dia 21')
    expect(delta.accessibleLabel).toBe('A taxa de conclusão recuou 4,9% versus agosto até o dia 21')
    expect(delta.tone).toBe('desfavoravel')
  })

  it('o Estável também nomeia o período', () => {
    const delta = buildDeltaFromKpi(
      { text: '+0,0%', positive: true, available: true },
      'O total de OS',
      'neutro',
      { label: 'vs. agosto', long: 'versus agosto' },
    )

    expect(delta.label).toBe('Estável vs. agosto')
    expect(delta.accessibleLabel).toBe('O total de OS ficou estável versus agosto')
  })
})