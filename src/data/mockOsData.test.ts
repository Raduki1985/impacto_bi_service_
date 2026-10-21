import { describe, expect, it } from 'vitest'

import {
  OS_CITIES,
  OS_EXPERIMENTAL_PROFESSIONALS,
  OS_PERIOD,
  OS_RESOLUTIONS,
  OS_SERVICE_TYPES,
  OS_STATUSES,
  OS_TECHNICIANS,
} from './mockOsCatalog'
import { dashboardMeta, generateOrders, orders } from './mockOsData'

/**
 * A base mockada precisa reproduzir com exatidão os totais confirmados do
 * Relatório de OS do SGI para 01/08/2026 a 21/08/2026, mantendo simuladas (e
 * apenas simuladas) as associações individuais.
 */
describe('números agregados obrigatórios', () => {
  it('produz exatamente 1.231 OS dentro da janela padrão', () => {
    expect(orders).toHaveLength(1231)

    for (const order of orders) {
      expect(order.dateISO >= OS_PERIOD.start && order.dateISO <= OS_PERIOD.end).toBe(true)
    }
  })

  it('produz exatamente 916 concluídas e 128 improdutivas', () => {
    expect(orders.filter((order) => order.status === 'Concluída')).toHaveLength(916)
    expect(orders.filter((order) => order.status === 'Improdutiva')).toHaveLength(128)
  })

  it('fecha a média das concluídas em exatamente 101 minutos (1h41)', () => {
    const completed = orders.filter((order) => order.status === 'Concluída')
    const sum = completed.reduce((total, order) => total + order.durationMinutes, 0)

    expect(sum).toBe(916 * 101)
    // Durações individuais continuam plausíveis após o ajuste fino.
    for (const order of completed) {
      expect(order.durationMinutes).toBeGreaterThanOrEqual(15)
      expect(order.durationMinutes).toBeLessThanOrEqual(220)
    }
  })

  it('deixa exatamente 150 OS sem técnico atribuído', () => {
    expect(orders.filter((order) => order.technicianId === null)).toHaveLength(150)
  })

  it('é determinística: a mesma seed produz a mesma base', () => {
    expect(generateOrders()).toEqual(orders)
  })
})

describe('OS sem técnico', () => {
  it('zera técnico, nome e equipe juntos, sem inventar equipe fictícia', () => {
    for (const order of orders) {
      const fields = [order.technicianId, order.technician, order.team]
      const nullCount = fields.filter((value) => value === null).length

      // Ou a OS tem técnico completo (id, nome e equipe) ou não tem nenhum.
      expect(nullCount === 0 || nullCount === 3).toBe(true)
      expect(order.team).not.toBe('Sem equipe')
    }
  })

  it('nunca deixa sem técnico uma OS em execução ou concluída', () => {
    const requireTechnician = new Set([
      'Em Deslocamento',
      'Técnico no Local',
      'Em Andamento',
      'Pendente de Aprovação',
      'Concluída',
      'Improdutiva',
    ])

    for (const order of orders) {
      if (order.technicianId === null) {
        expect(requireTechnician.has(order.status)).toBe(false)
      }
    }
  })
})

describe('técnicos da base', () => {
  const catalogById = new Map(OS_TECHNICIANS.map((technician) => [technician.id, technician]))

  it('usa apenas técnicos do catálogo, com nome e equipe coerentes com ele', () => {
    for (const order of orders) {
      if (order.technicianId === null) continue

      const technician = catalogById.get(order.technicianId)
      expect(technician).toBeDefined()
      expect(order.technician).toBe(technician!.name)
      expect(order.team).toBe(technician!.team)
    }
  })

  it('não serializa e-mail nem identificador com aparência de e-mail', () => {
    const emailPattern = /[\w.+-]+@[\w-]+\.[\w.-]+/

    for (const order of orders) {
      if (order.technicianId !== null) {
        expect(order.technicianId).toMatch(/^mock-tech-\d{3}$/)
      }
    }
    // O JSON completo das 1.231 OS (o que o navegador baixa) fica sem '@'.
    expect(JSON.stringify(orders)).not.toMatch(emailPattern)
  })

  it('não gera OS para inativos, ex-funcionários, experimentais ou excluídos', () => {
    const blockedNames = new Set([
      ...OS_TECHNICIANS.filter((technician) => !technician.activeInCurrentPeriod).map(
        (technician) => technician.name,
      ),
      ...OS_EXPERIMENTAL_PROFESSIONALS.map((professional) => professional.name),
    ])

    for (const order of orders) {
      if (order.technician === null) continue
      expect(blockedNames.has(order.technician)).toBe(false)
      expect(order.technician).not.toMatch(/yoneyama/i)
    }
  })

  it('distribui OS a todos os 39 técnicos elegíveis, sem pesos individuais', () => {
    const active = OS_TECHNICIANS.filter((technician) => technician.activeInCurrentPeriod)
    const counts = new Map<string, number>()

    for (const order of orders) {
      if (order.technicianId === null) continue
      counts.set(order.technicianId, (counts.get(order.technicianId) ?? 0) + 1)
    }

    expect(counts.size).toBe(active.length)
    // Nenhuma pontuação de habilidade sobrou no modelo.
    expect('technicians' in dashboardMeta).toBe(false)
  })
})

describe('dimensões normalizadas da base', () => {
  it('usa somente valores dos catálogos em status, tipo, cidade e resolução', () => {
    const statuses = new Set<string>(OS_STATUSES)
    const serviceTypes = new Set<string>(OS_SERVICE_TYPES)
    const cities = new Set<string>(OS_CITIES)
    const resolutions = new Set<string>(OS_RESOLUTIONS)

    for (const order of orders) {
      expect(statuses.has(order.status)).toBe(true)
      expect(serviceTypes.has(order.serviceType)).toBe(true)
      expect(cities.has(order.city)).toBe(true)
      if (order.resolution !== null) {
        expect(resolutions.has(order.resolution)).toBe(true)
      }
    }
  })

  it('mantém Categoria como dimensão própria, distinta de Tipo de OS', () => {
    const categories = new Set(dashboardMeta.categories.map((category) => category.value))

    for (const order of orders) {
      expect(categories.has(order.category)).toBe(true)
    }
    // Os dois catálogos não são o mesmo conjunto de valores.
    expect(categories.has('Instalação de Câmeras')).toBe(false)
  })

  it('substituiu Fechada por Encerrada na base', () => {
    expect(orders.some((order) => order.status === 'Encerrada')).toBe(true)
    expect(orders.some((order) => (order.status as string) === 'Fechada')).toBe(false)
  })
})
