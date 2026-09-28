import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * Grupo de campos da área expandida da faixa de filtros, com o nome do grupo
 * em caixa alta: Período, Operação, Resultado. Os grupos seguem o
 * significado de negócio, e não o tipo do controle.
 *
 * `columnsClass` é a régua dos campos: a Visão Geral de OS usa 8 partes na
 * linha, 2 para Período e 6 para Operação, e cada campo ocupa 1. É o que faz
 * os controles terem a mesma largura em todas as faixas do portal; sobra na
 * linha fica vazia de propósito, em vez de esticar os campos.
 */
export function FilterGroup({
  children,
  columnsClass,
  legend,
}: {
  children: ReactNode
  /** Colunas da grade do grupo por ponto de quebra, por exemplo `sm:grid-cols-2`. */
  columnsClass: string
  legend: string
}) {
  // `min-w-0` anula o `min-inline-size: min-content` nativo do fieldset, que
  // impediria os controles de encolher e criaria overflow horizontal.
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="p-0 text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {legend}
      </legend>
      <div className={cn('mt-2 grid grid-cols-1 gap-3', columnsClass)}>{children}</div>
    </fieldset>
  )
}
