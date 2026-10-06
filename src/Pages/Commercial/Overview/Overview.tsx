import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BadgeDollarSign,
  CircleCheckBig,
  Download,
  Eye,
  EyeOff,
  History,
  MapPin,
  Medal,
  Share2,
  ShieldAlert,
  // Ícone da Meta Comercial, que saiu da coleção em 15/09/2026.
  // Target,
  Timer,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../../components/charts/Chart'
import {
  ExecutiveCardGrid,
  type ExecutiveGridCard,
} from '../../../components/dashboard/ExecutiveCardGrid'
import { PageStatePanel } from '../../../components/dashboard/PageStatePanel'
import { SectionHeading } from '../../../components/dashboard/SectionHeading'
import { PageStickyHeader } from '../../../components/layout/PageStickyHeader'
import { tintedChipClass } from '../../../components/ui/chipStyles'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { useReportPageSourceStatus } from '../../../contexts/usePageSourceStatus'
import { useAuth } from '../../../contexts/useAuth'
import { usePreferences } from '../../../contexts/usePreferences'
import { cn } from '../../../lib/utils'
import { isBiApiConfigured } from '../../../data/api/biApiClient'
import { fetchCommercialPeriodSales } from '../../../data/api/commercialRecordsSource'
import {
  COMMERCIAL_PERIOD_END,
  COMMERCIAL_PERIOD_START,
  formatIsoAsBrDate,
} from '../../../data/commercialCalendar'
import {
  fetchCommercialOverview,
  type CommercialOverviewApiResult,
} from './commercialOverviewApi'
import type { CommercialDataset } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import { todayISO } from '../../../data/defaultPeriod'
import { periodIncludesToday, periodTitle } from '../../../data/overviewOsFilters'
import { downloadXlsx } from '../../../lib/downloadFile'
import { formatDateTimeBr, formatNumber, formatPercent } from '../../../lib/formatters'
import {
  buildCommercialDelta,
  // Cor de identidade do card: hoje pinta a barra do Novos Clientes, e volta a
  // pintar o velocímetro quando a Meta Comercial voltar.
  commercialCardColors,
  type CommercialCardDelta,
  type CommercialCardTone,
  type CommercialComparison,
} from '../components/commercialCardModel'
import type { SalesPeriodTeam, SalesPeriodTeamFilter } from '../SalesPeriod/salesPeriodModel'
import { OverviewFilters } from './OverviewFilters'
import {
  ACTIVATION_RULE,
  activationDelta,
  bandsReading,
  daysAmount,
  emptyPreviousDelta,
  orLessDays,
} from './overviewActivationModel'
import {
  activeSalesOriginAccessible,
  activeSalesOriginDetail,
  activeSalesRuleReading,
} from './overviewActiveSalesModel'
import {
  buildTeamDetail,
  initialMonthlyLegendSelection,
  makeOverviewMonthlyOptions,
  monthlyFromChartClick,
  monthlyFromMonthIndex,
  monthlyPanelSubtitle,
  type MonthlyChartClick,
  makeOverviewTeamOptions,
} from './overviewChartOptions'
import { SalesListDialog, type SalesListDialogHandle } from './SalesListDialog'
import {
  cohortFromChartClick,
  cohortFromMonthIndex,
  cohortPanelSubtitle,
  initialCohortLegendSelection,
  makeOverviewCohortOptions,
  type CohortChartClick,
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
  MATURITY_CARD_LABEL,
  MATURITY_OBSERVE,
  maturityDelta,
  maturityDetail,
  maturityEmptyReading,
  maturityMissingReading,
  maturityParts,
  maturityRate,
  maturityReadingText,
  maturityReadingTitle,
  type MaturityPart,
} from './overviewMaturityModel'
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
  type OverviewBreakdown,
  type OverviewCustomerMix,
  type OverviewCustomerMixFront,
  type OverviewCustomerMixPart,
  type OverviewMaturity,
} from './overviewModel'
import { situationColors } from './overviewStageColors'
import {
  buildPeriodSalesRows,
  periodRangeOf,
  periodSalesDownloadLabel,
  periodSalesExportHead,
  periodSalesExtraColumns,
  periodSalesFileName,
  periodSoldRecords,
} from './periodSalesExport'
import { buildSalesWorkbook, salesExportInfoTail, todaySalesPageFilters } from './todaySalesExport'
import { TodaySalesStrip } from './TodaySalesStrip'
import {
  canRevealMoney,
  HIDDEN_MONEY,
  moneyText,
  MoneyShownContext,
  useMoneyShown,
} from './moneyVisibility'
import { usePeriodSales } from './usePeriodSales'

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
 * Quatro degraus do azul do card Tempo até a ativação, um por faixa de espera.
 *
 * Mesma gramática dos degraus da fila de ativação (as etapas da faixa Hoje ao
 * vivo, antes a barra do card Aguardando Ativação), e pelo mesmo motivo:
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
 * Aqui não cabe a rampa de um matiz só, como no Tempo até a ativação: as
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
  const { user } = useAuth()
  /**
   * Olho dos valores em reais (regra do Mário em 28/09/2026, em
   * `moneyVisibility`): só Administrador e Executivo abrem, e a página sempre
   * começa com eles escondidos.
   */
  const canReveal = canRevealMoney(user?.profile)
  const [moneyOpen, setMoneyOpen] = useState(false)
  const moneyShown = canReveal && moneyOpen
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
   * Janela de contratos da Safra e da Evolução mensal (25/09/2026). A página
   * só pede a abertura; a seleção e a leitura dos contratos são estado da
   * própria janela, para o clique não redesenhar os gráficos com o ponteiro
   * ainda sobre a barra.
   */
  const salesList = useRef<SalesListDialogHandle>(null)
  /**
   * Quantas vendas o "Baixar N vendas em Excel" do título Resultado do
   * período leva (25/09/2026). Desde 01/10/2026 só a contagem, relida a cada
   * resposta dos cards para fechar com eles, e só depois da primeira: é ela
   * que corrige o período de abertura, e ler antes pediria ao serviço o mês
   * da base sintética à toa. Os contratos vêm no clique.
   */
  const periodSales = usePeriodSales(isBiApiConfigured ? loaded : null, filters)
  const [downloading, setDownloading] = useState(false)

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
        // mês corrente até ontem, ou até a última data com dado quando a carga
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

  if (error !== null) {
    return (
      <PageStatePanel kind="error" title="Não foi possível montar a Visão Geral">
        {error}
      </PageStatePanel>
    )
  }
  if (snapshot === null) {
    return (
      <PageStatePanel title="Montando a Visão Geral">
        Preparando os indicadores executivos.
      </PageStatePanel>
    )
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

  /**
   * Planilha das vendas do período (25/09/2026; desde 02/10/2026, regra do
   * Mário, só os contratos vendidos no período, com uma coluna Sim/Não de
   * ativada no período). Só aparece com a contagem lida e os cards em dia
   * com o recorte: durante a troca de filtro, o número do botão e o dos
   * cards seriam de recortes diferentes. Desde 01/10/2026 os contratos são
   * pedidos ao serviço só no clique, já com os filtros da página e na ordem
   * da planilha.
   */
  const periodSold = periodSales.status === 'ready' && !refreshing ? periodSales.count : null
  const periodCount = periodSold ?? 0
  const filterNames = { cities, sellers }
  const downloadPeriod = () => {
    const range = periodRangeOf(filters)
    setDownloading(true)
    void fetchCommercialPeriodSales(range, filters)
      .then((list) => {
        const sold = periodSoldRecords(list.records)
        const bytes = buildSalesWorkbook(
          buildPeriodSalesRows(sold, todayISO()),
          [
            ...periodSalesExportHead(range),
            ...salesExportInfoTail(
              {
                pageFilters: todaySalesPageFilters(filters, filterNames),
                readAt: list.generatedAt,
                generatedAt: formatDateTimeBr(new Date()),
              },
              sold.length,
            ),
          ],
          periodSalesExtraColumns(sold),
          moneyShown,
        )
        downloadXlsx(bytes, periodSalesFileName(range))
      })
      .catch((cause: unknown) => {
        window.alert(cause instanceof Error ? cause.message : 'Não foi possível baixar os contratos do período.')
      })
      .finally(() => setDownloading(false))
  }
  // Recorte vazio não oferece planilha: seria um arquivo só com o cabeçalho.
  const periodDownload =
    periodCount === 0 ? undefined : (
      <button
        // `impacto-text-action`: no tema escuro o texto e o anel de foco
        // trocam para o verde das demais ações de texto do portal.
        className="impacto-text-action flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        disabled={downloading}
        onClick={downloadPeriod}
        title="Baixa os contratos vendidos no período, com os filtros da página, numa planilha do Excel pronta para tabela dinâmica"
        type="button"
      >
        <Download aria-hidden="true" size={13} />
        {downloading ? 'Preparando a planilha…' : periodSalesDownloadLabel(periodCount)}
      </button>
    )

  return (
    <MoneyShownContext.Provider value={moneyShown}>
      {/* O painel de filtros é a faixa de comando da página: preso ao topo
          do `main`, visualmente contínuo ao cabeçalho, permanece visível
          durante toda a rolagem vertical. Fica FORA do contêiner executivo
          porque a faixa usa a mesma superfície do cabeçalho do portal, e não
          as superfícies mais claras dos painéis no tema escuro. */}
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
      {/* Hoje ao vivo (25/09/2026): as vendas do dia, agora, no molde da faixa
          da Visão Geral de OS. Fica FORA do bloco esmaecido de baixo porque
          tem leitura própria, a cada minuto, e não espera a consulta do
          recorte voltar. */}
      <TodaySalesStrip filters={filters} names={filterNames} theme={theme} />
      {/* Resultado do período, com a etiqueta do período por extenso, como na
          Visão Geral de OS (pedido do Mário em 25/09/2026): o bloco dos cards
          vai para o projetor e para o print sem a faixa de filtros. Com hoje
          dentro do recorte, o aviso fica fora da etiqueta, no tom secundário. */}
      <SectionHeading
        description={
          <>
            <span className={tintedChipClass}>
              {periodTitle({ dateFrom: filters.startDate, dateTo: filters.endDate })}
            </span>
            {periodIncludesToday({ dateTo: filters.endDate })
              ? ' · inclui hoje, ainda em andamento'
              : null}
          </>
        }
        action={periodDownload}
        title="Resultado do período"
      />
      {/* `executive-panel` escopa as superfícies mais claras do tema escuro
          desta página, as mesmas dos painéis executivos do portal, sem tocar
          nos tokens globais.

          Enquanto a consulta do novo recorte não volta, o bloco inteiro fica
          esmaecido e marcado como ocupado: os números continuam legíveis, mas
          param de se apresentar como resposta ao filtro que acabou de ser
          escolhido. */}
      <div
        aria-busy={refreshing}
        className={cn(
          'executive-panel flex flex-col gap-4 transition-opacity duration-200',
          refreshing && 'opacity-50',
        )}
      >
        {/* Com a Meta Comercial suspensa, a coleção deixou de precisar do mês
            da meta e do time selecionado:
            goalPeriodLabel={goalPeriodLabel(filters.startDate, filters.endDate)}
            team={filters.team} */}
        <ExecutiveCards
          moneyShown={moneyShown}
          onToggleMoney={canReveal ? () => setMoneyOpen((open) => !open) : undefined}
          periodSold={periodSold}
          periodStart={filters.startDate}
          snapshot={snapshot}
          theme={theme}
        />

        {/* Safra de vendas por mês (decisão do Mário em 18/09/2026), logo
            abaixo dos cards porque é a continuação de dois deles: o gestor lê
            quantos aguardam ativação e a pergunta seguinte é de que meses
            são. Mostra todos os meses da base, pela data da venda; o período
            da página não vale aqui, e o subtítulo diz isso. Desde 25/09/2026
            a fatia, o nome do mês ou o fundo da coluna abrem os contratos,
            só com o serviço ligado: a base sintética não tem contrato. */}
        <CohortPanel
          cohorts={snapshot.cohorts}
          onOpen={
            isBiApiConfigured
              ? (click) =>
                  salesList.current?.open({ kind: 'cohort', month: click.month, bucket: click.series })
              : undefined
          }
          theme={theme}
        />

        <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
          <CitiesPanel rows={snapshot.topCities} selectedCityIds={filters.cityIds} />
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
              filtrar Comercial com a série Comercial desligada na legenda.
              Desde 25/09/2026 a barra, o nome do mês ou o fundo da coluna abrem
              as ativações do mês, só com o serviço ligado. */}
          <MonthlyPanel
            key={filters.team}
            monthly={snapshot.monthly}
            onOpen={
              isBiApiConfigured
                ? (click) =>
                    salesList.current?.open({ kind: 'monthly', month: click.month, team: click.team })
                : undefined
            }
            team={filters.team}
            theme={theme}
          />
          <SellerRanking selectedSellerIds={filters.sellerIds} snapshot={snapshot} theme={theme} />
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

        {/* Com os filtros que produziram os painéis na tela, e não os recém
            escolhidos: enquanto a consulta nova não volta, o que está
            desenhado ainda é o recorte anterior, e a janela precisa fechar
            com ele. */}
        {isBiApiConfigured ? (
          <SalesListDialog
            filters={loaded?.filters ?? filters}
            names={filterNames}
            ref={salesList}
            theme={theme}
          />
        ) : null}
      </div>
    </MoneyShownContext.Provider>
  )
}

