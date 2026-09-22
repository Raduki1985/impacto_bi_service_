import { useEffect, useState } from 'react'

import {
  fetchOverviewOsDay,
  type OverviewOsTechnician,
} from '../../data/api/osOverviewSource'
import type { OverviewOsRecord } from '../../data/overviewOsData'
import { shiftISODate } from '../../data/overviewOsFilters'

/**
 * Leitura ao vivo das OS agendadas para hoje e para os últimos dias.
 *
 * É uma consulta própria, pequena, e não a base inteira que a página já
 * carregou: assim a faixa de hoje pode se atualizar a cada minuto sem baixar
 * de novo as milhares de OS do período e sem mexer nos números que o gestor
 * está lendo abaixo dela. O serviço guarda cada resposta por 60 s, então este
 * é o ritmo em que um dado novo chega de fato.
 *
 * A janela passou de um dia para oito em 22/09/2026, quando a faixa ganhou o
 * aviso das OS de dias anteriores que continuam abertas no aplicativo. Elas
 * precisam vir da leitura AO VIVO, e não da base que a página carregou uma
 * vez: uma OS fechada no SGI há dez minutos não pode seguir na tela como
 * pendência. Uma semana cobre o caso real (a única pendência achada em
 * 22/09/2026 era do dia anterior, e o SGI expira sozinho toda OS que ninguém
 * iniciou), e custa poucas centenas de registros por leitura.
 *
 * Falha depois de uma leitura boa NÃO apaga os números: a faixa mantém a
 * última leitura, com a hora dela, e diz que a tentativa seguinte falhou.
 */

export const TODAY_REFRESH_MS = 60_000

/** Dias para trás que a leitura ao vivo cobre, além do próprio dia. */
export const TODAY_CARRY_OVER_DAYS = 7

export type TodayOsStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TodayOsState = {
  readonly status: TodayOsStatus
  /**
   * OS da janela inteira, de hoje e dos dias anteriores. Quem desenha separa
   * o dia do que ficou para trás (`todayOnly`, `buildCarryOverOs`): as seis
   * caixas continuam somando 100% de HOJE.
   */
  readonly records: readonly OverviewOsRecord[]
  /**
   * Técnicos com OS hoje, com nome, como o serviço manda junto da consulta do
   * dia. É o que a lista de OS usa para escrever o nome no lugar do
   * identificador; vazia enquanto o serviço não mandar o catálogo.
   */
  readonly technicians: readonly OverviewOsTechnician[]
  /** Hora em que o serviço leu o banco, em ISO com fuso; null até a primeira leitura. */
  readonly generatedAt: string | null
  readonly errorMessage: string | null
}

const idleState: TodayOsState = {
  status: 'idle',
  records: [],
  technicians: [],
  generatedAt: null,
  errorMessage: null,
}

export function useTodayOs(enabled: boolean, today: string): TodayOsState {
  const [state, setState] = useState<TodayOsState>(
    enabled ? { ...idleState, status: 'loading' } : idleState,
  )

  // Toda mudança de estado acontece no retorno da promessa, e não no corpo
  // do efeito: a regra `set-state-in-effect` do lint continua respeitada.
  useEffect(() => {
    if (!enabled) return

    let active = true
    const load = () => {
      void fetchOverviewOsDay(shiftISODate(today, -TODAY_CARRY_OVER_DAYS), today)
        .then((loaded) => {
          if (!active) return
          setState({
            status: 'ready',
            records: loaded.records,
            technicians: loaded.technicians,
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
              cause instanceof Error ? cause.message : 'Não foi possível ler a agenda de hoje.',
          }))
        })
    }

    load()
    const timer = window.setInterval(load, TODAY_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [enabled, today])

  return state
}
