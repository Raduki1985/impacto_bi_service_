import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { type ReactNode, useId, useRef, useState } from 'react'

import { Button } from '../../components/ui/button'
import {
  checkProfileMenuDraft,
  hasChildren,
  nextPositionFor,
  parentOptionsFor,
  type ProfileMenuDraft,
} from '../../services/profileMenus/profileMenuRules'
import type { CoreProfileMenu } from '../../types/coreApi'
import { modalOverlayClass, modalShellClass, RequiredMark } from '../AccessProfilesPreview/accessProfilesUi'
import { draftFailureMessages } from './menuItemMessages'

/**
 * Formulário de item de menu, em modal central, no mesmo traço do formulário de
 * Usuários: superfície, overlay, cabeçalho fixo com Fechar, conteúdo com
 * rolagem própria e rodapé fixo com Cancelar e Salvar. Foco preso, Escape e
 * devolução do foco vêm do Dialog do Radix.
 *
 * O campo que define a natureza do item vem PRIMEIRO, e não no fim: ele decide
 * o que os campos seguintes significam. `Item pai` é um grupo do menu, e
 * `Submenu` é um item dentro de um grupo. Escolher isso depois de preencher o
 * resto obrigaria a voltar e corrigir.
 *
 * A `Chave do menu` é TEXTO LIVRE. O campo oferecia, em um `datalist`, os ids
 * dos departamentos do portal para um item pai e as chaves das páginas daquele
 * departamento para um submenu, e explicava por escrito que uma chave fora
 * dessa lista não concederia nada. As duas coisas saíram: a lista era do
 * catálogo do portal, e a chave é do serviço. Quem cadastra escreve o que
 * decidir, e a única recusa que sobra é a chave vazia ou já usada por outro
 * item.
 */

/** Modal fechado (null), cadastrando, ou editando um item existente. */
export type MenuItemFormMode = { mode: 'create' } | { mode: 'edit'; menu: CoreProfileMenu }

