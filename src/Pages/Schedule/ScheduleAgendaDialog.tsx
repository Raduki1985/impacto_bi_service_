import { useEffect, useId, useState } from 'react'

import { ListDialog, ListDialogHeader } from '../../components/dashboard/ListDialog'
import { ChoiceChip } from '../../components/ui/ChoiceChip'
import { PanelTabPanel, PanelTabs } from '../../components/ui/PanelTabs'
import { fetchOsScheduleList, type OsScheduleListSource } from '../../data/api/osOverviewSource'
import type { OsScheduleSource } from '../../data/api/osScheduleSource'
import { downloadXlsx } from '../../lib/downloadFile'
import { formatDateTimeBr, formatIsoClock, formatNumber } from '../../lib/formatters'
import {
  buildOsWorkbook,
  describeListFilters,
  osExportFileName,
  osExportPeriod,
  osExportSource,
} from '../Overview/osListExport'
import { compareOperationOrder, toPeriodOsRow, type PeriodOsRow } from '../Overview/todayOsModel'
import { TodayOsTable } from '../Overview/TodayOsTable'
import { TODAY_COLUMNS, type TodayOsTableFilters } from '../Overview/todayOsTableModel'
import { buildAgendaDialog, agendaSelectionKey, type AgendaSelection } from './scheduleModel'
import { AgendaCategories } from './ScheduleShiftDetail'

/**
 * A janela da Agenda e capacidade (21/10/2026): o clique num turno abre o
 * turno, e o clique no nome do dia abre o dia inteiro, no centro da tela,
 * como as janelas de lista do portal. Até ali o turno abria um detalhe
 * embaixo do calendário, só com as categorias.
 *
 * De cima para baixo: o título e a linha de contexto (OS, horas, resposta do
 * turno, técnicos, hora da leitura), os atalhos "Dia inteiro" e um por turno
 * com a contagem do calendário, e duas abas (Mário, 21/10/2026: as duas partes
 * juntas dividiam a janela ao meio): Categorias, que abre primeiro porque é a
 * pergunta de quem agenda, e OS, a lista com filtro por coluna, busca e
 * Baixar Excel. A aba escolhida fica ao trocar de turno, e a janela volta a
 * abrir em Categorias. A tabela e a planilha são as da Visão
 * Geral de OS (`TodayOsTable`, `osListExport`), sem a coluna Data, porque a
 * lista é de um dia só.
 *
 * As OS vêm do serviço quando a janela abre, pela mesma regra que o
 * calendário conta (no futuro só as ativas, hoje tudo o que aconteceu e o que
 * ainda vai acontecer, no passado só o realizado): o número da lista fecha
 * com o do turno. Se o dia virou com a janela aberta, a lista já vem pela
 * regra do dia novo, e a janela diz isso em vez de culpar a agenda. A janela guarda a
 * leitura do calendário de quando abriu (`OpenAgenda`), e a releitura de 5
 * minutos da página não mexe nela; se a agenda mudou entre as duas leituras,
 * ela diz.
 */

/** As duas partes da janela, uma de cada vez. */
type AgendaTab = 'categories' | 'orders'

/** A janela aberta: o que ela mostra e a leitura do calendário de quando abriu. */
export type OpenAgenda = { readonly selection: AgendaSelection; readonly source: OsScheduleSource }

const DESCRIPTION =
  'Entram as OS que o calendário conta: no futuro só as ativas, hoje tudo o que aconteceu e o que ainda vai acontecer, no passado só o realizado. Cada coluna filtra e ordena só esta lista, e Baixar Excel leva exatamente o que ela mostra. SLA é o tempo previsto de serviço da categoria e, na concluída, o tempo real antes dele. Reagendada mostra quem, quando e o motivo ao parar o mouse. Detalhe traz a resolução nas concluídas, o motivo nas improdutivas e o horário nas que estão em campo.'

