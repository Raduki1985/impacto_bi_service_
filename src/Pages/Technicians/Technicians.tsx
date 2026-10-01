import { AlertTriangle, CalendarClock, Info, Timer, Users, type LucideIcon } from 'lucide-react'

import { Chart } from '../../components/charts/Chart'
import { ChartCard } from '../../components/dashboard/ChartCard'
import {
  ExecutiveCardGrid,
  type ExecutiveGridCard,
} from '../../components/dashboard/ExecutiveCardGrid'
import type { ExecutiveCardTone } from '../../components/dashboard/executiveMetricCardModel'
import { PageStatePanel } from '../../components/dashboard/PageStatePanel'
import { SectionHeading } from '../../components/dashboard/SectionHeading'
import { PageStickyHeader } from '../../components/layout/PageStickyHeader'
import { OverviewOsProvider } from '../../contexts/OverviewOsContext'
import { useOverviewOs } from '../../contexts/useOverviewOs'
import { useReportPageSourceStatus } from '../../contexts/usePageSourceStatus'
import { usePreferences } from '../../contexts/usePreferences'
import {
  formatDateBr,
  formatDecimal,
  formatMinutes,
  formatNumber,
  formatPercent,
  initials,
} from '../../lib/formatters'
import { OverviewFilterPanel } from '../Overview/OverviewFilterPanel'
import {
  makeTechnicianRankingOptions,
  makeUnproductiveReasonsOptions,
} from './techniciansChartOptions'
import {
  buildTechnicianRows,
  buildTechniciansSummary,
  buildUnproductiveReasons,
  hasFieldTiming,
  RANKING_MIN_DAYS,
  rowsOfFront,
  WORK_FRONTS,
  type TechnicianRow,
  type WorkFrontKey,
} from './techniciansModel'

/**
 * Gestão de Técnicos de OS sobre a fonte real do serviço de BI.
 *
 * Até 21/09/2026 esta página era inteiramente simulada: nomes reais com
 * desempenho inventado, herdados do painel de demonstração. Ela passou a ler
 * os mesmos registros da Visão Geral de OS, pelo mesmo provedor e com a mesma
 * faixa de filtros, e a responder três perguntas, de cima para baixo:
 *
 * 1. Como está a operação de campo no período: quantos técnicos, quantas
 *    visitas por dia, quanto tempo por serviço e quanto do dia é produtivo.
 * 2. Quem entrega mais, dentro da própria frente de trabalho: quem instala
 *    internet não é comparado com quem instala câmera.
 * 3. O que impediu a visita de acontecer, por motivo, como contexto.
 *
 * As três decisões que sustentam o ranking estão em `techniciansModel.ts`,
 * com a medição do SGI que levou a cada uma.
 */
export function Technicians() {
  return (
    <OverviewOsProvider>
      <TechniciansBody />
    </OverviewOsProvider>
  )
}

function TechniciansBody() {
  const { errorMessage, status, updatedAt } = useOverviewOs()

  useReportPageSourceStatus(
    status === 'loading' ? 'loading' : status === 'error' ? 'unavailable' : 'ready',
    updatedAt === null ? null : formatDateBr(updatedAt),
  )

  if (status === 'loading') {
    return (
      <PageStatePanel title="Carregando as visitas dos técnicos">
        Buscando os dados no serviço de BI.
      </PageStatePanel>
    )
  }

  // Falha NÃO cai na base local: desempenho de gente com número de estudo
  // apresentado como número do banco seria pior do que a ausência da página.
  if (status === 'error') {
    return (
      <PageStatePanel kind="error" title="Não foi possível carregar a Gestão de Técnicos">
        {errorMessage ?? 'O serviço de BI não respondeu.'}
      </PageStatePanel>
    )
  }

  return (
    <>
      <PageStickyHeader className="mb-3.5">
        <OverviewFilterPanel />
      </PageStickyHeader>
      <TechniciansContent />
    </>
  )
}

/** Aviso de leitura: explica um recorte que muda o sentido dos números. */
function PageNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3.5 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--text-secondary)]"
      role="note"
    >
      <Info aria-hidden="true" className="mt-0.5 flex-none text-[#b45309]" size={15} />
      <span>{children}</span>
    </p>
  )
}

/**
 * Cor de identidade de cada frente, fixa e igual nos dois temas.
 *
 * Todas saem da paleta que o portal já usa, e as quatro foram medidas em
 * 21/09/2026 contra a superfície clara (`#ffffff`) e a escura (`#1f2937`),
 * com o mínimo de 3,0 que a casa exige: azul 4,50 e 3,26; teal 3,66 e 4,02;
 * terracota 4,31 e 3,40; cinza 4,76 e 3,08. A terracota é a mesma que a Visão
 * Geral já usa para Infraestrutura.
 */
