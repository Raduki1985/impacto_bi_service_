import { describe, expect, it } from 'vitest'

import {
  buildOverviewOsData,
  OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
} from './overviewOsAggregates'
import { OVERVIEW_OS_RECORDS, type OverviewOsRecord } from './overviewOsData'
import { defaultOverviewOsFilters, type OverviewOsFilters } from './overviewOsFilters'

const filters = (overrides: Partial<OverviewOsFilters> = {}): OverviewOsFilters => ({
  ...defaultOverviewOsFilters,
  ...overrides,
})

const build = (overrides: Partial<OverviewOsFilters> = {}) =>
  buildOverviewOsData(OVERVIEW_OS_RECORDS, filters(overrides))

describe('indicadores do período padrão (01/08 a 21/08/2026)', () => {
  const data = build()

  it('reproduz os totais reais aprovados da fonte', () => {
    expect(data.kpis.total).toBe('1.248')
    expect(data.kpis.completed).toBe('959')
    expect(data.kpis.completionRate).toBe('76,8%')
    expect(data.kpis.unproductiveRate).toBe('10,7%')
    // Técnicos Ativos saiu da página: o agregado não publica mais a contagem.
    expect(data.kpis).not.toHaveProperty('activeTechnicians')
  })

  it('compara com a janela anterior real de mesma duração: 11/07 a 31/07', () => {
    expect(data.previousPeriod).toEqual({
      range: { dateFrom: '2026-07-11', dateTo: '2026-07-31' },
      coverage: 'complete',
      totals: { total: 1110, completed: 880, unproductive: 136 },
    })

    expect(data.kpis.totalDelta).toMatchObject({ text: '+12,4%', positive: true, available: true })
    expect(data.kpis.completedDelta).toMatchObject({ text: '+9,0%', available: true })
    expect(data.kpis.completionDelta).toMatchObject({
      text: '-3,1%',
      positive: false,
      available: true,
    })
    // Improdutividade caiu: em indicador de sentido invertido, queda é favorável.
    expect(data.kpis.unproductiveDelta).toMatchObject({
      text: '-12,4%',
      positive: true,
      available: true,
    })
  })

  it('gera a série diária com um ponto por dia COM OS, sem zeros inventados', () => {
    // Agosto tem 19 dias com OS agendada no recorte padrão. A série do gráfico
    // é a única que existe: as séries dos antigos minigráficos saíram junto com
    // eles, e eram os MESMOS pontos, calculados uma segunda vez.
    expect(data.charts.overviewDay.x.length).toBe(19)
    expect(data.charts.overviewDay.total.length).toBe(19)
    expect(data.charts.overviewDay.completed.length).toBe(19)
    expect(data.charts.overviewDay.total.reduce((sum, value) => sum + value, 0)).toBe(1248)
  })

  it('lista o Top 10 de categorias reais, com o empate na ordem dos artefatos', () => {
    expect(data.charts.categoryTopPairs.slice(0, 6)).toEqual([
      ['fibra instalação', 562],
      ['mudança de endereço', 187],
      ['instalação de 2 câmeras', 166],
      ['instalação de 1 câmera', 56],
      ['REPARO DE CTO', 26],
      ['instalação de 4 câmeras', 26],
    ])
    expect(data.charts.categoryTopPairs.length).toBe(10)
  })

  it('compõe o recorte por tipo, em ordem decrescente, cada fatia com o ranking das categorias', () => {
    const slices = data.charts.serviceTypeSlices

    expect(slices.map(({ name, value }) => [name, value])).toEqual([
      ['Instalação', 584],
      ['Instalação de Câmera', 293],
      ['Mudança de Endereço', 212],
      ['Infraestrutura', 135],
      ['Manutenção', 22],
      ['Auditoria', 2],
    ])
    // As fatias somam exatamente o total do recorte: nenhuma OS fica fora.
    expect(slices.reduce((sum, slice) => sum + slice.value, 0)).toBe(1248)

    // O ranking de cada fatia é o das categorias DAQUELE tipo, decrescente e
    // sem corte, e soma o valor da própria fatia.
    const installation = slices[0]
    expect(installation.categories.slice(0, 2)).toEqual([
      ['fibra instalação', 562],
      ['fibra instalação + segundo ponto', 19],
    ])
    for (const slice of slices) {
      expect(slice.categories.reduce((sum, [, count]) => sum + count, 0)).toBe(slice.value)
      for (let index = 1; index < slice.categories.length; index += 1) {
        expect(slice.categories[index][1]).toBeLessThanOrEqual(slice.categories[index - 1][1])
      }
    }
    // A mesma categoria pode viver sob dois tipos na fonte, e cada fatia
    // conta só a parte dela.
    const move = slices.find((slice) => slice.name === 'Mudança de Endereço')!
    expect(move.categories).toContainEqual(['fibra instalação + segundo ponto', 1])
  })

  it('lista TODAS as cidades do recorte, em ordem decrescente, sem corte', () => {
    expect(data.charts.cityPairs).toEqual([
      ['Atibaia', 938],
      ['Mairiporã', 106],
      ['Bom Jesus dos Perdões', 86],
      ['Piracaia', 79],
      ['Joanópolis', 11],
      ['Nazaré Paulista', 9],
      ['Bragança Paulista', 7],
      ['Jarinu', 6],
      ['Campinas', 3],
      ['São Paulo', 2],
      ['Cidade não informada', 1],
    ])
    expect(data.charts.cityPairs.reduce((sum, [, value]) => sum + value, 0)).toBe(1248)
  })

  it('lista o Top de resoluções considerando só OS Concluídas com resolução', () => {
    expect(data.charts.resolutionTopPairs.slice(0, 5)).toEqual([
      ['Instalação Realizada', 647],
      ['Todas as Câmeras Instaladas', 226],
      ['Instalação + Segundo Ponto Executado', 39],
      ['Instalação Parcial das Câmeras, Retornar ao Local', 8],
      ['Troca de Câmeras', 7],
    ])
  })
})