export function ScheduleAgendaDialog({
  agenda,
  onClose,
  onSelect,
}: {
  agenda: OpenAgenda | null
  onClose: () => void
  onSelect: (selection: AgendaSelection) => void
}) {
  return (
    <ListDialog
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      open={agenda !== null}
    >
      {(panelContainer) =>
        agenda === null ? null : (
          <ScheduleAgendaPanel {...agenda} onSelect={onSelect} panelContainer={panelContainer} />
        )
      }
    </ListDialog>
  )
}

/**
 * Conteúdo da janela. Separado da casca para o teste desenhá-lo sem abrir a
 * janela, que usa portal. A classe `os-schedule` traz os tons da página para
 * dentro da janela, publicada fora dela; `contents` não cria caixa, e o
 * desenho em coluna da janela continua valendo para os blocos.
 */
export function ScheduleAgendaPanel({
  list: givenList,
  onSelect,
  panelContainer,
  selection,
  source,
}: OpenAgenda & {
  onSelect: (selection: AgendaSelection) => void
  panelContainer: HTMLElement | null
  /** As OS já carregadas, para o teste desenhar sem consultar o serviço. */
  list?: OsScheduleListSource
}) {
  const loaded = useAgendaList(selection, givenList)
  // A aba mora no conteúdo, que continua montado ao trocar de turno: a
  // escolha fica. Fechar a janela desmonta o conteúdo, e ela volta a abrir em
  // Categorias.
  const [tab, setTab] = useState<AgendaTab>('categories')
  const baseId = useId()
  const dialog = buildAgendaDialog(source, selection)
  if (dialog === null) {
    return <ListDialogHeader description="A leitura da agenda não tem este dia ou este turno." title="Agenda" />
  }

  const names = new Map((loaded.list?.technicians ?? []).map((technician) => [technician.id, technician.name] as const))
  const rows: PeriodOsRow[] = (loaded.list?.records ?? [])
    .map((record) => toPeriodOsRow(record, names, source.today))
    .sort(compareOperationOrder)
  const selectedKey = agendaSelectionKey(selection)
  const range = { dateFrom: selection.iso, dateTo: selection.iso }
  const listReadAt = loaded.list === null ? null : formatIsoClock(loaded.list.generatedAt)
  // O dia virou com a janela aberta: a lista conta pela regra do dia novo, e
  // a diferença não é da agenda.
  const turned = loaded.list !== null && loaded.list.kind !== null && loaded.list.kind !== dialog.kind
  const changed = !turned && loaded.list !== null && loaded.list.records.length !== dialog.expected

  const download = (visible: readonly PeriodOsRow[], filters: TodayOsTableFilters, search: string) => {
    const bytes = buildOsWorkbook(visible, {
      selection: dialog.title,
      period: osExportPeriod(range),
      pageFilters: null,
      listFilters: describeListFilters(filters, TODAY_COLUMNS, search),
      source: osExportSource('api', null),
      readAt: loaded.list?.generatedAt ?? null,
      generatedAt: formatDateTimeBr(new Date()),
    })
    downloadXlsx(bytes, osExportFileName(`agenda ${dialog.label}`, range))
  }

  return (
    <div className="os-schedule contents">
      <ListDialogHeader description={dialog.description} title={dialog.title}>
        {/* O dia inteiro e cada turno, com a contagem do calendário: trocar
            de turno não obriga a fechar a janela e clicar de novo. */}
        <div aria-label="Trocar entre o dia inteiro e os turnos" className="mt-3 flex flex-wrap gap-1.5" role="group">
          {dialog.chips.map((chip) => {
            const key = agendaSelectionKey(chip.selection)

            return (
              <ChoiceChip key={key} onClick={() => onSelect(chip.selection)} pressed={key === selectedKey}>
                {chip.label}
                <span className="font-mono">{formatNumber(chip.count)}</span>
              </ChoiceChip>
            )
          })}
        </div>
      </ListDialogHeader>
      <PanelTabs
        activeId={tab}
        ariaLabel="Partes da agenda"
        baseId={baseId}
        onChange={setTab}
        tabs={[
          { id: 'categories', label: 'Categorias', count: dialog.categoryCount },
          { id: 'orders', label: 'OS', count: dialog.expected },
        ]}
      />
      <PanelTabPanel
        active={tab === 'categories'}
        baseId={baseId}
        className="min-h-0 flex-1 overflow-auto px-5 py-3"
        tabId="categories"
      >
        <AgendaCategories dialog={dialog} />
      </PanelTabPanel>
      {/* A lista fica montada com a aba escondida: o filtro de coluna e a
          busca continuam lá quando a pessoa volta para ela. */}
      <PanelTabPanel
        active={tab === 'orders'}
        baseId={baseId}
        className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-3"
        tabId="orders"
      >
        {turned ? (
          <p className="mb-2 text-[11.5px] text-[var(--text-secondary)]">
            O dia virou desde a leitura do calendário: a lista já conta pela regra de{' '}
            {loaded.list?.kind === 'past' ? 'dia passado, só o realizado' : 'hoje, tudo o que aconteceu e o que ainda vai acontecer'}.
            Feche a janela e abra de novo depois que o calendário atualizar.
          </p>
        ) : null}
        {changed ? (
          <p className="mb-2 text-[11.5px] text-[var(--text-secondary)]">
            A agenda mudou entre as duas leituras: o calendário contava {formatNumber(dialog.expected)} OS, e a lista
            {listReadAt === null ? '' : `, lida às ${listReadAt},`} tem {formatNumber(loaded.list?.records.length ?? 0)}.
          </p>
        ) : null}
        <TodayOsTable
          columns={TODAY_COLUMNS}
          description={DESCRIPTION}
          emptyMessage={
            loaded.status === 'error'
              ? (loaded.error ?? 'Não foi possível ler as OS da agenda.')
              : dialog.kind === 'past'
                ? 'Nenhuma OS realizada aqui.'
                : 'Nenhuma OS marcada aqui.'
          }
          fill
          // A seleção é a identidade da lista: trocar de turno monta outra,
          // com os filtros de coluna zerados, como na janela de OS da Visão Geral.
          key={selectedKey}
          label={dialog.label}
          loadingMessage={loaded.status === 'loading' ? 'Buscando as OS no serviço de BI.' : undefined}
          onDownload={loaded.status === 'ready' ? download : undefined}
          panelContainer={panelContainer}
          rows={rows}
        />
      </PanelTabPanel>
    </div>
  )
}

