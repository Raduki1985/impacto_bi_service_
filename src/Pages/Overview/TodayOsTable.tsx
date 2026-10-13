import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { ListTable } from '../../components/dashboard/ListTable'
import { statusColors } from '../../data/dashboardAggregates'
import type { TodayOsRow } from './todayOsModel'
import {
  formatClockMinutes,
  rescheduleDescription,
  TODAY_COLUMNS,
  TODAY_TABLE_RULES,
  type TodayColumn,
  type TodayColumnKey,
  type TodayOsTableFilters,
} from './todayOsTableModel'

/**
 * Lista das OS por trás de uma caixa da faixa "Hoje ao vivo" e da janela de
 * OS do período.
 *
 * A faixa responde quantas; esta tabela responde quais. Ela abre embaixo da
 * caixa clicada, com o recorte que a caixa representa, e fecha no mesmo
 * clique. É a ponte entre o número e a ação: o gestor lê "4 improdutivas",
 * abre, vê o código da OS, o turno, a cidade, o técnico, a equipe e o motivo,
 * e já sabe a quem falar.
 *
 * Desde 24/09/2026 a tabela em si é a lista do portal (`ListTable`), com o
 * recorte e a ordenação por coluna de qualquer página. O que fica aqui é o
 * que só a OS sabe: as colunas (`todayOsTableModel`), a cor do status na
 * célula, a marca de atenção da OS sem técnico e as frases de apoio.
 */

/**
 * Cor do status na lista, a MESMA dos gráficos de OS da página: status tem
 * cor fixa, nunca por posição. Rótulo novo do SGI, ainda sem cor declarada,
 * cai no cinza neutro do Pendente, pelo token e não por um hex repetido aqui,
 * que é o mesmo caminho da rosca de tipos (`serviceTypeColor`).
 */
const UNKNOWN_STATUS_COLOR = statusColors.Pendente

/** Explicação da marca de atenção, para quem parar o ponteiro na célula. */
const UNASSIGNED_AT_RISK_TITLE =
  'Sem técnico, e o turno desta OS já passou da hora em que costuma começar.'

/** Frase de apoio das listas das caixas: o que a coluna Detalhe traz em cada situação. */
const DEFAULT_DESCRIPTION =
  'Cada coluna filtra e ordena só esta lista. SLA é o tempo previsto de serviço da categoria e, na concluída, o tempo real antes dele. Detalhe traz a resolução nas concluídas, o motivo nas improdutivas e o horário nas que estão em campo.'

/** Dica da coluna SLA: o que o número previsto é, e o que o real é quando aparece. */
const SLA_EXPECTED_TITLE = 'Tempo previsto de serviço no cliente para esta categoria, no SGI.'

/** A cor da OS reagendada na coluna, a MESMA do status Reagendada nos gráficos. */
const RESCHEDULED_COLOR = statusColors.Reagendada

/** Aviso da lista sem OS: a da agenda de hoje fala do momento. */
const DEFAULT_EMPTY_MESSAGE = 'Nenhuma OS nesta situação agora.'

type ColumnRef = Pick<TodayColumn, 'key'>

function cellClassName(_row: TodayOsRow, column: ColumnRef): string {
  const key: TodayColumnKey = column.key
  if (key === 'id') return 'font-mono font-semibold text-[var(--text-heading)]'
  if (key === 'date') return 'font-mono text-[var(--text-secondary)]'
  if (key === 'category') return 'text-[var(--text-primary)]'

  return 'text-[var(--text-secondary)]'
}

function cellTitle(row: TodayOsRow, column: ColumnRef, text: string): string {
  if (column.key === 'technician' && row.unassignedAtRisk) return UNASSIGNED_AT_RISK_TITLE
  if (column.key === 'sla' && row.slaMinutes !== null) {
    return row.serviceMinutes === null
      ? SLA_EXPECTED_TITLE
      : `Serviço de ${formatClockMinutes(row.serviceMinutes)}, do início ao fim no cliente, contra ${formatClockMinutes(row.slaMinutes)} previstos para a categoria.`
  }
  // O último reagendamento por extenso: quem, quando e o motivo. A tela não
  // tem coluna para isso (decisão do Mário em 13/10/2026, para a lista não
  // rolar para o lado); a planilha leva em colunas próprias.
  if (column.key === 'rescheduled') return rescheduleDescription(row) ?? text

  return text
}

