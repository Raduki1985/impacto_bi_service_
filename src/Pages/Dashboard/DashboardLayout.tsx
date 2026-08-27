import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import logoImpactoSimbolo from '../../assets/logo-impacto-simbolo.svg'
import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { getActiveNavigationContext } from '../../config/biAreas'
import { useAuth } from '../../contexts/useAuth'
import { usePreferences } from '../../contexts/usePreferences'
import { resolveHomePath } from '../../lib/homeNavigation'
import { isSettingsPath } from '../../lib/settingsNavigation'
import { cn } from '../../lib/utils'

type DashboardLayoutProps = {
  /** null identifica uma seção externa às páginas de OS (ex.: um departamento) — usa title/subtitle no lugar do lookup por página. */
  activePage: PageKey | null
  onPageChange: (page: PageKey) => void
  onLogout: () => void
  children: ReactNode
  title?: string
  subtitle?: string
  sidebar?: ReactNode
  showPageHeader?: boolean
  /**
   * Data de atualização da base daquela página, repassada ao cabeçalho. Sem
   * valor, o cabeçalho mantém a data padrão que já exibia.
   */
  updatedAt?: string
}

/**
 * Rótulo do contexto da rota atual para a barra superior, só de leitura:
 * departamento, contexto executivo ou Configurações do Portal. A fonte é a mesma
 * função que já resolve o contexto no repositório, sem segundo mapeamento de
 * departamentos.
 *
 * Rota sem contexto reconhecido devolve null e não recebe título: o elemento
 * simplesmente não existe.
 */
function headerContextLabel(pathname: string): string | null {
  const context = getActiveNavigationContext(pathname)
  if (!context) return null

  return context.label
}

