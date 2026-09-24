import { describe, expect, it } from 'vitest'

import {
  buildRankingDescription,
  buildReasonsDescription,
  formatPerDay,
  LABEL_MAX_LENGTH,
  makeTechnicianRankingOptions,
  makeUnproductiveReasonsOptions,
  NO_UNPRODUCTIVE_MESSAGE,
  shortTechnicianName,
  TECHNICIANS_EMPTY_MESSAGE,
  truncateTechnicianLabel,
} from './techniciansChartOptions'
import type { TechnicianRow } from './techniciansModel'

/** Teste espelho dos dois rankings da página de Técnicos. */

function linha(campos: Partial<TechnicianRow> = {}): TechnicianRow {
  return {
    id: 'tec-1',
    name: 'Marcos Andrade Silva',
    team: 'Suporte Técnico',
    front: 'internet',
    visits: 127,
    completed: 112,
    unproductive: 15,
    daysWorked: 29,
    completedPerDay: 112 / 29,
    completionRate: 112 / 127,
    serviceMinutes: 59,
    travelMinutes: 26,
    mix: [{ front: 'internet', share: 1 }],
    lowActivity: false,
    ...campos,
  }
}

describe('shortTechnicianName', () => {
  it('mantém primeiro nome e último sobrenome', () => {
    expect(shortTechnicianName('Marcos Andrade Silva')).toBe('Marcos Silva')
  })

  it('não mexe em nome de uma palavra só', () => {
    expect(shortTechnicianName('Nildiomar')).toBe('Nildiomar')
  })

  it('tolera espaços repetidos do cadastro', () => {
    expect(shortTechnicianName('  Ana   Paula  Souza ')).toBe('Ana Souza')
  })
})

describe('truncateTechnicianLabel', () => {
  it('deixa passar o que cabe', () => {
    expect(truncateTechnicianLabel('Cliente ausente')).toBe('Cliente ausente')
  })

  it('encurta com reticências o que não cabe', () => {
    const longo = 'Equipamento ou infraestrutura inadequada no local'
    const saida = truncateTechnicianLabel(longo)

    expect(saida.length).toBeLessThanOrEqual(LABEL_MAX_LENGTH)
    expect(saida.endsWith('…')).toBe(true)
  })
})

describe('formatPerDay', () => {
  it('usa vírgula decimal e uma casa', () => {
    expect(formatPerDay(112 / 29)).toBe('3,9')
    expect(formatPerDay(4)).toBe('4,0')
  })
})

describe('makeTechnicianRankingOptions', () => {
  it('desenha o primeiro colocado no topo, invertendo para o eixo do ECharts', () => {
    const rows = [
      linha({ id: 'a', name: 'Primeiro Lugar', completedPerDay: 4.5 }),
      linha({ id: 'b', name: 'Segundo Lugar', completedPerDay: 3.1 }),
    ]

    const options = makeTechnicianRankingOptions({
      name: 'Internet',
      rows,
      color: '#2f6bff',
      theme: 'light',
    })

    const yAxis = options.yAxis as { data: string[] }
    expect(yAxis.data).toEqual(['Segundo Lugar', 'Primeiro Lugar'])
  })

  it('não anima na entrada nem na troca de filtro', () => {
    const options = makeTechnicianRankingOptions({
      name: 'Internet',
      rows: [linha()],
      color: '#2f6bff',
      theme: 'light',
    })

    expect(options.animation).toBe(false)
  })

  it('declara a leitura acessível com os números da própria coleção', () => {
    const options = makeTechnicianRankingOptions({
      name: 'Internet',
      rows: [linha({ name: 'Marcos Andrade Silva' })],
      color: '#2f6bff',
      theme: 'light',
    })

    const aria = options.aria as { label: { description: string } }
    expect(aria.label.description).toContain('Marcos Andrade Silva')
    expect(aria.label.description).toContain('3,9 concluídas por dia')
    expect(aria.label.description).toContain('visitas concluídas por dia trabalhado')
  })

  it('recorte vazio mostra o aviso, e não um gráfico sem barra', () => {
    const options = makeTechnicianRankingOptions({
      name: 'Câmeras',
      rows: [],
      color: '#2f6bff',
      theme: 'dark',
    })

    const title = options.title as { text: string }
    expect(title.text).toBe(TECHNICIANS_EMPTY_MESSAGE)
    expect(options.series).toBeUndefined()
  })

  it('frente com gente mas sem ninguém no piso diz isso, e não "sem visitas"', () => {
    const options = makeTechnicianRankingOptions({
      name: 'Outros serviços',
      rows: [],
      color: '#64748b',
      emptyMessage: 'Nenhum técnico com 5 dias em campo no período',
      theme: 'light',
    })

    const title = options.title as { text: string }
    expect(title.text).toBe('Nenhum técnico com 5 dias em campo no período')

    const aria = options.aria as { label: { description: string } }
    expect(aria.label.description).toContain('Nenhum técnico com 5 dias em campo')
  })

  it('omite tempo e deslocamento do tooltip quando não foram medidos', () => {
    const options = makeTechnicianRankingOptions({
      name: 'Internet',
      rows: [linha({ serviceMinutes: null, travelMinutes: null })],
      color: '#2f6bff',
      theme: 'light',
    })

    const tooltip = options.tooltip as { formatter: (params: unknown) => string }
    const texto = tooltip.formatter({ dataIndex: 0 })

    expect(texto).toContain('Concluídas por dia')
    expect(texto).not.toContain('Tempo por serviço')
    expect(texto).not.toContain('Deslocamento')
  })

  it('leva nome completo e taxa de conclusão para o tooltip', () => {
    const options = makeTechnicianRankingOptions({
      name: 'Internet',
      rows: [linha()],
      color: '#2f6bff',
      theme: 'light',
    })

    const tooltip = options.tooltip as { formatter: (params: unknown) => string }
    const texto = tooltip.formatter({ dataIndex: 0 })

    expect(texto).toContain('Marcos Andrade Silva')
    expect(texto).toContain('Taxa de conclusão')
    expect(texto).toContain('88,2%')
  })
})

describe('makeUnproductiveReasonsOptions', () => {
  const rows = [
    { reason: 'Cliente ausente', count: 378, share: 0.518 },
    { reason: 'Local sem condição', count: 103, share: 0.141 },
  ]

  it('desenha o motivo mais frequente no topo', () => {
    const options = makeUnproductiveReasonsOptions({ rows, color: '#e5484d', theme: 'light' })
    const yAxis = options.yAxis as { data: string[] }

    expect(yAxis.data).toEqual(['Local sem condição', 'Cliente ausente'])
  })

  it('período sem improdutiva diz isso, em vez de "sem dados"', () => {
    const options = makeUnproductiveReasonsOptions({ rows: [], color: '#e5484d', theme: 'light' })
    const title = options.title as { text: string }

    expect(title.text).toBe(NO_UNPRODUCTIVE_MESSAGE)
  })

  it('descreve os motivos com contagem e participação', () => {
    expect(buildReasonsDescription(rows)).toContain('Cliente ausente: 378 visitas, 51,8%')
  })
})

describe('descrições vazias', () => {
  it('falam do período, e não de erro', () => {
    expect(buildRankingDescription('Internet', [])).toContain(TECHNICIANS_EMPTY_MESSAGE)
    expect(buildReasonsDescription([])).toContain(NO_UNPRODUCTIVE_MESSAGE)
  })
})
