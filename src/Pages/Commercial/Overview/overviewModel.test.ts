import { describe, expect, it } from 'vitest'

import { daysInMonth, isoDateInMonth } from '../../../data/commercialCalendar'
import { todayISO } from '../../../data/defaultPeriod'
import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  awaitingStageOf,
  buildCommercialOverviewSnapshot,
  customerMixFront,
  initialCommercialOverviewFilters,
  initialCommercialOverviewFiltersFor,
  openingPeriodCorrection,
  OVERVIEW_AWAITING_STAGES,
  type CommercialOverviewSnapshot,
  type OverviewAwaitingActivation,
} from './overviewModel'

const dataset = getCommercialDataset()

describe('recorte de abertura da Visão Geral Comercial', () => {
  it('na base sintética, que termina em 31/07/2026, abre julho inteiro', () => {
    expect(initialCommercialOverviewFilters()).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      cityId: null,
      team: 'todos',
      sellerId: null,
      personType: 'todos',
    })
  })

  it('com o banco em dia, abre no dia 1 do mês corrente até hoje', () => {
    const hoje = todayISO()
    const abertura = initialCommercialOverviewFiltersFor({ start: '2020-01-01', end: '2099-12-31' })

    expect(abertura.startDate).toBe(`${hoje.slice(0, 7)}-01`)
    expect(abertura.endDate).toBe(hoje)
  })

  it('com a carga atrasada, o fim recua para a última data com dado', () => {
    const abertura = initialCommercialOverviewFiltersFor({ start: '2026-01-01', end: '2026-08-14' })

    expect(abertura).toMatchObject({ startDate: '2026-08-01', endDate: '2026-08-14' })
  })
})

describe('correção do período quando a cobertura do banco chega', () => {
  const abertura = initialCommercialOverviewFilters()

  it('troca o recorte da base sintética pelo da cobertura recebida', () => {
    const corrigido = openingPeriodCorrection(abertura, { start: '2026-01-01', end: '2026-09-11' })

    expect(corrigido).toEqual({ ...abertura, startDate: '2026-09-01', endDate: '2026-09-11' })
  })

  it('preserva cidade, time e vendedor já escolhidos', () => {
    const comRecorte = {
      ...abertura,
      cityId: 'atibaia' as const,
      team: 'corporativo' as const,
    }
    const corrigido = openingPeriodCorrection(comRecorte, { start: '2026-01-01', end: '2026-09-11' })

    expect(corrigido).toMatchObject({ cityId: 'atibaia', team: 'corporativo' })
  })

  it('não mexe em nada quando o período em uso já é o de abertura da cobertura', () => {
    const cobertura = { start: '2026-01-01', end: '2026-09-11' }
    const corrigido = openingPeriodCorrection(
      initialCommercialOverviewFiltersFor(cobertura),
      cobertura,
    )

    expect(corrigido).toBeNull()
  })
})

