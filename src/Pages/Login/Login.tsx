import {type FormEvent, useState} from 'react'
import {Eye, EyeClosed} from 'lucide-react'

import logoImpacto from '../../assets/logo-horizontal-branco-verde.svg'
import fundoAzul from '../../assets/Fundo Azul.png'
import type {LoginFailureReason, LoginResult} from '../../contexts/AuthContextCore'
import {
    declineRememberedLogin,
    readRememberedLogin,
    rememberLoginEmail,
} from '../../services/preferences/rememberedLoginStorage'
import './Login.css'

type LoginProps = {
    /** E-mail e senha vão ao serviço, e é ele quem decide quem entra. */
    onLogin: (email: string, password: string) => Promise<LoginResult>
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

export function Login({onLogin}: LoginProps) {
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
    const [rememberedLogin] = useState(readRememberedLogin)

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (submitting) return

        const data = new FormData(event.currentTarget)
        const email = String(data.get('email') ?? '')
        // A senha sai daqui direto para o serviço: não vai para o contexto além da
        // chamada e não é gravada em lugar nenhum, nem pelo Lembrar-me.
        const password = String(data.get('password') ?? '')
        // Caixa de seleção não enviada é caixa desmarcada: a ausência do campo é a
        // resposta "não lembrar", e não um valor a converter.
        const remember = data.get('remember') !== null

        setSubmitting(true)
        let result: LoginResult
        try {
            result = await onLogin(email, password)
        } finally {
            setSubmitting(false)
        }

        // Só entrada que deu certo vira memória: guardar um e-mail recusado faria a
        // tela sugerir de novo, no próximo acesso, exatamente o que não funcionou.
        // A recusa, essa, vale sempre, porque desmarcar a caixa precisa apagar o
        // e-mail de quem entrou antes mesmo que esta tentativa falhe.
        if (remember) {
            if (result.ok) rememberLoginEmail(email)
        } else {
            declineRememberedLogin()
        }

        setError(result.ok ? null : loginFailureMessages[result.reason])
    }

    return (
        <main className="login-page">
            <section
                className="brand-panel"
                style={{backgroundImage: `url(${fundoAzul})`}}
                aria-label="Impacto Telecom Business Intelligence"
            >
                <div className="brand-content">
                    <img className="brand-logo" src={logoImpacto} alt="Impacto Telecom"/>

                    <h1>
                        Inteligência de dados para <span>decisões</span> mais <span>estratégicas</span>.
                    </h1>

                    <p className="brand-description">
                        Acompanhe indicadores, resultados e oportunidades de todas as áreas da Impacto Telecom
                        em um único ambiente.
                    </p>

                    <div className="benefits" aria-label="Benefícios do painel">
                        <article className="benefit">
                            <svg viewBox="0 0 48 48" aria-hidden="true">
                                <rect x="3" y="3" width="17" height="17" rx="3"/>
                                <rect x="28" y="3" width="17" height="17" rx="3"/>
                                <rect x="3" y="28" width="17" height="17" rx="3"/>
                                <rect x="28" y="28" width="17" height="17" rx="3"/>
                            </svg>
                            <h2>Todas as áreas</h2>
                            <p>
                                dashboards
                                <br/>
                                integrados
                            </p>
                        </article>

                        <article className="benefit">
                            <svg viewBox="0 0 48 48" aria-hidden="true">
                                <path d="M5 44V32h9v12M20 44V23h9v21M35 44V14h9v30M4 20l11-9 8 5L42 2M34 2h8v8"/>
                            </svg>
                            <h2>Visão gerencial</h2>
                            <p>
                                indicadores
                                <br/>
                                estratégicos
                            </p>
                        </article>

                        <article className="benefit">
                            <svg viewBox="0 0 48 48" aria-hidden="true">
                                <ellipse cx="24" cy="9" rx="19" ry="7"/>
                                <path
                                    d="M5 9v11c0 4 8.5 7 19 7s19-3 19-7V9M5 20v11c0 4 8.5 7 19 7s19-3 19-7V20M5 31v8c0 4 8.5 7 19 7s19-3 19-7v-8"/>
                            </svg>
                            <h2>Dados centralizados</h2>
                            <p>
                                uma única fonte
                                <br/>
                                de informação
                            </p>
                        </article>
                    </div>
                </div>

                <footer>© 2026 Impacto Telecom | Business Intelligence</footer>
            </section>

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
                            // Em branco quando não há ninguém lembrado, e não mais um e-mail
                            // fixo no código: aquele endereço era resíduo da entrada mockada e
                            // aparecia igual em qualquer navegador, para qualquer pessoa.
                            defaultValue={
                                rememberedLogin.status === 'remembered' ? rememberedLogin.email : ''
                            }
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
                        <label className="remember-option">
                            {/* A caixa guarda QUEM entrou por último, e nada além disso: o
                  campo de e-mail já vem preenchido no próximo acesso. Ela não
                  mantém ninguém logado, porque a sessão é sempre da aba e
                  fechar a aba ou o navegador pede login de novo.

                  Marcada enquanto ninguém decidiu, que é como a tela sempre
                  chegou. Desmarcar apaga o e-mail guardado e a caixa continua
                  desmarcada nos acessos seguintes: a escolha da pessoa dura
                  mais do que uma entrada. */}
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
                        </label>
                        <button className="forgot-password" type="button">
                            Esqueci minha senha
                        </button>
                    </div>

                    {error ? (
                        <p role="alert" style={{color: '#e5484d', fontSize: '13px', margin: '0 0 4px'}}>
                            {error}
                        </p>
                    ) : null}

                    <button className="submit-button" type="submit">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>
                        </svg>
                        Entrar
                    </button>

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
