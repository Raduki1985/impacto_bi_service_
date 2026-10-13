import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import { defaultOverviewOsFilters, OVERVIEW_OS_NO_TEAM } from '../../data/overviewOsFilters'
import {
  applyTodayFilters,
  buildCarryOverOs,
  buildCarryOverRows,
  buildTodayRows,
  buildTodaySummary,
  buildTodayUnassigned,
  carryOverCornerLabel,
  carryOverMessage,
  compareOperationOrder,
  formatClock,
  hasTodayFilters,
  hourOf,
  rescheduledCornerLabel,
  rescheduledToDoCount,
  serviceMinutesOf,
  TODAY_BUCKETS,
  todayOnly,
  toPeriodOsRow,
  unassignedCornerLabel,
} from './todayOsModel'

function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  return {
    id: 'OS-1',
    dateISO: '2026-09-18',
    technicianId: 'tec-1',
    team: 'Terceirizada',
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    status: 'Concluída',
    statusKey: 'completed',
    resolution: null,
    ...overrides,
  }
}

const day = [
  record({ id: '1' }),
  record({ id: '2' }),
  record({ id: '3', status: 'Em Deslocamento', statusKey: 'in_motion' }),
  record({ id: '4', status: 'Técnico no Local', statusKey: 'arrived' }),
  record({ id: '5', status: 'Agendada', statusKey: 'scheduled' }),
  record({ id: '6', status: 'Agendada', statusKey: 'scheduled' }),
  record({ id: '7', status: 'Reagendada', statusKey: 'rescheduled' }),
  record({ id: '8', status: 'Improdutiva', statusKey: 'unproductive' }),
  record({ id: '9', status: 'Encerrada', statusKey: 'closed' }),
]

describe('resumo da agenda de hoje', () => {
  it('separa o dia nas cinco caixas, na ordem em que o gestor pergunta', () => {
    const summary = buildTodaySummary(day)

    expect(summary.total).toBe(9)
    expect(summary.buckets.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ['Concluídas', 2],
      ['Em campo', 2],
      ['A fazer', 3],
      ['Improdutivas', 1],
      ['Não executadas', 1],
    ])
    expect(summary.buckets[0].share).toBeCloseTo(2 / 9)
    expect(summary.buckets[1].statuses).toEqual([['Em Deslocamento', 1], ['Técnico no Local', 1]])
    expect(summary.buckets[2].statuses).toEqual([['Agendada', 2], ['Reagendada', 1]])
  })

  it('só mostra "sem classificação" quando alguma OS caiu nela', () => {
    const withUnknown = buildTodaySummary([...day, record({ id: '10', status: 'Rascunho', statusKey: null })])

    expect(withUnknown.buckets).toHaveLength(6)
    expect(withUnknown.buckets[5]).toMatchObject({ label: 'Sem classificação', count: 1 })
    expect(TODAY_BUCKETS[5].key).toBe('unknown')
  })

  it('agenda vazia tem total zero e caixas zeradas, sem divisão por zero', () => {
    const summary = buildTodaySummary([])

    expect(summary.total).toBe(0)
    expect(summary.buckets).toHaveLength(5)
    for (const bucket of summary.buckets) {
      expect(bucket.count).toBe(0)
      expect(bucket.share).toBe(0)
    }
  })
})