describe('overviewModel', () => {
  it('resume julho com as mesmas regras de vendas, Meta e Supermeta', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )

    expect(snapshot.periodLabel).toBe('01/07/2026 a 31/07/2026')
    expect(snapshot.metrics.activeSales).toBe(883)
    expect(snapshot.metrics.commercialSales).toBe(795)
    expect(snapshot.metrics.corporateSales).toBe(88)
    expect(snapshot.metrics.goal).toBe(800)
    expect(snapshot.metrics.superGoal).toBe(880)
    expect(snapshot.metrics.goalAchieved).toBe(795)
    expect(snapshot.metrics.superGoalAchieved).toBe(883)
    expect(snapshot.topSellers).toHaveLength(5)
    expect(snapshot.topPlans).toHaveLength(5)
    expect(snapshot.monthly).toHaveLength(7)
  })

  it('fecha cidade, time e origem no mesmo total de ativações', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )
    const sum = (rows: readonly { activeSales: number }[]) =>
      rows.reduce((total, row) => total + row.activeSales, 0)

    // Sem cidade e sem time selecionados, os conjuntos comparativos coincidem
    // com o recorte principal.
    expect(snapshot.cityComparisonTotal).toBe(snapshot.metrics.activeSales)
    expect(snapshot.teamComparisonTotal).toBe(snapshot.metrics.activeSales)
    expect(sum(snapshot.topCities)).toBe(snapshot.metrics.activeSales)
    expect(sum(snapshot.teams)).toBe(snapshot.metrics.activeSales)
    expect(sum(snapshot.origins)).toBe(snapshot.metrics.activeSales)
    expect(snapshot.origins.find((row) => row.id === 'indicacao')?.activeSales).toBe(
      snapshot.metrics.indicatedSales,
    )
    expect(snapshot.origins.find((row) => row.id === 'vendedores')?.activeSales).toBe(
      snapshot.metrics.sellerSales,
    )
  })

  describe('painéis comparativos', () => {
    const base = initialCommercialOverviewFilters()
    const todos = buildCommercialOverviewSnapshot(dataset, base)

    it('mantém o ranking completo de cidades quando uma cidade é selecionada', () => {
      const comCidade = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
      })

      expect(comCidade.topCities.length).toBeGreaterThan(1)
      expect(comCidade.topCities).toEqual(todos.topCities)
      expect(comCidade.cityComparisonTotal).toBe(todos.cityComparisonTotal)
      // O recorte principal continua reduzido à cidade escolhida.
      expect(comCidade.metrics.activeSales).toBeLessThan(comCidade.cityComparisonTotal)
    })

    it('aplica time e data ao ranking de cidades, ignorando apenas a cidade', () => {
      const comercial = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'comercial',
      })

      expect(comercial.cityComparisonTotal).toBe(todos.metrics.commercialSales)
      expect(comercial.cityComparisonTotal).toBeLessThan(todos.cityComparisonTotal)
      expect(comercial.topCities.map((row) => row.id)).toEqual(
        expect.arrayContaining(['atibaia']),
      )
      expect(
        comercial.topCities.reduce((total, row) => total + row.activeSales, 0),
      ).toBe(comercial.cityComparisonTotal)
    })

    it('mantém os dois times no comparativo quando um time é selecionado', () => {
      ;(['comercial', 'corporativo'] as const).forEach((team) => {
        const snapshot = buildCommercialOverviewSnapshot(dataset, { ...base, team })

        expect(snapshot.teams).toHaveLength(2)
        expect(snapshot.teams.map((row) => row.id).sort()).toEqual([
          'comercial',
          'corporativo',
        ])
        expect(snapshot.teams).toEqual(todos.teams)
        expect(snapshot.teamComparisonTotal).toBe(todos.teamComparisonTotal)
      })
    })

    it('aplica cidade e data ao comparativo de times, ignorando apenas o time', () => {
      const snapshot = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'corporativo',
      })
      const soCidade = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
      })

      expect(snapshot.teams).toEqual(soCidade.teams)
      expect(snapshot.teamComparisonTotal).toBe(soCidade.metrics.activeSales)
      expect(snapshot.teamComparisonTotal).toBeLessThan(todos.teamComparisonTotal)
    })

    it('não altera Origem das vendas quando apenas o filtro de time muda', () => {
      const comercial = buildCommercialOverviewSnapshot(dataset, { ...base, team: 'comercial' })
      const corporativo = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        team: 'corporativo',
      })

      expect(comercial.origins).toEqual(todos.origins)
      expect(corporativo.origins).toEqual(todos.origins)
    })

    it('aplica cidade e data a Origem das vendas', () => {
      const comCidade = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'comercial',
      })
      const soCidade = buildCommercialOverviewSnapshot(dataset, { ...base, cityId: 'atibaia' })

      expect(comCidade.origins).toEqual(soCidade.origins)
      expect(comCidade.origins).not.toEqual(todos.origins)
      expect(
        comCidade.origins.reduce((total, row) => total + row.activeSales, 0),
      ).toBe(comCidade.teamComparisonTotal)
    })

    it('calcula participação sobre o próprio conjunto comparativo', () => {
      const snapshot = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        cityId: 'atibaia',
        team: 'corporativo',
      })

      snapshot.topCities.forEach((row) => {
        expect(row.share).toBe(row.activeSales / snapshot.cityComparisonTotal)
      })
      snapshot.teams.forEach((row) => {
        expect(row.share).toBe(row.activeSales / snapshot.teamComparisonTotal)
      })
      snapshot.origins.forEach((row) => {
        expect(row.share).toBe(row.activeSales / snapshot.teamComparisonTotal)
      })
    })

    it('não quebra em um recorte sem nenhuma venda ativada', () => {
      const vazio = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        startDate: '2026-01-01',
        endDate: '2026-01-01',
        cityId: 'atibaia',
      })

      expect(Number.isFinite(vazio.cityComparisonTotal)).toBe(true)
      expect(Number.isFinite(vazio.teamComparisonTotal)).toBe(true)
      ;[...vazio.topCities, ...vazio.teams, ...vazio.origins].forEach((row) => {
        expect(Number.isFinite(row.share)).toBe(true)
        expect(row.share).toBeGreaterThanOrEqual(0)
      })
    })
  })

  it('deriva o valor mensal de cada time separadamente no histórico', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )

    snapshot.monthly.forEach((point) => {
      expect(point.commercialValue).toBeGreaterThan(0)
      expect(point.corporateValue).toBeGreaterThan(0)
      // Na base sintética todo vendedor tem time: a parcela sem time existe no
      // modelo, para o gráfico ser o mesmo da API, e vale zero.
      expect(point.unassignedSales).toBe(0)
      expect(point.unassignedValue).toBe(0)
      expect(
        point.commercialValue + point.corporateValue + point.unassignedValue,
      ).toBeCloseTo(point.monthlyValue, 6)
    })
  })

  it('não separa a venda herdada na base sintética, que segue a régua do contrato ativo hoje', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())

    // Quem mede a origem da venda é o serviço, sobre a data da venda no SGI.
    // Aqui o card diz só a régua da base sintética.
    expect(snapshot.activeSalesSoldEarlier).toBeNull()
  })

  it('monta a safra por mês vendido com as cinco parcelas fechando no vendido', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())
    const cohorts = snapshot.cohorts ?? []

    expect(cohorts.map((point) => point.month)).toEqual([...dataset.months])
    expect(cohorts.length).toBeGreaterThan(0)
    cohorts.forEach((point) => {
      expect(point.sold).toBeGreaterThan(0)
      expect(
        point.activatedInMonth +
          point.activatedLater +
          point.awaiting +
          point.cancelledBefore +
          point.other,
      ).toBe(point.sold)
      expect(point.label).toMatch(/^[A-Z][a-z]{2}\/\d{2}$/)
    })
    // O período da página não recorta a safra: um dia de julho dá o mesmo
    // painel de julho inteiro.
    const umDia = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      startDate: '2026-07-10',
      endDate: '2026-07-10',
    })
    expect(umDia.cohorts).toEqual(snapshot.cohorts)
  })

  it('a safra de um mês fecha com o card Aguardando Ativação daquele mês', () => {
    const junho = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })
    const safra = junho.cohorts?.find((point) => point.month === '2026-06')

    expect(safra).toBeDefined()
    expect(safra?.sold).toBe(junho.awaitingActivation?.sold)
    expect((safra?.awaiting ?? 0) + (safra?.cancelledBefore ?? 0)).toBe(
      junho.awaitingActivation?.awaiting,
    )
  })

  it('a safra segue cidade, time e vendedor como o card Aguardando Ativação', () => {
    const todos = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())
    const vendedor = todos.topSellers[0]?.sellerId ?? null
    const recorte = {
      ...initialCommercialOverviewFilters(),
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      cityId: 'atibaia' as const,
      team: 'comercial' as const,
      sellerId: vendedor,
    }
    const junho = buildCommercialOverviewSnapshot(dataset, recorte)
    const safra = junho.cohorts?.find((point) => point.month === '2026-06')
    const inteira = todos.cohorts?.find((point) => point.month === '2026-06')

    expect(vendedor).not.toBeNull()
    expect(safra?.sold).toBe(junho.awaitingActivation?.sold)
    expect((safra?.awaiting ?? 0) + (safra?.cancelledBefore ?? 0)).toBe(
      junho.awaitingActivation?.awaiting,
    )
    expect(safra?.sold ?? 0).toBeLessThan(inteira?.sold ?? 0)
  })

  it('zera o valor mensal do time ausente quando o filtro global restringe o time', () => {
    const comercial = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'comercial',
    })
    const corporativo = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    comercial.monthly.forEach((point) => {
      expect(point.corporateValue).toBe(0)
      expect(point.commercialValue).toBe(point.monthlyValue)
    })
    corporativo.monthly.forEach((point) => {
      expect(point.commercialValue).toBe(0)
      expect(point.corporateValue).toBe(point.monthlyValue)
    })
  })

  it('ordena Top 5 Planos por vendas ativadas e calcula participação', () => {
    const snapshot = buildCommercialOverviewSnapshot(
      dataset,
      initialCommercialOverviewFilters(),
    )

    snapshot.topPlans.forEach((plan, index) => {
      expect(plan.position).toBe(index + 1)
      expect(plan.share).toBe(plan.activeSales / snapshot.metrics.activeSales)
      if (index > 0) {
        expect(plan.activeSales).toBeLessThanOrEqual(snapshot.topPlans[index - 1].activeSales)
      }
    })
  })

  it('não inventa meta própria para o filtro exclusivo do Corporativo', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    expect(snapshot.metrics.goal).toBeNull()
    expect(snapshot.metrics.superGoal).toBeNull()
    expect(snapshot.topSellers.every((seller) => seller.team === 'corporativo')).toBe(true)
  })

  it('consolida o valor mensal dos dois times em Todos os times', () => {
    const todos = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())
    const comercial = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'comercial',
    })
    const corporativo = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    expect(todos.monthly).toHaveLength(7)
    todos.monthly.forEach((point, index) => {
      expect(point.commercialSales).toBe(comercial.monthly[index].commercialSales)
      expect(point.corporateSales).toBe(corporativo.monthly[index].corporateSales)
      expect(point.monthlyValue).toBeCloseTo(
        comercial.monthly[index].monthlyValue + corporativo.monthly[index].monthlyValue,
        6,
      )
    })
  })

  it('reduz o histórico mensal ao Comercial quando o time é Comercial', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'comercial',
    })

    expect(snapshot.monthly).toHaveLength(7)
    expect(snapshot.monthly.every((point) => point.corporateSales === 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.commercialSales > 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.monthlyValue > 0)).toBe(true)
  })

  it('reduz o histórico mensal ao Corporativo quando o time é Corporativo', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      team: 'corporativo',
    })

    expect(snapshot.monthly).toHaveLength(7)
    expect(snapshot.monthly.every((point) => point.commercialSales === 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.corporateSales > 0)).toBe(true)
    expect(snapshot.monthly.every((point) => point.monthlyValue > 0)).toBe(true)
  })

  it('mantém o histórico mensal restrito aos meses existentes na base', () => {
    const snapshot = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())

    expect(snapshot.monthly.map((point) => point.month)).toEqual(dataset.months)
    expect(snapshot.monthly[0].month).toBe('2026-01')
    expect(snapshot.monthly[snapshot.monthly.length - 1].month).toBe('2026-07')
  })

  it('aplica cidade ao recorte executivo e ao histórico mensal', () => {
    const todos = buildCommercialOverviewSnapshot(dataset, initialCommercialOverviewFilters())
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...initialCommercialOverviewFilters(),
      cityId: 'atibaia',
    })

    // Indicadores, rankings e histórico continuam restritos à cidade; apenas o
    // painel comparativo de cidades permanece completo.
    expect(snapshot.metrics.activeSales).toBeLessThan(todos.metrics.activeSales)
    expect(snapshot.monthly.every((point) => point.monthlyValue > 0)).toBe(true)
    expect(snapshot.monthly.every((point, index) =>
      point.monthlyValue < todos.monthly[index].monthlyValue,
    )).toBe(true)
  })
})

