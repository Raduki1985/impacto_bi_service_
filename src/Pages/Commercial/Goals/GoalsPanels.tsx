import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  OctagonAlert,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '../../../components/charts/Chart'
import { KpiReadingText } from '../../../components/dashboard/KpiStoryCard'
import type { CommercialCity, CommercialCityId } from '../../../data/commercialTypes'
import { formatNumber, formatPercent } from '../../../lib/formatters'
import { goalsCompositionColors, makeGoalsCompositionOptions } from './goalsChartOptions'
import type { CommercialKpiCard } from './goalsKpiCards'
import {
  INTERNAL_SELLER_MONTHLY_GOAL,
  type CommercialGoalAlert,
  type CommercialGoalAlertTone,
  type CommercialGoalStory,
  type CommercialGoalsSnapshot,
  type CommercialConsistencyIssue,
  type CommercialSellerPerformance,
} from './commercialGoalsModel'

const panelClass = 'rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4'
const titleClass = 'text-[13.5px] font-semibold text-[var(--text-heading)]'
const captionClass = 'mt-0.5 text-[12px] leading-[1.45] text-[var(--text-secondary)]'

/* -------------------------------------------------------------------------- */
/* Cartão de gráfico                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cartão dos gráficos desta página.
 *
 * `ChartCard` não é reutilizado aqui por um motivo concreto: o título dele é
 * `#101828` fixo. Sobre a superfície clara dele isso funciona, mas sobre o
 * `--surface` dos painéis desta página o texto sumiria no tema escuro. Tornar o
 * título tokenizado no componente compartilhado deixaria as demais páginas com
 * título claro sobre fundo branco, o que seria pior. Este cartão local usa os
 * mesmos tokens dos outros painéis daqui e não toca em nenhuma página existente.
 */
