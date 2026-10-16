import { describe, expect, it } from 'vitest'

import type { TodayOsRow } from './todayOsModel'
import {
  compareSlaText,
  filterTodayRows,
  formatClockMinutes,
  hasTodayTableFilters,
  NO_SCHEDULE_LABEL,
  OS_LIST_COLUMNS,
  osRowSearchText,
  rescheduleDescription,
  slaBarShares,
  sortTodayRows,
  tableMinWidth,
  TODAY_COLUMNS,
  TODAY_TABLE_MIN_WIDTH,
  todayCellText,
  todayColumnOptions,
  unassignedPresetPeriods,
} from './todayOsTableModel'

/**
 * Teste espelho dos filtros de coluna da lista de OS de hoje.
 *
 * O que ele protege: o texto que a célula mostra é o mesmo pelo qual a coluna
 * filtra e ordena, as opções de uma coluna respeitam os filtros das OUTRAS
 * colunas (e não o dela mesma), e a ausência é um valor escolhível, não um
 * buraco.
 */

function row(overrides: Partial<TodayOsRow> = {}): TodayOsRow {
  return {
    id: 'OS-2026-1234',
    period: 'Manhã',
    unscheduled: false,
    endedBy: null,
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    technician: 'Ana Souza',
    team: 'Infra',
    hasTechnician: true,
    status: 'Concluída',
    detail: 'Instalação Realizada',
    unassignedAtRisk: false,
    slaMinutes: null,
    serviceMinutes: null,
    rescheduleCount: 0,
    rescheduledAt: null,
    rescheduledBy: null,
    rescheduledByKind: null,
    reschedulingReason: null,
    ...overrides,
  }
}

const lista = [
  row({ id: 'OS-2026-10', city: 'Atibaia', team: 'Infra', technician: 'Ana Souza' }),
  row({ id: 'OS-2026-9', city: 'Piracaia', team: 'Terceirizada', technician: 'Bruno Lima' }),
  row({ id: 'OS-2026-100', city: 'Atibaia', team: null, technician: null, hasTechnician: false }),
]

describe('colunas da lista', () => {
  it('declara largura para todas e o piso da tabela é a soma delas', () => {
    expect(TODAY_COLUMNS.every((column) => column.width > 0)).toBe(true)
    expect(TODAY_TABLE_MIN_WIDTH).toBe(
      TODAY_COLUMNS.reduce((total, column) => total + column.width, 0),
    )
  })

  it('escreve a ausência por extenso, que é o mesmo texto da opção de filtro', () => {
    const vazia = row({ period: null, team: null, technician: null, hasTechnician: false, detail: null })

    expect(todayCellText(vazia, 'period')).toBe('Sem turno')
    expect(todayCellText(vazia, 'team')).toBe('Sem equipe')
    expect(todayCellText(vazia, 'technician')).toBe('Sem técnico')
    expect(todayCellText(row({ technician: null }), 'technician')).toBe('Técnico sem nome')
    expect(todayCellText(vazia, 'detail')).toBe('·')
  })

  it('a OS sem agendamento escreve "Sem agendamento" no Turno, e é ausência como "Sem turno"', () => {
    // A Ativação Remota nasce sem agendamento no SGI (15/10/2026): não tem
    // turno porque não tem data marcada, e a célula diz isso, não "Sem turno".
    const semAgenda = row({
      id: 'OS-2026-2',
      period: null,
      unscheduled: true,
      technician: null,
      hasTechnician: false,
    })
    const comTurno = row({ id: 'OS-2026-1', period: 'Tarde' })

    expect(todayCellText(semAgenda, 'period')).toBe(NO_SCHEDULE_LABEL)
    // Sem executor, o Técnico diz "Sem técnico", como em qualquer OS.
    expect(todayCellText(semAgenda, 'technician')).toBe('Sem técnico')
    expect(
      sortTodayRows([semAgenda, comTurno], { column: 'period', direction: 'asc' }).map((item) => item.id),
    ).toEqual(['OS-2026-1', 'OS-2026-2'])
    expect(todayColumnOptions([semAgenda, comTurno], 'period', {})).toEqual([
      { value: 'Tarde', count: 1 },
      { value: NO_SCHEDULE_LABEL, count: 1 },
    ])
  })
})