describe('overviewModel: realizados do período anterior', () => {
  const base = initialCommercialOverviewFilters()

  it('expõe o realizado comercial e o total do mês anterior fechado', () => {
    const julho = buildCommercialOverviewSnapshot(dataset, base)
    const junho = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })

    // O período anterior de julho fechado é junho fechado, a mesma janela que o
    // valor mensal já usava.
    expect(julho.previousGoalAchieved).toBe(junho.metrics.goalAchieved)
    expect(julho.previousSuperGoalAchieved).toBe(junho.metrics.superGoalAchieved)
  })

  it('usa o mesmo numerador de cada indicador', () => {
    const junho = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })

    expect(junho.metrics.goalAchieved).toBe(junho.metrics.commercialSales)
    expect(junho.metrics.superGoalAchieved).toBe(junho.metrics.activeSales)
  })

  it('devolve null quando não existe período anterior na base', () => {
    const janeiro = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(janeiro.previousGoalAchieved).toBeNull()
    expect(janeiro.previousSuperGoalAchieved).toBeNull()
    expect(janeiro.previousMonthlyValue).toBeNull()
  })

  it('acompanha cidade e time no período anterior', () => {
    const comercial = buildCommercialOverviewSnapshot(dataset, { ...base, team: 'comercial' })
    const todos = buildCommercialOverviewSnapshot(dataset, base)

    expect(comercial.previousGoalAchieved).toBe(todos.previousGoalAchieved)
    expect(comercial.previousSuperGoalAchieved).toBeLessThan(
      todos.previousSuperGoalAchieved as number,
    )
  })
})

