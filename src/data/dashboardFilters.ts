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
    if (filters.technician !== 'Todos' && row.technician !== filters.technician) return false
    if (filters.category !== 'Todas' && row.category !== filters.category) return false
    if (filters.status !== 'Todos' && row.status !== filters.status) return false
    if (filters.resolution !== 'Todas' && row.resolution !== filters.resolution) return false

    return true
  })
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
