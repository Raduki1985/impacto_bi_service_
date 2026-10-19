import { describe, expect, it } from 'vitest'

import type { OsScheduleDay, OsScheduleSource } from '../../data/api/osScheduleSource'
import { daysBetween } from '../../data/isoDate'
import { FIXTURE_TODAY, makeScheduleFixture } from './scheduleFixture.testing'
import {
  ALWAYS_ACCEPTED_TYPES,
  averageOrderHours,
  buildCalendar,
  buildRegistryLines,
  buildRegistryRows,
  buildShiftDetail,
  buildWeekSummary,
  dayLabel,
  DEFAULT_WEEKS,
  defaultSelection,
  detailTitle,
  EXPANDED_WEEKS,
  fillPercent,
  fitsInShift,
  formatHours,
  isoHour,
  OCCUPATION_ATTENTION,
  occupationState,
  presenceBasisText,
  scheduleWindow,
  shiftCutoff,
  shiftHoursNote,
  shiftPill,
  shiftState,
  shiftTone,
  shortDay,
  summaryText,
  uncountedNote,
  weekTitle,
} from './scheduleModel'

/**
 * Teste espelho do modelo da Agenda e capacidade em calendário: o que a tela
 * escreve a partir da resposta do serviço, sobre a agenda sintética de
 * quatro semanas (hoje é sexta-feira 16/10/2026, lida às 14h32).
 */

const source = makeScheduleFixture()

/** O turno de um dia do calendário de quatro semanas. */
function shiftOf(iso: string, periodKey: string, from: OsScheduleSource = source) {
  const day = buildCalendar(from, EXPANDED_WEEKS)
    .flatMap((week) => week.days)
    .find((item) => item.iso === iso)
  const shift = day?.shifts.find((item) => item.periodKey === periodKey)
  if (shift === undefined) throw new Error(`sem turno ${periodKey} em ${iso}`)

  return shift
}

/** A agenda com um dia trocado, para provar um caso que a fixture não tem. */
function withDay(iso: string, change: (day: OsScheduleDay) => OsScheduleDay): OsScheduleSource {
  return { ...source, days: source.days.map((day) => (day.day === iso ? change(day) : day)) }
}

const nobody = { technicians: 0, capacityHours: 0, occupation: null }
const semBase = { technicians: null, capacityHours: null, occupation: null }

describe('janela da leitura', () => {
  it('vai da segunda-feira anterior à semana de hoje até o domingo de uma semana depois das quatro', () => {
    expect(scheduleWindow('2026-10-16')).toEqual({ from: '2026-10-05', to: '2026-11-15' })
    expect(scheduleWindow('2026-10-16', DEFAULT_WEEKS)).toEqual({ from: '2026-10-05', to: '2026-11-01' })
    // Domingo pertence à semana que começou na segunda anterior.
    expect(scheduleWindow('2026-10-18')).toEqual({ from: '2026-10-05', to: '2026-11-15' })
    expect(scheduleWindow('2026-10-19').from).toBe('2026-10-12')
  })

  it('cabe nos 45 dias que o serviço aceita', () => {
    const { from, to } = scheduleWindow('2026-10-16')
    expect(daysBetween(from, to) + 1).toBe(42)
  })

  it('um dia de diferença entre o hoje do navegador e o do serviço não deixa semana fora da leitura', () => {
    for (const [browser, service] of [
      ['2026-10-19', '2026-10-18'],
      ['2026-10-18', '2026-10-19'],
      ['2026-10-25', '2026-10-26'],
    ]) {
      const { from, to } = scheduleWindow(browser)
      const grid = buildCalendar({ ...source, today: service }, EXPANDED_WEEKS)
      expect(grid[0].start >= from).toBe(true)
      expect(grid[grid.length - 1].end <= to).toBe(true)
    }
  })
})

