import {Check, Edit, KeyRound, Mail, MailPlus, Plus, Power} from 'lucide-react'
import type {InputHTMLAttributes, ReactNode} from 'react'
import {useEffect, useId, useMemo, useState} from 'react'

import {DataTable} from '../../components/dashboard/DataTable'
import {Button} from '../../components/ui/button'
import {SessionToast} from '../../components/ui/SessionToast'

import {ADMIN_USERS_WRITE_PERMISSION} from '../../config/permissions'
import {useAuth} from '../../contexts/useAuth'
import {firstAccessInviteState, type FirstAccessInviteState, hasDefinedPassword,} from '../../lib/firstAccessInvite'
import {formatLastAccess, formatUserStatus} from '../../lib/formatters'
import {isPasswordAccepted, passwordRequirements} from '../../lib/passwordPolicy'
import {profileColorClasses} from '../../lib/profileColors'
import {userStatusColorClasses} from '../../lib/userStatusColors'
import {RequiredMark,} from '../AccessProfiles/accessProfilesUi'
import {CoverageTooltipProvider} from '../AccessProfiles/CoverageTooltipProvider'
import {DepartmentCoverageChip} from '../AccessProfiles/DepartmentCoverageChip'
import {
    type AccessProfileOption,
    type AccessProfileSelectionFailureReason,
    UNPROFILED_ACCESS_LABEL,
} from './userAccessProfiles'
import {CreateUserTypes, UpdateUserTypes, UserPasswordTypes, UserStatus, UserTypes} from "../../types/user/userTypes";
import {userService} from "../../services/users/userService";
import {accessProfileService} from "../../services/accessProfiles/accessProfileService";
import {profileTypesService} from "../../services/profileTypes/profileTypesService";
import {AccessProfileTypes} from "../../types/accessProfile/accessProfileTypes";
import {ProfileTypesTypes, UserProfileTypesResponse} from "../../types/profileTypes/profileTypesType";

const PAGE_SIZE = 10

const lastAccessPattern = /^(\d{2})\/(\d{2})\/(\d{4}) \d{2}:\d{2}$/
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {weekday: 'long'})

function weekdayFromLastAccess(value: string): string | null {
    const parts = lastAccessPattern.exec(value)
    if (!parts) return null

    const [, day, month, year] = parts.map(Number)
    const date = new Date(year, month - 1, day)

    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null
    }

    const weekday = weekdayFormatter.format(date)

    return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

/*type UserFeedback = {
    type: 'success' | 'error'
    message: string
}*/

function useInviteClock(users: readonly UserTypes[]): Date {
    const [now, setNow] = useState(() => new Date())

    const pending = users.some((user) => firstAccessInviteState(user, now) === 'pending')

    useEffect(() => {
        if (!pending) return

        const timer = setInterval(() => setNow(new Date()), 30_000)

        return () => clearInterval(timer)
    }, [pending])

    return now
}

type modeState = { mode: 'create' } | { mode: 'edit'; user: UserTypes }

type PendingStatusChange = { user: UserTypes; action: 'deactivate' | 'reactivate' }


