import { describe, expect, it } from 'vitest'

import {
  buildXlsx,
  columnLetter,
  crc32,
  excelDateSerial,
  excelDateTimeSerial,
  type XlsxSheet,
} from './xlsxWriter'

/**
 * Teste espelho da planilha montada no navegador.
 *
 * O que ele protege é o que faria o Excel pedir reparo ou mostrar número
 * errado: o pacote .zip íntegro (cada arquivo com a soma de conferência
 * certa), a Tabela do Excel com o mesmo tamanho dos dados, data como data e
 * não como texto, e texto do SGI com caractere especial escapado.
 */

/** Lê um .zip sem compressão, o único que o módulo escreve, conferindo a soma de cada arquivo. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  const files = new Map<string, string>()
  let offset = 0

  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(0)
    const crc = view.getUint32(offset + 14, true)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size)
    expect(crc32(data)).toBe(crc)
    files.set(name, decoder.decode(data))
    offset += 30 + nameLength + size
  }

  // O índice central lista os mesmos arquivos, e o fecho aponta para ele.
  const end = bytes.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  expect(view.getUint16(end + 10, true)).toBe(files.size)
  expect(view.getUint32(end + 16, true)).toBe(offset)

  return files
}

const dados: XlsxSheet = {
  name: 'OS',
  table: 'OrdensDeServico',
  columns: [
    { header: 'Data', width: 11, type: 'date' },
    { header: 'OS', width: 14, type: 'text' },
    { header: 'Início do serviço', width: 17, type: 'datetime' },
    { header: 'Deslocamento (min)', width: 18, type: 'decimal' },
  ],
  rows: [
    ['2026-09-01', 'OS-2026-4924', '2026-09-01T09:29:22.123456-03:00', 29.5],
    ['2026-09-02', 'OS-2026-4925', null, null],
  ],
}

const recorte: XlsxSheet = {
  name: 'Filtros',
  columns: [
    { header: 'Item', width: 22, type: 'text', bold: true },
    { header: 'Valor', width: 80, type: 'text' },
  ],
  rows: [['Período', 'Setembro de 2026, até o dia 23']],
}

describe('números do Excel', () => {
  it('data vira o número de série do Excel, e não texto', () => {
    // 01/01/1900 é 1 no Excel; 01/03/1900 é 61 por causa do dia fictício de 1900.
    expect(excelDateSerial('1900-03-01')).toBe(61)
    expect(excelDateSerial('2026-09-01')).toBe(46266)
    expect(excelDateSerial('01/09/2026')).toBeNull()
  })

  it('data com hora usa a hora ESCRITA, sem converter pelo fuso do computador', () => {
    // 09:29:22 de São Paulo continua 09:29:22 na célula.
    const serial = excelDateTimeSerial('2026-09-01T09:29:22-03:00')!
    expect(Math.floor(serial)).toBe(46266)
    expect(Math.round((serial - 46266) * 86_400)).toBe(9 * 3600 + 29 * 60 + 22)
    expect(excelDateTimeSerial('sem hora')).toBeNull()
  })

  it('letra da coluna segue o Excel depois do Z', () => {
    expect([0, 18, 25, 26, 27, 701, 702].map(columnLetter)).toEqual([
      'A',
      'S',
      'Z',
      'AA',
      'AB',
      'ZZ',
      'AAA',
    ])
  })

  it('soma de conferência do .zip é a CRC-32 padrão', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('pacote do .xlsx', () => {
  it('traz as partes que o Excel exige, com o índice de conteúdo primeiro', () => {
    const bytes = buildXlsx([dados, recorte])
    const files = unzip(bytes)

    expect([...files.keys()][0]).toBe('[Content_Types].xml')
    for (const part of [
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/sharedStrings.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
      'xl/tables/table1.xml',
      'xl/worksheets/_rels/sheet1.xml.rels',
    ]) {
      expect(files.has(part)).toBe(true)
    }
    // Cada parte declarada no índice existe no pacote.
    const overrides = [...files.get('[Content_Types].xml')!.matchAll(/PartName="\/([^"]+)"/g)].map(
      (match) => match[1],
    )
    for (const part of overrides) expect(files.has(part)).toBe(true)
  })

  it('o mesmo conteúdo gera sempre os mesmos bytes', () => {
    expect(buildXlsx([dados])).toEqual(buildXlsx([dados]))
  })

  it('abas na ordem recebida, com os nomes pedidos', () => {
    const workbook = unzip(buildXlsx([dados, recorte])).get('xl/workbook.xml')!

    expect(workbook).toContain('<sheet name="OS" sheetId="1" r:id="rId1"/>')
    expect(workbook).toContain('<sheet name="Filtros" sheetId="2" r:id="rId2"/>')
  })
})

describe('aba de dados como Tabela do Excel', () => {
  it('a tabela cobre o cabeçalho e todas as linhas, com filtro no cabeçalho', () => {
    const table = unzip(buildXlsx([dados])).get('xl/tables/table1.xml')!

    expect(table).toContain('name="OrdensDeServico" displayName="OrdensDeServico" ref="A1:D3"')
    expect(table).toContain('<autoFilter ref="A1:D3"/>')
    expect(table).toContain('<tableColumn id="3" name="Início do serviço"/>')
    expect(table).toContain('<tableColumn id="4" name="Deslocamento (min)"/>')
  })

  it('congela o cabeçalho e declara a largura de cada coluna', () => {
    const sheet = unzip(buildXlsx([dados])).get('xl/worksheets/sheet1.xml')!

    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>')
    expect(sheet).toContain('<col min="1" max="1" width="11" customWidth="1"/>')
    expect(sheet).toContain('<dimension ref="A1:D3"/>')
    expect(sheet).toContain('<tableParts count="1"><tablePart r:id="rId1"/></tableParts>')
  })

  it('data, data com hora e decimal saem como número formatado', () => {
    const sheet = unzip(buildXlsx([dados])).get('xl/worksheets/sheet1.xml')!

    expect(sheet).toContain('<c r="A2" s="1"><v>46266</v></c>')
    expect(sheet).toMatch(/<c r="C2" s="2"><v>46266\.39\d+<\/v><\/c>/)
    expect(sheet).toContain('<c r="D2" s="3"><v>29.5</v></c>')
  })

  it('valor em reais sai como número com duas casas, e não com a casa única do decimal', () => {
    const files = unzip(
      buildXlsx([
        {
          name: 'Contratos',
          table: 'Contratos',
          columns: [{ header: 'Valor mensal (R$)', width: 16, type: 'money' }],
          rows: [[129.99]],
        },
      ]),
    )

    expect(files.get('xl/worksheets/sheet1.xml')!).toContain('<c r="A2" s="5"><v>129.99</v></c>')
    // O estilo 5 aponta para o formato 4 do Excel, `#,##0.00`.
    expect(files.get('xl/styles.xml')!).toMatch(/<cellXfs count="6">(?:<xf [^>]*\/>){5}<xf numFmtId="4" /)
  })

  it('zero é valor, e não célula vazia: deslocamento de 0 min entra na média', () => {
    const sheet = unzip(buildXlsx([{ ...dados, rows: [['2026-09-01', 'OS-1', null, 0]] }])).get(
      'xl/worksheets/sheet1.xml',
    )!

    expect(sheet).toContain('<c r="D2" s="3"><v>0</v></c>')
  })

  it('célula vazia não é escrita, em vez de virar zero ou texto vazio', () => {
    const sheet = unzip(buildXlsx([dados])).get('xl/worksheets/sheet1.xml')!

    expect(sheet).not.toContain('r="C3"')
    expect(sheet).not.toContain('r="D3"')
    expect(sheet).toContain('r="A3"')
  })

  it('valor fora do formato da coluna vai como texto, e não some', () => {
    const files = unzip(
      buildXlsx([{ ...dados, rows: [['sem data', 'OS-1', 'sem hora', Number.NaN]] }]),
    )

    expect(files.get('xl/sharedStrings.xml')).toContain('<t>sem data</t>')
    expect(files.get('xl/sharedStrings.xml')).toContain('<t>sem hora</t>')
    expect(files.get('xl/sharedStrings.xml')).toContain('<t>NaN</t>')
  })

  it('sem nenhuma linha, a aba fica só com o cabeçalho e sem Tabela', () => {
    // O Excel recusa Tabela sem linha de dados e pede reparo no arquivo inteiro.
    const files = unzip(buildXlsx([{ ...dados, rows: [] }]))

    expect(files.has('xl/tables/table1.xml')).toBe(false)
    expect(files.get('xl/worksheets/sheet1.xml')).not.toContain('tableParts')
    expect(files.get('[Content_Types].xml')).not.toContain('table1.xml')
    expect(files.get('xl/sharedStrings.xml')).toContain('<t>Data</t>')
  })
})

describe('textos', () => {
  it('cada texto entra uma vez na tabela compartilhada, com a contagem de usos', () => {
    const files = unzip(
      buildXlsx([
        { ...dados, rows: [['2026-09-01', 'OS-1', null, null], ['2026-09-01', 'OS-1', null, null]] },
      ]),
    )
    const strings = files.get('xl/sharedStrings.xml')!

    // Quatro cabeçalhos e o código duas vezes: seis usos, cinco textos.
    expect(strings).toContain('count="6" uniqueCount="5"')
    expect(strings.match(/<t>OS-1<\/t>/g)).toHaveLength(1)
  })

  it('escapa o que o XML reserva e tira o caractere de controle que ele recusa', () => {
    const strings = unzip(
      buildXlsx([{ ...dados, rows: [['2026-09-01', 'A & B <c> "d"\u0007', null, null]] }]),
    ).get('xl/sharedStrings.xml')!

    expect(strings).toContain('<t>A &amp; B &lt;c&gt; &quot;d&quot;</t>')
  })

  it('aba de recorte sem cabeçalho, com o rótulo em negrito', () => {
    const files = unzip(buildXlsx([dados, recorte]))
    const sheet = files.get('xl/worksheets/sheet2.xml')!

    expect(sheet).not.toContain('<pane')
    expect(sheet).toContain('<c r="A1" s="4" t="s">')
    expect(files.get('xl/sharedStrings.xml')).toContain('<t>Setembro de 2026, até o dia 23</t>')
  })
})

describe('guarda do que o Excel recusa', () => {
  it('nome de aba ou de tabela fora da regra do Excel é erro de quem chama', () => {
    expect(() => buildXlsx([{ ...dados, name: 'OS/Setembro' }])).toThrow('nome de aba')
    expect(() => buildXlsx([{ ...dados, table: 'Ordens de serviço' }])).toThrow('nome de tabela')
  })

  it('coluna de tabela repetida ou sem nome é erro de quem chama', () => {
    const repetida = { ...dados, columns: [...dados.columns, { header: 'data', width: 9, type: 'text' as const }] }

    expect(() => buildXlsx([repetida])).toThrow('nomes de coluna únicos')
  })
})
