import { useImperativeHandle, useRef, useState, type Ref } from 'react'

import { ListDialog, ListDialogHeader } from '../../../components/dashboard/ListDialog'
import { SkeletonBlock } from '../../../components/dashboard/PageSkeleton'
import { ChoiceChip } from '../../../components/ui/ChoiceChip'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import {
  fetchCommercialMonthSales,
  type CommercialMonthChipCount,
  type CommercialSaleRecord,
} from '../../../data/api/commercialRecordsSource'
import { todayISO } from '../../../data/defaultPeriod'
import { downloadXlsx } from '../../../lib/downloadFile'
import { useMoneyShown } from './moneyVisibility'
import { formatDateTimeBr, formatNumber } from '../../../lib/formatters'
import type { CommercialOverviewFilters } from './overviewModel'
import { saleStatusColor } from './overviewStageColors'
import {
  buildSalesListChips,
  buildSalesListRows,
  salesListApiSlice,
  salesListChipsLabel,
  salesListContext,
  salesListDescription,
  salesListExportHead,
  salesListFileLabel,
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
  type SalesFilterNames,
} from './todaySalesExport'
import { TodaySalesTable } from './TodaySalesTable'
import type { TodaySalesTableFilters } from './todaySalesTableModel'

/**
 * Janela de contratos da Visão Geral Comercial, aberta pelo clique nos
 * painéis Safra de vendas por mês e Evolução mensal das vendas (25/09/2026,
 * pedido do Mário: no Comercial, a mesma janela que a Visão Geral de OS abre
 * no clique). O texto do que ela mostra mora em `salesListModel`; a casca é
 * a janela de lista do portal (`ListDialog`), e a tabela e a planilha são as
 * da lista de contratos do Hoje ao vivo.
 *
 * Diferente da janela de OS, os contratos não estão na página: ela recebe só
 * números somados. Desde 01/10/2026 a janela pede ao serviço, na hora do
 * clique, só os contratos da BARRA escolhida, já com os filtros da página e
 * na ordem do painel, e a contagem de cada barra do mês para os atalhos.
 * Trocar de atalho é outra consulta pequena, e não um recorte no navegador
 * sobre o mês inteiro.
 *
 * Aberta ou fechada, com qual seleção e com qual leitura, é estado DESTA
 * janela, e a página só pede a abertura (`open`), pelo mesmo motivo da janela
 * de OS: com o estado na página, o clique redesenharia os gráficos com o
 * ponteiro ainda sobre a barra.
 */

export type SalesListDialogHandle = {
  readonly open: (selection: SalesListSelection) => void
}

/** A leitura dos contratos da barra aberta. */
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
  /** Nomes de cidade e vendedor dos catálogos da página, para escrever os filtros. */
  readonly names: SalesFilterNames
  readonly theme: Theme
}

/** O mês e o painel: trocar de atalho dentro deles mantém os atalhos na tela. */
function monthKeyOf(selection: SalesListSelection): string {
  return `${selection.kind}:${selection.month}`
}

