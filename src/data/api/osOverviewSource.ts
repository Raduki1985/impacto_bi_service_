import type {
  CarryOverOs,
  TodayBucket,
  TodayBucketKey,
  TodaySelection,
} from '../../Pages/Overview/todayOsModel'
import type { OsListSelection } from '../../Pages/Overview/osListModel'
import {
  OS_OUTCOMES,
  type OsGroupTotals,
  type OsOutcomeGroup,
  type OsOutcomeKey,
  type OsTotals,
  type OverviewOsPeriodFacts,
} from '../../Pages/Overview/overviewModel'
import type { ReasonSummary } from '../../Pages/Overview/overviewReasonsChartOptions'
import type { Pair } from '../dashboardTypes'
import type { OverviewOsCatalogOrder, OverviewOsRecord } from '../overviewOsData'
import type {
  OverviewOsFilterOptions,
  OverviewOsFilters,
  OverviewOsSelectionField,
} from '../overviewOsFilters'
import {BiApiError, fetchFromBiApi} from './biApiClient'

/**
 * Fonte da Visão Geral de OS vinda da API (`GET /bi/os/overview/records`).
 *
 * A página recebe os REGISTROS e continua fazendo as contas com o código que
 * já existe e já está testado: filtros dependentes, período anterior, os
 * quatro indicadores e os seis gráficos não mudam uma linha. O que muda é
 * apenas de onde as linhas vêm.
 *
 * A validação de entrada é própria deste módulo, e não a de
 * `parseOverviewOsRecords`. Aquela guarda o arquivo local, cujos
 * identificadores são anônimos por construção (`mock-os-NNNNNN`); a API manda o
 * código real da OS e o identificador real do técnico, que não passariam por
 * lá. O que as duas têm em comum é a postura: erro alto e explicado, nunca um
 * dashboard com número errado.
 */

const OVERVIEW_OS_RECORDS_PATH = 'v1/bi/os/overview/records'

/** Projeção do registro como a API entrega, em inglês e com nomes separados por sublinhado. */
type ApiOsRecord = {
    readonly id: unknown
    readonly date: unknown
    readonly period?: unknown
    readonly technician_id: unknown
    readonly team: unknown
    readonly service_type: unknown
    readonly category: unknown
    readonly city: unknown
    readonly status: unknown
    readonly status_key: unknown
    readonly resolution: unknown
    readonly started_at?: unknown
    readonly finished_at?: unknown
    readonly travel_minutes?: unknown
    readonly difficulty?: unknown
    readonly unproductive_reason?: unknown
}

type ApiQuality = {
    readonly records_without_team?: unknown
    readonly unclassified_technician_ids?: unknown
    readonly unmapped_status_keys?: unknown
    readonly unmapped_service_type_keys?: unknown
    readonly unknown_cities?: unknown
}

type ApiRecordsResponse = {
    /** Data-hora em que o serviço leu o banco para esta resposta, com fuso. */
    readonly generated_at?: unknown
    readonly source?: {
        readonly updated_at?: unknown
        readonly coverage?: { readonly min?: unknown; readonly max?: unknown }
    }
    readonly records?: unknown
    /**
     * Catálogo opcional. A lista de técnicos é o que permite mostrar nome no
     * filtro em vez do identificador; enquanto o serviço não devolver, o portal
     * segue funcionando sem o filtro de técnico. As listas de status e de tipos
     * trazem a ORDEM de exibição (o de-para como dado, decisão de 08/09/2026);
     * ausentes, a página ordena em ordem alfabética.
     */
    readonly catalog?: {
        readonly technicians?: unknown
        readonly statuses?: unknown
        readonly service_types?: unknown
    }
    readonly quality?: ApiQuality
}

/** Técnico do catálogo: identificador que a OS carrega e o nome de exibição. */
export type OverviewOsTechnician = {
    readonly id: string
    readonly name: string
}

export type OverviewOsApiSource = {
    readonly records: readonly OverviewOsRecord[]
    /**
     * Cobertura da base INTEIRA, não do recorte. É ela que limita os calendários
     * e define o período padrão, e é ela que diz se a janela anterior de uma
     * comparação está inteira dentro da base.
     */
    readonly coverage: { readonly min: string; readonly max: string }
    /** Data da última alteração em qualquer OS, em ISO; null quando a API não informa. */
    readonly updatedAt: string | null
    /**
     * Data-hora em que o serviço leu o banco para esta resposta, em ISO com
     * fuso, como o serviço a escreveu; null quando ausente. É a hora que a
     * faixa de hoje da Visão Geral mostra ao gestor.
     */
    readonly generatedAt: string | null
    /**
     * Técnicos com nome, na ordem em que o filtro os mostra. Vem VAZIO quando o
     * serviço ainda não manda o catálogo, e é isso que mantém o seletor de
     * técnico desabilitado em vez de listar identificadores.
     */
    readonly technicians: readonly OverviewOsTechnician[]
    /**
     * Ordem de exibição de status e de tipo de OS, como o serviço mandou. Lista
     * vazia quando o contrato ainda não a traz: a página cai na ordem
     * alfabética, sem lista própria.
     */
    readonly catalogOrder: OverviewOsCatalogOrder
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function fail(message: string): never {
    throw new BiApiError(message)
}

function requiredText(value: unknown, field: string, index: number): string {
    if (typeof value !== 'string' || value.trim() === '') {
        fail(`A API devolveu ${field} vazio no registro ${index + 1} de OS.`)
    }
    return value
}

function nullableText(value: unknown, field: string, index: number): string | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'string' || value === '') {
        fail(`A API devolveu ${field} inválido no registro ${index + 1} de OS.`)
    }
    return value
}

