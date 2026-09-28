import {
  buildDeltaFromKpi,
  PREVIOUS_PERIOD_COMPARISON,
  type ExecutiveComparison,
} from '../../../components/dashboard/executiveMetricCardModel'
import { COMMERCIAL_PERIOD_START, formatIsoAsBrDate } from '../../../data/commercialCalendar'
import { shiftISODate } from '../../../data/isoDate'
import { formatDecimal, formatNumber } from '../../../lib/formatters'
import type { CommercialCardDelta } from '../components/commercialCardModel'
import type { OverviewMaturity } from './overviewModel'

/**
 * Regras do card de bloqueio ou cancelamento em 90 dias.
 *
 * Ocupou a vaga do Aguardando Ativação em 28/09/2026, decisão do Mário: a
 * fila do que foi vendido e não ativou já aparece na Safra e na faixa Hoje ao
 * vivo, e faltava na página o que acontece DEPOIS do sinal ligado. Ficam fora
 * da página, como as do Tempo até a ativação, porque têm casos de borda
 * próprios (período cedo demais, recorte sem venda, período anterior sem
 * medida) e precisam de teste direto.
 *
 * O que o card mede está em `OverviewMaturity`: das vendas que completaram
 * 90 dias no período, quantas estavam em bloqueio financeiro ou canceladas no
 * 90º dia. Idade fixa, e não a situação de hoje, porque hoje o mês antigo
 * parece pior só por ter tido mais tempo (em 28/09/2026: 25,6% das ativadas
 * em janeiro contra 1,9% das de agosto). Só cancelamento ficaria perto de 1%
 * em qualquer mês: o problema da venda aparece primeiro como bloqueio, e o
 * cancelamento por inadimplência só vem depois de 60 dias de atraso.
 */

/** Idade em que a venda é julgada, a mesma do serviço (`MATURITY_DAYS`). */
export const MATURITY_DAYS = 90

/**
 * Nome do card. Provisório: o Mário aprovou a regra em 28/09/2026 e pediu
 * para pensar num nome melhor. Mora aqui para a troca ser num lugar só.
 */
export const MATURITY_CARD_LABEL = 'Bloqueio ou cancelamento em 90 dias'

/**
 * Primeiro dia de período que o card mede: o período julga as ativações de
 * 90 dias antes, e a base começa em `COMMERCIAL_PERIOD_START`. Antes disso o
 * serviço devolve nulo, porque medir só uma parte enganaria.
 */
export function firstMeasuredPeriodStart(): string {
  return shiftISODate(COMMERCIAL_PERIOD_START, MATURITY_DAYS)
}

/** Bloqueadas mais canceladas: as duas não se sobrepõem. */
export function maturityTroubled(maturity: OverviewMaturity): number {
  return maturity.blocked + maturity.cancelled
}

/** A parcela em destaque, de 0 a 1; nula quando nenhuma venda completou 90 dias. */
export function maturityRate(maturity: OverviewMaturity): number | null {
  return maturity.sales === 0 ? null : maturityTroubled(maturity) / maturity.sales
}

function shortDate(iso: string): string {
  return formatIsoAsBrDate(iso).slice(0, 5)
}

/**
 * Quando as vendas julgadas ligaram o sinal, no meio de uma frase: `de 03 a
 * 29/06` dentro de um mês, `de 03/06 a 02/07` entre dois, `em 03/06` num
 * período de um dia. Curto porque cabe numa linha da frente do card (a forma
 * `de 03/06 a 29/06` quebrava em 1366 px). Sem o ano, porque a janela é
 * sempre de 90 dias antes do período que a faixa acima já escreve.
 */
export function maturityWindow(maturity: OverviewMaturity): string {
  const { activatedFrom: from, activatedTo: to } = maturity
  if (from === to) return `em ${shortDate(from)}`
  if (from.slice(0, 7) === to.slice(0, 7)) return `de ${from.slice(8, 10)} a ${shortDate(to)}`
  return `de ${shortDate(from)} a ${shortDate(to)}`
}

/**
 * Linha de detalhe da frente: quantas de quantas, e de quando é o sinal. Sem
 * ela o percentual de setembro seria lido como sobre as vendas de setembro,
 * e ele é sobre as ativadas em junho.
 */
export function maturityDetail(maturity: OverviewMaturity): string {
  const ativadas = maturity.sales === 1 ? 'ativada' : 'ativadas'
  return `${formatNumber(maturityTroubled(maturity))} de ${formatNumber(maturity.sales)} ${ativadas} ${maturityWindow(maturity)}`
}

/**
 * Comparação com o período anterior, em PONTOS (p.p.), como as taxas da
 * Visão Geral de OS (decisão do Mário em 23/09/2026): com o número principal
 * em percentual, a variação relativa se leria como nível. Subir é
 * desfavorável.
 *
 * O período anterior julga as ativações 90 dias antes DELE: setembro julga
 * junho e compara com agosto, que julga maio. Sem medida ali (período cedo
 * demais ou nenhuma venda), nenhum número é inventado.
 */
