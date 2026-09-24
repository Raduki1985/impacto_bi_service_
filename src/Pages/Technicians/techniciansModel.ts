import type { OverviewOsTechnician } from '../../data/api/osOverviewSource'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { osStatusKind } from '../Overview/osStatusKind'

/**
 * Modelo analítico da página de Técnicos de OS.
 *
 * As três decisões que este módulo congela vieram do Mário em 21/09/2026,
 * depois da medição no SGI de produção (junho a setembro de 2026):
 *
 * 1. A régua do ranking é VISITA CONCLUÍDA POR DIA TRABALHADO, e não o total
 *    de concluídas. O total premia quem teve mais dias no mês, e a operação
 *    tem técnico entrando no meio do período, férias e afastamento. Hoje a
 *    mediana da operação é 3,25 por dia.
 * 2. Quem faz câmera não é comparado com quem faz internet. Medido em
 *    agosto: metade do time faz instalação de internet (76% instalação, 24%
 *    mudança de endereço) e a outra metade faz câmeras (86% a 98% do
 *    trabalho). Os três últimos colocados da taxa de conclusão eram todos do
 *    time de câmeras, e não por serem piores. A frente de trabalho sai do
 *    serviço que o técnico mais executou no período, e não do cadastro de
 *    equipes do SGI, que mistura Terceirizada com a especialidade.
 * 3. A visita improdutiva é CONTEXTO, nunca demérito. Dos 729 motivos
 *    registrados de junho a setembro, 378 são cliente ausente, 103 local sem
 *    condição e 36 clima; só 6 (material em falta) apontam para algo sob
 *    controle do técnico. Por isso a taxa de conclusão não ordena ninguém
 *    aqui: ela mede o cliente e a infraestrutura.
 *
 * O que este módulo NÃO faz: nota combinada, meta por técnico e retrabalho.
 * Meta não existe em cadastro nenhum, e retrabalho não é mensurável (só 13 de
 * 2.623 instalações geraram manutenção em 30 dias: o chamado de suporte não
 * está no SGI). Inventar qualquer um dos três seria número sem fonte.
 */

/** Frentes de trabalho, na ordem em que a página as apresenta. */
export const WORK_FRONTS = [
  { key: 'internet', label: 'Internet' },
  { key: 'cameras', label: 'Câmeras' },
  { key: 'infrastructure', label: 'Infraestrutura' },
  { key: 'other', label: 'Outros serviços' },
] as const

export type WorkFrontKey = (typeof WORK_FRONTS)[number]['key']

/**
 * Tipo de OS (rótulo do serviço) para frente de trabalho.
 *
 * Instalação e mudança de endereço andam juntas no mesmo técnico, medido em
 * agosto, e por isso formam uma frente só. Tipo novo que o serviço mandar cai
 * em "Outros serviços" em vez de sumir: o técnico continua no ranking e a
 * pendência de catálogo fica visível na coluna do serviço.
 */
const FRONT_BY_SERVICE_TYPE: Readonly<Record<string, WorkFrontKey>> = {
  'Instalação': 'internet',
  'Mudança de Endereço': 'internet',
  'Instalação de Câmera': 'cameras',
  'Infraestrutura': 'infrastructure',
  'Manutenção': 'other',
  'Retirada': 'other',
  'Auditoria': 'other',
}

export function workFrontOf(serviceType: string): WorkFrontKey {
  return FRONT_BY_SERVICE_TYPE[serviceType] ?? 'other'
}

/**
 * Piso para entrar no ranking: cinco dias em campo no período.
 *
 * Sem ele, o técnico que fez uma única visita e a concluiu aparece com 1,00
 * por dia e uma taxa de 100%, acima de quem sustentou o mês inteiro. Quem
 * está abaixo do piso NÃO desaparece: continua na tabela, no fim, marcado
 * como pouca atividade, porque some-lo esconderia trabalho que aconteceu.
 */
export const RANKING_MIN_DAYS = 5

