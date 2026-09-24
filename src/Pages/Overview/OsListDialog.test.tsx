import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import { defaultOverviewOsFilters } from '../../data/overviewOsFilters'
import type { OsListSelection } from './osListModel'
import { OsListPanel } from './OsListDialog'

/**
 * Teste espelho do conteúdo da janela de OS.
 *
 * A casca da janela usa portal, que só existe no navegador; o conteúdo é
 * desenhado aqui dentro do contexto da janela, que é o que o título e o
 * botão Fechar exigem. O que ele protege: a janela diz de onde veio, de que
 * período e com que filtros, mostra os atalhos com a contagem e abre a lista
 * com o número da barra.
 */

let sequence = 0

function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  sequence += 1

  return {
    id: `OS-2026-${sequence}`,
    dateISO: '2026-09-02',
    period: 'Manhã',
    technicianId: 'tec-1',
    team: 'Terceirizada',
    serviceType: 'Instalação',
    category: 'Fibra Instalação',
    city: 'Atibaia',
    status: 'Improdutiva',
    statusKey: 'unproductive',
    resolution: null,
    unproductiveReason: 'Cliente ausente',
    ...overrides,
  }
}

const records = [
  record(),
  record({ dateISO: '2026-09-01', serviceType: 'Infraestrutura' }),
  record({ unproductiveReason: 'Clima ou segurança' }),
  record({ status: 'Encerrada', statusKey: 'closed', unproductiveReason: null }),
]

const filters = { ...defaultOverviewOsFilters, dateFrom: '2026-09-01', dateTo: '2026-09-23' }

function render(selection: OsListSelection) {
  return renderToStaticMarkup(
    <Dialog.Root open>
      <OsListPanel
        coverage={{ min: '2026-04-06', max: '2026-09-30' }}
        filters={filters}
        onSelect={() => {}}
        origin="api"
        panelContainer={null}
        readAt="2026-09-24T08:02:11-03:00"
        records={records}
        selection={selection}
        technicianNames={new Map([['tec-1', 'Ana Souza']])}
        updatedAt="2026-09-24"
      />
    </Dialog.Root>,
  )
}

describe('janela aberta pelo painel de motivos', () => {
  const html = render({ kind: 'reason', reason: 'Cliente ausente' })

  it('diz de que painel veio, de que período e com que filtros', () => {
    expect(html).toContain('Motivos de improdutiva')
    expect(html).toContain('Setembro de 2026, até o dia 23 · sem outros filtros')
  })

  it('a lista tem o número da barra, de cliente e de infraestrutura', () => {
    expect(html).toContain('Cliente ausente: 2 OS')
    expect(html).toContain('Ana Souza')
    expect(html).toContain('02/09/2026')
  })

  it('os atalhos trazem as barras do painel com a contagem, e o aceso é o clicado', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Cliente ausente<span class="font-mono">2<\/span>/s)
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Clima ou segurança<span class="font-mono">1<\/span>/s)
  })

  it('o primeiro atalho é "Todas", com todas as improdutivas e sem a cor de barra', () => {
    expect(html).toMatch(/aria-pressed="false"[^>]*>Todas<span class="font-mono">3<\/span>/)
  })

  it('tem Fechar da janela e Baixar Excel da lista', () => {
    expect(html).toContain('Fechar')
    expect(html).toContain('Baixar Excel')
  })
})

describe('janela aberta pelo Destino das OS', () => {
  it('nomeia o grupo e a saída, e só oferece saídas daquele grupo', () => {
    const html = render({ kind: 'outcome', group: 'customer', outcome: 'notExecuted' })

    expect(html).toContain('Destino das OS do período')
    expect(html).toContain('OS de cliente · Não executada: 1 OS')
    expect(html).toContain('aria-label="Trocar de saída, OS de cliente"')
    // A improdutiva de infraestrutura não entra no atalho das OS de cliente.
    expect(html).toMatch(/Improdutiva<span class="font-mono">2<\/span>/)
    // "Todas" é a barra inteira das OS de cliente: 2 improdutivas e 1 encerrada.
    expect(html).toMatch(/>Todas<span class="font-mono">3<\/span>/)
  })

  it('no "Todas", a lista diz que são todas e baixa o painel inteiro', () => {
    const html = render({ kind: 'reason', reason: null })

    expect(html).toContain('Todas as improdutivas: 3 OS')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Todas<span class="font-mono">3<\/span>/)
    expect(html).toContain('Baixar Excel')
  })
})

describe('janela aberta pelo Volume diário', () => {
  it('diz o dia na linha de contexto, e os atalhos são as séries do dia', () => {
    const html = render({ kind: 'day', date: '2026-09-02', series: 'unproductive' })

    expect(html).toContain('Volume diário de OS')
    // O período da lista é o dia clicado, e não o mês da página.
    expect(html).toContain('Quarta-feira, 02/09/2026 · sem outros filtros')
    // No dia 02/09: duas improdutivas e uma encerrada; a de infraestrutura é do dia 01.
    expect(html).toContain('Improdutivas: 2 OS')
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Total<span class="font-mono">3<\/span>/s)
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Improdutivas<span class="font-mono">2<\/span>/s)
    // A encerrada do dia tem atalho próprio; concluída não houve, e não aparece.
    expect(html).toMatch(/Não executadas<span class="font-mono">1<\/span>/)
    expect(html).not.toContain('Concluídas<span')
  })
})
