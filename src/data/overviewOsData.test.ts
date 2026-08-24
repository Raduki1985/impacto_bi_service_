import { describe, expect, it } from 'vitest'

import { OS_TECHNICIANS } from './mockOsCatalog'
import {
  OVERVIEW_OS_DATE_RANGE,
  OVERVIEW_OS_DEFAULT_PERIOD,
  OVERVIEW_OS_RECORDS,
} from './overviewOsData'
import overviewOsFactJson from './overviewOsFact.json'
import {
  OVERVIEW_OS_SOURCE_EXPLANATION,
  OVERVIEW_OS_SOURCE_MAX_DATE_BR,
} from './overviewOsMeta'

/**
 * A projeção `overviewOsFact.json` é a fonte REAL da Visão Geral: estes testes
 * guardam a quantidade, a estrutura, a unicidade e, principalmente, a
 * sanitização. Nenhum dado de cliente, nome de técnico, código real de OS ou
 * campo fora da projeção aprovada pode entrar no repositório ou no bundle.
 */

const ALLOWED_KEYS = [
  'id',
  'dateISO',
  'technicianId',
  'team',
  'serviceType',
  'category',
  'city',
  'status',
  'resolution',
].sort()

describe('estrutura da projeção sanitizada', () => {
  it('contém exatamente 4.465 registros com identificadores únicos e sequenciais', () => {
    expect(OVERVIEW_OS_RECORDS.length).toBe(4465)
    expect(new Set(OVERVIEW_OS_RECORDS.map((record) => record.id)).size).toBe(4465)

    OVERVIEW_OS_RECORDS.forEach((record, index) => {
      expect(record.id).toBe(`mock-os-${String(index + 1).padStart(6, '0')}`)
    })
  })

  it('cada registro traz somente os nove campos permitidos', () => {
    for (const record of overviewOsFactJson as unknown[]) {
      expect(Object.keys(record as object).sort()).toEqual(ALLOWED_KEYS)
    }
  })

  it('cobre exatamente 06/04/2026 a 21/08/2026, sem datas fora da fonte', () => {
    expect(OVERVIEW_OS_DATE_RANGE).toEqual({ min: '2026-04-06', max: '2026-08-21' })

    for (const record of OVERVIEW_OS_RECORDS) {
      expect(record.dateISO >= '2026-04-06' && record.dateISO <= '2026-08-21').toBe(true)
    }
  })

  it('reproduz os totais mensais aprovados da tabela-fato', () => {
    const byMonth = new Map<string, number>()
    for (const record of OVERVIEW_OS_RECORDS) {
      const month = record.dateISO.slice(0, 7)
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
    }

    expect(Object.fromEntries(byMonth)).toEqual({
      '2026-04': 8,
      '2026-05': 82,
      '2026-06': 1508,
      '2026-07': 1619,
      '2026-08': 1248,
    })
  })

  it('deriva o período padrão do mês da data máxima, sem usar o relógio', () => {
    expect(OVERVIEW_OS_DEFAULT_PERIOD).toEqual({ start: '2026-08-01', end: '2026-08-21' })
  })

  it('preserva os fatos aprovados: sem Retirada, com legado e sem equipe inventada', () => {
    const records = OVERVIEW_OS_RECORDS

    expect(records.filter((record) => record.serviceType === 'Retirada').length).toBe(0)
    expect(records.filter((record) => record.team === 'Retiradas').length).toBe(0)
    expect(records.filter((record) => record.serviceType === 'Customer (legado)').length).toBe(11)
    expect(records.filter((record) => record.status === 'Pendente de Aprovação').length).toBe(1)
    expect(records.filter((record) => record.city === 'Cidade não informada').length).toBe(1)
    expect(records.filter((record) => record.technicianId === null).length).toBe(347)
    expect(
      new Set(records.map((record) => record.technicianId).filter((id) => id !== null)).size,
    ).toBe(37)
  })

  it('mantém técnico e equipe coerentes, com uma única equipe por chave anônima', () => {
    const teamByTechnician = new Map<string, string>()

    for (const record of OVERVIEW_OS_RECORDS) {
      if (record.technicianId === null) {
        expect(record.team).toBeNull()
        continue
      }
      expect(record.team).not.toBeNull()

      const knownTeam = teamByTechnician.get(record.technicianId)
      if (knownTeam === undefined) {
        teamByTechnician.set(record.technicianId, record.team as string)
      } else {
        // A mesma chave anônima nunca aparece em duas equipes: preserva a
        // relação técnico-equipe da fonte sem revelar quem é o técnico.
        expect(record.team).toBe(knownTeam)
      }
    }

    expect(teamByTechnician.size).toBe(37)
  })

  it('o período padrão continua com 33 chaves anônimas ativas', () => {
    const active = new Set(
      OVERVIEW_OS_RECORDS.filter(
        (record) =>
          record.dateISO >= OVERVIEW_OS_DEFAULT_PERIOD.start &&
          record.dateISO <= OVERVIEW_OS_DEFAULT_PERIOD.end &&
          record.technicianId !== null,
      ).map((record) => record.technicianId),
    )

    expect(active.size).toBe(33)
  })
})

