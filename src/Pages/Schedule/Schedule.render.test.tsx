import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PreferencesProvider } from '../../contexts/PreferencesContext'
import type { OsScheduleSource } from '../../data/api/osScheduleSource'
import { Schedule, ScheduleContent } from './Schedule'
import { makeScheduleFixture } from './scheduleFixture.testing'
import { EXPANDED_WEEKS } from './scheduleModel'

/**
 * Teste de fumaça da Agenda e capacidade em calendário: a página inteira
 * desenhada sobre a agenda sintética (hoje é sexta 16/10), na ordem aprovada:
 * os dois resumos de semana, o calendário de duas semanas e o rodapé
 * fechado. Desde 21/10/2026 nada abre sozinho: o turno e o nome do dia abrem
 * a janela da agenda, testada em `ScheduleAgendaDialog.test.tsx`. Desde
 * 22/10/2026 a página é de hoje em diante: sem a faixa de título, sem os
 * dias no canto dos painéis, e as setas não voltam antes da semana de hoje
 * (a semana de hoje continua inteira, com o realizado).
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

  it('desenha as faixas na ordem: resumos, calendário de duas semanas e rodapé', () => {
    const ordem = [
      'Esta semana, 12/10 a 18/10',
      'Próxima semana, 19/10 a 25/10',
      'Calendário de agendamento',
      'Cadastro de aptidões a corrigir no SGI: 2 categorias e 4 técnicos',
    ]
    const posicoes = ordem.map((texto) => html.indexOf(texto))
    expect(posicoes.every((posicao) => posicao >= 0)).toBe(true)
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
    expect(count(html, 'data-calendar-day=')).toBe(14)
    expect(html).toContain('Filtros da agenda')
    expect(html).toMatch(/aria-pressed="true"[^>]*>[^<]*2 semanas/)
  })

  it('cada resumo de semana traz as horas livres em destaque, a ocupação e os turnos, sem os dias e sem o realizado', () => {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    expect(text).toContain('Esta semana Horas livres de hoje em diante 128h12 Ocupação da agenda 50%')
    expect(text).toContain('Ocupação da agenda 50% Marcadas 131h Capacidade restante 259h12')
    expect(text).toContain('2 turnos com horas livres · 1 com poucas horas livres · 1 fechado')
    expect(text).not.toContain('0 cheios')
    expect(text).toContain('Próxima semana Horas livres 548h48')
    expect(text).toContain('1 turno cheio: 7h12 além da capacidade')
    // As OS sem turno saíram do painel e da célula (Mário, 22/10/2026); seguem na janela do dia.
    expect(text).not.toContain('OS sem turno')
    expect(text).not.toContain('realizadas até ontem')
    expect(text).not.toContain('16 a 17/10')
  })

  it('não tem a faixa de título nem a hora da leitura, que só volta quando a releitura falha', () => {
    expect(html).not.toContain('Agenda por turno')
    expect(html).not.toContain('lida às')
    expect(html).not.toContain('O serviço não respondeu')
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
    expect(html).toContain('title="Rota fechada: rota travada para Terceirizada"')
    // Lida às 14h32, a manhã de hoje já passou da hora limite do SGI (11h).
    expect(html).toContain('Fechado às 11h')
  })

  it('nada abre sozinho: cada turno e cada nome de dia com agenda abrem a janela', () => {
    // O único 'expandido' da página é o da faixa de filtros, e ele abre fechado.
    expect(count(html, 'aria-expanded="true"')).toBe(0)
    expect(html).not.toContain('O que o SGI já recusa neste turno')
    // 12 dias com agenda (os dois domingos vazios não abrem nada), 2 turnos em
    // cada e o rodapé do cadastro de aptidões.
    expect(count(html, 'aria-haspopup="dialog"')).toBe(12 + 24 + 1)
    expect(html).toContain('Ver o dia inteiro, ')
    expect(html).toContain('Clique para ver as OS do dia inteiro')
  })

  it('o rodapé fica fechado: o cadastro de aptidões só abre ao clicar', () => {
    expect(html).not.toContain('Técnico A')
    expect(html).not.toContain('Câmera Offline')
  })

  it('com quatro semanas, desenha 28 dias', () => {
    const quatro = render(null, EXPANDED_WEEKS)
    expect(count(quatro, 'data-calendar-day=')).toBe(28)
    // O mesmo alcance da seta com 4 semanas: há OS depois da primeira semana.
    expect(quatro).not.toMatch(/aria-label="Semana seguinte"[^>]*disabled=""/)
    expect(quatro).toMatch(/aria-pressed="true"[^>]*>[^<]*4 semanas/)
  })

  it('não usa travessão em texto nenhum', () => {
    expect(html).not.toContain('—')
    expect(html).not.toContain('–')
  })

  it('em hoje, "Hoje" fica aceso, a seta para trás apagada e não há chip de semanas', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>Hoje</)
    expect(html).toMatch(/aria-label="Semana anterior"[^>]*disabled=""[^>]*title="A agenda começa hoje"/)
    expect(html).not.toContain('Semanas: ')
  })

  it('a seta para a frente anda enquanto houver OS marcada depois da primeira semana da tela', () => {
    // A agenda sintética tem OS até o sábado 24/10, na segunda semana da tela.
    expect(html).not.toMatch(/aria-label="Semana seguinte"[^>]*disabled=""/)
    const avancado = (source: OsScheduleSource) =>
      renderToStaticMarkup(
        <PreferencesProvider>
          <ScheduleContent source={source} weekOffset={1} />
        </PreferencesProvider>,
      )
    // Avançada uma semana, a última OS fica na primeira linha, e a seta para,
    // dizendo até onde a leitura olhou (a agenda sintética vai até 08/11).
    expect(avancado(makeScheduleFixture())).toMatch(
      /aria-label="Semana seguinte"[^>]*disabled=""[^>]*title="Não há OS marcadas de 26\/10 a 08\/11"/,
    )
    const base = makeScheduleFixture()
    const comCamera = {
      ...base,
      days: base.days.map((day) => (day.day === '2026-11-04' ? { ...day, scheduled: 1 } : day)),
    }
    expect(avancado(comCamera)).not.toMatch(/aria-label="Semana seguinte"[^>]*disabled=""/)
  })

  it('avisa numa linha quando a última releitura falhou, sem apagar o calendário', () => {
    const stale = render('O serviço não respondeu.')
    expect(stale).toContain('O serviço não respondeu na última tentativa: os números são da leitura das 14h32.')
    expect(stale.indexOf('O serviço não respondeu')).toBeLessThan(stale.indexOf('Esta semana, 12/10 a 18/10'))
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
    expect(selo).toBeGreaterThan(hoje.lastIndexOf('aria-haspopup', hoje.indexOf('data-calendar-day=', 20)))
  })
})

describe('semanas à frente', () => {
  function renderWeeks(props: Partial<ComponentProps<typeof ScheduleContent>>) {
    return renderToStaticMarkup(
      <PreferencesProvider>
        <ScheduleContent source={makeScheduleFixture()} {...props} />
      </PreferencesProvider>,
    )
  }

  it('avançado uma semana, nomeia os painéis e mostra o chip que volta', () => {
    const html = renderWeeks({ weekOffset: 1 })
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    expect(html).toContain('Próxima semana, 19/10 a 25/10')
    // Sem os dias no canto, a semana mais à frente leva as datas no nome.
    expect(text).toContain('Semana de 26/10 a 01/11 Horas livres')
    expect(html).toContain('Semanas: 19/10 a 01/11')
    expect(html).not.toMatch(/aria-pressed="true"[^>]*>Hoje</)
    expect(html).not.toMatch(/aria-label="Semana anterior"[^>]*disabled=""/)
    expect(html).toMatch(/aria-label="Semana seguinte"[^>]*disabled=""[^>]*title="Não há OS marcadas de 26\/10 a 08\/11"/)
  })

  it('enquanto as semanas novas chegam, só os resumos e o calendário ficam em cinza', () => {
    const html = renderWeeks({ weekOffset: 1, weeksLoading: true })
    expect(html).toContain('Filtros da agenda')
    expect(html).toContain('Carregando as semanas escolhidas')
    expect(count(html, 'data-calendar-day=')).toBe(0)
    expect(count(html, 'data-skeleton="day"')).toBe(14)
    expect(html).not.toContain('O que o SGI já recusa neste turno')
    // A leitura em mãos é de outras semanas: a seta espera as novas.
    expect(html).toMatch(/aria-label="Semana seguinte"[^>]*disabled=""[^>]*title="Carregando as semanas escolhidas"/)
  })

  it('se a leitura das semanas falhar, diz isso no lugar do calendário e mantém os filtros', () => {
    const html = renderWeeks({ weekOffset: 1, weeksError: 'O serviço não respondeu.' })
    expect(html).toContain('Filtros da agenda')
    expect(html).toContain('Não foi possível carregar estas semanas')
    expect(count(html, 'data-calendar-day=')).toBe(0)
    // A seta diz a mesma coisa que o painel, e não "carregando".
    expect(html).toMatch(/aria-label="Semana seguinte"[^>]*disabled=""[^>]*title="Não foi possível carregar estas semanas"/)
  })
})
