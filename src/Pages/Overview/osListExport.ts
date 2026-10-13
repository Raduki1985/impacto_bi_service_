import { mondayOf, periodIncludesToday, type OverviewOsFilters } from '../../data/overviewOsFilters'
import { formatDateBr, formatIsoDateTimeBr, formatNumber } from '../../lib/formatters'
import { OS_GROUPS, OS_OUTCOMES, periodTitle } from './overviewModel'
import type { PeriodOsRow } from './todayOsModel'
import {
  NOT_RESCHEDULED_LABEL,
  RESCHEDULING_REASON_MISSING,
  todayCellText,
  type TodayColumn,
  type TodayOsTableFilters,
} from './todayOsTableModel'
import { buildXlsx, type XlsxColumn, type XlsxValue } from '../../lib/xlsxWriter'

/**
 * Planilha das OS da Visão Geral: colunas, formato e nome do arquivo.
 *
 * Serve às duas saídas pedidas pelo Mário em 24/09/2026: o `Baixar Excel` da
 * janela de OS, com exatamente o que a lista mostra, e o botão que baixa as
 * OS do período inteiro, para quando o gestor quiser montar o relatório do
 * mês ou da semana. O que ele congela:
 *
 * - uma linha por OS, na ordem da tela, e com mais colunas do que a tela: a
 *   planilha é para tabela dinâmica, e o gestor precisa de Semana, Mês, Grupo
 *   e Destino como colunas próprias para agrupar sem fórmula;
 * - Turno, Técnico e Equipe com o MESMO texto da lista (`todayCellText`),
 *   inclusive "Sem técnico" e "Sem equipe": a ausência é resposta, e a tabela
 *   dinâmica a conta como qualquer outro valor;
 * - Grupo e Destino pela mesma regra dos painéis (`groupOf`, `outcomeOf`); o
 *   motivo pela mesma do painel de motivos (`reasonOf`), só nas
 *   improdutivas; e a resolução só nas concluídas, como o ranking de
 *   resoluções e o Detalhe da lista. A planilha soma o que a página mostra:
 *   uma Encerrada que carrega resolução no SGI não vira resolução a mais na
 *   tabela dinâmica (achado da revisão de dados de 24/09/2026);
 * - campo que a FONTE não traz sai vazio, e não como ausência do SGI: "Sem
 *   turno" e "Sem motivo registrado" dizem que o SGI não guardou o dado, e a
 *   base local de estudo nem tem os dois campos;
 * - "Início da semana" é a segunda-feira, a mesma semana dos atalhos de
 *   período. "Mês" vai como `aaaa-mm`, que ordena certo em qualquer tabela
 *   dinâmica: por nome, "nov" viria antes de "out";
 * - uma segunda aba, "Filtros", diz de que recorte a planilha saiu, quando o
 *   serviço leu o banco e se o período inclui o dia de hoje, ainda em
 *   andamento. O arquivo circula sem a tela, e sem ela ninguém saberia o que
 *   as linhas somam nem de que hora são os status;
 * - nada de cliente, endereço, telefone ou observação: a planilha leva o que
 *   o serviço já entrega ao portal, e nada além.
 */

export const OS_EXPORT_COLUMNS = [
  { header: 'Data', width: 11, type: 'date' },
  { header: 'Início da semana', width: 15, type: 'date' },
  { header: 'Mês', width: 9, type: 'text' },
  { header: 'OS', width: 15, type: 'text' },
  { header: 'Turno', width: 10, type: 'text' },
  { header: 'Grupo', width: 15, type: 'text' },
  { header: 'Destino', width: 15, type: 'text' },
  { header: 'Status', width: 22, type: 'text' },
  { header: 'Tipo de OS', width: 20, type: 'text' },
  { header: 'Categoria', width: 28, type: 'text' },
  { header: 'Cidade', width: 22, type: 'text' },
  { header: 'Técnico', width: 26, type: 'text' },
  { header: 'Equipe', width: 16, type: 'text' },
  { header: 'Motivo da improdutiva', width: 28, type: 'text' },
  { header: 'Resolução', width: 32, type: 'text' },
  { header: 'Dificuldade', width: 12, type: 'text' },
  { header: 'Início do serviço', width: 17, type: 'datetime' },
  { header: 'Fim do serviço', width: 17, type: 'datetime' },
  { header: 'Deslocamento (min)', width: 19, type: 'decimal' },
  // SLA e reagendamento (TSK-892, 13/10/2026). Em MINUTOS inteiros, como o
  // deslocamento, para as três colunas somarem sem conversão na tabela
  // dinâmica; a tela mostra o relógio ("1h30"), a planilha o número (90).
  { header: 'SLA (min)', width: 11, type: 'decimal' },
  { header: 'Duração do serviço (min)', width: 23, type: 'decimal' },
  { header: 'Reagendada', width: 12, type: 'text' },
  { header: 'Reagendamentos', width: 16, type: 'decimal' },
  { header: 'Reagendada por', width: 26, type: 'text' },
  { header: 'Motivo do reagendamento', width: 32, type: 'text' },
  { header: 'Último reagendamento em', width: 22, type: 'datetime' },
] as const satisfies readonly XlsxColumn[]

