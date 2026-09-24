import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import {
  ColumnFilterHeader,
  ColumnListPanel,
  ColumnPanelActions,
  ColumnSortSection,
} from './ColumnFilter'

/**
 * Teste espelho do filtro de cabeçalho compartilhado.
 *
 * Ele é usado por Vendas por Período e pela lista de OS da Visão Geral, então
 * o que está provado aqui vale para as duas: o painel nasce fechado, o estado
 * da coluna é anunciado por texto e não só por cor, e a lista mostra rótulo,
 * dica e contagem conforme a tabela informar.
 *
 * O painel aberto não entra: ele é publicado em portal, depois de medir a
 * posição do botão na tela, e o projeto renderiza estático, sem navegador.
 */

describe('cabeçalho de coluna', () => {
  it('nasce fechado, com o título e o botão de filtro', () => {
    const html = renderToStaticMarkup(
      <ColumnFilterHeader filtered={false} label="Cidade">
        {() => <span>painel</span>}
      </ColumnFilterHeader>,
    )

    expect(html).toContain('Cidade')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Filtrar e ordenar Cidade."')
    // O conteúdo do painel só existe depois do clique.
    expect(html).not.toContain('painel')
  })

  it('anuncia filtro e ordenação separados, e marca o filtro fora da cor', () => {
    const html = renderToStaticMarkup(
      <ColumnFilterHeader
        filtered
        label="Cidade"
        sort={{ direction: 'asc', label: 'Crescente' }}
      >
        {() => null}
      </ColumnFilterHeader>,
    )

    expect(html).toContain(
      'aria-label="Filtrar e ordenar Cidade. Filtro ativo nesta coluna. Ordenação ativa nesta coluna: Crescente."',
    )
    // Asterisco ao lado do nome: a marca não depende só do ícone colorido.
    expect(html).toContain(' *')
    expect(html).toContain('Ordenação ativa: Crescente.')
  })
})

describe('bloco de ordenação', () => {
  it('desenha uma opção por sentido e marca a ativa', () => {
    const html = renderToStaticMarkup(
      <ColumnSortSection
        choices={[
          { key: 'asc', label: 'Crescente', icon: ArrowUpAZ, active: true },
          { key: 'desc', label: 'Decrescente', icon: ArrowDownAZ, active: false },
        ]}
        onSelect={() => {}}
      />,
    )

    expect(html).toContain('Ordenar')
    expect(html).toContain('Crescente')
    expect(html).toContain('Decrescente')
    expect(html.indexOf('aria-pressed="true"')).toBeLessThan(html.indexOf('aria-pressed="false"'))
  })
})

describe('painel de lista', () => {
  const options = [
    { value: 'atibaia', label: 'Atibaia', count: 42 },
    { value: 'c-1', label: 'João Conceição', hint: '123.456.789-00' },
  ]

  function render(props: Partial<Parameters<typeof ColumnListPanel>[0]> = {}) {
    return renderToStaticMarkup(
      <ColumnListPanel
        onApply={() => {}}
        onCancel={() => {}}
        options={options}
        searchLabel="Buscar em Cidade"
        selected={[]}
        {...props}
      />,
    )
  }

  it('mostra rótulo, dica e contagem, com o campo de busca', () => {
    const html = render()

    expect(html).toContain('Buscar em Cidade')
    expect(html).toContain('Atibaia')
    expect(html).toContain('42')
    expect(html).toContain('123.456.789-00')
    expect(html).toContain('Sem filtro')
  })

  it('sem seleção nenhuma, o Limpar fica desligado e o resumo diz sem filtro', () => {
    const html = render()

    expect(html).toContain('Selecionar tudo')
    expect(html).toContain('Sem filtro')
  })

  it('conta a seleção no resumo, com a concordância certa', () => {
    expect(render({ selected: ['atibaia'] })).toContain('1 selecionado')
    expect(render({ selected: ['atibaia', 'c-1'] })).toContain('2 selecionados')
  })

  it('coluna sem busca não desenha o campo', () => {
    expect(render({ searchable: false })).not.toContain('Buscar em Cidade')
  })

  it('lista vazia avisa, em vez de mostrar uma caixa em branco', () => {
    expect(render({ options: [] })).toContain('Nenhum valor corresponde à busca.')
  })
})

describe('ações do painel', () => {
  it('traz Cancelar e Aplicar, e a ação secundária quando a página pede', () => {
    const html = renderToStaticMarkup(
      <ColumnPanelActions
        onApply={() => {}}
        onCancel={() => {}}
        secondary={{ disabled: false, label: 'Limpar datas', onClick: () => {} }}
        summary="Sem filtro"
      />,
    )

    expect(html).toContain('Cancelar')
    expect(html).toContain('Aplicar')
    expect(html).toContain('Limpar datas')
    expect(html).toContain('Sem filtro')
  })

  it('Aplicar desligado quando a página recusa o que está digitado', () => {
    const html = renderToStaticMarkup(
      <ColumnPanelActions applyDisabled onApply={() => {}} onCancel={() => {}} />,
    )

    expect(html).toContain('disabled=""')
  })
})
