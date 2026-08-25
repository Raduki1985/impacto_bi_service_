import { salesPeriodOriginLabels, type ActiveSaleRow } from './salesPeriodModel'

/**
 * Filtros e ordenação LOCAIS da tabela de Vendas por Período.
 *
 * São uma camada operacional de investigação, aplicada depois dos filtros
 * superiores da página. Eles nunca recalculam cards, gráfico ou composição por
 * origem: recebem as linhas que os filtros superiores já produziram e apenas
 * recortam e reordenam o que a tabela mostra.
 *
 * Status atual não tem filtro próprio. O universo da página já é fixo em vendas
 * atualmente ativas, então a coluna existe para leitura, não para recorte.
 */

/** Colunas que possuem filtro próprio no cabeçalho. */
export const SALES_TABLE_FILTER_COLUMNS = [
  'startDate',
  'contract',
  'customers',
  'sellers',
  'cities',
  'plans',
  'value',
  'origins',
] as const

export type SalesTableColumn = (typeof SALES_TABLE_FILTER_COLUMNS)[number]

/** Colunas cujo painel é uma lista de seleção múltipla. */
export type SalesTableListColumn = 'customers' | 'sellers' | 'cities' | 'plans' | 'origins'

/** Ordenação local. `null` preserva a ordem padrão da página. */
export type SalesTableSort =
  | 'data-desc'
  | 'data-asc'
  | 'contrato-asc'
  | 'contrato-desc'
  | 'cliente-asc'
  | 'cliente-desc'
  | 'vendedor-asc'
  | 'vendedor-desc'
  | 'cidade-asc'
  | 'cidade-desc'
  | 'plano-asc'
  | 'plano-desc'
  | 'valor-desc'
  | 'valor-asc'
  | 'origem-asc'
  | 'origem-desc'
  | null

export type SalesTableFilters = {
  /** Data de Início em ISO. `null` em um dos lados significa faixa aberta. */
  readonly startDateFrom: string | null
  readonly startDateTo: string | null
  /** Pesquisa parcial por contrato. Texto vazio significa "sem filtro". */
  readonly contract: string
  /** Identificados pelo rótulo do cliente, que é único por venda no mock. */
  readonly customers: readonly string[]
  readonly sellers: readonly string[]
  readonly cities: readonly string[]
  readonly plans: readonly string[]
  readonly origins: readonly string[]
  readonly minValue: number | null
  readonly maxValue: number | null
}

export type SalesTableOption = {
  readonly value: string
  readonly label: string
  /** Texto secundário exibido e também pesquisável, hoje o CPF do cliente. */
  readonly hint?: string
}

export type SalesTableOptions = Record<SalesTableListColumn, readonly SalesTableOption[]>

export function initialSalesTableFilters(): SalesTableFilters {
  return {
    startDateFrom: null,
    startDateTo: null,
    contract: '',
    customers: [],
    sellers: [],
    cities: [],
    plans: [],
    origins: [],
    minValue: null,
    maxValue: null,
  }
}

/** Uma lista vazia significa "sem filtro", e não "nenhum valor selecionado". */
function matchesList(value: string, selected: readonly string[]): boolean {
  return selected.length === 0 || selected.includes(value)
}

/* -------------------------------------------------------------------------- */
/* Estado ativo por coluna                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Colunas com filtro ativo.
 *
 * A tabela usa isso para marcar o cabeçalho, e a página para decidir se oferece
 * a ação de restaurar. Ordenação não entra aqui: uma coluna apenas ordenada não
 * é uma coluna filtrada. `value` cobre a faixa mínima e a máxima juntas, e
 * `startDate` cobre as duas pontas do intervalo.
 */
export function activeSalesTableColumns(filters: SalesTableFilters): Set<SalesTableColumn> {
  const active = new Set<SalesTableColumn>()

  if (filters.startDateFrom !== null || filters.startDateTo !== null) active.add('startDate')
  if (filters.contract.trim() !== '') active.add('contract')
  if (filters.customers.length > 0) active.add('customers')
  if (filters.sellers.length > 0) active.add('sellers')
  if (filters.cities.length > 0) active.add('cities')
  if (filters.plans.length > 0) active.add('plans')
  if (filters.origins.length > 0) active.add('origins')
  if (filters.minValue !== null || filters.maxValue !== null) active.add('value')

  return active
}