describe('estado do turno', () => {
  const gauge = { technicians: 29, capacityHours: 92.8, occupation: 0.5 }

  it('cabe abaixo da atenção, quase cheio até antes de 100%, cheio de 100% em diante, sem estimativa sem base', () => {
    expect(occupationState(0.5)).toBe('ok')
    expect(occupationState(OCCUPATION_ATTENTION)).toBe('attention')
    expect(occupationState(0.9999)).toBe('attention')
    expect(occupationState(1)).toBe('over')
    expect(occupationState(1.01)).toBe('over')
    expect(occupationState(null)).toBe('unknown')
  })

  it('cheio também quando a sobra é menor que uma OS média, mesmo abaixo de 100%', () => {
    expect(occupationState(0.95, 0.7, 1.1)).toBe('over')
    expect(occupationState(0.95, 2, 1.1)).toBe('attention')
    expect(occupationState(0.5, 0.7, 1.1)).toBe('over')
    // Sem a medida da OS média, só a ocupação decide.
    expect(occupationState(0.95, 0.7, null)).toBe('attention')
    expect(occupationState(0.95, null, 1.1)).toBe('attention')
  })

  it('a OS média é a do turno com OS suficientes, senão a do dia, e nula sem OS com horas', () => {
    const dia = [
      { scheduled: 10, consumedHours: 15 },
      { scheduled: 2, consumedHours: 6 },
    ]
    expect(averageOrderHours(dia[0], dia)).toBe(1.5)
    expect(averageOrderHours(dia[1], dia)).toBe(21 / 12)
    expect(averageOrderHours({ scheduled: 0, consumedHours: 0 }, [{ scheduled: 0, consumedHours: 0 }])).toBeNull()
    expect(averageOrderHours({ scheduled: 3, consumedHours: 0 }, [{ scheduled: 3, consumedHours: 0 }])).toBeNull()
  })

  it('dia passado é realizado; feriado e turno fechado não recebem OS, com ou sem OS marcada', () => {
    expect(shiftState({ scheduled: 10, consumedHours: 0, operation: gauge }, 'past', false)).toBe('past')
    expect(shiftState({ scheduled: 0, consumedHours: 0, operation: gauge }, 'future', true)).toBe('closed')
    expect(shiftState({ scheduled: 10, consumedHours: 0, operation: gauge }, 'future', true)).toBe('closed')
    expect(shiftState({ scheduled: 10, consumedHours: 0, operation: gauge }, 'today', false, true)).toBe('cutoff')
    expect(shiftState({ scheduled: 0, consumedHours: 0, operation: gauge }, 'today', false, true)).toBe('cutoff')
  })

  it('turno sem OS é livre; com OS e nenhum técnico previsto nada cabe; sem base não há resposta', () => {
    expect(shiftState({ scheduled: 0, consumedHours: 0, operation: gauge }, 'future', false)).toBe('free')
    expect(shiftState({ scheduled: 0, consumedHours: 0, operation: nobody }, 'future', false)).toBe('free')
    expect(shiftState({ scheduled: 5, consumedHours: 0, operation: nobody }, 'today', false)).toBe('nobody')
    expect(shiftState({ scheduled: 10, consumedHours: 0, operation: gauge }, 'today', false)).toBe('ok')
    expect(shiftState({ scheduled: 10, consumedHours: 0, operation: semBase }, 'future', false)).toBe('unknown')
  })

  it('o SGI fecha o turno de hoje na hora limite, pela hora da leitura no serviço', () => {
    const morning = { key: 'morning', label: 'Manhã', startHour: 8, limitHour: 11 }
    expect(shiftCutoff('today', morning, 10)).toBe(false)
    expect(shiftCutoff('today', morning, 11)).toBe(true)
    expect(shiftCutoff('today', morning, 14)).toBe(true)
    expect(shiftCutoff('future', morning, 14)).toBe(false)
    expect(shiftCutoff('today', { ...morning, limitHour: null }, 14)).toBe(false)
    expect(shiftCutoff('today', morning, null)).toBe(false)
    expect(shiftCutoff('today', undefined, 14)).toBe(false)
    expect(isoHour('2026-10-16T14:32:00-03:00')).toBe(14)
    expect(isoHour('2026-10-16')).toBeNull()
  })

  it('só cabe, quase cheio, cheio e sem técnico têm cor; o resto é cinza', () => {
    expect(shiftTone('ok')).toBe('ok')
    expect(shiftTone('attention')).toBe('attention')
    expect(shiftTone('over')).toBe('over')
    expect(shiftTone('nobody')).toBe('over')
    expect((['past', 'free', 'closed', 'cutoff', 'unknown'] as const).map(shiftTone)).toEqual([
      'muted',
      'muted',
      'muted',
      'muted',
      'muted',
    ])
  })

  it('a pílula responde em horas, sempre com a palavra, e sem "0,0 h"', () => {
    expect(shiftPill('ok', 36.2, 96)).toBe('Cabe mais 59h48')
    expect(shiftPill('attention', 91, 96)).toBe('Quase cheio · sobram 5h')
    expect(shiftPill('attention', 95.995, 96)).toBe('Quase cheio · sem sobra')
    expect(shiftPill('over', 102, 96)).toBe('Cheio · passou 6h')
    expect(shiftPill('over', 96, 96)).toBe('Cheio · sem sobra')
    expect(shiftPill('over', 66.5, 67.2)).toBe('Cheio · sobram 42min')
    expect(shiftPill('past', 10, 20)).toBe('Realizado')
    expect(shiftPill('free', 0, 96)).toBe('Livre')
    expect(shiftPill('closed', 15, 96)).toBe('Feriado')
    expect(shiftPill('cutoff', 97.5, 124.8, 11)).toBe('Fechado às 11h')
    expect(shiftPill('cutoff', 97.5, 124.8)).toBe('Fechado para hoje')
    expect(shiftPill('nobody', 7.5, 0)).toBe('Sem técnico previsto')
    expect(shiftPill('unknown', 10, null)).toBe('Sem estimativa')
  })

  it('a legenda das horas diz o que é o número grande e de quanto', () => {
    expect(shiftHoursNote(false, 96)).toBe('marcadas de 96h')
    expect(shiftHoursNote(true, 89.6)).toBe('realizadas de 89h36')
    expect(shiftHoursNote(false, null)).toBe('marcadas')
    expect(shiftHoursNote(false, 0)).toBe('marcadas')
  })

  it('a barra enche até 100% e fica vazia sem estimativa', () => {
    expect(fillPercent(0.384)).toBe(38)
    expect(fillPercent(1.5)).toBe(100)
    expect(fillPercent(null)).toBe(0)
  })
})

