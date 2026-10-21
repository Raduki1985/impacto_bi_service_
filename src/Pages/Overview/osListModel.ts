import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  listActiveOverviewOsFilters,
  type OverviewOsCoverage,
  type OverviewOsFilters,
} from '../../data/overviewOsFilters'
import { formatDateBr } from '../../lib/formatters'
import {
  DAILY_VOLUME_COLORS,
  DAILY_VOLUME_COMPLETED_SERIES,
  DAILY_VOLUME_TOTAL_SERIES,
  DAILY_VOLUME_UNPRODUCTIVE_SERIES,
} from './overviewDailyChartOptions'
import {
  OS_GROUPS,
  OS_OUTCOMES,
  periodTitle,
  type OsGroupKey,
  type OsOutcomeKey,
  type OverviewOsPeriodFacts,
} from './overviewModel'
import { OUTCOME_COLORS } from './overviewOutcomeChartOptions'
import { REASON_COLOR, REASON_UNCLEAR_COLOR } from './overviewReasonsChartOptions'
import { buildServiceTypeRows, serviceTypeColor } from './overviewServiceTypeChartOptions'
import { compareOperationOrder, toPeriodOsRow, type PeriodOsRow } from './todayOsModel'

/**
 * Janela de OS da Visão Geral: o que o clique numa barra abre.
 *
 * Nasceu do estudo de 24/09/2026 com o Mário. O painel dizia QUANTAS (66
 * improdutivas com cliente ausente, 82 OS de cliente não executadas); a
 * janela diz QUAIS, que é o que permite agir. Decisões dele no mesmo dia:
 * janela no centro da tela, e não matriz no fim da página; primeira leva nos
 * painéis Motivos de improdutiva e Destino das OS, e depois o Volume diário
 * (o dia clicado); e planilha para baixar quando o gestor quiser. Tipo,
 * cidade e categoria ficaram de fora de propósito: a faixa de filtros já faz
 * esses recortes, e as listas seriam de OS normais, sem ação. Em 21/10/2026 o
 * Mário reabriu a decisão para o TIPO: a fatia da Composição por tipo de OS
 * abre a lista das OS daquele tipo. Cidade e categoria seguem sem lista.
 *
 * O que este módulo congela:
 *
 * - a janela abre com a MESMA regra do painel clicado, com todos os filtros
 *   da página: o número da janela fecha com o da barra, sempre. Desde
 *   01/10/2026 essa regra é do serviço de BI, que manda as OS da barra quando
 *   a janela abre (`/bi/os/overview/period/records`); os atalhos contam com
 *   os números do mesmo período (`OverviewOsPeriodFacts`). A exceção é a
 *   Composição por tipo, que já desenha sem os filtros Tipo e Categoria: a
 *   lista dela usa os filtros da rosca (`osListFilters`), e o número fecha
 *   com o da fatia;
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
 *
 * `day` é o Volume diário (24/09/2026): o dia clicado e a saída das OS
 * dele, com saída nula para o Total do dia, que é uma barra do painel. O
 * clique no gráfico só abre Total, Concluídas ou Improdutivas; as demais
 * saídas vêm dos atalhos da janela.
 *
 * `service-type` é a Composição por tipo de OS (21/10/2026): o tipo da fatia,
 * ou nulo no "Todas", que é a rosca inteira.
 */
export type OsListSelection =
  | { readonly kind: 'reason'; readonly reason: string | null }
  | { readonly kind: 'outcome'; readonly group: OsGroupKey; readonly outcome: OsOutcomeKey | null }
  | { readonly kind: 'day'; readonly date: string; readonly series: OsOutcomeKey | null }
  | { readonly kind: 'service-type'; readonly serviceType: string | null }

/** Nome do atalho que abre o painel inteiro. */
export const OS_LIST_ALL_LABEL = 'Todas'

/**
 * Identidade da seleção em texto: marca o atalho aceso e faz a lista
 * recomeçar do zero ao trocar de atalho, como ao trocar de caixa em Hoje ao
 * vivo. O "Todas" tem chave própria, que nenhum nome de motivo alcança.
 */
export function osListSelectionKey(selection: OsListSelection): string {
  if (selection.kind === 'day') return `day:${selection.date}:${selection.series ?? 'total'}`
  if (selection.kind === 'service-type') {
    return selection.serviceType === null ? 'service-type-all' : `service-type:${selection.serviceType}`
  }
  if (selection.kind === 'reason') {
    return selection.reason === null ? 'reason-all' : `reason:${selection.reason}`
  }

  return selection.outcome === null
    ? `outcome-all:${selection.group}`
    : `outcome:${selection.group}:${selection.outcome}`
}

