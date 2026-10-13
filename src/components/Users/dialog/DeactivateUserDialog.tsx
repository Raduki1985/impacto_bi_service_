import * as Dialog from "@radix-ui/react-dialog";
import {PendingStatusChange} from "../../../types/user/userTypes";
import {Button} from "../../ui/button";

export function DeactivateUserDialog({
                                         pending,
                                         onCancel,
                                         onConfirm,
                                     }: {
    pending: PendingStatusChange | null
    onCancel: () => void
    onConfirm: () => void
}) {
    if (pending === null) return null

    const deactivating = pending.action === 'deactivate'

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
                    className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 impacto-settings executive-panel rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
                    <Dialog.Title className="text-base font-bold text-[var(--text-heading)]">
                        {deactivating ? 'Desativar usuário?' : 'Reativar usuário?'}
                    </Dialog.Title>
                    <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                        {deactivating
                            ? `${pending.user.name} não poderá entrar no portal enquanto estiver Inativo. O acesso pode ser devolvido depois pela reativação.`
                            : `Deseja reativar o usuário “${pending.user.name}”? Ele voltará a ter acesso ao portal conforme suas permissões atuais.`}
                    </Dialog.Description>
                    <div className="mt-5 flex justify-end gap-2.5">
                        <Button onClick={onCancel} variant="secondary">Cancelar</Button>
                        <Button
                            className={
                                deactivating ? 'bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[var(--settings-danger)]' : undefined
                            }
                            onClick={onConfirm}
                        >
                            {deactivating ? 'Desativar usuário' : 'Reativar usuário'}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
