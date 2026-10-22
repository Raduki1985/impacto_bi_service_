import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SchedulePageSkeleton } from './ScheduleSkeleton'

/**
 * Teste espelho do esqueleto da Agenda e capacidade: os dois resumos de
 * semana e o calendário de duas semanas (14 dias), sem o painel do detalhe,
 * que virou janela em 21/10/2026, para o cinza não prometer um desenho que a
 * página não tem.
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

describe('esqueleto da Agenda e capacidade', () => {
  it('desenha os dois resumos e o calendário de duas semanas, sem detalhe e sem número', () => {
    const html = renderToStaticMarkup(<SchedulePageSkeleton />)

    expect(html).toContain('Carregando a agenda e a capacidade')
    expect(html).toContain('page-sticky-header')
    expect(count(html, 'data-skeleton="summary"')).toBe(2)
    expect(count(html, 'data-skeleton="calendar"')).toBe(1)
    expect(count(html, 'data-skeleton="day"')).toBe(14)
    expect(count(html, 'data-skeleton="shift"')).toBe(28)
    expect(count(html, 'data-skeleton="chart"')).toBe(0)
    expect(html).not.toMatch(/\d+ OS/)
  })
})
