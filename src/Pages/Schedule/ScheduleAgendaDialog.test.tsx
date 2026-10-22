import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { OsScheduleListSource } from '../../data/api/osOverviewSource'
import type { OsScheduleSource } from '../../data/api/osScheduleSource'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { ScheduleAgendaPanel } from './ScheduleAgendaDialog'
import { makeScheduleFixture } from './scheduleFixture.testing'
import type { AgendaSelection } from './scheduleModel'

/**
 * Teste espelho do conteúdo da janela da agenda (21/10/2026).
 *
 * A casca da janela usa portal, que só existe no navegador; o conteúdo é
 * desenhado aqui dentro do contexto da janela, que é o que o título e o
 * botão Fechar exigem. O que ele protege: o título diz o dia e o turno, os
 * atalhos trazem o número do calendário com o escolhido aceso, as categorias
 * são as do turno ou do dia inteiro, a lista mostra as OS que chegaram, e a
 * janela avisa quando a agenda mudou entre a leitura do calendário e a da
 * lista. As OS entram prontas (`list`), como o serviço as manda.
 */

function record(id: string, overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  return {
    id,
    dateISO: '2026-10-17',
    period: 'Manhã',
    technicianId: 'tec-1',
    team: 'Terceirizada',
    serviceType: 'Instalação',
    category: 'Fibra Instalação',
    city: 'Atibaia',
    status: 'Agendada',
    statusKey: 'scheduled',
    resolution: null,
    ...overrides,
  }
}

const list: OsScheduleListSource = {
  generatedAt: '2026-10-16T14:40:00-03:00',
  kind: 'future',
  records: [record('OS-2026-2'), record('OS-2026-1', { technicianId: null })],
  technicians: [{ id: 'tec-1', name: 'Ana Souza' }],
}

/** A agenda sintética com o sábado 17/10 reduzido às duas OS da lista. */
function sourceWithTwo(): OsScheduleSource {
  const base = makeScheduleFixture()

  return {
    ...base,
    days: base.days.map((day) =>
      day.day === '2026-10-17'
        ? {
            ...day,
            scheduled: 2,
            periods: day.periods.map((period) => (period.periodKey === 'morning' ? { ...period, scheduled: 2 } : period)),
          }
        : day,
    ),
  }
}

function render(
  selection: AgendaSelection,
  source: OsScheduleSource = makeScheduleFixture(),
  given: OsScheduleListSource = list,
) {
  return renderToStaticMarkup(
    <Dialog.Root open>
      <ScheduleAgendaPanel list={given} onSelect={() => undefined} panelContainer={null} selection={selection} source={source} />
    </Dialog.Root>,
  )
}

