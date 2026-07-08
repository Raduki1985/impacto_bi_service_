import { Trash2 } from 'lucide-react'

import { useDashboardContext } from '../../contexts/useDashboardData'

export function FilterBar() {
  const { filters, filteredRows, options, resetFilters, setFilter } = useDashboardContext()

  return (
    <div className="flex gap-2 overflow-x-auto px-[26px] pb-3.5">
      <DateFilter
        label="De"
        value={filters.dateFrom}
        onChange={(value) => setFilter('dateFrom', value)}
      />
      <DateFilter
        label="Até"
        value={filters.dateTo}
        onChange={(value) => setFilter('dateTo', value)}
      />
      <SelectFilter
        label="Técnico"
        value={filters.technician}
        options={['Todos', ...options.technicians]}
        onChange={(value) => setFilter('technician', value)}
      />
      <SelectFilter
        label="Categoria"
        value={filters.category}
        options={['Todas', ...options.categories]}
        onChange={(value) => setFilter('category', value)}
      />
      <SelectFilter
        label="Status"
        value={filters.status}
        options={['Todos', ...options.statuses]}
        onChange={(value) => setFilter('status', value)}
      />
      <SelectFilter
        label="Resolução"
        value={filters.resolution}
        options={['Todas', ...options.resolutions]}
        onChange={(value) => setFilter('resolution', value)}
      />
      <div className="flex flex-none items-center rounded-lg border border-[#e4e7ee] bg-white px-3 py-2 text-[12.5px] text-[#667085]">
        <b className="font-mono text-[#344054]">{filteredRows.length}</b>
        <span className="ml-1">OS</span>
      </div>
      <button
        type="button"
        onClick={resetFilters}
        className="ml-auto flex flex-none items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-[var(--accent)]"
      >
        <Trash2 size={13} aria-hidden="true" />
        Limpar filtros
      </button>
    </div>
  )
}

type FilterProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

function DateFilter({ label, value, onChange }: FilterProps) {
  return (
    <label className="flex flex-none items-center gap-2 rounded-lg border border-[#e4e7ee] bg-[#fafbfc] px-3 py-1.5 text-[12.5px] text-[#344054]">
      <span className="text-[#98a2b3]">{label}</span>
      <input
        className="w-[126px] bg-transparent font-mono font-semibold outline-none"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  )
}

function SelectFilter({
  label,
  onChange,
  options,
  value,
}: FilterProps & { options: string[] }) {
  return (
    <label className="flex flex-none items-center gap-2 rounded-lg border border-[#e4e7ee] bg-[#fafbfc] px-3 py-1.5 text-[12.5px] text-[#344054]">
      <span className="text-[#98a2b3]">{label}</span>
      <select
        className="max-w-[190px] bg-transparent font-semibold outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
