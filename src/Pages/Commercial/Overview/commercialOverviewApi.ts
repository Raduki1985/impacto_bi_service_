import { BiApiError, fetchFromBiApi } from '../../../data/api/biApiClient'
import { formatIsoAsBrDate, isIsoDate, monthShortLabel } from '../../../data/commercialCalendar'
import type { CommercialCity, CommercialCityId } from '../../../data/commercialTypes'
import type { SalesPeriodMetrics, SalesPeriodSellerRank, SalesPeriodTeam } from '../SalesPeriod/salesPeriodModel'
import {
  OVERVIEW_ACTIVATION_BANDS,
  OVERVIEW_AWAITING_STAGES,
  type CommercialOverviewFilters,
  type CommercialOverviewSnapshot,
  type CommercialPersonTypeOption,
  type CommercialSellerOption,
  type OverviewActivationDays,
  type OverviewAwaitingActivation,
  type OverviewAwaitingStageId,
  type OverviewBreakdown,
  type OverviewCustomerMix,
  type OverviewMonthlyPoint,
  type OverviewPlanRank,
} from './overviewModel'

/**
 * Visão Geral Comercial vinda da API (`GET /bi/commercial/overview`).
 *
 * Esta página consome a rota AGREGADA: o serviço faz as contas e o portal
 * desenha. É o oposto da Visão Geral de OS, que recebe os registros e calcula
 * aqui, e a diferença tem motivo: a meta, a supermeta e o cadastro dos
 * vendedores são do banco, e o portal não tem como derivá-los sozinho.
 *
 * O que continua sendo do portal, e por isso não vem na resposta: as
 * participações percentuais, o ticket médio por time, a posição de cada
 * ranking, o rótulo dos meses e todos os textos. O contrato manda número, a
 * tela decide como apresentar.
 *
 * O adaptador mora junto da página, e não em `src/data`, porque ele conhece o
 * modelo desta tela. `src/data/api` guarda só o transporte, que não sabe de
 * página nenhuma.
 */

const COMMERCIAL_OVERVIEW_PATH = '/bi/commercial/overview'

type ApiBreakdown = {
  readonly id?: unknown
  readonly label?: unknown
  readonly active_sales?: unknown
  readonly monthly_value?: unknown
}

type ApiPanel = {
  readonly comparison_total?: unknown
  readonly rows?: unknown
}

type ApiQuality = {
  readonly sales_without_team?: unknown
  readonly sellers_without_team?: unknown
  readonly unmapped_team_names?: unknown
  readonly unmapped_status_keys?: unknown
  readonly unknown_cities?: unknown
}

type ApiPeriod = { readonly start?: unknown; readonly end?: unknown }

type ApiResponse = {
  readonly source?: {
    readonly updated_at?: unknown
    readonly period?: ApiPeriod
    readonly months?: unknown
  }
  readonly catalog?: {
    readonly cities?: unknown
    readonly sellers?: unknown
    readonly person_types?: unknown
  }
  readonly metrics?: Record<string, unknown>
  readonly previous?: {
    readonly active_sales?: unknown
    readonly monthly_revenue?: unknown
    readonly goal_achieved?: unknown
    readonly super_goal_achieved?: unknown
    readonly new_customers?: unknown
    readonly activation_days_median?: unknown
  } | null
  readonly customers?: {
    readonly new?: unknown
    readonly expansion?: unknown
    readonly returning?: unknown
  } | null
  readonly awaiting_stages?: unknown
  readonly activation_bands?: unknown
  readonly cities?: ApiPanel
  readonly teams?: ApiPanel
  readonly origins?: unknown
  readonly top_plans?: unknown
  readonly top_sellers?: unknown
  readonly top_sellers_total?: unknown
  readonly monthly?: unknown
  readonly quality?: ApiQuality
}