describe('rótulos', () => {
  it('escreve dia, horas e títulos em pt-BR', () => {
    expect(shortDay('2026-10-19')).toBe('19/10')
    expect(dayLabel('2026-10-19')).toBe('Seg 19/10')
    expect(dayLabel('2026-10-24')).toBe('Sáb 24/10')
    expect(formatHours(97.5)).toBe('97h30')
    expect(formatHours(64)).toBe('64h')
    expect(formatHours(0.67)).toBe('40min')
    expect(formatHours(1.33)).toBe('1h20')
    expect(formatHours(0)).toBe('0h')
    expect(weekTitle(0, '2026-10-19', '2026-10-25')).toBe('Esta semana, 19/10 a 25/10')
    expect(weekTitle(1, '2026-10-26', '2026-11-01')).toBe('Próxima semana, 26/10 a 01/11')
    expect(weekTitle(2, '2026-11-02', '2026-11-08')).toBe('Semana de 02/11 a 08/11')
    expect(detailTitle('2026-10-16', 'Manhã', FIXTURE_TODAY)).toBe('Hoje, sexta-feira 16/10, manhã')
    expect(detailTitle('2026-10-17', 'Tarde', FIXTURE_TODAY)).toBe('Amanhã, sábado 17/10, tarde')
    expect(detailTitle('2026-10-20', 'Manhã', FIXTURE_TODAY)).toBe('Terça-feira 20/10, manhã')
  })

  it('explica de onde saiu a presença, com concordância e o histórico que o serviço informa', () => {
    expect(presenceBasisText('executed', '2026-10-15')).toBe('que executaram ou estiveram em campo no dia')
    expect(presenceBasisText('executed', '2026-10-15', 1)).toBe('que executou ou esteve em campo no dia')
    expect(presenceBasisText('assigned_or_available', '2026-10-16')).toContain('disponíveis no aplicativo')
    expect(presenceBasisText('assigned_or_available', '2026-10-16', 1)).toContain('ou disponível no aplicativo')
    expect(presenceBasisText('typical_weekday', '2026-10-19')).toBe(
      'pela presença típica de segunda-feira nas últimas 4 semanas, estimativa',
    )
    expect(presenceBasisText('typical_weekday', '2026-10-19', 2, 30)).toContain('nos últimos 30 dias')
    expect(presenceBasisText(null, '2026-10-18')).toContain('sem histórico')
  })
})

