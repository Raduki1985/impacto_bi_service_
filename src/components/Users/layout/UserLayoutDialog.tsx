import type {InputHTMLAttributes, ReactNode} from "react";
import {RequiredMark} from "../../../Pages/AccessProfiles/accessProfilesUi";
import {UserProfileTypesResponse} from "../../../types/profileTypes/profileTypesType";
import {profileColorClass} from "../../../lib/profileColors";
import {UserStatus} from "../../../types/user/userTypes";
import {userStatusColorClasses} from "../../../lib/userStatusColors";
import {formatUserStatus} from "../../../lib/formatters";
import {passwordRequirements} from "../../../lib/passwordPolicy";
import {Check} from "lucide-react";

export function SectionTitle({children}: { children: ReactNode }) {
    return (
        <div
            className="mb-3 border-b border-[var(--divider)] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[var(--settings-muted)]">
            {children}
        </div>
    )
}

export function FormInput({
                              error,
                              label,
                              required,
                              ...props
                          }: InputHTMLAttributes<HTMLInputElement> & { error?: string | null; label: string }) {
    return (
        <label className="mb-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[var(--text-item)]">
                {label} {required ? <RequiredMark/> : null}
            </span>

            <input
                aria-invalid={error ? true : undefined}
                aria-required={required || undefined}
                className={`w-full rounded-lg border ${error ? 'border-[var(--settings-danger)] focus:outline-none' : 'border-[var(--border)] focus:outline-none focus:border-[var(--settings-muted)]'} bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--settings-faint)] disabled:cursor-not-allowed disabled:bg-[var(--settings-tint)] disabled:text-[var(--settings-faint)]`}
                {...props}
            />

            {error ? (
                <span className="mt-1.5 block text-[11.5px] font-medium text-[var(--settings-danger)]" role="alert">
                    {error}
                </span>
            ) : null}
        </label>
    )
}

export function UserKpi({label, value, valueClassName}: { label: string; value: number; valueClassName: string }) {
    return (
        <div className="w-[148px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <div className="text-[11.5px] font-semibold uppercase text-[var(--settings-muted)]">{label}</div>
            <div className={`mt-1 font-mono text-[22px] font-semibold ${valueClassName}`}>{value}</div>
        </div>
    )
}

export function ProfileBadge({profileType}: { profileType: UserProfileTypesResponse | null }) {
    return <span
        className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${profileColorClass(profileType?.code)}`}>{profileType?.name ?? 'Perfil desconhecido'}</span>
}

export function StatusBadge({status}: { status: UserStatus }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${userStatusColorClasses[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current"/>
            {formatUserStatus(status)}
    </span>
    )
}

export function AccessProfileHint({
                                      accessProfilesAvailable,
                                      hasUnprofiledAccess,
                                      id,
                                      isOwnAccount,
                                      selected,
                                  }: {
    accessProfilesAvailable: boolean
    hasUnprofiledAccess: boolean
    id: string
    isOwnAccount: boolean
    selected: boolean
}) {
    if (!accessProfilesAvailable) {
        return (
            <HintText id={id} tone="attention">
                Erro ao carregar os perfis de acesso.
            </HintText>
        )
    }

    if (!selected && hasUnprofiledAccess) {
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

    if (!selected) {
        return <HintText id={id}>Selecione um Perfil de Acesso para este usuário.</HintText>
    }

    return (
        <HintText id={id}>
            Os labels mostram os departamentos concedidos. Passe o mouse, use Tab ou toque em um deles
            para conferir as páginas.
        </HintText>
    )
}

const HINT_TONE_CLASSES = {
    neutral: 'text-[var(--settings-faint)]',
    attention: 'font-medium text-[var(--settings-warn)]',
    error: 'font-medium text-[var(--settings-danger)]',
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
}

export function PasswordRequirementList({password}: { password: string }) {
    return (
        <ul
            aria-label="Exigências da senha"
            className="mb-4 space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--settings-tint)] px-3.5 py-3"
        >
            {passwordRequirements.map((rule) => {
                const met = rule.isMet(password)

                return (
                    <li
                        className={`flex items-center gap-2 text-[12px] leading-4 ${met ? 'text-[var(--settings-ok-text)]' : 'text-[var(--settings-muted)]'}`}
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
}