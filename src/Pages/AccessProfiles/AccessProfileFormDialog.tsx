import * as Dialog from '@radix-ui/react-dialog'
import {Check, Minus, X} from 'lucide-react'
import {useEffect, useId, useMemo, useState} from 'react'

import {Button} from '../../components/ui/button'
import {menuService} from '../../services/menu/menuService'
import {pageKeyFromChildMenuId} from '../../services/profileMenus/profileMenuKeys'
import type {DepartmentPageAccess} from '../../types/access'
import type {MenuTreeTypes, MenuTypes} from '../../types/menu/menuTypes'
import {
    NON_DEFAULT_SELECTION_PAGE_KEYS,
    pageSelectionKey,
    type PreviewProfile,
    selectionFromDepartments,
} from './accessProfilesPreviewModel'
import {
    DepartmentAccordion,
    fieldClass,
    fieldLabelClass,
    formModalClass,
    modalOverlayClass,
    modalShellClass,
    type ModalTab,
    ModalTabPanel,
    ModalTabs,
    RequiredMark,
    sectionTitleClass,
    SelectionCheckbox,
} from './accessProfilesUi'
import {DepartmentCoverageBadge} from './DepartmentCoverageChip'

export const DRAFT_PROFILE_ID = 'perfil-rascunho'

export type AccessProfileFormMode = { mode: 'create' } | { mode: 'edit'; profile: PreviewProfile }

const TABS: readonly ModalTab[] = [
    {id: 'dados', label: 'Dados gerais'},
    {id: 'acessos', label: 'Acessos'},
]

export type AccessProfileFormDraft = {
    name: string
    description: string
    departmentPageAccess: DepartmentPageAccess[]
}

export function AccessProfileFormDialog({
                                            form,
                                            onOpenChange,
                                            onSave,
                                        }: {
    form: AccessProfileFormMode | null
    onOpenChange: (open: boolean) => void
    onSave: (draft: AccessProfileFormDraft) => Promise<string | null>
}) {

    const [menu, setMenu] = useState<MenuTreeTypes[]>([])

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let ativo = true

        async function loadMenuTree() {

            try {

                setLoading(true)
                setError(null)

                const response = await menuService.getMenuTree()

                if (!ativo) return

                setMenu(response)

            } catch (err) {
                console.log(err)

                if (!ativo) return

                setMenu([])
                setError("Erro ao carregar os menus")

            } finally {
                if (ativo) setLoading(false)
            }
        }

        void loadMenuTree()

        return () => {
            ativo = false
        }
    }, [])

    return (
        <Dialog.Root onOpenChange={onOpenChange} open={form !== null}>
            <Dialog.Portal>
                <Dialog.Overlay className={modalOverlayClass}/>
                <Dialog.Content className={`${modalShellClass} ${formModalClass}`}>
                    {form ? (
                        <FormBody
                            form={form}
                            isLoadingMenu={loading}
                            key={form.mode === 'edit' ? form.profile.id : DRAFT_PROFILE_ID}
                            menu={menu}
                            menuError={error}
                            onClose={() => onOpenChange(false)}
                            onSave={onSave}
                        />
                    ) : null}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function menuLabel(item: { name: string; menuId: string }): string {
    return item.name.trim() || item.menuId
}

function byPosition<T extends { position: number }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => a.position - b.position)
}

function submenusOf(root: MenuTreeTypes): MenuTypes[] {
    return byPosition(root.children ?? [])
}

function submenuSelectionKey(root: MenuTreeTypes, child: MenuTypes): string {
    return pageSelectionKey(root.menuId, pageKeyFromChildMenuId(root.menuId, child.menuId))
}

function allSelectionKeysOf(root: MenuTreeTypes): string[] {
    return submenusOf(root).map((child) => submenuSelectionKey(root, child))
}

function defaultSelectionKeysOf(root: MenuTreeTypes): string[] {
    return submenusOf(root)
        .filter(
            (child) =>
                !NON_DEFAULT_SELECTION_PAGE_KEYS.includes(
                    pageKeyFromChildMenuId(root.menuId, child.menuId),
                ),
        )
        .map((child) => submenuSelectionKey(root, child))
}

