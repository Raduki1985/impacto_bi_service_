import type { ServiceOrder } from './dashboardTypes'
import {
  OS_CITIES,
  OS_PERIOD,
  OS_RESOLUTIONS,
  OS_SERVICE_TYPES,
  OS_STATUSES,
  OS_TEAMS,
} from './mockOsCatalog'

/**
 * Os sete filtros aprovados da Visão Geral de OS: Início, Fim, Equipe,
 * Tipo de OS, Cidade, Status e Resolução. Todos de seleção simples.
 */
export type DashboardFilters = {
  dateFrom: string
  dateTo: string
  team: string
  serviceType: string
  city: string
  status: string
  resolution: string
}

export const defaultDashboardFilters: DashboardFilters = {
  dateFrom: OS_PERIOD.start,
  dateTo: OS_PERIOD.end,
  team: 'Todas',
  serviceType: 'Todos',
  city: 'Todas',
  status: 'Todos',
  resolution: 'Todas',
}

/** Rótulos de exibição dos sete filtros, na ordem aprovada. */
const dashboardFilterLabels: Record<keyof DashboardFilters, string> = {
  dateFrom: 'Início',
  dateTo: 'Fim',
  team: 'Equipe',
  serviceType: 'Tipo de OS',
  city: 'Cidade',
  status: 'Status',
  resolution: 'Resolução',
}

export type ActiveDashboardFilter = {
  field: keyof DashboardFilters
  label: string
  value: string
}

/** Confirma uma data ISO real no formato aceito pelos controles `date`. */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Mantém o período completo e ordenado antes de publicar um novo filtro. */
export function updateDashboardFilter(
  current: DashboardFilters,
  key: keyof DashboardFilters,
  value: string,
): DashboardFilters {
  const next = { ...current, [key]: value }

  if (
    (key === 'dateFrom' || key === 'dateTo') &&
    (!isValidISODate(next.dateFrom) ||
      !isValidISODate(next.dateTo) ||
      next.dateFrom > next.dateTo)
  ) {
    return current
  }

  return next
}

/**
 * Campos diferentes de `defaultDashboardFilters`, na ordem aprovada dos sete
 * filtros. Datas alteradas contam; o período padrão intacto não conta. Fonte
 * única da contagem e dos chips do painel de filtros, para o componente e os
 * testes não repetirem a comparação.
 */
export function listActiveDashboardFilters(filters: DashboardFilters): ActiveDashboardFilter[] {
  return (Object.keys(dashboardFilterLabels) as (keyof DashboardFilters)[])
    .filter((field) => filters[field] !== defaultDashboardFilters[field])
    .map((field) => ({ field, label: dashboardFilterLabels[field], value: filters[field] }))
}

export type FilterOptions = {
  teams: string[]
  serviceTypes: string[]
  cities: string[]
  statuses: string[]
  resolutions: string[]
}

/**
 * As opções saem dos catálogos normalizados, e não dos dados: assim nunca
 * aparecem valores crus ou duplicados, e "Sem técnico"/"Sem equipe" jamais
 * viram opção do filtro Equipe. Equipes e status ficam na ordem de negócio do
 * catálogo; cidades e resoluções, em ordem alfabética.
 */
export function buildFilterOptions(): FilterOptions {
  return {
    teams: [...OS_TEAMS],
    serviceTypes: [...OS_SERVICE_TYPES],
    cities: [...OS_CITIES].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    statuses: [...OS_STATUSES],
    resolutions: [...OS_RESOLUTIONS].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }
}

export function applyDashboardFilters(rows: ServiceOrder[], filters: DashboardFilters) {
  if (!isValidDashboardDateRange(filters)) return []

  return rows.filter((row) => {
    if (row.dateISO < filters.dateFrom || row.dateISO > filters.dateTo) return false
    return matchesNonDateFilters(row, filters)
  })
}

function isValidDashboardDateRange(
  filters: Pick<DashboardFilters, 'dateFrom' | 'dateTo'>,
): boolean {
  return (
    isValidISODate(filters.dateFrom) &&
    isValidISODate(filters.dateTo) &&
    filters.dateFrom <= filters.dateTo
  )
}

const MS_PER_DAY = 86_400_000

/**
 * Data ISO como instante UTC, e o caminho de volta. Exportados desde
 * 22/09/2026 para a Visão Geral de OS montar a janela anterior pela natureza
 * do recorte (`overviewOsFilters.ts`) com a MESMA aritmética de datas daqui.
 */
export function parseISODate(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function toISODate(ms: number): string {
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Janela imediatamente anterior à filtrada, de mesma duração. Ex.: filtro de
 * 01/08 a 21/08 (21 dias) → período anterior 11/07 a 31/07.
 *
 * Recebe só o par de datas para servir também à Visão Geral, que tem filtros
 * próprios: um `DashboardFilters` completo continua sendo aceito como antes.
 */
export function previousPeriodRange(
  filters: Pick<DashboardFilters, 'dateFrom' | 'dateTo'>,
): { dateFrom: string; dateTo: string } | null {
  if (!isValidDashboardDateRange(filters)) return null

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
  if (!range) return []

  return rows.filter((row) => {
    if (row.dateISO < range.dateFrom || row.dateISO > range.dateTo) return false
    return matchesNonDateFilters(row, filters)
  })
}

function matchesNonDateFilters(row: ServiceOrder, filters: DashboardFilters) {
  if (filters.team !== 'Todas' && row.team !== filters.team) return false
  if (filters.serviceType !== 'Todos' && row.serviceType !== filters.serviceType) return false
  if (filters.city !== 'Todas' && row.city !== filters.city) return false
  if (filters.status !== 'Todos' && row.status !== filters.status) return false
  if (filters.resolution !== 'Todas' && row.resolution !== filters.resolution) return false

  return true
}