describe('filtros que valem para hoje', () => {
  it('aplica equipe, técnico, tipo, categoria e cidade, e ignora período e status', () => {
    const rows = [
      record({ id: '1', team: 'Câmeras', dateISO: '2026-01-01', status: 'Agendada', statusKey: 'scheduled' }),
      record({ id: '2', team: 'Terceirizada' }),
    ]

    expect(applyTodayFilters(rows, defaultOverviewOsFilters).map((row) => row.id)).toEqual(['1', '2'])
    expect(
      applyTodayFilters(rows, { ...defaultOverviewOsFilters, team: ['Câmeras'], status: ['Concluída'] }).map(
        (row) => row.id,
      ),
    ).toEqual(['1'])
    expect(applyTodayFilters(rows, { ...defaultOverviewOsFilters, city: ['Piracaia'] })).toEqual([])
    // Várias equipes marcadas: basta a OS estar em uma delas.
    expect(
      applyTodayFilters(rows, { ...defaultOverviewOsFilters, team: ['Câmeras', 'Terceirizada'] }).map(
        (row) => row.id,
      ),
    ).toEqual(['1', '2'])
  })

  it('Sem equipe traz as OS de hoje sem equipe, que é onde estão as sem técnico', () => {
    const rows = [record({ id: '1', team: null, technicianId: null }), record({ id: '2', team: 'Câmeras' })]

    expect(
      applyTodayFilters(rows, { ...defaultOverviewOsFilters, team: [OVERVIEW_OS_NO_TEAM] }).map((row) => row.id),
    ).toEqual(['1'])
  })

  it('Sem equipe marcada junto de uma equipe traz as duas: a sem equipe e a da equipe', () => {
    const rows = [
      record({ id: '1', team: null, technicianId: null }),
      record({ id: '2', team: 'Câmeras' }),
      record({ id: '3', team: 'Infra' }),
    ]

    expect(
      applyTodayFilters(rows, { ...defaultOverviewOsFilters, team: ['Câmeras', OVERVIEW_OS_NO_TEAM] }).map(
        (row) => row.id,
      ),
    ).toEqual(['1', '2'])
  })

  it('sabe quando algum filtro de hoje está ativo', () => {
    expect(hasTodayFilters(defaultOverviewOsFilters)).toBe(false)
    expect(hasTodayFilters({ ...defaultOverviewOsFilters, status: ['Concluída'] })).toBe(false)
    expect(hasTodayFilters({ ...defaultOverviewOsFilters, dateFrom: '2026-01-01' })).toBe(false)
    expect(hasTodayFilters({ ...defaultOverviewOsFilters, team: ['Câmeras'] })).toBe(true)
  })
})

describe('formatação da faixa', () => {
  it('lê a hora do próprio texto do serviço, sem passar pelo fuso da máquina', () => {
    expect(formatClock('2026-09-18T16:16:01.077760-03:00')).toBe('16h16')
    expect(formatClock('2026-09-18T09:05:00Z')).toBe('09h05')
    expect(formatClock(null)).toBeNull()
    expect(formatClock('sem hora')).toBeNull()
  })
})

