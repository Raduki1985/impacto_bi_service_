import type {
  CommercialPeriodRange,
  CommercialPeriodSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { periodTitle } from '../../../data/overviewOsFilters'
import { formatDateBr, formatNumber } from '../../../lib/formatters'
import type { XlsxColumn, XlsxValue } from '../../../lib/xlsxWriter'
import type { CommercialOverviewFilters } from './overviewModel'
import type { TodaySaleRow } from './todaySalesModel'

/**
 * A janela do card Vendas ativadas, aberta pelo ícone de planilha do card
 * (06/10/2026, decisões do Mário no mesmo dia).
 *
 * Ela obedece ao card: lista os contratos que ligaram o sinal no período, o
 * número em destaque, e os separa do jeito que a frente do card separa,
 * vendidos no período e vendidos antes dele. Três atalhos, na ordem da
 * leitura do card (87, 59 e 28), e a janela abre no total. Nada de parágrafo
 * nem de contagem nova: quem clicou em 87 precisa ver os 87, não outra
 * história.
 *
 * O caminho até aqui, todo em 06/10/2026: a janela nasceu contando também o
 * vendido no período (114) e o destino das vendas que não ativaram dentro
 * dele (ativaram depois, em fluxo, canceladas), com um parágrafo e seis
 * atalhos. Era a confusão do card repetida num lugar maior: quem clicava em
 * "87" caía numa janela que falava de 114. O Mário decidiu que o vendido e
 * o destino das vendas são assunto da Safra (e de um card próprio, em
 * estudo), e a janela ficou só com o que o card conta. Versões recusadas no
 * mesmo dia, não repropor: atalhos soltos com "Todas", duas linhas de
 * atalhos (uma por régua), e a conta dentro de um quadro clicável.
 *
 * História do lugar: de 25/09 a 06/10/2026 havia um botão de baixar no
 * título Resultado do período, "Baixar N vendas em Excel" com os vendidos
 * OU ativados (774 em setembro) e, desde 02/10, "Baixar as N vendidas em
 * Excel" só com os vendidos (707). O número dele não era o de card nenhum,
 * e ele saiu.
 *
 * Os contratos vêm do serviço só no clique (`/period/records`, com os
 * filtros da página): os vendidos OU ativados no período, cada um marcado
 * com as duas réguas e com a situação de hoje. A janela fica com os
 * ativados; os só vendidos viajam e não aparecem, e a leitura continua uma
 * só. Quem ativou no período e cancelou depois aparece como Cancelada na
 * coluna Situação, a regra do card (cancelamento posterior não tira a
 * ativação do período); é o que explica a diferença de 1 ou 2 contratos
 * para a Safra, que põe esse caso em Cancelou. As colunas e o texto de cada
 * célula são os da planilha das listas (`todaySalesExport`).
 */

export type PeriodRange = CommercialPeriodRange

/** O período da página, nas datas que a consulta usa. */
export function periodRangeOf(filters: CommercialOverviewFilters): PeriodRange {
  return { dateFrom: filters.startDate, dateTo: filters.endDate }
}

/** Os três números da janela, na ordem da leitura do card. */
export type PeriodPart = 'activated' | 'soldActivated' | 'earlier'

const PERIOD_PARTS: readonly PeriodPart[] = ['activated', 'soldActivated', 'earlier']

/** Nome de cada número, para o título da lista e para a planilha. */
const PART_LABELS: Readonly<Record<PeriodPart, string>> = {
  activated: 'Total ativado no período',
  soldActivated: 'Vendidas e ativadas no período',
  earlier: 'Vendidas antes do período e ativadas nele',
}

export function periodPartLabel(part: PeriodPart): string {
  return PART_LABELS[part]
}

/**
 * O contrato entra no número? Só quem ligou o sinal no período, repartido
 * pela data da venda com a régua do card (`sold_earlier_count` no serviço):
 * vendido antes do primeiro dia é "antes do período"; o resto, inclusive a
 * rara venda sem data ou registrada depois do sinal, é "no período". A marca
 * `soldInPeriod` do serviço não serve para a divisão: ela deixaria de fora a
 * venda registrada depois do fim, e o atalho não fecharia com a frente do
 * card.
 */
export function inPeriodPart(record: CommercialPeriodSaleRecord, part: PeriodPart, range: PeriodRange): boolean {
  if (!record.activatedInPeriod) return false
  if (part === 'activated') return true

  const earlier = record.contractedOn !== null && record.contractedOn < range.dateFrom
  return part === 'earlier' ? earlier : !earlier
}

/** Quando o sinal foi ligado, para ordenar; contrato sem a hora vai para o fim. */
function signalTime(record: CommercialPeriodSaleRecord): number {
  const time = record.startedAt === null ? Number.NaN : Date.parse(record.startedAt)

  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function latestSignalFirst(a: CommercialPeriodSaleRecord, b: CommercialPeriodSaleRecord): number {
  return signalTime(b) - signalTime(a) || a.id.localeCompare(b.id)
}

/** Os contratos de um número, o sinal mais recente primeiro, como a janela da Evolução mensal. */
export function periodPartRecords(
  records: readonly CommercialPeriodSaleRecord[],
  part: PeriodPart,
  range: PeriodRange,
): CommercialPeriodSaleRecord[] {
  return records.filter((record) => inPeriodPart(record, part, range)).sort(latestSignalFirst)
}

/** Quantos contratos cada número tem; vendidas no período + vendidas antes = total. */
export function periodCounts(
  records: readonly CommercialPeriodSaleRecord[],
  range: PeriodRange,
): Readonly<Record<PeriodPart, number>> {
  const count = (part: PeriodPart) => records.filter((record) => inPeriodPart(record, part, range)).length

  return { activated: count('activated'), soldActivated: count('soldActivated'), earlier: count('earlier') }
}

/** Nome curto de cada atalho, o mesmo vocabulário da frente do card. */
const CHIP_LABELS: Readonly<Record<PeriodPart, string>> = {
  activated: 'Total ativado',
  soldActivated: 'Vendidas no período',
  earlier: 'Vendidas antes do período',
}

/** Um atalho clicável, com a contagem. */
export type PeriodChip = {
  readonly part: PeriodPart
  readonly label: string
  readonly count: number
}

/**
 * Os três atalhos, sempre, na ordem da leitura do card: o total, onde a
 * janela abre, e as duas parcelas que o somam. Parcela zerada fica à vista
 * com o zero: aqui ela é metade de uma conta, não uma fatia a esconder.
 */
export function buildPeriodChips(counts: Readonly<Record<PeriodPart, number>>): PeriodChip[] {
  return PERIOD_PARTS.map((part) => ({ part, label: CHIP_LABELS[part], count: counts[part] }))
}

/** Título da janela: o nome do card que a abre. */
export const PERIOD_LIST_TITLE = 'Vendas ativadas'

/** O que a lista mostra, e o nome da planilha: `Setembro de 2026 · Total ativado no período`. */
export function periodListLabel(range: PeriodRange, part: PeriodPart): string {
  return `${periodTitle(range)} · ${PART_LABELS[part]}`
}

/** `de 01/09/2026 a 30/09/2026`, para o meio de uma frase. */
function rangeText(range: PeriodRange): string {
  return `de ${formatDateBr(range.dateFrom)} a ${formatDateBr(range.dateTo)}`
}

/** A régua de cada número, por extenso, para a planilha. */
function partRule(range: PeriodRange, part: PeriodPart): string {
  const sinal = `Sinal ligado ${rangeText(range)}`
  if (part === 'soldActivated') return `${sinal}, vendidas no mesmo período`
  if (part === 'earlier') return `${sinal}, vendidas antes de ${formatDateBr(range.dateFrom)}`

  return sinal
}

/**
 * Linha de contexto da janela, abaixo do título: o período e os filtros da
 * página. A janela vai para o projetor sem a faixa de filtros atrás, e sem
 * esta linha ninguém saberia de que recorte é a conta.
 */
export function periodListContext(range: PeriodRange, pageFilters: string | null): string {
  return `${periodTitle(range)} · ${pageFilters ?? 'sem outros filtros'}`
}

/** Frase de apoio da lista: o que ela traz e em que ordem. */
export function periodListDescription(): string {
  return 'Cada coluna filtra e ordena só esta lista, e Baixar Excel leva exatamente o que ela mostra. O sinal mais recente primeiro; Venda diz de que dia é a venda, e Detalhe o dia do sinal.'
}

/**
 * A coluna a mais na planilha, no fim da aba dos contratos: se o contrato
 * foi vendido no período (Sim) ou antes dele (Não). Com ela, a tabela
 * dinâmica refaz a conta do card.
 */
export function periodExtraColumns(
  records: readonly CommercialPeriodSaleRecord[],
  range: PeriodRange,
): {
  readonly columns: readonly XlsxColumn[]
  readonly values: (row: TodaySaleRow) => XlsxValue[]
} {
  const byId = new Map(records.map((record) => [record.id, record]))
  const soldInPeriod = (row: TodaySaleRow) => {
    const record = byId.get(row.id)

    return record !== undefined && inPeriodPart(record, 'soldActivated', range)
  }

  return {
    columns: [{ header: 'Vendida no período', width: 19, type: 'text' }],
    values: (row) => [soldInPeriod(row) ? 'Sim' : 'Não'],
  }
}

/**
 * Seleção e Período no topo da aba Filtros da planilha; o resto da aba é o de
 * toda planilha de contratos da página (`salesExportInfoTail`).
 */
export function periodExportHead(range: PeriodRange, part: PeriodPart): [string, string][] {
  return [
    ['Seleção', `${PERIOD_LIST_TITLE} · ${PART_LABELS[part]}`],
    ['Período', partRule(range, part)],
  ]
}

/** Nome do ícone e da dica dele no card: diz quantos contratos a janela abre. */
export function periodOpenLabel(activated: number): string {
  return activated === 1
    ? 'Ver e baixar o contrato ativado no período'
    : `Ver e baixar os ${formatNumber(activated)} contratos ativados no período`
}