describe('filtros aplicados aos indicadores e gráficos', () => {
  it('equipe Câmeras: 298 OS reais, sem resolução de rede no ranking', () => {
    const data = build({ team: 'Câmeras' })

    expect(data.kpis.total).toBe('298')
    const resolutions = data.charts.resolutionTopPairs.map(([resolution]) => resolution)
    expect(resolutions).not.toContain('Atenuação da Rede')
    expect(resolutions).toContain('Todas as Câmeras Instaladas')
  })

  it('categoria selecionada recorta indicadores e cidades, mas não a rosca de tipos', () => {
    const data = build({ category: 'fibra instalação' })

    expect(data.kpis.total).toBe('562')
    // A rosca ignora Tipo de OS e Categoria: as seis fatias do período seguem
    // desenhadas como contexto, e a seleção vira destaque na página, nunca uma
    // fatia única de 100%.
    expect(data.charts.serviceTypeSlices.map(({ name, value }) => [name, value])).toEqual(
      build().charts.serviceTypeSlices.map(({ name, value }) => [name, value]),
    )
    // O ranking de cidades ignora só o filtro Cidade, então a categoria
    // continua recortando: as cidades somam as 562 OS da categoria.
    expect(data.charts.cityPairs.reduce((sum, [, value]) => sum + value, 0)).toBe(562)
  })

  it('status selecionado filtra indicadores e rankings normalmente', () => {
    const data = build({ status: 'Improdutiva' })

    expect(data.kpis.total).toBe('134')
    // Nenhuma OS improdutiva é concluída: o ranking de resoluções zera.
    expect(data.charts.resolutionTopPairs).toEqual([])
  })
})

