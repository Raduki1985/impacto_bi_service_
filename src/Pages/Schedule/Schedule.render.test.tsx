import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../contexts/PreferencesContext'
import { Schedule, ScheduleContent } from './Schedule'
import { makeScheduleFixture } from './scheduleFixture.testing'
import { EXPANDED_WEEKS } from './scheduleModel'

/**
 * Teste de fumaça da Agenda e capacidade em calendário: a página inteira
 * desenhada sobre a agenda sintética, na ordem aprovada em 19/10/2026: a
 * faixa de título, os dois resumos de semana, o calendário de
 * duas semanas, o detalhe do primeiro turno de amanhã e o rodapé fechado.
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

function render(staleMessage: string | null = null, initialWeeks?: number) {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <ScheduleContent initialWeeks={initialWeeks} source={makeScheduleFixture()} staleMessage={staleMessage} />
    </PreferencesProvider>,
  )
}

describe('página sem o serviço de BI', () => {
  it('avisa que precisa do serviço e não desenha o calendário', () => {
    const html = renderToStaticMarkup(
      <PreferencesProvider>
        <Schedule />
      </PreferencesProvider>,
    )

    expect(html).toContain('A Agenda e capacidade lê o serviço de BI')
    expect(html).not.toContain('data-calendar-day')
  })
})

describe('Agenda e capacidade', () => {
  const html = render()

  it('desenha as faixas na ordem: título, resumos, calendário de duas semanas, detalhe e rodapé', () => {
    const ordem = [
      'Agenda por turno',
      'Esta semana, 12/10 a 18/10',
      'Próxima semana, 19/10 a 25/10',
      'Calendário de agendamento',
      'Amanhã, sábado 17/10, manhã',
      'Cadastro de aptidões a corrigir no SGI: 2 categorias e 4 técnicos',
    ]
    const posicoes = ordem.map((texto) => html.indexOf(texto))
    expect(posicoes.every((posicao) => posicao >= 0)).toBe(true)
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
    expect(count(html, 'data-calendar-day=')).toBe(14)
    expect(html).toContain('Filtros da agenda')
    expect(html).toMatch(/aria-pressed="true"[^>]*>[^<]*2 semanas/)
  })

  it('escreve a janela, a hora da leitura e a regra da capacidade na faixa de título', () => {
    expect(html).toContain(
      '12/10 a 25/10 · agenda do SGI lida às 14h32 · capacidade pela conta com os técnicos presentes, 3h12 por técnico por turno · clique num turno para ver as categorias',
    )
  })

  it('responde cada turno em horas, com a palavra junto da cor, e marca hoje e o realizado', () => {
    expect(html).toContain('>Hoje<')
    expect(html).toContain('Realizado')
    expect(html).toContain('Cabe mais 56h30')
    expect(html).toContain('Quase cheio · sobram 7h12')
    expect(html).toContain('Cheio · passou 7h12')
    expect(html).toContain('Livre')
    expect(html).toContain('Sem estimativa')
    expect(html).toContain('Sem agenda')
    expect(html).toContain('Feriado')
    expect(html).toContain('1 sem turno')
    // Lida às 14h32, a manhã de hoje já passou da hora limite do SGI (11h).
    expect(html).toContain('Fechado às 11h')
    expect(html).toContain('entre as categorias com OS no dia')
  })

  it('abre com o primeiro turno de amanhã e o detalhe por categoria', () => {
    expect(count(html, 'aria-expanded="true"')).toBe(1)
    expect(html).toContain('O que o SGI já recusa neste turno')
    expect(html).toContain('Instalação de 2 Câmeras')
    expect(html).toContain('Cabe mais 12')
    expect(html).toContain('Sempre cabe')
  })

  it('o rodapé fica fechado: o cadastro de aptidões só abre ao clicar', () => {
    expect(html).not.toContain('Técnico A')
    expect(html).not.toContain('Câmera Offline')
  })

  it('com quatro semanas, desenha 28 dias', () => {
    const quatro = render(null, EXPANDED_WEEKS)
    expect(count(quatro, 'data-calendar-day=')).toBe(28)
    expect(quatro).toMatch(/aria-pressed="true"[^>]*>[^<]*4 semanas/)
  })

  it('não usa travessão em texto nenhum', () => {
    expect(html).not.toContain('—')
    expect(html).not.toContain('–')
  })

  it('avisa na faixa de título quando a última releitura falhou, sem apagar o calendário', () => {
    const stale = render('O serviço não respondeu.')
    expect(stale).toContain('o serviço não respondeu na última tentativa')
    expect(count(stale, 'data-calendar-day=')).toBe(14)
  })
})
