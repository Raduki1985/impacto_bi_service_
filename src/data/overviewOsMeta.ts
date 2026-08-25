/**
 * Metadados LEVES da fonte real da Visão Geral de OS.
 *
 * Vivem separados de `overviewOsData.ts` de propósito: o cabeçalho aparece em
 * todas as páginas, e importar o texto de lá arrastaria os 4.465 registros da
 * projeção para o bundle inicial. Aqui só existem constantes de texto.
 *
 * A data é a máxima da fonte, escrita por extenso; o teste de
 * `overviewOsData.test.ts` compara com `OVERVIEW_OS_DATE_RANGE.max` e quebra
 * se a projeção for atualizada sem este arquivo acompanhar.
 */

/** Data máxima da fonte sanitizada, no formato dd/mm/aaaa. */
export const OVERVIEW_OS_SOURCE_MAX_DATE_BR = '21/08/2026'

/**
 * Explicação do aviso da Visão Geral: base local de estudo com as relações
 * reais da exportação sanitizada do SGI, sem conexão em tempo real. As demais
 * páginas de OS continuam com a explicação da base simulada.
 */
export const OVERVIEW_OS_SOURCE_EXPLANATION =
  `Base local de estudo: as relações de OS desta página vêm da exportação sanitizada do SGI ` +
  `até ${OVERVIEW_OS_SOURCE_MAX_DATE_BR}, sem conexão em tempo real. ` +
  `Clientes e as demais páginas de OS continuam simulados.`
