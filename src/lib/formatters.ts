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
