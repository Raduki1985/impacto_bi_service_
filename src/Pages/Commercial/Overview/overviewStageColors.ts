import type { Theme } from '../../../contexts/PreferencesContextCore'
import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { cohortPalette } from './overviewCohortChartOptions'
import type { OverviewAwaitingStageId } from './overviewModel'

/**
 * Cores das etapas da fila de ativação, as mesmas em todo lugar da página em
 * que uma etapa aparece: a barra do card Aguardando Ativação e, desde
 * 25/09/2026, as caixas Agendadas, Assinadas e Pendentes da faixa Hoje ao
 * vivo. Saíram de `Overview.tsx` para um arquivo só delas porque a faixa
 * precisa das mesmas cores e não pode importar a página inteira.
 *
 * Quatro degraus do âmbar do card, um por etapa. Etapa não é sucesso nem
 * erro, então nenhum degrau usa verde ou vermelho: os quatro são variações
 * da própria identidade do card, do mais escuro no início para o mais claro
 * no fim. A cancelada antes de ativar herda o último degrau, e não um
 * vermelho: ela é o fim da fila deste card, e pintá-la de alerta criaria um
 * sinal que a página não dá a nenhuma outra saída. A cor também nunca é o
 * único identificador, porque cada etapa traz label e quantidade.
 *
 * No tema escuro os degraus sobem um passo. O primeiro deles, `#b45309`, é
 * pouco separado da superfície `#1f2937` do card no escuro, e o degrau mais
 * claro ganha um pouco mais de corpo para não estourar sobre o mesmo fundo.
 */
export const awaitingColors: Record<'light' | 'dark', Record<OverviewAwaitingStageId, string>> = {
  light: {
    pendente: '#b45309',
    assinada: '#d97706',
    agendada: '#f59e0b',
    cancelada: '#fbbf24',
  },
  dark: {
    pendente: '#c9700f',
    assinada: '#e8890b',
    agendada: '#f7ab24',
    cancelada: '#fbd25d',
  },
}

/**
 * Cor que marca, numa lista de contratos, o que não é fila nem ativação
 * (reprovada, expirada, cortesia): a terracota que o portal já usa, medida
 * nos dois temas (3,40 no claro, 4,31 no escuro).
 */
const OTHER_STATUS_COLOR = '#b5652f'

/**
 * Cor do ponto de situação de um contrato nas listas da página: o degrau da
 * etapa na fila, o verde de "ativou no mês" da Safra no contrato ativado, o
 * cinza da Safra na cancelada antes de ativar e a terracota no resto. Saiu da
 * faixa Hoje ao vivo em 25/09/2026, quando a janela da Safra passou a listar
 * os mesmos contratos: a situação tem uma cor só na página inteira.
 */
export function saleStatusColor(record: CommercialSaleRecord, theme: Theme): string {
  const key = theme === 'dark' ? 'dark' : 'light'
  if (record.stage !== null && record.stage !== 'cancelada') return awaitingColors[key][record.stage]
  if (record.activated) return cohortPalette[key].activatedInMonth
  if (record.stage === 'cancelada') return cohortPalette[key].cancelledBefore

  return OTHER_STATUS_COLOR
}
