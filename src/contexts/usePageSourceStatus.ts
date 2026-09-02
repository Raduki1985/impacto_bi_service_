import { useContext, useEffect } from 'react'

import {
  PageSourceStatusContext,
  type PageSourceStatus,
} from './PageSourceStatusContextCore'

/**
 * Informa ao cabeçalho do portal o estado da fonte desta página.
 *
 * A limpeza devolve `ready` ao sair da página. Sem isso, uma falha na Visão
 * Geral de OS acompanharia o usuário até a próxima tela, que talvez nem
 * dependa do serviço de BI.
 */
export function useReportPageSourceStatus(status: PageSourceStatus): void {
  const report = useContext(PageSourceStatusContext)

  useEffect(() => {
    report(status)

    return () => report('ready')
  }, [report, status])
}
