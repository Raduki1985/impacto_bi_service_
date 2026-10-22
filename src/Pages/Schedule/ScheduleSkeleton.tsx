import { PageSkeleton, SkeletonBlock, SkeletonFilterBar } from '../../components/dashboard/PageSkeleton'
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
 * redesenhada em 19/10/2026: a faixa de filtros, os dois resumos de semana
 * e o calendário de duas semanas com dois turnos por dia. Sem a faixa de
 * título desde 22/10/2026, quando ela saiu da página. Sem o detalhe do turno
 * desde 21/10/2026: ele virou a janela que o clique abre, e a página não
 * abre nada sozinha. Sem número nenhum.
 */

function SkeletonSummary() {
  return (
    <div
      className="executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm"
      data-skeleton="summary"
    >
      <SkeletonBlock className="h-2.5 w-28" />
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div>
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="mt-1.5 h-7 w-28" />
        </div>
        <div>
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="mt-1.5 h-2 w-full rounded-full" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SkeletonBlock className="h-11 w-full rounded-lg" />
            <SkeletonBlock className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
      <SkeletonBlock className="mt-2.5 h-3 w-4/5" />
    </div>
  )
}

/**
 * Um turno em cinza, nas alturas do botão real (card de 20/10/2026): nome e
 * capacidade (17 px), a barra de 18 px e a linha centralizada das horas
 * livres (18 px), para a célula não crescer quando os números chegam.
 */
function SkeletonShift() {
  return (
    <div className="mt-1.5 rounded-lg border border-[var(--border)] px-2 py-1.5" data-skeleton="shift">
      <div className="flex h-[17px] items-center justify-between">
        <SkeletonBlock className="h-2.5 w-10" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <SkeletonBlock className="my-1.5 h-[18px] w-full rounded-[5px]" />
      <div className="flex h-[18px] items-center justify-center">
        <SkeletonBlock className="h-3 w-20" />
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
      <div className="flex h-5 items-center justify-center">
        <SkeletonBlock className="h-3 w-14" />
      </div>
      <div className="flex h-4 items-center justify-center">
        <SkeletonBlock className="h-2.5 w-16" />
      </div>
      <SkeletonShift />
      <SkeletonShift />
    </div>
  )
}

/** Os dois resumos e o calendário em cinza, com tantas semanas quanto a página mostra. */
function SkeletonWeeks({ weeks }: { weeks: number }) {
  return (
    <>
      <div className={`${SUMMARY_GRID_CLASS} mb-3.5`}>
        <SkeletonSummary />
        <SkeletonSummary />
      </div>
      <div className={`${CALENDAR_PANEL_CLASS} overflow-x-auto`} data-skeleton="calendar">
        {Array.from({ length: weeks }, (_, week) => (
          <div className={`${CALENDAR_WEEK_GRID_CLASS}${week > 0 ? ` ${CALENDAR_WEEK_DIVIDER_CLASS}` : ''}`} key={week}>
            {Array.from({ length: 7 }, (_, day) => (
              <SkeletonDay key={day} />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function SchedulePageSkeleton() {
  return (
    <PageSkeleton label="Carregando a agenda e a capacidade">
      <SkeletonFilterBar className="mb-3.5" />
      <SkeletonWeeks weeks={DEFAULT_WEEKS} />
    </PageSkeleton>
  )
}

/**
 * A troca de semanas (20/10/2026): só os resumos e o calendário vão para o
 * cinza; a faixa de filtros e o rodapé continuam na tela, como na
 * troca de período da Visão Geral de OS.
 */
export function ScheduleWeeksSkeleton({ weeks }: { weeks: number }) {
  return (
    <PageSkeleton label="Carregando as semanas escolhidas">
      <SkeletonWeeks weeks={weeks} />
    </PageSkeleton>
  )
}