function ExecutiveCards({
  // Suspensos com a Meta Comercial:
  // goalPeriodLabel: goalPeriod,
  moneyShown,
  onToggleMoney,
  periodSold,
  periodStart,
  snapshot,
  // team,
  theme,
}: {
  /** Os R$ estão à vista: valor, ticket e leitura do card de valor. */
  moneyShown: boolean
  /** Liga e desliga os R$ da página; ausente para quem não pode ver (Analista). */
  onToggleMoney?: () => void
  /**
   * Vendidas no período, o N do "Baixar as N vendidas em Excel"; nulo antes
   * de lido, durante a troca de filtro e na base sintética.
   */
  periodSold: number | null
  /** Início do período, para o card dos 90 dias dizer quando o período é cedo demais. */
  periodStart: string
  /** Mês da meta, `Set/26`, para o rodapé do velocímetro dizer de quando ela é. */
  // goalPeriodLabel: string
  snapshot: CommercialOverviewSnapshot
  // team: SalesPeriodTeamFilter
  theme: Theme
}) {
  const { metrics } = snapshot
  /* Suspenso com a Meta Comercial. O filtro exclusivo do Corporativo chegava
     explícito à coleção: era ele que distinguia "não se aplica" de uma meta
     simplesmente ausente no recorte.
  const corporateOnly = team === 'corporativo' */
  // Com o que a comparação compara, desde 25/09/2026 escrito no card
  // (`vs. agosto até o dia 24`), como na Visão Geral de OS. Sem a janela
  // conhecida, o genérico `vs. período anterior`.
  const comparison = snapshot.comparison ?? undefined
  // A janela anterior existe e não teve ativação (um domingo, por exemplo):
  // o card diz isso, e não "Sem período anterior", que seria falso (decisão
  // do Mário em 25/09/2026).
  const emptyPrevious =
    snapshot.previousActiveSales === 0
      ? `Sem ativação ${snapshot.comparison?.within ?? 'no período anterior'}`
      : undefined
  const activeDelta = changeText(
    metrics.activeSalesChangeRate,
    'O volume de vendas ativadas',
    comparison,
    emptyPrevious,
  )
  const valueDelta = changeText(
    snapshot.monthlyValueChangeRate,
    'O valor das vendas ativadas',
    comparison,
    emptyPrevious,
  )
  // O ticket médio sobe para a frente do card de valor: é a leitura que
  // qualifica o total. Sem ativações não existe divisão possível, e nenhum
  // R$ 0,00 é mostrado como se fosse ticket.
  const averageTicketDetail =
    metrics.activeSales === 0
      ? 'Ticket médio: sem ativações'
      : `Ticket médio de ${moneyText(currency.format(metrics.averageTicket), moneyShown)}`
  // A leitura gerencial do mesmo card repete o ticket, então ela precisa da
  // mesma ressalva: sem ativações, `metrics.averageTicket` é zero por guarda
  // de divisão, e escrever R$ 0,00 ali seria apresentar ausência como valor.
  const averageTicketReading =
    metrics.activeSales === 0
      ? 'Sem ativações no recorte, não há ticket médio.'
      : `O ticket médio ficou em {${moneyText(currency.format(metrics.averageTicket), moneyShown)}}.`
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
  const activeOrigin = activeSalesOriginDetail(
    metrics.activeSales,
    snapshot.activeSalesSoldEarlier,
    periodSold,
  )
  const cards: OverviewCard[] = [
    {
      icon: CircleCheckBig,
      label: 'Vendas ativadas',
      value: formatNumber(metrics.activeSales),
      delta: activeDelta.delta,
      tone: 'green',
      // Linha de detalhe desde 18/09/2026, decisão do Mário: a divisão entre
      // venda do próprio período e venda herdada é a ponte entre as duas
      // réguas da página, e ficava só na leitura gerencial, que depende de
      // clique. Na base sintética não há a medida, e a linha some inteira em
      // vez de escrever zero. Sem barra nova: a fileira já tem três, e o texto
      // resolve. Desde 06/10/2026 a primeira linha traz também o vendido no
      // período, o N do botão de baixar, e a herdada desce para a segunda.
      detail: activeOrigin?.main,
      detailNote: activeOrigin?.note,
      detailAccessibleText: activeSalesOriginAccessible(
        metrics.activeSales,
        snapshot.activeSalesSoldEarlier,
        periodSold,
      ),
      readingTitle: `${formatNumber(metrics.activeSales)} vendas foram ativadas no recorte.`,
      // A taxa de ativação saiu daqui em 16/09/2026, decisão do Mário: ela
      // dividia as ativações por contratos de outra régua, a data do evento, e
      // a conversão passou para a régua da data da venda (o card Aguardando
      // Ativação até 28/09/2026, hoje a Safra de vendas por mês). No lugar
      // entra a régua deste número, para ele não ser lido como
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
      value: moneyText(currency.format(metrics.monthlyRevenue), moneyShown),
      headerAction:
        onToggleMoney === undefined ? undefined : (
          <MoneyEye onToggle={onToggleMoney} shown={moneyShown} />
        ),
      delta: valueDelta.delta,
      tone: 'blue',
      detail: averageTicketDetail,
      detailAccessibleText: `${averageTicketDetail}.`,
      readingTitle: `${moneyText(currency.format(metrics.monthlyRevenue), moneyShown)} em valor mensal ativado.`,
      readingText: `${valueDelta.reading} ${averageTicketReading}`,
      observe: 'Crescimento do valor recorrente e comportamento do ticket médio.',
    },
    newCustomersCard(snapshot.customerMix, metrics.activeSales, comparison, emptyPrevious),
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
    activationTimeCard(
      snapshot.activationDays,
      snapshot.previousActivationDaysMedian,
      metrics.activeSales,
      comparison,
      emptyPrevious,
    ),
    // Aguardando Ativação saiu da vaga em 28/09/2026, decisão do Mário: a
    // fila já aparece na Safra e na faixa Hoje ao vivo (ver `maturityCard`).
    maturityCard(snapshot.maturity, snapshot.previousMaturity, periodStart, comparison),
  ]

  // Com a Meta Comercial suspensa, nenhum card tem rodapé. A prop que
  // desenhava o do velocímetro volta junto com ela:
  // footer: card.gauge === undefined ? undefined : <OverviewGaugeFooter model={card.gauge} theme={theme} />
  //
  // Nenhum card desta página tem frase na base. Ela saiu em 16/09/2026, a
  // pedido do Mário: o que o indicador é já está no rótulo e na leitura
  // gerencial, e a linha extra só afastava o conteúdo. A prop continua no
  // componente, que é compartilhado com outras páginas.
  //
  // Piso da fileira, herdado do velocímetro, que era o card mais alto: as
  // linhas de baixo (três colunas no lg, duas no sm) acompanham a altura
  // dele. Mantido na saída da meta para a fileira não encolher.
  return (
    <ExecutiveCardGrid
      ariaLabel="Indicadores executivos da operação comercial"
      cards={cards.map(
        (card): ExecutiveGridCard => ({
          id: card.label,
          // Leitor de tela não soletra a máscara: diz que o valor está escondido.
          accessibleText: cardAccessibleText(card).replaceAll(HIDDEN_MONEY, 'valor escondido'),
          children: <OverviewCardVisual card={card} theme={theme} />,
          delta: card.delta,
          detail: card.detail,
          icon: card.icon,
          label: card.label,
          minHeight: 206,
          observe: card.observe,
          readingText: card.readingText,
          readingTitle: card.readingTitle,
          tone: card.tone,
          value: card.value,
          headerAction: card.headerAction,
          variant: cardVariant(card),
        }),
      )}
      columnsClass="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    />
  )
}