/**
 * Campo de execução em campo que a API pode ainda não mandar.
 *
 * Ausente é SITUAÇÃO PREVISTA, e não erro: é um serviço anterior a
 * 21/09/2026 respondendo a um portal novo, e nesse caso a página de Técnicos
 * mostra o ranking de volume sem os tempos. Presente e malformado continua
 * sendo erro alto, como todo o resto deste módulo.
 */
function optionalText(value: unknown, field: string, index: number): string | null {
    return value === undefined ? null : nullableText(value, field, index)
}

/** Minutos medidos em campo: número não negativo, ou nulo quando não medido. */
function optionalMinutes(value: unknown, field: string, index: number): number | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        fail(`A API devolveu ${field} inválido no registro ${index + 1} de OS.`)
    }
    return value
}

/**
 * Converte um registro da API na projeção que a página consome.
 *
 * A validação é de FORMA (texto presente, data ISO), não de vocabulário: os
 * valores vêm do banco do SGI via serviço, e o que o banco disser é o dado
 * (decisão de 04/09/2026: nenhuma lista fechada no portal). Vocabulário
 * inesperado não some nem derruba: aparece cru na tela e em `quality`.
 */
function toOverviewOsRecord(raw: ApiOsRecord, index: number): OverviewOsRecord {
    const id = requiredText(raw.id, 'o identificador da OS', index)
    const dateISO = requiredText(raw.date, 'a data de agendamento', index)
    if (!ISO_DATE.test(dateISO)) {
        fail(`A API devolveu a data "${dateISO}" fora do formato aaaa-mm-dd na OS ${id}.`)
    }

    const technicianId = nullableText(raw.technician_id, 'o identificador do técnico', index)
    // Equipe NÃO valida contra lista fechada (decisão de 04/09/2026): ela vem do
    // cadastro do SGI (teams/team_users), então o nome que o serviço mandar é o
    // nome verdadeiro, como já acontece com categoria. O catálogo OS_TEAMS
    // segue existindo só como dica de ordenação das equipes conhecidas.
    const team = nullableText(raw.team, 'a equipe', index)

    // Tipo e status também não validam contra lista fechada: o serviço traduz
    // as chaves conhecidas para os rótulos aprovados e deixa chave nova passar
    // CRUA de propósito, reportada em `quality`. Derrubar a carga aqui
    // esconderia a pendência; nos gráficos, valor fora do catálogo entra no fim
    // da ordenação (`orderedByCatalog`), visível e contável.
    const serviceType = requiredText(raw.service_type, 'o tipo de OS', index)
    const status = requiredText(raw.status, 'o status', index)

    // A chave do SGI é OBRIGATÓRIA no contrato, e é por ela que os indicadores
    // contam (decisão de 08/09/2026). O valor pode ser nulo, para a OS sem
    // status; o campo ausente, não: seria uma API antiga respondendo a um portal
    // novo, e todo cartão de Concluídas mostraria zero sem erro nenhum.
    if (!('status_key' in raw)) {
        fail(
            'A API respondeu sem a chave de status (`status_key`) na OS ' +
            `${id}: sem ela os indicadores não podem ser contados.`,
        )
    }
    const statusKey = nullableText(raw.status_key, 'a chave do status', index)

    return {
        id,
        dateISO,
        // Turno do agendamento. Ausente é situação prevista, como os campos de
        // execução: é um serviço anterior a 21/09/2026 respondendo a um portal
        // novo, e aí a lista da agenda de hoje mostra a OS sem o turno.
        period: optionalText(raw.period, 'o período do agendamento', index),
        technicianId,
        // Equipe nula com técnico preenchido é situação PREVISTA: é o técnico que
        // ainda não tem vínculo de equipe no SGI. Ele entra nos totais e fica de
        // fora do filtro Equipe, que é o mesmo tratamento que a OS sem executor
        // já recebia.
        team,
        serviceType,
        category: requiredText(raw.category, 'a categoria', index),
        city: requiredText(raw.city, 'a cidade', index),
        status,
        statusKey,
        resolution: nullableText(raw.resolution, 'a resolução', index),
        startedAt: optionalText(raw.started_at, 'o início do serviço', index),
        finishedAt: optionalText(raw.finished_at, 'o fim do serviço', index),
        travelMinutes: optionalMinutes(raw.travel_minutes, 'o tempo de deslocamento', index),
        difficulty: optionalText(raw.difficulty, 'a dificuldade', index),
        unproductiveReason: optionalText(raw.unproductive_reason, 'o motivo da improdutiva', index),
    }
}

