import * as Dialog from '@radix-ui/react-dialog'
import {ChevronRight, LayoutGrid, List, Pencil, Plus, Trash2} from 'lucide-react'
import {type ReactNode, useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '../../components/ui/button'
import {SessionToast} from '../../components/ui/SessionToast'
/*import {profileColorClasses} from '../../lib/profileColors'*/
import {
    type AccessProfilesView,
    readStoredAccessProfilesView,
    writeStoredAccessProfilesView,
} from '../../services/preferences/accessProfilesViewStorage'
import {AccessProfileDetailsModal} from './AccessProfileDetail'
import {AccessProfileFormDialog, type AccessProfileFormMode,} from './AccessProfileFormDialog'
import {
    type AccessProfilesPreviewModel,
    buildAccessProfilesPreviewModel,
    describeAccessProfileDeletionImpact,
    type PreviewProfile,
} from './accessProfilesPreviewModel'
/*import {AssignAccessProfileModal} from './AssignAccessProfileModal'*/
/*import {chipClass, countClass, SummaryStat, UserAvatar} from './accessProfilesUi'*/
import {countClass, SummaryStat} from './accessProfilesUi'
import {CoverageTooltipProvider} from './CoverageTooltipProvider'
import {DepartmentCoverageChip} from './DepartmentCoverageChip'
import {accessProfileService,} from '../../services/accessProfiles/accessProfileService'
import {userService} from "../../services/users/userService";
import {AccessProfileTypes, CreateAccessProfileTypes} from "../../types/accessProfile/accessProfileTypes";
import {UserTypes} from "../../types/user/userTypes";

export function AccessProfiles() {

    const [accessProfiles, setAccessProfiles] = useState<AccessProfileTypes[]>([])
    const [users, setUsers] = useState<UserTypes[]>([])

    const [feedback, setFeedback] = useState<string | null>(null)

    const [saveToast, setSaveToast] = useState<{ description: string; title: string } | null>(null)

    const dismissSaveToast = useCallback(() => setSaveToast(null), [])

    const [loading, setLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [deleteTarget, setDeleteTarget] = useState<PreviewProfile | null>(null)

    const [deleteError, setDeleteError] = useState<string | null>(null)

    /*const [assignTarget, setAssignTarget] = useState<UserTypes | null>(null)*/

    const [view, setView] = useState<AccessProfilesView>(() => readStoredAccessProfilesView())
    const [detailProfileId, setDetailProfileId] = useState<string | null>(null)
    const [form, setForm] = useState<AccessProfileFormMode | null>(null)

    const preview = useMemo(
        () =>
            buildAccessProfilesPreviewModel({
                profiles: accessProfiles,
                users,
            }),
        [accessProfiles, users],
    )

    const detailProfile = resolveProfile(preview, detailProfileId)

    const detailOpen = detailProfile !== null && form === null

    function openCreateForm() {
        setFeedback(null)
        setSaveToast(null)
        setForm({mode: 'create'})
    }

    useEffect(() => {
        if (loading) return

        async function readCollections() {
            try {
                setLoading(true)
                setError(null)

                const [profiles, loadedUsers] = await Promise.all([
                    accessProfileService.listAccessProfiles(),

                    userService.getUsersList(),

                ])

                setAccessProfiles(profiles.list || [])
                setUsers(loadedUsers.list || [])

            } catch (err) {
                console.log(err)
                setError("Erro ao carregar os perfis")
            } finally {
                setLoading(false)
            }
        }

        void readCollections
    }, []);

    async function handleSaveForm(payload: CreateAccessProfileTypes) {
        if (form === null) return null

        const isEditing = form.mode === 'edit'

        const result =
            form.mode === 'edit'
                ? await accessProfileService.updateAccessProfile(form.profile.id, {...payload})
                : await accessProfileService.createAccessProfile({...payload})

        setForm(null)
        setDetailProfileId(null)

        setSaveToast(
            isEditing
                ? {
                    title: 'Perfil de acesso atualizado com sucesso',
                    description: `As alterações de ${result.name} foram gravadas.`,
                }
                : {
                    title: 'Perfil de acesso cadastrado com sucesso',
                    description: `${result.name} já está na lista de perfis de acesso.`,
                },
        )

        return null
    }

    function changeView(next: AccessProfilesView) {
        setView(next)
        writeStoredAccessProfilesView(next)
    }

    function openEditForm(profile: PreviewProfile | null) {
        if (profile === null) return

        setFeedback(null)
        setSaveToast(null)
        setForm({mode: 'edit', profile})
    }

    function openDeleteDialog(profile: PreviewProfile) {
        setFeedback(null)
        setSaveToast(null)
        setDeleteError(null)
        setDeleteTarget(profile)
    }

    function closeDeleteDialog() {
        setDeleteTarget(null)
        setDeleteError(null)
    }

    async function confirmDelete() {
        if (deleteTarget === null) return

        const payload = await accessProfileService.deleteAccessProfile(deleteTarget.id)

        if (detailProfileId === deleteTarget.id) setDetailProfileId(null)

        setDeleteTarget(null)
        setDeleteError(null)
        setFeedback(`${payload} foi excluído com sucesso.`)
    }

    /*const assignOptions = useMemo(
        () =>
            assignTarget === null
                ? []
                : assignableProfiles(preview.profiles),
        [assignTarget, preview.profiles],
    )*/

    /*function openAssignDialog(user: UserTypes) {
        setFeedback(null)
        setSaveToast(null)
        setAssignTarget(user)
    }*/

    /*async function handleAssign() {
        if (assignTarget === null) return null

        const result = await accessProfileService.createUserAccessProfile({accessId: accessId, profileMenuId: profileMenuId})

        setAssignTarget(null)
        setFeedback(`${result} agora usa o Perfil de Acesso ${result}.`)

        return null
    }*/

    function closeForm() {

        if (form?.mode === 'create') setDetailProfileId(null)

        setForm(null)
    }

    return (

        <CoverageTooltipProvider>
            <div className="grid gap-5">

                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef0f4] pb-4">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-[#172033]">Perfis de acesso</h2>
                        <p className="mt-1 text-[13px] text-[#667085]">
                            Controle quais áreas e páginas cada grupo de usuários pode visualizar.
                        </p>
                    </div>

                    <Button onClick={openCreateForm} size="sm">
                        <Plus aria-hidden="true" size={15}/>
                        Novo perfil
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

                <ProfilesSection
                    failure={null}
                    onDeleteProfile={openDeleteDialog}
                    onEditProfile={openEditForm}
                    onOpenDetail={setDetailProfileId}
                    onViewChange={changeView}
                    preview={preview}
                    view={view}
                />

                {/*<UnassignedSection onAssign={openAssignDialog} users={preview.unassignedUsers}/>*/}

                <AccessProfileDetailsModal
                    onEdit={() => openEditForm(detailProfile)}
                    onOpenChange={(open) => {
                        if (!open) setDetailProfileId(null)
                    }}
                    open={detailOpen}
                    profile={detailProfile}
                />

                <DeleteProfileDialog
                    error={deleteError}
                    onCancel={closeDeleteDialog}
                    onConfirm={confirmDelete}
                    profile={deleteTarget}
                />

                {/* <AssignAccessProfileModal
                    onOpenChange={(open) => {

                        if (!open) setAssignTarget(null)
                    }}
                    onSubmit={handleAssign}
                    options={assignOptions}
                    user={assignTarget}
                />*/}

                <AccessProfileFormDialog
                    form={form}
                    onOpenChange={(open) => {
                        if (!open) closeForm()
                    }}
                    onSave={handleSaveForm}
                />

                {saveToast ? (
                    <SessionToast
                        description={saveToast.description}
                        onDismiss={dismissSaveToast}
                        title={saveToast.title}
                    />
                ) : null}
            </div>
        </CoverageTooltipProvider>
    )
}

function resolveProfile(
    preview: AccessProfilesPreviewModel,
    profileId: string | null,
): PreviewProfile | null {
    if (profileId === null) return null

    return preview.orderedProfiles.find((profile) => profile.id === profileId) ?? null
}

function ProfileDepartments({
                                departments,
                            }: {
    departments: PreviewProfile['departments']
}) {
    if (departments.length === 0) {
        return <p className="text-[11.5px] leading-4 text-[#98a2b3]">Nenhum departamento concedido</p>
    }

    return (

        <div className="flex flex-wrap gap-1">
            {departments.map((department) => (
                <DepartmentCoverageChip
                    coverage={department.coverage}
                    key={department.departmentId}
                    label={department.label}
                    pages={department.catalogPages}
                />
            ))}
        </div>
    )
}

function ProfileIdentity({profile}: { profile: PreviewProfile }) {
    return (
        <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
        <span className="break-words text-[13px] font-semibold leading-[1.35] text-[#172033]">
          {profile.name}
        </span>
            </div>
            <p className="mt-0.5 text-[11.5px] leading-4 text-[#667085]">
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
            ? 'text-[#98a2b3] hover:bg-[#fdf3f3] hover:text-[#b42318] focus-visible:ring-[#e5484d] focus-visible:text-[#b42318]'
            : 'text-[#98a2b3] hover:bg-[#eef2f8] hover:text-[#344054] focus-visible:ring-[var(--accent)] focus-visible:text-[#344054]'

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
            className="inline-flex cursor-pointer items-center gap-1 rounded-md text-[11.5px] font-semibold leading-[1.45] text-[#2563eb] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
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
    profile: PreviewProfile
    view: AccessProfilesView
}) {
    const className = "rounded-xl border bg-[#f7f8fa] px-3.5 py-3 text-left transition border-[#eaecf2]"

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
                <ProfileDepartments departments={profile.departments}/>

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
            <ProfileDepartments departments={profile.departments}/>

            <div className="grid gap-1.5 md:pt-0.5">
                {actions ? <div className="flex justify-end">{actions}</div> : null}
                <div className="flex justify-end">
                    <DetailsAction onOpenDetail={onOpenDetail} profileName={profile.name}/>
                </div>
            </div>
        </div>
    )
}

