import { describe, expect, it } from 'vitest'

import type { OverviewOsRecord } from '../../data/overviewOsData'
import {
  buildOsWorkbook,
  describeListFilters,
  OS_EXPORT_COLUMNS,
  osExportFileName,
  osExportInfoRows,
  osExportPeriod,
  osExportRow,
  osExportSource,
  periodDownloadLabel,
  type OsExportContext,
} from './osListExport'
import { REASON_MISSING } from './overviewReasonsChartOptions'
import { toPeriodOsRow } from './todayOsModel'
import { OS_LIST_COLUMNS } from './todayOsTableModel'

/**
 * Teste espelho da planilha de OS da Visão Geral.
 *
 * O que ele protege: cada linha diz o mesmo que a tela (turno, técnico e
 * equipe com o texto da lista; grupo, destino e motivo pela regra dos
 * painéis), as colunas de apoio para tabela dinâmica (semana começando na
 * segunda, mês que ordena certo), a aba de recorte e o nome do arquivo.
 */

function record(overrides: Partial<OverviewOsRecord> = {}): OverviewOsRecord {
  return {
    id: 'OS-2026-4924',
    dateISO: '2026-09-06',
    period: 'Manhã',
    technicianId: 'tec-1',
    team: 'Terceirizada',
    serviceType: 'Instalação',
    category: 'Fibra Instalação',
    city: 'Mairiporã',
    status: 'Improdutiva',
    statusKey: 'unproductive',
    resolution: null,
    startedAt: null,
    finishedAt: '2026-09-06T10:01:13.888790-03:00',
    travelMinutes: 14.8,
    difficulty: null,
    unproductiveReason: 'Cliente ausente',
    // Como o serviço manda a OS nas listas do período (01/10/2026).
    outcome: 'unproductive',
    group: 'customer',
    listReason: 'Cliente ausente',
    ...overrides,
  }
}

const names = new Map([['tec-1', 'Ana Souza']])
const linha = (overrides: Partial<OverviewOsRecord> = {}) =>
  osExportRow(toPeriodOsRow(record(overrides), names))
const coluna = (header: string) =>
  OS_EXPORT_COLUMNS.findIndex((column) => column.header === header)