describe('lista de OS da caixa aberta', () => {
  const nomes = new Map([
    ['tec-1', 'Ana Souza'],
    ['tec-2', 'Bruno Lima'],
  ])

  const agenda = [
    record({ id: 'OS-5', period: 'Tarde', technicianId: 'tec-1' }),
    record({ id: 'OS-4', period: 'Manhã', technicianId: 'tec-2' }),
    record({ id: 'OS-3', period: 'Manhã', technicianId: 'tec-1' }),
    record({ id: 'OS-2', period: null, technicianId: 'tec-1' }),
    record({ id: 'OS-1', period: 'Manhã', technicianId: null }),
  ]

  it('ordena por turno, depois técnico, depois código, com ausência no fim', () => {
    const rows = buildTodayRows(agenda, 'all', nomes)

    expect(rows.map((row) => row.id)).toEqual(['OS-3', 'OS-4', 'OS-1', 'OS-5', 'OS-2'])
    expect(rows.map((row) => row.period)).toEqual(['Manhã', 'Manhã', 'Manhã', 'Tarde', null])
    expect(rows[2].technician).toBeNull()
  })

  it('mostra só as OS da caixa escolhida', () => {
    const rows = buildTodayRows(
      [
        ...agenda,
        record({ id: 'OS-9', status: 'Improdutiva', statusKey: 'unproductive' }),
      ],
      'unproductive',
      nomes,
    )

    expect(rows.map((row) => row.id)).toEqual(['OS-9'])
  })

  it('leva a equipe do técnico como está no cadastro do SGI', () => {
    const rows = buildTodayRows(
      [
        record({ id: 'OS-1', team: 'Terceirizada' }),
        record({ id: 'OS-2', team: null, technicianId: null }),
      ],
      'all',
      nomes,
    )

    expect(rows.map((row) => row.team)).toEqual(['Terceirizada', null])
  })

  it('traduz o identificador do técnico e deixa nulo quem não está no catálogo', () => {
    const rows = buildTodayRows(
      [record({ id: 'OS-7', technicianId: 'tec-1' }), record({ id: 'OS-8', technicianId: 'tec-9' })],
      'all',
      nomes,
    )

    expect(rows.map((row) => row.technician)).toEqual(['Ana Souza', null])
  })

  it('o detalhe muda com a situação: resolução, motivo e hora de início', () => {
    const rows = buildTodayRows(
      [
        record({ id: 'OS-1', resolution: 'Instalação Realizada' }),
        record({
          id: 'OS-2',
          status: 'Improdutiva',
          statusKey: 'unproductive',
          unproductiveReason: 'Cliente ausente',
        }),
        record({
          id: 'OS-3',
          status: 'Em Andamento',
          statusKey: 'in_progress',
          startedAt: '2026-09-21T09:12:33-03:00',
        }),
        // A fazer não tem desfecho nenhum: a coluna fica vazia, e não com um
        // texto inventado.
        record({ id: 'OS-4', status: 'Agendada', statusKey: 'scheduled' }),
      ],
      'all',
      nomes,
    )

    expect(rows.map((row) => row.detail)).toEqual([
      'Instalação Realizada',
      'Cliente ausente',
      'Iniciada às 09h12',
      null,
    ])
  })

  it('a lista de cada caixa tem exatamente o que a caixa conta', () => {
    // É a promessa da faixa: o número que o gestor lê e a lista que ele abre
    // saem do mesmo recorte e da mesma classificação por chave de status.
    const resumo = buildTodaySummary(day)

    for (const caixa of resumo.buckets) {
      expect(buildTodayRows(day, caixa.key, nomes)).toHaveLength(caixa.count)
    }
    expect(buildTodayRows(day, 'all', nomes)).toHaveLength(resumo.total)
    expect(resumo.buckets.reduce((soma, caixa) => soma + caixa.count, 0)).toBe(resumo.total)
  })

  it('caixa sem nenhuma OS abre uma lista vazia, e não a agenda inteira', () => {
    expect(buildTodayRows(agenda, 'unproductive', nomes)).toEqual([])
  })

  it('abre também a caixa Sem classificação, com a OS de chave desconhecida', () => {
    const rows = buildTodayRows(
      [...agenda, record({ id: 'OS-0', status: 'Rascunho', statusKey: null })],
      'unknown',
      nomes,
    )

    expect(rows.map((row) => row.id)).toEqual(['OS-0'])
  })

  it('separa a OS sem executor da OS com executor sem nome no cadastro', () => {
    const rows = buildTodayRows(
      [
        record({ id: 'OS-1', technicianId: null }),
        record({ id: 'OS-2', technicianId: 'tec-sem-nome' }),
        record({ id: 'OS-3', technicianId: 'tec-1' }),
      ],
      'all',
      nomes,
    )

    expect(rows.map((row) => [row.id, row.technician, row.hasTechnician])).toEqual([
      ['OS-3', 'Ana Souza', true],
      ['OS-2', null, true],
      ['OS-1', null, false],
    ])
  })

  it('desempata pelo código quando turno e técnico são os mesmos', () => {
    const rows = buildTodayRows(
      [
        record({ id: 'OS-9', period: 'Manhã', technicianId: 'tec-1' }),
        record({ id: 'OS-7', period: 'Manhã', technicianId: 'tec-1' }),
        record({ id: 'OS-8', period: 'Manhã', technicianId: 'tec-1' }),
      ],
      'all',
      nomes,
    )

    expect(rows.map((row) => row.id)).toEqual(['OS-7', 'OS-8', 'OS-9'])
  })

  it('turno fora do de-para do serviço fica depois dos conhecidos e antes do vazio', () => {
    const rows = buildTodayRows(
      [
        record({ id: 'OS-1', period: null }),
        record({ id: 'OS-2', period: 'Madrugada' }),
        record({ id: 'OS-3', period: 'Tarde' }),
      ],
      'all',
      nomes,
    )

    expect(rows.map((row) => row.period)).toEqual(['Tarde', 'Madrugada', null])
  })
})

