import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OverviewPageSkeleton, OverviewPeriodSkeleton } from './OverviewSkeleton'

/**
 * Teste espelho do esqueleto da Visão Geral de OS: o mesmo número de cards e
 * de painéis da página real (quatro cards; Destino, Volume diário, Motivos,
 * Composição por tipo, Volume por cidade, Volume por categoria e Resoluções),
 * para o cinza não prometer um desenho que a página não tem.
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

describe('esqueleto da Visão Geral de OS', () => {
  it('primeira carga: filtros, Hoje ao vivo com seis caixas, quatro cards e sete painéis', () => {
    const html = renderToStaticMarkup(<OverviewPageSkeleton />)

    expect(html).toContain('Carregando as ordens de serviço')
    expect(html).toContain('page-sticky-header')
    expect(count(html, 'data-skeleton="live-strip"')).toBe(1)
    expect(count(html, 'h-[68px]')).toBe(6)
    expect(count(html, 'data-skeleton="card"')).toBe(4)
    expect(count(html, 'data-skeleton="chart"')).toBe(7)
  })

  it('troca de período: só o período, porque filtros e Hoje ao vivo continuam na tela', () => {
    const html = renderToStaticMarkup(<OverviewPeriodSkeleton />)

    expect(html).toContain('Carregando o período')
    expect(html).not.toContain('page-sticky-header')
    expect(html).not.toContain('data-skeleton="live-strip"')
    expect(count(html, 'data-skeleton="card"')).toBe(4)
    expect(count(html, 'data-skeleton="chart"')).toBe(7)
  })

  it('Destino das OS tem a altura do gráfico real de dois grupos', () => {
    const html = renderToStaticMarkup(<OverviewPeriodSkeleton />)

    // 52 + 2 grupos x 56, a conta de outcomeChartHeight.
    expect(html).toContain('height:164px')
  })
})
