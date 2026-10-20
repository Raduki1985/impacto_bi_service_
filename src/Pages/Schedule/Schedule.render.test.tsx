import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../contexts/PreferencesContext'
import { Schedule, ScheduleContent } from './Schedule'
import { makeScheduleFixture } from './scheduleFixture.testing'
import { EXPANDED_WEEKS, MAX_PAST_WEEKS } from './scheduleModel'

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
      '12/10 a 25/10 · agenda do SGI lida às 14h32 · capacidade pela conta do SGI, técnicos ativos no cadastro, 3h12 por técnico por turno · clique num turno para ver as categorias',
    )
  })

  it('responde cada turno em horas, com a palavra junto da cor, e marca hoje e o realizado', () => {
    const text = html.replace(/<[^>]+>/g, '')
    expect(text).toContain('Hoje 16/10')
    expect(text).toContain('Agora: 35 disponíveis')
    expect(text).toContain('Realizado')
    expect(text).toContain('56h30 livres')
    expect(text).toContain('só 7h12 livres')
    expect(text).toContain('excedeu 7h12')
    expect(text).toContain('92h48 livres')
    expect(html).toContain('title="97h30 marcadas de 124h48 de capacidade (78%)"')
    expect(html).toContain('Sem estimativa')
    expect(html).toContain('Sem agenda')
    // O selo do dia: o feriado do calendário e a rota travada de terça 20/10,
    // que não é hoje e por isso fica na segunda linha do dia.
    expect(text).toContain('Feriado · Aparecida')
    expect(html).toContain('title="Rota fechada: rota travada para Terceirizada · 1 OS sem turno"')
    expect(html).toContain('1 OS sem turno')
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
    // As horas de uma OS aparecem em toda linha do detalhe, inclusive na que o SGI recusa.
    expect(html.replace(/<[^>]+>/g, '')).toContain('Instalação de 2 Câmeras1h20 cada · 4 técnicos aptos · 6 OS marcadas')
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

  it('em hoje, "Hoje" fica aceso, a seta para a frente apagada e não há chip de semanas', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Hoje</)
    expect(html).toMatch(/aria-label="Semana seguinte"[^>]*disabled=""/)
    expect(html).not.toMatch(/aria-label="Semana anterior"[^>]*disabled=""/)
    expect(html).not.toContain('Semanas: ')
  })

  it('avisa na faixa de título quando a última releitura falhou, sem apagar o calendário', () => {
    const stale = render('O serviço não respondeu.')
    expect(stale).toContain('o serviço não respondeu na última tentativa')
    expect(count(stale, 'data-calendar-day=')).toBe(14)
  })
})

describe('selo de rota travada no dia de hoje', () => {
  it('vai para o pé do card, depois dos turnos, porque a segunda linha é do "Agora"', () => {
    const base = makeScheduleFixture()
    const source = {
      ...base,
      days: base.days.map((day) =>
        day.day === base.today
          ? { ...day, closures: [{ name: 'BARRAMENTO', group: 'BARRAMENTO', teams: ['Terceirizada'] }] }
          : day,
      ),
    }
    const html = renderToStaticMarkup(
      <PreferencesProvider>
        <ScheduleContent source={source} />
      </PreferencesProvider>,
    )
    const hoje = html.slice(html.indexOf(`data-calendar-day="${base.today}"`))
    const selo = hoje.indexOf('title="Barramento: rota travada para Terceirizada"')
    expect(hoje.indexOf('Agora:')).toBeGreaterThan(-1)
    expect(selo).toBeGreaterThan(hoje.lastIndexOf('aria-expanded', hoje.indexOf('data-calendar-day=', 20)))
  })
})

describe('semanas anteriores', () => {
  function renderWeeks(props: Partial<ComponentProps<typeof ScheduleContent>>) {
    return renderToStaticMarkup(
      <PreferencesProvider>
        <ScheduleContent source={makeScheduleFixture()} {...props} />
      </PreferencesProvider>,
    )
  }

  it('voltado uma semana, nomeia as semanas pela distância de hoje e mostra o chip que volta', () => {
    const html = renderWeeks({ weekOffset: -1 })
    expect(html).toContain('Semana passada, 05/10 a 11/10')
    expect(html).toContain('Esta semana, 12/10 a 18/10')
    expect(html).toContain('Semanas: 05/10 a 18/10')
    expect(html).toContain('05/10 a 18/10 · agenda do SGI')
    expect(html).not.toMatch(/aria-pressed="true"[^>]*>Hoje</)
    expect(html).not.toMatch(/aria-label="Semana seguinte"[^>]*disabled=""/)
  })

  it('no limite de oito semanas, a seta para trás fica apagada com o motivo', () => {
    const html = renderWeeks({ weekOffset: -MAX_PAST_WEEKS })
    expect(html).toMatch(/aria-label="Semana anterior"[^>]*disabled=""[^>]*title="O calendário volta até 8 semanas antes desta"/)
  })

  it('enquanto as semanas novas chegam, só os resumos e o calendário ficam em cinza', () => {
    const html = renderWeeks({ weekOffset: -1, weeksLoading: true })
    expect(html).toContain('Filtros da agenda')
    expect(html).toContain('Carregando as semanas escolhidas')
    expect(count(html, 'data-calendar-day=')).toBe(0)
    expect(count(html, 'data-skeleton="day"')).toBe(14)
    expect(html).not.toContain('O que o SGI já recusa neste turno')
    // A hora em mãos é da leitura das semanas anteriores: não vai para o título.
    expect(html).not.toContain('lida às')
  })

  it('se a leitura das semanas falhar, diz isso no lugar do calendário e mantém os filtros', () => {
    const html = renderWeeks({ weekOffset: -1, weeksError: 'O serviço não respondeu.' })
    expect(html).toContain('Filtros da agenda')
    expect(html).toContain('Não foi possível carregar estas semanas')
    expect(count(html, 'data-calendar-day=')).toBe(0)
  })
})
