import { Fragment, useCallback, useState } from 'react'
import { Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { usePreferences } from '../../contexts/usePreferences'
import { cn } from '../../lib/utils'

export type AreaSidebarItem = {
  key: string
  label: string
  icon?: LucideIcon
  disabled?: boolean
  sectionLabel?: string
  /**
   * Tooltip do item habilitado, para ler o nome inteiro quando o rótulo trunca
   * na largura da sidebar. Sem ele, o item habilitado continua sem tooltip.
   */
  title?: string
}

type AreaSidebarProps = {
  areaLabel: string
  items: AreaSidebarItem[]
  activeKey: string | null
  onItemSelect: (key: string) => void
  /**
   * Opcional: quando informado, o título da sidebar ganha uma seta compacta de
   * retorno à sua esquerda. Sem ele, apenas o título é renderizado, exatamente
   * como nos demais contextos.
   */
  onDashboardsSelect?: () => void
  /**
   * Departamento selecionado. Só a barra estreita usa esse par, para identificar
   * de que departamento são as páginas listadas — no modo expandido o nome
   * continua vindo do cabeçalho e do conteúdo central.
   */
  contextIcon?: LucideIcon
  contextLabel?: string
}

/**
 * Base visual compartilhada pelos itens e pelo controle superior.
 *
 * Cor, fundo, borda e divisória vêm dos tokens `--sidebar-*`, e não dos tokens
 * gerais de superfície e texto: no tema claro a coluna é escura (Azul Primário
 * da marca) enquanto o resto da página segue claro, então ela precisa da
 * própria escala. No tema escuro os tokens apontam de volta para os gerais, e
 * nada muda.
 */
const sidebarButtonClasses =
  'flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-[var(--sidebar-text)] transition hover:bg-[var(--sidebar-hover-bg)]'

/**
 * Item da barra estreita, centralizado nos 56px da coluna com 8px de folga de
 * cada lado. A largura é fluida com teto de 40px, e não fixa em 40px: a coluna
 * tem 56px, mas a borda direita do <aside> consome 1px e o padding consome 16px,
 * então sobram 39px úteis. Fixar 40px estourava esse limite por 1px e abria uma
 * barra de rolagem horizontal. Com `w-full` o item nunca excede o espaço real,
 * inclusive quando a rolagem vertical aparece e estreita a faixa.
 */
const compactButtonClasses =
  'flex h-10 w-full max-w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--sidebar-text)] transition hover:bg-[var(--sidebar-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)]'

/** Tamanho único dos ícones da barra estreita, alinhado ao dos itens expandidos. */
const COMPACT_ICON_SIZE = 18

/** Folga entre a borda direita do item e o balão. */
const TOOLTIP_GAP = 10

/** Balão ancorado em coordenadas de viewport: `fixed` escapa do overflow da nav. */
type TooltipState = {
  label: string
  top: number
  left: number
}

export function AreaSidebar({
  areaLabel,
  items,
  activeKey,
  contextIcon: ContextIcon,
  contextLabel,
  onDashboardsSelect,
  onItemSelect,
}: AreaSidebarProps) {
  /**
   * Estado compacto: mesma preferência já compartilhada pelo shell, lida aqui
   * para não atravessar o `sidebar: ReactNode` do layout com uma prop nova.
   */
  const { sidebarOpen } = usePreferences()
  const collapsed = !sidebarOpen

  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  /**
   * A posição vem do retângulo do próprio item, medido na hora de abrir. Como o
   * balão é `fixed`, ele não é recortado pela rolagem da nav nem pelo
   * `overflow-hidden` da coluna, e não empurra nenhum item de lugar.
   */
  const showTooltip = useCallback((element: HTMLElement, label: string) => {
    const rect = element.getBoundingClientRect()

    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + TOOLTIP_GAP,
    })
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  /**
   * Um balão só, compartilhado pelos dois modos: mesmo estado e mesmas funções,
   * sem uma segunda implementação concorrente. Decorativo, porque o nome já é o
   * nome acessível do próprio item.
   */
  const tooltipNode = tooltip ? (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-item)] shadow-lg"
      style={{ top: tooltip.top, left: tooltip.left }}
    >
      {tooltip.label}
    </div>
  ) : null

  if (collapsed) {
    /** Só há bloco de contexto quando existe retorno ou identificação a mostrar. */
    const hasContextBlock = Boolean(onDashboardsSelect) || Boolean(ContextIcon && contextLabel)

    return (
      <aside className="flex h-full min-h-0 w-full flex-none flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
        <nav
          aria-label={contextLabel ?? areaLabel}
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-3"
        >
          {onDashboardsSelect ? (
            <button
              aria-label="Voltar aos departamentos"
              className={compactButtonClasses}
              onBlur={hideTooltip}
              onClick={() => {
                hideTooltip()
                onDashboardsSelect()
              }}
              onFocus={(event) => showTooltip(event.currentTarget, 'Voltar aos departamentos')}
              onMouseEnter={(event) => showTooltip(event.currentTarget, 'Voltar aos departamentos')}
              onMouseLeave={hideTooltip}
              type="button"
            >
              <Undo2 aria-hidden="true" size={COMPACT_ICON_SIZE} />
            </button>
          ) : null}
          {ContextIcon && contextLabel ? (
            /* Identificação, não navegação: sem foco, sem clique e com moldura
               própria, para não ser lido como a página ativa da lista. */
            <div
              className="flex h-10 w-full max-w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--sidebar-border)] text-[var(--sidebar-text)]"
              onMouseEnter={(event) => showTooltip(event.currentTarget, contextLabel)}
              onMouseLeave={hideTooltip}
            >
              <ContextIcon aria-hidden="true" size={COMPACT_ICON_SIZE} />
              <span className="sr-only">{contextLabel}</span>
            </div>
          ) : null}
          {hasContextBlock ? (
            <span aria-hidden="true" className="my-1 h-px w-6 shrink-0 bg-[var(--sidebar-divider)]" />
          ) : null}
          {items.map((item) => {
            const Icon = item.icon
            const active = activeKey === item.key
            const label = item.disabled ? `${item.label} - Em desenvolvimento` : item.label

            return (
              <Fragment key={item.key}>
                {item.sectionLabel ? (
                  <span aria-hidden="true" className="my-1 h-px w-6 shrink-0 bg-[var(--sidebar-divider)]" />
                ) : null}
                {/* A página em desenvolvimento é marcada por `aria-disabled`, e
                    não pelo `disabled` nativo: o nativo tira o botão do fluxo do
                    Tab e ainda suprime os eventos de mouse, então o item ficaria
                    sem foco e sem balão justamente onde o aviso importa. Quem
                    bloqueia de fato é a guarda do onClick, por onde passam o
                    clique e as ativações por Enter e Espaço. */}
                <button
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={item.disabled || undefined}
                  aria-label={label}
                  className={cn(
                    compactButtonClasses,
                    active && 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]',
                    item.disabled && 'cursor-not-allowed text-[var(--sidebar-disabled)] hover:bg-transparent',
                  )}
                  onBlur={hideTooltip}
                  onClick={() => {
                    if (item.disabled) return
                    hideTooltip()
                    onItemSelect(item.key)
                  }}
                  onFocus={(event) => showTooltip(event.currentTarget, label)}
                  onMouseEnter={(event) => showTooltip(event.currentTarget, label)}
                  onMouseLeave={hideTooltip}
                  type="button"
                >
                  {Icon ? <Icon aria-hidden="true" size={COMPACT_ICON_SIZE} /> : null}
                </button>
              </Fragment>
            )
          })}
        </nav>
        {tooltipNode}
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 w-[220px] flex-none flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
      {/* Quando há retorno, a seta e o rótulo formam UM botão só: clicar na
          palavra também volta, e a área clicável deixa de ser um alvo de 24px.
          O recuo lateral acompanha o da lista abaixo, então a seta cai na mesma
          coluna dos ícones das páginas e o rótulo na mesma coluna dos nomes.
          Sem retorno, o topo continua sendo texto puro, no recuo original. */}
      <div className={cn('pb-2 pt-3.5', onDashboardsSelect ? 'px-2' : 'px-3.5')}>
        {onDashboardsSelect ? (
          <button
            aria-label="Voltar para a lista de dashboards"
            className="flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1 text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--sidebar-title)] transition hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)]"
            onClick={onDashboardsSelect}
            title="Voltar para a lista de dashboards"
            type="button"
          >
            {/* O desenho da seta não ocupa a caixa inteira do ícone: sobra folga
                embaixo, e centralizado pela caixa ele aparece um fio abaixo da
                linha das maiúsculas. O 1px de subida corrige o que se vê, e
                `relative` mantém a altura da linha intacta. */}
            <Undo2 aria-hidden="true" className="relative -top-px flex-none" size={16} />
            <span className="min-w-0 truncate">{areaLabel}</span>
          </button>
        ) : (
          <span className="block truncate text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--sidebar-title)]">
            {areaLabel}
          </span>
        )}
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeKey === item.key
          /**
           * Só a página em desenvolvimento usa o balão aqui: o rótulo das demais
           * já está visível em texto, então um balão repetindo o nome seria ruído.
           */
          const developmentLabel = item.disabled ? `${item.label} - Em desenvolvimento` : null

          return (
            <Fragment key={item.key}>
              {item.sectionLabel ? (
                <div className="shrink-0 px-2.5 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--sidebar-section)]">
                  {item.sectionLabel}
                </div>
              ) : null}
              {/* Mesma escolha do modo compacto: `aria-disabled` no lugar do
                  `disabled` nativo, que tiraria o item do fluxo do Tab e deixaria
                  o aviso inalcançável por teclado. O bloqueio real é a guarda do
                  onClick, por onde passam clique, Enter e Espaço. */}
              <button
                aria-current={active ? 'page' : undefined}
                aria-disabled={item.disabled || undefined}
                aria-label={developmentLabel ?? undefined}
                className={cn(
                  sidebarButtonClasses,
                  active && 'bg-[var(--sidebar-active-bg)] font-semibold text-[var(--sidebar-active-text)]',
                  item.disabled && 'cursor-not-allowed text-[var(--sidebar-disabled)] hover:bg-transparent',
                )}
                onBlur={developmentLabel ? hideTooltip : undefined}
                onClick={() => {
                  if (item.disabled) return
                  onItemSelect(item.key)
                }}
                onFocus={
                  developmentLabel
                    ? (event) => showTooltip(event.currentTarget, developmentLabel)
                    : undefined
                }
                onMouseEnter={
                  developmentLabel
                    ? (event) => showTooltip(event.currentTarget, developmentLabel)
                    : undefined
                }
                onMouseLeave={developmentLabel ? hideTooltip : undefined}
                title={item.disabled ? undefined : item.title}
                type="button"
              >
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            </Fragment>
          )
        })}
      </nav>
      {tooltipNode}
    </aside>
  )
}
