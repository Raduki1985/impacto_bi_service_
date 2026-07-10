import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Gauge,
  Repeat2,
  Tag,
  Target,
  UserCheck,
  UsersRound,
  XCircle,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

type KpiAccent = 'blue' | 'green' | 'red' | 'indigo' | 'teal' | 'orange'
type KpiDetailTone = 'neutral' | 'positive' | 'negative'
type KpiIcon =
  | 'alert'
  | 'calendarCritical'
  | 'calendarDemand'
  | 'check'
  | 'clipboard'
  | 'clock'
  | 'gauge'
  | 'repeat'
  | 'tag'
  | 'target'
  | 'userCheck'
  | 'users'
  | 'xCircle'

type KpiCardProps = {
  label: string
  value: string | number
  helper?: string
  tone?: 'default' | 'success' | 'danger' | 'warning'
  accent?: KpiAccent
  detailTone?: KpiDetailTone
  icon?: KpiIcon
  valueTone?: KpiDetailTone
}

const accents: Record<KpiAccent, { color: string; soft: string }> = {
  blue: { color: '#2563eb', soft: 'rgba(37,99,235,.10)' },
  green: { color: '#15b881', soft: 'rgba(46,204,142,.14)' },
  red: { color: '#f43f5e', soft: 'rgba(244,63,94,.11)' },
  indigo: { color: '#6366f1', soft: 'rgba(99,102,241,.12)' },
  teal: { color: '#0d9488', soft: 'rgba(13,148,136,.12)' },
  orange: { color: '#f59e0b', soft: 'rgba(245,158,11,.13)' },
}

const icons: Record<KpiIcon, LucideIcon> = {
  alert: AlertTriangle,
  calendarCritical: CalendarClock,
  calendarDemand: CalendarCheck,
  check: CheckCircle2,
  clipboard: ClipboardList,
  clock: Clock3,
  gauge: Gauge,
  repeat: Repeat2,
  tag: Tag,
  target: Target,
  userCheck: UserCheck,
  users: UsersRound,
  xCircle: XCircle,
}

const detailTones: Record<KpiDetailTone, string> = {
  neutral: 'text-[#94a3b8]',
  positive: 'font-semibold text-[#0e9f6e]',
  negative: 'font-semibold text-[#dc2626]',
}

const valueTones: Record<KpiDetailTone, string> = {
  neutral: 'text-[#0f1d3a]',
  positive: 'text-[#0e9f6e]',
  negative: 'text-[#dc2626]',
}

function defaultAccent(tone: KpiCardProps['tone']): KpiAccent {
  if (tone === 'success') return 'green'
  if (tone === 'danger') return 'red'
  if (tone === 'warning') return 'orange'
  return 'blue'
}

function defaultValueTone(tone: KpiCardProps['tone']): KpiDetailTone {
  if (tone === 'success') return 'positive'
  if (tone === 'danger') return 'negative'
  return 'neutral'
}

export function KpiCard({
  label,
  value,
  helper,
  tone = 'default',
  accent,
  detailTone = 'neutral',
  icon = 'gauge',
  valueTone,
}: KpiCardProps) {
  const selectedAccent = accents[accent ?? defaultAccent(tone)]
  const Icon = icons[icon]
  const resolvedValueTone = valueTone ?? defaultValueTone(tone)
  const style = {
    '--kpi-accent': selectedAccent.color,
    '--kpi-accent-soft': selectedAccent.soft,
  } as CSSProperties

  return (
    <article
      className="kpi-card relative min-w-0 overflow-hidden rounded-2xl border border-[#e9edf3] bg-white py-[18px] pl-[22px] pr-[18px] shadow-[0_1px_2px_rgba(15,29,58,.04),0_1px_3px_rgba(15,29,58,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,29,58,.08),0_2px_4px_rgba(15,29,58,.05)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[5px] before:rounded-l-2xl before:bg-[var(--kpi-accent)]"
      style={style}
    >
      <div className="kpi-card-header mb-[15px] flex min-w-0 items-center gap-2.5">
        <span className="kpi-card-icon flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--kpi-accent-soft)] text-[var(--kpi-accent)]">
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className="kpi-card-label min-w-0 text-[11px] font-bold uppercase leading-[1.35] tracking-[.035em] text-[#5b6b82]">
          {label}
        </span>
      </div>
      <p className={cn('kpi-card-value mb-[9px] text-[27px] font-extrabold leading-[1.1] tracking-normal', valueTones[resolvedValueTone])}>
        {value}
      </p>
      {helper ? (
        <div className={cn('kpi-card-detail min-h-[18px] text-xs font-medium leading-[1.45]', detailTones[detailTone])}>
          {helper}
        </div>
      ) : null}
    </article>
  )
}
