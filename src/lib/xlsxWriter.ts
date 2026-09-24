/**
 * Planilha do Excel (.xlsx) montada no próprio navegador, sem biblioteca.
 *
 * Existe para a janela de OS da Visão Geral e para o botão que baixa as OS do
 * período (pedido do Mário em 24/09/2026: baixar "para quando o gestor
 * quiser"). O portal não tinha exportação nenhuma, e as bibliotecas de Excel
 * são grandes para o que se precisa aqui; a mais conhecida no npm, além
 * disso, está parada numa versão com falhas de segurança publicadas. O
 * arquivo que o gestor precisa é simples: uma aba com a tabela das OS e uma
 * aba com o recorte que gerou a planilha.
 *
 * Um .xlsx é um pacote .zip de arquivos XML. Este módulo escreve o mínimo que
 * o Excel abre sem pedir reparo, e o que ele congela:
 *
 * - a aba de dados sai como TABELA do Excel (o mesmo que Inserir > Tabela),
 *   com filtro no cabeçalho e linhas zebradas: a tabela dinâmica fica a dois
 *   cliques e acompanha a tabela quando o gestor acrescenta linhas;
 * - cabeçalho congelado e larguras de coluna declaradas;
 * - data vai como DATA do Excel (número de série com formato dd/mm/aaaa), e
 *   não como texto: é o que deixa agrupar por mês numa tabela dinâmica e
 *   ordenar certo;
 * - data com hora é lida pelos números do texto ISO, sem passar pelo relógio
 *   do computador. O serviço já manda a hora de São Paulo com o fuso escrito,
 *   e é essa hora, a da operação, que a célula mostra;
 * - texto vai na tabela compartilhada de textos (`sharedStrings`), o formato
 *   que o próprio Excel grava: cidade, equipe e status se repetem milhares de
 *   vezes;
 * - o .zip vai SEM compressão (método "store"). Um mês de OS dá cerca de
 *   1 MB, e comprimir exigiria um algoritmo que o navegador só entrega de
 *   forma assíncrona. O Excel comprime ao salvar.
 *
 * Nasceu na pasta da Visão Geral de OS e foi promovido a `lib` em
 * 24/09/2026, quando o Mário definiu aquela página como modelo do portal:
 * qualquer lista que abra pelo clique num painel baixa a planilha por aqui.
 * O que cada página decide é só a lista de colunas e as linhas; o arquivo em
 * si é o mesmo em toda parte.
 */

/** Como a célula é escrita. */
export type XlsxColumnType = 'text' | 'date' | 'datetime' | 'decimal'

export type XlsxColumn = {
  /** Nome da coluna. Na aba com tabela, é também o nome da coluna da tabela. */
  readonly header: string
  /** Largura em caracteres, a unidade do Excel. */
  readonly width: number
  readonly type: XlsxColumnType
  /** Texto em negrito, para a coluna de rótulos da aba de recorte. */
  readonly bold?: boolean
}

/**
 * Valor de uma célula. Texto para `text`, `aaaa-mm-dd` para `date`, ISO com
 * hora para `datetime` e número para `decimal`. Nulo deixa a célula vazia.
 */
export type XlsxValue = string | number | null

export type XlsxSheet = {
  /** Nome da aba: até 31 caracteres, sem `[ ] : * ? / \`. */
  readonly name: string
  readonly columns: readonly XlsxColumn[]
  readonly rows: readonly (readonly XlsxValue[])[]
  /**
   * Nome da Tabela do Excel. Com ele, a primeira linha é o cabeçalho e os
   * dados viram tabela; sem ele, as linhas vão como estão, sem cabeçalho.
   */
  readonly table?: string
}

/** Tipo de arquivo que o navegador anuncia ao baixar. */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PACKAGE_RELATIONSHIPS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const RELATIONSHIP = `${NS_RELATIONSHIPS}/`
const CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.'

/**
 * Estilos de célula, na ordem de `cellXfs` em `styles.xml`. Os formatos são
 * gravados no padrão do arquivo (`dd/mm/yyyy`, `0.0`), e o Excel em português
 * os mostra com as letras e a vírgula dele (`dd/mm/aaaa`, `29,5`).
 */
const STYLE = { text: 0, date: 1, datetime: 2, decimal: 3, bold: 4 } as const

/** Dia zero do Excel no sistema de datas de 1900, já com o dia fictício de 1900. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

/** Nome de Tabela válido para o Excel: letra ou sublinhado, depois letras, números, `_` e `.`. */
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/
const FORBIDDEN_SHEET_CHARACTERS = /[[\]:*?/\\]/

