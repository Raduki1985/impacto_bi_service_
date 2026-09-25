import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/**
 * Janela de lista do portal: o número vira lista no centro da tela.
 *
 * Nasceu como a janela de OS da Visão Geral (24/09/2026, decisão do Mário:
 * janela no centro da tela, e não matriz no fim da página) e virou a casca de
 * qualquer lista aberta por um clique num painel. A regra do que a janela
 * mostra é da página; aqui fica só a casca, e o que ela congela:
 *
 * - é a janela modal do portal (Radix Dialog, a mesma de Perfis de Acesso):
 *   foco preso nela, Esc e clique fora fecham, e a página atrás não rola. A
 *   superfície vem dos tokens do tema, e `executive-panel` a põe nas mesmas
 *   superfícies dos painéis executivos de onde ela abre; publicada fora da
 *   página, sem isso ela cairia nas superfícies globais, mais escuras;
 * - o centro da tela é feito com flex, e não com o deslocamento de metade da
 *   largura que os outros modais usam: o painel do filtro de coluna tem
 *   posição fixa, e dentro de um elemento deslocado ele nasceria fora do
 *   lugar. Pelo mesmo motivo a camada que ocupa a tela não recebe clique
 *   (`pointerEvents: none`): o clique no fundo cai na película escura, e é
 *   isso que a janela reconhece como clique fora para fechar;
 * - o painel do filtro de coluna nasce DENTRO da janela, num contêiner
 *   próprio entregue a quem desenha o conteúdo: fora dela ele seria clique
 *   fora, e o foco não entraria no campo de busca. Com um painel aberto, o Esc
 *   fecha só o painel, e não a janela;
 * - a janela tem altura FIXA, e não a altura da lista (decisão do Mário em
 *   24/09/2026, vista na tela): com a altura da lista e a janela no centro,
 *   trocar de uma seleção com 66 linhas para outra com 2 levava título,
 *   atalhos e Fechar uns 260 px para baixo, e o próximo atalho fugia do
 *   mouse. A lista curta fica com espaço vazio embaixo das linhas, como uma
 *   planilha com poucas linhas;
 * - o foco entra na JANELA, e não no primeiro botão: é a recomendação para
 *   janela de conteúdo longo, o leitor de tela anuncia o título, e o Fechar
 *   não abre aceso como se tivesse sido escolhido.
 *
 * Aberta ou fechada é estado de quem a usa: a página guarda a seleção e passa
 * `open`. A Visão Geral de OS guarda esse estado dentro da própria janela de
 * OS (`OsListDialog`), e não na página, para o clique não redesenhar todos
 * os gráficos com o ponteiro ainda sobre a barra.
 */
export function ListDialog({
  children,
  onOpenChange,
  open,
}: {
  /** O conteúdo, com o contêiner onde o painel do filtro de coluna nasce. */
  children: (panelContainer: HTMLElement | null) => ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  // O contêiner do painel de filtro de coluna chega pelo `ref`, depois da
  // montagem: é estado, e não ref, porque o conteúdo precisa ser desenhado de
  // novo quando ele passa a existir.
  const [panelContainer, setPanelContainer] = useState<HTMLDivElement | null>(null)

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/50" />
        <Dialog.Content
          className="impacto-list-dialog executive-panel fixed inset-0 z-50 flex items-center justify-center p-3 outline-none"
          onEscapeKeyDown={(event) => {
            if ((panelContainer?.childElementCount ?? 0) > 0) event.preventDefault()
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) {
              event.currentTarget.focus({ preventScroll: true })
            }
          }}
          style={{ pointerEvents: 'none' }}
        >
          <div className="pointer-events-auto flex h-[88vh] w-[1260px] max-w-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_48px_rgba(16,24,40,.22)]">
            {children(panelContainer)}
          </div>
          <div className="pointer-events-auto" ref={setPanelContainer} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Cabeçalho da janela: título, a linha de contexto e o Fechar. O que mais a
 * página quiser no cabeçalho, como os atalhos de seleção, vai no `children`.
 *
 * Separado da casca para a página poder desenhar o conteúdo sem abrir a
 * janela nos testes: a casca usa portal, que não existe fora do navegador, e
 * o cabeçalho só precisa do contexto do `Dialog.Root`.
 */
export function ListDialogHeader({
  children,
  description,
  title,
}: {
  children?: ReactNode
  /** Período pelo nome e filtros da página: a janela vai para o projetor sem a faixa atrás dela. */
  description: string
  title: string
}) {
  return (
    <div className="flex-none px-5 pb-3 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Dialog.Title className="text-[13.5px] font-semibold text-[var(--text-heading)]">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
            {description}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <button
            className="flex flex-none cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            type="button"
          >
            <X aria-hidden="true" size={13} />
            Fechar
          </button>
        </Dialog.Close>
      </div>
      {children}
    </div>
  )
}
