import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BadgeDollarSign,
  CircleCheckBig,
  Clock3,
  History,
  MapPin,
  Medal,
  Share2,
  // Ícone da Meta Comercial, que saiu da coleção em 15/09/2026.
  // Target,
  Timer,
  UserPlus,
  UsersRound,
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
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  formatIsoAsBrDate,
} from '../../../data/commercialCalendar'
import {
  fetchCommercialOverview,
  type CommercialOverviewApiResult,
} from './commercialOverviewApi'
import type { CommercialCityId, CommercialDataset } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  buildCommercialDelta,
  // Cor de identidade do card: hoje pinta a barra do Novos Clientes, e volta a
  // pintar o velocímetro quando a Meta Comercial voltar.
  commercialCardColors,
  type CommercialCardDelta,
  type CommercialCardTone,
} from '../components/commercialCardModel'
import { ExecutiveMetricCard } from '../../../components/dashboard/ExecutiveMetricCard'
import type { SalesPeriodTeam, SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import { OverviewFilters } from './OverviewFilters'
import {
  ACTIVATION_RULE,
  activationDelta,
  bandsReading,
  daysAmount,
  orLessDays,
} from './overviewActivationModel'
import { activeSalesRuleReading } from './overviewActiveSalesModel'
import {
  buildTeamDetail,
  initialMonthlyLegendSelection,
  makeOverviewMonthlyOptions,
  makeOverviewTeamOptions,
} from './overviewChartOptions'
import {
  initialCohortLegendSelection,
  makeOverviewCohortOptions,
} from './overviewCohortChartOptions'
/*
 * Meta Comercial suspensa em 15/09/2026, decisão do Mário: a empresa ainda não
 * tem a regra do número, e um alvo sem regra vira cobrança sem base. O card
 * saiu da coleção e o Tempo até a ativação ocupou a vaga. Nada foi apagado: o
 * velocímetro, o modelo dele e os testes continuam inteiros, e este arquivo
 * marca com comentário cada ponto que precisa voltar junto.
 *
 * import { OverviewGauge, OverviewGaugeFooter } from './OverviewGauge'
 * import {
 *   buildOverviewGaugeModel,
 *   goalPeriodLabel,
 *   type OverviewGaugeModel,
 * } from './overviewGaugeModel'
 */
import {
  awaitingObserve,
  awaitingReadingText,
  awaitingReadingTitle,
} from './overviewAwaitingModel'
import {
  buildCommercialOverviewSnapshot,
  customerMixFront,
  initialCommercialOverviewFilters,
  openingPeriodCorrection,
  type CommercialOverviewFilters,
  type CommercialOverviewSnapshot,
  type OverviewActivationBand,
  type OverviewActivationBandId,
  type OverviewActivationDays,
  type OverviewAwaitingActivation,
  type OverviewAwaitingStage,
  type OverviewAwaitingStageId,
  type OverviewBreakdown,
  type OverviewCustomerMix,
  type OverviewCustomerMixFront,
  type OverviewCustomerMixPart,
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
 * Quatro degraus do âmbar do card Aguardando Ativação, um por etapa.
 *
 * Etapa não é sucesso nem erro, então nenhum degrau usa verde ou vermelho: os
 * quatro são variações da própria identidade do card, do mais escuro no início
 * para o mais claro no fim. A cancelada antes de ativar herda o último degrau,
 * e não um vermelho: ela é o fim da fila deste card, e pintá-la de alerta
 * criaria um sinal que a página não dá a nenhuma outra saída. A cor também
 * nunca é o único identificador, porque cada etapa traz label e quantidade na
 * grade abaixo da barra.
 *
 * No tema escuro os degraus sobem um passo. O primeiro deles, `#b45309`, é
 * pouco separado da superfície `#1f2937` do card no escuro, e o degrau mais
 * claro ganha um pouco mais de corpo para não estourar sobre o mesmo fundo.
 */
const awaitingColors: Record<'light' | 'dark', Record<OverviewAwaitingStageId, string>> = {
  light: {
    pendente: '#b45309',
    assinada: '#d97706',
    agendada: '#f59e0b',
    cancelada: '#fbbf24',
  },
  dark: {
    pendente: '#c9700f',
    assinada: '#e8890b',
    agendada: '#f7ab24',
    cancelada: '#fbd25d',
  },
}

/**
 * Quatro degraus do azul do card Tempo até a ativação, um por faixa de espera.
 *
 * Mesma gramática dos degraus de Aguardando Ativação, e pelo mesmo motivo:
 * faixa de espera não é sucesso nem erro enquanto a empresa não definir um
 * prazo aceitável, e pintar `4 dias ou mais` de vermelho seria inventar esse
 * prazo. Os quatro são variações da identidade do próprio card, do mais escuro
 * no começo da fila para o mais claro no fim, e a cor nunca é o único
 * identificador: cada faixa traz rótulo e quantidade na grade abaixo da barra.
 *
 * No tema escuro os degraus sobem um passo, para não sumirem contra a
 * superfície `#1f2937` do card.
 */
const activationColors: Record<'light' | 'dark', Record<OverviewActivationBandId, string>> = {
  light: {
    'mesmo-dia': '#1e40af',
    '1-dia': '#2563eb',
    '2-a-3-dias': '#3b82f6',
    '4-dias-ou-mais': '#60a5fa',
  },
  dark: {
    'mesmo-dia': '#2563eb',
    '1-dia': '#3b82f6',
    '2-a-3-dias': '#60a5fa',
    '4-dias-ou-mais': '#93c5fd',
  },
}

/**
 * Cor das duas parcelas que acompanham o Novos Clientes.
 *
 * Aqui não cabe a rampa de um matiz só, como nos dois cards de composição: as
 * parcelas não são degraus de uma mesma escala, são dois grupos de cliente com
 * significados diferentes. Cada uma recebe uma cor da paleta que o portal já
 * usa, o azul de dados para a venda dentro da carteira e o verde institucional
 * para quem retornou.
 *
 * As duas medem contra as duas superfícies, e no limite mais duro, o do texto
 * da participação: `#2f6bff` dá 4,6 sobre o claro e `#00844d` dá 4,8, os dois
 * acima dos 4,5 que texto pede. No escuro elas sobem um passo, para `#7e9bff`,
 * o azul que a página já usa nos filtros, e para `#34d372`, o verde da
 * identidade. A cor nunca identifica sozinha: cada bloco traz rótulo,
 * contagem e participação.
 */
const mixColors: Record<'light' | 'dark', Record<OverviewCustomerMixPart['id'], string>> = {
  light: {
    'da-base': '#2f6bff',
    retornaram: '#00844d',
  },
  dark: {
    'da-base': '#7e9bff',
    retornaram: '#34d372',
  },
}

/** Ícone de cada parcela, na mesma ordem em que a frente do card as mostra. */
const mixIcons: Record<OverviewCustomerMixPart['id'], LucideIcon> = {
  'da-base': UsersRound,
  retornaram: History,
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
   * A cobertura real do banco só chega junto da primeira resposta, então a
   * página abre no período da base sintética e corrige o recorte assim que
   * sabe até onde a fonte vai.
   *
   * Vira verdadeiro na primeira resposta que traz cobertura E em qualquer
   * escolha de data feita na tela. Uma resposta sem cobertura NÃO fecha o
   * assunto, porque o recorte continua sendo o da base sintética; o que fecha
   * é a pessoa ter escolhido o período dela, que o portal não pode desfazer.
   */
  const periodSettled = useRef(false)

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
   * parâmetros do contrato viajam na consulta (período, cidade, time,
   * vendedor e tipo de cliente).
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

        // Recorte de abertura recalculado sobre a cobertura do banco: dia 1 do
        // mês corrente até hoje, ou até a última data com dado quando a carga
        // está atrasada. Cidade, time, vendedor e tipo de cliente ficam como
        // estão, para não apagar uma escolha feita enquanto a consulta ia e
        // voltava.
        if (periodSettled.current || result.period === null) return
        periodSettled.current = true
        const corrected = openingPeriodCorrection(filters, result.period)
        if (corrected !== null) setFilters(corrected)
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
   * Ligada ao serviço, é quem criou contrato na base do SGI, como o serviço
   * manda desde 14/09/2026; se um serviço anterior não mandar a lista, o
   * seletor fica vazio e o painel de filtros o desabilita, em vez de oferecer
   * um filtro sem efeito nenhum sobre os números. Na base local, os vendedores
   * da base sintética.
   */
  const sellers = isBiApiConfigured ? (apiResult?.sellers ?? []) : (dataset?.sellers ?? [])
  /**
   * Aviso sob o seletor, só ligada ao serviço: o SGI registra o vendedor do
   * contrato desde junho de 2026, então um recorte por vendedor em meses
   * anteriores sai vazio de propósito, e não por falha. Curto o bastante para
   * uma linha sob o campo, senão o aviso vira um bloco embaixo do seletor.
   */
  const sellersHint = isBiApiConfigured ? 'Registrado no SGI desde junho de 2026.' : undefined
  /**
   * Opções do filtro Tipo de cliente.
   *
   * Só existem ligada ao serviço, que classifica a venda pelo documento do
   * cliente no SGI. A base sintética não guarda esse dado, então a lista fica
   * vazia e o painel desabilita o seletor, dizendo que a limitação é dos dados
   * em uso, e não do serviço.
   */
  const personTypes = isBiApiConfigured ? (apiResult?.personTypes ?? []) : []

  /**
   * Cobertura da base que prende os calendários dos filtros. Ligada ao
   * serviço, é a cobertura real do banco (`source.period`), que ganha um mês a
   * cada virada; sem ela, ou na base sintética, vale a cobertura fixa de
   * janeiro a julho de 2026.
   */
  const period = (isBiApiConfigured ? apiResult?.period : null) ?? {
    start: COMMERCIAL_PERIOD_START,
    end: COMMERCIAL_PERIOD_END,
  }
  /**
   * Data real da fonte para o selo do cabeçalho, como a Visão Geral de OS faz
   * desde o commit 8e037cd. Só existe ligada ao serviço; na base sintética o
   * cabeçalho mantém a data padrão da área.
   */
  const updatedAt = isBiApiConfigured ? (apiResult?.updatedAt ?? null) : null

  // O selo do cabeçalho diz o que está acontecendo com a fonte: buscando,
  // indisponível, ou atualizado de verdade, e em que data.
  useReportPageSourceStatus(
    error !== null ? 'unavailable' : snapshot === null || refreshing ? 'loading' : 'ready',
    updatedAt === null ? null : formatIsoAsBrDate(updatedAt),
  )

  if (error !== null) return <StatePanel title="Não foi possível montar a Visão Geral">{error}</StatePanel>
  if (snapshot === null) {
    return <StatePanel title="Montando a Visão Geral">Preparando os indicadores executivos.</StatePanel>
  }

  const monthlyRangeLabel = describeMonthlyRange(snapshot.monthly)

  /**
   * Troca de filtros vinda da tela. Mudar Início ou Fim encerra a correção
   * automática de período: a partir daí o recorte é escolha da pessoa, e uma
   * resposta que chegue depois não pode substituí-lo.
   */
  function handleFiltersChange(next: CommercialOverviewFilters) {
    if (next.startDate !== filters.startDate || next.endDate !== filters.endDate) {
      periodSettled.current = true
    }
    setFilters(next)
  }

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
          onChange={handleFiltersChange}
          periodEnd={period.end}
          periodStart={period.start}
          personTypes={personTypes}
          sellers={sellers}
          sellersHint={sellersHint}
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
        {/* Com a Meta Comercial suspensa, a coleção deixou de precisar do mês
            da meta e do time selecionado:
            goalPeriodLabel={goalPeriodLabel(filters.startDate, filters.endDate)}
            team={filters.team} */}
        <ExecutiveCards snapshot={snapshot} theme={theme} />

        {/* Safra de vendas por mês (decisão do Mário em 18/09/2026), logo
            abaixo dos cards porque é a continuação de dois deles: o gestor lê
            quantos aguardam ativação e a pergunta seguinte é de que meses
            são. Mostra todos os meses da base, pela data da venda; o período
            da página não vale aqui, e o subtítulo diz isso. */}
        <CohortPanel cohorts={snapshot.cohorts} theme={theme} />

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
            dizer que nenhum valor foi extraído do SGI deixaria de ser verdade;
            no lugar, ela explica o "Sem time" do painel de times e do gráfico
            mensal, que é agrupamento provisório do cadastro, não um time. */}
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {isBiApiConfigured
            ? 'Visão executiva com a base entregue pelo serviço de BI. '
            : 'Visão executiva com dados sintéticos. '}
          O recorte dos indicadores e rankings é {snapshot.periodLabel}; o histórico mensal mostra{' '}
          {monthlyRangeLabel} com cidade e time aplicados. Vendas por cidade, Vendas por time e
          Origem das vendas são comparativos: cada um ignora o filtro da própria dimensão e apenas
          destaca a seleção.
          {isBiApiConfigured
            ? ' Sem time reúne vendas de vendedor sem equipe no SGI e vendas sem vendedor registrado.'
            : ' Nenhum valor foi extraído do SGI.'}
        </p>
      </div>
    </>
  )
}

