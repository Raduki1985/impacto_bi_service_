import type { ReactNode } from 'react'

/**
 * Título de faixa de uma página de dashboard.
 *
 * É o que separa as perguntas da página (resultado do período, composição)
 * sem virar um card: um rótulo curto em caixa alta e uma frase dizendo o que
 * a faixa responde. Nasceu na Visão Geral de OS, foi copiado na Gestão de
 * Técnicos e virou componente em 24/09/2026, quando aquela página passou a
 * ser o modelo do portal.
 *
 * A ação, quando existe, fica encostada à direita na mesma linha: é o
 * `Baixar N OS em Excel` do resultado do período. Nunca mais de uma ação,
 * de propósito: a faixa é um título, não uma barra de ferramentas.
 */
export function SectionHeading({
  action,
  description,
  title,
}: {
  /** Ação da faixa, encostada à direita. */
  action?: ReactNode
  /** O que a faixa responde. Aceita texto ou uma etiqueta, como a do período. */
  description: ReactNode
  title: string
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5">
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {title}
      </h2>
      <span className="text-[11.5px] text-[var(--text-secondary)]">{description}</span>
      {action === undefined ? null : <span className="ml-auto self-center">{action}</span>}
    </div>
  )
}
