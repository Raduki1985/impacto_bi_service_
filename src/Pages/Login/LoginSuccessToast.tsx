import {SessionToast} from '../../components/ui/SessionToast'

/**
 * Aviso flutuante da entrada aceita pelo serviço.
 *
 * O QUE ELE DIZ é que a entrada foi aceita e em qual conta. A recusa continua
 * sendo dita pela própria tela de login, ao lado do formulário, porque lá ainda
 * há o que conferir; o sucesso não tem o que conferir, e por isso pode ser um
 * aviso passageiro.
 *
 * A casca, o tempo de tela, o Fechar e as cores são do `SessionToast`, a mesma
 * do aviso de saída: os dois são a confirmação de uma ponta da sessão, e vê-los
 * lado a lado no código é o que os mantém iguais na tela.
 */
type LoginSuccessToastProps = {
    /** Fecha o aviso. Chamado pelo botão e pelo tempo esgotado. */
    onDismiss: () => void
    /** Nome de quem entrou, exatamente como o serviço devolveu. */
    userName: string
}

export function LoginSuccessToast({onDismiss, userName}: LoginSuccessToastProps) {
    return (
        <SessionToast
            // O nome diz em QUAL conta a pessoa entrou, que é o que importa em um
            // navegador compartilhado. Sem saudação flexionada: o portal não deduz
            // gênero a partir do nome de ninguém.
            description={`Você entrou como ${userName}.`}
            onDismiss={onDismiss}
            title="Login realizado com sucesso"
        />
    )
}
