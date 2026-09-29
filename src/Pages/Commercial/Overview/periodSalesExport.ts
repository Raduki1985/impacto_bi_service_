import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { periodTitle } from '../../../data/overviewOsFilters'
import { formatDateBr, formatNumber } from '../../../lib/formatters'
import type { XlsxColumn, XlsxValue } from '../../../lib/xlsxWriter'
import type { CommercialOverviewFilters } from './overviewModel'
import { applyTodaySalesFilters, toSaleRow, type TodaySaleRow } from './todaySalesModel'

/**
 * Planilha de TODOS os contratos do período da Visão Geral Comercial, o
 * "Baixar N contratos em Excel" do título Resultado do período, no molde do
 * "Baixar N OS em Excel" da Visão Geral de OS.
 *
 * Regra decidida pelo Mário em 25/09/2026, entre três caminhos (só as
 * ativadas, só as vendidas, ou as duas): entram os contratos VENDIDOS no
 * período OU com o sinal ligado no período, cada um uma vez, com os filtros
 * da página. Duas colunas Sim/Não dizem por qual régua o contrato entrou, e
 * filtrando uma delas no Excel o gestor chega ao número de cada card:
 *
 * - "Ativada no período" = Sim: o card Vendas ativadas (sinal ligado no
 *   período, pela regra da venda ativada);
 * - "Vendida no período" = Sim: os vendidos do período, o vendido da Safra
 *   quando o período é um mês inteiro (até 28/09/2026, a base do card
 *   Aguardando Ativação, que saiu da página).
 *
 * Contrato com sinal gravado no período que o serviço não conta como
 * ativado, vendido antes do período, não entra: não pertence a card nenhum.
 *
 * A página só recebe números somados, então os contratos vêm da consulta de
 * contratos do serviço (a mesma do Hoje ao vivo e da janela de contratos),
 * pedida para o período inteiro. As colunas e o texto de cada célula são os
 * da planilha dessas listas (`todaySalesExport`).
 */

export type PeriodRange = { readonly dateFrom: string; readonly dateTo: string }

function within(day: string | null, range: PeriodRange): boolean {
  return day !== null && day >= range.dateFrom && day <= range.dateTo
}

/** Vendido no período, pela data da venda. */
export function soldInPeriod(record: CommercialSaleRecord, range: PeriodRange): boolean {
  return within(record.contractedOn, range)
}

/** Ativado no período: conta como ativado, com o sinal no período. */
export function activatedInPeriod(record: CommercialSaleRecord, range: PeriodRange): boolean {
  return record.activated && within(record.startedOn, range)
}

/** O período da página, nas datas que a consulta usa. */
export function periodRangeOf(filters: CommercialOverviewFilters): PeriodRange {
  return { dateFrom: filters.startDate, dateTo: filters.endDate }
}

/** Os contratos da planilha: vendidos ou ativados no período, com os filtros da página. */
export function selectPeriodSales(
  records: readonly CommercialSaleRecord[],
  filters: CommercialOverviewFilters,
): CommercialSaleRecord[] {
  const range = periodRangeOf(filters)

  return applyTodaySalesFilters(records, filters).filter(
    (record) => soldInPeriod(record, range) || activatedInPeriod(record, range),
  )
}

/**
 * Linhas da planilha, a venda mais recente primeiro, como a planilha do
 * período da OS; no mesmo dia, a hora do registro, e depois o código.
 */
export function buildPeriodSalesRows(
  records: readonly CommercialSaleRecord[],
  today: string,
): TodaySaleRow[] {
  return records
    .map((record) => toSaleRow(record, today))
    .sort(
      (a, b) =>
        (b.soldOn ?? '').localeCompare(a.soldOn ?? '') ||
        (b.source.createdAt ?? '').localeCompare(a.source.createdAt ?? '') ||
        a.id.localeCompare(b.id, 'pt-BR'),
    )
}

/** Texto do botão: diz quantos e em que formato. */
export function periodSalesDownloadLabel(count: number): string {
  return count === 1 ? 'Baixar 1 contrato em Excel' : `Baixar ${formatNumber(count)} contratos em Excel`
}

const yesNo = (value: boolean) => (value ? 'Sim' : 'Não')

/** As duas colunas a mais, no fim da aba dos contratos, e o valor de cada linha. */
export function periodSalesExtraColumns(range: PeriodRange): {
  readonly columns: readonly XlsxColumn[]
  readonly values: (row: TodaySaleRow) => XlsxValue[]
} {
  return {
    columns: [
      { header: 'Vendida no período', width: 19, type: 'text' },
      { header: 'Ativada no período', width: 19, type: 'text' },
    ],
    values: (row) => [
      yesNo(soldInPeriod(row.source, range)),
      yesNo(activatedInPeriod(row.source, range)),
    ],
  }
}

/**
 * Seleção, Período e a nota de como chegar aos cards, no topo da aba Filtros;
 * o resto da aba é o de toda planilha de contratos da página
 * (`salesExportInfoTail`).
 */
export function periodSalesExportHead(range: PeriodRange): [string, string][] {
  return [
    ['Seleção', 'Todos os contratos do período'],
    [
      'Período',
      `${periodTitle(range)}: vendidos ou com sinal ligado de ${formatDateBr(range.dateFrom)} a ${formatDateBr(range.dateTo)}`,
    ],
    [
      'Como usar',
      'Ativada no período = Sim fecha com o card Vendas ativadas; Vendida no período = Sim fecha com o vendido da Safra quando o período é um mês inteiro',
    ],
  ]
}

/** `contratos-2026-09-01-a-2026-09-24.xlsx`, como o nome da planilha do período da OS. */
export function periodSalesFileName(range: PeriodRange): string {
  return `contratos-${range.dateFrom}-a-${range.dateTo}.xlsx`
}
