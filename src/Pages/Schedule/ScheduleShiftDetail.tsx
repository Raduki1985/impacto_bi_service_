import type { ReactNode } from 'react'

import { ChartCard } from '../../components/dashboard/ChartCard'
import { formatNumber } from '../../lib/formatters'
import { TonePill } from './ScheduleCalendar'
import { formatHours, type CategoryLine, type ShiftDetail } from './scheduleModel'

/**
 * O detalhe do turno escolhido no calendário (19/10/2026): o que a grade de
 * datas do SGI já recusa naquele turno e o que ainda cabe, categoria por
 * categoria, porque é por categoria que o agendamento diz "sem data
 * disponível". Num dia que já passou, o que foi realizado por categoria.
 *
 * É aqui, e só aqui, que a página conta OS em vez de horas: "Cabe mais 15"
 * é a sobra dos técnicos aptos dividida pelas horas previstas DESSA
 * categoria, então o número só faz sentido ao lado do nome dela.
 */

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

function aptText(count: number): string {
  return `${formatNumber(count)} ${plural(count, 'técnico apto', 'técnicos aptos')}`
}

function ordersText(count: number, past: boolean): string {
  const word = past ? plural(count, 'realizada', 'realizadas') : plural(count, 'marcada', 'marcadas')

  return `${formatNumber(count)} OS ${word}`
}

/**
 * O resto da linha, depois do nome: as horas previstas de uma OS da
 * categoria em destaque, em toda linha (Mário, 20/10/2026: antes só as que
 * cabem traziam), como o selo "SLA: 40m" que o SGI põe ao lado do nome, e
 * depois os técnicos aptos e, nas linhas que não dizem quantas cabem, as
 * OS do turno.
 */
function LineMeta({ line, orders }: { line: CategoryLine; orders: string | null }) {
  return (
    <>
      <span className="font-semibold text-[var(--text-heading)]">
        {line.slaHours === null ? 'sem horas previstas' : `${formatHours(line.slaHours)} cada`}
      </span>
      {` · ${aptText(line.aptTechnicians)}`}
      {orders === null ? null : ` · ${orders}`}
    </>
  )
}

function DetailRow({ meta, name, pill }: { meta: ReactNode; name: string; pill: ReactNode }) {
  return (
    <li className="flex items-center gap-2 border-t border-[var(--divider)] py-1.5 text-[12.5px]">
      <span className="flex-none">{pill}</span>
      <span className="min-w-0 truncate font-medium text-[var(--text-heading)]" title={name}>
        {name}
      </span>
      <span className="ml-auto flex-none whitespace-nowrap text-[11px] text-[var(--text-secondary)]">{meta}</span>
    </li>
  )
}

function DetailColumn({ children, empty, heading }: { children: ReactNode[]; empty: string; heading: string }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
        {heading}
      </h4>
      {children.length === 0 ? (
        <p className="py-3 text-[12px] text-[var(--text-secondary)]">{empty}</p>
      ) : (
        <ul className="max-h-[320px] overflow-auto">{children}</ul>
      )}
    </div>
  )
}

export function ScheduleShiftDetail({ detail, id }: { detail: ShiftDetail; id: string }) {
  const past = detail.kind === 'past'
  const refusedRows = detail.refused.map((line: CategoryLine) => (
    <DetailRow
      key={line.id}
      meta={<LineMeta line={line} orders={ordersText(line.scheduled, false)} />}
      name={line.name}
      pill={<TonePill tone="over">Cheio</TonePill>}
    />
  ))
  const fittingRows = [
    ...detail.fitting.map((line) => (
      <DetailRow
        key={line.id}
        meta={<LineMeta line={line} orders={null} />}
        name={line.name}
        pill={
          <TonePill tone={line.fits === null ? 'muted' : 'ok'}>
            {line.fits === null ? 'Sem estimativa' : `Cabe mais ${formatNumber(line.fits)}`}
          </TonePill>
        }
      />
    )),
    ...detail.alwaysAccepted.map((line) => (
      <DetailRow
        key={line.id}
        meta={<LineMeta line={line} orders={ordersText(line.scheduled, false)} />}
        name={line.name}
        pill={<TonePill tone="muted">Sempre cabe</TonePill>}
      />
    )),
  ]
  const realizedRows = detail.realized.map((line) => (
    <DetailRow
      key={line.id}
      meta={<LineMeta line={line} orders={ordersText(line.scheduled, true)} />}
      name={line.name}
      pill={<TonePill tone="muted">Realizado</TonePill>}
    />
  ))

  return (
    <div className="mt-3.5" id={id}>
      <ChartCard subtitle={detail.summary} title={detail.title} variant="executive">
        {past ? (
          <DetailColumn empty="Nenhuma OS realizada neste turno." heading="O que foi realizado, por categoria">
            {realizedRows}
          </DetailColumn>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-3 lg:grid-cols-2">
            <DetailColumn
              empty="Nenhuma: a grade do SGI oferece este turno a todas as categorias com OS no dia."
              heading="O que o SGI já recusa neste turno"
            >
              {refusedRows}
            </DetailColumn>
            <DetailColumn empty="Nenhuma categoria com OS no dia ainda cabe." heading="O que ainda cabe, por categoria">
              {fittingRows}
            </DetailColumn>
          </div>
        )}
        {detail.note === null ? null : (
          <p className="mt-2.5 text-[11px] text-[var(--text-secondary)]">{detail.note}</p>
        )}
      </ChartCard>
    </div>
  )
}
