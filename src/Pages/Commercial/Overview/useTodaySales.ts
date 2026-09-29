import { useEffect, useState } from 'react'

import {
  fetchCommercialSalesDay,
  type CommercialSaleRecord,
} from '../../../data/api/commercialRecordsSource'

/**
 * Leitura ao vivo das vendas de hoje e da esteira.
 *
 * É uma consulta própria, e não a página agregada que a Visão Geral já
 * carregou: os contratos vendidos ou ativados hoje e toda venda da base
 * comercial ainda na fila, algumas centenas de linhas. Assim a faixa se
 * atualiza a cada minuto sem refazer a agregação inteira e sem mexer nos
 * números que o gestor está lendo abaixo dela. O serviço guarda cada
 * resposta por 60 s, então este é o ritmo em que um dado novo chega de fato.
 * O mesmo desenho da faixa de OS (`useTodayOs`).
 *
 * Falha depois de uma leitura boa NÃO apaga os números: a faixa mantém a
 * última leitura, com a hora dela, e diz que a tentativa seguinte falhou.
 */

export const TODAY_SALES_REFRESH_MS = 60_000

export type TodaySalesStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TodaySalesState = {
  readonly status: TodaySalesStatus
  /** Contratos vendidos ou ativados hoje e os da esteira, que a faixa separa. */
  readonly records: readonly CommercialSaleRecord[]
  /** Data de venda a partir da qual a esteira vale, ISO; null até a primeira leitura. */
  readonly queueFrom: string | null
  /** Hora em que o serviço leu o banco, em ISO com fuso; null até a primeira leitura. */
  readonly generatedAt: string | null
  readonly errorMessage: string | null
}

const idleState: TodaySalesState = {
  status: 'idle',
  records: [],
  queueFrom: null,
  generatedAt: null,
  errorMessage: null,
}

export function useTodaySales(enabled: boolean, today: string): TodaySalesState {
  const [state, setState] = useState<TodaySalesState>(
    enabled ? { ...idleState, status: 'loading' } : idleState,
  )

  // Toda mudança de estado acontece no retorno da promessa, e não no corpo
  // do efeito: a regra `set-state-in-effect` do lint continua respeitada.
  useEffect(() => {
    if (!enabled) return

    let active = true
    const load = () => {
      void fetchCommercialSalesDay(today, { includeQueue: true })
        .then((loaded) => {
          if (!active) return
          setState({
            status: 'ready',
            records: loaded.records,
            queueFrom: loaded.queueFrom,
            generatedAt: loaded.generatedAt,
            errorMessage: null,
          })
        })
        .catch((cause: unknown) => {
          if (!active) return
          setState((current) => ({
            ...current,
            status: 'error',
            errorMessage:
              cause instanceof Error ? cause.message : 'Não foi possível ler as vendas de hoje.',
          }))
        })
    }

    load()
    const timer = window.setInterval(load, TODAY_SALES_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [enabled, today])

  return state
}
