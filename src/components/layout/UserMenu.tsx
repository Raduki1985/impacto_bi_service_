import { Bell, CircleHelp, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { AppearanceIcon } from '../icons/AppearanceIcon'
import { useAuth } from '../../contexts/useAuth'
import { usePreferences } from '../../contexts/usePreferences'
import { profileColorClasses } from '../../lib/profileColors'
import { SETTINGS_ENTRY_PATH, settingsReturnState } from '../../lib/settingsNavigation'
import { cn } from '../../lib/utils'

type UserMenuProps = {
  onLogout: () => void
}

/**
 * As três superfícies do canto direito do cabeçalho. Só uma fica aberta por vez,
 * e por isso elas são UM estado, e não três: com um booleano para cada, fechar a
 * anterior e abrir a nova viravam dois eventos, e era possível ficar com duas
 * camadas sobrepostas disputando o clique.
 */
type HeaderPanel = 'help' | 'notifications' | 'user'

/**
 * Superfície elevada compartilhada pelos três painéis: mesma borda, mesmo raio,
 * mesma sombra e os mesmos tokens de tema. Nenhum deles declara cor própria, e é
 * isso que os mantém iguais nos temas claro e escuro.
 *
 * Sempre em posição absoluta, ancorada abaixo do próprio botão: o painel não
 * ocupa espaço no fluxo, então abrir qualquer um deles não muda a altura do
 * cabeçalho nem desloca o conteúdo da página.
 */
const popoverSurfaceClass =
  'absolute right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[0_14px_34px_rgba(16,24,40,.16)]'

/** Botão de ícone do cabeçalho: mesma área de toque e o mesmo anel de foco. */
const headerIconButtonClass =
  'flex h-10 w-8 cursor-pointer items-center justify-center rounded-md bg-transparent text-[#e4e7ee] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-strip-bg)]'

export function UserMenu({ onLogout }: UserMenuProps) {
  const { user } = useAuth()
  const { theme, toggleTheme } = usePreferences()
  const location = useLocation()
  /**
   * Painel aberto, ou null.
   *
   * Estado só de exibição: não persiste, não conta nada e não busca dado nenhum.
   * Ajuda e Notificações deixaram de ser botões inertes e passaram a abrir a
   * superfície que comunica o estado atual de cada recurso.
   */
  const [panel, setPanel] = useState<HeaderPanel | null>(null)
  /**
   * Bloco inteiro dos três botões e dos painéis deles.
   *
   * O clique fora é decidido por este limite, e não por uma camada invisível
   * cobrindo a página. A camada era o motivo de trocar de painel exigir dois
   * cliques: ela interceptava o primeiro clique, que só fechava o que estava
   * aberto, e o botão de destino só recebia o segundo.
   */
  const containerRef = useRef<HTMLDivElement>(null)
  const helpTitleId = useId()
  const notificationsTitleId = useId()
  const isDark = theme === 'dark'
  /** O switch de Aparência lê o tema claro como "luz ligada". */
  const isLight = !isDark

  /**
   * Fechamento por Escape e por clique fora, montado apenas enquanto algum
   * painel está aberto.
   *
   * O clique é ouvido no `mousedown`, antes do `click` que aciona os botões: um
   * clique dentro do bloco não fecha nada aqui e segue para o botão, que decide
   * se abre outro painel ou fecha o atual. É assim que alternar entre os três
   * acontece em um clique só.
   */
  useEffect(() => {
    if (panel === null) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPanel(null)
    }

    function handlePointerDown(event: Event) {
      const { target } = event
      if (target instanceof Node && containerRef.current?.contains(target)) return

      setPanel(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [panel])

  /** Abre o painel pedido, fechando qualquer outro; no próprio painel, fecha. */
  function togglePanel(next: HeaderPanel) {
    setPanel((current) => (current === next ? null : next))
  }

  function handleLogout() {
    setPanel(null)
    onLogout()
  }

  if (!user) return null

  const menuItemClass =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[var(--text-item)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

  const menuItemTextClass = 'min-w-0 flex-1 text-[14px] font-normal leading-5'

  const menuItemIconClass = 'flex h-4 w-4 flex-none items-center justify-center'

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1">
        {/* Âncora própria de cada botão: o painel precisa nascer sob ELE, e não
            sob a borda direita do bloco inteiro, que é onde o menu do usuário
            abre. O invólucro só posiciona e não ocupa espaço além do botão, então
            o cabeçalho não se desloca ao abrir. */}
        <div className="relative translate-x-[7px]">
          <button
            aria-expanded={panel === 'help'}
            aria-haspopup="dialog"
            aria-label="Ajuda"
            className={headerIconButtonClass}
            onClick={() => togglePanel('help')}
            title="Ajuda"
            type="button"
          >
            <CircleHelp aria-hidden="true" size={21} />
          </button>
          {panel === 'help' ? (
            // Estado real do recurso: a Central de ajuda ainda não existe, e
            // inventar artigos, links ou canais de atendimento aqui ensinaria um
            // caminho que o portal não tem.
            <InfoPopover
              message="A Central de ajuda ainda não está disponível."
              title="Ajuda"
              titleId={helpTitleId}
            />
          ) : null}
        </div>
        <div className="relative">
          <button
            aria-expanded={panel === 'notifications'}
            aria-haspopup="dialog"
            aria-label="Notificações"
            className={headerIconButtonClass}
            onClick={() => togglePanel('notifications')}
            title="Notificações"
            type="button"
          >
            <Bell aria-hidden="true" size={21} />
          </button>
          {panel === 'notifications' ? (
            // Estado vazio real: o portal ainda não produz notificação nenhuma.
            // Sem contador e sem ponto, pelo mesmo motivo.
            <InfoPopover
              message="Nenhuma notificação no momento."
              title="Notificações"
              titleId={notificationsTitleId}
            />
          ) : null}
        </div>
        {/* Botão transparente: fundo, borda e hover recolorem o avatar conforme o tema. */}
        <button
          aria-expanded={panel === 'user'}
          aria-haspopup="menu"
          aria-label="Abrir menu do usuário"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-transparent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--brand-strip-bg)]"
          onClick={() => togglePanel('user')}
          type="button"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${profileColorClasses[user.profile]}`}
          >
            {user.initials}
          </span>
        </button>
      </div>
      {panel === 'user' ? (
        <div className={`${popoverSurfaceClass} w-[242px]`} role="menu">
          <div className="px-3 py-2.5">
            <div className="text-[13px] font-semibold text-[var(--text-heading)]">{user.name}</div>
            <div className="text-[11.5px] text-[#98a2b3]">{user.email}</div>
          </div>
          <div className="my-1 h-px bg-[var(--divider)]" />
          {/* Única entrada das Configurações, e ela abre em Meu perfil. O
              `settingsReturnState` registra a página de origem; estando já
              dentro das Configurações, ele repassa a origem antiga em vez de
              trocá-la por uma rota do próprio contexto, o que evita retorno
              circular. As abas internas seguem filtradas por permissão na
              própria rota. */}
          <Link
            className={menuItemClass}
            onClick={() => setPanel(null)}
            role="menuitem"
            state={settingsReturnState(location)}
            to={SETTINGS_ENTRY_PATH}
          >
            <span aria-hidden="true" className={menuItemIconClass}>
              <Settings size={16} />
            </span>
            <span className={menuItemTextClass}>Configurações</span>
          </Link>
          {/* Opção marcada do menu: `menuitemcheckbox` com aria-checked, e não
              `switch`, que não é papel válido dentro de role="menu". Não fecha
              o menu de propósito, para dar para comparar os dois temas na hora
              da escolha. O estado vive só no PreferencesContext. */}
          <button
            aria-checked={isLight}
            aria-label={isDark ? 'Aparência - tema escuro ativo' : 'Aparência - tema claro ativo'}
            className={menuItemClass}
            onClick={toggleTheme}
            role="menuitemcheckbox"
            title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            type="button"
          >
            {/* Símbolo fixo do controle: nomeia o assunto (claro contra
                escuro) e não muda com o tema. Quem carrega o estado é a
                chave, pela posição do botão e pelo ícone dentro dele. */}
            <span aria-hidden="true" className={menuItemIconClass}>
              <AppearanceIcon size={16} />
            </span>
            <span className={menuItemTextClass}>Aparência</span>
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
          <div className="my-1 h-px bg-[var(--divider)]" />
          <button className={menuItemClass} onClick={handleLogout} role="menuitem" type="button">
            <span aria-hidden="true" className={menuItemIconClass}>
              <LogOut size={16} />
            </span>
            <span className={menuItemTextClass}>Sair</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Painel informativo de Ajuda e de Notificações.
 *
 * Um componente só para os dois: eles dizem coisas diferentes, mas são a MESMA
 * superfície, com o mesmo título, o mesmo filete e a mesma linha de texto. Com
 * duas cópias, qualquer ajuste de espaçamento ou de cor precisaria ser feito nos
 * dois lugares para os painéis continuarem idênticos.
 */
function InfoPopover({
  message,
  title,
  titleId,
}: {
  message: ReactNode
  title: string
  titleId: string
}) {
  return (
    <div aria-labelledby={titleId} className={`${popoverSurfaceClass} w-[268px]`} role="dialog">
      <div
        className="px-3 pb-1 pt-2 text-[13px] font-semibold text-[var(--text-heading)]"
        id={titleId}
      >
        {title}
      </div>
      <div className="my-1 h-px bg-[var(--divider)]" />
      <p className="px-3 pb-2 pt-1.5 text-[12.5px] leading-5 text-[#98a2b3]">{message}</p>
    </div>
  )
}
