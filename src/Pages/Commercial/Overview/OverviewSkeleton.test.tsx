import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CommercialOverviewSkeleton } from './OverviewSkeleton'

/**
 * Teste espelho do esqueleto da Visão Geral Comercial: seis cards na grade da
 * página e sete painéis (Safra; cidade, time e origem; evolução mensal e os
 * dois Top 5).
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

describe('esqueleto da Visão Geral Comercial', () => {
  it('filtros, Hoje ao vivo com três caixas, seis cards e sete painéis', () => {
    const html = renderToStaticMarkup(<CommercialOverviewSkeleton />)

    expect(html).toContain('Montando a Visão Geral')
    expect(html).toContain('page-sticky-header')
    expect(count(html, 'h-[68px]')).toBe(3)
    expect(count(html, 'data-skeleton="card"')).toBe(6)
    expect(html).toContain('sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6')
    expect(count(html, 'data-skeleton="chart"')).toBe(7)
  })
})