describe('não associação com o catálogo simulado', () => {
  const technicianIds = [
    ...new Set(
      OVERVIEW_OS_RECORDS.map((record) => record.technicianId).filter(
        (id): id is string => id !== null,
      ),
    ),
  ]

  it('a interseção com os identificadores de OS_TECHNICIANS é vazia', () => {
    const catalogIds = new Set(OS_TECHNICIANS.map((technician) => technician.id))
    const intersection = technicianIds.filter((id) => catalogIds.has(id))

    // Teste obrigatório da correção de privacidade: se qualquer chave da
    // projeção existir no catálogo, o cruzamento dos arquivos do bundle
    // reconstruiria resultados individuais reais por nome.
    expect(intersection).toEqual([])
  })

  it('nenhuma chave usa o padrão mock-tech- do catálogo', () => {
    for (const id of technicianIds) {
      expect(id.startsWith('mock-tech-')).toBe(false)
    }
  })

  it('toda chave é um alias opaco overview-tech-<uuid>, sem nome, inicial ou equipe', () => {
    const pattern =
      /^overview-tech-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

    expect(technicianIds.length).toBe(37)
    for (const id of technicianIds) {
      // O charset hexadecimal do UUID já impede nomes, iniciais maiúsculas ou
      // nomes de equipe dentro do alias.
      expect(id).toMatch(pattern)
    }
  })
})

describe('sanitização da projeção', () => {
  const rawJson = JSON.stringify(overviewOsFactJson)

  it('não contém código real de OS, contato, endereço ou coordenada', () => {
    expect(rawJson).not.toMatch(/OS-\d{4}-\d+/)
    expect(rawJson).not.toMatch(/\b55\d{10,11}\b/)
    expect(rawJson).not.toContain('@')
    expect(rawJson).not.toMatch(/\b\d{5}-\d{3}\b/)
    expect(rawJson).not.toMatch(/-2[0-9]\.\d{4,}/)
  })

  it('não contém as chaves proibidas da tabela-fato completa', () => {
    for (const forbidden of [
      'customer',
      'subscription',
      'address',
      'duration_minutes',
      'durationMinutes',
      'unproductive_reason',
      'unproductiveReason',
      'approval',
      'difficulty',
      'shift',
      'technician_name',
      'note',
    ]) {
      expect(rawJson).not.toContain(`"${forbidden}"`)
    }
  })

  it('não contém nome de técnico: a associação fica só no catálogo', () => {
    for (const technician of OS_TECHNICIANS) {
      // Sobrenomes compostos incluídos: o nome inteiro não pode aparecer.
      expect(rawJson).not.toContain(technician.name)
    }
    expect(rawJson).not.toContain('Sem equipe')
    expect(rawJson).not.toContain('Não classificada')
  })
})

describe('aviso da fonte da Visão Geral', () => {
  it('descreve a base local sanitizada, o corte temporal e a ausência de tempo real', () => {
    expect(OVERVIEW_OS_SOURCE_EXPLANATION).toContain('Base local de estudo')
    expect(OVERVIEW_OS_SOURCE_EXPLANATION).toContain('exportação sanitizada do SGI')
    expect(OVERVIEW_OS_SOURCE_EXPLANATION).toContain('21/08/2026')
    expect(OVERVIEW_OS_SOURCE_EXPLANATION).toContain('sem conexão em tempo real')
    expect(OVERVIEW_OS_SOURCE_EXPLANATION).toContain(
      'Clientes e as demais páginas de OS continuam simulados',
    )
  })

  it('a data do aviso acompanha a data máxima real da projeção', () => {
    const [year, month, day] = OVERVIEW_OS_DATE_RANGE.max.split('-')

    // O texto vive num módulo leve, fora do bundle da projeção; este teste
    // quebra se a fonte for atualizada sem o metadado acompanhar.
    expect(OVERVIEW_OS_SOURCE_MAX_DATE_BR).toBe(`${day}/${month}/${year}`)
  })
})
