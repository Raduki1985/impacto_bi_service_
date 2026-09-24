/**
 * Classes do painel de filtro de coluna.
 *
 * Em arquivo próprio, e não junto do componente, por dois motivos: os painéis
 * de tipo de dado que ficam nas páginas precisam das MESMAS classes (campo,
 * ação e legenda não podem divergir dentro do mesmo cabeçalho), e exportar
 * objeto de um arquivo de componente quebra a atualização instantânea do
 * `npm run dev`, que é o aviso `react-refresh/only-export-components`.
 *
 * `impacto-column-filter` no painel e `impacto-column-filter-apply` no
 * Aplicar são os ganchos que o tema escuro pinta de Verde Detalhes
 * (`styles.css`), como já pintava a faixa de filtros da página.
 */

export const columnFilterClass = {
  panel:
    'impacto-column-filter fixed z-50 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2.5 shadow-[0_14px_34px_-16px_rgba(13,27,49,.5)]',
  action:
    'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  input:
    'w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
  legend: 'mb-1 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]',
  error: 'text-[10.5px] font-semibold text-[#b51d38]',
} as const

export const columnFilterActionClass = {
  primary: `impacto-column-filter-apply ${columnFilterClass.action} bg-[var(--accent)] text-white hover:opacity-90`,
  secondary: `${columnFilterClass.action} border border-[var(--border)] text-[var(--text-item)] hover:bg-[var(--hover-bg)]`,
  link: `${columnFilterClass.action} text-[var(--accent)] hover:bg-[var(--hover-bg)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent`,
} as const
