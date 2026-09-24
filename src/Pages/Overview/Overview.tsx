import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  Target,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { OS_CHART_ACCENT } from '../../components/charts/chartOptions'
import { ChartCard } from '../../components/dashboard/ChartCard'
import { ExecutiveMetricCard } from '../../components/dashboard/ExecutiveMetricCard'
import {
  buildDeltaFromKpi,
  executiveCardColors,
  type ExecutiveCardDelta,
  type ExecutiveCardTone,
} from '../../components/dashboard/executiveMetricCardModel'
import { PageStickyHeader } from '../../components/layout/PageStickyHeader'
import { OverviewOsProvider } from '../../contexts/OverviewOsContext'
import type { Theme } from '../../contexts/PreferencesContextCore'
import { useOverviewOs } from '../../contexts/useOverviewOs'
import { useReportPageSourceStatus } from '../../contexts/usePageSourceStatus'
import { usePreferences } from '../../contexts/usePreferences'
import { OVERVIEW_OS_ALL, periodIncludesToday } from '../../data/overviewOsFilters'
import { formatDateBr, formatDateTimeBr } from '../../lib/formatters'
import { downloadXlsx } from './downloadFile'
import { OsListDialog, type OsListDialogHandle } from './OsListDialog'
import {
  buildOsWorkbook,
  osExportFileName,
  osExportPeriod,
  osExportSource,
  periodDownloadLabel,
} from './osListExport'
import { buildOsListRows, pageFiltersText, type OsListSelection } from './osListModel'
import {
  DAILY_VOLUME_COINCIDENT_MESSAGE,
  dailySeriesCoincide,
  dailyVolumeFromChartClick,
  dailyVolumeStatusNote,
  dailyVolumeSubtitle,
  makeDailyVolumeOptions,
} from './overviewDailyChartOptions'
import { OverviewFilterPanel } from './OverviewFilterPanel'
import {
  buildOsOutcome,
  buildOverviewKpis,
  buildOverviewReadings,
  periodTitle,
  type OverviewReading,
} from './overviewModel'
import {
  buildOutcomeRows,
  makeOutcomeOptions,
  outcomeChartHeight,
  outcomeFromChartClick,
  outcomeSubtitle,
} from './overviewOutcomeChartOptions'
import { makeRankingOptions, RESOLUTION_EMPTY_MESSAGE } from './overviewRankingChartOptions'
import {
  makeServiceTypeOptions,
  type ServiceTypeHighlight,
} from './overviewServiceTypeChartOptions'
import {
  buildReasonSummary,
  makeReasonsOptions,
  reasonFromChartClick,
  reasonsChartHeight,
  reasonsSubtitle,
} from './overviewReasonsChartOptions'
import { TodayStrip } from './TodayStrip'

/**
 * Visão Geral de OS sobre a fonte real: o serviço de BI quando há endereço
 * configurado, a base local sanitizada caso contrário.
 *
 * O provedor próprio da página é o que isola os registros reais e os sete
 * filtros dependentes deste dashboard: as demais páginas de OS seguem no
 * `DashboardDataProvider`, com a simulação de sempre.
 *
 * Desde 21/09/2026 a página é a que nasceu como "Visão Geral 2", candidata
 * construída em 18/09/2026 a partir da análise da página antiga como gestor
 * em tempo real, e aprovada pelo Mário no lugar dela. Três perguntas, de
 * cima para baixo:
 *
 * 1. Hoje ao vivo: a agenda do dia por situação, lida do serviço a cada
 *    minuto.
 * 2. Resultado do período: os quatro indicadores, com as duas taxas sobre as
 *    OS de cliente, e o destino de cada OS do período numa barra por grupo.
 *    Por padrão o período para em ONTEM (decisão de 22/09/2026): hoje é da
 *    faixa, e dentro dos cards ele derrubava as taxas de manhã. Quem inclui
 *    hoje no filtro vê o aviso na faixa de título.
 * 3. Composição do período: os seis painéis de sempre.
 *
 * Desde 24/09/2026 o número vira lista (estudo com o Mário no mesmo dia): o
 * clique numa fatia do Destino das OS, numa barra dos Motivos de
 * improdutiva ou num dia do Volume diário abre, no centro da tela, as OS
 * daquele pedaço, com filtro por
 * coluna e planilha para baixar; e o título "Resultado do período" oferece a
 * planilha de todas as OS do recorte, para o relatório do mês ou da semana.
 */
