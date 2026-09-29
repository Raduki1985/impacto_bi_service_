import { RefreshCw } from 'lucide-react'

/**
 * Aviso de que saiu uma versão nova do portal enquanto a aba estava aberta.
 *
 * NÃO passa pelo `SessionToast` de propósito. Aquela casca é para confirmar
 * algo que a pessoa acabou de fazer, e por isso some sozinha em cinco
 * segundos. Este aqui é o contrário: ninguém o pediu, e ele exige uma
 * providência. Um aviso que exige providência e se apaga sozinho é um aviso
 * que não foi lido — a pessoa segue a manhã inteira no arquivo antigo, vendo
 * uma tela que já não é a que está publicada.
 *
 * Por isso não tem tempo de tela nem Fechar: a única saída é o Atualizar
 * agora. Não é insistência gratuita — o aviso só aparece quando o servidor
 * confirma que há versão mais nova (`src/components/ui/useVersionCheck.ts`), e
 * recarregar resolve em um clique.
 *
 * Quem recarrega é a PESSOA, e nunca o portal por conta própria: um
 * recarregamento automático descartaria um filtro montado ou uma análise na
 * tela sem pedir licença.
 */
type UpdateAvailableToastProps = {
  /** Versão publicada, exatamente como veio do `version.json`. */
  version: string
}

export function UpdateAvailableToast({ version }: UpdateAvailableToastProps) {
  return (
    // `status` e não `alert`: é uma notícia, e não uma emergência que precise
    // interromper quem está lendo a tela. Fica ACIMA do aviso de sessão no
    // celular e do outro lado dele no computador, porque os dois podem
    // aparecer juntos — entrar no portal com uma aba antiga dispara os dois no
    // mesmo instante.
    <div
      aria-live="polite"
      className="update-toast pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:justify-start"
      role="status"
    >
      <div className="pointer-events-auto flex w-full max-w-[368px] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-lg">
        <RefreshCw
          aria-hidden="true"
          className="mt-[1px] flex-none text-[var(--accent)]"
          size={18}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[var(--text-heading)]">
            Nova versão disponível
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
            {/* O número entra na frase porque é o que se compara com o do menu
                do usuário quando alguém relata que "está diferente na minha
                tela". */}
            A versão {version} do portal já está publicada. Atualize para
            continuar com a versão certa.
          </p>

          <button
            className="mt-2 cursor-pointer rounded-md bg-[var(--accent)] px-3 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            // `reload` busca o `index.html` fresco, que aponta para os arquivos
            // da compilação nova. É o único gesto que troca o portal em pé.
            onClick={() => window.location.reload()}
            type="button"
          >
            Atualizar agora
          </button>
        </div>
      </div>
    </div>
  )
}
