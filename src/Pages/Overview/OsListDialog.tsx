import { useEffect, useImperativeHandle, useState, type Ref } from 'react'

import { ListDialog, ListDialogHeader } from '../../components/dashboard/ListDialog'
import { ChoiceChip } from '../../components/ui/ChoiceChip'
import type { OverviewOsOrigin } from '../../contexts/OverviewOsContextCore'
import {
  fetchOverviewOsPeriodList,
  type OverviewOsPeriodListSource,
} from '../../data/api/osOverviewSource'
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
  type OsListSelection,
} from './osListModel'
import type { OverviewOsPeriodFacts } from './overviewModel'
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
 *
 * Desde 01/10/2026 a página não carrega mais as OS do período: a janela as
 * pede ao serviço quando abre, com a mesma regra do painel clicado, e os
 * atalhos contam com os números do período que a página já tem.
 */

/** O que a página pode fazer com a janela: abri-la numa seleção. */
export type OsListDialogHandle = {
  readonly open: (selection: OsListSelection) => void
}

const DESCRIPTION =
  'Cada coluna filtra e ordena só esta lista, e Baixar Excel leva exatamente o que ela mostra. SLA é o tempo previsto de serviço da categoria e, na concluída, o tempo real antes dele. Reagendada mostra quem, quando e o motivo ao parar o mouse. Detalhe traz a resolução nas concluídas, o motivo nas improdutivas e o horário nas que estão em campo.'

type OsListSource = {
  /** Números do período, com todos os filtros: os mesmos do painel clicado. */
  readonly facts: Pick<OverviewOsPeriodFacts, 'daily' | 'outcome' | 'reasons'>
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
  facts,
  filters,
  onSelect,
  origin,
  panelContainer,
  readAt,
  selection,
  technicianNames,
  updatedAt,
  list: givenList,
}: OsListSource & {
  selection: OsListSelection
  onSelect: (selection: OsListSelection) => void
  panelContainer: HTMLElement | null
  /** As OS da barra já carregadas, para o teste desenhar sem consultar o serviço. */
  list?: OverviewOsPeriodListSource
}) {
  const title = osListPanelTitle(selection)
  const label = osListSelectionLabel(selection)
  const selectedKey = osListSelectionKey(selection)
  const chips = buildOsListChips(facts, selection)
  const loaded = usePeriodList(filters, selection, givenList)
  const names = new Map([
    ...technicianNames,
    ...(loaded.list?.technicians ?? []).map((technician) => [technician.id, technician.name] as const),
  ])
  const rows = buildOsListRows(loaded.list?.records ?? [], names)
  // O período do que a lista contém: o dia, na janela do Volume diário.
  const range = osListRange(selection, filters)

  const download = (visible: readonly PeriodOsRow[], tableFilters: TodayOsTableFilters, search: string) => {
    const bytes = buildOsWorkbook(visible, {
      selection: `${title} · ${label}`,
      period: osExportPeriod(range),
      pageFilters: pageFiltersText(filters, coverage, technicianNames),
      listFilters: describeListFilters(tableFilters, OS_LIST_COLUMNS, search),
      source: osExportSource(origin, updatedAt),
      readAt: loaded.list?.generatedAt ?? readAt,
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
          emptyMessage={
            loaded.status === 'error'
              ? (loaded.error ?? 'Não foi possível ler as OS desta seleção.')
              : 'Nenhuma OS nesta seleção.'
          }
          fill
          // A seleção é a identidade da lista: trocar de atalho monta outra,
          // com os filtros de coluna zerados, como ao trocar de caixa em Hoje
          // ao vivo.
          key={selectedKey}
          label={label}
          // Buscando, a lista aparece em cinza sob os nomes das colunas
          // (08/10/2026), e o título não diz "0 OS" antes da hora.
          loadingMessage={loaded.status === 'loading' ? 'Buscando as OS no serviço de BI.' : undefined}
          onDownload={loaded.status === 'ready' ? download : undefined}
          panelContainer={panelContainer}
          rows={rows}
        />
      </div>
    </>
  )
}

type PeriodListState = {
  readonly status: 'loading' | 'ready' | 'error'
  readonly list: OverviewOsPeriodListSource | null
  readonly error: string | null
}

/**
 * As OS da barra escolhida, pedidas ao serviço a cada seleção (e a cada
 * troca de filtro da página). A resposta guarda a identidade do pedido: a de
 * uma seleção anterior nunca aparece sob o título da atual.
 */
function usePeriodList(
  filters: OverviewOsFilters,
  selection: OsListSelection,
  given: OverviewOsPeriodListSource | undefined,
): PeriodListState {
  const key = `${osListSelectionKey(selection)}|${JSON.stringify(filters)}`
  const [loaded, setLoaded] = useState<{ key: string; state: PeriodListState } | null>(null)

  // O `setState` mora no retorno da promessa, e não no corpo do efeito: a
  // regra `set-state-in-effect` do lint continua respeitada.
  useEffect(() => {
    if (given !== undefined) return

    let active = true
    void fetchOverviewOsPeriodList(filters, selection)
      .then((list) => {
        if (active) setLoaded({ key, state: { status: 'ready', list, error: null } })
      })
      .catch((cause: unknown) => {
        if (!active) return
        const error = cause instanceof Error ? cause.message : 'Não foi possível ler as OS desta seleção.'
        setLoaded({ key, state: { status: 'error', list: null, error } })
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, given])

  if (given !== undefined) return { status: 'ready', list: given, error: null }

  return loaded?.key === key ? loaded.state : { status: 'loading', list: null, error: null }
}
