import {
  compareBrDates,
  compareNumberedCodes,
  filterListRows,
  hasListFilters,
  listColumnOptions,
  listTableMinWidth,
  sortListRows,
  type ListColumn,
  type ListSort,
  type ListSortDirection,
  type ListTableFilters,
  type ListTableOption,
  type ListTableRules,
} from '../../components/dashboard/listTableModel'
import { formatDateBr, formatIsoDateTimeBr, formatNumber } from '../../lib/formatters'
import type { TodayOsRow } from './todayOsModel'

/**
 * Colunas da lista de OS: a agenda de hoje e a janela de OS do período.
 *
 * A tabela ganhou a mesma experiência dos cabeçalhos de Vendas por Período
 * (pedido do Mário, 21/09/2026): um botão por coluna abre um painel com a
 * ordenação e o recorte daquela coluna. Em 24/09/2026 o recorte, a contagem
 * das opções e a ordenação viraram o modelo de lista do portal
 * (`components/dashboard/listTableModel`), e este arquivo passou a declarar
 * só o que é da OS: as colunas, o texto de cada célula, o que é ausência e o
 * desempate pelo código.
 *
 * O filtro vale SÓ para a lista aberta. Os filtros da página continuam em
 * cima, na faixa, e não são alterados por nada daqui: são dois recortes com
 * donos diferentes, e misturá-los faria o gestor mudar a página inteira
 * tentando organizar uma tabela.
 *
 * A janela de OS do período tem OS de vários dias, e a lista ganha a coluna
 * `Data` na frente; na agenda de hoje ela continua de fora, porque todas as
 * OS são do mesmo dia.
 */

/** Ausência na coluna Detalhe: traço discreto, o mesmo da tabela de Técnicos. */
export const TODAY_EMPTY_DETAIL = '·'

/**
 * Rótulo da OS sem executor na coluna Técnico. Exportado porque o atalho da
 * caixa `A fazer` abre a lista já filtrada por ele (23/09/2026): o filtro
 * precisa do MESMO texto que a célula escreve, senão não casa com linha nenhuma.
 */
export const TODAY_NO_TECHNICIAN_LABEL = 'Sem técnico'

/** Turno da OS sem período marcado no SGI. */
export const NO_PERIOD_LABEL = 'Sem turno'

/**
 * Turno da OS sem agendamento no SGI (15/10/2026): a Ativação Remota nasce
 * sem data marcada e é feita à distância pelo suporte. Sem data, o turno que
 * o SGI possa ter gravado não diz quando (das 155 OS sem data em produção,
 * 129 tinham turno), e a célula diz o que importa. É ausência como as
 * outras: vai para o fim da ordenação, e é opção de filtro.
 */
export const NO_SCHEDULE_LABEL = 'Sem agendamento'

/**
 * Turnos com que o atalho "sem técnico" da caixa A fazer abre a lista: o que
 * a legenda nomeia, ou todos os que ela conta, pelo texto da coluna Turno.
 *
 * Desde 15/10/2026 a Ativação Remota pendente também diz "Sem técnico" na
 * lista (decisão do Mário), mas não entra na conta da legenda: ela nunca
 * terá técnico. O Turno dela é "Sem agendamento", que nunca está entre os
 * turnos contados, e assim a lista do atalho fica com exatamente as OS que a
 * legenda contou. `byPeriod` é a contagem por turno que o serviço manda.
 */
export function unassignedPresetPeriods(
  byPeriod: readonly { readonly period: string | null; readonly count: number }[],
  riskPeriod: string | null,
): string[] {
  if (riskPeriod !== null) return [riskPeriod]

  return byPeriod.filter((item) => item.count > 0).map((item) => item.period ?? NO_PERIOD_LABEL)
}

/** O que a coluna Reagendada escreve na OS nunca reagendada. É valor, não ausência. */
export const NOT_RESCHEDULED_LABEL = 'Não'

