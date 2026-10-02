import { describe, expect, it } from 'vitest'

import { OVERVIEW_PREVIOUS_INCOMPLETE_LABEL } from '../../data/overviewOsAggregates'
import { defaultOverviewOsFilters } from '../../data/overviewOsFilters'
import { handFacts, periodScenario, totals } from './osPeriodFixture.testing'
import { KNOWN_STATUS_KEYS, osStatusKind } from './osStatusKind'
import {
  buildOverviewKpis,
  buildOverviewReadings,
  OS_GROUPS,
  OS_OUTCOMES,
  periodTitle,
  RATE_NO_OS,
  RATE_NOT_APPLICABLE,
  type OverviewOsPeriodFacts,
} from './overviewModel'

/**
 * Teste espelho do modelo da Visão Geral.
 *
 * Desde 01/10/2026 as contas do período são do serviço de BI, e este teste
 * cobre o que a página ESCREVE com os números que ele manda: os cards, a
 * comparação e a leitura gerencial. Os números da base local (01/08 a
 * 21/08/2026: 1.248 OS, das quais 135 de infraestrutura) vêm de respostas
 * reais do serviço (`osPeriodFixture.json`); os casos que a base não tem são
 * montados à mão. As regras que produzem os números (saída, grupo, base das
 * taxas, janela de comparação, motivo mais frequente) são testadas no
 * serviço, em `tests/test_bi_os_period.py`.
 */

describe('situação pela chave de status do SGI', () => {
  it('classifica cada chave conhecida, e o resto como sem classificação', () => {
    expect(osStatusKind('completed')).toBe('completed')
    expect(osStatusKind('unproductive')).toBe('unproductive')
    for (const key of ['closed', 'expired', 'cancelled', 'canceled']) {
      expect(osStatusKind(key)).toBe('not-executed')
    }
    for (const key of ['pending', 'scheduled', 'rescheduled']) {
      expect(osStatusKind(key)).toBe('to-do')
    }
    for (const key of ['in_motion', 'arrived', 'in_progress', 'checklist', 'pending_approval', 'provision']) {
      expect(osStatusKind(key)).toBe('in-field')
    }
    expect(osStatusKind(null)).toBe('unknown')
    expect(osStatusKind('waiting_parts')).toBe('unknown')
  })

  it('conhece as chaves que o serviço traduz hoje', () => {
    // As quinze do catálogo do SGI mais as variantes que o de-para do serviço
    // aceita (`canceled`, `provisioning`, subestados de Em Andamento).
    for (const key of [
      'pending', 'scheduled', 'rescheduled', 'in_motion', 'arrived', 'checklist',
      'products_used', 'resolution', 'completed', 'closed', 'unproductive',
      'expired', 'provision', 'pending_approval', 'cancelled',
    ]) {
      expect(KNOWN_STATUS_KEYS).toContain(key)
    }
  })

  it('as saídas e os grupos têm a ordem e os nomes da página', () => {
    expect(OS_OUTCOMES.map((outcome) => outcome.key)).toEqual([
      'completed', 'unproductive', 'notExecuted', 'open', 'unknown',
    ])
    expect(OS_GROUPS.map((group) => group.label)).toEqual(['OS de cliente', 'Infraestrutura'])
  })
})

