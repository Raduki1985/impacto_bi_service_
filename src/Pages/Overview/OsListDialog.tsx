import { useImperativeHandle, useState, type Ref } from 'react'

import { ListDialog, ListDialogHeader } from '../../components/dashboard/ListDialog'
import { ChoiceChip } from '../../components/ui/ChoiceChip'
import type { OverviewOsOrigin } from '../../contexts/OverviewOsContextCore'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import type { OverviewOsCoverage, OverviewOsFilters } from '../../data/overviewOsFilters'
import { downloadXlsx } from '../../lib/downloadFile'
import { formatDateTimeBr, formatNumber } from '../../lib/formatters'
import {
  buildOsWorkbook,
  describeListFilters,
  osExportFileName,
  osExportPeriod,
  osExportSource,
} from './osListExport'
import {
  buildOsListChips,
  buildOsListRows,
  osListChipsLabel,
  osListContext,
  osListPanelTitle,
  osListRange,
  osListSelectionKey,
  osListSelectionLabel,
  pageFiltersText,
  selectOsListRecords,
  type OsListSelection,
} from './osListModel'
import type { PeriodOsRow } from './todayOsModel'
import { TodayOsTable } from './TodayOsTable'
import { OS_LIST_COLUMNS, type TodayOsTableFilters } from './todayOsTableModel'

/**
 * Janela de OS da Visão Geral, aberta pelo clique nos painéis Motivos de
 * improdutiva, Destino das OS e Volume diário (24/09/2026, decisão do Mário:
 * janela no centro da tela, e não matriz no fim da página). A regra do que
 * ela mostra mora em `osListModel`; a casca é a janela de lista do portal
 * (`ListDialog`), e aqui fica só o que é da OS: a seleção, os atalhos e a
 * lista.
 *
 * Aberta ou fechada, e com qual seleção, é estado DESTA janela, e a página
 * só pede a abertura (`open`). Com o estado na página, o clique redesenhava
 * todos os gráficos com o ponteiro ainda sobre a barra, e a biblioteca de
 * gráficos falhava no console ao perder a barra sob o ponteiro (visto no
 * navegador em 24/09/2026). Assim, abrir, trocar de atalho e fechar não
 * tocam nos gráficos.
 */

/** O que a página pode fazer com a janela: abri-la numa seleção. */
export type OsListDialogHandle = {
  readonly open: (selection: OsListSelection) => void
}

const DESCRIPTION =
  'Cada coluna filtra e ordena só esta lista, e Baixar Excel leva exatamente o que ela mostra. Detalhe traz a resolução nas concluídas, o motivo nas improdutivas e o horário nas que estão em campo.'

type OsListSource = {
  /** Registros da página com TODOS os filtros aplicados: os mesmos do painel clicado. */
  readonly records: readonly OverviewOsRecord[]
  readonly filters: OverviewOsFilters
  readonly coverage: OverviewOsCoverage
  readonly technicianNames: ReadonlyMap<string, string>
  readonly origin: OverviewOsOrigin
  readonly updatedAt: string | null
  /** Hora em que o serviço leu o banco para a carga da página. */
  readonly readAt: string | null
}

export function OsListDialog({
  ref,
  ...source
}: OsListSource & { ref: Ref<OsListDialogHandle> }) {
  // Null com a janela fechada.
  const [selection, setSelection] = useState<OsListSelection | null>(null)

  useImperativeHandle(ref, () => ({ open: setSelection }), [])

  return (
    <ListDialog
      onOpenChange={(open) => {
        if (!open) setSelection(null)
      }}
      open={selection !== null}
    >
      {(panelContainer) =>
        selection === null ? null : (
          <OsListPanel
            {...source}
            onSelect={setSelection}
            panelContainer={panelContainer}
            selection={selection}
          />
        )
      }
    </ListDialog>
  )
}

/**
 * Conteúdo da janela: título, período e filtros, atalhos e a lista.
 *
 * Separado da casca para o teste desenhá-lo sem abrir a janela: a casca usa
 * portal, que não existe fora do navegador.
 */
export function OsListPanel({
  coverage,
  filters,
  onSelect,
  origin,
  panelContainer,
  readAt,
  records,
  selection,
  technicianNames,
  updatedAt,
}: OsListSource & {
  selection: OsListSelection
  onSelect: (selection: OsListSelection) => void
  panelContainer: HTMLElement | null
}) {
  const title = osListPanelTitle(selection)
  const label = osListSelectionLabel(selection)
  const selectedKey = osListSelectionKey(selection)
  const chips = buildOsListChips(records, selection)
  const rows = buildOsListRows(selectOsListRecords(records, selection), technicianNames)
  // O período do que a lista contém: o dia, na janela do Volume diário.
  const range = osListRange(selection, filters)

  const download = (visible: readonly PeriodOsRow[], tableFilters: TodayOsTableFilters) => {
    const bytes = buildOsWorkbook(visible, {
      selection: `${title} · ${label}`,
      period: osExportPeriod(range),
      pageFilters: pageFiltersText(filters, coverage, technicianNames),
      listFilters: describeListFilters(tableFilters, OS_LIST_COLUMNS),
      source: osExportSource(origin, updatedAt),
      readAt,
      generatedAt: formatDateTimeBr(new Date()),
    })
    downloadXlsx(bytes, osExportFileName(label, range))
  }

  return (
    <>
      {/* Período pelo nome e filtros da página: a janela vai para o projetor
          sem a faixa de filtros atrás dela. No Volume diário o período é o
          dia clicado. */}
      <ListDialogHeader
        description={osListContext({ ...filters, ...range }, coverage, technicianNames)}
        title={title}
      >
        {/* "Todas" e as outras barras do mesmo painel, com a cor e a contagem
            delas: trocar de motivo, ou ver o painel inteiro para baixar de
            uma vez, não obriga a fechar a janela e clicar de novo. O formato
            é o do atalho de período da faixa de filtros. */}
        <div aria-label={osListChipsLabel(selection)} className="mt-3 flex flex-wrap gap-1.5" role="group">
          {chips.map((chip) => {
            const key = osListSelectionKey(chip.selection)

            return (
              <ChoiceChip key={key} onClick={() => onSelect(chip.selection)} pressed={key === selectedKey}>
                {/* O "Todas" não é uma barra do painel, então não leva cor. */}
                {chip.color === null ? null : (
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 flex-none rounded-full"
                    style={{ background: chip.color }}
                  />
                )}
                {chip.label}
                <span className="font-mono">{formatNumber(chip.count)}</span>
              </ChoiceChip>
            )
          })}
        </div>
      </ListDialogHeader>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        <TodayOsTable
          columns={OS_LIST_COLUMNS}
          description={DESCRIPTION}
          emptyMessage="Nenhuma OS nesta seleção."
          fill
          // A seleção é a identidade da lista: trocar de atalho monta outra,
          // com os filtros de coluna zerados, como ao trocar de caixa em Hoje
          // ao vivo.
          key={selectedKey}
          label={label}
          onDownload={download}
          panelContainer={panelContainer}
          rows={rows}
        />
      </div>
    </>
  )
}