describe('overviewModel: aguardando ativação', () => {
  const base = initialCommercialOverviewFilters()
  const todos = buildCommercialOverviewSnapshot(dataset, base)
  const sum = (rows: readonly { count: number }[]) =>
    rows.reduce((total, row) => total + row.count, 0)
  /** O card do recorte, que na base sintética sempre existe. */
  const awaitingOf = (snapshot: CommercialOverviewSnapshot): OverviewAwaitingActivation => {
    const card = snapshot.awaitingActivation
    if (card === null) throw new Error('a base sintética conta a venda pela data do contrato')
    return card
  }
  /** Vendas da base com a data da venda (o `createdAt` sintético) no intervalo. */
  const soldIn = (startDate: string, endDate: string) =>
    dataset.sales.filter((sale) => sale.createdAt >= startDate && sale.createdAt <= endDate)

  it('entrega as quatro etapas na ordem do card, com os rótulos aprovados', () => {
    const card = awaitingOf(todos)

    expect(card.stages.map((stage) => stage.id)).toEqual([
      'pendente',
      'assinada',
      'agendada',
      'cancelada',
    ])
    expect(card.stages.map((stage) => stage.label)).toEqual([
      'Pendente',
      'Assinada',
      'Agendada',
      'Cancelada',
    ])
    // A ordem exibida é a mesma da coleção oficial: não existe segunda lista.
    expect(card.stages.map((stage) => stage.id)).toEqual(
      OVERVIEW_AWAITING_STAGES.map((stage) => stage.id),
    )
    // A base sintética não liga ordem de serviço à venda: nem visita marcada
    // nem reagendamento medidos. Prazo não existe no card desde 17/09/2026,
    // em fonte nenhuma.
    expect(card.stages.map((stage) => stage.scheduledVisit)).toEqual([null, null, null, null])
    expect(card.stages.map((stage) => stage.needsReschedule)).toEqual([null, null, null, null])
    expect(card.stages.every((stage) => !('stalled' in stage))).toBe(true)
  })

  it('conta o vendido pela data da venda, que é outra régua da data do evento', () => {
    const card = awaitingOf(todos)

    expect(card.sold).toBe(soldIn(base.startDate, base.endDate).length)
    // Julho de 2026 na base sintética.
    expect({ sold: card.sold, awaiting: card.awaiting }).toEqual({ sold: 873, awaiting: 164 })
    // Régua própria: o total por data do evento dos outros cards é outro número.
    expect(card.sold).not.toBe(todos.metrics.totalContracts)
  })

  it('fecha a soma das etapas no total que aguarda, dentro do vendido', () => {
    const card = awaitingOf(todos)

    expect(sum(card.stages)).toBe(card.awaiting)
    expect(card.awaiting).toBeGreaterThan(0)
    expect(card.awaiting).toBeLessThanOrEqual(card.sold)
  })

  it('calcula a participação dentro do que aguarda, e não sobre o vendido', () => {
    const card = awaitingOf(todos)

    card.stages.forEach((stage) => {
      expect(stage.share).toBeCloseTo(stage.count / card.awaiting, 10)
    })
    expect(card.stages.reduce((acc, stage) => acc + stage.share, 0)).toBeCloseTo(1, 10)
  })

  it('classifica cada venda do recorte pela regra das etapas', () => {
    const card = awaitingOf(todos)
    const vendidas = soldIn(base.startDate, base.endDate)
    const esperado = new Map<string, number>()
    vendidas.forEach((sale) => {
      const stage = awaitingStageOf(sale.status, sale.activatedAt)
      if (stage !== null) esperado.set(stage, (esperado.get(stage) ?? 0) + 1)
    })

    expect(card.stages.map((stage) => stage.count)).toEqual(
      card.stages.map((stage) => esperado.get(stage.id) ?? 0),
    )
    // A base sintética tem contrato cancelado sem ativação e contrato aguardando
    // aprovação: um enche o quarto quadrado, o outro soma em Pendente.
    expect(card.stages[3].count).toBeGreaterThan(0)
    expect(card.stages[0].count).toBeGreaterThan(
      vendidas.filter((sale) => sale.status === 'pendente').length,
    )
  })

  it('responde ao filtro de time', () => {
    const card = awaitingOf(todos)
    const comercial = awaitingOf(
      buildCommercialOverviewSnapshot(dataset, { ...base, team: 'comercial' }),
    )
    const corporativo = awaitingOf(
      buildCommercialOverviewSnapshot(dataset, { ...base, team: 'corporativo' }),
    )

    expect(sum(comercial.stages)).toBe(comercial.awaiting)
    expect(sum(corporativo.stages)).toBe(corporativo.awaiting)
    expect(comercial.sold + corporativo.sold).toBe(card.sold)
    expect(comercial.awaiting + corporativo.awaiting).toBe(card.awaiting)
  })

  it('responde ao filtro de cidade', () => {
    const card = awaitingOf(todos)
    const porCidade = dataset.cities.map((city) =>
      awaitingOf(buildCommercialOverviewSnapshot(dataset, { ...base, cityId: city.id })),
    )

    porCidade.forEach((recorte) => {
      expect(sum(recorte.stages)).toBe(recorte.awaiting)
      expect(recorte.sold).toBeLessThanOrEqual(card.sold)
    })
    expect(porCidade.reduce((total, recorte) => total + recorte.sold, 0)).toBe(card.sold)
    expect(porCidade.reduce((total, recorte) => total + recorte.awaiting, 0)).toBe(
      card.awaiting,
    )
  })

  it('responde ao filtro de período', () => {
    const junho = awaitingOf(
      buildCommercialOverviewSnapshot(dataset, {
        ...base,
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }),
    )

    expect(junho.sold).toBe(soldIn('2026-06-01', '2026-06-30').length)
    expect(sum(junho.stages)).toBe(junho.awaiting)
    expect(junho.sold).not.toBe(awaitingOf(todos).sold)
  })

  it('mantém a etapa zerada visível em recorte de um dia com dado', () => {
    // 15/07/2026 na base sintética: nenhum agendado entre os que aguardam.
    const dia = awaitingOf(
      buildCommercialOverviewSnapshot(dataset, {
        ...base,
        startDate: '2026-07-15',
        endDate: '2026-07-15',
      }),
    )

    expect(dia.sold).toBe(32)
    expect(dia.awaiting).toBe(8)
    expect(dia.stages.map((stage) => stage.count)).toEqual([4, 3, 0, 1])
    expect(dia.stages.map((stage) => stage.share)).toEqual([0.5, 0.375, 0, 0.125])
  })

  it('com vendedor selecionado, conta só a venda própria dele, sem indicação', () => {
    const vendidas = soldIn(base.startDate, base.endDate)
    // Um vendedor que registrou venda indicada no mês, para a regra pesar.
    const vendedor = dataset.sellers.find((seller) =>
      vendidas.some((sale) => sale.creatorId === seller.id && sale.indicationCode !== null),
    )
    if (vendedor === undefined) throw new Error('a base sintética tem venda indicada em julho')
    const registradas = vendidas.filter((sale) => sale.creatorId === vendedor.id)
    const proprias = registradas.filter((sale) => sale.indicationCode === null)

    const card = awaitingOf(
      buildCommercialOverviewSnapshot(dataset, { ...base, sellerId: vendedor.id }),
    )

    expect(card.sold).toBe(proprias.length)
    expect(card.sold).toBeLessThan(registradas.length)
    expect(card.awaiting).toBe(
      proprias.filter((sale) => awaitingStageOf(sale.status, sale.activatedAt) !== null).length,
    )
  })

  it('fecha a soma dos sete meses com a base inteira: a cobertura não perde venda', () => {
    const meses = dataset.months.map((month) =>
      awaitingOf(
        buildCommercialOverviewSnapshot(dataset, {
          ...base,
          startDate: isoDateInMonth(month, 1),
          endDate: isoDateInMonth(month, daysInMonth(month)),
        }),
      ),
    )

    expect(meses.reduce((total, mes) => total + mes.sold, 0)).toBe(dataset.sales.length)
    expect(meses.reduce((total, mes) => total + mes.awaiting, 0)).toBe(
      dataset.sales.filter((sale) => awaitingStageOf(sale.status, sale.activatedAt) !== null)
        .length,
    )
  })

  it('mantém as quatro etapas e zera sem dividir por zero no recorte sem venda', () => {
    const vazio = awaitingOf(
      buildCommercialOverviewSnapshot(dataset, {
        ...base,
        sellerId: 'vendedor-que-não-existe',
      }),
    )

    expect(vazio.sold).toBe(0)
    expect(vazio.awaiting).toBe(0)
    expect(vazio.stages).toHaveLength(4)
    vazio.stages.forEach((stage) => {
      expect(stage.count).toBe(0)
      expect(stage.share).toBe(0)
      expect(Number.isFinite(stage.share)).toBe(true)
    })
  })

  describe('regra das etapas', () => {
    it('soma Aguardando aprovação em Pendente e só conta a cancelada que nunca ativou', () => {
      expect(awaitingStageOf('pendente', null)).toBe('pendente')
      expect(awaitingStageOf('aguardando-aprovacao', null)).toBe('pendente')
      expect(awaitingStageOf('assinada', null)).toBe('assinada')
      expect(awaitingStageOf('agendada', null)).toBe('agendada')
      expect(awaitingStageOf('cancelada', null)).toBe('cancelada')
      // Cancelou depois do sinal ligado: é saída da base, não venda que não
      // aconteceu, e fica para a página de clientes.
      expect(awaitingStageOf('cancelada', '2026-07-10')).toBeNull()
    })

    it('deixa de fora quem ativou e o que nunca chegou a aguardar', () => {
      for (const status of [
        'ativa',
        'suspensa',
        'bloqueio-financeiro',
        'bloqueio-administrativo',
      ] as const) {
        expect(awaitingStageOf(status, '2026-07-10')).toBeNull()
      }
      for (const status of ['reprovada', 'expirada', 'nao-sincronizada'] as const) {
        expect(awaitingStageOf(status, null)).toBeNull()
      }
    })
  })

  /**
   * Novos Clientes.
   *
   * A base sintética dá um CPF diferente a cada venda, então ela não tem como
   * saber quem já era cliente: toda venda pareceria de cliente novo e a página
   * mostraria 100% de crescimento de base para sempre. O teste guarda a
   * decisão de devolver ausência em vez de um número que o dado não sustenta.
   */
  describe('composição de clientes', () => {
    it('não inventa cliente novo a partir da base sintética', () => {
      expect(todos.customerMix).toBeNull()
    })

    it('continua ausente em qualquer recorte, e não só no padrão', () => {
      const junho = buildCommercialOverviewSnapshot(dataset, {
        ...base,
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        cityId: 'atibaia',
        team: 'comercial',
      })

      expect(junho.metrics.activeSales).toBeGreaterThan(0)
      expect(junho.customerMix).toBeNull()
    })

    /**
     * Composição da frente do card, acrescentada em 17/09/2026.
     *
     * O que o teste guarda: cliente novo vira a barra, porque ele já é o
     * número em destaque, as outras duas viram blocos na mesma ordem da frase
     * da leitura gerencial, e as três participações usam as vendas ativadas
     * como denominador, de modo a somarem o período inteiro.
     */
    it('mede as três parcelas contra as vendas ativadas do recorte', () => {
      const frente = customerMixFront(
        { newCustomers: 293, expansion: 44, returning: 23, changeRate: -0.042 },
        360,
      )

      expect(frente.parts.map((parte) => [parte.label, parte.count])).toEqual([
        ['Clientes da base', 44],
        ['Retornaram', 23],
      ])
      expect(frente.parts.map((parte) => parte.accessibleLabel)).toEqual([
        'Clientes da base com outro contrato ativo',
        'Retornaram depois de cancelar',
      ])

      const total = frente.parts.reduce((soma, parte) => soma + parte.share, frente.share)

      expect(frente.share).toBeCloseTo(293 / 360, 12)
      expect(total).toBeCloseTo(1, 12)
    })

    it('mostra parcela zerada em vez de esconder o bloco', () => {
      const frente = customerMixFront(
        { newCustomers: 10, expansion: 0, returning: 0, changeRate: null },
        10,
      )

      // Zero é resultado do período, não ausência de dado: some com o bloco e
      // o gestor deixa de saber se ninguém retornou ou se o card quebrou.
      expect(frente.parts).toHaveLength(2)
      expect(frente.parts.every((parte) => parte.count === 0)).toBe(true)
    })

    it('não divide por zero em recorte sem venda ativada', () => {
      const frente = customerMixFront(
        { newCustomers: 0, expansion: 0, returning: 0, changeRate: null },
        0,
      )

      expect(frente.share).toBe(0)
      expect(frente.parts.every((parte) => parte.share === 0)).toBe(true)
    })
  })

  /**
   * Tempo até a ativação.
   *
   * Mesma situação de Novos Clientes, por outro motivo: a base sintética guarda
   * a data do evento e a da ativação, e nunca a data em que o contrato foi
   * fechado. Sem as duas pontas não existe espera para medir, e zero dia seria
   * a afirmação de que a ativação é imediata.
   */
  describe('tempo até a ativação', () => {
    it('não mede a espera a partir da base sintética', () => {
      expect(todos.activationDays).toBeNull()
      expect(todos.previousActivationDaysMedian).toBeNull()
    })
  })

  it('não expõe série temporal nenhuma no recorte', () => {
    // Duas razões, e a primeira é do DADO: o dataset guarda o status atual dos
    // contratos, nunca o histórico das mudanças, então uma série por data
    // sugeriria uma evolução de estoque que o dado não comprova.
    //
    // A segunda é da TELA: os minigráficos saíram dos cards, e uma série que
    // ninguém desenha é cálculo rodando a cada filtro sem chegar a lugar nenhum.
    expect('sparklines' in todos).toBe(false)
  })
})

