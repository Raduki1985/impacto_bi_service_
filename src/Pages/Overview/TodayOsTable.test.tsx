import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { statusColors } from '../../data/dashboardAggregates'
import type { TodayOsRow } from './todayOsModel'
import { TodayOsTable } from './TodayOsTable'
import { TODAY_COLUMNS } from './todayOsTableModel'

/**
 * Teste espelho da lista de OS da agenda de hoje.
 *
 * O que ele protege é a promessa da tabela: as nove colunas que o gestor
 * pediu, o código da OS em evidência, a ausência escrita por extenso em vez
 * de uma célula vazia, e a cor do status igual à dos gráficos da página.
 */

function row(overrides: Partial<TodayOsRow> = {}): TodayOsRow {
  return {
    id: 'OS-2026-1234',
    period: 'Manhã',
    serviceType: 'Instalação',
    category: 'fibra instalação',
    city: 'Atibaia',
    technician: 'Ana Souza',
    team: 'Infra',
    hasTechnician: true,
    status: 'Concluída',
    detail: 'Instalação Realizada',
    unassignedAtRisk: false,
    ...overrides,
  }
}

function render(rows: readonly TodayOsRow[]) {
  return renderToStaticMarkup(
    <TodayOsTable id="os-today-list" label="Concluídas" onClose={() => {}} rows={rows} />,
  )
}

describe('lista de OS da agenda de hoje', () => {
  it('mostra as nove colunas pedidas e o conteúdo da linha', () => {
    const html = render([row()])

    expect(TODAY_COLUMNS.map((column) => column.label)).toEqual([
      'OS',
      'Turno',
      'Tipo',
      'Categoria',
      'Cidade',
      'Técnico',
      'Equipe',
      'Status',
      'Detalhe',
    ])
    for (const column of TODAY_COLUMNS) {
      expect(html).toContain(`title="${column.label}"`)
    }
    // Largura declarada por coluna: é o que mantém a tabela parada quando o
    // gestor troca de caixa.
    expect(html).toContain('table-fixed')
    expect(html).toContain(`width:${TODAY_COLUMNS[0].width}px`)
    expect(html).toContain('OS-2026-1234')
    expect(html).toContain('fibra instalação')
    expect(html).toContain('Atibaia')
    expect(html).toContain('Ana Souza')
    expect(html).toContain('Infra')
    expect(html).toContain('Instalação Realizada')
    // A cor do status é a mesma dos gráficos de OS, nunca uma por posição.
    expect(html).toContain(statusColors.Concluída)
  })

  it('conta quantas OS a caixa aberta tem, no cabeçalho da lista', () => {
    expect(render([row(), row({ id: 'OS-2' })])).toContain('Concluídas: 2 OS')
  })

  it('escreve a ausência de turno e de técnico, em vez de deixar a célula vazia', () => {
    const html = render([
      row({ period: null, technician: null, team: null, hasTechnician: false, detail: null }),
    ])

    expect(html).toContain('Sem turno')
    expect(html).toContain('Sem técnico')
    expect(html).toContain('Sem equipe')
    expect(html).toContain('·')
  })

  it('OS com executor sem nome no cadastro não é lida como OS sem técnico', () => {
    const html = render([row({ technician: null, hasTechnician: true })])

    expect(html).toContain('Técnico sem nome')
    expect(html).not.toContain('>Sem técnico<')
  })

  it('recorte sem nenhuma OS diz isso e não desenha tabela vazia', () => {
    const html = render([])

    expect(html).toContain('Nenhuma OS nesta situação agora.')
    expect(html).not.toContain('<table')
  })
})

/**
 * Marca de atenção na célula Técnico, aprovada pelo Mário em 22/09/2026: a
 * mesma da caixa `A fazer`, pela mesma régua de turno, para a lista dizer
 * QUAIS são as OS que a caixa contou.
 */
