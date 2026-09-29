import logoImpacto from '../../assets/logo-horizontal-branco-verde.svg'
import fundoAzul from '../../assets/Fundo Azul.png'
import {useApiVersion} from '../../components/layout/useApiVersion'
import {APP_VERSION_LABEL} from '../../lib/appVersion'

/**
 * Painel institucional das telas de autenticação, à esquerda da faixa azul.
 *
 * Saiu de dentro do `Login` para poder ser reaproveitado pelas telas de
 * recuperação e de definição de senha, que são do mesmo fluxo e precisam do
 * mesmo enquadramento. A marcação e as classes vieram inteiras de lá: o HTML
 * renderizado é o mesmo de antes, e o `Login.css` continua sendo o único dono
 * do visual.
 *
 * O CSS não é importado aqui de propósito. Ele é escopado sob `.login-page`, que
 * é a raiz de cada tela, e quem monta a raiz é quem importa o arquivo.
 */
export function BrandPanel() {
    const apiVersion = useApiVersion()

    return (
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

            <footer>
                © 2026 Impacto Telecom | Business Intelligence
                <span className="brand-version">
                    {APP_VERSION_LABEL}
                    {apiVersion === null ? null : ` (${apiVersion})`}
                </span>
            </footer>
        </section>
    )
}
