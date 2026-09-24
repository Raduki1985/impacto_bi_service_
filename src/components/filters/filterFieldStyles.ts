/**
 * Classes dos controles da faixa de filtros.
 *
 * Em arquivo próprio pelo mesmo motivo de `columnFilterStyles.ts`: o campo de
 * data (`DateField`) e o campo com digitação (`SearchSelectField`) precisam
 * das MESMAS medidas do seletor comum, e exportar valor de um arquivo de
 * componente quebra a atualização instantânea do `npm run dev`.
 */

/** Seletor da faixa: 36px de altura, superfície elevada, anel no foco. */
export const filterControlClass =
  'h-9 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-[12.5px] font-semibold text-[var(--text-item)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Ação de texto no acento: Limpar filtros, Expandir e Recolher. A classe
 * `impacto-text-action` é o gancho que o tema escuro pinta de verde, o mesmo
 * das ações das listas e da janela de OS.
 */
export const filterActionClass =
  'impacto-text-action flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
