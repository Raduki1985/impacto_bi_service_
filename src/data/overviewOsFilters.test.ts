import { describe, expect, it } from 'vitest'

import { OVERVIEW_OS_RECORDS } from './overviewOsData'
import {
  applyOverviewOsFilters,
  defaultOverviewOsFilters,
  listActiveOverviewOsFilters,
  previousOverviewOsPeriod,
  resolveOverviewOsFilters,
  updateOverviewOsFilter,
  type OverviewOsFilters,
} from './overviewOsFilters'

const filters = (overrides: Partial<OverviewOsFilters> = {}): OverviewOsFilters => ({
  ...defaultOverviewOsFilters,
  ...overrides,
})

describe('período padrão e limites de data', () => {
  it('abre no mês mais recente da base: 01/08/2026 a 21/08/2026', () => {
    expect(defaultOverviewOsFilters.dateFrom).toBe('2026-08-01')
    expect(defaultOverviewOsFilters.dateTo).toBe('2026-08-21')
  })

  it('rejeita data invertida, inválida ou fora da cobertura da fonte', () => {
    const current = filters()

    expect(updateOverviewOsFilter(current, 'dateFrom', '2026-08-30')).toBe(current)
    expect(updateOverviewOsFilter(current, 'dateFrom', 'texto')).toBe(current)
    // Antes de 06/04/2026 não existe base; depois de 21/08/2026 também não.
    expect(updateOverviewOsFilter(current, 'dateFrom', '2026-03-11')).toBe(current)
    expect(updateOverviewOsFilter(current, 'dateTo', '2026-08-22')).toBe(current)
  })

  it('aceita qualquer janela válida dentro da cobertura', () => {
    const next = updateOverviewOsFilter(filters(), 'dateFrom', '2026-08-05')
    expect(next.dateFrom).toBe('2026-08-05')
  })
})

describe('opções dependentes derivadas dos dados', () => {
  it('no período padrão oferece só valores existentes, sem Retirada nem Retiradas', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters())

    // Retiradas não tem OS em toda a base; Suporte Lógico não tem em agosto.
    expect(options.teams).toEqual(['Infra', 'Terceirizada', 'Câmeras', 'Suporte Técnico'])
    // Tipo Retirada não existe na fonte; Customer (legado) só existe em
    // abril e maio, então também fica fora do mês padrão.
    expect(options.serviceTypes).not.toContain('Retirada')
    expect(options.serviceTypes).not.toContain('Customer (legado)')
    expect(options.serviceTypes).toContain('Instalação de Câmera')
    expect(options.statuses).toEqual([
      'Pendente de Aprovação',
      'Concluída',
      'Improdutiva',
      'Encerrada',
      'Expirada',
    ])
    expect(options.cities).toContain('Cidade não informada')
  })

  it('no período completo o tipo legado aparece, na posição pós-catálogo', () => {
    const { options } = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ dateFrom: '2026-04-06' }),
    )

    expect(options.serviceTypes).toContain('Customer (legado)')
    expect(options.serviceTypes[options.serviceTypes.length - 1]).toBe('Customer (legado)')
  })

  it('com Câmeras selecionada, Resolução oferece só os desfechos reais da equipe', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters({ team: 'Câmeras' }))

    expect(options.resolutions).not.toContain('Atenuação da Rede')
    expect(options.resolutions).not.toContain('Instalação + Segundo Ponto Executado')
    expect(options.resolutions).toContain('Todas as Câmeras Instaladas')
    // Tipos reais da equipe no mês padrão; nada de combinação inventada.
    expect(options.serviceTypes).toEqual(['Instalação', 'Manutenção', 'Instalação de Câmera'])
  })

  it('nunca oferece null como opção', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters())

    for (const list of Object.values(options)) {
      expect(list).not.toContain(null)
      expect(list).not.toContain('null')
      expect(list).not.toContain('')
    }
  })

  it('sem resolução preenchida no contexto, a lista fica vazia (ex.: Expirada)', () => {
    const { options } = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ status: 'Expirada' }),
    )

    expect(options.resolutions).toEqual([])
  })
})

describe('invalidação de seleções dependentes', () => {
  it('trocar a equipe limpa a resolução incompatível e preserva as compatíveis', () => {
    const incompatible = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Câmeras', resolution: 'Instalação + Segundo Ponto Executado' }),
    )
    expect(incompatible.filters.resolution).toBe('Todas')

    const compatible = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Câmeras', resolution: 'Todas as Câmeras Instaladas' }),
    )
    expect(compatible.filters.resolution).toBe('Todas as Câmeras Instaladas')
  })

  it('mudar o período limpa qualquer campo que ficou sem dados na nova janela', () => {
    // Customer (legado) existe só em abril e maio: ao voltar para o mês padrão
    // a seleção não sobrevive escondida.
    const resolved = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ serviceType: 'Customer (legado)' }),
    )

    expect(resolved.filters.serviceType).toBe('Todos')
  })

  it('trocar o status revalida a resolução', () => {
    const resolved = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ status: 'Expirada', resolution: 'Instalação Realizada' }),
    )

    expect(resolved.filters.resolution).toBe('Todas')
  })

  it('a cadeia continua avaliando os campos seguintes após um reset', () => {
    // Suporte Lógico não tem OS no mês padrão: a equipe volta para Todas e,
    // com o contexto restaurado, as seleções seguintes compatíveis permanecem.
    const resolved = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Suporte Lógico', status: 'Concluída' }),
    )

    expect(resolved.filters.team).toBe('Todas')
    expect(resolved.filters.status).toBe('Concluída')
  })
})

describe('aplicação dos filtros e período anterior', () => {
  it('o padrão devolve as 1.248 OS de agosto', () => {
    expect(applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters()).length).toBe(1248)
  })

  it('equipe Câmeras no padrão tem exatamente as 298 OS reais', () => {
    const rows = applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters({ team: 'Câmeras' }))

    expect(rows.length).toBe(298)
    expect(rows.filter((row) => row.serviceType === 'Instalação de Câmera').length).toBe(279)
    expect(rows.filter((row) => row.serviceType === 'Manutenção').length).toBe(18)
    expect(rows.filter((row) => row.serviceType === 'Instalação').length).toBe(1)
  })

  it('a janela anterior tem a mesma duração e termina na véspera do início', () => {
    const previous = previousOverviewOsPeriod(filters())

    expect(previous).toEqual({
      range: { dateFrom: '2026-07-11', dateTo: '2026-07-31' },
      coverage: 'complete',
    })
  })

  it('marca como incompleta a janela anterior que alcança datas sem base', () => {
    const previous = previousOverviewOsPeriod(
      filters({ dateFrom: '2026-04-06', dateTo: '2026-04-30' }),
    )

    expect(previous?.coverage).toBe('incomplete')
  })
})

describe('resumo dos filtros ativos', () => {
  it('padrão intacto não conta filtro ativo', () => {
    expect(listActiveOverviewOsFilters(filters())).toEqual([])
  })

  it('lista campo, rótulo e valor na ordem aprovada', () => {
    expect(
      listActiveOverviewOsFilters(filters({ dateFrom: '2026-08-05', team: 'Infra' })),
    ).toEqual([
      { field: 'dateFrom', label: 'Início', value: '2026-08-05' },
      { field: 'team', label: 'Equipe', value: 'Infra' },
    ])
  })
})