export function maturityDelta(
  current: OverviewMaturity,
  previous: OverviewMaturity | null,
  comparison: ExecutiveComparison = PREVIOUS_PERIOD_COMPARISON,
): CommercialCardDelta {
  const subject = 'A parcela bloqueada ou cancelada no 90º dia'
  const rate = maturityRate(current)
  const previousRate = previous === null ? null : maturityRate(previous)

  if (rate === null || previousRate === null) {
    return buildDeltaFromKpi(
      {
        text: '',
        positive: false,
        available: false,
        ...(previous !== null && previousRate === null
          ? {
              unavailableLabel: 'Sem vendas no período anterior',
              unavailableAccessibleLabel:
                'nenhuma venda completou 90 dias no período anterior',
            }
          : {}),
      },
      subject,
      'direcional',
      comparison,
    )
  }

  const points = (rate - previousRate) * 100
  const shown = formatDecimal(Math.abs(points), 1)

  return buildDeltaFromKpi(
    {
      text: `${points >= 0 ? '+' : '-'}${shown} p.p.`,
      positive: points < 0,
      available: true,
    },
    subject,
    'direcional',
    comparison,
  )
}

/** `1 venda`, `594 vendas`. */
function salesAmount(count: number): string {
  return count === 1 ? '1 venda' : `${formatNumber(count)} vendas`
}

/** Título da leitura gerencial, com o número do card por extenso. */
export function maturityReadingTitle(maturity: OverviewMaturity): string {
  const troubled = maturityTroubled(maturity)

  if (troubled === 0) {
    return maturity.sales === 1
      ? 'A venda que completou 90 dias estava em dia.'
      : `Nenhuma das ${formatNumber(maturity.sales)} vendas estava bloqueada ou cancelada no 90º dia.`
  }
  if (maturity.sales === 1) return 'A venda que completou 90 dias estava bloqueada ou cancelada.'
  if (troubled === 1) {
    return `1 das ${formatNumber(maturity.sales)} vendas estava bloqueada ou cancelada no 90º dia.`
  }

  return `${formatNumber(troubled)} das ${formatNumber(maturity.sales)} vendas estavam bloqueadas ou canceladas no 90º dia.`
}

/**
 * Corpo da leitura: de quando é o sinal, a divisão entre bloqueio e
 * cancelamento, e o que fica fora da conta.
 */
export function maturityReadingText(maturity: OverviewMaturity): string {
  const blocked = maturity.blocked === 1 ? '1 em bloqueio financeiro' : `${formatNumber(maturity.blocked)} em bloqueio financeiro`
  const cancelled = maturity.cancelled === 1 ? '1 cancelada' : `${formatNumber(maturity.cancelled)} canceladas`

  return `${salesAmount(maturity.sales)} com sinal ligado {${maturityWindow(maturity)}}: {${blocked}} e {${cancelled}} no 90º dia. Venda cancelada sem chegar a instalar fica fora da conta.`
}

/** O OBSERVAR: onde agir, e não a definição outra vez. */
export const MATURITY_OBSERVE =
  'Com os filtros de vendedor, time e cidade, onde a venda dá errado depois de ativar.'

/**
 * O card sem medida. Dois casos que a tela distingue pelo período: cedo
 * demais, que o gestor resolve escolhendo outro período, e fonte sem o
 * histórico (base sintética, ou a consulta do histórico que passou do limite
 * no serviço), que se resolve sozinho.
 */
export function maturityMissingReading(periodStart: string): {
  readonly title: string
  readonly text: string
  readonly observe: string
} {
  const first = firstMeasuredPeriodStart()

  if (periodStart < first) {
    return {
      title: `O card mede períodos a partir de ${formatIsoAsBrDate(first)}.`,
      text: `Ele julga as vendas ativadas ${MATURITY_DAYS} dias antes do período, e a base começa em ${formatIsoAsBrDate(COMMERCIAL_PERIOD_START)}.`,
      observe: 'Escolha um período a partir de abril para ver a situação no 90º dia.',
    }
  }
  return {
    title: 'Sem a situação no 90º dia para este recorte.',
    text: 'A situação no 90º dia sai do histórico de bloqueio de cada contrato, que só o serviço de BI tem. Se ele está no ar e a consulta demorou, atualize a página em instantes.',
    observe: 'Com o histórico na mão, o card mostra quantas vendas deram errado depois de ativar.',
  }
}

/** Recorte em que nenhuma venda completou 90 dias. */
export function maturityEmptyReading(maturity: OverviewMaturity): {
  readonly title: string
  readonly text: string
} {
  return {
    title: 'Nenhuma venda completou 90 dias no recorte.',
    text: `Com os filtros escolhidos, nenhuma venda teve o sinal ligado ${maturityWindow(maturity)}.`,
  }
}

/** Parte da barra do card: bloqueio ou cancelamento. */
export type MaturityPart = {
  readonly id: 'bloqueio' | 'cancelada'
  readonly label: string
  readonly count: number
  /** Fatia dentro das bloqueadas ou canceladas: as duas somam 1 quando há alguma. */
  readonly share: number
}

/**
 * As duas partes que a barra da frente divide, na ordem do fluxo: o bloqueio
 * vem antes do cancelamento. A barra mede a divisão do número em destaque,
 * como a do Tempo até a ativação divide as ativações.
 */
export function maturityParts(maturity: OverviewMaturity): readonly MaturityPart[] {
  const troubled = maturityTroubled(maturity)
  const share = (count: number) => (troubled === 0 ? 0 : count / troubled)

  return [
    { id: 'bloqueio', label: 'Em bloqueio', count: maturity.blocked, share: share(maturity.blocked) },
    { id: 'cancelada', label: 'Canceladas', count: maturity.cancelled, share: share(maturity.cancelled) },
  ]
}
