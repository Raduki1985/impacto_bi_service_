import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ChartCard } from './ChartCard'

function render(props: Partial<Parameters<typeof ChartCard>[0]> = {}) {
  return renderToStaticMarkup(
    <ChartCard subtitle="Subtítulo do painel" title="Título do painel" {...props}>
      <span>grafico</span>
    </ChartCard>,
  )
}

/**
 * A variante padrão é a de todos os outros gráficos do portal.
 *
 * Ela precisa continuar byte a byte como estava: qualquer mudança aqui
 * apareceria em Clientes, Calendário, Improdutividade, Qualidade e nas demais
 * páginas que não fazem parte deste bloco.
 */
describe('ChartCard padrão', () => {
  it('mantém superfície, título e subtítulo históricos sem declarar variante', () => {
    const html = render()

    expect(html).toContain(
      '<section class="rounded-xl border border-[#e6e8ee] bg-white px-[18px] py-4">',
    )
    expect(html).toContain('<div class="text-[13.5px] font-semibold text-[#101828]">')
    expect(html).toContain('<div class="mb-2 text-xs text-[#98a2b3]">')
    expect(html).toContain('grafico')
    // A superfície do tema escuro é só da variante executiva.
    expect(html).not.toContain('executive-panel')
  })

  it('continua substituindo a superfície quando recebe className', () => {
    expect(render({ className: 'painel-proprio' })).toContain('<section class="painel-proprio">')
  })

  it('preserva o espaçador do painel sem subtítulo', () => {
    const html = render({ subtitle: undefined })

    expect(html).toContain('<div class="mb-2">')
    expect(html).not.toContain('text-xs text-[#98a2b3]')
  })
})

/**
 * A variante executiva alinha o painel aos cards executivos de OS: superfície e
 * textos por tokens, para acompanharem o tema, e sombra estática.
 */
describe('ChartCard executivo', () => {
  it('usa tokens de tema na superfície, no título e no subtítulo', () => {
    const html = render({ variant: 'executive' })

    expect(html).toContain('bg-[var(--surface)]')
    expect(html).toContain('border-[var(--border)]')
    expect(html).toContain('rounded-xl')
    expect(html).toContain('shadow-sm')
    // A superfície do tema escuro vem do próprio painel, sem classe da página.
    expect(html).toContain('executive-panel')
    expect(html).toContain('text-[var(--text-heading)]')
    expect(html).toContain('text-[var(--text-secondary)]')
    // Nenhuma cor fixa clara sobrou para brigar com o tema escuro.
    expect(html).not.toContain('bg-white')
    expect(html).not.toContain('#101828')
    expect(html).not.toContain('#98a2b3')
  })

  it('soma o className ao painel em vez de substituir a superfície', () => {
    const html = render({ className: 'os-daily-volume', variant: 'executive' })

    expect(html).toContain('os-daily-volume')
    expect(html).toContain('bg-[var(--surface)]')
  })

  it('não vira botão nem painel expansível', () => {
    const html = render({ variant: 'executive' })

    expect(html).not.toContain('role="button"')
    expect(html).not.toContain('aria-expanded')
    expect(html).not.toContain('tabindex')
    expect(html).not.toContain('cursor-pointer')
    // Sem elevação nem transição no hover: o painel é estático.
    expect(html).not.toContain('hover:')
    expect(html).not.toContain('transition')
  })
})
