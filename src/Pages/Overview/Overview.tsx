import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, Target, type LucideIcon } from 'lucide-react'

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
import { OVERVIEW_OS_ALL } from '../../data/overviewOsFilters'
import {
  DAILY_VOLUME_COINCIDENT_MESSAGE,
  dailySeriesCoincide,
  dailyVolumeStatusNote,
  makeDailyVolumeOptions,
} from './overviewDailyChartOptions'
import { makeRankingOptions, RESOLUTION_EMPTY_MESSAGE } from './overviewRankingChartOptions'
import {
  makeServiceTypeOptions,
  type ServiceTypeHighlight,
} from './overviewServiceTypeChartOptions'
import {
  makeStatusDistributionOptions,
  statusDistributionHeight,
} from './overviewStatusChartOptions'
import { OverviewFilterPanel } from './OverviewFilterPanel'

/**
 * Visão Geral de OS sobre a fonte REAL sanitizada.
 *
 * O provedor próprio da página é o que isola os 4.465 registros reais e os
 * sete filtros dependentes deste dashboard: as demais páginas de OS seguem no
 * `DashboardDataProvider`, com a simulação de sempre, sem receber este painel
 * nem estes filtros.
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
  const { status, errorMessage } = useOverviewOs()

  // O selo do cabeçalho acompanha a fonte: sem isso ele afirmava "Atualizado"
  // com a página inteira mostrando que o serviço não respondeu.
  useReportPageSourceStatus(
    status === 'loading' ? 'loading' : status === 'error' ? 'unavailable' : 'ready',
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

function OverviewContent() {
  const { theme } = usePreferences()
  const { data, filters } = useOverviewOs()
  const { kpis, charts } = data

  /**
   * Um re-render único quando as fontes da página terminam de carregar.
   *
   * O ECharts mede os rótulos dos eixos no PRIMEIRO layout, com a fonte que o
   * navegador tiver naquele instante, e não refaz a medida sozinho quando a
   * IBM Plex chega. Num repaint posterior o texto sai mais largo do que a
   * faixa reservada e é amputado à esquerda, que era exatamente o corte
   * `uditória de Infraestrutura` do ranking de categorias. O estado não guarda
   * dado nenhum: ele só remonta as opções dos gráficos com as métricas
   * definitivas. Com a fonte já em cache a promessa resolve na hora e o custo
   * é um render. A atualização é assíncrona por natureza, então a regra
   * `set-state-in-effect` do lint continua respeitada.
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

  // Status escolhido no filtro: destaca a barra dele na distribuição
  // contextual, sem esconder os demais status do recorte.
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
   * está lá). Quando tipo e categoria estão juntos, a categoria é subdivisão
   * do tipo escolhido e o destaque é a mesma fatia.
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
   * Altura da primeira linha de gráficos, derivada UMA vez e repassada aos
   * dois painéis. A distribuição por status é quem manda: ela cresce com a
   * quantidade de status do recorte, e o volume diário acompanha para os dois
   * cards continuarem alinhados na mesma linha da grade.
   */
  const firstRowHeight = statusDistributionHeight(charts.statusPairs.length)

  /**
   * Altura da segunda linha, a mesma nos dois painéis. O ranking de cidades
   * mostra TODAS as cidades do contexto (até doze), e 280 px é o que mantém
   * cada barra com o respiro dos outros rankings; a rosca acompanha para os
   * dois cards terminarem juntos.
   */
  const SECOND_ROW_HEIGHT = 280

  /**
   * Com `Status: Concluída` toda OS do recorte é concluída: Total e Concluídas
   * ficam com os mesmos valores e a barra verde chega ao topo da azul. A
   * nota vira o subtítulo do painel diário e explica a sobreposição; nenhum
   * valor é deslocado e nenhuma série sai da legenda por causa disso.
   */
  const dailyCoincide = dailySeriesCoincide(
    charts.overviewDay.total,
    charts.overviewDay.completed,
  )

  /**
   * Nota do painel diário. Com um status filtrado, a nota explica o desenho
   * degenerado daquele recorte (decisão aprovada junto com os contextos dos
   * gráficos); sem status, permanece a checagem de coincidência orgânica.
   */
  const dailySubtitle =
    selectedStatus !== null
      ? dailyVolumeStatusNote(selectedStatus)
      : dailyCoincide
        ? DAILY_VOLUME_COINCIDENT_MESSAGE
        : undefined

  /**
   * Os quatro indicadores, na ordem aprovada e com os nomes, valores e textos
   * gerenciais já aprovados: Total de OS, OS Concluídas, Taxa de Conclusão e
   * Taxa Improdutividade. Técnicos Ativos saiu da coleção: a página lê o
   * resultado do período, e a capacidade que o produziu tem página própria.
   *
   * A cor é identidade fixa do indicador e não muda com o resultado: a
   * interpretação favorável ou desfavorável mora na comparação, cujo tom sai do
   * `positive` já calculado nos agregados (`higherIsGood` por indicador). Total
   * permanece neutro, como sempre foi.
   */
  const cards: OsExecutiveCard[] = [
    {
      icon: ClipboardList,
      label: 'Total de OS',
      value: kpis.total,
      delta: buildDeltaFromKpi(kpis.totalDelta, 'O total de OS', 'neutro'),
      tone: 'blue',
      readingTitle: 'Todas as ordens de serviço abertas no período.',
      readingText:
        'É o tamanho da operação. Sozinho não diz se vai bem: leia junto de {conclusão} e {improdutividade}.',
      observe: 'Crescer o total sem crescer a conclusão vira acúmulo de backlog.',
    },
    {
      icon: CheckCircle2,
      label: 'OS Concluídas',
      value: kpis.completed,
      delta: buildDeltaFromKpi(kpis.completedDelta, 'O volume de OS concluídas'),
      tone: 'green',
      readingTitle: 'Ordens efetivamente finalizadas no período.',
      readingText:
        'Mede a capacidade real de entrega. Avança junto do {volume}? Então a operação está {escalando}.',
      observe: 'A distância entre Total e Concluídas é o que ficou pendente.',
    },
    {
      icon: Target,
      label: 'Taxa de Conclusão',
      value: kpis.completionRate,
      delta: buildDeltaFromKpi(kpis.completionDelta, 'A taxa de conclusão'),
      tone: 'indigo',
      readingTitle: 'Percentual das OS do período que foram concluídas.',
      readingText:
        'Termômetro de eficiência. Queda persistente aponta {gargalo} de capacidade ou {improdutividade} alta.',
      observe: 'Leia junto da improdutividade: uma costuma explicar a outra.',
    },
    {
      icon: AlertTriangle,
      label: 'Taxa Improdutividade',
      value: kpis.unproductiveRate,
      delta: buildDeltaFromKpi(kpis.unproductiveDelta, 'A taxa de improdutividade'),
      // Vermelho semântico do portal, o MESMO do status `Improdutiva` nos
      // gráficos de OS e da linha diária da taxa. É identidade do indicador, e
      // não julgamento do número: a leitura favorável ou desfavorável continua
      // saindo do `positive` da comparação, então uma queda segue em verde.
      tone: 'red',
      readingTitle: 'Fatia das OS que não geraram resultado produtivo.',
      readingText:
        'Cada ponto é {deslocamento e tempo pagos} sem entrega. Puxa a taxa de conclusão para baixo.',
      observe: 'Abra por motivo e por técnico para atacar a causa raiz.',
    },
  ]

  return (
    <div>
      <OsExecutiveCards cards={cards} theme={theme} />
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        {/* `os-daily-volume` escopa a superfície escura deste painel, para ele
            acompanhar os cards executivos acima. Os demais gráficos da página
            continuam na variante padrão. */}
        <ChartCard
          className="os-daily-volume"
          subtitle={dailySubtitle}
          title="Volume diário de OS"
          variant="executive"
        >
          {/* O painel mostra o período filtrado INTEIRO, dia a dia. As três
              séries são quantidade de OS no mesmo eixo: Total e Concluídas em
              barra, Improdutivas em linha. */}
          <Chart
            height={firstRowHeight}
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
        {/* Barras horizontais no lugar da rosca: comparar cinco fatias é
            impreciso, e aqui a diferença entre dois status é um comprimento,
            com quantidade e participação escritas na própria linha. Este
            painel é a referência comparativa da página: ignora só o filtro
            Status, então selecionar um status destaca a barra dele sem reduzir
            o gráfico a 100%. */}
        <ChartCard
          className="os-status-distribution"
          subtitle="Comparação entre status no contexto dos demais filtros"
          title="Distribuição por status"
          variant="executive"
        >
          <Chart
            height={firstRowHeight}
            option={makeStatusDistributionOptions(
              charts.statusPairs,
              charts.statusColors,
              theme,
              selectedStatus,
            )}
          />
        </ChartCard>
      </div>
      {/* Segunda linha: a composição do recorte por tipo e por cidade.
          `os-mix` escopa a superfície escura da rosca; o ranking de cidades
          é um `os-ranking` como os dois da linha de baixo. */}
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard
          className="os-mix os-service-type-mix"
          subtitle="Tipos no contexto dos demais filtros · passe o mouse para ver as categorias"
          title="Composição por tipo de OS"
          variant="executive"
        >
          {/* Uma fatia por tipo; o tooltip lista o ranking das categorias que
              compõem a fatia, então o gráfico responde o que há dentro de
              cada tipo sem trocar de filtro. Como a distribuição por status,
              este painel ignora os filtros Tipo de OS e Categoria: selecionar
              um tipo destaca a fatia dele, e selecionar uma categoria destaca
              o tipo que a contém, sem reduzir a rosca a 100%. */}
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
          {/* Ranking horizontal com TODAS as cidades do contexto, no mesmo
              gerador dos rankings de categoria e resolução: a fonte tem doze
              cidades no máximo, então nenhuma fica de fora. O painel ignora
              só o filtro Cidade: a cidade escolhida vira destaque entre as
              demais, nunca barra única. */}
          <Chart
            height={SECOND_ROW_HEIGHT}
            option={makeRankingOptions({
              // O azul-acento padrão das barras das outras páginas de OS, pela
              // mesma constante que elas usam, sem literal próprio.
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
          uma contagem ordenada por item, e só mudam a coleção e a cor de
          identidade. `os-ranking` escopa a superfície escura dos dois. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard
          className="os-ranking os-category-volume"
          subtitle={categorySubtitle}
          title="Volume por categoria"
          variant="executive"
        >
          {/* Projeção visual: só as 10 categorias mais frequentes do contexto
              cabem legíveis aqui; a fonte tem as 33 categorias reais do SGI.
              O painel ignora só o filtro Categoria: a categoria escolhida vira
              destaque entre as demais, garantida no desenho mesmo fora do
              Top 10. */}
          <Chart
            height={250}
            option={makeRankingOptions({
              // Identidade do ranking direto da paleta oficial compartilhada
              // dos cards executivos, sem literal próprio.
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
          {/* Projeção visual: só as 10 resoluções mais frequentes do recorte
              cabem legíveis aqui; o restante segue nos dados filtrados. */}
          <Chart
            height={250}
            option={makeRankingOptions({
              // Mesma fonte compartilhada do ranking ao lado: uma cor por
              // gráfico, sem segunda paleta. O verde é o mesmo do card
              // `OS Concluídas`, e este ranking abre justamente o desfecho
              // dessas OS.
              color: executiveCardColors.green,
              // Vazio com causa conhecida: resolução só existe em OS Concluída,
              // então um recorte sem concluídas esvazia ESTE ranking por essa
              // razão, e a mensagem diz isso em vez do aviso genérico.
              emptyMessage: RESOLUTION_EMPTY_MESSAGE,
              items: charts.resolutionTopPairs,
              name: 'Resoluções mais frequentes',
              theme,
            })}
          />
        </ChartCard>
      </div>
    </div>
  )
}

/**
 * Um card da coleção executiva de OS: valor, comparação e a definição curta do
 * indicador.
 *
 * O minigráfico saiu da frente do card. Três das cinco séries eram as MESMAS do
 * "Volume diário de OS" logo abaixo, que tem eixo, datas e legenda, e as cinco
 * se ajustavam cada uma à própria escala: variação mínima virava montanha e
 * variação grande virava linha reta, lado a lado, convidando a uma comparação
 * que não existe. A direção do período continua dita pela comparação, que não
 * tem como ser lida errado, e a série completa continua no gráfico de baixo.
 */
type OsExecutiveCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly tone: ExecutiveCardTone
  readonly value: string
  readonly delta: ExecutiveCardDelta
  readonly readingTitle: string
  readonly readingText: string
  readonly observe: string
  /**
   * Frase da frente do card, quando a do próprio título da leitura não serve.
   * Nenhum card atual precisa; fica disponível para um indicador cuja
   * comparação já diga o que o título da leitura diria.
   */
  readonly definition?: string
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
      // `os-executive-cards` escopa os ajustes de tema escuro a esta coleção,
      // sem tocar nos tokens globais nem nos gráficos abaixo. Quatro colunas
      // entram no `lg`: os quatro indicadores dividem a mesma linha, ainda com
      // valor, comparação e leitura gerencial legíveis. Antes disso a grade
      // segura dois por linha.
      className="os-executive-cards mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
      ref={containerRef}
    >
      {cards.map((card) => (
        <ExecutiveMetricCard
          // No lugar do minigráfico, a definição do indicador, presa à base do
          // card pelo próprio componente. O espaço não fica vazio e passa a
          // responder o que o minigráfico não respondia: o que este número
          // conta. A interpretação e o que observar continuam a um clique.
          definition={card.definition ?? card.readingTitle}
          // Só o valor: a comparação tem a própria leitura acessível dentro do
          // card, e repeti-la aqui faria o percentual ser anunciado duas vezes.
          accessibleText={`${card.label}: ${card.value}.`}
          delta={card.delta}
          icon={card.icon}
          key={card.label}
          label={card.label}
          observe={card.observe}
          onToggle={() =>
            setOpenCard((current) => (current === card.label ? null : card.label))
          }
          open={openCard === card.label}
          readingText={card.readingText}
          readingTitle={card.readingTitle}
          theme={theme}
          tone={card.tone}
          value={card.value}
          variant="spark"
        />
      ))}
    </section>
  )
}
