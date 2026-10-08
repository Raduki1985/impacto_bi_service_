import {
  PageSkeleton,
  SkeletonCardGrid,
  SkeletonChartCard,
  SkeletonFilterBar,
  SkeletonLiveStrip,
  SkeletonSectionHeading,
} from '../../components/dashboard/PageSkeleton'
import { outcomeChartHeight } from './overviewOutcomeChartOptions'
import { reasonsChartHeight } from './overviewReasonsChartOptions'

/**
 * Esqueleto da Visão Geral de OS (opção B, 08/10/2026), na ordem e nas medidas
 * da página: as alturas dos gráficos saem das mesmas contas que a página usa,
 * para os números entrarem no lugar do cinza sem a página pular.
 */

/** O período: Resultado do período, quatro cards, Destino das OS e a composição. */
function OsPeriodBlocks() {
  return (
    <>
      <SkeletonSectionHeading />
      <SkeletonCardGrid className="mb-4" count={4} />
      {/* Destino das OS: uma barra por grupo, de cliente e de infraestrutura. */}
      <SkeletonChartCard bars={2} className="mb-4" height={outcomeChartHeight(2)} shape="rows" thickBars />
      <SkeletonSectionHeading />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <SkeletonChartCard bars={12} height={reasonsChartHeight(0)} />
        <SkeletonChartCard height={reasonsChartHeight(0)} shape="rows" />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <SkeletonChartCard height={280} shape="rows" />
        <SkeletonChartCard height={280} shape="rows" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <SkeletonChartCard height={250} shape="rows" />
        <SkeletonChartCard height={250} shape="rows" />
      </div>
    </>
  )
}

/** Primeira carga: a página inteira, da faixa de filtros ao último painel. */
export function OverviewPageSkeleton() {
  return (
    <PageSkeleton label="Carregando as ordens de serviço">
      <SkeletonFilterBar className="mb-3.5" />
      <SkeletonLiveStrip boxes={6} gridClass="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" />
      <OsPeriodBlocks />
    </PageSkeleton>
  )
}

/** Troca de período: a faixa de filtros e o Hoje ao vivo ficam, o período vira esqueleto. */
export function OverviewPeriodSkeleton() {
  return (
    <PageSkeleton label="Carregando o período">
      <OsPeriodBlocks />
    </PageSkeleton>
  )
}
