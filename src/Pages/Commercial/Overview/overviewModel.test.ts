import { describe, expect, it } from 'vitest'

import { getCommercialDataset } from '../../../data/mockCommercialData'
import {
  buildCommercialOverviewSnapshot,
  initialCommercialOverviewFilters,
  OVERVIEW_PIPELINE_STAGES,
} from './overviewModel'

const dataset = getCommercialDataset()

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
      expect(point.commercialValue + point.corporateValue).toBeCloseTo(point.monthlyValue, 6)
    })
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

describe('overviewModel: composição dos contratos em fluxo', () => {
  const base = initialCommercialOverviewFilters()
  const todos = buildCommercialOverviewSnapshot(dataset, base)
  const sum = (rows: readonly { count: number }[]) =>
    rows.reduce((total, row) => total + row.count, 0)

  it('entrega as quatro etapas na ordem do fluxo, com os rótulos do card', () => {
    expect(todos.pipelineStages.map((stage) => stage.id)).toEqual([
      'pendente',
      'assinada',
      'agendada',
      'aguardando-aprovacao',
    ])
    expect(todos.pipelineStages.map((stage) => stage.label)).toEqual([
      'Pendente',
      'Assinada',
      'Agendada',
      'Em aprovação',
    ])
    // A ordem exibida é a mesma da coleção oficial: não existe segunda lista.
    expect(todos.pipelineStages.map((stage) => stage.id)).toEqual(
      OVERVIEW_PIPELINE_STAGES.map((stage) => stage.id),
    )
  })

  it('fecha a soma das etapas no total de contratos em fluxo', () => {
    expect(todos.metrics.pipelineSales).toBe(162)
    expect(sum(todos.pipelineStages)).toBe(todos.metrics.pipelineSales)
    expect(todos.pipelineStages.map((stage) => stage.count)).toEqual([59, 47, 36, 20])
  })

  it('calcula a participação dentro do fluxo, e não sobre o total de contratos', () => {
    todos.pipelineStages.forEach((stage) => {
      expect(stage.share).toBeCloseTo(stage.count / todos.metrics.pipelineSales, 10)
    })

    const total = todos.pipelineStages.reduce((acc, stage) => acc + stage.share, 0)
    expect(total).toBeCloseTo(1, 10)
    // O denominador do card e o da barra são diferentes de propósito: o fluxo é
    // uma fração pequena do total de contratos do recorte.
    expect(todos.metrics.pipelineSales).toBeLessThan(todos.metrics.totalContracts)
  })

  it('conta somente os quatro status do fluxo', () => {
    const excluidos = todos.metrics.totalContracts - todos.metrics.pipelineSales

    // Ativadas, reprovadas, canceladas, expiradas, suspensas, bloqueios e não
    // sincronizadas ficam de fora: o que sobra do total nunca entra na soma.
    expect(excluidos).toBeGreaterThan(0)
    expect(sum(todos.pipelineStages)).toBe(todos.metrics.totalContracts - excluidos)
    expect(todos.pipelineStages).toHaveLength(4)
  })

  it('responde ao filtro de time', () => {
    const comercial = buildCommercialOverviewSnapshot(dataset, { ...base, team: 'comercial' })
    const corporativo = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      team: 'corporativo',
    })

    expect(sum(comercial.pipelineStages)).toBe(comercial.metrics.pipelineSales)
    expect(sum(corporativo.pipelineStages)).toBe(corporativo.metrics.pipelineSales)
    expect(comercial.metrics.pipelineSales + corporativo.metrics.pipelineSales).toBe(
      todos.metrics.pipelineSales,
    )
  })

  it('responde ao filtro de cidade', () => {
    const porCidade = dataset.cities.map((city) =>
      buildCommercialOverviewSnapshot(dataset, { ...base, cityId: city.id }),
    )

    porCidade.forEach((snapshot) => {
      expect(sum(snapshot.pipelineStages)).toBe(snapshot.metrics.pipelineSales)
      expect(snapshot.metrics.pipelineSales).toBeLessThanOrEqual(
        todos.metrics.pipelineSales,
      )
    })
    expect(
      porCidade.reduce((total, snapshot) => total + snapshot.metrics.pipelineSales, 0),
    ).toBe(todos.metrics.pipelineSales)
  })

  it('responde ao filtro de período', () => {
    const junho = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })

    expect(sum(junho.pipelineStages)).toBe(junho.metrics.pipelineSales)
    expect(junho.pipelineStages.map((stage) => stage.count)).not.toEqual(
      todos.pipelineStages.map((stage) => stage.count),
    )
  })

  it('mantém as quatro etapas visíveis quando alguma está zerada', () => {
    // Terra Preta tem um único contrato em fluxo, e ele está em Assinada.
    const snapshot = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      cityId: 'terra-preta',
    })

    expect(snapshot.pipelineStages).toHaveLength(4)
    expect(snapshot.pipelineStages.map((stage) => stage.count)).toEqual([0, 1, 0, 0])
    expect(snapshot.pipelineStages.map((stage) => stage.share)).toEqual([0, 1, 0, 0])
  })

  it('zera sem dividir por zero quando não existe contrato em fluxo', () => {
    const vazio = buildCommercialOverviewSnapshot(dataset, {
      ...base,
      cityId: 'terra-preta',
      team: 'comercial',
    })

    expect(vazio.metrics.pipelineSales).toBe(0)
    // O recorte ainda tem contratos: o que não existe é contrato EM FLUXO.
    expect(vazio.metrics.totalContracts).toBeGreaterThan(0)
    expect(vazio.pipelineStages).toHaveLength(4)
    vazio.pipelineStages.forEach((stage) => {
      expect(stage.count).toBe(0)
      expect(stage.share).toBe(0)
      expect(Number.isFinite(stage.share)).toBe(true)
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