function coverageOf(response: ApiRecordsResponse): { min: string; max: string } {
    const min = response.source?.coverage?.min
    const max = response.source?.coverage?.max

    if (typeof min !== 'string' || typeof max !== 'string' || !ISO_DATE.test(min) || !ISO_DATE.test(max)) {
        fail('A API não informou a cobertura de datas da base de OS.')
    }
    if (min > max) {
        fail('A API informou uma cobertura de datas invertida para a base de OS.')
    }

    return {min, max}
}

function asList(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : []
}

/**
 * Pendências de classificação que a API reporta.
 *
 * Não interrompem nada e não viram categoria na tela: são manutenção de
 * catálogo do BI. Ficam no console para não desaparecerem sem ninguém saber.
 */
function warnAboutQuality(quality: ApiQuality | undefined): void {
    if (quality === undefined) return

    const withoutTeam = typeof quality.records_without_team === 'number' ? quality.records_without_team : 0
    const unmappedStatuses = asList(quality.unmapped_status_keys)
    const unmappedTypes = asList(quality.unmapped_service_type_keys)
    const unknownCities = asList(quality.unknown_cities)

    if (withoutTeam === 0 && unmappedStatuses.length === 0 && unmappedTypes.length === 0 && unknownCities.length === 0) {
        return
    }

    console.warn('Visão Geral de OS: pendências de classificação reportadas pela API.', {
        osSemEquipe: withoutTeam,
        statusSemDePara: unmappedStatuses,
        tiposSemDePara: unmappedTypes,
        cidadesDesconhecidas: unknownCities,
    })
}

/**
 * Catálogo de técnicos, quando o serviço manda.
 *
 * Ausência NÃO é erro: enquanto o contrato não tiver a lista, a página inteira
 * continua funcionando e só o filtro de técnico fica indisponível. O que é
 * erro é a lista existir malformada, com item sem identificador ou sem nome,
 * porque aí o seletor mostraria uma entrada vazia que filtra alguma coisa.
 *
 * A ordem é alfabética em português: o serviço não precisa se preocupar com
 * isso, e o portal não fica refém da ordem de retorno do banco.
 */
function techniciansOf(raw: unknown): OverviewOsTechnician[] {
    if (raw === undefined || raw === null) return []
    if (!Array.isArray(raw)) {
        fail('A API devolveu o catálogo de técnicos fora do formato de lista.')
    }

    return raw
        .map((item, index) => {
            const técnico = item as { id?: unknown; name?: unknown }
            const id = requiredText(técnico.id, 'o identificador do técnico do catálogo', index)
            const name = requiredText(técnico.name, 'o nome do técnico do catálogo', index)

            return {id, name}
        })
        .sort((um, outro) => um.name.localeCompare(outro.name, 'pt-BR'))
}

/**
 * Rótulos de um catálogo de ordem (`statuses` ou `service_types`), na ordem
 * em que o serviço os mandou.
 *
 * Cada item é `{ label, order }`: `order` é a posição para rótulo do de-para e
 * nulo para chave crua do SGI, que o serviço já põe no fim. A lista vem
 * ordenada de lá, e o portal respeita: a ordem operacional dos status é regra
 * do BI, não do navegador. Ausência não é erro; lista malformada é, porque um
 * rótulo vazio ordenaria o nada.
 */
function catalogOrderOf(raw: unknown, nome: string): string[] {
    if (raw === undefined || raw === null) return []
    if (!Array.isArray(raw)) {
        fail(`A API devolveu o catálogo de ${nome} fora do formato de lista.`)
    }

    return raw.map((item, index) => {
        const entrada = item as { label?: unknown; order?: unknown }
        const label = requiredText(entrada.label, `o rótulo do catálogo de ${nome}`, index)
        const order = entrada.order
        if (order !== undefined && order !== null && typeof order !== 'number') {
            fail(`A API devolveu a posição de "${label}" no catálogo de ${nome} sem um número.`)
        }
        return label
    })
}

/** Janela de agendamento de uma consulta, limites inclusivos. */
type SourceRange = { readonly dateFrom: string; readonly dateTo: string }

/**
 * Busca e converte uma resposta da rota de registros.
 *
 * Sem janela vem a base inteira, e a base inteira vazia é erro: o serviço
 * respondeu sem OS nenhuma para a cobertura que ele mesmo declara. Uma janela
 * vazia é resultado, um domingo sem OS por exemplo, e por isso quem pede a
 * janela diz que aceita vazio.
 */