/**
 * Um card da coleção executiva.
 *
 * A variante é derivada do conteúdo, e não declarada duas vezes: `gauge`
 * significa velocímetro, `outcomes` ou `bands` significa composição em barra e o restante é
 * minigráfico. Assim não existe a possibilidade de um card declarar uma
 * variante e trazer o conteúdo de outra.
 */
type OverviewCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly tone: CommercialCardTone
  readonly value?: string
  /** Olho dos R$, só no card de valor e só para quem pode ver. */
  readonly headerAction?: ReactNode
  readonly delta?: CommercialCardDelta
  // Volta com a Meta Comercial:
  // readonly gauge?: OverviewGaugeModel
  /** Texto curto abaixo do valor, já pronto para a tela. */
  readonly detail?: string
  /** Segunda linha do detalhe, logo abaixo dele: a venda herdada no Vendas ativadas. */
  readonly detailNote?: string
  /**
   * Frase do detalhe no nome acessível, para quando `equivalentes a` não o
   * descreve. O ticket médio não é uma fração do valor total, então o card
   * declara a própria frase em vez de herdar a das participações.
   */
  readonly detailAccessibleText?: string
  /**
   * Composição do card Novos Clientes: barra de participação do valor em
   * destaque e um bloco para cada uma das outras duas parcelas. Diferente de
   * `outcomes` e `bands`, a barra aqui não é repartida, ela mede o quanto o
   * número principal ocupa das vendas ativadas.
   */
  readonly mix?: OverviewCustomerMixFront
  /** Bloqueio e cancelamento do card dos 90 dias, na mesma barra das faixas da espera. */
  readonly outcomes?: readonly MaturityPart[]
  /** Faixas da espera do card Tempo até a ativação, na mesma barra de composição. */
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
  comparison?: CommercialComparison,
  emptyPrevious?: string,
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

  const change = changeText(mix.changeRate, 'O volume de clientes novos', comparison, emptyPrevious)
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
 *
 * Recorte sem nenhuma ativação é outro caso, e vem antes: a fonte mede, só
 * não há espera para medir (decisão do Mário em 25/09/2026). Culpar a fonte
 * ali era falso, e o atalho Ontem num domingo leva a ele com um clique.
 */
