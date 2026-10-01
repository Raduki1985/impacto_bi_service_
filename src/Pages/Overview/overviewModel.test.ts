import { describe, expect, it } from 'vitest'

import {
  buildOverviewOsData,
  OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
} from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_RECORDS, type OverviewOsRecord } from '../../data/overviewOsData'
import {
  applyOverviewOsFilters,
  defaultOverviewOsFilters,
  OVERVIEW_OS_NO_TEAM,
} from '../../data/overviewOsFilters'
import { KNOWN_STATUS_KEYS, osStatusKind } from './osStatusKind'
import {
  buildOsOutcome,
  buildOverviewKpis,
  buildOverviewReadings,
  groupOf,
  INFRASTRUCTURE_SERVICE_TYPE,
  OS_GROUPS,
  OS_OUTCOMES,
  outcomeOf,
  periodTitle,
  RATE_NO_OS,
  RATE_NOT_APPLICABLE,
} from './overviewModel'

/**
 * Teste espelho do modelo da Visão Geral.
 *
 * Os números da base local vêm da projeção sanitizada de sempre (01/08 a
 * 21/08/2026): 1.248 OS, das quais 135 de infraestrutura. É o que permite
 * cravar aqui o efeito da regra de taxas sobre OS de cliente, ao lado dos
 * números da regra antiga, que `buildOverviewOsData` ainda calcula para os
 * gráficos.
 */

function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  return {
    id: 'OS-1',
    dateISO: '2026-08-01',
    technicianId: null,
    team: null,
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    status: 'Concluída',
    statusKey: 'completed',
    resolution: null,
    ...overrides,
  }
}

describe('situação pela chave de status do SGI', () => {
  it('classifica cada chave conhecida, e o resto como sem classificação', () => {
    expect(osStatusKind('completed')).toBe('completed')
    expect(osStatusKind('unproductive')).toBe('unproductive')
    for (const key of ['closed', 'expired', 'cancelled', 'canceled']) {
      expect(osStatusKind(key)).toBe('not-executed')
    }
    for (const key of ['pending', 'scheduled', 'rescheduled']) {
      expect(osStatusKind(key)).toBe('to-do')
    }
    for (const key of ['in_motion', 'arrived', 'in_progress', 'checklist', 'pending_approval', 'provision']) {
      expect(osStatusKind(key)).toBe('in-field')
    }
    expect(osStatusKind(null)).toBe('unknown')
    expect(osStatusKind('waiting_parts')).toBe('unknown')
  })

  it('conhece as chaves que o serviço traduz hoje', () => {
    // As quinze do catálogo do SGI mais as variantes que o de-para do serviço
    // aceita (`canceled`, `provisioning`, subestados de Em Andamento).
    for (const key of [
      'pending', 'scheduled', 'rescheduled', 'in_motion', 'arrived', 'checklist',
      'products_used', 'resolution', 'completed', 'closed', 'unproductive',
      'expired', 'provision', 'pending_approval', 'cancelled',
    ]) {
      expect(KNOWN_STATUS_KEYS).toContain(key)
    }
  })

  it('leva a situação para a saída da OS, e nunca decide pelo rótulo', () => {
    expect(outcomeOf({ statusKey: 'completed' })).toBe('completed')
    expect(outcomeOf({ statusKey: 'unproductive' })).toBe('unproductive')
    expect(outcomeOf({ statusKey: 'expired' })).toBe('notExecuted')
    expect(outcomeOf({ statusKey: 'closed' })).toBe('notExecuted')
    expect(outcomeOf({ statusKey: 'scheduled' })).toBe('open')
    expect(outcomeOf({ statusKey: 'arrived' })).toBe('open')
    expect(outcomeOf({ statusKey: null })).toBe('unknown')
    expect(OS_OUTCOMES.map((outcome) => outcome.key)).toEqual([
      'completed', 'unproductive', 'notExecuted', 'open', 'unknown',
    ])
  })
})

describe('grupo da OS', () => {
  it('separa a infraestrutura pelo tipo, e todo outro tipo é OS de cliente', () => {
    expect(groupOf({ serviceType: INFRASTRUCTURE_SERVICE_TYPE })).toBe('infrastructure')
    for (const serviceType of ['Instalação', 'Instalação de Câmera', 'Mudança de Endereço', 'Manutenção', 'Retirada', 'Auditoria', 'customer']) {
      expect(groupOf({ serviceType })).toBe('customer')
    }
    expect(OS_GROUPS.map((group) => group.label)).toEqual(['OS de cliente', 'Infraestrutura'])
  })
})

