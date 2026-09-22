import { AlertTriangle } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { OS_CHART_ACCENT } from '../../components/charts/chartOptions'
import { useOverviewOs } from '../../contexts/useOverviewOs'
import { statusColors } from '../../data/dashboardAggregates'
import { todayISO } from '../../data/defaultPeriod'
import { formatDateBr, formatNumber, formatPercent } from '../../lib/formatters'
import {
  applyTodayFilters,
  buildCarryOverOs,
  buildCarryOverRows,
  buildTodayRows,
  buildTodaySummary,
  buildTodayUnassigned,
  carryOverMessage,
  formatClock,
  hasTodayFilters,
  hourOf,
  TODAY_BUCKETS,
  todayOnly,
  type TodayBucketKey,
  type TodaySelection,
  type TodayUnassigned,
} from './todayOsModel'
import { TodayOsTable } from './TodayOsTable'
import { useTodayOs } from './useTodayOs'

/**
 * Faixa "Hoje ao vivo" da Visão Geral.
 *
 * Fica acima dos indicadores do período porque é a primeira pergunta do
 * gestor ao abrir a página de manhã ou no meio da tarde: como está o dia.
 * A faixa lê só as OS agendadas para hoje, direto do serviço, e se atualiza
 * sozinha a cada minuto; o restante da página continua parado no recorte que
 * o gestor escolheu.
 *
 * Desde 21/09/2026 cada caixa ABRE: um clique mostra, logo abaixo, quais são
 * as OS daquela situação, com código, turno, tipo, categoria, cidade, técnico,
 * equipe e o desfecho registrado, e cada coluna filtra e ordena a lista. O
 * número sozinho dizia quantas; a lista diz quais, que é o que permite agir
 * ainda hoje.
 *
 * Com a base local de estudo não existe "hoje": a faixa diz isso e não
 * desenha número nenhum, em vez de mostrar um dia vazio como se fosse
 * resultado.
 */

/**
 * Cor de cada caixa, pela cor semântica do status que a representa. É
 * identidade, não julgamento: "em campo" leva o âmbar de Em Andamento porque
 * é trabalho em curso, e "a fazer" o azul de Agendada.
 */
const BUCKET_COLORS: Readonly<Record<TodayBucketKey, string>> = {
  done: statusColors.Concluída,
  inField: statusColors['Em Andamento'],
  toDo: statusColors.Agendada,
  unproductive: statusColors.Improdutiva,
  notExecuted: statusColors.Encerrada,
  unknown: statusColors.Pendente,
}

// Guarda do domínio fechado, a mesma do destino das OS: caixa sem cor
// declarada é erro no carregamento, e não uma caixa que abre sem borda nem
// fundo porque o rótulo do status foi renomeado em outro arquivo.
for (const bucket of TODAY_BUCKETS) {
  if (!BUCKET_COLORS[bucket.key]) {
    throw new Error(`Hoje ao vivo: a caixa ${bucket.label} está sem cor declarada.`)
  }
}

/**
 * Cor da caixa "Agenda do dia", que não representa um status: o azul de DADOS
 * da página, o mesmo das barras. O azul da estrutura não seria visto como
 * borda sobre a superfície escura da faixa.
 */
const TOTAL_COLOR = OS_CHART_ACCENT

/** Nome da caixa aberta no cabeçalho da lista. */
const TOTAL_LABEL = 'Agenda do dia'

/** Um único destino para a lista, que é também o alvo do `aria-controls`. */
const LIST_ID = 'os-today-list'

/** Destino da lista do aviso de dias anteriores, que pode abrir junto com a das caixas. */
const CARRY_OVER_LIST_ID = 'os-today-carry-over-list'

function Note({ children }: { children: ReactNode }) {
  return <p className="py-3 text-[12px] text-[var(--text-secondary)]">{children}</p>
}