describe('calendário', () => {
  const twoWeeks = buildCalendar(source, DEFAULT_WEEKS)

  it('começa na segunda-feira da semana de hoje, com sete dias por semana', () => {
    expect(twoWeeks).toHaveLength(2)
    expect(twoWeeks[0].days[0].iso).toBe('2026-10-12')
    expect(twoWeeks[1].days[6].iso).toBe('2026-10-25')
    expect(twoWeeks[0].title).toBe('Esta semana, 12/10 a 18/10')
    const fourWeeks = buildCalendar(source, EXPANDED_WEEKS)
    expect(fourWeeks).toHaveLength(4)
    expect(fourWeeks[3].days[6].iso).toBe('2026-11-08')
  })

  it('marca hoje, trata o passado como realizado e deixa o domingo sem agenda vazio', () => {
    const [week] = twoWeeks
    expect(week.days.map((day) => day.isToday)).toEqual([false, false, false, false, true, false, false])
    expect(week.days[0].kind).toBe('past')
    expect(week.days[0].closed).toBe(true)
    expect(week.days[0].shifts.map((shift) => shift.pill)).toEqual(['Realizado', 'Realizado'])
    expect(week.days[0].shifts[0].hours).toBe('97h30')
    expect(week.days[0].shifts[0].hoursNote).toBe('realizadas de 89h36')
    expect(week.days[6].empty).toBe('sunday')
    expect(week.days[6].shifts).toEqual([])
  })

  it('responde cada turno pelo estado: cabe, quase cheio, cheio, livre, sem estimativa', () => {
    expect(shiftOf('2026-10-20', 'morning').pill).toBe('Cabe mais 56h30')
    expect(shiftOf('2026-10-17', 'morning').pill).toBe('Quase cheio · sobram 7h12')
    expect(shiftOf('2026-10-17', 'morning').tone).toBe('attention')
    expect(shiftOf('2026-10-19', 'morning').pill).toBe('Cheio · passou 7h12')
    expect(shiftOf('2026-10-19', 'morning').fillPercent).toBe(100)
    expect(shiftOf('2026-10-21', 'afternoon').pill).toBe('Livre')
    expect(shiftOf('2026-10-21', 'afternoon').hours).toBe('0h')
    expect(shiftOf('2026-10-21', 'afternoon').hoursNote).toBe('marcadas de 92h48')
    expect(shiftOf('2026-10-22', 'morning').pill).toBe('Sem estimativa')
    expect(shiftOf('2026-10-22', 'morning').hoursNote).toBe('marcadas')
  })

  it('lida às 14h32, a manhã de hoje já fechou (limite 11h) e a tarde ainda não (16h)', () => {
    const morning = shiftOf(FIXTURE_TODAY, 'morning')
    expect(morning.state).toBe('cutoff')
    expect(morning.pill).toBe('Fechado às 11h')
    expect(morning.tone).toBe('muted')
    expect(morning.hours).toBe('97h30')
    expect(morning.hoursNote).toBe('marcadas de 124h48')
    const afternoon = shiftOf(FIXTURE_TODAY, 'afternoon')
    expect(afternoon.state).toBe('ok')
    expect(afternoon.pill).toBe('Cabe mais 53h48')
  })

  it('feriado futuro com OS marcada responde Feriado, com as horas, e não convida a agendar', () => {
    const feriado = withDay('2026-10-20', (day) => ({ ...day, closed: true }))
    const shift = shiftOf('2026-10-20', 'morning', feriado)
    expect(shift.state).toBe('closed')
    expect(shift.pill).toBe('Feriado')
    expect(shift.hoursNote).toBe('marcadas de 92h48')
    expect(buildShiftDetail(feriado, { iso: '2026-10-20', periodKey: 'morning' })?.note).toMatch(
      /^Feriado no cadastro do SGI: a grade não oferece o dia · Rota fechada: Terceirizada/,
    )
  })

  it('com OS marcada e nenhum técnico previsto, o turno não cabe nada', () => {
    const ninguem = withDay('2026-10-21', (day) => ({
      ...day,
      operation: nobody,
      periods: day.periods.map((period) => ({ ...period, operation: nobody })),
    }))
    const shift = shiftOf('2026-10-21', 'morning', ninguem)
    expect(shift.state).toBe('nobody')
    expect(shift.pill).toBe('Sem técnico previsto')
    expect(shift.tone).toBe('over')
    expect(shift.hoursNote).toBe('marcadas')
    expect(shift.fillPercent).toBe(100)
    const semana2 = buildCalendar(ninguem, DEFAULT_WEEKS)[1]
    expect(semana2.days[2].technicians).toBe(0)
    expect(summaryText(buildWeekSummary(semana2))).toContain('6 turnos em que ainda cabe, 0 quase cheios, 2 cheios')
    const detail = buildShiftDetail(ninguem, { iso: '2026-10-21', periodKey: 'morning' })
    expect(detail?.summary).toContain('28 OS marcadas, 36h18 previstas · 0 técnicos pela presença típica')
  })

  it('escreve a presença com a origem dela, a rota fechada e as OS sem turno', () => {
    const day = twoWeeks[1].days[1]
    expect(day.iso).toBe('2026-10-20')
    expect(day.technicians).toBe(29)
    expect(day.presenceText).toBe('29 técnicos pela presença típica de terça-feira nas últimas 4 semanas, estimativa')
    expect(day.closedTeams).toEqual(['Terceirizada'])
    expect(day.withoutPeriod).toBe(1)
    expect(twoWeeks[1].days[3].technicians).toBeNull()
    expect(twoWeeks[1].days[3].presenceText).toBeNull()
  })

  it('um turno com sobra menor que uma OS média responde Cheio com a sobra', () => {
    const apertado = withDay('2026-10-24', (day) => ({
      ...day,
      periods: day.periods.map((period) =>
        period.periodKey === 'morning'
          ? {
              ...period,
              scheduled: 28,
              consumedHours: 66.5,
              operation: { technicians: 21, capacityHours: 67.2, occupation: 66.5 / 67.2 },
            }
          : period,
      ),
    }))
    const shift = shiftOf('2026-10-24', 'morning', apertado)
    expect(shift.state).toBe('over')
    expect(shift.pill).toBe('Cheio · sobram 42min')
    // A fixture de sempre: sábado 17/10 de manhã sobra 7h12 para uma OS média de 1h18, ainda cabe.
    expect(shiftOf('2026-10-17', 'morning').state).toBe('attention')
  })

  it('concorda com um técnico só', () => {
    const umSo = withDay('2026-10-12', (day) => ({ ...day, operation: { ...day.operation, technicians: 1 } }))
    expect(buildCalendar(umSo, DEFAULT_WEEKS)[0].days[0].presenceText).toBe(
      '1 técnico que executou ou esteve em campo no dia',
    )
  })

  it('o filtro de turno mostra só o turno escolhido, e o resumo soma só ele', () => {
    const manhas = buildCalendar(source, DEFAULT_WEEKS, 'morning')
    expect(manhas.flatMap((week) => week.days).every((day) => day.shifts.every((shift) => shift.periodKey === 'morning'))).toBe(true)
    expect(manhas[1].days[0].shifts).toHaveLength(1)
    expect(summaryText(buildWeekSummary(manhas[0]))).toMatch(/^390h realizadas até ontem · 157h30 marcadas/)
  })

  it('dia fora da leitura fica vazio, sem inventar turno', () => {
    const curta = { ...source, days: source.days.slice(0, 7) }
    const [, semana2] = buildCalendar(curta, DEFAULT_WEEKS)
    expect(semana2.days.every((day) => day.empty === 'outside')).toBe(true)
  })
})