export function Users() {
    const {user: authenticatedUser, hasPermission} = useAuth()

    const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)

    const [users, setUsers] = useState<UserTypes[]>([])
    const [accessProfiles, setAccessProfiles] = useState<AccessProfileTypes[]>([])
    const [profileTypes, setProfileTypes] = useState<ProfileTypesTypes[]>([])

    const [page, setPage] = useState(0)
    const [mode, setMode] = useState<modeState | null>(null)
    const [statusTarget, setStatusTarget] = useState<PendingStatusChange | null>(null)

    /*const [feedback, setFeedback] = useState<UserFeedback | null>(null)*/

    const [resendingUserId, setResendingUserId] = useState<string | null>(null)
    const [firstAccessTarget, setFirstAccessTarget] = useState<UserTypes | null>(null)
    const [passwordTarget, setPasswordTarget] = useState<UserTypes | null>(null)

    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const [user, setUser] = useState<UserTypes | null>(null)

    const [savingUser, setSavingUser] = useState(false)

    const activeCount = users.filter((user) => user.status === 'active').length
    const pendingCount = users.filter((user) => user.status === 'pending').length

    const inactiveCount = users.length - activeCount - pendingCount

    const administratorCount = users.filter((user) => user.profileType?.code === 'adm').length
    const executiveCount = users.filter((user) => user.profileType?.code === 'executive').length
    const analystCount = users.filter((user) => user.profileType?.code === 'analyst').length
    const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
    const safePage = Math.min(page, totalPages - 1)
    const pageUsers = useMemo(
        () => users.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
        [safePage, users],
    )
    const now = useInviteClock(pageUsers)
    const from = users.length === 0 ? 0 : safePage * PAGE_SIZE + 1
    const to = Math.min(users.length, safePage * PAGE_SIZE + PAGE_SIZE)
    const headers = canManageUsers
        ? ['Usuário', 'Perfil do Sistema', 'Perfil de Acesso', 'Status', 'Último acesso', 'Ações']
        : ['Usuário', 'Perfil do Sistema', 'Perfil de Acesso', 'Status', 'Último acesso']
    const columnWidths = canManageUsers
        ? ['28%', '180px', undefined, '90px', '145px', '170px']
        : ['30%', '180px', undefined, '90px', '145px']

    useEffect(() => {

        async function loadUsers() {

            try {

                const [users, accessProfiles, profileTypes] = await Promise.all([

                    userService.getUsersList(),
                    accessProfileService.listAccessProfiles(),
                    profileTypesService.listProfileTypes(),

                ])

                setUsers(users.list || [])
                setAccessProfiles(accessProfiles.list || [])
                setProfileTypes(profileTypes.list || [])

            } catch (err) {
                console.error(err)
                setError("Erro ao carregar os dados")
            } finally {
                setLoading(false)
            }
        }

        void loadUsers()
    }, [])

    async function handleCreateUser(payload: CreateUserTypes) {
        if (!authenticatedUser) {
            return 'Sessão não identificada. Entre novamente para gerenciar usuários.'
        }

        try {
            setSavingUser(true)

            await userService.createUsers({...payload})

        } catch (err) {
            console.error("Erro ao cadadastrar o usuário", err)
        } finally {
            setSavingUser(false)
        }
    }

    async function handleUpdateUser(userId: string, payload: UpdateUserTypes) {
        if (!authenticatedUser) {
            return 'Sessão não identificada. Entre novamente para gerenciar usuários.'
        }

        try {
            setSavingUser(true)

            const updateUser = await userService.updateUser(userId, {...payload})

            setUser(updateUser)

        } catch (err) {
            console.error("Erro ao atualizar o usuário", err)

            return "Não foi possível atualizar o usuário. Tente novamente"

        } finally {
            setSavingUser(false)
        }
    }

    /*async function runStatusChange(
        target: UserTypes,
        operation: (id: string, actor: UserActionActor) => Promise<UserStatusChangeResult>,
        messages: { done: string; already: string },
    ) {
        if (!authenticatedUser) {
            setFeedback({type: 'error', message: 'Sessão não identificada. Entre novamente para gerenciar usuários.'})
            return
        }

        const result = await operation(target.id, {
            id: authenticatedUser.id,
            name: authenticatedUser.name,
        })

        if (!result.ok) {
            setFeedback({
                type: 'error',
                message:
                    result.reason === 'service-failure'
                        ? result.message
                        : statusChangeFailureMessages[result.reason],
            })
            return
        }

        if (result.changed) await refreshUsers()

        setFeedback({
            type: 'success',
            message: `${result.user.name} ${result.changed ? messages.done : messages.already}`,
        })
    }*/

    async function handleResendEmail(userId: string) {
        if (resendingUserId !== null) return

        setResendingUserId(userId)

        try {
            await userService.resendEmail(userId)

            const refreshed = await userService.getUserById(userId)
            setUsers((current) => current.map((item) => (item.id === refreshed.id ? refreshed : item)))

        } catch (err) {
            console.error("Erro ao reenviar o email", err)
        } finally {
            setResendingUserId(null)
        }
    }


    function handleFirstAccessClick(target: UserTypes) {
        setFirstAccessTarget(target)
    }

    async function handleResendFromDialog() {
        const target = firstAccessTarget
        if (!target) return

        setFirstAccessTarget(null)
        await handleResendEmail(target.id)
    }

    /*async function handleSaveFirstAccessPassword(password: string): Promise<string | null> {
        const target = firstAccessTarget
        if (!target) return firstAccessPasswordFailureMessages['not-found']

        const result = await usersService.setUserPassword(target.id, password)

        if (!result.ok) {
            return result.reason === 'service-failure'
                ? result.message
                : (result.message ?? firstAccessPasswordFailureMessages[result.reason])
        }

        setFirstAccessTarget(null)

        return null
    }*/

    function handleChangePasswordClick(target: UserTypes) {
        setPasswordTarget(target)
    }

    async function handleChangePassword(userId: string, payload: UserPasswordTypes) {

        if (!userId) return 'Usuário não encontrado. Cancele e tente de novo.'

        if (!isPasswordAccepted(payload.newPassword)) {
            return 'A senha nova ainda não atende a todas as exigências listadas.'
        }

        try {
            await userService.changeUserPassword(userId, {...payload})
        } catch (err) {
            console.error('Erro ao trocar a senha do usuário', err)
        } finally {

            setPasswordTarget(null)
        }
    }

    function handleStatusButtonClick(target: UserTypes) {

        if (target.status === 'pending') return

        setStatusTarget({
            user: target,
            action: target.status === 'active' ? 'deactivate' : 'reactivate',
        })
    }

    /*function handleStatusConfirm() {
        const pending = statusTarget
        setStatusTarget(null)

        if (!pending) return

        if (pending.action === 'deactivate') {
            void runStatusChange(pending.user, (id, actor) => usersService.deactivateUser(id, actor), {
                done: 'foi desativado com sucesso.',
                already: 'já estava inativo.',
            })
            return
        }

        void runStatusChange(pending.user, (id) => usersService.activateUser(id), {
            done: 'foi reativado com sucesso.',
            already: 'já estava ativo.',
        })
    }*/

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div
                className="flex flex-none flex-wrap items-start justify-between gap-3 border-b border-[#eef0f4] pb-4">
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-[#1a2331]">Usuários</h2>
                    <p className="mt-1 text-[13px] text-[#667085]">
                        {canManageUsers
                            ? 'Gerencie usuários, Perfis do Sistema e acessos vinculados ao portal.'
                            : 'Consulte usuários, Perfis do Sistema e acessos vinculados ao portal.'}
                    </p>
                </div>

                {canManageUsers ? (
                    <Button
                        onClick={() => {
                            setMode({mode: 'create'})
                        }}
                        size="sm"
                    >
                        <Plus aria-hidden="true" size={15}/>
                        Novo usuário
                    </Button>
                ) : null}
            </div>

            <div className="flex flex-none flex-wrap items-end gap-x-10 gap-y-3">
                <div className="flex gap-7">
                    <UserKpi label="Usuários" value={users.length} valueClassName="text-[#101828]"/>
                    <UserKpi label="Ativos" value={activeCount} valueClassName="text-[#16a34a]"/>
                    <UserKpi label="Pendentes" value={pendingCount} valueClassName="text-[#b54708]"/>
                    <UserKpi label="Inativos" value={inactiveCount} valueClassName="text-[#dc2626]"/>
                </div>

                <div className="flex gap-7">
                    <UserKpi label="Administradores" value={administratorCount} valueClassName="text-[#003be2]"/>
                    <UserKpi label="Executivos" value={executiveCount} valueClassName="text-[#0369a1]"/>
                    <UserKpi label="Analistas" value={analystCount} valueClassName="text-[#305522]"/>
                </div>
            </div>

            {/* {feedback ? (
                <div
                    className={`flex-none rounded-lg border px-3.5 py-2 text-[12.5px] font-medium ${
                        feedback.type === 'success'
                            ? 'border-[#b7e4c7] bg-[#f2fbf5] text-[#16794a]'
                            : 'border-[#f4c7c9] bg-[#fdf3f3] text-[#b42318]'
                    }`}
                    role={feedback.type === 'success' ? 'status' : 'alert'}
                >
                    {feedback.message}
                </div>
            ) : null}*/}

            <div className="min-h-0 flex-1">
                <DataTable
                    columnWidths={columnWidths}
                    headers={headers}
                    key={safePage}
                    minWidth={960}
                    scrollY
                >
                    {pageUsers.map((user) => (
                        <UserTableRow
                            canManageUsers={canManageUsers}
                            key={user.id}
                            now={now}
                            onChangePasswordClick={handleChangePasswordClick}
                            onEdit={() => {
                                setMode({mode: 'edit', user})
                            }}
                            onFirstAccessClick={handleFirstAccessClick}
                            onStatusClick={handleStatusButtonClick}
                            resending={resendingUserId === user.id}
                            user={user}
                        />
                    ))}
                </DataTable>
            </div>

            <div
                className="mt-auto flex flex-none flex-wrap items-center justify-between gap-4 rounded-xl border border-[#e6e8ee] bg-[#fafbfc] px-4 py-2.5 text-[12.5px] text-[#667085]"
            >
                <div>Mostrando <b className="text-[#344054]">{from}</b>-<b className="text-[#344054]">{to}</b> de <b
                    className="text-[#344054]">{users.length}</b> usuários
                </div>

                <div className="flex gap-1.5">
                    <Button
                        className={'disabled:pointer-events-auto disabled:cursor-pointer disabled:hover:bg-white'}
                        disabled={safePage === 0}
                        onClick={() => setPage(Math.max(0, safePage - 1))} size="sm"
                        variant="secondary"
                    >
                        Anterior
                    </Button>


                    {Array.from({length: totalPages}, (_, index) => (
                        <Button key={index} onClick={() => setPage(index)} size="sm"
                                variant={safePage === index ? 'primary' : 'secondary'}
                        >
                            {index + 1}
                        </Button>
                    ))}

                    <Button
                        className={'disabled:pointer-events-auto disabled:cursor-pointer disabled:hover:bg-white'}
                        disabled={safePage >= totalPages - 1}
                        onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} size="sm"
                        variant="secondary"
                    >
                        Próxima
                    </Button>
                </div>
            </div>

            {/*{canManageUsers ? (
                <UserDialog
                    accessProfiles={accessProfiles}
                    accessProfilesAvailable={accessProfilesAvailable}
                    editingUser={mode?.mode === 'edit' ? mode.user : null}
                    profileTypes={catalog.profileTypes}
                    isOwnAccount={mode?.mode === 'edit' && mode.user.id === authenticatedUser?.id}
                    key={mode === null ? 'closed' : mode.mode === 'edit' ? mode.user.id : 'create'}
                    onOpenChange={(nextOpen) => {
                        if (!nextOpen) setMode(null)
                    }}
                    onSaveCreate={handleCreateUser}
                    onSaveEdit={handleUpdateUser}
                    open={mode !== null}
                />
            ) : null}

            {canManageUsers ? (
                <StatusConfirmationDialog
                    onCancel={() => setStatusTarget(null)}
                    onConfirm={handleStatusConfirm}
                    pending={statusTarget}
                />
            ) : null}

            {canManageUsers ? (
                <ChangePasswordDialog
                    key={passwordTarget === null ? 'closed' : passwordTarget.id}
                    onCancel={() => setPasswordTarget(null)}
                    onSave={handleChangePassword}
                    target={passwordTarget}
                />
            ) : null}
            {canManageUsers ? (
                <FirstAccessDialog
                    key={firstAccessTarget === null ? 'closed' : firstAccessTarget.id}
                    now={now}
                    onCancel={() => setFirstAccessTarget(null)}
                    onResend={handleResendFromDialog}
                    onSavePassword={handleSaveFirstAccessPassword}
                    target={firstAccessTarget}
                />
            ) : null}

            {saveToast ? (
                <SessionToast
                    description={saveToast.description}
                    onDismiss={dismissSaveToast}
                    title={saveToast.title}
                />
            ) : null}*/}
        </div>
    )
}