/**
 * Segunda linha da caixa `A fazer`: quantas das OS pendentes ainda não têm
 * técnico.
 *
 * Fica aqui, e não numa caixa própria, por decisão do Mário em 22/09/2026:
 * toda OS sem técnico está em `a fazer`, então "18 das 66" é uma frase que
 * fecha, enquanto uma caixa separada somaria por fora das seis e faria a
 * faixa crescer por uma exceção.
 *
 * O alarme é do TURNO, não do número. Antes da hora do turno a linha é só
 * informação, em cinza; depois dela vira atenção, com a cor e o triângulo.
 */
function UnassignedNote({ unassigned }: { unassigned: TodayUnassigned }) {
  if (unassigned.total === 0) return null
  if (unassigned.atRisk === 0) {
    return (
      <span className="mt-0.5 block">{formatNumber(unassigned.total)} sem técnico</span>
    )
  }

  const period = unassigned.riskPeriod
  const scope = period === null ? '' : ` na ${period.toLocaleLowerCase('pt-BR')}`

  return (
    <span
      className="mt-0.5 flex items-center gap-1 font-semibold"
      style={{ color: 'var(--os-attention)' }}
      // A frase curta cabe na caixa; o total e a régua ficam aqui, para quem
      // parar o ponteiro, sem gastar linha na faixa.
      title={`${formatNumber(unassigned.atRisk)} de ${formatNumber(unassigned.total)} OS sem técnico já passaram da hora em que o turno costuma começar.`}
    >
      <AlertTriangle aria-hidden="true" className="h-3 w-3 flex-none" strokeWidth={2.2} />
      {formatNumber(unassigned.atRisk)} sem técnico{scope}
    </span>
  )
}

/** Nome da lista que o aviso abre, no cabeçalho da tabela. */
const CARRY_OVER_LABEL = 'De dias anteriores'

/** O que a coluna Detalhe traz nessa lista, no lugar da frase das caixas. */
const CARRY_OVER_DESCRIPTION =
  'Cada coluna filtra e ordena só esta lista. Detalhe traz a data da OS e a hora em que o serviço começou, quando chegou a começar.'

/**
 * Aviso das OS de dias anteriores que continuam abertas no aplicativo.
 *
 * Só aparece quando existe caso (decisão do Mário em 22/09/2026): em catorze
 * dias houve uma única OS assim, e um aviso permanente dizendo "nenhuma
 * pendência" ocuparia a faixa todo dia para informar o normal.
 *
 * É um botão, como as caixas, e abre a lista dessas OS logo abaixo (pedido do
 * Mário no mesmo dia): a frase nomeia uma OS, mas com várias ela só conta, e
 * essas OS não estão em nenhuma lista das caixas, que são só de hoje.
 */
function CarryOverNote({
  message,
  onToggle,
  open,
}: {
  message: string
  onToggle: () => void
  open: boolean
}) {
  return (
    <button
      aria-controls={open ? CARRY_OVER_LIST_ID : undefined}
      aria-expanded={open}
      className="mt-3 flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left text-[11.5px] leading-[1.45] text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onClick={onToggle}
      style={{
        background: `color-mix(in srgb, var(--os-attention) ${open ? 14 : 8}%, transparent)`,
        border: `1px solid color-mix(in srgb, var(--os-attention) ${open ? 60 : 28}%, transparent)`,
      }}
      type="button"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-px h-3.5 w-3.5 flex-none"
        strokeWidth={2.2}
        style={{ color: 'var(--os-attention)' }}
      />
      <span className="min-w-0">
        {message}
        {/* A frase não parece clicável por si só: o verbo logo depois dela
            diz o que o clique faz, e fica colado a ela em vez de na outra
            ponta da faixa. Aberta, a lista tem o próprio Fechar, e um segundo
            aqui era repetição (apontada pelo Mário em 22/09/2026); a borda
            mais forte é o que diz que ela está aberta, como nas caixas. */}
        {open ? null : (
          <span className="ml-2 font-semibold text-[var(--accent)]">Ver as OS</span>
        )}
      </span>
    </button>
  )
}

/**
 * Caixa da faixa. É um botão porque abre a lista de OS: a caixa aberta fica
 * com a borda e um fundo na própria cor, e o estado nunca depende só da cor,
 * já que o `aria-expanded` e a lista logo abaixo dizem o mesmo.
 */