/**
 * Filtro Vendedor da Visão Geral.
 *
 * O vendedor é um filtro global, como período, cidade e time: ele vale para os
 * cards e para todos os painéis. A exceção é o próprio Top 5 Vendedores, que o
 * ignora para continuar sendo uma comparação, no mesmo padrão dos painéis de
 * cidade e de time.
 */
describe('overviewModel: filtro por vendedor', () => {
  const filtros = initialCommercialOverviewFilters()
  const todos = buildCommercialOverviewSnapshot(dataset, filtros)
  const primeiro = todos.topSellers[0]
  const umVendedor = buildCommercialOverviewSnapshot(dataset, {
    ...filtros,
    sellerId: primeiro.sellerId,
  })

  it('nasce sem vendedor selecionado, ou seja, com todos', () => {
    expect(filtros.sellerId).toBeNull()
  })

  it('reduz as vendas ativadas às do vendedor selecionado', () => {
    expect(umVendedor.metrics.activeSales).toBe(primeiro.activeSales)
    expect(umVendedor.metrics.activeSales).toBeLessThan(todos.metrics.activeSales)
    expect(umVendedor.metrics.activeSales).toBeGreaterThan(0)
  })

  it('aplica o vendedor também aos painéis comparativos de cidade e de time', () => {
    const somaCidades = umVendedor.topCities.reduce((total, row) => total + row.activeSales, 0)
    const somaTimes = umVendedor.teams.reduce((total, row) => total + row.activeSales, 0)

    // Os dois painéis ignoram apenas o próprio filtro: com um vendedor
    // selecionado, eles mostram a distribuição das vendas DELE.
    expect(somaCidades).toBe(umVendedor.metrics.activeSales)
    expect(somaTimes).toBe(umVendedor.metrics.activeSales)
    expect(somaCidades).toBeLessThan(todos.metrics.activeSales)
  })

  it('mantém o Top 5 Vendedores inteiro, para a comparação não virar um número solto', () => {
    // O ranking ignora o filtro Vendedor: a tela destaca a linha do
    // selecionado, e a posição dele continua significando alguma coisa.
    expect(umVendedor.topSellers).toEqual(todos.topSellers)
    expect(umVendedor.topSellers.length).toBeGreaterThan(1)
  })

  it('não muda nada quando nenhum vendedor está selecionado', () => {
    expect(buildCommercialOverviewSnapshot(dataset, { ...filtros, sellerId: null })).toEqual(todos)
  })

  it('devolve recorte vazio, e não a base inteira, para vendedor sem venda no período', () => {
    const semVenda = buildCommercialOverviewSnapshot(dataset, {
      ...filtros,
      sellerId: 'vendedor-que-não-existe',
    })

    expect(semVenda.metrics.activeSales).toBe(0)
    expect(semVenda.metrics.totalContracts).toBe(0)
    expect(semVenda.topCities).toEqual([])
  })
})

