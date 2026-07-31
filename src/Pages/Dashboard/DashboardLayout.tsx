import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun } from 'lucide-react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import logoImpactoSimbolo from '../../assets/logo-impacto-simbolo.svg'
import type { PageKey } from './pageConfig'
import { AppearanceIcon } from '../../components/icons/AppearanceIcon'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { AreaSelector } from '../../components/navigation/AreaSelector'
import { useAuth } from '../../contexts/useAuth'
import { usePreferences } from '../../contexts/usePreferences'
import {
  isSettingsPath,
  resolveSettingsReturnPath,
  settingsReturnState,
  SETTINGS_ENTRY_PATH,
} from '../../lib/settingsNavigation'
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
}

export function DashboardLayout({
  activePage,
  onLogout,
  children,
  title,
  subtitle,
  sidebar,
  showPageHeader = true,
}: DashboardLayoutProps) {
  const { sidebarOpen, toggleSidebar, theme, toggleTheme } = usePreferences()
  const {
    lastSettingsPath,
    hasOpenedSettingsFromSidebar,
    rememberSettingsPath,
    markSettingsOpenedFromSidebar,
  } = useAuth()
  const isDark = theme === 'dark'
  /** O switch de Aparência lê o tema claro como "luz ligada". */
  const isLight = !isDark
  const location = useLocation()
  const navigate = useNavigate()
  const inSettings = isSettingsPath(location.pathname)
  const hasSidebar = Boolean(sidebar)
  /**
   * Única medida das duas colunas: a faixa da marca, na barra superior, usa a
   * mesma largura da sidebar logo abaixo. É isso que mantém o botão de recolher
   * sempre colado ao limite lateral da sidebar, nos dois estados.
   */
  const sidebarWidthClass = sidebarOpen ? 'w-[220px]' : 'w-[56px]'
  const sidebarWidthTransition =
    'transition-[width] duration-[220ms] ease-in-out motion-reduce:transition-none'

  /** O botão alterna o contexto: entra nas configurações ou volta à página de origem. */
  function handleSettingsToggle() {
    if (inSettings) {
      // Desligar pela chavinha memoriza a aba para o próximo acesso pela sidebar.
      rememberSettingsPath(location.pathname)
      navigate(resolveSettingsReturnPath(location.state))
      return
    }

    // A primeira abertura da sessão sempre cai em Preferências.
    const target = hasOpenedSettingsFromSidebar ? lastSettingsPath : SETTINGS_ENTRY_PATH

    markSettingsOpenedFromSidebar()
    navigate(target, { state: settingsReturnState(location) })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <aside className="flex-none border-b border-[var(--border)] bg-[var(--surface)]">
        <div
          className={cn(
            'flex items-center gap-4 border-b border-[#263244] bg-[#182230] py-3 pr-[22px]',
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
            <Link
              aria-label="Ir para a Visão Geral Executiva"
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
              to="/dashboard/inicio"
            >
              {/* Logo completo enquanto há largura para ele; recolhida, a coluna
                  estreita recebe apenas o símbolo, no topo. O arquivo é usado
                  como está: as áreas brancas do símbolo só se sustentam sobre a
                  faixa escura fixa do topo, igual nos dois temas. */}
              {hasSidebar && !sidebarOpen ? (
                /* 32px dentro dos 56px da coluna deixam 12px de folga de cada
                   lado. O quadrado acompanha o viewBox quadrado do arquivo, que
                   segue intacto: muda só a dimensão externa. */
                <img
                  className="h-8 w-8 object-contain"
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
          {hasSidebar ? (
            <button
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Recolher sidebar' : 'Expandir sidebar'}
              className="-ml-2 flex h-8 w-9 flex-none cursor-pointer items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#182230]"
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
          <div className="flex flex-1 items-center justify-center">
            <AreaSelector />
          </div>
          <div className="flex flex-none items-center pr-1">
            <UserMenu onLogout={onLogout} />
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
            <div className="min-h-0 flex-1">{sidebar}</div>
            {/* Recolhida, a coluna fica como faixa vertical estreita: os
                controles do rodapé voltam junto com a largura, no bloco
                seguinte da navegação compacta. */}
            {sidebarOpen ? (
              <div className="flex flex-none flex-col gap-0.5 border-t border-[var(--border)] bg-[var(--surface)] px-2 pb-3 pt-2">
                <button
                  aria-checked={isLight}
                  aria-label={isDark ? 'Aparência - tema escuro ativo' : 'Aparência - tema claro ativo'}
                  className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[16px] font-normal text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={toggleTheme}
                  role="switch"
                  title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
                  type="button"
                >
                  {/* Símbolo fixo do controle: nomeia o assunto (claro contra
                      escuro) e não muda com o tema. Quem carrega o estado é a
                      chave, pela posição do botão e pelo ícone dentro dele. */}
                  <AppearanceIcon aria-hidden="true" className="flex-none" size={15} />
                  <span className="min-w-0 flex-1 truncate">Aparência</span>
                  <span
                    aria-hidden="true"
                    className="relative inline-flex h-5 w-9 flex-none items-center rounded-full bg-[var(--appearance-switch-active)] transition-colors duration-200 motion-reduce:transition-none"
                  >
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 items-center justify-center rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
                        // 36px de trilho menos 16px do botão deixam 20px de curso:
                        // 18px à direita e 2px à esquerda dão a mesma folga de 2px
                        // nos dois extremos.
                        isLight ? 'translate-x-[18px]' : 'translate-x-0.5',
                      )}
                    >
                      {/* Cor escura fixa: o botão é branco nos dois temas, então o
                          ícone não pode seguir os tokens de texto. */}
                      {isLight ? (
                        <Sun aria-hidden="true" className="text-[#344054]" size={10} />
                      ) : (
                        <Moon aria-hidden="true" className="text-[#344054]" size={10} />
                      )}
                    </span>
                  </span>
                </button>
                <button
                  aria-current={inSettings ? 'page' : undefined}
                  aria-pressed={inSettings}
                  className={cn(
                    'flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[16px] font-normal text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    inSettings &&
                      'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)]',
                  )}
                  onClick={handleSettingsToggle}
                  title={inSettings ? 'Fechar configurações' : 'Abrir configurações'}
                  type="button"
                >
                  <Settings aria-hidden="true" className="flex-none" size={16} />
                  <span className="min-w-0 flex-1 truncate">Configurações</span>
                  {/* Espelho visual de `inSettings`: o estado real vem de aria-pressed e da rota. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors duration-200 motion-reduce:transition-none',
                      inSettings ? 'bg-[var(--appearance-switch-active)]' : 'bg-[#d0d5dd]',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
                        inSettings ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </span>
                </button>
                <button
                  className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[16px] font-normal text-[var(--text-secondary)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={onLogout}
                  type="button"
                >
                  <LogOut aria-hidden="true" className="flex-none" size={16} />
                  <span className="min-w-0 flex-1 truncate">Sair</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {showPageHeader ? <AppHeader page={activePage} subtitle={subtitle} title={title} /> : null}
          {/* Nas configurações o respiro inferior fica simétrico ao superior: o
              painel branco já delimita o conteúdo e a folga extra encurtava a área útil. */}
          <main
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-[26px] pt-[22px]',
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
