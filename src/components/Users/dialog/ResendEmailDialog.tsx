import * as Dialog from "@radix-ui/react-dialog";
import {useState} from "react";
import {KeyRound, MailPlus} from "lucide-react";
import {UpdateUserTypes, UserTypes} from "../../../types/user/userTypes";
import {Button} from "../../ui/button";
import {firstAccessInviteState, formatInviteDeadline} from "../../../lib/firstAccessInvite";
import {isPasswordAccepted} from "../../../lib/passwordPolicy";
import {FormInput, PasswordRequirementList} from "../layout/UserLayoutDialog";

export function ResendEmailDialog({
                                      target,
                                      now,
                                      onCancel,
                                      onResend,
                                      onSavePassword,
                                  }: {
    target: UserTypes | null
    now: Date
    onCancel: () => void
    onResend: (userId: string) => void
    onSavePassword: (userId: string, payload: UpdateUserTypes) => Promise<string | null>
}) {
    const [stage, setStage] = useState<'choose' | 'password'>('choose')
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    if (target === null) return null

    const inviteState = firstAccessInviteState(target, now)
    const inviteDeadline = formatInviteDeadline(target.setPasswordExpire)
    const accepted = isPasswordAccepted(password)
    const matches = password !== '' && password === confirmation

    async function handleSave() {
        if (saving || target === null) return

        if (!accepted) {
            setError('A senha ainda não atende a todas as exigências listadas acima.')
            return
        }
        if (!matches) {
            setError('As duas senhas digitadas não são iguais.')
            return
        }

        setError(null)
        setSaving(true)
        let message: string | null
        try {
            message = await onSavePassword(target.id, {password, status: 'active'})
        } finally {
            setSaving(false)
        }

        if (message === null) {
            onCancel()
            return
        }

        setError(message)
    }

    return (
        <Dialog.Root
            open
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onCancel()
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40"/>
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-50 w-[520px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                    <Dialog.Title className="text-base font-bold text-[#101828]">
                        {stage === 'choose' ? 'Primeiro acesso' : 'Cadastrar senha'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
                        {stage === 'choose'
                            ? `Reenviar o e-mail ou cadastrar uma senha para o usuário ${target.name}.`
                            : `A senha abaixo passa a valer para ${target.name}, e a conta é ativada. Combine-a com ele e peça que a troque depois pela recuperação de senha.`}
                    </Dialog.Description>

                    {stage === 'choose' ? (
                        <>
                            {inviteState === 'pending' ? (
                                <p className="mt-4 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3.5 py-3 text-[12.5px] leading-5 text-[#475467]">
                                    {inviteDeadline === null
                                        ? 'O link enviado por e-mail ainda está no prazo. O reenvio libera quando ele expirar, porque um e-mail novo derruba o anterior.'
                                        : `O link enviado por e-mail vale até ${inviteDeadline}. O reenvio libera depois disso, porque um e-mail novo derruba o anterior.`}
                                </p>
                            ) : null}

                            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
                                <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                                <Button onClick={() => setStage('password')} variant="secondary">
                                    <KeyRound aria-hidden="true" size={14}/>
                                    Cadastrar senha
                                </Button>
                                <Button
                                    disabled={inviteState !== 'expired'}
                                    onClick={() => {
                                        onResend(target.id)
                                        onCancel()
                                    }}
                                >
                                    <MailPlus aria-hidden="true" size={14}/>
                                    Reenviar e-mail
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="mt-4">
                            <FormInput
                                autoComplete="new-password"
                                autoFocus
                                label="Senha"
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                type="password"
                                value={password}
                            />

                            <PasswordRequirementList password={password}/>

                            <FormInput
                                autoComplete="new-password"
                                error={error}
                                label="Digite novamente a senha"
                                onChange={(event) => setConfirmation(event.target.value)}
                                required
                                type="password"
                                value={confirmation}
                            />

                            <div className="flex flex-wrap justify-end gap-2.5">
                                <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                                <Button onClick={() => setStage('choose')} variant="secondary">Voltar</Button>
                                <Button disabled={saving || !accepted || !matches} onClick={handleSave}>
                                    {saving ? 'Salvando...' : 'Salvar senha e ativar'}
                                </Button>
                            </div>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
