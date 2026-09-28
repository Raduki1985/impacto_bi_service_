import { useState, type ReactNode } from 'react'

import { OS_CHART_ACCENT } from '../../../components/charts/chartOptions'
import { LiveBox, LiveNote, LiveStrip } from '../../../components/dashboard/LiveStrip'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { isBiApiConfigured } from '../../../data/api/biApiClient'
import { todayISO } from '../../../data/defaultPeriod'
import { downloadXlsx } from '../../../lib/downloadFile'
import { useMoneyShown } from './moneyVisibility'
import { formatDateBr, formatDateTimeBr, formatIsoClock } from '../../../lib/formatters'
import { cohortPalette } from './overviewCohortChartOptions'
import type { CommercialOverviewFilters } from './overviewModel'
import { awaitingColors, saleStatusColor } from './overviewStageColors'
import {
  applyTodaySalesFilters,
  buildTodaySalesRows,
  buildTodaySalesSummary,
  hasTodaySalesFilters,
  isQueueBoxKey,
  lateCornerLabel,
  todaySalesListLabel,
  todaySalesSelectionKey,
  type TodaySaleRow,
  type TodaySalesBox,
  type TodaySalesBoxKey,
  type TodaySalesGroup,
  type TodaySalesSelection,
} from './todaySalesModel'
import {
  buildTodaySalesWorkbook,
  describeTodaySalesListFilters,
  todaySalesExportFileName,
  todaySalesPageFilters,
} from './todaySalesExport'
import { TodaySalesTable } from './TodaySalesTable'
import type { TodaySalesTableFilters } from './todaySalesTableModel'
import { useTodaySales } from './useTodaySales'

/**
 * Faixa "Hoje ao vivo" da Visão Geral Comercial: a esteira das vendas
 * (25/09/2026, desenhada com o Mário a partir do fluxo da venda e de quem
 * age em cada etapa; regra em `todaySalesModel`).
 *
 * Fica acima dos cards do período porque é a primeira pergunta do gerente e
 * da diretoria ao abrir a página: o que entrou hoje, onde a venda está
 * parada e o que virou cliente hoje. Lê do serviço a cada minuto; o restante
 * da página continua parado no recorte escolhido.
 *
 * Cinco caixas em três grupos, da esquerda para a direita na ordem do
 * fluxo. Cada caixa ABRE a lista dos contratos embaixo; nas três da esteira,
 * o canto "N fora do prazo" abre só os que passaram do prazo da etapa.
 *
 * Com a base sintética não existe "hoje": a faixa diz isso e não desenha
 * número nenhum. A moldura e a caixa são as do portal (`LiveStrip`).
 */

/**
 * Cor de cada caixa, a MESMA que a situação já tem no resto da página: o
 * azul de dados na entrada (o da "Agenda do dia" na faixa de OS), os degraus
 * de âmbar das etapas do card Aguardando Ativação na esteira e o verde de
 * "ativou no mês" da Safra na saída. É identidade, não julgamento, e a cor
 * nunca está sozinha: cada caixa traz o nome e a contagem.
 */
const BOX_COLORS: Record<'light' | 'dark', Record<TodaySalesBoxKey, string>> = {
  light: {
    sold: OS_CHART_ACCENT,
    pending: awaitingColors.light.pendente,
    signed: awaitingColors.light.assinada,
    scheduled: awaitingColors.light.agendada,
    activated: cohortPalette.light.activatedInMonth,
  },
  dark: {
    sold: OS_CHART_ACCENT,
    pending: awaitingColors.dark.pendente,
    signed: awaitingColors.dark.assinada,
    scheduled: awaitingColors.dark.agendada,
    activated: cohortPalette.dark.activatedInMonth,
  },
}