async function loadOverviewOsSource(
    range: SourceRange | null,
    allowEmpty: boolean,
): Promise<OverviewOsApiSource> {
    const response =
        range === null
            ? await fetchFromBiApi<ApiRecordsResponse>(OVERVIEW_OS_RECORDS_PATH)
            : await fetchFromBiApi<ApiRecordsResponse>(OVERVIEW_OS_RECORDS_PATH, {
                date_from: range.dateFrom,
                date_to: range.dateTo,
            })
    const rawRecords = response.records

    if (!Array.isArray(rawRecords)) {
        fail('A API respondeu sem a lista de ordens de serviço.')
    }
    if (rawRecords.length === 0 && !allowEmpty) {
        fail('A API respondeu sem nenhuma ordem de serviço para o período coberto.')
    }

    // As pendências de classificação são da base inteira e vão para o console
    // uma vez, na carga da página. A consulta do dia repete a cada minuto, e
    // repetir o aviso junto encheria o console sem informação nova.
    if (range === null) warnAboutQuality(response.quality)

    const updatedAt = response.source?.updated_at
    const generatedAt = response.generated_at
    return {
        records: rawRecords.map((item, index) => toOverviewOsRecord(item as ApiOsRecord, index)),
        coverage: coverageOf(response),
        updatedAt: typeof updatedAt === 'string' && ISO_DATE.test(updatedAt) ? updatedAt : null,
        generatedAt: typeof generatedAt === 'string' && generatedAt !== '' ? generatedAt : null,
        technicians: techniciansOf(response.catalog?.technicians),
        catalogOrder: {
            statuses: catalogOrderOf(response.catalog?.statuses, 'status'),
            serviceTypes: catalogOrderOf(response.catalog?.service_types, 'tipos de OS'),
        },
    }
}

/** Busca a base inteira de OS já normalizada pelo serviço. */
export function fetchOverviewOsSource(): Promise<OverviewOsApiSource> {
    return loadOverviewOsSource(null, false)
}

/**
 * Busca só as OS de uma janela de agendamento, já normalizadas.
 *
 * É a carga da página desde 01/10/2026: o período escolhido mais a janela
 * de comparação dele, e não mais a base inteira (7.605 OS e 3,3 MB em
 * produção naquele dia). Janela vazia é resultado, e não erro.
 */
export function fetchOverviewOsWindow(dateFrom: string, dateTo: string): Promise<OverviewOsApiSource> {
  return loadOverviewOsSource({ dateFrom, dateTo }, true)
}

// --- Consultas enxutas (01/10/2026) -----------------------------------------
//
// Pedido do Mário para a página carregar menos: os filtros globais, as
// contagens da faixa Hoje ao vivo e a lista de cada caixa têm consulta
// própria, e cada uma traz só o que a tela mostra. As regras moram no serviço
// (`app/services/bi/os_live.py`), cópia das deste portal.

const OVERVIEW_OS_FILTERS_PATH = 'v1/bi/os/overview/filters'
const OVERVIEW_OS_TODAY_PATH = 'v1/bi/os/overview/today'
const OVERVIEW_OS_TODAY_RECORDS_PATH = 'v1/bi/os/overview/today/records'

/** Campos de escolha na grafia do serviço, que os recebe como parâmetro repetido. */
const SELECTION_PARAMS = {
  team: 'team',
  technicianId: 'technician_id',
  serviceType: 'service_type',
  category: 'category',
  city: 'city',
  status: 'status',
} as const satisfies Record<OverviewOsSelectionField, string>

function selectionParams(
  filters: OverviewOsFilters,
  fields: readonly OverviewOsSelectionField[],
): Record<string, readonly string[]> {
  return Object.fromEntries(fields.map((field) => [SELECTION_PARAMS[field], filters[field]]))
}

const ALL_SELECTION_FIELDS = Object.keys(SELECTION_PARAMS) as OverviewOsSelectionField[]

function textList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`A API devolveu ${field} fora do formato de lista de textos.`)
  }
  return value as string[]
}

/** A faixa de filtros globais: o recorte saneado, as opções e o catálogo, sem OS. */
export type OverviewOsFiltersSource = {
  readonly filters: OverviewOsFilters
  readonly options: OverviewOsFilterOptions
  readonly coverage: { readonly min: string; readonly max: string }
  readonly updatedAt: string | null
  readonly technicians: readonly OverviewOsTechnician[]
  readonly catalogOrder: OverviewOsCatalogOrder
}

type ApiFiltersResponse = {
  readonly source?: ApiRecordsResponse['source']
  readonly filters?: Record<string, unknown>
  readonly options?: Record<string, unknown>
  readonly catalog?: ApiRecordsResponse['catalog']
}

/**
 * Opções dos filtros globais para um recorte, já saneado pelo serviço na
 * mesma cadeia dependente do portal (`resolveOverviewOsFilters`).
 *
 * Sem recorte (`null`), o serviço devolve o período com que a página abre,
 * do dia 1 do mês até ontem, e é com ele que a primeira carga começa: o
 * portal só conhece a cobertura da base depois desta resposta.
 */