function firstAccessLabel(user: UserTypes, state: FirstAccessInviteState): string {
    return state === 'not-applicable'
        ? `${user.name} já definiu a senha. Não há primeiro acesso a resolver.`
        : `Primeiro acesso de ${user.name}: reenviar o e-mail ou cadastrar uma senha`
}

function statusToggleLabel(user: UserTypes): string {
    if (user.status === 'pending') {
        return `${user.name} ainda não definiu a senha. Resolva o primeiro acesso antes de ativar ou desativar.`
    }

    return user.status === 'active' ? `Desativar ${user.name}` : `Reativar ${user.name}`
}

function passwordChangeLabel(user: UserTypes, passwordDefined: boolean): string {
    return passwordDefined
        ? `Trocar a senha de ${user.name}`
        : `${user.name} ainda não definiu a senha. Resolva o primeiro acesso antes de trocá-la.`
}

type UserTableRowProps = {
    user: UserTypes
    canManageUsers: boolean
    now: Date
    onChangePasswordClick?: (user: UserTypes) => void
    onEdit?: () => void
    onFirstAccessClick?: (user: UserTypes) => void
    onStatusClick?: (user: UserTypes) => void
    resending?: boolean
}

function UserTableRow({
                          user,
                          canManageUsers,
                          now,
                          onChangePasswordClick,
                          onEdit,
                          onFirstAccessClick,
                          onStatusClick,
                          resending = false,
                      }: UserTableRowProps) {
    const accessProfileLabel = user.access?.name ?? UNPROFILED_ACCESS_LABEL
    const profileType = user.profileType
    const lastAccess = formatLastAccess(user.lastAccess)
    const lastAccessWeekday = weekdayFromLastAccess(lastAccess)
    const inviteState = firstAccessInviteState(user, now)
    const passwordDefined = hasDefinedPassword(user)

    return (
        <tr className="border-t border-[#f1f3f7] hover:bg-[#fafbfc]">
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${profileColorClasses[profileType?.code ?? ''] ?? "bg-[#f2f4f7] text-[#667085]"}`}>{user.name.slice(0, 2)}</span>
                    <span className="min-w-0 leading-tight">
            <span className="block truncate font-medium text-[#1a2331]" title={user.name}>{user.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-[#98a2b3]"
                  title={user.email}>{user.email}</span>
          </span>
                </div>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5"><ProfileBadge profileType={profileType}/></td>
            <td className="px-4 py-2.5 text-[#475467]">
                <span className="block truncate" title={accessProfileLabel}>{accessProfileLabel}</span>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5"><StatusBadge status={user.status}/></td>
            <td className="whitespace-nowrap px-4 py-2.5 text-[#98a2b3]"
                title={lastAccessWeekday ?? undefined}>{lastAccess}</td>
            {canManageUsers ? (
                <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                        <button
                            aria-label={`Editar ${user.name}`}
                            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828]"
                            onClick={onEdit}
                            title={`Editar ${user.name}`}
                            type="button"
                        >
                            <Edit size={14} aria-hidden="true"/>
                        </button>

                        <button
                            aria-label={firstAccessLabel(user, inviteState)}
                            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828] disabled:cursor-not-allowed disabled:border-[#e9ecf2] disabled:bg-[#f9fafb] disabled:text-[#c2c8d2] disabled:hover:bg-[#f9fafb] disabled:hover:text-[#c2c8d2]"
                            disabled={inviteState === 'not-applicable' || resending}
                            onClick={() => onFirstAccessClick?.(user)}
                            title={firstAccessLabel(user, inviteState)}
                            type="button"
                        >
                            <MailPlus size={14} aria-hidden="true"/>
                        </button>

                        <button
                            aria-label={passwordChangeLabel(user, passwordDefined)}
                            className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828] disabled:cursor-not-allowed disabled:border-[#e9ecf2] disabled:bg-[#f9fafb] disabled:text-[#c2c8d2] disabled:hover:bg-[#f9fafb] disabled:hover:text-[#c2c8d2]"
                            disabled={!passwordDefined}
                            onClick={() => onChangePasswordClick?.(user)}
                            title={passwordChangeLabel(user, passwordDefined)}
                            type="button"
                        >
                            <KeyRound size={14} aria-hidden="true"/>
                        </button>

                        <button
                            aria-label={statusToggleLabel(user)}
                            className={`flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[#e4e7ee] ${user.status === 'active' ? 'text-[#e5484d] hover:bg-[#fdf3f3]' : 'text-[#16a34a] hover:bg-[#f2fbf5]'} disabled:cursor-not-allowed disabled:border-[#e9ecf2] disabled:bg-[#f9fafb] disabled:text-[#c2c8d2] disabled:hover:bg-[#f9fafb] disabled:hover:text-[#c2c8d2]`}
                            disabled={user.status === 'pending'}
                            onClick={() => onStatusClick?.(user)}
                            title={statusToggleLabel(user)}
                            type="button"
                        >
                            <Power size={14} aria-hidden="true"/>
                        </button>
                    </div>
                </td>
            ) : null}
        </tr>
    )
}

