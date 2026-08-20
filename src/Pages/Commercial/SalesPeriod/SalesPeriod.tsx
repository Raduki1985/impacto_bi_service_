import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BadgeDollarSign,
  CircleCheckBig,
  Handshake,
  Receipt,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../../components/charts/Chart'
import type { Theme } from '../../../contexts/PreferencesContextCore'
import { usePreferences } from '../../../contexts/usePreferences'
import { formatIsoAsBrDate } from '../../../data/commercialCalendar'
import type { CommercialDataset, CommercialSaleStatus } from '../../../data/commercialTypes'
import { getCommercialDataset, peekCommercialDataset } from '../../../data/mockCommercialData'
import {
  COMMERCIAL_INSTALLATION_BASE_PRICE,
  COMMERCIAL_INSTALLATION_SERVICE_CODE,
} from '../../../data/mockCommercialInstallations'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  buildCommercialDelta,
  commercialCardColors,
  type CommercialCardDelta,
  type CommercialCardTone,
} from '../components/commercialCardModel'
import {
  CommercialExecutiveCard,
  CommercialSparkline,
} from '../components/CommercialExecutiveCard'
import { SalesPeriodFilters } from './SalesPeriodFilters'
import { ColumnFilterHeader, ListFilterPanel, ValueFilterPanel } from './SalesPeriodColumnFilter'
import {
  buildActiveSalesPage,
  buildActiveSalesSnapshot,
  commercialSaleStatusLabels,
  initialActiveSalesFilters,
  type ActiveSaleRow,
  type ActiveSalesDailyPoint,
  type ActiveSalesFilters,
  type ActiveSalesInstallationMetrics,
  type ActiveSalesOriginSlice,
  type ActiveSalesSnapshot,
} from './salesPeriodModel'
import {
  activeSalesTableColumns,
  applySalesTableFilters,
  buildSalesTableOptions,
  initialSalesTableFilters,
  sortSalesTableRows,
  type SalesTableFilters,
  type SalesTableSort,
} from './salesPeriodTableModel'
import { makeSalesPeriodDailyOptions } from './salesPeriodChartOptions'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

const panelClass =
  'min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4'

/**
 * Comercial > Vendas por Período.
 *
 * Detalhamento das vendas atualmente ativas que começaram no período. O
 * universo é fixo: status atual `Ativa` e Data de Início dentro do recorte.
 * Meta, Supermeta, ranking de vendedores e contratos em fluxo pertencem a
 * outras páginas e não aparecem aqui.
 *
 * Existem dois níveis de filtro. Os superiores recortam a página inteira, e é
 * deles que saem cards, gráfico e composição por origem. Os dos cabeçalhos são
 * locais da tabela: recortam apenas as linhas exibidas e nunca recalculam os
 * indicadores.
 *
 * Todos os clientes, CPFs, contratos, planos e valores são sintéticos.
 */
