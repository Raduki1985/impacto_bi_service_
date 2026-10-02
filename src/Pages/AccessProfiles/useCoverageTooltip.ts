import { useContext } from 'react'

import { CoverageTooltipContext } from './coverageTooltipContext'
import { isCoverageTooltipActive } from './coverageTooltipState'

/**
 * Acesso ao coordenador, do ponto de vista de um label.
 *
 * Devolve já respondida a única pergunta que o label faz o tempo todo, `sou eu o
 * ativo?`, para nenhum componente precisar comparar ids à mão.
 *
 * Lança sem provedor de propósito: um label fora do provedor voltaria a abrir
 * junto com os outros, que é exatamente o defeito que este bloco corrige, e um
 * valor padrão silencioso faria a regressão passar despercebida.
 */
export function useCoverageTooltip(id: string) {
  const context = useContext(CoverageTooltipContext)

  if (!context) {
    throw new Error('useCoverageTooltip precisa estar dentro de CoverageTooltipProvider')
  }

  return {
    isActive: isCoverageTooltipActive(context.activeId, id),
    claim: context.claim,
    release: context.release,
  }
}