/*function PasswordRequirementList({password}: { password: string }) {
    return (
        <ul
            aria-label="Exigências da senha"
            className="mb-4 space-y-1.5 rounded-lg border border-[#e4e7ee] bg-[#f9fafb] px-3.5 py-3"
        >
            {passwordRequirements.map((rule) => {
                const met = rule.isMet(password)

                return (
                    <li
                        className={`flex items-center gap-2 text-[12px] leading-4 ${met ? 'text-[#13875a]' : 'text-[#667085]'}`}
                        key={rule.id}
                    >
                        {met ? (
                            <Check aria-hidden="true" className="flex-none" size={13}/>
                        ) : (
                            <span
                                aria-hidden="true"
                                className="h-[7px] w-[7px] flex-none rounded-full border border-current"
                            />
                        )}
                        {rule.label}
                        <span className="sr-only">{met ? ' (atendido)' : ' (pendente)'}</span>
                    </li>
                )
            })}
        </ul>
    )
}*/

function UserKpi({label, value, valueClassName}: { label: string; value: number; valueClassName: string }) {
    return (
        <div>
            <div className="text-[11.5px] font-semibold uppercase text-[#667085]">{label}</div>
            <div className={`mt-1 font-mono text-[22px] font-semibold ${valueClassName}`}>{value}</div>
        </div>
    )
}

