import { formatDateBr } from '../lib/formatters'
import { isValidISODate } from './dashboardFilters'
import { todayISO } from './defaultPeriod'
import {
  lastDayOfMonth,
  mondayOf,
  previousMonthStart,
  shiftISODate,
  weekdayNameOf,
} from './isoDate'

/**
 * Atalhos de período da faixa de filtros do portal.
 *
 * Nasceram na Visão Geral de OS (aprovados pelo Mário em 22/09/2026 para a
 * apresentação à diretoria: diretor clica em "Mês passado", não digita
 * data) e saíram de `overviewOsFilters.ts` em 24/09/2026, quando a faixa de
 * filtros virou componente do portal. A regra não sabe o que é uma OS: vale
 * para qualquer página que recorte por data.
 *
 * Todos mostram DIAS FECHADOS, a mesma regra do período padrão da Visão
 * Geral de OS: quem clica em "Mês passado" espera um resultado completo. No
 * dia em que o atalho "corrente" ainda não tem dia fechado (segunda-feira
 * para a semana, dia 1 para o mês), o botão fica desabilitado com o motivo
 * (`periodPresetNotStartedReason`): antes ele caía no período anterior
 * inteiro, e na segunda "Esta semana" dava o mesmo que "Semana passada" sem
 * dizer por quê (apontado pelo Mário em 28/09/2026). A janela continua
 * calculada assim, para quem pede a data fora do botão.
 *
 * O que ficou de fora, de propósito: "Hoje" (é a faixa Hoje ao vivo, e nos
 * cards mostraria taxa de um dia pela metade), o futuro (os cards medem
 * resultado, e a agenda futura é outra pergunta) e trimestre ou ano (as OS
 * no SGI começam em junho de 2026).
 */
export const PERIOD_PRESETS = [
  { key: 'yesterday', label: 'Ontem' },
  { key: 'thisWeek', label: 'Esta semana' },
  { key: 'lastWeek', label: 'Semana passada' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
] as const

export type PeriodPresetKey = (typeof PERIOD_PRESETS)[number]['key']

/** Início e Fim de um recorte, em ISO, como os filtros de página guardam. */
export type PeriodRange = { readonly dateFrom: string; readonly dateTo: string }

/**
 * Cobertura de datas de uma fonte: do primeiro ao último dia com dado. É o
 * mesmo par que os calendários da faixa usam como limite.
 */
export type DateCoverage = { readonly min: string; readonly max: string }

/** Janela de um atalho, para a data de hoje informada (o relógio, no portal). */
export function periodPresetRange(key: PeriodPresetKey, today: string = todayISO()): PeriodRange {
  const yesterday = shiftISODate(today, -1)
  const monday = mondayOf(today)
  const lastWeek = { dateFrom: shiftISODate(monday, -7), dateTo: shiftISODate(monday, -1) }
  const previousStart = previousMonthStart(today)
  const lastMonth = { dateFrom: previousStart, dateTo: lastDayOfMonth(previousStart) }

  switch (key) {
    case 'yesterday':
      return { dateFrom: yesterday, dateTo: yesterday }
    case 'thisWeek':
      return monday > yesterday ? lastWeek : { dateFrom: monday, dateTo: yesterday }
    case 'lastWeek':
      return lastWeek
    case 'thisMonth': {
      const start = `${today.slice(0, 7)}-01`

      return start > yesterday ? lastMonth : { dateFrom: start, dateTo: yesterday }
    }
    case 'lastMonth':
      return lastMonth
  }
}

/**
 * Motivo de o atalho "corrente" não se aplicar hoje, ou null quando se
 * aplica. A semana que começa hoje (segunda-feira) e o mês que começa hoje
 * (dia 1) ainda não têm nenhum dia fechado para mostrar.
 */
export function periodPresetNotStartedReason(
  key: PeriodPresetKey,
  today: string = todayISO(),
): string | null {
  if (key === 'thisWeek' && mondayOf(today) === today) {
    return 'A semana começou hoje e ainda não tem dia fechado'
  }
  if (key === 'thisMonth' && today.endsWith('-01')) {
    return 'O mês começou hoje e ainda não tem dia fechado'
  }

  return null
}

/** true quando a janela inteira cabe na cobertura da fonte: fora disso o atalho não se aplica. */
export function periodWithinCoverage(range: PeriodRange, coverage: DateCoverage): boolean {
  return range.dateFrom >= coverage.min && range.dateTo <= coverage.max
}

/**
 * Ordem em que os atalhos são reconhecidos quando dois deles dão a mesma
 * janela: vale o de NOME verdadeiro. No dia 1 "Este mês" e "Mês passado" são
 * o mesmo recorte, e o que acende é "Mês passado", porque é o que as datas
 * mostram; na segunda-feira, "Semana passada" e não "Esta semana"; na terça,
 * "Ontem" e não "Esta semana". A ordem de EXIBIÇÃO continua a de
 * `PERIOD_PRESETS`.
 */
const PRESET_RECOGNITION_ORDER: readonly PeriodPresetKey[] = [
  'yesterday',
  'lastWeek',
  'thisWeek',
  'lastMonth',
  'thisMonth',
]

/**
 * Atalho que corresponde ao período escolhido, ou null quando ele é
 * personalizado. Derivado das datas, e não guardado: assim o atalho continua
 * marcado depois de recarregar a página, e some sozinho quando o gestor mexe
 * numa das datas.
 */
export function activePeriodPreset(
  range: PeriodRange,
  today: string = todayISO(),
  /**
   * Atalho que o gestor clicou por último. Enquanto as datas forem as dele,
   * ele acende, mesmo que outro atalho dê o mesmo recorte: numa terça-feira
   * "Esta semana" é só a segunda, igual a "Ontem", e sem isto o clique em
   * "Esta semana" acendia "Ontem" (apontado pelo Mário em 23/09/2026). Ao
   * recarregar, ou depois de mexer numa data, volta a valer o nome verdadeiro.
   */
  chosen: PeriodPresetKey | null = null,
): PeriodPresetKey | null {
  const matches = (key: PeriodPresetKey) => {
    const preset = periodPresetRange(key, today)

    return preset.dateFrom === range.dateFrom && preset.dateTo === range.dateTo
  }

  // Atalho desabilitado hoje não acende, nem se foi o último clicado.
  if (chosen !== null && periodPresetNotStartedReason(chosen, today) === null && matches(chosen)) {
    return chosen
  }

  return PRESET_RECOGNITION_ORDER.find(matches) ?? null
}

/**
 * Período por extenso, no resumo da faixa e na dica de cada atalho. Um dia só
 * ganha o nome do dia da semana ("segunda-feira, 21/09/2026"): "21/09/2026 a
 * 21/09/2026" repetia a data e não dizia que dia era (pedido do Mário em
 * 23/09/2026). Data fora do formato não passa por `Date` nem inventa dia:
 * escreve que não está definida.
 */
export function periodRangeText(range: PeriodRange): string {
  const from = isValidISODate(range.dateFrom) ? formatDateBr(range.dateFrom) : 'Data não definida'
  const to = isValidISODate(range.dateTo) ? formatDateBr(range.dateTo) : 'Data não definida'

  if (range.dateFrom === range.dateTo && isValidISODate(range.dateTo)) {
    return `${weekdayNameOf(range.dateTo)}, ${to}`
  }

  return `${from} a ${to}`
}