export function SalesPeriod() {
  const { theme } = usePreferences()
  const [dataset, setDataset] = useState<CommercialDataset | null>(() => peekCommercialDataset())
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ActiveSalesFilters>(initialActiveSalesFilters)
  const [tableFilters, setTableFilters] = useState<SalesTableFilters>(initialSalesTableFilters)
  const [tableSort, setTableSort] = useState<SalesTableSort>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (dataset !== null || error !== null) return

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

  const snapshot = useMemo(
    () => (dataset === null ? null : buildActiveSalesSnapshot(dataset, filters)),
    [dataset, filters],
  )

  // Trocar qualquer filtro devolve a tabela à primeira página: manter a página
  // anterior mostraria um trecho arbitrário de um conjunto que acabou de mudar.
  const handleFiltersChange = (next: ActiveSalesFilters) => {
    setFilters(next)
    setPage(0)
  }
  const handleTableFiltersChange = (next: SalesTableFilters) => {
    setTableFilters(next)
    setPage(0)
  }
  const handleTableSortChange = (next: SalesTableSort) => {
    setTableSort(next)
    setPage(0)
  }

  if (error !== null) return <ErrorPanel message={error} />
  if (dataset === null || snapshot === null) return <LoadingPanel />

  return (
    <div className="flex flex-col gap-4">
      <SalesPeriodFilters
        activeSales={snapshot.metrics.activeSales}
        cities={dataset.cities}
        filters={filters}
        onChange={handleFiltersChange}
        options={snapshot.options}
      />

      <KpiGrid snapshot={snapshot} theme={theme} />

      <div className="grid min-w-0 grid-cols-1 gap-3.5 xl:grid-cols-[1.55fr_1fr]">
        <Panel
          subtitle={`Quantidade e valor mensal contratado por Data de Início, de ${snapshot.periodLabel}.`}
          title="Evolução das vendas ativas iniciadas"
        >
          {snapshot.metrics.activeSales === 0 ? (
            <EmptyPanel>
              Nenhuma venda atualmente ativa tem Data de Início no recorte selecionado.
            </EmptyPanel>
          ) : (
            <>
              <Chart
                height={290}
                minWidth={600}
                option={makeSalesPeriodDailyOptions(snapshot.daily)}
              />
              <DailyChartTable daily={snapshot.daily} periodLabel={snapshot.periodLabel} />
            </>
          )}
        </Panel>

        <OriginsPanel origins={snapshot.origins} total={snapshot.metrics.activeSales} />
      </div>

      <SalesTable
        filters={tableFilters}
        onFiltersChange={handleTableFiltersChange}
        onPageChange={setPage}
        onSortChange={handleTableSortChange}
        page={page}
        rows={snapshot.rows}
        sort={tableSort}
      />

      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
        Esboço com dados sintéticos para validar a matriz funcional. Clientes, CPFs, contratos,
        planos e valores não foram extraídos do SGI. Os valores de instalação também são
        sintéticos: o serviço {COMMERCIAL_INSTALLATION_SERVICE_CODE} e o preço-base de{' '}
        {currency.format(COMMERCIAL_INSTALLATION_BASE_PRICE)} foram confirmados no Sales e no SGI,
        mas a distribuição entre cobrança integral, desconto, isenção e ausência de dado existe
        apenas para validar os cálculos e não representa a operação. A Data de Início ainda vem do
        único campo de data da base mockada, que hoje reúne início e ativação; a integração com o
        Sales/SGI passará a usar o campo real de início. Base mockada atualizada em{' '}
        {formatIsoAsBrDate(dataset.referenceDate)}.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Indicadores                                                                */
/* -------------------------------------------------------------------------- */

type SalesPeriodCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly value: string
  readonly delta: CommercialCardDelta
  readonly detail: string
  readonly points: readonly number[]
  readonly tone: CommercialCardTone
  readonly readingTitle: string
  readonly readingText: string
  /** Bloco `OBSERVAR` da leitura gerencial: o que o minigráfico do card mostra. */
  readonly observe: string
}

/** Valor mostrado quando o recorte não tem dado de instalação nenhum. */
const NO_INSTALLATION_VALUE = 'Sem dados'

/**
 * Comparação do card de instalações quando não existe dado no recorte.
 *
 * Sem instalação apurada não há o que comparar, e o estado indisponível é
 * diferente de "não há período anterior": por isso o texto não é o padrão de
 * `buildCommercialDelta`.
 */
const NO_INSTALLATION_DELTA: CommercialCardDelta = {
  label: 'Sem dados de instalação',
  accessibleLabel: 'O recorte não possui dados de instalação',
  tone: 'indisponivel',
}

/**
 * Os quatro cards do resumo.
 *
 * Usam o mesmo componente da Visão Geral, e não classes parecidas: superfície,
 * espaçamento, ícone, faixas de valor e comparação, minigráfico e leitura
 * gerencial vêm todos de `CommercialExecutiveCard`. O estado "um card aberto por
 * vez" continua aqui, porque é da coleção desta página.
 *
 * As séries dos minigráficos saem da própria evolução diária do recorte, que já
 * respeita os filtros superiores. Nenhum dado novo é criado e nada vem da Visão
 * Geral.
 *
 * `Valor de Instalações` é cobrança ÚNICA e vive num card próprio: ele não se
 * soma ao valor mensal contratado nem ao ticket médio mensal, que são grandezas
 * recorrentes.
 */
function KpiGrid({ snapshot, theme }: { snapshot: ActiveSalesSnapshot; theme: Theme }) {
  const [openCard, setOpenCard] = useState<string | null>(null)
  const containerRef = useRef<HTMLElement>(null)
  const { daily, metrics } = snapshot

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

  // Ticket médio do dia. Dia sem venda não divide por zero e entra como zero,
  // que é como as opções de gráfico já tratam um dia vazio.
  const dailyTicket = daily.map((point) =>
    point.activeSales === 0 ? 0 : point.monthlyContractedValue / point.activeSales,
  )
  const installations = metrics.installations
  // Recorte sem nenhuma instalação apurada não mostra R$ 0,00: isso leria como
  // "todas isentas", que é outra situação.
  const hasInstallations = installations.withData > 0

  const cards: readonly SalesPeriodCard[] = [
    {
      icon: CircleCheckBig,
      label: 'Vendas ativadas',
      value: formatNumber(metrics.activeSales),
      delta: buildCommercialDelta(metrics.activeSalesChangeRate, 'O volume'),
      detail: 'assinaturas ativas com Data de Início no período',
      points: daily.map((point) => point.activeSales),
      tone: 'green',
      readingTitle: `${formatNumber(metrics.activeSales)} assinaturas atualmente ativas começaram no período.`,
      readingText: `${changeReading(metrics.activeSalesChangeRate, 'O volume')} O recorte considera somente vendas com status atual Ativa e Data de Início dentro do período.`,
      observe: 'Evolução diária do volume de vendas ativadas no período.',
    },
    {
      icon: BadgeDollarSign,
      label: 'Valor Vendas Ativadas',
      value: currency.format(metrics.monthlyContractedValue),
      delta: buildCommercialDelta(
        metrics.monthlyContractedValueChangeRate,
        'O valor contratado',
      ),
      detail: 'soma do valor mensal das vendas do recorte',
      points: daily.map((point) => point.monthlyContractedValue),
      tone: 'blue',
      readingTitle: `${currency.format(metrics.monthlyContractedValue)} de valor mensal contratado no período.`,
      readingText: `${changeReading(metrics.monthlyContractedValueChangeRate, 'O valor contratado')} É valor mensal contratado, e não receita reconhecida.`,
      observe: 'Evolução diária do valor mensal contratado pelas vendas ativadas.',
    },
    {
      icon: Receipt,
      label: 'Ticket médio mensal',
      value: currency.format(metrics.averageTicket),
      delta: buildCommercialDelta(metrics.averageTicketChangeRate, 'O ticket médio'),
      detail: 'valor mensal contratado dividido pelas vendas',
      points: dailyTicket,
      tone: 'cyan',
      readingTitle: `Cada venda do recorte representa ${currency.format(metrics.averageTicket)} de valor mensal.`,
      readingText: `${changeReading(metrics.averageTicketChangeRate, 'O ticket médio')} O minigráfico mostra o ticket médio de cada dia do período.`,
      observe: 'Variação diária do valor médio mensal por venda ativada.',
    },
    {
      icon: Wrench,
      label: 'Valor de Instalações',
      value: hasInstallations
        ? currency.format(installations.contractedValue)
        : NO_INSTALLATION_VALUE,
      delta: hasInstallations
        ? buildCommercialDelta(
            installations.contractedValueChangeRate,
            'O valor contratado em instalações',
          )
        : NO_INSTALLATION_DELTA,
      detail: 'valor único contratado nas instalações do recorte',
      points: daily.map((point) => point.installationContractedValue),
      tone: 'violet',
      readingTitle: hasInstallations
        ? `${currency.format(installations.contractedValue)} contratados nas instalações do período.`
        : 'O recorte não possui dados de instalação.',
      readingText: installationsReading(installations),
      observe: 'Isenções e descontos aplicados nas instalações do período.',
    },
  ]

  return (
    <section
      aria-label="Indicadores das vendas ativadas no período"
      // Duas colunas cobrem a maior parte das larguras: quatro cards só entram
      // na mesma linha onde cada um mantém valor, comparação e leitura
      // gerencial legíveis, sem comprimir texto para caber.
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-4"
      ref={containerRef}
    >
      {cards.map((card) => (
        <CommercialExecutiveCard
          // Só o valor: a comparação tem a própria leitura acessível dentro do
          // card, e repeti-la aqui faria o percentual ser anunciado duas vezes.
          accessibleText={`${card.label}: ${card.value}.`}
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
          readingText={card.readingText}
          readingTitle={card.readingTitle}
          theme={theme}
          tone={card.tone}
          value={card.value}
          variant="spark"
        >
          <CommercialSparkline
            color={commercialCardColors[card.tone]}
            points={card.points}
          />
        </CommercialExecutiveCard>
      ))}
    </section>
  )
}

function changeReading(rate: number | null, subject: string): string {
  if (rate === null) {
    return 'A base mockada não tem um período anterior completo para comparar.'
  }
  if (rate > 0) return `${subject} cresceu ${formatPercent(rate)} frente ao período anterior.`
  if (rate < 0) {
    return `${subject} recuou ${formatPercent(Math.abs(rate))} frente ao período anterior.`
  }
  return `${subject} ficou estável frente ao período anterior.`
}

/**
 * Leitura gerencial das instalações.
 *
 * Explica o contratado a partir do potencial e do desconto concedido, e nunca
 * chama esse valor de receita recebida: o portal não tem baixa financeira, e o
 * mock não afirma pagamento nenhum.
 *
 * Os três estados são distintos de propósito: sem dado no recorte, tudo isento
 * e o caso comum. Ausência de dado nunca é descrita como isenção.
 */
function installationsReading(metrics: ActiveSalesInstallationMetrics): string {
  if (metrics.withData === 0) {
    return 'Nenhuma venda do recorte possui dado de instalação, e ausência de dado não é isenção: por isso nada é apurado como valor contratado.'
  }

  const composition = `Das ${formatNumber(metrics.withData)} instalações com dado, ${formatNumber(metrics.fullCharge)} integrais, ${formatNumber(metrics.partialDiscount)} com desconto e ${formatNumber(metrics.waived)} isentas, ou {${formatPercent(metrics.waivedShare ?? 0)}} de isenção.`
  const value =
    metrics.contractedValue === 0
      ? `O potencial de {${currency.format(metrics.potentialValue)}} foi integralmente concedido em desconto.`
      : `O potencial era {${currency.format(metrics.potentialValue)}}, com {${currency.format(metrics.discountValue)}} concedidos em desconto.`
  const [predominant] = metrics.paymentTerms
  const term = predominant === undefined ? '' : ` Predomina a condição ${predominant.label}.`

  return `${changeReading(metrics.contractedValueChangeRate, 'O valor contratado')} ${value} ${composition}${term}`
}

/* -------------------------------------------------------------------------- */
/* Origem das vendas                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Composição por origem.
 *
 * Origem é a classificação da venda conforme o indicador, e não o canal pelo
 * qual o cliente entrou em contato. A base não tem campo de canal de aquisição,
 * e nenhum outro campo serve para inferir um.
 *
 * As duas categorias são exclusivas e somam o total do recorte. Indicação tem
 * precedência: a venda indicada também tem uma vendedora responsável, que
 * continua na coluna Vendedor, mas a origem daquela venda é Indicação.
 */
function OriginsPanel({
  origins,
  total,
}: {
  origins: readonly ActiveSalesOriginSlice[]
  total: number
}) {
  return (
    <Panel
      subtitle="Classificação da venda conforme o indicador: com CPF de indicador, é Indicação; sem indicador, é atribuída a Vendedores."
      title="Origem das vendas"
    >
      {total === 0 ? (
        <EmptyPanel>
          Nenhuma venda atualmente ativa tem Data de Início no recorte selecionado.
        </EmptyPanel>
      ) : (
        <>
          <div className="mt-4 space-y-3.5">
            {origins.map((slice) => {
              const indicated = slice.origin === 'indicacao'
              const Icon = indicated ? Handshake : UsersRound

              return (
                <div className="rounded-xl border border-[var(--divider)] p-3" key={slice.origin}>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-lg p-2 ${indicated ? 'bg-[#14b8a6]/10 text-[#0f9689]' : 'bg-[#2f7de1]/10 text-[#2f7de1]'}`}
                    >
                      <Icon aria-hidden="true" size={17} />
                    </span>
                    <span className="font-mono text-[19px] font-bold text-[var(--text-heading)]">
                      {formatNumber(slice.activeSales)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[10.5px]">
                    <strong className="text-[var(--text-item)]">{slice.label}</strong>
                    <span className="text-[var(--text-secondary)]">
                      {formatPercent(slice.share)} do total
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--divider)]">
                    <div
                      className={`h-full rounded-full ${indicated ? 'bg-[#14b8a6]' : 'bg-[#2f7de1]'}`}
                      style={{ width: `${slice.share * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10.5px] text-[var(--text-secondary)]">
                    {currency.format(slice.monthlyContractedValue)} mensais contratados
                  </p>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[10.5px] leading-[1.45] text-[var(--text-secondary)]">
            Somadas, as duas origens correspondem às {formatNumber(total)} vendas ativas iniciadas
            do recorte.
          </p>
        </>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */
/* Alternativa acessível do gráfico                                           */
/* -------------------------------------------------------------------------- */

/**
 * O ECharts desenha em canvas, então nenhum valor da série chega a um leitor de
 * tela. A mesma série é publicada em uma tabela fora da tela, como já é feito
 * em Metas e Desempenho. O contêiner é `fixed` em `top:0; left:0` para não
 * esticar a área rolável do documento.
 */
function DailyChartTable({
  daily,
  periodLabel,
}: {
  daily: readonly ActiveSalesDailyPoint[]
  periodLabel: string
}) {
  return (
    <div className="sr-only fixed left-0 top-0 pointer-events-none">
      <table>
        <caption>
          Evolução das vendas ativas iniciadas de {periodLabel}, por Data de Início, com
          quantidade e valor mensal contratado.
        </caption>
        <thead>
          <tr>
            <th scope="col">Data de Início</th>
            <th scope="col">Vendas ativas iniciadas</th>
            <th scope="col">Valor mensal contratado</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatIsoAsBrDate(point.date)}</th>
              <td>{formatNumber(point.activeSales)}</td>
              <td>{currency.format(point.monthlyContractedValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Tabela detalhada                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Larguras das nove colunas.
 *
 * Percentuais com `table-fixed`: as proporções não dependem do conteúdo da
 * página renderizada, então uma coluna tem a mesma largura na primeira, numa
 * intermediária e na última página. O `min-width` da tabela garante o mínimo
 * legível e joga o excedente para a rolagem lateral do próprio contêiner.
 */
const COLUMN_WIDTHS = ['9%', '9%', '15%', '16%', '12%', '11%', '11%', '8%', '9%'] as const

/** Altura fixa de linha e de cabeçalho, base da altura estável do painel. */
const ROW_HEIGHT = 48
const HEADER_HEIGHT = 40
const VISIBLE_ROWS = 10

const headerCellClass =
  'px-2 py-2 align-middle text-[10px] font-bold uppercase tracking-[0.45px] text-[var(--text-secondary)]'

/**
 * Detalhamento das vendas do recorte.
 *
 * É o elemento operacional do bloco: nenhum registro fica permanentemente
 * escondido, e a paginação local alcança todos eles. Os filtros dos cabeçalhos
 * recortam somente esta tabela.
 */
function SalesTable({
  filters,
  onFiltersChange,
  onPageChange,
  onSortChange,
  page,
  rows,
  sort,
}: {
  filters: SalesTableFilters
  onFiltersChange: (filters: SalesTableFilters) => void
  onPageChange: (page: number) => void
  onSortChange: (sort: SalesTableSort) => void
  page: number
  rows: readonly ActiveSaleRow[]
  sort: SalesTableSort
}) {
  const options = useMemo(() => buildSalesTableOptions(rows, filters), [rows, filters])
  const visibleRows = useMemo(
    () => sortSalesTableRows(applySalesTableFilters(rows, filters), sort),
    [rows, filters, sort],
  )
  const activeColumns = activeSalesTableColumns(filters)
  const slice = buildActiveSalesPage(visibleRows, page)

  return (
    <Panel
      subtitle="Vendas atualmente ativas com Data de Início no período. Os filtros dos cabeçalhos recortam apenas esta tabela."
      title="Detalhamento das vendas ativas iniciadas"
    >
      {activeColumns.size > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-[var(--text-secondary)]">
            <b className="font-mono text-[var(--text-item)]">{activeColumns.size}</b>{' '}
            {activeColumns.size === 1
              ? 'coluna com filtro ativo'
              : 'colunas com filtro ativo'}
          </p>
          <button
            className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={() => onFiltersChange(initialSalesTableFilters())}
            type="button"
          >
            Limpar filtros da tabela
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyPanel>
          Nenhuma venda atualmente ativa tem Data de Início dentro dos filtros selecionados. Amplie
          o período ou limpe os filtros da página para voltar ao recorte inicial.
        </EmptyPanel>
      ) : (
        <>
          {/* A rolagem lateral fica só na tabela: o corpo da página nunca rola
              na horizontal, nem no celular. A altura mínima equivale a dez
              linhas mais o cabeçalho, então a última página, mesmo curta, não
              encolhe o painel nem move a paginação. */}
          <div
            className="mt-3 overflow-x-auto"
            style={{ minHeight: HEADER_HEIGHT + ROW_HEIGHT * VISIBLE_ROWS }}
          >
            {slice.total === 0 ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-5 text-center text-[12px] text-[var(--text-secondary)]">
                <p>
                  Os filtros da tabela não deixaram nenhuma venda visível. Os indicadores acima
                  continuam considerando o recorte completo do período.
                </p>
                <button
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-item)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={() => onFiltersChange(initialSalesTableFilters())}
                  type="button"
                >
                  Limpar filtros da tabela
                </button>
              </div>
            ) : (
              <table className="w-full min-w-[1150px] table-fixed border-collapse text-left text-[11.5px]">
                <colgroup>
                  {COLUMN_WIDTHS.map((width, index) => (
                    <col key={index} style={{ width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr
                    className="border-b border-[var(--divider)]"
                    style={{ height: HEADER_HEIGHT }}
                  >
                    <th className={headerCellClass} scope="col">
                      Data de Início
                    </th>
                    <th className={headerCellClass} scope="col">
                      Contrato
                    </th>
                    <th className={headerCellClass} scope="col">
                      <ColumnFilterHeader
                        active={activeColumns.has('customers')}
                        label="Cliente"
                      >
                        {(close) => (
                          <ListFilterPanel
                            onApply={(customers) => {
                              onFiltersChange({ ...filters, customers })
                              close()
                            }}
                            onCancel={close}
                            options={options.customers}
                            searchLabel="Buscar por nome ou CPF"
                            selected={filters.customers}
                          />
                        )}
                      </ColumnFilterHeader>
                    </th>
                    <th className={headerCellClass} scope="col">
                      <ColumnFilterHeader
                        active={activeColumns.has('sellers')}
                        label="Vendedor"
                      >
                        {(close) => (
                          <ListFilterPanel
                            onApply={(sellers) => {
                              onFiltersChange({ ...filters, sellers })
                              close()
                            }}
                            onCancel={close}
                            options={options.sellers}
                            searchLabel="Buscar vendedor"
                            selected={filters.sellers}
                          />
                        )}
                      </ColumnFilterHeader>
                    </th>
                    <th className={headerCellClass} scope="col">
                      <ColumnFilterHeader
                        active={activeColumns.has('cities')}
                        label="Cidade de instalação"
                      >
                        {(close) => (
                          <ListFilterPanel
                            onApply={(cities) => {
                              onFiltersChange({ ...filters, cities })
                              close()
                            }}
                            onCancel={close}
                            options={options.cities}
                            searchLabel="Buscar cidade"
                            selected={filters.cities}
                          />
                        )}
                      </ColumnFilterHeader>
                    </th>
                    <th className={headerCellClass} scope="col">
                      <ColumnFilterHeader active={activeColumns.has('plans')} label="Plano">
                        {(close) => (
                          <ListFilterPanel
                            onApply={(plans) => {
                              onFiltersChange({ ...filters, plans })
                              close()
                            }}
                            onCancel={close}
                            options={options.plans}
                            searchLabel="Buscar plano"
                            selected={filters.plans}
                          />
                        )}
                      </ColumnFilterHeader>
                    </th>
                    <th className={`${headerCellClass} text-right`} scope="col">
                      <ColumnFilterHeader
                        active={activeColumns.has('value') || sort !== null}
                        align="right"
                        label="Valor mensal contratado"
                      >
                        {(close) => (
                          <ValueFilterPanel
                            maxValue={filters.maxValue}
                            minValue={filters.minValue}
                            onApply={({ min, max }) => {
                              onFiltersChange({ ...filters, minValue: min, maxValue: max })
                              close()
                            }}
                            onCancel={close}
                            onSortChange={onSortChange}
                            sort={sort}
                          />
                        )}
                      </ColumnFilterHeader>
                    </th>
                    <th className={headerCellClass} scope="col">
                      <ColumnFilterHeader
                        active={activeColumns.has('statuses')}
                        label="Status atual"
                      >
                        {(close) => (
                          <ListFilterPanel
                            onApply={(statuses) => {
                              onFiltersChange({ ...filters, statuses })
                              close()
                            }}
                            onCancel={close}
                            options={options.statuses}
                            searchLabel="Buscar status"
                            searchable={false}
                            selected={filters.statuses}
                          />
                        )}
                      </ColumnFilterHeader>
                    </th>
                    <th className={headerCellClass} scope="col">
                      Origem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.rows.map((row) => (
                    <tr
                      className="border-b border-[var(--divider)] last:border-0"
                      key={row.id}
                      style={{ height: ROW_HEIGHT }}
                    >
                      <td className="truncate px-2 align-middle text-[var(--text-secondary)]">
                        {formatIsoAsBrDate(row.startDate)}
                      </td>
                      <td className="truncate px-2 align-middle font-mono font-semibold text-[var(--text-item)]">
                        {row.contractCode}
                      </td>
                      <td className="px-2 align-middle">
                        <p
                          className="truncate font-semibold leading-tight text-[var(--text-item)]"
                          title={row.customerLabel}
                        >
                          {row.customerLabel}
                        </p>
                        <p className="truncate font-mono text-[10px] leading-tight text-[var(--text-secondary)]">
                          {row.customerCpf}
                        </p>
                      </td>
                      <td
                        className="truncate px-2 align-middle text-[var(--text-item)]"
                        title={row.sellerName}
                      >
                        {row.sellerName}
                      </td>
                      <td
                        className="truncate px-2 align-middle text-[var(--text-secondary)]"
                        title={row.cityName}
                      >
                        {row.cityName}
                      </td>
                      <td
                        className="truncate px-2 align-middle text-[var(--text-secondary)]"
                        title={row.planName}
                      >
                        {row.planName}
                      </td>
                      <td className="truncate px-2 text-right align-middle font-mono font-semibold text-[var(--text-item)]">
                        {currency.format(row.monthlyValue)}
                      </td>
                      <td className="px-2 align-middle">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="truncate px-2 align-middle text-[var(--text-secondary)]">
                        {row.origin === 'indicacao' ? 'Indicação' : 'Vendedores'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <TablePagination onPageChange={onPageChange} slice={slice} />
        </>
      )}
    </Panel>
  )
}

const paginationButtonClass =
  'rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-item)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:text-[var(--text-disabled)] disabled:hover:bg-transparent'

function TablePagination({
  onPageChange,
  slice,
}: {
  onPageChange: (page: number) => void
  slice: ReturnType<typeof buildActiveSalesPage>
}) {
  return (
    <nav
      aria-label="Paginação do detalhamento das vendas ativas iniciadas"
      className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] pt-3"
    >
      <p aria-live="polite" className="text-[11.5px] text-[var(--text-secondary)]">
        Mostrando <b className="font-mono text-[var(--text-item)]">{formatNumber(slice.from)}</b> a{' '}
        <b className="font-mono text-[var(--text-item)]">{formatNumber(slice.to)}</b> de{' '}
        <b className="font-mono text-[var(--text-item)]">{formatNumber(slice.total)}</b> vendas
        ativas iniciadas
      </p>
      <div className="flex items-center gap-2">
        <button
          className={paginationButtonClass}
          disabled={slice.page === 0}
          onClick={() => onPageChange(slice.page - 1)}
          type="button"
        >
          Anterior
        </button>
        <span className="text-[11.5px] text-[var(--text-secondary)]">
          Página <b className="font-mono text-[var(--text-item)]">{slice.page + 1}</b> de{' '}
          <b className="font-mono text-[var(--text-item)]">{slice.totalPages}</b>
        </span>
        <button
          className={paginationButtonClass}
          disabled={slice.page >= slice.totalPages - 1}
          onClick={() => onPageChange(slice.page + 1)}
          type="button"
        >
          Próxima
        </button>
      </div>
    </nav>
  )
}

/**
 * Neste bloco só existe `Ativa`. O mapa de tons continua parcial, com recuo
 * neutro, para que a coluna não invente cor caso um outro status apareça.
 */
const statusTone: Partial<Record<CommercialSaleStatus, string>> = {
  ativa: 'border-[#00a862]/25 bg-[#00a862]/10 text-[#00844d]',
}

function StatusBadge({ status }: { status: CommercialSaleStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        statusTone[status] ??
        'border-[var(--border)] bg-[var(--hover-bg)] text-[var(--text-secondary)]'
      }`}
    >
      {commercialSaleStatusLabels[status]}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Painéis e estados                                                          */
/* -------------------------------------------------------------------------- */

function Panel({
  children,
  subtitle,
  title,
}: {
  children: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <section className={panelClass}>
      <h2 className="text-[13.5px] font-semibold text-[var(--text-heading)]">{title}</h2>
      <p className="mt-0.5 text-[12px] leading-[1.45] text-[var(--text-secondary)]">{subtitle}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] px-5 text-center text-[12px] text-[var(--text-secondary)]">
      {children}
    </div>
  )
}

function LoadingPanel() {
  return (
    <div aria-live="polite" className={panelClass} role="status">
      <p className="text-[13px] text-[var(--text-secondary)]">
        Carregando as vendas ativas da base comercial mockada...
      </p>
      <div aria-hidden="true" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div className="h-[86px] animate-pulse rounded-xl bg-[var(--divider)]" key={index} />
        ))}
      </div>
    </div>
  )
}

/** Falha ao montar a base. Não há retorno silencioso para uma tela vazia. */
function ErrorPanel({ message }: { message: string }) {
  return (
    <div className={panelClass} role="alert">
      <p className="text-[13.5px] font-semibold text-[var(--text-heading)]">
        Não foi possível montar a base comercial
      </p>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--text-secondary)]">{message}</p>
    </div>
  )
}