export async function fetchOverviewOsFilters(
  filters: OverviewOsFilters | null,
): Promise<OverviewOsFiltersSource> {
  const response = await fetchFromBiApi<ApiFiltersResponse>(
    OVERVIEW_OS_FILTERS_PATH,
    filters === null
      ? undefined
      : {
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          ...selectionParams(filters, ALL_SELECTION_FIELDS),
        },
  )
  const resolved = response.filters ?? {}
  const options = response.options ?? {}
  const dateFrom = resolved.date_from
  const dateTo = resolved.date_to
  if (typeof dateFrom !== 'string' || typeof dateTo !== 'string' || !ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) {
    fail('A API não informou o período dos filtros da Visão Geral de OS.')
  }
  const updatedAt = response.source?.updated_at

  return {
    filters: {
      dateFrom,
      dateTo,
      team: textList(resolved.team, 'as equipes marcadas'),
      technicianId: textList(resolved.technician_id, 'os técnicos marcados'),
      serviceType: textList(resolved.service_type, 'os tipos marcados'),
      category: textList(resolved.category, 'as categorias marcadas'),
      city: textList(resolved.city, 'as cidades marcadas'),
      status: textList(resolved.status, 'os status marcados'),
    },
    options: {
      teams: textList(options.teams, 'as opções de equipe'),
      technicians: textList(options.technicians, 'as opções de técnico'),
      serviceTypes: textList(options.service_types, 'as opções de tipo'),
      categories: textList(options.categories, 'as opções de categoria'),
      cities: textList(options.cities, 'as opções de cidade'),
      statuses: textList(options.statuses, 'as opções de status'),
    },
    coverage: coverageOf(response),
    updatedAt: typeof updatedAt === 'string' && ISO_DATE.test(updatedAt) ? updatedAt : null,
    technicians: techniciansOf(response.catalog?.technicians),
    catalogOrder: {
      statuses: catalogOrderOf(response.catalog?.statuses, 'status'),
      serviceTypes: catalogOrderOf(response.catalog?.service_types, 'tipos de OS'),
    },
  }
}

/** Campos da página que valem na faixa Hoje ao vivo: tudo, menos período e status. */
const TODAY_SELECTION_FIELDS = [
  'team',
  'technicianId',
  'serviceType',
  'category',
  'city',
] as const satisfies readonly OverviewOsSelectionField[]

/** Caixa da faixa na grafia do serviço. */
const TODAY_BOX_PARAM: Readonly<Record<TodayBucketKey, string>> = {
  done: 'done',
  inField: 'in_field',
  toDo: 'to_do',
  unproductive: 'unproductive',
  notExecuted: 'not_executed',
  unknown: 'unknown',
}

const TODAY_BOX_BY_PARAM = new Map(
  Object.entries(TODAY_BOX_PARAM).map(([key, param]) => [param, key as TodayBucketKey]),
)

/** Contagens da faixa Hoje ao vivo, como o serviço as manda: só números. */
export type TodayOsCountsSource = {
  /** Hora em que o serviço leu o banco, em ISO com fuso. */
  readonly generatedAt: string | null
  readonly total: number
  readonly buckets: readonly TodayBucket[]
  /** A fazer e sem técnico, por turno; a régua do atraso é aplicada no portal. */
  readonly unassigned: readonly { readonly period: string | null; readonly count: number }[]
  readonly carryOver: readonly CarryOverOs[]
}

type ApiTodayResponse = {
  readonly generated_at?: unknown
  readonly total?: unknown
  readonly buckets?: unknown
  readonly unassigned?: unknown
  readonly carry_over?: unknown
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(`A API devolveu ${field} sem uma contagem válida.`)
  }
  return value
}

function generatedAtOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Contagens da faixa Hoje ao vivo para o dia, com os filtros da página menos
 * período e status. É a consulta repetida a cada minuto: cerca de 1 KB, no
 * lugar das ~960 OS da semana que a faixa baixava até 01/10/2026.
 */
