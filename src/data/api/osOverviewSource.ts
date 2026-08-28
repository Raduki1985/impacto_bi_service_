import {
  OS_SERVICE_TYPES,
  OS_STATUSES,
  OS_TEAMS,
  type OsTeam,
} from '../mockOsCatalog'
import { OVERVIEW_OS_LEGACY_SERVICE_TYPE, type OverviewOsRecord } from '../overviewOsData'
import { BiApiError, fetchFromBiApi } from './biApiClient'

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

const OVERVIEW_OS_RECORDS_PATH = '/bi/os/overview/records'

/** Projeção do registro como a API entrega, em inglês e com nomes separados por sublinhado. */
type ApiOsRecord = {
  readonly id: unknown
  readonly date: unknown
  readonly technician_id: unknown
  readonly team: unknown
  readonly service_type: unknown
  readonly category: unknown
  readonly city: unknown
  readonly status: unknown
  readonly resolution: unknown
}

type ApiQuality = {
  readonly records_without_team?: unknown
  readonly unclassified_technician_ids?: unknown
  readonly unmapped_status_keys?: unknown
  readonly unmapped_service_type_keys?: unknown
  readonly unknown_cities?: unknown
}

type ApiRecordsResponse = {
  readonly source?: {
    readonly updated_at?: unknown
    readonly coverage?: { readonly min?: unknown; readonly max?: unknown }
  }
  readonly records?: unknown
  readonly quality?: ApiQuality
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
}

const validTeams: ReadonlySet<string> = new Set(OS_TEAMS)
const validServiceTypes: ReadonlySet<string> = new Set([
  ...OS_SERVICE_TYPES,
  OVERVIEW_OS_LEGACY_SERVICE_TYPE,
])
const validStatuses: ReadonlySet<string> = new Set(OS_STATUSES)

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
 * Converte um registro da API na projeção que a página consome.
 *
 * Valor fora dos catálogos aprovados derruba a carga de propósito. Aceitar um
 * status novo do SGI calado seria pior: ele entraria nos totais dos cards e
 * sumiria do gráfico de distribuição, que desenha na ordem do catálogo, e a
 * página mostraria dois números que não fecham entre si.
 */
function toOverviewOsRecord(raw: ApiOsRecord, index: number): OverviewOsRecord {
  const id = requiredText(raw.id, 'o identificador da OS', index)
  const dateISO = requiredText(raw.date, 'a data de agendamento', index)
  if (!ISO_DATE.test(dateISO)) {
    fail(`A API devolveu a data "${dateISO}" fora do formato aaaa-mm-dd na OS ${id}.`)
  }

  const technicianId = nullableText(raw.technician_id, 'o identificador do técnico', index)
  const team = nullableText(raw.team, 'a equipe', index)
  if (team !== null && !validTeams.has(team)) {
    fail(`A API devolveu a equipe "${team}", que não existe no catálogo do portal, na OS ${id}.`)
  }

  const serviceType = requiredText(raw.service_type, 'o tipo de OS', index)
  if (!validServiceTypes.has(serviceType)) {
    fail(`A API devolveu o tipo de OS "${serviceType}", sem correspondência no catálogo, na OS ${id}.`)
  }

  const status = requiredText(raw.status, 'o status', index)
  if (!validStatuses.has(status)) {
    fail(`A API devolveu o status "${status}", sem correspondência no catálogo, na OS ${id}.`)
  }

  return {
    id,
    dateISO,
    technicianId,
    // Equipe nula com técnico preenchido é situação PREVISTA: é o técnico que
    // ainda não foi classificado numa das seis equipes do BI. Ele entra nos
    // totais e fica de fora do filtro Equipe, que é o mesmo tratamento que a
    // OS sem executor já recebia.
    team: team as OsTeam | null,
    serviceType,
    category: requiredText(raw.category, 'a categoria', index),
    city: requiredText(raw.city, 'a cidade', index),
    status,
    resolution: nullableText(raw.resolution, 'a resolução', index),
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

  return { min, max }
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

/** Busca a base inteira de OS já normalizada pelo serviço. */
export async function fetchOverviewOsSource(): Promise<OverviewOsApiSource> {
  const response = await fetchFromBiApi<ApiRecordsResponse>(OVERVIEW_OS_RECORDS_PATH)
  const rawRecords = response.records

  if (!Array.isArray(rawRecords)) {
    fail('A API respondeu sem a lista de ordens de serviço.')
  }
  if (rawRecords.length === 0) {
    fail('A API respondeu sem nenhuma ordem de serviço para o período coberto.')
  }

  warnAboutQuality(response.quality)

  const updatedAt = response.source?.updated_at
  return {
    records: rawRecords.map((item, index) => toOverviewOsRecord(item as ApiOsRecord, index)),
    coverage: coverageOf(response),
    updatedAt: typeof updatedAt === 'string' && ISO_DATE.test(updatedAt) ? updatedAt : null,
  }
}