function ProfileBadge({profileType}: { profileType: UserProfileTypesResponse | null }) {
    return <span
        className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${profileColorClasses[profileType?.code ?? ''] ?? "bg-[#f2f4f7] text-[#667085]"}`}>{profileType?.name ?? 'Perfil desconhecido'}</span>
}

function StatusBadge({status}: { status: UserStatus }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${userStatusColorClasses[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current"/>
            {formatUserStatus(status)}
    </span>
    )
}

/*function AccessProfileField({
                                disabled,
                                hasUnprofiledAccess,
                                isOwnAccount,
                                onSelect,
                                options,
                                selectedId,
                                selectionFailureReason,
                                selectedOption,
                            }: {
    disabled: boolean
    hasUnprofiledAccess: boolean
    isOwnAccount: boolean
    onSelect: (accessProfileId: string | null) => void
    options: readonly AccessProfileOption[]
    selectedId: string | null
    selectionFailureReason: AccessProfileSelectionFailureReason | null
    selectedOption: AccessProfileOption | null
}) {
    const fieldId = useId()
    const hintId = useId()

    const invalid = selectionFailureReason !== null && selectionFailureReason !== 'required'

    return (
        <>
            <label
                className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
                htmlFor={fieldId}
            >
                Perfil de Acesso {disabled ? null : <RequiredMark/>}
            </label>
            <div>
                <select
                    aria-describedby={hintId}
                    aria-invalid={invalid || undefined}
                    className={`w-full cursor-pointer rounded-lg border ${invalid ? 'border-[#b42318] focus:outline-none' : 'border-[#dfe3ec] focus:outline-none focus:border-[#667085]'} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                    disabled={disabled}
                    id={fieldId}
                    onChange={(event) => onSelect(event.target.value || null)}
                    value={selectedId ?? ''}
                >
                    {selectedId === null ? (
                        <option value="">
                            {hasUnprofiledAccess ? UNPROFILED_ACCESS_LABEL : 'Selecione um Perfil de Acesso'}
                        </option>
                    ) : null}
                    {options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name}
                        </option>
                    ))}
                </select>
                {selectedOption ? (
                    <CoverageTooltipProvider>
                        <div
                            aria-label={`Departamentos concedidos por ${selectedOption.name}`}
                            className="mt-2 flex flex-wrap gap-1.5"
                        >
                            {selectedOption.departments.length > 0 ? (
                                selectedOption.departments.map((department) => (
                                    <DepartmentCoverageChip
                                        coverage={department.coverage}
                                        key={department.departmentId}
                                        label={department.label}
                                        pages={department.catalogPages}
                                    />
                                ))
                            ) : (
                                <span className="text-[11.5px] text-[#98a2b3]">
                  Nenhum departamento concedido.
                </span>
                            )}
                        </div>
                    </CoverageTooltipProvider>
                ) : null}
            </div>
            <AccessProfileHint
                failureReason={selectionFailureReason}
                hasUnprofiledAccess={hasUnprofiledAccess}
                id={hintId}
                isOwnAccount={isOwnAccount}
            />
        </>
    )
}*/

