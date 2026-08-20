import type { CommercialSaleStatus } from '../../../data/commercialTypes'
import { commercialSaleStatusLabels, type ActiveSaleRow } from './salesPeriodModel'

/**
 * Filtros e ordenação LOCAIS da tabela de Vendas por Período.
 *
 * São uma camada operacional de investigação, aplicada depois dos filtros
 * superiores da página. Eles nunca recalculam cards, gráfico ou composição por
 * origem: recebem as linhas que os filtros superiores já produziram e apenas
 * recortam o que a tabela mostra.
 */

/** Colunas que possuem filtro próprio no cabeçalho. */
export const SALES_TABLE_FILTER_COLUMNS = [
  'customers',
  'sellers',
  'cities',
  'plans',
  'value',
  'statuses',
] as const

export type SalesTableColumn = (typeof SALES_TABLE_FILTER_COLUMNS)[number]

/** Ordenação local. `null` preserva a ordem padrão por Data de Início. */
export type SalesTableSort = 'valor-asc' | 'valor-desc' | null

export type SalesTableFilters = {
  /** Identificados pelo rótulo do cliente, que é único por venda no mock. */
  readonly customers: readonly string[]
  readonly sellers: readonly string[]
  readonly cities: readonly string[]
  readonly plans: readonly string[]
  readonly statuses: readonly string[]
  readonly minValue: number | null
  readonly maxValue: number | null
}

export type SalesTableOption = {
  readonly value: string
  readonly label: string
  /** Texto secundário exibido e também pesquisável, hoje o CPF do cliente. */
  readonly hint?: string
}

export type SalesTableOptions = Record<
  Exclude<SalesTableColumn, 'value'>,
  readonly SalesTableOption[]
>

export function initialSalesTableFilters(): SalesTableFilters {
  return {
    customers: [],
    sellers: [],
    cities: [],
    plans: [],
    statuses: [],
    minValue: null,
    maxValue: null,
  }
}

/** Uma lista vazia significa "sem filtro", e não "nenhum valor selecionado". */
function matchesList(value: string, selected: readonly string[]): boolean {
  return selected.length === 0 || selected.includes(value)
}

/**
 * Colunas com filtro ativo.
 *
 * A tabela usa isso para marcar o cabeçalho, e a página para decidir se oferece
 * a ação de limpar. `value` cobre a faixa mínima e a máxima juntas.
 */
export function activeSalesTableColumns(filters: SalesTableFilters): Set<SalesTableColumn> {
  const active = new Set<SalesTableColumn>()

  if (filters.customers.length > 0) active.add('customers')
  if (filters.sellers.length > 0) active.add('sellers')
  if (filters.cities.length > 0) active.add('cities')
  if (filters.plans.length > 0) active.add('plans')
  if (filters.statuses.length > 0) active.add('statuses')
  if (filters.minValue !== null || filters.maxValue !== null) active.add('value')

  return active
}

export function hasActiveSalesTableFilters(filters: SalesTableFilters): boolean {
  return activeSalesTableColumns(filters).size > 0
}

/**
 * Aplica os filtros locais a uma linha.
 *
 * `ignore` existe para o cálculo das opções de um painel: ao montar a lista da
 * própria coluna, o filtro dela é desconsiderado, para o usuário conseguir
 * rever e ampliar a seleção em vez de ficar preso ao que já escolheu.
 */
export function matchesSalesTableFilters(
  row: ActiveSaleRow,
  filters: SalesTableFilters,
  ignore?: SalesTableColumn,
): boolean {
  if (ignore !== 'customers' && !matchesList(row.customerLabel, filters.customers)) return false
  if (ignore !== 'sellers' && !matchesList(row.sellerId, filters.sellers)) return false
  if (ignore !== 'cities' && !matchesList(row.cityId, filters.cities)) return false
  if (ignore !== 'plans' && !matchesList(row.planName, filters.plans)) return false
  if (ignore !== 'statuses' && !matchesList(row.status, filters.statuses)) return false

  if (ignore !== 'value') {
    if (filters.minValue !== null && row.monthlyValue < filters.minValue) return false
    if (filters.maxValue !== null && row.monthlyValue > filters.maxValue) return false
  }

  return true
}

/** Composição lógica E entre todas as colunas filtradas. */
export function applySalesTableFilters(
  rows: readonly ActiveSaleRow[],
  filters: SalesTableFilters,
): ActiveSaleRow[] {
  return rows.filter((row) => matchesSalesTableFilters(row, filters))
}

