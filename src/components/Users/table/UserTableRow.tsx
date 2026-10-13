import {UserTypes} from "../../../types/user/userTypes";
import {ProfileBadge, StatusBadge} from "../layout/UserLayoutDialog";
import {Edit, KeyRound, MailPlus, Power} from "lucide-react";
import {firstAccessInviteState, hasDefinedPassword} from "../../../lib/firstAccessInvite";
import {formatLastAccess, formatLastAccessWeekday, initials, UNPROFILED_ACCESS_LABEL} from "../../../lib/formatters";
import {profileColorClass} from "../../../lib/profileColors";

const iconButtonClass =
    'flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-item)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-heading)]'

const disabledIconClass =
    'disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--settings-tint)] disabled:text-[var(--text-disabled)] disabled:hover:bg-[var(--settings-tint)] disabled:hover:text-[var(--text-disabled)]'

const statusIconClass =
    'flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded border border-[var(--border)]'

interface UserTableRowProps {
    user: UserTypes
    canManageUsers: boolean
    now: Date
    resending: boolean
    onChangePasswordClick: (user: UserTypes) => void
    onEdit: (user: UserTypes) => void
    onFirstAccessClick: (user: UserTypes) => void
    onStatusClick: (user: UserTypes) => void
}

export function UserTableRow({
                                 user,
                                 canManageUsers,
                                 now,
                                 resending,
                                 onChangePasswordClick,
                                 onEdit,
                                 onFirstAccessClick,
                                 onStatusClick,
                             }: UserTableRowProps) {
    const accessProfileLabel = user.access?.name ?? UNPROFILED_ACCESS_LABEL
    const inviteState = firstAccessInviteState(user, now)
    const passwordDefined = hasDefinedPassword(user)

    const firstAccessLabel = inviteState === 'not-applicable'
        ? `${user.name} já definiu a senha. Não há primeiro acesso a resolver.`
        : `Primeiro acesso de ${user.name}: reenviar o e-mail ou cadastrar uma senha`

    const passwordLabel = passwordDefined
        ? `Trocar a senha de ${user.name}`
        : `${user.name} ainda não definiu a senha. Resolva o primeiro acesso antes de trocá-la.`

    const statusLabel = user.status === 'pending'
        ? `${user.name} ainda não definiu a senha. Resolva o primeiro acesso antes de ativar ou desativar.`
        : user.status === 'active'
            ? `Desativar ${user.name}`
            : `Reativar ${user.name}`

    return (
        <tr className="border-t border-[var(--divider)] hover:bg-[var(--hover-bg)]">
            <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${profileColorClass(user.profileType?.code)}`}>
                        {initials(user.name)}
                    </span>

                    <span className="min-w-0 leading-tight">
                        <span
                            className="block truncate font-medium text-[var(--text-primary)]"
                            title={user.name}
                        >
                            {user.name}
                        </span>

                        <span
                            className="block truncate font-mono text-[11.5px] text-[var(--settings-faint)]"
                            title={user.email}
                        >
                            {user.email}
                        </span>
                    </span>
                </div>
            </td>

            <td className="whitespace-nowrap px-4 py-2.5">
                <ProfileBadge profileType={user.profileType}/>
            </td>

            <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                <span className="block truncate" title={accessProfileLabel}>
                    {accessProfileLabel}
                </span>
            </td>

            <td className="whitespace-nowrap px-4 py-2.5">
                <StatusBadge status={user.status}/>
            </td>

            <td className="whitespace-nowrap px-4 py-2.5 text-[var(--settings-faint)]"
                title={formatLastAccessWeekday(user.lastAccess) ?? undefined}>
                {formatLastAccess(user.lastAccess)}
            </td>

            {canManageUsers ? (
                <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                        <button
                            aria-label={`Editar ${user.name}`}
                            className={iconButtonClass}
                            onClick={() => onEdit(user)}
                            title={`Editar ${user.name}`}
                            type="button"
                        >
                            <Edit size={14} aria-hidden="true"/>
                        </button>

                        <button
                            aria-label={firstAccessLabel}
                            className={`${iconButtonClass} ${disabledIconClass}`}
                            disabled={inviteState === 'not-applicable' || resending}
                            onClick={() => onFirstAccessClick(user)}
                            title={firstAccessLabel}
                            type="button"
                        >
                            <MailPlus size={14} aria-hidden="true"/>
                        </button>

                        <button
                            aria-label={passwordLabel}
                            className={`${iconButtonClass} ${disabledIconClass}`}
                            disabled={!passwordDefined}
                            onClick={() => onChangePasswordClick(user)}
                            title={passwordLabel}
                            type="button"
                        >
                            <KeyRound size={14} aria-hidden="true"/>
                        </button>

                        <button
                            aria-label={statusLabel}
                            className={`${statusIconClass} ${user.status === 'active' ? 'text-[var(--settings-danger)] hover:bg-[var(--settings-danger-bg)]' : 'text-[var(--settings-ok)] hover:bg-[var(--settings-ok-bg)]'} ${disabledIconClass}`}
                            disabled={user.status === 'pending'}
                            onClick={() => onStatusClick(user)}
                            title={statusLabel}
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
