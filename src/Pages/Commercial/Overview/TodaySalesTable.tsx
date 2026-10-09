import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { ListTable } from '../../../components/dashboard/ListTable'
import { useMoneyShown } from './moneyVisibility'
import type { TodaySaleRow } from './todaySalesModel'
import {
  todaySalesColumns,
  TODAY_SALES_TABLE_RULES,
  type TodaySalesColumn,
  type TodaySalesTableFilters,
} from './todaySalesTableModel'

/**
 * Lista dos contratos por trás de uma caixa da faixa Hoje ao vivo da Visão
 * Geral Comercial (25/09/2026).
 *
 * A faixa responde quantos; esta lista responde quais. Abre embaixo da caixa
 * clicada, com o recorte que a caixa representa, e fecha no mesmo clique. É
 * a ponte entre o número e a ação: o gestor lê "181 fora do prazo", abre, vê
 * o contrato, o dia da venda, o vendedor e há quanto tempo a etapa espera, e
 * já sabe a quem cobrar. Desde 25/09/2026 é também a lista da janela da
 * Safra e do painel Vendas ativadas por mês (`SalesListDialog`), com `fill` e o contêiner do
 * filtro de coluna da janela, e sem o Fechar próprio.
 *
 * A tabela em si é a lista do portal (`ListTable`); o que fica aqui é o que
 * só a venda sabe: as colunas (`todaySalesTableModel`), a cor da situação na
 * célula e a marca de atenção no Detalhe do contrato fora do prazo, a mesma
 * da célula de técnico na lista de OS de hoje. A planilha do `Baixar Excel`
 * é de quem abre a lista, que sabe o recorte (`todaySalesExport`).
 */

const DEFAULT_EMPTY_MESSAGE = 'Nenhum contrato nesta caixa agora.'

/** Explicação da marca de atenção, para quem parar o ponteiro na célula. */
const LATE_TITLE = 'Fora do prazo: a próxima etapa não aconteceu a tempo, sem contar domingo.'

type ColumnRef = Pick<TodaySalesColumn, 'key'>

function cellClassName(_row: TodaySaleRow, column: ColumnRef): string {
  if (column.key === 'id') return 'font-mono font-semibold text-[var(--text-heading)]'
  if (column.key === 'soldOn' || column.key === 'time' || column.key === 'value') {
    return 'font-mono text-[var(--text-primary)]'
  }
  if (column.key === 'plan' || column.key === 'seller') return 'text-[var(--text-primary)]'

  return 'text-[var(--text-secondary)]'
}

function cellTitle(row: TodaySaleRow, column: ColumnRef, text: string): string {
  if (column.key !== 'detail') return text
  if (row.late) return `${text}. ${LATE_TITLE}`

  // A venda resolvida fora do fluxo do SGI tem Detalhe curto; a dica explica.
  return row.detailNote ?? text
}

export function TodaySalesTable({
  colorOf,
  description,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  fill,
  id,
  label,
  loadingMessage,
  onClose,
  onDownload,
  onRestore,
  panelContainer,
  rows,
}: {
  /** Cor da situação do contrato, a MESMA da caixa que o conta. */
  colorOf: (row: TodaySaleRow) => string
  /** Frase de apoio abaixo do título: o que a lista traz e em que ordem. */
  description: string
  emptyMessage?: string
  /** Dentro da janela de contratos (Safra e Vendas ativadas por mês), a tabela ocupa a altura que sobra. */
  fill?: boolean
  id?: string
  label: string
  /** Com valor, os contratos ainda estão sendo buscados: linhas em cinza (ver `ListTable`). */
  loadingMessage?: string
  /** Sem ele, a lista não tem o Fechar: na janela, quem fecha é a janela. */
  onClose?: () => void
  /** Liga o `Baixar Excel`, com as linhas VISÍVEIS, na ordem da tela, e os filtros de coluna em uso. */
  onDownload?: (rows: readonly TodaySaleRow[], filters: TodaySalesTableFilters) => void
  /** O que mais o `Restaurar tabela` faz: a lista do atalho volta à da caixa. */
  onRestore?: () => void
  /** Na janela de lista, onde o painel do filtro de coluna nasce. */
  panelContainer?: HTMLElement | null
  rows: readonly TodaySaleRow[]
}) {
  const moneyShown = useMoneyShown()
  const renderCell = (row: TodaySaleRow, column: ColumnRef, text: string): ReactNode => {
    if (column.key === 'status') {
      return (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 flex-none rounded-full"
            style={{ background: colorOf(row) }}
          />
          <span className="min-w-0 truncate text-[var(--text-primary)]">{text}</span>
        </span>
      )
    }
    if (column.key === 'detail' && row.late) {
      // Só a célula, e não a linha inteira, para não brigar com o hover nem
      // pesar numa lista de cento e tantas linhas.
      return (
        <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--live-attention)' }}>
          <AlertTriangle aria-hidden="true" className="h-3 w-3 flex-none" strokeWidth={2.2} />
          <span className="min-w-0 truncate">{text}</span>
          <span className="sr-only">, fora do prazo</span>
        </span>
      )
    }

    return text
  }

  return (
    <ListTable
      ariaLabel={`Contratos: ${label}`}
      cellClassName={cellClassName}
      cellTitle={cellTitle}
      columns={todaySalesColumns(moneyShown)}
      description={description}
      emptyMessage={emptyMessage}
      fill={fill}
      filteredEmptyMessage="Nenhum contrato com os filtros das colunas."
      id={id}
      label={label}
      loadingMessage={loadingMessage}
      onClose={onClose}
      onDownload={onDownload}
      onRestore={onRestore}
      panelContainer={panelContainer}
      renderCell={renderCell}
      rowKey={(row) => row.id}
      rows={rows}
      rules={TODAY_SALES_TABLE_RULES}
      // "1 contrato", "5 contratos": a lista escreve a contagem com a unidade.
      unit={rows.length === 1 ? 'contrato' : 'contratos'}
    />
  )
}
