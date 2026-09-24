import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  buildTechnicianRows,
  buildTechniciansSummary,
  buildUnproductiveReasons,
  hasFieldTiming,
  median,
  RANKING_MIN_DAYS,
  rowsOfFront,
  serviceMinutesOf,
  UNPRODUCTIVE_REASON_MISSING,
  workFrontOf,
} from './techniciansModel'

/**
 * Teste espelho do modelo da página de Técnicos.
 *
 * Cobre as três decisões de 21/09/2026 (régua por dia trabalhado, frentes
 * separadas, improdutiva como contexto) e os casos que a medição no SGI
 * mostrou existir de verdade: técnico sem nome no catálogo, OS sem executor,
 * visita sem marcação de tempo e improdutiva sem motivo.
 */

let contador = 0

function os(campos: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  contador += 1
  return {
    id: `os-${contador}`,
    dateISO: '2026-09-15',
    technicianId: 'tec-1',
    team: 'Suporte Técnico',
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    status: 'Concluída',
    statusKey: 'completed',
    resolution: null,
    ...campos,
  }
}

/** Visita com os dois marcos de campo, em horas locais do mesmo dia. */
function comTempo(
  campos: Partial<OverviewOsRecord>,
  inicio: string,
  fim: string,
  deslocamento: number | null = null,
): OverviewOsRecord {
  const dia = campos.dateISO ?? '2026-09-15'
  return os({
    ...campos,
    startedAt: `${dia}T${inicio}-03:00`,
    finishedAt: `${dia}T${fim}-03:00`,
    travelMinutes: deslocamento,
  })
}

describe('median', () => {
  it('devolve nulo para lista vazia, e não zero', () => {
    expect(median([])).toBeNull()
  })

  it('usa a média dos dois centrais quando a quantidade é par', () => {
    expect(median([10, 20, 30, 40])).toBe(25)
    expect(median([30, 10, 40, 20])).toBe(25)
  })

  it('não altera a lista recebida', () => {
    const valores = [3, 1, 2]
    median(valores)
    expect(valores).toEqual([3, 1, 2])
  })
})

describe('serviceMinutesOf', () => {
  it('mede do início ao fim do serviço', () => {
    expect(serviceMinutesOf(comTempo({}, '09:00:00', '10:15:00'))).toBe(75)
  })

  it('devolve nulo sem os dois marcos', () => {
    expect(serviceMinutesOf(os())).toBeNull()
    expect(serviceMinutesOf(os({ startedAt: '2026-09-15T09:00:00-03:00' }))).toBeNull()
  })

  it('devolve nulo quando o fim é anterior ao início', () => {
    expect(serviceMinutesOf(comTempo({}, '10:00:00', '09:00:00'))).toBeNull()
  })

  it('lê o fuso escrito na resposta, e não o do navegador', () => {
    const record = os({
      startedAt: '2026-09-15T12:00:00+00:00',
      finishedAt: '2026-09-15T10:30:00-03:00',
    })
    expect(serviceMinutesOf(record)).toBe(90)
  })
})

describe('workFrontOf', () => {
  it('junta instalação e mudança de endereço na frente de internet', () => {
    expect(workFrontOf('Instalação')).toBe('internet')
    expect(workFrontOf('Mudança de Endereço')).toBe('internet')
  })

  it('separa câmeras e infraestrutura', () => {
    expect(workFrontOf('Instalação de Câmera')).toBe('cameras')
    expect(workFrontOf('Infraestrutura')).toBe('infrastructure')
  })

  it('tipo novo do serviço cai em outros serviços, em vez de sumir', () => {
    expect(workFrontOf('Vistoria de Poste')).toBe('other')
  })
})