export async function fetchTodayOsCounts(
  day: string,
  filters: OverviewOsFilters,
): Promise<TodayOsCountsSource> {
  const response = await fetchFromBiApi<ApiTodayResponse>(OVERVIEW_OS_TODAY_PATH, {
    day,
    ...selectionParams(filters, TODAY_SELECTION_FIELDS),
  })
  const total = count(response.total, 'o total do dia')

  const buckets = asList(response.buckets).map((raw): TodayBucket => {
    const bucket = raw as { key?: unknown; label?: unknown; count?: unknown; statuses?: unknown }
    const key = TODAY_BOX_BY_PARAM.get(String(bucket.key))
    if (key === undefined) fail(`A API devolveu a caixa "${String(bucket.key)}", que a faixa não conhece.`)
    const label = requiredText(bucket.label, 'o nome da caixa', 0)
    const value = count(bucket.count, `a caixa ${label}`)
    const statuses = asList(bucket.statuses).map((item): Pair => {
      const status = item as { label?: unknown; count?: unknown }
      return [requiredText(status.label, 'o status da caixa', 0), count(status.count, `o status da caixa ${label}`)]
    })

    return { key, label, count: value, share: total === 0 ? 0 : value / total, statuses }
  })

  const unassigned = asList(response.unassigned).map((raw) => {
    const item = raw as { period?: unknown; count?: unknown }
    return {
      period: nullableText(item.period, 'o turno das OS sem técnico', 0),
      count: count(item.count, 'as OS sem técnico'),
    }
  })

  const carryOver = asList(response.carry_over).map((raw, index): CarryOverOs => {
    const item = raw as { id?: unknown; date?: unknown; service_type?: unknown; status?: unknown; started_at?: unknown }
    const dateISO = requiredText(item.date, 'a data da OS de dia anterior', index)
    if (!ISO_DATE.test(dateISO)) fail(`A API devolveu a data "${dateISO}" fora do formato aaaa-mm-dd.`)

    return {
      id: requiredText(item.id, 'o código da OS de dia anterior', index),
      dateISO,
      serviceType: requiredText(item.service_type, 'o tipo da OS de dia anterior', index),
      status: requiredText(item.status, 'o status da OS de dia anterior', index),
      startedAt: nullableText(item.started_at, 'o início da OS de dia anterior', index),
    }
  })

  return { generatedAt: generatedAtOf(response.generated_at), total, buckets, unassigned, carryOver }
}

// --- Resultado do período (01/10/2026) ----------------------------------------
//
// Decisão do Mário no mesmo dia: as regras do período ficam num lugar só, no
// serviço, e a página recebe os números prontos. Era a maior carga da página
// (o período e a janela de comparação, ~4.600 OS e 1,8 MB em setembro/2026);
// a resposta agora tem ~10 KB.

const OVERVIEW_OS_PERIOD_PATH = 'v1/bi/os/overview/period'
const OVERVIEW_OS_PERIOD_RECORDS_PATH = 'v1/bi/os/overview/period/records'

/** Saída na grafia do serviço -> na do portal. */
const OUTCOME_BY_PARAM: Readonly<Record<string, OsOutcomeKey>> = {
  completed: 'completed',
  unproductive: 'unproductive',
  not_executed: 'notExecuted',
  open: 'open',
  unknown: 'unknown',
}

const OUTCOME_PARAM: Readonly<Record<OsOutcomeKey, string>> = {
  completed: 'completed',
  unproductive: 'unproductive',
  notExecuted: 'not_executed',
  open: 'open',
  unknown: 'unknown',
}

type Raw = Record<string, unknown>

function rawObject(value: unknown, field: string): Raw {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`A API devolveu ${field} fora do formato esperado.`)
  }
  return value as Raw
}

function groupTotalsOf(value: unknown, field: string): OsGroupTotals {
  const raw = rawObject(value, field)
  return {
    total: count(raw.total, field),
    completed: count(raw.completed, field),
    unproductive: count(raw.unproductive, field),
    notExecuted: count(raw.not_executed, field),
    open: count(raw.open, field),
    unknown: count(raw.unknown, field),
  }
}

function totalsOf(value: unknown, field: string): OsTotals {
  const raw = rawObject(value, field)
  return {
    all: groupTotalsOf(raw.all, field),
    customer: groupTotalsOf(raw.customer, field),
    infrastructure: groupTotalsOf(raw.infrastructure, field),
  }
}

function pairsOf(value: unknown, field: string): Pair[] {
  return asList(value).map((item) => {
    const raw = rawObject(item, field)
    return [requiredText(raw.label, field, 0), count(raw.count, field)] as Pair
  })
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(`A API devolveu ${field} com um valor que a página não conhece ("${String(value)}").`)
  }
  return value as T
}

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) fail(`A API devolveu ${field} fora do formato aaaa-mm-dd.`)
  return value
}

/** `21/09`, o rótulo curto do eixo do volume diário. */
function shortDay(dateISO: string): string {
  return `${dateISO.slice(8, 10)}/${dateISO.slice(5, 7)}`
}

function filtersParams(filters: OverviewOsFilters) {
  return {
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    ...selectionParams(filters, ALL_SELECTION_FIELDS),
  }
}

/**
 * O "Resultado do período" e a "Composição do período" prontos, para os
 * filtros da página (já saneados pela consulta de filtros).
 */
export async function fetchOverviewOsPeriod(
  filters: OverviewOsFilters,
): Promise<{ readonly facts: OverviewOsPeriodFacts; readonly generatedAt: string | null }> {
  const response = await fetchFromBiApi<unknown>(OVERVIEW_OS_PERIOD_PATH, filtersParams(filters))

  return {
    facts: parseOverviewOsPeriod(response),
    generatedAt: generatedAtOf((response as { generated_at?: unknown } | null)?.generated_at),
  }
}

