import type { CSSProperties, ReactNode } from 'react'

import { cn } from '../../lib/utils'
import { PageStickyHeader } from '../layout/PageStickyHeader'

/**
 * Esqueleto de carregamento das páginas ligadas ao serviço de BI.
 *
 * Opção B, escolhida pelo Mário em 08/10/2026: enquanto a página busca os
 * dados, os cards e os painéis aparecem em cinza no lugar e no tamanho em que
 * vão ficar, com um brilho correndo. Substitui o texto parado do
 * `PageStatePanel` no carregando; a falha continua no `PageStatePanel`.
 *
 * Cada peça aqui imita um componente compartilhado real (`FilterPanel`,
 * `SectionHeading`, `ExecutiveCardGrid`, `ChartCard` executivo, `LiveStrip`),
 * com a mesma moldura e as mesmas medidas, para a troca do esqueleto pelos
 * números não fazer a página pular. Quem monta o desenho de cada página é a
 * própria página, juntando as peças na ordem dela.
 *
 * A regra que continua valendo: carregando, a página NÃO desenha indicador
 * nenhum. O esqueleto não tem número, nem de estudo.
 */

/** Um bloco cinza. A cor e o brilho vêm da classe `impacto-skeleton` (`styles.css`). */
export function SkeletonBlock({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={cn('impacto-skeleton block rounded-md', className)} style={style} />
}

/**
 * A moldura que anuncia o carregando.
 *
 * O desenho todo é escondido do leitor de tela, que recebe só a frase: o
 * mesmo título que o quadro de carregamento tinha ("Carregando as ordens de
 * serviço"). Sem `aria-busy` aqui: numa região que se anuncia sozinha, ele
 * faz o leitor de tela esperar e calar a frase.
 */
export function PageSkeleton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div aria-live="polite" role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

/**
 * A faixa de filtros recolhida: título, período e dois filtros, DENTRO da
 * faixa fixa real (`PageStickyHeader`), como o `FilterPanel`: de ponta a ponta,
 * sem moldura nem canto, com a superfície e a borda da faixa. Fora dela, o
 * `main` mantinha o respiro de cima e a página subia ao chegarem os números.
 */
export function SkeletonFilterBar({ className }: { className?: string }) {
  return (
    <PageStickyHeader className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-[26px] py-3" data-skeleton="filter-bar">
        <SkeletonBlock className="h-3.5 w-24" />
        <SkeletonBlock className="h-3 w-40" />
        <SkeletonBlock className="h-5 w-24 rounded-full" />
        <SkeletonBlock className="h-5 w-20 rounded-full" />
        <SkeletonBlock className="ml-auto h-3 w-16" />
      </div>
    </PageStickyHeader>
  )
}

/** O título de uma faixa da página, em caixa alta, com a frase de apoio. */
export function SkeletonSectionHeading() {
  return (
    <div className="mb-2.5 flex items-center gap-2 px-0.5">
      <SkeletonBlock className="h-3 w-36" />
      <SkeletonBlock className="h-2.5 w-48" />
    </div>
  )
}

/** Larguras que se repetem de card a card, para a grade não sair idêntica. */
const CARD_LABEL_WIDTHS = ['w-1/2', 'w-2/5', 'w-3/5', 'w-[45%]']
const CARD_VALUE_WIDTHS = ['w-2/5', 'w-1/3', 'w-[45%]', 'w-[30%]']

/**
 * A grade de cards de indicador, com a mesma grade do `ExecutiveCardGrid`
 * (padrão: quatro por linha no `lg`) e o card com as mesmas faixas do
 * `ExecutiveMetricCard`: rótulo e ícone, valor, comparação, detalhe e a
 * definição na base.
 */
export function SkeletonCardGrid({
  className,
  columnsClass = 'sm:grid-cols-2 lg:grid-cols-4',
  count,
}: {
  className?: string
  columnsClass?: string
  count: number
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-3.5', columnsClass, className)} data-skeleton="cards">
      {Array.from({ length: count }, (_, index) => (
        <div
          className="executive-panel flex min-w-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-sm"
          data-skeleton="card"
          key={index}
        >
          <div className="flex min-h-8 items-start justify-between gap-2">
            <SkeletonBlock className={cn('mt-0.5 h-2.5', CARD_LABEL_WIDTHS[index % CARD_LABEL_WIDTHS.length])} />
            <SkeletonBlock className="h-8 w-8 flex-none rounded-xl" />
          </div>
          <div className="mt-0.5 flex h-[30px] items-end">
            <SkeletonBlock className={cn('h-6', CARD_VALUE_WIDTHS[index % CARD_VALUE_WIDTHS.length])} />
          </div>
          <div className="mt-1.5 flex h-[24px] items-center">
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
          <SkeletonBlock className="mt-1.5 h-2.5 w-1/2" />
          <div className="mt-auto flex flex-col gap-1.5 pt-2">
            <SkeletonBlock className="h-2.5 w-full" />
            <SkeletonBlock className="h-2.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Alturas das colunas, em %, na ordem em que aparecem. */
const COLUMN_HEIGHTS = [60, 85, 45, 70, 95, 55, 75, 40, 65, 80, 50, 90]
/** Comprimentos das barras deitadas, em %, do maior ao menor, como num ranking. */
const ROW_WIDTHS = [92, 78, 66, 55, 46, 38, 30, 24]
/** Linhas de uma tabela: todas cheias, a última um pouco menor. */
const TABLE_ROWS = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 85]

/**
 * Um painel de gráfico com a moldura do `ChartCard` executivo: título,
 * subtítulo e a área do gráfico na altura que o gráfico real vai ocupar.
 *
 * `columns` desenha colunas em pé (volume por dia, por mês); `rows` desenha
 * barras deitadas, do maior para o menor (rankings, motivos, destino);
 * `table` desenha linhas de largura cheia, para o painel que é uma tabela.
 * As barras deitadas se espalham pela altura toda, como no gráfico real;
 * `thickBars` engrossa as barras quando são poucas e largas (Destino das OS).
 */
export function SkeletonChartCard({
  bars,
  className,
  height,
  shape = 'columns',
  thickBars = false,
}: {
  bars?: number
  className?: string
  height: number
  shape?: 'columns' | 'rows' | 'table'
  thickBars?: boolean
}) {
  const sizes = shape === 'columns' ? COLUMN_HEIGHTS : shape === 'rows' ? ROW_WIDTHS : TABLE_ROWS
  const count = Math.max(1, Math.min(bars ?? (shape === 'rows' ? 6 : 8), sizes.length))

  return (
    <div
      className={cn(
        'executive-panel min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm',
        className,
      )}
      data-skeleton="chart"
    >
      <SkeletonBlock className="h-3.5 w-1/3" />
      <SkeletonBlock className="mt-1.5 mb-3 h-2.5 w-1/2" />
      <div
        className={
          shape === 'columns'
            ? 'flex items-end gap-2.5'
            : shape === 'rows'
              ? 'flex flex-col justify-evenly'
              : 'flex flex-col justify-start gap-3.5 pt-1'
        }
        style={{ height }}
      >
        {sizes.slice(0, count).map((size, index) =>
          shape === 'columns' ? (
            <SkeletonBlock className="flex-1" key={index} style={{ height: `${size}%` }} />
          ) : (
            <SkeletonBlock
              className={shape === 'table' ? 'h-3' : thickBars ? 'h-9' : 'h-4'}
              key={index}
              style={{ width: `${size}%` }}
            />
          ),
        )}
      </div>
    </div>
  )
}

/**
 * Uma caixa do Hoje ao vivo em cinza, com a moldura e as três faixas da
 * `LiveBox` (rótulo, número e frase) nas alturas de linha dela, medidas na
 * tela em 08/10/2026 (15,8, 23 e 16,5 px), para a caixa real entrar no lugar
 * sem a faixa mudar de altura.
 */
function SkeletonLiveBox() {
  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5"
      data-skeleton="live-box"
    >
      <div className="flex h-[16px] items-center">
        <SkeletonBlock className="h-2.5 w-2/3" />
      </div>
      <div className="mt-1 h-[23px]">
        <SkeletonBlock className="h-full w-1/3" />
      </div>
      <div className="mt-1.5 flex h-[16.5px] items-center">
        <SkeletonBlock className="h-2.5 w-1/2" />
      </div>
    </div>
  )
}

/** As caixas do Hoje ao vivo em cinza, na grade que a faixa usa. */
export function SkeletonBoxGrid({ boxes, className }: { boxes: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: boxes }, (_, index) => (
        <SkeletonLiveBox key={index} />
      ))}
    </div>
  )
}

/**
 * A faixa ao vivo (Hoje ao vivo) inteira em cinza, com a moldura do
 * `LiveStrip`: título, subtítulo e, embaixo, as caixas que a página passa.
 * Na primeira carga da página; depois, quem busca é a própria faixa, que
 * mostra só as caixas em cinza dentro da moldura real.
 */
export function SkeletonLiveStrip({ children }: { children: ReactNode }) {
  return (
    <div
      className="executive-panel mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm"
      data-skeleton="live-strip"
    >
      <SkeletonBlock className="h-3.5 w-28" />
      <SkeletonBlock className="mt-1.5 mb-3 h-2.5 w-2/5" />
      {children}
    </div>
  )
}

/**
 * Esqueleto neutro, para quando o portal ainda não sabe que página vai abrir:
 * o código da página está chegando ao navegador. Título de faixa, quatro
 * cards e um painel, o formato comum das páginas do portal.
 */
export function GenericPageSkeleton() {
  return (
    <>
      <SkeletonSectionHeading />
      <SkeletonCardGrid className="mb-4" count={4} />
      <SkeletonChartCard height={220} />
    </>
  )
}
