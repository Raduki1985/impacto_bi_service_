import { AlertTriangle } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { OS_CHART_ACCENT } from '../../components/charts/chartOptions'
import { LiveBox, LiveNote, LiveStrip } from '../../components/dashboard/LiveStrip'
import { PageSkeleton } from '../../components/dashboard/PageSkeleton'
import { useOverviewOs } from '../../contexts/useOverviewOs'
import { statusColors } from '../../data/dashboardAggregates'
import { todayISO } from '../../data/defaultPeriod'
import { downloadXlsx } from '../../lib/downloadFile'
import { formatDateBr, formatDateTimeBr, formatPercent } from '../../lib/formatters'
import {
  buildOsWorkbook,
  describeListFilters,
  osExportFileName,
  osExportPeriod,
  osExportSource,
  todayExportRows,
  todayListRange,
} from './osListExport'
import { pageFiltersText } from './osListModel'
import { OUTCOME_COLORS } from './overviewOutcomeChartOptions'
import { TodayStripBoxesSkeleton } from './OverviewSkeleton'
import {
  buildCarryOverRows,
  buildTodayRows,
  buildTodayUnassignedFromCounts,
  carryOverCornerLabel,
  carryOverMessage,
  formatClock,
  hasTodayFilters,
  hourOf,
  RESCHEDULED_STATUS_LABEL,
  rescheduledCornerLabel,
  rescheduledToDoCount,
  TODAY_BUCKETS,
  unassignedCornerLabel,
  type CornerText,
  type TodayBucketKey,
  type TodayOsRow,
  type TodaySelection,
  type TodayUnassigned,
} from './todayOsModel'
import { TodayOsTable } from './TodayOsTable'
import { TODAY_COLUMNS, TODAY_NO_TECHNICIAN_LABEL, type TodayOsTableFilters } from './todayOsTableModel'
import { useTodayOs, useTodayOsBox } from './useTodayOs'

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
 *
 * Desde 25/09/2026 a moldura e a caixa são as do portal (`LiveStrip`,
 * `LiveBox`), as mesmas da faixa de vendas da Visão Geral Comercial. O que
 * fica aqui é o que só a OS sabe: as caixas, as cores, os atalhos e as
 * listas.
 */

/**
 * Cor de cada caixa, pela cor semântica do status que a representa. É
 * identidade, não julgamento: "em campo" leva o verde-azulado de Técnico no
 * Local porque é trabalho em curso, e "a fazer" o azul de Agendada.
 *
 * "Não executadas" leva a mesma cor da saída no Destino das OS, para a caixa
 * do dia e a fatia do período se lerem como a mesma coisa. Em 30/09/2026 o
 * Mário trocou essa cor do cinza para o âmbar, e o âmbar era de "em campo":
 * para não ter duas caixas iguais lado a lado, "em campo" passou ao
 * verde-azulado.
 */