/** Nome da aba e da Tabela do Excel com as OS. */
export const OS_EXPORT_SHEET = 'OS'
export const OS_EXPORT_TABLE = 'OrdensDeServico'

const GROUP_LABELS = new Map(OS_GROUPS.map((group) => [group.key, group.label]))
const OUTCOME_LABELS = new Map(OS_OUTCOMES.map((outcome) => [outcome.key, outcome.label]))

/** Uma OS da lista como linha da planilha, na ordem de `OS_EXPORT_COLUMNS`. */
export function osExportRow(row: PeriodOsRow): XlsxValue[] {
  const record = row.source
  // Grupo, destino e motivo vêm do serviço com a OS (01/10/2026): é a mesma
  // regra do painel que abriu a lista, sem uma cópia dela no portal.
  const outcome = record.outcome

  return [
    record.dateISO,
    mondayOf(record.dateISO),
    record.dateISO.slice(0, 7),
    record.id,
    // Sem o campo na fonte, vazio; com o campo nulo, "Sem turno", como na lista.
    record.period === undefined ? null : todayCellText(row, 'period'),
    record.group === undefined ? null : (GROUP_LABELS.get(record.group) ?? null),
    outcome === undefined ? null : (OUTCOME_LABELS.get(outcome) ?? null),
    record.status,
    record.serviceType,
    record.category,
    record.city,
    todayCellText(row, 'technician'),
    todayCellText(row, 'team'),
    outcome === 'unproductive' ? (record.listReason ?? null) : null,
    outcome === 'completed' ? record.resolution : null,
    record.difficulty ?? null,
    record.startedAt ?? null,
    record.finishedAt ?? null,
    record.travelMinutes ?? null,
    record.slaMinutes ?? null,
    // Só na concluída, como a coluna SLA da tela: é o tempo que se compara.
    row.serviceMinutes,
    // Sem o campo na fonte, vazio; com o campo, "Não" é resposta, como na lista.
    record.rescheduledAt === undefined ? null : row.rescheduleCount > 0 ? 'Sim' : NOT_RESCHEDULED_LABEL,
    record.rescheduledAt === undefined ? null : row.rescheduleCount,
    row.rescheduledBy,
    row.rescheduleCount === 0 ? null : (row.reschedulingReason ?? RESCHEDULING_REASON_MISSING),
    row.rescheduledAt,
  ]
}

/** Texto do botão que baixa as OS do período: diz quantas e em que formato. */
export function periodDownloadLabel(count: number): string {
  return `Baixar ${formatNumber(count)} OS em Excel`
}

/** De que recorte a planilha saiu, escrito para quem abre o arquivo longe da tela. */
export type OsExportContext = {
  /** `Motivos de improdutiva · Cliente ausente`, ou `Todas as OS do período`. */
  readonly selection: string
  readonly period: string
  /** Filtros da faixa da página além do período; null sem nenhum. */
  readonly pageFilters: string | null
  /** Filtros de coluna da lista; `undefined` quando a planilha não saiu de uma lista. */
  readonly listFilters?: string | null
  readonly source: string
  /**
   * Hora em que o serviço leu o banco para a carga da página, ISO com fuso;
   * null sem a informação. A página carrega uma vez, então é esta a hora dos
   * status na planilha, e não a do clique.
   */
  readonly readAt: string | null
  /** Hora do clique em Baixar, já escrita. */
  readonly generatedAt: string
}