describe('resumo da semana', () => {
  const [week1, week2] = buildCalendar(source, DEFAULT_WEEKS)

  it('esta semana: o realizado até ontem, o marcado de hoje em diante e os turnos abertos por estado', () => {
    // A manhã de hoje já fechou às 11h e fica fora da contagem de estados.
    expect(summaryText(buildWeekSummary(week1))).toBe(
      '674h realizadas até ontem · 228h30 marcadas de hoje em diante · 1 turno em que ainda cabe, 1 quase cheio, 0 cheios',
    )
  })

  it('próxima semana: o marcado com as sem turno, os estados e os sem estimativa', () => {
    expect(summaryText(buildWeekSummary(week2))).toBe(
      '401h30 marcadas · 1 OS sem turno fica fora dos turnos · 7 turnos em que ainda cabe, 0 quase cheios, 1 cheio · 2 turnos sem estimativa de capacidade',
    )
  })

  it('semana sem passado e sem OS escreve só o marcado; semana fora da leitura diz isso', () => {
    const [, , semana3] = buildCalendar(source, EXPANDED_WEEKS)
    expect(summaryText(buildWeekSummary(semana3))).toBe('0h marcadas')
    const curta = { ...source, days: source.days.slice(0, 7) }
    expect(summaryText(buildWeekSummary(buildCalendar(curta, DEFAULT_WEEKS)[1]))).toBe('Semana fora da leitura')
  })
})

