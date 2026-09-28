import { CircleCheck, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/**
 * Aviso flutuante de confirmação do portal.
 *
 * Nasceu nas duas pontas da sessão — a entrada aceita e a saída concluída — e
 * serve hoje também às gravações dos cadastros: usuário, Perfil de Acesso e
 * item de menu, cadastrados ou editados. É a mesma natureza de aviso, e ter
 * uma casca só é o que os mantém idênticos na tela.
 *
 * QUEM O DESENHA muda com a ação. Entrar e sair trocam a rota no mesmo
 * instante, e a tela de origem sai da árvore junto: por isso os dois avisos da
 * sessão são desenhados pelo `Portal`, fora das rotas, e atravessam a troca
 * para serem lidos já na tela de destino. Uma gravação de cadastro não troca
 * rota nenhuma — a tela continua ali, atrás do formulário que fecha —, então
 * ali quem desenha é a própria página.
 *
 * Todo aviso daqui é uma CONFIRMAÇÃO de algo favorável que a pessoa acabou de
 * fazer, e por isso o símbolo e a cor são fixos: quem usa esta casca escolhe
 * só o que está escrito. Uma recusa não passa por aqui — ela é dita onde ainda
 * há o que corrigir, ao lado do formulário. Um aviso que exige providência,
 * como o de página concedida sem menu no serviço, também não: ele fica na
 * faixa da página, que não se apaga sozinha.
 *
 * Nada depende dele: é confirmação, não decisão. Some sozinho depois de alguns
 * segundos, e antes disso pelo Fechar.
 *
 * O visual vem dos tokens, então os dois temas saem de graça. O verde é o par
 * favorável já medido do portal (`--session-toast-accent`, em
 * `src/styles.css`), e não um verde novo: o Verde Detalhes puro tem 1,96 de
 * contraste sobre o branco do tema claro.
 */

/** Tempo na tela: dá para ler as duas linhas sem que o aviso vire estorvo. */
const AUTO_DISMISS_MS = 5_000

type SessionToastProps = {
  /** Segunda linha: o que mudou, em uma frase. */
  description: ReactNode
  /** Fecha o aviso. Chamado pelo botão e pelo tempo esgotado. */
  onDismiss: () => void
  /** Primeira linha: o que aconteceu. */
  title: string
}

export function SessionToast({ description, onDismiss, title }: SessionToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)

    // Fechar pelo botão desmonta o aviso e cancela o tempo aqui: sem isso o
    // relógio continuaria correndo e fecharia um aviso que já não existe.
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    // `status` e não `alert`: é a confirmação de algo que a pessoa acabou de
    // fazer, e não uma interrupção. A faixa inteira ignora o ponteiro para não
    // cobrir a tela embaixo dela; só o cartão volta a recebê-lo, por causa do
    // Fechar.
    <div
      aria-live="polite"
      className="session-toast pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:justify-end"
      role="status"
    >
      <div className="pointer-events-auto flex w-full max-w-[368px] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-lg">
        <CircleCheck
          aria-hidden="true"
          className="mt-[1px] flex-none text-[var(--session-toast-accent)]"
          size={18}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[var(--text-heading)]">{title}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-secondary)]">
            {description}
          </p>
        </div>

        <button
          aria-label="Fechar aviso"
          className="flex flex-none cursor-pointer items-center rounded-md p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
    </div>
  )
}