/** Número de série do Excel para uma data `aaaa-mm-dd`; null fora do formato. */
export function excelDateSerial(iso: string): number | null {
  const match = ISO_DATE.exec(iso)
  if (match === null) return null
  const [, year, month, day] = match.map(Number)

  return (Date.UTC(year, month - 1, day) - EXCEL_EPOCH) / MS_PER_DAY
}

/**
 * Número de série do Excel para data com hora, pela hora ESCRITA no texto.
 *
 * O deslocamento de fuso no fim (`-03:00`) é ignorado de propósito: o serviço
 * já converte para a hora de São Paulo, e converter de novo pelo relógio do
 * computador mostraria outra hora para quem abrir a planilha fora do fuso.
 */
export function excelDateTimeSerial(iso: string): number | null {
  const match = ISO_DATE_TIME.exec(iso)
  if (match === null) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0))
  const date = (Date.UTC(year, month - 1, day) - EXCEL_EPOCH) / MS_PER_DAY

  return date + (hour * 3600 + minute * 60 + second) / 86_400
}

/** Letra da coluna do Excel: 0 é A, 25 é Z, 26 é AA. */
export function columnLetter(index: number): string {
  let letter = ''
  let rest = index + 1
  while (rest > 0) {
    const remainder = (rest - 1) % 26
    letter = String.fromCharCode(65 + remainder) + letter
    rest = Math.floor((rest - 1) / 26)
  }

  return letter
}

/**
 * Caracteres de controle que o XML não aceita, nem escapados. Um só deles
 * vindo do SGI faria o Excel recusar o arquivo inteiro; tirá-los é a única
 * alteração que o texto sofre.
 */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

function escapeXml(text: string): string {
  return text
    .replace(INVALID_XML_CHARACTERS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Tabela compartilhada de textos: cada texto uma vez, referenciado pela posição. */
class SharedStrings {
  private readonly index = new Map<string, number>()
  private readonly values: string[] = []
  private uses = 0

  add(text: string): number {
    this.uses += 1
    const known = this.index.get(text)
    if (known !== undefined) return known
    const position = this.values.length
    this.index.set(text, position)
    this.values.push(text)

    return position
  }

  toXml(): string {
    const items = this.values
      .map((text) => {
        // Espaço nas pontas ou quebra de linha só sobrevivem com `preserve`.
        const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : ''

        return `<si><t${preserve}>${escapeXml(text)}</t></si>`
      })
      .join('')

    return `${XML_HEAD}<sst xmlns="${NS_MAIN}" count="${this.uses}" uniqueCount="${this.values.length}">${items}</sst>`
  }
}

function textCell(reference: string, text: string, strings: SharedStrings, style: number): string {
  const styleAttribute = style === STYLE.text ? '' : ` s="${style}"`

  return `<c r="${reference}"${styleAttribute} t="s"><v>${strings.add(text)}</v></c>`
}

function numberCell(reference: string, value: number, style: number): string {
  const styleAttribute = style === STYLE.text ? '' : ` s="${style}"`

  return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`
}

/**
 * Uma célula. Valor que não serve ao tipo da coluna (data fora do formato,
 * número infinito) vai como TEXTO, e não some: esconder o valor esconderia o
 * problema na origem, a mesma regra do serviço para chave sem de-para.
 */
function cellXml(column: XlsxColumn, value: XlsxValue, reference: string, strings: SharedStrings): string {
  if (value === null || value === '') return ''
  const textStyle = column.bold === true ? STYLE.bold : STYLE.text

  if (column.type === 'date' && typeof value === 'string') {
    const serial = excelDateSerial(value)
    if (serial !== null) return numberCell(reference, serial, STYLE.date)
  }
  if (column.type === 'datetime' && typeof value === 'string') {
    const serial = excelDateTimeSerial(value)
    if (serial !== null) return numberCell(reference, serial, STYLE.datetime)
  }
  if (column.type === 'decimal' && typeof value === 'number' && Number.isFinite(value)) {
    return numberCell(reference, value, STYLE.decimal)
  }

  return textCell(reference, String(value), strings, textStyle)
}

function checkSheet(sheet: XlsxSheet): void {
  if (sheet.name === '' || sheet.name.length > 31 || FORBIDDEN_SHEET_CHARACTERS.test(sheet.name)) {
    throw new Error(`Planilha: o nome de aba "${sheet.name}" não é aceito pelo Excel.`)
  }
  if (sheet.table === undefined) return
  if (!TABLE_NAME.test(sheet.table)) {
    throw new Error(`Planilha: o nome de tabela "${sheet.table}" não é aceito pelo Excel.`)
  }
  const headers = sheet.columns.map((column) => column.header.trim().toLocaleLowerCase('pt-BR'))
  if (headers.some((header) => header === '') || new Set(headers).size !== headers.length) {
    throw new Error(`Planilha: a tabela "${sheet.table}" precisa de nomes de coluna únicos e preenchidos.`)
  }
}

/** A tabela só existe com ao menos uma linha de dados: o Excel recusa tabela só de cabeçalho. */
function hasTable(sheet: XlsxSheet): boolean {
  return sheet.table !== undefined && sheet.rows.length > 0
}

function worksheetXml(sheet: XlsxSheet, strings: SharedStrings): string {
  const withHeader = sheet.table !== undefined
  const lines: string[] = []

  if (withHeader) {
    const cells = sheet.columns
      .map((column, index) => textCell(`${columnLetter(index)}1`, column.header, strings, STYLE.text))
      .join('')
    lines.push(`<row r="1">${cells}</row>`)
  }

  sheet.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + (withHeader ? 2 : 1)
    const cells = sheet.columns
      .map((column, index) =>
        cellXml(column, row[index] ?? null, `${columnLetter(index)}${rowNumber}`, strings),
      )
      .join('')
    lines.push(`<row r="${rowNumber}">${cells}</row>`)
  })

  const lastRow = Math.max(1, sheet.rows.length + (withHeader ? 1 : 0))
  const lastColumn = columnLetter(Math.max(0, sheet.columns.length - 1))
  // Só a aba com cabeçalho congela a primeira linha: é ela que rola.
  const pane = withHeader
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
    : ''
  const columns = sheet.columns
    .map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`)
    .join('')
  const tablePart = hasTable(sheet) ? '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>' : ''

  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">` +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<cols>${columns}</cols>` +
    `<sheetData>${lines.join('')}</sheetData>` +
    tablePart +
    '</worksheet>'
  )
}

