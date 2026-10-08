import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TechniciansPageSkeleton, TechniciansPeriodSkeleton } from './TechniciansSkeleton'

/**
 * Teste espelho do esqueleto da Gestão de Técnicos: quatro cards, dois painéis
 * de ranking por frente e a fileira de contexto (motivos e a tabela de
 * desempenho por técnico).
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

describe('esqueleto da Gestão de Técnicos', () => {
  it('primeira carga: filtros, quatro cards e quatro painéis, o último como tabela', () => {
    const html = renderToStaticMarkup(<TechniciansPageSkeleton />)

    expect(html).toContain('Carregando as visitas dos técnicos')
    expect(html).toContain('page-sticky-header')
    expect(count(html, 'data-skeleton="card"')).toBe(4)
    expect(count(html, 'data-skeleton="chart"')).toBe(4)
    expect(count(html, 'width:100%')).toBeGreaterThanOrEqual(9)
  })

  it('troca de período: sem a faixa de filtros, que continua na tela', () => {
    const html = renderToStaticMarkup(<TechniciansPeriodSkeleton />)

    expect(html).toContain('Carregando o período')
    expect(html).not.toContain('page-sticky-header')
    expect(count(html, 'data-skeleton="card"')).toBe(4)
  })
})