type MenuSelectionState = 'empty' | 'partial' | 'complete'

function describeMenuSelectionState(
    root: MenuTreeTypes,
    selection: ReadonlySet<string>,
): MenuSelectionState {
    const all = allSelectionKeysOf(root)

    if (!all.some((key) => selection.has(key))) return 'empty'

    const defaults = defaultSelectionKeysOf(root)

    return defaults.length > 0 && defaults.every((key) => selection.has(key)) ? 'complete' : 'partial'
}

/** Seleção com os submenus padrão daquele menu ACRESCENTADOS; nada é retirado. */
function withMenuDefaultPages(selection: ReadonlySet<string>, root: MenuTreeTypes): Set<string> {
    const next = new Set(selection)

    for (const key of defaultSelectionKeysOf(root)) next.add(key)

    return next
}

/** Seleção sem nenhum submenu daquele menu, inclusive IA e Modelo Dimensional. */
function withoutMenuPages(selection: ReadonlySet<string>, root: MenuTreeTypes): Set<string> {
    const next = new Set(selection)

    for (const key of allSelectionKeysOf(root)) next.delete(key)

    return next
}

function FormBody({
                      form,
                      isLoadingMenu,
                      menu,
                      menuError,
                      onClose,
                      onSave,
                  }: {
    form: AccessProfileFormMode
    isLoadingMenu: boolean
    menu: readonly MenuTreeTypes[]
    menuError: string | null
    onClose: () => void
    onSave: (draft: AccessProfileFormDraft) => Promise<string | null>
}) {

    const baseId = useId()
    const [activeTab, setActiveTab] = useState<string>(TABS[0].id)
    const isEditing = form.mode === 'edit'

    const [name, setName] = useState(isEditing ? form.profile.name : '')
    const [description, setDescription] = useState(isEditing ? form.profile.description : '')
    const [formError, setFormError] = useState<string | null>(null)

    const menuRoots = useMemo(() => byPosition(menu), [menu])
    const [selectedPages, setSelectedPages] = useState<ReadonlySet<string>>(() =>
        isEditing ? selectionFromDepartments(form.profile.departments) : new Set<string>(),
    )
    const [isSaving, setIsSaving] = useState(false)

    /*
     * Lista vazia tem dois motivos, e eles não dizem a mesma coisa: a leitura
     * falhou, ou o serviço não publicou item de menu nenhum. Enquanto a resposta
     * está a caminho, nenhum dos dois é afirmado.
     */
    const emptyReason =
        menuError ??
        (!isLoadingMenu && menuRoots.length === 0
            ? 'O serviço ainda não publicou nenhum item de menu. Cadastre os itens em Menu Itens antes de compor um Perfil de Acesso.'
            : null)

    function togglePage(key: string, selected: boolean) {
        setSelectedPages((current) => {
            const next = new Set(current)

            if (selected) next.add(key)
            else next.delete(key)

            return next
        })

        setFormError(null)
    }

    function applyMenuDefaultPages(root: MenuTreeTypes) {
        setSelectedPages((current) => withMenuDefaultPages(current, root))
        setFormError(null)
    }

    function clearMenuPages(root: MenuTreeTypes) {
        setSelectedPages((current) => withoutMenuPages(current, root))
        setFormError(null)
    }

    const departmentPageAccess: DepartmentPageAccess[] = useMemo(
        () =>
            menuRoots.flatMap((root) => {
                const pageKeys = submenusOf(root)
                    .map((child) => pageKeyFromChildMenuId(root.menuId, child.menuId))
                    .filter((pageKey) => selectedPages.has(pageSelectionKey(root.menuId, pageKey)))

                return pageKeys.length ? [{departmentId: root.menuId, pageKeys}] : []
            }),
        [menuRoots, selectedPages],
    )

    const missingRequirement =
        name.trim() === ''
            ? 'Informe o nome do Perfil de Acesso.'
            : departmentPageAccess.length === 0
                ? 'Selecione ao menos uma página disponível em Acessos.'
                : null

    async function handleSave() {
        if (missingRequirement) {
            setFormError(missingRequirement)
            return
        }

        if (isSaving) return

        setIsSaving(true)
        try {
            const error = await onSave({name, description, departmentPageAccess})

            setFormError(error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <div className="flex flex-none items-center justify-between gap-3 px-5 pb-2 pt-4">
                <div className="min-w-0">
                    <Dialog.Title className="text-[16px] font-bold leading-tight text-[#172033]">
                        {isEditing ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-0.5 truncate text-[11.5px] text-[#98a2b3]">
                        {isEditing ? form.profile.name : 'Defina quais áreas e páginas o perfil libera'}
                    </Dialog.Description>
                </div>

                <Dialog.Close asChild>
                    <Button aria-label="Fechar" size="icon" variant="ghost">
                        <X aria-hidden="true" size={18}/>
                    </Button>
                </Dialog.Close>
            </div>

            <ModalTabs activeTabId={activeTab} baseId={baseId} onTabChange={setActiveTab} tabs={TABS}/>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {activeTab === 'dados' ? (
                    <ModalTabPanel baseId={baseId} tabId="dados">
                        <GeneralDataTab
                            baseId={baseId}
                            description={description}
                            name={name}
                            onDescriptionChange={setDescription}
                            onNameChange={(value) => {
                                setName(value)
                                setFormError(null)
                            }}
                        />
                    </ModalTabPanel>
                ) : null}
                {activeTab === 'acessos' ? (
                    <ModalTabPanel baseId={baseId} tabId="acessos">
                        <AccessTab
                            emptyReason={emptyReason}
                            isLoading={isLoadingMenu}
                            menu={menuRoots}
                            onApplyMenuDefaults={applyMenuDefaultPages}
                            onClearMenu={clearMenuPages}
                            onTogglePage={togglePage}
                            selection={selectedPages}
                        />
                    </ModalTabPanel>
                ) : null}
            </div>
            <div
                className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] bg-[#f6f8fb] px-5 py-2.5">
        <span className="min-w-0 text-[11.5px] leading-4 text-[#667085]">
            {(formError ?? emptyReason) ? (
                <span className="font-medium text-[#b42318]" role="alert">
              {formError ?? emptyReason}
            </span>
            ) : (
                'Cancelar descarta tudo o que foi preenchido aqui.'
            )}
        </span>
                <div className="flex items-center gap-2">
                    <Button onClick={onClose} size="sm" variant="secondary">
                        Cancelar
                    </Button>
                    <Button
                        disabled={missingRequirement !== null}
                        loading={isSaving}
                        onClick={handleSave}
                        size="sm"
                    >
                        {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar perfil'}
                    </Button>
                </div>
            </div>
        </>
    )
}

function GeneralDataTab({
                            baseId,
                            description,
                            name,
                            onDescriptionChange,
                            onNameChange,
                        }: {
    baseId: string
    description: string
    name: string
    onDescriptionChange: (value: string) => void
    onNameChange: (value: string) => void
}) {
    const nameId = `${baseId}-profile-name`
    const descriptionId = `${baseId}-profile-description`

    return (
        <div className="grid gap-4">
            <div>
                <label className={fieldLabelClass} htmlFor={nameId}>
                    Nome do Perfil de Acesso <RequiredMark/>
                </label>
                <input
                    aria-required
                    className={fieldClass}
                    id={nameId}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder="Ex.: Comercial"
                    type="text"
                    value={name}
                />
            </div>
            <div>
                <label className={fieldLabelClass} htmlFor={descriptionId}>
                    Descrição <span className="font-normal text-[#667085]">(opcional)</span>
                </label>
                <textarea
                    className={`${fieldClass} min-h-[84px] resize-none`}
                    id={descriptionId}
                    onChange={(event) => onDescriptionChange(event.target.value)}
                    placeholder="Descreva o que este perfil libera."
                    value={description}
                />
            </div>
        </div>
    )
}

function AccessTab({
                       emptyReason,
                       isLoading,
                       menu,
                       onApplyMenuDefaults,
                       onClearMenu,
                       onTogglePage,
                       selection,
                   }: {
    emptyReason: string | null
    isLoading: boolean
    menu: readonly MenuTreeTypes[]
    onApplyMenuDefaults: (root: MenuTreeTypes) => void
    onClearMenu: (root: MenuTreeTypes) => void
    onTogglePage: (key: string, selected: boolean) => void
    selection: ReadonlySet<string>
}) {
    if (isLoading) {
        return (
            <div>
                <div className={sectionTitleClass}>Departamentos e páginas</div>
                <p className="mt-2 text-[12.5px] leading-5 text-[#667085]">Lendo os menus do serviço…</p>
            </div>
        )
    }

    if (menu.length === 0) {
        return (
            <div>
                <div className={sectionTitleClass}>Departamentos e páginas</div>
                <p className="mt-2 text-[12.5px] leading-5 text-[#b42318]" role="alert">
                    {emptyReason ?? 'Nenhum menu de acesso disponível.'}
                </p>
            </div>
        )
    }

    return (
        <div>
            <div className={sectionTitleClass}>Departamentos e páginas</div>
            <ul className="mt-2 grid gap-1.5">
                {menu.map((root) => {
                    const submenus = submenusOf(root)
                    const total = submenus.length
                    const granted = submenus.filter((child) =>
                        selection.has(submenuSelectionKey(root, child)),
                    ).length
                    const percent = total === 0 ? 0 : Math.min(100, (granted / total) * 100)
                    const label = menuLabel(root)

                    return (
                        <li key={root.id}>
                            <DepartmentAccordion
                                label={label}
                                meta={
                                    <DepartmentCoverageBadge
                                        accessibleLabel={`${label}: ${granted} de ${total} ${
                                            total === 1 ? 'submenu liberado' : 'submenus liberados'
                                        }`}
                                        fraction={`${granted}/${total}`}
                                        percent={percent}
                                    />
                                }
                            >
                                <MenuDefaultSelection
                                    onApplyDefault={() => onApplyMenuDefaults(root)}
                                    onClear={() => onClearMenu(root)}
                                    root={root}
                                    selection={selection}
                                />
                                {submenus.length === 0 ? (
                                    <p className="py-1.5 text-[12px] leading-4 text-[#98a2b3]">
                                        Este item de menu ainda não tem submenus. Cadastre-os em Menu Itens para poder
                                        concedê-los.
                                    </p>
                                ) : (
                                    <ul>
                                        {submenus.map((child) => {
                                            const key = submenuSelectionKey(root, child)

                                            return (
                                                <li key={child.id}>
                                                    <SelectionCheckbox
                                                        checked={selection.has(key)}
                                                        label={menuLabel(child)}
                                                        onCheckedChange={(checked) => onTogglePage(key, checked)}
                                                    />
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </DepartmentAccordion>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function MenuDefaultSelection({
                                  onApplyDefault,
                                  onClear,
                                  root,
                                  selection,
                              }: {
    onApplyDefault: () => void
    onClear: () => void
    root: MenuTreeTypes
    selection: ReadonlySet<string>
}) {
    if (defaultSelectionKeysOf(root).length === 0) return null

    const state = describeMenuSelectionState(root, selection)
    const checked = state === 'complete' ? 'true' : state === 'partial' ? 'mixed' : 'false'

    const stateLabel =
        state === 'complete'
            ? 'Páginas padrão selecionadas'
            : state === 'partial'
                ? 'Seleção parcial'
                : 'Nenhuma página selecionada'

    return (
        <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#f2f4f8] pb-1.5 pt-0.5">
            <button
                aria-checked={checked}
                aria-label={`Selecionar páginas padrão de ${menuLabel(root)}`}
                className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-[12.5px] font-medium text-[#344054] transition hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
                onClick={() => (state === 'complete' ? onClear() : onApplyDefault())}
                role="checkbox"
                type="button"
            >
        <span
            className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border ${
                state === 'empty'
                    ? 'border-[#d0d5dd] bg-white'
                    : 'border-[var(--accent)] bg-[var(--accent)] text-white'
            }`}
        >
          {state === 'complete' ? (
              <Check aria-hidden="true" size={11} strokeWidth={3}/>
          ) : state === 'partial' ? (
              <Minus aria-hidden="true" size={11} strokeWidth={3}/>
          ) : null}
        </span>
                Selecionar páginas padrão
            </button>
            <span className="text-[11px] leading-4 text-[#98a2b3]">{stateLabel}</span>
        </div>
    )
}