describe('recorte por coluna', () => {
  it('lista vazia é sem filtro, e a seleção recorta pelo texto da célula', () => {
    expect(filterTodayRows(lista, {})).toHaveLength(3)
    expect(filterTodayRows(lista, { city: [] })).toHaveLength(3)
    expect(filterTodayRows(lista, { city: ['Atibaia'] }).map((item) => item.id)).toEqual([
      'OS-2026-10',
      'OS-2026-100',
    ])
    expect(hasTodayTableFilters({ city: [] })).toBe(false)
    expect(hasTodayTableFilters({ city: ['Atibaia'] })).toBe(true)
  })

  it('a ausência é escolhível como qualquer outro valor', () => {
    expect(filterTodayRows(lista, { team: ['Sem equipe'] }).map((item) => item.id)).toEqual([
      'OS-2026-100',
    ])
  })

  it('combina colunas diferentes com E', () => {
    expect(
      filterTodayRows(lista, { city: ['Atibaia'], team: ['Infra'] }).map((item) => item.id),
    ).toEqual(['OS-2026-10'])
  })
})

describe('opções de uma coluna', () => {
  it('conta no contexto das outras colunas e ignora o filtro da própria', () => {
    // Com Atibaia escolhido em Cidade, a lista de cidades continua com as duas
    // para o gestor poder acrescentar Piracaia; já Equipe só mostra o que
    // sobrou dentro de Atibaia.
    expect(todayColumnOptions(lista, 'city', { city: ['Atibaia'] })).toEqual([
      { value: 'Atibaia', count: 2 },
      { value: 'Piracaia', count: 1 },
    ])
    expect(todayColumnOptions(lista, 'team', { city: ['Atibaia'] })).toEqual([
      { value: 'Infra', count: 1 },
      { value: 'Sem equipe', count: 1 },
    ])
  })

  it('ordena em português e joga a ausência para o fim', () => {
    expect(todayColumnOptions(lista, 'technician', {}).map((option) => option.value)).toEqual([
      'Ana Souza',
      'Bruno Lima',
      'Sem técnico',
    ])
  })
})

describe('ordenação por coluna', () => {
  it('sem escolha, devolve a ordem que a lista já tinha', () => {
    expect(sortTodayRows(lista, null).map((item) => item.id)).toEqual([
      'OS-2026-10',
      'OS-2026-9',
      'OS-2026-100',
    ])
  })

  it('ordena texto em português nos dois sentidos', () => {
    expect(
      sortTodayRows(lista, { column: 'city', direction: 'asc' }).map((item) => item.city),
    ).toEqual(['Atibaia', 'Atibaia', 'Piracaia'])
    expect(
      sortTodayRows(lista, { column: 'city', direction: 'desc' }).map((item) => item.city),
    ).toEqual(['Piracaia', 'Atibaia', 'Atibaia'])
  })

  it('o código da OS ordena por número, e não como texto', () => {
    expect(sortTodayRows(lista, { column: 'id', direction: 'asc' }).map((item) => item.id)).toEqual([
      'OS-2026-9',
      'OS-2026-10',
      'OS-2026-100',
    ])
  })

  it('empate na coluna volta ao código, para a ordem não depender do acaso', () => {
    const rows = sortTodayRows(lista, { column: 'city', direction: 'asc' })

    expect(rows.slice(0, 2).map((item) => item.id)).toEqual(['OS-2026-10', 'OS-2026-100'])
  })

  it('no sentido inverso, a lista é o espelho da ordem crescente', () => {
    const crescente = sortTodayRows(lista, { column: 'city', direction: 'asc' })
    const decrescente = sortTodayRows(lista, { column: 'city', direction: 'desc' })

    expect(decrescente.map((item) => item.id)).toEqual(
      [...crescente].reverse().map((item) => item.id),
    )
  })

  it('a ausência fica no fim nos DOIS sentidos, e não no meio dos turnos', () => {
    const turnos = [
      row({ id: 'OS-1', period: null }),
      row({ id: 'OS-2', period: 'Tarde' }),
      row({ id: 'OS-3', period: 'Manhã' }),
    ]

    expect(
      sortTodayRows(turnos, { column: 'period', direction: 'asc' }).map((item) => item.period),
    ).toEqual(['Manhã', 'Tarde', null])
    expect(
      sortTodayRows(turnos, { column: 'period', direction: 'desc' }).map((item) => item.period),
    ).toEqual(['Tarde', 'Manhã', null])
  })

  it('valor do SGI que começa com "sem" não é tratado como ausência', () => {
    // "sem conexão" é categoria de verdade, e tem que ordenar junto das outras.
    const categorias = [
      row({ id: 'OS-1', category: 'sem conexão' }),
      row({ id: 'OS-2', category: 'troca de equipamento' }),
      row({ id: 'OS-3', category: 'fibra instalação' }),
    ]

    expect(
      sortTodayRows(categorias, { column: 'category', direction: 'asc' }).map(
        (item) => item.category,
      ),
    ).toEqual(['fibra instalação', 'sem conexão', 'troca de equipamento'])
  })
})

