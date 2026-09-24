import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, Trash2, X } from 'lucide-react'

import { cn } from '../../lib/utils'
import { tintedChipToneClass } from '../ui/chipStyles'
import { filterActionClass } from './filterFieldStyles'

/** Um filtro aplicado, como o resumo o mostra: nome, valor e o "x" que tira só ele. */
export type FilterPanelChip = {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly onRemove: () => void
}

type FilterPanelProps = {
  /** Título da faixa. O padrão é o das Visões Gerais. */
  title?: string
  /**
   * O que vem logo depois do título, sempre visível: os atalhos de período
   * (`PeriodPresets`), quando a página os tem.
   */
  shortcuts?: ReactNode
  /**
   * Período por extenso, visível mesmo com a faixa recolhida. A página decide
   * quando mostrá-lo: a Visão Geral de OS o esconde enquanto um atalho está
   * aceso, porque o botão já nomeia o período.
   */
  period?: string
  /** Filtros aplicados, cada um com o "x" que tira só ele. */
  chips?: readonly FilterPanelChip[]
  /**
   * Com ele, o `Limpar filtros` aparece. A página passa a função só quando há
   * o que limpar, datas incluídas: é a página que sabe qual é o recorte padrão.
   */
  onClear?: () => void
  /**
   * Estado visual inicial da área expandida. O painel abre recolhido; o valor
   * existe para os testes de renderização estática exercitarem o estado
   * expandido, já que a suíte não tem ambiente de DOM para acionar o controle.
   */
  defaultExpanded?: boolean
  /** Os grupos de campos da área expandida (`FilterGroup`). */
  children: ReactNode
}

/**
 * Faixa de filtros de uma página de dashboard.
 *
 * Nasceu na Visão Geral de OS, foi copiada na Visão Geral Comercial e virou
 * componente em 24/09/2026, quando a Visão Geral de OS passou a ser o modelo
 * do portal. O que a faixa faz é igual em qualquer página; o que muda é a
 * lista de campos, e ela é o `children`.
 *
 * O que a faixa congela:
 *
 * - um resumo SEMPRE visível: título, atalhos, período por extenso e os
 *   filtros aplicados identificados direto nos chips. Nada de contador de
 *   ativos, e nenhuma linha extra quando o painel está recolhido;
 * - cada chip tem o "x" que tira só ele (pedido do Mário em 10/09/2026);
 *   `Limpar filtros` continua tirando todos, e aparece diante de QUALQUER
 *   alteração, datas incluídas;
 * - as ações ficam agrupadas e estáveis à direita: Limpar antes de
 *   Expandir/Recolher, que está sempre presente, por último. Um único
 *   `Limpar filtros` por estado, sem cópia no rodapé da área expandida;
 * - o período e os atalhos moram no resumo, e não na área expandida (decisão
 *   do Mário em 22/09/2026): o período é o único filtro que a diretoria usa,
 *   e escondê-lo atrás de "Expandir" era obrigar a um clique;
 * - a área expandida permanece no DOM com `hidden`, para o `aria-controls`
 *   do botão apontar sempre para um id existente. Oculta, ela sai do fluxo,
 *   da ordem de tabulação e da árvore de acessibilidade. O teto de altura com
 *   rolagem interna vale só para viewport de pouca altura: o resumo e o botão
 *   de recolher continuam fora dela, sempre acessíveis;
 * - nada aqui usa rolagem horizontal: cabeçalho, chips e grupos quebram de
 *   linha.
 *
 * A faixa é o conteúdo da faixa fixa da página (`PageStickyHeader`), e não um
 * card solto: sem moldura nem canto próprio, com o respiro horizontal de 26px
 * alinhado ao conteúdo do `main`. Superfície e borda inferior vêm da faixa.
 * `impacto-filter-panel` é o gancho das regras de `styles.css`: a lista
 * aberta dos seletores na paleta do portal e, no tema escuro, o verde dos
 * chips, das ações e do anel de foco.
 */
export function FilterPanel({
  chips = [],
  children,
  defaultExpanded = false,
  onClear,
  period,
  shortcuts,
  title = 'Filtros da análise',
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const titleId = useId()
  const contentId = useId()

  return (
    <section aria-labelledby={titleId} className="impacto-filter-panel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-[26px] py-3">
        <span id={titleId} className="text-[13.5px] font-semibold text-[var(--text-heading)]">
          {title}
        </span>
        {shortcuts}
        {period === undefined ? null : (
          <span className="text-[12.5px] text-[var(--text-secondary)]">{period}</span>
        )}
        {chips.length > 0 ? (
          <ul aria-label="Filtros ativos" className="flex min-w-0 flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip.key}
                className={`${tintedChipToneClass} flex max-w-[260px] items-center gap-1 py-0.5 pr-1 pl-2.5`}
                title={`${chip.label}: ${chip.value}`}
              >
                <span className="truncate">
                  {chip.label}: {chip.value}
                </span>
                <button
                  aria-label={`Remover filtro ${chip.label}: ${chip.value}`}
                  className="impacto-chip-remove flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  onClick={chip.onRemove}
                  type="button"
                >
                  <X aria-hidden="true" size={11} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="ml-auto flex flex-none items-center gap-x-1">
          {onClear === undefined ? null : (
            <button className={cn(filterActionClass, 'gap-1.5')} onClick={onClear} type="button">
              <Trash2 aria-hidden="true" size={13} />
              Limpar filtros
            </button>
          )}
          <button
            aria-controls={contentId}
            aria-expanded={expanded}
            className={filterActionClass}
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? 'Recolher filtros' : 'Expandir filtros'}
            <ChevronDown aria-hidden="true" className={expanded ? 'rotate-180' : undefined} size={14} />
          </button>
        </div>
      </div>
      <div
        hidden={!expanded}
        id={contentId}
        className="max-h-[45vh] overflow-x-hidden overflow-y-auto overscroll-contain border-t border-[var(--border)] px-[26px] py-4"
      >
        {children}
      </div>
    </section>
  )
}
