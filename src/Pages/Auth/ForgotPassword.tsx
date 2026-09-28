import {type FormEvent, useState} from 'react'

import {requestPasswordRecovery} from '../../services/auth/passwordFlows'
import {AuthEnterIcon, AuthScreen} from './AuthScreen'

type ForgotPasswordProps = {
    /** Volta para a entrada. Quem conhece a rota é o roteador. */
    onBackToLogin: () => void
}

/**
 * Pedido de recuperação de senha: um campo de e-mail e um botão.
 *
 * A TELA NÃO DIZ SE O E-MAIL EXISTE NEM EM QUE SITUAÇÃO A CONTA ESTÁ, e isso é
 * intencional, não uma omissão. O serviço responde 200 para um endereço
 * cadastrado, para um desconhecido e para uma conta que não pode recuperar a
 * senha, e a frase de confirmação aqui é a mesma nos três casos. Uma mensagem
 * diferente para cada um transformaria esta tela, que é pública, em um jeito de
 * descobrir quem tem conta no portal. Quem digitou o e-mail errado simplesmente
 * não recebe nada e tenta de novo.
 *
 * O LINK SÓ SAI PARA CONTA ATIVA. Quem nunca definiu a senha (Pendente) não tem
 * senha a recuperar: o caminho dele é o convite de primeiro acesso, que um
 * Administrador reenvia pela tela Usuários. Quem foi desativado precisa ser
 * reativado antes. Os dois casos passam por um Administrador, e é para lá que o
 * texto do "Não chegou?" aponta, sem afirmar em qual deles a pessoa está.
 *
 * O e-mail só sai daqui: nada é gravado, nenhuma sessão é aberta e a pessoa
 * continua tendo que entrar pelo login depois de criar a senha nova.
 */
export function ForgotPassword({onBackToLogin}: ForgotPasswordProps) {
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)
    /**
     * Envio em andamento. Guarda contra o segundo Enter enquanto o serviço ainda
     * não respondeu ao primeiro, que dispararia dois e-mails com tokens
     * diferentes: só o último valeria, e o primeiro link chegaria morto.
     */
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting) return

        const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
        if (email === '') {
            setError('Informe o e-mail cadastrado no portal.')
            return
        }

        setError(null)
        setSubmitting(true)
        let result: Awaited<ReturnType<typeof requestPasswordRecovery>>
        try {
            result = await requestPasswordRecovery(email)
        } finally {
            setSubmitting(false)
        }

        if (result.ok) {
            setSent(true)
            return
        }

        // O serviço só recusa esta rota por formato do endereço (`422`, que o
        // campo de e-mail do navegador já barra) ou por estar fora do ar.
        // E-mail desconhecido volta como sucesso, e é assim que tem que ser.
        setError(
            result.reason === 'weak-password' && result.message !== null
                ? 'Informe um e-mail válido, no formato nome@empresa.com.'
                : 'Não foi possível falar com o serviço do portal. Tente novamente em instantes.',
        )
    }

    if (sent) {
        return (
            <AuthScreen>
                <div className="login-form">
                    <h2>E-mail enviado</h2>
                    <p className="form-intro">Confira sua caixa de entrada para continuar.</p>

                    <p className="auth-feedback" data-tone="success" role="status">
                        Se o e-mail informado pertencer a uma conta ativa do portal, você receberá
                        em instantes uma mensagem com o link para criar uma nova senha. O link vale
                        por 10 minutos.
                    </p>

                    <p className="auth-feedback" data-tone="info">
                        Não chegou? Confira a caixa de spam e confirme se digitou o mesmo e-mail que
                        usa para entrar no portal. Se você ainda não criou a sua primeira senha, ou
                        se o seu acesso foi desativado, quem resolve é um Administrador do portal.
                    </p>

                    <button className="submit-button" onClick={onBackToLogin} type="button">
                        <AuthEnterIcon/>
                        Voltar para a entrada
                    </button>
                </div>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen>
            <form className="login-form" onSubmit={handleSubmit} noValidate>
                <h2>Recuperar senha</h2>
                <p className="form-intro">
                    Informe o e-mail cadastrado e enviaremos um link para criar uma nova senha.
                </p>

                <label htmlFor="recovery-email">E-mail</label>
                <div className="field-wrap">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2"/>
                        <path d="m3 7 9 6 9-6"/>
                    </svg>
                    <input
                        autoComplete="email"
                        autoFocus
                        id="recovery-email"
                        name="email"
                        type="email"
                    />
                </div>

                {error !== null ? (
                    <p className="auth-feedback" data-tone="error" role="alert">
                        {error}
                    </p>
                ) : null}

                <button className="submit-button" disabled={submitting} type="submit">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2"/>
                        <path d="m3 7 9 6 9-6"/>
                    </svg>
                    {submitting ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>

                <button className="auth-back" onClick={onBackToLogin} type="button">
                    Voltar para a entrada
                </button>

                {/* <AuthSecurityNote>O link enviado vale por 10 minutos.</AuthSecurityNote>*/}
            </form>
        </AuthScreen>
    )
}
