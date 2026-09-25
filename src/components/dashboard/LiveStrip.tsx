import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatNumber } from '../../lib/formatters'

/**
 * Faixa "ao vivo" de uma página de dashboard: o quadro do dia, lido do
 * serviço a cada minuto, em caixas que abrem a lista do que contam.
 *
 * Nasceu como a faixa Hoje ao vivo da Visão Geral de OS (21/09/2026) e virou
 * componente em 25/09/2026, quando a Visão Geral Comercial ganhou o mesmo
 * quadro para as vendas do dia (pedido do Mário: "a mesma faixa, com a
 * tabela que abre no clique"). O que mora aqui é a moldura e a caixa; o que
 * cada caixa conta, a cor dela e a lista que abre são da página.
 *
 * O que a moldura congela:
 *
 * - a superfície é a dos painéis executivos (`executive-panel`), e o título
 *   fica VERDE com um ponto que pulsa quando a leitura é ao vivo (pedido do
 *   Mário em 23/09/2026): é o sinal de "isto está acontecendo agora". Com a
 *   base local não há leitura ao vivo e o título fica na cor de sempre; a
 *   frase ao lado diz o motivo. Badge foi descartado: pareceria filtro ativo
 *   ou alerta;
 * - a frase de apoio diz de quando é o quadro, a hora da leitura no serviço
 *   e se os filtros da página valem, com as partes separadas por ` · `;
 * - o par de cores da faixa (`--live-accent`, o verde; `--live-attention`,
 *   o âmbar de atenção dos atalhos) vem da classe `live-strip`, medido nos
 *   dois temas em `styles.css`. A página não os declara.
 */
export function LiveStrip({
  ariaLabel,
  children,
  className,
  live,
  subtitle,
  title = 'Hoje ao vivo',
}: {
  ariaLabel: string
  children: ReactNode
  /** Classe da página, para os tokens que só ela tem (o `.os-today` da OS). */
  className?: string
  /** A leitura vem do serviço, agora: título verde e ponto pulsando. */
  live: boolean
  subtitle: string
  title?: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`live-strip executive-panel mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm${className === undefined ? '' : ` ${className}`}`}
    >
      <div
        className="flex items-center gap-2 text-[13.5px] font-semibold"
        style={{ color: live ? 'var(--live-accent)' : 'var(--text-heading)' }}
      >
        {live ? (
          <span
            aria-hidden="true"
            className="live-strip-dot inline-block h-2 w-2 flex-none rounded-full"
            style={{ background: 'var(--live-accent)' }}
          />
        ) : null}
        {title}
      </div>
      <div className="mb-2 text-[11px] leading-[1.45] text-[var(--text-secondary)]">{subtitle}</div>
      {children}
    </section>
  )
}

/** Aviso no corpo da faixa: sem leitura ao vivo, buscando, dia vazio, falha. */
export function LiveNote({ children }: { children: ReactNode }) {
  return <p className="py-3 text-[12px] text-[var(--text-secondary)]">{children}</p>
}

/**
 * Atalho do canto inferior direito de uma caixa: o que ele diz e o que abre.
 * `attention` pinta de âmbar com o triângulo; sem ela é cinza, só informação.
 */
export type LiveBoxCorner = {
  readonly label: string
  readonly title: string
  readonly accessibleLabel: string
  readonly attention: boolean
  readonly onClick: () => void
}

/**
 * Caixa da faixa. É um botão porque abre a lista do que conta: a caixa aberta
 * fica com a borda e um fundo na própria cor, e o estado nunca depende só da
 * cor, já que o `aria-expanded` e a lista logo abaixo dizem o mesmo.
 *
 * O atalho do canto (decisão do Mário em 23/09/2026) é IRMÃO do botão grande,
 * e não filho: botão dentro de botão não existe em HTML. Dois alvos, dois
 * cliques, sem um disparar o outro. Um espaço invisível na última linha
 * reserva o lugar dele, para o atalho nunca cobrir o texto da caixa.
 */
export function LiveBox({
  children,
  color,
  controls,
  corner,
  label,
  onToggle,
  open,
  value,
}: {
  children: ReactNode
  color: string
  /** Identificador da lista que a caixa abre, para o `aria-controls`. */
  controls: string
  corner?: LiveBoxCorner | null
  label: ReactNode
  onToggle: () => void
  open: boolean
  value: number
}) {
  const cornerContent = corner ? (
    <>
      {corner.attention ? (
        <AlertTriangle aria-hidden="true" className="h-3 w-3 flex-none" strokeWidth={2.2} />
      ) : null}
      {corner.label}
    </>
  ) : null

  return (
    <li className="relative">
      <button
        aria-controls={open ? controls : undefined}
        aria-expanded={open}
        // `h-full` mantém as caixas da fileira com a mesma altura quando uma
        // delas ganha a segunda linha do atalho.
        className="h-full w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-left transition-colors hover:border-[var(--text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onClick={onToggle}
        style={
          open
            ? {
                borderColor: color,
                background: `color-mix(in srgb, ${color} 12%, var(--surface-elevated))`,
              }
            : undefined
        }
        type="button"
      >
        <span className="block text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
          {label}
        </span>
        <strong className="mt-1 block font-mono text-[23px] font-bold leading-none tracking-[-0.8px] text-[var(--text-heading)]">
          {formatNumber(value)}
        </strong>
        <span className="mt-1.5 flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-secondary)]">
          <span>{children}</span>
          {corner ? (
            <span aria-hidden="true" className="invisible ml-auto flex items-center gap-1 font-semibold">
              {cornerContent}
            </span>
          ) : null}
        </span>
      </button>
      {corner ? (
        <button
          aria-label={corner.accessibleLabel}
          className="absolute right-3 bottom-2.5 flex cursor-pointer items-center gap-1 rounded-sm text-[11px] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={corner.onClick}
          style={{ color: corner.attention ? 'var(--live-attention)' : 'var(--text-secondary)' }}
          title={corner.title}
          type="button"
        >
          {cornerContent}
        </button>
      ) : null}
    </li>
  )
}
