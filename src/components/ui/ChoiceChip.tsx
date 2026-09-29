import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { outlineChipClass, tintedChipClass } from './chipStyles'

/**
 * Pílula de escolha: um botão de pressionar, aceso quando é a escolha atual.
 *
 * É o atalho de período da faixa de filtros e o atalho de seleção no topo da
 * janela de OS. O estado nunca depende só da cor: `aria-pressed` diz ao
 * leitor de tela qual está aceso, e o texto do botão nomeia a escolha.
 * Desabilitado, ele fica visível e apagado, com o motivo no `title`, em vez
 * de sumir: o gestor precisa ver que "Mês passado" existe mesmo quando a fonte
 * não o cobre.
 */
export function ChoiceChip({
  children,
  className,
  disabled = false,
  onClick,
  pressed,
  title,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
  onClick: () => void
  pressed: boolean
  /** Dica ao parar o ponteiro: o período por extenso, ou o motivo de estar desabilitado. */
  title?: string
}) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        pressed ? tintedChipClass : outlineChipClass,
        'flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        // Desabilitado mantém a mãozinha, só apagado: o sinal de proibido
        // parecia erro, e o motivo já está na dica (pedido do Mário em
        // 28/09/2026).
        'cursor-pointer',
        disabled && 'opacity-50',
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}
