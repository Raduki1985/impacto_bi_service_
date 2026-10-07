import * as Dialog from '@radix-ui/react-dialog'
import {ChevronDown, CornerDownRight, Pencil, Plus, Trash2} from 'lucide-react'
import {type ReactNode, useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '../../components/ui/button'
import {SessionToast, type SessionToastVariant} from '../../components/ui/SessionToast'
import {ApiError} from '../../services/apiService'
import {menuService} from '../../services/menu/menuService'
import type {CreateMenuTypes, MenuTypes} from '../../types/menu/menuTypes'
import {MenuItemFormModal, type MenuItemFormMode} from './MenuItemFormModal'
import {
    buildMenuItemsModel,
    childCountOf,
    checkMenuItemDraft,
    draftFailureMessages,
    flattenMenuTree,
    type MenuItemDraft,
    parentNameOf,
} from './menuItemsModel'

const surfaceClass = 'rounded-xl border border-[#eaecf2] bg-white'

const sectionHeadingClass = 'text-[14px] font-semibold text-[#172033]'

type MenuItemToast = { title: string; description: string; variant: SessionToastVariant }

function failureMessage(cause: unknown, fallback: string): string {
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
        const message = cause.message.trim()

        if (message !== '') return message
    }

    return fallback
}

export function MenuItems() {
    const [menus, setMenus] = useState<MenuTypes[]>([])
    const [listError, setListError] = useState<string | null>(null)

    const [toast, setToast] = useState<MenuItemToast | null>(null)
    const dismissToast = useCallback(() => setToast(null), [])

    const [form, setForm] = useState<MenuItemFormMode | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<MenuTypes | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    const model = useMemo(() => buildMenuItemsModel(menus), [menus])

    const refreshMenus = useCallback(async () => {
        setMenus(flattenMenuTree(await menuService.getMenuTree()))
    }, [])

    useEffect(() => {
        let active = true

        async function readMenus() {
            try {
                setListError(null)

                const tree = await menuService.getMenuTree()

                if (!active) return

                setMenus(flattenMenuTree(tree))
            } catch (err) {
                console.error('Erro ao carregar os itens de menu', err)

                if (!active) return

                setListError(
                    failureMessage(err, 'Não foi possível ler os itens de menu. Tente novamente.'),
                )
            }
        }

        void readMenus()

        return () => {
            active = false
        }
    }, [])

    function openCreateForm() {
        setToast(null)
        setForm({mode: 'create'})
    }

    function openEditForm(menu: MenuTypes) {
        setToast(null)
        setForm({mode: 'edit', menu})
    }

    async function handleSave(draft: MenuItemDraft): Promise<string | null> {
        if (form === null) return null

        const isEditing = form.mode === 'edit'
        const check = checkMenuItemDraft(draft, menus, isEditing ? form.menu.id : null)

        if (!check.ok) return draftFailureMessages[check.reason]

        const payload: CreateMenuTypes = {
            name: check.input.name,
            position: check.input.position,
            menuId: check.input.menuKey,
            icon: check.input.icon === '' ? null : check.input.icon,
            profileMenuId: check.input.parentId,
        }

        try {
            const saved = isEditing
                ? await menuService.updateMenu(form.menu.id, payload)
                : await menuService.createMenus(payload)

            setForm(null)

            await refreshMenus()

            setToast(
                isEditing
                    ? {
                        variant: 'success',
                        title: 'Item de menu atualizado com sucesso',
                        description: `As alterações de ${saved.name} foram gravadas.`,
                    }
                    : {
                        variant: 'success',
                        title: 'Item de menu cadastrado com sucesso',
                        description: `${saved.name} já está na lista de itens de menu.`,
                    },
            )

            return null
        } catch (err) {
            console.error('Erro ao gravar o item de menu', err)

            const message = failureMessage(
                err,
                isEditing
                    ? 'Não foi possível atualizar o item de menu. Tente novamente.'
                    : 'Não foi possível cadastrar o item de menu. Tente novamente.',
            )

            setToast({
                variant: 'alert',
                title: isEditing ? 'Erro ao atualizar item de menu' : 'Erro ao cadastrar item de menu',
                description: message,
            })

            return message
        }
    }

    function openDeleteDialog(menu: MenuTypes) {
        setToast(null)
        setDeleteError(null)
        setDeleteTarget(menu)
    }

    function closeDeleteDialog() {
        if (deleting) return

        setDeleteTarget(null)
        setDeleteError(null)
    }

    async function confirmDelete() {
        if (deleteTarget === null || deleting) return

        const target = deleteTarget

        setDeleting(true)
        try {
            await menuService.deleteMenus(target.id)

            setDeleteTarget(null)
            setDeleteError(null)

            await refreshMenus()

            setToast({
                variant: 'success',
                title: 'Item de menu excluído',
                description: `${target.name} saiu da lista de itens de menu.`,
            })
        } catch (err) {
            console.error('Erro ao excluir o item de menu', err)

            const message = failureMessage(
                err,
                'Não foi possível excluir o item de menu. Tente novamente.',
            )

            setDeleteError(message)
            setToast({
                variant: 'alert',
                title: 'Erro ao excluir item de menu',
                description: message,
            })
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef0f4] pb-4">
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-[#172033]">Menu Itens</h2>
                    <p className="mt-1 text-[13px] text-[#667085]">
                        Cadastre os itens de menu que os Perfis de Acesso concedem, como itens pai e submenus.
                    </p>
                </div>
                <Button onClick={openCreateForm} size="sm">
                    <Plus aria-hidden="true" size={15}/>
                    Novo item de menu
                </Button>
            </div>

            <section aria-label="Itens de menu" className="grid gap-3">
                {listError !== null ? (
                    <FailurePanel message={listError}/>
                ) : model.groups.length === 0 && model.unreachable.length === 0 ? (
                    <EmptyPanel/>
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
                childCount={deleteTarget === null ? 0 : childCountOf(menus, deleteTarget.id)}
                deleting={deleting}
                error={deleteError}
                menu={deleteTarget}
                onCancel={closeDeleteDialog}
                onConfirm={confirmDelete}
            />

            {toast ? (
                <SessionToast
                    description={toast.description}
                    key={`${toast.variant}-${toast.title}-${toast.description}`}
                    onDismiss={dismissToast}
                    title={toast.title}
                    variant={toast.variant}
                />
            ) : null}
        </div>
    )
}

function MenuGroupCard({
                           childrenItems,
                           onDelete,
                           onEdit,
                           root,
                       }: {
    childrenItems: readonly MenuTypes[]
    onDelete: (menu: MenuTypes) => void
    onEdit: (menu: MenuTypes) => void
    root: MenuTypes
}) {
    return (
        <details className="group overflow-hidden rounded-xl border border-[#eaecf2] bg-[#f7f8fa]">
            <summary
                className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 transition hover:bg-[#f2f4f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
                <ChevronDown
                    aria-hidden="true"
                    className="shrink-0 text-[#98a2b3] transition group-open:rotate-180"
                    size={15}
                />
                <span className="min-w-0 flex-1">
          <MenuIdentity menu={root}/>
        </span>
                <span className="flex-none text-[11.5px] tabular-nums text-[#667085]">
          {childrenItems.length} {childrenItems.length === 1 ? 'submenu' : 'submenus'}
        </span>
                <MenuActions menu={root} onDelete={onDelete} onEdit={onEdit}/>
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
                                <CornerDownRight aria-hidden="true" className="flex-none text-[#c4cbd8]" size={14}/>
                                <span className="min-w-0 flex-1">
                  <MenuIdentity menu={child}/>
                </span>
                                <MenuActions menu={child} onDelete={onDelete} onEdit={onEdit}/>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </details>
    )
}

function MenuIdentity({menu}: { menu: MenuTypes }) {
    return (
        <span className="block min-w-0">
      <span className="block break-words text-[13px] font-semibold leading-[1.35] text-[#172033]">
        {menu.name}
      </span>
      <span className="mt-0.5 block text-[11.5px] leading-4 text-[#667085]">
        <span className="break-all font-mono text-[#475467]">{menu.menuId}</span>
          {' · posição '}
          <span className="tabular-nums">{menu.position}</span>
          {menu.icon ? <> · ícone {menu.icon}</> : null}
      </span>
    </span>
    )
}

function MenuActions({
                         menu,
                         onDelete,
                         onEdit,
                     }: {
    menu: MenuTypes
    onDelete: (menu: MenuTypes) => void
    onEdit: (menu: MenuTypes) => void
}) {
    return (
        <span className="flex flex-none items-center gap-0.5">
      <ActionButton
          icon={<Pencil aria-hidden="true" size={13}/>}
          label={`Editar item de menu ${menu.name}`}
          onClick={() => onEdit(menu)}
          tone="neutral"
      />
      <ActionButton
          icon={<Trash2 aria-hidden="true" size={13}/>}
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

function UnreachableSection({
                                menus,
                                onDelete,
                                onEdit,
                                unreachable,
                            }: {
    menus: readonly MenuTypes[]
    onDelete: (menu: MenuTypes) => void
    onEdit: (menu: MenuTypes) => void
    unreachable: readonly MenuTypes[]
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
                <MenuIdentity menu={menu}/>
                <span className="mt-0.5 block text-[11.5px] leading-4 text-[#b54708]">
                  {parentName === null
                      ? 'O item pai não existe mais na coleção.'
                      : `Está abaixo de “${parentName}”, que já é um submenu.`}
                </span>
              </span>
                            <MenuActions menu={menu} onDelete={onDelete} onEdit={onEdit}/>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

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

function FailurePanel({message}: { message: string }) {
    return (
        <div className="rounded-xl border border-[#f3d9a5] bg-[#fffaf0] px-4 py-4">
            <h3 className="text-[13.5px] font-semibold text-[#7a5a12]">
                Não foi possível ler os itens de menu
            </h3>
            <p className="mt-1 text-[12.5px] leading-5 text-[#8a6a2a]">{message}</p>
        </div>
    )
}

function DeleteMenuDialog({
                              childCount,
                              deleting,
                              error,
                              menu,
                              onCancel,
                              onConfirm,
                          }: {
    childCount: number
    deleting: boolean
    error: string | null
    menu: MenuTypes | null
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
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
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
                        <Button disabled={deleting} onClick={onCancel} variant="secondary">
                            Cancelar
                        </Button>
                        <Button
                            className="bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[#e5484d]"
                            loading={deleting}
                            onClick={onConfirm}
                        >
                            {deleting ? null : <Trash2 aria-hidden="true" size={15}/>}
                            {deleting ? 'Excluindo...' : 'Excluir item'}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