const FRONT_COLORS: Readonly<Record<WorkFrontKey, string>> = {
  internet: '#2f6bff',
  cameras: '#0f9689',
  infrastructure: '#b5652f',
  other: '#64748b',
}

/** Cor do status Improdutiva nos gráficos de OS: a mesma dos motivos aqui. */
const UNPRODUCTIVE_COLOR = '#e5484d'

/** Altura do painel de ranking, proporcional à quantidade de barras. */
function rankingHeight(rows: number): number {
  return Math.max(180, Math.min(rows, 14) * 26 + 24)
}

function TechniciansContent() {
  const { filteredRecords, filters, technicians } = useOverviewOs()
  const { theme } = usePreferences()

  const rows = buildTechnicianRows(filteredRecords, technicians)
  const summary = buildTechniciansSummary(filteredRecords)
  const reasons = buildUnproductiveReasons(filteredRecords)
  const timed = hasFieldTiming(filteredRecords)

  // Com status marcado no filtro, a página deixa de descrever o período
  // inteiro: filtrar Concluída zera as improdutivas e leva toda taxa a 100%.
  const selectedStatuses = filters.status

  // Só as frentes com técnico no recorte ganham painel: uma frente vazia
  // desenharia um gráfico sem barra ao lado de outro cheio.
  const frontsWithPeople = WORK_FRONTS.filter(
    (front) => rowsOfFront(rows, front.key).length > 0,
  )

  const cards: TechnicianCard[] = [
    {
      icon: Users,
      label: 'Técnicos em campo',
      value: formatNumber(summary.technicians),
      tone: 'blue',
      detail: `${formatNumber(summary.visits)} visitas em ${formatNumber(summary.workDays)} dias de campo`,
      readingTitle: 'Técnicos que executaram ao menos uma visita no período.',
      readingText:
        'Conta quem esteve em campo, e não o quadro de funcionários. Uma OS só {agendada} ou encerrada no escritório não coloca ninguém na rua e não entra aqui.',
      observe: 'Queda no número com o mesmo volume de OS significa time menor carregando o mesmo.',
    },
    {
      icon: CalendarClock,
      label: 'Concluídas por dia',
      value: summary.completedPerDay === null ? 'Sem dados' : formatDecimal(summary.completedPerDay, 1),
      tone: 'green',
      detail: `${formatNumber(summary.completed)} visitas concluídas no período`,
      readingTitle: 'Média de visitas concluídas por técnico em cada dia de campo.',
      readingText:
        'É a régua do ranking. Divide pelos {dias em que o técnico saiu}, e não pelos dias do mês: quem entrou no meio do período ou tirou férias não aparece pior por isso.',
      observe: 'Leia junto do tempo por visita: concluir mais em serviços curtos não é o mesmo ganho.',
    },
    {
      icon: Timer,
      label: 'Tempo por visita',
      value: summary.serviceMinutes === null ? 'Sem dados' : formatMinutes(summary.serviceMinutes),
      tone: 'cyan',
      detail:
        summary.travelMinutes === null
          ? 'Deslocamento não medido no recorte'
          : `Mais ${formatMinutes(summary.travelMinutes)} de deslocamento até o cliente`,
      readingTitle: 'Tempo mediano com a mão no serviço, do início ao fim no cliente.',
      readingText:
        'Mediana, e não média: uma visita de oito horas não desloca o número do time inteiro. O {deslocamento} é medido à parte e aparece na linha de detalhe.',
      observe: 'Tempo alto pode ser serviço difícil, e não lentidão: confira a dificuldade no SGI.',
    },
    {
      icon: AlertTriangle,
      label: 'Ocupação do dia',
      value: summary.occupancy === null ? 'Sem dados' : formatPercent(summary.occupancy),
      tone: 'amber',
      detail: 'Parte da jornada em serviço ou em deslocamento',
      readingTitle: 'Quanto do dia em campo foi serviço ou estrada, e não espera.',
      readingText:
        'A jornada vai do {primeiro serviço ao último} do dia. Só entram dias com duas visitas ou mais: num dia de visita única a jornada é a própria visita, e a conta daria sempre 100%.',
      observe: 'O resto do dia é espera, almoço e tempo entre uma ordem e outra.',
    },
  ]

  return (
    <div>
      {selectedStatuses.length > 0 ? (
        <PageNote>
          <strong className="font-bold text-[#b45309]">
            Filtro de status ativo: {selectedStatuses.join(', ')}.
          </strong>{' '}
          Os números desta página descrevem só as OS{' '}
          {selectedStatuses.length === 1 ? 'nesse status' : 'nesses status'}, e não o período inteiro. Taxa de
          conclusão e motivos de improdutiva perdem o sentido neste recorte.
        </PageNote>
      ) : null}
      {timed ? null : (
        <PageNote>
          <strong className="font-bold text-[#b45309]">Sem medição de tempo neste recorte.</strong>{' '}
          A fonte em uso não traz os horários de campo, então tempo por visita, deslocamento e
          ocupação ficam sem valor. O ranking por volume continua válido.
        </PageNote>
      )}
      <SectionHeading
        description="Tamanho do time em campo, ritmo de entrega e uso do dia"
        title="Operação de campo no período"
      />
      {/* Nenhum card traz comparação com o período anterior: a janela
          anterior das visitas de campo ainda não foi definida com o Mário, e
          um delta inventado seria pior do que a ausência dele. */}
      <ExecutiveCardGrid
        ariaLabel="Indicadores da operação de campo"
        cards={cards.map(
          (card): ExecutiveGridCard => ({
            id: card.label,
            accessibleText: `${card.label}: ${card.value}.`,
            definition: card.readingTitle,
            detail: card.detail,
            icon: card.icon,
            label: card.label,
            observe: card.observe,
            readingText: card.readingText,
            readingTitle: card.readingTitle,
            tone: card.tone,
            value: card.value,
            variant: 'spark',
          }),
        )}
        className="mb-4"
      />
      <SectionHeading
        description={`Visitas concluídas por dia trabalhado · quem faz câmera não é comparado com quem faz internet · a partir de ${RANKING_MIN_DAYS} dias em campo`}
        title="Ranking por frente de trabalho"
      />
      {frontsWithPeople.length === 0 ? (
        <ChartCard
          className="mb-4"
          subtitle="Nenhum técnico executou visita no recorte"
          title="Ranking por frente de trabalho"
          variant="executive"
        >
          <p className="py-10 text-center text-[12.5px] text-[var(--text-secondary)]">
            Sem visitas no período selecionado.
          </p>
        </ChartCard>
      ) : (
        <div
          className={`mb-4 grid grid-cols-1 gap-3.5 ${frontsWithPeople.length > 1 ? 'lg:grid-cols-2' : ''}`}
        >
          {frontsWithPeople.map((front) => {
            const doFront = rowsOfFront(rows, front.key)
            const noRanking = doFront.filter((row) => !row.lowActivity)
            // Todo mundo da frente abaixo do piso: o painel diz isso em vez de
            // "sem visitas", que contradiria a contagem de técnicos ao lado.
            const emptyMessage =
              noRanking.length === 0
                ? `Nenhum técnico com ${RANKING_MIN_DAYS} dias em campo no período`
                : undefined

            return (
              <ChartCard
                key={front.key}
                subtitle={
                  noRanking.length === doFront.length
                    ? `${formatNumber(doFront.length)} técnicos no período`
                    : `${formatNumber(noRanking.length)} no ranking, de ${formatNumber(doFront.length)} técnicos no período`
                }
                title={front.label}
                variant="executive"
              >
                <Chart
                  height={rankingHeight(noRanking.length)}
                  option={makeTechnicianRankingOptions({
                    name: front.label,
                    rows: noRanking,
                    color: FRONT_COLORS[front.key],
                    emptyMessage,
                    theme,
                  })}
                />
              </ChartCard>
            )
          })}
        </div>
      )}
      <SectionHeading
        description="O que impediu a visita de acontecer, e o desempenho linha a linha"
        title="Contexto e detalhamento"
      />
      {/* `minmax(0,...)` nas duas colunas para o nome longo do técnico poder
          encurtar: sem ele a coluna cresce com o conteúdo e a tabela empurra a
          última medida para fora da vista. A tabela leva a maior fatia porque
          tem oito colunas; os motivos são sete barras curtas. */}
      <div className="mb-4 grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)]">
        <ChartCard
          subtitle="Contexto da operação, não avaliação do técnico"
          title="Por que a visita não aconteceu"
          variant="executive"
        >
          {/* A improdutiva fica FORA do ranking de propósito: dos motivos
              medidos no SGI entre junho e setembro de 2026, a maioria é
              cliente ausente, local sem condição e clima. */}
          <Chart
            height={Math.max(rankingHeight(reasons.length), 320)}
            option={makeUnproductiveReasonsOptions({
              rows: reasons,
              color: UNPRODUCTIVE_COLOR,
              theme,
            })}
          />
        </ChartCard>
        <ChartCard
          subtitle={`${formatNumber(rows.length)} técnicos em campo · ordenado por concluídas por dia`}
          title="Desempenho por técnico"
          variant="executive"
        >
          <TechnicianTable rows={rows} timed={timed} />
        </ChartCard>
      </div>
    </div>
  )
}

