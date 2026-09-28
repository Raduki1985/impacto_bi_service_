import { describe, expect, it } from 'vitest'

import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import type { CommercialOverviewFilters } from './overviewModel'
import {
  buildTodaySalesWorkbook,
  describeTodaySalesListFilters,
  TODAY_SALES_EXPORT_COLUMNS,
  todaySalesExportFileName,
  todaySalesExportInfoRows,
  todaySalesExportRow,
  todaySalesPageFilters,
  type TodaySalesExportContext,
} from './todaySalesExport'
import { buildTodaySalesRows, type TodaySalesSelection } from './todaySalesModel'

/**
 * Teste espelho da planilha dos contratos da faixa Hoje ao vivo.
 *
 * O que ele protege: cada linha diz o mesmo que a lista (ausências por
 * extenso, situação e detalhe da tela), a marca de atenção como coluna só na
 * esteira, o sinal ligado só no contrato ativado, a aba de recorte e o nome
 * do arquivo.
 */

// Sexta-feira, 25/09/2026.
const TODAY = '2026-09-25'

function record(overrides: Partial<CommercialSaleRecord> = {}): CommercialSaleRecord {
  return {
    id: '01757155',
    status: 'pendente',
    statusKey: 'pending',
    stage: 'pendente',
    activated: false,
    contractedOn: TODAY,
    signedOn: null,
    createdAt: '2026-09-25T08:57:38-03:00',
    startedOn: null,
    startedAt: null,
    monthlyValue: 129.9,
    planName: 'res_600mb solo',
    cityId: 'atibaia',
    cityLabel: 'Atibaia',
    sellerId: 'v1',
    sellerName: 'Ana Maria dos Santos',
    team: 'comercial',
    teams: ['comercial'],
    indicated: false,
    customerKind: null,
    personType: 'pf',
    hasOpenOrder: false,
    hasInstallationOrder: false,
    hasUnproductiveOrder: false,
    nextVisitOn: null,
    lastVisitOn: null,
    lastOrderStatus: null,
    signalEvidence: [],
    replacedBy: null,
    ...overrides,
  }
}

const filters: CommercialOverviewFilters = {
  startDate: '2026-09-01',
  endDate: '2026-09-24',
  cityId: null,
  team: 'todos',
  sellerId: null,
  personType: 'todos',
}

/** As linhas da lista de uma caixa, pelo mesmo caminho da tela. */
const rowsOf = (records: CommercialSaleRecord[], selection: TodaySalesSelection) =>
  buildTodaySalesRows(records, selection, TODAY)
const lineOf = (item: CommercialSaleRecord, selection: TodaySalesSelection) =>
  todaySalesExportRow(rowsOf([item], selection)[0])
const column = (header: string) =>
  TODAY_SALES_EXPORT_COLUMNS.findIndex((item) => item.header === header)

