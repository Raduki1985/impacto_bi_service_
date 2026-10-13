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
  /**
   * Identificador local e opaco da OS (`mock-os-NNNNNN`), nunca o código do
   * SGI. Vale para ESTE arquivo: vindo da API, o mesmo campo carrega o
   * código real da OS (`OS-2026-1234`), que é o que a lista da agenda de
   * hoje mostra ao gestor.
   */
  readonly id: string
  readonly dateISO: string
  /**
   * Turno do agendamento (`Manhã`, `Tarde`), como o serviço traduz
   * `service_orders.period`. OPCIONAL: a base local de estudo não o tem, e só
   * a lista da agenda de hoje o consome (21/09/2026). Nulo na OS sem período
   * marcado no SGI, que é menos de 0,5% delas.
   */
  readonly period?: string | null
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
  /**
   * Execução em campo, para a página de Técnicos (21/09/2026).
   *
   * Os cinco campos são OPCIONAIS de propósito: a base local de estudo
   * (`overviewOsFact.json`) não os tem. Ausentes, a página de Técnicos mostra
   * o ranking de volume e avisa que o tempo não está disponível, em vez de
   * somar zero e inventar um número. A Visão Geral usa o motivo no painel de
   * motivos e o início do serviço na faixa de hoje, e desde 24/09/2026 a
   * planilha de OS leva os cinco; campo ausente sai vazio, e não como
   * ausência do SGI.
   *
   * O deslocamento chega em MINUTOS já calculados, e não como dois horários,
   * porque o SGI gravou partida e chegada 3h adiantadas até 01/09/2026: a
   * duração é correta na base inteira, o instante de cada marca não é. O
   * serviço resolve isso na origem (ver `os_overview.py`).
   */
  readonly startedAt?: string | null
  readonly finishedAt?: string | null
  readonly travelMinutes?: number | null
  readonly difficulty?: string | null
  readonly unproductiveReason?: string | null
  /**
   * SLA e reagendamento (TSK-892, 13/10/2026), opcionais como os de execução:
   * a base local não os tem, e um serviço anterior responde sem eles.
   *
   * `slaMinutes` é o tempo PREVISTO de serviço no cliente, em minutos, da
   * categoria no SGI (1,5 h vira 90): não é prazo de atendimento, é quanto a
   * visita deve durar, e a mediana real de início a fim bate com ele.
   *
   * Reagendar não cria OS nova: a mesma OS ganha a data nova, e `dateISO` já
   * é a nova. Os três campos são o ÚLTIMO reagendamento; `rescheduleCount`
   * diz quantas vezes (0 = nunca). Motivo nulo numa OS reagendada é "não
   * informado": o SGI só tinha pontuação no campo.
   */
  readonly slaMinutes?: number | null
  readonly rescheduledAt?: string | null
  readonly rescheduledBy?: string | null
  /** Colaborador do SGI ou login de cliente; null sem usuário gravado. */
  readonly rescheduledByKind?: 'employee' | 'customer' | null
  readonly reschedulingReason?: string | null
  readonly rescheduleCount?: number | null
  /**
   * Só nas listas do período (01/10/2026): a saída, o grupo e o motivo da OS
   * como o painel clicado os conta, vindos do serviço junto com a OS. É o
   * que a lista e a planilha escrevem, e o que garante que a regra delas é a
   * mesma do painel, sem uma cópia dela aqui.
   */
  readonly outcome?: 'completed' | 'unproductive' | 'notExecuted' | 'open' | 'unknown'
  readonly group?: 'customer' | 'infrastructure'
  /** Motivo como a barra o nomeia ("Sem motivo registrado" inclusive); só nas improdutivas. */
  readonly listReason?: string | null
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
 *
 * Desde 18/09/2026 o de-para cobre os treze rótulos do catálogo, com as
 * chaves que o serviço traduz (`os_catalog`): a Visão Geral classifica toda
 * OS pela chave (em campo, a fazer, não executada), e sem isso a base local
 * mostraria onze rótulos como "sem classificação". Os quatro indicadores
 * continuam olhando só `completed` e `unproductive`.
 */
const LOCAL_STATUS_KEY: Readonly<Record<string, string>> = {
  Pendente: 'pending',
  Agendada: 'scheduled',
  Reagendada: 'rescheduled',
  'Em Deslocamento': 'in_motion',
  'Técnico no Local': 'arrived',
  'Em Andamento': 'in_progress',
  'Pendente de Aprovação': 'pending_approval',
  Concluída: OVERVIEW_OS_STATUS_KEY.completed,
  Cancelada: 'cancelled',
  Improdutiva: OVERVIEW_OS_STATUS_KEY.unproductive,
  Encerrada: 'closed',
  Expirada: 'expired',
  Provisionamento: 'provision',
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
