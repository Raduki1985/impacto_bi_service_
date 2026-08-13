/**
 * Identificação da página Metas e Desempenho para quem monta a rota.
 *
 * Módulo minúsculo de propósito: a rota precisa da chave da página e da data de
 * atualização da base comercial sem importar o dashboard inteiro, que é
 * carregado sob demanda. A data vem do próprio período mockado, e não de um
 * texto repetido em outro arquivo.
 */

import { COMMERCIAL_PERIOD_END, formatIsoAsBrDate } from '../../../data/commercialCalendar'

/** Chave da página no catálogo do departamento Comercial. */
export const COMMERCIAL_GOALS_PAGE_KEY = 'goals'

/** Data exibida no cabeçalho desta página: 31/07/2026. */
export const COMMERCIAL_GOALS_UPDATED_AT = formatIsoAsBrDate(COMMERCIAL_PERIOD_END)
