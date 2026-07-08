type ProgressBarProps = {
  value: number
  color?: string
}

export function ProgressBar({ value, color = 'var(--accent)' }: ProgressBarProps) {
  return (
    <div className="h-1.5 overflow-hidden rounded bg-[#eef0f4]">
      <div className="h-full rounded" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}