/**
 * Converte a resposta de `/bi/os/overview/period` nos números da página.
 * Separada da busca para os testes lerem respostas reais do serviço
 * (`osPeriodFixture.json`) pelo mesmo caminho da página.
 */
export function parseOverviewOsPeriod(raw: unknown): OverviewOsPeriodFacts {
  const response = rawObject(raw, 'o período')

  const previousRaw = response.previous
  const previous =
    previousRaw === null || previousRaw === undefined
      ? null
      : (() => {
          const raw = rawObject(previousRaw, 'a janela de comparação')
          return {
            range: {
              dateFrom: isoDate(raw.date_from, 'o início da janela de comparação'),
              dateTo: isoDate(raw.date_to, 'o fim da janela de comparação'),
            },
            kind: oneOf(raw.kind, ['day', 'week', 'month', 'custom'] as const, 'a natureza da comparação'),
            coverage: oneOf(raw.coverage, ['complete', 'incomplete'] as const, 'a cobertura da comparação'),
            totals: raw.totals === null || raw.totals === undefined ? null : totalsOf(raw.totals, 'os totais da comparação'),
          }
        })()

  const topRaw = response.top_reason
  const topReason =
    topRaw === null || topRaw === undefined
      ? null
      : (() => {
          const raw = rawObject(topRaw, 'o motivo mais frequente')
          return {
            reason: nullableText(raw.reason, 'o motivo mais frequente', 0),
            count: count(raw.count, 'o motivo mais frequente'),
            of: count(raw.of, 'as improdutivas da base'),
          }
        })()

  const outcome = asList(response.outcome).map((item): OsOutcomeGroup => {
    const raw = rawObject(item, 'o destino das OS')
    const counts = rawObject(raw.counts, 'as saídas do destino')
    const statuses = rawObject(raw.statuses, 'os status do destino')
    const byOutcome = <T,>(read: (param: string) => T) =>
      Object.fromEntries(OS_OUTCOMES.map(({ key }) => [key, read(OUTCOME_PARAM[key])])) as Record<OsOutcomeKey, T>

    return {
      key: oneOf(raw.key, ['customer', 'infrastructure'] as const, 'o grupo do destino'),
      label: requiredText(raw.label, 'o nome do grupo', 0),
      total: count(raw.total, 'o total do grupo'),
      counts: byOutcome((param) => count(counts[param], 'uma saída do destino')),
      statuses: byOutcome((param) => pairsOf(statuses[param], 'os status de uma saída')),
    }
  })

  const reasonsRaw = rawObject(response.reasons, 'os motivos de improdutiva')
  const reasons: ReasonSummary = {
    total: count(reasonsRaw.total, 'o total de improdutivas'),
    customer: count(reasonsRaw.customer, 'as improdutivas de cliente'),
    infrastructure: count(reasonsRaw.infrastructure, 'as improdutivas de infraestrutura'),
    hasReason: reasonsRaw.has_reason === true,
    rows: asList(reasonsRaw.rows).map((item) => {
      const raw = rawObject(item, 'um motivo')
      return {
        reason: requiredText(raw.reason, 'o motivo', 0),
        count: count(raw.count, 'o motivo'),
        share: typeof raw.share === 'number' ? raw.share : fail('A API devolveu um motivo sem participação.'),
        customer: count(raw.customer, 'o motivo'),
        infrastructure: count(raw.infrastructure, 'o motivo'),
        unclear: raw.unclear === true,
      }
    }),
  }

  const days = asList(response.daily).map((item) => rawObject(item, 'um dia do volume diário'))
  const iso = days.map((day) => isoDate(day.date, 'um dia do volume diário'))
  const series = (field: string) => days.map((day) => count(day[field], 'um dia do volume diário'))

  return {
    totals: totalsOf(response.totals, 'os totais do período'),
    rateBase: oneOf(response.rate_base, ['customer', 'infrastructure', 'all'] as const, 'a base das taxas'),
    rateState: oneOf(response.rate_state, ['ok', 'status', 'empty'] as const, 'o estado das taxas'),
    withoutUnassigned: response.without_unassigned === true,
    previous,
    daysWithOs: count(response.days_with_os, 'os dias com OS'),
    topReason,
    outcome,
    reasons,
    daily: {
      x: iso.map(shortDay),
      iso,
      total: series('total'),
      completed: series('completed'),
      unproductive: series('unproductive'),
      notExecuted: series('not_executed'),
      open: series('open'),
      unknown: series('unknown'),
    },
    serviceTypeSlices: asList(response.service_types).map((item) => {
      const raw = rawObject(item, 'um tipo de OS')
      return {
        name: requiredText(raw.label, 'o tipo de OS', 0),
        value: count(raw.count, 'o tipo de OS'),
        categories: pairsOf(raw.categories, 'as categorias do tipo'),
      }
    }),
    cityPairs: pairsOf(response.cities, 'as cidades'),
    categoryTopPairs: pairsOf(response.categories_top, 'as categorias'),
    selectedCategoryRanks: asList(response.selected_category_ranks).map((rank) => count(rank, 'a posição da categoria')),
    resolutionTopPairs: pairsOf(response.resolutions_top, 'as resoluções'),
  }
}

