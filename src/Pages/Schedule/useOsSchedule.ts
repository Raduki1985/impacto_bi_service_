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
 *
 * Desde 20/10/2026 o calendário volta semanas no tempo, e cada volta pede
 * outra janela. A leitura guarda de qual janela ela é (`current`): enquanto
 * a janela nova não chega, a página tem a anterior para manter a faixa de
 * filtros na tela, mas não a desenha como se fosse das semanas novas.
 */

export const SCHEDULE_REFRESH_MS = 5 * 60_000

export type OsScheduleStatus = 'idle' | 'loading' | 'ready' | 'error'

export type OsScheduleState = {
  readonly status: OsScheduleStatus
  /** A última leitura boa; nula até ela chegar. Pode ser de outra janela (ver `current`). */
  readonly data: OsScheduleSource | null
  /** A leitura em `data` é da janela pedida agora. */
  readonly current: boolean
  readonly errorMessage: string | null
}

type Loaded = {
  readonly value: OsScheduleSource | null
  readonly valueKey: string | null
  readonly error: string | null
  readonly errorKey: string | null
}

const idleState: OsScheduleState = { status: 'idle', data: null, current: false, errorMessage: null }

const windowKey = (from: string, to: string) => `${from}|${to}`

export function useOsSchedule(enabled: boolean, range: OsScheduleWindow): OsScheduleState {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const { from, to } = range
  const key = windowKey(from, to)

  useEffect(() => {
    if (!enabled) return

    let active = true
    const requested = windowKey(from, to)
    const load = () => {
      void fetchOsSchedule({ from, to })
        .then((data) => {
          if (active) setLoaded({ value: data, valueKey: requested, error: null, errorKey: null })
        })
        .catch((cause: unknown) => {
          if (!active) return
          const error = cause instanceof Error ? cause.message : 'Não foi possível ler a agenda.'
          setLoaded((current) => ({
            value: current?.value ?? null,
            valueKey: current?.valueKey ?? null,
            error,
            errorKey: requested,
          }))
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

  const current = loaded.valueKey === key
  // O erro só vale para a janela em que aconteceu: voltar para uma janela
  // que leu bem não herda a falha de outra.
  const errorMessage = loaded.errorKey === key ? loaded.error : null

  return {
    status: errorMessage !== null ? 'error' : current ? 'ready' : 'loading',
    data: loaded.value,
    current,
    errorMessage,
  }
}
