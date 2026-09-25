import {
  compareBrDates,
  compareNumberedCodes,
  type ListColumn,
  type ListTableFilters,
  type ListTableRules,
} from '../../../components/dashboard/listTableModel'
import { formatDateBr } from '../../../lib/formatters'
import type { TodaySaleRow } from './todaySalesModel'

/**
 * Colunas da lista de contratos da faixa Hoje ao vivo da Visão Geral
 * Comercial (25/09/2026), sobre a lista do portal (`ListTable`): o que fica
 * aqui é só o que é da venda: as colunas, o texto de cada célula, o que é
 * ausência e o desempate pelo código do contrato.
 *
 * O filtro vale SÓ para a lista aberta; os filtros da página continuam na
 * faixa de cima. `Detalhe` fica sem painel de propósito: mistura a hora do
 * sinal, a visita e há quanto tempo a etapa espera, conforme a caixa, e
 * recortar por essa lista confundiria. O código do contrato ordena por
 * número e não filtra; o valor ordena pelo número e não pelo texto; a Venda
 * ordena pelo calendário. Larguras somam o mesmo da lista de OS de hoje,
 * para a tabela caber na faixa sem rolar para o lado.
 */

/** Ausência na coluna Detalhe: traço discreto, o mesmo das listas de OS. */
export const TODAY_SALES_EMPTY_DETAIL = '·'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `R$ 1.299,90` -> 1299.9, para ordenar o valor pelo número. */
function amountOf(text: string): number {
  const digits = text.replace(/[^\d,]/g, '').replace(',', '.')
  const value = Number(digits)

  return Number.isFinite(value) ? value : 0
}

function compareAmounts(a: string, b: string): number {
  return amountOf(a) - amountOf(b)
}

// Valor com 108 desde 25/09/2026: com 86, "R$ 1.200,00" saía cortado (a
// célula mede 79 px de texto mais 20 de respiro, e "R$ 12.000,00" mede 86).
// Os 22 px saíram de Contrato (8 dígitos cabem em 86) e de Plano, que já
// corta os nomes longos, para a soma continuar a mesma.
const COLUMN_SPECS = [
  { key: 'id', label: 'Contrato', width: 86, filterable: false, sortable: true, compare: compareNumberedCodes },
  { key: 'soldOn', label: 'Venda', width: 98, filterable: true, sortable: true, sortKind: 'date', compare: compareBrDates },
  { key: 'time', label: 'Hora', width: 72, filterable: false, sortable: true },
  { key: 'seller', label: 'Vendedor', width: 120, filterable: true, sortable: true, searchable: true },
  { key: 'team', label: 'Time', width: 84, filterable: true, sortable: true },
  { key: 'city', label: 'Cidade', width: 90, filterable: true, sortable: true, searchable: true },
  { key: 'plan', label: 'Plano', width: 98, filterable: true, sortable: true, searchable: true },
  { key: 'value', label: 'Valor', width: 108, filterable: false, sortable: true, compare: compareAmounts },
  // "Tipo" e não "Cliente": o nome da coluna precisa caber ao lado do botão
  // do filtro, e PF ou PJ é o tipo do cliente.
  { key: 'personType', label: 'Tipo', width: 64, filterable: true, sortable: true },
  { key: 'status', label: 'Situação', width: 96, filterable: true, sortable: true },
  { key: 'detail', label: 'Detalhe', width: 176, filterable: false, sortable: false },
] as const satisfies readonly Omit<ListColumn<TodaySaleRow>, 'text'>[]

/** Chave de coluna, saída da própria lista acima: não existe chave sem coluna. */
export type TodaySalesColumnKey = (typeof COLUMN_SPECS)[number]['key']

export type TodaySalesColumn = ListColumn<TodaySaleRow, TodaySalesColumnKey>

/** Rótulos de ausência, os MESMOS que a célula escreve: viram opção de filtro e vão para o fim. */
export const TODAY_SALES_NO_SELLER_LABEL = 'Sem vendedor'
const NO_TEAM_LABEL = 'Sem time'
const NO_TIME_LABEL = 'Sem hora'
const NO_DATE_LABEL = 'Sem data'
const NO_PERSON_TYPE_LABEL = 'Sem tipo'

export const PERSON_TYPE_LABELS: Readonly<Record<'pf' | 'pj', string>> = { pf: 'PF', pj: 'PJ' }

/**
 * Texto que a célula mostra, e também o valor pelo qual a coluna filtra e
 * ordena. Um só lugar decide isso: tela, filtro e ordenação nunca divergem.
 */
export function todaySalesCellText(row: TodaySaleRow, column: TodaySalesColumnKey): string {
  switch (column) {
    case 'id':
      return row.id
    case 'soldOn':
      return row.soldOn === null ? NO_DATE_LABEL : formatDateBr(row.soldOn)
    case 'time':
      return row.time ?? NO_TIME_LABEL
    case 'seller':
      return row.seller ?? TODAY_SALES_NO_SELLER_LABEL
    case 'team':
      return row.team ?? NO_TEAM_LABEL
    case 'city':
      return row.city
    case 'plan':
      return row.plan
    case 'value':
      return currency.format(row.value)
    case 'personType':
      return row.personType === null ? NO_PERSON_TYPE_LABEL : PERSON_TYPE_LABELS[row.personType]
    case 'status':
      return row.status
    case 'detail':
      return row.detail ?? TODAY_SALES_EMPTY_DETAIL
  }
}

export const TODAY_SALES_COLUMNS: readonly TodaySalesColumn[] = COLUMN_SPECS.map((spec) => ({
  ...spec,
  text: (row: TodaySaleRow) => todaySalesCellText(row, spec.key),
}))

export type TodaySalesTableFilters = ListTableFilters<TodaySalesColumnKey>

const MISSING_LABELS: ReadonlySet<string> = new Set([
  TODAY_SALES_NO_SELLER_LABEL,
  NO_TEAM_LABEL,
  NO_TIME_LABEL,
  NO_DATE_LABEL,
  NO_PERSON_TYPE_LABEL,
  TODAY_SALES_EMPTY_DETAIL,
])

/** A ausência vai para o fim, e o empate na ordenação volta ao código do contrato. */
export const TODAY_SALES_TABLE_RULES: ListTableRules<TodaySaleRow> = {
  missing: MISSING_LABELS,
  tieBreak: (a, b) => compareNumberedCodes(a.id, b.id),
}
