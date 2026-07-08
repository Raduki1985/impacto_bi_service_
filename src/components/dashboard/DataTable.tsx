import type { ReactNode } from 'react'

type DataTableProps = {
  headers: ReactNode[]
  children: ReactNode
  minWidth?: number
}

export function DataTable({ headers, children, minWidth = 720 }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e6e8ee] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]" style={{ minWidth }}>
          <thead>
            <tr className="bg-[#fafbfc] text-left text-[#667085]">
              {headers.map((header, index) => (
                <th key={index} className="px-4 py-2.5 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}