describe('destino das OS por grupo', () => {
  const rows = [
    record({ id: '1' }),
    record({ id: '2' }),
    record({ id: '3' }),
    record({ id: '4', status: 'Improdutiva', statusKey: 'unproductive' }),
    record({ id: '5', status: 'Encerrada', statusKey: 'closed' }),
    record({ id: '6', status: 'Rascunho', statusKey: null }),
    record({ id: '7', serviceType: 'Infraestrutura', status: 'Expirada', statusKey: 'expired' }),
    record({ id: '8', serviceType: 'Infraestrutura', status: 'Encerrada', statusKey: 'closed' }),
    record({ id: '9', serviceType: 'Infraestrutura', status: 'Agendada', statusKey: 'scheduled' }),
  ]

  it('conta cada saída por grupo e abre os status dentro dela, do maior para o menor', () => {
    const [customer, infrastructure] = buildOsOutcome(rows)

    expect(customer.label).toBe('OS de cliente')
    expect(customer.total).toBe(6)
    expect(customer.counts).toEqual({ completed: 3, unproductive: 1, notExecuted: 1, open: 0, unknown: 1 })
    expect(customer.statuses.completed).toEqual([['Concluída', 3]])
    expect(customer.statuses.notExecuted).toEqual([['Encerrada', 1]])
    expect(customer.statuses.unknown).toEqual([['Rascunho', 1]])

    expect(infrastructure.label).toBe('Infraestrutura')
    expect(infrastructure.total).toBe(3)
    expect(infrastructure.counts).toEqual({ completed: 0, unproductive: 0, notExecuted: 2, open: 1, unknown: 0 })
    // Empate desfeito pela ordem alfabética em português: nada depende da
    // ordem de chegada dos registros.
    expect(infrastructure.statuses.notExecuted).toEqual([['Encerrada', 1], ['Expirada', 1]])
    expect(infrastructure.statuses.open).toEqual([['Agendada', 1]])
  })

  it('devolve os dois grupos mesmo quando um deles não tem OS', () => {
    const groups = buildOsOutcome(rows.filter((row) => row.serviceType !== 'Infraestrutura'))

    expect(groups.map((group) => group.key)).toEqual(['customer', 'infrastructure'])
    expect(groups[1].total).toBe(0)
    expect(groups[1].counts.notExecuted).toBe(0)
    expect(buildOsOutcome([]).map((group) => group.total)).toEqual([0, 0])
  })
})