describe('detalhe do turno', () => {
  it('abre no primeiro turno de amanhã, e pula o domingo sem agenda', () => {
    expect(defaultSelection(source)).toEqual({ iso: '2026-10-17', periodKey: 'morning' })
    expect(defaultSelection({ ...source, today: '2026-10-17' })).toEqual({ iso: '2026-10-19', periodKey: 'morning' })
    expect(defaultSelection({ ...source, days: [] })).toBeNull()
  })

  it('lista o que o SGI recusa, o que cabe por categoria e o que a grade nunca recusa', () => {
    const detail = buildShiftDetail(source, { iso: '2026-10-17', periodKey: 'morning' })
    expect(detail?.title).toBe('Amanhã, sábado 17/10, manhã')
    expect(detail?.summary).toBe(
      '46 OS marcadas, 60h de 67h12 · 21 técnicos pela presença típica de sábado nas últimas 4 semanas, estimativa · pela grade do SGI, capacidade só dos técnicos aptos em cada categoria, entre as categorias com OS no dia',
    )
    expect(detail?.refused.map((line) => line.name)).toEqual(['Instalação de 2 Câmeras'])
    expect(detail?.refused[0]).toMatchObject({ aptTechnicians: 4, scheduled: 6 })
    expect(detail?.fitting.map((line) => [line.name, line.fits])).toEqual([['Fibra Instalação', 12]])
    expect(detail?.alwaysAccepted.map((line) => line.name)).toEqual(['Execução de CTO'])
    expect(ALWAYS_ACCEPTED_TYPES).toContain('Infraestrutura')
    expect(detail?.note).toBe('Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa')
  })

  it('hoje, depois da hora limite, avisa que o SGI fechou o turno', () => {
    const detail = buildShiftDetail(source, { iso: FIXTURE_TODAY, periodKey: 'morning' })
    expect(detail?.title).toBe('Hoje, sexta-feira 16/10, manhã')
    expect(detail?.summary).toContain('39 técnicos com OS designada hoje ou disponíveis no aplicativo')
    expect(detail?.note).toContain('O SGI fechou o agendamento de hoje neste turno às 11h')
    // A tarde ainda está aberta: a nota só traz o aviso de infra e auditoria.
    expect(buildShiftDetail(source, { iso: FIXTURE_TODAY, periodKey: 'afternoon' })?.note).not.toContain('fechou o agendamento')
  })

  it('categoria sem horas previstas fica sem conta, no fim da lista do que cabe', () => {
    const detail = buildShiftDetail(source, { iso: '2026-10-23', periodKey: 'morning' })
    expect(detail?.fitting.map((line) => [line.name, line.fits, line.slaHours])).toEqual([
      ['Fibra Instalação', 12, 1.5],
      ['Vistoria Técnica', null, null],
    ])
  })

  it('num dia passado lista o realizado por categoria, da maior para a menor', () => {
    const detail = buildShiftDetail(source, { iso: '2026-10-12', periodKey: 'morning' })
    expect(detail?.kind).toBe('past')
    expect(detail?.title).toBe('Segunda-feira 12/10, manhã')
    expect(detail?.summary).toContain('75 OS realizadas, 97h30 de 89h36 · 28 técnicos que executaram')
    expect(detail?.realized.map((line) => [line.name, line.scheduled])).toEqual([
      ['Fibra Instalação', 10],
      ['Instalação de 2 Câmeras', 6],
      ['Execução de CTO', 2],
    ])
    expect(detail?.refused).toEqual([])
    expect(detail?.note).toBe('Feriado no cadastro do SGI: a grade não oferece o dia')
  })

  it('avisa rota fechada e o que fica fora da conta', () => {
    const detail = buildShiftDetail(source, { iso: '2026-10-20', periodKey: 'afternoon' })
    expect(detail?.note).toBe(
      'Rota fechada: Terceirizada · 1 OS sem turno fica fora dos turnos · 2 OS sem horas previstas pesam zero · Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa',
    )
    expect(uncountedNote({ withoutPeriod: 0, ordersWithoutSla: 0 })).toBe('')
  })

  it('sem o dia ou o turno na leitura não há detalhe', () => {
    expect(buildShiftDetail(source, null)).toBeNull()
    expect(buildShiftDetail(source, { iso: '2026-01-01', periodKey: 'morning' })).toBeNull()
    expect(buildShiftDetail(source, { iso: '2026-10-17', periodKey: 'noite' })).toBeNull()
  })

  it('quantas OS a mais cabem é a sobra dos aptos dividida pelas horas de uma OS, com a tolerância do serviço', () => {
    expect(fitsInShift(38.4, 20, 1.5)).toBe(12)
    expect(fitsInShift(12.8, 4, 1.33)).toBe(6)
    expect(fitsInShift(12.8, 12, 1.33)).toBe(0)
    // Quociente cru 0,9999999999999999: o serviço diz "não cheia", aqui cabe 1.
    expect(fitsInShift(9.6, 8.93, 0.67)).toBe(1)
    // 9,6 menos 3,2 dá 6,3999999999999995: sem a tolerância o floor daria 1.
    expect(fitsInShift(9.6, 3.2, 3.2)).toBe(2)
    expect(fitsInShift(0, 0, 1.5)).toBeNull()
    expect(fitsInShift(12.8, 4, null)).toBeNull()
  })

})

describe('cadastro de aptidões', () => {
  it('mostra só o que distorce a conta', () => {
    expect(buildRegistryRows(source).map((row) => row.name)).toEqual(['Câmera Offline', 'Execução de CTO'])
  })

  it('abre em linhas por técnico e categoria, do que mais executou sem aptidão ao que menos', () => {
    const lines = buildRegistryLines(source)
    expect(lines.map((line) => [line.technician, line.category, line.orders])).toEqual([
      ['Técnico A', 'Câmera Offline', 40],
      ['Técnico D', 'Execução de CTO', 30],
      ['Técnico B', 'Câmera Offline', 25],
      ['Técnico A', 'Execução de CTO', 16],
      ['Técnico C', 'Câmera Offline', 5],
    ])
    expect(lines[2].teams).toBe('Equipe Sul, Equipe Norte')
    expect(lines[4]).toMatchObject({ teams: 'Sem equipe', status: 'Inativo', aptTechnicians: 1 })
    expect(lines[1].aptTechnicians).toBe(0)
    expect(new Set(lines.map((line) => line.key)).size).toBe(lines.length)
  })
})
