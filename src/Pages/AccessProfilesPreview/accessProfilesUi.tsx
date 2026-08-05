import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'

/**
 * Peças visuais compartilhadas pela tela Perfis de acesso.
 *
 * Existem para a página e os dois drawers terem o mesmo traço sem duplicar
 * classe: abas, acordeão de departamento, selo de página e caixa de seleção
 * aparecem em mais de um lugar, e uma divergência entre eles seria percebida na
 * hora.
 *
 * Todas as cores são literais e claras, como nas demais abas das Configurações,
 * porque o painel e os drawers do portal são brancos fixos nos dois temas.
 */

export const chipClass =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold'
export const sectionTitleClass =
  'text-[11.5px] font-semibold uppercase tracking-wide text-[#667085]'
export const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-semibold text-[#344054]'
export const fieldClass =
  'w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2.5 text-[13px] text-[#172033] placeholder:text-[#98a2b3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

/** Números alinhados apenas onde há contagem, e não no texto corrido. */
export const countClass = 'tabular-nums'

/* -------------------------------------------------------------------------- */
/* Abas                                                                       */
/* -------------------------------------------------------------------------- */

export type DrawerTab = {
  id: string
  label: string
}

/**
 * Abas do drawer, com a semântica de tablist do ARIA.
 *
 * Setas, Home e End não são implementadas à mão: cada aba é um botão real na
 * ordem de tabulação, então Tab e Enter já percorrem e acionam tudo. O visual
 * segue as abas das Configurações, em versão compacta.
 *
 * `baseId` vem de fora porque o painel de conteúdo mora em outro ponto da
 * árvore e precisa apontar para a mesma aba: dois drawers na mesma página
 * nunca compartilham os ids.
 */
export function DrawerTabs({
  activeTabId,
  baseId,
  onTabChange,
  tabs,
}: {
  activeTabId: string
  baseId: string
  onTabChange: (tabId: string) => void
  tabs: readonly DrawerTab[]
}) {
  return (
    // Faixa fria sob as abas: a aba ativa é branca e emenda no painel de
    // conteúdo, que também é branco, do mesmo jeito que as abas das
    // Configurações. É isso que liga a aba ao conteúdo em vez de deixar as duas
    // como blocos soltos.
    <div
      className="flex flex-none flex-wrap gap-1 border-b border-[#eef0f4] bg-[#f6f8fb] px-5 pb-0 pt-1.5"
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId

        return (
          <button
            aria-controls={`${baseId}-${tab.id}-panel`}
            aria-selected={active}
            className={
              active
                ? 'relative -mb-px cursor-pointer rounded-t-lg border border-[#eef0f4] border-b-white bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                : 'cursor-pointer rounded-t-lg px-3.5 py-2 text-[12.5px] font-medium text-[#667085] transition hover:bg-[#eef2f8] hover:text-[#344054] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            }
            id={`${baseId}-${tab.id}-tab`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function DrawerTabPanel({
  baseId,
  children,
  tabId,
}: {
  baseId: string
  children: ReactNode
  tabId: string
}) {
  return (
    <div
      aria-labelledby={`${baseId}-${tabId}-tab`}
      id={`${baseId}-${tabId}-panel`}
      role="tabpanel"
      tabIndex={-1}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Acordeão de departamento                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Um departamento por vez, recolhido por padrão.
 *
 * `details` e `summary` nativos, e não um componente próprio: já são operáveis
 * por teclado, anunciam o estado expandido e dispensam JavaScript de foco.
 */
export function DepartmentAccordion({
  children,
  label,
  meta,
}: {
  children: ReactNode
  label: string
  /** Texto curto à direita do nome, como a contagem de páginas. */
  meta: ReactNode
}) {
  return (
    <details className="group rounded-lg border border-[#eaecf2] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold text-[#344054] transition hover:bg-[#f6f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-[#98a2b3] transition group-open:rotate-180"
          size={14}
        />
        <span className="min-w-0 flex-1 break-words">{label}</span>
        <span className="shrink-0 text-[11.5px] font-normal text-[#667085]">{meta}</span>
      </summary>
      <div className="border-t border-[#eef0f4] px-3 py-1.5">{children}</div>
    </details>
  )
}

/* -------------------------------------------------------------------------- */
/* Estado da página                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Estado escrito, e não apenas colorido: quem não distingue as cores lê a mesma
 * informação. A página disponível não recebe selo nenhum, porque é o estado
 * normal e marcá-la encheria a lista de ruído.
 */
export function InDevelopmentBadge() {
  return (
    <span className={`${chipClass} flex-none bg-[#f1f3f7] font-medium text-[#667085]`}>
      Em desenvolvimento
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Caixa de seleção                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Caixa de seleção dos formulários visuais.
 *
 * Funciona de verdade, em estado local de quem a renderiza: é o que permite
 * avaliar a composição das telas. Nada do que ela marca é gravado.
 */
export function SelectionCheckbox({
  checked,
  label,
  onCheckedChange,
  trailing,
}: {
  checked: boolean
  label: ReactNode
  onCheckedChange: (checked: boolean) => void
  trailing?: ReactNode
}) {
  const id = useId()

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <input
        checked={checked}
        className="h-4 w-4 flex-none cursor-pointer accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
        id={id}
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
      />
      <label className="min-w-0 flex-1 cursor-pointer break-words text-[12.5px] text-[#475467]" htmlFor={id}>
        {label}
      </label>
      {trailing}
    </div>
  )
}