describe('indicadores da Visão Geral sobre a base local', () => {
  const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)
  const legacy = buildOverviewOsData(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)

  it('mantém Total e Concluídas iguais aos agregados, com a divisão por grupo no detalhe', () => {
    expect(kpis.total).toBe('1.248')
    expect(kpis.completed).toBe('959')
    expect(kpis.total).toBe(legacy.kpis.total)
    expect(kpis.completed).toBe(legacy.kpis.completed)
    // Cada grupo abre nas cinco saídas, e o total é a soma delas: é o que a
    // leitura gerencial escreve ("177 não concluíram: 131 improdutivas, 46
    // não executadas").
    expect(kpis.totals.customer).toEqual({
      total: 1113, completed: 936, unproductive: 131, notExecuted: 46, open: 0, unknown: 0,
    })
    expect(kpis.totals.infrastructure).toEqual({
      total: 135, completed: 23, unproductive: 3, notExecuted: 108, open: 1, unknown: 0,
    })
    expect(kpis.details.total).toBe('1.113 de cliente · 135 de infraestrutura')
    expect(kpis.details.completed).toBe('936 de cliente · 23 de infraestrutura')
  })

  it('calcula as duas taxas só sobre as OS de cliente', () => {
    expect(kpis.rateBase).toBe('customer')
    // 936 de 1.113, contra 76,8% da regra antiga (959 de 1.248): a diferença é
    // a infraestrutura, com 104 das 135 OS expiradas no recorte.
    expect(kpis.completionRate).toBe('84,1%')
    expect(legacy.kpis.completionRate).toBe('76,8%')
    expect(kpis.unproductiveRate).toBe('11,8%')
    expect(kpis.details.completionRate).toBe('936 de 1.113 OS de cliente')
    expect(kpis.details.unproductiveRate).toBe('131 de 1.113 OS de cliente')
  })

  it('compara com a janela anterior: volume como os agregados, taxas pela base de cliente', () => {
    expect(kpis.totalDelta.text).toBe(legacy.kpis.totalDelta.text)
    expect(kpis.completedDelta.text).toBe(legacy.kpis.completedDelta.text)
    expect(kpis.totalDelta.text).toBe('+19,4%')

    // A janela anterior é o mês anterior até o mesmo dia, 01/07 a 21/07
    // (regra de 22/09/2026). Sobre OS de cliente a conclusão SUBIU (84,1%
    // contra 81,0%); a regra antiga mostrava queda de 4,9% porque a janela
    // atual tem mais infraestrutura expirada do que a anterior.
    expect(kpis.completionDelta).toMatchObject({ text: '+3,1 p.p.', positive: true, available: true })
    expect(legacy.kpis.completionDelta.text).toBe('-4,9%')
    expect(kpis.unproductiveDelta).toMatchObject({ text: '-1,4 p.p.', positive: true, available: true })
  })

  it('sem OS de cliente no recorte, as taxas valem para o que está na tela e o detalhe diz isso', () => {
    const infra = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      serviceType: ['Infraestrutura'],
    })

    expect(infra.rateBase).toBe('infrastructure')
    expect(infra.totals.customer.total).toBe(0)
    expect(infra.completionRate).toBe('17,0%')
    expect(infra.details.completionRate).toBe('23 de 135 OS de infraestrutura')
    expect(infra.details.unproductiveRate).toBe('3 de 135 OS de infraestrutura')
  })

  it('a base segue a frente da equipe ou do técnico filtrado, e fora disso é o cliente', () => {
    // Retrato da equipe Infra em setembro/2026: 87 de infraestrutura e 3 de
    // cliente. "Cliente sempre que houver uma" dava 66,7% sobre as 3.
    const infraTeam = [
      ...Array.from({ length: 8 }, (_, index) =>
        record({ id: `i${index}`, serviceType: INFRASTRUCTURE_SERVICE_TYPE, team: 'Infra' }),
      ),
      record({ id: 'i8', serviceType: INFRASTRUCTURE_SERVICE_TYPE, team: 'Infra', status: 'Encerrada', statusKey: 'closed' }),
      record({ id: 'c1', team: 'Infra' }),
      record({ id: 'c2', team: 'Infra', status: 'Improdutiva', statusKey: 'unproductive' }),
    ]
    const day = { dateFrom: '2026-08-01', dateTo: '2026-08-01' }
    const team = buildOverviewKpis(infraTeam, { ...defaultOverviewOsFilters, ...day, team: ['Infra'] })

    expect(team.rateBase).toBe('infrastructure')
    expect(team.completionRate).toBe('88,9%')
    expect(team.unproductiveRate).toBe('0,0%')
    expect(team.details.completionRate).toBe('8 de 9 OS de infraestrutura, sem as OS sem técnico')
    const readings = buildOverviewReadings(infraTeam, team, { dateTo: '2026-08-01' }, '2026-09-23')
    expect(readings.completed.text).toContain('Equipe ou técnico de infraestrutura')
    expect(readings.completed.text).toContain('as {2 OS de cliente} ficam fora')

    // As MESMAS OS sem filtro de equipe (uma cidade, um dia): cidade não tem
    // frente, e a taxa volta a ser das OS de cliente, mesmo em minoria.
    const city = buildOverviewKpis(infraTeam, { ...defaultOverviewOsFilters, ...day })
    expect(city.rateBase).toBe('customer')
    expect(city.completionRate).toBe('50,0%')
    expect(city.details.completionRate).toBe('1 de 2 OS de cliente')

    // "Sem equipe" não é uma equipe: em setembro/2026, 143 de infraestrutura
    // contra 124 de cliente levavam a taxa para 1,4% e escondiam os 48,4%
    // das OS de cliente sem dono, que são o motivo de a opção existir.
    const noTeam = infraTeam.map((row) => ({ ...row, team: null }))
    const unassigned = buildOverviewKpis(noTeam, {
      ...defaultOverviewOsFilters,
      ...day,
      team: [OVERVIEW_OS_NO_TEAM],
    })
    expect(unassigned.totals.all.total).toBe(11)
    expect(unassigned.rateBase).toBe('customer')
    expect(unassigned.details.completionRate).toBe('1 de 2 OS de cliente')

    // Empate na frente fica com o cliente, a regra de sempre da página.
    const tie = buildOverviewKpis(
      [
        record({ id: 'a', team: 'Mista' }),
        record({ id: 'b', team: 'Mista', serviceType: INFRASTRUCTURE_SERVICE_TYPE }),
      ],
      { ...defaultOverviewOsFilters, ...day, team: ['Mista'] },
    )
    expect(tie.rateBase).toBe('customer')
  })

  it('com Status filtrado as taxas não se aplicam, e Total e Concluídas seguem filtrados', () => {
    const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      status: ['Concluída'],
    })

    expect(kpis.rateState).toBe('status')
    expect(kpis.total).toBe('959')
    expect(kpis.completed).toBe('959')
    expect(kpis.completionRate).toBe(RATE_NOT_APPLICABLE)
    expect(kpis.unproductiveRate).toBe(RATE_NOT_APPLICABLE)
    expect(kpis.details.completionRate).toBe('Com um status só, a taxa seria 0% ou 100%')
    for (const delta of [kpis.completionDelta, kpis.unproductiveDelta]) {
      expect(delta.available).toBe(false)
      expect(delta.unavailableLabel).toBe('Com Status filtrado')
    }
    // O volume continua comparando.
    expect(kpis.totalDelta.available).toBe(true)

    const readings = buildOverviewReadings(
      applyOverviewOsFilters(OVERVIEW_OS_RECORDS, { ...defaultOverviewOsFilters, status: ['Concluída'] }),
      kpis,
      defaultOverviewOsFilters,
      '2026-09-23',
    )
    expect(readings.completionRate.title).toBe('A taxa não se aplica com o filtro de Status.')
    expect(readings.unproductiveRate.title).toBe('A taxa não se aplica com o filtro de Status.')
    // Total e Concluídas mantêm a contagem no título, e o texto não narra o
    // recorte como a operação inteira ("23 de 23" da infraestrutura).
    expect(readings.completed.title).toBe('959 OS entregues, 50,5 por dia com agenda.')
    for (const reading of [readings.total, readings.completed]) {
      expect(reading.text).toContain('Tire o filtro para ler o período.')
      expect(reading.text).not.toContain('23 de 23')
      expect(reading.text).not.toContain('não houve improdutiva')
    }
  })

  it('com vários status marcados as taxas também não se aplicam, e o detalhe diz por quê', () => {
    const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      status: ['Concluída', 'Improdutiva'],
    })

    expect(kpis.rateState).toBe('status')
    expect(kpis.total).toBe('1.093')
    expect(kpis.completionRate).toBe(RATE_NOT_APPLICABLE)
    expect(kpis.unproductiveRate).toBe(RATE_NOT_APPLICABLE)
    expect(kpis.details.completionRate).toBe('Com Status filtrado, a taxa perde parte da base')
    expect(kpis.completionDelta.available).toBe(false)
  })

  it('com Técnico filtrado a base segue a frente do técnico, e o detalhe avisa', () => {
    // Técnico da base local cujas OS são quase todas de infraestrutura.
    const counts = new Map<string, { infra: number; total: number }>()
    for (const row of applyOverviewOsFilters(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)) {
      if (row.technicianId === null) continue
      const item = counts.get(row.technicianId) ?? { infra: 0, total: 0 }
      item.total += 1
      if (row.serviceType === INFRASTRUCTURE_SERVICE_TYPE) item.infra += 1
      counts.set(row.technicianId, item)
    }
    const infraTech = [...counts].find(([, item]) => item.infra * 2 > item.total)![0]
    const customerTech = [...counts].find(([, item]) => item.infra === 0)![0]

    const infra = buildOverviewKpis(OVERVIEW_OS_RECORDS, { ...defaultOverviewOsFilters, technicianId: [infraTech] })
    expect(infra.rateBase).toBe('infrastructure')
    expect(infra.details.completionRate).toMatch(/OS de infraestrutura, sem as OS sem técnico$/)

    const customer = buildOverviewKpis(OVERVIEW_OS_RECORDS, { ...defaultOverviewOsFilters, technicianId: [customerTech] })
    expect(customer.rateBase).toBe('customer')
    expect(customer.details.completionRate).toMatch(/OS de cliente, sem as OS sem técnico$/)
  })

  it('com Equipe ou Técnico filtrado o detalhe avisa que as OS sem técnico ficam fora', () => {
    const team = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      team: [OVERVIEW_OS_RECORDS.find((row) => row.team !== null)!.team!],
    })
    // A primeira equipe da base local é a Infra: a base é a do grupo maior.
    expect(team.details.completionRate).toMatch(/^\d+ de \d+ OS de infraestrutura, sem as OS sem técnico$/)
    expect(team.details.unproductiveRate).toMatch(/, sem as OS sem técnico$/)

    const none = buildOverviewKpis(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)
    expect(none.details.completionRate).not.toContain('sem técnico')

    // "Sem equipe" é onde elas estão: o aviso seria falso.
    const noTeam = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      team: [OVERVIEW_OS_NO_TEAM],
    })
    expect(noTeam.totals.all.total).toBeGreaterThan(0)
    expect(noTeam.details.completionRate).not.toContain('sem técnico')

    // Marcada junto de outra equipe, "Sem equipe" traz as OS sem técnico de
    // volta ao recorte, e o aviso também seria falso.
    const withNoTeam = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      team: ['Câmeras', OVERVIEW_OS_NO_TEAM],
    })
    expect(withNoTeam.details.completionRate).not.toContain('sem técnico')

    // Várias equipes do cadastro, sem "Sem equipe": o aviso continua.
    const teams = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      team: ['Câmeras', 'Infra'],
    })
    expect(teams.details.completionRate).toMatch(/, sem as OS sem técnico$/)
  })

  it('período anterior fora da cobertura deixa as quatro comparações indisponíveis com o motivo', () => {
    const incomplete = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-04-06',
      dateTo: '2026-04-30',
    })

    for (const delta of [incomplete.totalDelta, incomplete.completedDelta, incomplete.completionDelta, incomplete.unproductiveDelta]) {
      expect(delta.available).toBe(false)
      expect(delta.unavailableLabel).toBe(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    }
  })

  it('recorte vazio não inventa taxa nem divide por zero', () => {
    const empty = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      city: ['Cidade inexistente'],
    })

    expect(empty.total).toBe('0')
    // "0,0%" em letra grande se lia como resultado péssimo: é falta de OS.
    expect(empty.rateState).toBe('empty')
    expect(empty.completionRate).toBe(RATE_NO_OS)
    expect(empty.unproductiveRate).toBe(RATE_NO_OS)
    expect(empty.details.completionRate).toBe('Sem OS no recorte')
    expect(empty.totalDelta.available).toBe(false)
    expect(empty.completionDelta.available).toBe(false)
    expect(empty.completionDelta.unavailableLabel).toBe('Sem comparação')

    // Dia sem OS com a semana anterior cheia: a taxa não compara com nada.
    const sunday = buildOverviewKpis(
      [record({ id: 'prev', dateISO: '2026-08-02' })],
      { ...defaultOverviewOsFilters, dateFrom: '2026-08-09', dateTo: '2026-08-09' },
      { min: '2026-08-01', max: '2026-08-21' },
    )
    expect(sunday.completionRate).toBe(RATE_NO_OS)
    expect(sunday.completionDelta.available).toBe(false)
  })
})

