/**
 * Os seis indicadores principais, como dado.
 *
 * A fileira de KPIs e o painel de leitura gerencial mostram o mesmo indicador em
 * dois lugares diferentes. Descrever o card em um objeto, e não em JSX, é o que
 * garante que os dois nunca divirjam: o painel recebe exatamente o texto do card
 * selecionado, sem uma segunda cópia das frases.
 *
 * Módulo puro: recebe o snapshot já calculado e devolve textos formatados.
 * Nenhuma regra de negócio vive aqui.
 */

import { Flag, Gauge, Handshake, Milestone, Target, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { KpiStatus, KpiTrend } from '../../../components/dashboard/KpiStoryCard'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import type { CommercialGoalsSnapshot } from './commercialGoalsModel'
import { goalScopeSummary, salesText } from './goalsText'

export type CommercialKpiCard = {
  readonly id: string
  readonly setor: string
  readonly nome: string
  readonly valor: string
  readonly delta: string
  readonly icon: LucideIcon
  readonly status: KpiStatus
  readonly tendencia: KpiTrend
  readonly leituraTitulo: string
  readonly leituraTexto: string
  readonly observar: string
}

/** Percentual formatado, ou o texto de ausência de meta. */
function percentOrNoGoal(value: number | null): string {
  return value === null ? 'Sem meta' : formatPercent(value)
}

function attainmentTone(value: number | null): { status: KpiStatus; tendencia: KpiTrend } {
  if (value === null) return { status: 'neutral', tendencia: 'neutro' }
  if (value >= 1) return { status: 'ok', tendencia: 'favoravel' }
  if (value >= 0.9) return { status: 'warn', tendencia: 'neutro' }

  return { status: 'bad', tendencia: 'desfavoravel' }
}

/**
 * Os seis indicadores do recorte atual.
 *
 * O KPI Realizado mostra o realizado da meta como valor principal e o realizado
 * total como informação secundária, porque são numeradores diferentes: o
 * primeiro alimenta o atingimento da meta, o segundo alimenta o da supermeta.
 *
 * Os `id` são fixos e não dependem do filtro: trocar de mês, cidade ou vendedor
 * mantém o mesmo indicador selecionado no painel de leitura.
 */
export function buildCommercialKpiCards(
  snapshot: CommercialGoalsSnapshot,
): readonly CommercialKpiCard[] {
  const goalTone = attainmentTone(snapshot.goalAttainment)
  const superGoalTone = attainmentTone(snapshot.superGoalAttainment)
  const eligible = snapshot.eligibleInternalSellers.length

  const goalDelta =
    snapshot.goalAchievedChange === null || snapshot.previousMonthLabel === null
      ? 'Primeiro mês da base'
      : `${snapshot.goalAchievedChange >= 0 ? '+' : '-'}${salesText(Math.abs(snapshot.goalAchievedChange))} vs. ${snapshot.previousMonthLabel}`

  return [
    {
      id: 'realizado-da-meta',
      setor: 'COMERCIAL',
      nome: 'Realizado da Meta',
      valor: formatNumber(snapshot.goalAchieved),
      delta: `Realizado total da supermeta: ${formatNumber(snapshot.totalAchieved)}`,
      icon: Handshake,
      status: 'neutral',
      tendencia: 'neutro',
      leituraTitulo: 'Vendas ativas que contam para a meta normal.',
      leituraTexto:
        'Soma as vendas ativas creditadas a {Vendas Internas} e a {Colaboradores}. O Corporativo não entra aqui: ele aparece apenas no realizado total.',
      observar:
        'Só entra venda com contrato ativo e data de ativação no mês. Assinatura e agendamento não contam.',
    },
    {
      id: 'meta',
      setor: 'COMERCIAL',
      nome: 'Meta',
      valor: snapshot.goal === null ? 'Sem meta' : formatNumber(snapshot.goal),
      delta: goalScopeSummary(snapshot.scope, eligible),
      icon: Target,
      status: 'neutral',
      tendencia: 'neutro',
      leituraTitulo: 'Meta de volume do recorte atual.',
      leituraTexto:
        'A meta consolidada é fixa em {800} vendas. Com cidade ou vendedor no filtro, ela passa a ser {50 por vendedor interno elegível}.',
      observar:
        'A meta consolidada não é a soma das metas individuais: 15 vendedores somam 750, e a meta do negócio continua 800.',
    },
    {
      id: 'atingimento-da-meta',
      setor: 'COMERCIAL',
      nome: 'Atingimento da Meta',
      valor: percentOrNoGoal(snapshot.goalAttainment),
      delta: goalDelta,
      icon: Gauge,
      status: goalTone.status,
      tendencia: goalTone.tendencia,
      leituraTitulo: 'Quanto da meta normal já foi entregue.',
      leituraTexto:
        'Divide o {realizado da meta} pela meta do recorte. Sem vendedor interno elegível não existe denominador, e o indicador fica {sem meta} em vez de zero.',
      observar:
        'Compare com o ritmo esperado da comparação Meta normal: o mesmo percentual significa coisas diferentes no dia 10 e no dia 30.',
    },
    {
      id: 'gap-para-meta',
      setor: 'COMERCIAL',
      nome: 'Gap para Meta',
      valor: snapshot.gapToGoal === null ? 'Sem meta' : formatNumber(snapshot.gapToGoal),
      delta:
        snapshot.goal === null
          ? 'Sem meta para calcular gap'
          : snapshot.surplusOverGoal !== null && snapshot.surplusOverGoal > 0
            ? `Excedente de ${salesText(snapshot.surplusOverGoal)}`
            : 'Vendas que faltam para a meta',
      icon: Milestone,
      status: snapshot.gapToGoal === null ? 'neutral' : snapshot.gapToGoal === 0 ? 'ok' : 'warn',
      tendencia: 'neutro',
      leituraTitulo: 'O que falta para fechar a meta normal.',
      leituraTexto:
        'É a diferença entre meta e realizado da meta, {nunca negativa}. Quando o realizado passa da meta, o gap fica em zero e o excedente aparece na linha de comparação.',
      observar: 'O gap ignora o Corporativo, porque o Corporativo não participa da meta normal.',
    },
    {
      id: 'supermeta',
      setor: 'COMERCIAL',
      nome: 'Supermeta',
      valor: snapshot.superGoal === null ? 'Sem meta' : formatNumber(snapshot.superGoal),
      delta:
        snapshot.superGoal === null
          ? 'Sem meta para derivar supermeta'
          : `110% da meta de ${formatNumber(snapshot.goal ?? 0)}`,
      icon: Flag,
      status: 'neutral',
      tendencia: 'neutro',
      leituraTitulo: 'Patamar de superação do recorte.',
      leituraTexto:
        'Sempre {110% da meta} do mesmo recorte. Ela é comparada ao realizado total, que inclui {Corporativo}.',
      observar:
        'Recorte sem vendedor interno elegível não tem meta e, portanto, também não tem supermeta.',
    },
    {
      id: 'atingimento-da-supermeta',
      setor: 'COMERCIAL',
      nome: 'Atingimento da Supermeta',
      valor: percentOrNoGoal(snapshot.superGoalAttainment),
      delta:
        snapshot.superGoal === null
          ? 'Sem supermeta no recorte'
          : `Realizado total de ${salesText(snapshot.totalAchieved)}`,
      icon: TrendingUp,
      status: superGoalTone.status,
      tendencia: superGoalTone.tendencia,
      leituraTitulo: 'Quanto da supermeta já foi entregue.',
      leituraTexto:
        'Usa o {realizado total}, que soma Vendas Internas, Colaboradores e Corporativo. Por isso pode ficar acima do atingimento da meta normal, sem que nenhum dos dois esteja errado.',
      observar:
        'Supermeta atingida com meta normal abaixo de 100% significa que o Corporativo sustentou o resultado total.',
    },
  ]
}