describe('linha da planilha', () => {
  it('uma coluna para cada campo, na ordem do cabeçalho', () => {
    // Vendida na terça, 22/09: sem assinatura há 3 dias de trabalho.
    const line = lineOf(record({ contractedOn: '2026-09-22' }), { box: 'pending', late: false })

    expect(line).toHaveLength(TODAY_SALES_EXPORT_COLUMNS.length)
    expect(line).toEqual([
      '01757155',
      '2026-09-22',
      '2026-09',
      '08h57',
      'Pendente',
      '3 dias sem assinar',
      'Sim',
      'Ana Maria dos Santos',
      'Não',
      'Comercial',
      'Atibaia',
      'res_600mb solo',
      129.9,
      'PF',
      null,
      null,
      null,
      null,
    ])
  })

  it('ausências são escritas como na lista, e o Detalhe vazio fica vazio', () => {
    const cancelled = record({
      status: 'cancelada',
      stage: 'cancelada',
      createdAt: null,
      sellerId: null,
      sellerName: null,
      team: null,
      teams: [],
      personType: null,
    })
    const line = lineOf(cancelled, { box: 'sold', late: false })

    expect(line[column('Hora da venda')]).toBe('Sem hora')
    expect(line[column('Vendedor')]).toBe('Sem vendedor')
    expect(line[column('Time')]).toBe('Sem time')
    expect(line[column('Tipo de cliente')]).toBe('Sem tipo')
    expect(line[column('Situação')]).toBe('Cancelada')
    // O traço da tela é desenho; na planilha, célula vazia.
    expect(line[column('Detalhe')]).toBeNull()
  })

  it('Fora do prazo só existe na esteira', () => {
    const noPrazo = lineOf(record(), { box: 'sold', late: false })
    const cancelada = lineOf(record({ status: 'cancelada', stage: 'cancelada' }), { box: 'sold', late: false })

    expect(noPrazo[column('Fora do prazo')]).toBe('Não')
    expect(cancelada[column('Fora do prazo')]).toBeNull()
  })

  it('o sinal ligado sai só no contrato que conta como ativado', () => {
    // Início de sinal gravado num contrato que continua na fila: não virou cliente.
    const naFila = lineOf(
      record({ stage: 'agendada', status: 'agendada', startedOn: '2026-09-24', nextVisitOn: '2026-09-26' }),
      { box: 'scheduled', late: false },
    )
    const ativada = lineOf(
      record({
        status: 'ativa',
        statusKey: 'active',
        stage: null,
        activated: true,
        contractedOn: '2026-09-23',
        startedOn: TODAY,
        startedAt: '2026-09-25T10:14:00-03:00',
      }),
      { box: 'activated', late: false },
    )

    expect(naFila[column('Sinal ligado em')]).toBeNull()
    expect(naFila[column('Próxima visita')]).toBe('2026-09-26')
    expect(ativada[column('Sinal ligado em')]).toBe(TODAY)
    expect(ativada[column('Fora do prazo')]).toBeNull()
  })

  it('venda com indicação é marcada, porque não é do vendedor', () => {
    expect(lineOf(record({ indicated: true }), { box: 'sold', late: false })[column('Indicação')]).toBe('Sim')
  })

  it('não leva nome, documento, endereço nem telefone do cliente', () => {
    const headers = TODAY_SALES_EXPORT_COLUMNS.map((item) => item.header.toLowerCase())

    for (const sensitive of ['nome', 'cpf', 'cnpj', 'documento', 'endereço', 'telefone', 'e-mail']) {
      expect(headers.some((header) => header.includes(sensitive))).toBe(false)
    }
  })
})