/**
 * Sinal de OS sem técnico, aprovado pelo Mário em 22/09/2026.
 *
 * A régua é do TURNO: como o técnico é designado no próprio dia da visita,
 * OS sem dono de manhã cedo é o fluxo normal, e só vira aviso depois da hora
 * em que aquele turno costuma começar (manhã 10h, tarde 15h).
 */
/**
 * SLA e reagendamento na linha (TSK-892, 13/10/2026): o tempo real de serviço
 * só na concluída, e o reagendamento como a OS o guarda, com quantas vezes.
 */
describe('SLA e reagendamento na linha', () => {
  const nomes = new Map([['tec-1', 'Ana Souza']])

  it('mede o serviço do início ao fim só na concluída, e nunca inventa na improdutiva', () => {
    const horarios = { startedAt: '2026-09-18T09:00:00-03:00', finishedAt: '2026-09-18T10:12:30-03:00' }

    expect(serviceMinutesOf(record(horarios))).toBe(73)
    expect(serviceMinutesOf(record({ ...horarios, status: 'Improdutiva', statusKey: 'unproductive' }))).toBeNull()
    expect(serviceMinutesOf(record({ startedAt: horarios.startedAt }))).toBeNull()
    // Fim antes do início é marcação errada: nulo, e não negativo.
    expect(
      serviceMinutesOf(record({ startedAt: horarios.finishedAt, finishedAt: horarios.startedAt })),
    ).toBeNull()
  })

  it('leva o SLA e o reagendamento para a linha, e a OS nunca reagendada fica com zero e nulos', () => {
    const rows = buildTodayRows(
      [
        record({
          id: 'OS-1',
          slaMinutes: 90,
          rescheduledAt: '2026-09-17T14:53:21-03:00',
          rescheduledBy: 'André Ricardo',
          reschedulingReason: 'chuva',
          rescheduleCount: 2,
        }),
        record({ id: 'OS-2', slaMinutes: 40, rescheduledAt: null, rescheduledBy: 'Alguém', rescheduleCount: 0 }),
        record({ id: 'OS-3' }),
      ],
      'all',
      nomes,
    )

    expect(rows.map((row) => [row.id, row.slaMinutes, row.rescheduleCount, row.rescheduledBy, row.reschedulingReason])).toEqual([
      ['OS-1', 90, 2, 'André Ricardo', 'chuva'],
      ['OS-2', 40, 0, null, null],
      ['OS-3', null, 0, null, null],
    ])
    expect(rows[0].rescheduledAt).toBe('2026-09-17T14:53:21-03:00')
  })

  it('reagendada sem contagem no histórico conta ao menos uma vez', () => {
    const [row] = buildTodayRows(
      [record({ rescheduledAt: '2026-06-01T12:00:00-03:00', rescheduleCount: 0 })],
      'all',
      nomes,
    )

    expect(row.rescheduleCount).toBe(1)
  })
})

/**
 * Atalho "reagendadas" da caixa A fazer (TSK-892): conta pelo status que a
 * caixa já recebe, e a legenda abre a lista filtrada pelo mesmo rótulo.
 */
describe('atalho de reagendadas', () => {
  it('conta as OS de status Reagendada dentro da caixa A fazer, e só lá', () => {
    expect(rescheduledToDoCount(buildTodaySummary(day).buckets)).toBe(1)
    expect(rescheduledToDoCount(buildTodaySummary([record({ id: '1' })]).buckets)).toBe(0)
    expect(rescheduledToDoCount([])).toBe(0)
  })

  it('a legenda é número e "reagendadas", sempre em atenção; uma só fala no singular', () => {
    expect(rescheduledCornerLabel(14)).toEqual({
      label: '14 reagendadas',
      title: '14 OS a fazer já foram reagendadas ao menos uma vez. Abrir a lista.',
      accessibleLabel: '14 OS a fazer reagendadas, ver na lista',
      attention: true,
    })
    expect(rescheduledCornerLabel(1)).toEqual({
      label: '1 reagendada',
      title: '1 OS a fazer já foi reagendada ao menos uma vez. Abrir a lista.',
      accessibleLabel: '1 OS a fazer reagendada, ver na lista',
      attention: true,
    })
  })

  it('sem OS reagendada não há atalho', () => {
    expect(rescheduledCornerLabel(0)).toBeNull()
  })
})