export function Overview() {
  return (
    <OverviewOsProvider>
      <OverviewBody />
    </OverviewOsProvider>
  )
}

/**
 * Painel de estado da página, com a mesma superfície dos demais blocos.
 *
 * Existe porque a fonte deixou de estar sempre pronta: quando o portal está
 * ligado à API, há um instante de carregamento e pode haver falha. Nenhum
 * indicador é desenhado nesses dois estados, de propósito.
 */
function OverviewStatePanel({ children, title }: { children: string; title: string }) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-10 text-center">
      <h2 className="text-[14px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{children}</p>
    </section>
  )
}

function OverviewBody() {
  const { status, errorMessage, updatedAt } = useOverviewOs()

  // O selo do cabeçalho acompanha a fonte: sem isso ele afirmava "Atualizado"
  // com a página inteira mostrando que o serviço não respondeu e, ligado à
  // API, mostrava a data da base local em vez da última alteração no banco.
  useReportPageSourceStatus(
    status === 'loading' ? 'loading' : status === 'error' ? 'unavailable' : 'ready',
    updatedAt === null ? null : formatDateBr(updatedAt),
  )

  if (status === 'loading') {
    return (
      <OverviewStatePanel title="Carregando as ordens de serviço">
        Buscando os dados no serviço de BI.
      </OverviewStatePanel>
    )
  }

  // Falha não cai na base local: um número de estudo apresentado como número do
  // banco seria pior do que a ausência do indicador.
  if (status === 'error') {
    return (
      <OverviewStatePanel title="Não foi possível carregar a Visão Geral">
        {errorMessage ?? 'O serviço de BI não respondeu.'}
      </OverviewStatePanel>
    )
  }

  return (
    <>
      {/* O painel de filtros é a faixa de comando da página: preso ao topo do
          `main`, visualmente contínuo ao cabeçalho, permanece visível durante
          toda a rolagem vertical. A faixa pertence à página, então as demais
          páginas de OS seguem sem ela e sem espaço reservado. */}
      <PageStickyHeader className="mb-3.5">
        <OverviewFilterPanel />
      </PageStickyHeader>
      <OverviewContent />
    </>
  )
}

/**
 * Título de faixa da página. É o que separa as perguntas (resultado do
 * período, composição) sem virar um card: um rótulo curto em caixa alta e
 * uma frase dizendo o que a faixa responde.
 */
function SectionHeading({
  action,
  description,
  title,
}: {
  /** Ação da faixa, encostada à direita, como o `Baixar` do resultado. */
  action?: ReactNode
  description: ReactNode
  title: string
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0.5">
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {title}
      </h2>
      <span className="text-[11.5px] text-[var(--text-secondary)]">{description}</span>
      {action === undefined ? null : <span className="ml-auto self-center">{action}</span>}
    </div>
  )
}