export function MenuItemFormModal({
  form,
  menus,
  onOpenChange,
  onSave,
}: {
  form: MenuItemFormMode | null
  /** Coleção completa, que alimenta os pais oferecidos e a conferência da chave. */
  menus: readonly CoreProfileMenu[]
  onOpenChange: (open: boolean) => void
  /** Persiste; devolve a mensagem de erro, ou null no sucesso. */
  onSave: (draft: ProfileMenuDraft) => Promise<string | null>
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={form !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className={modalOverlayClass} />
        <Dialog.Content
          className={`${modalShellClass} max-h-[92vh] max-w-[calc(100vw-24px)] sm:max-h-[88vh] sm:w-[600px]`}
        >
          {/* A key remonta o corpo a cada alvo: o formulário nasce preenchido (ou
              vazio) e nem rascunho nem erro da abertura anterior atravessam. */}
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
  menus: readonly CoreProfileMenu[]
  onClose: () => void
  onSave: (draft: ProfileMenuDraft) => Promise<string | null>
}) {
  const editing = form.mode === 'edit' ? form.menu : null
  const editingId = editing?.id ?? null

  const [name, setName] = useState(editing?.name ?? '')
  const [menuKey, setMenuKey] = useState(editing?.menu_id ?? '')
  const [icon, setIcon] = useState(editing?.icon ?? '')
  const [parentId, setParentId] = useState<string | null>(editing?.profile_menu_id ?? null)
  const [position, setPosition] = useState(
    String(editing?.position ?? nextPositionFor(menus, null)),
  )
  const [formError, setFormError] = useState<string | null>(null)
  /** Gravação em andamento: um segundo clique cadastraria o mesmo item duas vezes. */
  const [isSaving, setIsSaving] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const keyFieldId = useId()
  const parentFieldId = useId()

  /**
   * Pais oferecidos. Vazio significa que não existe raiz alguma para receber o
   * item, ou que este item já tem submenus — os dois casos são explicados por
   * escrito, em vez de virarem um seletor vazio sem motivo.
   */
  const parentOptions = parentOptionsFor(menus, editingId)
  const canBeChild = parentOptions.length > 0
  /**
   * Item que já tem submenus, e por isso está preso a item pai.
   *
   * Perguntado direto à coleção, e não deduzido de `parentOptions` estar vazia:
   * a lista também vem vazia quando simplesmente não existe outra raiz para
   * receber o item, e são dois motivos diferentes, com saídas diferentes.
   */
  const isParentOfOthers = editingId !== null && hasChildren(menus, editingId)

  const isChild = parentId !== null

  const draft: ProfileMenuDraft = { name, menuKey, position, icon, parentId }
  const check = checkProfileMenuDraft(draft, menus, editingId)

  /**
   * Troca entre item pai e submenu.
   *
   * A posição sugerida acompanha a troca, mas SOMENTE na criação e somente
   * enquanto ela ainda é a sugestão: os irmãos passam a ser outros, e manter o
   * número do conjunto anterior colocaria o item em um lugar que ninguém
   * escolheu. Um número digitado à mão, e a posição de um item que já existe,
   * permanecem intocados.
   */
  function changeParent(nextParentId: string | null) {
    setParentId(nextParentId)
    setFormError(null)

    if (editing === null && position === String(nextPositionFor(menus, parentId))) {
      setPosition(String(nextPositionFor(menus, nextParentId)))
    }
  }

  /**
   * Publica o erro e devolve o topo do conteúdo ao campo de visão: a mensagem
   * fica acima do formulário e o botão vive no rodapé fixo, então uma recusa
   * disparada com o modal rolado deixaria a mensagem fora da tela. Imperativo
   * de propósito: a mesma frase pode repetir em duas tentativas seguidas, e sem
   * mudança de estado não haveria novo render a que reagir.
   */
  function showFormError(message: string) {
    setFormError(message)

    if (contentRef.current) contentRef.current.scrollTop = 0
  }

  async function handleSave() {
    if (isSaving) return

    setFormError(null)

    // Rede de segurança: o botão já fica desabilitado com o rascunho inválido, e
    // o repositório confere de novo, contra a coleção recém-lida do serviço.
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
      <div className="flex flex-none items-start justify-between gap-3 border-b border-[#eef0f4] px-5 py-4">
        <div className="min-w-0">
          <Dialog.Title className="text-base font-bold text-[#101828]">
            {editing ? 'Editar item de menu' : 'Novo item de menu'}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-xs text-[#98a2b3]">
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
            className="mb-4 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3.5 py-2 text-[12.5px] font-medium text-[#b42318]"
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
                  {option.name} ({option.menu_id})
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
        {/* Campo aberto, sem `list`: não existe conjunto de chaves aceitas a
            oferecer. O que o serviço exige de `menu_id` é ser preenchido e não
            repetir o de outro item, e é só isso que a dica abaixo informa. */}
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

      <div className="flex flex-none justify-end gap-2.5 border-t border-[#eef0f4] px-5 py-4">
        <Button className={FOOTER_FOCUS_RING_CLASS} onClick={onClose} variant="secondary">
          Cancelar
        </Button>
        {/* `loading` troca o botão travado por um botão trabalhando: a gravação
            passa pelo serviço, e sem esse sinal o modal fica idêntico ao de antes
            do clique enquanto a resposta não chega. */}
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

/**
 * Item pai ou submenu, o campo que decide o que todos os outros significam.
 *
 * Dois botões de rádio, e não um seletor: são duas opções fixas, e a escolha
 * muda o formulário à vista: `Submenu` abre o campo do pai e troca as chaves
 * sugeridas. A opção indisponível é desabilitada com o motivo escrito ao lado,
 * porque um rádio que simplesmente não reage ao clique não ensina nada.
 */
function NatureField({
  canBeChild,
  hasChildren,
  isChild,
  onChange,
}: {
  canBeChild: boolean
  /** true quando o item editado tem submenus e por isso está preso a item pai. */
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
          ? 'cursor-not-allowed border-[#eef0f4] bg-[#f9fafb] opacity-60'
          : checked
            ? 'cursor-pointer border-[#98a2b3] bg-[#f6f8fb]'
            : 'cursor-pointer border-[#dfe3ec] bg-white hover:bg-[#f9fafb]'
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
        <span className="block text-[12.5px] font-semibold text-[#344054]">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-4 text-[#667085]">{description}</span>
      </span>
    </label>
  )
}

/**
 * A única exigência que sobrou para a chave: existir, e ser dela.
 *
 * A dica listava as chaves do catálogo do portal já cadastradas e avisava
 * quando a chave do pai não correspondia a departamento nenhum. As duas frases
 * descreviam uma lista de valores esperados que não existe mais.
 *
 * O aviso de chave repetida CONTINUA, porque descreve o serviço e não o
 * catálogo: `menu_id` é único em toda a tabela `profile_menu`, não por pai, e o
 * 409 é a recusa menos previsível deste formulário. Ele fala da chave que está
 * digitada agora, e não de uma lista.
 */
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

/* -------------------------------------------------------------------------- */
/* Peças do formulário                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mesmas classes de campo da aba Usuários, e pelo mesmo motivo: o painel das
 * Configurações é branco fixo nos dois temas, então cor de texto e de fundo
 * precisam ser literais. O contorno nativo é suprimido porque é desenhado por
 * fora da borda e engrossaria o campo ao receber o foco; no lugar dele, a borda
 * escurece.
 */
const FIELD_BORDER_CLASS = 'border-[#dfe3ec] focus:outline-none focus:border-[#667085]'
const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-semibold text-[#344054]'
const fieldClass = `w-full rounded-lg border ${FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331] placeholder:text-[#98a2b3]`
const selectClass = `w-full cursor-pointer rounded-lg border ${FIELD_BORDER_CLASS} bg-white px-3 py-2.5 text-[13px] text-[#1a2331]`

/** Cor do anel de foco por teclado do rodapé, como no formulário de Usuários. */
const FOOTER_FOCUS_RING_CLASS = 'focus-visible:ring-[#667085]'

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 mt-1 border-b border-[#eef0f4] pb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#667085] first:mt-0">
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
        tone === 'attention' ? 'font-medium text-[#b54708]' : 'text-[#98a2b3]'
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
      {/* `aria-required` em vez do atributo nativo: o modal não é um `form` que
          submete, então o `required` do HTML não validaria nada. */}
      <input aria-required={required || undefined} className={fieldClass} {...props} />
    </label>
  )
}
