import { ListDialog, ListDialogHeader } from '../../components/dashboard/ListDialog'
import { ListTable } from '../../components/dashboard/ListTable'
import type { ListTableFilters } from '../../components/dashboard/listTableModel'
import { downloadXlsx } from '../../lib/downloadFile'
import { formatDateTimeBr, formatNumber } from '../../lib/formatters'
import type { RegistryLine } from './scheduleModel'
import {
  buildRegistryWorkbook,
  REGISTRY_COLUMNS,
  registryFileName,
  registryFiltersText,
  type RegistryKey,
} from './scheduleRegistryModel'

/**
 * A janela do cadastro de aptidões a corrigir no SGI (19/10/2026): quem
 * executou cada categoria nos últimos 28 dias sem estar cadastrado como
 * apto, uma linha por técnico e categoria. É a lista que o gestor de cada
 * equipe corrige, por isso a coluna Equipe filtra e a planilha leva o que a
 * lista mostra. A casca é a janela de lista do portal (`ListDialog`) e a
 * tabela é a `ListTable`, com filtro por coluna, busca e Baixar Excel; as
 * colunas e a planilha moram em `scheduleRegistryModel`.
 */

const DESCRIPTION =
  'Filtre pela Equipe para separar o que cada gestor corrige; Baixar Excel leva exatamente o que a lista mostra. OS sem aptidão é quantas OS da categoria o técnico concluiu ou teve improdutiva no período sem ter a aptidão cadastrada no SGI. Aptos no cadastro é quantos técnicos a categoria tem cadastrados hoje.'

type RegistryPanelSource = {
  readonly historyDays: number
  /** A hora da leitura, ISO com fuso, para a planilha; null sem a informação. */
  readonly readAt: string | null
  readonly rows: readonly RegistryLine[]
  readonly today: string
}

/**
 * Conteúdo da janela: título, o que a lista é, e a tabela. Separado da casca
 * para o teste desenhá-lo sem abrir a janela, que usa portal.
 */
export function ScheduleRegistryPanel({
  historyDays,
  panelContainer,
  readAt,
  rows,
  today,
}: RegistryPanelSource & { panelContainer: HTMLElement | null }) {
  const download = (visible: readonly RegistryLine[], filters: ListTableFilters<RegistryKey>, search: string) => {
    const bytes = buildRegistryWorkbook(visible, {
      historyDays,
      listFilters: registryFiltersText(filters, search),
      readAt,
      generatedAt: formatDateTimeBr(new Date()),
    })
    downloadXlsx(bytes, registryFileName(today))
  }

  return (
    <>
      <ListDialogHeader
        description={`Quem executou cada categoria nos últimos ${formatNumber(historyDays)} dias sem estar cadastrado como apto no SGI · uma linha por técnico e categoria · é o cadastro que faz o agendamento recusar data sem motivo`}
        title="Cadastro de aptidões a corrigir no SGI"
      />
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        <ListTable
          ariaLabel="Cadastro de aptidões a corrigir no SGI"
          columns={REGISTRY_COLUMNS}
          description={DESCRIPTION}
          emptyMessage="Nenhum técnico executando sem a aptidão cadastrada."
          fill
          label="Técnicos sem a aptidão cadastrada"
          onDownload={download}
          panelContainer={panelContainer}
          rowKey={(row) => row.key}
          rows={rows}
          unit="linhas"
        />
      </div>
    </>
  )
}

export function ScheduleRegistryDialog({
  onOpenChange,
  open,
  ...source
}: RegistryPanelSource & { onOpenChange: (open: boolean) => void; open: boolean }) {
  return (
    <ListDialog onOpenChange={onOpenChange} open={open}>
      {(panelContainer) => <ScheduleRegistryPanel {...source} panelContainer={panelContainer} />}
    </ListDialog>
  )
}
