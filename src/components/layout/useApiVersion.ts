import { useEffect, useState } from 'react'

import { fetchBiApiVersion } from '../../data/api/biHealthSource'

/**
 * Versão do `impacto-bi-service`, para a linha de versão do menu do usuário.
 *
 * Começa em null e continua null quando não há resposta: o menu simplesmente
 * não desenha os parênteses, e nada mais na tela muda. Quem não deixa a falha
 * virar erro é a própria fonte, que resolve em null em vez de recusar.
 */
export function useApiVersion(): string | null {
  const [apiVersion, setApiVersion] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    void fetchBiApiVersion().then((version) => {
      // A resposta pode chegar depois de a pessoa trocar de página, e o menu
      // sai da árvore junto: sem esta trava, seria um estado gravado em um
      // componente que já não existe.
      if (ativo) setApiVersion(version)
    })

    return () => {
      ativo = false
    }
  }, [])

  return apiVersion
}