type TechnicianCard = {
  readonly icon: LucideIcon
  readonly label: string
  readonly value: string
  readonly tone: ExecutiveCardTone
  readonly detail: string
  readonly readingTitle: string
  readonly readingText: string
  readonly observe: string
}

/**
 * Cabeçalho de coluna da tabela, alinhado à direita nos números.
 *
 * `whitespace-nowrap` nas colunas numéricas porque `1h 36m` e `19 min` têm um
 * espaço no meio e quebravam em duas linhas na largura apertada, deixando as
 * linhas da tabela com alturas diferentes.
 */
function Th({ children, numeric = false }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      // O `sticky` e o fundo ficam no `th`, e NÃO no `tr`: com
      // `border-collapse`, fundo e borda da linha não acompanham a célula
      // presa, e o cabeçalho ficava transparente com as linhas passando por
      // baixo durante a rolagem. A borda inferior sai como sombra interna pelo
      // mesmo motivo. É a solução que o `DataTable` do portal já usa.
      className={`sticky top-0 z-[1] bg-[var(--surface)] px-2.5 py-2 font-semibold text-[var(--text-secondary)] shadow-[inset_0_-1px_0_var(--border)] ${numeric ? 'whitespace-nowrap text-right' : 'text-left'}`}
      scope="col"
    >
      {children}
    </th>
  )
}

