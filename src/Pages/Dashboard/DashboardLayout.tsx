import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import logoImpactoHeader from '../../assets/logo-01.svg'
import logoImpactoSimbolo from '../../assets/logo-impacto-simbolo.svg'
import type { PageKey } from './pageConfig'
import { AppHeader } from '../../components/layout/AppHeader'
import { UserMenu } from '../../components/layout/UserMenu'
import { getActiveNavigationContext } from '../../config/biAreas'
import { usePreferences } from '../../contexts/usePreferences'
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
}

/**
 * Rótulo do contexto da rota atual para a barra superior, só de leitura:
 * departamento, contexto executivo ou Configurações do Portal. A fonte é a mesma
 * função que já resolve o contexto no repositório, sem segundo mapeamento de
 * departamentos.
 *
 * Única adaptação: no header o contexto executivo aparece como "Página
 * Inicial", porque ali ele identifica onde o usuário está e não repete o título
 * da página. O nome canônico "Visão Geral Executiva" continua no h1 do conteúdo
 * e no cadastro de contextos. A troca usa o id estável, nunca a comparação do
 * texto.
 *
 * Rota sem contexto reconhecido devolve null e não recebe título: o elemento
 * simplesmente não existe.
 */
function headerContextLabel(pathname: string): string | null {
  const context = getActiveNavigationContext(pathname)
  if (!context) return null

  return context.id === 'corporate' ? 'Página Inicial' : context.label
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
  const { sidebarOpen, toggleSidebar } = usePreferences()
  const location = useLocation()
  const inSettings = isSettingsPath(location.pathname)
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
          {/* Coluna da área útil: começa exatamente no limite da sidebar, porque
              o -ml-4 anula o gap da faixa, e termina no respiro direito. É ela
              que define o centro do título, e não a tela inteira: como a largura
              vem da faixa da marca, o centro acompanha sozinho os 220px e os
              56px, inclusive durante a transição. */}
          <div className="relative -ml-4 flex flex-1 items-center">
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
            {/* Texto puro, sem clique, sem seta e sem dropdown: identifica o
                contexto, não navega. O nome da página fica no h1 do cabeçalho da
                página, então aqui entra apenas o contexto.

                Fora do fluxo e com recuos laterais iguais: é o que mantém o
                texto no centro real da coluna. Em fluxo, o centro seria puxado
                para a esquerda pela diferença entre os 36px do botão e os 116px
                dos controles da direita. Os 120px de recuo cobrem esses 116px,
                então o título nunca alcança nenhum dos lados, e por estar fora
                do fluxo ele não participa da altura da faixa.

                A cor vem do token que já era o padrão deste rótulo sobre a faixa
                escura: branco no tema claro e o verde institucional #00d776 no
                tema escuro. O nome do token ainda cita o seletor removido, mas o
                par de valores é o do rótulo do header.

                Peso e espaçamento acompanham o h1 do cabeçalho da página
                (font-bold, tracking-normal): a família já era a mesma, vinda do
                :root, então o peso era a única diferença de traço entre os dois
                títulos. Só o tamanho continua distinto, 22px aqui contra 19px
                no h1. */}
            {contextLabel ? (
              <p className="absolute inset-x-[120px] top-1/2 -translate-y-1/2 truncate text-center text-[22px] font-bold tracking-normal text-[var(--area-selector-control-label)]">
                {contextLabel}
              </p>
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