describe('séries diárias do Volume diário de OS', () => {
  const data = build()
  const { overviewDay } = data.charts

  it('publica as quatro coleções com o mesmo comprimento', () => {
    expect(overviewDay.x.length).toBe(19)
    expect(overviewDay.total.length).toBe(overviewDay.x.length)
    expect(overviewDay.completed.length).toBe(overviewDay.x.length)
    expect(overviewDay.unproductiveRate.length).toBe(overviewDay.x.length)
  })

  it('publica a data completa de cada dia, alinhada com o rótulo do eixo', () => {
    // O rótulo do eixo não tem ano, e é da data completa que o tooltip do
    // gráfico tira o dia da semana. As duas coleções andam na mesma ordem.
    expect(overviewDay.iso.length).toBe(overviewDay.x.length)
    expect(overviewDay.iso[0]).toBe('2026-08-01')
    expect(overviewDay.iso[overviewDay.iso.length - 1]).toBe('2026-08-21')
    for (const [index, iso] of overviewDay.iso.entries()) {
      const [, month, day] = iso.split('-')
      expect(`${day}/${month}`).toBe(overviewDay.x[index])
    }
  })

  it('publica a CONTAGEM de improdutivas do dia, e não só a taxa', () => {
    // 01/08 tem 48 OS, 4 delas improdutivas; 21/08 tem 74 OS e 6 improdutivas.
    expect(overviewDay.unproductive.length).toBe(overviewDay.x.length)
    expect(overviewDay.unproductive[0]).toBe(4)
    expect(overviewDay.unproductive[overviewDay.x.length - 1]).toBe(6)
    // Mesma contagem do KPI do período, somada dia a dia.
    expect(overviewDay.unproductive.reduce((sum, value) => sum + value, 0)).toBe(134)
    // Contagem e taxa saem do MESMO dia: uma é a outra dividida pelo total.
    for (const [index, quantidade] of overviewDay.unproductive.entries()) {
      expect(Number.isInteger(quantidade)).toBe(true)
      expect(quantidade).toBeLessThanOrEqual(overviewDay.total[index])
      expect(overviewDay.unproductiveRate[index]).toBeCloseTo(
        quantidade / overviewDay.total[index],
        12,
      )
    }
  })

  it('soma exatamente os totais do recorte, sem dia a mais nem a menos', () => {
    expect(overviewDay.total.reduce((sum, value) => sum + value, 0)).toBe(1248)
    expect(overviewDay.completed.reduce((sum, value) => sum + value, 0)).toBe(959)
  })

  it('calcula a taxa de cada dia sobre o total DAQUELE dia', () => {
    // 01/08 tem 48 OS, 4 delas improdutivas; 21/08 tem 74 OS e 6 improdutivas.
    expect(overviewDay.x[0]).toBe('01/08')
    expect(overviewDay.unproductiveRate[0]).toBeCloseTo(4 / 48, 12)
    expect(overviewDay.x[overviewDay.x.length - 1]).toBe('21/08')
    expect(overviewDay.unproductiveRate[overviewDay.x.length - 1]).toBeCloseTo(6 / 74, 12)

    // A taxa reconstrói as 134 improdutivas do período: é a mesma contagem do
    // KPI, dia a dia, e não o percentual geral repetido em todos os pontos.
    const improdutivas = overviewDay.unproductiveRate.reduce(
      (sum, rate, index) => sum + rate * overviewDay.total[index],
      0,
    )
    expect(Math.round(improdutivas)).toBe(134)
    expect(new Set(overviewDay.unproductiveRate).size).toBeGreaterThan(1)
  })

  it('mantém a taxa como proporção de 0 a 1, sem arredondamento nem percentual', () => {
    for (const rate of overviewDay.unproductiveRate) {
      expect(Number.isFinite(rate)).toBe(true)
      expect(rate).toBeGreaterThanOrEqual(0)
      expect(rate).toBeLessThanOrEqual(1)
    }
    // Proporção crua: o valor do primeiro dia não é 8,3 nem 8.
    expect(overviewDay.unproductiveRate[0]).toBeLessThan(1)
  })

  it('publica o período INTEIRO, sem corte oculto nos últimos 45 dias', () => {
    // Recorte completo da fonte: 06/04 a 21/08, com 95 dias COM OS.
    const completo = build({ dateFrom: '2026-04-06', dateTo: '2026-08-21' })
    const serie = completo.charts.overviewDay

    expect(serie.x.length).toBe(95)
    expect(serie.x.length).toBeGreaterThan(45)
    // O primeiro e o último ponto são o primeiro e o último dia COM OS do
    // recorte, e não os 45 dias finais dele.
    expect(serie.x[0]).toBe('06/04')
    expect(serie.x[serie.x.length - 1]).toBe('21/08')
    expect(serie.total.length).toBe(95)
    expect(serie.completed.length).toBe(95)
    expect(serie.unproductiveRate.length).toBe(95)
    expect(serie.total.reduce((sum, value) => sum + value, 0)).toBe(4465)
    expect(serie.completed.reduce((sum, value) => sum + value, 0)).toBe(3432)
  })

  it('recalcula as três séries quando um filtro muda o recorte', () => {
    const cameras = build({ team: 'Câmeras' })
    const serie = cameras.charts.overviewDay

    expect(serie.total.reduce((sum, value) => sum + value, 0)).toBe(298)
    expect(serie.unproductiveRate.length).toBe(serie.x.length)
    expect(serie.unproductiveRate).not.toEqual(overviewDay.unproductiveRate)
  })

  it('não sobra nenhum dia quando a combinação de filtros não tem OS', () => {
    // Câmeras não tem nenhuma OS expirada no período padrão.
    const vazio = build({ team: 'Câmeras', status: 'Expirada' })
    const serie = vazio.charts.overviewDay

    expect(serie.x).toEqual([])
    expect(serie.total).toEqual([])
    expect(serie.completed).toEqual([])
    expect(serie.unproductiveRate).toEqual([])
  })
})