describe('OS a fazer sem técnico', () => {
  const pendentes = [
    record({ id: 'A', status: 'Agendada', statusKey: 'scheduled', period: 'Manhã', technicianId: null }),
    record({ id: 'B', status: 'Agendada', statusKey: 'scheduled', period: 'Manhã', technicianId: null }),
    record({ id: 'C', status: 'Reagendada', statusKey: 'rescheduled', period: 'Tarde', technicianId: null }),
    record({ id: 'D', status: 'Agendada', statusKey: 'scheduled', period: 'Tarde', technicianId: 'tec-1' }),
    // Em campo e concluída sem técnico não existem na prática, e mesmo assim
    // não entram: a caixa mede o que ainda precisa de alguém.
    record({ id: 'E', status: 'Concluída', statusKey: 'completed', technicianId: null }),
  ]

  it('conta só as OS a fazer sem executor designado', () => {
    expect(buildTodayUnassigned(pendentes, 8).total).toBe(3)
  })

  it('de manhã cedo não há risco nenhum: designar no dia é o fluxo normal', () => {
    expect(buildTodayUnassigned(pendentes, 8)).toMatchObject({ atRisk: 0, riskPeriod: null })
    expect(buildTodayUnassigned(pendentes, 9).atRisk).toBe(0)
  })

  it('às 10h a manhã vira sinal, e a tarde continua dentro do normal', () => {
    expect(buildTodayUnassigned(pendentes, 10)).toMatchObject({
      total: 3,
      atRisk: 2,
      riskPeriod: 'Manhã',
    })
  })

  it('às 15h os dois turnos entram, e aí nenhum é nomeado sozinho', () => {
    expect(buildTodayUnassigned(pendentes, 15)).toMatchObject({
      total: 3,
      atRisk: 3,
      riskPeriod: null,
    })
  })

  it('OS sem turno marcado segue a régua da tarde, a mais tardia', () => {
    const semTurno = [
      record({ id: 'X', status: 'Agendada', statusKey: 'scheduled', period: null, technicianId: null }),
    ]

    expect(buildTodayUnassigned(semTurno, 10).atRisk).toBe(0)
    expect(buildTodayUnassigned(semTurno, 15)).toMatchObject({ atRisk: 1, riskPeriod: null })
  })

  it('sem a hora da leitura não inventa alarme, só conta', () => {
    expect(buildTodayUnassigned(pendentes, null)).toMatchObject({ total: 3, atRisk: 0 })
  })

  it('lê a hora da leitura do serviço pelo texto, sem passar pelo fuso da máquina', () => {
    expect(hourOf('2026-09-22T09:11:02.123456-03:00')).toBe(9)
    expect(hourOf('2026-09-22T16:16:01-03:00')).toBe(16)
    expect(hourOf(null)).toBeNull()
    expect(hourOf('2026-09-22')).toBeNull()
  })
})

/**
 * OS de dias anteriores que o aplicativo nunca fechou. O SGI expira sozinho
 * só a OS que ninguém iniciou, então a que o técnico começou e não terminou
 * fica parada sem prazo para sair de lá.
 */
