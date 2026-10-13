import * as Dialog from '@radix-ui/react-dialog'
import {ChevronRight, LayoutGrid, List, Pencil, Plus, Trash2} from 'lucide-react'
import {type ReactNode, useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '../../components/ui/button'
import {SessionToast, type SessionToastVariant} from '../../components/ui/SessionToast'
import {accessProfileService} from '../../services/accessProfiles/accessProfileService'
import {menuService} from '../../services/menu/menuService'
import {
    type AccessProfilesView,
    readStoredAccessProfilesView,
    writeStoredAccessProfilesView,
} from '../../services/preferences/accessProfilesViewStorage'
import {userService} from '../../services/users/userService'
import {ApiError} from '../../services/apiService'
import type {MenuTreeTypes} from '../../types/menu/menuTypes'
import type {AccessProfileTypes} from '../../types/accessProfile/accessProfileTypes'
import type {UserTypes} from '../../types/user/userTypes'
import {AccessProfileDetailsModal} from './AccessProfileDetail'
import {
    AccessProfileFormDialog,
    type AccessProfileFormDraft,
    type AccessProfileFormMode,
} from './AccessProfileFormDialog'
import {
    type AccessProfilesModel,
    buildAccessProfilesModel,
    describeAccessProfileDeletionImpact,
    type ProfileView,
} from './accessProfilesModel'
import {countClass, SummaryStat} from './accessProfilesUi'
import {CoverageTooltipProvider} from './CoverageTooltipProvider'
import {DepartmentCoverageChip} from './DepartmentCoverageChip'

type ProfileToast = { title: string; description: string; variant: SessionToastVariant }

function failureMessage(cause: unknown, fallback: string): string {
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
        const message = cause.message.trim()

        if (message !== '') return message
    }

    return fallback
}

