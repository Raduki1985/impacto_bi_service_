import * as Dialog from '@radix-ui/react-dialog'

/**
 * Confirmação do Sair, antes de a sessão ser encerrada de fato.
 *
 * POR QUE CONFIRMAR uma ação que não destrói dado nenhum: o Sair fica a um
 * clique do avatar, vizinho de Configurações e Aparência, e acertá-lo sem
 * querer custa a sessão inteira — a volta exige e-mail e senha de novo, e o
 * que estava aberto na tela se perde.
 *
 * É `alertdialog`, e não `dialog`: a janela existe para colher uma decisão, e o
 * papel faz o leitor de tela anunciar a pergunta inteira ao abrir, em vez de só
 * o título. Pelo mesmo motivo ela NÃO fecha por clique fora — só por Cancelar,
 * por Esc ou pelo próprio Encerrar sessão. Fechar por um clique distraído
 * deixaria a pessoa sem saber se saiu ou não.
 *
 * Construída sobre o `Dialog` do Radix, que já é a janela modal do portal (a
 * mesma de Perfis de Acesso e da janela de lista), e não sobre o
 * `AlertDialog` do mesmo fornecedor: o papel, a recusa do clique fora e o foco
 * inicial no Cancelar são o que aquele pacote acrescenta, e são exatamente as
 * três linhas abaixo. Uma dependência a mais no portal por isso não se paga.
 *
 * O foco entra no CANCELAR, que é o primeiro botão da ordem de leitura: quem
 * abriu a janela sem querer sai dela com um Enter, sem encerrar coisa alguma.
 */
export function LogoutConfirmDialog({
                                        onConfirm,
                                        onOpenChange,
                                        open,
                                    }: {
    /** Encerra a sessão. Chamado só pelo botão de confirmação. */
    onConfirm: () => void
    onOpenChange: (open: boolean) => void
    open: boolean
}) {
    return (
        <Dialog.Root onOpenChange={onOpenChange} open={open}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/50"/>
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[0_18px_48px_rgba(16,24,40,.22)] outline-none"
                    onInteractOutside={(event) => event.preventDefault()}
                    role="alertdialog"
                >
                    <LogoutConfirmBody onConfirm={onConfirm}/>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

/**
 * Ação de dentro da janela: o mesmo desenho dos dois botões, cor à parte.
 *
 * O anel de foco fica FORA daqui porque ele acompanha a cor de cada botão: um
 * anel azul em volta do botão vermelho leria como dois avisos diferentes.
 */
const actionClass =
    'cursor-pointer rounded-lg px-3 py-2 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-elevated)]'

/**
 * Confirmação em vermelho: o mesmo `#b42318` de toda recusa e todo erro do
 * portal, e não um tom novo.
 *
 * A cor carrega o peso da ação — encerrar a sessão é o que a janela existe para
 * evitar por engano —, mas não é ela que informa: quem não distingue a cor lê
 * "Encerrar sessão" no botão e a consequência na descrição. Branco sobre este
 * vermelho dá 7,4 de contraste, e o valor é literal nos dois temas, como em
 * todo o resto do portal.
 *
 * As classes vêm escritas por extenso, e não montadas a partir de uma constante
 * de cor: o Tailwind lê o TEXTO deste arquivo para decidir o que gerar, e uma
 * classe interpolada não existiria na folha de estilo.
 */
const confirmActionClass =
    'bg-[#b42318] text-white hover:opacity-90 focus-visible:ring-[#b42318]'

/**
 * A pergunta e os dois botões.
 *
 * Separado da casca pelo mesmo motivo do cabeçalho da janela de lista: a casca
 * usa portal, que não existe fora do navegador, e é isto aqui — o texto e as
 * ações — que os testes precisam desenhar, dentro do contexto do
 * `Dialog.Root`.
 */
export function LogoutConfirmBody({onConfirm}: { onConfirm: () => void }) {
    return (
        <>
            <Dialog.Title className="text-[15px] font-semibold text-[var(--text-heading)]">
                Encerrar sessão?
            </Dialog.Title>
            {/* Vira o `aria-describedby` da janela, então é lido junto com o título
                assim que ela abre — e é por isso que a pergunta cabe aqui, e não em
                um parágrafo solto, que o leitor de tela só alcançaria depois. */}
            <Dialog.Description className="mt-1.5 text-[12.5px] leading-5 text-[var(--text-secondary)]">
                Deseja prosseguir com o encerramento da sessão?
            </Dialog.Description>

            <div className="mt-5 flex justify-end gap-2">
                <Dialog.Close asChild>
                    <button
                        className={`${actionClass} border border-[var(--border)] text-[var(--text-item)] hover:bg-[var(--hover-bg)] focus-visible:ring-[var(--accent)]`}
                        type="button"
                    >
                        Cancelar
                    </button>
                </Dialog.Close>
                <button
                    className={`${actionClass} ${confirmActionClass}`}
                    onClick={onConfirm}
                    type="button"
                >
                    Encerrar sessão
                </button>
            </div>
        </>
    )
}