export type CommercialOverviewApiResult = {
  readonly snapshot: CommercialOverviewSnapshot
  /**
   * Data da última alteração em qualquer assinatura do SGI, em ISO; nula
   * quando o serviço não informa. É o que o selo do cabeçalho exibe no lugar
   * da data fixa da área, como a Visão Geral de OS já faz.
   */
  readonly updatedAt: string | null
  /**
   * Cobertura da base INTEIRA, não do recorte: do início configurado no
   * serviço até a última data com venda. É ela que prende os calendários dos
   * filtros. Nula quando o serviço não a informa, e aí a página fica com a
   * cobertura da base sintética.
   */
  readonly period: { readonly start: string; readonly end: string } | null
  /** Cidades aceitas no filtro, na ordem que o serviço enviou. */
  readonly cities: readonly CommercialCity[]
  /**
   * Vendedores aceitos no filtro: quem criou contrato na base, em ordem de
   * nome, como o serviço manda desde 14/09/2026. Vazio só com um serviço
   * anterior a isso, e aí o seletor de vendedor fica desabilitado em vez de
   * oferecer um filtro que o serviço ignora.
   */
  readonly sellers: readonly CommercialSellerOption[]
  /**
   * Tipos de cliente aceitos no filtro, como o serviço manda desde 16/09/2026.
   * Vazio quando a fonte não separa pessoa física de jurídica, e aí o seletor
   * fica desabilitado em vez de oferecer um recorte sem efeito.
   */
  readonly personTypes: readonly CommercialPersonTypeOption[]
}

function fail(message: string): never {
  throw new BiApiError(message)
}

function numberOf(value: unknown, campo: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`A API devolveu ${campo} sem um número válido na Visão Geral Comercial.`)
  }
  return value
}

function nullableNumberOf(value: unknown, campo: string): number | null {
  if (value === null || value === undefined) return null
  return numberOf(value, campo)
}

function textOf(value: unknown, campo: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`A API devolveu ${campo} vazio na Visão Geral Comercial.`)
  }
  return value
}

function listOf(value: unknown, nome: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    fail(`A API respondeu sem a lista de ${nome} na Visão Geral Comercial.`)
  }
  return value as Record<string, unknown>[]
}

/** Variação relativa; nula quando não há base anterior ou ela é zero. */
function changeRate(atual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null
  return (atual - anterior) / anterior
}

/**
 * Composição de clientes do recorte.
 *
 * Bloco opcional no contrato: um serviço anterior a esta entrega simplesmente
 * não o manda, e aí o card escreve que a fonte ainda não separa cliente novo
 * de cliente antigo, em vez de mostrar zero. Quem classifica é o serviço,
 * porque a resposta desta rota traz totais, e não o histórico de cada cliente.
 *
 * `previousNewCustomers` é o mesmo número no período anterior comparável, e é
 * o que dá a comparação da face do card.
 */
function toCustomerMix(
  raw: ApiResponse['customers'],
  previousNewCustomers: number | null,
): OverviewCustomerMix | null {
  if (raw === null || raw === undefined) return null

  const newCustomers = numberOf(raw.new, 'os clientes novos')

  return {
    newCustomers,
    expansion: numberOf(raw.expansion, 'as ativações de cliente com ponto ativo'),
    returning: numberOf(raw.returning, 'as ativações de cliente que voltou'),
    changeRate: changeRate(newCustomers, previousNewCustomers),
  }
}

/**
 * Tempo até a ativação, quando o serviço mede.
 *
 * O valor do meio e as faixas andam juntos: um serviço anterior a esta entrega
 * não manda nenhum dos dois, e aí o card escreve que a fonte não registra
 * quando a venda foi fechada. Faltando um deles, o card assume a ausência
 * inteira, porque meia medida não sustenta nem o número em destaque nem a
 * barra que o explica.
 *
 * O contrato também traz `activation_days_p90`, o prazo que cobre 9 em cada
 * 10. A tela não o usa: ele competia com o número em destaque e confundia a
 * leitura, então ficou só no serviço, para conferência.
 */
function toActivationDays(
  raw: Record<string, unknown>,
  bands: unknown,
): OverviewActivationDays | null {
  const meio = nullableNumberOf(raw.activation_days_median, 'o tempo até a ativação')
  if (meio === null) return null

  // Ausência não é erro de contrato: um serviço anterior às faixas simplesmente
  // não as manda, e aí a medida inteira conta como indisponível.
  if (!Array.isArray(bands) || bands.length === 0) return null

  const recebidas = new Map(
    listOf(bands, 'faixas da espera').map((faixa) => [faixa.id, faixa]),
  )

  // Percorre a lista oficial do portal, e não o que veio: a ordem das faixas é
  // do card, e faixa zerada continua aparecendo.
  const counts = OVERVIEW_ACTIVATION_BANDS.map((faixa) => ({
    ...faixa,
    count: numberOf(recebidas.get(faixa.id)?.count ?? 0, `a contagem da faixa ${faixa.label}`),
  }))
  const total = counts.reduce((sum, faixa) => sum + faixa.count, 0)

  return {
    medianDays: meio,
    bands: counts.map((faixa) => ({
      ...faixa,
      // Participação dentro do que foi medido, que é o denominador da barra.
      share: total === 0 ? 0 : faixa.count / total,
    })),
  }
}