describe('indicadores da Visão Geral sobre a base local', () => {
  const { facts, filters } = periodScenario('padrao')
  const kpis = buildOverviewKpis(facts, filters)

  it('Total e Concluídas contam todas as OS, com a divisão por grupo no detalhe', () => {
    expect(kpis.total).toBe('1.248')
    expect(kpis.completed).toBe('959')
    // Cada grupo abre nas cinco saídas, e o total é a soma delas: é o que a
    // leitura gerencial escreve ("177 não concluíram: 131 improdutivas, 46
    // não executadas").
    expect(kpis.totals.customer).toEqual({
      total: 1113, completed: 936, unproductive: 131, notExecuted: 46, open: 0, unknown: 0,
    })
    expect(kpis.totals.infrastructure).toEqual({
      total: 135, completed: 23, unproductive: 3, notExecuted: 108, open: 1, unknown: 0,
    })
    expect(kpis.details.total).toBe('1.113 de cliente · 135 de infraestrutura')
    expect(kpis.details.completed).toBe('936 de cliente · 23 de infraestrutura')
  })

  it('calcula as duas taxas só sobre as OS de cliente', () => {
    expect(kpis.rateBase).toBe('customer')
    // 936 de 1.113, contra 76,8% se a infraestrutura entrasse (959 de 1.248):
    // a diferença é ela, com 104 das 135 OS expiradas no recorte.
    expect(kpis.completionRate).toBe('84,1%')
    expect(kpis.unproductiveRate).toBe('11,8%')
    expect(kpis.details.completionRate).toBe('936 de 1.113 OS de cliente')
    expect(kpis.details.unproductiveRate).toBe('131 de 1.113 OS de cliente')
  })

  it('compara com a janela anterior: volume em percentual, taxas em pontos pela base de cliente', () => {
    expect(kpis.totalDelta.text).toBe('+19,4%')

    // A janela anterior é o mês anterior até o mesmo dia, 01/07 a 21/07
    // (regra de 22/09/2026). Sobre OS de cliente a conclusão SUBIU (84,1%
    // contra 81,0%); com a infraestrutura junto ela mostrava queda de 4,9%,
    // porque a janela atual tem mais infraestrutura expirada do que a
    // anterior.
    expect(kpis.completionDelta).toMatchObject({ text: '+3,1 p.p.', positive: true, available: true })
    expect(kpis.unproductiveDelta).toMatchObject({ text: '-1,4 p.p.', positive: true, available: true })
  })

  it('sem OS de cliente no recorte, as taxas valem para o que está na tela e o detalhe diz isso', () => {
    const scenario = periodScenario('so-infraestrutura')
    const infra = buildOverviewKpis(scenario.facts, scenario.filters)

    expect(infra.rateBase).toBe('infrastructure')
    expect(infra.totals.customer.total).toBe(0)
    expect(infra.completionRate).toBe('17,0%')
    expect(infra.details.completionRate).toBe('23 de 135 OS de infraestrutura')
    expect(infra.details.unproductiveRate).toBe('3 de 135 OS de infraestrutura')
  })

  it('com a base na infraestrutura (frente da equipe filtrada), a taxa e a leitura são dela', () => {
    // Retrato da equipe Infra em setembro/2026: quase tudo de infraestrutura
    // e algumas OS de cliente. O serviço decide a base; a página escreve.
    const teamFacts = handFacts({
      totals: totals({ completed: 1, unproductive: 1 }, { completed: 8, notExecuted: 1 }),
      rateBase: 'infrastructure',
      withoutUnassigned: true,
    })
    const team = buildOverviewKpis(teamFacts, { ...defaultOverviewOsFilters, team: ['Infra'] })

    expect(team.completionRate).toBe('88,9%')
    expect(team.unproductiveRate).toBe('0,0%')
    expect(team.details.completionRate).toBe('8 de 9 OS de infraestrutura, sem as OS sem técnico')
    const readings = buildOverviewReadings(teamFacts, team, { dateTo: '2026-08-01' }, '2026-09-23')
    expect(readings.completed.text).toContain('Equipe ou técnico de infraestrutura')
    expect(readings.completed.text).toContain('as {2 OS de cliente} ficam fora')

    // As MESMAS OS com a base no cliente (cidade não tem frente).
    const city = buildOverviewKpis({ ...teamFacts, rateBase: 'customer', withoutUnassigned: false }, defaultOverviewOsFilters)
    expect(city.completionRate).toBe('50,0%')
    expect(city.details.completionRate).toBe('1 de 2 OS de cliente')
  })

  it('com Status filtrado as taxas não se aplicam, e Total e Concluídas seguem filtrados', () => {
    const scenario = periodScenario('status-concluida')
    const filtered = buildOverviewKpis(scenario.facts, scenario.filters)

    expect(filtered.rateState).toBe('status')
    expect(filtered.total).toBe('959')
    expect(filtered.completed).toBe('959')
    expect(filtered.completionRate).toBe(RATE_NOT_APPLICABLE)
    expect(filtered.unproductiveRate).toBe(RATE_NOT_APPLICABLE)
    expect(filtered.details.completionRate).toBe('Com um status só, a taxa seria 0% ou 100%')
    for (const delta of [filtered.completionDelta, filtered.unproductiveDelta]) {
      expect(delta.available).toBe(false)
      expect(delta.unavailableLabel).toBe('Com Status filtrado')
    }
    // O volume continua comparando.
    expect(filtered.totalDelta.available).toBe(true)

    const readings = buildOverviewReadings(scenario.facts, filtered, scenario.filters, '2026-09-23')
    expect(readings.completionRate.title).toBe('A taxa não se aplica com o filtro de Status.')
    expect(readings.unproductiveRate.title).toBe('A taxa não se aplica com o filtro de Status.')
    // Total e Concluídas mantêm a contagem no título, e o texto não narra o
    // recorte como a operação inteira ("23 de 23" da infraestrutura).
    expect(readings.completed.title).toBe('959 OS entregues, 50,5 por dia com agenda.')
    for (const reading of [readings.total, readings.completed]) {
      expect(reading.text).toContain('Tire o filtro para ler o período.')
      expect(reading.text).not.toContain('23 de 23')
      expect(reading.text).not.toContain('não houve improdutiva')
    }
  })

  it('com vários status marcados as taxas também não se aplicam, e o detalhe diz por quê', () => {
    const scenario = periodScenario('dois-status')
    const filtered = buildOverviewKpis(scenario.facts, scenario.filters)

    expect(filtered.rateState).toBe('status')
    expect(filtered.total).toBe('1.093')
    expect(filtered.completionRate).toBe(RATE_NOT_APPLICABLE)
    expect(filtered.unproductiveRate).toBe(RATE_NOT_APPLICABLE)
    expect(filtered.details.completionRate).toBe('Com Status filtrado, a taxa perde parte da base')
    expect(filtered.completionDelta.available).toBe(false)
  })

  it('com Equipe ou Técnico filtrado o detalhe avisa que as OS sem técnico ficam fora', () => {
    const base = handFacts({ totals: totals({ completed: 3, unproductive: 1 }, { completed: 9, notExecuted: 3 }) })

    const infra = buildOverviewKpis({ ...base, rateBase: 'infrastructure', withoutUnassigned: true }, defaultOverviewOsFilters)
    expect(infra.details.completionRate).toBe('9 de 12 OS de infraestrutura, sem as OS sem técnico')
    expect(infra.details.unproductiveRate).toMatch(/, sem as OS sem técnico$/)

    const customer = buildOverviewKpis({ ...base, withoutUnassigned: true }, defaultOverviewOsFilters)
    expect(customer.details.completionRate).toBe('3 de 4 OS de cliente, sem as OS sem técnico')

    // Sem equipe nem técnico filtrado (ou com "Sem equipe" marcada, onde
    // elas estão), o serviço diz que nada ficou de fora, e o aviso some.
    const none = buildOverviewKpis(base, defaultOverviewOsFilters)
    expect(none.details.completionRate).not.toContain('sem técnico')
  })

  it('período anterior fora da cobertura deixa as quatro comparações indisponíveis com o motivo', () => {
    const scenario = periodScenario('anterior-incompleto')
    const incomplete = buildOverviewKpis(scenario.facts, scenario.filters)

    for (const delta of [incomplete.totalDelta, incomplete.completedDelta, incomplete.completionDelta, incomplete.unproductiveDelta]) {
      expect(delta.available).toBe(false)
      expect(delta.unavailableLabel).toBe(OVERVIEW_PREVIOUS_INCOMPLETE_LABEL)
    }
  })

  it('recorte vazio não inventa taxa nem divide por zero', () => {
    const scenario = periodScenario('vazio')
    const empty = buildOverviewKpis(scenario.facts, scenario.filters)

    expect(empty.total).toBe('0')
    // "0,0%" em letra grande se lia como resultado péssimo: é falta de OS.
    expect(empty.rateState).toBe('empty')
    expect(empty.completionRate).toBe(RATE_NO_OS)
    expect(empty.unproductiveRate).toBe(RATE_NO_OS)
    expect(empty.details.completionRate).toBe('Sem OS no recorte')
    expect(empty.totalDelta.available).toBe(false)
    expect(empty.completionDelta.available).toBe(false)
    expect(empty.completionDelta.unavailableLabel).toBe('Sem comparação')

    // Dia sem OS com a semana anterior cheia: a taxa não compara com nada.
    const sunday = buildOverviewKpis(
      handFacts({
        previous: {
          range: { dateFrom: '2026-08-02', dateTo: '2026-08-02' },
          kind: 'day',
          coverage: 'complete',
          totals: totals({ completed: 1 }),
        },
      }),
      { ...defaultOverviewOsFilters, dateFrom: '2026-08-09', dateTo: '2026-08-09' },
    )
    expect(sunday.completionRate).toBe(RATE_NO_OS)
    expect(sunday.completionDelta.available).toBe(false)
  })
})

