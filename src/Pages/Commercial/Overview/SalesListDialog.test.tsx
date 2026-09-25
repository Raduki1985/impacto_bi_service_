import * as Dialog from '@radix-ui/react-dialog'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import type { SalesListSelection } from './salesListModel'
import { SalesListPanel, type SalesMonthLoad } from './SalesListDialog'
import { initialCommercialOverviewFilters, type CommercialOverviewFilters } from './overviewModel'

/**
 * Teste espelho do conteúdo da janela de contratos, aberta pela Safra de
 * vendas por mês e pela Evolução mensal das vendas.
 *
 * A casca da janela usa portal, que só existe no navegador; o conteúdo é
 * desenhado aqui dentro do contexto da janela. O que ele protege: a janela
 * diz de onde veio, de que mês e com que filtros, mostra os atalhos com a
 * contagem, aplica os filtros da página e diz quando ainda está lendo.
 */

let sequence = 0

function record(overrides: Partial<CommercialSaleRecord> = {}): CommercialSaleRecord {
  sequence += 1

  return {
    id: String(2000 + sequence),
    status: 'agendada',
    statusKey: 'scheduled',
    stage: 'agendada',
    activated: false,
    contractedOn: '2026-07-05',
    signedOn: '2026-07-05',
    createdAt: '2026-07-05T10:00:00-03:00',
    startedOn: null,
    startedAt: null,
    monthlyValue: 99.9,
    planName: 'res_600mb solo',
    cityId: 'atibaia',
    cityLabel: 'Atibaia',
    sellerId: 'v1',
    sellerName: 'Ana Souza',
    team: 'comercial',
    teams: ['comercial'],
    indicated: false,
    customerKind: null,
    personType: 'pf',
    hasOpenOrder: false,
    hasInstallationOrder: true,
    hasUnproductiveOrder: true,
    nextVisitOn: null,
    lastVisitOn: '2026-07-08',
    lastOrderStatus: 'unproductive',
    ...overrides,
  }
}

const records = [
  record(),
  record({ cityId: 'piracaia', cityLabel: 'Piracaia' }),
  record({ stage: null, status: 'ativa', statusKey: 'active', activated: true, startedOn: '2026-07-06' }),
]

const filters: CommercialOverviewFilters = initialCommercialOverviewFilters()

function render(
  selection: SalesListSelection,
  load: SalesMonthLoad = { status: 'ready', records, generatedAt: '2026-09-25T10:02:11-03:00' },
  pageFilters: CommercialOverviewFilters = filters,
) {
  return renderToStaticMarkup(
    <Dialog.Root open>
      <SalesListPanel
        filters={pageFilters}
        load={load}
        onSelect={() => {}}
        panelContainer={null}
        selection={selection}
        theme="light"
      />
    </Dialog.Root>,
  )
}

describe('janela aberta pela fatia Aguarda hoje', () => {
  const html = render({ kind: 'cohort', month: '2026-07', bucket: 'awaiting' })

  it('diz de que painel veio, de que mês e com que filtros', () => {
    expect(html).toContain('Safra de vendas por mês')
    expect(html).toContain('Vendidas em julho de 2026, na situação de hoje · sem outros filtros')
  })

  it('a lista tem o número da fatia', () => {
    expect(html).toContain('Julho de 2026 · Aguarda hoje: 2 contratos')
    expect(html).toContain('Improdutiva em 08/07')
  })

  it('os atalhos trazem as fatias do mês com a contagem, e o aceso é o clicado', () => {
    expect(html).toMatch(/aria-pressed="false"[^>]*>Todas<span class="font-mono">3<\/span>/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Aguarda hoje<span class="font-mono">2<\/span>/s)
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*Ativou no mês<span class="font-mono">1<\/span>/s)
  })

  it('tem Fechar da janela e Baixar Excel da lista', () => {
    expect(html).toContain('Fechar')
    expect(html).toContain('Baixar Excel')
  })
})

describe('filtros da página valem na janela', () => {
  it('com uma cidade escolhida, só os contratos dela, e a cidade na linha de contexto', () => {
    const html = render({ kind: 'cohort', month: '2026-07', bucket: null }, undefined, { ...filters, cityId: 'piracaia' })

    expect(html).toContain('Vendidas em julho de 2026, na situação de hoje · Cidade: Piracaia')
    expect(html).toContain('Julho de 2026 · Todas as vendas: 1 contrato')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Todas<span class="font-mono">1<\/span>/)
  })

  it('time pelo vínculo do vendedor, e tipo de cliente sem tipo fica fora do PJ', () => {
    const mixed = [
      record({ teams: ['comercial', 'corporativo'] }),
      record(),
      record({ personType: 'pj' }),
      record({ personType: null }),
    ]
    const load: SalesMonthLoad = { status: 'ready', records: mixed, generatedAt: null }
    const month: SalesListSelection = { kind: 'cohort', month: '2026-07', bucket: null }

    expect(render(month, load, { ...filters, team: 'corporativo' })).toContain(
      'Julho de 2026 · Todas as vendas: 1 contrato',
    )
    expect(render(month, load, { ...filters, personType: 'pj' })).toContain(
      'Julho de 2026 · Todas as vendas: 1 contrato',
    )
  })

  it('filtro que zera o mês: sem atalho e a lista diz que não há contrato', () => {
    const html = render({ kind: 'cohort', month: '2026-07', bucket: 'awaiting' }, undefined, { ...filters, cityId: 'joanopolis' })

    expect(html).not.toContain('aria-pressed')
    expect(html).toContain('Nenhum contrato nesta seleção.')
  })
})

describe('janela aberta pela Evolução mensal', () => {
  it('diz o painel e a régua do sinal, e os atalhos são os grupos da barra', () => {
    const html = render({ kind: 'monthly', month: '2026-07', team: 'comercial' })

    expect(html).toContain('Evolução mensal das vendas')
    expect(html).toContain('Sinal ligado em julho de 2026 · sem outros filtros')
    // Só o contrato ativado com sinal em julho; os dois agendados não são ativação.
    expect(html).toContain('Julho de 2026 · Comercial: 1 contrato')
    expect(html).toMatch(/aria-pressed="false"[^>]*>Todas<span class="font-mono">1<\/span>/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*Comercial<span class="font-mono">1<\/span>/s)
    expect(html).toContain('aria-label="Trocar de time, ativações de julho de 2026"')
  })
})

describe('leitura dos contratos do mês', () => {
  it('enquanto lê, diz o que busca e não mostra lista nem atalho', () => {
    const html = render({ kind: 'cohort', month: '2026-07', bucket: 'awaiting' }, { status: 'loading' })

    expect(html).toContain('Julho de 2026 · buscando os contratos no serviço de BI')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('Baixar Excel')
    expect(html).not.toContain('aria-pressed')
  })

  it('na falha, mostra a mensagem do serviço como alerta', () => {
    const html = render({ kind: 'cohort', month: '2026-07', bucket: 'awaiting' }, { status: 'error', message: 'Serviço fora do ar.' })

    expect(html).toContain('role="alert"')
    expect(html).toContain('Serviço fora do ar.')
  })
})
