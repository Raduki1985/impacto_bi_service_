import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { OsScheduleListSource } from '../../data/api/osOverviewSource'
import type { OsScheduleCategorySource, OsScheduleSource } from '../../data/api/osScheduleSource'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { ScheduleAgendaPanel } from './ScheduleAgendaDialog'
import { makeCategoryViewFixture, makeScheduleFixture } from './scheduleFixture.testing'
import type { AgendaSelection, CategoryChoice } from './scheduleModel'

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
  typeFilter: string | null = null,
  category: CategoryChoice | null = null,
  categoryView: OsScheduleCategorySource | null = null,
) {
  return renderToStaticMarkup(
    <Dialog.Root open>
      <ScheduleAgendaPanel
        category={category}
        categoryView={categoryView}
        list={given}
        onSelect={() => undefined}
        panelContainer={null}
        selection={selection}
        source={source}
        typeFilter={typeFilter}
      />
    </Dialog.Root>,
  )
}

const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('janela da agenda com o filtro Tipo de OS da página (22/10/2026)', () => {
  it('mostra só as categorias do tipo, avisa, e abre a lista recortada pela coluna Tipo', () => {
    const outra = { ...list, records: [...list.records, record('OS-2026-3', { serviceType: 'Manutenção', category: 'Sem Conexão' })] }
    const html = render({ iso: '2026-10-17', periodKey: 'morning' }, makeScheduleFixture(), outra, 'Instalação')

    expect(html).toContain('Só as categorias de Instalação, pelo filtro Tipo de OS da página')
    expect(html).toMatch(/aria-selected="true"[^>]*>Categorias<span class="font-mono">1</)
    expect(text(html)).toContain('Fibra Instalação')
    expect(html).not.toContain('Instalação de 2 Câmeras')
    // Os atalhos e a contagem da lista seguem o calendário, que é geral.
    expect(html).toMatch(/aria-pressed="true"[^>]*>Manhã<span class="font-mono">46</)
    expect(html).toMatch(/aria-selected="false"[^>]*>OS<span class="font-mono">46</)
    // A OS de outro tipo fica fora do recorte inicial da lista.
    expect(html).not.toContain('Sem Conexão')
    expect(html).toContain('OS-2026-2')
  })

  it('com o filtro Categoria, só ela na aba Categorias, e a lista recortada pela coluna Categoria', () => {
    const outra = { ...list, records: [...list.records, record('OS-2026-3', { category: 'Fibra Instalação + Box TV' })] }
    const html = render(
      { iso: '2026-10-17', periodKey: 'morning' },
      makeScheduleFixture(),
      outra,
      null,
      { id: 'fibra', name: 'Fibra Instalação' },
    )

    expect(html).toContain('Só a categoria Fibra Instalação, pelo filtro Categoria da página')
    expect(html).toMatch(/aria-selected="true"[^>]*>Categorias<span class="font-mono">1</)
    expect(html).not.toContain('Instalação de 2 Câmeras')
    expect(html).toContain('OS-2026-2')
    expect(html).not.toContain('OS-2026-3')
    // Os atalhos seguem o calendário, que é geral.
    expect(html).toMatch(/aria-pressed="true"[^>]*>Manhã<span class="font-mono">46</)
  })

  it('categoria sem OS no dia diz isso, em vez de dizer que a grade a oferece', () => {
    const html = render({ iso: '2026-10-17', periodKey: 'morning' }, makeScheduleFixture(), list, null, {
      id: 'vistoria',
      name: 'Vistoria Técnica',
    })

    expect(html).toContain(
      'Vistoria Técnica não tem OS neste dia, e a janela só traz a conta da grade do SGI para as categorias com OS no dia.',
    )
    expect(html).toContain('A próxima vaga dela está na linha acima do calendário.')
    expect(html).not.toContain('a grade do SGI oferece este turno a todas as categorias')
    // O mesmo para o tipo sem categoria com OS no dia, sem apontar para uma faixa que não existe.
    const tipo = render({ iso: '2026-10-17', periodKey: null }, makeScheduleFixture(), list, 'Retirada')
    expect(tipo).toContain(
      'Nenhuma categoria de Retirada tem OS neste dia, e a janela só traz a conta da grade do SGI para as categorias com OS no dia.',
    )
    expect(tipo).not.toContain('faixa')
  })

  it('sem o filtro, as categorias do turno vêm inteiras e sem o aviso', () => {
    const html = render({ iso: '2026-10-17', periodKey: 'morning' })

    expect(html).not.toContain('pelo filtro Tipo de OS')
    expect(html).toContain('Instalação de 2 Câmeras')
  })
})

