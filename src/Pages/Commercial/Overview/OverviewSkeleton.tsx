import {
  PageSkeleton,
  SkeletonCardGrid,
  SkeletonChartCard,
  SkeletonFilterBar,
  SkeletonLiveStrip,
  SkeletonSectionHeading,
} from '../../../components/dashboard/PageSkeleton'

/**
 * Esqueleto da Visão Geral Comercial (opção B, 08/10/2026), na ordem da
 * página: faixa de filtros, Hoje ao vivo, Resultado do período com os seis
 * cards, a Safra de vendas por mês e as duas fileiras de painéis (cidade,
 * time e origem; evolução mensal e os dois Top 5). As grades são as mesmas da
 * página, então a fileira de seis cards só se forma em tela larga.
 */
export function CommercialOverviewSkeleton() {
  return (
    <PageSkeleton label="Montando a Visão Geral">
      <SkeletonFilterBar className="mb-3.5" />
      <SkeletonLiveStrip boxes={3} gridClass="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_3fr_1fr]" />
      <SkeletonSectionHeading />
      <div className="flex flex-col gap-4">
        <SkeletonCardGrid columnsClass="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" count={6} />
        <SkeletonChartCard bars={12} height={260} />
        <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <SkeletonChartCard height={240} shape="rows" />
          <SkeletonChartCard bars={4} height={240} shape="rows" />
          <SkeletonChartCard bars={4} height={240} shape="rows" />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[2fr_1fr_1fr]">
          <SkeletonChartCard bars={12} height={306} />
          <SkeletonChartCard bars={5} height={306} shape="rows" />
          <SkeletonChartCard bars={5} height={306} shape="rows" />
        </div>
      </div>
    </PageSkeleton>
  )
}