describe('destino das OS sobre a base local', () => {
  it('fecha com os totais dos cards e não deixa status sem classificação', () => {
    const { facts, filters } = periodScenario('padrao')
    const kpis = buildOverviewKpis(facts, filters)
    const outcome = facts.outcome

    expect(outcome.reduce((sum, group) => sum + group.total, 0)).toBe(1248)
    expect(outcome[0].counts.completed + outcome[1].counts.completed).toBe(959)
    expect(outcome[0].total).toBe(kpis.totals.customer.total)
    expect(outcome[1].total).toBe(kpis.totals.infrastructure.total)
    // Expirada e Encerrada da base local caem em "não executada", nunca em
    // "sem classificação".
    expect(outcome[1].counts.notExecuted).toBe(108)
    expect(outcome[0].counts.unknown + outcome[1].counts.unknown).toBe(0)
  })
})

/**
 * As duas taxas comparam em PONTOS, e o volume em percentual (23/09/2026):
 * 11,8% contra 11,0% é uma queda de 0,8 ponto, e não de 6,4%.
 */
describe('comparação das taxas em pontos', () => {
  /** Um mês com `total` OS de cliente, das quais `bad` improdutivas, contra julho. */
  function monthAgainstJuly(total: number, bad: number, previousTotal: number, previousBad: number) {
    return buildOverviewKpis(
      handFacts({
        totals: totals({ completed: total - bad, unproductive: bad }),
        previous: {
          range: { dateFrom: '2026-07-01', dateTo: '2026-07-21' },
          kind: 'month',
          coverage: 'complete',
          totals: totals({ completed: previousTotal - previousBad, unproductive: previousBad }),
        },
      }),
      defaultOverviewOsFilters,
    )
  }

  it('diferença de meio ponto vale no singular, e o favorável segue o sentido da taxa', () => {
    // Agosto 21/200 = 10,5% contra julho 20/200 = 10,0%.
    const kpis = monthAgainstJuly(200, 21, 200, 20)

    expect(kpis.unproductiveDelta).toMatchObject({ text: '+0,5 p.p.', positive: false })
    // A conclusão caiu os mesmos 0,5 ponto: desfavorável.
    expect(kpis.completionDelta).toMatchObject({ text: '-0,5 p.p.', positive: false })
    // O volume continua em percentual.
    expect(kpis.totalDelta.text).toBe('+0,0%')
  })

  it('acima de um ponto vai para o plural, e taxa igual é estável', () => {
    expect(monthAgainstJuly(100, 12, 100, 10).unproductiveDelta.text).toBe('+2,0 p.p.')

    const stable = monthAgainstJuly(100, 10, 100, 10)
    expect(stable.unproductiveDelta.text).toBe('+0,0 p.p.')
    expect(stable.completionDelta.text).toBe('+0,0 p.p.')
  })
})