describe('pendências de dias anteriores', () => {
  const hoje = '2026-09-22'
  const janela = [
    record({ id: 'HOJE-1', dateISO: hoje, status: 'Agendada', statusKey: 'scheduled' }),
    record({
      id: 'OS-2026-6623',
      dateISO: '2026-09-21',
      serviceType: 'Instalação',
      status: 'Pendente de Aprovação',
      statusKey: 'checklist',
      startedAt: '2026-09-21T16:53:00-03:00',
    }),
    // Fechadas ontem não são pendência: elas já têm desfecho.
    record({ id: 'FECHADA', dateISO: '2026-09-21', status: 'Concluída', statusKey: 'completed' }),
    record({ id: 'EXPIRADA', dateISO: '2026-09-21', status: 'Expirada', statusKey: 'expired' }),
  ]

  it('separa o que é de hoje do que ficou para trás', () => {
    expect(todayOnly(janela, hoje).map((row) => row.id)).toEqual(['HOJE-1'])
    expect(buildCarryOverOs(janela, hoje).map((row) => row.id)).toEqual(['OS-2026-6623'])
  })

  it('a mais antiga vem primeiro, porque é a que está parada há mais tempo', () => {
    const varias = [
      record({ id: 'OS-B', dateISO: '2026-09-21', status: 'Agendada', statusKey: 'scheduled' }),
      record({ id: 'OS-A', dateISO: '2026-09-18', status: 'Agendada', statusKey: 'scheduled' }),
    ]

    expect(buildCarryOverOs(varias, hoje).map((row) => row.id)).toEqual(['OS-A', 'OS-B'])
  })

  it('sem caso nenhum não existe aviso', () => {
    expect(carryOverMessage([], hoje, () => '')).toBeNull()
    expect(buildCarryOverOs([record({ id: 'HOJE-1', dateISO: hoje })], hoje)).toEqual([])
  })

  it('com uma OS só, a frase nomeia a OS e diz desde quando ela está parada', () => {
    const mensagem = carryOverMessage(buildCarryOverOs(janela, hoje), hoje, () => '21/09/2026')

    expect(mensagem).toBe(
      'De dias anteriores: a OS-2026-6623 de ontem, instalação, continua aberta no aplicativo, iniciada às 16h53.',
    )
  })

  it('OS de dia anterior que nunca foi iniciada aparece pelo status, sem hora inventada', () => {
    const naoIniciada = [
      record({
        id: 'OS-7',
        dateISO: '2026-09-18',
        status: 'Agendada',
        statusKey: 'scheduled',
        startedAt: null,
      }),
    ]
    const mensagem = carryOverMessage(
      buildCarryOverOs(naoIniciada, hoje),
      hoje,
      () => '18/09/2026',
    )

    expect(mensagem).toContain('de 18/09/2026')
    expect(mensagem).toContain('continua em Agendada')
  })

  it('com mais de uma, conta e aponta a mais antiga', () => {
    const varias = [
      record({ id: 'OS-B', dateISO: '2026-09-21', status: 'Agendada', statusKey: 'scheduled' }),
      record({ id: 'OS-A', dateISO: '2026-09-18', status: 'Agendada', statusKey: 'scheduled' }),
    ]
    const mensagem = carryOverMessage(buildCarryOverOs(varias, hoje), hoje, () => '18/09/2026')

    expect(mensagem).toBe(
      'De dias anteriores: 2 OS continuam abertas no aplicativo. A mais antiga é a OS-A, de 18/09/2026.',
    )
  })
})

describe('marca de risco linha a linha', () => {
  const nomes = new Map([['tec-1', 'Ana Souza']])
  const agenda = [
    record({ id: 'M', status: 'Agendada', statusKey: 'scheduled', period: 'Manhã', technicianId: null }),
    record({ id: 'T', status: 'Agendada', statusKey: 'scheduled', period: 'Tarde', technicianId: null }),
    record({ id: 'D', status: 'Agendada', statusKey: 'scheduled', period: 'Manhã', technicianId: 'tec-1' }),
  ]

  it('a lista marca exatamente o que a caixa contou em risco, pela mesma hora', () => {
    const rows = buildTodayRows(agenda, 'toDo', nomes, 10)

    expect(rows.map((row) => [row.id, row.unassignedAtRisk])).toEqual([
      ['D', false],
      ['M', true],
      ['T', false],
    ])
    expect(rows.filter((row) => row.unassignedAtRisk)).toHaveLength(
      buildTodayUnassigned(agenda, 10).atRisk,
    )
  })

  it('sem a hora da leitura nenhuma linha é marcada', () => {
    for (const row of buildTodayRows(agenda, 'all', nomes)) {
      expect(row.unassignedAtRisk).toBe(false)
    }
  })
})

/**
 * Lista que o aviso de dias anteriores abre (aprovado pelo Mário em
 * 22/09/2026): a mesma tabela das caixas, com a data da OS no Detalhe.
 */