describe('recorte que não sobra nada', () => {
  it('filtro sem correspondência devolve lista vazia, e é isso que a tela mostra', () => {
    const vazio = filterTodayRows(lista, { city: ['Campinas'] })

    expect(vazio).toEqual([])
    // É o número que o cabeçalho escreve como "0 de 3 OS".
    expect(vazio.length).toBe(0)
    expect(lista.length).toBe(3)
  })

  it('opções de outra coluna, dentro de um recorte vazio, não quebram nem inventam', () => {
    expect(todayColumnOptions(lista, 'team', { city: ['Campinas'] })).toEqual([])
  })

  it('seleção que deixou de existir continua valendo, e a lista esvazia', () => {
    // O filtro de coluna NÃO volta sozinho ao neutro, diferente dos filtros da
    // página: quem desfaz é o "Restaurar tabela". A lista vazia, com a frase
    // própria, é o que avisa o gestor.
    expect(filterTodayRows(lista, { technician: ['Carlos que saiu da base'] })).toEqual([])
  })
})

describe('coluna Data da janela de OS do período', () => {
  const periodo = [
    row({ id: 'OS-2026-1', date: '2026-09-02' }),
    row({ id: 'OS-2026-2', date: '2026-08-30' }),
    row({ id: 'OS-2026-3', date: '2026-09-01' }),
    row({ id: 'OS-2026-4', date: '2026-09-01' }),
  ]

  it('a janela põe a Data na frente, e a agenda de hoje segue com as nove colunas', () => {
    expect(OS_LIST_COLUMNS.map((column) => column.label)).toEqual([
      'Data',
      ...TODAY_COLUMNS.map((column) => column.label),
    ])
    expect(TODAY_COLUMNS.some((column) => column.key === 'date')).toBe(false)
    expect(tableMinWidth(OS_LIST_COLUMNS)).toBe(TODAY_TABLE_MIN_WIDTH + OS_LIST_COLUMNS[0].width)
  })

  it('escreve a data no formato brasileiro, e a linha sem data leva o traço', () => {
    expect(todayCellText(periodo[0], 'date')).toBe('02/09/2026')
    expect(todayCellText(row(), 'date')).toBe('·')
  })

  it('ordena pelo calendário nos dois sentidos, e não pelo texto dd/mm', () => {
    const crescente = sortTodayRows(periodo, { column: 'date', direction: 'asc' })
    const decrescente = sortTodayRows(periodo, { column: 'date', direction: 'desc' })

    expect(crescente.map((item) => item.id)).toEqual(['OS-2026-2', 'OS-2026-3', 'OS-2026-4', 'OS-2026-1'])
    expect(decrescente.map((item) => item.id)).toEqual(['OS-2026-1', 'OS-2026-4', 'OS-2026-3', 'OS-2026-2'])
  })

  it('a lista do filtro de Data vem na ordem do calendário, com a contagem de cada dia', () => {
    expect(todayColumnOptions(periodo, 'date', {})).toEqual([
      { value: '30/08/2026', count: 1 },
      { value: '01/09/2026', count: 2 },
      { value: '02/09/2026', count: 1 },
    ])
  })

  it('o filtro de Data recorta a lista e conta como filtro ativo', () => {
    const filtros = { date: ['01/09/2026'] }

    expect(filterTodayRows(periodo, filtros).map((item) => item.id)).toEqual(['OS-2026-3', 'OS-2026-4'])
    expect(hasTodayTableFilters(filtros)).toBe(true)
  })

  it('devolve o mesmo tipo de linha que recebeu, com o que ela carregava a mais', () => {
    const comOrigem = periodo.map((item) => ({ ...item, origem: item.id }))

    expect(sortTodayRows(filterTodayRows(comOrigem, {}), null)[0].origem).toBe('OS-2026-1')
  })
})

/**
 * Colunas SLA e Reagendada (TSK-892, 13/10/2026). O que elas congelam: o
 * tempo vai em relógio, sem decimal; a concluída compara o real com o
 * previsto; a OS nunca reagendada diz "Não", que é valor e não ausência; e
 * a dica do "Sim" conta o último reagendamento por extenso.
 */
