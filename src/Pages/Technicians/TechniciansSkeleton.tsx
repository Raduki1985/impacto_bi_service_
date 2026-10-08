import {
  PageSkeleton,
  SkeletonCardGrid,
  SkeletonChartCard,
  SkeletonFilterBar,
  SkeletonSectionHeading,
} from '../../components/dashboard/PageSkeleton'

/**
 * Esqueleto da Gestão de Técnicos (opção B, 08/10/2026), na ordem da página:
 * Operação de campo no período, Ranking por frente de trabalho e Contexto e
 * detalhamento. O ranking sai em duas frentes, o caso comum; a página real
 * pode ter uma só.
 */

function TechniciansPeriodBlocks() {
  return (
    <>
      <SkeletonSectionHeading />
      <SkeletonCardGrid className="mb-4" count={4} />
      <SkeletonSectionHeading />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <SkeletonChartCard bars={8} height={300} shape="rows" />
        <SkeletonChartCard bars={8} height={300} shape="rows" />
      </div>
      <SkeletonSectionHeading />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)]">
        <SkeletonChartCard height={320} shape="rows" />
        <SkeletonChartCard bars={10} height={320} shape="table" />
      </div>
    </>
  )
}

/** Primeira carga: a faixa de filtros e o período. */
export function TechniciansPageSkeleton() {
  return (
    <PageSkeleton label="Carregando as visitas dos técnicos">
      <SkeletonFilterBar className="mb-3.5" />
      <TechniciansPeriodBlocks />
    </PageSkeleton>
  )
}

/** Troca de período: a faixa de filtros fica, o período vira esqueleto. */
export function TechniciansPeriodSkeleton() {
  return (
    <PageSkeleton label="Carregando o período">
      <TechniciansPeriodBlocks />
    </PageSkeleton>
  )
}