/**
 * Atalhos do dia além do Total, na ordem do fluxo de uma OS, a mesma do
 * Destino (pedido do Mário em 24/09/2026: "todos os status que constaram no
 * dia", lidos pelas saídas, e não pelos treze status crus, que ficam na
 * coluna Status da lista). Concluídas e Improdutivas levam o nome e a cor da
 * legenda do painel diário; as outras saídas, o nome no plural e a cor do
 * Destino. Juntas, somam o Total do dia.
 */
const DAY_OUTCOME_CHIPS: readonly {
  readonly outcome: OsOutcomeKey
  readonly label: string
  readonly color: string
}[] = [
  { outcome: 'completed', label: DAILY_VOLUME_COMPLETED_SERIES, color: DAILY_VOLUME_COLORS.completed },
  {
    outcome: 'unproductive',
    label: DAILY_VOLUME_UNPRODUCTIVE_SERIES,
    color: DAILY_VOLUME_COLORS.unproductive,
  },
  { outcome: 'notExecuted', label: 'Não executadas', color: OUTCOME_COLORS.notExecuted },
  { outcome: 'open', label: 'Em aberto', color: OUTCOME_COLORS.open },
  { outcome: 'unknown', label: 'Sem classificação', color: OUTCOME_COLORS.unknown },
]

// Guarda do domínio fechado: saída sem atalho seria OS do Total que nenhum
// atalho do dia alcança, e os atalhos deixariam de somar o Total.
for (const outcome of OS_OUTCOMES) {
  if (!DAY_OUTCOME_CHIPS.some((item) => item.outcome === outcome.key)) {
    throw new Error(`Janela de OS: a saída ${outcome.label} está sem atalho no Volume diário.`)
  }
}

