import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  listActiveOverviewOsFilters,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import {
  buildOsOutcome,
  groupOf,
  OS_GROUPS,
  OS_OUTCOMES,
  outcomeOf,
  periodTitle,
  type OsGroupKey,
  type OsOutcomeKey,
} from './overviewModel'
import { OUTCOME_COLORS } from './overviewOutcomeChartOptions'
import {
  buildReasonSummary,
  REASON_COLOR,
  REASON_UNCLEAR_COLOR,
  reasonOf,
} from './overviewReasonsChartOptions'
import { compareOperationOrder, toPeriodOsRow, type PeriodOsRow } from './todayOsModel'

/**
 * Janela de OS da Visão Geral: o que o clique numa barra abre.
 *
 * Nasceu do estudo de 24/09/2026 com o Mário. O painel dizia QUANTAS (66
 * improdutivas com cliente ausente, 82 OS de cliente não executadas); a
 * janela diz QUAIS, que é o que permite agir. Decisões dele no mesmo dia:
 * janela no centro da tela, e não matriz no fim da página; primeira leva só
 * nos painéis Motivos de improdutiva e Destino das OS; e planilha para baixar
 * quando o gestor quiser.
 *
 * O que este módulo congela:
 *
 * - a janela abre com a MESMA regra do painel clicado (`reasonOf`,
 *   `outcomeOf`, `groupOf`) sobre os MESMOS registros, com todos os filtros
 *   da página: o número da janela fecha com o da barra, sempre;
 * - o clique não mexe nos filtros da página, a mesma regra da lista de Hoje
 *   ao vivo. Para ver onde as OS se concentram, os filtros de coluna da
 *   própria lista já contam por cidade, técnico e equipe;
 * - as outras barras do MESMO painel ficam como atalhos no topo da janela,
 *   com a contagem: trocar de motivo não obriga a fechar e clicar de novo.
 *   No Destino, os atalhos são as saídas do grupo clicado, porque cliente e
 *   infraestrutura têm ciclos diferentes e a página nunca os soma numa taxa;
 * - o primeiro atalho, "Todas", abre o painel inteiro: todas as improdutivas
 *   nos motivos, a barra inteira do grupo no Destino. Pedido do Mário em
 *   24/09/2026, ao sentir falta de baixar tudo de uma vez: o `Baixar Excel`
 *   leva o que a lista mostra, e com "Todas" a lista mostra o painel todo.
 *   O nome é "Todas" porque o atalho conta OS, "todas as OS", o mesmo
 *   feminino da faixa de filtros para Equipe e Cidade;
 * - a lista abre com a OS mais recente no topo e, dentro do dia, na ordem da
 *   operação (turno, técnico, código), a mesma da agenda de hoje.
 */

/**
 * O que a janela mostra. Motivo ou saída nulos são o atalho "Todas": todas
 * as improdutivas do painel de motivos, ou a barra inteira do grupo no
 * Destino. O clique no gráfico sempre abre uma barra só; o nulo vem apenas
 * do atalho.
 */
export type OsListSelection =
  | { readonly kind: 'reason'; readonly reason: string | null }
  | { readonly kind: 'outcome'; readonly group: OsGroupKey; readonly outcome: OsOutcomeKey | null }

/** Nome do atalho que abre o painel inteiro. */
export const OS_LIST_ALL_LABEL = 'Todas'

/** A OS entra na janela? A regra é a do painel que abriu a janela. */
export function matchesOsListSelection(
  record: OverviewOsRecord,
  selection: OsListSelection,
): boolean {
  if (selection.kind === 'reason') {
    return (
      outcomeOf(record) === 'unproductive' &&
      (selection.reason === null || reasonOf(record) === selection.reason)
    )
  }

  return (
    groupOf(record) === selection.group &&
    (selection.outcome === null || outcomeOf(record) === selection.outcome)
  )
}

/**
 * Identidade da seleção em texto: marca o atalho aceso e faz a lista
 * recomeçar do zero ao trocar de atalho, como ao trocar de caixa em Hoje ao
 * vivo. O "Todas" tem chave própria, que nenhum nome de motivo alcança.
 */
export function osListSelectionKey(selection: OsListSelection): string {
  if (selection.kind === 'reason') {
    return selection.reason === null ? 'reason-all' : `reason:${selection.reason}`
  }

  return selection.outcome === null
    ? `outcome-all:${selection.group}`
    : `outcome:${selection.group}:${selection.outcome}`
}

/** Um atalho no topo da janela: a barra do painel, com a cor e a contagem dela. */
export type OsListChip = {
  readonly selection: OsListSelection
  readonly label: string
  readonly count: number
  /**
   * A cor da barra no painel, para o atalho ser reconhecido de relance. Nula
   * no "Todas", que não é uma barra.
   */
  readonly color: string | null
}

/**
 * Atalhos da janela: "Todas" primeiro, e depois as barras, na ordem do
 * painel.
 *
 * Motivos: todos os motivos do painel, os cinza no fim, como lá. Destino: as
 * saídas do grupo clicado que têm OS; saída zerada não vira atalho para uma
 * lista vazia. Painel sem nenhuma OS não tem atalho nenhum, nem o "Todas".
 */
