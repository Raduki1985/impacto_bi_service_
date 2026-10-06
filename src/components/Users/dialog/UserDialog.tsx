import {CreateUserTypes, UpdateUserTypes, UserTypes} from "../../../types/user/userTypes";
import {useId, useRef, useState} from "react";
import {AccessProfileTypes} from "../../../types/accessProfile/accessProfileTypes";
import {ProfileTypesTypes} from "../../../types/profileTypes/profileTypesType";
import {UNPROFILED_ACCESS_LABEL} from "../../../lib/formatters";
import {isValidUserEmail} from "../../../lib/userEmail";
import * as Dialog from "@radix-ui/react-dialog";
import {modalOverlayClass, modalShellClass, RequiredMark} from "../../../Pages/AccessProfiles/accessProfilesUi";
import {Button} from "../../ui/button";
import {Mail, X} from "lucide-react";
import {AccessProfileHint, FormInput, SectionTitle} from "../layout/UserLayoutDialog";

/*import { CoverageTooltipProvider } from "../../../Pages/AccessProfiles/CoverageTooltipProvider";
import {DepartmentCoverageChip} from "../../../Pages/AccessProfiles/DepartmentCoverageChip";*/

interface UserDialogProps {
    open: boolean
    editingUser: UserTypes | null
    isOwnAccount: boolean
    profileTypes: readonly ProfileTypesTypes[]
    accessProfiles: readonly AccessProfileTypes[]
    accessProfilesAvailable: boolean
    onOpenChange: (open: boolean) => void
    onSaveEdit: (userId: string, input: UpdateUserTypes) => Promise<string | null>
    onSaveCreate: (input: CreateUserTypes) => Promise<string | null>
}