const BUCKET_COLORS: Readonly<Record<TodayBucketKey, string>> = {
  done: statusColors.Concluída,
  inField: statusColors['Técnico no Local'],
  toDo: statusColors.Agendada,
  unproductive: statusColors.Improdutiva,
  notExecuted: OUTCOME_COLORS.notExecuted,
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

/** Atalho do canto inferior direito de uma caixa: o que ele diz e o que abre. */
type TodayBoxCorner = CornerText & { readonly onClick: () => void }

/**
 * Atalho "sem técnico" da caixa `A fazer`, clicável, no canto inferior
 * direito (decisão do Mário em 23/09/2026). Fica nesta caixa, e não numa
 * caixa própria: toda OS sem técnico está em `a fazer`.
 *
 * O texto vem de `unassignedCornerLabel`: total do dia em cinza antes da
 * hora dos turnos; depois, só as atrasadas, em atenção, com o turno entre
 * parênteses. O clique abre a lista de A fazer filtrada por "Sem técnico" e,
 * quando a legenda nomeia um turno, também por ele: legenda e lista dizem o
 * mesmo número.
 */
function unassignedCorner(unassigned: TodayUnassigned, onClick: () => void): TodayBoxCorner | null {
  const text = unassignedCornerLabel(unassigned)

  return text === null ? null : { ...text, onClick }
}

/**
 * Recorte com que a lista abre quando vem de um atalho de canto. O turno
 * fica guardado no clique, e não lido ao vivo: às 15h a régua muda e a lista
 * aberta não pode remontar sozinha, zerando o que o gestor filtrou.
 */
type ListPreset =
  | { readonly kind: 'unassigned'; readonly period: string | null }
  | { readonly kind: 'rescheduled' }
  | { readonly kind: 'carryOver' }

function listPresetKey(preset: ListPreset | null): string {
  if (preset === null) return 'all'

  return preset.kind === 'unassigned' ? `unassigned:${preset.period ?? ''}` : preset.kind
}

/**
 * Recorte de coluna com que a lista de `A fazer` abre pelos atalhos do
 * canto: "sem técnico" filtra o Técnico (e o turno que a legenda nomeia);
 * "reagendadas" filtra o Status pelo mesmo rótulo que a caixa contou.
 */
function toDoPresetFilters(preset: ListPreset | null): TodayOsTableFilters | undefined {
  if (preset?.kind === 'unassigned') {
    return {
      technician: [TODAY_NO_TECHNICIAN_LABEL],
      ...(preset.period === null ? {} : { period: [preset.period] }),
    }
  }
  if (preset?.kind === 'rescheduled') return { status: [RESCHEDULED_STATUS_LABEL] }

  return undefined
}

/** Nome da lista que o aviso abre, no cabeçalho da tabela. */
const CARRY_OVER_LABEL = 'De dias anteriores'

/** O que a coluna Detalhe traz nessa lista, no lugar da frase das caixas. */
const CARRY_OVER_DESCRIPTION =
  'Cada coluna filtra e ordena só esta lista. Detalhe traz a data da OS e a última etapa, com a hora: saiu, chegou ou início do serviço. Não saiu é a OS que ninguém tocou; sem hora, a que está em campo sem nenhuma marcação.'

/**
 * Aviso das OS de dias anteriores que continuam abertas no aplicativo, para
 * o dia SEM agenda (domingo, feriado): sem caixa nenhuma na faixa não há onde
 * pendurar o atalho do canto, e a pendência de sexta não pode sumir.
 *
 * Nos dias com agenda o aviso não aparece: o atalho no canto da caixa `Em
 * campo` faz o papel dele (decisão do Mário em 23/09/2026, o mesmo desenho
 * do atalho "sem técnico"). É um botão, e abre a lista dessas OS logo abaixo.
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
          <span className="impacto-text-action ml-2 font-semibold text-[var(--accent)]">Ver as OS</span>
        )}
      </span>
    </button>
  )
}

export function TodayStrip() {
  const { coverage, filters, origin, technicians, updatedAt } = useOverviewOs()
  const today = todayISO()
  // Desde 01/10/2026 a faixa lê só CONTAGENS do serviço, com os filtros da
  // página menos período e status; as OS de uma caixa vêm numa consulta
  // própria, quando ela abre. As caixas contam SÓ hoje e somam 100% do dia; o
  // que ficou para trás vem à parte, para o aviso.
  const live = useTodayOs(origin === 'api', today, filters)
  const summary = { total: live.counts?.total ?? 0, buckets: live.counts?.buckets ?? [] }
  // Uma hora só para a caixa e para a lista: o que a caixa conta em risco é
  // exatamente o que a lista marca.
  const hour = hourOf(live.generatedAt)
  const unassigned = buildTodayUnassignedFromCounts(live.counts?.unassigned ?? [], hour)
  const carryOverOs = live.counts?.carryOver ?? []
  const carryOver = carryOverMessage(carryOverOs, today, formatDateBr)
  const filtered = hasTodayFilters(filters)
  const clock = formatClock(live.generatedAt)

  // Caixa aberta. A seleção é derivada no render, e não corrigida num efeito:
  // trocar um filtro pode zerar a caixa "sem classificação", que some da
  // faixa, e a lista de uma caixa que não existe mais fecha sozinha.
  const [selected, setSelected] = useState<TodaySelection | null>(null)
  const openable = new Set<TodaySelection>(['all', ...summary.buckets.map((bucket) => bucket.key)])
  const open = selected !== null && openable.has(selected) ? selected : null

  // Recorte com que a lista abre. Só os atalhos do canto o definem: "sem
  // técnico" abre A fazer filtrada, "de dias anteriores" abre a lista das OS
  // que ficaram para trás no lugar da de Em campo. Clicar numa caixa limpa, e
  // a `key` da tabela muda junto, então a lista remonta com o recorte certo
  // em vez de herdar o anterior.
  const [listPreset, setListPreset] = useState<ListPreset | null>(null)
  const openUnassigned = () => {
    setSelected('toDo')
    // O turno que a legenda nomeia é o que a lista filtra: legenda e lista
    // dizem o mesmo número. Sem turno na legenda, só o "Sem técnico".
    setListPreset({
      kind: 'unassigned',
      period: unassigned.atRisk > 0 ? unassigned.riskPeriod : null,
    })
  }
  // Segundo atalho da caixa A fazer (TSK-892): as OS que já foram reagendadas,
  // contadas pelo status que a caixa recebe, e a lista filtrada por ele.
  const rescheduledCorner = rescheduledCornerLabel(rescheduledToDoCount(summary.buckets))
  const openRescheduled = () => {
    setSelected('toDo')
    setListPreset({ kind: 'rescheduled' })
  }
  const openCarryOver = () => {
    setSelected('inField')
    setListPreset({ kind: 'carryOver' })
  }
  const toggleBox = (key: TodaySelection) => {
    setSelected((current) => (current === key ? null : key))
    setListPreset(null)
  }
  // Nome da caixa aberta: o título da lista e o nome da planilha.
  const openLabel =
    open === null || open === 'all'
      ? TOTAL_LABEL
      : (summary.buckets.find((bucket) => bucket.key === open)?.label ?? TOTAL_LABEL)
  const carryOverListOpen =
    open === 'inField' && listPreset?.kind === 'carryOver' && carryOverOs.length > 0
  const carryOverCorner = carryOverCornerLabel(carryOverOs, today)

  // A lista do aviso tem estado PRÓPRIO: abrir as OS de dias anteriores não
  // fecha a caixa que o gestor deixou aberta, e fechá-la devolve a faixa
  // exatamente como estava (apontado pelo Mário em 22/09/2026). Também
  // derivada no render: fechada a OS no SGI, a lista some junto com o aviso.
  const [carryOverSelected, setCarryOverSelected] = useState(false)
  const carryOverOpen = carryOverSelected && carryOverOs.length > 0

  // A lista aberta, pedida ao serviço só agora. O aviso de dias anteriores
  // só existe no dia sem agenda, quando não há caixa para abrir, então nunca
  // há duas listas pedindo ao mesmo tempo.
  const box =
    carryOverListOpen || carryOverOpen ? 'carryOver' : summary.total > 0 ? open : null
  const boxList = useTodayOsBox(origin === 'api', today, box, filters, live.generatedAt)
  // Buscando, a lista aparece em cinza sob os nomes das colunas e o título
  // não diz "0" antes da hora (08/10/2026); o aviso de lista vazia fica para
  // a falha e para a caixa que não tem nada.
  const listLoadingMessage = boxList.status === 'loading' ? 'Buscando as OS no serviço de BI.' : undefined
  const listEmptyMessage =
    boxList.status === 'error'
      ? (boxList.errorMessage ?? 'Não foi possível ler as OS desta caixa.')
      : undefined

  // O nome do técnico pode vir do catálogo dos filtros ou do catálogo da
  // lista aberta. Os dois entram no mesmo mapa: o da lista é o mais recente e
  // fica por cima, e assim um técnico que só tem OS hoje também aparece.
  const technicianNames = new Map(
    [...technicians, ...boxList.technicians].map((technician) => [technician.id, technician.name]),
  )

  // Baixar Excel das listas da faixa (13/10/2026, pedido do Mário): a MESMA
  // planilha da janela do período, com as linhas visíveis. A aba Filtros diz
  // que é a agenda de hoje, com os filtros da página que valem aqui (todos
  // menos período e status) e a hora da leitura do serviço, porque os
  // status mudam ao longo do dia e o arquivo circula sem a tela.
  const downloadToday = (
    label: string,
    visible: readonly TodayOsRow[],
    tableFilters: TodayOsTableFilters,
    search: string,
  ) => {
    const range = todayListRange(label === CARRY_OVER_LABEL, boxList.records, today)
    const bytes = buildOsWorkbook(todayExportRows(visible, boxList.records), {
      selection: `Hoje ao vivo · ${label}`,
      period: osExportPeriod(range),
      pageFilters: pageFiltersText({ ...filters, status: [] }, coverage, technicianNames),
      listFilters: describeListFilters(tableFilters, TODAY_COLUMNS, search),
      source: osExportSource(origin, updatedAt),
      // A hora das linhas, e não a das contagens: se a releitura da caixa
      // falhou, a lista na tela é a da leitura anterior.
      readAt: boxList.generatedAt ?? live.generatedAt,
      generatedAt: formatDateTimeBr(new Date()),
    })
    downloadXlsx(bytes, osExportFileName(`hoje ${label}`, range))
  }

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
      <LiveNote>
        Disponível com o portal ligado ao serviço de BI. A base local de estudo termina em{' '}
        {formatDateBr(coverage.max)} e não tem o dia de hoje.
      </LiveNote>
    )
  } else if (live.status === 'loading' || live.status === 'idle') {
    // Buscando, as caixas aparecem em cinza no lugar (08/10/2026); a frase vai
    // só para o leitor de tela.
    body = (
      <PageSkeleton label="Buscando a agenda de hoje no serviço de BI.">
        <TodayStripBoxesSkeleton />
      </PageSkeleton>
    )
  } else if (live.status === 'error' && live.counts === null) {
    body = <LiveNote>{live.errorMessage ?? 'Não foi possível ler a agenda de hoje.'}</LiveNote>
  } else if (summary.total === 0) {
    body = (
      <LiveNote>
        Nenhuma OS agendada para hoje{filtered ? ' com os filtros da página' : ''}.
      </LiveNote>
    )
  } else {
    body = (
      <>
        <ul
          aria-label="Agenda de hoje por situação"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <LiveBox
            color={TOTAL_COLOR}
            controls={LIST_ID}
            label={TOTAL_LABEL}
            onToggle={() => toggleBox('all')}
            open={open === 'all'}
            value={summary.total}
          >
            OS agendadas para hoje
          </LiveBox>
          {summary.buckets.map((bucket) => (
            <LiveBox
              color={BUCKET_COLORS[bucket.key]}
              controls={LIST_ID}
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
              corner={
                bucket.key === 'toDo'
                  ? [
                      unassignedCorner(unassigned, openUnassigned),
                      rescheduledCorner === null ? null : { ...rescheduledCorner, onClick: openRescheduled },
                    ]
                  : bucket.key === 'inField' && carryOverCorner !== null
                    ? { ...carryOverCorner, onClick: openCarryOver }
                    : null
              }
              onToggle={() => toggleBox(bucket.key)}
              open={open === bucket.key}
              value={bucket.count}
            >
              {formatPercent(bucket.share)} do dia
            </LiveBox>
          ))}
        </ul>
        {carryOverListOpen ? (
          // Pelo atalho da caixa Em campo: a lista das OS que ficaram para
          // trás, com a data no Detalhe, no lugar da lista de hoje.
          <TodayOsTable
            description={CARRY_OVER_DESCRIPTION}
            id={LIST_ID}
            key="inField:carryOver"
            label={CARRY_OVER_LABEL}
            onClose={() => setSelected(null)}
            onDownload={(visible, tableFilters, search) =>
              downloadToday(CARRY_OVER_LABEL, visible, tableFilters, search)
            }
            // Restaurar leva de volta à lista de Em campo, as OS de hoje.
            onRestore={() => setListPreset(null)}
            emptyMessage={listEmptyMessage}
            loadingMessage={listLoadingMessage}
            rows={buildCarryOverRows(boxList.records, today, technicianNames, (iso) =>
              formatDateBr(iso).slice(0, 5),
            )}
          />
        ) : open !== null ? (
          <TodayOsTable
            id={LIST_ID}
            initialFilters={open === 'toDo' ? toDoPresetFilters(listPreset) : undefined}
            // A caixa aberta e o recorte inicial são a identidade da tabela:
            // trocar de caixa, ou abrir pelo atalho, monta outra, com os
            // filtros de coluna zerados ou no recorte do atalho. Sem isto, um
            // recorte de Improdutivas continuaria valendo ao abrir Concluídas,
            // e o gestor veria uma lista curta sem entender por quê.
            key={`${open}:${listPresetKey(listPreset)}`}
            // Restaurar também zera o recorte do atalho na faixa. Sem isto a
            // `key` continuava "toDo:unassigned" depois do Restaurar, e um
            // segundo clique em "sem técnico" não remontava a lista: abria
            // sem o filtro.
            onRestore={listPreset === null ? undefined : () => setListPreset(null)}
            label={openLabel}
            onClose={() => setSelected(null)}
            onDownload={(visible, tableFilters, search) =>
              downloadToday(openLabel, visible, tableFilters, search)
            }
            emptyMessage={listEmptyMessage}
            loadingMessage={listLoadingMessage}
            rows={buildTodayRows(boxList.records, open, technicianNames, hour)}
          />
        ) : null}
      </>
    )
  }

  return (
    // `os-today` fica pela cor de atenção da célula do técnico na lista e do
    // aviso de dia sem agenda; a moldura, o título verde e o ponto pulsando
    // são da faixa do portal.
    <LiveStrip
      ariaLabel="Hoje ao vivo"
      className="os-today"
      live={origin === 'api'}
      subtitle={subtitleParts.join(' · ')}
    >
      {body}
      {/* Só no dia SEM agenda: um domingo continua podendo ter uma OS de
          sexta parada no aplicativo, e sem caixa não há canto para o atalho.
          Com agenda, o atalho da caixa Em campo faz este papel. */}
      {carryOver === null || summary.total > 0 ? null : (
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
          onDownload={(visible, tableFilters, search) =>
            downloadToday(CARRY_OVER_LABEL, visible, tableFilters, search)
          }
          // Dia e mês bastam na coluna: a janela é de uma semana, e o ano só
          // roubava espaço da hora da etapa.
          emptyMessage={listEmptyMessage}
          loadingMessage={listLoadingMessage}
          rows={buildCarryOverRows(boxList.records, today, technicianNames, (iso) =>
            formatDateBr(iso).slice(0, 5),
          )}
        />
      ) : null}
    </LiveStrip>
  )
}