/** Nome de cada grupo, acima das caixas. */
function groupCaption(group: TodaySalesGroup, queueFrom: string | null): string {
  if (group === 'in') return 'Entrou hoje'
  if (group === 'out') return 'Virou cliente hoje'

  // "Não ativadas", e não "sem sinal", desde 28/09/2026: a esteira segue a
  // situação do SGI, e há venda nela com o sinal já ligado ("Com sinal, falta
  // ativar" no Detalhe).
  return queueFrom === null
    ? 'Na esteira, ainda não ativadas'
    : `Na esteira: vendidas desde ${formatDateBr(queueFrom)}, ainda não ativadas`
}

/** Frase de apoio da lista aberta: o que ela traz e em que ordem. */
function listDescription(selection: TodaySalesSelection): string {
  const columns = 'Cada coluna filtra e ordena só esta lista, e Baixar Excel leva exatamente o que ela mostra.'
  if (selection.box === 'sold') {
    return `${columns} A venda mais recente primeiro; Detalhe traz o que falta ou a hora do sinal.`
  }
  if (selection.box === 'activated') {
    return `${columns} O sinal mais recente primeiro; Venda diz de que dia é a venda.`
  }

  return `${columns} A venda mais antiga primeiro; Detalhe traz há quanto tempo a etapa espera ou o que houve na última visita, em cor de atenção quando passou do prazo.`
}

/** Um único destino para a lista, que é também o alvo do `aria-controls`. */
const LIST_ID = 'commercial-today-list'