/**
 * Ordenação local.
 *
 * Só o valor mensal contratado é ordenável neste bloco. Sem ordenação local, a
 * ordem recebida é preservada, que é a padrão da página: Data de Início da mais
 * recente para a mais antiga. O desempate pelo id mantém o resultado
 * determinístico entre páginas.
 */
export function sortSalesTableRows(
  rows: readonly ActiveSaleRow[],
  sort: SalesTableSort,
): ActiveSaleRow[] {
  if (sort === null) return [...rows]

  const direction = sort === 'valor-asc' ? 1 : -1

  return [...rows].sort(
    (a, b) =>
      (a.monthlyValue - b.monthlyValue) * direction ||
      b.startDate.localeCompare(a.startDate) ||
      b.id.localeCompare(a.id),
  )
}

function sortOptions(options: SalesTableOption[]): SalesTableOption[] {
  return options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

/**
 * Opções de cada painel.
 *
 * Cada lista considera o universo entregue pelos filtros superiores e os demais
 * filtros locais já aplicados, ignorando apenas o filtro da própria coluna.
 * Nenhuma opção é inventada: todas saem das linhas presentes.
 */
export function buildSalesTableOptions(
  rows: readonly ActiveSaleRow[],
  filters: SalesTableFilters,
): SalesTableOptions {
  const customers = new Map<string, SalesTableOption>()
  const sellers = new Map<string, string>()
  const cities = new Map<string, string>()
  const plans = new Set<string>()
  const statuses = new Set<CommercialSaleStatus>()

  rows.forEach((row) => {
    if (matchesSalesTableFilters(row, filters, 'customers')) {
      customers.set(row.customerLabel, {
        value: row.customerLabel,
        label: row.customerLabel,
        hint: row.customerCpf,
      })
    }
    if (matchesSalesTableFilters(row, filters, 'sellers')) sellers.set(row.sellerId, row.sellerName)
    if (matchesSalesTableFilters(row, filters, 'cities')) cities.set(row.cityId, row.cityName)
    if (matchesSalesTableFilters(row, filters, 'plans')) plans.add(row.planName)
    if (matchesSalesTableFilters(row, filters, 'statuses')) statuses.add(row.status)
  })

  return {
    customers: sortOptions([...customers.values()]),
    sellers: sortOptions(
      [...sellers.entries()].map(([value, label]) => ({ value, label })),
    ),
    cities: sortOptions([...cities.entries()].map(([value, label]) => ({ value, label }))),
    plans: sortOptions([...plans].map((plan) => ({ value: plan, label: plan }))),
    statuses: sortOptions(
      [...statuses].map((status) => ({
        value: status,
        label: commercialSaleStatusLabels[status],
      })),
    ),
  }
}

/** Busca por rótulo e por texto secundário, sem acento e sem caixa. */
export function matchesOptionSearch(option: SalesTableOption, search: string): boolean {
  const term = normalizeSearch(search)
  if (term === '') return true

  return (
    normalizeSearch(option.label).includes(term) ||
    normalizeSearch(option.hint ?? '').includes(term)
  )
}

/** Faixa de diacríticos combinantes do Unicode, separada de NFD pelo normalize. */
const DIACRITICS = /[̀-ͯ]/g

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim()
}

export type CurrencyInputResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'value'; readonly value: number }

/**
 * Lê o valor digitado nos campos de faixa.
 *
 * Aceita os formatos que a própria interface exibe, como `R$ 1.234,56`, e
 * também a digitação direta em `1234,56` ou `1234.56`. O ponto só é tratado
 * como separador de milhar quando existe vírgula decimal ou quando o número
 * está agrupado de três em três, para `129.9` continuar valendo 129,9.
 *
 * Campo vazio não é erro: significa faixa aberta daquele lado.
 */
export function parseCurrencyInput(text: string): CurrencyInputResult {
  const cleaned = text.replace(/R\$/gi, '').replace(/\s/g, '').trim()
  if (cleaned === '') return { kind: 'empty' }

  let normalized = cleaned
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return { kind: 'invalid' }

  const value = Number(normalized)
  return Number.isFinite(value) ? { kind: 'value', value } : { kind: 'invalid' }
}

/** Faixa inválida é recusada com aviso, e nunca aplicada silenciosamente. */
export function isValueRangeInvalid(min: number | null, max: number | null): boolean {
  return min !== null && max !== null && min > max
}