describe('colunas SLA e Reagendada', () => {
  it('as duas entraram na lista, SLA ao lado da Categoria e Reagendada ao lado do Status', () => {
    const labels = TODAY_COLUMNS.map((column) => column.label)

    expect(labels.indexOf('SLA')).toBe(labels.indexOf('Categoria') + 1)
    expect(labels.indexOf('Reagendada')).toBe(labels.indexOf('Status') + 1)
    expect(TODAY_COLUMNS.find((column) => column.key === 'sla')?.filterable).toBe(false)
    expect(TODAY_COLUMNS.find((column) => column.key === 'rescheduled')?.filterable).toBe(true)
  })

  it('o tempo vai no formato de relógio, sem decimal', () => {
    expect(formatClockMinutes(90)).toBe('1h30')
    expect(formatClockMinutes(40)).toBe('40min')
    expect(formatClockMinutes(480)).toBe('8h')
    expect(formatClockMinutes(65)).toBe('1h05')
    expect(formatClockMinutes(0)).toBe('0min')
  })

  it('SLA escreve o previsto e, na concluída com serviço medido, o real antes dele', () => {
    expect(todayCellText(row({ slaMinutes: 90 }), 'sla')).toBe('1h30')
    expect(todayCellText(row({ slaMinutes: 90, serviceMinutes: 72 }), 'sla')).toBe('1h12 de 1h30')
    expect(todayCellText(row({ slaMinutes: null, serviceMinutes: 72 }), 'sla')).toBe('·')
  })

  it('SLA ordena pela proporção do previsto usada; sem medida vem depois, pelo previsto; o traço vai para o fim', () => {
    const linhas = [
      row({ id: 'OS-2026-1', slaMinutes: 90, serviceMinutes: 100 }),
      row({ id: 'OS-2026-2', slaMinutes: 40 }),
      row({ id: 'OS-2026-3', slaMinutes: null }),
      row({ id: 'OS-2026-4', slaMinutes: 90, serviceMinutes: 50 }),
      row({ id: 'OS-2026-5', slaMinutes: 480 }),
      // 47h10 de 6h: previsto maior que o das outras, e a que mais passou dele.
      row({ id: 'OS-2026-6', slaMinutes: 360, serviceMinutes: 2830 }),
    ]
    const crescente = sortTodayRows(linhas, { column: 'sla', direction: 'asc' })
    const decrescente = sortTodayRows(linhas, { column: 'sla', direction: 'desc' })

    expect(decrescente.map((item) => item.id)).toEqual([
      'OS-2026-6',
      'OS-2026-1',
      'OS-2026-4',
      'OS-2026-5',
      'OS-2026-2',
      'OS-2026-3',
    ])
    expect(crescente.map((item) => item.id)).toEqual([
      'OS-2026-2',
      'OS-2026-5',
      'OS-2026-4',
      'OS-2026-1',
      'OS-2026-6',
      'OS-2026-3',
    ])
    expect(compareSlaText('40min', '1h30')).toBeLessThan(0)
    // Medida vale mais que a sem medida, qualquer que seja o previsto.
    expect(compareSlaText('6h', '4h35 de 2h40')).toBeLessThan(0)
    // Proporção, não previsto: 4h35 de 2h40 (1,7) passa 4h51 de 6h (0,8).
    expect(compareSlaText('4h35 de 2h40', '4h51 de 6h')).toBeGreaterThan(0)
    // Mesma proporção: o tempo real maior vem depois.
    expect(compareSlaText('2h de 2h', '1h de 1h')).toBeGreaterThan(0)
    expect(compareSlaText('1h40 de 1h30', '1h12 de 1h30')).toBeGreaterThan(0)
  })

  it('Reagendada diz Não, Sim ou Sim com a quantidade, e filtra por esse texto', () => {
    expect(todayCellText(row(), 'rescheduled')).toBe('Não')
    expect(todayCellText(row({ rescheduleCount: 1 }), 'rescheduled')).toBe('Sim')
    expect(todayCellText(row({ rescheduleCount: 3 }), 'rescheduled')).toBe('Sim 3x')

    const linhas = [row({ id: 'OS-2026-1' }), row({ id: 'OS-2026-2', rescheduleCount: 2 })]
    expect(filterTodayRows(linhas, { rescheduled: ['Sim 2x'] }).map((item) => item.id)).toEqual(['OS-2026-2'])
    expect(todayColumnOptions(linhas, 'rescheduled', {})).toEqual([
      { value: 'Não', count: 1 },
      { value: 'Sim 2x', count: 1 },
    ])
  })

  it('a dica do Sim conta o último reagendamento: quando, quem e o motivo', () => {
    expect(
      rescheduleDescription(
        row({
          rescheduleCount: 1,
          rescheduledAt: '2026-10-09T14:53:21-03:00',
          rescheduledBy: 'André Ricardo',
          rescheduledByKind: 'employee',
          reschedulingReason: 'a pedido do cliente',
        }),
      ),
    ).toBe(
      'Reagendada uma vez, em 09/10/2026 às 14:53, por André Ricardo (colaborador). Motivo: a pedido do cliente.',
    )
    // Login de cliente, se o SGI um dia permitir; sem o tipo, só o nome.
    expect(
      rescheduleDescription(
        row({ rescheduleCount: 1, rescheduledBy: 'Maria', rescheduledByKind: 'customer', reschedulingReason: 'viagem' }),
      ),
    ).toBe('Reagendada uma vez, por Maria (cliente). Motivo: viagem.')
    expect(rescheduleDescription(row({ rescheduleCount: 1, rescheduledBy: 'Maria', reschedulingReason: 'x' }))).toBe(
      'Reagendada uma vez, por Maria. Motivo: x.',
    )
    expect(
      rescheduleDescription(
        row({ rescheduleCount: 2, rescheduledAt: '2026-10-09T14:53:21-03:00', rescheduledBy: null }),
      ),
    ).toBe('Reagendada 2 vezes. A última em 09/10/2026 às 14:53. Motivo: motivo não informado.')
    expect(rescheduleDescription(row())).toBeNull()
  })
})

