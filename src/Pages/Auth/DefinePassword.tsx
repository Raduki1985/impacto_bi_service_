import { type FormEvent, useState } from 'react'
import { Eye, EyeClosed } from 'lucide-react'

import { isPasswordAccepted, passwordRequirements } from '../../lib/passwordPolicy'
import { authService } from '../../services/auth/authService'
import type { PasswordFlowResult } from '../../types/auth/authTypes'
import { AuthEnterIcon, AuthScreen, AuthSecurityNote } from './AuthScreen'

/**
 * Qual dos dois links trouxe a pessoa até aqui.
 *
 * `first-access` é o e-mail de cadastro, e concluí-lo ATIVA a conta.
 * `reset` é o e-mail de recuperação, e só troca a senha de quem já entrava.
 *
 * Os dois usam tokens diferentes, guardados em colunas diferentes do serviço, e
 * cada endpoint recusa o token do outro com 401. Por isso o modo é decidido pela
 * ROTA, e não por algo lido do token: a tela nunca chama o endpoint errado.
 */
export type DefinePasswordMode = 'first-access' | 'reset'

type DefinePasswordProps = {
    mode: DefinePasswordMode
    /** Token da query da URL. Nulo quando o link chegou truncado ou sem ele. */
    token: string | null
    /** Vai para a entrada. Quem conhece a rota é o roteador. */
    onGoToLogin: () => void
}

/** Textos de cada modo. Só o que muda entre os dois mora aqui. */
const modeCopy: Record<
    DefinePasswordMode,
    { title: string; intro: string; submit: string; successTitle: string; successMessage: string }
> = {
    'first-access': {
        title: 'Definir senha',
        intro: 'Crie a senha que você vai usar para entrar no portal.',
        submit: 'Definir senha e ativar conta',
        successTitle: 'Conta ativada',
        successMessage:
            'Sua senha foi definida e sua conta está ativa. Entre no portal com o seu e-mail e a senha que você acabou de criar.',
    },
    reset: {
        title: 'Criar nova senha',
        intro: 'Escolha a nova senha da sua conta no portal.',
        submit: 'Salvar nova senha',
        successTitle: 'Senha alterada',
        successMessage:
            'Sua senha foi alterada. Entre no portal com o seu e-mail e a senha que você acabou de criar.',
    },
}

/**
 * Por que o link não serve mais, em cada modo.
 *
 * O serviço responde 401 para quatro situações diferentes (token ilegível, token
 * do outro fluxo, token já usado e token vencido) e a tela não as separa: a
 * saída é a mesma nas quatro, e é pedir um link novo. O que muda entre os modos
 * é ONDE se pede: o convite de primeiro acesso só um Administrador reenvia,
 * enquanto a recuperação a própria pessoa refaz.
 */
const expiredLinkMessage: Record<DefinePasswordMode, string> = {
    'first-access':
        'Este link não é mais válido. Ele vale por 10 minutos e só pode ser usado uma vez. Peça ao Administrador que cadastrou sua conta para reenviar o convite.',
    reset:
        'Este link não é mais válido. Ele vale por 10 minutos e só pode ser usado uma vez. Volte para a entrada e peça a recuperação de senha novamente.',
}

/**
 * Tela das duas pontas do fluxo de senha: primeiro acesso e redefinição.
 *
 * Uma tela só, com dois modos, porque o formulário é o MESMO: a mesma regra de
 * composição, a mesma confirmação, o mesmo token de 10 minutos vindo por e-mail.
 * Duas telas quase iguais divergiriam na primeira mudança da regra.
 *
 * A regra de senha aparece como lista que vai ficando verde enquanto a pessoa
 * digita, e o botão só libera quando todas as exigências estão atendidas. Isso
 * não substitui a validação do serviço, que continua sendo quem recusa: evita
 * gastar a ida até lá e, principalmente, evita a pessoa descobrir a exigência
 * por tentativa e erro com um link que vale 10 minutos.
 */