function tableXml(sheet: XlsxSheet, id: number): string {
  const name = sheet.table ?? ''
  const reference = `A1:${columnLetter(sheet.columns.length - 1)}${sheet.rows.length + 1}`
  const columns = sheet.columns
    .map((column, index) => `<tableColumn id="${index + 1}" name="${escapeXml(column.header)}"/>`)
    .join('')

  return (
    `${XML_HEAD}<table xmlns="${NS_MAIN}" id="${id}" name="${name}" displayName="${name}" ref="${reference}" totalsRowShown="0">` +
    `<autoFilter ref="${reference}"/>` +
    `<tableColumns count="${sheet.columns.length}">${columns}</tableColumns>` +
    '<tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>' +
    '</table>'
  )
}

const STYLES_XML =
  `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="3">' +
  '<numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>' +
  '<numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/>' +
  '<numFmt numFmtId="166" formatCode="0.0"/>' +
  '</numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '</fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

function relationshipsXml(items: readonly { id: string; type: string; target: string }[], namespace: string): string {
  const relationships = items
    .map((item) => `<Relationship Id="${item.id}" Type="${RELATIONSHIP}${item.type}" Target="${item.target}"/>`)
    .join('')

  return `${XML_HEAD}<Relationships xmlns="${namespace}">${relationships}</Relationships>`
}

/**
 * O arquivo .xlsx inteiro, pronto para baixar.
 *
 * As abas saem na ordem recebida, e a primeira é a que abre. Cada aba com
 * `table` e ao menos uma linha ganha a própria Tabela do Excel.
 */
export function buildXlsx(sheets: readonly XlsxSheet[]): Uint8Array<ArrayBuffer> {
  if (sheets.length === 0) throw new Error('Planilha: é preciso ao menos uma aba.')
  sheets.forEach(checkSheet)

  const strings = new SharedStrings()
  const files: { name: string; content: string }[] = []
  const overrides: string[] = []
  let tableCount = 0

  sheets.forEach((sheet, index) => {
    const sheetNumber = index + 1
    files.push({ name: `xl/worksheets/sheet${sheetNumber}.xml`, content: worksheetXml(sheet, strings) })
    overrides.push(
      `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="${CONTENT_TYPE}worksheet+xml"/>`,
    )
    if (!hasTable(sheet)) return

    tableCount += 1
    files.push({ name: `xl/tables/table${tableCount}.xml`, content: tableXml(sheet, tableCount) })
    files.push({
      name: `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`,
      content: relationshipsXml(
        [{ id: 'rId1', type: 'table', target: `../tables/table${tableCount}.xml` }],
        NS_PACKAGE_RELATIONSHIPS,
      ),
    })
    overrides.push(
      `<Override PartName="/xl/tables/table${tableCount}.xml" ContentType="${CONTENT_TYPE}table+xml"/>`,
    )
  })

  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')
  const workbook =
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_RELATIONSHIPS}">` +
    `<bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetEntries}</sheets></workbook>`
  const workbookRelationships = relationshipsXml(
    [
      ...sheets.map((_, index) => ({
        id: `rId${index + 1}`,
        type: 'worksheet',
        target: `worksheets/sheet${index + 1}.xml`,
      })),
      { id: `rId${sheets.length + 1}`, type: 'styles', target: 'styles.xml' },
      { id: `rId${sheets.length + 2}`, type: 'sharedStrings', target: 'sharedStrings.xml' },
    ],
    NS_PACKAGE_RELATIONSHIPS,
  )
  const contentTypes =
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${CONTENT_TYPE}sheet.main+xml"/>` +
    overrides.join('') +
    `<Override PartName="/xl/styles.xml" ContentType="${CONTENT_TYPE}styles+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${CONTENT_TYPE}sharedStrings+xml"/>` +
    '</Types>'

  // O índice de conteúdo abre o pacote: o formato não exige, mas é a ordem
  // que o próprio Excel grava, e alguns leitores de .xlsx contam com ela.
  return zipStore([
    { name: '[Content_Types].xml', content: contentTypes },
    {
      name: '_rels/.rels',
      content: relationshipsXml(
        [{ id: 'rId1', type: 'officeDocument', target: 'xl/workbook.xml' }],
        NS_PACKAGE_RELATIONSHIPS,
      ),
    },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelationships },
    { name: 'xl/styles.xml', content: STYLES_XML },
    // Os textos são escritos DEPOIS das abas, porque é ao montar as abas que
    // a tabela compartilhada se enche.
    ...files,
    { name: 'xl/sharedStrings.xml', content: strings.toXml() },
  ])
}