function OverviewContent() {
  const { theme } = usePreferences()
  const {
    coverage,
    data,
    filteredRecords,
    filters,
    generatedAt,
    origin,
    records,
    technicians,
    updatedAt,
  } = useOverviewOs()
  const { charts } = data
  // A janela de OS guarda a própria seleção; a página só pede para abrir.
  // Com o estado aqui, o clique redesenhava todos os gráficos com o ponteiro
  // ainda sobre a barra (ver `OsListDialog`).
  const listDialog = useRef<OsListDialogHandle>(null)
  const openList = (selection: OsListSelection) => listDialog.current?.open(selection)
  // Lista e planilha só com o portal ligado ao serviço, como a faixa Hoje ao
  // vivo. A base local de estudo tem código de OS e técnico anônimos e não
  // tem turno nem motivo: a lista diria "Sem turno" e "Técnico sem nome" em
  // toda linha, como se o SGI não tivesse o dado (revisão de dados de
  // 24/09/2026).
  const listsAvailable = origin === 'api'
  const technicianNames = new Map(technicians.map((technician) => [technician.id, technician.name]))
  // Os indicadores e o destino saem dos mesmos registros do provedor; só a
  // regra muda (taxas sobre OS de cliente), e ela mora em `overviewModel`.
  const kpis = buildOverviewKpis(records, filters, coverage)
  const outcome = buildOsOutcome(filteredRecords)
  // A leitura gerencial de cada card é calculada sobre o MESMO recorte dos
  // indicadores: os números que ela escreve são os que o card mostra.
  const readings = buildOverviewReadings(filteredRecords, kpis, filters)

  /**
   * Um re-render único quando as fontes da página terminam de carregar.
   *
   * O ECharts mede os rótulos dos eixos no PRIMEIRO layout, com a fonte que o
   * navegador tiver naquele instante, e não refaz a medida sozinho quando a
   * IBM Plex chega. Num repaint posterior o texto sai mais largo do que a
   * faixa reservada e é amputado à esquerda. O estado não guarda dado nenhum:
   * ele só remonta as opções dos gráficos com as métricas definitivas. A
   * atualização é assíncrona por natureza, então a regra `set-state-in-effect`
   * do lint continua respeitada.
   */
  const [, setFontsReady] = useState(false)
  useEffect(() => {
    let active = true
    void document.fonts.ready.then(() => {
      if (active) setFontsReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  // Status escolhido no filtro: o painel diário explica o desenho daquele
  // recorte, e os motivos dizem quando o filtro tirou as improdutivas.
  const selectedStatus = filters.status === OVERVIEW_OS_ALL.status ? null : filters.status

  // Mesmo recurso na composição por tipo: a fatia do tipo escolhido fica em
  // destaque e as demais permanecem como referência comparativa.
  const selectedServiceType =
    filters.serviceType === OVERVIEW_OS_ALL.serviceType ? null : filters.serviceType

  // E nos dois rankings com filtro próprio: a barra da categoria ou da cidade
  // escolhida fica em destaque entre as demais, nunca sozinha.
  const selectedCategory =
    filters.category === OVERVIEW_OS_ALL.category ? null : filters.category
  const selectedCity = filters.city === OVERVIEW_OS_ALL.city ? null : filters.city

  /**
   * Destaque da rosca de tipos. Tipo selecionado destaca a própria fatia; sem
   * tipo, uma categoria selecionada destaca o tipo que a contém, procurado nas
   * fatias do contexto (que ignoram os dois filtros, então a categoria sempre
   * está lá).
   */
  let serviceTypeHighlight: ServiceTypeHighlight | null = null
  if (selectedServiceType !== null) {
    serviceTypeHighlight = { kind: 'service-type', serviceType: selectedServiceType }
  } else if (selectedCategory !== null) {
    serviceTypeHighlight = {
      kind: 'category',
      category: selectedCategory,
      serviceTypes: charts.serviceTypeSlices
        .filter((slice) => slice.categories.some(([name]) => name === selectedCategory))
        .map((slice) => slice.name),
    }
  }

  /**
   * Subtítulo do ranking de categorias. Com a categoria selecionada fora do
   * Top 10 do contexto, ela é desenhada como última barra e o subtítulo diz a
   * posição real, para a barra do fim não ser lida como a 11ª maior.
   */
  const categorySubtitle =
    charts.selectedCategoryRank !== null && charts.selectedCategoryRank > 10
      ? `Onde a operação mais atua · Top 10 · categoria selecionada: ${charts.selectedCategoryRank}ª do recorte`
      : 'Onde a operação mais atua · Top 10'

  /**
   * Motivos das improdutivas do recorte, com TODOS os filtros: é o "por quê"
   * do que o Destino e o card de Improdutividade contam. A base inclui a
   * infraestrutura de propósito (ver `overviewReasonsChartOptions`).
   */
  const reasons = buildReasonSummary(filteredRecords)

  /**
   * Altura da primeira linha de gráficos de composição, derivada UMA vez e
   * repassada aos dois painéis: os motivos crescem a partir da nona barra, e o
   * volume diário acompanha.
   */
  const firstRowHeight = reasonsChartHeight(reasons.rows.length)

  /** Altura da segunda linha: todas as cidades (até doze) e a rosca juntas. */
  const SECOND_ROW_HEIGHT = 280

  /**
   * Com `Status: Concluída` toda OS do recorte é concluída: Total e Concluídas
   * coincidem no painel diário e a nota explica a sobreposição; com outro
   * status filtrado, a nota explica o desenho degenerado daquele recorte.
   */
  const dailyCoincide = dailySeriesCoincide(
    charts.overviewDay.total,
    charts.overviewDay.completed,
  )
  // A nota do recorte, e depois o convite ao clique, que abre as OS do dia.
  const dailySubtitle = dailyVolumeSubtitle(
    selectedStatus !== null
      ? dailyVolumeStatusNote(selectedStatus)
      : dailyCoincide
        ? DAILY_VOLUME_COINCIDENT_MESSAGE
        : undefined,
    listsAvailable,
    charts.overviewDay.iso.length,
  )

  const customerRates = kpis.rateBase === 'customer'
  // "vs. agosto até o dia 21" no lugar de "vs. período anterior"; sem
  // comparação disponível o card já diz o motivo, e o texto não é usado.
  const comparison = kpis.comparison ?? undefined

  // O título da faixa NOMEIA o período ("Setembro de 2026, até o dia 21"):
  // o bloco vai para o projetor sem a faixa de filtros. Desde 23/09/2026 o
  // nome vem em DESTAQUE, a pedido do Mário, no MESMO formato do atalho de
  // período aceso na faixa: pílula no azul claro (verde no tema escuro). Ela
  // repete o atalho escolhido, por extenso, e é isso que liga os dois
  // lugares no olho de quem lê. O período padrão para em ontem; com
  // hoje dentro do recorte, os números abaixo ainda mudam até a noite, e o
  // aviso fica fora da etiqueta, no tom secundário de sempre.
  const resultDescription = (
    <>
      <span className="os-period-title rounded-full border border-transparent bg-[var(--accent-weak)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--accent)]">
        {periodTitle(filters)}
      </span>
      {periodIncludesToday(filters) ? ' · inclui hoje, ainda em andamento' : null}
    </>
  )

  /**
   * Planilha de TODAS as OS do recorte, para o relatório do mês ou da semana
   * (decisão do Mário em 24/09/2026: baixar "para quando o gestor quiser").
   * Fica no título do resultado porque é o recorte que ele nomeia: o que a
   * faixa de filtros escolheu, com todos os filtros. A planilha é montada só
   * no clique, e não a cada desenho da página.
   */
  const downloadPeriod = () => {
    const bytes = buildOsWorkbook(buildOsListRows(filteredRecords, technicianNames), {
      selection: 'Todas as OS do período',
      period: osExportPeriod(filters),
      pageFilters: pageFiltersText(filters, coverage, technicianNames),
      source: osExportSource(origin, updatedAt),
      readAt: generatedAt,
      generatedAt: formatDateTimeBr(new Date()),
    })
    downloadXlsx(bytes, osExportFileName(null, filters))
  }
  // Recorte vazio não oferece planilha: seria um arquivo só com o cabeçalho.
  const periodDownload =
    !listsAvailable || filteredRecords.length === 0 ? undefined : (
      <button
        // `os-period-download`: no tema escuro o texto e o anel de foco
        // trocam para o verde das demais ações de texto da página, pelo
        // mesmo motivo de contraste.
        className="os-period-download flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onClick={downloadPeriod}
        title="Baixa todas as OS do período, com os filtros da página, numa planilha do Excel pronta para tabela dinâmica"
        type="button"
      >
        <Download aria-hidden="true" size={13} />
        {periodDownloadLabel(filteredRecords.length)}
      </button>
    )

  const outcomeRows = buildOutcomeRows(outcome)

  /**
   * Os quatro indicadores, na ordem, com os nomes e as cores já aprovados.
   * A linha de detalhe de cada card mostra os números que sustentam o valor,
   * para a infraestrutura nunca ficar escondida atrás de uma taxa que a
   * exclui. A cor é identidade fixa do indicador e não muda com o resultado:
   * a interpretação favorável ou desfavorável mora na comparação.
   *
   * Cada card tem duas faces com papéis distintos (23/09/2026): a frente
   * fecha com a DEFINIÇÃO do indicador, fixa; a leitura gerencial, a um
   * clique, é calculada sobre o recorte em `buildOverviewReadings`, e o
   * OBSERVAR diz onde agir. Antes a mesma frase abria as duas faces.
   */
  const cards: OsExecutiveCard[] = [
    {
      icon: ClipboardList,
      label: 'Total de OS',
      value: kpis.total,
      delta: buildDeltaFromKpi(kpis.totalDelta, 'O total de OS', 'neutro', comparison),
      tone: 'blue',
      detail: kpis.details.total,
      // O período é pela data de AGENDAMENTO, eixo temporal oficial da página
      // (não criação, não conclusão).
      definition: 'OS agendadas para o período, em qualquer status.',
      reading: readings.total,
      observe: 'Total sobe e a taxa não: a agenda cresceu com visita repetida, não com entrega.',
    },
    {
      icon: CheckCircle2,
      label: 'OS Concluídas',
      value: kpis.completed,
      // Comparação NEUTRA desde 23/09/2026 (decisão do Mário): o volume
      // concluído sobe e desce com a agenda, e um mês com menos OS não pode
      // pintar o card de vermelho sem o time ter rendido menos. Bom ou ruim
      // é papel da Taxa de Conclusão.
      delta: buildDeltaFromKpi(kpis.completedDelta, 'O volume de OS concluídas', 'neutro', comparison),
      tone: 'green',
      detail: kpis.details.completed,
      definition: 'OS em que a visita aconteceu e o serviço foi entregue.',
      reading: readings.completed,
      observe: 'O que falta para o Total está no Destino das OS, logo abaixo, saída por saída.',
    },
    {
      icon: Target,
      label: 'Taxa de Conclusão',
      value: kpis.completionRate,
      delta: buildDeltaFromKpi(kpis.completionDelta, 'A taxa de conclusão', 'direcional', comparison),
      tone: 'indigo',
      detail: kpis.details.completionRate,
      definition: customerRates
        ? 'Percentual das OS de cliente do período que foram concluídas.'
        : 'Percentual das OS de infraestrutura do período que foram concluídas.',
      reading: readings.completionRate,
      // OS que termina o dia sem técnico expira à meia-noite (medido em
      // 22/09/2026: 137 de 145 em catorze dias): o atalho "sem técnico" da
      // faixa Hoje ao vivo é o aviso antecipado da não executada.
      observe:
        'A não executada de amanhã é a OS sem técnico de hoje: veja o atalho em Hoje ao vivo.',
    },
    {
      icon: AlertTriangle,
      label: 'Taxa Improdutividade',
      value: kpis.unproductiveRate,
      delta: buildDeltaFromKpi(
        kpis.unproductiveDelta,
        'A taxa de improdutividade',
        'direcional',
        comparison,
      ),
      // Vermelho semântico do portal, o MESMO do status `Improdutiva` nos
      // gráficos de OS. É identidade do indicador, e não julgamento do número.
      tone: 'red',
      detail: kpis.details.unproductiveRate,
      definition: customerRates
        ? 'Percentual das OS de cliente em que o técnico foi e não conseguiu executar.'
        : 'Percentual das OS de infraestrutura em que o técnico foi e não conseguiu executar.',
      reading: readings.unproductiveRate,
      observe: 'Filtre por tipo e por equipe: a taxa não é a mesma em todas as frentes.',
    },
  ]

  return (
    <div>
      <TodayStrip />
      <SectionHeading
        action={periodDownload}
        description={resultDescription}
        title="Resultado do período"
      />
      <OsExecutiveCards cards={cards} theme={theme} />
      <ChartCard
        className="os-outcome mb-4"
        subtitle={outcomeSubtitle(outcome, listsAvailable)}
        title="Destino das OS do período"
        variant="executive"
      >
        {/* Uma barra de 100% por grupo: é a resposta visual de "está bom ou
            ruim" que a lista de status não dá, e é onde a infraestrutura
            aparece com o próprio ciclo, fora das taxas dos cards. Cada fatia
            abre a janela com as OS daquela saída, naquele grupo. */}
        <Chart
          height={outcomeChartHeight(outcomeRows.length)}
          onEvents={
            listsAvailable
              ? {
                  click: (params) => {
                    const hit = outcomeFromChartClick(outcome, params)
                    if (hit !== null) openList({ kind: 'outcome', ...hit })
                  },
                }
              : undefined
          }
          option={makeOutcomeOptions(outcome, theme)}
        />
      </ChartCard>
      <SectionHeading
        description="Volume diário, motivos de improdutiva, tipos, cidades, categorias e resoluções do recorte"
        title="Composição do período"
      />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        {/* `os-daily-volume` escopa a superfície escura deste painel, para ele
            acompanhar os cards executivos acima. */}
        <ChartCard
          className="os-daily-volume"
          subtitle={dailySubtitle}
          title="Volume diário de OS"
          variant="executive"
        >
          {/* O painel mostra o período filtrado INTEIRO, dia a dia. As três
              séries são quantidade de OS no mesmo eixo: Total e Concluídas em
              barra, Improdutivas em linha. A barra, ou o nome do dia, abre a
              janela com as OS daquele dia. */}
          <Chart
            height={firstRowHeight}
            onEvents={
              listsAvailable
                ? {
                    click: (params) => {
                      const hit = dailyVolumeFromChartClick(charts.overviewDay, params)
                      if (hit !== null) openList({ kind: 'day', ...hit })
                    },
                  }
                : undefined
            }
            option={makeDailyVolumeOptions(
              charts.overviewDay.x,
              charts.overviewDay.iso,
              charts.overviewDay.total,
              charts.overviewDay.completed,
              charts.overviewDay.unproductive,
              theme,
            )}
          />
        </ChartCard>
        {/* No lugar de "Distribuição por status" desde 23/09/2026: aquele
            painel repetia os números do Destino em outro corte. Este diz por
            que a visita falhou. Barras vermelhas são motivo real; as cinza,
            no fim, são a improdutiva sem motivo que o portal consiga ler.
            Cada barra abre a janela com as OS daquele motivo. */}
        <ChartCard
          className="os-unproductive-reasons"
          subtitle={reasonsSubtitle(reasons, listsAvailable)}
          title="Motivos de improdutiva"
          variant="executive"
        >
          <Chart
            height={firstRowHeight}
            onEvents={
              listsAvailable
                ? {
                    click: (params) => {
                      const reason = reasonFromChartClick(reasons, params)
                      if (reason !== null) openList({ kind: 'reason', reason })
                    },
                  }
                : undefined
            }
            option={makeReasonsOptions(reasons, theme, selectedStatus !== null)}
          />
        </ChartCard>
      </div>
      {/* Segunda linha: a composição do recorte por tipo e por cidade. */}
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard
          className="os-mix os-service-type-mix"
          subtitle="Tipos no contexto dos demais filtros · passe o mouse para ver as categorias"
          title="Composição por tipo de OS"
          variant="executive"
        >
          {/* Uma fatia por tipo; o tooltip lista o ranking das categorias que
              compõem a fatia. O painel ignora os filtros Tipo de OS e
              Categoria: selecionar um tipo destaca a fatia dele. */}
          <Chart
            height={SECOND_ROW_HEIGHT}
            option={makeServiceTypeOptions(
              charts.serviceTypeSlices,
              theme,
              serviceTypeHighlight,
            )}
          />
        </ChartCard>
        <ChartCard
          className="os-ranking os-city-volume"
          subtitle="Todas as cidades no contexto dos demais filtros"
          title="Volume por cidade"
          variant="executive"
        >
          {/* Ranking horizontal com TODAS as cidades do contexto; ignora só o
              filtro Cidade, e a cidade escolhida vira destaque. */}
          <Chart
            height={SECOND_ROW_HEIGHT}
            option={makeRankingOptions({
              color: OS_CHART_ACCENT,
              items: charts.cityPairs,
              name: 'Volume por cidade',
              selected: selectedCity === null ? null : { noun: 'cidade', value: selectedCity },
              theme,
            })}
          />
        </ChartCard>
      </div>
      {/* Os dois rankings compartilham o mesmo gerador: são a mesma leitura,
          uma contagem ordenada por item, e só mudam a coleção e a cor. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard
          className="os-ranking os-category-volume"
          subtitle={categorySubtitle}
          title="Volume por categoria"
          variant="executive"
        >
          {/* Só as 10 categorias mais frequentes do contexto cabem legíveis;
              a categoria escolhida é garantida no desenho mesmo fora do Top 10. */}
          <Chart
            height={250}
            option={makeRankingOptions({
              color: executiveCardColors.blue,
              items: charts.categoryTopPairs,
              name: 'Volume por categoria',
              selected:
                selectedCategory === null
                  ? null
                  : { noun: 'categoria', value: selectedCategory },
              theme,
            })}
          />
        </ChartCard>
        <ChartCard
          className="os-ranking os-resolution-ranking"
          subtitle="Desfecho das OS concluídas · Top 10"
          title="Resoluções mais frequentes"
          variant="executive"
        >
          {/* O verde é o mesmo do card `OS Concluídas`: este ranking abre
              justamente o desfecho dessas OS. Resolução só existe em OS
              Concluída, e a mensagem de vazio diz isso. */}
          <Chart
            height={250}
            option={makeRankingOptions({
              color: executiveCardColors.green,
              emptyMessage: RESOLUTION_EMPTY_MESSAGE,
              items: charts.resolutionTopPairs,
              name: 'Resoluções mais frequentes',
              theme,
            })}
          />
        </ChartCard>
      </div>
      {/* Mesmos registros dos painéis, com todos os filtros: o número da
          janela fecha com o da barra clicada. */}
      <OsListDialog
        coverage={coverage}
        filters={filters}
        origin={origin}
        readAt={generatedAt}
        records={filteredRecords}
        ref={listDialog}
        technicianNames={technicianNames}
        updatedAt={updatedAt}
      />
    </div>
  )
}

/** Um card da coleção executiva de OS: valor, comparação, detalhe, definição e leitura. */
type OsExecutiveCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly tone: ExecutiveCardTone
  readonly value: string
  readonly delta: ExecutiveCardDelta
  /** Linha logo abaixo da comparação, com os números que sustentam o valor. */
  readonly detail: string
  /** O que o número conta, fixo, na base da frente do card. */
  readonly definition: string
  /** Título e explicação da leitura gerencial, calculados sobre o recorte. */
  readonly reading: OverviewReading
  readonly observe: string
}

function OsExecutiveCards({ cards, theme }: { cards: OsExecutiveCard[]; theme: Theme }) {
  // Um único identificador controla a coleção inteira: abrir um card fecha
  // automaticamente o anterior e nunca existem duas leituras abertas.
  const [openCard, setOpenCard] = useState<string | null>(null)
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (openCard === null) return
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node) !== true) {
        setOpenCard(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openCard])

  return (
    <section
      aria-label="Indicadores executivos das ordens de serviço"
      // `os-executive-cards` escopa os ajustes de tema escuro a esta coleção.
      // Quatro colunas entram no `lg`: os quatro indicadores dividem a mesma
      // linha; antes disso a grade segura dois por linha.
      className="os-executive-cards mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
      ref={containerRef}
    >
      {cards.map((card) => (
        <ExecutiveMetricCard
          // Só o valor: a comparação tem a própria leitura acessível dentro do
          // card, e repeti-la aqui faria o percentual ser anunciado duas vezes.
          accessibleText={`${card.label}: ${card.value}.`}
          // A definição do indicador fica presa à base do card; a leitura
          // do recorte e o que observar continuam a um clique.
          definition={card.definition}
          delta={card.delta}
          detail={card.detail}
          icon={card.icon}
          key={card.label}
          label={card.label}
          observe={card.observe}
          onToggle={() =>
            setOpenCard((current) => (current === card.label ? null : card.label))
          }
          open={openCard === card.label}
          readingText={card.reading.text}
          readingTitle={card.reading.title}
          theme={theme}
          tone={card.tone}
          value={card.value}
          variant="spark"
        />
      ))}
    </section>
  )
}
