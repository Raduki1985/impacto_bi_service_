import { describe, expect, it } from 'vitest'

import { OVERVIEW_OS_RECORDS } from './overviewOsData'
import {
  applyOverviewOsFilters,
  applyOverviewOsFiltersExceptServiceType,
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

  it('com Câmeras selecionada, Categoria oferece só as categorias reais da equipe', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters({ team: 'Câmeras' }))

    expect(options.categories).not.toContain('REPARO DE CTO')
    expect(options.categories).not.toContain('mudança de endereço')
    expect(options.categories).toContain('instalação de 2 câmeras')
    // Ordem alfabética pt-BR: as categorias não têm catálogo de negócio.
    expect(options.categories).toEqual([...options.categories].sort((a, b) => a.localeCompare(b, 'pt-BR')))
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

  it('com um tipo selecionado, Categoria oferece só as subdivisões dele', () => {
    const { options } = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ serviceType: 'Infraestrutura' }),
    )

    expect(options.categories).toContain('REPARO DE CTO')
    expect(options.categories).not.toContain('fibra instalação')
  })

  it('não publica mais opções de resolução: o filtro saiu do painel', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters())

    expect(options).not.toHaveProperty('resolutions')
    expect(defaultOverviewOsFilters).not.toHaveProperty('resolution')
  })
})

describe('invalidação de seleções dependentes', () => {
  it('trocar a equipe limpa a categoria incompatível e preserva as compatíveis', () => {
    const incompatible = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Câmeras', category: 'REPARO DE CTO' }),
    )
    expect(incompatible.filters.category).toBe('Todas')

    const compatible = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Câmeras', category: 'instalação de 2 câmeras' }),
    )
    expect(compatible.filters.category).toBe('instalação de 2 câmeras')
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

  it('trocar o tipo revalida a categoria, e a categoria recorta a cidade', () => {
    const resolved = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ serviceType: 'Infraestrutura', category: 'fibra instalação' }),
    )
    expect(resolved.filters.category).toBe('Todas')

    // Categoria vem ANTES de Cidade na cadeia: as cidades oferecidas são só as
    // que têm OS daquela categoria.
    const scoped = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ category: 'Auditória de Infraestrutura' }),
    )
    expect(scoped.options.cities.length).toBeLessThan(
      resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters()).options.cities.length,
    )
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

describe('contexto que ignora o próprio filtro Tipo de OS', () => {
  it('mantém todos os tipos do recorte quando um tipo está selecionado', () => {
    const comTipo = applyOverviewOsFiltersExceptServiceType(
      OVERVIEW_OS_RECORDS,
      filters({ serviceType: 'Instalação' }),
    )

    // O contexto tem as 1.248 OS do período, e não só as 584 do tipo: é ele
    // que preserva as demais fatias como referência comparativa.
    expect(comTipo.length).toBe(1248)
    expect(new Set(comTipo.map((row) => row.serviceType)).size).toBe(6)
    expect(
      applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters({ serviceType: 'Instalação' })).length,
    ).toBe(584)
  })

  it('aplica todos os demais campos, inclusive Categoria e Status', () => {
    const rows = applyOverviewOsFiltersExceptServiceType(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Câmeras', serviceType: 'Instalação de Câmera', status: 'Concluída' }),
    )

    expect(rows.every((row) => row.team === 'Câmeras')).toBe(true)
    expect(rows.every((row) => row.status === 'Concluída')).toBe(true)
    // Categoria é a subdivisão do tipo, então ela continua recortando.
    const porCategoria = applyOverviewOsFiltersExceptServiceType(
      OVERVIEW_OS_RECORDS,
      filters({ category: 'fibra instalação + segundo ponto' }),
    )
    expect(porCategoria.every((row) => row.category === 'fibra instalação + segundo ponto')).toBe(
      true,
    )
    expect(new Set(porCategoria.map((row) => row.serviceType))).toEqual(
      new Set(['Instalação', 'Mudança de Endereço']),
    )
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
