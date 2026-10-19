import { useEffect, useState } from 'react'

import { fetchOsSchedule, type OsScheduleSource, type OsScheduleWindow } from '../../data/api/osScheduleSource'

/**
 * Leitura da agenda e capacidade: uma consulta ao abrir a página e uma
 * releitura a cada cinco minutos, porque a presença de hoje muda ao longo do
 * dia (o técnico liga e desliga o botão de disponível no aplicativo) e a
 * agenda de amanhã enche durante a tarde. A janela é a que a página pede
 * (as semanas do calendário); mudou a janela, lê de novo.
 *
 * Falha depois de uma leitura boa NÃO apaga os números: a página mantém a
 * última leitura e diz que a tentativa seguinte falhou, como a faixa Hoje ao
 * vivo faz. Toda mudança de estado acontece no retorno da promessa, e não no
 * corpo do efeito: a regra `set-state-in-effect` do lint continua respeitada.
 */

export const SCHEDULE_REFRESH_MS = 5 * 60_000

export type OsScheduleStatus = 'idle' | 'loading' | 'ready' | 'error'

export type OsScheduleState = {
  readonly status: OsScheduleStatus
  /** A última leitura boa; nula até ela chegar. */
  readonly data: OsScheduleSource | null
  readonly errorMessage: string | null
}

type Loaded = { readonly value: OsScheduleSource | null; readonly error: string | null }

const idleState: OsScheduleState = { status: 'idle', data: null, errorMessage: null }

export function useOsSchedule(enabled: boolean, range: OsScheduleWindow): OsScheduleState {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const { from, to } = range

  useEffect(() => {
    if (!enabled) return

    let active = true
    const load = () => {
      void fetchOsSchedule({ from, to })
        .then((data) => {
          if (active) setLoaded({ value: data, error: null })
        })
        .catch((cause: unknown) => {
          if (!active) return
          const error = cause instanceof Error ? cause.message : 'Não foi possível ler a agenda.'
          setLoaded((current) => ({ value: current?.value ?? null, error }))
        })
    }

    load()
    const timer = window.setInterval(load, SCHEDULE_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [enabled, from, to])

  if (!enabled) return idleState
  if (loaded === null) return { ...idleState, status: 'loading' }

  return {
    status: loaded.error === null ? 'ready' : 'error',
    data: loaded.value,
    errorMessage: loaded.error,
  }
}
