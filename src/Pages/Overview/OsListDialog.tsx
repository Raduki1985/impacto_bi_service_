import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useImperativeHandle, useState, type Ref } from 'react'

import type { OverviewOsOrigin } from '../../contexts/OverviewOsContextCore'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import type { OverviewOsCoverage, OverviewOsFilters } from '../../data/overviewOsFilters'
import { formatDateTimeBr, formatNumber } from '../../lib/formatters'
import { downloadXlsx } from './downloadFile'
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
 * ela mostra mora em `osListModel`; aqui fica a casca.
 *
 * - A casca é a janela modal do portal (Radix Dialog, a mesma de Perfis de
 *   Acesso): foco preso nela, Esc e clique fora fecham, e a página atrás não
 *   rola. A superfície vem dos tokens do tema, e não do branco fixo daquela
 *   área, porque a Visão Geral tem tema escuro.
 * - O centro da tela é feito com flex, e não com o deslocamento de metade da
 *   largura que os outros modais usam: o painel do filtro de coluna tem
 *   posição fixa, e dentro de um elemento deslocado ele nasceria fora do
 *   lugar. Pelo mesmo motivo a camada que ocupa a tela não recebe clique
 *   (`pointerEvents: none`): o clique no fundo cai na película escura, e é
 *   isso que a janela reconhece como clique fora para fechar.
 * - O painel do filtro de coluna nasce DENTRO da janela, num contêiner
 *   próprio: fora dela ele seria clique fora, e o foco não entraria no campo
 *   de busca. Com um painel aberto, o Esc fecha só o painel, e não a janela.
 * - A lista é a mesma tabela da faixa Hoje ao vivo, com a coluna Data, a
 *   altura da janela e o `Baixar Excel`.
 * - A janela tem altura FIXA, e não a altura da lista (decisão do Mário em
 *   24/09/2026, vista na tela): com a altura da lista e a janela no centro,
 *   trocar de "Cliente ausente" (66 OS) para "Acesso negado ao local" (2 OS)
 *   levava título, atalhos e Fechar uns 260 px para baixo, e o próximo
 *   atalho fugia do mouse. É a mesma regra da janela com abas de Perfis de
 *   Acesso. A lista curta fica com espaço vazio embaixo das linhas, como uma
 *   planilha com poucas linhas.
 * - Aberta ou fechada, e com qual seleção, é estado DESTA janela, e a página
 *   só pede a abertura (`open`). Com o estado na página, o clique redesenhava
 *   todos os gráficos com o ponteiro ainda sobre a barra, e a biblioteca de
 *   gráficos falhava no console ao perder a barra sob o ponteiro (visto no
 *   navegador em 24/09/2026). Assim, abrir, trocar de atalho e fechar não
 *   tocam nos gráficos.
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
  // O contêiner do painel de filtro de coluna chega pelo `ref`, depois da
  // montagem: é estado, e não ref, porque a tabela precisa ser desenhada de
  // novo quando ele passa a existir.
  const [panelContainer, setPanelContainer] = useState<HTMLDivElement | null>(null)

  useImperativeHandle(ref, () => ({ open: setSelection }), [])

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) setSelection(null)
      }}
      open={selection !== null}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/50" />
        <Dialog.Content
          // `os-list-dialog` escopa as superfícies do tema escuro, as mesmas
          // dos painéis executivos, sem redefinir token global.
          className="os-list-dialog fixed inset-0 z-50 flex items-center justify-center p-3 outline-none"
          onEscapeKeyDown={(event) => {
            if ((panelContainer?.childElementCount ?? 0) > 0) event.preventDefault()
          }}
          // O foco entra na JANELA, e não no primeiro botão: é a recomendação
          // para janela de conteúdo longo, o leitor de tela anuncia o título,
          // e o Fechar não abre aceso como se tivesse sido escolhido.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.focus({ preventScroll: true })
            }
          }}
          style={{ pointerEvents: 'none' }}
        >
          {selection === null ? null : (
            <OsListPanel
              {...source}
              onSelect={setSelection}
              panelContainer={panelContainer}
              selection={selection}
            />
          )}
          <div className="pointer-events-auto" ref={setPanelContainer} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <div className="pointer-events-auto flex h-[88vh] w-[1260px] max-w-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_48px_rgba(16,24,40,.22)]">
      <div className="flex-none px-5 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Dialog.Title className="text-[13.5px] font-semibold text-[var(--text-heading)]">
              {title}
            </Dialog.Title>
            {/* Período pelo nome e filtros da página: a janela vai para o
                projetor sem a faixa de filtros atrás dela. No Volume diário
                o período é o dia clicado. */}
            <Dialog.Description className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
              {osListContext({ ...filters, ...range }, coverage, technicianNames)}
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button
              className="flex flex-none cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              type="button"
            >
              <X aria-hidden="true" size={13} />
              Fechar
            </button>
          </Dialog.Close>
        </div>
        {/* "Todas" e as outras barras do mesmo painel, com a cor e a contagem
            delas: trocar de motivo, ou ver o painel inteiro para baixar de
            uma vez, não obriga a fechar a janela e clicar de novo. O formato
            é o do atalho de período da faixa de filtros. */}
        <div aria-label={osListChipsLabel(selection)} className="mt-3 flex flex-wrap gap-1.5" role="group">
          {chips.map((chip) => {
            const key = osListSelectionKey(chip.selection)
            const active = key === selectedKey

            return (
              <button
                aria-pressed={active}
                className={`os-list-chip flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  active
                    ? 'border-transparent bg-[var(--accent-weak)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-disabled)] hover:text-[var(--text-heading)]'
                }`}
                key={key}
                onClick={() => onSelect(chip.selection)}
                type="button"
              >
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
              </button>
            )
          })}
        </div>
      </div>
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
    </div>
  )
}
