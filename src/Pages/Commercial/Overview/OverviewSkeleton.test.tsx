import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CommercialOverviewSkeleton } from './OverviewSkeleton'

/**
 * Teste espelho do esqueleto da Visão Geral Comercial: seis cards na grade da
 * página e sete painéis (Evolução mensal das vendas; cidade, time e origem;
 * vendas ativadas por mês e os dois rankings, com rolagem).
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

describe('esqueleto da Visão Geral Comercial', () => {
  it('filtros, Hoje ao vivo com cinco caixas numa fileira, seis cards e sete painéis', () => {
    const html = renderToStaticMarkup(<CommercialOverviewSkeleton />)

    expect(html).toContain('Montando a Visão Geral')
    expect(html).toContain('page-sticky-header')
    // Vendidas, as três da esteira e Ativadas, numa fileira, no estilo da faixa de OS (08/10/2026).
    expect(count(html, 'data-skeleton="live-box"')).toBe(5)
    expect(html).toContain('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5')
    expect(count(html, 'data-skeleton="card"')).toBe(6)
    expect(html).toContain('sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6')
    expect(count(html, 'data-skeleton="chart"')).toBe(7)
  })
})
