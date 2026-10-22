import type { ReactNode } from 'react'

import { formatNumber } from '../../lib/formatters'
import { TonePill } from './ScheduleCalendar'
import {
  formatHours,
  type AgendaDialog,
  type CategoryLine,
  type DayCategoryCell,
  type DayCategoryLine,
  type ShiftDetail,
} from './scheduleModel'

/**
 * As categorias da janela da agenda (21/10/2026; até ali, o detalhe que abria
 * embaixo do calendário, de 19/10/2026, e daí o nome do arquivo, mantido para
 * não renomear sem aprovação): o que a grade de datas do SGI já
 * recusa e o que ainda cabe, categoria por categoria, porque é por categoria
 * que o agendamento diz "sem data disponível". Num dia passado, o que foi
 * realizado por categoria.
 *
 * No turno, as duas colunas de antes: o que o SGI recusa e o que ainda cabe.
 * No dia inteiro, uma linha por categoria com a resposta de cada turno lado a
 * lado, para quem agenda ver de uma vez em qual turno ainda dá para marcar.
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

const HEADING_CLASS = 'text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]'

/**
 * O resto da linha, depois do nome: as horas previstas de uma OS da
 * categoria em destaque, em toda linha (Mário, 20/10/2026), como o selo "SLA:
 * 40m" que o SGI põe ao lado do nome, e depois os técnicos aptos e, nas linhas
 * que não dizem quantas cabem, as OS.
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

/**
 * Uma categoria em linha: a pílula, o nome e o resto. `pillWidth` fixa a largura
 * da pílula na coluna em que o texto dela varia ("Cabe mais 3", "Cabe mais 11",
 * "Sem estimativa"), para os nomes ficarem alinhados; onde toda pílula diz a
 * mesma palavra, ela fica do tamanho da palavra.
 */
function DetailRow({
  meta,
  name,
  pill,
  pillWidth = false,
}: {
  meta: ReactNode
  name: string
  pill: ReactNode
  pillWidth?: boolean
}) {
  return (
    <li className="flex items-center gap-2 border-t border-[var(--divider)] py-1.5 text-[12.5px]">
      <span className={pillWidth ? "w-[7rem] flex-none" : "flex-none"}>{pill}</span>
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
      <h4 className={`mb-1.5 ${HEADING_CLASS}`}>{heading}</h4>
      {children.length === 0 ? (
        <p className="py-3 text-[12px] text-[var(--text-secondary)]">{empty}</p>
      ) : (
        <ul>{children}</ul>
      )}
    </div>
  )
}

/**
 * Um turno: o que o SGI recusa e o que ainda cabe; no passado, o realizado; e
 * no turno que o SGI não oferece mais, toda categoria "Fechado".
 */
function ShiftCategories({ detail }: { detail: ShiftDetail }) {
  if (detail.closed) {
    return (
      <DetailColumn empty="Nenhuma categoria com OS no dia." heading="O SGI não agenda mais neste turno">
        {detail.closedLines.map((line) => (
          <DetailRow
            key={line.id}
            meta={<LineMeta line={line} orders={ordersText(line.scheduled, false)} />}
            name={line.name}
            pill={<TonePill tone="muted">Fechado</TonePill>}
          />
        ))}
      </DetailColumn>
    )
  }

  if (detail.kind === 'past') {
    return (
      <DetailColumn empty="Nenhuma OS realizada neste turno." heading="O que foi realizado, por categoria">
        {detail.realized.map((line) => (
          <DetailRow
            key={line.id}
            meta={<LineMeta line={line} orders={ordersText(line.scheduled, true)} />}
            name={line.name}
            pill={<TonePill tone="muted">Realizado</TonePill>}
          />
        ))}
      </DetailColumn>
    )
  }

  const refusedRows = detail.refused.map((line) => (
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
        pillWidth
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
        pillWidth
        pill={<TonePill tone="muted">SGI não limita</TonePill>}
      />
    )),
  ]

  return (
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
  )
}

/** A pílula de uma categoria num turno, pela resposta da grade do SGI. */
function DayCellPill({ cell }: { cell: DayCategoryCell }) {
  switch (cell.answer) {
    case 'realized':
      // Zero também é resultado: "0 OS", e não o traço de ausência das listas.
      return <span className="text-[12px] tabular-nums text-[var(--text-heading)]">{formatNumber(cell.scheduled)} OS</span>
    case 'refused':
      return <TonePill tone="over">Cheio</TonePill>
    case 'always':
      return <TonePill tone="muted">SGI não limita</TonePill>
    case 'closed':
      return <TonePill tone="muted">Fechado</TonePill>
    case 'fits':
      return (
        <TonePill tone={cell.fits === null ? 'muted' : 'ok'}>
          {cell.fits === null ? 'Sem estimativa' : `Cabe mais ${formatNumber(cell.fits)}`}
        </TonePill>
      )
  }
}

