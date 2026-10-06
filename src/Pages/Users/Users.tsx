import {Plus} from 'lucide-react'
import {useEffect, useMemo, useState} from 'react'

import {DataTable} from '../../components/dashboard/DataTable'
import {Button} from '../../components/ui/button'

import {ADMIN_USERS_WRITE_PERMISSION} from '../../config/permissions'
import {useAuth} from '../../contexts/useAuth'
import {firstAccessInviteState,} from '../../lib/firstAccessInvite'
import {isPasswordAccepted} from '../../lib/passwordPolicy'
import {
    CreateUserTypes,
    PendingStatusChange,
    UpdateUserTypes,
    UserPasswordTypes,
    UserStatus,
    UserTypes
} from "../../types/user/userTypes";
import {userService} from "../../services/users/userService";
import {accessProfileService} from "../../services/accessProfiles/accessProfileService";
import {profileTypesService} from "../../services/profileTypes/profileTypesService";
import {AccessProfileTypes} from "../../types/accessProfile/accessProfileTypes";
import {ProfileTypesTypes} from "../../types/profileTypes/profileTypesType";
import {UserKpi} from "../../components/Users/layout/UserLayoutDialog";
import {UserDialog} from "../../components/Users/dialog/UserDialog";
import {DeactivateUserDialog} from "../../components/Users/dialog/DeactivateUserDialog";
import {ChangeUserPasswordDialog} from "../../components/Users/dialog/ChangeUserPasswordDialog";
import {ResendEmailDialog} from "../../components/Users/dialog/ResendEmailDialog";
import {UserTableRow} from "../../components/Users/table/UserTableRow";

const PAGE_SIZE = 10

/*type UserFeedback = {
    type: 'success' | 'error'
    message: string
}*/

function isLastActiveAdministrator(collection: readonly UserTypes[], current: UserTypes): boolean {
    if (current.profileType?.code !== 'adm' || current.status !== 'active') return false

    return collection.filter((user) => user.profileType?.code === 'adm' && user.status === 'active').length <= 1
}

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

/*type PendingStatusChange = { user: UserTypes; action: 'deactivate' | 'reactivate' }*/


export function Users() {
    const {user: authenticatedUser, hasPermission} = useAuth()

    const canManageUsers = hasPermission(ADMIN_USERS_WRITE_PERMISSION)

    const [users, setUsers] = useState<UserTypes[]>([])
    const [accessProfiles, setAccessProfiles] = useState<AccessProfileTypes[]>([])
    const [accessProfilesAvailable, setAccessProfilesAvailable] = useState(false)
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
                setAccessProfilesAvailable(true)
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

            return null

        } catch (err) {
            console.error("Erro ao cadadastrar o usuário", err)

            return "Não foi possível cadastrar o usuário. Tente novamente"

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

            return null

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

    /*async function handleResendFromDialog() {
        const target = firstAccessTarget
        if (!target) return

        setFirstAccessTarget(null)
        await handleResendEmail(target.id)
    }*/

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

            return null

        } catch (err) {
            console.error('Erro ao trocar a senha do usuário', err)

            return "Não foi possível trocar a senha do usuário. Tente novamente"
        }
    }

    function handleStatusButtonClick(target: UserTypes) {

        if (target.status === 'pending') return

        setStatusTarget({
            user: target,
            action: target.status === 'active' ? 'deactivate' : 'reactivate',
        })
    }

    async function handleStatusConfirm() {
        const pending = statusTarget
        setStatusTarget(null)

        if (!pending) return

        const status: UserStatus = pending.action === 'deactivate' ? 'inactive' : 'active'

        if (status === 'inactive') {
            if (pending.user.id === authenticatedUser?.id) {
                console.error('Um administrador não pode desativar a própria conta')
                return
            }

            if (isLastActiveAdministrator(users, pending.user)) {
                console.error('Não é possível desativar o último administrador ativo')
                return
            }
        }

        await handleUpdateUser(pending.user.id, {status})
    }

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
                            onEdit={(user) => setMode({mode: 'edit', user})}
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

            {canManageUsers ? (
                <UserDialog
                    accessProfiles={accessProfiles}
                    accessProfilesAvailable={accessProfilesAvailable}
                    editingUser={mode?.mode === 'edit' ? mode.user : null}
                    profileTypes={profileTypes}
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
                <DeactivateUserDialog
                    onCancel={() => setStatusTarget(null)}
                    onConfirm={handleStatusConfirm}
                    pending={statusTarget}
                />
            ) : null}

            {canManageUsers ? (
                <ChangeUserPasswordDialog
                    key={passwordTarget === null ? 'closed' : passwordTarget.id}
                    onCancel={() => setPasswordTarget(null)}
                    onSave={handleChangePassword}
                    target={passwordTarget}
                />
            ) : null}
            {canManageUsers ? (
                <ResendEmailDialog
                    key={firstAccessTarget === null ? 'closed' : firstAccessTarget.id}
                    now={now}
                    onCancel={() => setFirstAccessTarget(null)}
                    onResend={handleResendEmail}
                    onSavePassword={handleUpdateUser}
                    target={firstAccessTarget}
                />
            ) : null}

            {/* {saveToast ? (
                <SessionToast
                    description={saveToast.description}
                    onDismiss={dismissSaveToast}
                    title={saveToast.title}
                />
            ) : null}*/}
        </div>
    )
}

