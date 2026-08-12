import { formatNumber, formatPercent } from '../../../lib/formatters'
import {
  CONSOLIDATED_MONTHLY_GOAL,
  INTERNAL_SELLER_MONTHLY_GOAL,
  type CommercialGoalsSnapshot,
} from './commercialGoalsModel'
import { goalsColors } from './goalsChartOptions'
import { activeSalesText, internalSellersText, pluralize } from './goalsText'

/**
 * Progresso do mês.
 *
 * `ProgressBar` não serve aqui: ela recebe um percentual e desenha uma barra
 * simples, sem marcador de meta, sem valor acima de 100% e sem escala comum
 * entre duas barras. Este componente resolve os três pontos.
 *
 * As duas barras compartilham a mesma escala, então comparar realizado da meta
 * com realizado total é honesto. A escala é o maior valor do recorte com folga,
 * de modo que nenhuma barra e nenhum marcador chegam à borda: valor acima de
 * 100% da meta aparece ultrapassando o marcador, sem estourar o contêiner.
 */
export function GoalProgress({ snapshot }: { snapshot: CommercialGoalsSnapshot }) {
  const scaleMax =
    Math.max(
      snapshot.goal ?? 0,
      snapshot.superGoal ?? 0,
      snapshot.goalAchieved,
      snapshot.totalAchieved,
      1,
    ) * 1.06

  return (
    <section className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4">
      <h2 className="text-[13.5px] font-semibold text-[var(--text-heading)]">
        Progresso de {snapshot.monthLabel}
      </h2>
      <p className="mt-0.5 text-[12px] leading-[1.45] text-[var(--text-secondary)]">
        {scopeDescription(snapshot)}
      </p>

      <div className="mt-4 flex flex-col gap-5">
        <ProgressRow
          ariaNoun="Realizado da meta"
          caption="Vendas Internas e Colaboradores"
          color={goalsColors.goalAchieved}
          markerColor={goalsColors.goalReference}
          scaleMax={scaleMax}
          target={snapshot.goal}
          targetLabel="Meta"
          title="Realizado da meta"
          value={snapshot.goalAchieved}
        />
        <ProgressRow
          ariaNoun="Realizado total"
          caption="Vendas Internas, Colaboradores e Corporativo"
          color={goalsColors.totalAchieved}
          markerColor={goalsColors.superGoalReference}
          scaleMax={scaleMax}
          target={snapshot.superGoal}
          targetLabel="Supermeta"
          title="Realizado total da supermeta"
          value={snapshot.totalAchieved}
        />
      </div>

      <p className="mt-4 border-t border-[var(--divider)] pt-3 text-[11.5px] leading-[1.5] text-[var(--text-secondary)]">
        São dois numeradores diferentes. A meta normal usa apenas Vendas Internas e Colaboradores.
        A supermeta usa o realizado total, que inclui o Corporativo. O Corporativo nunca entra na
        meta normal.
      </p>
    </section>
  )
}

