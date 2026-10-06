import { useImperativeHandle, useRef, useState, type Ref } from 'react'

import { ListDialog, ListDialogHeader } from '../../../components/dashboard/ListDialog'
import { ChoiceChip } from '../../../components/ui/ChoiceChip'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import {
  fetchCommercialPeriodSales,
  type CommercialPeriodSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { todayISO } from '../../../data/defaultPeriod'
import { periodTitle } from '../../../data/overviewOsFilters'
import { downloadXlsx } from '../../../lib/downloadFile'
import { formatDateTimeBr, formatNumber } from '../../../lib/formatters'
import { useMoneyShown } from './moneyVisibility'
import type { CommercialOverviewFilters } from './overviewModel'
import { saleStatusColor } from './overviewStageColors'
import {
  buildPeriodChips,
  PERIOD_LIST_TITLE,
  periodCounts,
  periodExportHead,
  periodExtraColumns,
  periodListContext,
  periodListDescription,
  periodListLabel,
  periodPartLabel,
  periodPartRecords,
  type PeriodPart,
  type PeriodRange,
} from './periodSalesExport'
import { toSaleRow, type TodaySaleRow } from './todaySalesModel'
import {
  buildSalesWorkbook,
  describeTodaySalesListFilters,
  salesExportFileName,
  salesExportInfoTail,
  todaySalesPageFilters,
  type SalesFilterNames,
} from './todaySalesExport'
import { TodaySalesTable } from './TodaySalesTable'
import type { TodaySalesTableFilters } from './todaySalesTableModel'

/**
 * Janela do card Vendas ativadas, aberta pelo ícone do card (06/10/2026): os
 * contratos que ligaram o sinal no período, separados como a frente do card
 * separa. A regra dos atalhos e os textos moram em `periodSalesExport`; a
 * casca é a janela de lista do portal (`ListDialog`), e a tabela e a
 * planilha são as da lista de contratos do Hoje ao vivo, como na janela da
 * Safra.
 *
 * Diferente da janela da Safra, uma leitura só: os contratos do período vêm
 * na abertura, e os atalhos recortam no navegador. Aberta ou fechada, e com
 * qual leitura, é estado desta janela; a página só pede a abertura.
 */

export type ActivatedSalesDialogHandle = {
  readonly open: (range: PeriodRange) => void
}

/** A leitura dos contratos do período. */
export type ActivatedSalesLoad =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      /** Os vendidos OU ativados no período, como o serviço os manda. */
      readonly records: readonly CommercialPeriodSaleRecord[]
      /** Hora em que o serviço leu o banco, ISO com fuso; null quando ausente. */
      readonly generatedAt: string | null
    }
  | { readonly status: 'error'; readonly message: string }

type ActivatedSalesSource = {
  /** Filtros da página que produziram os cards: cidade, time, vendedor e tipo de cliente. */
  readonly filters: CommercialOverviewFilters
  /** Nomes de cidade e vendedor dos catálogos da página, para escrever os filtros. */
  readonly names: SalesFilterNames
  readonly theme: Theme
}

export function ActivatedSalesDialog({
  ref,
  ...source
}: ActivatedSalesSource & { ref: Ref<ActivatedSalesDialogHandle> }) {
  // Null com a janela fechada.
  const [range, setRange] = useState<PeriodRange | null>(null)
  const [part, setPart] = useState<PeriodPart>('activated')
  const [load, setLoad] = useState<ActivatedSalesLoad>({ status: 'loading' })
  // Só a leitura mais recente vale: fechar ou reabrir antes da resposta não
  // pode trazer os contratos da abertura anterior.
  const latestRequest = useRef(0)
  const { filters } = source

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        latestRequest.current += 1
        const current = latestRequest.current
        setRange(next)
        // Abre no número do card.
        setPart('activated')
        setLoad({ status: 'loading' })
        void fetchCommercialPeriodSales(next, filters)
          .then((loaded) => {
            if (latestRequest.current !== current) return
            setLoad({ status: 'ready', records: loaded.records, generatedAt: loaded.generatedAt })
          })
          .catch((cause: unknown) => {
            if (latestRequest.current !== current) return
            setLoad({
              status: 'error',
              message: cause instanceof Error ? cause.message : 'Não foi possível ler os contratos do período.',
            })
          })
      },
    }),
    // Refeito quando os filtros da página mudam: a janela pede com os filtros
    // dos cards que estão na tela. O resto é setter e ref.
    [filters],
  )

  return (
    <ListDialog
      onOpenChange={(open) => {
        if (open) return
        // A resposta que chegar depois de fechar não reabre nada.
        latestRequest.current += 1
        setRange(null)
      }}
      open={range !== null}
    >
      {(panelContainer) =>
        range === null ? null : (
          <ActivatedSalesPanel
            {...source}
            load={load}
            onSelect={setPart}
            panelContainer={panelContainer}
            part={part}
            range={range}
          />
        )
      }
    </ListDialog>
  )
}

