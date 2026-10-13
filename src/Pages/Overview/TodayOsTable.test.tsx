import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ListColumnHeader } from '../../components/dashboard/ListColumnHeader'
import { statusColors } from '../../data/dashboardAggregates'
import type { TodayOsRow } from './todayOsModel'
import { TodayOsTable } from './TodayOsTable'
import { OS_LIST_COLUMNS, TODAY_COLUMNS } from './todayOsTableModel'

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
    slaMinutes: null,
    serviceMinutes: null,
    rescheduleCount: 0,
    rescheduledAt: null,
    rescheduledBy: null,
    rescheduledByKind: null,
    reschedulingReason: null,
    ...overrides,
  }
}

function render(rows: readonly TodayOsRow[]) {
  return renderToStaticMarkup(
    <TodayOsTable id="os-today-list" label="Concluídas" onClose={() => {}} rows={rows} />,
  )
}

describe('lista de OS da agenda de hoje', () => {
  it('mostra as onze colunas (as nove pedidas mais SLA e Reagendada) e o conteúdo da linha', () => {
    const html = render([row()])

    expect(TODAY_COLUMNS.map((column) => column.label)).toEqual([
      'OS',
      'Turno',
      'Tipo',
      'Categoria',
      'SLA',
      'Cidade',
      'Técnico',
      'Equipe',
      'Status',
      'Reagendada',
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

/**
 * Colunas SLA e Reagendada na tela (TSK-892, 13/10/2026): a bolinha da OS
 * reagendada leva a cor do status Reagendada, e a dica de mouse carrega o
 * que a tela não tem coluna para mostrar.
 */
describe('colunas SLA e Reagendada', () => {
  it('a OS reagendada leva a bolinha na cor do status Reagendada e a dica com quem e por quê', () => {
    const html = render([
      row({
        rescheduleCount: 2,
        rescheduledAt: '2026-10-09T14:53:21-03:00',
        rescheduledBy: 'André Ricardo',
        rescheduledByKind: 'employee',
        reschedulingReason: 'chuva',
      }),
    ])

    expect(html).toContain('Sim 2x')
    expect(html).toContain(`background:${statusColors.Reagendada}`)
    expect(html).toContain(
      'title="Reagendada 2 vezes. A última em 09/10/2026 às 14:53, por André Ricardo (colaborador). Motivo: chuva."',
    )
  })

  it('a OS nunca reagendada diz Não, sem bolinha e sem dica além do próprio texto', () => {
    const html = render([row()])

    expect(html).toContain('>Não<')
    expect(html).not.toContain(`background:${statusColors.Reagendada}`)
    expect(html).not.toContain('Reagendada uma vez')
  })

  it('SLA mostra o previsto, e na concluída o real contra o previsto, com a dica explicando', () => {
    const prevista = render([row({ status: 'Agendada', slaMinutes: 90 })])
    const concluida = render([row({ slaMinutes: 90, serviceMinutes: 72 })])

    expect(prevista).toContain('>1h30<')
    expect(prevista).toContain('Tempo previsto de serviço no cliente para esta categoria')
    expect(concluida).toContain('>1h12 de 1h30<')
    expect(concluida).toContain('Serviço de 1h12, do início ao fim no cliente, contra 1h30 previstos')
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

    expect(html).toMatch(/class="impacto-text-action[^"]*"[^>]*>Restaurar tabela</)
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

describe('lista aberta pelo atalho com turno', () => {
  it('filtra por Sem técnico e pelo turno da legenda, e diz quantas ficaram', () => {
    const html = renderToStaticMarkup(
      <TodayOsTable
        id="os-today-list"
        initialFilters={{ technician: ['Sem técnico'], period: ['Manhã'] }}
        label="A fazer"
        onClose={() => {}}
        rows={[
          row({ id: 'OS-1', period: 'Manhã', technician: null, hasTechnician: false, status: 'Agendada' }),
          row({ id: 'OS-2', period: 'Tarde', technician: null, hasTechnician: false, status: 'Agendada' }),
          row({ id: 'OS-3', period: 'Manhã', status: 'Agendada' }),
        ]}
      />,
    )

    expect(html).toContain('A fazer: 1 de 3 OS')
    expect(html).toContain('OS-1')
    expect(html).not.toContain('OS-2')
    expect(html).not.toContain('OS-3')
  })
})

describe('a mesma lista na janela de OS do período', () => {
  const periodo = [row({ date: '2026-09-02' }), row({ id: 'OS-2026-9', date: '2026-08-30' })]

  function renderJanela(rows: readonly TodayOsRow[] = periodo) {
    return renderToStaticMarkup(
      <TodayOsTable
        columns={OS_LIST_COLUMNS}
        emptyMessage="Nenhuma OS nesta seleção."
        fill
        label="Cliente ausente"
        onDownload={() => {}}
        rows={rows}
      />,
    )
  }

  it('ganha a coluna Data na frente, com a data de cada OS', () => {
    const html = renderJanela()

    expect(html).toContain('title="Data"')
    expect(html.indexOf('title="Data"')).toBeLessThan(html.indexOf('title="OS"'))
    expect(html).toContain('02/09/2026')
    expect(html).toContain('30/08/2026')
  })

  it('oferece o Baixar Excel e não tem Fechar próprio: quem fecha é a janela', () => {
    const html = renderJanela()

    expect(html).toContain('Baixar Excel')
    expect(html).not.toContain('Fechar')
  })

  it('ocupa a altura da janela, em vez do teto fixo da faixa de hoje', () => {
    const html = renderJanela()

    expect(html).not.toContain('max-h-[380px]')
    expect(html).toContain('min-h-0 flex-1')
  })

  it('sem OS, diz o aviso da janela e não oferece planilha vazia', () => {
    const html = renderJanela([])

    expect(html).toContain('Nenhuma OS nesta seleção.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*Baixar Excel/s)
  })

  it('na agenda de hoje nada muda: sem Data, sem Baixar e com Fechar', () => {
    const html = render([row()])

    expect(html).not.toContain('title="Data"')
    expect(html).not.toContain('Baixar Excel')
    expect(html).toContain('Fechar')
    expect(html).toContain('max-h-[380px]')
  })
})

describe('ordenação anunciada no cabeçalho', () => {
  function header(label: string, chronological: boolean, sort: 'asc' | 'desc') {
    return renderToStaticMarkup(
      <ListColumnHeader
        filtered={false}
        label={label}
        onApply={() => {}}
        onSortChange={() => {}}
        options={[]}
        searchable={false}
        selected={[]}
        sort={sort}
        sortKind={chronological ? 'date' : 'text'}
        sortable
      />,
    )
  }

  it('a Data usa os nomes de calendário de Vendas por Período', () => {
    expect(header('Data', true, 'desc')).toContain('Ordenado: Mais recente primeiro')
    expect(header('Data', true, 'asc')).toContain('Ordenado: Mais antiga primeiro')
  })

  it('as colunas de texto seguem com Crescente e Decrescente', () => {
    expect(header('Cidade', false, 'asc')).toContain('Ordenado: Crescente')
    expect(header('Cidade', false, 'desc')).toContain('Ordenado: Decrescente')
  })
})

describe('lista da caixa buscando as OS', () => {
  it('linhas em cinza na lista de teto fixo, sem "0 OS" e sem Baixar Excel', () => {
    const html = renderToStaticMarkup(
      <TodayOsTable
        label="Em campo"
        loadingMessage="Buscando as OS no serviço de BI."
        onDownload={() => {}}
        rows={[]}
      />,
    )

    expect(html).toContain('data-skeleton="list"')
    expect(html.split('data-skeleton="list-row"').length - 1).toBe(6)
    expect(html).toContain('<span class="sr-only">Buscando as OS no serviço de BI.</span>')
    expect(html).not.toContain('0 OS')
    expect(html).not.toContain('lucide-download')
  })
})
