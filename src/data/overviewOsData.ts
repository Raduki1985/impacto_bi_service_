import {
  OS_SERVICE_TYPES,
  OS_STATUSES,
  OS_TEAMS,
  OS_TECHNICIANS,
} from './mockOsCatalog'
import overviewOsFactJson from './overviewOsFact.json'

/**
 * Fonte REAL e sanitizada da Visão Geral de OS.
 *
 * Os 4.465 registros de `overviewOsFact.json` são a projeção mínima da
 * tabela-fato sanitizada gerada do estudo do SGI (exportação por Data de
 * agendamento até 21/08/2026). Diferente de `mockOsData.ts`, aqui NENHUMA
 * combinação é sorteada: data, técnico, equipe, tipo, categoria, cidade,
 * status e resolução preservam as relações reais registro a registro.
 *
 * Esta fonte alimenta SOMENTE a Visão Geral. As demais páginas de OS seguem
 * no `DashboardDataProvider` com a simulação de `mockOsData.ts`, até que cada
 * uma tenha um bloco próprio aprovado.
 *
 * A projeção é sanitizada por construção: identificadores locais e opacos
 * (`mock-os-NNNNNN` para a OS e uma chave aleatória `overview-tech-<uuid>`
 * para o técnico), sem código real de OS, sem nomes de clientes ou técnicos,
 * sem endereço, telefone, coordenada ou observação. A chave do técnico é
 * exclusiva da Visão Geral e NÃO cruza com `OS_TECHNICIANS`: nenhum arquivo do
 * bundle associa esses aliases a um nome.
 */

export type OverviewOsRecord = {
  /** Identificador local e opaco da OS (`mock-os-NNNNNN`), nunca o código do SGI. */
  readonly id: string
  readonly dateISO: string
  /**
   * Chave anônima do técnico (`overview-tech-<uuid>` aleatório), exclusiva da
   * Visão Geral e sem correspondência no catálogo; null em OS sem executor.
   */
  readonly technicianId: string | null
  /**
   * Equipe do técnico como está no cadastro do SGI (`teams.name`); null
   * quando a OS não tem técnico ou ele não tem vínculo de equipe. Não é um
   * literal das 6 do catálogo: equipe nova cadastrada no SGI chega aqui com
   * o próprio nome (decisão de 04/09/2026).
   */
  readonly team: string | null
  /** Tipo real da fonte; inclui o valor aprovado `Customer (legado)`. */
  readonly serviceType: string
  /** Uma das 33 categorias reais do SGI, preservadas como estão. */
  readonly category: string
  /** Cidade normalizada; inclui o valor aprovado `Cidade não informada`. */
  readonly city: string
  /** Rótulo do status, para exibir. NUNCA para contar (ver `statusKey`). */
  readonly status: string
  /**
   * Chave de `service_orders.status` como está no SGI (`completed`).
   *
   * É por ela que Concluídas e Improdutivas são contadas, e não pelo rótulo:
   * rótulo é apresentação e pode mudar, chave é identidade (decisão de
   * 08/09/2026, orientação do dev do SGI). Nula quando a OS não tem status,
   * ou quando a base em uso não informa a chave.
   */
  readonly statusKey: string | null
  readonly resolution: string | null
}

/** Chaves do SGI que os indicadores contam. */
export const OVERVIEW_OS_STATUS_KEY = {
  completed: 'completed',
  unproductive: 'unproductive',
} as const

/** Tipo aprovado fora do catálogo simulado: resíduo legado da implantação do SGI. */
export const OVERVIEW_OS_LEGACY_SERVICE_TYPE = 'Customer (legado)'

/**
 * Ordem de exibição de status e de tipo de OS, vinda da fonte em uso.
 *
 * Com a API, é o de-para do serviço (`catalog.statuses` e
 * `catalog.service_types`): a ordem operacional dos status e a ordem do filtro
 * de tipo viajam na resposta, e a página não carrega lista própria. Com o
 * arquivo local, é a ordem declarada logo abaixo. Lista vazia significa "sem
 * ordem de negócio", e aí tudo sai em ordem alfabética pt-BR.
 */