describe('janela da agenda com a categoria e o calendário dela (23/10/2026)', () => {
  const turno = { iso: '2026-10-17', periodKey: 'morning' }

  it('a linha de cima, os atalhos e as duas abas contam só a categoria, e o total fica como referência', () => {
    const cam2 = { id: 'cam-2', name: 'Instalação de 2 Câmeras' }
    const html = render(turno, makeScheduleFixture(), list, null, cam2, makeCategoryViewFixture('cam-2'))

    expect(text(html)).toContain(
      '6 OS de Instalação de 2 Câmeras, de 46 marcadas no turno · agenda dos técnicos aptos: 12h48 de 12h48 · Cheio · 4 técnicos aptos no cadastro do SGI · agenda do SGI lida às 14h32',
    )
    expect(html).not.toContain('técnicos ativos no cadastro')
    expect(html).toMatch(/aria-pressed="false"[^>]*>Dia inteiro<span class="font-mono">8</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Manhã<span class="font-mono">6</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Tarde<span class="font-mono">2</)
    expect(html).toMatch(/aria-selected="true"[^>]*>Categorias<span class="font-mono">1</)
    expect(html).toMatch(/aria-selected="false"[^>]*>OS<span class="font-mono">6</)
    expect(html).toContain(
      'Só a categoria Instalação de 2 Câmeras, pelo filtro Categoria da página · Pela grade do SGI: capacidade só dos técnicos aptos nesta categoria, descontadas as OS de todas as categorias que eles atendem',
    )
    // Só a coluna da resposta dela: a vazia falaria das outras categorias.
    expect(html).toContain('O que o SGI já recusa neste turno')
    expect(html).not.toContain('O que ainda cabe, por categoria')
    expect(html).not.toContain('Nenhuma categoria com OS no dia ainda cabe.')
    // A lista chega inteira, e o aviso confere as OS dela.
    expect(text(html)).toContain(
      'A agenda mudou entre as duas leituras: o calendário contava 6 OS de Instalação de 2 Câmeras, e a lista, lida às 14h40, tem 0.',
    )
  })

  it('avisa quando as OS dela não fecham com a lista, mesmo com o total do turno igual', () => {
    const cam2 = { id: 'cam-2', name: 'Instalação de 2 Câmeras' }
    // O total do turno fecha (2 e 2), mas as duas OS da lista são de outra categoria.
    const html = text(render(turno, sourceWithTwo(), list, null, cam2, makeCategoryViewFixture('cam-2')))
    expect(html).toContain('o calendário contava 6 OS de Instalação de 2 Câmeras, e a lista, lida às 14h40, tem 0.')

    // As dela batem: nenhum aviso.
    const delas = { ...list, records: list.records.map((item) => ({ ...item, category: 'Instalação de 2 Câmeras' })) }
    const view = makeCategoryViewFixture('cam-2')
    const duas = {
      ...view,
      days: view.days.map((day) =>
        day.day === '2026-10-17'
          ? { ...day, periods: day.periods.map((period) => ({ ...period, scheduled: period.periodKey === 'morning' ? 2 : 0 })) }
          : day,
      ),
    }
    expect(text(render(turno, sourceWithTwo(), delas, null, cam2, duas))).not.toContain('A agenda mudou')
  })

  it('categoria sem OS no dia: a linha dela vem com a resposta do card, e não a frase de que não há conta', () => {
    const cam1 = { id: 'cam-1', name: 'Instalação de 1 Câmera' }
    const html = render(turno, makeScheduleFixture(), list, null, cam1, makeCategoryViewFixture('cam-1'))

    expect(html).not.toContain('não tem OS neste dia')
    expect(html).not.toContain('a grade do SGI oferece este turno a todas as categorias')
    expect(html).not.toContain('O que o SGI já recusa neste turno')
    expect(text(html)).toContain('0 OS de Instalação de 1 Câmera, de 46 marcadas no turno · agenda dos técnicos aptos: 0h de 12h48 · cabe mais 19')
    expect(html).toContain('Cabe mais 19')
    expect(text(html)).toContain('Instalação de 1 Câmera40min cada · 4 técnicos aptos')
    expect(html).toMatch(/aria-selected="true"[^>]*>Categorias<span class="font-mono">1</)
    expect(html).toMatch(/aria-selected="false"[^>]*>OS<span class="font-mono">0</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Dia inteiro<span class="font-mono">0</)
  })

  it('no dia inteiro de hoje, cada turno responde como o card: a manhã fechada e a tarde cheia', () => {
    const cam2 = { id: 'cam-2', name: 'Instalação de 2 Câmeras' }
    const html = text(
      render({ iso: '2026-10-16', periodKey: null }, makeScheduleFixture(), list, null, cam2, makeCategoryViewFixture('cam-2')),
    )

    expect(html).toContain('8 OS de Instalação de 2 Câmeras, de 130 marcadas no dia')
    expect(html).toContain('Manhã: Fechado')
    expect(html).toContain('Tarde: Cheio')
    expect(html).toContain('O SGI fechou o agendamento de hoje: manhã às 11h')
  })

  it('sem técnico apto, a pílula diz isso, e a linha de cima não fala em agenda dos aptos', () => {
    const view = makeCategoryViewFixture('cam-2')
    const semApto = {
      ...view,
      days: view.days.map((day) => ({
        ...day,
        aptTechnicians: 0,
        periods: day.periods.map((period) => ({ ...period, capacityHours: 0, occupation: null, full: true, fits: null })),
      })),
    }
    const html = render(turno, makeScheduleFixture(), list, null, { id: 'cam-2', name: 'Instalação de 2 Câmeras' }, semApto)

    expect(html).toContain('Sem técnico apto')
    expect(html).not.toContain('>Cheio<')
    expect(text(html)).toContain('6 OS de Instalação de 2 Câmeras, de 46 marcadas no turno · Sem técnico apto · 0 técnicos aptos no cadastro do SGI')
    expect(html).not.toContain('agenda dos técnicos aptos')
  })

  it('no passado sem OS dela, diz que não houve', () => {
    const cam1 = { id: 'cam-1', name: 'Instalação de 1 Câmera' }
    const html = render({ iso: '2026-10-15', periodKey: null }, makeScheduleFixture(), list, null, cam1, makeCategoryViewFixture('cam-1'))

    expect(html).toContain('Nenhuma OS de Instalação de 1 Câmera realizada nos turnos deste dia.')
    expect(html).not.toContain('Cabe mais')
  })
})

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
