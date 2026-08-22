import { Info } from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeHeatmapOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { DataTable } from '../../components/dashboard/DataTable'
import { ProgressBar } from '../../components/dashboard/ProgressBar'
import { useDashboardData } from '../../contexts/useDashboardData'
import { OS_SIMULATED_BADGE } from '../../data/mockOsCatalog'

export function Technicians() {
  const dashboardData = useDashboardData()
  const { technicianRanking, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
      {/* Aviso antes do ranking: os nomes e as equipes são reais, mas o
          desempenho individual é simulado. A informação está no texto, não
          apenas na cor. */}
      <p
        className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--text-secondary)]"
        role="note"
      >
        <Info aria-hidden="true" className="mt-0.5 flex-none text-[#b45309]" size={15} />
        <span>
          <strong className="font-bold text-[#b45309]">{OS_SIMULATED_BADGE}.</strong> Os nomes e
          as equipes vêm da investigação do SGI de 21/08/2026, mas as OS e o desempenho de cada
          técnico neste ranking são simulados e não avaliam nenhum profissional real.
        </span>
      </p>
      <ChartCard title="Top 10 técnicos por OS concluídas" subtitle="Maiores produtividades">
        <Chart height={320} option={makeBarOptions(charts.technicianTop.labels, charts.technicianTop.values, '#2f6bff', true)} />
      </ChartCard>
      <DataTable headers={['#', 'Técnico', 'Total', 'Concluídas', 'Improd.', 'Média/dia', 'Taxa de conclusão']}>
        {technicianRanking.map((technician) => (
          <tr key={technician.name} className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
            <td className="px-4 py-2.5 font-mono text-[#98a2b3]">{technician.position}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--accent-weak)] text-[11px] font-bold text-[var(--accent)]">{technician.initials}</span>
                <span className="font-medium text-[#1a2331]">{technician.name}</span>
              </div>
            </td>
            <td className="px-4 py-2.5 text-right font-mono text-[#475467]">{technician.total}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#16a34a]">{technician.completed}</td>
            <td className="px-4 py-2.5 text-right font-mono text-[#e5484d]">{technician.unproductive}</td>
            <td className="px-4 py-2.5 text-right font-mono text-[#475467]">{technician.averageDay}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1"><ProgressBar value={technician.completionRateNumber} /></div>
                <span className="w-11 text-right font-mono text-[11.5px] text-[#344054]">{technician.completionRate}</span>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <ChartCard title="Técnico x Categoria" subtitle="Heatmap de atuação">
          <Chart height={400} option={makeHeatmapOptions(charts.technicianCategory.x, charts.technicianCategory.y, charts.technicianCategory.data, charts.technicianCategory.max)} />
        </ChartCard>
        <ChartCard title="Técnico x Resolução" subtitle="Heatmap de desfechos · Top 10 + Outras">
          <Chart height={400} option={makeHeatmapOptions(charts.technicianResolution.x, charts.technicianResolution.y, charts.technicianResolution.data, charts.technicianResolution.max)} />
        </ChartCard>
      </div>
    </div>
  )
}