type AgendaListState = {
  readonly status: 'loading' | 'ready' | 'error'
  readonly list: OsScheduleListSource | null
  readonly error: string | null
}

/**
 * As OS do turno ou do dia escolhido, pedidas ao serviço a cada seleção. A
 * resposta guarda a identidade do pedido: a de uma seleção anterior nunca
 * aparece sob o título da atual. O `setState` mora no retorno da promessa, e
 * não no corpo do efeito, como pede a regra `set-state-in-effect` do lint.
 */
function useAgendaList(selection: AgendaSelection, given: OsScheduleListSource | undefined): AgendaListState {
  const { iso, periodKey } = selection
  const key = agendaSelectionKey(selection)
  const [loaded, setLoaded] = useState<{ key: string; state: AgendaListState } | null>(null)

  useEffect(() => {
    if (given !== undefined) return

    let active = true
    const requested = agendaSelectionKey({ iso, periodKey })
    void fetchOsScheduleList(iso, periodKey)
      .then((list) => {
        if (active) setLoaded({ key: requested, state: { status: 'ready', list, error: null } })
      })
      .catch((cause: unknown) => {
        if (!active) return
        const error = cause instanceof Error ? cause.message : 'Não foi possível ler as OS da agenda.'
        setLoaded({ key: requested, state: { status: 'error', list: null, error } })
      })

    return () => {
      active = false
    }
  }, [iso, periodKey, given])

  if (given !== undefined) return { status: 'ready', list: given, error: null }

  return loaded?.key === key ? loaded.state : { status: 'loading', list: null, error: null }
}