/**
 * Barra da coluna SLA (13/10/2026): azul até o previsto, âmbar no que passa
 * dele, na escala do maior dos dois tempos. Sem cor de "bom" abaixo do
 * previsto, e sem barra sem os dois tempos.
 */
describe('barra da coluna SLA', () => {
  it('dentro do previsto, só o azul, proporcional ao real', () => {
    expect(slaBarShares(row({ slaMinutes: 120, serviceMinutes: 24 }))).toEqual({ within: 0.2, over: 0 })
    expect(slaBarShares(row({ slaMinutes: 90, serviceMinutes: 90 }))).toEqual({ within: 1, over: 0 })
  })

  it('acima do previsto, o azul vai até o previsto e o resto é âmbar, somando a barra inteira', () => {
    const bar = slaBarShares(row({ slaMinutes: 40, serviceMinutes: 57 }))

    expect(bar?.within).toBeCloseTo(40 / 57)
    expect(bar?.over).toBeCloseTo(17 / 57)
    expect((bar?.within ?? 0) + (bar?.over ?? 0)).toBeCloseTo(1)
  })

  it('sem o tempo real ou sem o previsto não há barra', () => {
    expect(slaBarShares(row({ slaMinutes: 90 }))).toBeNull()
    expect(slaBarShares(row({ serviceMinutes: 30 }))).toBeNull()
    expect(slaBarShares(row({ slaMinutes: 0, serviceMinutes: 30 }))).toBeNull()
  })

  it('serviço de zero minuto com previsto é barra vazia, e não ausência', () => {
    expect(slaBarShares(row({ slaMinutes: 40, serviceMinutes: 0 }))).toEqual({ within: 0, over: 0 })
  })
})

describe('atalho "sem técnico" e quem fechou a OS sem técnico', () => {
  it('o atalho abre pelos turnos que a legenda nomeia, ou por todos os que ela conta', () => {
    const contagem = [
      { period: 'Manhã', count: 2 },
      { period: 'Tarde', count: 0 },
      { period: null, count: 1 },
    ]

    expect(unassignedPresetPeriods(contagem, 'Manhã')).toEqual(['Manhã'])
    expect(unassignedPresetPeriods(contagem, null)).toEqual(['Manhã', 'Sem turno'])
  })

  it('com os turnos contados, a Ativação Remota pendente fica fora da lista do atalho', () => {
    const remota = row({ id: 'OS-R', period: 'Manhã', unscheduled: true, technician: null, hasTechnician: false })
    const semTecnico = row({ id: 'OS-T', period: 'Manhã', technician: null, hasTechnician: false })
    const recorte = { technician: ['Sem técnico'], period: unassignedPresetPeriods([{ period: 'Manhã', count: 1 }], null) }

    expect(filterTodayRows([remota, semTecnico], recorte).map((item) => item.id)).toEqual(['OS-T'])
  })

  it('a busca acha a OS pelo nome de quem a fechou', () => {
    expect(osRowSearchText(row({ endedBy: 'Bruno Suporte' }))).toContain('Bruno Suporte')
  })
})

describe('busca na lista de OS', () => {
  it('acha também quem reagendou e o motivo, que só a dica de mouse mostra', () => {
    expect(osRowSearchText(row({ rescheduledBy: 'André Ricardo', reschedulingReason: 'chuva' }))).toBe(
      'André Ricardo chuva',
    )
    expect(osRowSearchText(row()).trim()).toBe('')
  })
})