export function SalesListDialog({
  ref,
  ...source
}: SalesListSource & { ref: Ref<SalesListDialogHandle> }) {
  // Null com a janela fechada.
  const [selection, setSelection] = useState<SalesListSelection | null>(null)
  const [load, setLoad] = useState<SalesMonthLoad>({ status: 'loading' })
  // Atalhos da última leitura, com o mês e o painel a que pertencem: enquanto
  // a lista de outro atalho do mesmo mês vem, eles continuam na tela.
  const [chips, setChips] = useState<{ readonly key: string; readonly counts: readonly CommercialMonthChipCount[] } | null>(
    null,
  )
  // Só a leitura mais recente vale: trocar de atalho, fechar ou abrir outro
  // mês antes da resposta não pode trazer os contratos da seleção anterior.
  const latestRequest = useRef(0)
  const { filters } = source

  const request = (next: SalesListSelection) => {
    latestRequest.current += 1
    const current = latestRequest.current
    setSelection(next)
    setLoad({ status: 'loading' })
    void fetchCommercialMonthSales(next.kind, next.month, salesListApiSlice(next), filters)
      .then((loaded) => {
        if (latestRequest.current !== current) return
        setChips({ key: monthKeyOf(next), counts: loaded.chips })
        setLoad({ status: 'ready', records: loaded.records, generatedAt: loaded.generatedAt })
      })
      .catch((cause: unknown) => {
        if (latestRequest.current !== current) return
        setLoad({
          status: 'error',
          message: cause instanceof Error ? cause.message : 'Não foi possível ler os contratos do mês.',
        })
      })
  }

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setChips(null)
        request(next)
      },
    }),
    // Refeito quando os filtros da página mudam: a janela pede com os filtros
    // dos painéis que estão na tela. O resto de `request` é setter e ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
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
            chips={chips !== null && chips.key === monthKeyOf(selection) ? chips.counts : null}
            load={load}
            onSelect={request}
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
  chips,
  filters,
  load,
  names,
  onSelect,
  panelContainer,
  selection,
  theme,
}: SalesListSource & {
  /** Contagem de cada barra do mês, da última leitura; null antes da primeira. */
  chips: readonly CommercialMonthChipCount[] | null
  load: SalesMonthLoad
  selection: SalesListSelection
  onSelect: (selection: SalesListSelection) => void
  panelContainer: HTMLElement | null
}) {
  const title = salesListPanelTitle(selection)
  const monthTitle = salesListMonthTitle(selection.month)
  const moneyShown = useMoneyShown()

  // Sem atalhos ainda, a primeira leitura do mês. Buscando, a janela mostra
  // os atalhos e a lista em cinza, no lugar em que vão ficar (08/10/2026);
  // na falha, só a mensagem do serviço.
  if (chips === null) {
    const failed = load.status === 'error'

    return (
      <>
        <ListDialogHeader
          description={`${monthTitle} · ${failed ? 'leitura indisponível' : 'buscando os contratos no serviço de BI'}`}
          title={title}
        >
          {failed ? null : (
            <div aria-hidden="true" className="mt-3 flex flex-wrap gap-1.5" data-skeleton="chips">
              {['w-16', 'w-28', 'w-24', 'w-32'].map((width) => (
                <SkeletonBlock className={`h-[22px] rounded-full ${width}`} key={width} />
              ))}
            </div>
          )}
        </ListDialogHeader>
        {load.status === 'error' ? (
          <div
            className="flex flex-1 items-center justify-center px-5 pb-5 text-center text-[12px] text-[var(--text-secondary)]"
            role="alert"
          >
            {load.message}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
            <TodaySalesTable
              colorOf={(row) => saleStatusColor(row.source, theme)}
              description={salesListDescription(selection)}
              fill
              label={salesListSelectionLabel(selection)}
              loadingMessage={`Buscando no serviço de BI os contratos de ${monthTitle.toLocaleLowerCase('pt-BR')}.`}
              panelContainer={panelContainer}
              rows={[]}
            />
          </div>
        )}
      </>
    )
  }

  const today = todayISO()
  const pageFilters = todaySalesPageFilters(filters, names)
  const selectedKey = salesListSelectionKey(selection)
  const chipList = buildSalesListChips(chips, selection, theme)
  const label = salesListSelectionLabel(selection)
  const records = load.status === 'ready' ? load.records : []
  const emptyMessage = load.status === 'error' ? load.message : 'Nenhum contrato nesta seleção.'

  const download = (visible: readonly TodaySaleRow[], tableFilters: TodaySalesTableFilters) => {
    const bytes = buildSalesWorkbook(visible, [
      ...salesListExportHead(selection),
      ...salesExportInfoTail(
        {
          pageFilters,
          listFilters: describeTodaySalesListFilters(tableFilters),
          readAt: load.status === 'ready' ? load.generatedAt : null,
          generatedAt: formatDateTimeBr(new Date()),
        },
        visible.length,
      ),
    ], undefined, moneyShown)
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
          {chipList.map((chip) => {
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
          emptyMessage={emptyMessage}
          fill
          // A seleção é a identidade da lista: trocar de atalho monta outra,
          // com os filtros de coluna zerados, como na janela de OS.
          key={selectedKey}
          label={label}
          // Buscando, a lista aparece em cinza sob os nomes das colunas
          // (08/10/2026), e o título não diz "0 contratos" antes da hora.
          loadingMessage={load.status === 'loading' ? 'Buscando os contratos no serviço de BI.' : undefined}
          onDownload={download}
          panelContainer={panelContainer}
          rows={buildSalesListRows(records, today)}
        />
      </div>
    </>
  )
}