export function ChartPanel({
  children,
  subtitle,
  title,
}: {
  children: ReactNode
  subtitle: string
  title: string
}) {
  return (
    <section className={panelClass}>
      <h2 className={titleClass}>{title}</h2>
      <p className={captionClass}>{subtitle}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Leitura gerencial compartilhada                                            */
/* -------------------------------------------------------------------------- */

/** Alvo do `aria-controls` dos seis KPIs. */
export const KPI_READING_PANEL_ID = 'comercial-leitura-gerencial'

/**
 * Leitura gerencial do KPI selecionado.
 *
 * Um painel para os seis indicadores, em vez de seis overlays.
 *
 * O overlay resolvia o problema errado nesta fileira: ele cobria justamente o
 * valor que a pessoa estava apontando, abria e fechava no hover, e em cartão
 * estreito ainda criava uma barra de rolagem dentro do KPI. Aqui a leitura é
 * permanente, cresce com o conteúdo e nunca disputa espaço com o número.
 *
 * `aria-live="polite"` porque a troca de KPI substitui todo o conteúdo deste
 * painel sem mover o foco: sem o anúncio, quem navega por leitor de tela
 * pressionaria o card e não perceberia mudança nenhuma.
 */
export function KpiReadingPanel({ card }: { card: CommercialKpiCard }) {
  return (
    <section
      aria-label="Leitura gerencial do indicador selecionado"
      aria-live="polite"
      className={panelClass}
      id={KPI_READING_PANEL_ID}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] font-bold uppercase tracking-[1px] text-[var(--accent)]">
        <Lightbulb aria-hidden="true" size={12} />
        Leitura gerencial
        <span aria-hidden="true" className="text-[var(--text-disabled)]">
          /
        </span>
        {/* O indicador selecionado é nomeado em texto: a seleção na fileira não
            depende só da cor do card em destaque. */}
        <span className="tracking-[0.8px] text-[var(--text-item)]">{card.nome}</span>
        <span className="font-semibold tracking-[0.8px] text-[var(--text-secondary)]">
          {card.setor}
        </span>
      </p>
      <h2 className="mt-2 text-[14px] font-bold leading-[1.35] text-[var(--text-heading)]">
        {card.leituraTitulo}
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--text-secondary)] [&>b]:font-semibold [&>b]:text-[var(--text-item)]">
        <KpiReadingText text={card.leituraTexto} />
      </p>
      <p className="mt-3 border-t border-[var(--divider)] pt-2.5 text-[11.5px] leading-[1.5] text-[var(--text-secondary)]">
        <span className="font-bold uppercase tracking-[0.5px] text-[var(--text-item)]">
          O que observar{' '}
        </span>
        {card.observar}
      </p>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Leitura do período                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Resumo determinístico do mês.
 *
 * O texto vem inteiro do modelo, calculado a partir dos indicadores. Nenhuma
 * causa é atribuída a equipe, mercado ou operação: os dados desta página não
 * sustentam esse tipo de afirmação.
 */
export function StoryPanel({ story }: { story: CommercialGoalStory }) {
  return (
    <section className={panelClass}>
      <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[1px] text-[var(--accent)]">
        <Lightbulb aria-hidden="true" size={12} />
        Leitura do período
      </p>
      <h2 className="mt-2 text-[14px] font-bold leading-[1.35] text-[var(--text-heading)]">
        {story.title}
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--text-secondary)]">{story.text}</p>
      <p className="mt-3 border-t border-[var(--divider)] pt-2.5 text-[11.5px] leading-[1.5] text-[var(--text-secondary)]">
        <span className="font-bold uppercase tracking-[0.5px] text-[var(--text-item)]">
          O que observar{' '}
        </span>
        {story.watch}
      </p>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Alertas                                                                    */
/* -------------------------------------------------------------------------- */

const alertTone: Record<CommercialGoalAlertTone, { color: string; icon: LucideIcon }> = {
  positivo: { color: '#00a862', icon: CheckCircle2 },
  atencao: { color: '#b16a00', icon: AlertTriangle },
  critico: { color: '#d32744', icon: OctagonAlert },
  neutro: { color: '#64748b', icon: Info },
}

/**
 * Alertas do recorte. A cor nunca é o único sinal: cada alerta tem título,
 * explicação e ícone próprio.
 */
export function AlertsPanel({ alerts }: { alerts: readonly CommercialGoalAlert[] }) {
  if (alerts.length === 0) return null

  return (
    <section aria-label="Alertas do período">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert) => {
          const tone = alertTone[alert.tone]
          const Icon = tone.icon

          return (
            <li
              className="flex gap-2.5 rounded-xl border border-l-[3px] border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5"
              key={alert.id}
              style={{ borderLeftColor: tone.color }}
            >
              <Icon
                aria-hidden="true"
                className="mt-[2px] flex-none"
                size={15}
                style={{ color: tone.color }}
              />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-[var(--text-heading)]">
                  {alert.title}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--text-secondary)]">
                  {alert.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Resumo da equipe                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Duas categorias apenas: atingiu ou não atingiu a meta individual. Sem faixas
 * intermediárias, e somente com vendedores internos elegíveis no recorte, o que
 * deixa Corporativo e Colaboradores de fora por construção.
 */
export function TeamSummaryPanel({
  cities,
  snapshot,
}: {
  cities: readonly CommercialCity[]
  snapshot: CommercialGoalsSnapshot
}) {
  const cityNames = new Map(cities.map((city) => [city.id, city.name]))

  return (
    <section className={panelClass}>
      <h2 className={titleClass}>Resumo da equipe</h2>
      <p className={captionClass}>
        Vendedores internos elegíveis no recorte, com meta individual de{' '}
        {formatNumber(INTERNAL_SELLER_MONTHLY_GOAL)} vendas ativas no mês. Corporativo e
        Colaboradores não possuem meta individual e ficam fora deste resumo.
      </p>

      {snapshot.eligibleInternalSellers.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-[12px] text-[var(--text-secondary)]">
          Nenhum vendedor interno elegível no recorte atual.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <SellerColumn
            cityNames={cityNames}
            color="#00a862"
            items={snapshot.attainedSellers}
            title="Atingiram a meta individual"
          />
          <SellerColumn
            cityNames={cityNames}
            color="#b16a00"
            items={snapshot.notAttainedSellers}
            title="Não atingiram a meta individual"
          />
        </div>
      )}
    </section>
  )
}

function SellerColumn({
  cityNames,
  color,
  items,
  title,
}: {
  cityNames: ReadonlyMap<CommercialCityId, string>
  color: string
  items: readonly CommercialSellerPerformance[]
  title: string
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-baseline gap-2 text-[12px] font-bold uppercase tracking-[0.3px] text-[var(--text-item)]">
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-none rounded-full"
          style={{ background: color }}
        />
        <span className="min-w-0">{title}</span>
        <span className="ml-auto font-mono text-[13px]" style={{ color }}>
          {formatNumber(items.length)}
        </span>
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11.5px] text-[var(--text-secondary)]">
          Nenhum vendedor nesta situação no recorte.
        </p>
      ) : (
        // Sem altura máxima e sem rolagem própria: a lista cresce com o recorte
        // e usa a rolagem principal do dashboard. Uma barra aqui dentro competia
        // com a do `<main>` e escondia parte da equipe sem nenhum sinal.
        <ul className="mt-1.5">
          {items.map((item) => (
            <li
              className="flex items-center justify-between gap-3 border-b border-[var(--divider)] py-1.5 last:border-b-0"
              key={item.seller.id}
            >
              <span className="min-w-0">
                <span
                  className="block truncate text-[12.5px] text-[var(--text-item)]"
                  title={item.seller.name}
                >
                  {item.seller.name}
                </span>
                <span className="block truncate text-[11px] text-[var(--text-secondary)]">
                  {item.seller.cityId === null
                    ? 'Atuação regional'
                    : (cityNames.get(item.seller.cityId) ?? 'Cidade não catalogada')}
                </span>
              </span>
              <span className="flex-none whitespace-nowrap font-mono text-[12.5px] font-semibold text-[var(--text-item)]">
                {formatNumber(item.activeSales)}/{formatNumber(item.goal)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Contribuições                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Contribuição de Colaboradores, Corporativo e composição do realizado total.
 *
 * A composição ocupa a coluna maior porque é a única das três que responde a uma
 * pergunta de distribuição. As duas contribuições continuam existindo com o
 * mesmo número de antes, empilhadas ao lado, e nenhuma delas ganha escala de
 * progresso: nem Colaboradores nem Corporativo têm meta própria.
 */
export function ContributionPanels({ snapshot }: { snapshot: CommercialGoalsSnapshot }) {
  const corporateShare =
    snapshot.totalAchieved === 0 ? null : snapshot.corporateAchieved / snapshot.totalAchieved

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.4fr]">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
        <section className={panelClass}>
          <h2 className={titleClass}>Contribuição de Colaboradores</h2>
          <p className="mt-2 text-[28px] font-extrabold leading-none text-[var(--text-heading)]">
            {formatNumber(snapshot.partnerAchieved)}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[var(--text-secondary)]">
            {snapshot.partnerShareOfGoalAchieved === null
              ? 'Sem realizado da meta no recorte para calcular participação.'
              : `${formatPercent(snapshot.partnerShareOfGoalAchieved)} do realizado da meta`}
          </p>
          <p className="mt-2.5 text-[11.5px] leading-[1.5] text-[var(--text-secondary)]">
            Colaboradores contribuem para o realizado da meta e não criam meta própria. A venda com
            código de indicação é creditada ao colaborador, e não a quem a registrou.
          </p>
        </section>

        <section className={panelClass}>
          <h2 className={titleClass}>Contribuição do Corporativo</h2>
          <p className="mt-2 text-[28px] font-extrabold leading-none text-[var(--text-heading)]">
            {formatNumber(snapshot.corporateAchieved)}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[var(--text-secondary)]">
            {corporateShare === null
              ? 'Sem realizado no recorte para calcular participação.'
              : `${formatPercent(corporateShare)} do realizado total`}
          </p>
          <p className="mt-2.5 text-[11.5px] leading-[1.5] text-[var(--text-secondary)]">
            O Corporativo não possui meta individual de volume. As vendas ativas dele entram
            somente no realizado total usado contra a supermeta e ficam fora da meta normal.
          </p>
        </section>
      </div>

      <CompositionPanel snapshot={snapshot} />
    </div>
  )
}

/**
 * De onde vêm as vendas ativas do recorte.
 *
 * Rosca, e não velocímetro: a pergunta é de composição, e uma escala de
 * progresso para Colaboradores ou Corporativo afirmaria uma meta que não existe.
 *
 * O anel nunca é a única leitura. A lista ao lado repete as três origens com
 * nome, quantidade e percentual, e é ela que sustenta a compreensão sem cor: o
 * ponto colorido é reforço, não informação exclusiva.
 *
 * Realizado total zerado não desenha anel algum. Sem denominador não existe
 * partição, e um anel vazio seria uma afirmação falsa sobre o recorte.
 */
function CompositionPanel({ snapshot }: { snapshot: CommercialGoalsSnapshot }) {
  const total = snapshot.totalAchieved
  const slices = [
    {
      name: 'Vendas Internas',
      note: 'entra na meta normal',
      color: goalsCompositionColors.internal,
      value: snapshot.internalAchieved,
    },
    {
      name: 'Colaboradores',
      note: 'entra na meta normal',
      color: goalsCompositionColors.partner,
      value: snapshot.partnerAchieved,
    },
    {
      name: 'Corporativo',
      note: 'somente supermeta',
      color: goalsCompositionColors.corporate,
      value: snapshot.corporateAchieved,
    },
  ]

  return (
    <section className={panelClass}>
      <h2 className={titleClass}>Composição do realizado</h2>
      <p className={captionClass}>
        De onde vem cada venda ativa do recorte. Vendas Internas e Colaboradores entram na meta
        normal. O Corporativo entra somente na supermeta.
      </p>

      {total === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-[12px] text-[var(--text-secondary)]">
          Nenhuma venda ativa no recorte atual, então não há composição para exibir.
        </p>
      ) : null}

      <div
        className={
          total === 0
            ? 'mt-2.5'
            : 'mt-2 grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]'
        }
      >
        {total === 0 ? null : (
          <Chart
            height={180}
            option={makeGoalsCompositionOptions(
              slices.map(({ color, name, value }) => ({ color, name, value })),
              total,
            )}
          />
        )}
        <dl className="min-w-0">
          {slices.map((slice) => (
            <CompositionRow
              color={slice.color}
              key={slice.name}
              label={slice.name}
              note={slice.note}
              total={total}
              value={slice.value}
            />
          ))}
        </dl>
      </div>
    </section>
  )
}

function CompositionRow({
  color,
  label,
  note,
  total,
  value,
}: {
  color: string
  label: string
  note: string
  total: number
  value: number
}) {
  const share = total === 0 ? null : value / total

  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--divider)] py-1.5 last:border-b-0">
      <dt className="flex min-w-0 items-baseline gap-2 text-[12.5px] text-[var(--text-item)]">
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-none translate-y-[-1px] rounded-full"
          style={{ background: color }}
        />
        <span className="min-w-0">
          {label}
          <span className="ml-1.5 text-[11px] text-[var(--text-secondary)]">({note})</span>
        </span>
      </dt>
      <dd className="flex-none whitespace-nowrap font-mono text-[12.5px] font-semibold text-[var(--text-item)]">
        {formatNumber(value)}
        <span className="ml-1.5 font-sans text-[11px] font-normal text-[var(--text-secondary)]">
          {share === null ? 'sem base' : formatPercent(share)}
        </span>
      </dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Estados                                                                    */
/* -------------------------------------------------------------------------- */

/** Carregamento da base, enquanto os fatos individuais são montados. */
export function LoadingPanel() {
  return (
    <div aria-live="polite" className={panelClass} role="status">
      <p className="text-[13px] text-[var(--text-secondary)]">
        Carregando a base comercial de janeiro a julho de 2026...
      </p>
      <div aria-hidden="true" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div className="h-[86px] animate-pulse rounded-xl bg-[var(--divider)]" key={index} />
        ))}
      </div>
    </div>
  )
}

