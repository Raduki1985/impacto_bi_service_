import { useEffect, useState } from 'react'

import { fetchPublishedVersion } from '../../data/api/publishedVersionSource'
import { APP_VERSION, isNewerVersion } from '../../lib/appVersion'

/**
 * Descobre que houve deploy novo enquanto a aba já estava aberta.
 *
 * O portal é baixado uma vez e fica aberto por horas. Quando sai uma versão
 * nova, quem está com a aba aberta continua no arquivo antigo — servido do
 * cache do navegador — até recarregar por conta própria. Isto pergunta de
 * tempos em tempos qual é a versão PUBLICADA e a compara com a EMBUTIDA no
 * arquivo que a aba baixou.
 *
 * O que ele devolve é a versão nova, uma vez encontrada, e nada além disso:
 * quem desenha o aviso é o `UpdateAvailableToast`, e quem recarrega é a
 * pessoa. Um recarregamento automático descartaria um filtro montado ou uma
 * análise na tela sem pedir licença.
 */

/**
 * Quanto tempo entre uma pergunta e a seguinte, quando o ambiente não diz.
 *
 * Quinze minutos é o suficiente para alguém que passa a manhã no portal
 * receber o aviso no mesmo turno do deploy, sem que a espera vire uma consulta
 * por minuto para cada aba aberta da empresa.
 */
const DEFAULT_INTERVAL_MINUTES = 15

/**
 * Nunca abaixo de um minuto.
 *
 * O piso não protege o servidor — o arquivo tem algumas dezenas de bytes —, e
 * sim contra um `0` ou um valor de segundos digitado no `.env` por engano, que
 * transformaria cada aba aberta em um relógio disparando sem parar.
 */
const MINIMUM_INTERVAL_MINUTES = 1

/**
 * Os minutos do `.env` em milissegundos, com o padrão no lugar do que não serve.
 *
 * Variável de ambiente chega SEMPRE como texto, e chega vazia quando o arquivo
 * do ambiente não a define. Um `Number` cru devolveria `NaN` para um valor
 * escrito errado e o `setInterval` com `NaN` dispara imediatamente, em laço.
 */
export function resolveIntervalMs(raw: string | undefined): number {
  const minutes = Number(raw)
  const usable =
    Number.isFinite(minutes) && minutes >= MINIMUM_INTERVAL_MINUTES
      ? minutes
      : DEFAULT_INTERVAL_MINUTES

  return usable * 60 * 1000
}

const VERSION_CHECK_INTERVAL_MS = resolveIntervalMs(
  import.meta.env.VITE_VERSION_CHECK_INTERVAL_MINUTES as string | undefined,
)

/** A versão publicada quando ela é mais nova que a da aba; null enquanto não é. */
export function useVersionCheck(): string | null {
  const [newVersion, setNewVersion] = useState<string | null>(null)

  useEffect(() => {
    // Desligado em desenvolvimento: ali o `version.json` nem é gerado, e o
    // Vite já recarrega a página sozinho a cada alteração.
    //
    // E desligado DEPOIS de encontrada: o aviso já está na tela e a única
    // saída dele é recarregar, então continuar perguntando só gastaria
    // conexão para confirmar o que já se sabe.
    if (import.meta.env.DEV || newVersion !== null) return

    let ativo = true

    const check = () => {
      // Aba em segundo plano não pergunta. Ninguém lê um aviso que não está à
      // vista, e a volta para a aba dispara a consulta de qualquer forma, pelo
      // ouvinte abaixo.
      if (document.visibilityState === 'hidden') return

      void fetchPublishedVersion().then((published) => {
        // A resposta pode chegar depois de a pessoa sair, e o efeito já ter
        // sido desmontado: sem esta trava, seria um estado gravado fora da
        // árvore.
        if (!ativo || published === null) return
        if (!isNewerVersion(published, APP_VERSION)) return

        setNewVersion(published)
      })
    }

    // Uma pergunta já na montagem: a aba pode ter sido aberta com um
    // `index.html` vindo do cache, e nesse caso o arquivo antigo está na tela
    // desde o primeiro quadro.
    check()

    const timer = window.setInterval(check, VERSION_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)

    return () => {
      ativo = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [newVersion])

  return newVersion
}
