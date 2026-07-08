import { cn } from '../../lib/utils'

type KpiCardProps = {
  label: string
  value: string | number
  helper?: string
  tone?: 'default' | 'success' | 'danger' | 'warning'
}

const tones = {
  default: 'text-[#101828]',
  success: 'text-[#16a34a]',
  danger: 'text-[#e5484d]',
  warning: 'text-[#f5a623]',
}

export function KpiCard({ label, value, helper, tone = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-[#e6e8ee] bg-white px-[18px] py-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <div className="text-[11.5px] font-semibold uppercase tracking-[.03em] text-[#667085]">
        {label}
      </div>
      <div className={cn('mt-1.5 font-mono text-[29px] font-semibold', tones[tone])}>
        {value}
      </div>
      {helper ? <div className="mt-1 text-[11.5px] text-[#98a2b3]">{helper}</div> : null}
    </div>
  )
}