/** As OS por trás de uma barra do período, com o nome dos técnicos dela. */
export type OverviewOsPeriodListSource = {
  readonly generatedAt: string | null
  readonly records: readonly OverviewOsRecord[]
  readonly technicians: readonly OverviewOsTechnician[]
}

/**
 * As OS por trás de uma barra do período (Destino, Motivos, Volume diário),
 * ou de todo o recorte (`null`, a planilha do período), pedidas quando a
 * lista abre. Cada OS chega com a saída, o grupo e o motivo como o painel os
 * conta: é a mesma regra do painel, e não uma cópia dela aqui.
 */
export async function fetchOverviewOsPeriodList(
  filters: OverviewOsFilters,
  selection: OsListSelection | null,
): Promise<OverviewOsPeriodListSource> {
  const panel =
    selection === null
      ? { panel: 'all' }
      : selection.kind === 'outcome'
        ? { panel: 'outcome', group: selection.group, outcome: selection.outcome && OUTCOME_PARAM[selection.outcome] }
        : selection.kind === 'reason'
          ? { panel: 'reason', reason: selection.reason }
          : { panel: 'day', day: selection.date, outcome: selection.series && OUTCOME_PARAM[selection.series] }
  const response = await fetchFromBiApi<ApiRecordsResponse>(OVERVIEW_OS_PERIOD_RECORDS_PATH, {
    ...filtersParams(filters),
    ...panel,
  })
  if (!Array.isArray(response.records)) {
    fail('A API respondeu sem a lista de ordens de serviço da barra.')
  }

  return {
    generatedAt: generatedAtOf(response.generated_at),
    records: response.records.map((item, index) => {
      const raw = item as ApiOsRecord & { outcome?: unknown; group?: unknown; reason?: unknown }
      const outcome = OUTCOME_BY_PARAM[String(raw.outcome)]
      if (outcome === undefined) fail(`A API devolveu a OS ${index + 1} da lista sem a saída.`)

      return {
        ...toOverviewOsRecord(raw, index),
        outcome,
        group: oneOf(raw.group, ['customer', 'infrastructure'] as const, 'o grupo da OS'),
        listReason: nullableText(raw.reason, 'o motivo da OS', index),
      }
    }),
    technicians: techniciansOf(response.catalog?.technicians),
  }
}

/** Lista que a faixa abre: uma caixa, a agenda inteira ou as de dias anteriores. */
export type TodayOsBox = TodaySelection | 'carryOver'

/** As OS de uma caixa da faixa, com o nome dos técnicos que estão nela. */
export type TodayOsBoxSource = {
  readonly generatedAt: string | null
  readonly records: readonly OverviewOsRecord[]
  readonly technicians: readonly OverviewOsTechnician[]
}

/**
 * As OS por trás de uma caixa da faixa Hoje ao vivo, pedidas só quando o
 * gestor abre a lista dela (01/10/2026). Mesmos filtros das contagens.
 */
export async function fetchTodayOsBox(
  day: string,
  box: TodayOsBox,
  filters: OverviewOsFilters,
): Promise<TodayOsBoxSource> {
  const response = await fetchFromBiApi<ApiRecordsResponse>(OVERVIEW_OS_TODAY_RECORDS_PATH, {
    day,
    box: box === 'carryOver' ? 'carry_over' : box === 'all' ? 'all' : TODAY_BOX_PARAM[box],
    ...selectionParams(filters, TODAY_SELECTION_FIELDS),
  })
  if (!Array.isArray(response.records)) {
    fail('A API respondeu sem a lista de ordens de serviço da caixa.')
  }

  return {
    generatedAt: generatedAtOf(response.generated_at),
    records: response.records.map((item, index) => toOverviewOsRecord(item as ApiOsRecord, index)),
    technicians: techniciansOf(response.catalog?.technicians),
  }
}

/**
 * Busca só as OS agendadas numa janela curta, já normalizadas.
 *
 * É a consulta da faixa "Hoje ao vivo" da Visão Geral: pequena o bastante
 * para ser repetida a cada minuto sem baixar a base inteira de novo. Desde
 * 22/09/2026 a janela é de alguns dias, e não de um só, porque a faixa
 * também avisa sobre a OS de dia anterior que continua aberta no aplicativo.
 * Sem o fim, a janela é de um dia só.
 */
export function fetchOverviewOsDay(
    dateISO: string,
    dateToISO: string = dateISO,
): Promise<OverviewOsApiSource> {
    return loadOverviewOsSource({dateFrom: dateISO, dateTo: dateToISO}, true)
}