function ExecutiveCards({
  // Suspensos com a Meta Comercial:
  // goalPeriodLabel: goalPeriod,
  snapshot,
  // team,
  theme,
}: {
  /** Mês da meta, `Set/26`, para o rodapé do velocímetro dizer de quando ela é. */
  // goalPeriodLabel: string
  snapshot: CommercialOverviewSnapshot
  // team: SalesPeriodTeamFilter
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
  /* Suspenso com a Meta Comercial. O filtro exclusivo do Corporativo chegava
     explícito à coleção: era ele que distinguia "não se aplica" de uma meta
     simplesmente ausente no recorte.
  const corporateOnly = team === 'corporativo' */
  const activeDelta = changeText(metrics.activeSalesChangeRate, 'O volume de vendas ativadas')
  const valueDelta = changeText(snapshot.monthlyValueChangeRate, 'O valor das vendas ativadas')
  // O ticket médio sobe para a frente do card de valor: é a leitura que
  // qualifica o total. Sem ativações não existe divisão possível, e nenhum
  // R$ 0,00 é mostrado como se fosse ticket.
  const averageTicketDetail =
    metrics.activeSales === 0
      ? 'Ticket médio: sem ativações'
      : `Ticket médio de ${currency.format(metrics.averageTicket)}`
  // A leitura gerencial do mesmo card repete o ticket, então ela precisa da
  // mesma ressalva: sem ativações, `metrics.averageTicket` é zero por guarda
  // de divisão, e escrever R$ 0,00 ali seria apresentar ausência como valor.
  const averageTicketReading =
    metrics.activeSales === 0
      ? 'Sem ativações no recorte, não há ticket médio.'
      : `O ticket médio ficou em {${currency.format(metrics.averageTicket)}}.`
  /* Suspenso com a Meta Comercial. O velocímetro era a única fonte de meta
     efetiva, percentual e distância, e a leitura gerencial lia dele, e não das
     métricas brutas, para nunca divergir do que o card mostrava.
  const goalGauge = buildOverviewGaugeModel({
    indicator: 'Meta Comercial',
    targetTerm: 'Meta',
    targetPeriodLabel: goalPeriod,
    achieved: metrics.goalAchieved,
    target: metrics.goal,
    previousAchieved: snapshot.previousGoalAchieved,
    corporateOnly,
  }) */
  const cards: OverviewCard[] = [
    {
      icon: CircleCheckBig,
      label: 'Vendas ativadas',
      value: formatNumber(metrics.activeSales),
      delta: activeDelta.delta,
      tone: 'green',
      readingTitle: `${formatNumber(metrics.activeSales)} vendas foram ativadas no recorte.`,
      // A taxa de ativação saiu daqui em 16/09/2026, decisão do Mário: ela
      // dividia as ativações por contratos de outra régua, a data do evento, e
      // a conversão passou a morar no card Aguardando Ativação, pela data da
      // venda. No lugar entra a régua deste número, para ele não ser lido como
      // o Total de Vendas do SGI. Desde 17/09/2026 a régua diz também que
      // cancelamento posterior não tira a venda do mês, e separa a venda do
      // próprio período da herdada; textos em `overviewActiveSalesModel`.
      readingText: `${activeDelta.reading} ${activeSalesRuleReading(metrics.activeSales, snapshot.activeSalesSoldEarlier)}`,
      observe: 'Evolução do volume de vendas ativadas frente ao período anterior.',
    },
    {
      icon: BadgeDollarSign,
      // Nome do indicador no card. O conceito de negócio continua sendo o valor
      // mensal ativado, preservado na leitura gerencial e nos campos técnicos.
      label: 'Valor Vendas Ativadas',
      value: currency.format(metrics.monthlyRevenue),
      delta: valueDelta.delta,
      tone: 'blue',
      detail: averageTicketDetail,
      detailAccessibleText: `${averageTicketDetail}.`,
      readingTitle: `${currency.format(metrics.monthlyRevenue)} em valor mensal ativado.`,
      readingText: `${valueDelta.reading} ${averageTicketReading}`,
      observe: 'Crescimento do valor recorrente e comportamento do ticket médio.',
    },
    newCustomersCard(snapshot.customerMix, metrics.activeSales),
    /* Meta Comercial suspensa em 15/09/2026. Para voltar, descomente este card
       junto dos outros pontos marcados no arquivo.
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
    }, */
    activationTimeCard(snapshot.activationDays, snapshot.previousActivationDaysMedian),
    awaitingActivationCard(snapshot.awaitingActivation),
  ]

  return (
    <section
      aria-label="Indicadores executivos da operação comercial"
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      ref={containerRef}
    >
      {/* Com a Meta Comercial suspensa, nenhum card tem rodapé. A prop que
          desenhava o do velocímetro volta junto com ela:
          footer={
            card.gauge === undefined ? undefined : (
              <OverviewGaugeFooter model={card.gauge} theme={theme} />
            )
          } */}
      {/* Nenhum card desta página tem frase na base. Ela saiu em 16/09/2026, a
          pedido do Mário: o que o indicador é já está no rótulo e na leitura
          gerencial, e a linha extra só afastava o conteúdo. A prop continua no
          componente, que é compartilhado com outras páginas. */}
      {cards.map((card) => (
        <ExecutiveMetricCard
          accessibleText={cardAccessibleText(card)}
          delta={card.delta}
          detail={card.detail}
          icon={card.icon}
          key={card.label}
          label={card.label}
          // Piso da fileira, herdado do velocímetro, que era o card mais alto:
          // as linhas de baixo (três colunas no lg, duas no sm) acompanham a
          // altura dele. Mantido na saída da meta para a fileira não encolher.
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
 * significa velocímetro, `stages` ou `bands` significa composição em barra e o restante é
 * minigráfico. Assim não existe a possibilidade de um card declarar uma
 * variante e trazer o conteúdo de outra.
 */
type OverviewCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly tone: CommercialCardTone
  readonly value?: string
  readonly delta?: CommercialCardDelta
  // Volta com a Meta Comercial:
  // readonly gauge?: OverviewGaugeModel
  /** Texto curto abaixo do valor, já pronto para a tela. */
  readonly detail?: string
  /**
   * Frase do detalhe no nome acessível, para quando `equivalentes a` não o
   * descreve. O ticket médio não é uma fração do valor total, então o card
   * declara a própria frase em vez de herdar a das participações.
   */
  readonly detailAccessibleText?: string
  /**
   * Composição do card Novos Clientes: barra de participação do valor em
   * destaque e um bloco para cada uma das outras duas parcelas. Diferente de
   * `stages` e `bands`, a barra aqui não é repartida, ela mede o quanto o
   * número principal ocupa das vendas ativadas.
   */
  readonly mix?: OverviewCustomerMixFront
  /** Etapas do card Aguardando Ativação, na mesma barra das faixas da espera. */
  readonly stages?: readonly OverviewAwaitingStage[]
  /** Faixas da espera do card Tempo até a ativação, na mesma barra das etapas. */
  readonly bands?: readonly OverviewActivationBand[]
  readonly readingTitle: string
  readonly readingText: string
  readonly observe: string
}

/**
 * Card Novos Clientes.
 *
 * Mostra quantas das vendas ativadas do recorte são de gente que nunca comprou
 * antes, que é o crescimento real da base. A regra está documentada em
 * `OverviewCustomerMix`, e as outras duas parcelas do mesmo total, cliente que
 * já tinha ponto ativo e cliente que retornou, aparecem na frente do card desde
 * 17/09/2026, a pedido do Mário: elas respondem de onde veio o crescimento e
 * ficavam escondidas na leitura gerencial, que só abre com clique.
 *
 * O denominador da participação é `metrics.activeSales`, o número que o
 * primeiro card da fileira exibe, e não a soma interna das três parcelas: os
 * dois cards precisam falar do mesmo total.
 *
 * Sem o dado, o card diz isso em vez de mostrar zero. Zero cliente novo é uma
 * afirmação forte, e ela não pode sair de uma fonte que apenas não sabe
 * separar cliente novo de cliente antigo.
 */
function newCustomersCard(
  mix: OverviewCustomerMix | null,
  activeSales: number,
): OverviewCard {
  const base = {
    icon: UserPlus,
    label: 'Novos Clientes',
    tone: 'cyan',
  } as const

  if (mix === null) {
    return {
      ...base,
      value: 'Sem dado',
      readingTitle: 'A fonte em uso não diz quem já era cliente.',
      readingText:
        'Para saber se alguém comprou pela primeira vez é preciso o histórico de contratos de cada cliente, e a base sintética cria um CPF por venda. Ligada ao serviço de BI, a página mostra a divisão real.',
      observe:
        'Com o serviço no ar, a soma das três parcelas fecha com as vendas ativadas do recorte.',
    }
  }

  const change = changeText(mix.changeRate, 'O volume de clientes novos')
  const share = formatPercent(activeSales === 0 ? 0 : mix.newCustomers / activeSales)

  return {
    ...base,
    value: formatNumber(mix.newCustomers),
    delta: change.delta,
    detail: `${share} das vendas ativadas`,
    mix: customerMixFront(mix, activeSales),
    // Recorte estreito, de um vendedor num dia, chega a um cliente só, e a
    // frase precisa continuar em português.
    readingTitle:
      mix.newCustomers === 1
        ? '1 cliente comprou pela primeira vez.'
        : `${formatNumber(mix.newCustomers)} clientes compraram pela primeira vez.`,
    readingText: `${change.reading} Eles são {${share}} das vendas ativadas. Clientes da base com outro contrato: {${formatNumber(mix.expansion)}}. Retornaram depois de cancelar: {${formatNumber(mix.returning)}}.`,
    observe:
      'Se o crescimento vem de cliente novo ou de venda feita dentro da carteira que já existe.',
  }
}

/**
 * Card Tempo até a ativação.
 *
 * Mostra quantos dias o cliente espera entre fechar o contrato e ter o sinal
 * ligado. Ocupou a vaga da Meta Comercial em 15/09/2026 porque responde a
 * mesma pergunta que ela respondia, se o período está bom ou ruim, sem
 * depender de um alvo que a empresa ainda não definiu.
 *
 * O número em destaque é o valor do meio, e não a média: contrato antigo
 * religado depois de mais de dois anos existe na base e deslocaria a média sem
 * representar o dia a dia. Quem mede é o serviço, sobre as vendas ativadas do
 * recorte, e a regra está em `OverviewActivationDays`.
 *
 * Os textos não dizem mediana nem percentil, e essa é a regra do card: quem lê
 * é gestão. O valor do meio vira "metade dos clientes esperou X ou menos", o
 * percentil 90 vira "quase todos", e a comparação sai em dias. A
 * `overviewActivationModel` guarda o porquê de cada escolha.
 *
 * Sem o dado, o card diz isso em vez de mostrar zero, como Novos Clientes já
 * faz: zero dia seria a afirmação de que a ativação é imediata, e a fonte
 * apenas não sabe dizer.
 */
function activationTimeCard(
  days: OverviewActivationDays | null,
  previousMedian: number | null,
): OverviewCard {
  const base = {
    icon: Timer,
    label: 'Tempo até a ativação',
    tone: 'indigo',
  } as const

  if (days === null) {
    return {
      ...base,
      value: 'Sem dado',
      readingTitle: 'A fonte em uso não diz quando a venda foi fechada.',
      readingText:
        'Para saber quanto o cliente esperou são precisas duas datas, a da venda e a do sinal ligado, e esta base só tem a segunda. Ligada ao serviço de BI, a página mostra a espera real.',
      observe: 'Com o serviço no ar, o card mostra quanto o cliente esperou.',
    }
  }

  // Quantos clientes entraram na medida: é a soma das quatro faixas, o mesmo
  // conjunto que gerou o valor do meio. Abaixo do mínimo, a faixa de
  // comparação mostra este número no lugar da seta.
  const measured = days.bands.reduce((total, band) => total + band.count, 0)

  return {
    ...base,
    value: days.medianDays === 0 ? 'Mesmo dia' : daysAmount(days.medianDays),
    delta: activationDelta(days.medianDays, previousMedian, measured),
    // Sem frase na base do card: as faixas logo acima já dizem a distribuição,
    // e a leitura detalhada explica a régua. O texto acessível fica, porque a
    // barra sozinha não se lê em leitor de tela.
    detailAccessibleText: `Metade dos clientes esperou ${orLessDays(days.medianDays)}.`,
    bands: days.bands,
    // O nome do indicador em linguagem de negócio, com o número junto, no mesmo
    // formato dos outros quatro cards da fileira.
    readingTitle:
      days.medianDays === 0
        ? 'A espera típica ficou no mesmo dia.'
        : `A espera típica ficou em ${daysAmount(days.medianDays)}.`,
    // Duas frases, e só: a régua, porque a data da venda não é a mesma coisa
    // que a assinatura do contrato, e a divisão por faixa. A comparação com o
    // período anterior fica só na seta acima, sem repetição em texto.
    readingText: `${ACTIVATION_RULE} ${bandsReading(days.bands)}`,
    observe: 'Se o cliente está esperando mais ou menos do que no período anterior.',
  }
}

/**
 * Card Aguardando Ativação.
 *
 * Responde quanto do que foi VENDIDO no período ainda não virou sinal ligado.
 * É o único card da fileira contado pela data da venda, e é isso que o liga ao
 * Total de Vendas do Relatório de Vendas do SGI: o total vendido aparece na
 * linha de detalhe, e a diferença para as vendas ativadas fica explicada. A
 * regra está em `OverviewAwaitingActivation` e os textos em
 * `overviewAwaitingModel`.
 *
 * Decisão do Mário em 16/09/2026. O card anterior, Status das Assinaturas,
 * dizia que os contratos "ainda podem avançar", e a base de produção mostrou
 * que quase nada avança: em agosto os 73 parados tinham de 16 a 44 dias, os
 * agendados não tinham visita aberta e ativação depois de 30 dias não houve.
 *
 * Sem comparação com o período anterior: no mês em andamento o número inclui
 * venda recente que ainda vai ativar, e compará-lo com um mês fechado diria
 * que a operação piorou quando só o mês está no meio.
 *
 * Sem o dado, o card diz isso em vez de mostrar zero, como Novos Clientes e
 * Tempo até a ativação já fazem.
 */
function awaitingActivationCard(card: OverviewAwaitingActivation | null): OverviewCard {
  const base = {
    icon: Clock3,
    label: 'Aguardando Ativação',
    tone: 'amber',
  } as const

  if (card === null) {
    return {
      ...base,
      value: 'Sem dado',
      readingTitle: 'A fonte em uso não separa vendido de ativado.',
      readingText:
        'O serviço de BI ainda não manda o total vendido pela data do contrato nem a situação atual de cada venda. Atualizado o serviço, o card mostra a divisão real.',
      observe: 'Com o serviço atualizado, o card mostra quantos vendidos não viraram ativação.',
    }
  }

  const { sold, awaiting, stages } = card
  // Progresso da safra: quanto do que foi vendido no período já ativou. É o
  // complemento exato do número em destaque, e o mesmo número que o painel de
  // vendas do SGI mostra como `Ativas`. Sem venda não há divisão, e o zero é
  // guarda: a linha de detalhe diz que nada foi vendido. Fica só em texto: a
  // barra fina verde que o desenhava saiu em 17/09/2026, a pedido do Mário,
  // porque disputava com a barra âmbar das etapas logo abaixo, e as duas
  // mediam totais diferentes.
  const activated = sold - awaiting
  const activatedShareLabel = formatPercent(sold === 0 ? 0 : activated / sold)

  return {
    ...base,
    value: formatNumber(awaiting),
    // O total vendido entra na frente do card de propósito: é o número que o
    // gestor procura quando compara a página com o SGI, e ele não aparecia em
    // lugar nenhum. Desde 17/09/2026 a linha fala do que já ativou, e não do
    // que falta: o número em destaque já é o que falta, e repetir a mesma
    // parcela em percentual não acrescentava nada.
    detail:
      sold === 0
        ? 'Nenhum contrato vendido'
        : `${activatedShareLabel} das ${formatNumber(sold)} vendidas já ativaram`,
    detailAccessibleText:
      sold === 0
        ? 'Nenhum contrato foi vendido no recorte.'
        : `Das ${formatNumber(sold)} vendidas no período, ${formatNumber(activated)} já ativaram, ${activatedShareLabel}.`,
    stages,
    readingTitle: awaitingReadingTitle(card),
    readingText: awaitingReadingText(card),
    observe: awaitingObserve(),
  }
}

function cardVariant(card: OverviewCard): 'spark' | 'gauge' | 'pipeline' {
  // Volta com a Meta Comercial:
  // if (card.gauge !== undefined) return 'gauge'
  if (card.stages !== undefined || card.bands !== undefined) return 'pipeline'
  return 'spark'
}

/**
 * Conteúdo visual da variante.
 *
 * Velocímetro e composições em barra continuam: têm escala própria e dizem
 * algo que o número sozinho não diz. O minigráfico saiu: ele se ajustava ao
 * próprio mínimo e máximo, então cards vizinhos mostravam formas parecidas
 * para grandezas diferentes. O card de valor não desenha mais nada: o ticket
 * médio na linha de detalhe é o que qualifica o total.
 */
function OverviewCardVisual({ card, theme }: { card: OverviewCard; theme: Theme }) {
  /* Volta com a Meta Comercial:
  if (card.gauge !== undefined) {
    return <OverviewGauge baseColor={commercialCardColors[card.tone]} model={card.gauge} />
  } */
  if (card.mix !== undefined) {
    return <CustomerMix mix={card.mix} theme={theme} tone={card.tone} />
  }
  if (card.stages !== undefined) {
    return <AwaitingComposition stages={card.stages} theme={theme} />
  }
  if (card.bands !== undefined) {
    return <ActivationComposition bands={card.bands} theme={theme} />
  }

  return null
}

/*
 * Comparação do velocímetro traduzida para o texto comparativo do card.
 * Suspensa com a Meta Comercial, junto do velocímetro que a alimentava.
 *
 * A fonte continua sendo o modelo do velocímetro: percentual, direção e tom
 * saem de lá. O que muda é só a posição, que passa de texto dentro do SVG para
 * texto em HTML logo abaixo do arco, com a expressão completa disponível para
 * leitor de tela.
 *
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
*/

/**
 * Nome acessível da frente do card, antes da orientação de abrir e fechar.
 *
 * O velocímetro já monta o próprio texto no modelo. O card de composição
 * precisa dizer a divisão por extenso, porque a barra é decorativa e a cor não
 * chega ao leitor de tela.
 */
function cardAccessibleText(card: OverviewCard): string {
  // Volta com a Meta Comercial:
  // if (card.gauge !== undefined) return card.gauge.accessibleText
  // O detalhe entra no nome acessível porque ele qualifica o número: sem isso,
  // quem usa leitor de tela ouviria a contagem sem o recorte a que ela se refere.
  const head =
    card.detailAccessibleText !== undefined
      ? `${card.label}: ${card.value}. ${card.detailAccessibleText}`
      : card.detail === undefined
        ? `${card.label}: ${card.value}.`
        : `${card.label}: ${card.value}, equivalentes a ${card.detail}.`

  // A barra é decorativa, então a divisão inteira precisa estar no texto,
  // nos dois cards de composição.
  const items = card.stages ?? card.bands
  if (items !== undefined) {
    const parts = items.map((item) => `${item.label} ${formatNumber(item.count)}`).join(', ')
    return `${head} ${parts}.`
  }

  if (card.mix === undefined) return head

  // Os blocos das parcelas trazem rótulo curto, e a barra é decorativa: quem
  // usa leitor de tela ouve o nome por extenso, como na leitura gerencial.
  const divisao = card.mix.parts
    .map(
      (part) =>
        `${part.accessibleLabel} ${formatNumber(part.count)}, ${formatPercent(part.share)}`,
    )
    .join(', ')

  return `${head} ${divisao}.`
}

/**
 * Composição do Novos Clientes: barra de participação e dois blocos.
 *
 * Desenho aprovado pelo Mário em 17/09/2026. A barra mede o valor em destaque
 * dentro das vendas ativadas, e é o que separa este card dos dois vizinhos:
 * lá a barra é repartida entre as etapas, aqui ela é uma medida sobre o total.
 * Por isso a barra não ganha segmento das outras parcelas, elas vêm nos blocos
 * abaixo com contagem e participação, e as três participações somam 100%.
 *
 * A barra é decorativa para leitor de tela: o percentual dela já está na linha
 * de detalhe logo acima, e os blocos estão inteiros no nome acessível do card.
 */
function CustomerMix({
  mix,
  theme,
  tone,
}: {
  mix: OverviewCustomerMixFront
  theme: Theme
  tone: CommercialCardTone
}) {
  const colors = mixColors[theme === 'dark' ? 'dark' : 'light']

  return (
    <div className="overview-mix mt-2">
      <div
        aria-hidden="true"
        className="h-1.5 overflow-hidden rounded-full bg-[var(--divider)]"
      >
        <div
          className="h-full rounded-full"
          style={{
            background: commercialCardColors[tone],
            width: `${mix.share * 100}%`,
          }}
        />
      </div>

      {/* Lista de definição, não botões: as parcelas informam, e a única ação
          do card continua sendo abrir a leitura gerencial. */}
      <dl className="overview-mix-grid">
        {mix.parts.map((part) => {
          const color = colors[part.id]
          const Icon = mixIcons[part.id]

          return (
            <div
              className="overview-mix-item"
              key={part.id}
              style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
            >
              <span aria-hidden="true" className="overview-mix-icon" style={{ color }}>
                <Icon size={14} />
              </span>
              <div className="overview-mix-body">
                <dt className="overview-mix-term">{part.label}</dt>
                <dd className="overview-mix-value">
                  <span className="overview-mix-count">{formatNumber(part.count)}</span>
                  <span className="overview-mix-share" style={{ color }}>
                    {formatPercent(part.share)}
                  </span>
                </dd>
              </div>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/**
 * Composição de Aguardando Ativação: barra segmentada e grade de etapas.
 *
 * A barra é uma divisão do que aguarda hoje, não uma linha do tempo. Cada
 * segmento ocupa a fatia da etapa dentro desse total, os quatro são contíguos
 * e só as pontas do conjunto são arredondadas, pelo `overflow-hidden` do
 * trilho. Sem nada aguardando nenhum segmento é desenhado e sobra o trilho
 * neutro, que já comunica ausência sem esconder o conteúdo.
 *
 * A barra é decorativa para leitor de tela: a mesma divisão está na grade
 * abaixo, em texto, e o nome acessível do card repete o detalhamento inteiro.
 *
 * O `-mx-2` devolve parte do padding lateral do card, como no rodapé dos
 * velocímetros. Nasceu quando a quarta etapa era `Em aprovação`, de 67,8 px:
 * em 1280 px cada coluna da grade ficava com 75 px para o rótulo mais o
 * marcador, e ele quebrava em duas linhas. Com ele sobram 83 px por coluna. A
 * compensação fica porque a grade é a mesma das faixas da espera, e `4 dias
 * ou +` tem largura parecida.
 */
function AwaitingComposition({
  stages,
  theme,
}: {
  stages: readonly OverviewAwaitingStage[]
  theme: Theme
}) {
  const colors = awaitingColors[theme === 'dark' ? 'dark' : 'light']

  // Só a barra das etapas. Uma barra fina verde de progresso da safra ficou
  // aqui em cima por algumas horas em 17/09/2026 e saiu a pedido do Mário:
  // duas barras coladas, medindo totais diferentes (392 vendidas em cima, 82
  // aguardando embaixo), disputavam a leitura. O progresso continua dito na
  // linha de detalhe, em texto.
  return (
    <CompositionBar
      items={stages.map((stage) => ({ ...stage, color: colors[stage.id] }))}
    />
  )
}

/**
 * Composição da espera até a ativação: a mesma barra das etapas, outras cores.
 *
 * As quatro faixas dividem as ativações medidas do recorte, então a barra
 * mostra a fila inteira: o valor em destaque diz a espera do meio e ela mostra
 * como os clientes se distribuem em volta disso.
 *
 * O afastamento do topo é menor que o da outra composição de propósito. Acima
 * da barra, este card tem a faixa de comparação, que reserva 24 px fixos, e o
 * Aguardando Ativação tem a linha de detalhe, que ocupa 17 px. Sem esta
 * compensação de 7 px as duas barras nascem em alturas diferentes, e elas
 * ficam lado a lado na mesma fileira.
 */
function ActivationComposition({
  bands,
  theme,
}: {
  bands: readonly OverviewActivationBand[]
  theme: Theme
}) {
  const colors = activationColors[theme === 'dark' ? 'dark' : 'light']

  return (
    <CompositionBar
      className="mt-[5px]"
      items={bands.map((band) => ({ ...band, color: colors[band.id] }))}
    />
  )
}

/** Um pedaço da barra de composição, já com a cor resolvida pelo tema. */
type CompositionItem = {
  readonly id: string
  readonly label: string
  readonly count: number
  readonly share: number
  readonly color: string
}

/**
 * Barra segmentada com a grade de rótulos abaixo.
 *
 * Nasceu no card de etapas (Status das Assinaturas, hoje Aguardando Ativação)
 * e passou a servir também ao Tempo até a ativação: os dois dividem um total
 * em partes que somam o todo, e mostrar isso com desenhos diferentes faria a
 * mesma ideia parecer duas.
 */
function CompositionBar({
  className = 'mt-3',
  items,
}: {
  /** Afastamento do topo, que cada card ajusta conforme o que vem acima. */
  className?: string
  items: readonly CompositionItem[]
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className={cn('overview-pipeline -mx-2', className)}>
      <div
        aria-hidden="true"
        className="flex h-2 overflow-hidden rounded-full bg-[var(--divider)]"
      >
        {total === 0
          ? null
          : items.map((item) =>
              item.count === 0 ? null : (
                <div
                  key={item.id}
                  style={{
                    background: item.color,
                    width: `${item.share * 100}%`,
                  }}
                />
              ),
            )}
      </div>

      {/* Lista de definição, não botões: as partes informam, e a única ação do
          card continua sendo abrir a leitura gerencial. */}
      <dl className="overview-pipeline-grid mt-2.5">
        {items.map((item) => (
          <div className="overview-pipeline-item" key={item.id}>
            <dt className="overview-pipeline-term">
              <span
                aria-hidden="true"
                className="overview-pipeline-dot"
                style={{ background: item.color }}
              />
              {item.label}
            </dt>
            <dd className="overview-pipeline-count">{formatNumber(item.count)}</dd>
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
 * A legenda do próprio gráfico liga e desliga cada barra: Comercial,
 * Corporativo e Sem time. O estado fica aqui para que a linha Valor mensal seja
 * recalculada como a soma apenas das barras visíveis, em vez de continuar
 * exibindo o total consolidado.
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
      subtitle="Comercial, Corporativo e Sem time em volume. O valor mensal soma as barras visíveis na legenda; sem nenhuma visível, volta ao total do filtro superior."
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

/**
 * Safra de vendas por mês.
 *
 * O que virou cada mês VENDIDO, pela data da venda e a situação de hoje, a
 * régua do card Aguardando Ativação. Ao lado da Evolução mensal, que conta
 * pelo sinal ligado, responde a outra pergunta: não "o que a operação
 * entregou em cada mês", e sim "quanto do que foi vendido em cada mês já
 * ativou, quanto aguarda e quanto cancelou antes". Mostra todos os meses da
 * base com cidade, time, vendedor e tipo de cliente aplicados; o período não
 * vale aqui, como na Evolução mensal. Um destaque dos meses do período,
 * com os demais apagados, foi testado e descartado pelo Mário em 18/09/2026:
 * todos os meses ficam acesos.
 *
 * Sem o bloco da fonte, o painel diz isso em vez de desenhar um gráfico
 * vazio, como os cards fazem com "Sem dado". A seleção da legenda mora aqui,
 * como na Evolução mensal: as opções são remontadas a cada filtro ou troca
 * de tema, e sem o estado a fatia desligada voltaria sozinha. Regra em
 * `overviewModel`, desenho em `overviewCohortChartOptions`.
 */
function CohortPanel({
  cohorts,
  theme,
}: {
  cohorts: CommercialOverviewSnapshot['cohorts']
  theme: Theme
}) {
  const [legendSelection, setLegendSelection] = useState(initialCohortLegendSelection)

  return (
    <Panel
      subtitle="O que virou cada mês vendido, pela data da venda e a situação de hoje no SGI. Cidade, time, vendedor e tipo de cliente valem; o período não. O mês em andamento ainda vai ativar no ritmo normal."
      title="Safra de vendas por mês"
    >
      {cohorts === null ? (
        <p className="mt-5 rounded-lg bg-[var(--hover-bg)] p-4 text-center text-[11px] text-[var(--text-secondary)]">
          A fonte em uso ainda não separa a safra por mês vendido.
        </p>
      ) : (
        <Chart
          height={260}
          onEvents={{
            legendselectchanged: (params) => {
              if (typeof params !== 'object' || params === null || !('selected' in params)) return
              const { selected } = params as { selected: unknown }
              if (typeof selected !== 'object' || selected === null) return
              setLegendSelection({ ...(selected as Record<string, boolean>) })
            },
          }}
          option={makeOverviewCohortOptions(cohorts, theme, legendSelection)}
        />
      )}
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

/*
 * Frase da leitura gerencial derivada do próprio velocímetro.
 * Suspensa com a Meta Comercial.
 *
 * A distância vem de `gauge.gap`, que já foi calculada sobre a meta efetiva
 * inteira. Assim a leitura nunca contradiz o rodapé nem exibe fração de venda.
 *
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
*/