describe('lista do aviso de dias anteriores', () => {
  const nomes = new Map([['tec-1', 'Ana Souza']])
  const hoje = '2026-09-22'
  const datas = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const janela = [
    record({ id: 'HOJE', dateISO: hoje, status: 'Agendada', statusKey: 'scheduled', technicianId: null }),
    record({
      id: 'OS-B',
      dateISO: '2026-09-21',
      status: 'Pendente de Aprovação',
      statusKey: 'checklist',
      startedAt: '2026-09-21T16:53:00-03:00',
    }),
    record({ id: 'OS-A', dateISO: '2026-09-18', status: 'Agendada', statusKey: 'scheduled', technicianId: null }),
    record({ id: 'FECHADA', dateISO: '2026-09-21', status: 'Concluída', statusKey: 'completed' }),
  ]

  it('lista só as OS de dias anteriores ainda abertas, a mais antiga primeiro', () => {
    expect(buildCarryOverRows(janela, hoje, nomes, datas).map((row) => row.id)).toEqual(['OS-A', 'OS-B'])
  })

  it('o Detalhe leva a data da OS e a hora de início, ou diz que ela nunca começou', () => {
    expect(buildCarryOverRows(janela, hoje, nomes, datas).map((row) => row.detail)).toEqual([
      '18/09 · nunca iniciada',
      '21/09 · início 16h53',
    ])
  })

  it('não marca risco de turno linha a linha: a lista inteira já é o alerta', () => {
    for (const row of buildCarryOverRows(janela, hoje, nomes, datas)) {
      expect(row.unassignedAtRisk).toBe(false)
    }
  })

  it('tem exatamente o que o aviso conta', () => {
    expect(buildCarryOverRows(janela, hoje, nomes, datas)).toHaveLength(
      buildCarryOverOs(janela, hoje).length,
    )
  })
})

/**
 * Atalho de dias anteriores no canto da caixa Em campo (23/09/2026): com o
 * sinal de mais, porque essas OS somam POR FORA do número de hoje.
 */
describe('atalho de dias anteriores', () => {
  const hoje = '2026-09-22'
  const ontem = (id: string) =>
    record({ id, dateISO: '2026-09-21', status: 'Pendente de Aprovação', statusKey: 'checklist' })

  it('a legenda é número e "de ontem"; a dica diz que a OS está fora do número de hoje', () => {
    expect(carryOverCornerLabel(buildCarryOverOs([ontem('OS-1')], hoje), hoje)).toEqual({
      label: '1 de ontem',
      title: '1 OS de ontem continua aberta no aplicativo. Ela não está no número de hoje. Abrir a lista.',
      accessibleLabel: '1 OS de ontem em aberto no aplicativo, fora do número de hoje, ver na lista',
      attention: true,
    })
  })

  it('várias, ou mais antigas que ontem, viram "de dias anteriores" na dica', () => {
    expect(carryOverCornerLabel(buildCarryOverOs([ontem('OS-1'), ontem('OS-2')], hoje), hoje)?.title).toContain(
      '2 OS de ontem continuam abertas',
    )
    const antiga = record({ id: 'OS-3', dateISO: '2026-09-18', status: 'Agendada', statusKey: 'scheduled' })
    expect(carryOverCornerLabel(buildCarryOverOs([ontem('OS-1'), antiga], hoje), hoje)).toEqual({
      label: '2 de dias anteriores',
      title: '2 OS de dias anteriores continuam abertas no aplicativo. Elas não estão no número de hoje. Abrir a lista.',
      accessibleLabel: '2 OS de dias anteriores em aberto no aplicativo, fora do número de hoje, ver na lista',
      attention: true,
    })
  })

  it('sem caso não há atalho', () => {
    expect(carryOverCornerLabel([], hoje)).toBeNull()
  })
})

/**
 * Legenda do atalho "sem técnico" (formato do Mário, 23/09/2026): total do
 * dia em cinza antes da hora dos turnos; depois só as atrasadas, com o turno
 * entre parênteses quando é um só.
 */