/*function AccessProfileHint({
                               failureReason,
                               hasUnprofiledAccess,
                               id,
                               isOwnAccount,
                           }: {
    failureReason: AccessProfileSelectionFailureReason | null
    hasUnprofiledAccess: boolean
    id: string
    isOwnAccount: boolean
}) {
    if (failureReason === 'unavailable') {
        return (
            <HintText id={id} tone="attention">
                {accessProfileSelectionMessages.unavailable}
            </HintText>
        )
    }

    if (failureReason === 'unknown' || (failureReason === 'required' && hasUnprofiledAccess)) {
        return (
            <HintText id={id} tone="attention">
                Este usuário está sem Perfil de Acesso válido e não consegue entrar no portal. Escolha um
                dos perfis oferecidos para liberar o acesso.
            </HintText>
        )
    }

    if (isOwnAccount) {
        return (
            <HintText id={id}>
                Você pode editar seu nome e e-mail, mas não pode alterar o próprio Perfil do Sistema nem o
                próprio Perfil de Acesso.
            </HintText>
        )
    }

    if (failureReason === 'required') {
        return <HintText id={id}>Selecione um Perfil de Acesso para este usuário.</HintText>
    }

    return (
        <HintText id={id}>
            Os labels mostram os departamentos concedidos. Passe o mouse, use Tab ou toque em um deles
            para conferir as páginas.
        </HintText>
    )
}*/

