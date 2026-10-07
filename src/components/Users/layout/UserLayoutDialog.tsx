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
            className="mb-3 border-b border-[#eef0f4] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#667085]">
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

export function UserKpi({label, value, valueClassName}: { label: string; value: number; valueClassName: string }) {
    return (
        <div>
            <div className="text-[11.5px] font-semibold uppercase text-[#667085]">{label}</div>
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
}

export function PasswordRequirementList({password}: { password: string }) {
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
}