/** Um atalho no topo da janela: a barra do painel, com a cor e a contagem dela. */
export type OsListChip = {
  readonly selection: OsListSelection
  readonly label: string
  readonly count: number
  /**
   * A cor da barra ou da fatia no painel, para o atalho ser reconhecido de
   * relance. Nula no "Todas" dos Motivos, do Destino e da Composição por
   * tipo, que não é uma barra nem uma fatia.
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
 *
 * Volume diário: o Total, que ali já é uma barra e faz o papel do "Todas",
 * e as saídas do dia (`DAY_OUTCOME_CHIPS`), que somam o Total.
 *
 * Composição por tipo: "Todas" (a rosca inteira) e as fatias, na ordem e na
 * cor da rosca, contadas com os mesmos números dela.
 */
export function buildOsListChips(
  facts: Pick<OverviewOsPeriodFacts, 'daily' | 'outcome' | 'reasons' | 'serviceTypeSlices'>,
  selection: OsListSelection,
): OsListChip[] {
  if (selection.kind === 'service-type') {
    const rows = buildServiceTypeRows(facts.serviceTypeSlices)
    if (rows.length === 0) return []

    return [
      {
        selection: { kind: 'service-type', serviceType: null },
        label: OS_LIST_ALL_LABEL,
        count: rows.reduce((sum, row) => sum + row.value, 0),
        color: null,
      },
      ...rows.map((row): OsListChip => ({
        selection: { kind: 'service-type', serviceType: row.name },
        label: row.name,
        count: row.value,
        color: serviceTypeColor(row.name),
      })),
    ]
  }
  if (selection.kind === 'day') {
    const { daily } = facts
    const index = daily.iso.indexOf(selection.date)
    if (index === -1 || daily.total[index] === 0) return []
    const chips: OsListChip[] = [
      {
        selection: { kind: 'day', date: selection.date, series: null },
        label: DAILY_VOLUME_TOTAL_SERIES,
        count: daily.total[index],
        color: DAILY_VOLUME_COLORS.total,
      },
      ...DAY_OUTCOME_CHIPS.map(
        (item): OsListChip => ({
          selection: { kind: 'day', date: selection.date, series: item.outcome },
          label: item.label,
          count: daily[item.outcome][index],
          color: item.color,
        }),
      ),
    ]

    return chips.filter((chip) => chip.count > 0)
  }
  if (selection.kind === 'reason') {
    const summary = facts.reasons
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

  const group = facts.outcome.find((item) => item.key === selection.group)
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
  if (selection.kind === 'day') return 'Volume diário de OS'
  if (selection.kind === 'service-type') return 'Composição por tipo de OS'

  return selection.kind === 'reason' ? 'Motivos de improdutiva' : 'Destino das OS do período'
}

/**
 * Período da lista: o dia clicado no Volume diário, ou o período da página
 * nos demais painéis. É o que a linha de contexto, a aba Filtros e o nome do
 * arquivo dizem, porque é o que a lista contém.
 */
export function osListRange(
  selection: OsListSelection,
  filters: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>,
): { readonly dateFrom: string; readonly dateTo: string } {
  return selection.kind === 'day'
    ? { dateFrom: selection.date, dateTo: selection.date }
    : { dateFrom: filters.dateFrom, dateTo: filters.dateTo }
}

/**
 * Filtros com que a lista é pedida ao serviço e descrita na janela e na
 * planilha.
 *
 * Nos painéis de barra são os da página, como chegam. Na Composição por tipo
 * são os da ROSCA: ela ignora os filtros Tipo de OS e Categoria (o filtro vira
 * destaque, nunca corte), então a lista troca o Tipo pelo da fatia e solta a
 * Categoria, e o número da janela fecha com o da fatia. O Status sai quando
 * não tira OS nenhuma (todos marcados, `statusNarrows` falso), como o serviço
 * faz ao contar a rosca (07/10/2026). Sem isso a lista ficaria ABAIXO da
 * fatia: a faixa só oferece os status do tipo filtrado, e o tipo da fatia pode
 * ter OS de outros status (Expirada, por exemplo), que a fatia conta e a lista
 * cortaria.
 */
export function osListFilters(
  selection: OsListSelection,
  filters: OverviewOsFilters,
  statusNarrows: boolean,
): OverviewOsFilters {
  if (selection.kind !== 'service-type') return filters

  return {
    ...filters,
    serviceType: selection.serviceType === null ? [] : [selection.serviceType],
    category: [],
    status: statusNarrows ? filters.status : [],
  }
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
 * cliente`; no Volume diário, a saída com o nome do atalho (`Improdutivas`,
 * `Não executadas`, ou `Todas as OS` no Total), porque o dia já está na
 * linha de contexto. Na Composição por tipo, o nome do tipo, ou `Todas as
 * OS` no "Todas", como no Total do dia. É também o nome da planilha baixada.
 */
export function osListSelectionLabel(selection: OsListSelection): string {
  if (selection.kind === 'service-type') return selection.serviceType ?? 'Todas as OS'
  if (selection.kind === 'day') {
    if (selection.series === null) return 'Todas as OS'

    return DAY_OUTCOME_CHIPS.find((item) => item.outcome === selection.series)?.label ?? selection.series
  }
  if (selection.kind === 'reason') return selection.reason ?? 'Todas as improdutivas'
  if (selection.outcome === null) return GROUP_ALL_LABELS[selection.group]
  const outcome = OS_OUTCOMES.find((item) => item.key === selection.outcome)?.label ?? selection.outcome

  return `${groupLabel(selection.group)} · ${outcome}`
}

/** Nome do grupo de atalhos, para o leitor de tela. */
export function osListChipsLabel(selection: OsListSelection): string {
  if (selection.kind === 'day') return `Trocar de série, dia ${formatDateBr(selection.date)}`
  if (selection.kind === 'service-type') return 'Trocar de tipo'

  return selection.kind === 'reason'
    ? 'Trocar de motivo'
    : `Trocar de saída, ${groupLabel(selection.group)}`
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
 * registrado". O motivo vem do serviço com a OS, com o mesmo nome da barra.
 */
function withReasonDetail(row: PeriodOsRow): PeriodOsRow {
  const record = row.source
  if (record.outcome !== 'unproductive' || record.listReason == null) return row

  return { ...row, detail: record.listReason }
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

  // Por extenso, com todas as opções marcadas: a janela e a planilha circulam
  // sem a faixa, e não têm dica de mouse para o "+2" do chip.
  return active
    .map((filter) => {
      const values =
        filter.field === 'technicianId'
          ? filter.values.map((id) => technicianNames.get(id) ?? id)
          : filter.values

      return `${filter.label}: ${values.join(', ')}`
    })
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
