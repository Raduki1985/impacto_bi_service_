import { Gauge, Repeat2, UserCheck } from 'lucide-react'

import { DataTable } from '../../components/dashboard/DataTable'
import { KpiStoryCard } from '../../components/dashboard/KpiStoryCard'
import { ProgressBar } from '../../components/dashboard/ProgressBar'
import { useDashboardData } from '../../contexts/useDashboardData'

export function Customers() {
  const dashboardData = useDashboardData()
  const { customers, customerRanking } = dashboardData

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 [grid-auto-rows:1fr] sm:grid-cols-2 lg:grid-cols-3">
        <KpiStoryCard
          setor="CLIENTES"
          icon={UserCheck}
          nome="Clientes atendidos"
          valor={customers.unique}
          delta="clientes únicos no período"
          status="neutral"
          tendencia="neutro"
          leituraTitulo="Clientes distintos atendidos no período."
          leituraTexto="Mede o {alcance} da operação. Combine com a recorrência para saber se é base nova ou a mesma base."
          observar="Muitos clientes com alta recorrência pode indicar problema não resolvido."
        />
        <KpiStoryCard
          setor="CLIENTES"
          icon={Repeat2}
          nome="Clientes recorrentes"
          valor={customers.recurring}
          delta="2+ visitas no período"
          status="warn"
          tendencia="neutro"
          leituraTitulo="Clientes que precisaram de 2 ou mais visitas."
          leituraTexto="Recorrência alta costuma sinalizar {resolução incompleta} na primeira visita, com custo dobrado."
          observar="Cruze com reincidência técnica para achar serviços que voltam."
        />
        <KpiStoryCard
          setor="CLIENTES"
          icon={Gauge}
          nome="Média de visitas/assinatura"
          valor={customers.averageVisits}
          delta="visitas por assinatura"
          status="neutral"
          tendencia="neutro"
          leituraTitulo="Média de visitas para cada assinatura atendida."
          leituraTexto="Quanto menor, mais {eficiente} a resolução. Acima de 1 significa retorno ao mesmo cliente."
          observar="Média subindo sem crescer a base = mais retrabalho por cliente."
        />
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
