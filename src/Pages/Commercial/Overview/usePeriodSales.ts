import { useEffect, useState } from 'react'

import { fetchCommercialPeriodCount } from '../../../data/api/commercialRecordsSource'
import type { CommercialOverviewFilters } from './overviewModel'

/**
 * Quantos contratos a planilha do período leva, para o botão "Baixar N
 * contratos em Excel" (25/09/2026) dizer o N antes do clique, como o "Baixar
 * N OS em Excel" da OS.
 *
 * Desde 01/10/2026 a página pede ao serviço só a CONTAGEM (`/period/summary`,
 * ~200 bytes), com os filtros da página; os contratos vêm no clique. Antes
 * ela baixava o período inteiro (~590 KB em setembro) a cada troca de filtro
 * só para contar.
 *
 * A contagem é relida a cada resposta nova dos cards (`version`, a própria
 * resposta): sem isso, uma troca de cidade às 14h traria cards das 14h e um
 * N das 9h, e o botão deixaria de fechar com o card.
 *
 * O estado guarda a resposta junto do recorte e da versão que a produziram,
 * e "lendo" sai do próprio render, comparando os dois: assim nenhum estado
 * muda no corpo do efeito (regra `set-state-in-effect` do lint), e a
 * resposta de um recorte ou de uma leitura antiga nunca aparece como atual.
 *
 * Falha não derruba a página: o botão só não aparece.
 */

export type PeriodSalesState =
  | { readonly status: 'idle' | 'loading' | 'error' }
  | { readonly status: 'ready'; readonly count: number }

type Loaded = {
  readonly key: string
  readonly version: object
} & ({ readonly count: number } | { readonly failed: true })

export function usePeriodSales(
  /** A leitura dos cards a que a contagem corresponde; null antes da primeira, e sem ler. */
  version: object | null,
  filters: CommercialOverviewFilters,
): PeriodSalesState {
  const key = JSON.stringify([
    filters.startDate,
    filters.endDate,
    filters.cityId,
    filters.team,
    filters.sellerId,
    filters.personType,
  ])
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (version === null) return
    let active = true
    void fetchCommercialPeriodCount({ dateFrom: filters.startDate, dateTo: filters.endDate }, filters)
      .then((result) => {
        if (active) setLoaded({ key, version, count: result.count })
      })
      .catch(() => {
        if (active) setLoaded({ key, version, failed: true })
      })

    return () => {
      active = false
    }
    // Os filtros entram pela `key`, que já os resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, key])

  if (version === null) return { status: 'idle' }
  if (loaded === null || loaded.key !== key || loaded.version !== version) return { status: 'loading' }
  if ('failed' in loaded) return { status: 'error' }

  return { status: 'ready', count: loaded.count }
}
