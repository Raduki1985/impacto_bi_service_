import { useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'

import { statusColors } from '../../data/dashboardAggregates'
import { formatNumber } from '../../lib/formatters'
import { TodayColumnHeader } from './TodayOsColumnFilter'
import type { TodayOsRow } from './todayOsModel'
import {
  filterTodayRows,
  hasTodayTableFilters,
  sortTodayRows,
  TODAY_COLUMNS,
  tableMinWidth,
  todayCellText,
  todayColumnOptions,
  type TodayColumn,
  type TodayOsSort,
  type TodayOsTableFilters,
} from './todayOsTableModel'

/**
 * Lista das OS por trás de uma caixa da faixa "Hoje ao vivo".
 *
 * A faixa responde quantas; esta tabela responde quais. Ela abre embaixo da
 * caixa clicada, com o recorte que a caixa representa, e fecha no mesmo
 * clique. É a ponte entre o número e a ação: o gestor lê "4 improdutivas",
 * abre, vê o código da OS, o turno, a cidade, o técnico, a equipe e o motivo,
 * e já sabe a quem falar.
 *
 * Cada coluna tem o próprio recorte e a própria ordenação, como a tabela de
 * Vendas por Período (pedido do Mário, 21/09/2026). O recorte das colunas vale
 * SÓ para esta lista: os filtros da página continuam na faixa de cima, e nada
 * daqui os altera.
 *
 * Escrita aqui, e não com o `DataTable` compartilhado, pelo mesmo motivo da
 * tabela de Técnicos: aquele componente tem superfície branca fixa e não
 * acompanha o tema escuro dos painéis executivos.
 *
 * Desde 24/09/2026 ela também é a lista da janela de OS do período, aberta
 * pelo clique nos painéis Motivos de improdutiva e Destino das OS. Uma tabela
 * só para as duas, para o gestor não aprender dois jeitos de filtrar a mesma
 * coisa. O que a janela liga, e a agenda de hoje não usa: a coluna Data, o
 * `Baixar Excel`, a lista ocupando a altura da janela e o painel do filtro de
 * coluna publicado dentro dela.
 */

/**
 * Cor do status na lista, a MESMA dos gráficos de OS da página: status tem
 * cor fixa, nunca por posição. Rótulo novo do SGI, ainda sem cor declarada,
 * cai no cinza neutro do Pendente, pelo token e não por um hex repetido aqui,
 * que é o mesmo caminho da rosca de tipos (`serviceTypeColor`).
 */
const UNKNOWN_STATUS_COLOR = statusColors.Pendente

/** Colunas com busca no painel: as de lista curta não precisam de campo. */
const SEARCHABLE_COLUMNS = new Set(['category', 'city', 'technician'])

/** Explicação da marca de atenção, para quem parar o ponteiro na célula. */
const UNASSIGNED_AT_RISK_TITLE =
  'Sem técnico, e o turno desta OS já passou da hora em que costuma começar.'

/** Frase de apoio das listas das caixas: o que a coluna Detalhe traz em cada situação. */
const DEFAULT_DESCRIPTION =
  'Cada coluna filtra e ordena só esta lista. Detalhe traz a resolução nas concluídas, o motivo nas improdutivas e o horário nas que estão em campo.'

/** Aviso da lista sem OS: a da agenda de hoje fala do momento. */
const DEFAULT_EMPTY_MESSAGE = 'Nenhuma OS nesta situação agora.'

export function TodayOsTable<Row extends TodayOsRow>({
  columns = TODAY_COLUMNS,
  description = DEFAULT_DESCRIPTION,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  fill = false,
  id,
  initialFilters,
  label,
  onClose,
  onDownload,
  onRestore,
  panelContainer,
  rows,
}: {
  /** Colunas da lista; a janela do período põe a Data na frente. */
  columns?: readonly TodayColumn[]
  /** Frase de apoio abaixo do título; a lista de dias anteriores explica o próprio Detalhe. */
  description?: string
  emptyMessage?: string
  /**
   * A lista ocupa a altura que o contêiner der, e rola por dentro. É o jeito
   * da janela do período, que tem a tela quase inteira; na faixa de hoje a
   * lista tem teto fixo, para não empurrar o resto da página para longe.
   */
  fill?: boolean
  id?: string
  /**
   * Recorte de coluna com que a lista ABRE, para o atalho "sem técnico" da
   * caixa `A fazer` (23/09/2026). Lido uma vez, na montagem: quem quiser
   * outro recorte inicial monta outra tabela (troca a `key`), que é o mesmo
   * caminho de trocar de caixa. O `Restaurar tabela` tira o recorte como
   * tira qualquer outro.
   */
  initialFilters?: TodayOsTableFilters
  label: string
  /** Sem ele não há `Fechar`: na janela do período quem fecha é a própria janela. */
  onClose?: () => void
  /**
   * Liga o `Baixar Excel`, que entrega as linhas VISÍVEIS, na ordem da tela,
   * e os filtros de coluna em uso: a planilha é o que a lista mostra, nem uma
   * linha a mais.
   */
  onDownload?: (rows: readonly Row[], filters: TodayOsTableFilters) => void
  /**
   * Onde o painel do filtro de coluna é publicado. Dentro de uma janela modal
   * ele precisa nascer DENTRO dela: fora, a janela o trataria como clique fora
   * e o foco não conseguiria entrar no campo de busca.
   */
  panelContainer?: HTMLElement | null
  /**
   * O que mais o `Restaurar tabela` faz, além de zerar filtro e ordenação:
   * a lista aberta por um atalho de canto avisa a faixa para voltar à lista
   * da caixa (pedido do Mário em 23/09/2026: "1 de ontem" abre outra lista,
   * sem filtro a desfazer, e mesmo assim o Restaurar precisa levar de volta
   * às OS de hoje). Com ele, o botão fica sempre visível.
   *
   * Vale também para a lista do atalho "sem técnico": sem avisar a faixa, a
   * identidade da tabela continuava a do atalho depois do Restaurar, e um
   * segundo clique no atalho não remontava a lista com o filtro.
   */
  onRestore?: () => void
  rows: readonly Row[]
}) {
  // Recorte e ordenação da tabela. Ficam aqui, e não no provedor da página,
  // porque são uma leitura passageira da lista aberta: trocar de caixa monta
  // outra tabela e recomeça do zero, que é o que o gestor espera.
  const [filters, setFilters] = useState<TodayOsTableFilters>(initialFilters ?? {})
  const [sort, setSort] = useState<TodayOsSort>(null)

  const visible = sortTodayRows(filterTodayRows(rows, filters), sort)
  const filtered = hasTodayTableFilters(filters)

  return (
    <section
      aria-label={`Ordens de serviço: ${label}`}
      // Superfície ELEVADA, a mesma das caixas: no tema escuro a superfície do
      // painel é a mesma da faixa, e a lista sumia nela, separada só por uma
      // borda de contraste 1,56. O cabeçalho preso lê o mesmo token, senão
      // ficaria transparente durante a rolagem.
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] ${
        fill ? 'flex min-h-0 flex-1 flex-col' : 'mt-3'
      }`}
      id={id}
    >
      <div className="flex-none border-b border-[var(--border)] px-3 py-2.5">
        {/* Título e ações dividem a primeira linha, e a frase de apoio fica
            abaixo: com tudo na mesma linha, o Fechar caía para baixo em tela
            estreita e ficava longe do canto que o gestor procura. */}
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--text-heading)]">
            {label}:{' '}
            {filtered
              ? `${formatNumber(visible.length)} de ${formatNumber(rows.length)} OS`
              : `${formatNumber(rows.length)} OS`}
          </span>
          <span className="flex flex-none items-center gap-1">
            {onDownload === undefined ? null : (
              <button
                // Mesma casca das ações de texto da lista, com o verde do
                // tema escuro pelo mesmo motivo de contraste.
                className="os-filter-action flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                disabled={visible.length === 0}
                onClick={() => onDownload(visible, filters)}
                title={
                  visible.length === 0
                    ? 'Nenhuma OS na lista para baixar'
                    : `Baixa as ${formatNumber(visible.length)} OS da lista, na ordem da tela, numa planilha do Excel`
                }
                type="button"
              >
                <Download aria-hidden="true" size={13} />
                Baixar Excel
              </button>
            )}
            {filtered || sort !== null || onRestore !== undefined ? (
              <button
                // `os-filter-action`: no tema escuro a cor troca para o verde
                // da faixa de filtros, pelo mesmo motivo de contraste.
                className="os-filter-action cursor-pointer rounded-md px-2 py-1 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)]"
                onClick={() => {
                  setFilters({})
                  setSort(null)
                  onRestore?.()
                }}
                type="button"
              >
                Restaurar tabela
              </button>
            ) : null}
            {onClose === undefined ? null : (
              <button
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)]"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" size={13} />
                Fechar
              </button>
            )}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{description}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-[12px] text-[var(--text-secondary)]">
          {emptyMessage}
        </p>
      ) : (
        <div
          // `scrollbar-gutter: stable` reserva o espaço da barra de rolagem
          // mesmo quando ela não aparece. Sem isso, a caixa com muitas OS
          // perdia 15 px de largura para a barra e as colunas encolhiam em
          // relação à caixa curta: a tabela seguia mudando de tamanho a cada
          // clique, que é o que as larguras fixas vieram resolver.
          //
          // `isolate` prende o `z-[1]` do cabeçalho preso a esta lista. Sem
          // ele, o cabeçalho disputa nível com a faixa fixa da página, que
          // também é `z-[1]`, e passaria por cima dela durante a rolagem.
          className={`isolate overflow-auto [scrollbar-gutter:stable] ${
            fill ? 'min-h-0 flex-1' : 'max-h-[380px]'
          }`}
        >
          {/* `table-fixed` com as larguras declaradas no `colgroup`: as colunas
              param de depender do texto de cada situação, então trocar de
              caixa não redesenha a tabela inteira. */}
          <table
            className="w-full table-fixed border-collapse text-[12px]"
            style={{ minWidth: tableMinWidth(columns) }}
          >
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={{ width: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    // Fundo e sombra no próprio `th`, e não no `tr`: com
                    // `border-collapse`, fundo e borda da linha não acompanham
                    // a célula presa e o cabeçalho ficava transparente durante
                    // a rolagem.
                    className="sticky top-0 z-[1] bg-[var(--surface-elevated)] px-2.5 py-2 text-left font-semibold text-[var(--text-secondary)] shadow-[inset_0_-1px_0_var(--border)]"
                    key={column.key}
                    scope="col"
                  >
                    <TodayColumnHeader
                      chronological={column.key === 'date'}
                      filtered={(filters[column.key] ?? []).length > 0}
                      label={column.label}
                      onApply={(selected) =>
                        setFilters((current) => ({ ...current, [column.key]: selected }))
                      }
                      onSortChange={(direction) =>
                        setSort(direction === null ? null : { column: column.key, direction })
                      }
                      options={
                        column.filterable ? todayColumnOptions(rows, column.key, filters) : null
                      }
                      panelContainer={panelContainer}
                      searchable={SEARCHABLE_COLUMNS.has(column.key)}
                      selected={filters[column.key] ?? []}
                      sort={sort?.column === column.key ? sort.direction : null}
                      sortable={column.sortable}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr className="border-t border-[var(--border)]" key={row.id}>
                  {columns.map((column) => {
                    const text = todayCellText(row, column.key)

                    return (
                      <td
                        className={`truncate px-2.5 py-1.5 ${
                          column.key === 'id'
                            ? 'font-mono font-semibold text-[var(--text-heading)]'
                            : column.key === 'date'
                              ? 'font-mono text-[var(--text-secondary)]'
                              : column.key === 'category'
                              ? 'text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)]'
                        }`}
                        key={column.key}
                        title={
                          column.key === 'technician' && row.unassignedAtRisk
                            ? UNASSIGNED_AT_RISK_TITLE
                            : text
                        }
                      >
                        {column.key === 'status' ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2 w-2 flex-none rounded-full"
                              style={{ background: statusColors[text] ?? UNKNOWN_STATUS_COLOR }}
                            />
                            <span className="min-w-0 truncate text-[var(--text-primary)]">
                              {text}
                            </span>
                          </span>
                        ) : column.key === 'technician' && row.unassignedAtRisk ? (
                          // A MESMA marca da caixa `A fazer`, pela mesma régua: a
                          // linha diz qual é a OS que a caixa contou. Só a célula,
                          // e não a linha inteira, para não brigar com o hover nem
                          // pesar numa lista de sessenta linhas.
                          <span
                            className="flex items-center gap-1 font-semibold"
                            style={{ color: 'var(--os-attention)' }}
                          >
                            <AlertTriangle
                              aria-hidden="true"
                              className="h-3 w-3 flex-none"
                              strokeWidth={2.2}
                            />
                            <span className="min-w-0 truncate">{text}</span>
                            <span className="sr-only">, turno já iniciado</span>
                          </span>
                        ) : (
                          text
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-[var(--text-secondary)]">
              Nenhuma OS com os filtros das colunas.
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