export type TechnicianRow = {
  readonly id: string
  /** Nome do catálogo do serviço; o identificador quando o nome não veio. */
  readonly name: string
  /** Equipe do cadastro do SGI, quando o técnico tem vínculo. */
  readonly team: string | null
  readonly front: WorkFrontKey
  /** Visitas que aconteceram: concluídas mais improdutivas. */
  readonly visits: number
  readonly completed: number
  readonly unproductive: number
  /** Dias distintos com pelo menos uma visita. */
  readonly daysWorked: number
  /** A régua: concluídas por dia trabalhado. */
  readonly completedPerDay: number
  /** Proporção de 0 a 1; contexto, nunca ordenação. */
  readonly completionRate: number
  /** Mediana do tempo de serviço no cliente, em minutos; nula sem medição. */
  readonly serviceMinutes: number | null
  /** Mediana do deslocamento até o cliente, em minutos; nula sem medição. */
  readonly travelMinutes: number | null
  /** Participação de cada frente nas visitas do técnico, já ordenada. */
  readonly mix: readonly { readonly front: WorkFrontKey; readonly share: number }[]
  /** Abaixo do piso de dias: fica na tabela, fora do gráfico de ranking. */
  readonly lowActivity: boolean
}

/** Mediana de uma lista de números; nula quando não há nenhum valor medido. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((um, outro) => um - outro)
  const meio = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[meio - 1] + sorted[meio]) / 2 : sorted[meio]
}

/** Minutos de serviço de uma OS, quando os dois marcos existem e fazem sentido. */
export function serviceMinutesOf(record: OverviewOsRecord): number | null {
  const { startedAt, finishedAt } = record
  if (!startedAt || !finishedAt) return null
  const inicio = Date.parse(startedAt)
  const fim = Date.parse(finishedAt)
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) return null
  return (fim - inicio) / 60000
}

/** A OS foi uma visita que aconteceu, concluída ou improdutiva. */
function isVisit(record: OverviewOsRecord): boolean {
  const kind = osStatusKind(record.statusKey)
  return kind === 'completed' || kind === 'unproductive'
}

type Bucket = {
  name: string
  team: string | null
  completed: number
  unproductive: number
  days: Set<string>
  serviceMinutes: number[]
  travelMinutes: number[]
  byFront: Map<WorkFrontKey, number>
}

/**
 * Uma linha por técnico que esteve em campo no recorte.
 *
 * Só entram OS com executor e que viraram visita: a OS ainda agendada, a
 * encerrada no escritório e a expirada não são trabalho de campo e não podem
 * dividir o dia de ninguém. Técnico sem nome no catálogo entra pelo
 * identificador, em vez de ficar de fora do ranking.
 */
export function buildTechnicianRows(
  records: readonly OverviewOsRecord[],
  technicians: readonly OverviewOsTechnician[],
): TechnicianRow[] {
  const nomePorId = new Map(technicians.map((technician) => [technician.id, technician.name]))
  const baldes = new Map<string, Bucket>()

  for (const record of records) {
    const id = record.technicianId
    if (id === null || !isVisit(record)) continue

    let balde = baldes.get(id)
    if (balde === undefined) {
      balde = {
        name: nomePorId.get(id) ?? id,
        team: record.team,
        completed: 0,
        unproductive: 0,
        days: new Set<string>(),
        serviceMinutes: [],
        travelMinutes: [],
        byFront: new Map<WorkFrontKey, number>(),
      }
      baldes.set(id, balde)
    }

    // A equipe vem da OS e pode faltar em algumas: a primeira preenchida vale
    // para o técnico, porque o vínculo é do cadastro e não da ordem.
    if (balde.team === null && record.team !== null) balde.team = record.team

    if (osStatusKind(record.statusKey) === 'completed') balde.completed += 1
    else balde.unproductive += 1

    balde.days.add(record.dateISO)

    const front = workFrontOf(record.serviceType)
    balde.byFront.set(front, (balde.byFront.get(front) ?? 0) + 1)

    const servico = serviceMinutesOf(record)
    if (servico !== null) balde.serviceMinutes.push(servico)
    const deslocamento = record.travelMinutes
    if (deslocamento !== null && deslocamento !== undefined) {
      balde.travelMinutes.push(deslocamento)
    }
  }

  const linhas: TechnicianRow[] = []
  for (const [id, balde] of baldes) {
    const visits = balde.completed + balde.unproductive
    const daysWorked = balde.days.size
    const mix = [...balde.byFront.entries()]
      .map(([front, quantidade]) => ({ front, share: quantidade / visits }))
      .sort((um, outro) => outro.share - um.share || frontOrder(um.front) - frontOrder(outro.front))

    linhas.push({
      id,
      name: balde.name,
      team: balde.team,
      // Frente predominante. O empate cai na ordem declarada em WORK_FRONTS,
      // que é determinística: o mesmo recorte nunca muda de resultado.
      front: mix[0]?.front ?? 'other',
      visits,
      completed: balde.completed,
      unproductive: balde.unproductive,
      daysWorked,
      completedPerDay: daysWorked === 0 ? 0 : balde.completed / daysWorked,
      completionRate: visits === 0 ? 0 : balde.completed / visits,
      serviceMinutes: median(balde.serviceMinutes),
      travelMinutes: median(balde.travelMinutes),
      mix,
      lowActivity: daysWorked < RANKING_MIN_DAYS,
    })
  }

  return linhas.sort(compareByRanking)
}

