import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import logoImpacto from '../../assets/logo-01.svg'
import fundoAzul from '../../assets/Fundo Azul.png'
import './Login.css'

type LoginProps = {
  onLogin: (email: string) => boolean
}

export function Login({ onLogin }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    const authenticated = onLogin(email)
    setError(authenticated ? null : 'E-mail não encontrado no sistema. Verifique e tente novamente.')
  }

  return (
    <main className="login-page">
      <section
        className="brand-panel"
        style={{ backgroundImage: `url(${fundoAzul})` }}
        aria-label="Impacto Telecom Business Intelligence"
      >
        <div className="brand-content">
          <img className="brand-logo" src={logoImpacto} alt="Impacto Telecom" />

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
                <rect x="3" y="3" width="17" height="17" rx="3" />
                <rect x="28" y="3" width="17" height="17" rx="3" />
                <rect x="3" y="28" width="17" height="17" rx="3" />
                <rect x="28" y="28" width="17" height="17" rx="3" />
              </svg>
              <h2>Todas as áreas</h2>
              <p>
                dashboards
                <br />
                integrados
              </p>
            </article>

            <article className="benefit">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <path d="M5 44V32h9v12M20 44V23h9v21M35 44V14h9v30M4 20l11-9 8 5L42 2M34 2h8v8" />
              </svg>
              <h2>Visão gerencial</h2>
              <p>
                indicadores
                <br />
                estratégicos
              </p>
            </article>

            <article className="benefit">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <ellipse cx="24" cy="9" rx="19" ry="7" />
                <path d="M5 9v11c0 4 8.5 7 19 7s19-3 19-7V9M5 20v11c0 4 8.5 7 19 7s19-3 19-7V20M5 31v8c0 4 8.5 7 19 7s19-3 19-7v-8" />
              </svg>
              <h2>Dados centralizados</h2>
              <p>
                uma única fonte
                <br />
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
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue="marioramos@impactotelecom.com"
              autoComplete="email"
            />
          </div>

          <label htmlFor="password">Senha</label>
          <div className="field-wrap password-wrap">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              defaultValue="demo-senha-123"
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
              {showPassword ? <EyeOff aria-hidden="true" size={21} /> : <Eye aria-hidden="true" size={21} />}
            </button>
          </div>

          <div className="form-options">
            <label className="remember-option">
              <input defaultChecked type="checkbox" />
              <span className="checkmark">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3 8 3 3 7-7" />
                </svg>
              </span>
              Lembrar-me
            </label>
            <button className="forgot-password" type="button">
              Esqueci minha senha
            </button>
          </div>

          {error ? (
            <p role="alert" style={{ color: '#e5484d', fontSize: '13px', margin: '0 0 4px' }}>
              {error}
            </p>
          ) : null}

          <button className="submit-button" type="submit">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
            </svg>
            Entrar
          </button>

          <p className="security-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Seus dados estão protegidos com segurança.
          </p>
        </form>
      </section>
    </main>
  )
}
