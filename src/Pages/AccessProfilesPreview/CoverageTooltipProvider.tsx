import { useCallback, useMemo, useReducer, type ReactNode } from 'react'

import { CoverageTooltipContext } from './coverageTooltipContext'
import { coverageTooltipReducer, initialCoverageTooltipState } from './coverageTooltipState'

/**
 * Provedor da exclusividade dos detalhamentos de cobertura.
 *
 * Envolve a tela inteira de Perfis de acesso, uma vez só. Os dois modais são
 * renderizados por portal, mas portal do React preserva a árvore de contexto:
 * um label dentro do modal de consulta enxerga o mesmo ativo que um label de
 * card da página, e por isso abrir um dentro do modal fecha o que estava aberto
 * atrás dele.
 *
 * O provedor guarda SOMENTE o id do ativo. A âncora medida e o estado de fixação
 * continuam em cada label, de propósito: reposicionar o painel durante a rolagem
 * mexe na âncora dezenas de vezes por segundo, e trazer isso para cá faria a
 * página inteira de labels renderizar a cada quadro de rolagem. Assim, o valor
 * do contexto só muda quando um detalhamento abre ou fecha.
 */
export function CoverageTooltipProvider({ children }: { children: ReactNode }) {
  const [activeId, dispatch] = useReducer(coverageTooltipReducer, initialCoverageTooltipState)

  const claim = useCallback((id: string) => dispatch({ type: 'claim', id }), [])
  const release = useCallback((id: string) => dispatch({ type: 'release', id }), [])

  const value = useMemo(() => ({ activeId, claim, release }), [activeId, claim, release])

  return <CoverageTooltipContext.Provider value={value}>{children}</CoverageTooltipContext.Provider>
}
