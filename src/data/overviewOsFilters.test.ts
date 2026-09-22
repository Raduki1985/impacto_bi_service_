import { describe, expect, it } from 'vitest'

import { todayISO } from './defaultPeriod'
import { OVERVIEW_OS_RECORDS } from './overviewOsData'
import {
  applyOverviewOsFilters,
  applyOverviewOsFiltersExceptCategory,
  applyOverviewOsFiltersExceptCity,
  applyOverviewOsFiltersExceptServiceTypeAndCategory,
  comparisonPeriodRange,
  defaultOverviewOsFilters,
  defaultOverviewOsFiltersFor,
  listActiveOverviewOsFilters,
  periodIncludesToday,
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

  it('com o banco em dia, abre no dia 1 do mês corrente até ONTEM: hoje é da faixa', () => {
    // Cobertura que alcança qualquer data futura, com a data fixada: o fim é
    // ontem, e o início é o dia 1 do mês de ontem. Hoje fica de fora porque as
    // OS do dia em andamento entravam como "em aberto" e derrubavam as taxas
    // de manhã (decisão do Mário em 22/09/2026).
    const cobertura = { min: '2020-01-01', max: '2099-12-31' }

    expect(defaultOverviewOsFiltersFor(cobertura, '2026-09-22')).toMatchObject({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-21',
    })
    // Sem data fixada vale o relógio, e o fim nunca chega a hoje.
    expect(defaultOverviewOsFiltersFor(cobertura).dateTo < todayISO()).toBe(true)
  })

  it('no dia 1 abre com o mês anterior inteiro, o último resultado fechado', () => {
    const cobertura = { min: '2020-01-01', max: '2099-12-31' }

    expect(defaultOverviewOsFiltersFor(cobertura, '2026-10-01')).toMatchObject({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    })
    // Virada de ano: 1º de janeiro abre em dezembro inteiro.
    expect(defaultOverviewOsFiltersFor(cobertura, '2027-01-01')).toMatchObject({
      dateFrom: '2026-12-01',
      dateTo: '2026-12-31',
    })
  })

  it('com a carga atrasada, o fim recua para a última data com dado', () => {
    const padrao = defaultOverviewOsFiltersFor({ min: '2026-04-06', max: '2026-08-21' }, '2026-09-22')

    expect(padrao).toMatchObject({ dateFrom: '2026-08-01', dateTo: '2026-08-21' })
  })

  it('avisa quando o recorte escolhido alcança o dia de hoje, ainda em andamento', () => {
    expect(periodIncludesToday({ dateTo: '2026-09-22' }, '2026-09-22')).toBe(true)
    expect(periodIncludesToday({ dateTo: '2026-09-21' }, '2026-09-22')).toBe(false)
    // O padrão nunca inclui hoje.
    expect(
      periodIncludesToday(defaultOverviewOsFiltersFor({ min: '2020-01-01', max: '2099-12-31' })),
    ).toBe(false)
  })
})

describe('ordem de exibição vinda da fonte', () => {
  it('ordena status e tipos pela lista recebida; o que sobra vai para o fim, alfabético', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters(), {
      statuses: ['Expirada', 'Concluída'],
      serviceTypes: ['Manutenção'],
    })

    expect(options.statuses).toEqual([
      'Expirada',
      'Concluída',
      'Encerrada',
      'Improdutiva',
      'Pendente de Aprovação',
    ])
    expect(options.serviceTypes).toEqual([
      'Manutenção',
      'Auditoria',
      'Infraestrutura',
      'Instalação',
      'Instalação de Câmera',
      'Mudança de Endereço',
    ])
  })

  it('sem ordem de negócio, tudo sai em ordem alfabética pt-BR', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters(), {
      statuses: [],
      serviceTypes: [],
    })

    expect(options.statuses).toEqual([
      'Concluída',
      'Encerrada',
      'Expirada',
      'Improdutiva',
      'Pendente de Aprovação',
    ])
  })
})

