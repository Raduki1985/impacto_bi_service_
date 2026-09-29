export const numberFormatter = new Intl.NumberFormat('pt-BR')

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`
}

export function formatDecimal(value: number, digits = 1) {
  return value.toFixed(digits).replace('.', ',')
}

/**
 * Data ISO `aaaa-mm-dd` no formato brasileiro `dd/mm/aaaa`.
 *
 * Direto do texto, sem passar por `Date`: uma data sem hora, convertida pelo
 * relógio do computador, pode virar o dia anterior em outro fuso. É o
 * formatador do selo do cabeçalho e da faixa de hoje da Visão Geral de OS.
 */
export function formatDateBr(iso: string) {
  const [year, month, day] = iso.split('-')

  return `${day}/${month}/${year}`
}

const pad2 = (value: number) => String(value).padStart(2, '0')

/**
 * Data e hora `dd/mm/aaaa hh:mm` de um momento, na hora LOCAL de quem está
 * usando o portal. É o "Gerada em" da planilha de OS (24/09/2026): o carimbo
 * diz quando a pessoa baixou, então vale o relógio dela.
 */
export function formatDateTimeBr(date: Date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * Data e hora `dd/mm/aaaa hh:mm` lidas do PRÓPRIO texto ISO do serviço
 * (`2026-09-24T08:02:11-03:00`), sem passar pelo fuso da máquina: o serviço
 * já manda a hora de São Paulo com o fuso escrito, e é ela que vale. Null
 * quando o texto não traz data e hora.
 */
export function formatIsoDateTimeBr(iso: string) {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(iso)

  return match === null ? null : `${formatDateBr(match[1])} ${match[2]}`
}

/**
 * Hora `16h16` lida do PRÓPRIO texto ISO do serviço, pelo mesmo motivo de
 * `formatIsoDateTimeBr`: converter para o fuso do computador de quem olha
 * mudaria a hora num acesso de fora do país, e o teste ficaria refém do
 * relógio da máquina. É a hora das faixas Hoje ao vivo (OS e Comercial).
 * Null sem texto ou sem hora nele.
 */
export function formatIsoClock(iso: string | null) {
  if (iso === null) return null
  const match = /T(\d{2}):(\d{2})/.exec(iso)

  return match === null ? null : `${match[1]}h${match[2]}`
}

export function formatMinutes(value: number) {
  const minutes = Math.round(value)

  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
  }

  return `${minutes} min`
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