function frontOrder(front: WorkFrontKey): number {
  return WORK_FRONTS.findIndex((item) => item.key === front)
}

/**
 * Ordem do ranking: pouca atividade sempre no fim, depois a régua, e o
 * desempate por volume e por nome, nesta ordem. Dois técnicos com a mesma
 * média por dia ficam sempre na mesma posição relativa, recorte após recorte.
 */
export function compareByRanking(um: TechnicianRow, outro: TechnicianRow): number {
  if (um.lowActivity !== outro.lowActivity) return um.lowActivity ? 1 : -1
  if (outro.completedPerDay !== um.completedPerDay) {
    return outro.completedPerDay - um.completedPerDay
  }
  if (outro.completed !== um.completed) return outro.completed - um.completed
  return um.name.localeCompare(outro.name, 'pt-BR')
}

/** Linhas de uma frente, já ordenadas, para o ranking separado por time. */
export function rowsOfFront(
  rows: readonly TechnicianRow[],
  front: WorkFrontKey,
): TechnicianRow[] {
  return rows.filter((row) => row.front === front)
}

export type TechniciansSummary = {
  /** Técnicos que estiveram em campo no recorte. */
  readonly technicians: number
  readonly visits: number
  readonly completed: number
  /** Média de concluídas por técnico por dia em campo, da operação inteira. */
  readonly completedPerDay: number | null
  /** Mediana do tempo de serviço por visita; nula sem medição no recorte. */
  readonly serviceMinutes: number | null
  /** Mediana do deslocamento por visita; nula sem medição no recorte. */
  readonly travelMinutes: number | null
  /**
   * Parte da jornada em serviço ou em deslocamento, de 0 a 1.
   *
   * A jornada de um dia vai do primeiro início ao último fim daquele técnico,
   * e só entram dias com DUAS visitas ou mais: num dia de visita única a
   * jornada é a própria visita, e a conta daria sempre 100%. Nula quando o
   * recorte não tem nenhum dia assim.
   */
  readonly occupancy: number | null
  /** Dias de campo somados, a base da ocupação. */
  readonly workDays: number
}

/**
 * Indicadores do topo, sobre o mesmo recorte do ranking.
 *
 * A ocupação é indicador da OPERAÇÃO, e não coluna de técnico, de propósito:
 * a jornada começa no primeiro serviço do dia, então o deslocamento que levou
 * o técnico até a primeira visita fica fora da janela. Somado o time inteiro
 * isso se diluí e o número descreve o dia; por técnico, viraria uma diferença
 * de arredondamento disputando posição no ranking.
 */