describe('distribuição contextual por status', () => {
  it('ignora somente o filtro Status: as demais barras permanecem', () => {
    const withStatus = build({ status: 'Improdutiva' })
    const withoutStatus = build()

    // O gráfico não vira uma barra única de 100%: o contexto fica igual ao do
    // recorte sem o filtro Status.
    expect(withStatus.charts.statusPairs).toEqual(withoutStatus.charts.statusPairs)
    expect(withStatus.charts.statusPairs.map(([status]) => status)).toEqual([
      'Pendente de Aprovação',
      'Concluída',
      'Improdutiva',
      'Encerrada',
      'Expirada',
    ])
  })

  it('aplica os demais filtros ao contexto do gráfico', () => {
    const data = build({ team: 'Câmeras', status: 'Concluída' })
    const total = data.charts.statusPairs.reduce((sum, [, value]) => sum + value, 0)

    // O contexto soma as 298 OS de Câmeras, não as 1.248 do período.
    expect(total).toBe(298)
  })
})

describe('ordem de exibição do gráfico de status', () => {
  it('status fora do de-para aparece no fim do gráfico, em vez de sumir', () => {
    const cru: OverviewOsRecord = {
      ...OVERVIEW_OS_RECORDS[0],
      id: 'OS-crua',
      dateISO: '2026-08-01',
      status: 'waiting_parts',
    }
    const data = buildOverviewOsData([...OVERVIEW_OS_RECORDS, cru], filters(), undefined, [
      'Concluída',
      'Improdutiva',
    ])

    // Conhecidos na ordem recebida; o resto, inclusive a chave crua, em ordem
    // alfabética no fim. Nada some: a OS conta no total e no gráfico.
    expect(data.charts.statusPairs.map(([status]) => status)).toEqual([
      'Concluída',
      'Improdutiva',
      'Encerrada',
      'Expirada',
      'Pendente de Aprovação',
      'waiting_parts',
    ])
    expect(data.kpis.total).toBe('1.249')
  })
})

describe('composição contextual por tipo de OS', () => {
  it('ignora somente o filtro Tipo de OS: as demais fatias permanecem', () => {
    const comTipo = build({ serviceType: 'Instalação' })
    const semTipo = build()

    // A rosca não vira uma fatia única de 100%: o contexto fica igual ao do
    // recorte sem o filtro Tipo de OS, como na distribuição por status.
    expect(comTipo.charts.serviceTypeSlices).toEqual(semTipo.charts.serviceTypeSlices)
    expect(comTipo.charts.serviceTypeSlices.length).toBe(6)

    // Os indicadores e os demais gráficos continuam recortados pelo tipo: só a
    // composição é que ganha o contexto.
    expect(comTipo.kpis.total).toBe('584')
    expect(comTipo.charts.cityPairs.reduce((sum, [, valor]) => sum + valor, 0)).toBe(584)
  })

  it('aplica os demais filtros ao contexto da composição', () => {
    const data = build({ team: 'Câmeras', serviceType: 'Instalação de Câmera' })
    const total = data.charts.serviceTypeSlices.reduce((sum, fatia) => sum + fatia.value, 0)

    // O contexto soma as 298 OS de Câmeras, não as 1.248 do período.
    expect(total).toBe(298)
  })

  it('categoria selecionada também não recorta a composição', () => {
    // Quase toda categoria pertence a um único tipo: aplicá-la aqui reproduzia
    // a fatia única de 100% por outro caminho. O contexto ignora os dois
    // filtros, e a seleção de categoria vira destaque do tipo que a contém.
    const data = build({ category: 'fibra instalação + segundo ponto' })
    const semFiltro = build()

    expect(data.charts.serviceTypeSlices.map(({ name, value }) => [name, value])).toEqual(
      semFiltro.charts.serviceTypeSlices.map(({ name, value }) => [name, value]),
    )
    // E o ranking interno das fatias segue completo, com a categoria escolhida
    // localizável nos DOIS tipos que a contêm: é dele que a página deriva o
    // destaque.
    const comCategoria = data.charts.serviceTypeSlices.filter((slice) =>
      slice.categories.some(([name]) => name === 'fibra instalação + segundo ponto'),
    )
    expect(comCategoria.map((slice) => slice.name)).toEqual([
      'Instalação',
      'Mudança de Endereço',
    ])
  })
})