export function TodaySalesStrip({
  filters,
  theme,
}: {
  filters: CommercialOverviewFilters
  theme: Theme
}) {
  const today = todayISO()
  const live = useTodaySales(isBiApiConfigured, today)
  // Os filtros da página valem, menos o período: a faixa é sempre de hoje.
  const records = applyTodaySalesFilters(live.records, filters)
  const summary = buildTodaySalesSummary(records, today)
  const filtered = hasTodaySalesFilters(filters)
  const clock = formatIsoClock(live.generatedAt)
  const themeKey = theme === 'dark' ? 'dark' : 'light'
  const colors = BOX_COLORS[themeKey]

  // Lista aberta. Derivada no render, e não corrigida num efeito: trocar um
  // filtro pode zerar o "fora do prazo" de uma caixa, e a lista de um atalho
  // que não existe mais volta sozinha para a lista da caixa.
  const [selected, setSelected] = useState<TodaySalesSelection | null>(null)
  const lateOf = (key: TodaySalesBoxKey) => summary.boxes.find((box) => box.key === key)?.late ?? 0
  const open =
    selected === null ? null : selected.late && lateOf(selected.box) === 0 ? { ...selected, late: false } : selected
  const toggleBox = (box: TodaySalesBoxKey) =>
    setSelected((current) => (current !== null && current.box === box && !current.late ? null : { box, late: false }))

  // A planilha da lista aberta, no molde da de OS: as linhas visíveis, e a
  // aba Filtros com a caixa, o dia, os filtros e a hora da leitura, porque o
  // arquivo circula sem a tela.
  const moneyShown = useMoneyShown()
  const downloadList = (
    selection: TodaySalesSelection,
    visible: readonly TodaySaleRow[],
    tableFilters: TodaySalesTableFilters,
  ) => {
    const bytes = buildTodaySalesWorkbook(visible, {
      selection,
      today,
      queueFrom: live.queueFrom,
      pageFilters: todaySalesPageFilters(filters, live.records),
      listFilters: describeTodaySalesListFilters(tableFilters),
      readAt: live.generatedAt,
      generatedAt: formatDateTimeBr(new Date()),
    }, moneyShown)
    downloadXlsx(bytes, todaySalesExportFileName(selection, today))
  }

  const subtitleParts = [`Vendas de ${formatDateBr(today)}`]
  if (clock !== null) subtitleParts.push(`leitura do serviço às ${clock}`)
  if (isBiApiConfigured) subtitleParts.push('atualiza a cada minuto')
  if (filtered) subtitleParts.push('com os filtros da página, exceto período')
  // A caixa não parece clicável por si só, então a faixa avisa. Só quando há
  // o que abrir: com tudo vazio a dica seria promessa falsa.
  if (isBiApiConfigured && live.status !== 'loading' && !summary.empty) {
    subtitleParts.push('clique numa caixa para ver os contratos')
  }
  if (live.status === 'error' && live.generatedAt !== null) {
    subtitleParts.push('o serviço não respondeu na última tentativa')
  }

  const renderBox = (box: TodaySalesBox): ReactNode => {
    const corner =
      isQueueBoxKey(box.key) && box.late !== null ? lateCornerLabel(box.key, box.late) : null

    return (
      <LiveBox
        color={colors[box.key]}
        controls={LIST_ID}
        corner={corner === null ? null : { ...corner, onClick: () => setSelected({ box: box.key, late: true }) }}
        key={box.key}
        label={
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 flex-none rounded-full"
              style={{ background: colors[box.key] }}
            />
            {box.label}
          </span>
        }
        onToggle={() => toggleBox(box.key)}
        open={open !== null && open.box === box.key}
        value={box.count}
      >
        {box.detail}
      </LiveBox>
    )
  }

  const renderGroup = (group: TodaySalesGroup): ReactNode => {
    const boxes = summary.boxes.filter((box) => box.group === group)

    return (
      <div className="flex min-w-0 flex-col" key={group}>
        <p className="mb-1.5 truncate text-[11px] font-semibold text-[var(--text-secondary)]">
          {groupCaption(group, live.queueFrom)}
        </p>
        <ul
          aria-label={groupCaption(group, live.queueFrom)}
          className={`grid flex-1 gap-3 ${group === 'queue' ? 'sm:grid-cols-3' : ''}`}
        >
          {boxes.map(renderBox)}
        </ul>
      </div>
    )
  }

  let body: ReactNode
  if (!isBiApiConfigured) {
    body = (
      <LiveNote>
        Disponível com o portal ligado ao serviço de BI. A base sintética não tem o dia de hoje.
      </LiveNote>
    )
  } else if (live.status === 'loading') {
    body = <LiveNote>Buscando as vendas de hoje e a esteira no serviço de BI.</LiveNote>
  } else if (live.status === 'error' && live.generatedAt === null) {
    body = <LiveNote>{live.errorMessage ?? 'Não foi possível ler as vendas de hoje.'}</LiveNote>
  } else if (summary.empty) {
    body = (
      <LiveNote>
        Nenhuma venda hoje e nenhuma venda na esteira{filtered ? ' com os filtros da página' : ''}.
      </LiveNote>
    )
  } else {
    body = (
      <>
        {/* Três grupos na proporção das caixas (1, 3 e 1), para as cinco
            terem a mesma largura; em tela estreita os grupos empilham. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_3fr_1fr]">
          {(['in', 'queue', 'out'] as const).map(renderGroup)}
        </div>
        {open !== null ? (
          <TodaySalesTable
            // A cor da situação, a mesma da caixa que conta o contrato.
            colorOf={(row) => saleStatusColor(row.source, theme)}
            description={listDescription(open)}
            id={LIST_ID}
            // A lista aberta é a identidade da tabela: trocar de caixa, ou
            // abrir pelo atalho, monta outra, com os filtros de coluna
            // zerados, como na faixa de OS.
            key={todaySalesSelectionKey(open)}
            label={todaySalesListLabel(open)}
            onClose={() => setSelected(null)}
            onDownload={(visible, tableFilters) => downloadList(open, visible, tableFilters)}
            // Restaurar, na lista do atalho, volta à lista da caixa inteira.
            onRestore={open.late ? () => setSelected({ box: open.box, late: false }) : undefined}
            rows={buildTodaySalesRows(records, open, today)}
          />
        ) : null}
      </>
    )
  }

  return (
    <LiveStrip ariaLabel="Hoje ao vivo" live={isBiApiConfigured} subtitle={subtitleParts.join(' · ')}>
      {body}
    </LiveStrip>
  )
}
