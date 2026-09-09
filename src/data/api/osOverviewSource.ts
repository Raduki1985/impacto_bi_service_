import type { OverviewOsCatalogOrder, OverviewOsRecord } from '../overviewOsData'
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
  readonly status_key: unknown
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
 * Converte um registro da API na projeção que a página consome.
 *
 * A validação é de FORMA (texto presente, data ISO), não de vocabulário: os
 * valores vêm do banco do SGI via serviço, e o que o banco disser é o dado
 * (decisão de 04/09/2026 — nenhuma lista fechada no portal). Vocabulário
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
  // nome verdadeiro — como já acontece com categoria. O catálogo OS_TEAMS
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

      return { id, name }
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
    technicians: techniciansOf(response.catalog?.technicians),
    catalogOrder: {
      statuses: catalogOrderOf(response.catalog?.statuses, 'status'),
      serviceTypes: catalogOrderOf(response.catalog?.service_types, 'tipos de OS'),
    },
  }
}
