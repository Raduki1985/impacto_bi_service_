import { formatNumber, formatPercent } from '../lib/formatters'
import { statusColors } from './dashboardAggregates'
import type { KpiDelta, Pair } from './dashboardTypes'
import {
  OVERVIEW_OS_LOCAL_CATALOG_ORDER,
  OVERVIEW_OS_STATUS_KEY,
  type OverviewOsRecord,
} from './overviewOsData'
import {
  applyOverviewOsFilters,
  applyOverviewOsFiltersExceptCategory,
  applyOverviewOsFiltersExceptCity,
  applyOverviewOsFiltersExceptServiceTypeAndCategory,
  applyOverviewOsFiltersExceptStatus,
  applyOverviewOsPreviousFilters,
  orderedByCatalog,
  OVERVIEW_OS_ALL,
  previousOverviewOsPeriod,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from './overviewOsFilters'

/**
 * Agregados da Visão Geral de OS sobre a fonte real sanitizada.
 *
 * Módulo próprio, separado de `dashboardAggregates.ts`, porque a Visão Geral
 * usa a tabela-fato real e as demais páginas continuam na simulação: um só
 * gerador para as duas fontes obrigaria o tipo simulado a mentir campos que a
 * fonte real não tem (duração, cliente, motivo), ou vice-versa.
 *
 * Este bloco não usa `duration_minutes`: a fonte da Visão Geral nem carrega o
 * campo, e o card de tempo médio não existe na página.
 */

/** Texto do card quando a janela anterior alcança datas sem cobertura da fonte. */
export const OVERVIEW_PREVIOUS_INCOMPLETE_LABEL = 'Período anterior incompleto'
export const OVERVIEW_PREVIOUS_INCOMPLETE_ACCESSIBLE =
  'comparação indisponível, o período anterior alcança datas sem cobertura da base'

export type OverviewOsKpis = {
  total: string
  completed: string
  completionRate: string
  unproductiveRate: string
  totalDelta: KpiDelta
  completedDelta: KpiDelta
  completionDelta: KpiDelta
  unproductiveDelta: KpiDelta
}

export type OverviewOsCharts = {
  /** Paleta semântica compartilhada dos status. */
  statusColors: Record<string, string>
  /**
   * Distribuição CONTEXTUAL por status: aplica período, equipe, tipo, categoria
   * e cidade, e ignora somente o filtro Status. Ordem de negócio do catálogo.
   */
  statusPairs: Pair[]
  /**
   * Séries diárias do `Volume diário de OS`, um ponto por dia COM OS dentro
   * do período filtrado, sem nenhum corte interno: as coleções têm sempre o
   * mesmo comprimento e a mesma ordem cronológica.
   *
   * `x` é o rótulo curto do eixo, no formato dia/mês, e `iso` é a MESMA data
   * completa, em aaaa-mm-dd. As duas andam juntas porque o rótulo do eixo não
   * tem ano, e sem ano não dá para saber o dia da semana que o tooltip mostra.
   *
   * `total`, `completed` e `unproductive` são CONTAGEM de OS do dia.
   * `unproductiveRate` é a mesma improdutividade em PROPORÇÃO, de 0 a 1,
   * calculada aqui sem arredondamento, e continua publicada para quem precisar
   * ler a improdutividade como taxa.
   */
  overviewDay: {
    x: string[]
    iso: string[]
    total: number[]
    completed: number[]
    unproductive: number[]
    unproductiveRate: number[]
  }
  /**
   * Ranking CONTEXTUAL de categorias: aplica todos os filtros MENOS Categoria,
   * pelo mesmo motivo de `statusPairs`, e mostra o Top 10 do contexto. Com uma
   * categoria selecionada fora do Top 10, ela entra garantida como último item,
   * com o valor real, e `selectedCategoryRank` diz a posição verdadeira.
   */
  categoryTopPairs: Pair[]
  /**
   * Posição real (1 = maior) da categoria selecionada dentro do contexto do
   * ranking de categorias; null sem categoria filtrada. É o que permite ao
   * subtítulo do painel dizer onde a categoria realmente está quando ela
   * aparece fora do Top 10.
   */
  selectedCategoryRank: number | null
  /** Top 10 resoluções das OS Concluídas com resolução preenchida. */
  resolutionTopPairs: Pair[]
  /**
   * Composição CONTEXTUAL por Tipo de OS, em ordem decrescente, cada fatia
   * carregando o ranking completo das categorias que a compõem. É a fonte do
   * gráfico de pizza e do tooltip dele: a fatia diz o tamanho do tipo, e o
   * ranking diz o que há dentro.
   *
   * Aplica período, equipe, cidade e status, e ignora os filtros Tipo de OS e
   * Categoria, pelo mesmo motivo de `statusPairs`: com o próprio filtro
   * aplicado, a rosca virava uma fatia única de 100%, que não compara nada. A
   * Categoria fica de fora porque quase toda categoria pertence a um único
   * tipo, e aplicá-la reproduzia a fatia de 100% por outro caminho.
   */
  serviceTypeSlices: ServiceTypeSlice[]
  /**
   * Ranking CONTEXTUAL de cidades: aplica todos os filtros MENOS Cidade, em
   * ordem decrescente e sem corte, para a cidade selecionada virar destaque
   * entre as demais em vez de barra única.
   */
  cityPairs: Pair[]
}

export type ServiceTypeSlice = {
  readonly name: string
  readonly value: number
  /** Categorias do tipo, da mais frequente para a menos, sem corte. */
  readonly categories: Pair[]
}

export type OverviewOsPreviousPeriod = {
  range: { dateFrom: string; dateTo: string }
  coverage: 'complete' | 'incomplete'
  /** Totais da janela anterior com os mesmos filtros; null quando incompleta. */
  totals: {
    total: number
    completed: number
    unproductive: number
  } | null
}

export type OverviewOsData = {
  kpis: OverviewOsKpis
  previousPeriod: OverviewOsPreviousPeriod | null
  charts: OverviewOsCharts
}

/**
 * Concluída e Improdutiva pela CHAVE do SGI, nunca pelo rótulo.
 *
 * O rótulo é apresentação e pode ser renomeado; a chave vem do banco. Contar
 * por texto traduzido significaria que renomear "Concluída" zera o cartão sem
 * nenhum erro aparecer, que é a pior falha possível num painel (decisão de
 * 08/09/2026, orientação do dev do SGI).
 */
function isCompleted(record: OverviewOsRecord): boolean {
  return record.statusKey === OVERVIEW_OS_STATUS_KEY.completed
}

function isUnproductive(record: OverviewOsRecord): boolean {
  return record.statusKey === OVERVIEW_OS_STATUS_KEY.unproductive
}

function shortDay(dateISO: string): string {
  const [, month, day] = dateISO.split('-')
  return `${day}/${month}`
}

/**
 * Contagem decrescente com desempate pela ordem lexicográfica simples dos
 * rótulos, o MESMO critério dos artefatos aprovados da investigação: é ele que
 * mantém `REPARO DE CTO` antes de `instalação de 4 câmeras` no empate de 26.
 */
function topPairs(counts: Map<string, number>, limit: number = Infinity): Pair[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
}

function unavailableDelta(reason: 'no-data' | 'incomplete'): KpiDelta {
  if (reason === 'incomplete') {
    return {
      text: 'N/A',
      positive: false,
      available: false,
      unavailableLabel: OVERVIEW_PREVIOUS_INCOMPLETE_LABEL,
      unavailableAccessibleLabel: OVERVIEW_PREVIOUS_INCOMPLETE_ACCESSIBLE,
    }
  }
  return { text: 'N/A', positive: false, available: false }
}

/** Mesma matemática de delta dos agregados de OS, sobre a fonte real. */
function delta(current: number, previous: number, higherIsGood: boolean): KpiDelta {
  const value = previous ? (current - previous) / previous : 0
  const positive = higherIsGood ? value >= 0 : value < 0

  return {
    text: `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1).replace('.', ',')}%`,
    positive,
    available: true,
  }
}

export function buildOverviewOsData(
  records: readonly OverviewOsRecord[],
  filters: OverviewOsFilters,
  /**
   * Cobertura da fonte em uso. Só decide se a janela anterior cabe inteira na
   * base; omitida, vale a cobertura do arquivo local, como sempre valeu.
   */
  coverage?: OverviewOsCoverage,
  /**
   * Ordem operacional dos status, vinda da fonte em uso (com a API, de
   * `catalog.statuses`). Omitida, vale a do arquivo local.
   */
  statusOrder: readonly string[] = OVERVIEW_OS_LOCAL_CATALOG_ORDER.statuses,
): OverviewOsData {
  const rows = applyOverviewOsFilters(records, filters)
  const statusContextRows = applyOverviewOsFiltersExceptStatus(records, filters)
  const serviceTypeContextRows = applyOverviewOsFiltersExceptServiceTypeAndCategory(
    records,
    filters,
  )
  const categoryContextRows = applyOverviewOsFiltersExceptCategory(records, filters)
  const cityContextRows = applyOverviewOsFiltersExceptCity(records, filters)

  const total = rows.length
  const completed = rows.filter(isCompleted).length
  const unproductive = rows.filter(isUnproductive).length

  // Comparação com a janela anterior de mesma duração, sob os mesmos filtros
  // não temporais. Janela que alcança datas antes da cobertura da fonte não
  // gera percentual nenhum: comparar com base parcial enganaria.
  const previous = previousOverviewOsPeriod(filters, coverage)
  let previousPeriod: OverviewOsPreviousPeriod | null = null
  let deltas: Pick<
    OverviewOsKpis,
    'totalDelta' | 'completedDelta' | 'completionDelta' | 'unproductiveDelta'
  >

  if (previous === null) {
    deltas = {
      totalDelta: unavailableDelta('no-data'),
      completedDelta: unavailableDelta('no-data'),
      completionDelta: unavailableDelta('no-data'),
      unproductiveDelta: unavailableDelta('no-data'),
    }
  } else if (previous.coverage === 'incomplete') {
    previousPeriod = { range: previous.range, coverage: 'incomplete', totals: null }
    deltas = {
      totalDelta: unavailableDelta('incomplete'),
      completedDelta: unavailableDelta('incomplete'),
      completionDelta: unavailableDelta('incomplete'),
      unproductiveDelta: unavailableDelta('incomplete'),
    }
  } else {
    const previousRows = applyOverviewOsPreviousFilters(records, filters, previous.range)
    const previousTotal = previousRows.length
    const previousCompleted = previousRows.filter(isCompleted).length
    const previousUnproductive = previousRows.filter(isUnproductive).length
    previousPeriod = {
      range: previous.range,
      coverage: 'complete',
      totals: {
        total: previousTotal,
        completed: previousCompleted,
        unproductive: previousUnproductive,
      },
    }

    // Janela coberta mas sem nenhum registro sob os filtros: comparação segue
    // indisponível, sem divisão enganosa por zero.
    if (previousTotal === 0) {
      deltas = {
        totalDelta: unavailableDelta('no-data'),
        completedDelta: unavailableDelta('no-data'),
        completionDelta: unavailableDelta('no-data'),
        unproductiveDelta: unavailableDelta('no-data'),
      }
    } else {
      deltas = {
        totalDelta: delta(total, previousTotal, true),
        completedDelta: delta(completed, previousCompleted, true),
        completionDelta: delta(
          completed / (total || 1),
          previousCompleted / previousTotal,
          true,
        ),
        unproductiveDelta: delta(
          unproductive / (total || 1),
          previousUnproductive / previousTotal,
          false,
        ),
      }
    }
  }

  // Séries diárias derivadas das mesmas linhas filtradas dos indicadores. Só
  // dias com OS entram: nenhum zero inventado, nenhuma divisão por zero.
  const dayMap = new Map<string, { total: number; completed: number; unproductive: number }>()
  for (const row of rows) {
    const item = dayMap.get(row.dateISO) ?? { total: 0, completed: 0, unproductive: 0 }
    item.total += 1
    if (isCompleted(row)) item.completed += 1
    if (isUnproductive(row)) item.unproductive += 1
    dayMap.set(row.dateISO, item)
  }
  const days = [...dayMap.keys()].sort()

  const statusCounts = new Map<string, number>()
  for (const row of statusContextRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
  }
  // Barras na ordem operacional da fonte. Status fora do de-para (chave crua
  // do SGI) entra no FIM, em ordem alfabética, em vez de sumir do gráfico:
  // ele conta no total e aparece no filtro, então precisa aparecer aqui.
  const statusPairs = orderedByCatalog(new Set(statusCounts.keys()), statusOrder)
    .map((status) => [status, statusCounts.get(status) ?? 0] as Pair)
    .filter(([, value]) => value > 0)

  // Contexto que ignora o próprio filtro Categoria: com uma categoria
  // selecionada, o ranking segue mostrando as demais como referência.
  const categoryCounts = new Map<string, number>()
  for (const row of categoryContextRows) {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1)
  }
  const categoryAllPairs = topPairs(categoryCounts)
  const categoryTopPairs = categoryAllPairs.slice(0, 10)
  // Categoria selecionada garantida no desenho: fora do Top 10, ela entra como
  // último item com o valor real do contexto, e a posição verdadeira segue no
  // agregado para o subtítulo do painel explicar onde ela está de fato.
  let selectedCategoryRank: number | null = null
  if (filters.category !== OVERVIEW_OS_ALL.category) {
    const index = categoryAllPairs.findIndex(([name]) => name === filters.category)
    if (index >= 0) {
      selectedCategoryRank = index + 1
      if (index >= categoryTopPairs.length) {
        categoryTopPairs.push(categoryAllPairs[index])
      }
    }
  }

  const resolutionCounts = new Map<string, number>()
  for (const row of rows) {
    if (!isCompleted(row) || row.resolution === null) continue
    resolutionCounts.set(row.resolution, (resolutionCounts.get(row.resolution) ?? 0) + 1)
  }

  // Composição por tipo: um mapa de categorias POR tipo, e não a contagem
  // global de categorias reaproveitada, porque a mesma categoria pode
  // aparecer sob mais de um tipo na fonte (`fibra instalação + segundo
  // ponto` existe em Instalação e em Mudança de Endereço).
  //
  // A fonte é o contexto que ignora os filtros Tipo de OS e Categoria, como na
  // distribuição por status: as demais fatias continuam desenhadas como
  // referência comparativa quando um tipo ou uma categoria está selecionado.
  const categoriesByType = new Map<string, Map<string, number>>()
  for (const row of serviceTypeContextRows) {
    const byCategory = categoriesByType.get(row.serviceType) ?? new Map<string, number>()
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1)
    categoriesByType.set(row.serviceType, byCategory)
  }
  const serviceTypeSlices: ServiceTypeSlice[] = [...categoriesByType.entries()]
    .map(([name, byCategory]) => {
      const categories = topPairs(byCategory)
      return {
        name,
        value: categories.reduce((sum, [, count]) => sum + count, 0),
        categories,
      }
    })
    .sort((a, b) => b.value - a.value || (a.name < b.name ? -1 : 1))

  // Contexto que ignora o próprio filtro Cidade, pela mesma razão do ranking
  // de categorias: a cidade escolhida vira destaque, nunca barra única.
  const cityCounts = new Map<string, number>()
  for (const row of cityContextRows) {
    cityCounts.set(row.city, (cityCounts.get(row.city) ?? 0) + 1)
  }

  return {
    kpis: {
      total: formatNumber(total),
      completed: formatNumber(completed),
      completionRate: formatPercent(completed / (total || 1)),
      unproductiveRate: formatPercent(unproductive / (total || 1)),
      ...deltas,
    },
    previousPeriod,
    charts: {
      statusColors,
      statusPairs,
      // Período INTEIRO do recorte: nenhum `slice` esconde dias do usuário.
      // Em janelas longas quem rareia os rótulos é o eixo do ECharts, e não um
      // corte silencioso na série. A taxa sai do MESMO `dayMap` dos volumes,
      // então os três valores de um dia são sempre do mesmo dia.
      overviewDay: {
        x: days.map(shortDay),
        // A data completa do mesmo dia, na mesma posição: é dela que o tooltip
        // do gráfico tira o dia da semana.
        iso: [...days],
        total: days.map((day) => dayMap.get(day)!.total),
        completed: days.map((day) => dayMap.get(day)!.completed),
        unproductive: days.map((day) => dayMap.get(day)!.unproductive),
        unproductiveRate: days.map((day) => {
          const item = dayMap.get(day)!
          return item.unproductive / item.total
        }),
      },
      categoryTopPairs,
      selectedCategoryRank,
      resolutionTopPairs: topPairs(resolutionCounts, 10),
      serviceTypeSlices,
      cityPairs: topPairs(cityCounts),
    },
  }
}
