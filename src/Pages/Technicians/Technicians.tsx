import { Chart } from '../../components/charts/Chart'
import { makeBarOptions, makeHeatmapOptions } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { DataTable } from '../../components/dashboard/DataTable'
import { ProgressBar } from '../../components/dashboard/ProgressBar'
import { dashboardData } from '../../data/dashboardAggregates'

export function Technicians() {
  const { technicianRanking, charts } = dashboardData

  return (
    <div className="grid gap-3.5">
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
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard title="Técnico x Categoria" subtitle="Heatmap de atuação">
          <Chart height={400} option={makeHeatmapOptions(charts.technicianCategory.x, charts.technicianCategory.y, charts.technicianCategory.data, charts.technicianCategory.max)} />
        </ChartCard>
        <ChartCard title="Técnico x Resolução" subtitle="Heatmap de desfechos">
          <Chart height={400} option={makeHeatmapOptions(charts.technicianResolution.x, charts.technicianResolution.y, charts.technicianResolution.data, charts.technicianResolution.max)} />
        </ChartCard>
      </div>
    </div>
  )
}