describe('ranking contextual de categorias', () => {
  it('ignora somente o filtro Categoria: as demais barras permanecem', () => {
    const comCategoria = build({ category: 'fibra instalação' })
    const semCategoria = build()

    // O ranking não vira barra única: o Top 10 é o mesmo do recorte sem o
    // filtro Categoria, e a seleção vira destaque na página.
    expect(comCategoria.charts.categoryTopPairs).toEqual(semCategoria.charts.categoryTopPairs)
    expect(comCategoria.charts.categoryTopPairs.length).toBe(10)
    // A posição real acompanha, para o subtítulo do painel.
    expect(comCategoria.charts.selectedCategoryRank).toBe(1)
    expect(semCategoria.charts.selectedCategoryRank).toBeNull()
  })

  it('aplica os demais filtros ao contexto do ranking', () => {
    const data = build({ team: 'Câmeras', category: 'instalação de 2 câmeras' })

    // O contexto é o recorte de Câmeras, e não as 1.248 OS do período: o
    // Top 10 é o MESMO de Câmeras sem o filtro Categoria, liderado pela
    // própria categoria escolhida.
    expect(data.charts.categoryTopPairs).toEqual(
      build({ team: 'Câmeras' }).charts.categoryTopPairs,
    )
    expect(data.charts.categoryTopPairs[0]).toEqual(['instalação de 2 câmeras', 157])
    // Câmeras tem 12 categorias no período: o Top 10 soma 296 das 298 OS.
    const total = data.charts.categoryTopPairs.reduce((sum, [, value]) => sum + value, 0)
    expect(total).toBe(296)
    expect(data.charts.selectedCategoryRank).toBe(1)
  })

  it('garante a categoria selecionada fora do Top 10 como última barra, com a posição real', () => {
    // `Rompimento Massivo` é a 13ª categoria do período padrão, com 18 OS.
    const data = build({ category: 'Rompimento Massivo' })

    expect(data.charts.categoryTopPairs.length).toBe(11)
    expect(data.charts.categoryTopPairs[10]).toEqual(['Rompimento Massivo', 18])
    expect(data.charts.selectedCategoryRank).toBe(13)
    // As dez primeiras seguem sendo o Top 10 verdadeiro do contexto.
    expect(data.charts.categoryTopPairs.slice(0, 10)).toEqual(build().charts.categoryTopPairs)
  })

  it('no empate na fronteira do corte, o desempate lexicográfico decide quem é o 10º', () => {
    // A base REAL tem o caso: os ranks 10, 11 e 12 do período padrão estão
    // empatados em 20 OS. Selecionada a 11ª, ela entra anexada como última
    // barra e a 10ª continua sendo a vencedora do desempate: uma regressão no
    // critério trocaria as duas sem mudar nenhuma soma.
    const data = build({ category: 'mudança de endereço de 2 câmeras - Instalação' })

    expect(data.charts.categoryTopPairs.length).toBe(11)
    expect(data.charts.categoryTopPairs[9]).toEqual(['fibra instalação + segundo ponto', 20])
    expect(data.charts.categoryTopPairs[10]).toEqual([
      'mudança de endereço de 2 câmeras - Instalação',
      20,
    ])
    expect(data.charts.selectedCategoryRank).toBe(11)
  })

  it('categoria exatamente na 10ª posição não gera barra anexada', () => {
    const data = build({ category: 'fibra instalação + segundo ponto' })

    expect(data.charts.categoryTopPairs.length).toBe(10)
    expect(data.charts.categoryTopPairs[9]).toEqual(['fibra instalação + segundo ponto', 20])
    expect(data.charts.selectedCategoryRank).toBe(10)
  })

  it('categoria ausente do contexto fica neutra: rank null e Top 10 intacto', () => {
    // Inalcançável pela página, que resolve os filtros antes de agregar; a
    // função é exportada e pode receber filtros crus, então o ramo defensivo
    // precisa de rede própria.
    const data = build({ category: 'categoria fantasma' })

    expect(data.charts.categoryTopPairs).toEqual(build().charts.categoryTopPairs)
    expect(data.charts.selectedCategoryRank).toBeNull()
  })
})