describe('destino das OS sobre a base local', () => {
  it('fecha com os totais dos cards e não deixa status sem classificação', () => {
    const outcome = buildOsOutcome(applyOverviewOsFilters(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters))
    const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)

    expect(outcome.reduce((sum, group) => sum + group.total, 0)).toBe(1248)
    expect(outcome[0].counts.completed + outcome[1].counts.completed).toBe(959)
    expect(outcome[0].total).toBe(kpis.totals.customer.total)
    expect(outcome[1].total).toBe(kpis.totals.infrastructure.total)
    // Expirada e Encerrada da base local caem em "não executada", nunca em
    // "sem classificação": o de-para local cobre os treze rótulos.
    expect(outcome[1].counts.notExecuted).toBe(108)
    expect(outcome[0].counts.unknown + outcome[1].counts.unknown).toBe(0)
  })
})

/**
 * Texto da comparação nos cards (22/09/2026): "vs. período anterior" saiu,
 * e o card diz com o que compara, pelo mesmo critério que montou a janela.
 */
/**
 * As duas taxas comparam em PONTOS, e o volume em percentual (23/09/2026):
 * 11,8% contra 11,0% é uma queda de 0,8 ponto, e não de 6,4%.
 */
describe('comparação das taxas em pontos', () => {
  /** `total` OS no dia, das quais `bad` improdutivas e o resto concluídas. */
  function day(dateISO: string, total: number, bad: number): OverviewOsRecord[] {
    return Array.from({ length: total }, (_, index) =>
      record({
        id: `${dateISO}-${index}`,
        dateISO,
        ...(index < bad ? { status: 'Improdutiva', statusKey: 'unproductive' } : {}),
      }),
    )
  }

  it('diferença de meio ponto vale no singular, e o favorável segue o sentido da taxa', () => {
    // Agosto 21/200 = 10,5% contra julho 20/200 = 10,0%.
    const kpis = buildOverviewKpis(
      [...day('2026-07-05', 200, 20), ...day('2026-08-05', 200, 21)],
      defaultOverviewOsFilters,
    )

    expect(kpis.unproductiveDelta).toMatchObject({ text: '+0,5 p.p.', positive: false })
    // A conclusão caiu os mesmos 0,5 ponto: desfavorável.
    expect(kpis.completionDelta).toMatchObject({ text: '-0,5 p.p.', positive: false })
    // O volume continua em percentual.
    expect(kpis.totalDelta.text).toBe('+0,0%')
  })

  it('acima de um ponto vai para o plural, e taxa igual é estável', () => {
    const plural = buildOverviewKpis(
      [...day('2026-07-05', 100, 10), ...day('2026-08-05', 100, 12)],
      defaultOverviewOsFilters,
    )
    expect(plural.unproductiveDelta.text).toBe('+2,0 p.p.')

    const stable = buildOverviewKpis(
      [...day('2026-07-05', 100, 10), ...day('2026-08-05', 100, 10)],
      defaultOverviewOsFilters,
    )
    expect(stable.unproductiveDelta.text).toBe('+0,0 p.p.')
    expect(stable.completionDelta.text).toBe('+0,0 p.p.')
  })
})