export type OverviewOsCatalogOrder = {
  readonly statuses: readonly string[]
  readonly serviceTypes: readonly string[]
}

/**
 * Ordem do ARQUIVO LOCAL: a mesma dos catálogos simulados que validam o
 * arquivo. Vale só sem API configurada; com ela, nada daqui é consultado.
 */
export const OVERVIEW_OS_LOCAL_CATALOG_ORDER: OverviewOsCatalogOrder = {
  statuses: OS_STATUSES,
  serviceTypes: OS_SERVICE_TYPES,
}

/**
 * Padrão da chave anônima: prefixo próprio da Visão Geral + UUID v4 aleatório.
 * O formato rejeita, por construção, `mock-tech-NNN` e qualquer identificador
 * do catálogo simulado; a interseção com `OS_TECHNICIANS` ainda é checada
 * explicitamente abaixo, como defesa contra regenerações erradas da projeção.
 */
const OVERVIEW_TECH_ID_PATTERN =
  /^overview-tech-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const catalogTechnicianIds: ReadonlySet<string> = new Set(
  OS_TECHNICIANS.map((technician) => technician.id),
)

const validTeams: ReadonlySet<string> = new Set(OS_TEAMS)
const validServiceTypes: ReadonlySet<string> = new Set([
  ...OS_SERVICE_TYPES,
  OVERVIEW_OS_LEGACY_SERVICE_TYPE,
])
const validStatuses: ReadonlySet<string> = new Set(OS_STATUSES)

const RECORD_KEYS = [
  'id',
  'dateISO',
  'technicianId',
  'team',
  'serviceType',
  'category',
  'city',
  'status',
  'resolution',
] as const

/**
 * Rótulo -> chave do SGI, só para a base local.
 *
 * O arquivo de estudo é uma exportação sanitizada que guarda o status já em
 * português, sem a chave. Como os indicadores contam pela chave, ela é
 * derivada aqui, no único lugar que conhece esse arquivo. Rótulo sem chave
 * conhecida fica nulo: ele conta no total e nos gráficos, e não em Concluídas
 * nem em Improdutivas, que é exatamente o que significa.
 */
