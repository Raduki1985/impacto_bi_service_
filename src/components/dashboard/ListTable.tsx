import { useState, type ReactNode } from 'react'
import { Download, X } from 'lucide-react'

import { formatNumber } from '../../lib/formatters'
import { ListColumnHeader } from './ListColumnHeader'
import { SkeletonBlock } from './PageSkeleton'
import {
  filterListRows,
  hasListFilters,
  listColumnOptions,
  listTableMinWidth,
  sortListRows,
  type ListColumn,
  type ListSort,
  type ListTableFilters,
  type ListTableRules,
} from './listTableModel'

/**
 * Lista do portal: a tabela que responde QUAIS depois que um número disse
 * QUANTAS.
 *
 * É a ponte entre o número e a ação: o gestor lê "4 improdutivas", abre, vê
 * o código da OS, o turno, a cidade, o técnico, a equipe e o motivo, e já
 * sabe a quem falar. Nasceu na faixa Hoje ao vivo da Visão Geral de OS
 * (21/09/2026), ganhou a janela de OS do período (24/09/2026) e virou a lista
 * de qualquer página no mesmo dia, quando o Mário definiu aquela página como
 * modelo do portal. O que ela congela:
 *
 * - cada coluna tem o próprio recorte e a própria ordenação, como a tabela de
 *   Vendas por Período. O recorte das colunas vale SÓ para esta lista: os
 *   filtros da página continuam na faixa de cima, e nada daqui os altera;
 * - recorte e ordenação são uma leitura passageira da lista aberta, e ficam
 *   aqui, não no provedor da página: quem quer outra lista monta outra
 *   tabela (troca a `key`), que recomeça do zero. É assim que trocar de caixa
 *   na faixa de hoje, ou de atalho na janela, zera os filtros de coluna;
 * - `Restaurar tabela` zera filtro e ordenação; `Baixar Excel` entrega as
 *   linhas VISÍVEIS, na ordem da tela, e os filtros de coluna em uso: a
 *   planilha é o que a lista mostra, nem uma linha a mais;
 * - larguras fixas no `colgroup` com `table-fixed`: as colunas param de
 *   depender do texto de cada lista, então trocar de lista não redesenha a
 *   tabela inteira;
 * - superfície ELEVADA, a mesma das caixas da faixa de hoje: no tema escuro a
 *   superfície do painel é a mesma da faixa, e a lista sumia nela. O
 *   cabeçalho preso lê o mesmo token, senão ficaria transparente na rolagem.
 *
 * O que a página decide: as colunas e o texto de cada célula (o modelo), o
 * desenho especial de alguma célula (`renderCell`, como o ponto de cor do
 * status), a cor do texto por coluna (`cellClassName`) e o que é ausência.
 */
