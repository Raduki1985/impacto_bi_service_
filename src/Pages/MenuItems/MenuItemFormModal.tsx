import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { type ReactNode, useId, useRef, useState } from 'react'

import { Button } from '../../components/ui/button'
import type { MenuTypes } from '../../types/menu/menuTypes'
import { modalOverlayClass, modalShellClass, RequiredMark } from '../AccessProfiles/accessProfilesUi'
import {
  checkMenuItemDraft,
  draftFailureMessages,
  hasChildren,
  type MenuItemDraft,
  nextPositionFor,
  parentOptionsFor,
} from './menuItemsModel'

export type MenuItemFormMode = { mode: 'create' } | { mode: 'edit'; menu: MenuTypes }

export function MenuItemFormModal({
  form,
  menus,
  onOpenChange,
  onSave,
}: {
  form: MenuItemFormMode | null
  menus: readonly MenuTypes[]
  onOpenChange: (open: boolean) => void
  onSave: (draft: MenuItemDraft) => Promise<string | null>
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={form !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className={modalOverlayClass} />
        <Dialog.Content
          className={`${modalShellClass} max-h-[92vh] max-w-[calc(100vw-24px)] sm:max-h-[88vh] sm:w-[600px]`}
        >
          {form === null ? null : (
            <MenuItemFormBody
              form={form}
              key={form.mode === 'edit' ? form.menu.id : 'create'}
              menus={menus}
              onClose={() => onOpenChange(false)}
              onSave={onSave}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function MenuItemFormBody({
  form,
  menus,
  onClose,
  onSave,
}: {
  form: MenuItemFormMode
  menus: readonly MenuTypes[]
  onClose: () => void
  onSave: (draft: MenuItemDraft) => Promise<string | null>
}) {
  const editing = form.mode === 'edit' ? form.menu : null
  const editingId = editing?.id ?? null

  const [name, setName] = useState(editing?.name ?? '')
  const [menuKey, setMenuKey] = useState(editing?.menuId ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [parentId, setParentId] = useState<string | null>(editing?.profileMenuId ?? null)
  const [position, setPosition] = useState(
    String(editing?.position ?? nextPositionFor(menus, null)),
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const keyFieldId = useId()
  const parentFieldId = useId()

  const parentOptions = parentOptionsFor(menus, editingId)
  const canBeChild = parentOptions.length > 0
  const isParentOfOthers = editingId !== null && hasChildren(menus, editingId)

  const isChild = parentId !== null

  const draft: MenuItemDraft = { name, menuKey, position, icon, parentId }
  const check = checkMenuItemDraft(draft, menus, editingId)

  function changeParent(nextParentId: string | null) {
    setParentId(nextParentId)
    setFormError(null)

    if (editing === null && position === String(nextPositionFor(menus, parentId))) {
      setPosition(String(nextPositionFor(menus, nextParentId)))
    }
  }

  function showFormError(message: string) {
    setFormError(message)

    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  async function handleSave() {
    if (isSaving) return

    setFormError(null)

    if (!check.ok) {
      showFormError(draftFailureMessages[check.reason])
      return
    }

    setIsSaving(true)
    try {
      const error = await onSave(draft)
      if (error) showFormError(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-none items-start justify-between gap-3 border-b border-[var(--divider)] px-5 py-4">
        <div className="min-w-0">
          <Dialog.Title className="text-base font-bold text-[var(--text-heading)]">
            {editing ? 'Editar item de menu' : 'Novo item de menu'}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-xs text-[var(--settings-faint)]">
            {editing
              ? 'Atualização do item e da posição dele na estrutura do menu'
              : 'Cadastro de um item pai ou de um submenu'}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button aria-label="Fechar" size="icon" variant="ghost">
            <X size={18} />
          </Button>
        </Dialog.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5" ref={contentRef}>
        {formError ? (
          <div
            className="mb-4 rounded-lg border border-[var(--settings-danger-border)] bg-[var(--settings-danger-bg)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--settings-danger)]"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <NatureField
          canBeChild={canBeChild}
          hasChildren={isParentOfOthers}
          isChild={isChild}
          onChange={(next) =>
            changeParent(next === 'child' ? (parentOptions[0]?.id ?? null) : null)
          }
        />

        {isChild ? (
          <>
            <label className={fieldLabelClass} htmlFor={parentFieldId}>
              Menu pai <RequiredMark />
            </label>
            <select
              className={`${selectClass} mb-1.5`}
              id={parentFieldId}
              onChange={(event) => changeParent(event.target.value || null)}
              value={parentId ?? ''}
            >
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.menuId})
                </option>
              ))}
            </select>
            <HintText>
              O submenu aparece dentro deste item pai e só é concedido a um Perfil de Acesso junto
              com ele.
            </HintText>
          </>
        ) : null}

        <SectionTitle>Dados do item</SectionTitle>
        <FormInput
          label="Nome"
          onChange={(event) => {
            setName(event.target.value)
            setFormError(null)
          }}
          placeholder={isChild ? 'Ex.: Visão Geral' : 'Ex.: Ordens de Serviço'}
          required
          value={name}
        />

        <label className={fieldLabelClass} htmlFor={keyFieldId}>
          Chave do menu <RequiredMark />
        </label>
        <input
          autoComplete="off"
          className={`${fieldClass} mb-1.5`}
          id={keyFieldId}
          onChange={(event) => {
            setMenuKey(event.target.value)
            setFormError(null)
          }}
          placeholder={isChild ? 'Ex.: os.overview' : 'Ex.: os'}
          spellCheck={false}
          value={menuKey}
        />
        <KeyHint isTaken={!check.ok && check.reason === 'menu-key-taken'} />

        <div className="grid gap-x-4 sm:grid-cols-2">
          <FormInput
            inputMode="numeric"
            label="Posição"
            min={0}
            onChange={(event) => {
              setPosition(event.target.value)
              setFormError(null)
            }}
            required
            type="number"
            value={position}
          />
          <FormInput
            autoComplete="off"
            label="Ícone"
            onChange={(event) => {
              setIcon(event.target.value)
              setFormError(null)
            }}
            placeholder="Ex.: Wrench"
            spellCheck={false}
            value={icon}
          />
        </div>
        <HintText>
          A posição ordena o item entre os irmãos dele, do menor para o maior. O ícone é o nome de
          um ícone da biblioteca Lucide, e pode ficar em branco.
        </HintText>
      </div>

      <div className="flex flex-none justify-end gap-2.5 border-t border-[var(--divider)] px-5 py-4">
        <Button className={FOOTER_FOCUS_RING_CLASS} onClick={onClose} variant="secondary">
          Cancelar
        </Button>
        <Button
          className={FOOTER_FOCUS_RING_CLASS}
          disabled={!check.ok}
          loading={isSaving}
          onClick={handleSave}
          type="button"
        >
          {isSaving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar item'}
        </Button>
      </div>
    </>
  )
}

function NatureField({
  canBeChild,
  hasChildren,
  isChild,
  onChange,
}: {
  canBeChild: boolean
  hasChildren: boolean
  isChild: boolean
  onChange: (nature: 'root' | 'child') => void
}) {
  const name = useId()

  return (
    <>
      <span className={fieldLabelClass}>
        Tipo do item <RequiredMark />
      </span>
      <div className="mb-1.5 grid gap-2 sm:grid-cols-2">
        <NatureOption
          checked={!isChild}
          description="Grupo de primeiro nível do menu, como um departamento."
          groupName={name}
          label="Item pai"
          onSelect={() => onChange('root')}
        />
        <NatureOption
          checked={isChild}
          description="Página dentro de um item pai."
          disabled={!canBeChild}
          groupName={name}
          label="Submenu"
          onSelect={() => onChange('child')}
        />
      </div>
      <HintText tone={hasChildren ? 'attention' : 'neutral'}>
        {hasChildren
          ? 'Este item já tem submenus e por isso só pode existir como item pai. Mova os submenus dele para outro pai antes de rebaixá-lo.'
          : canBeChild
            ? 'O portal reconhece dois níveis de menu: itens pai e os submenus diretos deles.'
            : 'Ainda não existe nenhum item pai cadastrado. Cadastre um antes de criar submenus.'}
      </HintText>
    </>
  )
}

function NatureOption({
  checked,
  description,
  disabled = false,
  groupName,
  label,
  onSelect,
}: {
  checked: boolean
  description: string
  disabled?: boolean
  groupName: string
  label: string
  onSelect: () => void
}) {
  const id = useId()

  return (
    <label
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
        disabled
          ? 'cursor-not-allowed border-[var(--divider)] bg-[var(--settings-tint)] opacity-60'
          : checked
            ? 'cursor-pointer border-[var(--settings-faint)] bg-[var(--settings-tint)]'
            : 'cursor-pointer border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--hover-bg)]'
      }`}
      htmlFor={id}
    >
      <input
        checked={checked}
        className="mt-0.5 h-4 w-4 flex-none cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
        disabled={disabled}
        id={id}
        name={groupName}
        onChange={onSelect}
        type="radio"
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-[var(--text-item)]">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-4 text-[var(--settings-muted)]">{description}</span>
      </span>
    </label>
  )
}

function KeyHint({ isTaken }: { isTaken: boolean }) {
  if (isTaken) {
    return (
      <HintText tone="attention">
        Esta chave já pertence a outro item de menu. A chave é única em todo o serviço, inclusive
        entre itens de pais diferentes.
      </HintText>
    )
  }

  return (
    <HintText>
      Identificador do item no serviço, da forma que você decidir. Ele só precisa ser único entre
      todos os itens de menu.
    </HintText>
  )
}

const FIELD_BORDER_CLASS = 'border-[var(--border)] focus:outline-none focus:border-[var(--settings-muted)]'
const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-semibold text-[var(--text-item)]'
const fieldClass = `w-full rounded-lg border ${FIELD_BORDER_CLASS} bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--settings-faint)]`
const selectClass = `w-full cursor-pointer rounded-lg border ${FIELD_BORDER_CLASS} bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--text-primary)]`

const FOOTER_FOCUS_RING_CLASS = 'focus-visible:ring-[var(--settings-muted)]'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 mt-1 border-b border-[var(--divider)] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[var(--settings-muted)] first:mt-0">
      {children}
    </div>
  )
}

function HintText({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'attention'
}) {
  return (
    <p
      className={`mb-4 text-[11.5px] leading-4 ${
        tone === 'attention' ? 'font-medium text-[var(--settings-warn)]' : 'text-[var(--settings-faint)]'
      }`}
    >
      {children}
    </p>
  )
}

function FormInput({
  label,
  required,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-4 block">
      <span className={fieldLabelClass}>
        {label} {required ? <RequiredMark /> : null}
      </span>
      <input aria-required={required || undefined} className={fieldClass} {...props} />
    </label>
  )
}