function TodayBox({
  children,
  color,
  label,
  onToggle,
  open,
  value,
}: {
  children: ReactNode
  color: string
  label: ReactNode
  onToggle: () => void
  open: boolean
  value: number
}) {
  return (
    <li>
      <button
        aria-controls={open ? LIST_ID : undefined}
        aria-expanded={open}
        // `h-full` mantém as seis caixas com a mesma altura quando uma delas
        // ganha a segunda linha do detalhe de técnico.
        className="h-full w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-left transition-colors hover:border-[var(--text-disabled)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        onClick={onToggle}
        style={
          open
            ? {
                borderColor: color,
                background: `color-mix(in srgb, ${color} 12%, var(--surface-elevated))`,
              }
            : undefined
        }
        type="button"
      >
        <span className="block text-[10.5px] font-bold uppercase tracking-[0.4px] text-[var(--text-secondary)]">
          {label}
        </span>
        <strong className="mt-1 block font-mono text-[23px] font-bold leading-none tracking-[-0.8px] text-[var(--text-heading)]">
          {formatNumber(value)}
        </strong>
        <span className="mt-1.5 block text-[11px] text-[var(--text-secondary)]">{children}</span>
      </button>
    </li>
  )
}

export function TodayStrip() {
  const { coverage, filters, origin, technicians } = useOverviewOs()
  const today = todayISO()
  const live = useTodayOs(origin === 'api', today)
  // A leitura ao vivo cobre a última semana. As caixas contam SÓ hoje, então
  // elas seguem somando 100% do dia; o que ficou para trás vira o aviso.
  const windowRecords = applyTodayFilters(live.records, filters)
  const records = todayOnly(windowRecords, today)
  const summary = buildTodaySummary(records)
  // Uma hora só para a caixa e para a lista: o que a caixa conta em risco é
  // exatamente o que a lista marca.
  const hour = hourOf(live.generatedAt)
  const unassigned = buildTodayUnassigned(records, hour)
  const carryOverOs = buildCarryOverOs(windowRecords, today)
  const carryOver = carryOverMessage(carryOverOs, today, formatDateBr)
  const filtered = hasTodayFilters(filters)
  const clock = formatClock(live.generatedAt)

  // Caixa aberta. A seleção é derivada no render, e não corrigida num efeito:
  // trocar um filtro pode zerar a caixa "sem classificação", que some da
  // faixa, e a lista de uma caixa que não existe mais fecha sozinha.
  const [selected, setSelected] = useState<TodaySelection | null>(null)
  const openable = new Set<TodaySelection>(['all', ...summary.buckets.map((bucket) => bucket.key)])
  const open = selected !== null && openable.has(selected) ? selected : null

  // A lista do aviso tem estado PRÓPRIO: abrir as OS de dias anteriores não
  // fecha a caixa que o gestor deixou aberta, e fechá-la devolve a faixa
  // exatamente como estava (apontado pelo Mário em 22/09/2026). Também
  // derivada no render: fechada a OS no SGI, a lista some junto com o aviso.
  const [carryOverSelected, setCarryOverSelected] = useState(false)
  const carryOverOpen = carryOverSelected && carryOverOs.length > 0

  // O nome do técnico pode vir do catálogo da carga inteira ou do catálogo da
  // consulta do dia. Os dois entram no mesmo mapa: o do dia é o mais recente e
  // fica por cima, e assim um técnico que só tem OS hoje também aparece.
  const technicianNames = new Map(
    [...technicians, ...live.technicians].map((technician) => [technician.id, technician.name]),
  )

  const subtitleParts = [`Agenda de ${formatDateBr(today)}`]
  if (clock !== null) subtitleParts.push(`leitura do serviço às ${clock}`)
  if (origin === 'api') subtitleParts.push('atualiza a cada minuto')
  if (filtered) subtitleParts.push('com os filtros da página, exceto período e status')
  // A caixa não parece clicável por si só, então a faixa avisa. Só quando há
  // o que abrir: com o dia vazio a dica seria promessa falsa.
  if (origin === 'api' && summary.total > 0) subtitleParts.push('clique numa caixa para ver as OS')
  if (live.status === 'error' && live.generatedAt !== null) {
    subtitleParts.push('o serviço não respondeu na última tentativa')
  }

  let body: ReactNode
  if (origin !== 'api') {
    body = (
      <Note>
        Disponível com o portal ligado ao serviço de BI. A base local de estudo termina em{' '}
        {formatDateBr(coverage.max)} e não tem o dia de hoje.
      </Note>
    )
  } else if (live.status === 'loading') {
    body = <Note>Buscando a agenda de hoje no serviço de BI.</Note>
  } else if (live.status === 'error' && live.generatedAt === null) {
    body = <Note>{live.errorMessage ?? 'Não foi possível ler a agenda de hoje.'}</Note>
  } else if (summary.total === 0) {
    body = (
      <Note>
        Nenhuma OS agendada para hoje{filtered ? ' com os filtros da página' : ''}.
      </Note>
    )
  } else {
    body = (
      <>
        <ul
          aria-label="Agenda de hoje por situação"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <TodayBox
            color={TOTAL_COLOR}
            label={TOTAL_LABEL}
            onToggle={() => setSelected((current) => (current === 'all' ? null : 'all'))}
            open={open === 'all'}
            value={summary.total}
          >
            OS agendadas para hoje
          </TodayBox>
          {summary.buckets.map((bucket) => (
            <TodayBox
              color={BUCKET_COLORS[bucket.key]}
              key={bucket.key}
              label={
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 flex-none rounded-full"
                    style={{ background: BUCKET_COLORS[bucket.key] }}
                  />
                  {bucket.label}
                </span>
              }
              onToggle={() =>
                setSelected((current) => (current === bucket.key ? null : bucket.key))
              }
              open={open === bucket.key}
              value={bucket.count}
            >
              {formatPercent(bucket.share)} do dia
              {bucket.key === 'toDo' ? <UnassignedNote unassigned={unassigned} /> : null}
            </TodayBox>
          ))}
        </ul>
        {open !== null ? (
          <TodayOsTable
            id={LIST_ID}
            // A caixa aberta é a identidade da tabela: trocar de caixa monta
            // outra, com os filtros de coluna zerados. Sem isto, um recorte de
            // Improdutivas continuaria valendo ao abrir Concluídas, e o gestor
            // veria uma lista curta sem entender por quê.
            key={open}
            label={
              open === 'all'
                ? TOTAL_LABEL
                : (summary.buckets.find((bucket) => bucket.key === open)?.label ?? TOTAL_LABEL)
            }
            onClose={() => setSelected(null)}
            rows={buildTodayRows(records, open, technicianNames, hour)}
          />
        ) : null}
      </>
    )
  }

  return (
    <section
      aria-label="Hoje ao vivo"
      className="os-today mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm"
    >
      <div className="text-[13.5px] font-semibold text-[var(--text-heading)]">Hoje ao vivo</div>
      <div className="mb-2 text-[11px] leading-[1.45] text-[var(--text-secondary)]">
        {subtitleParts.join(' · ')}
      </div>
      {body}
      {/* Fora do corpo de propósito: um domingo sem agenda continua podendo
          ter uma OS de sexta parada no aplicativo. */}
      {carryOver === null ? null : (
        <CarryOverNote
          message={carryOver}
          onToggle={() => setCarryOverSelected((current) => !current)}
          open={carryOverOpen}
        />
      )}
      {carryOverOpen ? (
        <TodayOsTable
          description={CARRY_OVER_DESCRIPTION}
          id={CARRY_OVER_LIST_ID}
          label={CARRY_OVER_LABEL}
          onClose={() => setCarryOverSelected(false)}
          // Dia e mês bastam na coluna: a janela é de uma semana, e o ano só
          // roubava espaço da hora de início.
          rows={buildCarryOverRows(windowRecords, today, technicianNames, (iso) =>
            formatDateBr(iso).slice(0, 5),
          )}
        />
      ) : null}
    </section>
  )
}
