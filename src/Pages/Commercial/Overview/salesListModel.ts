import type { Theme } from '../../../contexts/PreferencesContextCore'
import type {
  CommercialMonthChipCount,
  CommercialMonthSlice,
  CommercialSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { lastDayOfMonth } from '../../../data/isoDate'
import { periodTitle } from '../../../data/overviewOsFilters'
import { formatDateBr } from '../../../lib/formatters'
import {
  COMMERCIAL_SERIES,
  CORPORATE_SERIES,
  overviewSeriesColor,
  UNASSIGNED_SERIES,
  type MonthlyChartTeam,
} from './overviewChartOptions'
import { COHORT_SERIES, cohortPalette, type CohortSeriesId } from './overviewCohortChartOptions'
import { toSaleRow, type TodaySaleRow } from './todaySalesModel'

/**
 * Janela de contratos da Visão Geral Comercial: o que o clique num painel
 * abre.
 *
 * Nasceu da análise de 25/09/2026 com o Mário, que pediu no Comercial a
 * janela que a Visão Geral de OS abre no clique. Dois painéis abrem, os dois
 * em que o número pede ação, e na ordem em que ele os aprovou:
 *
 * - Safra de vendas por mês: o painel diz QUANTAS vendas de julho ainda
 *   aguardam ou cancelaram, e a janela diz QUAIS;
 * - Evolução mensal das vendas: as ativações do mês, por time, como o Volume
 *   diário da OS abre as OS do dia. Serve para conferir quais contratos formam
 *   a barra e achar as vendas Sem time, cadastro de vendedor a corrigir.
 *
 * Os rankings (cidade, time, origem, Top 5) e os cards ficaram sem janela de
 * propósito, pelo critério da OS: a faixa de filtros já faz esses recortes, e
 * as listas seriam de vendas que deram certo, sem ação.
 *
 * O que este módulo congela:
 *
 * - a janela abre com a MESMA regra do painel clicado, aplicada pelo serviço
 *   (`commercial_live.py`): na Safra, a
 *   venda entra pelo mês da data da venda e a fatia é a de `cohort_bucket`;
 *   na Evolução mensal, a ativação entra pelo mês do sinal e o grupo é o time
 *   principal do vendedor, como em `build_monthly` (`commercial_overview.py`).
 *   Os filtros da página valem como nos dois painéis: cidade, time, vendedor
 *   e tipo de cliente, e não o período;
 * - com um time escolhido na página, a Evolução mensal só desenha a barra
 *   daquele time, e a janela só conta esse grupo: o "Todas" fecha com a barra;
 * - o clique não mexe nos filtros da página, a mesma regra da janela de OS;
 * - as outras barras do mesmo mês ficam como atalhos no topo, com a contagem
 *   e a cor delas, e o primeiro atalho, "Todas", abre o mês inteiro. Na
 *   Safra, "Outras situações" (reprovada, expirada, cortesia, ativa no SGI
 *   sem sinal ligado) não é fatia do gráfico, mas vira atalho quando existe,
 *   para os atalhos somarem o "Todas". O "Todas" bate com o vendido do
 *   tooltip e, desde 02/10/2026, com o rótulo da barra, que antes somava só
 *   as quatro fatias (setembro de 2026: 707 contra 704);
 * - a Safra abre com a venda mais antiga do mês no topo (na fatia Aguarda
 *   hoje é a mais esquecida, a ordem da esteira do Hoje ao vivo); a Evolução
 *   mensal, com o sinal mais recente, a ordem das Ativadas do Hoje ao vivo.
 *
 * Desde 01/10/2026 a regra (o mês, a fatia de cada contrato, os filtros da
 * página e a ordem) mora no serviço (`commercial_live.py`): a janela pede os
 * contratos da barra clicada e recebe junto a contagem de cada barra do mês,
 * para os atalhos. Antes ela baixava o mês inteiro (~520 KB em setembro) e
 * recortava no navegador. Este módulo só nomeia, colore e escreve. O painel
 * vem da consulta agregada, lida em outro momento: um contrato que mudar de
 * situação entre as duas leituras pode fazer a janela diferir da barra em
 * uma unidade. Os atalhos, que saem da mesma leitura da lista, sempre fecham
 * entre si.
 *
 * Outra diferença possível, sem caso hoje: a consulta agregada só lê contrato
 * cujo evento (sinal, senão assinatura, senão venda) é de 2026 em diante, e a
 * de contratos lê pela data da venda. Uma venda de 2026 com sinal gravado em
 * 2025 entraria na janela da Safra e não na barra. Conferido em 25/09/2026
 * contra o SGI: os nove meses de 2026 bateram fatia por fatia, sem esse caso.
 */

/** Fatia da safra em que um contrato vendido entra, mais as outras situações. */
export type CohortBucket = CohortSeriesId | 'other'

/** Grupo da Evolução mensal: os dois times e a venda sem time. */
export type MonthlyTeam = MonthlyChartTeam

/**
 * O que a janela mostra: o painel, o mês (`aaaa-mm`) e a barra. Fatia ou
 * grupo nulos são o mês inteiro, o atalho "Todas".
 */
export type SalesListSelection =
  | { readonly kind: 'cohort'; readonly month: string; readonly bucket: CohortBucket | null }
  | { readonly kind: 'monthly'; readonly month: string; readonly team: MonthlyTeam | null }

/** Nome do atalho que abre o mês inteiro, o mesmo da janela de OS. */
export const SALES_LIST_ALL_LABEL = 'Todas'

/** Nome do que não é fatia da Safra, o mesmo do tooltip do painel. */
export const COHORT_OTHER_LABEL = 'Outras situações'

/** Fatia da Safra no nome do portal -> no nome do serviço. */
const COHORT_API_SLICES: Readonly<Record<CohortBucket, CommercialMonthSlice>> = {
  activatedInMonth: 'activated_in_month',
  activatedLater: 'activated_later',
  awaiting: 'awaiting',
  cancelled: 'cancelled',
  other: 'other',
}

/** A barra escolhida como o serviço a recebe; null é o mês inteiro. */
export function salesListApiSlice(selection: SalesListSelection): CommercialMonthSlice | null {
  if (selection.kind === 'cohort') {
    return selection.bucket === null ? null : COHORT_API_SLICES[selection.bucket]
  }

  return selection.team
}

/** Os grupos da Evolução mensal, na ordem da legenda, com o nome e a cor da barra. */
const MONTHLY_TEAMS = [
  { team: 'comercial', label: COMMERCIAL_SERIES, colorKey: 'comercial' },
  { team: 'corporativo', label: CORPORATE_SERIES, colorKey: 'corporativo' },
  { team: 'unassigned', label: UNASSIGNED_SERIES, colorKey: 'semTime' },
] as const satisfies readonly { team: MonthlyTeam; label: string; colorKey: string }[]

/** A barra que o serviço contou, como seleção da janela; null para barra desconhecida. */
function selectionOfApiSlice(
  selection: SalesListSelection,
  slice: CommercialMonthSlice | null,
): SalesListSelection | null {
  const { month } = selection
  if (selection.kind === 'cohort') {
    if (slice === null) return { kind: 'cohort', month, bucket: null }
    const bucket = (Object.keys(COHORT_API_SLICES) as CohortBucket[]).find(
      (key) => COHORT_API_SLICES[key] === slice,
    )

    return bucket === undefined ? null : { kind: 'cohort', month, bucket }
  }
  if (slice === null) return { kind: 'monthly', month, team: null }
  const team = MONTHLY_TEAMS.find((item) => item.team === slice)?.team

  return team === undefined ? null : { kind: 'monthly', month, team }
}

/** Identidade da seleção: marca o atalho aceso e faz a lista recomeçar do zero ao trocar. */
export function salesListSelectionKey(selection: SalesListSelection): string {
  const slice = selection.kind === 'cohort' ? selection.bucket : selection.team

  return `${selection.kind}:${selection.month}:${slice ?? 'all'}`
}

/** Primeiro e último dia do mês, ISO: é o que a janela pede ao serviço. */
export function salesListMonthRange(month: string): { readonly dateFrom: string; readonly dateTo: string } {
  const dateFrom = `${month}-01`

  return { dateFrom, dateTo: lastDayOfMonth(dateFrom) }
}

/** `Julho de 2026`, como a etiqueta do período da página escreve um mês inteiro. */
export function salesListMonthTitle(month: string): string {
  return periodTitle(salesListMonthRange(month))
}

/** `julho de 2026`, para o meio de uma frase. */
function monthInSentence(month: string): string {
  const title = salesListMonthTitle(month)

  return title.charAt(0).toLocaleLowerCase('pt-BR') + title.slice(1)
}

/** Título da janela: o painel de onde ela veio. */
export function salesListPanelTitle(selection: SalesListSelection): string {
  return selection.kind === 'cohort' ? 'Safra de vendas por mês' : 'Evolução mensal das vendas'
}

/** Nome da barra clicada, o da legenda do painel; o mês inteiro, por extenso. */
function sliceLabel(selection: SalesListSelection): string {
  if (selection.kind === 'cohort') {
    if (selection.bucket === null) return 'Todas as vendas'
    if (selection.bucket === 'other') return COHORT_OTHER_LABEL

    return COHORT_SERIES.find((series) => series.id === selection.bucket)?.name ?? selection.bucket
  }
  if (selection.team === null) return 'Todas as ativações'

  return MONTHLY_TEAMS.find((item) => item.team === selection.team)?.label ?? selection.team
}

/**
 * O que a lista mostra, e o nome da planilha: `Julho de 2026 · Aguarda
 * hoje`, `Julho de 2026 · Comercial`, ou o mês inteiro (`Todas as vendas`,
 * `Todas as ativações`).
 */
export function salesListSelectionLabel(selection: SalesListSelection): string {
  return `${salesListMonthTitle(selection.month)} · ${sliceLabel(selection)}`
}

/** Nome do grupo de atalhos, para o leitor de tela. */
export function salesListChipsLabel(selection: SalesListSelection): string {
  return selection.kind === 'cohort'
    ? `Trocar de situação, vendas de ${monthInSentence(selection.month)}`
    : `Trocar de time, ativações de ${monthInSentence(selection.month)}`
}

/**
 * Linha de contexto da janela: o mês, a régua do painel e os filtros da
 * página. A janela vai para o projetor sem a faixa de filtros atrás, e sem
 * esta linha ninguém saberia de que recorte são os contratos.
 */
export function salesListContext(selection: SalesListSelection, pageFilters: string | null): string {
  const month = monthInSentence(selection.month)
  const rule =
    selection.kind === 'cohort'
      ? `Vendidas em ${month}, na situação de hoje`
      : `Sinal ligado em ${month}`

  return `${rule} · ${pageFilters ?? 'sem outros filtros'}`
}

/** Frase de apoio da lista: o que ela traz e em que ordem. */
export function salesListDescription(selection: SalesListSelection): string {
  const columns =
    'Cada coluna filtra e ordena só esta lista, e Baixar Excel leva exatamente o que ela mostra.'

  return selection.kind === 'cohort'
    ? `${columns} A venda mais antiga primeiro; Detalhe traz o dia do sinal, há quanto tempo a etapa espera ou o que houve na última visita.`
    : `${columns} O sinal mais recente primeiro; Venda diz de que dia é a venda, e Detalhe o dia do sinal.`
}

/** Um atalho no topo da janela: a barra do mês, com a cor e a contagem dela. */
export type SalesListChip = {
  readonly selection: SalesListSelection
  readonly label: string
  readonly count: number
  /** A cor da barra no painel; nula no "Todas" e nas outras situações, que não são barra. */
  readonly color: string | null
}

/**
 * Atalhos da janela, sobre a contagem de cada barra que o serviço mandou:
 * "Todas" primeiro e depois as barras, na ordem da legenda; na Safra, as
 * outras situações no fim, quando existem. O serviço já tira a barra zerada
 * (nenhum atalho para uma lista vazia), e o mês sem contrato vem sem atalho
 * nenhum. Aqui cada barra ganha o nome e a cor do painel.
 */
export function buildSalesListChips(
  counts: readonly CommercialMonthChipCount[],
  selection: SalesListSelection,
  theme: Theme,
): SalesListChip[] {
  const palette = cohortPalette[theme === 'dark' ? 'dark' : 'light']

  return counts.flatMap((item): SalesListChip[] => {
    const chip = selectionOfApiSlice(selection, item.slice)
    if (chip === null) return []
    const { count } = item
    if (item.slice === null) return [{ selection: chip, label: SALES_LIST_ALL_LABEL, count, color: null }]
    if (chip.kind === 'cohort') {
      const series = COHORT_SERIES.find((entry) => entry.id === chip.bucket)

      return [
        series === undefined
          ? { selection: chip, label: COHORT_OTHER_LABEL, count, color: null }
          : { selection: chip, label: series.name, count, color: palette[series.id] },
      ]
    }
    const team = MONTHLY_TEAMS.find((entry) => entry.team === chip.team)

    return team === undefined
      ? []
      : [{ selection: chip, label: team.label, count, color: overviewSeriesColor(team.colorKey, theme) }]
  })
}

/**
 * Linhas da lista, na ordem em que o serviço manda (na Safra, a venda mais
 * antiga primeiro; na Evolução mensal, o sinal mais recente), com o mesmo
 * texto e o mesmo Detalhe da lista do Hoje ao vivo (o dia do sinal, há
 * quanto tempo a etapa espera, o que houve na última visita).
 */
export function buildSalesListRows(records: readonly CommercialSaleRecord[], today: string): TodaySaleRow[] {
  return records.map((record) => toSaleRow(record, today))
}

/**
 * Seleção e Período da aba Filtros da planilha: o resto da aba é o de toda
 * planilha de contratos da página (`salesExportInfoTail`).
 */
export function salesListExportHead(selection: SalesListSelection): [string, string][] {
  const { dateFrom, dateTo } = salesListMonthRange(selection.month)
  const range = `de ${formatDateBr(dateFrom)} a ${formatDateBr(dateTo)}`

  return [
    ['Seleção', `${salesListPanelTitle(selection)} · ${sliceLabel(selection)}`],
    [
      'Período',
      selection.kind === 'cohort'
        ? `Vendidas ${range}, pela data da venda, na situação de hoje`
        : `Sinal ligado ${range}, vendas ativadas pela regra da página`,
    ],
  ]
}

/** Nome da planilha, sem a data: `safra ...` ou `ativacoes ...`, e o que a lista mostra. */
export function salesListFileLabel(selection: SalesListSelection): string {
  return `${selection.kind === 'cohort' ? 'safra' : 'ativacoes'} ${salesListSelectionLabel(selection)}`
}