describe('linha da planilha', () => {
  it('uma coluna para cada campo, na ordem do cabeçalho', () => {
    expect(linha()).toHaveLength(OS_EXPORT_COLUMNS.length)
    expect(linha()).toEqual([
      '2026-09-06',
      '2026-08-31',
      '2026-09',
      'OS-2026-4924',
      'Manhã',
      'OS de cliente',
      'Improdutiva',
      'Improdutiva',
      'Instalação',
      'Fibra Instalação',
      'Mairiporã',
      'Ana Souza',
      'Terceirizada',
      'Cliente ausente',
      null,
      null,
      null,
      '2026-09-06T10:01:13.888790-03:00',
      14.8,
    ])
  })

  it('a semana começa na segunda, a mesma dos atalhos de período', () => {
    // 06/09/2026 é domingo: a semana é a que começou em 31/08.
    expect(linha({ dateISO: '2026-09-06' })[coluna('Início da semana')]).toBe('2026-08-31')
    expect(linha({ dateISO: '2026-09-07' })[coluna('Início da semana')]).toBe('2026-09-07')
  })

  it('turno, técnico e equipe ausentes são escritos como na lista', () => {
    const vazia = linha({ period: null, technicianId: null, team: null })

    expect(vazia[coluna('Turno')]).toBe('Sem turno')
    expect(vazia[coluna('Técnico')]).toBe('Sem técnico')
    expect(vazia[coluna('Equipe')]).toBe('Sem equipe')
    expect(linha({ technicianId: 'tec-9' })[coluna('Técnico')]).toBe('Técnico sem nome')
  })

  it('o motivo sai só na improdutiva, e a sem motivo leva o nome da barra cinza', () => {
    expect(
      linha({ unproductiveReason: null, listReason: REASON_MISSING })[coluna('Motivo da improdutiva')],
    ).toBe(REASON_MISSING)
    const concluida = linha({
      status: 'Concluída',
      statusKey: 'completed',
      outcome: 'completed',
      resolution: 'Instalação Realizada',
      unproductiveReason: 'Cliente ausente',
      listReason: null,
    })

    expect(concluida[coluna('Motivo da improdutiva')]).toBeNull()
    expect(concluida[coluna('Resolução')]).toBe('Instalação Realizada')
    expect(concluida[coluna('Destino')]).toBe('Concluída')
  })

  it('a resolução sai só na concluída, como no ranking de resoluções', () => {
    // Encerrada que carrega resolução no SGI: o ranking não a conta, e a
    // tabela dinâmica da planilha também não pode contar.
    const encerrada = linha({
      status: 'Encerrada',
      statusKey: 'closed',
      outcome: 'notExecuted',
      resolution: 'Instalação Realizada',
    })
    const improdutiva = linha({ resolution: 'Não Realizado, Local sem Viabilidade' })

    expect(encerrada[coluna('Resolução')]).toBeNull()
    expect(improdutiva[coluna('Resolução')]).toBeNull()
  })

  it('campo que a fonte não traz sai vazio, e não como ausência do SGI', () => {
    // O formato da base local de estudo: sem turno e sem motivo no registro.
    const semCampos = record()
    delete (semCampos as { period?: unknown }).period
    delete (semCampos as { unproductiveReason?: unknown }).unproductiveReason
    delete (semCampos as { listReason?: unknown }).listReason
    const row = osExportRow(toPeriodOsRow(semCampos, names))

    expect(row[coluna('Turno')]).toBeNull()
    expect(row[coluna('Motivo da improdutiva')]).toBeNull()
  })

  it('grupo e destino são os que o serviço mandou com a OS, a regra dos painéis', () => {
    const infra = linha({
      serviceType: 'Infraestrutura',
      status: 'Expirada',
      statusKey: 'expired',
      group: 'infrastructure',
      outcome: 'notExecuted',
    })

    expect(infra[coluna('Grupo')]).toBe('Infraestrutura')
    expect(infra[coluna('Destino')]).toBe('Não executada')
    expect(linha({ status: 'Agendada', statusKey: 'scheduled', outcome: 'open' })[coluna('Destino')]).toBe(
      'Em aberto',
    )
    // Chave de status que o de-para não conhece: contada, com o nome da fatia.
    expect(linha({ status: 'Rascunho', statusKey: 'draft', outcome: 'unknown' })[coluna('Destino')]).toBe(
      'Sem classificação',
    )
  })

  it('não leva cliente, endereço, telefone nem observação', () => {
    const headers = OS_EXPORT_COLUMNS.map((column) => column.header.toLowerCase())

    for (const sensitive of ['cliente', 'endereço', 'telefone', 'observação', 'contato']) {
      expect(headers.some((header) => header.includes(sensitive))).toBe(false)
    }
  })
})

describe('arquivo inteiro', () => {
  const context: OsExportContext = {
    selection: 'Motivos de improdutiva · Cliente ausente',
    period: 'Setembro de 2026, até o dia 23 (01/09/2026 a 23/09/2026)',
    pageFilters: null,
    listFilters: 'Cidade: Mairiporã',
    source: 'SGI, pelo serviço de BI',
    readAt: '2026-09-24T08:02:11.123-03:00',
    generatedAt: '24/09/2026 09:05',
  }

  it('a tabela tem uma linha por OS da lista', () => {
    const rows = [record(), record({ id: 'OS-2026-4925' })].map((item) => toPeriodOsRow(item, names))
    // Sem compressão, o XML aparece inteiro dentro do arquivo.
    const text = new TextDecoder().decode(buildOsWorkbook(rows, context))

    expect(text).toContain('<table xmlns=')
    expect(text).toContain('name="OrdensDeServico" displayName="OrdensDeServico" ref="A1:S3"')
    expect(text).toContain('<sheet name="Filtros"')
  })

  it('a aba Filtros diz de onde a planilha saiu, e os filtros da lista só quando ela veio de uma', () => {
    expect(osExportInfoRows(context, 66)).toEqual([
      ['Seleção', 'Motivos de improdutiva · Cliente ausente'],
      ['Período', 'Setembro de 2026, até o dia 23 (01/09/2026 a 23/09/2026)'],
      ['Filtros da página', 'Nenhum'],
      ['Filtros da lista', 'Cidade: Mairiporã'],
      ['OS na planilha', '66'],
      ['Fonte', 'SGI, pelo serviço de BI'],
      // A hora da leitura do banco, e não a do clique: é dela os status.
      ['Dados lidos em', '24/09/2026 08:02'],
      ['Gerada em', '24/09/2026 09:05'],
    ])
    const periodo = osExportInfoRows({ ...context, listFilters: undefined }, 1498)

    expect(periodo.map(([label]) => label)).not.toContain('Filtros da lista')
    expect(periodo).toContainEqual(['OS na planilha', '1.498'])
  })

  it('sem a hora da leitura, a aba não inventa uma', () => {
    const labels = osExportInfoRows({ ...context, readAt: null }, 66).map(([label]) => label)

    expect(labels).not.toContain('Dados lidos em')
    expect(labels).toContain('Gerada em')
  })

  it('filtros de coluna viram texto, só os que têm valor escolhido', () => {
    expect(describeListFilters({}, OS_LIST_COLUMNS)).toBeNull()
    expect(
      describeListFilters({ city: ['Atibaia', 'Piracaia'], team: [], technician: ['Ana Souza'] }, OS_LIST_COLUMNS),
    ).toBe('Cidade: Atibaia, Piracaia · Técnico: Ana Souza')
  })
})

