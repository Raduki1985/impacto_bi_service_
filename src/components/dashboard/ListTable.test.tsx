import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ListTable } from './ListTable'
import type { ListColumn } from './listTableModel'

/**
 * Teste espelho da lista do portal, com linhas de mentira.
 *
 * O que ele protege é a casca comum a qualquer lista: o cabeçalho conta
 * quantas linhas com a unidade da página, as larguras fixas, a ausência de
 * tabela quando não há linha, o recorte inicial com o Restaurar, e as ações
 * que só aparecem quando a página as liga. As regras da OS ficam em
 * `TodayOsTable.test.tsx`.
 */
type Row = { readonly id: string; readonly city: string; readonly kind: string }

const columns: readonly ListColumn<Row, 'id' | 'city' | 'kind'>[] = [
  { key: 'id', label: 'Venda', width: 90, filterable: false, sortable: true, text: (row) => row.id },
  { key: 'city', label: 'Cidade', width: 120, filterable: true, sortable: true, text: (row) => row.city },
  { key: 'kind', label: 'Tipo', width: 100, filterable: false, sortable: false, text: (row) => row.kind },
]

const rows: Row[] = [
  { id: 'V-1', city: 'Atibaia', kind: 'Nova' },
  { id: 'V-2', city: 'Piracaia', kind: 'Upgrade' },
]

function render(props: Partial<Parameters<typeof ListTable<Row, 'id' | 'city' | 'kind'>>[0]> = {}) {
  return renderToStaticMarkup(
    <ListTable
      ariaLabel="Vendas: Ativadas"
      columns={columns}
      emptyMessage="Nenhuma venda nesta seleção."
      label="Ativadas"
      rowKey={(row) => row.id}
      rows={rows}
      unit="vendas"
      {...props}
    />,
  )
}

describe('lista do portal', () => {
  it('conta as linhas com a unidade da página e desenha as colunas com largura fixa', () => {
    const html = render()

    expect(html).toContain('aria-label="Vendas: Ativadas"')
    expect(html).toContain('Ativadas: 2 vendas')
    expect(html).toContain('table-fixed')
    expect(html).toContain('width:90px')
    for (const column of columns) expect(html).toContain(`title="${column.label}"`)
    expect(html).toContain('V-1')
    expect(html).toContain('Piracaia')
    // Só as colunas que filtram ou ordenam ganham o botão do painel.
    expect(html).toContain('Filtrar e ordenar Cidade.')
    expect(html).not.toContain('Filtrar e ordenar Tipo')
  })

  it('sem linha nenhuma diz o aviso da página e não desenha tabela', () => {
    const html = render({ rows: [] })

    expect(html).toContain('Nenhuma venda nesta seleção.')
    expect(html).not.toContain('<table')
  })

  it('abre já recortada quando a página pede, e oferece o Restaurar tabela', () => {
    const html = render({ initialFilters: { city: ['Atibaia'] } })

    expect(html).toContain('Ativadas: 1 de 2 vendas')
    expect(html).toContain('V-1')
    expect(html).not.toContain('V-2')
    expect(html).toMatch(/class="impacto-text-action[^"]*"[^>]*>Restaurar tabela</)
  })

  it('recorte inicial sem linha diz o aviso do recorte, e não o da lista vazia', () => {
    const html = render({ initialFilters: { city: ['Campinas'] } })

    expect(html).toContain('Ativadas: 0 de 2 vendas')
    expect(html).toContain('Nenhuma linha com os filtros das colunas.')
    expect(html).not.toContain('Nenhuma venda nesta seleção.')
  })

  it('Fechar e Baixar Excel só existem quando a página os liga', () => {
    expect(render()).not.toContain('Fechar')
    expect(render()).not.toContain('Baixar Excel')
    expect(render({ onClose: () => {} })).toContain('Fechar')
    expect(render({ onDownload: () => {} })).toContain('Baixar Excel')
    expect(render({ onRestore: () => {} })).toContain('Restaurar tabela')
  })

  it('preenche a altura do contêiner quando é a janela, e tem teto fixo na faixa', () => {
    expect(render({ fill: true })).toContain('min-h-0 flex-1')
    expect(render({ fill: true })).not.toContain('max-h-[380px]')
    expect(render()).toContain('max-h-[380px]')
  })

  it('a página pode desenhar e colorir a célula do próprio jeito', () => {
    const html = render({
      cellClassName: (_row, column) => (column.key === 'id' ? 'font-mono' : 'text-plain'),
      renderCell: (_row, column, text) => (column.key === 'kind' ? <b>{text}</b> : text),
    })

    expect(html).toContain('<b>Nova</b>')
    expect(html).toContain('font-mono')
    expect(html).toContain('text-plain')
  })
})
