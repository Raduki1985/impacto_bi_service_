import { useEffect, useState } from 'react'

import {
  fetchCommercialTodayBox,
  fetchCommercialTodayCounts,
  type CommercialSaleRecord,
  type CommercialSalesFilters,
  type CommercialTodayCountsSource,
} from '../../../data/api/commercialRecordsSource'
import type { TodaySalesSelection } from './todaySalesModel'

/**
 * Leitura ao vivo da faixa Hoje ao vivo da Visão Geral Comercial, em duas
 * consultas desde 01/10/2026 (pedido do Mário para a página carregar menos,
 * no molde da faixa de OS, `useTodayOs`):
 *
 * - `useTodaySales`: as CONTAGENS das cinco caixas, repetidas a cada minuto.
 *   Até aqui a faixa baixava o dia com a esteira inteira (~330 contratos em
 *   produção, ~240 KB) para contar no navegador; agora o serviço conta e
 *   manda menos de 1 KB, já com os filtros da página;
 * - `useTodaySalesBox`: os contratos de UMA caixa, pedidos só quando o
 *   gestor abre a lista dela, e relidos junto com as contagens enquanto ela
 *   fica aberta.
 *
 * O serviço guarda cada leitura do banco por 60 s, então este é o ritmo em
 * que um dado novo chega de fato.
 *
 * Falha depois de uma leitura boa NÃO apaga os números: a faixa mantém a
 * última leitura, com a hora dela, e diz que a tentativa seguinte falhou.
 * Trocar um filtro, sim, descarta a leitura anterior: os números dela são de
 * outro recorte.
 */

export const TODAY_SALES_REFRESH_MS = 60_000

export type TodaySalesStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TodaySalesState = {
  readonly status: TodaySalesStatus
  /** Contagens da última leitura boa do recorte atual; null até ela chegar. */
  readonly counts: CommercialTodayCountsSource | null
  /** Hora em que o serviço leu o banco, em ISO com fuso; null até a primeira leitura. */
  readonly generatedAt: string | null
  readonly errorMessage: string | null
}

/** Identidade do recorte da faixa: o dia e os filtros que valem nela. */
function todayKey(today: string, filters: CommercialSalesFilters): string {
  return JSON.stringify([today, filters.cityIds, filters.team, filters.sellerIds, filters.personType])
}

type Loaded<T> = { readonly key: string; readonly value: T | null; readonly error: string | null }

const idleState: TodaySalesState = { status: 'idle', counts: null, generatedAt: null, errorMessage: null }

export function useTodaySales(
  enabled: boolean,
  today: string,
  filters: CommercialSalesFilters,
): TodaySalesState {
  const key = todayKey(today, filters)
  const [loaded, setLoaded] = useState<Loaded<CommercialTodayCountsSource> | null>(null)

  // Toda mudança de estado acontece no retorno da promessa, e não no corpo
  // do efeito: a regra `set-state-in-effect` do lint continua respeitada. Os
  // filtros entram pela `key`, que já os resume.
  useEffect(() => {
    if (!enabled) return

    let active = true
    const load = () => {
      void fetchCommercialTodayCounts(today, filters)
        .then((counts) => {
          if (active) setLoaded({ key, value: counts, error: null })
        })
        .catch((cause: unknown) => {
          if (!active) return
          const error = cause instanceof Error ? cause.message : 'Não foi possível ler as vendas de hoje.'
          // A última leitura boa do MESMO recorte fica; a de outro, não.
          setLoaded((current) => ({ key, value: current?.key === key ? current.value : null, error }))
        })
    }

    load()
    const timer = window.setInterval(load, TODAY_SALES_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  if (!enabled) return idleState
  // Leitura de outro recorte ainda na tela: é como se nada tivesse chegado.
  const current = loaded?.key === key ? loaded : null
  if (current === null) return { ...idleState, status: 'loading' }

  return {
    status: current.error === null ? 'ready' : 'error',
    counts: current.value,
    generatedAt: current.value?.generatedAt ?? null,
    errorMessage: current.error,
  }
}

export type TodaySalesBoxState = {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly records: readonly CommercialSaleRecord[]
  /** Hora em que o serviço leu o banco para esta lista; null até ela chegar. */
  readonly generatedAt: string | null
  readonly errorMessage: string | null
}

const closedBox: TodaySalesBoxState = { status: 'idle', records: [], generatedAt: null, errorMessage: null }

/**
 * Os contratos da lista aberta (`selection`), ou nada com a lista fechada
 * (`null`).
 *
 * `refresh` é a hora da última leitura das contagens: quando ela muda, a
 * lista aberta é relida, e a caixa e a lista continuam dizendo o mesmo
 * número. A lista não remonta na releitura, então os filtros de coluna que
 * o gestor escolheu ficam.
 */
export function useTodaySalesBox(
  enabled: boolean,
  today: string,
  selection: TodaySalesSelection | null,
  filters: CommercialSalesFilters,
  refresh: string | null,
): TodaySalesBoxState {
  const key =
    selection === null ? null : `${selection.box}|${String(selection.late)}|${todayKey(today, filters)}`
  const [loaded, setLoaded] = useState<Loaded<TodaySalesBoxState> | null>(null)

  useEffect(() => {
    if (!enabled || selection === null || key === null) return

    let active = true
    void fetchCommercialTodayBox(today, selection.box, selection.late, filters)
      .then((source) => {
        if (!active) return
        setLoaded({
          key,
          value: { status: 'ready', records: source.records, generatedAt: source.generatedAt, errorMessage: null },
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (!active) return
        const error = cause instanceof Error ? cause.message : 'Não foi possível ler os contratos desta caixa.'
        setLoaded((current) => ({ key, value: current?.key === key ? current.value : null, error }))
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, refresh])

  if (!enabled || key === null) return closedBox
  const current = loaded?.key === key ? loaded : null
  if (current === null) return { ...closedBox, status: 'loading' }
  if (current.value === null) return { ...closedBox, status: 'error', errorMessage: current.error }

  // Releitura que falhou: a lista da leitura anterior fica na tela.
  return current.value
}