const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('janela da agenda', () => {
  it('abre o turno com o título, os atalhos do calendário e as categorias do turno', () => {
    const html = render({ iso: '2026-10-17', periodKey: 'morning' })
    expect(html).toContain('Agenda de amanhã, sábado 17/10 · Manhã')
    expect(html).toContain('46 OS marcadas, 60h de 67h12 · só 7h12 livres')
    expect(html).toMatch(/aria-pressed="false"[^>]*>Dia inteiro<span class="font-mono">46</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Manhã<span class="font-mono">46</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Tarde<span class="font-mono">0</)
    expect(html).toContain('O que o SGI já recusa neste turno')
    // As horas de uma OS aparecem em toda linha, inclusive na que o SGI recusa.
    expect(text(html)).toContain('Instalação de 2 Câmeras1h20 cada · 4 técnicos aptos · 6 OS marcadas')
    expect(html).toContain('Cabe mais 12')
    expect(html).toContain('SGI não limita')
    // Os tons da página valem dentro da janela, publicada fora dela.
    expect(html).toContain('class="os-schedule contents"')
  })

  it('abre na aba Categorias, com a lista montada e escondida na aba OS', () => {
    const html = render({ iso: '2026-10-17', periodKey: 'morning' })
    expect(html).toMatch(/aria-selected="true"[^>]*>Categorias<span class="font-mono">3</)
    expect(html).toMatch(/aria-selected="false"[^>]*>OS<span class="font-mono">46</)
    expect(html).toMatch(/hidden=""[^>]*role="tabpanel"|role="tabpanel"[^>]*hidden=""/)
    // A lista está no HTML, escondida, para guardar o filtro de coluna ao voltar.
    expect(html).toContain('Manhã: 2 OS')
  })

  it('lista as OS na ordem da operação, sem a coluna Data, com o turno no título da lista', () => {
    const html = render({ iso: '2026-10-17', periodKey: 'morning' }, sourceWithTwo())
    expect(html).toContain('Ana Souza')
    expect(html).toContain('Sem técnico')
    // Com técnico antes de sem técnico, como na agenda de hoje.
    expect(html.indexOf('OS-2026-2')).toBeLessThan(html.indexOf('OS-2026-1'))
    expect(html).not.toContain('>Data<')
    expect(html).toContain('Baixar Excel')
    expect(html).not.toContain('A agenda mudou entre as duas leituras')
  })

  it('avisa quando a lista não fecha com o calendário, porque a agenda mudou entre as leituras', () => {
    const html = render({ iso: '2026-10-17', periodKey: 'morning' })
    expect(text(html)).toContain(
      'A agenda mudou entre as duas leituras: o calendário contava 46 OS, e a lista, lida às 14h40, tem 2.',
    )
  })

  it('o dia inteiro mostra cada categoria com a resposta de cada turno', () => {
    const html = render({ iso: '2026-10-19', periodKey: null })
    expect(html).toContain('Agenda de segunda-feira 19/10 · Dia inteiro')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Dia inteiro</)
    expect(html).toContain('O que ainda cabe em cada turno, por categoria')
    expect(html).toContain('Cabe mais 6')
    expect(html).toContain('Cabe mais 15')
    // O leitor de tela ouve o turno e as OS dele junto da pílula.
    expect(text(html)).toContain('Manhã: Cheio, 6 OS marcadas')
    expect(html).not.toContain('O que o SGI já recusa neste turno')
  })

  it('num dia passado, as categorias são o realizado e a janela não convida a agendar', () => {
    const html = render({ iso: '2026-10-12', periodKey: null })
    expect(html).toContain('O que foi realizado, por categoria e turno')
    // Zero realizada é resultado, escrito "0 OS", e não o traço de ausência.
    expect(text(html)).toContain('Tarde: 0 OS')
    expect(html).not.toContain('Cabe mais')
    expect(html).not.toContain('Pela grade do SGI')
    expect(html).toContain('Dia fechado no cadastro de feriados do SGI')
  })

  it('se o dia virou com a janela aberta, diz isso, e não que a agenda mudou', () => {
    const html = text(render({ iso: '2026-10-17', periodKey: 'morning' }, makeScheduleFixture(), { ...list, kind: 'today' }))
    expect(html).toContain('O dia virou desde a leitura do calendário')
    expect(html).not.toContain('A agenda mudou entre as duas leituras')
  })

  it('num dia sem OS, os atalhos ficam zerados e as categorias dizem que não há nenhuma', () => {
    const base = makeScheduleFixture()
    const source = {
      ...base,
      days: base.days.map((day) =>
        day.day === '2026-10-28'
          ? { ...day, scheduled: 0, periods: day.periods.map((period) => ({ ...period, scheduled: 0 })), categories: [] }
          : day,
      ),
    }
    const html = render({ iso: '2026-10-28', periodKey: null }, source, { ...list, records: [], technicians: [] })
    expect(html).toMatch(/aria-pressed="true"[^>]*>Dia inteiro<span class="font-mono">0</)
    expect(html).toContain('Nenhuma categoria com OS no dia.')
    expect(html).toContain('Nenhuma OS marcada aqui.')
  })

  it('hoje, depois da hora limite, a manhã fecha para toda categoria e a regra da grade sai', () => {
    const turno = render({ iso: '2026-10-16', periodKey: 'morning' })
    expect(turno).toContain('O SGI não agenda mais neste turno')
    expect(turno).toContain('Fechado')
    expect(turno).not.toContain('Cabe mais')
    expect(turno).not.toContain('Pela grade do SGI')
    // No dia inteiro, a manhã diz "Fechado" e a tarde ainda responde pela grade.
    const dia = text(render({ iso: '2026-10-16', periodKey: null }))
    expect(dia).toContain('Manhã: Fechado')
    expect(dia).toContain('Pela grade do SGI')
  })

  it('o Detalhe escreve a data só quando a etapa em campo não é de hoje', () => {
    const emCampo = {
      ...list,
      records: [
        record('OS-2026-7', { dateISO: '2026-10-16', status: 'Em deslocamento', statusKey: 'in_motion', startedMotionAt: '2026-10-16T08:20:00-03:00' }),
        record('OS-2026-8', { dateISO: '2026-10-16', status: 'No local', statusKey: 'arrived', arrivedAt: '2026-10-15T17:05:00-03:00' }),
      ],
    }
    const html = text(render({ iso: '2026-10-16', periodKey: 'morning' }, makeScheduleFixture(), emCampo))
    expect(html).toContain('Saiu às 08h20')
    expect(html).toContain('15/10 · chegou às 17h05')
  })

  it('não usa travessão em texto nenhum', () => {
    const html = render({ iso: '2026-10-20', periodKey: null })
    expect(html).not.toContain('—')
    expect(html).not.toContain('–')
  })
})
