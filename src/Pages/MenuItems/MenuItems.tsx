import * as Dialog from '@radix-ui/react-dialog'
import { ChevronDown, CornerDownRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { SessionToast } from '../../components/ui/SessionToast'
import {
  createProfileMenu,
  deleteProfileMenu,
  loadProfileMenus,
  updateProfileMenu,
  type ProfileMenuListResult,
} from '../../services/profileMenus/profileMenuRepository'
import {
  deletionImpactOf,
  type ProfileMenuDraft,
} from '../../services/profileMenus/profileMenuRules'
import type { CoreProfileMenu } from '../../types/coreApi'
import { MenuItemFormModal, type MenuItemFormMode } from './MenuItemFormModal'
import { draftFailureMessages } from './menuItemMessages'
import { buildMenuItemsModel, parentNameOf } from './menuItemsModel'

/**
 * Menu Itens.
 *
 * A aba lista os itens de menu do `impacto-bi-service` (`profile_menu`), que
 * são as unidades que um Perfil de Acesso concede. Identidade, chave, posição,
 * ícone e hierarquia vêm das linhas de lá; não existe coleção local nem
 * armazenamento no navegador.
 *
 * Cadastrar, editar e excluir são chamadas ao serviço, coordenadas por
 * `profileMenuRepository`. Enquanto o formulário está aberto, tudo vive em
 * estado local; cancelar ou fechar descarta o rascunho inteiro sem tocar em
 * nada.
 *
 * A listagem é por GRUPO, e não uma tabela plana: a informação que importa
 * neste cadastro é a relação entre pai e filho, e uma tabela com uma coluna
 * "pai" obrigaria a reconstruir a árvore com o olho, linha a linha.
 *
 * As recusas do SERVIÇO chegam com a frase pronta (`reason: 'service-failure'`)
 * e são exibidas como vieram.
 */

/** Superfície das demais abas das Configurações: painel branco fixo nos dois temas. */
const surfaceClass = 'rounded-xl border border-[#eaecf2] bg-white'

/** Rótulo de seção com o mesmo peso das demais leituras relevantes das abas. */
const sectionHeadingClass = 'text-[14px] font-semibold text-[#172033]'

/**
 * Coleção da leitura que falhou, com identidade estável entre renders.
 *
 * Um `[]` escrito na derivação seria um array novo a cada render, e o modelo
 * derivado dele seria recalculado a cada render junto. Aqui não é otimização
 * prematura: a falha de leitura é exatamente o estado em que a tela fica parada
 * na tela enquanto alguém lê a mensagem.
 */
const NO_MENUS: readonly CoreProfileMenu[] = []

export function MenuItems() {
  /**
   * Coleção do serviço, lida na montagem e relida após cada gravação
   * confirmada. Vazia até a primeira resposta chegar. Uma leitura que falhou
   * mostra o painel de falha com a frase do serviço, e nada é criado,
   * substituído ou apagado por causa dela.
   */
  const [collection, setCollection] = useState<ProfileMenuListResult>({ ok: true, menus: [] })
  /**
   * Confirmação da última EXCLUSÃO, exibida acima da coleção.
   *
   * Cadastro e edição saíram daqui e viraram aviso flutuante: a confirmação
   * deles responde a um formulário que acabou de fechar, e a mesma frase nos
   * dois lugares seria a mesma notícia contada duas vezes.
   */
  const [feedback, setFeedback] = useState<string | null>(null)
  /**
   * Aviso flutuante da última gravação do formulário, cadastro ou edição.
   *
   * Quem o desenha é esta página, e não o `Portal` das rotas: salvar um item
   * não troca de tela, então a página continua montada atrás do modal que fecha.
   */
  const [saveToast, setSaveToast] = useState<{ description: string; title: string } | null>(null)
  /**
   * Estável de propósito: o `SessionToast` conta os 5 segundos em um efeito que
   * depende desta função, e uma função nova a cada render reiniciaria a contagem
   * antes de ela terminar.
   */
  const dismissSaveToast = useCallback(() => setSaveToast(null), [])
  const [form, setForm] = useState<MenuItemFormMode | null>(null)
  /**
   * Item apontado pela lixeira, ainda não excluído. Guardar o item, e não
   * apenas o id, é o que permite à confirmação escrever nome e alcance mesmo
   * depois de a coleção ser relida.
   */
  const [deleteTarget, setDeleteTarget] = useState<CoreProfileMenu | null>(null)
  /** Recusa da última tentativa de exclusão, exibida dentro da confirmação. */
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const menus = collection.ok ? collection.menus : NO_MENUS
  const model = useMemo(() => buildMenuItemsModel(menus), [menus])

  // Carga inicial. O StrictMode monta o efeito duas vezes em desenvolvimento; a
  // primeira resposta é descartada para a segunda montagem não receber um
  // estado que não é dela.
  useEffect(() => {
    let cancelled = false

    void loadProfileMenus().then((next) => {
      if (!cancelled) setCollection(next)
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    setCollection(await loadProfileMenus())
  }

  function openCreateForm() {
    setFeedback(null)
    setSaveToast(null)
    setForm({ mode: 'create' })
  }

  function openEditForm(menu: CoreProfileMenu) {
    setFeedback(null)
    setSaveToast(null)
    setForm({ mode: 'edit', menu })
  }

  /**
   * Grava o item no serviço. Devolve a mensagem de erro para o formulário
   * exibir, ou null no sucesso, quando a coleção é relida e o modal fecha.
   */
  async function handleSave(draft: ProfileMenuDraft): Promise<string | null> {
    if (form === null) return null

    const result =
      form.mode === 'edit'
        ? await updateProfileMenu(form.menu.id, draft)
        : await createProfileMenu(draft)

    if (!result.ok) {
      // A frase do serviço sobe como veio; a recusa que o portal conferiu usa a
      // mesma tabela do formulário, e não uma segunda cópia dela.
      return result.reason === 'service-failure'
        ? result.message
        : draftFailureMessages[result.reason]
    }

    await reload()
    setForm(null)
    setSaveToast(
      form.mode === 'edit'
        ? {
            title: 'Item de menu atualizado com sucesso',
            description: `As alterações de ${result.menu.name} foram gravadas.`,
          }
        : {
            title: 'Item de menu cadastrado com sucesso',
            description: `${result.menu.name} já está na lista de itens de menu.`,
          },
    )

    return null
  }

  function openDeleteDialog(menu: CoreProfileMenu) {
    setFeedback(null)
    setSaveToast(null)
    setDeleteError(null)
    setDeleteTarget(menu)
  }

  /**
   * Confirma a exclusão. Na recusa a confirmação PERMANECE ABERTA com a
   * mensagem, e o Administrador pode tentar de novo ou cancelar.
   */
  async function confirmDelete() {
    if (deleteTarget === null) return

    const result = await deleteProfileMenu(deleteTarget.id)

    if (!result.ok) {
      setDeleteError(result.message)
      return
    }

    await reload()
    setFeedback(`${deleteTarget.name} foi excluído com sucesso.`)
    setDeleteTarget(null)
    setDeleteError(null)
  }

  return (
    <div className="grid gap-5">
      {/* Mesma composição de cabeçalho das abas Usuários e Perfis de acesso:
          título e linha de apoio à esquerda, ação principal à direita, e o
          filete que separa a identidade da aba do conteúdo administrativo. */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef0f4] pb-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#172033]">Menu Itens</h2>
          <p className="mt-1 text-[13px] text-[#667085]">
            Cadastre os itens de menu que os Perfis de Acesso concedem, como itens pai e submenus.
          </p>
        </div>
        <Button onClick={openCreateForm} size="sm">
          <Plus aria-hidden="true" size={15} />
          Novo item de menu
        </Button>
      </div>

      {feedback ? (
        <div
          className="rounded-lg border border-[#b7e4c7] bg-[#f2fbf5] px-3.5 py-2 text-[12.5px] font-medium text-[#16794a]"
          role="status"
        >
          {feedback}
        </div>
      ) : null}

      <section aria-label="Itens de menu" className="grid gap-3">
        {!collection.ok ? (
          <FailurePanel message={collection.message} />
        ) : model.groups.length === 0 && model.unreachable.length === 0 ? (
          <EmptyPanel />
        ) : (
          <ul className="grid gap-3">
            {model.groups.map((group) => (
              <li key={group.root.id}>
                <MenuGroupCard
                  childrenItems={group.children}
                  onDelete={openDeleteDialog}
                  onEdit={openEditForm}
                  root={group.root}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <UnreachableSection
        menus={menus}
        onDelete={openDeleteDialog}
        onEdit={openEditForm}
        unreachable={model.unreachable}
      />

      <MenuItemFormModal
        form={form}
        menus={menus}
        onOpenChange={(open) => {
          if (!open) setForm(null)
        }}
        onSave={handleSave}
      />

      <DeleteMenuDialog
        childCount={deleteTarget === null ? 0 : deletionImpactOf(menus, deleteTarget.id).childCount}
        error={deleteError}
        menu={deleteTarget}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
        onConfirm={confirmDelete}
      />

      {/* Por último na árvore, mas a posição na tela é fixa e vem do próprio
          aviso: ele não empurra nem reposiciona nada desta página. */}
      {saveToast ? (
        <SessionToast
          description={saveToast.description}
          onDismiss={dismissSaveToast}
          title={saveToast.title}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Grupo: um item pai e os submenus dele                                      */
/* -------------------------------------------------------------------------- */

/**
 * Um item pai com os submenus dentro, em acordeão recolhido por padrão.
 *
 * Recolhido: a lista abre com um grupo por linha, e a estrutura de primeiro
 * nível cabe inteira na tela sem rolagem. Quem precisa dos submenus de um grupo
 * abre aquele grupo, e o número de submenus continua dito na linha do pai para
 * o grupo fechado não esconder que tem conteúdo.
 *
 * `details` e `summary` nativos, como no acordeão de departamento dos Perfis de
 * acesso: já são operáveis por teclado e anunciam o estado expandido sem
 * JavaScript de foco.
 */
function MenuGroupCard({
  childrenItems,
  onDelete,
  onEdit,
  root,
}: {
  childrenItems: readonly CoreProfileMenu[]
  onDelete: (menu: CoreProfileMenu) => void
  onEdit: (menu: CoreProfileMenu) => void
  root: CoreProfileMenu
}) {
  return (
    <details className="group overflow-hidden rounded-xl border border-[#eaecf2] bg-[#f7f8fa]">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 transition hover:bg-[#f2f4f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-[#98a2b3] transition group-open:rotate-180"
          size={15}
        />
        <span className="min-w-0 flex-1">
          <MenuIdentity menu={root} />
        </span>
        <span className="flex-none text-[11.5px] tabular-nums text-[#667085]">
          {childrenItems.length} {childrenItems.length === 1 ? 'submenu' : 'submenus'}
        </span>
        <MenuActions menu={root} onDelete={onDelete} onEdit={onEdit} />
      </summary>
      <div className="border-t border-[#eaecf2] bg-white px-3.5 py-1">
        {childrenItems.length === 0 ? (
          <p className="py-2.5 text-[11.5px] text-[#98a2b3]">
            Nenhum submenu cadastrado neste item.
          </p>
        ) : (
          <ul className="divide-y divide-[#f2f4f8]">
            {childrenItems.map((child) => (
              <li className="flex items-center gap-2.5 py-2.5" key={child.id}>
                <CornerDownRight aria-hidden="true" className="flex-none text-[#c4cbd8]" size={14} />
                <span className="min-w-0 flex-1">
                  <MenuIdentity menu={child} />
                </span>
                <MenuActions menu={child} onDelete={onDelete} onEdit={onEdit} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

/**
 * Nome do item e, abaixo, a linha técnica: chave, posição e ícone.
 *
 * A chave vem em fonte monoespaçada porque é um identificador que alguém vai
 * comparar caractere a caractere com o catálogo do portal, e não um rótulo a
 * ser lido. O ícone só aparece quando existe: uma linha dizendo "sem ícone" em
 * cada item encheria a lista de uma informação que não muda decisão nenhuma.
 */
function MenuIdentity({ menu }: { menu: CoreProfileMenu }) {
  return (
    <span className="block min-w-0">
      <span className="block break-words text-[13px] font-semibold leading-[1.35] text-[#172033]">
        {menu.name}
      </span>
      <span className="mt-0.5 block text-[11.5px] leading-4 text-[#667085]">
        <span className="break-all font-mono text-[#475467]">{menu.menu_id}</span>
        {' · posição '}
        <span className="tabular-nums">{menu.position}</span>
        {menu.icon ? <> · ícone {menu.icon}</> : null}
      </span>
    </span>
  )
}

/**
 * Lápis e lixeira, no mesmo traço discreto dos cards de Perfis de acesso:
 * compactos e em cinza no repouso, para não competir com o nome do item, com a
 * cor aparecendo só na interação. O nome acessível diz o que o botão faz e em
 * qual item, sem depender do ícone.
 *
 * `stopPropagation` porque estes botões vivem dentro do `summary` do acordeão:
 * sem ele, clicar no lápis também recolheria o grupo.
 */
function MenuActions({
  menu,
  onDelete,
  onEdit,
}: {
  menu: CoreProfileMenu
  onDelete: (menu: CoreProfileMenu) => void
  onEdit: (menu: CoreProfileMenu) => void
}) {
  return (
    <span className="flex flex-none items-center gap-0.5">
      <ActionButton
        icon={<Pencil aria-hidden="true" size={13} />}
        label={`Editar item de menu ${menu.name}`}
        onClick={() => onEdit(menu)}
        tone="neutral"
      />
      <ActionButton
        icon={<Trash2 aria-hidden="true" size={13} />}
        label={`Excluir item de menu ${menu.name}`}
        onClick={() => onDelete(menu)}
        tone="destructive"
      />
    </span>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  tone: 'neutral' | 'destructive'
}) {
  const toneClass =
    tone === 'destructive'
      ? 'text-[#98a2b3] hover:bg-[#fdf3f3] hover:text-[#b42318] focus-visible:ring-[#e5484d] focus-visible:text-[#b42318]'
      : 'text-[#98a2b3] hover:bg-[#eef2f8] hover:text-[#344054] focus-visible:ring-[var(--accent)] focus-visible:text-[#344054]'

  return (
    <button
      aria-label={label}
      className={`flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 ${toneClass}`}
      onClick={(event) => {
        // O botão vive dentro do `summary`: sem isto, o clique também recolheria
        // o grupo enquanto abre o formulário.
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      title={label}
      type="button"
    >
      {icon}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Itens fora da hierarquia de dois níveis                                    */
/* -------------------------------------------------------------------------- */

/**
 * Itens que a listagem por grupo não alcança: netos e filhos de um pai que
 * sumiu.
 *
 * Sem nenhum caso a seção não renderiza, porque não há nada a dizer. Quando há,
 * ela é a única forma de alguém descobrir esses itens: eles existem no banco,
 * não aparecem em nenhum grupo e não concedem acesso a tela nenhuma, porque a
 * tradução de acesso do portal só enxerga raízes e filhos diretos. A saída está
 * escrita na própria seção: editar o item e dar a ele um item pai.
 */
function UnreachableSection({
  menus,
  onDelete,
  onEdit,
  unreachable,
}: {
  menus: readonly CoreProfileMenu[]
  onDelete: (menu: CoreProfileMenu) => void
  onEdit: (menu: CoreProfileMenu) => void
  unreachable: readonly CoreProfileMenu[]
}) {
  if (unreachable.length === 0) return null

  return (
    <section aria-labelledby="unreachable-title" className="grid gap-2">
      <h3 className={sectionHeadingClass} id="unreachable-title">
        Itens fora da estrutura de dois níveis
      </h3>
      <p className="text-[12px] leading-4 text-[#667085]">
        Estes itens estão abaixo de um submenu, ou apontam para um item pai que não existe mais. O
        portal não os enxerga ao montar a navegação, e nenhum Perfil de Acesso concede as telas
        deles. Edite cada um e escolha um item pai, ou exclua-o.
      </p>
      <ul className={`divide-y divide-[#f2f4f8] overflow-hidden ${surfaceClass}`}>
        {unreachable.map((menu) => {
          const parentName = parentNameOf(menus, menu)

          return (
            <li className="flex items-center gap-2.5 px-4 py-2.5" key={menu.id}>
              <span className="min-w-0 flex-1">
                <MenuIdentity menu={menu} />
                <span className="mt-0.5 block text-[11.5px] leading-4 text-[#b54708]">
                  {parentName === null
                    ? 'O item pai não existe mais na coleção.'
                    : `Está abaixo de “${parentName}”, que já é um submenu.`}
                </span>
              </span>
              <MenuActions menu={menu} onDelete={onDelete} onEdit={onEdit} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Estados da coleção                                                         */
/* -------------------------------------------------------------------------- */

function EmptyPanel() {
  return (
    <div className={`${surfaceClass} px-4 py-4`}>
      <h3 className="text-[13.5px] font-semibold text-[#172033]">Nenhum item de menu</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-[#667085]">
        A tabela de itens de menu do serviço está vazia. Enquanto ela estiver assim, um Perfil de
        Acesso não tem o que conceder: cadastre primeiro os itens pai dos departamentos e depois os
        submenus das páginas de cada um.
      </p>
    </div>
  )
}

/**
 * Estado da coleção quando ela não pôde ser lida do serviço. A frase é a do
 * serviço. Não é uma coleção vazia: a aba não cria, não substitui e não apaga
 * nada por causa de uma falha de leitura.
 */
function FailurePanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[#f3d9a5] bg-[#fffaf0] px-4 py-4">
      <h3 className="text-[13.5px] font-semibold text-[#7a5a12]">
        Não foi possível ler os itens de menu
      </h3>
      <p className="mt-1 text-[12.5px] leading-5 text-[#8a6a2a]">{message}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Confirmação da exclusão                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Confirmação da exclusão de um item de menu.
 *
 * Diferente da exclusão de um Perfil de Acesso, esta nunca é bloqueada: o
 * serviço exclui o item, os submenus dele por cascata, e os vínculos daquele
 * ramo com os Perfis de Acesso. Por isso a confirmação não pergunta apenas
 * "tem certeza": ela diz quantos submenus vão junto e que os perfis que
 * concediam essas telas deixam de concedê-las. É a única chance de alguém
 * perceber o alcance antes.
 *
 * Mesmo Radix Dialog e mesma composição das demais confirmações das
 * Configurações, com foco preso, fechamento por Escape e por clique no overlay,
 * e o botão destrutivo à direita dizendo o que faz por escrito, e não apenas
 * pela cor.
 */
function DeleteMenuDialog({
  childCount,
  error,
  menu,
  onCancel,
  onConfirm,
}: {
  childCount: number
  error: string | null
  menu: CoreProfileMenu | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
      open={menu !== null}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
          <Dialog.Title className="text-base font-bold text-[#101828]">
            Excluir item de menu?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
            {menu === null ? '' : `O item “${menu.name}” será excluído do serviço.`}
          </Dialog.Description>
          <p className="mt-2 text-[13px] leading-relaxed text-[#475467]">
            {childCount > 0
              ? `${childCount} ${childCount === 1 ? 'submenu será excluído' : 'submenus serão excluídos'} junto com ele.`
              : 'Este item não tem submenus.'}{' '}
            Os Perfis de Acesso que concediam estas telas deixam de concedê-las, e os usuários
            vinculados a eles perdem o acesso correspondente.
          </p>
          {error ? (
            <p
              className="mt-3 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3 py-2 text-[12.5px] font-medium leading-5 text-[#b42318]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2.5">
            <Button onClick={onCancel} variant="secondary">
              Cancelar
            </Button>
            <Button
              className="bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[#e5484d]"
              onClick={onConfirm}
            >
              <Trash2 aria-hidden="true" size={15} />
              Excluir item
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