export function DefinePassword({ mode, token, onGoToLogin }: DefinePasswordProps) {
    const copy = modeCopy[mode]

    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    // Um estado por campo: revelar a senha não revela a confirmação, que é
    // justamente o que se está conferindo ao digitar duas vezes.
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmation, setShowConfirmation] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)
    /** Envio em andamento. O segundo Enter usaria um token que o primeiro já queimou. */
    const [submitting, setSubmitting] = useState(false)

    const accepted = isPasswordAccepted(password)
    const matches = password !== '' && password === confirmation

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting || token === null) return

        if (!accepted) {
            setError('A senha ainda não atende a todas as exigências listadas abaixo do campo.')
            return
        }
        if (!matches) {
            setError('As duas senhas digitadas não são iguais.')
            return
        }

        setError(null)
        setSubmitting(true)
        let result: PasswordFlowResult
        try {
            result =
                mode === 'first-access'
                    ? await authService.setFirstAccessPassword({ token, newPassword: password })
                    : await authService.confirmPasswordReset({ token, newPassword: password })
        } finally {
            setSubmitting(false)
        }

        if (result.ok) {
            setDone(true)
            return
        }

        if (result.reason === 'invalid-token') {
            setError(expiredLinkMessage[mode])
            return
        }
        if (result.reason === 'account-not-active') {
            // A frase é do serviço: só ele sabe se a conta está inativa ou
            // bloqueada. Acontece quando um Administrador desativa a conta entre o
            // pedido do link e o uso dele, e não há nada a corrigir no formulário.
            setError(
                `${result.message ?? 'Esta conta não está ativa'}. Procure um Administrador do portal.`,
            )
            return
        }
        if (result.reason === 'weak-password') {
            // A frase do serviço lista o que faltou e é mais precisa que
            // qualquer texto fixo daqui. Só entra em cena quando a tela e o
            // serviço discordarem, o que não deveria acontecer.
            setError(result.message ?? 'O serviço recusou a senha informada.')
            return
        }
        setError('Não foi possível falar com o serviço do portal. Tente novamente em instantes.')
    }

    // Link sem token não tem o que enviar: a tela nem monta o formulário.
    if (token === null) {
        return (
            <AuthScreen>
                <div className="login-form">
                    <h2>Link inválido</h2>
                    <p className="form-intro">Não foi possível identificar o convite.</p>

                    <p className="auth-feedback" data-tone="error" role="alert">
                        Este endereço não traz o código do link enviado por e-mail. Abra o link
                        direto da mensagem, sem copiar apenas parte dele.
                    </p>

                    <button className="submit-button" onClick={onGoToLogin} type="button">
                        <AuthEnterIcon/>
                        Voltar para a entrada
                    </button>
                </div>
            </AuthScreen>
        )
    }

    if (done) {
        return (
            <AuthScreen>
                <div className="login-form">
                    <h2>{copy.successTitle}</h2>
                    <p className="form-intro">Tudo certo por aqui.</p>

                    <p className="auth-feedback" data-tone="success" role="status">
                        {copy.successMessage}
                    </p>

                    <button className="submit-button" onClick={onGoToLogin} type="button">
                        <AuthEnterIcon/>
                        Entrar no portal
                    </button>
                </div>
            </AuthScreen>
        )
    }

    return (
        <AuthScreen>
            <form className="login-form" onSubmit={handleSubmit} noValidate>
                <h2>{copy.title}</h2>
                <p className="form-intro">{copy.intro}</p>

                <label htmlFor="new-password">Nova senha</label>
                <div className="field-wrap password-wrap">
                    <input
                        autoComplete="new-password"
                        autoFocus
                        id="new-password"
                        onChange={(event) => setPassword(event.target.value)}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                    />
                    <button
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showPassword}
                        className="icon-button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        type="button"
                    >
                        {/* O ícone mostra o ESTADO do campo, como no login: senha oculta
                com o olho fechado, revelada com o olho aberto. */}
                        {showPassword ? (
                            <Eye aria-hidden="true" size={21}/>
                        ) : (
                            <EyeClosed aria-hidden="true" size={21}/>
                        )}
                    </button>
                </div>

                {/* A lista fica visível o tempo todo, e não só depois de um erro: é ela
            que diz o que fazer ANTES de tentar. O `data-met` é o que o CSS lê
            para pintar de verde, e o texto entre parênteses é o que um leitor
            de tela anuncia, porque cor sozinha não informa ninguém. */}
                <ul aria-label="Exigências da senha" className="password-rules">
                    {passwordRequirements.map((rule) => {
                        const met = rule.isMet(password)
                        return (
                            <li data-met={met} key={rule.id}>
                                {met ? (
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="m4 12 5 5L20 6"/>
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <circle cx="12" cy="12" r="8"/>
                                    </svg>
                                )}
                                {rule.label}
                                <span className="sr-only">{met ? ' (atendido)' : ' (pendente)'}</span>
                            </li>
                        )
                    })}
                </ul>

                <label htmlFor="confirm-password">Repita a nova senha</label>
                <div className="field-wrap password-wrap">
                    <input
                        autoComplete="new-password"
                        id="confirm-password"
                        onChange={(event) => setConfirmation(event.target.value)}
                        type={showConfirmation ? 'text' : 'password'}
                        value={confirmation}
                    />
                    <button
                        aria-label={showConfirmation ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showConfirmation}
                        className="icon-button"
                        onClick={() => setShowConfirmation((visible) => !visible)}
                        title={showConfirmation ? 'Ocultar senha' : 'Mostrar senha'}
                        type="button"
                    >
                        {showConfirmation ? (
                            <Eye aria-hidden="true" size={21}/>
                        ) : (
                            <EyeClosed aria-hidden="true" size={21}/>
                        )}
                    </button>
                </div>

                {error !== null ? (
                    <p className="auth-feedback" data-tone="error" role="alert">
                        {error}
                    </p>
                ) : null}

                <button
                    className="submit-button"
                    disabled={submitting || !accepted || !matches}
                    type="submit"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2"/>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                    </svg>
                    {submitting ? 'Salvando...' : copy.submit}
                </button>

                <button className="auth-back" onClick={onGoToLogin} type="button">
                    Voltar para a entrada
                </button>

                <AuthSecurityNote>
                    Este link vale por 10 minutos e só pode ser usado uma vez.
                </AuthSecurityNote>
            </form>
        </AuthScreen>
    )
}