function toBreakdown(raw: ApiBreakdown, total: number, onde: string): OverviewBreakdown {
  const activeSales = numberOf(raw.active_sales, `as vendas de ${onde}`)

  return {
    id: textOf(raw.id, `o identificador de ${onde}`),
    label: textOf(raw.label, `o rótulo de ${onde}`),
    activeSales,
    monthlyValue: numberOf(raw.monthly_value, `o valor de ${onde}`),
    // Participação é apresentação, então o serviço não manda: sai do total do
    // próprio conjunto comparativo, que é o mesmo denominador do painel.
    share: total === 0 ? 0 : activeSales / total,
  }
}

function panelOf(panel: ApiPanel | undefined, nome: string): {
  total: number
  rows: OverviewBreakdown[]
} {
  const total = numberOf(panel?.comparison_total, `o total comparativo de ${nome}`)
  const rows = listOf(panel?.rows, nome).map((row) => toBreakdown(row as ApiBreakdown, total, nome))
  return { total, rows }
}

/**
 * Time do vendedor no ranking.
 *
 * A classe do serviço aceita vazio, para o vendedor que não está vinculado a
 * nenhuma equipe no SGI. Ele continua no ranking, com o time em branco: sumir
 * do Top 5 mudaria o ranking em silêncio, e chutar um time seria inventar
 * dado.
 */
function teamOf(value: unknown): SalesPeriodTeam | null {
  if (value === 'comercial' || value === 'corporativo') return value
  return null
}

/**
 * Linha do Top 5 Vendedores.
 *
 * `totalProprias` é o denominador da participação: as vendas próprias, sem
 * indicação, do conjunto do ranking, que ignora o filtro de vendedor. Vem do
 * serviço porque o portal só recebe as 5 linhas, e o total de ativadas do
 * recorte não serve: com um vendedor filtrado ele encolhe para o número dele,
 * e a participação dos outros passaria de 100%.
 */
function toSellerRank(
  raw: Record<string, unknown>,
  posicao: number,
  totalProprias: number,
): SalesPeriodSellerRank {
  const activeSales = numberOf(raw.active_sales, 'as vendas do vendedor')

  return {
    position: posicao + 1,
    sellerId: sellerIdOf(raw.seller_id),
    sellerName: textOf(raw.seller_name, 'o nome do vendedor'),
    team: teamOf(raw.team),
    activeSales,
    monthlyRevenue: numberOf(raw.monthly_revenue, 'o valor do vendedor'),
    share: totalProprias === 0 ? 0 : activeSales / totalProprias,
  }
}

function toPlanRank(
  raw: Record<string, unknown>,
  posicao: number,
  totalAtivadas: number,
): OverviewPlanRank {
  const activeSales = numberOf(raw.active_sales, 'as vendas do plano')
  const label = textOf(raw.label, 'o nome do plano')

  return {
    // O contrato não tem identificador de plano: o nome é a chave, como já era
    // no modelo da página.
    id: label,
    label,
    activeSales,
    monthlyValue: numberOf(raw.monthly_value, 'o valor do plano'),
    share: totalAtivadas === 0 ? 0 : activeSales / totalAtivadas,
    position: posicao + 1,
  }
}

/**
 * Identificador do vendedor no ranking.
 *
 * VAZIO é estado previsto: é a venda sem criador no SGI (`created_by` nulo),
 * que o serviço agrupa numa linha só e nomeia "Vendedor não informado". Ela
 * fica no ranking, porque sumir esconderia uma pendência de cadastro que em
 * 10/09/2026 era a maior linha da base. O que continua sendo erro é o campo
 * faltar ou vir fora de texto.
 */