describe('texto da comparação nos cards', () => {
  it('mês até um dia compara com o mês anterior até o mesmo dia, pelo nome', () => {
    const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)

    expect(kpis.comparison).toEqual({ label: 'vs. julho até o dia 21', long: 'versus julho até o dia 21' })
  })

  it('mês inteiro compara com o mês anterior inteiro, só pelo nome', () => {
    const kpis = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    })

    expect(kpis.comparison?.label).toBe('vs. junho')
  })

  it('dia compara com o mesmo dia da semana anterior, nomeado; recorte livre, com as duas datas', () => {
    const dia = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-08-21',
      dateTo: '2026-08-21',
    })
    // 21/08/2026 é sexta-feira: compara com a sexta anterior, e diz isso.
    expect(dia.comparison).toEqual({ label: 'vs. sexta 14/08', long: 'versus sexta 14/08' })

    const livre = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-08-05',
      dateTo: '2026-08-14',
    })
    expect(livre.comparison?.label).toBe('vs. 26/07 a 04/08')
  })

  it('semana incompleta diz até que dia compara; a completa, só "semana anterior"', () => {
    // 17/08/2026 é segunda-feira. De segunda a sexta, a comparação é com
    // segunda a sexta da semana anterior, e o texto diz isso.
    const incompleta = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-08-17',
      dateTo: '2026-08-21',
    })
    expect(incompleta.comparison).toEqual({
      label: 'vs. semana anterior até sexta',
      long: 'versus semana anterior até sexta',
    })

    // De segunda a domingo: a semana inteira contra a semana inteira.
    const completa = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-08-10',
      dateTo: '2026-08-16',
    })
    expect(completa.comparison).toEqual({ label: 'vs. semana anterior', long: 'versus semana anterior' })
  })

  it('sem comparação disponível não há texto, e o card já diz o motivo', () => {
    const incomplete = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      dateFrom: '2026-04-06',
      dateTo: '2026-04-30',
    })

    expect(incomplete.comparison).toBeNull()
  })
})
/**
 * Leitura gerencial calculada sobre o recorte (23/09/2026): o título de cada
 * card escreve os números da tela, e o texto muda conforme o que existe no
 * recorte (infraestrutura, OS em aberto, motivo de improdutiva na fonte).
 */
