import { COMMERCIAL_PERIOD_END, formatIsoAsBrDate } from '../../../data/commercialCalendar'

/** Chave da página no catálogo do departamento Comercial. */
export const COMMERCIAL_SALES_PERIOD_PAGE_KEY = 'sales-period'

/** Data exibida no cabeçalho desta página, derivada do período mockado. */
export const COMMERCIAL_SALES_PERIOD_UPDATED_AT = formatIsoAsBrDate(COMMERCIAL_PERIOD_END)