export function UserDialog({
                               open,
                               editingUser,
                               isOwnAccount,
                               profileTypes,
                               accessProfiles,
                               accessProfilesAvailable,
                               onOpenChange,
                               onSaveEdit,
                               onSaveCreate,
                           }: UserDialogProps) {
    const isEditing = editingUser !== null
    const [name, setName] = useState(editingUser?.name ?? '')
    const [email, setEmail] = useState(editingUser?.email ?? '')
    const [emailTouched, setEmailTouched] = useState(false)

    const [profileSystemDraft, setProfileSystemDraft] = useState<string | null>(null)
    const profileSystemId = profileSystemDraft ?? editingUser?.profileSystemId ?? null

    const [accessProfileDraft, setAccessProfileDraft] = useState<string | null>(
        editingUser?.accessProfileId ?? null,
    )
    const [formError, setFormError] = useState<string | null>(null)

    const [isSaving, setIsSaving] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)
    const profileFieldId = useId()
    const accessFieldId = useId()
    const accessHintId = useId()

    const selectedId = accessProfiles.some((profile) => profile.id === accessProfileDraft)
        ? accessProfileDraft
        : null
    const emailValid = isValidUserEmail(email)
    const emailError = emailTouched && !emailValid ? 'Informe um e-mail válido.' : null

    const hasUnprofiledAccess =
        editingUser !== null && !accessProfiles.some((profile) => profile.id === editingUser.accessProfileId)

    const canSave = selectedId !== null && emailValid && profileSystemId !== null

    function handleSystemProfileChange(value: string) {
        setProfileSystemDraft(value || null)
        setFormError(null)
    }

    function showFormError(message: string) {
        setFormError(message)

        if (contentRef.current) contentRef.current.scrollTop = 0
    }

    async function handleSave() {
        if (isSaving) return

        setFormError(null)

        if (!emailValid) {
            setEmailTouched(true)
            showFormError('Informe um e-mail válido.')
            return
        }

        if (selectedId === null || profileSystemId === null) return

        setIsSaving(true)
        try {
            const error = editingUser
                ? await onSaveEdit(editingUser.id, {
                    name, email, profileSystemId, accessProfileId: selectedId,
                })
                : await onSaveCreate({
                    name, email, profileSystemId, accessProfileId: selectedId,
                    status: 'pending', password: '',
                })

            if (error) showFormError(error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className={modalOverlayClass}/>
                <Dialog.Content
                    className={`${modalShellClass} max-h-[92vh] max-w-[calc(100vw-24px)] sm:max-h-[88vh] sm:w-[560px]`}
                >
                    <div
                        className="flex flex-none items-start justify-between gap-3 border-b border-[#eef0f4] px-5 py-4">
                        <div className="min-w-0">
                            <Dialog.Title className="text-base font-bold text-[#101828]">
                                {isEditing ? 'Editar usuário' : 'Novo usuário'}
                            </Dialog.Title>
                            <Dialog.Description className="mt-0.5 text-xs text-[#98a2b3]">
                                {isEditing
                                    ? 'Atualização de dados, Perfil do Sistema e Perfil de Acesso'
                                    : 'Cadastro de acesso ao BI'}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button aria-label="Fechar" size="icon" variant="ghost">
                                <X size={18}/>
                            </Button>
                        </Dialog.Close>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-5" ref={contentRef}>
                        {formError ? (
                            <div
                                className="mb-4 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3.5 py-2 text-[12.5px] font-medium text-[#b42318]"
                                role="alert">
                                {formError}
                            </div>
                        ) : null}

                        <SectionTitle>Dados básicos</SectionTitle>

                        <FormInput
                            label="Nome completo"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Ex.: João da Silva"
                            required
                            value={name}
                        />

                        <FormInput
                            autoComplete="off"
                            error={emailError}
                            label="E-mail"
                            name="new-user-email"
                            onBlur={() => setEmailTouched(true)}
                            onChange={(event) => {
                                setEmail(event.target.value)
                                setFormError(null)
                            }}
                            placeholder="usuario@impactotelecom.com"
                            required
                            type="email"
                            value={email}
                        />

                        <label
                            className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
                            htmlFor={profileFieldId}
                        >
                            Perfil do Sistema {isOwnAccount ? null : <RequiredMark/>}
                        </label>

                        <select
                            className={`mb-4 w-full cursor-pointer rounded-lg border border-[#dfe3ec] focus:outline-none focus:border-[#667085] bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                            disabled={isOwnAccount}
                            id={profileFieldId}
                            onChange={(event) => handleSystemProfileChange(event.target.value)}
                            value={profileSystemId ?? ''}
                        >
                            {profileSystemId === null ? (
                                <option value="">Selecione um Perfil do Sistema</option>
                            ) : null}
                            {profileTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>

                        <label
                            className="mb-1.5 block text-[12.5px] font-semibold text-[#344054]"
                            htmlFor={accessFieldId}
                        >
                            Perfil de Acesso {isOwnAccount ? null : <RequiredMark/>}
                        </label>
                        <div>
                            <select
                                aria-describedby={accessHintId}
                                className={`w-full cursor-pointer rounded-lg border border-[#dfe3ec] focus:outline-none focus:border-[#667085] bg-white px-3 py-2.5 text-[13px] text-[#1a2331] disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]`}
                                disabled={isOwnAccount}
                                id={accessFieldId}
                                onChange={(event) => {
                                    setAccessProfileDraft(event.target.value || null)
                                    setFormError(null)
                                }}
                                value={selectedId ?? ''}
                            >
                                {selectedId === null ? (
                                    <option value="">
                                        {hasUnprofiledAccess ? UNPROFILED_ACCESS_LABEL : 'Selecione um Perfil de Acesso'}
                                    </option>
                                ) : null}
                                {accessProfiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                        {profile.name}
                                    </option>
                                ))}
                            </select>
                            {/*{selectedOption ? (
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
                            ) : null}*/}
                        </div>
                        <AccessProfileHint
                            accessProfilesAvailable={accessProfilesAvailable}
                            hasUnprofiledAccess={hasUnprofiledAccess}
                            id={accessHintId}
                            isOwnAccount={isOwnAccount}
                            selected={selectedId !== null}
                        />


                        {isEditing ? null : (
                            <div
                                className="mb-1 flex items-start gap-2.5 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3.5 py-3">
                                <Mail aria-hidden="true" className="mt-0.5 flex-none text-[#98a2b3]" size={15}/>
                                <div className="min-w-0 space-y-1">
                                    <p className="text-[12.5px] leading-5 text-[#475467]">
                                        Ao salvar, o usuário recebe no e-mail cadastrado um link para criar a senha de
                                        acesso.
                                    </p>
                                    <p className="text-[11.5px] leading-4 text-[#98a2b3]">
                                        O link vale 10 minutos e só pode ser usado uma vez.
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="flex flex-none justify-end gap-2.5 border-t border-[#eef0f4] px-5 py-4">
                        <Button
                            className="focus-visible:ring-[#667085]"
                            onClick={() => onOpenChange(false)}
                            variant="secondary"
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="focus-visible:ring-[#667085]"
                            disabled={!canSave}
                            loading={isSaving}
                            onClick={handleSave}
                            type="button"
                        >
                            {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar usuário'}
                        </Button>
                    </div>

                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
