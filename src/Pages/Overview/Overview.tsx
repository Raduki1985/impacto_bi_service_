import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Target,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
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
import { usePreferences } from '../../contexts/usePreferences'
import { OVERVIEW_OS_ALL } from '../../data/overviewOsFilters'
import { formatNumber } from '../../lib/formatters'
import {
  DAILY_VOLUME_COINCIDENT_MESSAGE,
  dailySeriesCoincide,
  makeDailyVolumeOptions,
} from './overviewDailyChartOptions'
import { makeRankingOptions, RESOLUTION_EMPTY_MESSAGE } from './overviewRankingChartOptions'
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
      {/* O painel de filtros é a faixa de comando da página: preso ao topo do
          `main`, visualmente contínuo ao cabeçalho, permanece visível durante
          toda a rolagem vertical. A faixa pertence à página, então as demais
          páginas de OS seguem sem ela e sem espaço reservado. */}
      <PageStickyHeader className="mb-3.5">
        <OverviewFilterPanel />
      </PageStickyHeader>
      <OverviewContent />
    </OverviewOsProvider>
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

  /**
   * Altura da primeira linha de gráficos, derivada UMA vez e repassada aos
   * dois painéis. A distribuição por status é quem manda: ela cresce com a
   * quantidade de status do recorte, e o volume diário acompanha para os dois
   * cards continuarem alinhados na mesma linha da grade.
   */
  const firstRowHeight = statusDistributionHeight(charts.statusPairs.length)

  /**
   * Com `Status: Concluída` toda OS do recorte é concluída: Total e Concluídas
   * ficam com os mesmos valores e a linha verde cobre a azul por inteiro. A
   * nota vira o subtítulo do painel diário e explica a sobreposição; nenhum
   * valor é deslocado e nenhuma série sai da legenda por causa disso.
   */
  const dailyCoincide = dailySeriesCoincide(
    charts.overviewDay.total,
    charts.overviewDay.completed,
  )

  /**
   * Os cinco indicadores, na ordem aprovada e com os nomes, valores e textos
   * gerenciais já aprovados: Total de OS, OS Concluídas, Taxa de Conclusão,
   * Taxa Improdutividade e, fechando a coleção, Técnicos Ativos.
   *
   * A cor é identidade fixa do indicador e não muda com o resultado: a
   * interpretação favorável ou desfavorável mora na comparação, cujo tom sai do
   * `positive` já calculado nos agregados (`higherIsGood` por indicador). Total
   * e Técnicos permanecem neutros, como sempre foram.
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
    // Técnicos Ativos fecha a coleção: os quatro primeiros são a leitura de
    // resultado do período, do volume ao desperdício, e a capacidade que os
    // produziu vem depois deles.
    {
      icon: UsersRound,
      label: 'Técnicos Ativos',
      value: formatNumber(kpis.activeTechnicians),
      // Sem comparação com o período anterior: o indicador nunca teve uma, e a
      // faixa recebe o mesmo contexto curto de sempre, em tom neutro.
      delta: {
        label: 'Em campo no período',
        accessibleLabel: 'técnicos em campo no período',
        tone: 'neutro',
      },
      tone: 'violet',
      readingTitle: 'Técnicos que atuaram em campo no período.',
      // A comparação deste card já diz "Em campo no período": repetir o título
      // da leitura logo abaixo seria a mesma frase duas vezes na mesma face.
      definition: 'Base de capacidade da operação.',
      readingText:
        'Base de capacidade da operação. Serve para {dimensionar} a produtividade e a carga por técnico.',
      observe: 'Poucos técnicos com muita OS = risco de fila e de improdutividade.',
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
          subtitle={dailyCoincide ? DAILY_VOLUME_COINCIDENT_MESSAGE : undefined}
          title="Volume diário de OS"
          variant="executive"
        >
          {/* O painel mostra o período filtrado INTEIRO, dia a dia, com as
              quantidades no eixo da esquerda e a taxa de improdutividade em
              percentual no da direita. */}
          <Chart
            height={firstRowHeight}
            option={makeDailyVolumeOptions(
              charts.overviewDay.x,
              charts.overviewDay.total,
              charts.overviewDay.completed,
              charts.overviewDay.unproductiveRate,
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
      {/* Os dois rankings compartilham o mesmo gerador: são a mesma leitura,
          uma contagem ordenada por item, e só mudam a coleção e a cor de
          identidade. `os-ranking` escopa a superfície escura dos dois. */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ChartCard
          className="os-ranking os-category-volume"
          subtitle="Onde a operação mais atua · Top 10"
          title="Volume por categoria"
          variant="executive"
        >
          {/* Projeção visual: só as 10 categorias mais frequentes do recorte
              cabem legíveis aqui; a fonte tem as 33 categorias reais do SGI. */}
          <Chart
            height={250}
            option={makeRankingOptions({
              // Identidade do ranking direto da paleta oficial compartilhada
              // dos cards executivos, sem literal próprio.
              color: executiveCardColors.blue,
              items: charts.categoryTopPairs,
              name: 'Volume por categoria',
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
   *
   * Só Técnicos Ativos precisa: a comparação dele já é o contexto "Em campo no
   * período", e o título da leitura diria a mesma coisa duas vezes na mesma
   * face. Nenhum texto novo é inventado aqui: a frase vem da leitura gerencial
   * que já estava aprovada.
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
      // sem tocar nos tokens globais nem nos gráficos abaixo. Cinco colunas
      // entram no `xl`: em 1366 px os cinco indicadores dividem a mesma linha,
      // ainda com valor, comparação e leitura gerencial legíveis, em vez de
      // deixar uma área vazia ao lado dos dois cards da segunda linha. Antes
      // disso a grade segura três por linha.
      className="os-executive-cards mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
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
