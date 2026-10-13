import * as Dialog from '@radix-ui/react-dialog'
import {Check, Minus, X} from 'lucide-react'
import {useId, useMemo, useState} from 'react'

import {Button} from '../../components/ui/button'
import type {MenuTreeTypes} from '../../types/menu/menuTypes'
import {
    byPosition,
    defaultSubmenusOf,
    describeMenuSelectionState,
    menuIdsFromSelection,
    menuLabel,
    type ProfileView,
    submenusOf,
    withMenuDefaults,
    withoutMenu,
} from './accessProfilesModel'
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

export type AccessProfileFormMode = { mode: 'create' } | { mode: 'edit'; profile: ProfileView }

const TABS: readonly ModalTab[] = [
    {id: 'dados', label: 'Dados gerais'},
    {id: 'acessos', label: 'Acessos'},
]

export type AccessProfileFormDraft = {
    name: string
    description: string | null
    menuIds: string[]
}

export function AccessProfileFormDialog({
                                            form,
                                            isLoadingMenu,
                                            menuError,
                                            menuTree,
                                            onOpenChange,
                                            onSave,
                                        }: {
    form: AccessProfileFormMode | null
    isLoadingMenu: boolean
    menuError: string | null
    menuTree: readonly MenuTreeTypes[]
    onOpenChange: (open: boolean) => void
    onSave: (draft: AccessProfileFormDraft) => Promise<string | null>
}) {
    return (
        <Dialog.Root onOpenChange={onOpenChange} open={form !== null}>
            <Dialog.Portal>
                <Dialog.Overlay className={modalOverlayClass}/>
                <Dialog.Content className={`${modalShellClass} ${formModalClass}`}>
                    {form ? (
                        <FormBody
                            form={form}
                            isLoadingMenu={isLoadingMenu}
                            key={form.mode === 'edit' ? form.profile.id : DRAFT_PROFILE_ID}
                            menuError={menuError}
                            menuTree={menuTree}
                            onClose={() => onOpenChange(false)}
                            onSave={onSave}
                        />
                    ) : null}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

function FormBody({
                      form,
                      isLoadingMenu,
                      menuError,
                      menuTree,
                      onClose,
                      onSave,
                  }: {
    form: AccessProfileFormMode
    isLoadingMenu: boolean
    menuError: string | null
    menuTree: readonly MenuTreeTypes[]
    onClose: () => void
    onSave: (draft: AccessProfileFormDraft) => Promise<string | null>
}) {
    const baseId = useId()
    const [activeTab, setActiveTab] = useState<string>(TABS[0].id)
    const isEditing = form.mode === 'edit'

    const [name, setName] = useState(isEditing ? form.profile.name : '')
    const [description, setDescription] = useState(isEditing ? form.profile.description : '')
    const [formError, setFormError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const menuRoots = useMemo(() => byPosition(menuTree), [menuTree])

    const [selected, setSelected] = useState<ReadonlySet<string>>(() =>
        isEditing ? new Set(form.profile.grantedMenuIds) : new Set<string>(),
    )

    const menuIds = useMemo(() => menuIdsFromSelection(menuRoots, selected), [menuRoots, selected])

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

    function toggleMenu(id: string, granted: boolean) {
        setSelected((current) => {
            const next = new Set(current)

            if (granted) next.add(id)
            else next.delete(id)

            return next
        })

        setFormError(null)
    }

    function applyMenuDefaults(root: MenuTreeTypes) {
        setSelected((current) => withMenuDefaults(current, root))
        setFormError(null)
    }

    function clearMenu(root: MenuTreeTypes) {
        setSelected((current) => withoutMenu(current, root))
        setFormError(null)
    }

    const missingRequirement =
        name.trim() === ''
            ? 'Informe o nome do Perfil de Acesso.'
            : menuIds.length === 0
                ? 'Selecione ao menos um menu disponível em Acessos.'
                : null

    async function handleSave() {
        if (missingRequirement) {
            setFormError(missingRequirement)
            return
        }

        if (isSaving) return

        setIsSaving(true)
        try {
            const error = await onSave({
                name: name.trim(),
                description: description.trim() === '' ? null : description.trim(),
                menuIds,
            })

            setFormError(error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <div className="flex flex-none items-center justify-between gap-3 px-5 pb-2 pt-4">
                <div className="min-w-0">
                    <Dialog.Title className="text-[16px] font-bold leading-tight text-[var(--text-heading)]">
                        {isEditing ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-0.5 truncate text-[11.5px] text-[var(--settings-faint)]">
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
                            menuRoots={menuRoots}
                            onApplyMenuDefaults={applyMenuDefaults}
                            onClearMenu={clearMenu}
                            onToggleMenu={toggleMenu}
                            selected={selected}
                        />
                    </ModalTabPanel>
                ) : null}
            </div>
            <div
                className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] bg-[var(--settings-tint)] px-5 py-2.5">
                <span className="min-w-0 text-[11.5px] leading-4 text-[var(--settings-muted)]">
                    {(formError ?? emptyReason) ? (
                        <span className="font-medium text-[var(--settings-danger)]" role="alert">
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
                    maxLength={255}
                    onChange={(event) => onNameChange(event.target.value)}
                    placeholder="Ex.: Comercial"
                    type="text"
                    value={name}
                />
            </div>
            <div>
                <label className={fieldLabelClass} htmlFor={descriptionId}>
                    Descrição <span className="font-normal text-[var(--settings-muted)]">(opcional)</span>
                </label>
                <textarea
                    className={`${fieldClass} min-h-[84px] resize-none`}
                    id={descriptionId}
                    maxLength={255}
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
                       menuRoots,
                       onApplyMenuDefaults,
                       onClearMenu,
                       onToggleMenu,
                       selected,
                   }: {
    emptyReason: string | null
    isLoading: boolean
    menuRoots: readonly MenuTreeTypes[]
    onApplyMenuDefaults: (root: MenuTreeTypes) => void
    onClearMenu: (root: MenuTreeTypes) => void
    onToggleMenu: (id: string, granted: boolean) => void
    selected: ReadonlySet<string>
}) {
    if (isLoading) {
        return (
            <div>
                <div className={sectionTitleClass}>Departamentos e páginas</div>
                <p className="mt-2 text-[12.5px] leading-5 text-[var(--settings-muted)]">Lendo os menus do serviço…</p>
            </div>
        )
    }

    if (menuRoots.length === 0) {
        return (
            <div>
                <div className={sectionTitleClass}>Departamentos e páginas</div>
                <p className="mt-2 text-[12.5px] leading-5 text-[var(--settings-danger)]" role="alert">
                    {emptyReason ?? 'Nenhum menu de acesso disponível.'}
                </p>
            </div>
        )
    }

    return (
        <div>
            <div className={sectionTitleClass}>Departamentos e páginas</div>
            <ul className="mt-2 grid gap-1.5">
                {menuRoots.map((root) => {
                    const submenus = submenusOf(root)
                    const total = submenus.length
                    const granted = submenus.filter((child) => selected.has(child.id)).length
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
                                    selected={selected}
                                />
                                {total === 0 ? (
                                    <SelectionCheckbox
                                        checked={selected.has(root.id)}
                                        label={`Conceder ${label} (sem submenus cadastrados)`}
                                        onCheckedChange={(checked) => onToggleMenu(root.id, checked)}
                                    />
                                ) : (
                                    <ul>
                                        {submenus.map((child) => (
                                            <li key={child.id}>
                                                <SelectionCheckbox
                                                    checked={selected.has(child.id)}
                                                    label={menuLabel(child)}
                                                    onCheckedChange={(checked) => onToggleMenu(child.id, checked)}
                                                />
                                            </li>
                                        ))}
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
                                  selected,
                              }: {
    onApplyDefault: () => void
    onClear: () => void
    root: MenuTreeTypes
    selected: ReadonlySet<string>
}) {
    if (defaultSubmenusOf(root).length === 0) return null

    const state = describeMenuSelectionState(root, selected)
    const checked = state === 'complete' ? 'true' : state === 'partial' ? 'mixed' : 'false'

    const stateLabel =
        state === 'complete'
            ? 'Páginas padrão selecionadas'
            : state === 'partial'
                ? 'Seleção parcial'
                : 'Nenhuma página selecionada'

    return (
        <div
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--divider)] pb-1.5 pt-0.5">
            <button
                aria-checked={checked}
                aria-label={`Selecionar páginas padrão de ${menuLabel(root)}`}
                className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-[12.5px] font-medium text-[var(--text-item)] transition hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
                onClick={() => (state === 'complete' ? onClear() : onApplyDefault())}
                role="checkbox"
                type="button"
            >
                <span
                    className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border ${
                        state === 'empty'
                            ? 'border-[var(--border)] bg-[var(--surface)]'
                            : 'border-[var(--accent)] bg-[var(--accent)] text-[var(--settings-on-accent)]'
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
            <span className="text-[11px] leading-4 text-[var(--settings-faint)]">{stateLabel}</span>
        </div>
    )
}