/**
 * Meta com um vendedor selecionado.
 *
 * O card Meta Comercial compara realizado com meta. Se o realizado encolhe
 * para um vendedor e a meta continua sendo a do time inteiro, quem bateu a
 * própria meta aparece com atingimento de um dígito. A meta acompanha a mesma
 * seleção, e é a meta individual do vendedor no recorte.
 */
describe('overviewModel: meta acompanha o filtro de vendedor', () => {
  const filtros = initialCommercialOverviewFilters()
  const todos = buildCommercialOverviewSnapshot(dataset, filtros)
  const primeiro = todos.topSellers[0]
  const umVendedor = buildCommercialOverviewSnapshot(dataset, {
    ...filtros,
    sellerId: primeiro.sellerId,
  })

  it('reduz a meta junto com o realizado', () => {
    expect(todos.metrics.goal).toBe(800)
    // Meta individual do vendedor no mês inteiro, e não a do time.
    expect(umVendedor.metrics.goal).toBe(50)
    expect(umVendedor.metrics.superGoal).toBe(55)
  })

  it('mantém a comparação em uma escala que se pode ler', () => {
    const atingimento = umVendedor.metrics.goalAchieved / (umVendedor.metrics.goal ?? 1)

    // Com a meta do time inteiro, o melhor vendedor do período apareceria com
    // menos de 10% de atingimento.
    expect(atingimento).toBeGreaterThan(0.5)
    expect(umVendedor.metrics.goalAchieved).toBeLessThanOrEqual(umVendedor.metrics.activeSales)
  })

  it('não muda a meta quando nenhum vendedor está selecionado', () => {
    expect(buildCommercialOverviewSnapshot(dataset, filtros).metrics.goal).toBe(
      todos.metrics.goal,
    )
  })
})

