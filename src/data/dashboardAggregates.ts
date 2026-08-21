import { formatDecimal, formatMinutes, formatNumber, formatPercent, initials } from '../lib/formatters'
import type {
  ChartSeries,
  DashboardData,
  HeatmapData,
  KpiSparklines,
  Pair,
  ServiceOrder,
} from './dashboardTypes'
import { dashboardMeta, orders } from './mockOsData'

const statusOrder = ['Concluída', 'Fechada', 'Improdutiva', 'Em Andamento', 'Cancelada']
const statusColors: Record<string, string> = {
  Concluída: '#16a34a',
  Fechada: '#64748b',
  Improdutiva: '#e5484d',
  'Em Andamento': '#f5a623',
  Cancelada: '#8b5cf6',
}
const chartPalette = ['#2f6bff', '#00b3a4', '#f5a623', '#e5484d', '#8b5cf6', '#0ea5e9', '#64748b']
const monthLabels: Record<string, string> = {
  '2026-04': 'Abril',
  '2026-05': 'Maio',
  '2026-06': 'Junho',
}

function countBy(rows: ServiceOrder[], selector: (row: ServiceOrder) => string | null) {
  const map = new Map<string, number>()

  for (const row of rows) {
    const key = selector(row)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return map
}

function pairFromOrder(order: string[], map: Map<string, number>) {
  return order.map((key) => [key, map.get(key) ?? 0] as Pair).filter(([, value]) => value > 0)
}

function sortedPairsFromOrder(order: string[], map: Map<string, number>) {
  return pairFromOrder(order, map).sort((a, b) => b[1] - a[1])
}

function shortDay(dateISO: string) {
  const [, month, day] = dateISO.split('-')
  return `${day}/${month}`
}

function fullDay(dateISO: string) {
  const [year, month, day] = dateISO.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekDays = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')} (${weekDays[date.getDay()]})`
}

function metricsOf(rows: ServiceOrder[]) {
  const completedRows = rows.filter((row) => row.status === 'Concluída')
  const unproductiveRows = rows.filter((row) => row.status === 'Improdutiva')
  const averageTime =
    completedRows.reduce((sum, row) => sum + row.durationMinutes, 0) / (completedRows.length || 1)

  return {
    total: rows.length,
    completed: completedRows.length,
    unproductive: unproductiveRows.length,
    completionRate: completedRows.length / (rows.length || 1),
    unproductiveRate: unproductiveRows.length / (rows.length || 1),
    averageTime,
  }
}

function delta(current: number, previous: number, higherIsGood: boolean, hasPrevious: boolean) {
  if (!hasPrevious) {
    return { text: 'N/A', positive: false, available: false }
  }

  const value = previous ? (current - previous) / previous : 0
  const positive = higherIsGood ? value >= 0 : value < 0

  return {
    text: `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1).replace('.', ',')}%`,
    positive,
    available: true,
  }
}

function matrix(
  rows: ServiceOrder[],
  yKeys: string[],
  xKeys: string[],
  rowSelector: (row: ServiceOrder) => string | null,
  colSelector: (row: ServiceOrder) => string | null,
  filter?: (row: ServiceOrder) => boolean,
): HeatmapData {
  const yIndex = Object.fromEntries(yKeys.map((key, index) => [key, index]))
  const xIndex = Object.fromEntries(xKeys.map((key, index) => [key, index]))
  const grid = yKeys.map(() => xKeys.map(() => 0))
  let max = 0

  for (const row of rows) {
    if (filter && !filter(row)) continue
    const y = rowSelector(row)
    const x = colSelector(row)
    if (!y || !x) continue
    const yi = yIndex[y]
    const xi = xIndex[x]
    if (yi == null || xi == null) continue
    grid[yi][xi] += 1
    max = Math.max(max, grid[yi][xi])
  }

  const data: [number, number, number][] = []
  for (let y = 0; y < yKeys.length; y++) {
    for (let x = 0; x < xKeys.length; x++) {
      data.push([x, y, grid[y][x]])
    }
  }

  return { x: xKeys, y: yKeys, data, max }
}

function stackedSeries(
  names: string[],
  xKeys: string[],
  rows: ServiceOrder[],
  xSelector: (row: ServiceOrder) => string,
  seriesSelector: (row: ServiceOrder) => string | null,
  colors = statusColors,
): ChartSeries[] {
  return names.map((name, index) => ({
    name,
    color: colors[name] ?? chartPalette[index % chartPalette.length],
    data: xKeys.map(
      (xKey) =>
        rows.filter((row) => xSelector(row) === xKey && seriesSelector(row) === name).length,
    ),
  }))
}

export function buildDashboardData(
  rows = orders,
  comparison?: { previousRows: ServiceOrder[] },
): DashboardData {
  const total = rows.length
  const statusMap = countBy(rows, (row) => row.status)
  const completed = statusMap.get('Concluída') ?? 0
  const closed = statusMap.get('Fechada') ?? 0
  const unproductive = statusMap.get('Improdutiva') ?? 0
  const completedRows = rows.filter((row) => row.status === 'Concluída')
  const averageTime =
    completedRows.reduce((sum, row) => sum + row.durationMinutes, 0) / (completedRows.length || 1)
  const averageLead =
    completedRows.reduce((sum, row) => sum + row.leadDays, 0) / (completedRows.length || 1)
  const currentPeriod = metricsOf(rows)
  const previousPeriod = comparison ? metricsOf(comparison.previousRows) : null
  const hasPrevious = previousPeriod !== null && previousPeriod.total > 0

  const dayMap = new Map<string, { total: number; completed: number; unproductive: number }>()
  for (const row of rows) {
    const item = dayMap.get(row.dateISO) ?? { total: 0, completed: 0, unproductive: 0 }
    item.total += 1
    if (row.status === 'Concluída') item.completed += 1
    if (row.status === 'Improdutiva') item.unproductive += 1
    dayMap.set(row.dateISO, item)
  }

  const days = [...dayMap.keys()].sort()
  const firstSafeDay = days[0] ?? '2026-04-01'
  let peak = firstSafeDay
  let peakQuantity = 0
  let critical = firstSafeDay
  let criticalQuantity = 0

  for (const day of days) {
    const item = dayMap.get(day)!
    if (item.total > peakQuantity) {
      peak = day
      peakQuantity = item.total
    }
    if (item.unproductive > criticalQuantity) {
      critical = day
      criticalQuantity = item.unproductive
    }
  }

  // Séries diárias dos minigráficos dos cards executivos. Saem das MESMAS
  // linhas filtradas que alimentam os valores: nenhum rateio, nenhuma série
  // sintética. `days` só contém dias com OS, então o total diário nunca é zero
  // e as taxas nunca dividem por zero. O tempo médio é a única métrica que pode
  // não ter base num dia com OS (dia sem nenhuma concluída) e fica `null` nele,
  // porque zero significaria atendimento instantâneo, não ausência.
  const timeByDay = new Map<string, { sum: number; count: number }>()
  const techniciansByDay = new Map<string, Set<number>>()
  for (const row of rows) {
    if (row.status === 'Concluída') {
      const item = timeByDay.get(row.dateISO) ?? { sum: 0, count: 0 }
      item.sum += row.durationMinutes
      item.count += 1
      timeByDay.set(row.dateISO, item)
    }
    const technicians = techniciansByDay.get(row.dateISO) ?? new Set<number>()
    technicians.add(row.technicianIndex)
    techniciansByDay.set(row.dateISO, technicians)
  }
  const kpiSparklines: KpiSparklines = {
    total: days.map((day) => dayMap.get(day)!.total),
    completed: days.map((day) => dayMap.get(day)!.completed),
    completionRate: days.map((day) => {
      const item = dayMap.get(day)!
      return item.completed / item.total
    }),
    unproductiveRate: days.map((day) => {
      const item = dayMap.get(day)!
      return item.unproductive / item.total
    }),
    averageTime: days.map((day) => {
      const item = timeByDay.get(day)
      return item === undefined ? null : item.sum / item.count
    }),
    activeTechnicians: days.map((day) => techniciansByDay.get(day)!.size),
  }

  const workDays = days.filter((day) => {
    const [year, month, date] = day.split('-').map(Number)
    return new Date(year, month - 1, date).getDay() !== 0
  }).length

  const weeks = [...new Set(rows.map((row) => row.weekKey))].sort()
  const weekLabels = weeks.map(shortDay)
  const weekStats = weeks.map((week) => {
    const weekRows = rows.filter((row) => row.weekKey === week)
    return {
      total: weekRows.length,
      completed: weekRows.filter((row) => row.status === 'Concluída').length,
      unproductive: weekRows.filter((row) => row.status === 'Improdutiva').length,
    }
  })

  const categories = dashboardMeta.categories.map((category) => category.value)
  const resolutions = dashboardMeta.resolutions
  const periods = dashboardMeta.periods
  const technicianNames = dashboardMeta.technicians.map((technician) => technician.name)
  const technicianShortNames = technicianNames.map((name) => {
    const [first, second = ''] = name.split(' ')
    return `${first} ${second.charAt(0)}.`
  })

  const categoryMap = countBy(rows, (row) => row.category)
  const resolutionMap = countBy(rows, (row) => row.resolution)
  const statusPairs = pairFromOrder(statusOrder, statusMap)
  const categoryValues = categories.map((category) => categoryMap.get(category) ?? 0)
  const resolutionPairs = sortedPairsFromOrder(resolutions, resolutionMap)
  const categoryStatus = stackedSeries(statusOrder, categories, rows, (row) => row.category, (row) => row.status)
  const statusPeriod = stackedSeries(statusOrder, periods, rows, (row) => row.period, (row) => row.status)
  const resolutionCategory = categories.map((category, index) => ({
    name: category,
    color: chartPalette[index % chartPalette.length],
    data: resolutions.map(
      (resolution) =>
        rows.filter((row) => row.category === category && row.resolution === resolution).length,
    ),
  }))

  const unproductiveRows = rows.filter((row) => row.status === 'Improdutiva')
  const unproductiveReasonMap = countBy(rows, (row) => row.unproductiveReason)
  const unproductiveReason = sortedPairsFromOrder(dashboardMeta.unproductiveReasons, unproductiveReasonMap)
  const unproductivePeriod = periods.map(
    (period) => [period, unproductiveRows.filter((row) => row.period === period).length] as Pair,
  )
  const unproductiveTechnician = technicianNames
    .map((name, index) => [
      technicianShortNames[index],
      unproductiveRows.filter((row) => row.technician === name).length,
    ] as Pair)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
  const unproductiveCategory = categories
    .map((category) => [
      category,
      unproductiveRows.filter((row) => row.category === category).length,
    ] as Pair)
    .sort((a, b) => b[1] - a[1])

  const closingRows = rows.filter((row) => row.status === 'Fechada' || row.status === 'Cancelada')
  const closingReasonMap = countBy(closingRows, (row) => row.closingReason)
  const closingReason = sortedPairsFromOrder(dashboardMeta.closingReasons, closingReasonMap)
  const closingEvolution = weeks.map(
    (week) =>
      closingRows.filter((row) => row.weekKey === week).length,
  )

  const technicianStats = technicianNames.map((name) => {
    const technicianRows = rows.filter((row) => row.technician === name)
    const completedCount = technicianRows.filter((row) => row.status === 'Concluída').length
    const unproductiveCount = technicianRows.filter((row) => row.status === 'Improdutiva').length
    const workedDays = new Set(technicianRows.map((row) => row.dateISO)).size

    return {
      name,
      total: technicianRows.length,
      completed: completedCount,
      unproductive: unproductiveCount,
      completionRate: completedCount / (technicianRows.length || 1),
      workedDays,
    }
  })
  const technicianRanking = technicianStats
    .sort((a, b) => b.completed - a.completed)
    .map((item, index) => ({
      position: index + 1,
      name: item.name,
      initials: initials(item.name),
      total: formatNumber(item.total),
      completed: formatNumber(item.completed),
      unproductive: formatNumber(item.unproductive),
      averageDay: formatDecimal(item.total / item.workedDays),
      completionRate: formatPercent(item.completionRate),
      completionRateNumber: Math.round(item.completionRate * 100),
    }))
  const technicianTop = technicianStats
    .slice()
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10)

  const customerMap = new Map<string, { name: string; subscription: string; visits: number }>()
  for (const row of rows) {
    const item = customerMap.get(row.subscription) ?? {
      name: row.customer,
      subscription: row.subscription,
      visits: 0,
    }
    item.visits += 1
    customerMap.set(row.subscription, item)
  }
  const customerList = [...customerMap.values()].sort((a, b) => b.visits - a.visits)
  const maxCustomerVisits = customerList[0]?.visits ?? 1
  const customerRanking = customerList.slice(0, 14).map((item, index) => ({
    position: index + 1,
    name: item.name,
    subscription: item.subscription,
    visits: item.visits,
    width: Math.round((item.visits / maxCustomerVisits) * 100),
  }))

  const intelligenceOrder = ['Cliente', 'Equipamentos', 'Rede', 'Infraestrutura', 'Comercial', 'Administrativo', 'Operacional']
  const intelligenceMap = countBy(rows, (row) => row.intelligenceTopic)
  const intelligenceBar = sortedPairsFromOrder(intelligenceOrder, intelligenceMap)
  const stopWords = new Set([
    'de',
    'da',
    'do',
    'a',
    'o',
    'e',
    'no',
    'na',
    'em',
    'com',
    'para',
    'que',
    'os',
    'as',
    'um',
    'uma',
    'ao',
    'se',
    'sem',
    'por',
    'foi',
    'nao',
    'não',
    'ja',
    'já',
    'pra',
    'vim',
    'ele',
    'agora',
    'tá',
    'esta',
    'está',
    'até',
    'aos',
    'das',
    'dos',
  ])
  const wordMap = new Map<string, number>()
  for (const row of rows) {
    if (!row.note) continue
    for (const token of row.note.toLowerCase().split(/[^a-zà-ú0-9-]+/)) {
      const word = token.trim()
      if (word.length < 3 || stopWords.has(word)) continue
      wordMap.set(word, (wordMap.get(word) ?? 0) + 1)
    }
  }
  const words = [...wordMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 34)
  const maxWord = words[0]?.[1] ?? 1
  const minWord = words[words.length - 1]?.[1] ?? 0
  const wordCloud = words.map(([text, value], index) => ({
    text,
    size: Math.round(15 + ((value - minWord) / ((maxWord - minWord) || 1)) * 34),
    color: chartPalette[index % chartPalette.length],
  }))
  const intelligenceTop = intelligenceBar.slice(0, 4).map(([topic]) => topic)
  const intelligenceTrend = intelligenceTop.map((topic, index) => ({
    name: topic,
    color: chartPalette[index % chartPalette.length],
    data: weeks.map(
      (week) => rows.filter((row) => row.weekKey === week && row.intelligenceTopic === topic).length,
    ),
  }))

  const weekIndex = Object.fromEntries(weeks.map((week, index) => [week, index]))
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const dayOfWeekGrid = weeks.map(() => dayNames.map(() => 0))
  for (const row of rows) {
    const dayIndex = (row.dayOfWeek + 6) % 7
    dayOfWeekGrid[weekIndex[row.weekKey]][dayIndex] += 1
  }
  const dayOfWeekData: [number, number, number][] = []
  let dayOfWeekMax = 0
  for (let week = 0; week < weeks.length; week++) {
    for (let day = 0; day < dayNames.length; day++) {
      const value = dayOfWeekGrid[week][day]
      dayOfWeekData.push([week, day, value])
      dayOfWeekMax = Math.max(dayOfWeekMax, value)
    }
  }

  return {
    kpis: {
      total: formatNumber(total),
      completed: formatNumber(completed),
      closed: formatNumber(closed),
      unproductive: formatNumber(unproductive),
      completionRate: formatPercent(completed / (total || 1)),
      unproductiveRate: formatPercent(unproductive / (total || 1)),
      averageTime: formatMinutes(averageTime),
      averageLead: `${formatDecimal(averageLead)} dias`,
      activeTechnicians: new Set(rows.map((row) => row.technicianIndex)).size,
      totalDelta: delta(currentPeriod.total, previousPeriod?.total ?? 0, true, hasPrevious),
      completedDelta: delta(currentPeriod.completed, previousPeriod?.completed ?? 0, true, hasPrevious),
      completionDelta: delta(currentPeriod.completionRate, previousPeriod?.completionRate ?? 0, true, hasPrevious),
      unproductiveDelta: delta(currentPeriod.unproductiveRate, previousPeriod?.unproductiveRate ?? 0, false, hasPrevious),
      timeDelta: delta(currentPeriod.averageTime, previousPeriod?.averageTime ?? 0, false, hasPrevious),
    },
    kpiSparklines,
    calendar: {
      peak: fullDay(peak),
      peakQuantity,
      critical: fullDay(critical),
      criticalQuantity,
      average: formatDecimal(total / (workDays || 1)),
    },
    unproductive: {
      topReason: unproductiveReason[0]?.[0] ?? '-',
      topReasonPercent: formatPercent((unproductiveReason[0]?.[1] ?? 0) / (unproductiveRows.length || 1)),
    },
    customers: {
      unique: formatNumber(customerMap.size),
      recurring: formatNumber(customerList.filter((item) => item.visits >= 2).length),
      averageVisits: formatDecimal(total / (customerMap.size || 1), 2),
    },
    intelligence: {
      totalNotes: formatNumber(rows.filter((row) => row.note).length),
    },
    technicianRanking,
    customerRanking,
    wordCloud,
    charts: {
      statusColors,
      statusPairs,
      overviewDay: {
        x: days.slice(-45).map(shortDay),
        total: days.slice(-45).map((day) => dayMap.get(day)!.total),
        completed: days.slice(-45).map((day) => dayMap.get(day)!.completed),
      },
      categoryBar: { labels: categories, values: categoryValues },
      resolutionPairs,
      daily: { x: days.map(shortDay), total: days.map((day) => dayMap.get(day)!.total) },
      weekly: { x: weekLabels, total: weekStats.map((item) => item.total) },
      monthly: {
        x: Object.keys(monthLabels).map((month) => monthLabels[month]),
        values: Object.keys(monthLabels).map((month) => rows.filter((row) => row.monthKey === month).length),
      },
      evolution: {
        x: weekLabels,
        completed: weekStats.map((item) => item.completed),
        unproductive: weekStats.map((item) => item.unproductive),
      },
      categoryStatus: { x: categories, series: categoryStatus },
      categoryResolution: matrix(rows, categories, resolutions, (row) => row.category, (row) => row.resolution, (row) => Boolean(row.resolution)),
      resolutionCategory: { x: resolutions, series: resolutionCategory },
      statusPeriod: { x: periods, series: statusPeriod },
      technicianTop: {
        labels: technicianTop.map((item) => {
          const [first, second = ''] = item.name.split(' ')
          return `${first} ${second}`
        }),
        values: technicianTop.map((item) => item.completed),
      },
      technicianCategory: matrix(rows, technicianShortNames, categories, (row) => technicianShortNames[row.technicianIndex], (row) => row.category),
      technicianResolution: matrix(rows, technicianShortNames, resolutions, (row) => technicianShortNames[row.technicianIndex], (row) => row.resolution, (row) => Boolean(row.resolution)),
      unproductiveReason,
      unproductivePeriod,
      unproductiveTechnician,
      unproductiveCategory,
      unproductiveEvolution: { x: weekLabels, values: weekStats.map((item) => item.unproductive) },
      closingReason,
      closingEvolution: { x: weekLabels, values: closingEvolution },
      qualityCategoryResolution: matrix(rows, categories, resolutions, (row) => row.category, (row) => row.resolution, (row) => Boolean(row.resolution)),
      qualityCategoryUnproductive: matrix(rows, categories, dashboardMeta.unproductiveReasons, (row) => row.category, (row) => row.unproductiveReason, (row) => Boolean(row.unproductiveReason)),
      qualityStatusCategory: { x: categories, series: categoryStatus },
      qualityStatusTechnician: matrix(rows, technicianShortNames, statusOrder, (row) => technicianShortNames[row.technicianIndex], (row) => row.status),
      calendarDay: days.map((day) => [day, dayMap.get(day)!.total]),
      calendarRange: ['2026-04-01', '2026-06-30'],
      dayOfWeekByWeek: { x: weekLabels, y: dayNames, data: dayOfWeekData, max: dayOfWeekMax },
      intelligenceBar,
      intelligenceTrend: { x: weekLabels, series: intelligenceTrend },
    },
  }
}

export const dashboardData = buildDashboardData()