export function AccessProfiles() {
    const [accessProfiles, setAccessProfiles] = useState<AccessProfileTypes[]>([])
    const [users, setUsers] = useState<UserTypes[]>([])
    const [menuTree, setMenuTree] = useState<MenuTreeTypes[]>([])

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [menuError, setMenuError] = useState<string | null>(null)

    const [toast, setToast] = useState<ProfileToast | null>(null)
    const dismissToast = useCallback(() => setToast(null), [])

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    const [view, setView] = useState<AccessProfilesView>(() => readStoredAccessProfilesView())
    const [detailProfileId, setDetailProfileId] = useState<string | null>(null)
    const [form, setForm] = useState<AccessProfileFormMode | null>(null)

    const model = useMemo(
        () => buildAccessProfilesModel({profiles: accessProfiles, users, menuTree}),
        [accessProfiles, menuTree, users],
    )

    const detailProfile = resolveProfile(model, detailProfileId)
    const detailOpen = detailProfile !== null && form === null
    const deleteTarget = resolveProfile(model, deleteTargetId)

    useEffect(() => {
        let active = true

        async function readCollections() {
            try {
                setLoading(true)
                setError(null)
                setMenuError(null)

                const [profiles, loadedUsers, tree] = await Promise.all([
                    accessProfileService.listAccessProfiles(),
                    userService.getUsersList(),
                    menuService.getMenuTree(),
                ])

                if (!active) return

                setAccessProfiles(profiles.list ?? [])
                setUsers(loadedUsers.list ?? [])
                setMenuTree(tree ?? [])
            } catch (err) {
                console.error('Erro ao carregar os perfis de acesso', err)

                if (!active) return

                setError('Não foi possível ler os Perfis de Acesso. Tente novamente.')
                setMenuError('Não foi possível ler os menus do serviço.')
            } finally {
                if (active) setLoading(false)
            }
        }

        void readCollections()

        return () => {
            active = false
        }
    }, [])

    const refreshProfiles = useCallback(async () => {
        const refreshed = await accessProfileService.listAccessProfiles()

        setAccessProfiles(refreshed.list ?? [])
    }, [])

    function openCreateForm() {
        setToast(null)
        setForm({mode: 'create'})
    }

    function openEditForm(profile: ProfileView | null) {
        if (profile === null) return

        setToast(null)
        setForm({mode: 'edit', profile})
    }

    function closeForm() {
        if (form?.mode === 'create') setDetailProfileId(null)

        setForm(null)
    }

    async function handleSaveForm(draft: AccessProfileFormDraft): Promise<string | null> {
        if (form === null) return null

        const isEditing = form.mode === 'edit'

        try {
            const saved = isEditing
                ? await accessProfileService.updateAccessProfile(form.profile.id, {
                    name: draft.name,
                    description: draft.description,
                    menuIds: draft.menuIds,
                })
                : await accessProfileService.createAccessProfile({
                    name: draft.name,
                    description: draft.description,
                    menuIds: draft.menuIds,
                })

            setForm(null)

            if (!isEditing) setDetailProfileId(null)

            await refreshProfiles()

            setToast(
                isEditing
                    ? {
                        variant: 'success',
                        title: 'Perfil de acesso atualizado com sucesso',
                        description: `As alterações de ${saved.name} foram gravadas.`,
                    }
                    : {
                        variant: 'success',
                        title: 'Perfil de acesso cadastrado com sucesso',
                        description: `${saved.name} já está na lista de perfis de acesso.`,
                    },
            )

            return null
        } catch (err) {
            console.error('Erro ao gravar o perfil de acesso', err)

            const message = failureMessage(
                err,
                isEditing
                    ? 'Não foi possível atualizar o perfil de acesso. Tente novamente.'
                    : 'Não foi possível cadastrar o perfil de acesso. Tente novamente.',
            )

            setToast({
                variant: 'alert',
                title: isEditing ? 'Erro ao atualizar perfil' : 'Erro ao cadastrar perfil',
                description: message,
            })

            return message
        }
    }

    function changeView(next: AccessProfilesView) {
        setView(next)
        writeStoredAccessProfilesView(next)
    }

    function openDeleteDialog(profile: ProfileView) {
        setToast(null)
        setDeleteError(null)
        setDeleteTargetId(profile.id)
    }

    function closeDeleteDialog() {
        if (deleting) return

        setDeleteTargetId(null)
        setDeleteError(null)
    }

    async function confirmDelete() {
        if (deleteTarget === null || deleting) return

        const target = deleteTarget

        setDeleting(true)
        try {
            await accessProfileService.deleteAccessProfile(target.id)

            if (detailProfileId === target.id) setDetailProfileId(null)

            setDeleteTargetId(null)
            setDeleteError(null)

            await refreshProfiles()

            setToast({
                variant: 'success',
                title: 'Perfil de acesso excluído',
                description: `${target.name} saiu da lista de perfis de acesso.`,
            })
        } catch (err) {
            console.error('Erro ao excluir o perfil de acesso', err)

            setDeleteError(
                failureMessage(err, 'Não foi possível excluir o perfil de acesso. Tente novamente.'),
            )

            await refreshProfiles().catch(() => undefined)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <CoverageTooltipProvider>
            <div className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--divider)] pb-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-[var(--text-heading)]">Perfis de acesso</h2>
                        <p className="mt-1 text-[13px] text-[var(--settings-muted)]">
                            Controle quais áreas e páginas cada grupo de usuários pode visualizar.
                        </p>
                    </div>

                    <Button onClick={openCreateForm} size="sm">
                        <Plus aria-hidden="true" size={15}/>
                        Novo perfil
                    </Button>
                </div>

                <ProfilesSection
                    failure={error}
                    loading={loading}
                    model={model}
                    onDeleteProfile={openDeleteDialog}
                    onEditProfile={openEditForm}
                    onOpenDetail={setDetailProfileId}
                    onViewChange={changeView}
                    view={view}
                />

                <AccessProfileDetailsModal
                    onEdit={() => openEditForm(detailProfile)}
                    onOpenChange={(open) => {
                        if (!open) setDetailProfileId(null)
                    }}
                    open={detailOpen}
                    profile={detailProfile}
                />

                <DeleteProfileDialog
                    deleting={deleting}
                    error={deleteError}
                    onCancel={closeDeleteDialog}
                    onConfirm={confirmDelete}
                    profile={deleteTarget}
                />

                <AccessProfileFormDialog
                    form={form}
                    isLoadingMenu={loading}
                    menuError={menuError}
                    menuTree={menuTree}
                    onOpenChange={(open) => {
                        if (!open) closeForm()
                    }}
                    onSave={handleSaveForm}
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
        </CoverageTooltipProvider>
    )
}

function resolveProfile(model: AccessProfilesModel, profileId: string | null): ProfileView | null {
    if (profileId === null) return null

    return model.profiles.find((profile) => profile.id === profileId) ?? null
}

function ProfileGroups({groups}: { groups: ProfileView['groups'] }) {
    if (groups.length === 0) {
        return <p className="text-[11.5px] leading-4 text-[var(--settings-faint)]">Nenhum departamento concedido</p>
    }

    return (
        <div className="flex flex-wrap gap-1">
            {groups.map((group) => (
                <DepartmentCoverageChip
                    coverage={group.coverage}
                    key={group.id}
                    label={group.label}
                    pages={group.pages}
                />
            ))}
        </div>
    )
}

