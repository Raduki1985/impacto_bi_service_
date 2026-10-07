import type { Theme } from '../../../contexts/PreferencesContextCore'
import type { CommercialSaleRecord } from '../../../data/api/commercialRecordsSource'
import { cohortPalette } from './overviewCohortChartOptions'
import type { OverviewAwaitingStageId } from './overviewModel'

/**
 * Cores das etapas da fila de ativação, as mesmas em todo lugar da página em
 * que uma etapa aparece: as caixas Agendadas, Assinadas e Pendentes da faixa
 * Hoje ao vivo, desde 25/09/2026, e o ponto de situação das listas. Até
 * 28/09/2026 eram também a barra do card Aguardando Ativação, que saiu da
 * página. Saíram de `Overview.tsx` para um arquivo só delas porque a faixa
 * precisa das mesmas cores e não pode importar a página inteira.
 *
 * Quatro degraus do âmbar da fila, um por etapa. Etapa não é sucesso nem
 * erro, então nenhum degrau usa verde ou vermelho: os quatro são variações
 * da mesma identidade, do mais escuro no início para o mais claro no fim. O
 * degrau da cancelada antes de ativar era o fim da fila do card antigo e
 * hoje não pinta nada: nas listas a cancelada leva o cinza de
 * `situationColors`. A cor também nunca é o único identificador, porque
 * cada etapa traz label e quantidade.
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
 * Cor que marca, numa lista de contratos, o que não é fila, ativa, travada
 * nem encerrada (cortesia, não sincronizada, situação nova do SGI): a
 * terracota que o portal já usa, medida nos dois temas (4,31 no claro, 3,40
 * no escuro).
 */
const OTHER_STATUS_COLOR = '#b5652f'

/**
 * Serviço travado: o cliente ativou, mas hoje está bloqueado ou suspenso. É
 * a situação em que ainda cabe ação (cobrança, desbloqueio), por isso leva o
 * vermelho desfavorável do portal. Encerrada é a que não tem mais volta, e
 * leva o cinza da cancelada na Safra. Tons medidos em 28/09/2026 contra as
 * superfícies da janela: o vermelho `#e5384e` (3,00) e o cinza `#64748b` (2,65)
 * do claro ficam no limite sobre o `#263448` do escuro, então o escuro sobe um
 * passo, para o `--kpi-bad` e para o cinza claro que o portal já usa.
 */
export const situationColors: Record<'light' | 'dark', Record<'stuck' | 'closed', string>> = {
  light: { stuck: '#e5384e', closed: '#64748b' },
  dark: { stuck: '#ff4d6a', closed: '#94a3b8' },
}

const STUCK_STATUSES: ReadonlySet<string> = new Set(['bloqueio-financeiro', 'bloqueio-administrativo', 'suspensa'])
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['cancelada', 'reprovada', 'expirada'])

/**
 * Cor do ponto de situação de um contrato nas listas da página. Segue o
 * texto da coluna, a situação de HOJE no SGI: o degrau da etapa na fila, o
 * verde de "ativou no mês" da Safra na ativa, o vermelho no serviço travado,
 * o cinza na encerrada e a terracota no resto. Saiu da faixa Hoje ao vivo em
 * 25/09/2026, quando a janela da Safra passou a listar os mesmos contratos.
 * A cancelada das listas e do card dos 90 dias é cinza (no escuro sobe para
 * `#94a3b8`); a fatia Cancelou da Safra é vermelha desde 02/10/2026, pedido
 * do Mário.
 *
 * Até 28/09/2026 o verde marcava "ativou um dia", e a cancelada ou bloqueada
 * depois do sinal saía verde ao lado do texto Cancelada (em 2026, cerca de
 * 1.100 contratos). O Mário pediu a cor pela situação.
 */
export function saleStatusColor(record: CommercialSaleRecord, theme: Theme): string {
  const key = theme === 'dark' ? 'dark' : 'light'
  if (record.stage !== null && record.stage !== 'cancelada') return awaitingColors[key][record.stage]
  if (record.status === 'ativa') return cohortPalette[key].activatedInMonth
  if (STUCK_STATUSES.has(record.status)) return situationColors[key].stuck
  if (CLOSED_STATUSES.has(record.status)) return situationColors[key].closed

  return OTHER_STATUS_COLOR
}
