import type { ReactNode } from 'react'

type ChartCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <section className={className ?? 'rounded-xl border border-[#e6e8ee] bg-white px-[18px] py-4'}>
      <div className="text-[13.5px] font-semibold text-[#101828]">{title}</div>
      {subtitle ? <div className="mb-2 text-xs text-[#98a2b3]">{subtitle}</div> : <div className="mb-2" />}
      {children}
    </section>
  )
}