export function ListTable<Row, Key extends string>({
  ariaLabel,
  cellClassName,
  cellTitle,
  columns,
  description,
  emptyMessage,
  fill = false,
  filteredEmptyMessage = 'Nenhuma linha com os filtros das colunas.',
  id,
  initialFilters,
  label,
  loadingMessage,
  onClose,
  onDownload,
  onRestore,
  panelContainer,
  renderCell,
  rowKey,
  rows,
  rules,
  unit,
}: {
  /** Nome acessível da lista, por exemplo `Ordens de serviço: Concluídas`. */
  ariaLabel: string
  /** Classes de cor e fonte da célula; sem valor, o texto secundário. */
  cellClassName?: (row: Row, column: ListColumn<Row, Key>) => string
  /** Dica ao parar o ponteiro na célula; sem valor, o próprio texto. */
  cellTitle?: (row: Row, column: ListColumn<Row, Key>, text: string) => string
  columns: readonly ListColumn<Row, Key>[]
  /** Frase de apoio abaixo do título: o que cada coluna traz. */
  description?: string
  /** Aviso da lista sem linha nenhuma. */
  emptyMessage: string
  /**
   * A lista ocupa a altura que o contêiner der, e rola por dentro. É o jeito
   * da janela, que tem a tela quase inteira; na faixa de hoje a lista tem
   * teto fixo, para não empurrar o resto da página para longe.
   */
  fill?: boolean
  /** Aviso do recorte de coluna que não deixou linha nenhuma. */
  filteredEmptyMessage?: string
  id?: string
  /**
   * Recorte de coluna com que a lista ABRE, para os atalhos que já chegam
   * filtrados. Lido uma vez, na montagem: quem quiser outro recorte inicial
   * monta outra tabela (troca a `key`). O `Restaurar tabela` tira o recorte
   * como tira qualquer outro.
   */
  initialFilters?: ListTableFilters<Key>
  label: string
  /**
   * Com valor, a lista ainda está sendo buscada (08/10/2026, opção B do
   * carregando): o título não diz "0 OS" e as linhas aparecem em cinza, sob
   * os nomes das colunas. A frase vai só para o leitor de tela, por exemplo
   * "Buscando as OS no serviço de BI.".
   */
  loadingMessage?: string
  /** Sem ele não há `Fechar`: na janela quem fecha é a própria janela. */
  onClose?: () => void
  /** Liga o `Baixar Excel`, com as linhas visíveis e os filtros de coluna em uso. */
  onDownload?: (rows: readonly Row[], filters: ListTableFilters<Key>) => void
  /**
   * O que mais o `Restaurar tabela` faz, além de zerar filtro e ordenação.
   * Com ele, o botão fica sempre visível: a lista aberta por um atalho avisa
   * a página para voltar à lista de origem.
   */
  onRestore?: () => void
  /**
   * Onde o painel do filtro de coluna é publicado. Dentro de uma janela modal
   * ele precisa nascer DENTRO dela: fora, a janela o trataria como clique fora
   * e o foco não conseguiria entrar no campo de busca.
   */
  panelContainer?: HTMLElement | null
  /** Desenho especial de uma célula; sem valor, o texto. */
  renderCell?: (row: Row, column: ListColumn<Row, Key>, text: string) => ReactNode
  rowKey: (row: Row) => string
  rows: readonly Row[]
  rules?: ListTableRules<Row>
  /** Do que a lista conta: `OS`, `vendas`. Vai no cabeçalho e na dica do Baixar. */
  unit: string
}) {
  // "Sem filtro" é o objeto vazio; o tipo só precisa saber de que colunas ele
  // fala, e um vazio serve a qualquer conjunto de chaves.
  const noFilters = {} as ListTableFilters<Key>
  const [filters, setFilters] = useState<ListTableFilters<Key>>(initialFilters ?? noFilters)
  const [sort, setSort] = useState<ListSort<Key>>(null)

  const visible = sortListRows(filterListRows(rows, columns, filters), columns, sort, rules)
  const filtered = hasListFilters(columns, filters)

  return (
    <section
      aria-label={ariaLabel}
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
            {loadingMessage !== undefined ? (
              <>
                {label}{' '}
                <SkeletonBlock className="inline-block h-3 w-14 align-middle" />
              </>
            ) : (
              <>
                {label}:{' '}
                {filtered
                  ? `${formatNumber(visible.length)} de ${formatNumber(rows.length)} ${unit}`
                  : `${formatNumber(rows.length)} ${unit}`}
              </>
            )}
          </span>
          <span className="flex flex-none items-center gap-1">
            {/* Buscando, o Baixar some: a dica dele diria "nenhuma linha" de uma
                lista que ainda não chegou. */}
            {onDownload === undefined || loadingMessage !== undefined ? null : (
              <button
                // `impacto-text-action`: no tema escuro a cor troca para o
                // verde da faixa de filtros, pelo mesmo motivo de contraste.
                className="impacto-text-action flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                disabled={visible.length === 0}
                onClick={() => onDownload(visible, filters)}
                title={
                  visible.length === 0
                    ? `Nenhuma linha na lista para baixar`
                    : `Baixa as ${formatNumber(visible.length)} ${unit} da lista, na ordem da tela, numa planilha do Excel`
                }
                type="button"
              >
                <Download aria-hidden="true" size={13} />
                Baixar Excel
              </button>
            )}
            {filtered || sort !== null || onRestore !== undefined ? (
              <button
                className="impacto-text-action cursor-pointer rounded-md px-2 py-1 text-[11.5px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={() => {
                  setFilters(noFilters)
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
                className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" size={13} />
                Fechar
              </button>
            )}
          </span>
        </div>
        {description === undefined ? null : (
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {loadingMessage !== undefined ? (
        <ListTableSkeleton columns={columns} fill={fill} message={loadingMessage} />
      ) : rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-[12px] text-[var(--text-secondary)]">
          {emptyMessage}
        </p>
      ) : (
        <div
          // `scrollbar-gutter: stable` reserva o espaço da barra de rolagem
          // mesmo quando ela não aparece. Sem isso, a lista com muitas linhas
          // perdia 15 px de largura para a barra e as colunas encolhiam em
          // relação à lista curta.
          //
          // `isolate` prende o `z-[1]` do cabeçalho preso a esta lista. Sem
          // ele, o cabeçalho disputa nível com a faixa fixa da página, que
          // também é `z-[1]`, e passaria por cima dela durante a rolagem.
          className={`isolate overflow-auto [scrollbar-gutter:stable] ${
            fill ? 'min-h-0 flex-1' : 'max-h-[380px]'
          }`}
        >
          <table
            className="w-full table-fixed border-collapse text-[12px]"
            style={{ minWidth: listTableMinWidth(columns) }}
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
                    <ListColumnHeader
                      filtered={(filters[column.key] ?? []).length > 0}
                      label={column.label}
                      onApply={(selected) =>
                        setFilters((current) => ({ ...current, [column.key]: selected }))
                      }
                      onSortChange={(direction) =>
                        setSort(direction === null ? null : { column: column.key, direction })
                      }
                      options={
                        column.filterable
                          ? listColumnOptions(rows, columns, column.key, filters, rules)
                          : null
                      }
                      panelContainer={panelContainer}
                      searchable={column.searchable}
                      selected={filters[column.key] ?? []}
                      sort={sort?.column === column.key ? sort.direction : null}
                      sortKind={column.sortKind}
                      sortable={column.sortable}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr className="border-t border-[var(--border)]" key={rowKey(row)}>
                  {columns.map((column) => {
                    const text = column.text(row)

                    return (
                      <td
                        className={`truncate px-2.5 py-1.5 ${
                          cellClassName?.(row, column) ?? 'text-[var(--text-secondary)]'
                        }`}
                        key={column.key}
                        title={cellTitle?.(row, column, text) ?? text}
                      >
                        {renderCell?.(row, column, text) ?? text}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-[var(--text-secondary)]">
              {filteredEmptyMessage}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}

/** Larguras das células em cinza, variando de linha a linha como texto de verdade. */
const SKELETON_CELL_WIDTHS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2', 'w-3/4']

/**
 * A lista enquanto é buscada: os nomes das colunas no lugar, nas larguras
 * reais, e as linhas em cinza. Vinte linhas na janela, que tem a tela quase
 * inteira; seis na lista de teto fixo. Os nomes das colunas não filtram nem
 * ordenam aqui, porque ainda não há linha para isso. Na janela vão mais
 * linhas do que cabem, e a sobra fica escondida: assim a lista em cinza
 * chega ao pé da janela em qualquer altura de tela.
 */
function ListTableSkeleton<Row, Key extends string>({
  columns,
  fill,
  message,
}: {
  columns: readonly ListColumn<Row, Key>[]
  fill: boolean
  message: string
}) {
  const rowCount = fill ? 20 : 6

  return (
    <div
      aria-live="polite"
      className={`overflow-hidden ${fill ? 'min-h-0 flex-1' : 'max-h-[380px]'}`}
      role="status"
    >
      <span className="sr-only">{message}</span>
      <table
        aria-hidden="true"
        className="w-full table-fixed border-collapse text-[12px]"
        data-skeleton="list"
        style={{ minWidth: listTableMinWidth(columns) }}
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
                className="bg-[var(--surface-elevated)] px-2.5 py-2 text-left font-semibold text-[var(--text-secondary)] shadow-[inset_0_-1px_0_var(--border)]"
                key={column.key}
              >
                <span className="block truncate">{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <tr className="border-t border-[var(--border)]" data-skeleton="list-row" key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td className="px-2.5 py-2" key={column.key}>
                  <SkeletonBlock
                    className={`h-3 ${SKELETON_CELL_WIDTHS[(rowIndex + columnIndex) % SKELETON_CELL_WIDTHS.length]}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
