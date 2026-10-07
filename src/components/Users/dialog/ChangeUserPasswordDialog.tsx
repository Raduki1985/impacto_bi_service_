import * as Dialog from "@radix-ui/react-dialog";
import {UserPasswordTypes, UserTypes} from "../../../types/user/userTypes";
import {Button} from "../../ui/button";
import {isPasswordAccepted} from "../../../lib/passwordPolicy";
import {useState} from "react";
import {FormInput, PasswordRequirementList} from "../layout/UserLayoutDialog";

export function ChangeUserPasswordDialog({
                                             target,
                                             onCancel,
                                             onSave,
                                         }: {
    target: UserTypes | null
    onCancel: () => void
    onSave: (userId: string, payload: UserPasswordTypes) => Promise<string | null>
}) {
    const [newPassword, setNewPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [confirmError, setConfirmError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    if (target === null) return null

    const accepted = isPasswordAccepted(newPassword)
    const matches = newPassword !== '' && newPassword === confirmation

    function handleRequestConfirmation() {
        if (!accepted) {
            setError('A senha nova ainda não atende a todas as exigências listadas acima.')
            return
        }
        if (!matches) {
            setError('As duas senhas digitadas não são iguais.')
            return
        }

        setError(null)
        setCurrentPassword('')
        setConfirmError(null)
        setConfirming(true)
    }

    async function handleConfirm() {
        if (saving || target === null) return

        if (currentPassword === '') {
            setConfirmError('Digite a sua senha para confirmar a troca.')
            return
        }

        setConfirmError(null)
        setSaving(true)
        let message: string | null
        try {
            message = await onSave(target.id, {currentPassword, newPassword})
        } finally {
            setSaving(false)
        }

        if (message === null) {
            onCancel()
            return
        }

        setConfirmError(message)
    }

    return (
        <>
            <Dialog.Root
                open
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) onCancel()
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[520px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                        <Dialog.Title className="text-base font-bold text-[#101828]">
                            Trocar senha
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                            {`Troque a senha do usuário ${target.name}.`}
                        </Dialog.Description>

                        <div className="mt-4">
                            <FormInput
                                autoComplete="new-password"
                                autoFocus
                                label="Nova senha"
                                onChange={(event) => {
                                    setNewPassword(event.target.value)
                                    setError(null)
                                }}
                                required
                                type="password"
                                value={newPassword}
                            />

                            <PasswordRequirementList password={newPassword}/>

                            <FormInput
                                autoComplete="new-password"
                                error={error}
                                label="Repita a nova senha"
                                onChange={(event) => {
                                    setConfirmation(event.target.value)
                                    setError(null)
                                }}
                                required
                                type="password"
                                value={confirmation}
                            />

                            <div className="flex flex-wrap justify-end gap-2.5">
                                <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                                <Button
                                    disabled={saving || !accepted || !matches}
                                    onClick={handleRequestConfirmation}
                                >
                                    Salvar senha
                                </Button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            <Dialog.Root
                open={confirming}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setConfirming(false)
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[60] bg-[#101828]/40"/>
                    <Dialog.Content
                        className="fixed left-1/2 top-1/2 z-[60] w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                        <Dialog.Title className="text-base font-bold text-[#101828]">
                            Confirmar a troca de senha?
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                            {`Digite a sua senha para trocar a senha de ${target.name}. Ele passa a entrar no portal com a senha nova, e a anterior deixa de valer.`}
                        </Dialog.Description>

                        <div className="mt-4">
                            <FormInput
                                autoComplete="current-password"
                                autoFocus
                                error={confirmError}
                                label="Sua senha"
                                onChange={(event) => {
                                    setCurrentPassword(event.target.value)
                                    setConfirmError(null)
                                }}
                                required
                                type="password"
                                value={currentPassword}
                            />

                            <div className="flex flex-wrap justify-end gap-2.5">
                                <Button onClick={() => setConfirming(false)} variant="secondary">
                                    Cancelar
                                </Button>
                                <Button disabled={saving || currentPassword === ''} onClick={handleConfirm}>
                                    {saving ? 'Salvando...' : 'Confirmar troca'}
                                </Button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    )
}