describe('ranking contextual de cidades', () => {
  it('ignora somente o filtro Cidade: as demais barras permanecem', () => {
    const comCidade = build({ city: 'Mairiporã' })
    const semCidade = build()

    // O ranking não vira barra única: as onze cidades do período continuam, e
    // a cidade escolhida vira destaque na página.
    expect(comCidade.charts.cityPairs).toEqual(semCidade.charts.cityPairs)
    // Os indicadores seguem recortados pela cidade: só o ranking ganha contexto.
    expect(comCidade.kpis.total).toBe('106')
  })

  it('aplica os demais filtros ao contexto do ranking', () => {
    const data = build({ team: 'Câmeras', city: 'Atibaia' })
    const total = data.charts.cityPairs.reduce((sum, [, value]) => sum + value, 0)

    // O contexto soma as 298 OS de Câmeras, não as 1.248 do período.
    expect(total).toBe(298)
  })
})

describe('comparação com período anterior incompleto ou vazio', () => {
  it('janela anterior fora da cobertura: sem percentual e com o aviso aprovado', () => {
    const data = build({ dateFrom: '2026-04-06', dateTo: '2026-04-30' })

    expect(data.previousPeriod?.coverage).toBe('incomplete')
    expect(data.previousPeriod?.totals).toBeNull()
    for (const delta of [
      data.kpis.totalDelta,
      data.kpis.completedDelta,
      data.kpis.completionDelta,
      data.kpis.unproductiveDelta,
    ]) {
      expect(delta.available).toBe(false)
      expect(delta.unavailableLabel).toBe(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    }
  })

  it('janela anterior coberta mas sem registros: comparação indisponível padrão', () => {
    // Suporte Lógico tem 5 OS em junho e nenhuma na janela anterior de mesma
    // duração (02/05 a 31/05), que está inteira dentro da cobertura da fonte.
    const data = build({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      team: 'Suporte Lógico',
    })

    expect(data.kpis.total).toBe('5')
    expect(data.previousPeriod?.coverage).toBe('complete')
    expect(data.previousPeriod?.totals?.total).toBe(0)
    expect(data.kpis.totalDelta.available).toBe(false)
    // Sem motivo específico: o card mantém o aviso padrão de sempre.
    expect(data.kpis.totalDelta.unavailableLabel).toBeUndefined()
  })
})

/** Desfaz a formatação pt-BR dos KPIs para poder somar o que a tela exibe. */
const numero = (texto: string) => Number(texto.replace(/\./g, ''))

describe('recorte sem nenhuma OS', () => {
  // Câmeras não tem nenhuma OS expirada no período padrão. A série diária já é
  // coberta acima; aqui o que se prende são os agregados e os indicadores, que
  // precisam devolver coleção vazia e valor neutro, nunca NaN nem Infinity.
  const vazio = build({ team: 'Câmeras', status: 'Expirada' })

  it('devolve coleções vazias em todos os agregados', () => {
    expect(vazio.charts.serviceTypeSlices).toEqual([])
    expect(vazio.charts.cityPairs).toEqual([])
    expect(vazio.charts.categoryTopPairs).toEqual([])
    expect(vazio.charts.resolutionTopPairs).toEqual([])
  })

  it('publica indicadores neutros, sem divisão por zero vazando para a tela', () => {
    expect(vazio.kpis.total).toBe('0')
    expect(vazio.kpis.completed).toBe('0')
    // O denominador zerado não pode produzir `NaN%` nem `Infinity%`.
    expect(vazio.kpis.completionRate).toBe('0,0%')
    expect(vazio.kpis.unproductiveRate).toBe('0,0%')
    for (const texto of [vazio.kpis.completionRate, vazio.kpis.unproductiveRate]) {
      expect(texto).not.toMatch(/NaN|Infinity/)
    }
  })

  it('mantém a distribuição contextual de status coerente com o recorte vazio', () => {
    // O contexto ignora só o Status, então ele mostra as OS de Câmeras no
    // período, e não some junto com o recorte filtrado.
    const total = vazio.charts.statusPairs.reduce((sum, [, value]) => sum + value, 0)
    expect(total).toBe(298)
  })
})

describe('empate na contagem dos agregados novos', () => {
  // O desempate é lexicográfico simples sobre o rótulo, o mesmo critério dos
  // artefatos aprovados. Categorias já têm caso acima; cidades e tipos usam a
  // MESMA função e ficariam sem rede se ninguém prendesse a ordem aqui.
  const completo = build({ dateFrom: '2026-04-06', dateTo: '2026-08-21' })

  it('ordena cidades empatadas pelo rótulo, e não pela ordem de chegada', () => {
    const cidades = completo.charts.cityPairs
    const nomes = cidades.map(([nome]) => nome)

    const empatadasEm14 = cidades.filter(([, valor]) => valor === 14).map(([nome]) => nome)
    expect(empatadasEm14).toEqual(['Bragança Paulista', 'Nazaré Paulista'])

    const empatadasEm4 = cidades.filter(([, valor]) => valor === 4).map(([nome]) => nome)
    expect(empatadasEm4).toEqual(['Campinas', 'São Paulo'])

    expect(nomes.indexOf('Bragança Paulista')).toBeLessThan(nomes.indexOf('Nazaré Paulista'))
  })

  it('mantém a ordem decrescente em todas as coleções do recorte completo', () => {
    for (const colecao of [completo.charts.cityPairs, completo.charts.categoryTopPairs]) {
      for (let index = 1; index < colecao.length; index += 1) {
        expect(colecao[index][1]).toBeLessThanOrEqual(colecao[index - 1][1])
      }
    }

    const fatias = completo.charts.serviceTypeSlices
    for (let index = 1; index < fatias.length; index += 1) {
      expect(fatias[index].value).toBeLessThanOrEqual(fatias[index - 1].value)
    }
  })
})

describe('período de um único dia', () => {
  // Menor recorte possível da fonte. A janela anterior vira o dia anterior, e a
  // série diária precisa sobreviver com um ponto só.
  const dia = build({ dateFrom: '2026-08-21', dateTo: '2026-08-21' })

  it('compara com a véspera, de mesma duração', () => {
    expect(dia.kpis.total).toBe('74')
    expect(dia.previousPeriod?.range).toEqual({ dateFrom: '2026-08-20', dateTo: '2026-08-20' })
    expect(dia.previousPeriod?.coverage).toBe('complete')
    expect(dia.kpis.totalDelta.available).toBe(true)
  })

  it('publica a série diária com um ponto só, e ele é o dia do recorte', () => {
    const serie = dia.charts.overviewDay

    expect(serie.x).toEqual(['21/08'])
    expect(serie.total).toEqual([74])
    expect(serie.completed.length).toBe(1)
    expect(serie.unproductiveRate.length).toBe(1)
  })

  it('fecha os agregados no total do próprio dia', () => {
    expect(dia.charts.cityPairs.reduce((sum, [, valor]) => sum + valor, 0)).toBe(74)
    expect(
      dia.charts.serviceTypeSlices.reduce((sum, fatia) => sum + fatia.value, 0),
    ).toBe(74)
  })
})

describe('OS sem equipe atribuída', () => {
  // `team` é null quando a OS não tem executor. Essas OS entram no total e nos
  // agregados, mas não são alcançáveis por nenhuma opção do seletor Equipe, que
  // só publica valores presentes e não declara um "Sem equipe". Sem este teste,
  // uma mudança que as descartasse do total passaria sem ninguém notar.
  const todas = build()
  const equipes = ['Terceirizada', 'Câmeras', 'Suporte Técnico', 'Infra'] as const

  it('conta as OS sem equipe no total do recorte', () => {
    const somaDasEquipes = equipes.reduce(
      (sum, team) => sum + numero(build({ team }).kpis.total),
      0,
    )

    expect(numero(todas.kpis.total)).toBe(1248)
    expect(somaDasEquipes).toBe(1095)
    // A diferença são as OS sem executor: elas existem no recorte e nenhuma
    // seleção de Equipe as alcança.
    expect(numero(todas.kpis.total) - somaDasEquipes).toBe(153)
  })

  it('inclui as OS sem equipe nos agregados de cidade e de tipo', () => {
    expect(todas.charts.cityPairs.reduce((sum, [, valor]) => sum + valor, 0)).toBe(1248)
    expect(
      todas.charts.serviceTypeSlices.reduce((sum, fatia) => sum + fatia.value, 0),
    ).toBe(1248)
  })
})
