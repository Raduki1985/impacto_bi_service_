/**
 * Camada de compatibilidade do card executivo comercial.
 *
 * O componente foi promovido para `components/dashboard/ExecutiveMetricCard`
 * quando a Visão Geral de OS adotou a mesma linguagem visual. Visão Geral e
 * Vendas por Período continuam importando daqui com os nomes originais; este
 * arquivo apenas reexporta a base compartilhada, então nenhum comportamento
 * mora nele.
 */
export {
  ExecutiveMetricCard as CommercialExecutiveCard,
  ExecutiveSparkline as CommercialSparkline,
} from '../../../components/dashboard/ExecutiveMetricCard'
export type { ExecutiveMetricCardProps as CommercialExecutiveCardProps } from '../../../components/dashboard/ExecutiveMetricCard'
