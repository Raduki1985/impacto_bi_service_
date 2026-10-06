import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CommercialPeriodSaleRecord } from '../../../data/api/commercialRecordsSource'
import { ActivatedSalesButton } from './ActivatedSalesButton'
import { ActivatedSalesPanel, type ActivatedSalesLoad } from './ActivatedSalesDialog'
import { initialCommercialOverviewFilters } from './overviewModel'
import type { PeriodPart } from './periodSalesExport'

/**
 * Teste espelho da janela do card Vendas ativadas e do ícone que a abre
 * (06/10/2026).
 *
 * A casca usa portal, que só existe no navegador; o conteúdo é desenhado
 * aqui dentro do contexto da janela. O que ele protege: a janela tem o nome
 * do card, diz o período e os filtros, traz os três atalhos na ordem da
 * leitura do card com a lista do aceso, não conta outra história, e diz
 * quando ainda lê.
 */

let sequence = 0

function record(overrides: Partial<CommercialPeriodSaleRecord> = {}): CommercialPeriodSaleRecord {
  sequence += 1

  return {
    id: String(4000 + sequence),
    status: 'ativa',
    statusKey: 'active',
    stage: null,
    activated: true,
    contractedOn: '2026-09-10',
    signedOn: '2026-09-10',
    createdAt: '2026-09-10T10:00:00-03:00',
    startedOn: '2026-09-11',
    startedAt: '2026-09-11T14:00:00-03:00',
    monthlyValue: 99.9,
    planName: 'res_600mb solo',
    cityId: 'atibaia',
    cityLabel: 'Atibaia',
    sellerId: 'v1',
    sellerName: 'Ana Souza',
    team: 'comercial',
    teams: ['comercial'],
    indicated: false,
    customerKind: 'novo',
    personType: 'pf',
    hasOpenOrder: false,
    hasInstallationOrder: true,
    hasUnproductiveOrder: false,
    nextVisitOn: null,
    lastVisitOn: '2026-09-11',
    lastOrderStatus: 'completed',
    signalEvidence: [],
    replacedBy: null,
    late: false,
    outsideFlow: null,
    soldInPeriod: true,
    activatedInPeriod: true,
    ...overrides,
  }
}

const records = [
  // Vendida no período e ainda na fila: o serviço manda, a janela não lista.
  record({
    status: 'pendente',
    stage: 'pendente',
    activated: false,
    startedOn: null,
    startedAt: null,
    activatedInPeriod: false,
  }),
  record(),
  record({ startedAt: '2026-09-12T10:00:00-03:00', startedOn: '2026-09-12' }),
  record({ contractedOn: '2026-08-28', createdAt: '2026-08-28T09:00:00-03:00', soldInPeriod: false }),
]
const range = { dateFrom: '2026-09-01', dateTo: '2026-09-30' }
const filters = initialCommercialOverviewFilters()
const names = { cities: [], sellers: [] }

function render(part: PeriodPart, load: ActivatedSalesLoad = { status: 'ready', records, generatedAt: null }) {
  return renderToStaticMarkup(
    <Dialog.Root open>
      <ActivatedSalesPanel
        filters={filters}
        load={load}
        names={names}
        onSelect={() => {}}
        panelContainer={null}
        part={part}
        range={range}
        theme="light"
      />
    </Dialog.Root>,
  )
}

describe('janela do card Vendas ativadas', () => {
  const html = render('earlier')
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  it('tem o nome do card e diz o período e os filtros', () => {
    expect(html).toContain('Vendas ativadas')
    expect(html).toContain('Setembro de 2026 · sem outros filtros')
    expect(html).not.toContain('Contratos do período')
  })

  it('traz os três números do card, na ordem da leitura dele, e o aceso é o da lista', () => {
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Total ativado<span class="font-mono">3<\/span>/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Vendidas no período<span class="font-mono">2<\/span>/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Vendidas antes do período<span class="font-mono">1<\/span>/)
    expect(text.indexOf('Total ativado 3')).toBeLessThan(text.indexOf('Vendidas no período 2'))
    expect(text.indexOf('Vendidas no período 2')).toBeLessThan(text.indexOf('Vendidas antes do período 1'))
  })

  it('não conta outra história: sem parágrafo, sem vendido, sem fila', () => {
    expect(text).not.toContain('No período, vendemos')
    expect(html).not.toContain('Em fluxo')
    expect(html).not.toContain('Ativaram depois')
    expect(html).not.toMatch(/>Vendidas<span/)
  })

  it('a lista é a do número escolhido, com Baixar Excel', () => {
    expect(html).toContain('Setembro de 2026 · Vendidas antes do período e ativadas nele: 1 contrato')
    expect(html).toContain('Baixar Excel')
  })

  it('no total, a lista traz só quem ligou o sinal no período; a fila fica de fora', () => {
    expect(render('activated')).toContain('Setembro de 2026 · Total ativado no período: 3 contratos')
  })

  it('sem contrato no período, os três atalhos ficam com zero e a lista diz que está vazia', () => {
    const empty = render('activated', { status: 'ready', records: [], generatedAt: null })

    expect(empty).toMatch(/Total ativado<span class="font-mono">0<\/span>/)
    expect(empty).toMatch(/Vendidas antes do período<span class="font-mono">0<\/span>/)
    expect(empty).toContain('Nenhum contrato nesta seleção.')
  })

  it('enquanto lê, diz que está buscando, sem atalho nem lista', () => {
    const loading = render('activated', { status: 'loading' })

    expect(loading).toContain('Buscando no serviço de BI os contratos de setembro de 2026.')
    expect(loading).not.toContain('Baixar Excel')
  })

  it('na falha, mostra o motivo como alerta', () => {
    expect(render('activated', { status: 'error', message: 'Serviço fora do ar.' })).toMatch(
      /role="alert"[^>]*>Serviço fora do ar\./,
    )
  })
})

describe('ícone do card', () => {
  const html = renderToStaticMarkup(<ActivatedSalesButton label="Ver e baixar os 651 contratos ativados no período" onOpen={() => {}} />)

  it('é um botão com nome, a dica do mouse, o ícone XLSX e a cor das ações de texto, sem caixa', () => {
    expect(html).toContain('aria-label="Ver e baixar os 651 contratos ativados no período"')
    expect(html).toContain('title="Ver e baixar os 651 contratos ativados no período"')
    expect(html).toContain('>XLSX</text>')
    // Azul do acento no claro, verde no escuro, pela mesma classe das ações
    // de texto; a caixa verde de antes saiu (pedido do Mário em 06/10/2026).
    expect(html).toContain('impacto-text-action')
    expect(html).toContain('text-[var(--accent)]')
    expect(html).not.toContain('#00a862')
    expect(html).toContain('type="button"')
  })
})