/** Texto que explica de onde veio a meta do recorte atual. */
function scopeDescription(snapshot: CommercialGoalsSnapshot): string {
  const sellers = snapshot.eligibleInternalSellers.length

  if (snapshot.incompatibleSelection) {
    return 'Cidade e vendedor selecionados não se cruzam, então o recorte não tem meta nem realizado.'
  }

  switch (snapshot.scope) {
    case 'consolidado':
      return `Meta empresarial consolidada de ${formatNumber(CONSOLIDATED_MONTHLY_GOAL)} vendas por mês. Ela é fixa: não é a soma das metas individuais dos ${internalSellersText(sellers)}, que hoje ${sellers === 1 ? 'soma' : 'somam'} ${formatNumber(sellers * INTERNAL_SELLER_MONTHLY_GOAL)}.`
    case 'cidade':
      return `Meta local de ${formatNumber(snapshot.goal ?? 0)} vendas: ${formatNumber(INTERNAL_SELLER_MONTHLY_GOAL)} por vendedor interno alocado à cidade, hoje ${pluralize(sellers, 'vendedor', 'vendedores')}.`
    case 'selecao':
      return snapshot.corporateAchieved > 0
        ? `Meta de ${formatNumber(snapshot.goal ?? 0)} vendas: ${formatNumber(INTERNAL_SELLER_MONTHLY_GOAL)} por vendedor interno selecionado, hoje ${pluralize(sellers, 'vendedor', 'vendedores')}. O Corporativo selecionado contribui apenas para a supermeta.`
        : `Meta de ${formatNumber(snapshot.goal ?? 0)} vendas: ${formatNumber(INTERNAL_SELLER_MONTHLY_GOAL)} por vendedor interno selecionado, hoje ${pluralize(sellers, 'vendedor', 'vendedores')}.`
    default:
      return 'O recorte não tem vendedor interno elegível, então não existe meta individual de volume. O realizado continua sendo exibido.'
  }
}

type ProgressRowProps = {
  ariaNoun: string
  caption: string
  color: string
  markerColor: string
  scaleMax: number
  target: number | null
  targetLabel: string
  title: string
  value: number
}

function ProgressRow({
  ariaNoun,
  caption,
  color,
  markerColor,
  scaleMax,
  target,
  targetLabel,
  title,
  value,
}: ProgressRowProps) {
  const fillPercent = Math.min((value / scaleMax) * 100, 100)
  const markerPercent = target === null ? null : Math.min((target / scaleMax) * 100, 100)
  const attainment = target === null || target === 0 ? null : value / target

  const ariaLabel =
    target === null
      ? `${ariaNoun}: ${activeSalesText(value)}. Sem meta de volume no recorte.`
      : `${ariaNoun}: ${activeSalesText(value)} de ${targetLabel.toLowerCase()} ${formatNumber(target)}, ou ${formatPercent(attainment ?? 0)}.`

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.3px] text-[var(--text-item)]">
            {title}
          </p>
          <p className="text-[11.5px] text-[var(--text-secondary)]">{caption}</p>
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[24px] font-extrabold leading-none text-[var(--text-heading)]">
            {formatNumber(value)}
          </span>
          <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
            {attainment === null
              ? 'Sem meta'
              : `${formatPercent(attainment)} de ${formatNumber(target ?? 0)}`}
          </span>
        </div>
      </div>

      <div
        aria-label={ariaLabel}
        className="relative mt-2.5 h-3 w-full overflow-hidden rounded-full bg-[var(--divider)]"
        role="img"
      >
        <div className="h-full rounded-full" style={{ background: color, width: `${fillPercent}%` }} />
      </div>

      {markerPercent === null ? (
        <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
          Sem meta individual de volume para comparar.
        </p>
      ) : (
        <div aria-hidden="true" className="relative mt-1 h-[15px] w-full">
          {/* Marcador desenhado fora da barra para não ser recortado por ela, e
              alinhado pela borda quando fica perto de um dos extremos: assim o
              rótulo nunca ultrapassa a largura do cartão. */}
          <span
            className="absolute -top-[19px] h-[17px] w-[2px] rounded-full"
            style={{ background: markerColor, left: `${markerPercent}%` }}
          />
          <span
            className="absolute top-0 whitespace-nowrap text-[10.5px] font-semibold"
            style={{
              color: markerColor,
              left: `${markerPercent}%`,
              transform: markerAlignment(markerPercent),
            }}
          >
            {targetLabel} {formatNumber(target ?? 0)}
          </span>
        </div>
      )}
    </div>
  )
}

/** Alinhamento do rótulo do marcador, para ele nunca sair do cartão. */
function markerAlignment(percent: number): string {
  if (percent < 12) return 'translateX(0)'
  if (percent > 88) return 'translateX(-100%)'

  return 'translateX(-50%)'
}
