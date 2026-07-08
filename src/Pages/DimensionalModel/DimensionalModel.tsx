const leftDimensions = [
  ['DimData', 'data · dia · mês\nsemana · dia_semana'],
  ['DimTecnico', 'id_tecnico · nome'],
  ['DimCategoria', 'id_categoria · nome'],
  ['DimStatus', 'id_status · descrição'],
  ['DimResolucao', 'id_resolucao · nome'],
]

const rightDimensions = [
  ['DimPeriodo', 'id_periodo · turno'],
  ['DimCliente', 'id_cliente · nome\ncod_assinatura'],
  ['DimMotivoImprodutividade', 'id_motivo · descrição'],
  ['DimMotivoFechamento', 'id_motivo · descrição'],
]

const measures = [
  ['Taxa de Conclusão', 'OS Concluídas / Total de OS'],
  ['Taxa de Improdutividade', 'OS Improdutivas / Total de OS'],
  ['Produtividade por Técnico', 'OS Concluídas / Técnico'],
  ['Tempo Médio de Atendimento', 'AVG(duração_min)'],
  ['Tempo Médio até Conclusão', 'AVG(lead_time_dias)'],
  ['OS por Dia / Semana / Mês', 'COUNT(os) por DimData'],
]

function DimensionBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#dfe3ec]">
      <div className="bg-[#f2f5fb] px-3 py-2 text-xs font-bold text-[#33507f]">{title}</div>
      <div className="whitespace-pre-line px-3 py-2 font-mono text-[11.5px] leading-6 text-[#667085]">{body}</div>
    </div>
  )
}

export function DimensionalModel() {
  return (
    <div className="grid gap-3.5">
      <section className="rounded-xl border border-[#e6e8ee] bg-white p-5">
        <h2 className="text-[13.5px] font-semibold text-[#101828]">Star Schema - Ordens de Serviço</h2>
        <p className="mb-5 mt-1 text-xs text-[#98a2b3]">Tabela fato central conectada às dimensões. Cada registro = uma Ordem de Serviço.</p>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_1fr] lg:items-center">
          <div className="grid gap-3">{leftDimensions.map(([title, body]) => <DimensionBox key={title} title={title} body={body} />)}</div>
          <div className="overflow-hidden rounded-xl border-2 border-[var(--accent)] shadow-[0_6px_20px_rgba(47,107,255,.13)]">
            <div className="bg-[var(--accent)] px-3.5 py-3 text-[13.5px] font-bold text-white">FatoOrdemServico</div>
            <div className="px-3.5 py-3 font-mono text-[11.5px] leading-7 text-[#475467]">
              <div className="mb-1 font-semibold text-[#98a2b3]">- Chaves (FK)</div>
              id_data · id_tecnico · id_categoria<br />id_status · id_resolucao · id_periodo<br />id_cliente · id_motivo_improd<br />id_motivo_fechamento
              <div className="mb-1 mt-2 font-semibold text-[#98a2b3]">- Métricas</div>
              qtd_os · duração_min · lead_time_dias<br />flag_concluida · flag_improdutiva
            </div>
          </div>
          <div className="grid gap-3">{rightDimensions.map(([title, body]) => <DimensionBox key={title} title={title} body={body} />)}</div>
        </div>
      </section>
      <section className="rounded-xl border border-[#e6e8ee] bg-white px-[18px] py-4">
        <h2 className="mb-3 text-[13.5px] font-semibold text-[#101828]">Indicadores calculados (medidas)</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-2.5">
          {measures.map(([title, formula]) => (
            <div key={title} className="rounded-lg border border-[#eef0f4] bg-[#fafbfc] px-3 py-2.5">
              <div className="text-[12.5px] font-semibold text-[#344054]">{title}</div>
              <div className="mt-1 font-mono text-[11.5px] text-[#98a2b3]">{formula}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