export function buildOsListChips(
  records: readonly OverviewOsRecord[],
  selection: OsListSelection,
): OsListChip[] {
  if (selection.kind === 'reason') {
    const summary = buildReasonSummary(records)
    if (summary.total === 0) return []

    return [
      {
        selection: { kind: 'reason', reason: null },
        label: OS_LIST_ALL_LABEL,
        count: summary.total,
        color: null,
      },
      ...summary.rows.map((row): OsListChip => ({
        selection: { kind: 'reason', reason: row.reason },
        label: row.reason,
        count: row.count,
        color: row.unclear ? REASON_UNCLEAR_COLOR : REASON_COLOR,
      })),
    ]
  }

  const group = buildOsOutcome(records).find((item) => item.key === selection.group)
  if (group === undefined || group.total === 0) return []

  return [
    {
      selection: { kind: 'outcome', group: selection.group, outcome: null },
      label: OS_LIST_ALL_LABEL,
      count: group.total,
      color: null,
    },
    ...OS_OUTCOMES.filter((outcome) => group.counts[outcome.key] > 0).map(
      (outcome): OsListChip => ({
        selection: { kind: 'outcome', group: selection.group, outcome: outcome.key },
        label: outcome.label,
        count: group.counts[outcome.key],
        color: OUTCOME_COLORS[outcome.key],
      }),
    ),
  ]
}

/** Título da janela: o painel de onde ela veio. */
export function osListPanelTitle(selection: OsListSelection): string {
  return selection.kind === 'reason' ? 'Motivos de improdutiva' : 'Destino das OS do período'
}

/** Nome do grupo, como o eixo do Destino o escreve. */
function groupLabel(group: OsGroupKey): string {
  return OS_GROUPS.find((item) => item.key === group)?.label ?? group
}

/** O grupo inteiro, como a lista o nomeia no atalho "Todas". */
const GROUP_ALL_LABELS: Readonly<Record<OsGroupKey, string>> = {
  customer: 'Todas as OS de cliente',
  infrastructure: 'Todas as OS de infraestrutura',
}

/**
 * O que a lista mostra: o motivo, ou o grupo e a saída (`OS de cliente · Não
 * executada`); no atalho "Todas", `Todas as improdutivas` ou `Todas as OS de
 * cliente`. É também o nome da planilha baixada.
 */
export function osListSelectionLabel(selection: OsListSelection): string {
  if (selection.kind === 'reason') return selection.reason ?? 'Todas as improdutivas'
  if (selection.outcome === null) return GROUP_ALL_LABELS[selection.group]
  const outcome = OS_OUTCOMES.find((item) => item.key === selection.outcome)?.label ?? selection.outcome

  return `${groupLabel(selection.group)} · ${outcome}`
}

/** Nome do grupo de atalhos, para o leitor de tela. */
export function osListChipsLabel(selection: OsListSelection): string {
  return selection.kind === 'reason'
    ? 'Trocar de motivo'
    : `Trocar de saída, ${groupLabel(selection.group)}`
}

/** As OS da janela, ainda como registros. */
export function selectOsListRecords(
  records: readonly OverviewOsRecord[],
  selection: OsListSelection,
): OverviewOsRecord[] {
  return records.filter((record) => matchesOsListSelection(record, selection))
}

/**
 * Linhas da lista, a mais recente primeiro e, no mesmo dia, na ordem da
 * operação. É também a ordem da planilha do período inteiro.
 */
export function buildOsListRows(
  records: readonly OverviewOsRecord[],
  technicianNames: ReadonlyMap<string, string>,
): PeriodOsRow[] {
  return records
    .map((record) => withReasonDetail(toPeriodOsRow(record, technicianNames)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || compareOperationOrder(a, b))
}

/**
 * Na janela, o Detalhe da improdutiva é o motivo com o nome da BARRA do
 * painel: a sem motivo diz "Sem motivo registrado", e não o traço da agenda
 * de hoje. Visto na tela em 24/09/2026: no atalho "Todas", cinco linhas
 * vinham com traço enquanto o atalho e a planilha diziam "Sem motivo
 * registrado". Sem o campo na fonte o traço fica, porque aí o dado não
 * existe.
 */
function withReasonDetail(row: PeriodOsRow): PeriodOsRow {
  const record = row.source
  if (outcomeOf(record) !== 'unproductive' || record.unproductiveReason === undefined) return row

  return { ...row, detail: reasonOf(record) }
}

/**
 * Filtros da página além do período, como os chips da faixa os escrevem
 * (`Equipe: Infra · Técnico: Ana Souza`); null sem nenhum. O período fica
 * de fora porque a janela já o diz pelo nome, logo antes.
 */
export function pageFiltersText(
  filters: OverviewOsFilters,
  coverage: OverviewOsCoverage,
  technicianNames: ReadonlyMap<string, string>,
): string | null {
  const active = listActiveOverviewOsFilters(filters, coverage).filter(
    (filter) => filter.field !== 'dateFrom' && filter.field !== 'dateTo',
  )
  if (active.length === 0) return null

  return active
    .map(
      (filter) =>
        `${filter.label}: ${
          filter.field === 'technicianId'
            ? (technicianNames.get(filter.value) ?? filter.value)
            : filter.value
        }`,
    )
    .join(' · ')
}

/**
 * Linha de contexto da janela: o período pelo nome e os filtros da página.
 * A janela vai para o projetor sem a faixa de filtros atrás, e sem esta linha
 * ninguém saberia de que recorte são as OS.
 */
export function osListContext(
  filters: OverviewOsFilters,
  coverage: OverviewOsCoverage,
  technicianNames: ReadonlyMap<string, string>,
): string {
  return `${periodTitle(filters)} · ${pageFiltersText(filters, coverage, technicianNames) ?? 'sem outros filtros'}`
}