/**
 * Venda com indicador é da indicação, não do vendedor.
 *
 * Regra de negócio do Mário. Ela vale nos dois lugares onde a página fala de
 * vendedor: no ranking Top 5 e no filtro Vendedor. Antes o ranking somava
 * também as vendas indicadas, e o mesmo vendedor aparecia com um número no
 * ranking e outro no card ao ser filtrado.
 */
describe('overviewModel: indicação não conta para o vendedor', () => {
  const filtros = initialCommercialOverviewFilters()
  const snapshot = buildCommercialOverviewSnapshot(dataset, filtros)

  it('conta no ranking somente a venda própria do vendedor', () => {
    // Julho: 883 ativações, das quais 819 sem indicador. O primeiro colocado
    // tinha 60 vendas somando as indicadas e fica com 56 próprias.
    expect(snapshot.metrics.activeSales).toBe(883)
    expect(snapshot.metrics.sellerSales).toBe(819)
    expect(snapshot.topSellers[0].activeSales).toBe(56)
    for (const seller of snapshot.topSellers) {
      expect(seller.activeSales).toBeLessThanOrEqual(snapshot.metrics.sellerSales)
    }
  })

  it('usa o total de vendas próprias como denominador da participação', () => {
    const primeiro = snapshot.topSellers[0]

    // Mesmo conjunto do painel Origem das vendas: ranking e origem falam da
    // mesma coisa, então as participações são comparáveis entre os dois.
    expect(primeiro.share).toBeCloseTo(primeiro.activeSales / snapshot.metrics.sellerSales, 12)
  })

  it('dá ao card o mesmo número que o ranking mostra para o vendedor', () => {
    const primeiro = snapshot.topSellers[0]
    const filtrado = buildCommercialOverviewSnapshot(dataset, {
      ...filtros,
      sellerId: primeiro.sellerId,
    })

    expect(filtrado.metrics.activeSales).toBe(primeiro.activeSales)
    // Nenhuma venda indicada sobrou no recorte de um vendedor.
    expect(filtrado.metrics.indicatedSales).toBe(0)
    expect(filtrado.metrics.sellerSales).toBe(filtrado.metrics.activeSales)
  })
})