export function hasActiveSalesTableFilters(filters: SalesTableFilters): boolean {
  return activeSalesTableColumns(filters).size > 0
}

/* -------------------------------------------------------------------------- */
/* Filtragem                                                                    */
/* -------------------------------------------------------------------------- */

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
  if (ignore !== 'startDate') {
    if (filters.startDateFrom !== null && row.startDate < filters.startDateFrom) return false
    if (filters.startDateTo !== null && row.startDate > filters.startDateTo) return false
  }
  if (ignore !== 'contract' && !matchesContractSearch(row.contractCode, filters.contract)) {
    return false
  }
  if (ignore !== 'customers' && !matchesList(row.customerLabel, filters.customers)) return false
  if (ignore !== 'sellers' && !matchesList(row.sellerId, filters.sellers)) return false
  if (ignore !== 'cities' && !matchesList(row.cityId, filters.cities)) return false
  if (ignore !== 'plans' && !matchesList(row.planName, filters.plans)) return false
  if (ignore !== 'origins' && !matchesList(row.origin, filters.origins)) return false

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

/* -------------------------------------------------------------------------- */
/* Ordenação                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Comparação textual em português do Brasil.
 *
 * `sensitivity: 'base'` iguala maiúsculas, minúsculas e acentos, então Ávila e
 * avila ficam lado a lado em vez de em pontas opostas da lista. `numeric` faz
 * 2 Giga vir antes de 10 Giga.
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

export type SalesTableSortKey = NonNullable<SalesTableSort>

/** Como uma ordenação se identifica no cabeçalho, no painel e no resumo. */
export type SalesTableSortSpec = {
  /** Coluna que exibe esta ordenação no cabeçalho. */
  readonly column: SalesTableColumn
  readonly direction: 'asc' | 'desc'
  readonly label: string
}

type SortSpec = SalesTableSortSpec & {
  readonly compare: (a: ActiveSaleRow, b: ActiveSaleRow) => number
}

function byText(
  pick: (row: ActiveSaleRow) => string,
  direction: 1 | -1,
): (a: ActiveSaleRow, b: ActiveSaleRow) => number {
  return (a, b) => collator.compare(pick(a), pick(b)) * direction
}

const contractKey = (row: ActiveSaleRow) => normalizeContract(row.contractCode)
const originLabel = (row: ActiveSaleRow) => salesPeriodOriginLabels[row.origin]

/** Alfabética nas colunas textuais, com o rótulo curto que os painéis exibem. */
const AZ = { direction: 'asc', label: 'A–Z' } as const
const ZA = { direction: 'desc', label: 'Z–A' } as const

const SORT_SPECS: Record<SalesTableSortKey, SortSpec> = {
  'data-desc': {
    column: 'startDate',
    direction: 'desc',
    label: 'Mais recente primeiro',
    compare: (a, b) => b.startDate.localeCompare(a.startDate),
  },
  'data-asc': {
    column: 'startDate',
    direction: 'asc',
    label: 'Mais antiga primeiro',
    compare: (a, b) => a.startDate.localeCompare(b.startDate),
  },
  // Contrato é identificador, não valor: compara o código normalizado.
  'contrato-asc': {
    column: 'contract',
    direction: 'asc',
    label: 'Código crescente',
    compare: byText(contractKey, 1),
  },
  'contrato-desc': {
    column: 'contract',
    direction: 'desc',
    label: 'Código decrescente',
    compare: byText(contractKey, -1),
  },
  'cliente-asc': { column: 'customers', ...AZ, compare: byText((row) => row.customerLabel, 1) },
  'cliente-desc': { column: 'customers', ...ZA, compare: byText((row) => row.customerLabel, -1) },
  'vendedor-asc': { column: 'sellers', ...AZ, compare: byText((row) => row.sellerName, 1) },
  'vendedor-desc': { column: 'sellers', ...ZA, compare: byText((row) => row.sellerName, -1) },
  'cidade-asc': { column: 'cities', ...AZ, compare: byText((row) => row.cityName, 1) },
  'cidade-desc': { column: 'cities', ...ZA, compare: byText((row) => row.cityName, -1) },
  'plano-asc': { column: 'plans', ...AZ, compare: byText((row) => row.planName, 1) },
  'plano-desc': { column: 'plans', ...ZA, compare: byText((row) => row.planName, -1) },
  // Maior valor primeiro é a leitura gerencial mais comum desta coluna.
  'valor-desc': {
    column: 'value',
    direction: 'desc',
    label: 'Maior valor primeiro',
    compare: (a, b) => b.monthlyValue - a.monthlyValue,
  },
  'valor-asc': {
    column: 'value',
    direction: 'asc',
    label: 'Menor valor primeiro',
    compare: (a, b) => a.monthlyValue - b.monthlyValue,
  },
  'origem-asc': { column: 'origins', ...AZ, compare: byText(originLabel, 1) },
  'origem-desc': { column: 'origins', ...ZA, compare: byText(originLabel, -1) },
}