function ProfilesSection({
                             failure,
                             onDeleteProfile,
                             onEditProfile,
                             onOpenDetail,
                             onViewChange,
                             preview,
                             view,
                         }: {

    failure: string | null
    onDeleteProfile: (profile: PreviewProfile) => void
    onEditProfile: (profile: PreviewProfile) => void
    onOpenDetail: (profileId: string) => void
    onViewChange: (view: AccessProfilesView) => void
    preview: AccessProfilesPreviewModel
    view: AccessProfilesView
}) {
    const {orderedProfiles} = preview

    return (

        <section aria-label="Perfis de Acesso" className="grid gap-3">

            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="flex flex-wrap gap-x-7 gap-y-3">
                    <SummaryStat
                        label="Perfis de acesso"
                        value={preview.totalProfileCount}
                        valueClassName="text-[#101828]"
                    />
                    <SummaryStat
                        label="Usuários correspondentes"
                        value={preview.totalMatchedUserCount}
                        valueClassName="text-[#16a34a]"
                    />
                </div>
                <ViewToggle onViewChange={onViewChange} view={view}/>
            </div>

            {failure ? (
                <CollectionFailurePanel message={failure}/>
            ) : orderedProfiles.length === 0 ? (
                <div className="rounded-xl border border-[#eaecf2] bg-white px-4 py-4">
                    <h3 className="text-[13.5px] font-semibold text-[#172033]">Nenhum Perfil de Acesso</h3>
                    <p className="mt-1 text-[12.5px] leading-5 text-[#667085]">
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
                    {orderedProfiles.map((profile) => (
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
        <div className="rounded-xl border border-[#f3d9a5] bg-[#fffaf0] px-4 py-4">
            <h3 className="text-[13.5px] font-semibold text-[#7a5a12]">
                Não foi possível ler os Perfis de Acesso
            </h3>
            <p className="mt-1 text-[12.5px] leading-5 text-[#8a6a2a]">{message}</p>
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
    const activeClass = 'bg-white text-[var(--accent)] shadow-[0_1px_2px_rgba(16,24,40,.08)]'
    const inactiveClass = 'text-[#667085] hover:bg-white hover:text-[#344054]'

    return (
        <div className="flex flex-none items-center gap-1 rounded-lg border border-[#eaecf2] bg-[#f6f8fb] p-1">
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
                                 error,
                                 onCancel,
                                 onConfirm,
                                 profile,
                             }: {
    error: string | null
    onCancel: () => void
    onConfirm: () => void
    profile: PreviewProfile | null
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
                    className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                    <Dialog.Title className="text-base font-bold text-[#101828]">
                        {hasUsers
                            ? 'Este Perfil de Acesso ainda não pode ser excluído'
                            : 'Excluir Perfil de Acesso?'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                        {profile === null
                            ? ''
                            : hasUsers
                                ? `O perfil “${profile.name}” continua como está.`
                                : `O perfil “${profile.name}” será excluído do portal.`}
                    </Dialog.Description>
                    {profile === null ? null : (
                        <p className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                            {describeAccessProfileDeletionImpact(profile.userCount)}
                        </p>
                    )}
                    {error ? (
                        <p
                            className="mt-3 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3 py-2 text-[12.5px] font-medium leading-5 text-[#b42318]"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : null}
                    <div className="mt-5 flex justify-end gap-2.5">
                        <Button onClick={onCancel} variant={hasUsers ? 'primary' : 'secondary'}>
                            {hasUsers ? 'Fechar' : 'Cancelar'}
                        </Button>
                        {hasUsers ? null : (
                            <Button
                                className="bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[#e5484d]"
                                onClick={onConfirm}
                            >
                                <Trash2 aria-hidden="true" size={15}/>
                                Excluir perfil
                            </Button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

/*function UnassignedSection({
                               onAssign,
                               users,
                           }: {
    onAssign: (user: UserTypes) => void
    users: UserTypes[]
}) {
    if (users.length === 0) return null

    return (
        <section aria-labelledby="unassigned-title" className="grid gap-2">

            <h3 className="text-[14px] font-semibold text-[#172033]" id="unassigned-title">
                Usuários sem perfil de acesso definido
            </h3>
            <p className="text-[12px] leading-4 text-[#667085]">
                Estes usuários não possuem um vínculo válido com os Perfis de Acesso exibidos e não
                conseguem entrar no portal até receberem um.
            </p>

            <ul className="divide-y divide-[#f2f4f8] overflow-hidden rounded-xl border border-[#eaecf2] bg-white">
                {users.map((user) => (
                    <li
                        className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                        key={user.id}
                    >
            <span className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar initials={user.name.slice(0, 2)} profile={user.profileType}/>
                      <span className="min-w-0">
                            <span className="block break-words text-[12.5px] font-medium text-[#172033]">
                              {user.name}
                            </span>

                            <span className="mt-0.5 block break-all text-[11.5px] leading-4 text-[#667085]">
                              {user.email}
                            </span>
                      </span>
            </span>

                        <span
                            className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1.5 justify-self-start sm:justify-self-end">
              <span className={`${chipClass} flex-none ${profileColorClasses[user.profileType.code]}`}>
                {user.profileType.name}
              </span>
              <AssignAction onAssign={() => onAssign(user)} userName={user.name}/>
            </span>
                    </li>
                ))}
            </ul>
        </section>
    )
}*/

/*function AssignAction({
                          onAssign,
                          userName,
                      }: {
    onAssign: () => void
    userName: string
}) {
    return (
        <button
            aria-label={`Definir perfil de acesso de ${userName}`}
            className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-md text-[11.5px] font-semibold leading-[1.45] text-[#2563eb] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            onClick={onAssign}
            type="button"
        >
            Definir perfil
            <ChevronRight aria-hidden="true" size={14}/>
        </button>
    )
}*/