export function DashboardLayout({
  activePage,
  onLogout,
  children,
  title,
  subtitle,
  sidebar,
  showPageHeader = true,
  updatedAt,
}: DashboardLayoutProps) {
  const { homeDepartmentIdFor, sidebarOpen, toggleSidebar } = usePreferences()
  const { user } = useAuth()
  const location = useLocation()
  const inSettings = isSettingsPath(location.pathname)
  /**
   * Destino da marca: a Página Inicial de quem está logado, e não uma rota fixa.
   * Administrador e Executivo continuam indo para a Visão Geral Executiva; o
   * Analista vai para a Visão Geral do departamento inicial dele.
   */
  const homePath = resolveHomePath(user, user ? homeDepartmentIdFor(user.id) : null)
  const hasSidebar = Boolean(sidebar)
  const contextLabel = headerContextLabel(location.pathname)
  /**
   * Única medida das duas colunas: a faixa da marca, na barra superior, usa a
   * mesma largura da sidebar logo abaixo. É isso que mantém o botão de recolher
   * sempre colado ao limite lateral da sidebar, nos dois estados.
   */
  const sidebarWidthClass = sidebarOpen ? 'w-[220px]' : 'w-[56px]'
  const sidebarWidthTransition =
    'transition-[width] duration-[220ms] ease-in-out motion-reduce:transition-none'

  return (
    /*
     * O shell fica preso ao viewport com `fixed inset-0`, e não apenas com
     * `h-screen`.
     *
     * Com `h-screen` o shell continuava no fluxo do documento, então qualquer
     * conteúdo que escapasse dele somava altura em `body` e o documento passava
     * a rolar junto com o `main`: duas barras verticais ao mesmo tempo. Fora do
     * fluxo, o `#root` não tem mais altura própria e o `scrollHeight` do
     * documento deixa de depender do conteúdo do dashboard.
     *
     * A trava vale só para este layout: Login e demais páginas fora do
     * `DashboardLayout` continuam rolando normalmente, porque nenhuma regra
     * global foi aplicada a `html`, `body` ou `#root`.
     */
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      {/* A barra superior abre o próprio nível de empilhamento (`relative
          z-40`), acima de tudo o que a página desenha abaixo dela.

          Sem ele, o menu do usuário disputava o mesmo nível 10 do conteúdo:
          o cabeçalho fixo das tabelas com rolagem (`DataTable` com
          `scrollY`) e a aba ativa das Configurações também usam `z-10`, e por
          virem depois no DOM cobriam a parte de baixo do menu aberto, que é
          onde ficam Aparência e Sair. Com o contexto próprio aqui, o `z-50`
          dos painéis do `UserMenu` passa a valer dentro da barra, e nenhuma
          página precisa conhecer o valor usado pelas outras. */}
      <aside className="relative z-40 flex-none border-b border-[var(--border)] bg-[var(--surface)]">
        <div
          className={cn(
            'relative flex items-center gap-4 border-b border-[#263244] bg-[#182230] py-3 pr-[22px]',
            // Com sidebar, a faixa da marca encosta na borda esquerda para
            // ocupar exatamente a coluna da sidebar. Sem sidebar, o respiro
            // original do cabeçalho continua valendo.
            hasSidebar ? 'pl-0' : 'pl-[22px]',
          )}
        >
          <div
            className={cn(
              // A altura da faixa é fixa e igual à do logo completo (44px), que
              // é o elemento mais alto da linha. Sem ela, o símbolo de 36px
              // deixava o topo 4px mais baixo ao recolher, porque a altura da
              // linha vinha do maior filho. Só a largura muda entre os estados.
              'flex h-11 flex-none items-center',
              hasSidebar && cn('justify-center', sidebarWidthClass, sidebarWidthTransition),
            )}
          >
            {/* Nome acessível neutro: o destino depende do perfil, e afirmar
                "Visão Geral Executiva" seria falso para o Analista, que nem a
                acessa. */}
            <Link
              aria-label="Ir para a Página Inicial"
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
              to={homePath}
            >
              {/* Logo completo enquanto há largura para ele; recolhida, a coluna
                  estreita recebe apenas o símbolo, no topo. O arquivo é usado
                  como está: as áreas brancas do símbolo só se sustentam sobre a
                  faixa escura fixa do topo, igual nos dois temas. */}
              {hasSidebar && !sidebarOpen ? (
                /* 41,4px é o tamanho externo que faz o símbolo recolhido APARECER
                   do mesmo tamanho do símbolo que existe dentro do logo
                   completo, e não um valor escolhido a olho. Os dois arquivos têm
                   folga interna diferente, então igualar a altura externa (44px
                   nos dois) deixaria o recolhido visivelmente maior.

                   A conta, sobre os viewBox intactos dos dois arquivos: no
                   `logo-01.svg` (1067,19 x 334) o símbolo ocupa 295,1 de altura,
                   que a 44px de altura total viram 38,88px; no
                   `logo-impacto-simbolo.svg` (818,51 quadrado) o desenho ocupa
                   768,19 dos 818,51, ou seja 93,85% da caixa, então 38,88 / 0,9385
                   pede 41,4px de caixa externa.

                   Quadrado, porque o viewBox do símbolo é quadrado: nada é
                   distorcido. Dentro dos 56px da coluna sobram 7,3px de folga de
                   cada lado, e a altura da faixa continua sendo os 44px fixos do
                   contêiner, então o cabeçalho não muda de geometria em nenhum dos
                   dois estados. */
                <img
                  className="h-[41.4px] w-[41.4px] object-contain"
                  src={logoImpactoSimbolo}
                  alt="Impacto Telecom"
                />
              ) : (
                <img
                  className="h-11 w-auto max-w-[236px] object-contain"
                  src={logoImpactoHeader}
                  alt="Impacto Telecom"
                />
              )}
            </Link>
          </div>
          {/* Contexto centralizado pela largura total da tela, e não pela coluna
              útil que sobra depois da marca e da sidebar. `left-1/2` parte do
              próprio header, então abrir ou recolher a sidebar não desloca o
              centro. Os limites responsivos preservam espaço para a marca e o
              menu sem transformar o texto em uma segunda linha. */}
          {contextLabel ? (
            <p className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden w-full max-w-[calc(100%-320px)] -translate-x-1/2 -translate-y-1/2 truncate px-2 text-center text-[22px] font-bold tracking-normal text-[var(--area-selector-control-label)] sm:block lg:max-w-[calc(100%-520px)]">
              {contextLabel}
            </p>
          ) : null}
          <div className="relative z-10 -ml-4 flex flex-1 items-center">
            {hasSidebar ? (
              <button
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Recolher sidebar' : 'Expandir sidebar'}
                // ml-2 dentro da coluna deixa o botão no mesmo x de antes, quando
                // o -ml-2 partia da posição criada pelo gap da faixa.
                className="ml-2 flex h-8 w-9 flex-none cursor-pointer items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
                onClick={toggleSidebar}
                title={sidebarOpen ? 'Recolher sidebar' : 'Expandir sidebar'}
                type="button"
              >
                {/* Painel com divisão vertical à esquerda e seta indicando a ação:
                    para a esquerda recolhe, para a direita expande. São os dois
                    ícones de painel lateral da própria lucide, mesmo traço dos
                    demais ícones do portal. */}
                {sidebarOpen ? (
                  <PanelLeftClose aria-hidden="true" size={20} />
                ) : (
                  <PanelLeftOpen aria-hidden="true" size={20} />
                )}
              </button>
            ) : null}
            <div className="ml-auto flex flex-none items-center pr-1">
              <UserMenu onLogout={onLogout} />
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-h-0 flex-1">
        {sidebar ? (
          <div
            className={cn(
              'flex flex-none flex-col overflow-hidden',
              sidebarWidthClass,
              sidebarWidthTransition,
            )}
          >
            {/* A coluna termina nos itens de navegação: Aparência,
                Configurações e Sair passaram para o menu do usuário, que fica
                visível nos dois estados da sidebar. */}
            <div className="min-h-0 flex-1">{sidebar}</div>
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showPageHeader ? (
            <AppHeader
              page={activePage}
              subtitle={subtitle}
              title={title}
              updatedAt={updatedAt}
            />
          ) : null}
          {/* Nas configurações o respiro inferior fica simétrico ao superior: o
              painel branco já delimita o conteúdo e a folga extra encurtava a área útil. */}
          {/* Única rolagem do dashboard. O eixo X é explicitamente travado para
              que nenhum painel largo crie uma barra horizontal no portal. */}
          <main
            className={cn(
              'min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[26px] pt-[22px]',
              inSettings ? 'pb-[22px]' : 'pb-10',
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