/**
 * Conteúdo da janela: título, período e filtros, os três atalhos e a lista.
 *
 * Separado da casca para o teste desenhá-lo sem abrir a janela: a casca usa
 * portal, que não existe fora do navegador.
 */
export function ActivatedSalesPanel({
  filters,
  load,
  names,
  onSelect,
  panelContainer,
  part,
  range,
  theme,
}: ActivatedSalesSource & {
  load: ActivatedSalesLoad
  part: PeriodPart
  range: PeriodRange
  onSelect: (part: PeriodPart) => void
  panelContainer: HTMLElement | null
}) {
  const moneyShown = useMoneyShown()
  const pageFilters = todaySalesPageFilters(filters, names)
  const title = periodTitle(range)

  if (load.status !== 'ready') {
    return (
      <>
        <ListDialogHeader
          description={`${title} · ${load.status === 'error' ? 'leitura indisponível' : 'buscando os contratos no serviço de BI'}`}
          title={PERIOD_LIST_TITLE}
        />
        <div
          className="flex flex-1 items-center justify-center px-5 pb-5 text-center text-[12px] text-[var(--text-secondary)]"
          role={load.status === 'error' ? 'alert' : 'status'}
        >
          {load.status === 'error'
            ? load.message
            : `Buscando no serviço de BI os contratos de ${title.toLocaleLowerCase('pt-BR')}.`}
        </div>
      </>
    )
  }

  const today = todayISO()
  const label = periodListLabel(range, part)
  const records = periodPartRecords(load.records, part, range)
  const counts = periodCounts(load.records, range)

  const download = (visible: readonly TodaySaleRow[], tableFilters: TodaySalesTableFilters) => {
    const bytes = buildSalesWorkbook(
      visible,
      [
        ...periodExportHead(range, part),
        ...salesExportInfoTail(
          {
            pageFilters,
            listFilters: describeTodaySalesListFilters(tableFilters),
            readAt: load.generatedAt,
            generatedAt: formatDateTimeBr(new Date()),
          },
          visible.length,
        ),
      ],
      periodExtraColumns(records, range),
      moneyShown,
    )
    downloadXlsx(bytes, salesExportFileName(label, today))
  }

  return (
    <>
      {/* Período e filtros da página: a janela vai para o projetor sem a
          faixa de filtros atrás dela. */}
      <ListDialogHeader description={periodListContext(range, pageFilters)} title={PERIOD_LIST_TITLE}>
        {/* Os três números do card, na ordem da leitura dele; o aceso é a lista. */}
        <div
          aria-label={`Trocar a lista, vendas ativadas de ${title.toLocaleLowerCase('pt-BR')}`}
          className="mt-3 flex flex-wrap gap-1.5"
          role="group"
        >
          {buildPeriodChips(counts).map((chip) => (
            <ChoiceChip
              key={chip.part}
              onClick={() => onSelect(chip.part)}
              pressed={chip.part === part}
              title={`Ver os contratos: ${periodPartLabel(chip.part).toLocaleLowerCase('pt-BR')}`}
            >
              {chip.label}
              <span className="font-mono">{formatNumber(chip.count)}</span>
            </ChoiceChip>
          ))}
        </div>
      </ListDialogHeader>
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        <TodaySalesTable
          colorOf={(row) => saleStatusColor(row.source, theme)}
          description={periodListDescription()}
          emptyMessage="Nenhum contrato nesta seleção."
          fill
          // O atalho é a identidade da lista: trocar monta outra, com os
          // filtros de coluna zerados, como nas outras janelas.
          key={part}
          label={label}
          onDownload={download}
          panelContainer={panelContainer}
          rows={records.map((record) => toSaleRow(record, today))}
        />
      </div>
    </>
  )
}