describe('textos da planilha', () => {
  const hoje = '2026-09-24'

  it('o período vai pelo nome e pelas datas; o recorte livre, só pelas datas', () => {
    expect(osExportPeriod({ dateFrom: '2026-09-01', dateTo: '2026-09-23' }, hoje)).toBe(
      'Setembro de 2026, até o dia 23 (01/09/2026 a 23/09/2026)',
    )
    expect(osExportPeriod({ dateFrom: '2026-09-03', dateTo: '2026-09-10' }, hoje)).toBe(
      '03/09/2026 a 10/09/2026',
    )
  })

  it('um dia e uma semana também vão pelo nome, como no título da página', () => {
    expect(osExportPeriod({ dateFrom: '2026-09-21', dateTo: '2026-09-21' }, hoje)).toBe(
      'Segunda-feira, 21/09/2026 (21/09/2026 a 21/09/2026)',
    )
    expect(osExportPeriod({ dateFrom: '2026-09-14', dateTo: '2026-09-20' }, hoje)).toBe(
      'Semana de 14/09 a 20/09/2026 (14/09/2026 a 20/09/2026)',
    )
  })

  it('período que alcança hoje leva o aviso da página: os status de hoje ainda mudam', () => {
    expect(osExportPeriod({ dateFrom: '2026-09-01', dateTo: '2026-09-24' }, hoje)).toBe(
      'Setembro de 2026, até o dia 24 (01/09/2026 a 24/09/2026) · inclui hoje, ainda em andamento',
    )
  })

  it('a fonte diz se é o SGI ou a base local de estudo', () => {
    expect(osExportSource('api', '2026-09-24')).toBe(
      'SGI, pelo serviço de BI, com dados atualizados em 24/09/2026',
    )
    expect(osExportSource('local', null)).toContain('Base local de estudo')
  })

  it('o botão do período diz quantas OS e em que formato', () => {
    expect(periodDownloadLabel(1498)).toBe('Baixar 1.498 OS em Excel')
    expect(periodDownloadLabel(1)).toBe('Baixar 1 OS em Excel')
  })

  it('o nome do arquivo diz a seleção e as datas, sem acento nem espaço', () => {
    const setembro = { dateFrom: '2026-09-01', dateTo: '2026-09-23' }

    expect(osExportFileName('Cliente ausente', setembro)).toBe(
      'os-cliente-ausente-2026-09-01-a-2026-09-23.xlsx',
    )
    expect(osExportFileName('OS de cliente · Não executada', setembro)).toBe(
      'os-de-cliente-nao-executada-2026-09-01-a-2026-09-23.xlsx',
    )
    expect(osExportFileName('Todas as improdutivas', setembro)).toBe(
      'os-todas-as-improdutivas-2026-09-01-a-2026-09-23.xlsx',
    )
    expect(osExportFileName(null, setembro)).toBe('os-2026-09-01-a-2026-09-23.xlsx')
  })
})
