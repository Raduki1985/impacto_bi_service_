import {SessionToast} from '../../components/ui/SessionToast'

/**
 * Aviso flutuante da sessão encerrada.
 *
 * Aparece JÁ SOBRE A TELA DE LOGIN, para onde o portal leva quem sai, e é a
 * única confirmação de que o Sair foi até o fim: a tela de login é a mesma de
 * quem nunca entrou, e sem o aviso a saída bem sucedida e uma sessão perdida
 * por conta própria ficariam idênticas.
 *
 * O que ele NÃO promete é que o serviço recebeu o aviso de encerramento. A
 * saída não espera resposta (`services/auth/authService`), então o texto fala
 * do que é certo aqui: a sessão desta aba acabou e o acesso pede uma nova
 * entrada.
 *
 * Sem o nome de quem saiu, ao contrário do aviso de entrada: na tela de login a
 * conta anterior não é mais o assunto, e repeti-la só daria a um navegador
 * compartilhado o nome de quem acabou de sair.
 */
type LogoutSuccessToastProps = {
    /** Fecha o aviso. Chamado pelo botão e pelo tempo esgotado. */
    onDismiss: () => void
}

export function LogoutSuccessToast({onDismiss}: LogoutSuccessToastProps) {
    return (
        <SessionToast
            description="Entre de novo para voltar ao portal."
            onDismiss={onDismiss}
            title="Sessão encerrada com sucesso"
        />
    )
}