describe('texto da comparação nos cards', () => {
  function comparisonOf(name: Parameters<typeof periodScenario>[0]) {
    const { facts, filters } = periodScenario(name)
    return buildOverviewKpis(facts, filters).comparison
  }

  it('mês até um dia compara com o mês anterior até o mesmo dia, pelo nome', () => {
    expect(comparisonOf('padrao')).toEqual({ label: 'vs. julho até o dia 21', long: 'versus julho até o dia 21' })
  })

  it('mês inteiro compara com o mês anterior inteiro, só pelo nome', () => {
    expect(comparisonOf('julho-inteiro')?.label).toBe('vs. junho')
  })

  it('dia compara com o mesmo dia da semana anterior, nomeado; recorte livre, com as duas datas', () => {
    // 21/08/2026 é sexta-feira: compara com a sexta anterior, e diz isso.
    expect(comparisonOf('um-dia')).toEqual({ label: 'vs. sexta 14/08', long: 'versus sexta 14/08' })
    expect(comparisonOf('recorte-livre')?.label).toBe('vs. 26/07 a 04/08')
  })

  it('semana incompleta diz até que dia compara; a completa, só "semana anterior"', () => {
    // 17/08/2026 é segunda-feira. De segunda a sexta, a comparação é com
    // segunda a sexta da semana anterior, e o texto diz isso.
    expect(comparisonOf('semana-incompleta')).toEqual({
      label: 'vs. semana anterior até sexta',
      long: 'versus semana anterior até sexta',
    })
    // De segunda a domingo: a semana inteira contra a semana inteira.
    expect(comparisonOf('semana-completa')).toEqual({ label: 'vs. semana anterior', long: 'versus semana anterior' })
  })

  it('sem comparação disponível não há texto, e o card já diz o motivo', () => {
    expect(comparisonOf('anterior-incompleto')).toBeNull()
  })
})