/*const HINT_TONE_CLASSES = {
    neutral: 'text-[#98a2b3]',
    attention: 'font-medium text-[#b54708]',
    error: 'font-medium text-[#b42318]',
}

function HintText({
                      children,
                      id,
                      tone = 'neutral',
                  }: {
    children: ReactNode
    id?: string
    tone?: keyof typeof HINT_TONE_CLASSES
}) {
    return (
        <p
            className={`mb-4 mt-1.5 text-[11.5px] ${HINT_TONE_CLASSES[tone]}`}
            id={id}
            role={tone === 'error' ? 'alert' : undefined}
        >
            {children}
        </p>
    )
}*/

/*function SectionTitle({children}: { children: ReactNode }) {
    return (
        <div
            className="mb-3 border-b border-[#eef0f4] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#667085]">
            {children}
        </div>
    )
}

function FormInput({
                       error,
                       label,
                       required,
                       ...props
                   }: InputHTMLAttributes<HTMLInputElement> & { error?: string | null; label: string }) {
    return (
        <label className="mb-4 block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]">
        {label} {required ? <RequiredMark/> : null}
      </span>
            <input
                aria-invalid={error ? true : undefined}
                aria-required={required || undefined}
                className={`w-full rounded-lg border ${error ? 'border-[#b42318] focus:outline-none' : 'border-[#dfe3ec] focus:outline-none focus:border-[#667085]'} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] placeholder:text-[#98a2b3] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                {...props}
            />
            {error ? (
                <span className="mt-1.5 block text-[11.5px] font-medium text-[#b42318]" role="alert">
          {error}
        </span>
            ) : null}
        </label>
    )
}

function FirstAccessNotice() {
    return (
        <div className="mb-1 flex items-start gap-2.5 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3.5 py-3">
            <Mail aria-hidden="true" className="mt-0.5 flex-none text-[#98a2b3]" size={15}/>
            <div className="min-w-0 space-y-1">
                <p className="text-[12.5px] leading-5 text-[#475467]">
                    Ao salvar, o usuário recebe no e-mail cadastrado um link para cria a senha de acesso.
                </p>
                <p className="text-[11.5px] leading-4 text-[#98a2b3]">
                    O link vale 10 minutos e só pode ser usado uma vez.
                </p>
            </div>
        </div>
    )
}

function DialogFooter({
                          canSave,
                          onClose,
                          onSave,
                          saveLabel,
                          saving,
                      }: {
    canSave: boolean
    onClose: () => void
    onSave: () => void
    saveLabel: string
    saving: boolean
}) {
    return (
        <div className="flex flex-none justify-end gap-2.5 border-t border-[#eef0f4] px-5 py-4">
            <Button className='focus-visible:ring-[#667085]' onClick={onClose} variant="secondary">Cancelar</Button>
            <Button className='focus-visible:ring-[#667085]' disabled={!canSave} loading={saving}
                    onClick={onSave}
                    type="button">{saving ? 'Salvando...' : saveLabel}</Button>
        </div>
    )
}*/