function sellerIdOf(value: unknown): string {
  if (typeof value !== 'string') {
    fail('A API devolveu o identificador do vendedor fora de texto na Visão Geral Comercial.')
  }
  return value
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Mês da evolução mensal.
 *
 * Qualquer `AAAA-MM` serve: os meses são os da cobertura real do banco, que
 * ganha um a cada virada de mês, e não a lista fechada da base sintética. O que
 * derruba a carga é mês fora da forma, porque ele não teria rótulo nem posição
 * no eixo.
 */
function monthOf(value: unknown): string {
  if (typeof value !== 'string' || !MONTH_KEY.test(value)) {
    fail(
      `A API devolveu o mês "${String(value)}" fora do formato aaaa-mm na Visão Geral Comercial.`,
    )
  }
  return value
}

function toMonthlyPoint(raw: Record<string, unknown>): OverviewMonthlyPoint {
  const month = monthOf(raw.month)
  const commercialValue = numberOf(raw.commercial_value, 'o valor mensal do Comercial')
  const corporateValue = numberOf(raw.corporate_value, 'o valor mensal do Corporativo')

  return {
    month,
    label: monthShortLabel(month),
    commercialSales: numberOf(raw.commercial_sales, 'as vendas do Comercial no mês'),
    corporateSales: numberOf(raw.corporate_sales, 'as vendas do Corporativo no mês'),
    commercialValue,
    corporateValue,
    // Soma direta dos dois times, nunca rateio: é o que permite ao gráfico
    // montar a linha só com as séries visíveis.
    monthlyValue: commercialValue + corporateValue,
  }
}

/**
 * Aguardando Ativação, quando o serviço conta a venda pela data do contrato.
 *
 * Total vendido, total aguardando e as etapas andam juntos: um serviço anterior
 * a este contrato não manda nenhum dos três, e aí o card escreve que a fonte
 * não separa o vendido do ativado. Faltando qualquer um deles, o card assume a
 * ausência inteira, porque meia medida não sustenta nem o número em destaque
 * nem a barra que o explica.
 *
 * Presentes os três, a conta precisa fechar: as etapas somam o aguardando e o
 * aguardando cabe no vendido. Diferente das faixas da espera, aqui uma etapa
 * desconhecida não pode ser ignorada, porque sumiria da soma e a barra ficaria
 * menor que o número; então ela derruba a carga, como qualquer campo fora do
 * contrato. `aguardando-aprovacao`, que o serviço ainda tem como etapa própria
 * no vocabulário do card antigo, soma em Pendente, como no modelo da base
 * sintética.
 *
 * Cada etapa pode trazer `scheduled_visit`, os contratos com visita marcada,
 * e `needs_reschedule`, os que tiveram visita improdutiva e estão sem nova
 * visita (17/09/2026). São opcionais por etapa: um serviço sem esse dado
 * deixa a etapa sem medida, nunca em zero, e a leitura narra só a contagem.
 * Quando vêm, os dois somados precisam caber na contagem da própria etapa.
 *
 * O `stalled` que o serviço também manda, os contratos além de um prazo, é
 * ignorado de propósito desde 17/09/2026: prazo não é assunto deste card, e
 * ele não chama nada de atrasado. Tempo é do card Tempo até a ativação.
 */
function toAwaitingActivation(
  raw: Record<string, unknown>,
  stages: unknown,
): OverviewAwaitingActivation | null {
  const sold = nullableNumberOf(raw.sold_contracts, 'os contratos vendidos')
  const awaiting = nullableNumberOf(raw.awaiting_activation, 'os contratos aguardando ativação')
  if (sold === null || awaiting === null) return null
  if (!Array.isArray(stages) || stages.length === 0) return null

  const counts = new Map<OverviewAwaitingStageId, number>()
  // Visita marcada e a reagendar por etapa. `null` quando algum item da etapa
  // veio sem o número: meia medida não vira frase na leitura. O `stalled` que
  // o serviço também manda é ignorado de propósito: prazo não é assunto deste
  // card (decisão do Mário em 17/09/2026).
  const scheduledVisit = new Map<OverviewAwaitingStageId, number | null>()
  const needsReschedule = new Map<OverviewAwaitingStageId, number | null>()
  const accumulate = (
    into: Map<OverviewAwaitingStageId, number | null>,
    id: OverviewAwaitingStageId,
    value: number | null,
  ) => {
    const acumulado = into.get(id)
    into.set(id, value === null || acumulado === null ? null : (acumulado ?? 0) + value)
  }
  for (const etapa of listOf(stages, 'etapas de aguardando ativação')) {
    const id = textOf(etapa.id, 'o identificador de uma etapa de aguardando ativação')
    const alvo = id === 'aguardando-aprovacao' ? 'pendente' : id
    const oficial = OVERVIEW_AWAITING_STAGES.find((candidata) => candidata.id === alvo)
    if (oficial === undefined) {
      fail(`A API devolveu a etapa ${id}, que o card Aguardando Ativação não conhece.`)
    }
    const count = numberOf(etapa.count, `a contagem da etapa ${id}`)
    counts.set(oficial.id, (counts.get(oficial.id) ?? 0) + count)

    // Fluxo em ações (17/09/2026): com visita marcada e a reagendar. Um
    // serviço anterior a este dado não os manda, e aí a etapa fica sem medida.
    const comVisita = nullableNumberOf(etapa.scheduled_visit, `as visitas marcadas da etapa ${id}`)
    const aReagendar = nullableNumberOf(etapa.needs_reschedule, `as reagendáveis da etapa ${id}`)
    if ((comVisita ?? 0) < 0 || (aReagendar ?? 0) < 0 || (comVisita ?? 0) + (aReagendar ?? 0) > count) {
      fail(
        `A API devolveu ${comVisita ?? 0} com visita marcada e ${aReagendar ?? 0} a reagendar para ${count} contratos na etapa ${id}.`,
      )
    }
    accumulate(scheduledVisit, oficial.id, comVisita)
    accumulate(needsReschedule, oficial.id, aReagendar)
  }

  const soma = [...counts.values()].reduce((total, count) => total + count, 0)
  if (soma !== awaiting) {
    fail(`A API devolveu etapas que somam ${soma} para ${awaiting} contratos aguardando ativação.`)
  }
  if (awaiting > sold) {
    fail(`A API devolveu ${awaiting} contratos aguardando ativação para ${sold} vendidos.`)
  }

  // Percorre a lista oficial do portal, e não o que veio: a ordem das etapas é
  // do card, e etapa zerada continua aparecendo.
  return {
    sold,
    awaiting,
    stages: OVERVIEW_AWAITING_STAGES.map((etapa) => {
      const count = counts.get(etapa.id) ?? 0
      return {
        id: etapa.id,
        label: etapa.label,
        count,
        share: awaiting === 0 ? 0 : count / awaiting,
        scheduledVisit: scheduledVisit.get(etapa.id) ?? null,
        needsReschedule: needsReschedule.get(etapa.id) ?? null,
      }
    }),
  }
}

function toMetrics(
  raw: Record<string, unknown>,
  previousActiveSales: number | null,
): SalesPeriodMetrics {
  const activeSales = numberOf(raw.active_sales, 'as vendas ativadas')

  return {
    totalContracts: numberOf(raw.total_contracts, 'o total de contratos'),
    activeSales,
    activeSalesChangeRate: changeRate(activeSales, previousActiveSales),
    activationRate: nullableNumberOf(raw.activation_rate, 'a taxa de ativação'),
    commercialSales: numberOf(raw.commercial_sales, 'as vendas do Comercial'),
    corporateSales: numberOf(raw.corporate_sales, 'as vendas do Corporativo'),
    indicatedSales: numberOf(raw.indicated_sales, 'as vendas indicadas'),
    sellerSales: numberOf(raw.seller_sales, 'as vendas diretas'),
    monthlyRevenue: numberOf(raw.monthly_revenue, 'o valor mensal ativado'),
    averageTicket: numberOf(raw.average_ticket, 'o ticket médio'),
    pipelineSales: numberOf(raw.pipeline_sales, 'os contratos em fluxo'),
    // Meta nula é recorte sem meta, e não meta zerada: o card escreve
    // "Sem meta" em vez de mostrar 0%.
    goal: nullableNumberOf(raw.goal, 'a meta'),
    superGoal: nullableNumberOf(raw.super_goal, 'a supermeta'),
    goalAchieved: numberOf(raw.goal_achieved, 'o realizado da meta'),
    superGoalAchieved: numberOf(raw.super_goal_achieved, 'o realizado da supermeta'),
  }
}

function toCities(raw: unknown): CommercialCity[] {
  return listOf(raw, 'cidades do catálogo').map((cidade) => ({
    id: textOf(cidade.id, 'o identificador da cidade') as CommercialCityId,
    name: textOf(cidade.name, 'o nome da cidade'),
  }))
}

/**
 * Vendedores do catálogo, quando o serviço manda.
 *
 * Ausência NÃO é erro: enquanto o contrato não tiver a lista, a página segue
 * funcionando e só o filtro de vendedor fica indisponível. Lista malformada,
 * com item sem identificador ou sem nome, derruba a carga como qualquer outro
 * campo do contrato.
 */
function toSellers(raw: unknown): CommercialSellerOption[] {
  if (raw === undefined || raw === null) return []

  return listOf(raw, 'vendedores do catálogo').map((vendedor) => ({
    id: textOf(vendedor.id, 'o identificador do vendedor'),
    name: textOf(vendedor.name, 'o nome do vendedor'),
  }))
}

/**
 * Tipos de cliente do catálogo, quando o serviço manda.
 *
 * Ausência NÃO é erro, pelo mesmo motivo dos vendedores: um serviço anterior
 * ao filtro segue alimentando a página, só sem o seletor. Item com id fora de
 * `pf` e `pj` é ignorado, porque o portal não teria o que fazer com ele; item
 * sem nome derruba a carga, como qualquer campo malformado do contrato.
 */
function toPersonTypes(raw: unknown): CommercialPersonTypeOption[] {
  if (raw === undefined || raw === null) return []

  return listOf(raw, 'tipos de cliente do catálogo')
    .filter((tipo) => tipo.id === 'pf' || tipo.id === 'pj')
    .map((tipo) => ({
      id: tipo.id as 'pf' | 'pj',
      name: textOf(tipo.name, 'o nome do tipo de cliente'),
    }))
}

/**
 * Cobertura da base, quando o serviço a informa inteira.
 *
 * Meia cobertura (fim nulo por base vazia, por exemplo) vale como ausência: um
 * calendário preso a uma data só travaria o filtro. Cobertura invertida é erro,
 * porque nenhum recorte caberia nela.
 */
function periodOf(raw: ApiPeriod | undefined): { start: string; end: string } | null {
  const start = raw?.start
  const end = raw?.end
  if (!isIsoDate(start) || !isIsoDate(end)) return null
  if (start > end) {
    fail('A API informou uma cobertura de datas invertida para a base comercial.')
  }
  return { start, end }
}

function asList(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * Pendências de cadastro que a API reporta, no mesmo padrão da Visão Geral de
 * OS (`osOverviewSource.ts`).
 *
 * Não interrompem nada e não viram categoria na tela: vendedor sem equipe
 * continua "Sem time", cidade fora das 6 continua em "Outras cidades". Ficam
 * no console para a pendência não desaparecer sem ninguém saber.
 */
function warnAboutQuality(quality: ApiQuality | undefined): void {
  if (quality === undefined) return

  const salesWithoutTeam =
    typeof quality.sales_without_team === 'number' ? quality.sales_without_team : 0
  const sellersWithoutTeam = asList(quality.sellers_without_team)
  const unmappedTeams = asList(quality.unmapped_team_names)
  const unmappedStatuses = asList(quality.unmapped_status_keys)
  const unknownCities = asList(quality.unknown_cities)

  if (
    salesWithoutTeam === 0 &&
    sellersWithoutTeam.length === 0 &&
    unmappedTeams.length === 0 &&
    unmappedStatuses.length === 0 &&
    unknownCities.length === 0
  ) {
    return
  }

  console.warn('Visão Geral Comercial: pendências de cadastro reportadas pela API.', {
    vendasSemTime: salesWithoutTeam,
    vendedoresSemTime: sellersWithoutTeam.length,
    equipesSemDePara: unmappedTeams,
    statusSemDePara: unmappedStatuses,
    cidadesDesconhecidas: unknownCities,
  })
}

/** Busca a Visão Geral Comercial já agregada para o recorte pedido. */
export async function fetchCommercialOverview(
  filters: CommercialOverviewFilters,
): Promise<CommercialOverviewApiResult> {
  const response = await fetchFromBiApi<ApiResponse>(COMMERCIAL_OVERVIEW_PATH, {
    start_date: filters.startDate,
    end_date: filters.endDate,
    city_id: filters.cityId,
    team: filters.team,
    // O vendedor só viaja quando existe seleção, e seleção só existe quando o
    // serviço mandou o catálogo. O serviço aplica a regra do negócio: venda
    // com indicação não conta para quem a registrou.
    seller_id: filters.sellerId,
    // Mesma ideia do vendedor: sem seleção o parâmetro não viaja. O serviço
    // recusa `pf` ou `pj` quando a fonte não classifica o cliente, e é por isso
    // que o seletor só fica habilitado com o catálogo na mão.
    person_type: filters.personType === 'todos' ? null : filters.personType,
  })

  if (response.metrics === undefined) {
    fail('A API respondeu sem os indicadores da Visão Geral Comercial.')
  }

  warnAboutQuality(response.quality)

  const updatedAt = response.source?.updated_at
  const previous = response.previous ?? null
  const previousActiveSales = previous === null ? null : numberOf(previous.active_sales, 'as vendas ativadas do período anterior')
  const previousMonthlyValue = previous === null ? null : numberOf(previous.monthly_revenue, 'o valor do período anterior')

  const metrics = toMetrics(response.metrics, previousActiveSales)
  const cityPanel = panelOf(response.cities, 'cidades')
  const teamPanel = panelOf(response.teams, 'times')
  // Denominador do Top 5 Vendedores. Um serviço anterior ao filtro de vendedor
  // não manda o campo, mas também não manda o catálogo, então nunca há vendedor
  // filtrado: o total de ativadas mantém ali o comportamento de antes.
  const topSellersTotal =
    nullableNumberOf(response.top_sellers_total, 'o total do ranking de vendedores') ??
    metrics.activeSales

  return {
    updatedAt: isIsoDate(updatedAt) ? updatedAt : null,
    period: periodOf(response.source?.period),
    cities: toCities(response.catalog?.cities),
    sellers: toSellers(response.catalog?.sellers),
    personTypes: toPersonTypes(response.catalog?.person_types),
    snapshot: {
      periodLabel: `${formatIsoAsBrDate(filters.startDate)} a ${formatIsoAsBrDate(filters.endDate)}`,
      metrics,
      previousMonthlyValue,
      monthlyValueChangeRate: changeRate(metrics.monthlyRevenue, previousMonthlyValue),
      previousGoalAchieved:
        previous === null ? null : numberOf(previous.goal_achieved, 'o realizado anterior da meta'),
      previousSuperGoalAchieved:
        previous === null
          ? null
          : numberOf(previous.super_goal_achieved, 'o realizado anterior da supermeta'),
      topCities: cityPanel.rows,
      cityComparisonTotal: cityPanel.total,
      teams: teamPanel.rows,
      teamComparisonTotal: teamPanel.total,
      // Origem compartilha o denominador do painel de times: as duas leituras
      // saem do mesmo conjunto comparativo.
      origins: listOf(response.origins, 'origens').map((origem) =>
        toBreakdown(origem as ApiBreakdown, teamPanel.total, 'origem'),
      ),
      topPlans: listOf(response.top_plans, 'planos').map((plano, indice) =>
        toPlanRank(plano, indice, metrics.activeSales),
      ),
      topSellers: listOf(response.top_sellers, 'vendedores').map((vendedor, indice) =>
        toSellerRank(vendedor, indice, topSellersTotal),
      ),
      monthly: listOf(response.monthly, 'meses').map(toMonthlyPoint),
      awaitingActivation: toAwaitingActivation(response.metrics, response.awaiting_stages),
      customerMix: toCustomerMix(
        response.customers,
        previous === null
          ? null
          : nullableNumberOf(previous.new_customers, 'os clientes novos do período anterior'),
      ),
      activationDays: toActivationDays(response.metrics, response.activation_bands),
      previousActivationDaysMedian:
        previous === null
          ? null
          : nullableNumberOf(
              previous.activation_days_median,
              'o tempo até a ativação do período anterior',
            ),
    },
  }
}
