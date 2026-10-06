import { formatDateBr, formatNumber, formatPercent } from '../../../lib/formatters'

/**
 * Pedaços de frase que mais de um card da Visão Geral Comercial escreve na
 * leitura gerencial. Nasceram no Vendas ativadas (06/10/2026) e passaram para
 * cá no mesmo dia, quando o Total de Vendas precisou das mesmas duas coisas:
 * o período por extenso e a variação com o número de trás do percentual.
 */

/** `05/10` de uma data ISO, sem passar por `Date` (o fuso mudaria o dia). */
export function dayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/**
 * O período para o meio da frase: `de 01 a 05/10`; num dia só, `em 05/10`;
 * entre meses, `de 28/09 a 05/10`; entre anos, as datas inteiras.
 */
export function periodPhrase(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return `em ${dayMonth(dateTo)}`
  if (dateFrom.slice(0, 7) === dateTo.slice(0, 7)) return `de ${dateFrom.slice(8, 10)} a ${dayMonth(dateTo)}`
  if (dateFrom.slice(0, 4) === dateTo.slice(0, 4)) return `de ${dayMonth(dateFrom)} a ${dayMonth(dateTo)}`

  return `de ${formatDateBr(dateFrom)} a ${formatDateBr(dateTo)}`
}

/** O que o card conta, no singular e no plural: `ativação`/`ativações`, `venda`/`vendas`. */
export type CountUnit = { readonly one: string; readonly many: string }

/**
 * A variação com o número de trás do percentual (pedido do Mário em
 * 06/10/2026: "recuou 36,5%" sozinho não diz de quanto para quanto) e
 * nomeando a janela comparada (`em setembro até o dia 5`), como a frente do
 * card já faz. Sem a janela conhecida, "no período anterior". As chaves
 * destacam os números na leitura. Sem a contagem anterior, só o percentual e
 * a comparação. Sem taxa (período anterior vazio ou inexistente) a frase é
 * outra, e não passa por aqui.
 */
export function changeReadingWithPrevious(
  rate: number,
  comparison: { readonly long: string; readonly within: string } | undefined,
  previous: number | null,
  unit: CountUnit,
): string {
  if (previous === null) {
    const versus = comparison?.long ?? 'versus período anterior'
    if (rate > 0) return `Cresceu {${formatPercent(rate)}} ${versus}.`
    if (rate < 0) return `Recuou {${formatPercent(Math.abs(rate))}} ${versus}.`

    return `Ficou estável ${versus}.`
  }

  const janela = comparison?.within ?? 'no período anterior'
  const eram = previous === 1 ? `era {1} ${unit.one}` : `eram {${formatNumber(previous)}} ${unit.many}`
  if (rate > 0) return `Cresceu {${formatPercent(rate)}}: ${eram} ${janela}.`
  if (rate < 0) return `Recuou {${formatPercent(Math.abs(rate))}}: ${eram} ${janela}.`

  const tambem = previous === 1 ? `também foi {1} ${unit.one}` : `também foram {${formatNumber(previous)}} ${unit.many}`
  return `Ficou estável: ${tambem} ${janela}.`
}
