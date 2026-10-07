import {type FormEvent, useState} from 'react'
import {Eye, EyeClosed, LoaderCircle} from 'lucide-react'

import type {LoginFailureReason, LoginResult} from '../../contexts/AuthContextCore'
import {declineRememberedLogin, rememberLoginEmail,} from '../../services/preferences/rememberedLoginStorage'
import {useApiVersion} from '../../components/layout/useApiVersion'
import {APP_VERSION_LABEL} from '../../lib/appVersion'
import {BrandPanel} from './BrandPanel'
import './Login.css'

type LoginProps = {
    /** E-mail e senha vão ao serviço, e é ele quem decide quem entra. */
    onLogin: (email: string, password: string) => Promise<LoginResult>
    /** Leva para a tela de recuperação. Quem conhece a rota é o roteador. */
    onForgotPassword: () => void
}

/**
 * Texto de cada recusa.
 *
 * Credencial, conta e permissão são separadas de propósito: quem errou a senha
 * confere o que digitou; quem está inativo ou sem Perfil de Acesso precisa saber
 * que não adianta conferir nada, e sim procurar um Administrador. A frase não
 * expõe o perfil nem o motivo técnico, porque a tela de entrada não é lugar para
 * descrever a configuração de acesso de ninguém. Credencial errada não diz se
 * foi o e-mail ou a senha, e é assim que o serviço também responde.
 */
const loginFailureMessages: Record<LoginFailureReason, string> = {
    'invalid-credentials': 'E-mail ou senha inválidos. Verifique e tente novamente.',
    'inactive-account':
        'Seu usuário está inativo e não pode entrar no portal. Procure um Administrador do portal.',
    'access-profile-required':
        'Seu acesso está bloqueado até que um Perfil de Acesso seja definido para o seu usuário. Procure um Administrador do portal.',
    'service-unavailable':
        'Não foi possível falar com o serviço do portal. Tente novamente em instantes.',
}

export function Login({onLogin, onForgotPassword}: LoginProps) {
    const apiVersion = useApiVersion()
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    /**
     * Envio em andamento. Guarda contra o segundo Enter enquanto o serviço ainda
     * não respondeu ao primeiro: duas entradas abririam duas sessões lá.
     */
    const [submitting, setSubmitting] = useState(false)
    /**
     * Lido UMA vez, na montagem.
     *
     * Os dois campos que ele decide são não controlados (`defaultValue` e
     * `defaultChecked`), então reler a cada renderização não mudaria o que está na
     * tela: só criaria leituras de armazenamento sem efeito nenhum.
     */
    /*const [rememberedLogin] = useState(readRememberedLogin)*/

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting) return

        const data = new FormData(event.currentTarget)
        const email = String(data.get('email') ?? '')
        const password = String(data.get('password') ?? '')
        const remember = data.get('remember') !== null

        setSubmitting(true)
        let result: LoginResult
        try {
            result = await onLogin(email, password)
        } finally {
            setSubmitting(false)
        }

        if (remember) {
            if (result.ok) rememberLoginEmail(email)
        } else {
            declineRememberedLogin()
        }

        setError(result.ok ? null : loginFailureMessages[result.reason])
    }

    return (
        <main className="login-page">
            <BrandPanel/>

            <section className="form-panel">
                <form className="login-form" onSubmit={handleSubmit} noValidate>
                    <h2>Entrar</h2>
                    <p className="form-intro">Acesse o painel com suas credenciais.</p>

                    <label htmlFor="email">E-mail</label>
                    <div className="field-wrap">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="3" y="5" width="18" height="14" rx="2"/>
                            <path d="m3 7 9 6 9-6"/>
                        </svg>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Ex: usuário@impactotelecom.com"
                            /*defaultValue={
                                rememberedLogin.status === 'remembered' ? rememberedLogin.email : ''
                            }*/
                            autoComplete="email"
                        />
                    </div>

                    <label htmlFor="password">Senha</label>
                    <div className="field-wrap password-wrap">
                        {/* Senha de verdade, conferida pelo serviço. Nasce vazia: a senha de
                        fachada da fase mockada saiu junto com a entrada mockada. O
                        Lembrar-me guarda apenas quem entrou, nunca a senha. */}
                        <input
                            id="password"
                            name="password"
                            placeholder="Ex: Senha123!"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                        />
                        <button
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            aria-pressed={showPassword}
                            className="icon-button"
                            onClick={() => setShowPassword((visible) => !visible)}
                            title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            type="button"
                        >
                            {/* O ícone mostra o ESTADO do campo, e não a ação do clique:
                              senha oculta aparece com o olho fechado, e revelada com o olho
                              aberto. Quem diz a ação é o `aria-label` e o `title` do botão,
                              que continuam sendo "Mostrar senha" e "Ocultar senha".

                              `EyeClosed` é a pálpebra fechada, e não o `EyeOff`, que é o
                              olho aberto com um risco em cima: o risco lê como proibição,
                              e aqui o que precisa aparecer é o olho fechado. */}
                            {showPassword ? (
                                <Eye aria-hidden="true" size={21}/>
                            ) : (
                                <EyeClosed aria-hidden="true" size={21}/>
                            )}
                        </button>
                    </div>

                    <div className="form-options">
                        {/*<label className="remember-option">
                            <input
                                defaultChecked={rememberedLogin.status !== 'declined'}
                                name="remember"
                                type="checkbox"
                            />

                            <span className="checkmark">
                                <svg viewBox="0 0 16 16" aria-hidden="true">
                                  <path d="m3 8 3 3 7-7"/>
                                </svg>
                            </span>
                            Lembrar-me
                        </label>*/}

                        <button className="forgot-password" onClick={onForgotPassword} type="button">
                            Esqueci minha senha
                        </button>
                    </div>

                    {error ? (
                        <p role="alert" style={{color: '#e5484d', fontSize: '13px', margin: '0 0 4px'}}>
                            {error}
                        </p>
                    ) : null}

                    {/* O próprio botão é o aviso de que o login está em andamento.
                        Entrar é uma chamada ao serviço, e sem esse sinal a tela fica
                        idêntica à de antes do clique: a pessoa não sabe se o clique
                        pegou e tenta de novo. A seta vira um giro, o texto diz o que
                        está acontecendo, `disabled` fecha o caminho do segundo envio
                        pelo botão (a guarda de `submitting` continua valendo para o
                        Enter) e `aria-busy` conta a mesma coisa a quem usa leitor de
                        tela. */}
                    <button aria-busy={submitting} className="submit-button" disabled={submitting} type="submit">
                        {submitting ? (
                            <LoaderCircle aria-hidden="true" className="submit-spinner" size={23}/>
                        ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>
                            </svg>
                        )}
                        {submitting ? 'Entrando...' : 'Entrar'}
                    </button>

                    <p className="app-version">
                        {APP_VERSION_LABEL}
                        {apiVersion === null ? null : ` (${apiVersion})`}
                    </p>

                    <p className="security-note">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="10" rx="2"/>
                            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                        </svg>
                        Seus dados estão protegidos com segurança.
                    </p>
                </form>
            </section>
        </main>
    )
}