describe('leitura gerencial com os números do recorte', () => {
  /** Leituras de um conjunto de registros, pelo mesmo caminho da página. */
  function readingsOf(records: readonly OverviewOsRecord[], today?: string) {
    const kpis = buildOverviewKpis(records, defaultOverviewOsFilters)

    return buildOverviewReadings(
      applyOverviewOsFilters(records, defaultOverviewOsFilters),
      kpis,
      defaultOverviewOsFilters,
      today,
    )
  }

  it('sobre a base local, escreve total, entrega, o que faltou e a improdutividade', () => {
    const readings = readingsOf(OVERVIEW_OS_RECORDS)

    // 1.248 OS em 19 dias com agenda (o recorte tem 21 dias, dois sem OS),
    // 959 concluídas: a média é por dia COM agenda, não por dia do período.
    const rows = applyOverviewOsFilters(OVERVIEW_OS_RECORDS, defaultOverviewOsFilters)
    expect(new Set(rows.map((row) => row.dateISO)).size).toBe(19)
    expect(readings.total.title).toBe('1.248 OS marcadas, 65,7 por dia com agenda.')
    // 131, e não 134: o mesmo número do card Taxa Improdutividade ao lado
    // (as 3 de infraestrutura ficam fora, como lá).
    expect(readings.total.text).toContain(
      'para o mesmo cliente: as {131 improdutivas} do recorte tendem a voltar como OS nova',
    )
    expect(readings.completed.title).toBe('959 OS entregues, 50,5 por dia com agenda.')
    expect(readings.completed.text).toBe(
      'Acompanha a agenda; bom ou ruim é a {Taxa de Conclusão}. Infraestrutura conta aqui, {23 de 135} concluídas, não nas taxas: outro ciclo.',
    )
    // 1.113 de cliente, 936 concluídas: faltaram 177, e o título diz onde foram.
    expect(readings.completionRate.title).toBe('177 não concluíram: 131 improdutivas, 46 não executadas.')
    expect(readings.completionRate.text).toBe(
      '{Improdutiva}: o técnico foi e não conseguiu. {Não executada}: ninguém foi, a OS expirou sem técnico ou foi encerrada à mão.',
    )
    // A base local não traz o motivo: o título não fala dele.
    expect(readings.unproductiveRate.title).toBe('131 visitas improdutivas: cada uma custa duas vezes.')
    expect(readings.unproductiveRate.text).toContain('{outra visita}')
  })

  it('só infraestrutura no recorte: a leitura diz isso, com a OS em aberto de dia passado', () => {
    const records = OVERVIEW_OS_RECORDS.filter((row) => row.serviceType === INFRASTRUCTURE_SERVICE_TYPE)
    // "Hoje" é o dia seguinte ao fim da base, fora do recorte.
    const readings = readingsOf(records, '2026-08-22')

    // Sem cliente no recorte, a frase do Total perde o "mesmo cliente" e
    // conta as improdutivas de infraestrutura, a base das taxas aqui.
    expect(readings.total.text).toBe(
      'Visita que falha gera {outra OS}: as {3 improdutivas} do recorte tendem a voltar como OS nova e inflar o total.',
    )
    expect(readings.completed.text).toBe(
      'Só há infraestrutura no recorte: quase sempre expira ou é encerrada à mão, e as taxas ao lado valem para ela.',
    )
    expect(readings.completionRate.title).toBe(
      '112 não concluíram: 3 improdutivas, 108 não executadas, 1 em aberto.',
    )
    // Hoje não está no recorte (a base termina em 21/08): a OS em aberto é de
    // dia passado, e o texto não promete que a taxa vai subir.
    expect(readings.completionRate.text).toContain('{Em aberto} ficou de dia passado, sem desfecho no aplicativo.')
    expect(readings.unproductiveRate.title).toBe('3 visitas improdutivas: cada uma custa duas vezes.')
  })

  it('recorte vazio dá a mesma leitura nos quatro cards, sem número inventado', () => {
    const readings = readingsOf([])

    for (const reading of Object.values(readings)) {
      expect(reading.title).toBe('Nenhuma OS no recorte.')
      expect(reading.text).toContain('amplie o período ou tire um filtro')
    }
  })

  it('um dia só, tudo concluído: "no dia", singular certo e nenhuma saída a explicar', () => {
    const one = readingsOf([record({ id: '1' })])
    expect(one.total.title).toBe('1 OS marcada no dia.')
    expect(one.completed.title).toBe('1 OS entregue no dia.')
    expect(one.completionRate.title).toBe('A única OS de cliente foi entregue.')
    expect(one.completionRate.text).toContain('Neste recorte não houve nenhuma das duas.')
    expect(one.unproductiveRate.title).toBe('Nenhuma visita improdutiva na única OS de cliente.')
    expect(one.total.text).toContain('Neste recorte não houve improdutiva de cliente.')
    expect(one.completed.text).toContain('Não há OS de infraestrutura neste recorte.')

    // Uma improdutiva sem o campo de motivo na fonte: singular também aqui.
    const oneFailed = readingsOf([
      record({ id: '1' }),
      record({ id: '2', status: 'Improdutiva', statusKey: 'unproductive' }),
    ])
    expect(oneFailed.unproductiveRate.title).toBe('1 visita improdutiva: ela custa duas vezes.')

    const three = readingsOf([record({ id: '1' }), record({ id: '2' }), record({ id: '3' })])
    expect(three.total.title).toBe('3 OS marcadas no dia.')
    expect(three.completionRate.title).toBe('Todas as 3 OS de cliente foram entregues.')
    expect(three.unproductiveRate.title).toBe('Nenhuma visita improdutiva nas 3 OS de cliente.')

    // Só infraestrutura, tudo concluído: o substantivo diz o grupo.
    const infra = readingsOf([
      record({ id: '1', serviceType: INFRASTRUCTURE_SERVICE_TYPE }),
      record({ id: '2', serviceType: INFRASTRUCTURE_SERVICE_TYPE }),
    ])
    expect(infra.completionRate.title).toBe('Todas as 2 OS de infraestrutura foram entregues.')
    expect(infra.unproductiveRate.title).toBe('Nenhuma visita improdutiva nas 2 OS de infraestrutura.')
    expect(infra.total.text).toContain('Neste recorte não houve improdutiva de infraestrutura.')
  })

  it('a média por dia tem uma casa decimal, e um recorte pequeno não vira "0 por dia"', () => {
    const readings = readingsOf([
      record({ id: '1', dateISO: '2026-08-03' }),
      record({ id: '2', dateISO: '2026-08-04', status: 'Improdutiva', statusKey: 'unproductive' }),
    ])

    expect(readings.total.title).toBe('2 OS marcadas, 1,0 por dia com agenda.')
    expect(readings.completed.title).toBe('1 OS entregue, 0,5 por dia com agenda.')
  })

  it('OS em aberto com hoje no recorte avisa que a taxa ainda sobe', () => {
    const records = [
      record({ id: '1', dateISO: '2026-08-21' }),
      record({ id: '2', dateISO: '2026-08-21', status: 'Agendada', statusKey: 'scheduled' }),
      record({ id: '3', dateISO: '2026-08-21', status: 'Rascunho', statusKey: null }),
    ]
    // "Hoje" é o último dia do recorte.
    const readings = readingsOf(records, '2026-08-21')

    expect(readings.completionRate.title).toBe('2 não concluíram: 1 em aberto, 1 sem classificação.')
    expect(readings.completionRate.text).toContain(
      '{Em aberto} ainda conclui, e a taxa sobe até o fim de hoje.',
    )
  })

  it('com o motivo na fonte, o título da improdutividade nomeia o mais comum e a fatia dele', () => {
    const unproductive = (id: string, unproductiveReason: string | null) =>
      record({ id, status: 'Improdutiva', statusKey: 'unproductive', unproductiveReason })
    const named = readingsOf([
      record({ id: '0' }),
      unproductive('1', 'Cliente ausente'),
      unproductive('2', 'Cliente ausente'),
      unproductive('3', null),
    ])
    expect(named.unproductiveRate.title).toBe('3 improdutivas, 66,7% por cliente ausente.')
    expect(named.total.text).toContain('as {3 improdutivas} do recorte tendem a voltar')

    // Havendo motivo no recorte, o nulo ou em branco conta como não
    // registrado, e pode ser o mais comum.
    const mixed = readingsOf([
      unproductive('1', null),
      unproductive('2', '  '),
      unproductive('3', null),
      unproductive('4', 'Chuva'),
    ])
    expect(mixed.unproductiveRate.title).toBe('4 improdutivas, 75,0% sem motivo registrado.')

    // Todas sem motivo é o que a API entrega quando o serviço NÃO manda o
    // campo (o adaptador troca ausente por nulo): o título não pode afirmar
    // "100% sem motivo registrado", e cai na frase sem motivo.
    const blank = readingsOf([unproductive('1', null), unproductive('2', '  ')])
    expect(blank.unproductiveRate.title).toBe('2 visitas improdutivas: cada uma custa duas vezes.')
    expect(blank.completed.title).toBe('Nenhuma OS entregue no recorte.')

    // O motivo e a fatia saem só das OS de cliente, a base das taxas: a
    // improdutiva de infraestrutura com motivo não entra no denominador.
    const withInfra = readingsOf([
      record({ id: '0' }),
      unproductive('1', 'Chuva'),
      record({ id: '2', serviceType: INFRASTRUCTURE_SERVICE_TYPE, status: 'Improdutiva', statusKey: 'unproductive', unproductiveReason: 'Cliente ausente' }),
      record({ id: '3', serviceType: INFRASTRUCTURE_SERVICE_TYPE, status: 'Improdutiva', statusKey: 'unproductive', unproductiveReason: 'Cliente ausente' }),
    ])
    expect(withInfra.unproductiveRate.title).toBe('1 improdutiva, 100,0% por chuva.')
    expect(withInfra.total.text).toContain('a {1 improdutiva} do recorte tende')

    // Empate sai pela ordem alfabética em português, o mesmo critério da
    // página de Técnicos: as duas páginas concordam.
    const tie = readingsOf([unproductive('1', 'Cliente ausente'), unproductive('2', 'Chuva')])
    expect(tie.unproductiveRate.title).toBe('2 improdutivas, 50,0% por chuva.')

    // Uma improdutiva só: singular nos dois cards. O motivo entra no meio da
    // frase todo em minúsculas, mesmo vindo em "Cliente Ausente".
    const single = readingsOf([record({ id: '0' }), unproductive('1', 'Chuva')])
    expect(single.unproductiveRate.title).toBe('1 improdutiva, 100,0% por chuva.')
    const titleCase = readingsOf([record({ id: '0' }), unproductive('1', 'Cliente Ausente')])
    expect(titleCase.unproductiveRate.title).toBe('1 improdutiva, 100,0% por cliente ausente.')
    expect(single.total.text).toContain('a {1 improdutiva} do recorte tende a voltar')
    expect(single.completionRate.title).toBe('1 não concluiu: 1 improdutiva.')
  })
})

