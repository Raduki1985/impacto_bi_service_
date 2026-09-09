import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BadgeDollarSign,
  CircleCheckBig,
  Clock3,
  MapPin,
  Medal,
  Share2,
  Target,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../../components/charts/Chart'
import { PageStickyHeader } from '../../../components/layout/PageStickyHeader'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { useReportPageSourceStatus } from '../../../contexts/usePageSourceStatus'
import { usePreferences } from '../../../contexts/usePreferences'
import { cn } from '../../../lib/utils'
import { isBiApiConfigured } from '../../../data/api/biApiClient'
import {
  fetchCommercialOverview,
  type CommercialOverviewApiResult,
} from './commercialOverviewApi'
import type { CommercialCityId, CommercialDataset } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  buildCommercialDelta,
  commercialCardColors,
  type CommercialCardDelta,
  type CommercialCardTone,
} from '../components/commercialCardModel'
import { ExecutiveMetricCard } from '../../../components/dashboard/ExecutiveMetricCard'
import type { SalesPeriodTeam, SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import { OverviewFilters } from './OverviewFilters'
import {
  buildTeamDetail,
  initialMonthlyLegendSelection,
  makeOverviewMonthlyOptions,
  makeOverviewTeamOptions,
} from './overviewChartOptions'
import { OverviewGauge, OverviewGaugeFooter } from './OverviewGauge'
import { buildOverviewGaugeModel, type OverviewGaugeModel } from './overviewGaugeModel'
import {
  buildCommercialOverviewSnapshot,
  initialCommercialOverviewFilters,
  type CommercialOverviewFilters,
  type CommercialOverviewSnapshot,
  type OverviewAwaitingPayment,
  type OverviewBreakdown,
  type OverviewPipelineStage,
  type OverviewPipelineStageId,
} from './overviewModel'

// Mesma superfície do painel executivo do portal (`ChartCard`, variante
// executiva), sombra discreta incluída: sem ela os painéis desta página ficavam
// chapados ao lado dos cards de indicador, que já têm a sombra.
const panelClass =
  'min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm'
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Destaque de item selecionado pelo filtro superior: borda, fundo e rótulo. */
const selectedRowClass = 'border-[var(--accent)] bg-[var(--accent-weak)]'

/*
 * Barras, ícones e posições dos rankings usam o azul de DADOS `#2f7de1`
 * literal, o mesmo das barras de Vendas por período, nunca `var(--accent)`:
 * o acento é identidade da ESTRUTURA (#003be2 desde o rebrand de set/2026) e
 * as marcas de dados não o acompanham. Seleção de linha e filtros, que são
 * interação, continuam no acento.
 */

/**
 * Quatro degraus do âmbar do card Status das Assinaturas, um por etapa.
 *
 * Etapa do fluxo não é sucesso nem erro, então nenhum degrau usa verde ou
 * vermelho: os quatro são variações da própria identidade do card, do mais
 * escuro no início para o mais claro no fim. A cor também nunca é o único
 * identificador, porque cada etapa traz label e quantidade na grade abaixo da
 * barra.
 *
 * No tema escuro os degraus sobem um passo. O primeiro deles, `#b45309`, é
 * pouco separado da superfície `#1f2937` do card no escuro, e o degrau mais
 * claro ganha um pouco mais de corpo para não estourar sobre o mesmo fundo.
 */
const pipelineColors: Record<'light' | 'dark', Record<OverviewPipelineStageId, string>> = {
  light: {
    pendente: '#b45309',
    assinada: '#d97706',
    agendada: '#f59e0b',
    'aguardando-aprovacao': '#fbbf24',
  },
  dark: {
    pendente: '#c9700f',
    assinada: '#e8890b',
    agendada: '#f7ab24',
    'aguardando-aprovacao': '#fbd25d',
  },
}

/**
 * Label discreto do item destacado pelo filtro superior.
 *
 * O visual mostra apenas `FILTRO`, sem preenchimento sólido. O texto acessível
 * completo continua no `sr-only`, junto do `aria-current` da linha.
 */
function FilterTag({ description }: { description: string }) {
  return (
    <>
      <span aria-hidden="true" className="overview-filter-tag">
        Selecionado
      </span>
      <span className="sr-only">{description}</span>
    </>
  )
}

export function Overview() {
  const { theme } = usePreferences()
  // Sem API configurada, a base sintética já pode estar em memória e a página
  // abre pronta, como sempre abriu.
  const [dataset, setDataset] = useState<CommercialDataset | null>(() =>
    isBiApiConfigured ? null : peekCommercialDataset(),
  )
  /**
   * Resposta do serviço junto do recorte que a produziu.
   *
   * Guardar os dois no mesmo estado é o que permite saber, no próprio render,
   * que os números na tela ainda são os do recorte ANTERIOR enquanto a
   * consulta nova não volta. Sem isso, trocar de cidade num serviço lento
   * mantinha os valores antigos sem nenhum aviso.
   */
  const [loaded, setLoaded] = useState<{
    readonly result: CommercialOverviewApiResult
    readonly filters: CommercialOverviewFilters
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CommercialOverviewFilters>(
    initialCommercialOverviewFilters,
  )

  /**
   * Base sintética local. Só roda quando o portal NÃO está ligado ao serviço.
   */
  useEffect(() => {
    if (isBiApiConfigured || dataset !== null || error !== null) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      try {
        const built = getCommercialDataset()
        if (!cancelled) setDataset(built)
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Falha desconhecida ao montar a base comercial mockada.',
          )
        }
      }
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [dataset, error])

  /**
   * Visão Geral vinda do serviço, já agregada.
   *
   * Diferente da página de OS, aqui a consulta REFAZ a cada mudança de filtro:
   * é o serviço que calcula, então cada recorte é uma pergunta nova. Os
   * parâmetros do contrato viajam na consulta (período, cidade e time).
   *
   * Falha não cai na base local. As duas trazem números diferentes, e mostrar
   * o número sintético com cara de número do serviço é pior do que o erro.
   */
  useEffect(() => {
    if (!isBiApiConfigured) return
    let cancelled = false

    void fetchCommercialOverview(filters)
      .then((result) => {
        if (cancelled) return
        setLoaded({ result, filters })
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(
          cause instanceof Error ? cause.message : 'Não foi possível carregar a Visão Geral.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [filters])

  const localSnapshot = useMemo(
    () => (dataset === null ? null : buildCommercialOverviewSnapshot(dataset, filters)),
    [dataset, filters],
  )

  const apiResult = loaded?.result ?? null
  /**
   * A consulta do recorte atual ainda não voltou, e o que está na tela é o
   * recorte anterior. Sai do próprio render, comparando o filtro que produziu
   * os números com o filtro em vigor, sem estado extra para manter em dia.
   */
  const refreshing = isBiApiConfigured && error === null && loaded !== null && loaded.filters !== filters

  const snapshot = isBiApiConfigured ? (apiResult?.snapshot ?? null) : localSnapshot
  const cities = isBiApiConfigured ? (apiResult?.cities ?? []) : (dataset?.cities ?? [])
  /**
   * Lista do filtro Vendedor.
   *
   * Só existe com a base local. O serviço de BI calcula a Visão Geral no
   * servidor e o contrato atual não recebe vendedor nem devolve a lista, então
   * ali o seletor fica vazio e o painel de filtros o desabilita, em vez de
   * oferecer um filtro que não teria efeito nenhum sobre os números.
   */
  const sellers = isBiApiConfigured ? (apiResult?.sellers ?? []) : (dataset?.sellers ?? [])

  // O selo do cabeçalho diz o que está acontecendo com a fonte: buscando,
  // indisponível, ou atualizado de verdade.
  useReportPageSourceStatus(
    error !== null ? 'unavailable' : snapshot === null || refreshing ? 'loading' : 'ready',
  )

  if (error !== null) return <StatePanel title="Não foi possível montar a Visão Geral">{error}</StatePanel>
  if (snapshot === null) {
    return <StatePanel title="Montando a Visão Geral">Preparando os indicadores executivos.</StatePanel>
  }

  const monthlyRangeLabel = describeMonthlyRange(snapshot.monthly)

  return (
    <>
      {/* O painel de filtros é a faixa de comando da página: preso ao topo
          do `main`, visualmente contínuo ao cabeçalho, permanece visível
          durante toda a rolagem vertical. Fica FORA de `commercial-overview`
          porque a faixa usa a mesma superfície do cabeçalho do portal, e não
          as superfícies mais claras que esta página redefine no tema escuro. */}
      <PageStickyHeader className="mb-3.5">
        <OverviewFilters
          cities={cities}
          filters={filters}
          onChange={setFilters}
          sellers={sellers}
        />
      </PageStickyHeader>
      {/* `commercial-overview` escopa as superfícies mais claras do tema
          escuro desta página, sem tocar nos tokens globais do portal.

          Enquanto a consulta do novo recorte não volta, o bloco inteiro fica
          esmaecido e marcado como ocupado: os números continuam legíveis, mas
          param de se apresentar como resposta ao filtro que acabou de ser
          escolhido. */}
      <div
        aria-busy={refreshing}
        className={cn(
          'commercial-overview flex flex-col gap-4 transition-opacity duration-200',
          refreshing && 'opacity-50',
        )}
      >
        <ExecutiveCards snapshot={snapshot} team={filters.team} theme={theme} />

        <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <CitiesPanel rows={snapshot.topCities} selectedCityId={filters.cityId} />
          <TeamPanel
            rows={snapshot.teams}
            selectedTeam={filters.team}
            theme={theme}
            total={snapshot.teamComparisonTotal}
          />
          <OriginsPanel rows={snapshot.origins} />
        </div>

        {/* O painel do gráfico ocupa metade da linha; cada ranking fica com um
            quarto. Abaixo de xl os três voltam a empilhar, sem rolagem lateral. */}
        <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[2fr_1fr_1fr]">
          {/* A chave remonta o painel quando o filtro global de time muda, o que
              devolve a legenda ao estado inicial. Sem isso o usuário poderia
              filtrar Comercial com a série Comercial desligada na legenda. */}
          <MonthlyPanel
            key={filters.team}
            monthly={snapshot.monthly}
            team={filters.team}
            theme={theme}
          />
          <SellerRanking selectedSellerId={filters.sellerId} snapshot={snapshot} theme={theme} />
          <PlansRanking snapshot={snapshot} />
        </div>

        {/* A frase de origem acompanha de onde a base veio. Com o serviço no ar,
            dizer que nenhum valor foi extraído do SGI deixaria de ser verdade. */}
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {isBiApiConfigured
            ? 'Visão executiva com a base entregue pelo serviço de BI. '
            : 'Visão executiva com dados sintéticos. '}
          O recorte dos indicadores e rankings é {snapshot.periodLabel}; o histórico mensal mostra{' '}
          {monthlyRangeLabel} com cidade e time aplicados. Vendas por cidade, Vendas por time e
          Origem das vendas são comparativos: cada um ignora o filtro da própria dimensão e apenas
          destaca a seleção.
          {isBiApiConfigured
            ? ' Valor mensal e plano de cada contrato ainda são derivados no portal.'
            : ' Nenhum valor foi extraído do SGI.'}
        </p>
      </div>
    </>
  )
}

function ExecutiveCards({
  snapshot,
  team,
  theme,
}: {
  snapshot: CommercialOverviewSnapshot
  team: SalesPeriodTeamFilter
  theme: Theme
}) {
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

  const { metrics } = snapshot
  // O filtro exclusivo do Corporativo chega explícito à coleção: é ele que
  // distingue "não se aplica" de uma meta simplesmente ausente no recorte.
  const corporateOnly = team === 'corporativo'
  const activeDelta = changeText(metrics.activeSalesChangeRate, 'O volume de vendas ativadas')
  const valueDelta = changeText(snapshot.monthlyValueChangeRate, 'O valor das vendas ativadas')
  // Participação dos contratos em fluxo sobre o TOTAL de contratos do recorte,
  // que é outro denominador do usado dentro da barra de composição.
  const pipelineShare = formatPercent(
    metrics.totalContracts === 0 ? 0 : metrics.pipelineSales / metrics.totalContracts,
  )
  // O velocímetro é a única fonte de meta efetiva, percentual e distância. A
  // leitura gerencial abaixo lê dele, e não das métricas brutas, para nunca
  // divergir do que o card mostra.
  const goalGauge = buildOverviewGaugeModel({
    indicator: 'Meta Comercial',
    targetTerm: 'Meta',
    achieved: metrics.goalAchieved,
    target: metrics.goal,
    previousAchieved: snapshot.previousGoalAchieved,
    corporateOnly,
  })
  const cards: OverviewCard[] = [
    {
      icon: CircleCheckBig,
      label: 'Vendas ativadas',
      value: formatNumber(metrics.activeSales),
      delta: activeDelta.delta,
      tone: 'green',
      definition: 'vendas ativadas no recorte, base da taxa de ativação',
      readingTitle: `${formatNumber(metrics.activeSales)} vendas foram ativadas no recorte.`,
      readingText: `${activeDelta.reading} A taxa de ativação foi de {${formatPercent(metrics.activationRate ?? 0)}}.`,
      observe: 'Evolução do volume e conversão dos contratos em ativação.',
    },
    {
      icon: BadgeDollarSign,
      // Nome do indicador no card. O conceito de negócio continua sendo o valor
      // mensal ativado, preservado na leitura gerencial e nos campos técnicos.
      label: 'Valor Vendas Ativadas',
      value: currency.format(metrics.monthlyRevenue),
      delta: valueDelta.delta,
      tone: 'blue',
      definition: 'soma do valor mensal das vendas ativadas',
      readingTitle: `${currency.format(metrics.monthlyRevenue)} em valor mensal ativado.`,
      readingText: `${valueDelta.reading} O ticket médio ficou em {${currency.format(metrics.averageTicket)}}.`,
      observe: 'Crescimento do valor recorrente e comportamento do ticket médio.',
    },
    awaitingPaymentCard(snapshot.awaitingPayment),
    {
      icon: Target,
      label: 'Meta Comercial',
      gauge: goalGauge,
      delta: gaugeDelta(goalGauge, 'A Meta Comercial'),
      tone: 'indigo',
      readingTitle: corporateOnly
        ? 'O time Corporativo não possui meta própria de volume.'
        : goalGauge.effectiveTarget === null
          ? 'O recorte não possui Meta Comercial definida.'
          : `${formatNumber(goalGauge.achieved)} de ${formatNumber(goalGauge.effectiveTarget)} vendas da Meta Comercial.`,
      readingText: corporateOnly
        ? 'Por isso, o atingimento da Meta Comercial não se aplica a este recorte.'
        : gaugeReadingText(goalGauge, {
            noGoal:
              'Sem uma meta válida para o recorte, nenhum percentual de atingimento é exibido.',
            exact: 'A Meta Comercial foi atingida exatamente.',
            above: (value) => `A Meta Comercial foi superada em {${value}}.`,
            below: (value) => `Ainda faltam {${value}} do Comercial para atingir a Meta.`,
          }),
      observe: corporateOnly
        ? 'A Meta Comercial considera somente as vendas do Comercial.'
        : 'O realizado considera o Comercial; o Corporativo não compõe este numerador.',
    },
    {
      icon: Clock3,
      label: 'Status das Assinaturas',
      value: formatNumber(metrics.pipelineSales),
      // Sem comparação com o período anterior: o percentual deste card é
      // participação no total de contratos do recorte, e não variação.
      share: pipelineShare,
      detail: `${pipelineShare} dos contratos`,
      stages: snapshot.pipelineStages,
      tone: 'amber',
      readingTitle: `${formatNumber(metrics.pipelineSales)} contratos ainda podem avançar.`,
      readingText: `Eles representam {${pipelineShare}} dos contratos do recorte.`,
      observe:
        'Distribuição entre pendentes, assinados, agendados e aguardando aprovação.',
    },
  ]

  return (
    <section
      aria-label="Indicadores executivos da operação comercial"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      ref={containerRef}
    >
      {cards.map((card) => (
        <ExecutiveMetricCard
          accessibleText={cardAccessibleText(card)}
          definition={card.definition}
          delta={card.delta}
          detail={card.detail}
          footer={
            card.gauge === undefined ? undefined : (
              <OverviewGaugeFooter model={card.gauge} theme={theme} />
            )
          }
          icon={card.icon}
          key={card.label}
          label={card.label}
          // Piso da fileira: o velocímetro é o card mais alto, e as linhas de
          // baixo (três colunas no lg, duas no sm) acompanham a altura dele.
          minHeight={206}
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
          variant={cardVariant(card)}
        >
          <OverviewCardVisual card={card} theme={theme} />
        </ExecutiveMetricCard>
      ))}
    </section>
  )
}

/**
 * Um card da coleção executiva.
 *
 * A variante é derivada do conteúdo, e não declarada duas vezes: `gauge`
 * significa velocímetro, `stages` significa composição do fluxo e o restante é
 * minigráfico. Assim não existe a possibilidade de um card declarar uma
 * variante e trazer o conteúdo de outra.
 */
type OverviewCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly tone: CommercialCardTone
  readonly value?: string
  readonly delta?: CommercialCardDelta
  readonly gauge?: OverviewGaugeModel
  /** Texto curto abaixo do valor, já pronto para a tela. */
  readonly detail?: string
  /**
   * Participação do card de composição, isolada do texto exibido porque o nome
   * acessível dele repete o percentual em outra frase.
   */
  readonly share?: string
  readonly stages?: readonly OverviewPipelineStage[]
  readonly readingTitle: string
  readonly readingText: string
  readonly observe: string
  /** Frase da base do card, no lugar do antigo minigráfico. */
  readonly definition?: string
}

/**
 * Card Aguardando pagamento.
 *
 * Indicador PROVISÓRIO, e o card diz isso na leitura gerencial. A regra está
 * documentada em `OverviewAwaitingPayment`: contrato ainda não ativado com
 * instalação a cobrar. Não é inadimplência.
 *
 * Sem comparação com o período anterior, pelo mesmo motivo do card Contratos em
 * fluxo: é uma fotografia do estoque atual, e não um volume acumulado no
 * período.
 *
 * Com a fonte sem o indicador, o card mostra que não há dado em vez de mostrar
 * zero: zero contratos aguardando pagamento é uma afirmação, e ela não pode ser
 * feita a partir de um contrato que simplesmente não traz o campo.
 */
function awaitingPaymentCard(awaiting: OverviewAwaitingPayment | null): OverviewCard {
  const base = {
    icon: Wallet,
    label: 'Aguardando pagamento',
    tone: 'cyan',
  } as const

  if (awaiting === null) {
    return {
      ...base,
      value: 'Sem dado',
      definition: 'indicador ainda não entregue pelo serviço de BI',
      readingTitle: 'O serviço de BI ainda não entrega este indicador.',
      readingText:
        'A Visão Geral conectada ao serviço recebe apenas os totais já somados, e a cobrança de instalação em aberto não está entre eles. Com a base sintética, o mesmo card é calculado no portal.',
      observe:
        'Pendência a levar ao time do serviço: incluir a instalação a cobrar dos contratos ainda não ativados no contrato desta página.',
    }
  }

  const share = formatPercent(awaiting.share)
  const semRegistro =
    awaiting.withoutData === 0
      ? ''
      : ` Outros {${formatNumber(awaiting.withoutData)}} contratos em fluxo não têm registro de instalação e ficam fora desta conta.`

  return {
    ...base,
    value: formatNumber(awaiting.contracts),
    detail: `${share} dos contratos em fluxo`,
    definition: 'contratos ainda não ativados com instalação a cobrar',
    readingTitle: `${formatNumber(awaiting.contracts)} contratos ainda não ativados têm instalação a cobrar.`,
    readingText: `A cobrança em aberto soma {${currency.format(awaiting.chargedValue)}} e representa {${share}} dos contratos em fluxo.${semRegistro}`,
    observe:
      'Indicador provisório: o sistema ainda não informa se a cobrança foi paga, então o número mede instalação a cobrar em contrato não ativado, e não inadimplência.',
  }
}

function cardVariant(card: OverviewCard): 'spark' | 'gauge' | 'pipeline' {
  if (card.gauge !== undefined) return 'gauge'
  if (card.stages !== undefined) return 'pipeline'
  return 'spark'
}

/**
 * Conteúdo visual da variante.
 *
 * Velocímetro e composição do funil continuam: os dois têm escala própria e
 * dizem algo que o número sozinho não diz. O minigráfico saiu: ele se ajustava
 * ao próprio mínimo e máximo, então cards vizinhos mostravam formas parecidas
 * para grandezas diferentes. O card de valor não desenha mais nada, e a base
 * dele passou a ser a definição do indicador.
 */
function OverviewCardVisual({ card, theme }: { card: OverviewCard; theme: Theme }) {
  if (card.gauge !== undefined) {
    return <OverviewGauge baseColor={commercialCardColors[card.tone]} model={card.gauge} />
  }
  if (card.stages !== undefined) {
    return <PipelineComposition stages={card.stages} theme={theme} />
  }

  return null
}

/**
 * Comparação do velocímetro traduzida para o texto comparativo do card.
 *
 * A fonte continua sendo o modelo do velocímetro: percentual, direção e tom
 * saem de lá. O que muda é só a posição, que passa de texto dentro do SVG para
 * texto em HTML logo abaixo do arco, com a expressão completa disponível para
 * leitor de tela.
 */
function gaugeDelta(gauge: OverviewGaugeModel, subject: string): CommercialCardDelta {
  const { comparison } = gauge

  // Sem base anterior, ou em recorte que não comparece à comparação, nenhum
  // percentual é inventado: o próprio modelo já diz qual é o caso.
  if (comparison.rate === null) {
    return {
      label: comparison.label,
      accessibleLabel: `${subject}: ${comparison.accessibleLabel}`,
      tone: 'indisponivel',
    }
  }

  return buildCommercialDelta(comparison.rate, subject)
}

/**
 * Nome acessível da frente do card, antes da orientação de abrir e fechar.
 *
 * O velocímetro já monta o próprio texto no modelo. O card de composição
 * precisa dizer a divisão por extenso, porque a barra é decorativa e a cor não
 * chega ao leitor de tela.
 */
function cardAccessibleText(card: OverviewCard): string {
  if (card.gauge !== undefined) return card.gauge.accessibleText
  if (card.stages !== undefined) {
    const total = card.stages.reduce((sum, stage) => sum + stage.count, 0)
    const head = `${card.label}: ${card.value}, equivalentes a ${card.share} dos contratos.`
    if (total === 0) return `${head} Nenhum contrato em fluxo neste recorte.`
    const parts = card.stages
      .map((stage) => `${stage.label} ${formatNumber(stage.count)}`)
      .join(', ')
    return `${head} ${parts}.`
  }
  // O detalhe entra no nome acessível porque ele qualifica o número: sem isso,
  // quem usa leitor de tela ouviria a contagem sem o recorte a que ela se refere.
  return card.detail === undefined
    ? `${card.label}: ${card.value}.`
    : `${card.label}: ${card.value}, equivalentes a ${card.detail}.`
}

/**
 * Composição dos contratos em fluxo: barra segmentada e grade de etapas.
 *
 * A barra é uma divisão do estoque atual, não uma linha do tempo. Cada segmento
 * ocupa a fatia da etapa dentro do próprio fluxo, os quatro são contíguos e só
 * as pontas do conjunto são arredondadas, pelo `overflow-hidden` do trilho. Com
 * o fluxo vazio nenhum segmento é desenhado e sobra o trilho neutro, que já
 * comunica ausência sem esconder o conteúdo.
 *
 * A barra é decorativa para leitor de tela: a mesma divisão está na grade
 * abaixo, em texto, e o nome acessível do card repete o detalhamento inteiro.
 *
 * O `-mx-2` devolve parte do padding lateral do card, como no rodapé dos
 * velocímetros. Sem ele, em 1280 px cada coluna da grade ficaria com 75 px para
 * um `Em aprovação` de 67,8 px mais o marcador, e o rótulo quebraria em duas
 * linhas. Com ele sobram 83 px por coluna e a etapa mais longa cabe inteira.
 */
function PipelineComposition({
  stages,
  theme,
}: {
  stages: readonly OverviewPipelineStage[]
  theme: Theme
}) {
  const colors = pipelineColors[theme === 'dark' ? 'dark' : 'light']
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)

  return (
    <div className="overview-pipeline -mx-2 mt-3">
      <div
        aria-hidden="true"
        className="flex h-2 overflow-hidden rounded-full bg-[var(--divider)]"
      >
        {total === 0
          ? null
          : stages.map((stage) =>
              stage.count === 0 ? null : (
                <div
                  key={stage.id}
                  style={{
                    background: colors[stage.id],
                    width: `${stage.share * 100}%`,
                  }}
                />
              ),
            )}
      </div>

      {/* Lista de definição, não botões: as etapas informam, e a única ação do
          card continua sendo abrir a leitura gerencial. */}
      <dl className="overview-pipeline-grid mt-2.5">
        {stages.map((stage) => (
          <div className="overview-pipeline-item" key={stage.id}>
            <dt className="overview-pipeline-term">
              <span
                aria-hidden="true"
                className="overview-pipeline-dot"
                style={{ background: colors[stage.id] }}
              />
              {stage.label}
            </dt>
            <dd className="overview-pipeline-count">{formatNumber(stage.count)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Ranking comparativo de cidades.
 *
 * O modelo já entrega o ranking completo do período, ignorando apenas o filtro
 * de cidade. Aqui `selectedCityId` serve só para destacar a linha: um ranking
 * reduzido a uma única cidade não compara nada.
 */
function CitiesPanel({
  rows,
  selectedCityId,
}: {
  rows: readonly OverviewBreakdown[]
  selectedCityId: CommercialCityId | null
}) {
  const max = Math.max(...rows.map((row) => row.activeSales), 1)
  return (
    <Panel
      subtitle="Ranking completo do período. O filtro de cidade destaca a linha, sem reduzir a comparação."
      title="Vendas por cidade"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const selected = row.id === selectedCityId
            return (
              <div
                aria-current={selected ? 'true' : undefined}
                className={`rounded-lg border px-2 py-1.5 ${selected ? selectedRowClass : 'border-transparent'}`}
                key={row.id}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-[var(--text-item)]">
                    <MapPin aria-hidden="true" className="flex-none text-[#2f7de1]" size={13} />
                    <span className="truncate" title={row.label}>{row.label}</span>
                    {selected ? (
                      <FilterTag description="Cidade selecionada no filtro superior." />
                    ) : null}
                  </span>
                  {/* 13px é o corpo do número principal em todos os rankings da
                      página. Só o número sobe: o nome da cidade fica nos 11px
                      da linha, como nos demais painéis. */}
                  <span className="flex-none font-mono text-[13px] text-[var(--text-heading)]">
                    {formatNumber(row.activeSales)} · {formatPercent(row.share)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                  <div className="h-full rounded-full bg-[#2f7de1]" style={{ width: `${(row.activeSales / max) * 100}%` }} />
                </div>
                <p className="mt-1 text-right text-[10.5px] text-[var(--text-secondary)]">
                  {currency.format(row.monthlyValue)} mensais
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

/**
 * Comparativo dos dois times.
 *
 * O modelo ignora o filtro de time ao montar este painel, então Comercial e
 * Corporativo continuam lado a lado. `selectedTeam` só marca qual bloco recebe
 * borda, fundo e o rótulo "Selecionado".
 *
 * Os detalhes ficam permanentemente visíveis nos dois blocos: não existe mais
 * tooltip na rosca nem nos blocos, e nada depende de hover para ser lido.
 */
function TeamPanel({
  rows,
  selectedTeam,
  theme,
  total,
}: {
  rows: readonly OverviewBreakdown[]
  selectedTeam: SalesPeriodTeamFilter
  theme: Theme
  total: number
}) {
  const details = rows.map((row) => buildTeamDetail(row, theme))
  return (
    <Panel
      subtitle="Comercial e Corporativo sempre comparados. O filtro de time destaca o selecionado."
      title="Vendas por time"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-1 flex flex-col items-center">
          <p className="sr-only">
            {formatNumber(total)} ativações no recorte de data e cidade.{' '}
            {details.map((detail) => detail.accessibleText).join(' ')}
          </p>
          <div aria-hidden="true" className="w-full">
            <Chart
              height={176}
              option={makeOverviewTeamOptions(rows, total, theme, selectedTeam)}
            />
          </div>
          {/* `items-stretch` é o padrão do grid: os dois blocos terminam sempre
              na mesma altura. Dentro de cada um, `mt-auto` empurra o bloco
              financeiro para a base, então a sobra vertical vira respiro entre
              a participação e o fechamento, em vez de um vazio no rodapé. */}
          <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
            {details.map((detail) => {
              const selected = detail.id === selectedTeam
              return (
                <div
                  aria-current={selected ? 'true' : undefined}
                  className={`flex min-w-0 flex-col rounded-lg border px-2.5 py-3 ${selected ? selectedRowClass : 'border-[var(--divider)]'}`}
                  key={detail.id}
                >
                  <p className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ background: detail.color }}
                    />
                    <span className="truncate">{detail.label}</span>
                  </p>
                  {/* Em linha própria: o bloco de time tem cerca de metade de um
                      painel estreito, e o label ao lado do nome espremeria os
                      dois. */}
                  {selected ? (
                    <p className="mt-1.5">
                      <FilterTag description="Time selecionado no filtro superior." />
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[17px] font-bold leading-none text-[var(--text-heading)]">
                    {formatNumber(detail.activeSales)}
                  </p>
                  <p className="mt-1 text-[10.5px] text-[var(--text-secondary)]">
                    {detail.share} das ativações
                  </p>
                  {/* Rótulo em cima e número embaixo porque cada bloco ocupa
                      metade de um painel estreito: os dois na mesma linha
                      estourariam a coluna. Valor mensal fecha o bloco com
                      hierarquia maior que o Ticket médio. */}
                  <dl className="mt-auto space-y-2.5 border-t border-[var(--divider)] pt-2.5">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.3px] text-[var(--text-secondary)]">
                        {detail.averageTicket.term}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[11px] font-semibold text-[var(--text-item)]">
                        {detail.averageTicket.value}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.3px] text-[var(--text-secondary)]">
                        {detail.monthlyValue.term}
                      </dt>
                      <dd className="mt-0.5 font-mono text-[12.5px] font-bold text-[var(--text-heading)]">
                        {detail.monthlyValue.value}
                      </dd>
                    </div>
                  </dl>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Panel>
  )
}

/**
 * Origem das vendas.
 *
 * Vendedores e Indicação são origens da ativação, não times. O modelo monta
 * este painel ignorando o filtro de time, então trocar Comercial ou Corporativo
 * no controle superior não altera estes números. Data e cidade continuam
 * valendo.
 */
function OriginsPanel({ rows }: { rows: readonly OverviewBreakdown[] }) {
  // Mesma régua das barras de Vendas por cidade e Top 5 Planos: o comprimento é
  // proporcional à MAIOR origem do recorte, e não à participação no total.
  // Antes eram duas réguas diferentes com o mesmo desenho na mesma tela, o que
  // fazia barras iguais dizerem coisas diferentes. A participação continua
  // escrita ao lado do nome, que é onde ela é lida sem ambiguidade.
  const max = Math.max(...rows.map((row) => row.activeSales), 1)

  return (
    <Panel
      subtitle="Crédito da ativação conforme a presença do CPF indicador, somando os dois times."
      title="Origem das vendas"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-5 space-y-3.5">
          {rows.map((row) => {
            const indicated = row.id === 'indicacao'
            const Icon = indicated ? Share2 : UsersRound
            return (
              <div className="rounded-xl border border-[var(--divider)] p-3" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-lg p-2 ${indicated ? 'bg-[#14b8a6]/10 text-[#0f9689]' : 'bg-[#2f7de1]/10 text-[#2f7de1]'}`}>
                    <Icon aria-hidden="true" size={17} />
                  </span>
                  <span className="font-mono text-[19px] font-bold text-[var(--text-heading)]">{formatNumber(row.activeSales)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[10.5px]">
                  <strong className="text-[var(--text-item)]">{row.label}</strong>
                  <span className="text-[var(--text-secondary)]">{formatPercent(row.share)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                  <div className={`h-full rounded-full ${indicated ? 'bg-[#14b8a6]' : 'bg-[#2f7de1]'}`} style={{ width: `${(row.activeSales / max) * 100}%` }} />
                </div>
                <p className="mt-2 text-[10.5px] text-[var(--text-secondary)]">{currency.format(row.monthlyValue)} mensais</p>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

/**
 * Evolução mensal das vendas.
 *
 * A legenda do próprio gráfico liga e desliga Comercial e Corporativo. O estado
 * fica aqui para que a linha Valor mensal seja recalculada como a soma apenas
 * dos times visíveis, em vez de continuar exibindo o total consolidado.
 */
function MonthlyPanel({
  monthly,
  team,
  theme,
}: {
  monthly: CommercialOverviewSnapshot['monthly']
  team: SalesPeriodTeamFilter
  theme: Theme
}) {
  const [legendSelection, setLegendSelection] = useState(initialMonthlyLegendSelection)

  return (
    <Panel
      subtitle="Comercial e Corporativo em volume. O valor mensal soma os times visíveis na legenda; sem nenhum time visível, volta ao total do filtro superior."
      title="Evolução mensal das vendas"
    >
      <Chart
        height={306}
        onEvents={{
          legendselectchanged: (params) => {
            if (typeof params !== 'object' || params === null || !('selected' in params)) return
            const { selected } = params as { selected: unknown }
            if (typeof selected !== 'object' || selected === null) return
            setLegendSelection({ ...(selected as Record<string, boolean>) })
          },
        }}
        option={makeOverviewMonthlyOptions(monthly, theme, team, legendSelection)}
      />
    </Panel>
  )
}

/** Ouro, prata e bronze com contraste próprio em cada tema. */
const medalColors: Record<number, { readonly light: string; readonly dark: string; readonly name: string }> = {
  1: { light: '#a1740a', dark: '#f2c14e', name: 'medalha de ouro' },
  2: { light: '#596577', dark: '#cbd5e1', name: 'medalha de prata' },
  3: { light: '#96551f', dark: '#e0a06a', name: 'bronze' },
}

/**
 * Top 5 Vendedores.
 *
 * O ranking ignora o filtro Vendedor, como os painéis de cidade e de time
 * ignoram os seus: `selectedSellerId` serve só para destacar a linha. Reduzir
 * o ranking a um nome só transformaria a comparação em um número solto.
 */
function SellerRanking({
  selectedSellerId,
  snapshot,
  theme,
}: {
  selectedSellerId: string | null
  snapshot: CommercialOverviewSnapshot
  theme: Theme
}) {
  // Mesma régua dos demais rankings: comprimento proporcional ao primeiro
  // colocado. Era o único dos quatro painéis de ranking sem barra nenhuma.
  const max = Math.max(...snapshot.topSellers.map((seller) => seller.activeSales), 1)

  return (
    <Panel
      subtitle="Ranking por quantidade de vendas ativadas no recorte."
      title="Top 5 Vendedores"
    >
      {snapshot.topSellers.length === 0 ? <EmptyPanel /> : (
        <ol className="mt-3 space-y-2">
          {snapshot.topSellers.map((seller) => {
            const medal = medalColors[seller.position]
            const selected = seller.sellerId === selectedSellerId
            return (
              <li
                aria-current={selected ? 'true' : undefined}
                className={`grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg border px-2 py-1.5 ${selected ? selectedRowClass : 'border-[var(--divider)]'}`}
                key={seller.sellerId}
              >
                {medal === undefined ? (
                  <span className="font-mono text-[11px] font-bold text-[#2f7de1]">{seller.position}º</span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Medal
                      aria-hidden="true"
                      size={16}
                      style={{ color: theme === 'dark' ? medal.dark : medal.light }}
                    />
                    {/* A posição continua no nome acessível mesmo virando ícone. */}
                    <span className="sr-only">{seller.position}º lugar, {medal.name}</span>
                  </span>
                )}
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-tight text-[var(--text-item)]">
                    <span className="truncate" title={seller.sellerName}>
                      {seller.sellerName}
                    </span>
                    {selected ? (
                      <FilterTag description="Vendedor selecionado no filtro superior." />
                    ) : null}
                  </p>
                  {/* Time em branco não vira Corporativo por descuido: o
                      vendedor sem vínculo de equipe aparece como sem time. */}
                  <p className="mt-0.5 truncate text-[10.5px] leading-tight text-[var(--text-secondary)]">{sellerTeamLabel(seller.team)} · {formatPercent(seller.share)}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                    <div className="h-full rounded-full bg-[#2f7de1]" style={{ width: `${(seller.activeSales / max) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <strong className="font-mono text-[13px] leading-tight text-[var(--text-heading)]">{formatNumber(seller.activeSales)}</strong>
                  <p className="whitespace-nowrap text-[10.5px] leading-tight text-[var(--text-secondary)]">{currency.format(seller.monthlyRevenue)}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

function PlansRanking({ snapshot }: { snapshot: CommercialOverviewSnapshot }) {
  const max = Math.max(...snapshot.topPlans.map((plan) => plan.activeSales), 1)
  return (
    <Panel subtitle="Planos ordenados por quantidade de vendas ativadas." title="Top 5 Planos">
      {snapshot.topPlans.length === 0 ? <EmptyPanel /> : (
        <ol className="mt-4 space-y-3">
          {snapshot.topPlans.map((plan) => (
            <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-1.5" key={plan.id}>
              <span className="font-mono text-[11px] font-bold text-[#2f7de1]">{plan.position}º</span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <strong className="truncate text-[var(--text-item)]" title={plan.label}>{plan.label}</strong>
                  <span className="flex-none text-[10.5px] text-[var(--text-secondary)]">{formatPercent(plan.share)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                  <div className="h-full rounded-full bg-[#2f7de1]" style={{ width: `${(plan.activeSales / max) * 100}%` }} />
                </div>
                {/* `truncate` em vez de `whitespace-nowrap`: dentro de uma
                    coluna `minmax(0,1fr)` o texto sem quebra transbordaria o
                    painel em vez de recortar. */}
                <p className="mt-1 truncate text-[10.5px] text-[var(--text-secondary)]" title={`${currency.format(plan.monthlyValue)} mensais`}>{currency.format(plan.monthlyValue)} mensais</p>
              </div>
              <strong className="font-mono text-[13px] text-[var(--text-heading)]">{formatNumber(plan.activeSales)}</strong>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function Panel({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className={panelClass}>
      <h2 className="text-[13.5px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-0.5 text-[11px] leading-[1.45] text-[var(--text-secondary)]">{subtitle}</p>
      {children}
    </section>
  )
}

function EmptyPanel() {
  return <p className="mt-5 rounded-lg bg-[var(--hover-bg)] p-4 text-center text-[11px] text-[var(--text-secondary)]">Nenhuma venda ativada corresponde aos filtros.</p>
}

/** Rótulo do time no ranking. Sem time é estado válido, não é Corporativo. */
function sellerTeamLabel(team: SalesPeriodTeam | null): string {
  if (team === 'comercial') return 'Comercial'
  if (team === 'corporativo') return 'Corporativo'
  return 'Sem time'
}

function StatePanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={`${panelClass} py-10 text-center`}>
      <h2 className="text-[14px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{children}</p>
    </section>
  )
}

/**
 * Descreve o histórico exibido a partir da coleção recebida.
 *
 * Nada é fixado no texto: se a fonte passar a entregar doze meses, a frase
 * acompanha sem alteração de código.
 */
function describeMonthlyRange(monthly: CommercialOverviewSnapshot['monthly']): string {
  if (monthly.length === 0) return 'nenhum mês disponível'
  const first = monthly[0]
  const last = monthly[monthly.length - 1]
  const year = first.month.slice(0, 4)
  if (monthly.length === 1) return `${first.label} de ${year}`
  return `${first.label} a ${last.label} de ${year}`
}

/**
 * Comparação dos cards de volume, nas duas formas que o card precisa.
 *
 * `delta` é o texto comparativo exibido na frente do card, montado pelo helper
 * comercial compartilhado, com `vs. período anterior` na tela e a expressão completa no
 * conteúdo acessível. `reading` é a frase da leitura gerencial, que continua
 * exatamente como estava: o texto da leitura não faz parte deste bloco.
 */
function changeText(rate: number | null, subject: string): {
  delta: CommercialCardDelta
  reading: string
} {
  const delta = buildCommercialDelta(rate, subject)

  if (rate === null) return { delta, reading: 'Ainda não há base anterior comparável.' }
  if (rate > 0) {
    return {
      delta,
      reading: `O indicador cresceu {${formatPercent(rate)}} frente ao período anterior.`,
    }
  }
  if (rate < 0) {
    return {
      delta,
      reading: `O indicador recuou {${formatPercent(Math.abs(rate))}} frente ao período anterior.`,
    }
  }
  return { delta, reading: 'O indicador permaneceu estável frente ao período anterior.' }
}

/**
 * Frase da leitura gerencial derivada do próprio velocímetro.
 *
 * A distância vem de `gauge.gap`, que já foi calculada sobre a meta efetiva
 * inteira. Assim a leitura nunca contradiz o rodapé nem exibe fração de venda.
 */
function gaugeReadingText(
  gauge: OverviewGaugeModel,
  phrases: {
    readonly noGoal: string
    readonly exact: string
    readonly above: (value: string) => string
    readonly below: (value: string) => string
  },
): string {
  const gap = gauge.gap.value
  if (gap === null) return phrases.noGoal
  if (gap === 0) return phrases.exact
  const amount = `${formatNumber(Math.abs(gap))} ${Math.abs(gap) === 1 ? 'venda' : 'vendas'}`
  return gap > 0 ? phrases.above(amount) : phrases.below(amount)
}