/* -------------------------------------------------------------------------- */
/* Pacote .zip                                                                  */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let byte = 0; byte < 256; byte += 1) {
    let value = byte
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[byte] = value >>> 0
  }

  return table
})()

/** CRC-32 do conteúdo, a soma de conferência que o .zip grava para cada arquivo. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)

  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Data fixa nos arquivos do pacote, 01/01/1980, a primeira que o .zip
 * representa: ano 0 a partir de 1980, mês 1 no bit 5, dia 1. Fixa de
 * propósito: o mesmo conteúdo gera sempre os mesmos bytes, e o Excel não usa
 * essa data para nada.
 */
const ZIP_DATE = (1 << 5) | 1

/**
 * Pacote .zip sem compressão.
 *
 * Três blocos, na ordem do formato: cada arquivo com o cabeçalho local, o
 * índice central com a posição de cada um e o fecho que diz onde o índice
 * começa. Nomes em ASCII, então nenhuma marca de UTF-8 é necessária.
 */
function zipStore(entries: readonly { name: string; content: string }[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const files = entries.map((entry) => {
    const data = encoder.encode(entry.content)

    return { name: encoder.encode(entry.name), data, crc: crc32(data) }
  })
  const localSize = files.reduce((sum, file) => sum + 30 + file.name.length + file.data.length, 0)
  const centralSize = files.reduce((sum, file) => sum + 46 + file.name.length, 0)
  const output = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(output.buffer)
  const offsets: number[] = []
  let offset = 0

  for (const file of files) {
    offsets.push(offset)
    view.setUint32(offset, 0x04034b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 0, true)
    view.setUint16(offset + 8, 0, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, ZIP_DATE, true)
    view.setUint32(offset + 14, file.crc, true)
    view.setUint32(offset + 18, file.data.length, true)
    view.setUint32(offset + 22, file.data.length, true)
    view.setUint16(offset + 26, file.name.length, true)
    view.setUint16(offset + 28, 0, true)
    output.set(file.name, offset + 30)
    output.set(file.data, offset + 30 + file.name.length)
    offset += 30 + file.name.length + file.data.length
  }

  const centralStart = offset
  files.forEach((file, index) => {
    view.setUint32(offset, 0x02014b50, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 20, true)
    view.setUint16(offset + 8, 0, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, 0, true)
    view.setUint16(offset + 14, ZIP_DATE, true)
    view.setUint32(offset + 16, file.crc, true)
    view.setUint32(offset + 20, file.data.length, true)
    view.setUint32(offset + 24, file.data.length, true)
    view.setUint16(offset + 28, file.name.length, true)
    view.setUint16(offset + 30, 0, true)
    view.setUint16(offset + 32, 0, true)
    view.setUint16(offset + 34, 0, true)
    view.setUint16(offset + 36, 0, true)
    view.setUint32(offset + 38, 0, true)
    view.setUint32(offset + 42, offsets[index], true)
    output.set(file.name, offset + 46)
    offset += 46 + file.name.length
  })

  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, files.length, true)
  view.setUint16(offset + 10, files.length, true)
  view.setUint32(offset + 12, offset - centralStart, true)
  view.setUint32(offset + 16, centralStart, true)
  view.setUint16(offset + 20, 0, true)

  return output
}