/** Célula numérica da tabela, em fonte monoespaçada e sem quebrar o valor. */
function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap px-2.5 py-2 text-right font-mono ${strong ? 'font-semibold text-[var(--text-heading)]' : 'text-[var(--text-secondary)]'}`}
    >
      {children}
    </td>
  )
}

/**
 * Tabela de desempenho, a leitura linha a linha do ranking.
 *
 * Escrita na página, e não com o `DataTable` compartilhado, porque aquele
 * componente tem superfície branca fixa e não acompanha o tema escuro dos
 * painéis executivos. Alterá-lo mudaria a aparência das telas simuladas que
 * ainda o usam.
 *
 * Quem está abaixo do piso de dias aparece no fim, marcado: esconder o técnico
 * com pouca atividade esconderia trabalho que aconteceu.
 */
function TechnicianTable({ rows, timed }: { rows: readonly TechnicianRow[]; timed: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-[12.5px] text-[var(--text-secondary)]">
        Sem visitas no período selecionado.
      </p>
    )
  }

  return (
    // `isolate` prende o `z-[1]` do cabeçalho preso a esta tabela, a mesma
    // solução da lista do portal (`ListTable`). Sem ele, o cabeçalho disputava
    // nível com a faixa fixa de filtros, que também é `z-[1]`, e passava por
    // cima dela durante a rolagem (visto no navegador em 24/09/2026).
    <div className="isolate max-h-[420px] overflow-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left">
            <Th>Técnico</Th>
            <Th>Frente</Th>
            <Th numeric>Por dia</Th>
            <Th numeric>Concl.</Th>
            <Th numeric>Improd.</Th>
            <Th numeric>Dias</Th>
            {timed ? <Th numeric>Serviço</Th> : null}
            {timed ? <Th numeric>Desloc.</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className="border-t border-[var(--border)] align-middle"
              key={row.id}
            >
              <td className="px-2.5 py-2">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: FRONT_COLORS[row.front] }}
                  >
                    {initials(row.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--text-heading)]">
                      {row.name}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-secondary)]">
                      {row.lowActivity
                        ? `Pouca atividade, menos de ${RANKING_MIN_DAYS} dias em campo`
                        : (row.team ?? 'Sem equipe no cadastro')}
                    </span>
                  </span>
                </div>
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[var(--text-secondary)]">
                {WORK_FRONTS.find((front) => front.key === row.front)?.label}
              </td>
              <Td strong>{formatDecimal(row.completedPerDay, 1)}</Td>
              <Td>{formatNumber(row.completed)}</Td>
              <Td>{formatNumber(row.unproductive)}</Td>
              <Td>{formatNumber(row.daysWorked)}</Td>
              {timed ? (
                <Td>{row.serviceMinutes === null ? '·' : formatMinutes(row.serviceMinutes)}</Td>
              ) : null}
              {timed ? (
                <Td>{row.travelMinutes === null ? '·' : formatMinutes(row.travelMinutes)}</Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
