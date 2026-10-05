/*
import {UserTypes} from "../../types/user/userTypes";
import {useId, useMemo, useRef, useState} from "react";
import {
    accessProfileDraftFor,
    accessProfileOptionsFor,
    checkAccessProfileSelection,
    findAccessProfileOption,
    initialAccessProfileId,
    initialProfileSystemId
} from "../../Pages/Users/userAccessProfiles";
import {isValidUserEmail} from "../../lib/userEmail";
import * as Dialog from "@radix-ui/react-dialog";
import {modalOverlayClass, modalShellClass, RequiredMark} from "../../Pages/AccessProfiles/accessProfilesUi";
import {Button} from "../ui/button";
import {X} from "lucide-react";

interface UserDialogProps

= {
    open: boolean
    editingUser: UserTypes | null
    isOwnAccount: boolean
    profileTypes: readonly SystemProfileOption[]
    accessProfiles: readonly AccessProfile[]
    accessProfilesAvailable: boolean
    onOpenChange: (open: boolean) => void
        onSaveEdit
:
(userId: string, input: UserFormInput) => Promise<string | null>
onSaveCreate: (input: UserFormInput) => Promise<string | null>
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
    const profileSystemId = profileSystemDraft ?? initialProfileSystemId(editingUser, profileTypes)

    const [accessProfileDraft, setAccessProfileDraft] = useState<string | null>(() =>
        initialAccessProfileId(editingUser, accessProfiles),
    )
    const [formError, setFormError] = useState<string | null>(null)

    const [isSaving, setIsSaving] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)
    const profileFieldId = useId()

    const options = useMemo(() => accessProfileOptionsFor(accessProfiles), [accessProfiles])
    const selectedId = accessProfileDraftFor(options, accessProfileDraft)
    const selectedOption = findAccessProfileOption(options, selectedId)
    const emailValid = isValidUserEmail(email)
    const emailError = emailTouched && !emailValid ? 'Informe um e-mail válido.' : null

    const selection = checkAccessProfileSelection(options, selectedId, accessProfilesAvailable)
    const hasUnprofiledAccess =
        editingUser !== null && initialAccessProfileId(editingUser, accessProfiles) === null

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

        const accessProfileId = selection.option.id

        setIsSaving(true)
        try {
            const error = editingUser
                ? await onSaveEdit(editingUser.id, {name, email, profileSystemId, accessProfileId})
                : await onSaveCreate({name, email, profileSystemId, accessProfileId})

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
                            {profileTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>

                        <AccessProfileField
                            disabled={isOwnAccount}
                            hasUnprofiledAccess={hasUnprofiledAccess}
                            isOwnAccount={isOwnAccount}
                            onSelect={(nextId) => {
                                setAccessProfileDraft(nextId)
                                setFormError(null)
                            }}
                            options={options}
                            selectedId={selectedId}
                            selectionFailureReason={selection.ok ? null : selection.reason}
                            selectedOption={selectedOption}
                        />
                        {isEditing ? null : <FirstAccessNotice/>}
                    </div>

                    <DialogFooter
                        canSave={selection.ok && emailValid && profileSystemId !== null}
                        onClose={() => onOpenChange(false)}
                        onSave={handleSave}
                        saveLabel={isEditing ? 'Salvar alterações' : 'Salvar usuário'}
                        saving={isSaving}
                    />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}*/
