import { useState } from 'react'

import { DataTable } from '../../components/dashboard/DataTable'
import { listUserHistoryEvents } from '../../services/users/userHistoryRepository'
import type { UserHistoryAction, UserHistoryEvent } from '../../types/userHistory'

/**
 * Página somente leitura do Histórico de usuários. Não cria, edita nem remove
 * eventos: apenas traduz para a tela o que o repositório entregou.
 */

/** A interface só traduz a ação; a semântica vive no repositório. */
const actionLabels: Record<UserHistoryAction, string> = {
  created: 'Usuário criado',
  updated: 'Usuário editado',
  deactivated: 'Usuário desativado',
  reactivated: 'Usuário reativado',
}

/** Mesmas cores opacas e literais dos badges de Usuários, pelo mesmo motivo:
    o painel é branco fixo e as classes precisam ser estáticas para o Tailwind. */
const actionBadgeClasses: Record<UserHistoryAction, string> = {
  created: 'bg-[#e6edff] text-[#2f6bff]',
  updated: 'bg-[#e0f2fe] text-[#0369a1]',
  deactivated: 'bg-[#fdf3f3] text-[#b42318]',
  reactivated: 'bg-[#dcfce7] text-[#16794a]',
}

/** Campos explícitos em vez de dateStyle/timeStyle: os estilos prontos não têm
    variação com segundos, e os segundos são o que separa dois eventos gravados
    no mesmo minuto. Sem milissegundos. */
const occurredAtFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * Apenas formata o ISO 8601 persistido para leitura em português do Brasil; o
 * timestamp gravado não é tocado. Um valor que o navegador não consiga
 * interpretar volta como está, para a linha continuar visível em vez de exibir
 * "Invalid Date".
 */
function formatOccurredAt(occurredAt: string): string {
  const date = new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return occurredAt

  return occurredAtFormatter.format(date)
}

const headers = ['Data e hora', 'Ação', 'Usuário afetado', 'Responsável', 'Detalhes']

/** Larguras fixas por coluna, como na tabela de Usuários: sem elas o layout
    automático redistribuiria tudo conforme o tamanho dos detalhes de cada
    evento. A coluna sem largura (Detalhes) absorve o restante. */
const columnWidths = ['150px', '160px', '18%', '18%', undefined]

export function UserHistory() {
  // Leitura única na montagem, como a tabela de Usuários. A página é somente
  // leitura, então não existe recarga: nada aqui altera o armazenamento.
  const [result] = useState(() => listUserHistoryEvents())

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-base font-bold text-[#1a2331]">Histórico de usuários</h2>
        <p className="mt-1 text-[13px] text-[#667085]">
          Consulte as alterações realizadas nos usuários e identifique quem executou cada ação.
        </p>
      </div>
      {!result.ok ? (
        <HistoryReadError />
      ) : result.events.length === 0 ? (
        <HistoryEmptyState />
      ) : (
        // Sem scrollY e sem altura fixa: a tabela cresce com os eventos e
        // nenhum registro fica cortado. Em telas menores o próprio DataTable
        // rola na horizontal a partir do minWidth.
        <DataTable columnWidths={columnWidths} headers={headers} minWidth={880}>
          {result.events.map((event) => (
            <HistoryTableRow event={event} key={event.id} />
          ))}
        </DataTable>
      )}
    </div>
  )
}

/** Ordem preservada: os eventos saem do repositório já do mais recente para o
    mais antigo, então a página não reordena nada. */
function HistoryTableRow({ event }: { event: UserHistoryEvent }) {
  return (
    <tr className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
      {/* align-top em todas as células: a linha de detalhes pode ocupar várias
          linhas de texto e as demais colunas devem acompanhar pelo topo. */}
      <td className="whitespace-nowrap px-4 py-2.5 align-top text-[#475467]">
        {formatOccurredAt(event.occurredAt)}
      </td>
      <td className="px-4 py-2.5 align-top">
        <ActionBadge action={event.action} />
      </td>
      <td className="px-4 py-2.5 align-top font-medium text-[#1a2331]">
        <span className="block break-words">{event.targetUserName}</span>
      </td>
      <td className="px-4 py-2.5 align-top text-[#475467]">
        <span className="block break-words">{event.actorName}</span>
      </td>
      <td className="px-4 py-2.5 align-top text-[#475467]">
        <EventDetails details={event.details} />
      </td>
    </tr>
  )
}

/**
 * Um texto por linha. Detalhes vazios são normais (a desativação, por exemplo,
 * não descreve alteração de campo), então o lugar recebe um aviso discreto em
 * vez de ficar em branco.
 */
function EventDetails({ details }: { details: string[] }) {
  if (details.length === 0) {
    return <span className="block text-[#98a2b3]">Nenhum detalhe adicional.</span>
  }

  return (
    <ul className="grid gap-1">
      {details.map((detail, index) => (
        // Os detalhes são textos prontos e imutáveis, que nunca reordenam nem
        // são filtrados; o índice basta como identidade.
        <li className="break-words leading-5" key={index}>
          {detail}
        </li>
      ))}
    </ul>
  )
}

function ActionBadge({ action }: { action: UserHistoryAction }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${actionBadgeClasses[action]}`}
    >
      {actionLabels[action]}
    </span>
  )
}

/** Leitura bem-sucedida sem nenhum evento: estado normal, não é erro. */
function HistoryEmptyState() {
  return (
    <div className="rounded-xl border border-[#e4e7ee] bg-white p-5">
      <h3 className="text-[15px] font-semibold text-[#1a2331]">Nenhum evento registrado</h3>
      <p className="mt-1.5 text-[13px] text-[#667085]">
        As próximas alterações realizadas nos usuários aparecerão neste Histórico.
      </p>
    </div>
  )
}

/** Falha ao ler o armazenamento. Visualmente distinto da lista vazia, e sem
    nenhuma tentativa de corrigir ou reinicializar o que está gravado. */
function HistoryReadError() {
  return (
    <div className="rounded-xl border border-[#f4c7c9] bg-[#fdf3f3] p-5" role="alert">
      <h3 className="text-[15px] font-semibold text-[#b42318]">
        Não foi possível carregar o Histórico de usuários.
      </h3>
      <p className="mt-1.5 text-[13px] text-[#b42318]">
        Os dados armazenados não foram alterados. Atualize a página e tente novamente.
      </p>
    </div>
  )
}