function activationTimeCard(
  days: OverviewActivationDays | null,
  previousMedian: number | null,
  activeSales: number,
  comparison?: CommercialComparison,
  emptyPrevious?: string,
): OverviewCard {
  const base = {
    icon: Timer,
    label: 'Tempo até a ativação',
    tone: 'indigo',
  } as const

  if (activeSales === 0) {
    return {
      ...base,
      value: 'Sem ativações',
      readingTitle: 'Sem ativações no recorte.',
      readingText:
        'Nenhuma venda teve o sinal ligado no período e nos filtros escolhidos, então não há espera para medir.',
      observe: 'Com ativações no recorte, o card mostra quanto o cliente esperou.',
    }
  }

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
    delta: activationDelta(days.medianDays, previousMedian, measured, comparison, emptyPrevious),
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
 * Card de bloqueio ou cancelamento em 90 dias.
 *
 * Ocupou a vaga do Aguardando Ativação em 28/09/2026, decisão do Mário: a
 * fila do que foi vendido e não ativou já aparece na Safra e na faixa Hoje ao
 * vivo, e faltava o que acontece DEPOIS do sinal ligado. Das vendas que
 * completaram 90 dias no período, quantas estavam em bloqueio financeiro ou
 * canceladas no 90º dia. Quem mede é o serviço, pelo histórico de bloqueio de
 * cada contrato; regra em `OverviewMaturity`, textos em `overviewMaturityModel`.
 *
 * O destaque é percentual e a comparação é em pontos, e subir é piorar. A
 * linha de detalhe diz de quando é o sinal das vendas julgadas: setembro
 * julga as ativadas em junho, e sem isso o número seria lido como sobre as
 * vendas de setembro.
 *
 * Sem medida, o card diz o motivo em vez de mostrar zero, como Novos
 * Clientes e Tempo até a ativação já fazem. O dado do Aguardando Ativação
 * continua chegando do serviço (`snapshot.awaitingActivation`, textos em
 * `overviewAwaitingModel`), para o card poder voltar se o Mário pedir.
 */
function maturityCard(
  maturity: OverviewMaturity | null,
  previous: OverviewMaturity | null,
  periodStart: string,
  comparison?: CommercialComparison,
): OverviewCard {
  const base = {
    icon: ShieldAlert,
    label: MATURITY_CARD_LABEL,
    // Vermelho de identidade, como a Taxa Improdutividade da Visão Geral de
    // OS: o indicador mede venda que deu errado. Bom ou ruim continua sendo
    // papel da comparação, que fica verde quando a parcela cai.
    tone: 'red',
  } as const

  if (maturity === null) {
    const missing = maturityMissingReading(periodStart)
    return {
      ...base,
      value: 'Sem dado',
      readingTitle: missing.title,
      readingText: missing.text,
      observe: missing.observe,
    }
  }

  const rate = maturityRate(maturity)
  if (rate === null) {
    const empty = maturityEmptyReading(maturity)
    return {
      ...base,
      value: 'Sem vendas',
      readingTitle: empty.title,
      readingText: empty.text,
      observe: MATURITY_OBSERVE,
    }
  }

  return {
    ...base,
    value: formatPercent(rate),
    delta: maturityDelta(maturity, previous, comparison),
    detail: maturityDetail(maturity),
    detailAccessibleText: `${maturityDetail(maturity)}.`,
    outcomes: maturityParts(maturity),
    readingTitle: maturityReadingTitle(maturity),
    readingText: maturityReadingText(maturity),
    observe: MATURITY_OBSERVE,
  }
}

function cardVariant(card: OverviewCard): 'spark' | 'gauge' | 'pipeline' {
  // Volta com a Meta Comercial:
  // if (card.gauge !== undefined) return 'gauge'
  if (card.outcomes !== undefined || card.bands !== undefined) return 'pipeline'
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
  if (card.outcomes !== undefined) {
    return <MaturityComposition outcomes={card.outcomes} theme={theme} />
  }
  if (card.bands !== undefined) {
    return <ActivationComposition bands={card.bands} theme={theme} />
  }
  // Mesma letra da linha de detalhe do card, colada nela.
  if (card.detailNote !== undefined) {
    return (
      <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
        {card.detailNote}
      </p>
    )
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
  const items = card.outcomes ?? card.bands
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
 * dentro das vendas ativadas, e é o que separa este card do Tempo até a
 * ativação e do card dos 90 dias: lá a barra é repartida entre as partes do
 * número em destaque, aqui ela é uma medida sobre o total.
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
 * Composição do card dos 90 dias: bloqueio e cancelamento na mesma barra das
 * faixas da espera.
 *
 * As cores são as da coluna Situação das listas da página (aprovadas pelo
 * Mário em 28/09/2026): vermelho para o serviço travado, que ainda tem volta,
 * e cinza para a cancelada, que não tem. A barra divide o número em
 * destaque, e a cor nunca identifica sozinha: a grade abaixo traz o nome e a
 * contagem.
 *
 * O card tem faixa de comparação e linha de detalhe, como o Novos Clientes,
 * e a barra nasce na mesma altura da dele quando o nome do card cabe em
 * duas linhas (o provisório, de 28/09/2026, ocupa três).
 */
/** Situação de cada parte, para a cor: toda parte nova precisa entrar aqui. */
const MATURITY_PART_SITUATION: Record<MaturityPart['id'], 'stuck' | 'closed'> = {
  bloqueio: 'stuck',
  cancelada: 'closed',
}

function MaturityComposition({
  outcomes,
  theme,
}: {
  outcomes: readonly MaturityPart[]
  theme: Theme
}) {
  const colors = situationColors[theme === 'dark' ? 'dark' : 'light']

  return (
    <CompositionBar
      className="mt-2"
      items={outcomes.map((part) => ({
        ...part,
        color: colors[MATURITY_PART_SITUATION[part.id]],
      }))}
    />
  )
}

/**
 * Composição da espera até a ativação: a mesma barra de composição, outras cores.
 *
 * As quatro faixas dividem as ativações medidas do recorte, então a barra
 * mostra a fila inteira: o valor em destaque diz a espera do meio e ela mostra
 * como os clientes se distribuem em volta disso.
 *
 * O afastamento do topo é menor que o da composição padrão. Ele nasceu para
 * alinhar esta barra com a do Aguardando Ativação, que tinha a linha de
 * detalhe (17 px) no lugar da faixa de comparação (24 px). O card dos 90 dias,
 * que ocupou a vaga em 28/09/2026, tem as duas, e alinha a barra dele com a
 * do Novos Clientes (`MaturityComposition`).
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
 * Nasceu no card de etapas (Status das Assinaturas, depois Aguardando
 * Ativação) e serve ao Tempo até a ativação e, desde 28/09/2026, ao card dos
 * 90 dias: os dois dividem um total em partes que somam o todo, e mostrar
 * isso com desenhos diferentes faria a mesma ideia parecer duas.
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
 * de cidade. Aqui `selectedCityIds` serve só para destacar as linhas: um
 * ranking reduzido às cidades marcadas não compara nada.
 */
function CitiesPanel({
  rows,
  selectedCityIds,
}: {
  rows: readonly OverviewBreakdown[]
  selectedCityIds: readonly string[]
}) {
  const moneyShown = useMoneyShown()
  const max = Math.max(...rows.map((row) => row.activeSales), 1)
  return (
    <Panel
      subtitle="Ranking completo do período. O filtro de cidade destaca as selecionadas, sem reduzir a comparação."
      title="Vendas por cidade"
    >
      {rows.length === 0 ? <EmptyPanel /> : (
        <div className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const selected = selectedCityIds.includes(row.id)
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
                  {moneyText(currency.format(row.monthlyValue), moneyShown)} mensais
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
  const moneyShown = useMoneyShown()
  const details = rows.map((row) => buildTeamDetail(row, theme, moneyShown))
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
  const moneyShown = useMoneyShown()

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
                <p className="mt-2 text-[10.5px] text-[var(--text-secondary)]">{moneyText(currency.format(row.monthlyValue), moneyShown)} mensais</p>
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
  onOpen,
  team,
  theme,
}: {
  monthly: CommercialOverviewSnapshot['monthly']
  /** Abre a janela de contratos; ausente com a base sintética, que não tem contrato. */
  onOpen?: (click: MonthlyChartClick) => void
  team: SalesPeriodTeamFilter
  theme: Theme
}) {
  const [legendSelection, setLegendSelection] = useState(initialMonthlyLegendSelection)
  const moneyShown = useMoneyShown()

  return (
    <Panel
      subtitle={monthlyPanelSubtitle(monthly, onOpen !== undefined, team, moneyShown)}
      title="Evolução mensal das vendas"
    >
      <Chart
        height={306}
        // O fundo da coluna do mês, fora das barras, abre o mês inteiro.
        onCategoryClick={
          onOpen === undefined
            ? undefined
            : (index) => {
                const hit = monthlyFromMonthIndex(monthly, index, team)
                if (hit !== null) onOpen(hit)
              }
        }
        onEvents={{
          legendselectchanged: (params) => {
            if (typeof params !== 'object' || params === null || !('selected' in params)) return
            const { selected } = params as { selected: unknown }
            if (typeof selected !== 'object' || selected === null) return
            setLegendSelection({ ...(selected as Record<string, boolean>) })
          },
          ...(onOpen === undefined
            ? {}
            : {
                click: (params: unknown) => {
                  const hit = monthlyFromChartClick(monthly, params, team)
                  if (hit !== null) onOpen(hit)
                },
              }),
        }}
        option={makeOverviewMonthlyOptions(monthly, theme, team, legendSelection, moneyShown)}
      />
    </Panel>
  )
}

/**
 * Safra de vendas por mês.
 *
 * O que virou cada mês VENDIDO, pela data da venda e a situação de hoje. Ao
 * lado da Evolução mensal, que conta pelo sinal ligado, responde a outra
 * pergunta: não "o que a operação entregou em cada mês", e sim "quanto do que
 * foi vendido em cada mês ativou e continua, quanto aguarda e quanto
 * cancelou, antes ou depois do sinal" (desde 28/09/2026). Mostra todos os meses da
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
  onOpen,
  theme,
}: {
  cohorts: CommercialOverviewSnapshot['cohorts']
  /** Abre a janela de contratos; ausente com a base sintética, que não tem contrato. */
  onOpen?: (click: CohortChartClick) => void
  theme: Theme
}) {
  const [legendSelection, setLegendSelection] = useState(initialCohortLegendSelection)

  return (
    <Panel
      subtitle={cohortPanelSubtitle(cohorts, onOpen !== undefined)}
      title="Safra de vendas por mês"
    >
      {cohorts === null ? (
        <p className="mt-5 rounded-lg bg-[var(--hover-bg)] p-4 text-center text-[11px] text-[var(--text-secondary)]">
          A fonte em uso ainda não separa a safra por mês vendido.
        </p>
      ) : (
        <Chart
          height={260}
          // O fundo da coluna do mês, fora das fatias, abre o mês inteiro.
          onCategoryClick={
            onOpen === undefined
              ? undefined
              : (index) => {
                  const hit = cohortFromMonthIndex(cohorts, index)
                  if (hit !== null) onOpen(hit)
                }
          }
          onEvents={{
            legendselectchanged: (params) => {
              if (typeof params !== 'object' || params === null || !('selected' in params)) return
              const { selected } = params as { selected: unknown }
              if (typeof selected !== 'object' || selected === null) return
              setLegendSelection({ ...(selected as Record<string, boolean>) })
            },
            ...(onOpen === undefined
              ? {}
              : {
                  click: (params: unknown) => {
                    const hit = cohortFromChartClick(cohorts, params)
                    if (hit !== null) onOpen(hit)
                  },
                }),
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
 * ignoram os seus: `selectedSellerIds` serve só para destacar as linhas.
 * Reduzir o ranking aos nomes marcados transformaria a comparação em números
 * soltos.
 */
function SellerRanking({
  selectedSellerIds,
  snapshot,
  theme,
}: {
  selectedSellerIds: readonly string[]
  snapshot: CommercialOverviewSnapshot
  theme: Theme
}) {
  // Mesma régua dos demais rankings: comprimento proporcional ao primeiro
  // colocado. Era o único dos quatro painéis de ranking sem barra nenhuma.
  const max = Math.max(...snapshot.topSellers.map((seller) => seller.activeSales), 1)
  const moneyShown = useMoneyShown()

  return (
    <Panel
      subtitle="Ranking por quantidade de vendas ativadas no recorte."
      title="Top 5 Vendedores"
    >
      {snapshot.topSellers.length === 0 ? <EmptyPanel /> : (
        <ol className="mt-3 space-y-2">
          {snapshot.topSellers.map((seller) => {
            const medal = medalColors[seller.position]
            const selected = selectedSellerIds.includes(seller.sellerId)
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
                  <p className="whitespace-nowrap text-[10.5px] leading-tight text-[var(--text-secondary)]">{moneyText(currency.format(seller.monthlyRevenue), moneyShown)}</p>
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
  const moneyShown = useMoneyShown()
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
                <p className="mt-1 truncate text-[10.5px] text-[var(--text-secondary)]" title={`${moneyText(currency.format(plan.monthlyValue), moneyShown)} mensais`}>{moneyText(currency.format(plan.monthlyValue), moneyShown)} mensais</p>
              </div>
              <strong className="font-mono text-[13px] text-[var(--text-heading)]">{formatNumber(plan.activeSales)}</strong>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

/**
 * Olho dos valores em reais, no cabeçalho do card Valor Vendas Ativadas, à
 * esquerda do ícone (pedido do Mário em 28/09/2026).
 *
 * Mostra ou esconde todos os R$ da página. O desenho mostra o estado: olho
 * fechado com os valores escondidos, olho aberto com eles à vista. O clique e o teclado
 * param aqui: sem isso, o mesmo clique viraria o card para a leitura
 * gerencial.
 */
function MoneyEye({ onToggle, shown }: { onToggle: () => void; shown: boolean }) {
  const label = shown ? 'Esconder os valores em reais da página' : 'Mostrar os valores em reais da página'
  const Icon = shown ? Eye : EyeOff

  return (
    <button
      aria-label={label}
      aria-pressed={shown}
      className="flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      onKeyDown={(event) => event.stopPropagation()}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={16} />
    </button>
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
 * comercial compartilhado, com o nome da comparação na tela (`vs. agosto até
 * o dia 24`, ou o genérico `vs. período anterior` sem ele) e a expressão
 * completa no conteúdo acessível. `reading` é a frase da leitura gerencial,
 * que continua exatamente como estava: o texto da leitura não faz parte
 * deste bloco.
 *
 * `emptyPrevious` é a frase do período comparado sem ativação (`Sem ativação
 * no domingo 13/09`): a variação continua indisponível, porque não se divide
 * por zero, mas o card não diz que o período anterior não existe.
 */
function changeText(
  rate: number | null,
  subject: string,
  comparison?: CommercialComparison,
  emptyPrevious?: string,
): {
  delta: CommercialCardDelta
  reading: string
} {
  if (rate === null && emptyPrevious !== undefined) {
    return {
      delta: emptyPreviousDelta(subject, emptyPrevious),
      reading: 'O período comparado não teve ativação, então não há variação para mostrar.',
    }
  }

  const delta = buildCommercialDelta(rate, subject, comparison)

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
