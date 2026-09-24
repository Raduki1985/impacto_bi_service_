import { XLSX_MIME } from './xlsxWriter'

/**
 * Entrega a planilha ao navegador como download.
 *
 * Separada de `xlsxWriter` porque é a única parte que toca a página: montar o
 * arquivo é conta pura, e é testada; baixar depende do navegador. O endereço
 * temporário do arquivo só é liberado alguns segundos depois do clique, porque
 * liberá-lo na hora pode cancelar o download antes de ele começar.
 */
export function downloadXlsx(bytes: Uint8Array<ArrayBuffer>, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