/**
 * A resposta de uma categoria num turno, na linha do dia inteiro. O leitor de
 * tela ouve o turno e as OS dele junto da pílula ("Manhã: Cheio, 2 OS
 * marcadas"): a coluna, que diz o turno a quem vê, não chega até ele, e a
 * contagem do turno fica só na dica de mouse para quem vê.
 */
function DayCell({ cell }: { cell: DayCategoryCell }) {
  const realized = cell.answer === 'realized'
  const orders = ordersText(cell.scheduled, realized)

  return (
    <span title={realized ? undefined : `${cell.period}: ${orders}`}>
      <span className="sr-only">{cell.period}: </span>
      <DayCellPill cell={cell} />
      {realized ? null : <span className="sr-only">, {orders}</span>}
    </span>
  )
}

/** O dia inteiro: uma linha por categoria, com a resposta de cada turno numa coluna. */
function DayCategories({ lines, past }: { lines: readonly DayCategoryLine[]; past: boolean }) {
  const periods = lines[0]?.cells.map((cell) => cell.period) ?? []
  const columns = { gridTemplateColumns: `minmax(0, 1fr) repeat(${periods.length}, 8.5rem)` }
  const allClosed = lines.length > 0 && lines.every((line) => line.cells.every((cell) => cell.answer === 'closed'))
  const heading = past
    ? 'O que foi realizado, por categoria e turno'
    : allClosed
      ? 'O SGI não agenda mais neste dia'
      : 'O que ainda cabe em cada turno, por categoria'

  if (lines.length === 0) {
    return (
      <div>
        <h4 className={`mb-1.5 ${HEADING_CLASS}`}>{heading}</h4>
        <p className="py-3 text-[12px] text-[var(--text-secondary)]">
          {past ? 'Nenhuma OS realizada neste dia.' : 'Nenhuma categoria com OS no dia.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 grid items-end gap-x-3" style={columns}>
        <h4 className={HEADING_CLASS}>{heading}</h4>
        {periods.map((period) => (
          <span className={`${HEADING_CLASS} text-center`} key={period}>
            {period}
          </span>
        ))}
      </div>
      <ul>
        {lines.map((line) => (
          <li
            className="grid items-center gap-x-3 border-t border-[var(--divider)] py-1.5 text-[12.5px]"
            key={line.id}
            style={columns}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-[var(--text-heading)]" title={line.name}>
                {line.name}
              </span>
              <span className="block truncate text-[11px] text-[var(--text-secondary)]">
                <LineMeta line={line} orders={ordersText(line.scheduled, past)} />
              </span>
            </span>
            {line.cells.map((cell) => (
              <span className="flex justify-center" key={cell.periodKey}>
                <DayCell cell={cell} />
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * As categorias da janela, do turno ou do dia inteiro, com a regra da conta e
 * os avisos do dia em cima (feriado, hora limite, rota travada, OS fora da
 * conta), onde a rolagem do bloco não os esconde.
 */
export function AgendaCategories({ dialog }: { dialog: AgendaDialog }) {
  const past = dialog.kind === 'past'
  // A regra da grade só explica a janela que ainda responde "cabe" ou "cheio".
  const open =
    dialog.shift !== null
      ? !dialog.shift.closed
      : dialog.dayLines.some((line) => line.cells.some((cell) => cell.answer !== 'closed'))
  const rule =
    past || !open
      ? null
      : 'Pela grade do SGI: capacidade só dos técnicos aptos em cada categoria, entre as categorias com OS no dia'
  const intro = [rule, dialog.note].filter((parte): parte is string => parte !== null).join(' · ')

  return (
    <section aria-label="Categorias">
      {intro === '' ? null : <p className="mb-2.5 text-[11px] text-[var(--text-secondary)]">{intro}</p>}
      {dialog.shift === null ? (
        <DayCategories lines={dialog.dayLines} past={past} />
      ) : (
        <ShiftCategories detail={dialog.shift} />
      )}
    </section>
  )
}
