import type { ReactNode } from 'react'

/**
 * Aparência do painel de gráfico.
 *
 * `default` é o painel histórico do portal, com superfície branca e textos
 * fixos, usado por todos os gráficos das demais páginas. Ele não muda.
 *
 * `executive` alinha o painel aos cards executivos: superfície e textos por
 * tokens do tema, canto `rounded-xl` e sombra discreta e estática. Existe para
 * o painel acompanhar os cards no tema escuro, onde o título e o subtítulo
 * fixos da variante padrão ficariam escuros sobre superfície escura. Continua
 * sendo um painel de leitura: nada aqui o torna clicável, expansível ou
 * sensível ao hover.
 */
export type ChartCardVariant = 'default' | 'executive'

const surfaceClass: Record<ChartCardVariant, string> = {
  default: 'rounded-xl border border-[#e6e8ee] bg-white px-[18px] py-4',
  executive:
    'rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm',
}

const titleClass: Record<ChartCardVariant, string> = {
  default: 'text-[13.5px] font-semibold text-[#101828]',
  executive: 'text-[13.5px] font-semibold text-[var(--text-heading)]',
}

const subtitleClass: Record<ChartCardVariant, string> = {
  default: 'mb-2 text-xs text-[#98a2b3]',
  executive: 'mb-2 text-[11px] leading-[1.45] text-[var(--text-secondary)]',
}

type ChartCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  /**
   * Classes do painel.
   *
   * Na variante padrão SUBSTITUI a superfície, que é o comportamento histórico
   * da propriedade. Na variante executiva ela é somada, porque ali a superfície
   * já vem da variante e o que se quer acrescentar é o escopo de quem consome.
   */
  className?: string
  /** Sem valor, o painel continua exatamente como os demais gráficos do portal. */
  variant?: ChartCardVariant
}

export function ChartCard({
  title,
  subtitle,
  children,
  className,
  variant = 'default',
}: ChartCardProps) {
  const sectionClass =
    variant === 'executive'
      ? `${surfaceClass.executive}${className === undefined ? '' : ` ${className}`}`
      : (className ?? surfaceClass.default)

  return (
    <section className={sectionClass}>
      <div className={titleClass[variant]}>{title}</div>
      {subtitle ? <div className={subtitleClass[variant]}>{subtitle}</div> : <div className="mb-2" />}
      {children}
    </section>
  )
}
