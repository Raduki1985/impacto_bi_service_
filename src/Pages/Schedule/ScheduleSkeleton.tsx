import {
  PageSkeleton,
  SkeletonBlock,
  SkeletonChartCard,
  SkeletonFilterBar,
  SkeletonSectionHeading,
} from '../../components/dashboard/PageSkeleton'
import { DEFAULT_WEEKS } from './scheduleModel'

/** A grade dos dois resumos de semana, a mesma da página. */
export const SUMMARY_GRID_CLASS = 'grid grid-cols-1 gap-3.5 lg:grid-cols-2'

/**
 * O painel do calendário e a linha de cada semana, os mesmos da página. A
 * largura mínima garante uns 130 px por dia: abaixo disso o calendário rola
 * para o lado em vez de espremer a célula e quebrar o número em duas linhas.
 */
export const CALENDAR_PANEL_CLASS =
  'executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-sm'
export const CALENDAR_WEEK_GRID_CLASS = 'grid min-w-[980px] grid-cols-7 gap-2.5'
export const CALENDAR_WEEK_DIVIDER_CLASS = 'mt-2.5 border-t border-[var(--divider)] pt-2.5'

/**
 * Esqueleto da Agenda e capacidade (opção B, 08/10/2026), na ordem da página
 * redesenhada em 19/10/2026: a faixa de filtros, a faixa de título, os dois
 * resumos de semana, o calendário de duas semanas com dois turnos
 * por dia e o detalhe do turno. Sem número nenhum.
 */

function SkeletonSummary() {
  return (
    <div
      className="executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
      data-skeleton="summary"
    >
      <SkeletonBlock className="h-2.5 w-40" />
      <SkeletonBlock className="mt-2 h-3.5 w-4/5" />
    </div>
  )
}

/**
 * Um turno em cinza, nas alturas do botão real: nome e número de OS (17 px),
 * a barra de 5 px, a pílula (cerca de 21 px) e a linha das horas, para a
 * célula não crescer quando os números chegam.
 */
function SkeletonShift() {
  return (
    <div className="mt-1.5 rounded-lg border border-[var(--border)] px-2 py-1.5" data-skeleton="shift">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-2.5 w-10" />
        <SkeletonBlock className="h-[17px] w-12" />
      </div>
      <SkeletonBlock className="my-1.5 h-[5px] w-full" />
      <div className="min-h-[42px]">
        <SkeletonBlock className="h-5 w-24 rounded-full" />
      </div>
      <div className="mt-1 flex h-[15px] items-center">
        <SkeletonBlock className="h-2.5 w-20" />
      </div>
    </div>
  )
}

function SkeletonDay() {
  return (
    <div
      className="min-h-[150px] rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] p-2"
      data-skeleton="day"
    >
      <div className="flex h-5 items-center">
        <SkeletonBlock className="h-3 w-14" />
      </div>
      <div className="flex h-4 items-center">
        <SkeletonBlock className="h-2.5 w-16" />
      </div>
      <SkeletonShift />
      <SkeletonShift />
    </div>
  )
}

export function SchedulePageSkeleton() {
  return (
    <PageSkeleton label="Carregando a agenda e a capacidade">
      <SkeletonFilterBar className="mb-3.5" />
      <SkeletonSectionHeading />
      <div className={`${SUMMARY_GRID_CLASS} mb-3.5`}>
        <SkeletonSummary />
        <SkeletonSummary />
      </div>
      <div className={`${CALENDAR_PANEL_CLASS} overflow-x-auto`} data-skeleton="calendar">
        {Array.from({ length: DEFAULT_WEEKS }, (_, week) => (
          <div className={`${CALENDAR_WEEK_GRID_CLASS}${week > 0 ? ` ${CALENDAR_WEEK_DIVIDER_CLASS}` : ''}`} key={week}>
            {Array.from({ length: 7 }, (_, day) => (
              <SkeletonDay key={day} />
            ))}
          </div>
        ))}
      </div>
      <SkeletonChartCard bars={6} className="mt-3.5" height={200} shape="table" />
    </PageSkeleton>
  )
}