/** Motivo do reagendamento que o SGI guardou só com pontuação. */
export const RESCHEDULING_REASON_MISSING = 'Motivo não informado'

/**
 * Minutos no formato de relógio, sem decimal (decisão do Mário em
 * 13/10/2026): `1h30`, `40min`, `8h`, `1h05`.
 */
export function formatClockMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total}min`
  const hours = Math.floor(total / 60)
  const rest = total % 60

  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

/** O inverso de `formatClockMinutes`, para a coluna SLA ordenar pelo tempo; null fora do formato. */
function clockToMinutes(text: string): number | null {
  const match = /^(?:(\d+)h(\d{2})?|(\d+)min)$/.exec(text.trim())
  if (match === null) return null
  if (match[3] !== undefined) return Number(match[3])

  return Number(match[1]) * 60 + Number(match[2] ?? 0)
}

/**
 * Texto da coluna SLA: o tempo previsto da categoria e, na concluída com
 * serviço medido, o tempo real antes dele ("1h12 de 1h30"). Sem SLA, o traço.
 */
export function slaCellText(row: Pick<TodayOsRow, 'slaMinutes' | 'serviceMinutes'>): string {
  if (row.slaMinutes === null) return TODAY_EMPTY_DETAIL
  const expected = formatClockMinutes(row.slaMinutes)

  return row.serviceMinutes === null ? expected : `${formatClockMinutes(row.serviceMinutes)} de ${expected}`
}

/**
 * Barra da coluna SLA (13/10/2026, ideia do Mário): quanto do previsto o
 * serviço usou, e quanto passou dele. A escala é o MAIOR dos dois tempos,
 * para a barra caber na célula: dentro do previsto, só a parte azul,
 * proporcional ao real ("26min de 2h" enche um quinto); acima dele, o azul
 * vai até onde o previsto acabou e o resto é âmbar ("57min de 40min" é 70%
 * azul e 30% âmbar). Não há cor de bom abaixo do previsto: terminar muito
 * rápido pode ser marcação feita de uma vez no aplicativo, e o SLA é tempo
 * previsto, não meta. Null sem os dois tempos.
 */
export function slaBarShares(
  row: Pick<TodayOsRow, 'slaMinutes' | 'serviceMinutes'>,
): { readonly within: number; readonly over: number } | null {
  const { slaMinutes: expected, serviceMinutes: actual } = row
  if (expected === null || actual === null || expected <= 0) return null
  const scale = Math.max(expected, actual)
  if (scale === 0) return null

  return { within: Math.min(expected, actual) / scale, over: Math.max(actual - expected, 0) / scale }
}

/**
 * Ordem da coluna SLA (decidida pelo Mário em 13/10/2026): pela PROPORÇÃO do
 * previsto que o serviço usou, a mesma que a barra desenha. Decrescente põe
 * primeiro quem mais passou do previsto ("47h10 de 6h" antes de "4h35 de
 * 2h40", mesmo com previsto menor), no empate a de tempo real maior, e as
 * OS sem tempo medido ("6h") vêm depois de todas as medidas, pelo previsto.
 * Crescente é o espelho. Antes a ordem era pelo previsto, a da categoria, e
 * "6h" sem medida ficava acima de "4h35 de 2h40": não era "do maior ao
 * menor" para quem lê. Texto fora do formato é ausência, e a regra de
 * ausência da tabela já o manda para o fim.
 */
export function compareSlaText(a: string, b: string): number {
  const parse = (text: string) => {
    const [first, second] = text.split(' de ')
    const expected = clockToMinutes(second ?? first) ?? 0
    const actual = second === undefined ? null : clockToMinutes(first)
    // Previsto zerado não divide: o real vale como proporção, só para ordenar.
    const share = actual === null ? null : expected > 0 ? actual / expected : actual

    return { expected, actual, share }
  }
  const left = parse(a)
  const right = parse(b)

  if (left.share !== null && right.share !== null) {
    return left.share - right.share || (left.actual ?? 0) - (right.actual ?? 0) || left.expected - right.expected
  }
  if (left.share !== null || right.share !== null) return left.share === null ? -1 : 1

  return left.expected - right.expected
}

/** O que a busca da lista de OS encontra além das colunas: o último reagendamento. */
export function osRowSearchText(
  row: Pick<TodayOsRow, 'rescheduledBy' | 'reschedulingReason' | 'endedBy'>,
): string {
  // Desde 15/10/2026 também quem fechou a OS sem técnico.
  return [row.rescheduledBy, row.reschedulingReason, row.endedBy].filter((part) => part !== null).join(' ')
}

/** Texto da coluna Reagendada: `Não`, `Sim` ou `Sim 2x`. */
export function rescheduledCellText(row: Pick<TodayOsRow, 'rescheduleCount'>): string {
  if (row.rescheduleCount <= 0) return NOT_RESCHEDULED_LABEL

  return row.rescheduleCount === 1 ? 'Sim' : `Sim ${formatNumber(row.rescheduleCount)}x`
}

/**
 * O último reagendamento por extenso, para a dica de mouse do "Sim": quando,
 * quem e o motivo. É o que a tela não tem coluna para mostrar e a planilha
 * leva em colunas próprias. Null na OS nunca reagendada.
 */
export function rescheduleDescription(
  row: Pick<
    TodayOsRow,
    'rescheduleCount' | 'rescheduledAt' | 'rescheduledBy' | 'rescheduledByKind' | 'reschedulingReason'
  >,
): string | null {
  if (row.rescheduleCount <= 0) return null
  const times =
    row.rescheduleCount === 1 ? 'Reagendada uma vez' : `Reagendada ${formatNumber(row.rescheduleCount)} vezes`
  const when = row.rescheduledAt === null ? null : formatIsoDateTimeBr(row.rescheduledAt)
  const last = row.rescheduleCount === 1 ? '' : ' A última'
  const whenText = when === null ? '' : `${last === '' ? ',' : `.${last}`} em ${when.replace(' ', ' às ')}`
  // "(colaborador)" ou "(cliente)" depois do nome (pedido do Mário em
  // 13/10/2026): a pergunta "foi o cliente ou alguém da empresa?" se
  // responde na própria dica. Vem do serviço, pelo cadastro do usuário.
  const kind =
    row.rescheduledByKind === 'customer' ? ' (cliente)' : row.rescheduledByKind === 'employee' ? ' (colaborador)' : ''
  const who = row.rescheduledBy === null ? '' : `, por ${row.rescheduledBy}${kind}`
  const reason = row.reschedulingReason ?? RESCHEDULING_REASON_MISSING.toLocaleLowerCase('pt-BR')

  return `${times}${whenText}${who}. Motivo: ${reason}.`
}

/**
 * As colunas, na ordem da tela, sem o texto da célula, que vem abaixo.
 *
 * `Detalhe` fica sem painel de propósito: ela carrega a resolução, o motivo da
 * improdutiva ou o horário de início conforme a situação da OS, e recortar por
 * uma lista que mistura as três origens confundiria mais do que ajuda. Quem
 * quer só improdutivas abre a caixa de improdutivas. O código da OS ordena por
 * número e não filtra: uma lista com 142 códigos não recorta nada. A Data
 * ordena pelo calendário, com os nomes de calendário no painel. Categoria,
 * cidade e técnico têm busca no painel; as listas curtas não precisam.
 */
/**
 * SLA e Reagendada (TSK-892, 13/10/2026) entraram sem a lista ganhar rolagem
 * para o lado, por decisão do Mário: as outras colunas cederam alguns pixels
 * cada, e a janela do período alargou um pouco. `SLA` fica ao lado da
 * Categoria porque é dela que o tempo previsto vem, e ordena pelo tempo, não
 * pelo texto; não filtra, porque na concluída cada célula diz "1h12 de 1h30"
 * e uma lista com um tempo real por OS não recorta nada. `Reagendada` fica
 * ao lado do Status, que já diz "Reagendada" enquanto a OS espera a nova
 * data; depois da visita só esta coluna lembra que ela foi reagendada.
 */
const COLUMN_SPECS = [
  { key: 'date', label: 'Data', width: 92, filterable: true, sortable: true, sortKind: 'date', compare: compareBrDates },
  { key: 'id', label: 'OS', width: 118, filterable: false, sortable: true, compare: compareNumberedCodes },
  { key: 'period', label: 'Turno', width: 78, filterable: true, sortable: true },
  { key: 'serviceType', label: 'Tipo', width: 106, filterable: true, sortable: true },
  { key: 'category', label: 'Categoria', width: 190, filterable: true, sortable: true, searchable: true },
  // "11min de 40min" é o texto mais longo da coluna; medido em 13/10/2026.
  { key: 'sla', label: 'SLA', width: 112, filterable: false, sortable: true, compare: compareSlaText },
  { key: 'city', label: 'Cidade', width: 96, filterable: true, sortable: true, searchable: true },
  { key: 'technician', label: 'Técnico', width: 200, filterable: true, sortable: true, searchable: true },
  { key: 'team', label: 'Equipe', width: 110, filterable: true, sortable: true },
  { key: 'status', label: 'Status', width: 126, filterable: true, sortable: true },
  { key: 'rescheduled', label: 'Reagendada', width: 112, filterable: true, sortable: true },
  { key: 'detail', label: 'Detalhe', width: 198, filterable: false, sortable: false },
] as const satisfies readonly Omit<ListColumn<TodayOsRow>, 'text'>[]

/**
 * Chave de coluna. Sai da PRÓPRIA lista acima, e não de uma união escrita à
 * mão: assim não existe chave declarada sem coluna declarada, caso em que um
 * filtro aplicado nela seria ignorado em silêncio e o cabeçalho continuaria
 * dizendo que a lista está inteira.
 */
export type TodayColumnKey = (typeof COLUMN_SPECS)[number]['key']

export type TodayColumn = ListColumn<TodayOsRow, TodayColumnKey>

/**
 * Texto que a célula mostra, e também o valor pelo qual a coluna filtra e
 * ordena. Um só lugar decide isso: tela, filtro e ordenação nunca divergem
 * sobre o que está escrito na linha.
 *
 * A ausência é escrita por extenso, porque ela também é resposta: "Sem equipe"
 * é uma opção legítima de filtro quando o gestor procura justamente o técnico
 * que ninguém vinculou no cadastro do SGI.
 */
export function todayCellText(row: TodayOsRow, column: TodayColumnKey): string {
  switch (column) {
    case 'date':
      return row.date === undefined ? TODAY_EMPTY_DETAIL : formatDateBr(row.date)
    case 'id':
      return row.id
    case 'period':
      return row.unscheduled ? NO_SCHEDULE_LABEL : (row.period ?? NO_PERIOD_LABEL)
    case 'serviceType':
      return row.serviceType
    case 'category':
      return row.category
    case 'city':
      return row.city
    case 'technician':
      return row.technician ?? (row.hasTechnician ? 'Técnico sem nome' : TODAY_NO_TECHNICIAN_LABEL)
    case 'team':
      return row.team ?? 'Sem equipe'
    case 'status':
      return row.status
    case 'sla':
      return slaCellText(row)
    case 'rescheduled':
      return rescheduledCellText(row)
    case 'detail':
      return row.detail ?? TODAY_EMPTY_DETAIL
  }
}

const COLUMNS: readonly TodayColumn[] = COLUMN_SPECS.map((spec) => ({
  ...spec,
  text: (row: TodayOsRow) => todayCellText(row, spec.key),
}))

/** Todas as colunas, com a Data na frente: a lista da janela de OS do período. */
export const OS_LIST_COLUMNS: readonly TodayColumn[] = COLUMNS

/** As nove colunas da agenda de hoje: sem a Data, porque todas as OS são do dia. */
export const TODAY_COLUMNS: readonly TodayColumn[] = COLUMNS.filter(
  (column) => column.key !== 'date',
)

/** Soma das larguras: é o piso da tabela, abaixo dele ela rola na horizontal. */
export function tableMinWidth(columns: readonly TodayColumn[]): number {
  return listTableMinWidth(columns)
}

export const TODAY_TABLE_MIN_WIDTH = tableMinWidth(TODAY_COLUMNS)

export type TodayOsSortDirection = ListSortDirection

export type TodayOsSort = ListSort<TodayColumnKey>

/**
 * Valores escolhidos por coluna. Lista ausente ou vazia significa SEM FILTRO,
 * e não "nenhum valor selecionado": é a mesma convenção da tabela de Vendas.
 */
export type TodayOsTableFilters = ListTableFilters<TodayColumnKey>

export type TodayTableOption = ListTableOption

/**
 * Rótulos de ausência, os MESMOS que `todayCellText` escreve. Declarados, e
 * não adivinhados por prefixo: "sem conexão" é categoria de verdade do SGI, e
 * uma regra por texto a trataria como buraco.
 */
const MISSING_LABELS: ReadonlySet<string> = new Set([
  NO_PERIOD_LABEL,
  NO_SCHEDULE_LABEL,
  TODAY_NO_TECHNICIAN_LABEL,
  'Técnico sem nome',
  'Sem equipe',
  TODAY_EMPTY_DETAIL,
])

/**
 * O que a lista de OS sabe das próprias linhas: a ausência vai para o fim, e
 * o empate na ordenação volta ao código da OS, para a ordem não depender do
 * acaso.
 */
export const TODAY_TABLE_RULES: ListTableRules<TodayOsRow> = {
  missing: MISSING_LABELS,
  tieBreak: (a, b) => compareNumberedCodes(a.id, b.id),
}

/**
 * Linhas que passam nos filtros de coluna. Devolve o MESMO tipo de linha que
 * recebeu: a janela do período guarda na linha a OS de origem, e é dela que a
 * planilha sai, na ordem e no recorte da tela.
 *
 * Os filtros são procurados em TODAS as colunas, e não só nas da agenda de
 * hoje: um filtro na Data da janela do período ficaria ignorado em silêncio,
 * com o cabeçalho dizendo que a lista está inteira.
 */
export function filterTodayRows<Row extends TodayOsRow>(
  rows: readonly Row[],
  filters: TodayOsTableFilters,
): Row[] {
  return filterListRows(rows, OS_LIST_COLUMNS, filters)
}

export function hasTodayTableFilters(filters: TodayOsTableFilters): boolean {
  return hasListFilters(OS_LIST_COLUMNS, filters)
}

/** Opções de uma coluna, no contexto dos DEMAIS filtros, com a ausência no fim. */
export function todayColumnOptions(
  rows: readonly TodayOsRow[],
  column: TodayColumnKey,
  filters: TodayOsTableFilters,
): TodayTableOption[] {
  return listColumnOptions(rows, OS_LIST_COLUMNS, column, filters, TODAY_TABLE_RULES)
}

/**
 * Ordena pela coluna escolhida. Sem escolha, devolve a lista como veio: a
 * ordem da operação (turno, técnico, código) na agenda de hoje, decidida em
 * `buildTodayRows`, e a data mais recente primeiro na janela do período,
 * decidida em `buildOsListRows`.
 */
export function sortTodayRows<Row extends TodayOsRow>(rows: readonly Row[], sort: TodayOsSort): Row[] {
  return sortListRows(rows, OS_LIST_COLUMNS, sort, TODAY_TABLE_RULES)
}