const LOCAL_STATUS_KEY: Readonly<Record<string, string>> = {
  Concluída: OVERVIEW_OS_STATUS_KEY.completed,
  Improdutiva: OVERVIEW_OS_STATUS_KEY.unproductive,
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/**
 * Valida a projeção importada antes de publicá-la para a página.
 *
 * A validação falha alto, em vez de aceitar silenciosamente um arquivo
 * regenerado com estrutura errada: um erro aqui aparece no build, nos testes e
 * no console, e não como um dashboard com números errados.
 */
function parseOverviewOsRecords(raw: unknown): readonly OverviewOsRecord[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('overviewOsFact.json deve ser uma lista não vazia de registros')
  }

  const seenIds = new Set<string>()
  const teamByTechnician = new Map<string, string>()

  const records = raw.map((item: unknown, index: number): OverviewOsRecord => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`overviewOsFact.json: registro ${index} não é um objeto`)
    }

    const keys = Object.keys(item)
    if (keys.length !== RECORD_KEYS.length || RECORD_KEYS.some((key) => !(key in item))) {
      throw new Error(`overviewOsFact.json: registro ${index} com chaves fora da projeção aprovada`)
    }

    const record = item as Record<(typeof RECORD_KEYS)[number], unknown>
    const { id, dateISO, technicianId, team, serviceType, category, city, status, resolution } =
      record

    if (typeof id !== 'string' || !/^mock-os-\d{6}$/.test(id) || seenIds.has(id)) {
      throw new Error(`overviewOsFact.json: id inválido ou repetido no registro ${index}`)
    }
    seenIds.add(id)

    if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      throw new Error(`overviewOsFact.json: data inválida no registro ${id}`)
    }
    if (!isNullableString(technicianId) || !isNullableString(team)) {
      throw new Error(`overviewOsFact.json: técnico ou equipe inválidos no registro ${id}`)
    }
    if ((technicianId === null) !== (team === null)) {
      throw new Error(`overviewOsFact.json: técnico e equipe incoerentes no registro ${id}`)
    }
    if (technicianId !== null) {
      if (!OVERVIEW_TECH_ID_PATTERN.test(technicianId)) {
        throw new Error(`overviewOsFact.json: technicianId fora do padrão anônimo no registro ${id}`)
      }
      if (catalogTechnicianIds.has(technicianId)) {
        throw new Error(
          `overviewOsFact.json: technicianId do catálogo simulado no registro ${id}; ` +
            'a projeção só aceita chaves anônimas sem associação a nomes',
        )
      }
    }
    if (team !== null && !validTeams.has(team)) {
      throw new Error(`overviewOsFact.json: equipe fora do catálogo oficial no registro ${id}`)
    }
    if (technicianId !== null && team !== null) {
      const knownTeam = teamByTechnician.get(technicianId)
      if (knownTeam === undefined) {
        teamByTechnician.set(technicianId, team)
      } else if (knownTeam !== team) {
        throw new Error(
          `overviewOsFact.json: chave anônima em mais de uma equipe no registro ${id}`,
        )
      }
    }
    if (typeof serviceType !== 'string' || !validServiceTypes.has(serviceType)) {
      throw new Error(`overviewOsFact.json: tipo de OS inesperado no registro ${id}`)
    }
    if (typeof status !== 'string' || !validStatuses.has(status)) {
      throw new Error(`overviewOsFact.json: status fora do catálogo no registro ${id}`)
    }
    if (typeof category !== 'string' || category === '') {
      throw new Error(`overviewOsFact.json: categoria vazia no registro ${id}`)
    }
    if (typeof city !== 'string' || city === '') {
      throw new Error(`overviewOsFact.json: cidade vazia no registro ${id}`)
    }
    if (!isNullableString(resolution) || resolution === '') {
      throw new Error(`overviewOsFact.json: resolução inválida no registro ${id}`)
    }

    return {
      id,
      dateISO,
      technicianId,
      team,
      serviceType,
      category,
      city,
      status,
      statusKey: LOCAL_STATUS_KEY[status] ?? null,
      resolution,
    }
  })

  return records
}

/** Os 4.465 registros reais e sanitizados, validados na carga do módulo. */
export const OVERVIEW_OS_RECORDS: readonly OverviewOsRecord[] =
  parseOverviewOsRecords(overviewOsFactJson)

function dateRangeOf(records: readonly OverviewOsRecord[]): { min: string; max: string } {
  let min = records[0].dateISO
  let max = records[0].dateISO

  for (const record of records) {
    if (record.dateISO < min) min = record.dateISO
    if (record.dateISO > max) max = record.dateISO
  }

  return { min, max }
}

/**
 * Cobertura real da fonte (06/04/2026 a 21/08/2026), derivada dos dados, e não
 * do relógio: uma base estática não muda de janela quando o dia vira.
 */
export const OVERVIEW_OS_DATE_RANGE = dateRangeOf(OVERVIEW_OS_RECORDS)

/**
 * Período padrão da Visão Geral: o mês mais recente da base, do dia 1 do mês
 * da data máxima até a própria data máxima. Se a fonte for atualizada, o
 * padrão acompanha automaticamente o novo mês.
 */
export const OVERVIEW_OS_DEFAULT_PERIOD = {
  start: `${OVERVIEW_OS_DATE_RANGE.max.slice(0, 7)}-01`,
  end: OVERVIEW_OS_DATE_RANGE.max,
} as const
