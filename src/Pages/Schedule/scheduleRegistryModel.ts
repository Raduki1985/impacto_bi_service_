import type { ListColumn, ListTableFilters } from '../../components/dashboard/listTableModel'
import { formatIsoDateTimeBr, formatNumber } from '../../lib/formatters'
import { buildXlsx, type XlsxColumn, type XlsxValue } from '../../lib/xlsxWriter'
import type { RegistryLine } from './scheduleModel'

/**
 * As colunas e a planilha da janela do cadastro de aptidões (19/10/2026).
 * Em arquivo próprio, fora do componente, como `todayOsTableModel` e
 * `osListExport` da Visão Geral de OS: exportar valor de um arquivo de
 * componente quebra a atualização instantânea do `npm run dev`.
 */

export type RegistryKey =
  | 'technician'
  | 'teams'
  | 'category'
  | 'serviceType'
  | 'orders'
  | 'status'
  | 'aptTechnicians'

const compareNumbers = (a: string, b: string) => Number(a) - Number(b)

export const REGISTRY_COLUMNS: readonly ListColumn<RegistryLine, RegistryKey>[] = [
  {
    key: 'technician',
    label: 'Técnico',
    width: 220,
    filterable: true,
    sortable: true,
    searchable: true,
    text: (row) => row.technician,
  },
  { key: 'teams', label: 'Equipe', width: 180, filterable: true, sortable: true, text: (row) => row.teams },
  {
    key: 'category',
    label: 'Categoria',
    width: 260,
    filterable: true,
    sortable: true,
    searchable: true,
    text: (row) => row.category,
  },
  { key: 'serviceType', label: 'Tipo', width: 150, filterable: true, sortable: true, text: (row) => row.serviceType },
  {
    key: 'orders',
    label: 'OS sem aptidão',
    width: 130,
    filterable: false,
    sortable: true,
    compare: compareNumbers,
    text: (row) => String(row.orders),
  },
  { key: 'status', label: 'Situação', width: 100, filterable: true, sortable: true, text: (row) => row.status },
  {
    key: 'aptTechnicians',
    label: 'Aptos no cadastro',
    width: 140,
    filterable: false,
    sortable: true,
    compare: compareNumbers,
    text: (row) => String(row.aptTechnicians),
  },
]

const EXPORT_COLUMNS: readonly XlsxColumn[] = [
  { header: 'Técnico', width: 28, type: 'text' },
  { header: 'Equipe', width: 24, type: 'text' },
  { header: 'Categoria', width: 36, type: 'text' },
  { header: 'Tipo', width: 18, type: 'text' },
  { header: 'OS sem aptidão', width: 16, type: 'decimal' },
  { header: 'Situação', width: 12, type: 'text' },
  { header: 'Aptos no cadastro', width: 18, type: 'decimal' },
]

const INFO_COLUMNS: readonly XlsxColumn[] = [
  { header: 'Item', width: 22, type: 'text', bold: true },
  { header: 'Valor', width: 100, type: 'text' },
]

/** Filtros de coluna e busca da lista em texto, para a aba de recorte; null sem nenhum. */
export function registryFiltersText(filters: ListTableFilters<RegistryKey>, search = ''): string | null {
  const parts = REGISTRY_COLUMNS.flatMap((column) => {
    const selected = filters[column.key] ?? []

    return selected.length === 0 ? [] : [`${column.label}: ${selected.join(', ')}`]
  })
  if (search.trim() !== '') parts.push(`Busca: "${search.trim()}"`)

  return parts.length === 0 ? null : parts.join(' · ')
}

export type RegistryExportContext = {
  readonly historyDays: number
  readonly listFilters: string | null
  /** Hora em que o serviço leu o banco, ISO com fuso; null sem a informação. */
  readonly readAt: string | null
  /** Hora do clique em Baixar, já escrita. */
  readonly generatedAt: string
}

function exportRow(line: RegistryLine): XlsxValue[] {
  return [line.technician, line.teams, line.category, line.serviceType, line.orders, line.status, line.aptTechnicians]
}

/** O arquivo inteiro: a aba das linhas, como Tabela do Excel, e a aba do recorte. */
export function buildRegistryWorkbook(
  lines: readonly RegistryLine[],
  context: RegistryExportContext,
): Uint8Array<ArrayBuffer> {
  const info: [string, string][] = [
    ['Lista', 'Cadastro de aptidões a corrigir no SGI'],
    ['Período', `Últimos ${formatNumber(context.historyDays)} dias`],
    ['Filtros da lista', context.listFilters ?? 'Nenhum'],
    ['Linhas na planilha', formatNumber(lines.length)],
  ]
  const readAt = context.readAt === null ? null : formatIsoDateTimeBr(context.readAt)
  if (readAt !== null) info.push(['Dados lidos em', readAt])
  info.push(['Gerada em', context.generatedAt])

  return buildXlsx([
    { name: 'Aptidoes', table: 'CadastroDeAptidoes', columns: EXPORT_COLUMNS, rows: lines.map(exportRow) },
    { name: 'Filtros', columns: INFO_COLUMNS, rows: info },
  ])
}

/** `cadastro-aptidoes-sgi-2026-10-19.xlsx`. */
export function registryFileName(today: string): string {
  return `cadastro-aptidoes-sgi-${today}.xlsx`
}
