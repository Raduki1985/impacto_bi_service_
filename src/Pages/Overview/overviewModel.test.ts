import { describe, expect, it } from 'vitest'

import {
  buildOverviewOsData,
  OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
} from '../../data/overviewOsAggregates'
import { OVERVIEW_OS_RECORDS, type OverviewOsRecord } from '../../data/overviewOsData'
import { applyOverviewOsFilters, defaultOverviewOsFilters } from '../../data/overviewOsFilters'
import { KNOWN_STATUS_KEYS, osStatusKind } from './osStatusKind'
import {
  buildOsOutcome,
  buildOverviewKpis,
  groupOf,
  INFRASTRUCTURE_SERVICE_TYPE,
  OS_GROUPS,
  OS_OUTCOMES,
  outcomeOf,
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
    expect(kpis.totals.customer).toEqual({ total: 1113, completed: 936, unproductive: 131 })
    expect(kpis.totals.infrastructure).toEqual({ total: 135, completed: 23, unproductive: 3 })
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
    expect(kpis.completionDelta).toMatchObject({ text: '+3,8%', positive: true, available: true })
    expect(legacy.kpis.completionDelta.text).toBe('-4,9%')
    expect(kpis.unproductiveDelta).toMatchObject({ text: '-10,9%', positive: true, available: true })
  })

  it('sem OS de cliente no recorte, as taxas valem para o que está na tela e o detalhe diz isso', () => {
    const infra = buildOverviewKpis(OVERVIEW_OS_RECORDS, {
      ...defaultOverviewOsFilters,
      serviceType: 'Infraestrutura',
    })

    expect(infra.rateBase).toBe('all')
    expect(infra.totals.customer.total).toBe(0)
    expect(infra.completionRate).toBe('17,0%')
    expect(infra.details.completionRate).toBe('23 de 135 OS, sem OS de cliente no recorte')
    expect(infra.details.unproductiveRate).toBe('3 de 135 OS, sem OS de cliente no recorte')
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
      city: 'Cidade inexistente',
    })

    expect(empty.total).toBe('0')
    expect(empty.completionRate).toBe('0,0%')
    expect(empty.unproductiveRate).toBe('0,0%')
    expect(empty.details.completionRate).toBe('Sem OS no recorte')
    expect(empty.totalDelta.available).toBe(false)
    expect(empty.completionDelta.available).toBe(false)
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