/** Falha ao montar a base. Não há retorno silencioso para uma tela vazia. */
export function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-l-[3px] border-[var(--border)] bg-[var(--surface)] px-[18px] py-4"
      role="alert"
      style={{ borderLeftColor: '#d32744' }}
    >
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--text-heading)]">
        <OctagonAlert aria-hidden="true" size={16} style={{ color: '#d32744' }} />
        Não foi possível montar a base comercial
      </p>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--text-secondary)]">{message}</p>
    </div>
  )
}

/** Inconsistência encontrada na base: nada é aceito silenciosamente. */
export function ConsistencyPanel({ issues }: { issues: readonly CommercialConsistencyIssue[] }) {
  if (issues.length === 0) return null

  return (
    <section
      aria-label="Inconsistências da base comercial"
      className="rounded-xl border border-l-[3px] border-[var(--border)] bg-[var(--surface)] px-[18px] py-4"
      style={{ borderLeftColor: '#b16a00' }}
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-heading)]">
        <AlertTriangle aria-hidden="true" size={15} style={{ color: '#b16a00' }} />
        Inconsistências encontradas na base
      </p>
      <ul className="mt-1.5">
        {issues.map((issue) => (
          <li className="text-[11.5px] leading-[1.5] text-[var(--text-secondary)]" key={issue.id}>
            {issue.message} Ocorrências: {formatNumber(issue.occurrences)}. Exemplo:{' '}
            {issue.sampleSaleId}.
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Recorte sem resultado possível, com o motivo explícito. */
export function EmptyStatePanel({ description, title }: { description: string; title: string }) {
  return (
    <div className={panelClass}>
      <p className="text-[13.5px] font-semibold text-[var(--text-heading)]">{title}</p>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  )
}