export function buildTechniciansSummary(
  records: readonly OverviewOsRecord[],
): TechniciansSummary {
  const visitas = records.filter((record) => record.technicianId !== null && isVisit(record))
  const concluidas = visitas.filter((record) => osStatusKind(record.statusKey) === 'completed')

  const diasPorTecnico = new Map<string, Set<string>>()
  // Chave técnico + dia: é o grão da jornada e o da ocupação.
  const jornadas = new Map<string, OverviewOsRecord[]>()
  for (const record of visitas) {
    const id = record.technicianId
    if (id === null) continue
    const dias = diasPorTecnico.get(id) ?? new Set<string>()
    dias.add(record.dateISO)
    diasPorTecnico.set(id, dias)

    const chave = `${id}|${record.dateISO}`
    const doDia = jornadas.get(chave) ?? []
    doDia.push(record)
    jornadas.set(chave, doDia)
  }

  let diasTrabalhados = 0
  for (const dias of diasPorTecnico.values()) diasTrabalhados += dias.size

  const servico = visitas
    .map(serviceMinutesOf)
    .filter((valor): valor is number => valor !== null)
  const deslocamento = visitas
    .map((record) => record.travelMinutes)
    .filter((valor): valor is number => valor !== null && valor !== undefined)

  let minutosTrabalhados = 0
  let minutosJornada = 0
  for (const doDia of jornadas.values()) {
    const comMarcos = doDia.filter((record) => serviceMinutesOf(record) !== null)
    if (comMarcos.length < 2) continue

    const inicios = comMarcos.map((record) => Date.parse(record.startedAt as string))
    const fins = comMarcos.map((record) => Date.parse(record.finishedAt as string))
    const jornada = (Math.max(...fins) - Math.min(...inicios)) / 60000
    if (jornada <= 0) continue

    let trabalho = 0
    for (const record of comMarcos) {
      trabalho += serviceMinutesOf(record) ?? 0
      trabalho += record.travelMinutes ?? 0
    }
    minutosTrabalhados += trabalho
    minutosJornada += jornada
  }

  return {
    technicians: diasPorTecnico.size,
    visits: visitas.length,
    completed: concluidas.length,
    completedPerDay: diasTrabalhados === 0 ? null : concluidas.length / diasTrabalhados,
    serviceMinutes: median(servico),
    travelMinutes: median(deslocamento),
    occupancy: minutosJornada === 0 ? null : minutosTrabalhados / minutosJornada,
    workDays: diasTrabalhados,
  }
}

export type UnproductiveReasonRow = {
  readonly reason: string
  readonly count: number
  readonly share: number
}

/** Rótulo das improdutivas em que o SGI não registrou motivo nenhum. */
export const UNPRODUCTIVE_REASON_MISSING = 'Sem motivo registrado'

/**
 * Motivos das visitas improdutivas do recorte, do mais frequente ao menos.
 *
 * Improdutiva sem motivo NÃO some: vira uma linha própria, porque ela é uma
 * visita que falhou e alguém precisa saber que o registro ficou em branco.
 * O empate sai em ordem alfabética, para a lista não trocar de ordem a cada
 * recorte.
 */
export function buildUnproductiveReasons(
  records: readonly OverviewOsRecord[],
): UnproductiveReasonRow[] {
  const improdutivas = records.filter(
    (record) => osStatusKind(record.statusKey) === 'unproductive',
  )
  if (improdutivas.length === 0) return []

  const contagem = new Map<string, number>()
  for (const record of improdutivas) {
    const motivo = record.unproductiveReason ?? UNPRODUCTIVE_REASON_MISSING
    contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      share: count / improdutivas.length,
    }))
    .sort((um, outro) => outro.count - um.count || um.reason.localeCompare(outro.reason, 'pt-BR'))
}

/**
 * O recorte tem medição de tempo?
 *
 * A base local de estudo não tem os marcos de campo, e um serviço anterior a
 * 21/09/2026 também não os manda. Nos dois casos a página mostra o ranking de
 * volume e diz que o tempo não está disponível, em vez de desenhar zeros.
 */
export function hasFieldTiming(records: readonly OverviewOsRecord[]): boolean {
  return records.some((record) => serviceMinutesOf(record) !== null)
}