/**
 * Leitura gerencial calculada sobre o recorte (23/09/2026): o título de cada
 * card escreve os números da tela, e o texto muda conforme o que existe no
 * recorte (infraestrutura, OS em aberto, motivo de improdutiva na fonte).
 */
describe('leitura gerencial com os números do recorte', () => {
  /** Leituras de um recorte, pelo mesmo caminho da página. */
  function readingsOf(facts: OverviewOsPeriodFacts, today?: string) {
    const kpis = buildOverviewKpis(facts, defaultOverviewOsFilters)

    return buildOverviewReadings(facts, kpis, defaultOverviewOsFilters, today)
  }

  it('sobre a base local, escreve total, entrega, o que faltou e a improdutividade', () => {
    const { facts } = periodScenario('padrao')
    const readings = readingsOf(facts)

    // 1.248 OS em 19 dias com agenda (o recorte tem 21 dias, dois sem OS),
    // 959 concluídas: a média é por dia COM agenda, não por dia do período.
    expect(facts.daysWithOs).toBe(19)
    expect(readings.total.title).toBe('1.248 OS marcadas, 65,7 por dia com agenda.')
    // 131, e não 134: o mesmo número do card Taxa Improdutividade ao lado
    // (as 3 de infraestrutura ficam fora, como lá).
    expect(readings.total.text).toContain(
      'para o mesmo cliente: as {131 improdutivas} do recorte tendem a voltar como OS nova',
    )
    expect(readings.completed.title).toBe('959 OS entregues, 50,5 por dia com agenda.')
    expect(readings.completed.text).toBe(
      'Acompanha a agenda; bom ou ruim é a {Taxa de Conclusão}. Infraestrutura conta aqui, {23 de 135} concluídas, não nas taxas: outro ciclo.',
    )
    // 1.113 de cliente, 936 concluídas: faltaram 177, e o título diz onde foram.
    expect(readings.completionRate.title).toBe('177 não concluíram: 131 improdutivas, 46 não executadas.')
    expect(readings.completionRate.text).toBe(
      '{Improdutiva}: o técnico foi e não conseguiu. {Não executada}: ninguém foi, a OS expirou sem técnico ou foi encerrada à mão.',
    )
    // A base local não traz o motivo: o título não fala dele.
    expect(readings.unproductiveRate.title).toBe('131 visitas improdutivas: cada uma custa duas vezes.')
    expect(readings.unproductiveRate.text).toContain('{outra visita}')
  })

  it('só infraestrutura no recorte: a leitura diz isso, com a OS em aberto de dia passado', () => {
    // "Hoje" é o dia seguinte ao fim da base, fora do recorte.
    const readings = readingsOf(periodScenario('so-infraestrutura').facts, '2026-08-22')

    // Sem cliente no recorte, a frase do Total perde o "mesmo cliente" e
    // conta as improdutivas de infraestrutura, a base das taxas aqui.
    expect(readings.total.text).toBe(
      'Visita que falha gera {outra OS}: as {3 improdutivas} do recorte tendem a voltar como OS nova e inflar o total.',
    )
    expect(readings.completed.text).toBe(
      'Só há infraestrutura no recorte: quase sempre expira ou é encerrada à mão, e as taxas ao lado valem para ela.',
    )
    expect(readings.completionRate.title).toBe(
      '112 não concluíram: 3 improdutivas, 108 não executadas, 1 em aberto.',
    )
    // Hoje não está no recorte (a base termina em 21/08): a OS em aberto é de
    // dia passado, e o texto não promete que a taxa vai subir.
    expect(readings.completionRate.text).toContain('{Em aberto} ficou de dia passado, sem desfecho no aplicativo.')
    expect(readings.unproductiveRate.title).toBe('3 visitas improdutivas: cada uma custa duas vezes.')
  })

  it('recorte vazio dá a mesma leitura nos quatro cards, sem número inventado', () => {
    const readings = readingsOf(handFacts())

    for (const reading of Object.values(readings)) {
      expect(reading.title).toBe('Nenhuma OS no recorte.')
      expect(reading.text).toContain('amplie o período ou tire um filtro')
    }
  })

  it('um dia só, tudo concluído: "no dia", singular certo e nenhuma saída a explicar', () => {
    const one = readingsOf(handFacts({ totals: totals({ completed: 1 }) }))
    expect(one.total.title).toBe('1 OS marcada no dia.')
    expect(one.completed.title).toBe('1 OS entregue no dia.')
    expect(one.completionRate.title).toBe('A única OS de cliente foi entregue.')
    expect(one.completionRate.text).toContain('Neste recorte não houve nenhuma das duas.')
    expect(one.unproductiveRate.title).toBe('Nenhuma visita improdutiva na única OS de cliente.')
    expect(one.total.text).toContain('Neste recorte não houve improdutiva de cliente.')
    expect(one.completed.text).toContain('Não há OS de infraestrutura neste recorte.')

    // Uma improdutiva sem motivo na fonte: singular também aqui.
    const oneFailed = readingsOf(handFacts({ totals: totals({ completed: 1, unproductive: 1 }) }))
    expect(oneFailed.unproductiveRate.title).toBe('1 visita improdutiva: ela custa duas vezes.')

    const three = readingsOf(handFacts({ totals: totals({ completed: 3 }) }))
    expect(three.total.title).toBe('3 OS marcadas no dia.')
    expect(three.completionRate.title).toBe('Todas as 3 OS de cliente foram entregues.')
    expect(three.unproductiveRate.title).toBe('Nenhuma visita improdutiva nas 3 OS de cliente.')

    // Só infraestrutura, tudo concluído: o substantivo diz o grupo.
    const infra = readingsOf(handFacts({ totals: totals({}, { completed: 2 }), rateBase: 'infrastructure' }))
    expect(infra.completionRate.title).toBe('Todas as 2 OS de infraestrutura foram entregues.')
    expect(infra.unproductiveRate.title).toBe('Nenhuma visita improdutiva nas 2 OS de infraestrutura.')
    expect(infra.total.text).toContain('Neste recorte não houve improdutiva de infraestrutura.')
  })

  it('a média por dia tem uma casa decimal, e um recorte pequeno não vira "0 por dia"', () => {
    const readings = readingsOf(handFacts({ totals: totals({ completed: 1, unproductive: 1 }), daysWithOs: 2 }))

    expect(readings.total.title).toBe('2 OS marcadas, 1,0 por dia com agenda.')
    expect(readings.completed.title).toBe('1 OS entregue, 0,5 por dia com agenda.')
  })

  it('OS em aberto com hoje no recorte avisa que a taxa ainda sobe', () => {
    // "Hoje" é o último dia do recorte.
    const readings = readingsOf(handFacts({ totals: totals({ completed: 1, open: 1, unknown: 1 }) }), '2026-08-21')

    expect(readings.completionRate.title).toBe('2 não concluíram: 1 em aberto, 1 sem classificação.')
    expect(readings.completionRate.text).toContain(
      '{Em aberto} ainda conclui, e a taxa sobe até o fim de hoje.',
    )
  })

  it('com o motivo na fonte, o título da improdutividade nomeia o mais comum e a fatia dele', () => {
    const named = readingsOf(
      handFacts({
        totals: totals({ completed: 1, unproductive: 3 }),
        topReason: { reason: 'Cliente ausente', count: 2, of: 3 },
      }),
    )
    expect(named.unproductiveRate.title).toBe('3 improdutivas, 66,7% por cliente ausente.')
    expect(named.total.text).toContain('as {3 improdutivas} do recorte tendem a voltar')

    // A improdutiva sem motivo pode ser a mais comum (`reason` nulo).
    const mixed = readingsOf(
      handFacts({ totals: totals({ unproductive: 4 }), topReason: { reason: null, count: 3, of: 4 } }),
    )
    expect(mixed.unproductiveRate.title).toBe('4 improdutivas, 75,0% sem motivo registrado.')

    // Nenhuma com motivo: o serviço não manda motivo, e o título não afirma
    // "100% sem motivo registrado", que poderia ser só a fonte sem o campo.
    const blank = readingsOf(handFacts({ totals: totals({ unproductive: 2 }) }))
    expect(blank.unproductiveRate.title).toBe('2 visitas improdutivas: cada uma custa duas vezes.')
    expect(blank.completed.title).toBe('Nenhuma OS entregue no recorte.')

    // A fatia é sobre a base das taxas: a improdutiva de infraestrutura não
    // entra no denominador.
    const withInfra = readingsOf(
      handFacts({
        totals: totals({ completed: 1, unproductive: 1 }, { unproductive: 2 }),
        topReason: { reason: 'Chuva', count: 1, of: 1 },
      }),
    )
    expect(withInfra.unproductiveRate.title).toBe('1 improdutiva, 100,0% por chuva.')
    expect(withInfra.total.text).toContain('a {1 improdutiva} do recorte tende')
    expect(withInfra.completionRate.title).toBe('1 não concluiu: 1 improdutiva.')

    // O motivo entra no meio da frase todo em minúsculas, mesmo vindo em
    // "Cliente Ausente".
    const titleCase = readingsOf(
      handFacts({
        totals: totals({ completed: 1, unproductive: 1 }),
        topReason: { reason: 'Cliente Ausente', count: 1, of: 1 },
      }),
    )
    expect(titleCase.unproductiveRate.title).toBe('1 improdutiva, 100,0% por cliente ausente.')
  })
})

