import { AlertTriangle } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  CommercialExecutiveCard,
  CommercialSparkline,
} from '../../Pages/Commercial/components/CommercialExecutiveCard'
import {
  buildCommercialDelta,
  commercialCardColors,
} from '../../Pages/Commercial/components/commercialCardModel'
import type { KpiDelta } from '../../data/dashboardTypes'
import { ExecutiveMetricCard, ExecutiveSparkline } from './ExecutiveMetricCard'
import {
  buildDeltaFromKpi,
  buildExecutiveDelta,
  executiveCardColors,
} from './executiveMetricCardModel'

/**
 * A base compartilhada e a compatibilidade comercial.
 *
 * O comportamento completo do card (variantes, faixas fixas, leitura gerencial,
 * acessibilidade, temas) continua coberto por
 * `Pages/Commercial/components/CommercialExecutiveCard.test.tsx`, que agora
 * exercita exatamente este componente através da camada de compatibilidade.
 * Aqui ficam as garantias novas da extração: a compatibilidade é o MESMO
 * objeto, e não uma cópia, e o minigráfico aceita lacunas.
 */
describe('compatibilidade comercial da base compartilhada', () => {
  it('reexporta o mesmo componente e o mesmo modelo, sem cópia paralela', () => {
    expect(CommercialExecutiveCard).toBe(ExecutiveMetricCard)
    expect(CommercialSparkline).toBe(ExecutiveSparkline)
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
})

function kpiDelta(overrides: Partial<KpiDelta> = {}): KpiDelta {
  return { text: '+12,3%', positive: true, available: true, ...overrides }
}

describe('comparação dos cards de OS derivada do KpiDelta', () => {
  it('mostra crescimento favorável com a abreviação e a forma longa', () => {
    expect(buildDeltaFromKpi(kpiDelta(), 'O volume de OS concluídas')).toEqual({
      label: '▲ 12,3% vs. p.p.',
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
      label: '▼ 5,0% vs. p.p.',
      accessibleLabel: 'A taxa de improdutividade recuou 5,0% versus período anterior',
      tone: 'favoravel',
    })
  })

  it('trata crescimento como desfavorável no indicador de sentido invertido', () => {
    expect(
      buildDeltaFromKpi(kpiDelta({ text: '+8,0%', positive: false }), 'O tempo médio'),
    ).toEqual({
      label: '▲ 8,0% vs. p.p.',
      accessibleLabel: 'O tempo médio cresceu 8,0% versus período anterior',
      tone: 'desfavoravel',
    })
  })

  it('mantém o indicador neutro sem julgamento, com a direção ainda visível', () => {
    const delta = buildDeltaFromKpi(kpiDelta({ text: '-2,0%', positive: false }), 'O total de OS', 'neutro')

    expect(delta.tone).toBe('neutro')
    expect(delta.label).toBe('▼ 2,0% vs. p.p.')
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
      label: 'Estável vs. p.p.',
      accessibleLabel: 'O total de OS ficou estável versus período anterior',
      tone: 'neutro',
    })
  })
})

function renderSparkline(points: readonly (number | null)[]) {
  return renderToStaticMarkup(<ExecutiveSparkline color="#2f7de1" points={points} />)
}

describe('minigráfico com lacunas', () => {
  it('desenha série contínua como uma única área decorativa', () => {
    const html = renderSparkline([1, 2, 3])

    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('executive-spark-')
    expect((html.match(/<polygon/g) ?? []).length).toBe(1)
    expect((html.match(/<polyline/g) ?? []).length).toBe(1)
  })

  it('interrompe a linha na lacuna em vez de desenhar zero', () => {
    const html = renderSparkline([1, 2, null, 3, 4])

    // Dois trechos independentes: a lacuna não vira ponto e não é ligada.
    expect((html.match(/<polygon/g) ?? []).length).toBe(2)
    expect((html.match(/<polyline/g) ?? []).length).toBe(2)
  })

  it('preserva ponto válido isolado como marcador', () => {
    const html = renderSparkline([1, null, 2])

    expect((html.match(/<polygon/g) ?? []).length).toBe(0)
    expect((html.match(/<polyline/g) ?? []).length).toBe(2)
  })

  it('não desenha nada sem ponto válido, mantendo o card estável', () => {
    expect(renderSparkline([])).toBe('')
    expect(renderSparkline([null, null, null])).toBe('')
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