function renderCell(row: TodayOsRow, column: ColumnRef, text: string): ReactNode {
  if (column.key === 'status') {
    return (
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 flex-none rounded-full"
          style={{ background: statusColors[text] ?? UNKNOWN_STATUS_COLOR }}
        />
        <span className="min-w-0 truncate text-[var(--text-primary)]">{text}</span>
      </span>
    )
  }
  if (column.key === 'rescheduled' && row.rescheduleCount > 0) {
    // A bolinha na cor do status Reagendada: enquanto a OS espera a nova
    // data o Status já a mostra, e depois da visita é esta coluna que lembra
    // que ela foi reagendada. As duas se leem como a mesma coisa.
    return (
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 flex-none rounded-full"
          style={{ background: RESCHEDULED_COLOR }}
        />
        <span className="min-w-0 truncate text-[var(--text-primary)]">{text}</span>
      </span>
    )
  }
  if (column.key === 'technician' && row.unassignedAtRisk) {
    // A MESMA marca da caixa `A fazer`, pela mesma régua: a linha diz qual é
    // a OS que a caixa contou. Só a célula, e não a linha inteira, para não
    // brigar com o hover nem pesar numa lista de sessenta linhas.
    return (
      <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--os-attention)' }}>
        <AlertTriangle aria-hidden="true" className="h-3 w-3 flex-none" strokeWidth={2.2} />
        <span className="min-w-0 truncate">{text}</span>
        <span className="sr-only">, turno já iniciado</span>
      </span>
    )
  }

  return text
}

export function TodayOsTable<Row extends TodayOsRow>({
  columns = TODAY_COLUMNS,
  description = DEFAULT_DESCRIPTION,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  fill = false,
  id,
  initialFilters,
  label,
  loadingMessage,
  onClose,
  onDownload,
  onRestore,
  panelContainer,
  rows,
}: {
  /** Colunas da lista; a janela do período põe a Data na frente. */
  columns?: readonly TodayColumn[]
  /** Frase de apoio abaixo do título; a lista de dias anteriores explica o próprio Detalhe. */
  description?: string
  emptyMessage?: string
  /** A lista ocupa a altura da janela, em vez do teto fixo da faixa de hoje. */
  fill?: boolean
  id?: string
  /**
   * Recorte de coluna com que a lista ABRE, para o atalho "sem técnico" da
   * caixa `A fazer` (23/09/2026). Lido uma vez, na montagem: quem quiser
   * outro recorte inicial monta outra tabela (troca a `key`).
   */
  initialFilters?: TodayOsTableFilters
  label: string
  /** Com valor, as OS ainda estão sendo buscadas: linhas em cinza (ver `ListTable`). */
  loadingMessage?: string
  /** Sem ele não há `Fechar`: na janela do período quem fecha é a própria janela. */
  onClose?: () => void
  /** Liga o `Baixar Excel`, com as linhas VISÍVEIS, na ordem da tela, e os filtros de coluna em uso. */
  onDownload?: (rows: readonly Row[], filters: TodayOsTableFilters) => void
  /**
   * O que mais o `Restaurar tabela` faz: a lista aberta por um atalho de
   * canto avisa a faixa para voltar à lista da caixa (pedido do Mário em
   * 23/09/2026). Sem avisar a faixa, a identidade da tabela continuava a do
   * atalho depois do Restaurar, e um segundo clique no atalho não remontava a
   * lista com o filtro.
   */
  onRestore?: () => void
  /** Onde o painel do filtro de coluna nasce: dentro da janela de OS, quando é ela. */
  panelContainer?: HTMLElement | null
  rows: readonly Row[]
}) {
  return (
    <ListTable
      ariaLabel={`Ordens de serviço: ${label}`}
      cellClassName={cellClassName}
      cellTitle={cellTitle}
      columns={columns}
      description={description}
      emptyMessage={emptyMessage}
      fill={fill}
      filteredEmptyMessage="Nenhuma OS com os filtros das colunas."
      id={id}
      initialFilters={initialFilters}
      label={label}
      loadingMessage={loadingMessage}
      onClose={onClose}
      onDownload={onDownload}
      onRestore={onRestore}
      panelContainer={panelContainer}
      renderCell={renderCell}
      rowKey={(row) => row.id}
      rows={rows}
      rules={TODAY_TABLE_RULES}
      unit="OS"
    />
  )
}
