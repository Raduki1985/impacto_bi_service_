import { Trash2 } from 'lucide-react'

const filters = [
  ['Período', 'Últimos 3 meses'],
  ['De', '01/04/2026'],
  ['Até', '30/06/2026'],
  ['Técnico', 'Todos'],
  ['Categoria', 'Todas'],
  ['Status', 'Todos'],
  ['Resolução', 'Todas'],
]

export function FilterBar() {
  return (
    <div className="flex gap-2 overflow-x-auto px-[26px] pb-3.5">
      {filters.map(([label, value]) => (
        <button
          key={label}
          type="button"
          className="flex flex-none items-center gap-2 rounded-lg border border-[#e4e7ee] bg-[#fafbfc] px-3 py-2 text-[12.5px] text-[#344054] transition hover:border-[#c2c8d4] hover:bg-white"
        >
          <span className="text-[#98a2b3]">{label}</span>
          <b className="font-semibold">{value}</b>
        </button>
      ))}
      <button
        type="button"
        className="ml-auto flex flex-none items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-[var(--accent)]"
      >
        <Trash2 size={13} aria-hidden="true" />
        Limpar filtros
      </button>
    </div>
  )
}