function ProfileIdentity({profile}: { profile: ProfileView }) {
    return (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="break-words text-[13px] font-semibold leading-[1.35] text-[var(--text-heading)]">
                    {profile.name}
                </span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-4 text-[var(--settings-muted)]">
                <span className={countClass}>{profile.userCount}</span>{' '}
                {profile.userCount === 1 ? 'usuário' : 'usuários'}
            </p>
        </div>
    )
}

function CardActionButton({
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
            ? 'text-[var(--settings-faint)] hover:bg-[var(--settings-danger-bg)] hover:text-[var(--settings-danger)] focus-visible:ring-[var(--settings-danger)] focus-visible:text-[var(--settings-danger)]'
            : 'text-[var(--settings-faint)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-item)] focus-visible:ring-[var(--accent)] focus-visible:text-[var(--text-item)]'

    return (
        <button
            aria-label={label}
            className={`flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 ${toneClass}`}
            onClick={onClick}
            title={label}
            type="button"
        >
            {icon}
        </button>
    )
}

function ProfileCardActions({
                                onDelete,
                                onEdit,
                                profileName,
                            }: {
    onDelete: () => void
    onEdit: () => void
    profileName: string
}) {
    return (
        <div className="flex flex-none items-center gap-0.5">
            <CardActionButton
                icon={<Pencil aria-hidden="true" size={13}/>}
                label={`Editar perfil ${profileName}`}
                onClick={onEdit}
                tone="neutral"
            />
            <CardActionButton
                icon={<Trash2 aria-hidden="true" size={13}/>}
                label={`Excluir perfil ${profileName}`}
                onClick={onDelete}
                tone="destructive"
            />
        </div>
    )
}

function DetailsAction({
                           onOpenDetail,
                           profileName,
                       }: {
    onOpenDetail: () => void
    profileName: string
}) {
    return (
        <button
            aria-label={`Ver detalhes de ${profileName}`}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md text-[11.5px] font-semibold leading-[1.45] text-[var(--accent)] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            onClick={onOpenDetail}
            type="button"
        >
            Ver detalhes
            <ChevronRight aria-hidden="true" size={14}/>
        </button>
    )
}

function ProfileCard({
                         onDelete,
                         onEdit,
                         onOpenDetail,
                         profile,
                         view,
                     }: {
    onDelete: () => void
    onEdit: () => void
    onOpenDetail: () => void
    profile: ProfileView
    view: AccessProfilesView
}) {
    const className = 'rounded-xl border bg-[var(--settings-tint)] px-3.5 py-3 text-left transition border-[var(--border)]'

    const actions = (
        <ProfileCardActions onDelete={onDelete} onEdit={onEdit} profileName={profile.name}/>
    )

    if (view === 'grid') {
        return (
            <div className={`${className} grid gap-2`}>
                <div className="flex items-start justify-between gap-2">
                    <ProfileIdentity profile={profile}/>
                    {actions}
                </div>
                <ProfileGroups groups={profile.groups}/>

                <div className="flex justify-end">
                    <DetailsAction onOpenDetail={onOpenDetail} profileName={profile.name}/>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`${className} grid items-start gap-x-4 gap-y-2 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]`}
        >
            <ProfileIdentity profile={profile}/>
            <ProfileGroups groups={profile.groups}/>

            <div className="grid gap-1.5 md:pt-0.5">
                <div className="flex justify-end">{actions}</div>
                <div className="flex justify-end">
                    <DetailsAction onOpenDetail={onOpenDetail} profileName={profile.name}/>
                </div>
            </div>
        </div>
    )
}

function ProfilesSection({
                             failure,
                             loading,
                             model,
                             onDeleteProfile,
                             onEditProfile,
                             onOpenDetail,
                             onViewChange,
                             view,
                         }: {
    failure: string | null
    loading: boolean
    model: AccessProfilesModel
    onDeleteProfile: (profile: ProfileView) => void
    onEditProfile: (profile: ProfileView) => void
    onOpenDetail: (profileId: string) => void
    onViewChange: (view: AccessProfilesView) => void
    view: AccessProfilesView
}) {
    const {profiles} = model

    return (
        <section aria-label="Perfis de Acesso" className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="flex flex-wrap gap-x-7 gap-y-3">
                    <SummaryStat
                        label="Perfis de acesso"
                        value={model.profileCount}
                        valueClassName="text-[var(--text-heading)]"
                    />
                    <SummaryStat
                        label="Usuários vinculados"
                        value={model.matchedUserCount}
                        valueClassName="text-[var(--settings-ok)]"
                    />
                    <SummaryStat
                        label="Sem perfil definido"
                        value={model.unassignedUserCount}
                        valueClassName="text-[var(--settings-warn)]"
                    />
                </div>
                <ViewToggle onViewChange={onViewChange} view={view}/>
            </div>

            {failure ? (
                <CollectionFailurePanel message={failure}/>
            ) : loading ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                    <p className="text-[12.5px] leading-5 text-[var(--settings-muted)]">
                        Lendo os Perfis de Acesso do serviço…
                    </p>
                </div>
            ) : profiles.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
                    <h3 className="text-[13.5px] font-semibold text-[var(--text-heading)]">Nenhum Perfil de Acesso</h3>
                    <p className="mt-1 text-[12.5px] leading-5 text-[var(--settings-muted)]">
                        A coleção de Perfis de Acesso deste portal está vazia.
                    </p>
                </div>
            ) : (
                <ul
                    className={
                        view === 'list'
                            ? 'grid items-start gap-2'
                            : 'grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3'
                    }
                >
                    {profiles.map((profile) => (
                        <li key={profile.id}>
                            <ProfileCard
                                onDelete={() => onDeleteProfile(profile)}
                                onEdit={() => onEditProfile(profile)}
                                onOpenDetail={() => onOpenDetail(profile.id)}
                                profile={profile}
                                view={view}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

function CollectionFailurePanel({message}: { message: string }) {
    return (
        <div className="rounded-xl border border-[var(--settings-warn-border)] bg-[var(--settings-warn-bg)] px-4 py-4">
            <h3 className="text-[13.5px] font-semibold text-[var(--settings-warn-text)]">
                Não foi possível ler os Perfis de Acesso
            </h3>
            <p className="mt-1 text-[12.5px] leading-5 text-[var(--settings-warn-text)]">{message}</p>
        </div>
    )
}

function ViewToggle({
                        onViewChange,
                        view,
                    }: {
    onViewChange: (view: AccessProfilesView) => void
    view: AccessProfilesView
}) {
    const buttonClass =
        'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
    const activeClass = 'bg-[var(--surface)] text-[var(--accent)] shadow-[0_1px_2px_rgba(16,24,40,.08)]'
    const inactiveClass = 'text-[var(--settings-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-item)]'

    return (
        <div className="flex flex-none items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--settings-tint)] p-1">
            <button
                aria-label="Ver em lista"
                aria-pressed={view === 'list'}
                className={`${buttonClass} ${view === 'list' ? activeClass : inactiveClass}`}
                onClick={() => onViewChange('list')}
                title="Ver em lista"
                type="button"
            >
                <List aria-hidden="true" size={16}/>
            </button>
            <button
                aria-label="Ver em grade"
                aria-pressed={view === 'grid'}
                className={`${buttonClass} ${view === 'grid' ? activeClass : inactiveClass}`}
                onClick={() => onViewChange('grid')}
                title="Ver em grade"
                type="button"
            >
                <LayoutGrid aria-hidden="true" size={16}/>
            </button>
        </div>
    )
}

function DeleteProfileDialog({
                                 deleting,
                                 error,
                                 onCancel,
                                 onConfirm,
                                 profile,
                             }: {
    deleting: boolean
    error: string | null
    onCancel: () => void
    onConfirm: () => void
    profile: ProfileView | null
}) {
    const hasUsers = profile !== null && profile.userCount > 0

    return (
        <Dialog.Root
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onCancel()
            }}
            open={profile !== null}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 impacto-settings executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                    <Dialog.Title className="text-base font-bold text-[var(--text-heading)]">
                        {hasUsers
                            ? 'Este Perfil de Acesso ainda não pode ser excluído'
                            : 'Excluir Perfil de Acesso?'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                        {profile === null
                            ? ''
                            : hasUsers
                                ? `O perfil “${profile.name}” continua como está.`
                                : `O perfil “${profile.name}” será excluído do portal.`}
                    </Dialog.Description>
                    {profile === null ? null : (
                        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                            {describeAccessProfileDeletionImpact(profile.userCount)}
                        </p>
                    )}
                    {error ? (
                        <p
                            className="mt-3 rounded-lg border border-[var(--settings-danger-border)] bg-[var(--settings-danger-bg)] px-3 py-2 text-[12.5px] font-medium leading-5 text-[var(--settings-danger)]"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : null}
                    <div className="mt-5 flex justify-end gap-2.5">
                        <Button
                            disabled={deleting}
                            onClick={onCancel}
                            variant={hasUsers ? 'primary' : 'secondary'}
                        >
                            {hasUsers ? 'Fechar' : 'Cancelar'}
                        </Button>
                        {hasUsers ? null : (
                            <Button
                                className="bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[var(--settings-danger)]"
                                loading={deleting}
                                onClick={onConfirm}
                            >
                                {deleting ? null : <Trash2 aria-hidden="true" size={15}/>}
                                {deleting ? 'Excluindo...' : 'Excluir perfil'}
                            </Button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