/**
 * Título da faixa "Resultado do período" (23/09/2026): nomeia o recorte pela
 * mesma régua da comparação, para título e card fecharem a frase.
 */
describe('nome do período no título da faixa', () => {
  it('mês inteiro é só o nome do mês, com o ano', () => {
    expect(periodTitle({ dateFrom: '2026-08-01', dateTo: '2026-08-31' })).toBe('Agosto de 2026')
    expect(periodTitle({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })).toBe('Fevereiro de 2026')
  })

  it('mês até um dia diz até que dia', () => {
    expect(periodTitle({ dateFrom: '2026-09-01', dateTo: '2026-09-21' })).toBe('Setembro de 2026, até o dia 21')
    expect(periodTitle(defaultOverviewOsFilters)).toBe('Agosto de 2026, até o dia 21')
  })

  it('semana, dia e recorte livre têm a própria forma', () => {
    // 14/09/2026 é segunda-feira; 21/09/2026 também.
    expect(periodTitle({ dateFrom: '2026-09-14', dateTo: '2026-09-20' })).toBe('Semana de 14/09 a 20/09/2026')
    expect(periodTitle({ dateFrom: '2026-09-21', dateTo: '2026-09-21' })).toBe('Segunda-feira, 21/09/2026')
    expect(periodTitle({ dateFrom: '2026-09-03', dateTo: '2026-09-10' })).toBe('03/09/2026 a 10/09/2026')
  })
})
