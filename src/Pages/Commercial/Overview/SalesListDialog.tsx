import { useImperativeHandle, useRef, useState, type Ref } from 'react'

import { ListDialog, ListDialogHeader } from '../../../components/dashboard/ListDialog'
import { ChoiceChip } from '../../../components/ui/ChoiceChip'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import {
  fetchCommercialSalesDay,
  type CommercialSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { todayISO } from '../../../data/defaultPeriod'
import { downloadXlsx } from '../../../lib/downloadFile'
import { formatDateTimeBr, formatNumber } from '../../../lib/formatters'
import type { CommercialOverviewFilters } from './overviewModel'
import { saleStatusColor } from './overviewStageColors'
import {
  buildSalesListChips,
  buildSalesListRows,
  salesListChipsLabel,
  salesListContext,
  salesListDescription,
  salesListExportHead,
  salesListFileLabel,
  salesListMonthRange,
  salesListMonthRecords,
  salesListMonthTitle,
  salesListPanelTitle,
  salesListSelectionKey,
  salesListSelectionLabel,
  type SalesListSelection,
} from './salesListModel'
import type { TodaySaleRow } from './todaySalesModel'
import {
  buildSalesWorkbook,
  describeTodaySalesListFilters,
  salesExportFileName,
  salesExportInfoTail,
  todaySalesPageFilters,
} from './todaySalesExport'
import { TodaySalesTable } from './TodaySalesTable'
import type { TodaySalesTableFilters } from './todaySalesTableModel'

/**
 * Janela de contratos da Visão Geral Comercial, aberta pelo clique nos
 * painéis Safra de vendas por mês e Evolução mensal das vendas (25/09/2026,
 * pedido do Mário: no Comercial, a mesma janela que a Visão Geral de OS abre
 * no clique). A regra do que ela mostra mora em `salesListModel`; a casca é
 * a janela de lista do portal (`ListDialog`), e a tabela e a planilha são as
 * da lista de contratos do Hoje ao vivo.
 *
 * Diferente da janela de OS, os contratos não estão na página: ela recebe só
 * números somados. A janela pede ao serviço os contratos do mês clicado, e só
 * dele, na hora do clique; trocar de atalho dentro do mesmo mês não pede de
 * novo.
 *
 * Aberta ou fechada, com qual seleção e com qual leitura, é estado DESTA
 * janela, e a página só pede a abertura (`open`), pelo mesmo motivo da janela
 * de OS: com o estado na página, o clique redesenharia os gráficos com o
 * ponteiro ainda sobre a barra.
 */

export type SalesListDialogHandle = {
  readonly open: (selection: SalesListSelection) => void
}

/** A leitura dos contratos do mês aberto. */
export type SalesMonthLoad =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly records: readonly CommercialSaleRecord[]
      /** Hora em que o serviço leu o banco, ISO com fuso; null quando ausente. */
      readonly generatedAt: string | null
    }
  | { readonly status: 'error'; readonly message: string }

type SalesListSource = {
  /** Filtros da página que produziram os painéis: cidade, time, vendedor e tipo de cliente valem. */
  readonly filters: CommercialOverviewFilters
  readonly theme: Theme
}

