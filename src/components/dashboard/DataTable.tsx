import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

type DataTableProps = {
  headers: ReactNode[]
  children: ReactNode
  minWidth?: number
  /** Rolagem vertical interna com cabeçalho fixo, limitada à altura do pai.
      Sem a prop, o comportamento continua exatamente o original. */
  scrollY?: boolean
  /** Larguras por coluna. Presente, troca o layout automático por table-fixed,
      então as colunas param de depender do conteúdo da página renderizada.
      Uma posição undefined absorve o espaço restante. */
  columnWidths?: Array<string | undefined>
}

export function DataTable({
  headers,
  children,
  minWidth = 720,
  scrollY = false,
  columnWidths,
}: DataTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]',
        scrollY && 'flex max-h-full min-h-0 flex-col',
      )}
    >
      {/* Um único elemento controla os dois eixos quando scrollY está ativo,
          para o sticky do cabeçalho prender no scroller correto. */}
      <div className={cn(scrollY ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto')}>
        <table
          className={cn('w-full border-collapse text-[12.5px]', columnWidths && 'table-fixed')}
          style={{ minWidth }}
        >
          {columnWidths ? (
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={index} style={width ? { width } : undefined} />
              ))}
            </colgroup>
          ) : null}
          <thead>
            <tr className="bg-[var(--surface-elevated)] text-left text-[var(--text-secondary)]">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className={cn(
                    'px-4 py-2.5 font-semibold',
                    // Fundo no próprio th e sombra no lugar de borda: com
                    // border-collapse, bordas e fundo do tr não acompanham
                    // células sticky durante a rolagem.
                    scrollY && 'sticky top-0 z-10 bg-[var(--surface-elevated)] shadow-[inset_0_-1px_0_var(--border)]',
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}
