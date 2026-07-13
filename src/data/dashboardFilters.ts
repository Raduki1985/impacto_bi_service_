import type { ServiceOrder } from './dashboardTypes'

export type DashboardFilters = {
  dateFrom: string
  dateTo: string
  technician: string
  category: string
  status: string
  resolution: string
}

export const defaultDashboardFilters: DashboardFilters = {
  dateFrom: '2026-04-01',
  dateTo: '2026-06-30',
  technician: 'Todos',
  category: 'Todas',
  status: 'Todos',
  resolution: 'Todas',
}

export type FilterOptions = {
  technicians: string[]
  categories: string[]
  statuses: string[]
  resolutions: string[]
}

export function buildFilterOptions(rows: ServiceOrder[]): FilterOptions {
  return {
    technicians: unique(rows.map((row) => row.technician)),
    categories: unique(rows.map((row) => row.category)),
    statuses: unique(rows.map((row) => row.status)),
    resolutions: unique(rows.map((row) => row.resolution).filter(Boolean) as string[]),
  }
}

export function applyDashboardFilters(rows: ServiceOrder[], filters: DashboardFilters) {
  return rows.filter((row) => {
    if (row.dateISO < filters.dateFrom || row.dateISO > filters.dateTo) return false
    return matchesNonDateFilters(row, filters)
  })
}

const MS_PER_DAY = 86_400_000

function parseISODate(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function toISODate(ms: number): string {
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Janela imediatamente anterior à filtrada, de mesma duração. Ex.: filtro de
 * 01/06 a 30/06 (30 dias) → período anterior 02/05 a 31/05.
 */
export function previousPeriodRange(filters: DashboardFilters): { dateFrom: string; dateTo: string } {
  const from = parseISODate(filters.dateFrom)
  const to = parseISODate(filters.dateTo)
  const lengthDays = Math.round((to - from) / MS_PER_DAY) + 1
  const previousTo = from - MS_PER_DAY
  const previousFrom = previousTo - (lengthDays - 1) * MS_PER_DAY
  return { dateFrom: toISODate(previousFrom), dateTo: toISODate(previousTo) }
}

/** Mesmos filtros da tela, mas na janela anterior de mesmo tamanho. */
export function applyPreviousPeriodFilters(rows: ServiceOrder[], filters: DashboardFilters) {
  const range = previousPeriodRange(filters)
  return rows.filter((row) => {
    if (row.dateISO < range.dateFrom || row.dateISO > range.dateTo) return false
    return matchesNonDateFilters(row, filters)
  })
}

function matchesNonDateFilters(row: ServiceOrder, filters: DashboardFilters) {
  if (filters.technician !== 'Todos' && row.technician !== filters.technician) return false
  if (filters.category !== 'Todas' && row.category !== filters.category) return false
  if (filters.status !== 'Todos' && row.status !== filters.status) return false
  if (filters.resolution !== 'Todas' && row.resolution !== filters.resolution) return false

  return true
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
