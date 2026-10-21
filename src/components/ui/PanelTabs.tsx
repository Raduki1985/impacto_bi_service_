import type { ReactNode } from 'react'

import { formatNumber } from '../../lib/formatters'
import { cn } from '../../lib/utils'

/**
 * Abas do portal (21/10/2026, pedido do Mário na janela da Agenda e
 * capacidade): duas ou mais partes da mesma tela que não cabem juntas, uma de
 * cada vez, com a tela inteira para a escolhida. O desenho parte das abas das
 * Configurações: uma faixa levemente tingida e a aba ativa com a superfície do
 * conteúdo, emendada nele, que é o que liga a aba ao que ela mostra. A aba
 * desmarcada também tem forma de aba, com borda e fundo um pouco mais escuro
 * que a faixa, apoiada na linha de baixo (Mário, 21/10/2026: só o texto
 * parecia solto, e não uma aba).
 *
 * Peça própria do portal, sem depender das abas das Configurações nem das do
 * Perfil de Acesso, que usam cores só daquela área: aqui tudo sai dos tokens
 * globais, e serve em qualquer página e dentro da janela de lista. No escuro
 * o acento da aba ativa passa ao Verde Detalhes, pelo gancho `.impacto-tabs`
 * em `styles.css`, como os chips e as ações de texto.
 *
 * Papéis de abas do ARIA (lista de abas, aba e conteúdo ligados entre si),
 * sem as setas, Home e End do padrão completo, como as abas das
 * Configurações: cada aba é um botão real na ordem de tabulação, então Tab e
 * Enter já percorrem e acionam tudo. O conteúdo recebe o foco pelo Tab, para
 * quem usa só o teclado conseguir rolar uma aba que não tem nada clicável. A
 * contagem, quando vem, fica ao lado do nome, como nos atalhos da janela de
 * lista.
 */

export type PanelTab<Id extends string> = {
  readonly id: Id
  readonly label: string
  /** Quantos itens a aba mostra; sem valor, a aba não leva número. */
  readonly count?: number
}

/** O identificador do conteúdo de uma aba, para a aba apontar para ele. */
function panelId(baseId: string, tabId: string): string {
  return `${baseId}-${tabId}-painel`
}

function tabId(baseId: string, id: string): string {
  return `${baseId}-${id}-aba`
}

export function PanelTabs<Id extends string>({
  activeId,
  ariaLabel,
  baseId,
  className,
  onChange,
  tabs,
}: {
  activeId: Id
  /** Nome do grupo de abas para o leitor de tela. */
  ariaLabel: string
  /** Prefixo único dos identificadores (`useId`), o mesmo passado a `PanelTabPanel`. */
  baseId: string
  className?: string
  onChange: (id: Id) => void
  tabs: readonly PanelTab<Id>[]
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        'impacto-tabs flex flex-none flex-wrap gap-1 border-b border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--text-secondary)_5%,var(--surface))] px-5 pt-1.5',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId

        return (
          <button
            aria-controls={panelId(baseId, tab.id)}
            aria-selected={active}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              active
                ? 'relative -mb-px border border-[var(--divider)] border-b-[var(--surface)] bg-[var(--surface)] font-semibold text-[var(--accent)]'
                : 'border border-b-0 border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--text-secondary)_11%,var(--surface))] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--text-secondary)_17%,var(--surface))] hover:text-[var(--text-heading)]',
            )}
            id={tabId(baseId, tab.id)}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
            {tab.count === undefined ? null : <span className="font-mono">{formatNumber(tab.count)}</span>}
          </button>
        )
      })}
    </div>
  )
}

/**
 * O conteúdo de uma aba. A aba que não está escolhida fica montada e
 * escondida (`hidden`), e não desmontada: o que a pessoa fez nela, como o
 * filtro de coluna de uma lista, continua lá quando ela volta.
 */
export function PanelTabPanel({
  active,
  baseId,
  children,
  className,
  tabId: id,
}: {
  active: boolean
  baseId: string
  children: ReactNode
  className?: string
  tabId: string
}) {
  return (
    <div
      aria-labelledby={tabId(baseId, id)}
      className={cn(
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]',
        className,
      )}
      hidden={!active}
      id={panelId(baseId, id)}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  )
}