describe('arquivo inteiro', () => {
  const context: TodaySalesExportContext = {
    selection: { box: 'pending', late: true },
    today: TODAY,
    queueFrom: '2026-01-01',
    pageFilters: null,
    listFilters: 'Cidade: Atibaia',
    readAt: '2026-09-25T15:02:11-03:00',
    generatedAt: '25/09/2026 15:03',
  }

  it('a tabela tem uma linha por contrato da lista, com o valor como número', () => {
    const rows = rowsOf(
      [record({ contractedOn: '2026-09-22' }), record({ id: '01757160', contractedOn: '2026-09-21' })],
      { box: 'pending', late: true },
    )
    // Sem compressão, o XML aparece inteiro dentro do arquivo.
    const text = new TextDecoder().decode(buildTodaySalesWorkbook(rows, context))

    expect(text).toContain('name="Contratos" displayName="Contratos" ref="A1:R3"')
    expect(text).toContain('<sheet name="Filtros"')
    expect(text).toContain('<c r="M2" s="5"><v>129.9</v></c>')
  })

  it('com os R$ escondidos, a coluna do valor sai vazia e a aba Filtros diz por quê', () => {
    const rows = rowsOf([record({ contractedOn: '2026-09-22' })], { box: 'pending', late: true })

    expect(todaySalesExportRow(rows[0], false)[12]).toBeNull()
    expect(todaySalesExportRow(rows[0])[12]).toBe(129.9)

    const text = new TextDecoder().decode(buildTodaySalesWorkbook(rows, context, false))
    expect(text).not.toContain('129.9')
    expect(text).toContain('Oculto nesta planilha')
  })

  it('a aba Filtros diz a caixa, o dia, o prazo e a hora da leitura', () => {
    expect(todaySalesExportInfoRows(context, 181)).toEqual([
      ['Seleção', 'Hoje ao vivo · Pendentes fora do prazo'],
      ['Período', 'Vendas desde 01/01/2026, ainda não ativadas em 25/09/2026'],
      [
        'Prazo',
        'Fora do prazo com 2 dias de trabalho ou mais depois da venda sem assinatura, sem contar domingo; ' +
          'não conta como fora do prazo a venda com sinal ligado no próprio contrato nem a refeita em outro ' +
          'contrato do cliente, no mesmo endereço, que já está com sinal',
      ],
      ['Filtros da página', 'Nenhum'],
      ['Filtros da lista', 'Cidade: Atibaia'],
      ['Contratos na planilha', '181'],
      ['Fonte', 'SGI, pelo serviço de BI'],
      ['Dados lidos em', '25/09/2026 15:02'],
      ['Gerada em', '25/09/2026 15:03'],
    ])
  })

  it('Vendidas e Ativadas são de hoje e não têm prazo', () => {
    const sold = todaySalesExportInfoRows({ ...context, selection: { box: 'sold', late: false } }, 12)
    const activated = todaySalesExportInfoRows({ ...context, selection: { box: 'activated', late: false } }, 9)

    expect(sold).toContainEqual(['Período', 'Vendas de hoje, 25/09/2026'])
    expect(activated).toContainEqual(['Período', 'Sinal ligado hoje, 25/09/2026'])
    expect(sold.map(([label]) => label)).not.toContain('Prazo')
  })

  it('o prazo da Agendada é de 1 dia, no singular', () => {
    const rows = todaySalesExportInfoRows({ ...context, selection: { box: 'scheduled', late: false } }, 3)

    expect(rows).toContainEqual([
      'Prazo',
      'Fora do prazo com 1 dia de trabalho ou mais depois da data da visita, sem sinal e sem outra visita marcada, ' +
        'sem contar domingo; não conta como fora do prazo a venda com sinal ligado no próprio contrato nem a ' +
        'refeita em outro contrato do cliente, no mesmo endereço, que já está com sinal',
    ])
  })

  it('a venda resolvida fora do fluxo sai com o motivo no Detalhe e Não em Fora do prazo', () => {
    const rows = rowsOf(
      [
        record({ id: 'com-sinal', contractedOn: '2026-09-10', signalEvidence: ['equipment_online'] }),
        record({ id: 'refeita', contractedOn: '2026-09-10', replacedBy: '01441111' }),
      ],
      { box: 'pending', late: false },
    )

    expect(rows.map((row) => todaySalesExportRow(row).slice(5, 7))).toEqual([
      ['Com sinal, falta ativar', 'Não'],
      ['Refeita no 01441111', 'Não'],
    ])
  })

  it('sem a hora da leitura, a aba não inventa uma', () => {
    const labels = todaySalesExportInfoRows({ ...context, readAt: null }, 1).map(([label]) => label)

    expect(labels).not.toContain('Dados lidos em')
    expect(labels).toContain('Gerada em')
  })
})

describe('textos da planilha', () => {
  it('filtros da página pelo nome, sem o período, que não vale para a faixa', () => {
    const records = [record(), record({ id: 'b', cityId: 'piracaia', cityLabel: 'Piracaia', sellerId: 'v2', sellerName: 'Bia Lima' })]

    expect(todaySalesPageFilters(filters, records)).toBeNull()
    expect(
      todaySalesPageFilters(
        { ...filters, cityId: 'piracaia', team: 'corporativo', sellerId: 'v2', personType: 'pj' },
        records,
      ),
    ).toBe('Cidade: Piracaia · Time: Corporativo · Vendedor: Bia Lima · Tipo de cliente: PJ')
    // Sem contrato com aquele id, o id cru, como o chip da faixa de filtros.
    expect(todaySalesPageFilters({ ...filters, sellerId: 'v9' }, records)).toBe('Vendedor: v9')
  })

  it('filtros de coluna viram texto, só os que têm valor escolhido', () => {
    expect(describeTodaySalesListFilters({})).toBeNull()
    expect(describeTodaySalesListFilters({ city: ['Atibaia', 'Piracaia'], team: [], seller: ['Ana'] })).toBe(
      'Vendedor: Ana · Cidade: Atibaia, Piracaia',
    )
  })

  it('o nome do arquivo diz a lista e o dia, sem acento nem espaço', () => {
    expect(todaySalesExportFileName({ box: 'pending', late: true }, TODAY)).toBe(
      'contratos-pendentes-fora-do-prazo-2026-09-25.xlsx',
    )
    expect(todaySalesExportFileName({ box: 'sold', late: false }, TODAY)).toBe('contratos-vendidas-2026-09-25.xlsx')
  })
})
