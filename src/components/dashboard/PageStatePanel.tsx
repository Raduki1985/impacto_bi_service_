import type { ReactNode } from 'react'

/**
 * Painel de estado de uma página ligada ao serviço de BI: carregando, ou a
 * falha que impediu a página de abrir.
 *
 * Nasceu copiado em três páginas (Visão Geral de OS, Gestão de Técnicos e
 * Visão Geral Comercial) e virou componente em 24/09/2026, quando a Visão
 * Geral de OS passou a ser o modelo do portal. A regra que ele congela: com
 * a fonte carregando ou indisponível, a página NÃO desenha indicador nenhum.
 * Falha não cai na base local de estudo: um número de estudo apresentado
 * como número do banco seria pior do que a ausência do indicador.
 *
 * Mesma superfície dos demais blocos executivos, para o painel não parecer
 * um aviso de outro sistema. Quem lê por leitor de tela recebe o estado sem
 * precisar achar o painel: carregando é `status`, falha é `alert`.
 */
export function PageStatePanel({
  children,
  kind = 'loading',
  title,
}: {
  /** A frase de apoio: o que está sendo buscado, ou o motivo da falha. */
  children: ReactNode
  kind?: 'loading' | 'error'
  title: string
}) {
  return (
    <section
      aria-live={kind === 'loading' ? 'polite' : undefined}
      className="executive-panel min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-10 text-center shadow-sm"
      role={kind === 'loading' ? 'status' : 'alert'}
    >
      <h2 className="text-[14px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{children}</p>
    </section>
  )
}
