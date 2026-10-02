import { createContext } from 'react'

import type { CoverageTooltipState } from './coverageTooltipState'

/**
 * Contrato do coordenador dos detalhamentos de cobertura.
 *
 * Fica em módulo próprio, sem componente nenhum, pelo mesmo motivo de
 * `AuthContextCore`: o lint desta base separa módulo de componente de módulo de
 * valor, e o contexto precisa ser importado tanto pelo provedor quanto pelo
 * gancho.
 */
export type CoverageTooltipContextValue = {
  /** Id do label ativo, ou null. */
  activeId: CoverageTooltipState
  /** Assume a vez para aquele label, fechando qualquer outro. */
  claim: (id: string) => void
  /** Pede o fechamento daquele label. Ignorado se ele já não for o ativo. */
  release: (id: string) => void
}

export const CoverageTooltipContext = createContext<CoverageTooltipContextValue | null>(null)