describe('OS sem técnico com o turno já iniciado', () => {
  it('marca a célula Técnico com a cor de atenção, o triângulo e a leitura acessível', () => {
    const html = render([
      row({ technician: null, hasTechnician: false, status: 'Agendada', unassignedAtRisk: true }),
    ])

    expect(html).toContain('Sem técnico')
    expect(html).toContain('var(--os-attention)')
    expect(html).toContain('turno já iniciado')
    expect(html).toContain('já passou da hora em que costuma começar')
  })

  it('fora da régua, a OS sem técnico fica como as outras: sem cor nem triângulo', () => {
    const html = render([
      row({ technician: null, hasTechnician: false, status: 'Agendada', unassignedAtRisk: false }),
    ])

    expect(html).toContain('Sem técnico')
    expect(html).not.toContain('var(--os-attention)')
    expect(html).not.toContain('turno já iniciado')
  })

  it('a marca fica só na célula Técnico, e não na linha inteira', () => {
    const html = render([
      row({ technician: null, hasTechnician: false, status: 'Agendada', unassignedAtRisk: true }),
    ])

    expect((html.match(/var\(--os-attention\)/g) ?? []).length).toBe(1)
  })
})

describe('frase de apoio da lista', () => {
  it('usa a frase das caixas por padrão e aceita a da lista de dias anteriores', () => {
    expect(render([row()])).toContain('o horário nas que estão em campo')

    const html = renderToStaticMarkup(
      <TodayOsTable
        description="Detalhe traz a data da OS."
        id="os-today-list"
        label="De dias anteriores"
        onClose={() => {}}
        rows={[row()]}
      />,
    )

    expect(html).toContain('Detalhe traz a data da OS.')
    expect(html).not.toContain('o horário nas que estão em campo')
  })
})

/**
 * Recorte inicial (23/09/2026): o atalho "sem técnico" da caixa `A fazer`
 * abre a lista já filtrada pela coluna Técnico.
 */
describe('lista aberta já filtrada', () => {
  it('aplica o recorte inicial e oferece o Restaurar tabela', () => {
    const html = renderToStaticMarkup(
      <TodayOsTable
        id="os-today-list"
        initialFilters={{ technician: ['Sem técnico'] }}
        label="A fazer"
        onClose={() => {}}
        rows={[
          row({ id: 'OS-1', technician: null, hasTechnician: false, status: 'Agendada' }),
          row({ id: 'OS-2', status: 'Agendada' }),
        ]}
      />,
    )

    expect(html).toContain('A fazer: 1 de 2 OS')
    expect(html).toContain('OS-1')
    expect(html).not.toContain('OS-2')
    expect(html).toContain('Restaurar tabela')
  })

  it('sem recorte inicial mostra tudo, como sempre', () => {
    const html = render([row({ id: 'OS-1' }), row({ id: 'OS-2' })])

    expect(html).toContain('Concluídas: 2 OS')
    expect(html).not.toContain('Restaurar tabela')
  })
})

describe('cor das ações no tema escuro', () => {
  it('o Restaurar tabela leva a classe que o tema escuro pinta de verde', () => {
    const html = renderToStaticMarkup(
      <TodayOsTable
        id="os-today-list"
        initialFilters={{ technician: ['Sem técnico'] }}
        label="A fazer"
        onClose={() => {}}
        rows={[row({ technician: null, hasTechnician: false })]}
      />,
    )

    expect(html).toMatch(/class="os-filter-action[^"]*"[^>]*>Restaurar tabela</)
  })
})

describe('Restaurar tabela de uma lista aberta por atalho', () => {
  it('fica visível mesmo sem filtro de coluna quando a faixa tem para onde voltar', () => {
    const html = renderToStaticMarkup(
      <TodayOsTable
        id="os-today-list"
        label="De dias anteriores"
        onClose={() => {}}
        onRestore={() => {}}
        rows={[row()]}
      />,
    )

    expect(html).toContain('Restaurar tabela')
  })
})
