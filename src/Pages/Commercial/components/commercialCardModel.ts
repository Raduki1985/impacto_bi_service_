/**
 * Camada de compatibilidade do modelo do card executivo comercial.
 *
 * O modelo foi promovido para `components/dashboard/executiveMetricCardModel`
 * quando a Visão Geral de OS adotou a mesma linguagem visual: a base é uma só,
 * e não duas cópias parecidas. As páginas comerciais continuam importando
 * daqui com os nomes originais; este arquivo apenas reexporta a base
 * compartilhada, então nenhum comportamento mora nele.
 */
export {
  buildExecutiveDelta as buildCommercialDelta,
  executiveCardColors as commercialCardColors,
  executiveDeltaColors as commercialDeltaColors,
  executiveDeltaReading as commercialDeltaReading,
  executiveSemanticTextClass as commercialSemanticTextClass,
  PREVIOUS_PERIOD_COMPARISON,
  PREVIOUS_PERIOD_LABEL,
  PREVIOUS_PERIOD_LONG,
} from '../../../components/dashboard/executiveMetricCardModel'
export type {
  ExecutiveComparison as CommercialComparison,
  KpiDeltaInterpretation as CommercialDeltaInterpretation,
  ExecutiveCardDelta as CommercialCardDelta,
  ExecutiveCardTone as CommercialCardTone,
  ExecutiveCardVariant as CommercialCardVariant,
  ExecutiveDeltaTone as CommercialDeltaTone,
} from '../../../components/dashboard/executiveMetricCardModel'