describe('legenda do atalho sem técnico', () => {
  const pendentes = [
    record({ id: 'A', status: 'Agendada', statusKey: 'scheduled', period: 'Manhã', technicianId: null }),
    record({ id: 'B', status: 'Agendada', statusKey: 'scheduled', period: 'Manhã', technicianId: null }),
    record({ id: 'C', status: 'Agendada', statusKey: 'scheduled', period: 'Tarde', technicianId: null }),
  ]

  it('antes das 10h mostra o total do dia, em cinza', () => {
    expect(unassignedCornerLabel(buildTodayUnassigned(pendentes, 8))).toEqual({
      label: '3 sem técnico',
      title: '3 OS a fazer sem técnico designado. Abrir a lista.',
      accessibleLabel: '3 OS a fazer sem técnico, ver na lista',
      attention: false,
    })
  })

  it('entre 10h e 15h mostra só as da manhã, nomeando o turno; o total fica na dica', () => {
    expect(unassignedCornerLabel(buildTodayUnassigned(pendentes, 11))).toEqual({
      label: '2 sem técnico (manhã)',
      title: '3 OS a fazer sem técnico. 2 da manhã já passaram da hora em que o turno costuma começar. Abrir a lista.',
      accessibleLabel: '2 OS sem técnico da manhã com o turno já iniciado, de 3 no dia, ver na lista',
      attention: true,
    })
  })

  it('depois das 15h tudo que sobrou está atrasado, sem parênteses quando mistura turnos', () => {
    expect(unassignedCornerLabel(buildTodayUnassigned(pendentes, 16))).toEqual({
      label: '3 sem técnico',
      title: '3 OS a fazer sem técnico. Todas já passaram da hora em que o turno costuma começar. Abrir a lista.',
      accessibleLabel: '3 OS sem técnico com o turno já iniciado, de 3 no dia, ver na lista',
      attention: true,
    })
  })

  it('depois das 15h, só a tarde sobrando, nomeia a tarde; uma só fala no singular', () => {
    const soTarde = [pendentes[2]]

    expect(unassignedCornerLabel(buildTodayUnassigned(soTarde, 16))).toEqual({
      label: '1 sem técnico (tarde)',
      title: '1 OS a fazer sem técnico. Ela já passou da hora em que o turno costuma começar. Abrir a lista.',
      accessibleLabel: '1 OS sem técnico da tarde com o turno já iniciado, de 1 no dia, ver na lista',
      attention: true,
    })
  })

  it('sem OS sem técnico não há atalho', () => {
    expect(unassignedCornerLabel(buildTodayUnassigned([], 11))).toBeNull()
  })
})

describe('linha da janela de OS do período', () => {
  it('leva a data e a OS de origem, que é de onde a planilha sai', () => {
    const origem = record({ id: 'OS-9', dateISO: '2026-09-02', period: 'Tarde' })
    const row = toPeriodOsRow(origem, new Map([['tec-1', 'Ana Souza']]))

    expect(row.date).toBe('2026-09-02')
    expect(row.source).toBe(origem)
    expect(row.technician).toBe('Ana Souza')
    expect(row.period).toBe('Tarde')
  })

  it('não marca risco de turno: num dia passado não há mais o que designar', () => {
    const semTecnico = record({ technicianId: null, team: null, status: 'Agendada', statusKey: 'scheduled', period: 'Manhã' })

    expect(toPeriodOsRow(semTecnico, new Map()).unassignedAtRisk).toBe(false)
  })

  it('dentro do dia, a ordem é a mesma da agenda de hoje', () => {
    const names = new Map([['tec-1', 'Bruno'], ['tec-2', 'Ana']])
    const registros = [
      record({ id: 'OS-3', period: 'Tarde', technicianId: 'tec-2' }),
      record({ id: 'OS-2', period: 'Manhã', technicianId: null }),
      record({ id: 'OS-1', period: 'Manhã', technicianId: 'tec-1' }),
      record({ id: 'OS-4', period: 'Manhã', technicianId: 'tec-2' }),
    ]

    expect(registros.map((item) => toPeriodOsRow(item, names)).sort(compareOperationOrder).map((row) => row.id)).toEqual(
      buildTodayRows(registros, 'all', names).map((row) => row.id),
    )
  })
})