export function SalesListDialog({
  ref,
  ...source
}: SalesListSource & { ref: Ref<SalesListDialogHandle> }) {
  // Null com a janela fechada.
  const [selection, setSelection] = useState<SalesListSelection | null>(null)
  const [load, setLoad] = useState<SalesMonthLoad>({ status: 'loading' })
  // Só a leitura mais recente vale: fechar e abrir outro mês antes da
  // resposta não pode trazer os contratos do mês anterior.
  const latestRequest = useRef(0)

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        latestRequest.current += 1
        const request = latestRequest.current
        setSelection(next)
        setLoad({ status: 'loading' })
        const { dateFrom, dateTo } = salesListMonthRange(next.month)
        void fetchCommercialSalesDay(dateFrom, { dateToISO: dateTo })
          .then((loaded) => {
            if (latestRequest.current !== request) return
            setLoad({ status: 'ready', records: loaded.records, generatedAt: loaded.generatedAt })
          })
          .catch((cause: unknown) => {
            if (latestRequest.current !== request) return
            setLoad({
              status: 'error',
              message:
                cause instanceof Error ? cause.message : 'Não foi possível ler os contratos do mês.',
            })
          })
      },
    }),
    [],
  )

  return (
    <ListDialog
      onOpenChange={(open) => {
        if (open) return
        // A resposta que chegar depois de fechar não reabre nada.
        latestRequest.current += 1
        setSelection(null)
      }}
      open={selection !== null}
    >
      {(panelContainer) =>
        selection === null ? null : (
          <SalesListPanel
            {...source}
            load={load}
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
 * Conteúdo da janela: título, mês e filtros, atalhos e a lista.
 *
 * Separado da casca para o teste desenhá-lo sem abrir a janela: a casca usa
 * portal, que não existe fora do navegador.
 */
export function SalesListPanel({
  filters,
  load,
  onSelect,
  panelContainer,
  selection,
  theme,
}: SalesListSource & {
  load: SalesMonthLoad
  selection: SalesListSelection
  onSelect: (selection: SalesListSelection) => void
  panelContainer: HTMLElement | null
}) {
  const title = salesListPanelTitle(selection)
  const monthTitle = salesListMonthTitle(selection.month)

  if (load.status !== 'ready') {
    return (
      <>
        <ListDialogHeader
          description={`${monthTitle} · ${load.status === 'loading' ? 'buscando os contratos no serviço de BI' : 'leitura indisponível'}`}
          title={title}
        />
        <div
          className="flex flex-1 items-center justify-center px-5 pb-5 text-center text-[12px] text-[var(--text-secondary)]"
          role={load.status === 'error' ? 'alert' : 'status'}
        >
          {load.status === 'loading'
            ? `Buscando no serviço de BI os contratos de ${monthTitle.toLocaleLowerCase('pt-BR')}.`
            : load.message}
        </div>
      </>
    )
  }

  const today = todayISO()
  // Os filtros da página valem, menos o período: os dois painéis mostram
  // todos os meses.
  const monthRecords = salesListMonthRecords(load.records, selection, filters)
  const pageFilters = todaySalesPageFilters(filters, load.records)
  const selectedKey = salesListSelectionKey(selection)
  const chips = buildSalesListChips(monthRecords, selection, theme)
  const label = salesListSelectionLabel(selection)

  const download = (visible: readonly TodaySaleRow[], tableFilters: TodaySalesTableFilters) => {
    const bytes = buildSalesWorkbook(visible, [
      ...salesListExportHead(selection),
      ...salesExportInfoTail(
        {
          pageFilters,
          listFilters: describeTodaySalesListFilters(tableFilters),
          readAt: load.generatedAt,
          generatedAt: formatDateTimeBr(new Date()),
        },
        visible.length,
      ),
    ])
    downloadXlsx(bytes, salesExportFileName(salesListFileLabel(selection), today))
  }

  return (
    <>
      {/* Mês, régua do painel e filtros da página: a janela vai para o
          projetor sem a faixa de filtros atrás dela. */}
      <ListDialogHeader description={salesListContext(selection, pageFilters)} title={title}>
        {/* "Todas" e as outras barras do mesmo mês, com a cor e a contagem
            delas, no formato dos atalhos da janela de OS. */}
        <div
          aria-label={salesListChipsLabel(selection)}
          className="mt-3 flex flex-wrap gap-1.5"
          role="group"
        >
          {chips.map((chip) => {
            const key = salesListSelectionKey(chip.selection)

            return (
              <ChoiceChip key={key} onClick={() => onSelect(chip.selection)} pressed={key === selectedKey}>
                {/* "Todas" e as outras situações não são barra do painel, então não levam cor. */}
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
        <TodaySalesTable
          colorOf={(row) => saleStatusColor(row.source, theme)}
          description={salesListDescription(selection)}
          emptyMessage="Nenhum contrato nesta seleção."
          fill
          // A seleção é a identidade da lista: trocar de atalho monta outra,
          // com os filtros de coluna zerados, como na janela de OS.
          key={selectedKey}
          label={label}
          onDownload={download}
          panelContainer={panelContainer}
          rows={buildSalesListRows(monthRecords, selection, today)}
        />
      </div>
    </>
  )
}
