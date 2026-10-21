import { describe, expect, it } from 'vitest'

import type { OsScheduleDay, OsScheduleSource } from '../../data/api/osScheduleSource'
import { daysBetween } from '../../data/isoDate'
import { FIXTURE_TODAY, makeScheduleFixture } from './scheduleFixture.testing'
import {
  ALWAYS_ACCEPTED_TYPES,
  averageOrderHours,
  barText,
  buildCalendar,
  buildRegistryLines,
  buildRegistryRows,
  buildShiftDetail,
  buildWeekSummary,
  dayLabel,
  dayLock,
  DEFAULT_WEEKS,
  agendaSelectionKey,
  agendaTitle,
  buildAgendaDialog,
  buildDayLines,
  EXPANDED_WEEKS,
  MAX_PAST_WEEKS,
  fillPercent,
  fitsInShift,
  occupationPercent,
  formatHours,
  isoHour,
  OCCUPATION_ATTENTION,
  occupationState,
  scheduleWindow,
  shiftCutoff,
  answerText,
  shiftAnswer,
  shiftTooltip,
  shiftState,
  shiftTone,
  shortDay,
  SYSTEM_HOLIDAYS_GROUP,
  summaryText,
  techniciansText,
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
      for (const offset of [0, -1, -MAX_PAST_WEEKS]) {
        const { from, to } = scheduleWindow(browser, EXPANDED_WEEKS, offset)
        const grid = buildCalendar({ ...source, today: service }, EXPANDED_WEEKS, null, offset)
        expect(grid[0].start >= from).toBe(true)
        expect(grid[grid.length - 1].end <= to).toBe(true)
      }
    }
  })

  it('volta no tempo semana a semana, com os mesmos 42 dias, até oito semanas antes da de hoje', () => {
    expect(scheduleWindow('2026-10-16', EXPANDED_WEEKS, -1)).toEqual({ from: '2026-09-28', to: '2026-11-08' })
    const { from, to } = scheduleWindow('2026-10-16', EXPANDED_WEEKS, -MAX_PAST_WEEKS)
    expect(MAX_PAST_WEEKS).toBe(8)
    expect(from).toBe('2026-08-10')
    expect(daysBetween(from, to) + 1).toBe(42)
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
    expect(shiftState({ scheduled: 10, consumedHours: 0, scheduler: gauge }, 'past', false)).toBe('past')
    expect(shiftState({ scheduled: 0, consumedHours: 0, scheduler: gauge }, 'future', true)).toBe('closed')
    expect(shiftState({ scheduled: 10, consumedHours: 0, scheduler: gauge }, 'future', true)).toBe('closed')
    expect(shiftState({ scheduled: 10, consumedHours: 0, scheduler: gauge }, 'today', false, true)).toBe('cutoff')
    expect(shiftState({ scheduled: 0, consumedHours: 0, scheduler: gauge }, 'today', false, true)).toBe('cutoff')
  })

  it('turno sem OS é livre; com OS e nenhum técnico previsto nada cabe; sem base não há resposta', () => {
    expect(shiftState({ scheduled: 0, consumedHours: 0, scheduler: gauge }, 'future', false)).toBe('free')
    expect(shiftState({ scheduled: 0, consumedHours: 0, scheduler: nobody }, 'future', false)).toBe('free')
    expect(shiftState({ scheduled: 5, consumedHours: 0, scheduler: nobody }, 'today', false)).toBe('nobody')
    expect(shiftState({ scheduled: 10, consumedHours: 0, scheduler: gauge }, 'today', false)).toBe('ok')
    expect(shiftState({ scheduled: 10, consumedHours: 0, scheduler: semBase }, 'future', false)).toBe('unknown')
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

  it('a resposta do turno dá as horas livres, sempre com a palavra, e sem "0h"', () => {
    const text = (...args: Parameters<typeof shiftAnswer>) => answerText(shiftAnswer(...args))
    expect(text('ok', 36.2, 96)).toBe('59h48 livres')
    expect(text('attention', 91, 96)).toBe('só 5h livres')
    expect(text('attention', 95.995, 96)).toBe('Quase cheio')
    expect(text('over', 102, 96)).toBe('excedeu 6h')
    expect(text('over', 96, 96)).toBe('Cheio')
    // Cheio pela OS média: a sobra de 42min vai para a dica do mouse.
    expect(text('over', 66.5, 67.2)).toBe('Cheio')
    expect(text('past', 10, 20)).toBe('Realizado')
    expect(text('free', 0, 96)).toBe('96h livres')
    expect(text('free', 0, null)).toBe('Livre')
    // Sem OS e ninguém previsto (a tarde de sábado): "Livre" pareceria folga.
    expect(text('free', 0, 0)).toBe('Sem técnico previsto')
    expect(shiftTone('free')).toBe('muted')
    expect(text('closed', 15, 96)).toBe('Fechado')
    expect(text('cutoff', 97.5, 124.8, 11)).toBe('Fechado às 11h')
    expect(text('cutoff', 97.5, 124.8)).toBe('Fechado para hoje')
    expect(text('nobody', 7.5, 0)).toBe('Sem técnico previsto')
    expect(text('unknown', 10, null)).toBe('Sem estimativa')
  })

  it('o número em destaque é o das horas; "só" e "excedeu" vão pequenos, "livres" em cinza', () => {
    expect(shiftAnswer('attention', 91, 96)).toEqual([
      { text: 'só', kind: 'qualifier' },
      { text: '5h', kind: 'hours' },
      { text: 'livres', kind: 'unit' },
    ])
    expect(shiftAnswer('over', 102, 96)).toEqual([
      { text: 'excedeu', kind: 'qualifier' },
      { text: '6h', kind: 'hours' },
    ])
    expect(shiftAnswer('past', 10, 20)).toEqual([{ text: 'Realizado', kind: 'word' }])
  })

  it('a dica do turno dá marcadas, capacidade e ocupação, e a sobra do cheio pela OS média', () => {
    expect(shiftTooltip('ok', 97.5, 124.8, 97.5 / 124.8, null)).toBe('97h30 marcadas de 124h48 de capacidade (78%)')
    expect(shiftTooltip('past', 97.5, 89.6, 97.5 / 89.6, null)).toBe('97h30 realizadas de 89h36 de capacidade (109%)')
    expect(shiftTooltip('over', 66.5, 67.2, 66.5 / 67.2, 2.5)).toBe(
      '66h30 marcadas de 67h12 de capacidade (98%). Sobram 42min, menos que uma OS média (2h30)',
    )
    // Sobra e média que arredondam para o mesmo minuto: a frase não se contradiz.
    expect(shiftTooltip('over', 9.3, 10, 0.93, 0.705)).toBe(
      '9h18 marcadas de 10h de capacidade (93%). Sobram 42min, menos que uma OS média',
    )
    expect(shiftTooltip('over', 102, 96, 102 / 96, 2.5)).toBe('102h marcadas de 96h de capacidade (106%)')
    // Sem a ocupação do serviço, a conta é a mesma dele.
    expect(shiftTooltip('ok', 48, 96, null, null)).toBe('48h marcadas de 96h de capacidade (50%)')
    expect(shiftTooltip('unknown', 10, null, null, null)).toBe('10h marcadas, sem estimativa de capacidade')
    // Capacidade zero não é falta de estimativa: ninguém foi previsto.
    expect(shiftTooltip('nobody', 7.5, 0, null, null)).toBe('7h30 marcadas, nenhum técnico previsto')
    expect(shiftTooltip('past', 3, 0, null, null)).toBe('3h realizadas, nenhum técnico previsto')
  })

  it('a barra escreve a ocupação, e as horas marcadas quando não há capacidade para dividir', () => {
    expect(barText(97.5, 124.8, 97.5 / 124.8)).toBe('78%')
    expect(barText(102, 96, null)).toBe('106%')
    expect(barText(10, null, null)).toBe('10h')
    expect(barText(7.5, 0, null)).toBe('7h30')
  })

  it('a porcentagem arredonda para baixo antes de 100%, para não dizer cheio com tempo sobrando', () => {
    expect(occupationPercent(0.995)).toBe(99)
    expect(occupationPercent(0.57)).toBe(57)
    expect(occupationPercent(0.004)).toBe(0)
    expect(occupationPercent(1)).toBe(100)
    expect(occupationPercent(1.086)).toBe(109)
    expect(occupationPercent(null)).toBeNull()
    expect(fillPercent(0.995)).toBe(99)
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
    expect(weekTitle(-1, '2026-10-12', '2026-10-18')).toBe('Semana passada, 12/10 a 18/10')
    expect(weekTitle(-2, '2026-10-05', '2026-10-11')).toBe('Semana de 05/10 a 11/10')
    expect(agendaTitle('2026-10-16', 'Manhã', FIXTURE_TODAY)).toBe('Agenda de hoje, sexta-feira 16/10 · Manhã')
    expect(agendaTitle('2026-10-17', 'Tarde', FIXTURE_TODAY)).toBe('Agenda de amanhã, sábado 17/10 · Tarde')
    expect(agendaTitle('2026-10-20', null, FIXTURE_TODAY)).toBe('Agenda de terça-feira 20/10 · Dia inteiro')
  })

  it('o selo do dia: feriado do calendário sem cadeado, trava com cadeado e o nome do SGI', () => {
    const fixo = { name: 'Aparecida', group: SYSTEM_HOLIDAYS_GROUP, teams: [] }
    const chuva = { name: 'CHUVA INTENSA ROTA FECHADA', group: 'CHUVA INTENSA ROTA FECHADA', teams: [] }
    const trava = { name: 'INDEPENCIA DO BRASIL', group: 'INDEPENCIA DO BRASIL', teams: ['Terceirizada'] }
    expect(dayLock([])).toBeNull()
    expect(dayLock([fixo])).toEqual({
      label: 'Feriado · Aparecida',
      title: 'Feriado do calendário do SGI: Aparecida',
      locked: false,
    })
    expect(dayLock([{ ...fixo, name: '-' }])?.label).toBe('Feriado')
    expect(dayLock([chuva])).toEqual({
      label: 'Chuva intensa rota fechada',
      title: 'Chuva intensa rota fechada: dia todo fechado no SGI',
      locked: true,
    })
    expect(dayLock([trava])).toEqual({
      label: 'Terceirizada',
      title: 'Indepencia do brasil: rota travada para Terceirizada',
      locked: true,
    })
    // O dia todo fechado manda no selo; a trava da equipe fica na dica.
    expect(dayLock([trava, chuva])?.label).toBe('Chuva intensa rota fechada')
    expect(dayLock([trava, chuva])?.title).toContain('rota travada para Terceirizada')
    expect(dayLock([trava, { ...trava, teams: ['Infra', 'Terceirizada'] }])?.label).toBe('Terceirizada, Infra')
  })

  it('escreve os técnicos da régua do SGI, com o aviso do passado e da rota travada', () => {
    expect(techniciansText(42, 'future')).toBe('42 técnicos ativos no cadastro do SGI')
    expect(techniciansText(1, 'today')).toBe('1 técnico ativo no cadastro do SGI')
    expect(techniciansText(38, 'past')).toBe(
      '38 técnicos ativos no cadastro do SGI nesse dia (inativações não têm data e seguem o cadastro atual)',
    )
    expect(techniciansText(35, 'future', ['Terceirizada'])).toBe(
      '35 técnicos ativos no cadastro do SGI, sem as equipes com rota travada',
    )
    // No passado a rota travada não tira a equipe: ela trabalhou.
    expect(techniciansText(42, 'past', ['Terceirizada'])).not.toContain('rota travada')
    expect(techniciansText(null, 'future')).toBeNull()
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

  it('voltado uma semana, começa na segunda anterior e dá nome às semanas pela distância de hoje', () => {
    const [passada, esta] = buildCalendar(source, DEFAULT_WEEKS, null, -1)
    expect(passada.days[0].iso).toBe('2026-10-05')
    expect(passada.title).toBe('Semana passada, 05/10 a 11/10')
    expect(esta.title).toBe('Esta semana, 12/10 a 18/10')
    // A agenda sintética começa em 12/10: antes disso o dia está fora da leitura.
    expect(passada.days[0].empty).toBe('outside')
    expect(buildCalendar(source, EXPANDED_WEEKS, null, -1).map((week) => week.title)).toEqual([
      'Semana passada, 05/10 a 11/10',
      'Esta semana, 12/10 a 18/10',
      'Próxima semana, 19/10 a 25/10',
      'Semana de 26/10 a 01/11',
    ])
  })

  it('marca hoje, trata o passado como realizado e deixa o domingo sem agenda vazio', () => {
    const [week] = twoWeeks
    expect(week.days.map((day) => day.isToday)).toEqual([false, false, false, false, true, false, false])
    expect(week.days[0].kind).toBe('past')
    expect(week.days[0].closed).toBe(true)
    expect(week.days[0].shifts.map((shift) => answerText(shift.answer))).toEqual(['Realizado', 'Realizado'])
    expect(week.days[0].shifts[0].barText).toBe('109%')
    expect(week.days[0].shifts[0].capacity).toBe('89h36')
    expect(week.days[0].shifts[0].tooltip).toBe('97h30 realizadas de 89h36 de capacidade (109%)')
    expect(week.days[6].empty).toBe('sunday')
    expect(week.days[6].shifts).toEqual([])
  })

  it('responde cada turno pelo estado: cabe, quase cheio, cheio, livre, sem estimativa', () => {
    const answer = (iso: string, period: string) => answerText(shiftOf(iso, period).answer)
    expect(answer('2026-10-20', 'morning')).toBe('56h30 livres')
    expect(answer('2026-10-17', 'morning')).toBe('só 7h12 livres')
    expect(shiftOf('2026-10-17', 'morning').tone).toBe('attention')
    expect(answer('2026-10-19', 'morning')).toBe('excedeu 7h12')
    expect(shiftOf('2026-10-19', 'morning').fillPercent).toBe(100)
    // Turno sem OS: a capacidade inteira é livre, e o tom continua cinza.
    expect(answer('2026-10-21', 'afternoon')).toBe('92h48 livres')
    expect(shiftOf('2026-10-21', 'afternoon').tone).toBe('muted')
    expect(shiftOf('2026-10-21', 'afternoon').barText).toBe('0%')
    expect(shiftOf('2026-10-21', 'afternoon').capacity).toBe('92h48')
    expect(answer('2026-10-22', 'morning')).toBe('Sem estimativa')
    expect(shiftOf('2026-10-22', 'morning').capacity).toBeNull()
  })

  it('lida às 14h32, a manhã de hoje já fechou (limite 11h) e a tarde ainda não (16h)', () => {
    const morning = shiftOf(FIXTURE_TODAY, 'morning')
    expect(morning.state).toBe('cutoff')
    expect(answerText(morning.answer)).toBe('Fechado às 11h')
    expect(morning.tone).toBe('muted')
    expect(morning.barText).toBe('78%')
    expect(morning.capacity).toBe('124h48')
    expect(morning.tooltip).toBe('97h30 marcadas de 124h48 de capacidade (78%)')
    const afternoon = shiftOf(FIXTURE_TODAY, 'afternoon')
    expect(afternoon.state).toBe('ok')
    expect(answerText(afternoon.answer)).toBe('53h48 livres')
  })

  it('feriado futuro com OS marcada responde Feriado, com as horas, e não convida a agendar', () => {
    const feriado = withDay('2026-10-20', (day) => ({ ...day, closed: true }))
    const shift = shiftOf('2026-10-20', 'morning', feriado)
    expect(shift.state).toBe('closed')
    expect(answerText(shift.answer)).toBe('Fechado')
    expect(shift.capacity).toBe('92h48')
    expect(buildShiftDetail(feriado, { iso: '2026-10-20', periodKey: 'morning' })).toMatchObject({
      closed: true,
      refused: [],
      fitting: [],
      alwaysAccepted: [],
    })
    // O dia todo fechado: as duas colunas do dia inteiro dizem "Fechado".
    const diaFechado = buildAgendaDialog(feriado, { iso: '2026-10-20', periodKey: null })
    expect(diaFechado?.dayLines.every((line) => line.cells.every((cell) => cell.answer === 'closed'))).toBe(true)
    expect(diaFechado?.dayLines.map((line) => line.name)).toEqual([
      'Fibra Instalação',
      'Instalação de 2 Câmeras',
      'Execução de CTO',
    ])
    expect(buildShiftDetail(feriado, { iso: '2026-10-20', periodKey: 'morning' })?.note).toMatch(
      /^Dia fechado no cadastro de feriados do SGI: a grade não oferece o dia · Rota travada: Terceirizada/,
    )
  })

  it('com OS marcada e nenhum técnico previsto, o turno não cabe nada', () => {
    const ninguem = withDay('2026-10-21', (day) => ({
      ...day,
      scheduler: nobody,
      periods: day.periods.map((period) => ({ ...period, scheduler: nobody })),
    }))
    const shift = shiftOf('2026-10-21', 'morning', ninguem)
    expect(shift.state).toBe('nobody')
    expect(answerText(shift.answer)).toBe('Sem técnico previsto')
    expect(shift.tone).toBe('over')
    expect(shift.capacity).toBeNull()
    expect(shift.fillPercent).toBe(100)
    const semana2 = buildCalendar(ninguem, DEFAULT_WEEKS)[1]
    expect(semana2.days[2].technicians).toBe(0)
    expect(summaryText(buildWeekSummary(semana2))).toContain('6 turnos em que ainda cabe, 0 quase cheios, 2 cheios')
    expect(buildAgendaDialog(ninguem, { iso: '2026-10-21', periodKey: 'morning' })?.description).toContain(
      '28 OS marcadas, 36h18 previstas · Sem técnico previsto · 0 técnicos ativos no cadastro do SGI',
    )
  })

  it('só o dia de hoje traz os técnicos disponíveis agora, também com o calendário voltado', () => {
    const days = twoWeeks.flatMap((week) => week.days)
    expect(days.filter((day) => day.availableNow !== null).map((day) => [day.iso, day.availableNow])).toEqual([
      [FIXTURE_TODAY, 35],
    ])
    const voltado = buildCalendar(source, DEFAULT_WEEKS, null, -MAX_PAST_WEEKS)
    expect(voltado.map((week) => week.title)).toEqual(['Semana de 17/08 a 23/08', 'Semana de 24/08 a 30/08'])
    expect(voltado.flatMap((week) => week.days).every((day) => day.availableNow === null)).toBe(true)
  })

  it('escreve os técnicos ativos, a rota fechada e as OS sem turno', () => {
    const day = twoWeeks[1].days[1]
    expect(day.iso).toBe('2026-10-20')
    expect(day.technicians).toBe(29)
    expect(day.techniciansText).toBe('29 técnicos ativos no cadastro do SGI, sem as equipes com rota travada')
    expect(day.lock).toEqual({
      label: 'Terceirizada',
      title: 'Rota fechada: rota travada para Terceirizada',
      locked: true,
    })
    expect(twoWeeks[0].days[0].lock).toEqual({
      label: 'Feriado · Aparecida',
      title: 'Feriado do calendário do SGI: Aparecida',
      locked: false,
    })
    expect(twoWeeks[0].days[1].lock).toBeNull()
    expect(day.closedTeams).toEqual(['Terceirizada'])
    expect(day.withoutPeriod).toBe(1)
    expect(twoWeeks[1].days[3].technicians).toBeNull()
    expect(twoWeeks[1].days[3].techniciansText).toBeNull()
  })

  it('um turno com sobra menor que uma OS média responde Cheio, e a sobra vai para a dica', () => {
    const apertado = withDay('2026-10-24', (day) => ({
      ...day,
      periods: day.periods.map((period) =>
        period.periodKey === 'morning'
          ? {
              ...period,
              scheduled: 28,
              consumedHours: 66.5,
              scheduler: { technicians: 21, capacityHours: 67.2, occupation: 66.5 / 67.2 },
            }
          : period,
      ),
    }))
    const shift = shiftOf('2026-10-24', 'morning', apertado)
    expect(shift.state).toBe('over')
    expect(answerText(shift.answer)).toBe('Cheio')
    expect(shift.tooltip).toBe(
      '66h30 marcadas de 67h12 de capacidade (98%). Sobram 42min, menos que uma OS média (2h23)',
    )
    // A fixture de sempre: sábado 17/10 de manhã sobra 7h12 para uma OS média de 1h18, ainda cabe.
    expect(shiftOf('2026-10-17', 'morning').state).toBe('attention')
  })

  it('concorda com um técnico só', () => {
    const umSo = withDay('2026-10-12', (day) => ({ ...day, scheduler: { ...day.scheduler, technicians: 1 } }))
    expect(buildCalendar(umSo, DEFAULT_WEEKS)[0].days[0].techniciansText).toBe(
      '1 técnico ativo no cadastro do SGI nesse dia (inativações não têm data e seguem o cadastro atual)',
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

  it('semana toda no passado escreve só o realizado, sem o "até ontem"', () => {
    const passada = {
      ...source,
      days: source.days.map((day) => (day.day <= '2026-10-18' ? { ...day, kind: 'past' as const } : day)),
    }
    const texto = summaryText(buildWeekSummary(buildCalendar(passada, DEFAULT_WEEKS)[0]))
    expect(texto).toMatch(/^\S+ realizadas$/)
  })
})

describe('detalhe do turno', () => {
  it('lista o que o SGI recusa, o que cabe por categoria e o que a grade nunca recusa', () => {
    const detail = buildShiftDetail(source, { iso: '2026-10-17', periodKey: 'morning' })
    expect(detail?.refused.map((line) => line.name)).toEqual(['Instalação de 2 Câmeras'])
    expect(detail?.refused[0]).toMatchObject({ aptTechnicians: 4, slaHours: 1.33, scheduled: 6 })
    expect(detail?.fitting.map((line) => [line.name, line.fits])).toEqual([['Fibra Instalação', 12]])
    expect(detail?.alwaysAccepted.map((line) => [line.name, line.slaHours])).toEqual([['Execução de CTO', 0.5]])
    expect(ALWAYS_ACCEPTED_TYPES).toContain('Infraestrutura')
    expect(detail?.note).toBe('Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa')
  })

  it('hoje, depois da hora limite, avisa que o SGI fechou o turno', () => {
    const detail = buildShiftDetail(source, { iso: FIXTURE_TODAY, periodKey: 'morning' })
    expect(detail?.note).toContain('O SGI fechou o agendamento de hoje neste turno às 11h')
    // Depois das 11h nenhuma categoria cabe na manhã de hoje, seja qual for a sobra.
    expect(detail?.closed).toBe(true)
    expect(detail?.fitting).toEqual([])
    expect(detail?.refused).toEqual([])
    expect(detail?.closedLines.map((line) => [line.name, line.scheduled])).toEqual([
      ['Fibra Instalação', 10],
      ['Instalação de 2 Câmeras', 6],
      ['Execução de CTO', 2],
    ])
    expect(buildShiftDetail(source, { iso: FIXTURE_TODAY, periodKey: 'afternoon' })?.closed).toBe(false)
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
    expect(detail?.realized.map((line) => [line.name, line.scheduled, line.slaHours])).toEqual([
      ['Fibra Instalação', 10, 1.5],
      ['Instalação de 2 Câmeras', 6, 1.33],
      ['Execução de CTO', 2, 0.5],
    ])
    expect(detail?.refused).toEqual([])
    expect(detail?.note).toBe('Dia fechado no cadastro de feriados do SGI: a grade não oferece o dia')
  })

  it('avisa rota fechada e o que fica fora da conta', () => {
    const detail = buildShiftDetail(source, { iso: '2026-10-20', periodKey: 'afternoon' })
    expect(detail?.note).toBe(
      'Rota travada: Terceirizada · 1 OS sem turno fica fora dos turnos · 2 OS sem horas previstas pesam zero · Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa',
    )
    expect(uncountedNote({ withoutPeriod: 0, ordersWithoutSla: 0 })).toBe('')
  })

  it('sem o dia ou o turno na leitura não há detalhe', () => {
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

describe('janela da agenda', () => {
  it('abre o turno com o título, a resposta do turno, os técnicos e a hora da leitura', () => {
    const dialog = buildAgendaDialog(source, { iso: '2026-10-17', periodKey: 'morning' })
    expect(dialog?.title).toBe('Agenda de amanhã, sábado 17/10 · Manhã')
    expect(dialog?.label).toBe('Manhã')
    expect(dialog?.description).toBe(
      '46 OS marcadas, 60h de 67h12 · só 7h12 livres · 21 técnicos ativos no cadastro do SGI · agenda do SGI lida às 14h32',
    )
    expect(dialog?.shift?.refused.map((line) => line.name)).toEqual(['Instalação de 2 Câmeras'])
    expect(dialog?.dayLines).toEqual([])
  })

  it('os atalhos são o dia inteiro e cada turno, com o número do calendário, e a lista espera o mesmo número', () => {
    const turno = buildAgendaDialog(source, { iso: '2026-10-20', periodKey: 'afternoon' })
    const dia = buildAgendaDialog(source, { iso: '2026-10-20', periodKey: null })
    const calendario = source.days.find((day) => day.day === '2026-10-20')!
    expect(turno?.chips.map((chip) => [chip.label, chip.count])).toEqual([
      ['Dia inteiro', calendario.scheduled],
      ['Manhã', calendario.periods[0].scheduled],
      ['Tarde', calendario.periods[1].scheduled],
    ])
    expect(turno?.expected).toBe(calendario.periods[1].scheduled)
    // O dia inteiro conta também a OS sem turno.
    expect(dia?.expected).toBe(calendario.scheduled)
    expect(calendario.scheduled).toBe(calendario.periods[0].scheduled + calendario.periods[1].scheduled + 1)
    expect(agendaSelectionKey({ iso: '2026-10-20', periodKey: null })).toBe('2026-10-20|dia')
    expect(agendaSelectionKey({ iso: '2026-10-20', periodKey: 'afternoon' })).toBe('2026-10-20|afternoon')
  })

  it('o dia inteiro traz as horas do dia, a rota travada e o que fica fora da conta', () => {
    const dia = buildAgendaDialog(source, { iso: '2026-10-20', periodKey: null })
    expect(dia?.title).toBe('Agenda de terça-feira 20/10 · Dia inteiro')
    expect(dia?.shift).toBeNull()
    expect(dia?.description).toBe(
      '52 OS marcadas, 66h18 de 185h36 · 29 técnicos ativos no cadastro do SGI, sem as equipes com rota travada · agenda do SGI lida às 14h32',
    )
    expect(dia?.note).toBe(
      'Rota travada: Terceirizada · 1 OS sem turno fica fora dos turnos · 2 OS sem horas previstas pesam zero · Infraestrutura e auditoria entram no consumo, mas a grade do SGI nunca as recusa',
    )
  })

  it('hoje, o dia inteiro avisa só o turno que o SGI já fechou', () => {
    const hoje = buildAgendaDialog(source, { iso: FIXTURE_TODAY, periodKey: null })
    expect(hoje?.note).toMatch(/^O SGI fechou o agendamento de hoje: manhã às 11h · /)
    // A manhã fechada responde "Fechado"; a tarde, ainda aberta, responde pela grade.
    expect(hoje?.dayLines.map((line) => [line.name, line.cells.map((cell) => cell.answer)])).toEqual([
      ['Instalação de 2 Câmeras', ['closed', 'fits']],
      ['Fibra Instalação', ['closed', 'fits']],
      ['Execução de CTO', ['closed', 'always']],
    ])
    expect(buildAgendaDialog(source, { iso: FIXTURE_TODAY, periodKey: 'morning' })?.description).toContain(
      'Fechado às 11h',
    )
  })

  it('no dia inteiro, cada categoria responde por turno, a recusada primeiro e infra no fim', () => {
    const segunda = source.days.find((day) => day.day === '2026-10-19')!
    const linhas = buildDayLines(segunda)
    expect(linhas.map((line) => [line.name, line.cells.map((cell) => [cell.period, cell.answer, cell.fits])])).toEqual([
      ['Instalação de 2 Câmeras', [['Manhã', 'refused', null], ['Tarde', 'fits', 6]]],
      ['Fibra Instalação', [['Manhã', 'fits', 12], ['Tarde', 'fits', 15]]],
      ['Execução de CTO', [['Manhã', 'always', null], ['Tarde', 'always', null]]],
    ])
  })

  it('num dia passado, o dia inteiro é o realizado por categoria e turno, sem a resposta de quem agenda', () => {
    const passado = buildAgendaDialog(source, { iso: '2026-10-12', periodKey: null })
    expect(passado?.kind).toBe('past')
    expect(passado?.dayLines.map((line) => [line.name, line.scheduled, line.cells.map((cell) => cell.scheduled)])).toEqual([
      ['Fibra Instalação', 18, [10, 8]],
      ['Instalação de 2 Câmeras', 8, [6, 2]],
      ['Execução de CTO', 2, [2, 0]],
    ])
    expect(passado?.dayLines.every((line) => line.cells.every((cell) => cell.answer === 'realized'))).toBe(true)
    const turno = buildAgendaDialog(source, { iso: '2026-10-12', periodKey: 'morning' })
    expect(turno?.title).toBe('Agenda de segunda-feira 12/10 · Manhã')
    expect(turno?.description).toBe(
      '75 OS realizadas, 97h30 de 89h36 · 28 técnicos ativos no cadastro do SGI nesse dia (inativações não têm data e seguem o cadastro atual) · agenda do SGI lida às 14h32',
    )
  })

  it('no empate sem conta (duas sem horas previstas, ou duas de infra), a ordem é a do nome', () => {
    const segunda = source.days.find((day) => day.day === '2026-10-19')!
    const semHoras = (id: string, name: string) => ({
      ...segunda.categories.find((category) => category.id === 'fibra')!,
      id,
      name,
      slaHours: null,
    })
    const dia = { ...segunda, categories: [semHoras('z', 'Zeladoria'), semHoras('a', 'Aferição')] }
    expect(buildDayLines(dia).map((line) => [line.name, line.cells.map((cell) => cell.fits)])).toEqual([
      ['Aferição', [null, null]],
      ['Zeladoria', [null, null]],
    ])
  })

  it('a aba Categorias conta as linhas que mostra: aberto, fechado, passado e dia inteiro', () => {
    // Amanhã de manhã: 1 recusada, 1 que cabe e 1 que o SGI não limita.
    expect(buildAgendaDialog(source, { iso: '2026-10-17', periodKey: 'morning' })?.categoryCount).toBe(3)
    // Hoje de manhã, depois das 11h: as três, fechadas.
    expect(buildAgendaDialog(source, { iso: FIXTURE_TODAY, periodKey: 'morning' })?.categoryCount).toBe(3)
    // Segunda 12/10, passado: só as categorias com OS realizada no turno.
    const tarde = buildAgendaDialog(source, { iso: '2026-10-12', periodKey: 'afternoon' })
    expect(tarde?.shift?.realized.length).toBe(2)
    expect(tarde?.categoryCount).toBe(2)
    // Dia inteiro: uma linha por categoria do dia.
    expect(buildAgendaDialog(source, { iso: '2026-10-23', periodKey: null })?.categoryCount).toBe(4)
  })

  it('sem o dia ou o turno na leitura não há janela', () => {
    expect(buildAgendaDialog(source, { iso: '2026-01-01', periodKey: null })).toBeNull()
    expect(buildAgendaDialog(source, { iso: '2026-10-17', periodKey: 'noite' })).toBeNull()
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
