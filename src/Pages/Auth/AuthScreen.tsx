import type { ReactNode } from 'react'

import { BrandPanel } from '../Login/BrandPanel'
import '../Login/Login.css'
import './Auth.css'

/**
 * Enquadramento comum das telas de senha, igual ao do login.
 *
 * Mesma faixa azul à esquerda, mesmo painel branco à direita, mesmas classes: as
 * telas de recuperação e de definição de senha fazem parte do mesmo momento do
 * portal, e trocar de enquadramento entre elas pareceria outro sistema.
 *
 * `login-page` é a raiz que o `Login.css` espera, e vem primeiro. `auth-page` é
 * a raiz do que existe só aqui, e por onde o `Auth.css` é escopado: nenhuma
 * regra nova alcança a tela de login, que continua exatamente como estava.
 *
 * O conteúdo entra direto no painel branco, sem nenhuma camada no meio. É quem
 * chama que monta o `.login-form` com o título e os campos dentro, porque o
 * `Login.css` estiliza `h2` e `label` como FILHOS DIRETOS dele: um `<div>` a
 * mais aqui quebraria os dois de uma vez.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
    return (
        <main className="login-page auth-page">
            <BrandPanel/>

            <section className="form-panel">{children}</section>
        </main>
    )
}

/** Cadeado do rodapé, o mesmo do login. */
export function AuthSecurityNote({ children }: { children: ReactNode }) {
    return (
        <p className="security-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
            </svg>
            {children}
        </p>
    )
}

/** Seta de entrada do botão verde, a mesma do "Entrar" do login. */
export function AuthEnterIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>
        </svg>
    )
}