describe('opções dependentes derivadas dos dados', () => {
  it('no período padrão oferece só valores existentes, sem Retirada nem Retiradas', () => {
    const { options } = resolveOverviewOsFilters(OVERVIEW_OS_RECORDS, filters())

    // Retiradas não tem OS em toda a base; Suporte Lógico não tem em agosto.
    // Equipe sai em ordem alfabética: é o cadastro do SGI, sem lista de ordem.
    expect(options.teams).toEqual(['Câmeras', 'Infra', 'Suporte Técnico', 'Terceirizada'])
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

})

/**
 * Janela anterior pela NATUREZA do recorte, regra aprovada pelo Mário em
 * 22/09/2026. Os dias da semana citados nos casos foram conferidos no
 * calendário: 21/09/2026 é segunda-feira, e daí os demais.
 */
describe('janela anterior pela natureza do recorte', () => {
  it('mês até um dia compara com o mês anterior até o mesmo dia: 01 a 21/08 contra 01 a 21/07', () => {
    // Era 11/07 a 31/07 (mesma duração terminando na véspera): misturava
    // semanas, cruzava o mês, e ninguém confere isso no SGI.
    expect(previousOverviewOsPeriod(filters())).toEqual({
      range: { dateFrom: '2026-07-01', dateTo: '2026-07-21' },
      coverage: 'complete',
      kind: 'month',
    })
  })

  it('mês inteiro compara com o mês anterior inteiro, mais curto ou mais longo que ele', () => {
    expect(comparisonPeriodRange({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toEqual({
      kind: 'month',
      range: { dateFrom: '2026-07-01', dateTo: '2026-07-31' },
    })
    expect(comparisonPeriodRange({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })).toEqual({
      kind: 'month',
      range: { dateFrom: '2026-02-01', dateTo: '2026-02-28' },
    })
    // Virada de ano.
    expect(comparisonPeriodRange({ dateFrom: '2027-01-01', dateTo: '2027-01-15' })).toEqual({
      kind: 'month',
      range: { dateFrom: '2026-12-01', dateTo: '2026-12-15' },
    })
  })

  it('mês até um dia que o mês anterior não tem para no fim dele', () => {
    expect(comparisonPeriodRange({ dateFrom: '2026-03-01', dateTo: '2026-03-30' })).toEqual({
      kind: 'month',
      range: { dateFrom: '2026-02-01', dateTo: '2026-02-28' },
    })
  })

  it('um dia compara com o mesmo dia da semana anterior, nunca com a véspera', () => {
    // 21/08/2026 é sexta-feira. A véspera compararia sexta com quinta, e um
    // domingo compararia com o sábado, que tem dez vezes mais OS.
    expect(comparisonPeriodRange({ dateFrom: '2026-08-21', dateTo: '2026-08-21' })).toEqual({
      kind: 'day',
      range: { dateFrom: '2026-08-14', dateTo: '2026-08-14' },
    })
  })

  it('semana, de segunda a algum dia dela, compara com os mesmos dias da semana anterior', () => {
    // 17/08/2026 é segunda-feira.
    expect(comparisonPeriodRange({ dateFrom: '2026-08-17', dateTo: '2026-08-19' })).toEqual({
      kind: 'week',
      range: { dateFrom: '2026-08-10', dateTo: '2026-08-12' },
    })
    expect(comparisonPeriodRange({ dateFrom: '2026-08-17', dateTo: '2026-08-23' })).toEqual({
      kind: 'week',
      range: { dateFrom: '2026-08-10', dateTo: '2026-08-16' },
    })
  })

  it('dia 1 numa segunda-feira é lido como mês, que é o eixo da página', () => {
    // 01/06/2026 é segunda-feira.
    expect(comparisonPeriodRange({ dateFrom: '2026-06-01', dateTo: '2026-06-05' })).toEqual({
      kind: 'month',
      range: { dateFrom: '2026-05-01', dateTo: '2026-05-05' },
    })
  })

  it('qualquer outro recorte segue com a mesma duração terminando na véspera', () => {
    expect(comparisonPeriodRange({ dateFrom: '2026-08-05', dateTo: '2026-08-14' })).toEqual({
      kind: 'custom',
      range: { dateFrom: '2026-07-26', dateTo: '2026-08-04' },
    })
    // Oito dias a partir de uma segunda-feira já não são "uma semana".
    expect(comparisonPeriodRange({ dateFrom: '2026-08-17', dateTo: '2026-08-24' })?.kind).toBe('custom')
    // Recorte que cruza para o mês seguinte também não é "um mês".
    expect(comparisonPeriodRange({ dateFrom: '2026-08-01', dateTo: '2026-09-02' })?.kind).toBe('custom')
  })

  it('recorte inválido não gera janela', () => {
    expect(comparisonPeriodRange({ dateFrom: '2026-08-21', dateTo: '2026-08-01' })).toBeNull()
    expect(comparisonPeriodRange({ dateFrom: 'texto', dateTo: '2026-08-01' })).toBeNull()
  })

  it('marca como incompleta a janela anterior que alcança datas sem base', () => {
    const previous = previousOverviewOsPeriod(
      filters({ dateFrom: '2026-04-06', dateTo: '2026-04-30' }),
    )

    expect(previous?.coverage).toBe('incomplete')
  })
})

describe('contexto que ignora os filtros Tipo de OS e Categoria', () => {
  it('mantém todos os tipos do recorte quando um tipo está selecionado', () => {
    const comTipo = applyOverviewOsFiltersExceptServiceTypeAndCategory(
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

  it('mantém todos os tipos também quando uma categoria está selecionada', () => {
    // Quase toda categoria pertence a um único tipo: aplicá-la aqui reproduzia
    // a fatia única de 100% por outro caminho. A seleção vira destaque na
    // página, e o dado do contexto não encolhe.
    const porCategoria = applyOverviewOsFiltersExceptServiceTypeAndCategory(
      OVERVIEW_OS_RECORDS,
      filters({ category: 'fibra instalação' }),
    )

    expect(porCategoria.length).toBe(1248)
    expect(new Set(porCategoria.map((row) => row.serviceType)).size).toBe(6)
  })

  it('aplica todos os demais campos, inclusive Equipe e Status', () => {
    const rows = applyOverviewOsFiltersExceptServiceTypeAndCategory(
      OVERVIEW_OS_RECORDS,
      filters({ team: 'Câmeras', serviceType: 'Instalação de Câmera', status: 'Concluída' }),
    )

    expect(rows.every((row) => row.team === 'Câmeras')).toBe(true)
    expect(rows.every((row) => row.status === 'Concluída')).toBe(true)
  })
})

describe('contexto que ignora o próprio filtro Categoria', () => {
  it('mantém todas as categorias do recorte quando uma está selecionada', () => {
    const comCategoria = applyOverviewOsFiltersExceptCategory(
      OVERVIEW_OS_RECORDS,
      filters({ category: 'fibra instalação' }),
    )

    // O ranking de categorias não vira barra única: o contexto tem as 1.248 OS
    // do período, e não só as 562 da categoria.
    expect(comCategoria.length).toBe(1248)
    expect(
      applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters({ category: 'fibra instalação' }))
        .length,
    ).toBe(562)
  })

  it('aplica todos os demais campos, inclusive Tipo de OS', () => {
    const rows = applyOverviewOsFiltersExceptCategory(
      OVERVIEW_OS_RECORDS,
      filters({ serviceType: 'Instalação de Câmera', category: 'instalação de 2 câmeras' }),
    )

    expect(rows.every((row) => row.serviceType === 'Instalação de Câmera')).toBe(true)
    // E a categoria não recorta: o contexto tem mais de uma.
    expect(new Set(rows.map((row) => row.category)).size).toBeGreaterThan(1)
  })
})

describe('contexto que ignora o próprio filtro Cidade', () => {
  it('mantém todas as cidades do recorte quando uma está selecionada', () => {
    const comCidade = applyOverviewOsFiltersExceptCity(
      OVERVIEW_OS_RECORDS,
      filters({ city: 'Mairiporã' }),
    )

    // O ranking de cidades não vira barra única: o contexto tem as 1.248 OS do
    // período, com as onze cidades, e não só as 106 de Mairiporã.
    expect(comCidade.length).toBe(1248)
    expect(new Set(comCidade.map((row) => row.city)).size).toBe(11)
    expect(
      applyOverviewOsFilters(OVERVIEW_OS_RECORDS, filters({ city: 'Mairiporã' })).length,
    ).toBe(106)
  })

  it('aplica todos os demais campos, inclusive Categoria e Status', () => {
    const rows = applyOverviewOsFiltersExceptCity(
      OVERVIEW_OS_RECORDS,
      filters({ category: 'fibra instalação', city: 'Atibaia', status: 'Concluída' }),
    )

    expect(rows.every((row) => row.category === 'fibra instalação')).toBe(true)
    expect(rows.every((row) => row.status === 'Concluída')).toBe(true)
    expect(new Set(rows.map((row) => row.city)).size).toBeGreaterThan(1)
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

  it('ligada ao serviço, o período padrão da cobertura real não conta como filtro', () => {
    // A base do serviço vai até 10/09/2026, então a página abre em 01/09 a
    // 10/09. Comparar com o padrão do arquivo local (01/08 a 21/08) fazia o
    // Limpar filtros nascer visível, sem nada filtrado.
    const cobertura = { min: '2026-04-06', max: '2026-09-10' }
    const padrao = defaultOverviewOsFiltersFor(cobertura)

    expect(listActiveOverviewOsFilters(padrao, cobertura)).toEqual([])
    expect(listActiveOverviewOsFilters({ ...padrao, dateFrom: '2026-09-03' }, cobertura)).toEqual([
      { field: 'dateFrom', label: 'Início', value: '2026-09-03' },
    ])
  })
})

/**
 * Filtro por técnico.
 *
 * O filtro guarda o IDENTIFICADOR que a OS carrega, e não o nome: o nome vive
 * no catálogo do serviço e só existe na hora de desenhar o seletor. Por isso o
 * núcleo é testado com identificadores reais da fonte.
 */
describe('filtro por técnico', () => {
  const primeiro = OVERVIEW_OS_RECORDS.find((record) => record.technicianId !== null)!
  const technicianId = primeiro.technicianId as string

  it('nasce neutro, com todos os técnicos', () => {
    expect(defaultOverviewOsFilters.technicianId).toBe('Todos')
  })

  it('deixa passar somente as OS daquele técnico', () => {
    const recorte = applyOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ dateFrom: '2026-04-06', dateTo: '2026-08-21', technicianId }),
    )

    expect(recorte.length).toBeGreaterThan(0)
    for (const record of recorte) {
      expect(record.technicianId).toBe(technicianId)
    }
  })

  it('tira do recorte as OS sem técnico, que é a decisão aprovada', () => {
    const semTécnico = OVERVIEW_OS_RECORDS.filter((record) => record.technicianId === null)
    const recorte = applyOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ dateFrom: '2026-04-06', dateTo: '2026-08-21', technicianId }),
    )

    // Elas existem na base e continuam nos totais sem filtro, mas não têm como
    // pertencer a um técnico escolhido.
    expect(semTécnico.length).toBeGreaterThan(0)
    expect(recorte.some((record) => record.technicianId === null)).toBe(false)
  })

  it('vale também nos contextos comparativos dos gráficos', () => {
    const janela = { dateFrom: '2026-04-06', dateTo: '2026-08-21', technicianId }

    for (const apply of [
      applyOverviewOsFiltersExceptCategory,
      applyOverviewOsFiltersExceptCity,
      applyOverviewOsFiltersExceptServiceTypeAndCategory,
    ]) {
      const recorte = apply(OVERVIEW_OS_RECORDS, filters(janela))

      // Cada contexto ignora só a própria dimensão. Técnico é filtro global, e
      // não pode escapar em nenhum deles.
      expect(recorte.length).toBeGreaterThan(0)
      for (const record of recorte) expect(record.technicianId).toBe(technicianId)
    }
  })

  it('publica na lista de opções os técnicos presentes no contexto', () => {
    const { options } = resolveOverviewOsFilters(
      OVERVIEW_OS_RECORDS,
      filters({ dateFrom: '2026-04-06', dateTo: '2026-08-21' }),
    )

    expect(options.technicians.length).toBeGreaterThan(0)
    expect(options.technicians).toContain(technicianId)
    // Nenhum nulo entra na lista: OS sem técnico não vira opção.
    expect(options.technicians.every((id) => typeof id === 'string' && id !== '')).toBe(true)
  })

  it('devolve o filtro ao neutro quando o técnico some do contexto', () => {
    // Um dia em que este técnico não trabalhou: a seleção não pode continuar
    // pendurada, escondendo um recorte vazio.
    const semEle = OVERVIEW_OS_RECORDS.filter(
      (record) => record.technicianId !== technicianId,
    )
    const { filters: saneado } = resolveOverviewOsFilters(semEle, filters({ technicianId }))

    expect(saneado.technicianId).toBe('Todos')
  })

  it('entra na lista de filtros ativos com o rótulo Técnico', () => {
    const ativos = listActiveOverviewOsFilters(filters({ technicianId }))

    expect(ativos.map((item) => item.label)).toContain('Técnico')
    expect(ativos.find((item) => item.field === 'technicianId')?.value).toBe(technicianId)
  })
})
