import { DataTable } from '../../components/dashboard/DataTable'
import { KpiCard } from '../../components/dashboard/KpiCard'
import { ProgressBar } from '../../components/dashboard/ProgressBar'
import { dashboardData } from '../../data/dashboardAggregates'

export function Customers() {
  const { customers, customerRanking } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <KpiCard label="Clientes atendidos" value={customers.unique} />
        <KpiCard label="Clientes recorrentes" value={customers.recurring} helper="2+ visitas no período" tone="warning" />
        <KpiCard label="Média de visitas/assinatura" value={customers.averageVisits} />
      </div>
      <DataTable headers={['#', 'Cliente', 'Assinatura', 'Visitas', 'Reincidência']} minWidth={640}>
        {customerRanking.map((customer) => (
          <tr key={customer.subscription} className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
            <td className="px-4 py-2.5 font-mono text-[#98a2b3]">{customer.position}</td>
            <td className="px-4 py-2.5 font-medium capitalize text-[#1a2331]">{customer.name}</td>
            <td className="px-4 py-2.5 font-mono text-[#667085]">{customer.subscription}</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#344054]">{customer.visits}</td>
            <td className="px-4 py-2.5"><ProgressBar value={customer.width} color="#f5a623" /></td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}