describe('buildTechnicianRows', () => {
  const catalogo = [
    { id: 'tec-1', name: 'Marcos Andrade' },
    { id: 'tec-2', name: 'Acacio Marinho' },
  ]

  it('ordena por concluídas por dia trabalhado, e não pelo total', () => {
    const registros = [
      // Volume maior, seis dias: 1,00 por dia.
      ...Array.from({ length: 6 }, (_, i) =>
        os({ technicianId: 'tec-1', dateISO: `2026-09-0${i + 1}` }),
      ),
      // Volume menor, dois dias por semana de escala: 2,50 por dia.
      ...Array.from({ length: 5 }, () => os({ technicianId: 'tec-2', dateISO: '2026-09-01' })),
      ...Array.from({ length: 5 }, () => os({ technicianId: 'tec-2', dateISO: '2026-09-02' })),
      ...Array.from({ length: 5 }, () => os({ technicianId: 'tec-2', dateISO: '2026-09-03' })),
      ...Array.from({ length: 5 }, () => os({ technicianId: 'tec-2', dateISO: '2026-09-04' })),
      ...Array.from({ length: 5 }, () => os({ technicianId: 'tec-2', dateISO: '2026-09-05' })),
    ]

    const linhas = buildTechnicianRows(registros, catalogo)

    expect(linhas.map((linha) => linha.name)).toEqual(['Acacio Marinho', 'Marcos Andrade'])
    expect(linhas[0].completed).toBe(25)
    expect(linhas[0].completedPerDay).toBe(5)
    expect(linhas[1].completedPerDay).toBe(1)
  })

  it('conta a improdutiva como visita e como dia trabalhado, sem tirar posição', () => {
    const registros = [
      os({ technicianId: 'tec-1', dateISO: '2026-09-01' }),
      os({
        technicianId: 'tec-1',
        dateISO: '2026-09-02',
        status: 'Improdutiva',
        statusKey: 'unproductive',
      }),
    ]

    const [linha] = buildTechnicianRows(registros, catalogo)

    expect(linha.visits).toBe(2)
    expect(linha.completed).toBe(1)
    expect(linha.unproductive).toBe(1)
    expect(linha.daysWorked).toBe(2)
    expect(linha.completedPerDay).toBe(0.5)
    expect(linha.completionRate).toBe(0.5)
  })

  it('ignora OS que não viraram visita e OS sem executor', () => {
    const registros = [
      os({ technicianId: 'tec-1' }),
      os({ technicianId: 'tec-1', status: 'Agendada', statusKey: 'scheduled' }),
      os({ technicianId: 'tec-1', status: 'Encerrada', statusKey: 'closed' }),
      os({ technicianId: 'tec-1', status: 'Expirada', statusKey: 'expired' }),
      os({ technicianId: null, team: null }),
    ]

    const linhas = buildTechnicianRows(registros, catalogo)

    expect(linhas).toHaveLength(1)
    expect(linhas[0].visits).toBe(1)
  })

  it('classifica a frente pelo serviço predominante e guarda o mix', () => {
    const registros = [
      ...Array.from({ length: 8 }, () =>
        os({ technicianId: 'tec-2', serviceType: 'Instalação de Câmera' }),
      ),
      ...Array.from({ length: 2 }, () => os({ technicianId: 'tec-2' })),
    ]

    const [linha] = buildTechnicianRows(registros, catalogo)

    expect(linha.front).toBe('cameras')
    expect(linha.mix).toEqual([
      { front: 'cameras', share: 0.8 },
      { front: 'internet', share: 0.2 },
    ])
  })

  it('empate de mix cai na ordem declarada das frentes, sempre igual', () => {
    const registros = [
      os({ technicianId: 'tec-1', serviceType: 'Instalação de Câmera' }),
      os({ technicianId: 'tec-1', serviceType: 'Instalação' }),
    ]

    expect(buildTechnicianRows(registros, catalogo)[0].front).toBe('internet')
  })

  it('marca pouca atividade abaixo do piso e joga essas linhas para o fim', () => {
    const registros = [
      // Uma visita num dia só: 1,00 por dia, acima da média de quem trabalhou.
      os({ technicianId: 'tec-2', dateISO: '2026-09-01' }),
      // Cinco dias, meia visita por dia: entra no ranking.
      ...Array.from({ length: RANKING_MIN_DAYS }, (_, i) =>
        os({ technicianId: 'tec-1', dateISO: `2026-09-1${i}` }),
      ),
    ]

    const linhas = buildTechnicianRows(registros, catalogo)

    expect(linhas.map((linha) => linha.name)).toEqual(['Marcos Andrade', 'Acacio Marinho'])
    expect(linhas[0].lowActivity).toBe(false)
    expect(linhas[1].lowActivity).toBe(true)
  })

  it('usa o identificador quando o técnico não está no catálogo de nomes', () => {
    const [linha] = buildTechnicianRows([os({ technicianId: 'tec-99' })], catalogo)

    expect(linha.name).toBe('tec-99')
  })

  it('herda a equipe da primeira OS que a informa', () => {
    const registros = [
      os({ technicianId: 'tec-1', team: null }),
      os({ technicianId: 'tec-1', team: 'Câmeras' }),
    ]

    expect(buildTechnicianRows(registros, catalogo)[0].team).toBe('Câmeras')
  })

  it('mede tempo de serviço e deslocamento pela mediana, ignorando o não medido', () => {
    const registros = [
      comTempo({ technicianId: 'tec-1', dateISO: '2026-09-01' }, '09:00:00', '10:00:00', 10),
      comTempo({ technicianId: 'tec-1', dateISO: '2026-09-02' }, '09:00:00', '11:00:00', 30),
      comTempo({ technicianId: 'tec-1', dateISO: '2026-09-03' }, '09:00:00', '12:00:00', 20),
      // Sem marcação: não entra em nenhuma das duas medianas.
      os({ technicianId: 'tec-1', dateISO: '2026-09-04' }),
    ]

    const [linha] = buildTechnicianRows(registros, catalogo)

    expect(linha.serviceMinutes).toBe(120)
    expect(linha.travelMinutes).toBe(20)
    expect(linha.visits).toBe(4)
  })

  it('devolve lista vazia para recorte sem visita nenhuma', () => {
    expect(buildTechnicianRows([], catalogo)).toEqual([])
  })
})

