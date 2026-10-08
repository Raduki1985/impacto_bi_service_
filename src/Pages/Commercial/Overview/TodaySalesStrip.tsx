import { useState, type ReactNode } from 'react'

import { OS_CHART_ACCENT } from '../../../components/charts/chartOptions'
import { LiveBox, LiveNote, LiveStrip } from '../../../components/dashboard/LiveStrip'
import { PageSkeleton } from '../../../components/dashboard/PageSkeleton'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { isBiApiConfigured } from '../../../data/api/biApiClient'
import { todayISO } from '../../../data/defaultPeriod'
import { downloadXlsx } from '../../../lib/downloadFile'
import { useMoneyShown } from './moneyVisibility'
import { formatDateBr, formatDateTimeBr, formatIsoClock } from '../../../lib/formatters'
import { cohortPalette } from './overviewCohortChartOptions'
import type { CommercialOverviewFilters } from './overviewModel'
import { TodaySalesBoxesSkeleton } from './OverviewSkeleton'
import { awaitingColors, saleStatusColor } from './overviewStageColors'
import {
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
  type TodaySalesSelection,
} from './todaySalesModel'
import {
  buildTodaySalesWorkbook,
  describeTodaySalesListFilters,
  todaySalesExportFileName,
  todaySalesPageFilters,
  type SalesFilterNames,
} from './todaySalesExport'
import { TodaySalesTable } from './TodaySalesTable'
import type { TodaySalesTableFilters } from './todaySalesTableModel'
import { useTodaySales, useTodaySalesBox } from './useTodaySales'

/**
 * Faixa "Hoje ao vivo" da Visão Geral Comercial: a esteira das vendas
 * (25/09/2026, desenhada com o Mário a partir do fluxo da venda e de quem
 * age em cada etapa; regra no serviço desde 01/10/2026, texto em
 * `todaySalesModel`).
 *
 * Fica acima dos cards do período porque é a primeira pergunta do gerente e
 * da diretoria ao abrir a página: o que entrou hoje, onde a venda está
 * parada e o que ativou hoje. Lê do serviço a cada minuto só as
 * contagens das caixas; os contratos de uma caixa vêm quando a lista abre. O
 * restante da página continua parado no recorte escolhido.
 *
 * Cinco caixas numa fileira, da esquerda para a direita na ordem do
 * fluxo. Cada caixa ABRE a lista dos contratos embaixo; nas três da esteira,
 * o canto "N fora do prazo" abre só os que passaram do prazo da etapa.
 *
 * Com a base sintética não existe "hoje": a faixa diz isso e não desenha
 * número nenhum. A moldura e a caixa são as do portal (`LiveStrip`).
 */

/**
 * Cor de cada caixa, a MESMA que a situação já tem no resto da página: o
 * azul de dados na entrada (o da "Agenda do dia" na faixa de OS), os degraus
 * de âmbar das etapas da fila de ativação na esteira e o verde de
 * "ativou no mês" da Evolução mensal das vendas nas Ativadas. É identidade,
 * não julgamento, e a cor nunca está sozinha: cada caixa traz o nome e a
 * contagem.
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
  names,
  theme,
}: {
  filters: CommercialOverviewFilters
  /** Nomes de cidade e vendedor dos catálogos da página, para escrever os filtros na planilha. */
  names: SalesFilterNames
  theme: Theme
}) {
  const today = todayISO()
  // Os filtros da página valem, menos o período: a faixa é sempre de hoje.
  // O serviço os aplica e manda só as contagens.
  const live = useTodaySales(isBiApiConfigured, today, filters)
  const summary = buildTodaySalesSummary(live.counts?.boxes ?? [])
  const queueFrom = live.counts?.queueFrom ?? null
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
    selected === null || summary.empty
      ? null
      : selected.late && lateOf(selected.box) === 0
        ? { ...selected, late: false }
        : selected
  const toggleBox = (box: TodaySalesBoxKey) =>
    setSelected((current) => (current !== null && current.box === box && !current.late ? null : { box, late: false }))

  // Os contratos da lista aberta, pedidos ao serviço só agora e relidos a
  // cada leitura nova das contagens.
  const boxList = useTodaySalesBox(isBiApiConfigured, today, open, filters, live.generatedAt)
  // Buscando, a lista aparece em cinza sob os nomes das colunas e o título
  // não diz "0" antes da hora (08/10/2026); o aviso de lista vazia fica para
  // a falha e para a caixa que não tem nada.
  const listLoadingMessage = boxList.status === 'loading' ? 'Buscando os contratos no serviço de BI.' : undefined
  const listEmptyMessage =
    boxList.status === 'error'
      ? (boxList.errorMessage ?? 'Não foi possível ler os contratos desta caixa.')
      : undefined

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
      queueFrom,
      deadlineDays: summary.boxes.find((box) => box.key === selection.box)?.deadlineDays ?? null,
      pageFilters: todaySalesPageFilters(filters, names),
      listFilters: describeTodaySalesListFilters(tableFilters),
      readAt: boxList.generatedAt ?? live.generatedAt,
      generatedAt: formatDateTimeBr(new Date()),
    }, moneyShown)
    downloadXlsx(bytes, todaySalesExportFileName(selection, today))
  }

  // A linha de apoio segue a da faixa de OS ("Agenda de 08/10/2026 · leitura
  // do serviço às 17h22 · atualiza a cada minuto · clique numa caixa..."), a
  // pedido do Mário em 08/10/2026. A data de início da esteira saiu da tela e
  // continua na aba Filtros da planilha.
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
      isQueueBoxKey(box.key) && box.late !== null && box.deadlineDays !== null
        ? lateCornerLabel(box.key, box.late, box.deadlineDays)
        : null

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

  let body: ReactNode
  if (!isBiApiConfigured) {
    body = (
      <LiveNote>
        Disponível com o portal ligado ao serviço de BI. A base sintética não tem o dia de hoje.
      </LiveNote>
    )
  } else if (live.status === 'loading' || live.status === 'idle') {
    // Buscando, as caixas aparecem em cinza no lugar (08/10/2026); a frase vai
    // só para o leitor de tela.
    body = (
      <PageSkeleton label="Buscando as vendas de hoje e a esteira no serviço de BI.">
        <TodaySalesBoxesSkeleton />
      </PageSkeleton>
    )
  } else if (live.status === 'error' && live.counts === null) {
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
        {/* As cinco caixas numa fileira só, no estilo da faixa de OS, sem
            título de grupo. Os títulos "Entrou hoje", "Na esteira" e "Virou
            cliente hoje" saíram em 08/10/2026; as caixas ficaram. */}
        <ul
          aria-label="Vendas de hoje, esteira e ativações por situação"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          {summary.boxes.map(renderBox)}
        </ul>
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
            emptyMessage={listEmptyMessage}
            loadingMessage={listLoadingMessage}
            rows={buildTodaySalesRows(boxList.records, today)}
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
