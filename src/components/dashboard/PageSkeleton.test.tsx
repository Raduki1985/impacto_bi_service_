import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  GenericPageSkeleton,
  PageSkeleton,
  SkeletonCardGrid,
  SkeletonChartCard,
  SkeletonBoxGrid,
  SkeletonFilterBar,
  SkeletonLiveStrip,
} from './PageSkeleton'

/**
 * Teste espelho do esqueleto de carregamento (opção B, 08/10/2026).
 *
 * O que ele protege: o leitor de tela recebe a frase do carregando e nunca o
 * desenho; a frase não fica calada por `aria-busy`; cada peça tem a moldura
 * do componente real que imita; e nenhum número aparece no esqueleto.
 */

function count(html: string, marker: string): number {
  return html.split(marker).length - 1
}

describe('esqueleto de carregamento da página', () => {
  it('anuncia o carregando por texto e esconde o desenho do leitor de tela', () => {
    const html = renderToStaticMarkup(
      <PageSkeleton label="Carregando as ordens de serviço">
        <GenericPageSkeleton />
      </PageSkeleton>,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('<span class="sr-only">Carregando as ordens de serviço</span>')
    expect(html).toContain('<div aria-hidden="true">')
    expect(html).not.toContain('aria-busy')
  })

  it('não desenha número nenhum, nem de estudo', () => {
    const html = renderToStaticMarkup(
      <PageSkeleton label="Carregando o período">
        <SkeletonFilterBar />
        <SkeletonLiveStrip>
          <SkeletonBoxGrid boxes={6} className="grid grid-cols-6" />
        </SkeletonLiveStrip>
        <GenericPageSkeleton />
      </PageSkeleton>,
    )
    const visibleText = html.replace(/<[^>]+>/g, '').replace('Carregando o período', '')

    expect(visibleText.trim()).toBe('')
  })

  it('grade de cards: quantos a página pede, na grade do ExecutiveCardGrid', () => {
    const html = renderToStaticMarkup(
      <SkeletonCardGrid columnsClass="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" count={6} />,
    )

    expect(count(html, 'data-skeleton="card"')).toBe(6)
    expect(html).toContain('grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6')
    expect(html).toContain('executive-panel')
  })

  it('grade de cards: sem colunas informadas, quatro por linha como nas páginas de OS', () => {
    const html = renderToStaticMarkup(<SkeletonCardGrid count={4} />)

    expect(html).toContain('sm:grid-cols-2 lg:grid-cols-4')
    expect(count(html, 'data-skeleton="card"')).toBe(4)
  })

  it('painel: a área do gráfico tem a altura que o gráfico real vai ocupar', () => {
    const html = renderToStaticMarkup(<SkeletonChartCard height={280} />)

    expect(html).toContain('height:280px')
    expect(html).toContain('px-[18px] py-4')
  })

  it('painel: colunas em pé, barras deitadas do maior ao menor, ou linhas de tabela', () => {
    const columns = renderToStaticMarkup(<SkeletonChartCard bars={12} height={200} />)
    const rows = renderToStaticMarkup(<SkeletonChartCard bars={4} height={200} shape="rows" />)
    const table = renderToStaticMarkup(<SkeletonChartCard bars={10} height={200} shape="table" />)

    expect(count(columns, 'height:') - 1).toBe(12)
    expect(rows).toContain('width:92%')
    expect(rows).toContain('width:55%')
    expect(count(rows, 'width:')).toBe(4)
    expect(count(table, 'width:100%')).toBe(10)
  })

  it('painel: pedir mais barras do que o desenho tem não quebra, para no máximo', () => {
    const html = renderToStaticMarkup(<SkeletonChartCard bars={50} height={200} shape="rows" />)

    expect(count(html, 'width:')).toBe(8)
  })

  it('faixa de filtros: dentro da faixa fixa real, de ponta a ponta, sem moldura de card', () => {
    const html = renderToStaticMarkup(<SkeletonFilterBar className="mb-3.5" />)

    expect(html.startsWith('<div class="page-sticky-header ')).toBe(true)
    expect(html).toContain('mb-3.5')
    expect(html).toContain('data-skeleton="filter-bar"')
    expect(html).toContain('px-[26px] py-3')
    expect(html).not.toContain('executive-panel')
    expect(html).not.toContain('rounded-xl')
  })

  it('faixa ao vivo: a moldura da faixa e as caixas na grade que a página passa', () => {
    const html = renderToStaticMarkup(
      <SkeletonLiveStrip>
        <SkeletonBoxGrid boxes={3} className="grid grid-cols-1 gap-3 lg:grid-cols-3" />
      </SkeletonLiveStrip>,
    )

    expect(count(html, 'data-skeleton="live-strip"')).toBe(1)
    expect(html).toContain('lg:grid-cols-3')
    expect(count(html, 'data-skeleton="live-box"')).toBe(3)
  })

  it('caixa ao vivo: moldura e alturas de linha da LiveBox, para a faixa não mudar de altura', () => {
    const html = renderToStaticMarkup(<SkeletonBoxGrid boxes={1} className="grid" />)

    expect(html).toContain('rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5')
    expect(html).toContain('flex h-[16px] items-center')
    expect(html).toContain('mt-1 h-[23px]')
    expect(html).toContain('mt-1.5 flex h-[16.5px]')
  })
})