describe('rowsOfFront', () => {
  it('separa os dois times sem misturar ninguém', () => {
    const registros = [
      ...Array.from({ length: 3 }, (_, i) =>
        os({ technicianId: 'tec-1', dateISO: `2026-09-0${i + 1}` }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        os({
          technicianId: 'tec-2',
          dateISO: `2026-09-0${i + 1}`,
          serviceType: 'Instalação de Câmera',
        }),
      ),
    ]

    const linhas = buildTechnicianRows(registros, [
      { id: 'tec-1', name: 'Marcos Andrade' },
      { id: 'tec-2', name: 'Acacio Marinho' },
    ])

    expect(rowsOfFront(linhas, 'internet').map((linha) => linha.name)).toEqual(['Marcos Andrade'])
    expect(rowsOfFront(linhas, 'cameras').map((linha) => linha.name)).toEqual(['Acacio Marinho'])
    expect(rowsOfFront(linhas, 'infrastructure')).toEqual([])
  })
})

describe('buildTechniciansSummary', () => {
  it('conta técnicos em campo, visitas e a média por dia da operação', () => {
    const registros = [
      os({ technicianId: 'tec-1', dateISO: '2026-09-01' }),
      os({ technicianId: 'tec-1', dateISO: '2026-09-01' }),
      os({ technicianId: 'tec-1', dateISO: '2026-09-02' }),
      os({
        technicianId: 'tec-2',
        dateISO: '2026-09-01',
        status: 'Improdutiva',
        statusKey: 'unproductive',
      }),
      os({ technicianId: null, team: null }),
    ]

    const resumo = buildTechniciansSummary(registros)

    expect(resumo.technicians).toBe(2)
    expect(resumo.visits).toBe(4)
    expect(resumo.completed).toBe(3)
    // 3 concluídas sobre 3 dias de campo (tec-1 em dois dias, tec-2 em um).
    expect(resumo.workDays).toBe(3)
    expect(resumo.completedPerDay).toBe(1)
  })

  it('mede a ocupação só em dias com duas visitas ou mais', () => {
    const registros = [
      // Jornada de 09:00 a 12:00 (180 min); serviço 60 + 60, deslocamento 30.
      comTempo({ technicianId: 'tec-1', dateISO: '2026-09-01' }, '09:00:00', '10:00:00', 20),
      comTempo({ technicianId: 'tec-1', dateISO: '2026-09-01' }, '11:00:00', '12:00:00', 10),
      // Dia de visita única: a jornada seria a própria visita, e daria 100%.
      comTempo({ technicianId: 'tec-2', dateISO: '2026-09-02' }, '09:00:00', '10:00:00', 45),
    ]

    const resumo = buildTechniciansSummary(registros)

    expect(resumo.occupancy).toBeCloseTo(150 / 180, 10)
  })

  it('devolve nulo em vez de zero quando nada foi medido', () => {
    const resumo = buildTechniciansSummary([os(), os()])

    expect(resumo.occupancy).toBeNull()
    expect(resumo.serviceMinutes).toBeNull()
    expect(resumo.travelMinutes).toBeNull()
  })

  it('recorte vazio não divide por zero', () => {
    const resumo = buildTechniciansSummary([])

    expect(resumo).toMatchObject({
      technicians: 0,
      visits: 0,
      completed: 0,
      completedPerDay: null,
      occupancy: null,
      workDays: 0,
    })
  })
})

describe('buildUnproductiveReasons', () => {
  function improdutiva(reason: string | null) {
    return os({ status: 'Improdutiva', statusKey: 'unproductive', unproductiveReason: reason })
  }

  it('ordena do mais frequente ao menos e calcula a participação', () => {
    const linhas = buildUnproductiveReasons([
      improdutiva('Cliente ausente'),
      improdutiva('Cliente ausente'),
      improdutiva('Cliente ausente'),
      improdutiva('Local sem condição'),
      os(),
    ])

    expect(linhas).toEqual([
      { reason: 'Cliente ausente', count: 3, share: 0.75 },
      { reason: 'Local sem condição', count: 1, share: 0.25 },
    ])
  })

  it('improdutiva sem motivo vira linha própria, em vez de sumir', () => {
    const linhas = buildUnproductiveReasons([improdutiva(null), improdutiva('Cliente ausente')])

    expect(linhas.map((linha) => linha.reason)).toContain(UNPRODUCTIVE_REASON_MISSING)
    expect(linhas).toHaveLength(2)
  })

  it('empate sai em ordem alfabética, para a lista não dançar entre recortes', () => {
    const linhas = buildUnproductiveReasons([
      improdutiva('Material em falta'),
      improdutiva('Clima ou segurança'),
    ])

    expect(linhas.map((linha) => linha.reason)).toEqual(['Clima ou segurança', 'Material em falta'])
  })

  it('recorte sem improdutiva devolve lista vazia', () => {
    expect(buildUnproductiveReasons([os()])).toEqual([])
  })
})

describe('hasFieldTiming', () => {
  it('reconhece o recorte que tem medição de campo', () => {
    expect(hasFieldTiming([os(), comTempo({}, '09:00:00', '10:00:00')])).toBe(true)
  })

  it('é falso na base sem os marcos, como a local de estudo', () => {
    expect(hasFieldTiming([os(), os()])).toBe(false)
  })
})