/** Coluna, sentido e rótulo de uma ordenação. `null` quando não há nenhuma. */
export function salesTableSortSpec(sort: SalesTableSort): SalesTableSortSpec | null {
  if (sort === null) return null

  const { column, direction, label } = SORT_SPECS[sort]
  return { column, direction, label }
}

/** Coluna que deve indicar ordenação ativa no cabeçalho. */
export function salesTableSortColumn(sort: SalesTableSort): SalesTableColumn | null {
  return sort === null ? null : SORT_SPECS[sort].column
}

/**
 * Ordenação local.
 *
 * Só uma ordenação fica ativa por vez, e ela nunca altera o conjunto de linhas:
 * apenas a posição. Sem ordenação local, a ordem recebida é preservada, que é a
 * padrão da página, Data de Início da mais recente para a mais antiga.
 *
 * O desempate é a posição original da linha. Assim, linhas com a mesma chave
 * mantêm a ordem padrão em vez de trocarem de lugar entre páginas.
 */
export function sortSalesTableRows(
  rows: readonly ActiveSaleRow[],
  sort: SalesTableSort,
): ActiveSaleRow[] {
  if (sort === null) return [...rows]

  const { compare } = SORT_SPECS[sort]

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compare(a.row, b.row) || a.index - b.index)
    .map((entry) => entry.row)
}

/* -------------------------------------------------------------------------- */
/* Opções dos painéis de lista                                                  */
/* -------------------------------------------------------------------------- */

function sortOptions(options: SalesTableOption[]): SalesTableOption[] {
  return options.sort((a, b) => collator.compare(a.label, b.label))
}

function optionsFromMap(entries: Map<string, string>): SalesTableOption[] {
  return sortOptions([...entries.entries()].map(([value, label]) => ({ value, label })))
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
  const origins = new Map<string, string>()

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
    if (matchesSalesTableFilters(row, filters, 'origins')) {
      origins.set(row.origin, salesPeriodOriginLabels[row.origin])
    }
  })

  return {
    customers: sortOptions([...customers.values()]),
    sellers: optionsFromMap(sellers),
    cities: optionsFromMap(cities),
    plans: sortOptions([...plans].map((plan) => ({ value: plan, label: plan }))),
    origins: optionsFromMap(origins),
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

/* -------------------------------------------------------------------------- */
/* Contrato                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Forma comparável do código de contrato.
 *
 * O `#` é decoração de exibição, e espaços e pontuação não fazem parte do
 * identificador. Normalizar os dois lados deixa a busca alcançar a mesma venda
 * com ou sem `#`, sem nunca alterar o código exibido na linha.
 */
export function normalizeContract(value: string): string {
  return value.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()
}

/** Pesquisa parcial. Texto vazio ou só com pontuação significa "sem filtro". */
export function matchesContractSearch(contractCode: string, search: string): boolean {
  const term = normalizeContract(search)
  if (term === '') return true

  return normalizeContract(contractCode).includes(term)
}

/* -------------------------------------------------------------------------- */
/* Entradas dos painéis de faixa                                                */
/* -------------------------------------------------------------------------- */

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

/**
 * Lê uma ponta do intervalo de Data de Início.
 *
 * O campo nativo de data já entrega ISO, então só o vazio e o rascunho
 * incompleto precisam de tratamento: ambos significam faixa aberta daquele
 * lado, e não erro.
 */
export function parseDateInput(text: string): string | null {
  const trimmed = text.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

/** Data inicial posterior à final é recusada com aviso, como na faixa de valor. */
export function isDateRangeInvalid(from: string | null, to: string | null): boolean {
  return from !== null && to !== null && from > to
}