/**
 * Título da faixa "Resultado do período" (23/09/2026): nomeia o recorte pela
 * mesma régua da comparação, para título e card fecharem a frase.
 */
describe('nome do período no título da faixa', () => {
  it('mês inteiro é só o nome do mês, com o ano', () => {
    expect(periodTitle({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toBe('Agosto de 2026')
    expect(periodTitle({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })).toBe('Fevereiro de 2026')
  })

  it('mês até um dia diz até que dia', () => {
    expect(periodTitle({ dateFrom: '2026-09-01', dateTo: '2026-09-21' })).toBe('Setembro de 2026, até o dia 21')
    expect(periodTitle(defaultOverviewOsFilters)).toBe('Agosto de 2026, até o dia 21')
  })

  it('semana, dia e recorte livre têm a própria forma', () => {
    // 14/09/2026 é segunda-feira; 21/09/2026 também.
    expect(periodTitle({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })).toBe('Semana de 14/09 a 20/09/2026')
    expect(periodTitle({ dateFrom: '2026-09-21', dateTo: '2026-09-21' })).toBe('Segunda-feira, 21/09/2026')
    expect(periodTitle({ dateFrom: '2026-09-03', dateTo: '2026-09-10' })).toBe('03/09/2026 a 10/09/2026')
  })
})
