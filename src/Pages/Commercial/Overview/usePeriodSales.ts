import { useEffect, useState } from 'react'

import {
  fetchCommercialSalesDay,
  type CommercialSaleRecord,
} from '../../../data/api/commercialRecordsSource'

/**
 * Contratos do período inteiro da Visão Geral Comercial, para o botão
 * "Baixar N contratos em Excel" (25/09/2026).
 *
 * A página só recebe números somados; o botão precisa dos contratos para
 * dizer quantos são antes do clique, como o "Baixar N OS em Excel" da OS.
 * Por isso a leitura acontece junto da dos cards, e não no clique: a cada
 * resposta nova dos cards (`version`, a própria resposta), os contratos são
 * lidos de novo. Sem isso, uma troca de cidade às 14h traria cards das 14h e
 * uma planilha das 9h, e a planilha deixaria de fechar com o card. Os
 * filtros da página são aplicados depois, sobre os contratos lidos.
 *
 * O estado guarda a resposta junto do período e da versão que a produziram,
 * e "lendo" sai do próprio render, comparando os dois: assim nenhum estado
 * muda no corpo do efeito (regra `set-state-in-effect` do lint), e a
 * resposta de um período ou de uma leitura antiga nunca aparece como atual.
 *
 * Falha não derruba a página: o botão só não aparece.
 */

export type PeriodSalesState =
  | { readonly status: 'idle' | 'loading' | 'error' }
  | {
      readonly status: 'ready'
      readonly records: readonly CommercialSaleRecord[]
      /** Hora em que o serviço leu o banco, ISO com fuso; null quando ausente. */
      readonly generatedAt: string | null
    }

type Loaded = {
  readonly key: string
  readonly version: object
} & (
  | { readonly records: readonly CommercialSaleRecord[]; readonly generatedAt: string | null }
  | { readonly failed: true }
)

export function usePeriodSales(
  /** A leitura dos cards a que os contratos correspondem; null antes da primeira, e sem ler. */
  version: object | null,
  dateFrom: string,
  dateTo: string,
): PeriodSalesState {
  const key = `${dateFrom}:${dateTo}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (version === null) return
    let active = true
    void fetchCommercialSalesDay(dateFrom, { dateToISO: dateTo })
      .then((result) => {
        if (active) {
          setLoaded({ key, version, records: result.records, generatedAt: result.generatedAt })
        }
      })
      .catch(() => {
        if (active) setLoaded({ key, version, failed: true })
      })

    return () => {
      active = false
    }
  }, [version, dateFrom, dateTo, key])

  if (version === null) return { status: 'idle' }
  if (loaded === null || loaded.key !== key || loaded.version !== version) return { status: 'loading' }
  if ('failed' in loaded) return { status: 'error' }

  return { status: 'ready', records: loaded.records, generatedAt: loaded.generatedAt }
}
