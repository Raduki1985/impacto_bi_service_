import { useEffect, useRef, useState } from 'react'

import { usePreferences } from '../../contexts/usePreferences'
import { cn } from '../../lib/utils'
import { ExecutiveMetricCard, type ExecutiveMetricCardProps } from './ExecutiveMetricCard'

/**
 * Um card da coleção: tudo o que o `ExecutiveMetricCard` pede, menos o que a
 * grade decide sozinha (aberto ou fechado, o clique e o tema).
 */
export type ExecutiveGridCard = Omit<ExecutiveMetricCardProps, 'open' | 'onToggle' | 'theme'> & {
  /** Identidade do card na coleção: é o que diz qual está aberto. */
  readonly id: string
}

/**
 * Coleção de cards executivos de uma página.
 *
 * O `ExecutiveMetricCard` é puro: cada card recebe `open` e `onToggle`, e a
 * regra "um card aberto por vez" pertence a quem monta a coleção. Até
 * 24/09/2026 essa regra estava copiada em quatro páginas (Visão Geral de OS,
 * Gestão de Técnicos, Visão Geral Comercial e Vendas por Período), com o
 * mesmo estado e o mesmo ouvinte de clique fora. A grade a concentra:
 *
 * - um único identificador controla a coleção inteira: abrir um card fecha
 *   automaticamente o anterior, e nunca existem duas leituras abertas;
 * - um clique ou toque fora da coleção fecha a leitura aberta;
 * - o tema vem das preferências, porque o card precisa dele para a paleta da
 *   leitura gerencial, e nenhuma página tem motivo para passar outro.
 *
 * A largura de cada card continua decisão da página, pelas colunas da grade
 * (`columnsClass`); o padrão é o das páginas de OS, quatro por linha no `lg`.
 * O piso de altura, quando existe, vai no próprio card (`minHeight`), como
 * as páginas comerciais fazem por causa do velocímetro.
 */
export function ExecutiveCardGrid({
  ariaLabel,
  cards,
  className,
  columnsClass = 'sm:grid-cols-2 lg:grid-cols-4',
}: {
  ariaLabel: string
  cards: readonly ExecutiveGridCard[]
  /** Margem ou outro ajuste externo da grade. */
  className?: string
  /** Colunas por ponto de quebra. */
  columnsClass?: string
}) {
  const { theme } = usePreferences()
  const [openCard, setOpenCard] = useState<string | null>(null)
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (openCard === null) return
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node) !== true) {
        setOpenCard(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openCard])

  return (
    <section
      aria-label={ariaLabel}
      className={cn('grid grid-cols-1 gap-3.5', columnsClass, className)}
      ref={containerRef}
    >
      {cards.map(({ id, ...card }) => (
        <ExecutiveMetricCard
          {...card}
          key={id}
          onToggle={() => setOpenCard((current) => (current === id ? null : id))}
          open={openCard === id}
          theme={theme}
        />
      ))}
    </section>
  )
}