/** Rótulo em negrito à esquerda e o valor à direita, sem cabeçalho. */
const INFO_COLUMNS: readonly XlsxColumn[] = [
  { header: 'Item', width: 22, type: 'text', bold: true },
  { header: 'Valor', width: 100, type: 'text' },
]

export function osExportInfoRows(context: OsExportContext, count: number): [string, string][] {
  const rows: [string, string][] = [
    ['Seleção', context.selection],
    ['Período', context.period],
    ['Filtros da página', context.pageFilters ?? 'Nenhum'],
  ]
  if (context.listFilters !== undefined) {
    rows.push(['Filtros da lista', context.listFilters ?? 'Nenhum'])
  }
  rows.push(['OS na planilha', formatNumber(count)], ['Fonte', context.source])
  const readAt = context.readAt === null ? null : formatIsoDateTimeBr(context.readAt)
  if (readAt !== null) rows.push(['Dados lidos em', readAt])
  rows.push(['Gerada em', context.generatedAt])

  return rows
}

/** O arquivo inteiro: a aba das OS, como Tabela do Excel, e a aba do recorte. */
export function buildOsWorkbook(
  rows: readonly PeriodOsRow[],
  context: OsExportContext,
): Uint8Array<ArrayBuffer> {
  return buildXlsx([
    {
      name: OS_EXPORT_SHEET,
      table: OS_EXPORT_TABLE,
      columns: OS_EXPORT_COLUMNS,
      rows: rows.map(osExportRow),
    },
    { name: 'Filtros', columns: INFO_COLUMNS, rows: osExportInfoRows(context, rows.length) },
  ])
}

/**
 * Filtros de coluna da lista, em texto (`Cidade: Atibaia, Piracaia · Técnico:
 * Ana Souza`); null sem nenhum. Só colunas com valor escolhido entram.
 */
export function describeListFilters(
  filters: TodayOsTableFilters,
  columns: readonly TodayColumn[],
): string | null {
  const parts = columns.flatMap((column) => {
    const selected = filters[column.key] ?? []

    return selected.length === 0 ? [] : [`${column.label}: ${selected.join(', ')}`]
  })

  return parts.length === 0 ? null : parts.join(' · ')
}

/**
 * Período pelo nome e pelas datas: "Setembro de 2026, até o dia 23
 * (01/09/2026 a 23/09/2026)". O nome sozinho depende do calendário de quem
 * lê; as datas fecham a dúvida. Recorte livre já é escrito pelas datas.
 *
 * Período que alcança hoje leva o mesmo aviso da página, "inclui hoje, ainda
 * em andamento": as OS de hoje saem com o status da hora da leitura.
 * `today` existe para os testes fixarem a data; no portal vale o relógio,
 * como no aviso da página.
 */
export function osExportPeriod(
  filters: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>,
  today?: string,
): string {
  const range = `${formatDateBr(filters.dateFrom)} a ${formatDateBr(filters.dateTo)}`
  const title = periodTitle(filters)
  const period = title === range ? range : `${title} (${range})`

  return periodIncludesToday(filters, today) ? `${period} · inclui hoje, ainda em andamento` : period
}

/** De onde vieram as OS, dito na aba de recorte. */
export function osExportSource(origin: 'api' | 'local', updatedAt: string | null): string {
  if (origin === 'local') {
    return 'Base local de estudo, sanitizada: códigos de OS e técnicos são anônimos, não é o SGI'
  }

  return updatedAt === null
    ? 'SGI, pelo serviço de BI'
    : `SGI, pelo serviço de BI, com dados atualizados em ${formatDateBr(updatedAt)}`
}

/** Sem acento, em minúsculas, com hífen no lugar de espaço e pontuação. */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Nome do arquivo: `os-cliente-ausente-2026-09-01-a-2026-09-23.xlsx`. Sem
 * seleção, só `os` e as datas. As datas em ISO para a pasta de downloads
 * ordenar os arquivos na ordem do calendário.
 */
export function osExportFileName(
  selection: string | null,
  range: Pick<OverviewOsFilters, 'dateFrom' | 'dateTo'>,
): string {
  const name = selection === null ? '' : slug(selection)
  const base = name === '' ? 'os' : name.startsWith('os-') ? name : `os-${name}`

  return `${base}-${range.dateFrom}-a-${range.dateTo}.xlsx`
}
