import { useEffect, useState } from 'react'

import {
  fetchTodayOsBox,
  fetchTodayOsCounts,
  type OverviewOsTechnician,
  type TodayOsBox,
  type TodayOsCountsSource,
} from '../../data/api/osOverviewSource'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import type { OverviewOsFilters } from '../../data/overviewOsFilters'
import { TODAY_FILTER_FIELDS } from './todayOsModel'

/**
 * Leitura ao vivo da faixa Hoje ao vivo, em duas consultas desde 01/10/2026
 * (pedido do Mário para a página carregar menos):
 *
 * - `useTodayOs`: as CONTAGENS das caixas, repetidas a cada minuto. Até
 *   aqui a faixa baixava a semana inteira de OS (~960 em produção, 419 KB)
 *   para contar no navegador; agora o serviço conta e manda ~1 KB;
 * - `useTodayOsBox`: as OS de UMA caixa, pedidas só quando o gestor abre a
 *   lista dela, e relidas junto com as contagens enquanto ela fica aberta.
 *
 * O serviço guarda cada leitura do banco por 60 s, então este é o ritmo em
 * que um dado novo chega de fato. A semana anterior continua sendo lida LÁ,
 * para o aviso das OS de dias anteriores que seguem abertas no aplicativo:
 * uma OS fechada no SGI há dez minutos não pode seguir na tela como
 * pendência.
 *
 * Falha depois de uma leitura boa NÃO apaga os números: a faixa mantém a
 * última leitura, com a hora dela, e diz que a tentativa seguinte falhou.
 * Trocar um filtro, sim, descarta a leitura anterior: os números dela são de
 * outro recorte.
 */

export const TODAY_REFRESH_MS = 60_000

export type TodayOsStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TodayOsState = {
  readonly status: TodayOsStatus
  /** Contagens da última leitura boa do recorte atual; null até ela chegar. */
  readonly counts: TodayOsCountsSource | null
  /** Hora em que o serviço leu o banco, em ISO com fuso; null até a primeira leitura. */
  readonly generatedAt: string | null
  readonly errorMessage: string | null
}

/** Identidade do recorte da faixa: o dia e os filtros que valem nela. */
function todayKey(today: string, filters: OverviewOsFilters): string {
  return JSON.stringify([today, ...TODAY_FILTER_FIELDS.map((field) => filters[field])])
}

type Loaded<T> = { readonly key: string; readonly value: T | null; readonly error: string | null }

const idleState: TodayOsState = { status: 'idle', counts: null, generatedAt: null, errorMessage: null }

export function useTodayOs(enabled: boolean, today: string, filters: OverviewOsFilters): TodayOsState {
  const key = todayKey(today, filters)
  const [loaded, setLoaded] = useState<Loaded<TodayOsCountsSource> | null>(null)

  // Toda mudança de estado acontece no retorno da promessa, e não no corpo
  // do efeito: a regra `set-state-in-effect` do lint continua respeitada. Os
  // filtros entram pela `key`, que já os resume.
  useEffect(() => {
    if (!enabled) return

    let active = true
    const load = () => {
      void fetchTodayOsCounts(today, filters)
        .then((counts) => {
          if (active) setLoaded({ key, value: counts, error: null })
        })
        .catch((cause: unknown) => {
          if (!active) return
          const error = cause instanceof Error ? cause.message : 'Não foi possível ler a agenda de hoje.'
          // A última leitura boa do MESMO recorte fica; a de outro, não.
          setLoaded((current) => ({ key, value: current?.key === key ? current.value : null, error }))
        })
    }

    load()
    const timer = window.setInterval(load, TODAY_REFRESH_MS)

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

export type TodayOsBoxState = {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly records: readonly OverviewOsRecord[]
  readonly technicians: readonly OverviewOsTechnician[]
  /** Hora em que o serviço leu as OS da lista: fica para trás se a releitura falhar. */
  readonly generatedAt: string | null
  readonly errorMessage: string | null
}

const closedBox: TodayOsBoxState = {
  status: 'idle',
  records: [],
  technicians: [],
  generatedAt: null,
  errorMessage: null,
}

/**
 * As OS da caixa aberta (`box`), ou nada com a faixa fechada (`null`).
 *
 * `refresh` é a hora da última leitura das contagens: quando ela muda, a
 * lista aberta é relida, e a caixa e a lista continuam dizendo o mesmo
 * número. A lista não remonta na releitura, então os filtros de coluna que
 * o gestor escolheu ficam.
 */
export function useTodayOsBox(
  enabled: boolean,
  today: string,
  box: TodayOsBox | null,
  filters: OverviewOsFilters,
  refresh: string | null,
): TodayOsBoxState {
  const key = box === null ? null : `${box}|${todayKey(today, filters)}`
  const [loaded, setLoaded] = useState<Loaded<TodayOsBoxState> | null>(null)

  useEffect(() => {
    if (!enabled || box === null || key === null) return

    let active = true
    void fetchTodayOsBox(today, box, filters)
      .then((source) => {
        if (!active) return
        setLoaded({
          key,
          value: {
            status: 'ready',
            records: source.records,
            technicians: source.technicians,
            generatedAt: source.generatedAt,
            errorMessage: null,
          },
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (!active) return
        const error = cause instanceof Error ? cause.message : 'Não foi possível ler as OS desta caixa.'
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
