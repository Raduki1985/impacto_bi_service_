import * as Dialog from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { profileColorClasses } from '../../lib/profileColors'
import {
  buildCatalogDepartments,
  pageSelectionKey,
  selectionFromDepartments,
  summarizeCatalogSelection,
  type PreviewProfile,
  type PreviewUser,
} from './accessProfilesPreviewModel'
import {
  chipClass,
  countClass,
  DepartmentAccordion,
  DrawerTabPanel,
  DrawerTabs,
  fieldClass,
  fieldLabelClass,
  InDevelopmentBadge,
  SelectionCheckbox,
  sectionTitleClass,
  type DrawerTab,
} from './accessProfilesUi'

/**
 * Formulário visual de perfil de acesso, em modo Novo e em modo Editar.
 *
 * As interações existem para a composição poder ser avaliada: o nome e a
 * descrição são digitáveis, as páginas e os usuários são realmente
 * selecionáveis e a busca de usuários filtra de verdade. Tudo isso vive em
 * estado local da tela e desaparece com ela: nenhum perfil é criado, nenhum
 * usuário é alterado, nenhum repositório é chamado e nada é gravado. O botão de
 * salvar existe desabilitado para mostrar onde ficará.
 *
 * A página inicial não aparece aqui: o campo existe no domínio persistido, mas
 * não faz parte desta composição. A Visão Geral Executiva também não aparece,
 * porque é um acesso corporativo de Acesso Total e Acesso Executivo, e não uma
 * página departamental que um perfil comum possa conceder.
 */

/** Identidade do perfil em edição no estado local; o rascunho tem a sua. */
export const DRAFT_PROFILE_ID = 'perfil-rascunho'

export type AccessProfileFormMode = { mode: 'create' } | { mode: 'edit'; profile: PreviewProfile }

const TABS: readonly DrawerTab[] = [
  { id: 'dados', label: 'Dados gerais' },
  { id: 'acessos', label: 'Acessos' },
  { id: 'usuarios', label: 'Usuários' },
]

export function AccessProfileFormDrawer({
  assignableUsers,
  form,
  onOpenChange,
  onToggleUser,
  selectedUserIds,
}: {
  /** Usuários que podem pertencer a perfis comuns. Administradores já ficam de fora. */
  assignableUsers: PreviewUser[]
  form: AccessProfileFormMode | null
  onOpenChange: (open: boolean) => void
  onToggleUser: (userId: string, selected: boolean) => void
  /** Selecionados para este perfil no estado local compartilhado da tela. */
  selectedUserIds: ReadonlySet<string>
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={form !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        {/* 640px: o formulário não precisa de mais que o drawer de consulta.
            Os rótulos do catálogo cabem nessa largura e o painel deixa de cobrir
            metade da tela. max-w-[94vw] mantém quase a tela inteira no celular,
            sem nunca gerar rolagem horizontal. */}
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[640px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_34px_rgba(16,24,40,.18)]">
          {form ? (
            <FormBody
              assignableUsers={assignableUsers}
              form={form}
              // Trocar de perfil remonta o corpo, e com ele o estado local: o
              // formulário nunca abre mostrando a seleção do perfil anterior.
              key={form.mode === 'edit' ? form.profile.id : DRAFT_PROFILE_ID}
              onClose={() => onOpenChange(false)}
              onToggleUser={onToggleUser}
              selectedUserIds={selectedUserIds}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FormBody({
  assignableUsers,
  form,
  onClose,
  onToggleUser,
  selectedUserIds,
}: {
  assignableUsers: PreviewUser[]
  form: AccessProfileFormMode
  onClose: () => void
  onToggleUser: (userId: string, selected: boolean) => void
  selectedUserIds: ReadonlySet<string>
}) {
  const baseId = useId()
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id)
  const isEditing = form.mode === 'edit'

  const [name, setName] = useState(isEditing ? form.profile.name : '')
  const [description, setDescription] = useState(isEditing ? form.profile.description : '')

  // Catálogo oficial completo, igual nos dois modos: o que muda é a seleção
  // inicial, vazia no rascunho e igual ao acesso atual do perfil na edição.
  const catalog = useMemo(() => buildCatalogDepartments(), [])
  const [selectedPages, setSelectedPages] = useState<ReadonlySet<string>>(() =>
    isEditing ? selectionFromDepartments(form.profile.departments) : new Set<string>(),
  )

  function togglePage(key: string, selected: boolean) {
    setSelectedPages((current) => {
      const next = new Set(current)

      if (selected) next.add(key)
      else next.delete(key)

      return next
    })
  }

  return (
    <>
      {/* Cabeçalho compacto: uma linha de título e uma de apoio. O que descreve
          o perfil mora no conteúdo, não aqui. */}
      <div className="flex flex-none items-center justify-between gap-3 px-5 pb-2 pt-3">
        <div className="min-w-0">
          <Dialog.Title className="text-[15px] font-bold leading-tight text-[#172033]">
            {isEditing ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 truncate text-[11.5px] text-[#98a2b3]">
            {isEditing ? form.profile.name : 'Defina quais áreas e páginas o perfil libera'}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button aria-label="Fechar" size="icon" variant="ghost">
            <X aria-hidden="true" size={18} />
          </Button>
        </Dialog.Close>
      </div>

      <DrawerTabs activeTabId={activeTab} baseId={baseId} onTabChange={setActiveTab} tabs={TABS} />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'dados' ? (
          <DrawerTabPanel baseId={baseId} tabId="dados">
            <GeneralDataTab
              baseId={baseId}
              description={description}
              name={name}
              onDescriptionChange={setDescription}
              onNameChange={setName}
            />
          </DrawerTabPanel>
        ) : null}
        {activeTab === 'acessos' ? (
          <DrawerTabPanel baseId={baseId} tabId="acessos">
            <AccessTab catalog={catalog} onTogglePage={togglePage} selection={selectedPages} />
          </DrawerTabPanel>
        ) : null}
        {activeTab === 'usuarios' ? (
          <DrawerTabPanel baseId={baseId} tabId="usuarios">
            <UsersTab
              assignableUsers={assignableUsers}
              baseId={baseId}
              onToggleUser={onToggleUser}
              selectedUserIds={selectedUserIds}
            />
          </DrawerTabPanel>
        ) : null}
      </div>

      {/* Rodapé fixo: os dois botões continuam alcançáveis em qualquer aba. O
          botão de salvar existe desabilitado para mostrar onde ficará; este
          bloco não cria nem edita perfil. */}
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] bg-[#f6f8fb] px-5 py-2.5">
        <span className="text-[11.5px] text-[#667085]">
          Composição visual: nenhuma alteração é gravada.
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={onClose} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button disabled size="sm">
            {isEditing ? 'Salvar alterações' : 'Salvar perfil'}
          </Button>
        </div>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Dados gerais                                                               */
/* -------------------------------------------------------------------------- */

function GeneralDataTab({
  baseId,
  description,
  name,
  onDescriptionChange,
  onNameChange,
}: {
  baseId: string
  description: string
  name: string
  onDescriptionChange: (value: string) => void
  onNameChange: (value: string) => void
}) {
  const nameId = `${baseId}-profile-name`
  const descriptionId = `${baseId}-profile-description`

  return (
    <div className="grid gap-4">
      <div>
        <label className={fieldLabelClass} htmlFor={nameId}>
          Nome do Perfil de Acesso
        </label>
        <input
          className={fieldClass}
          id={nameId}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Ex.: Comercial"
          type="text"
          value={name}
        />
      </div>
      <div>
        <label className={fieldLabelClass} htmlFor={descriptionId}>
          Descrição <span className="font-normal text-[#667085]">(opcional)</span>
        </label>
        <textarea
          className={`${fieldClass} min-h-[84px] resize-none`}
          id={descriptionId}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Descreva o que este perfil libera."
          value={description}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Acessos                                                                    */
/* -------------------------------------------------------------------------- */

function AccessTab({
  catalog,
  onTogglePage,
  selection,
}: {
  catalog: ReturnType<typeof buildCatalogDepartments>
  onTogglePage: (key: string, selected: boolean) => void
  selection: ReadonlySet<string>
}) {
  const summary = summarizeCatalogSelection(catalog, selection)

  return (
    <div className="grid gap-4">
      {/* Os três números ficam separados de propósito: uma página em
          desenvolvimento pode ser selecionada, mas ainda não abre, e somá-la às
          disponíveis descreveria um acesso que o portal não entrega hoje. */}
      <dl className="grid gap-2 rounded-lg border border-[#eaecf2] bg-[#f6f8fb] px-3.5 py-3 sm:grid-cols-3">
        <SelectionStat label="Departamentos" value={summary.departmentCount} />
        <SelectionStat label="Páginas disponíveis" value={summary.availablePageCount} />
        <SelectionStat label="Em desenvolvimento" value={summary.inDevelopmentPageCount} />
      </dl>

      <div>
        <div className={sectionTitleClass}>Departamentos e páginas</div>
        <ul className="mt-2 grid gap-1.5">
          {catalog.map((department) => {
            const selectedPages = department.pages.filter((page) =>
              selection.has(pageSelectionKey(department.departmentId, page.pageKey)),
            )
            const selectedAvailable = selectedPages.filter((page) => !page.inDevelopment).length
            const selectedInDevelopment = selectedPages.length - selectedAvailable

            return (
              <li key={department.departmentId}>
                <DepartmentAccordion
                  label={department.label}
                  meta={
                    <>
                      <span className={countClass}>{selectedAvailable}</span> de{' '}
                      <span className={countClass}>{department.pageTotals.available}</span>{' '}
                      disponíveis
                      {selectedInDevelopment > 0 ? (
                        <>
                          {' · '}
                          <span className={countClass}>{selectedInDevelopment}</span> em
                          desenvolvimento
                        </>
                      ) : null}
                    </>
                  }
                >
                  <ul>
                    {department.pages.map((page) => {
                      const key = pageSelectionKey(department.departmentId, page.pageKey)

                      return (
                        <li key={page.pageKey}>
                          <SelectionCheckbox
                            checked={selection.has(key)}
                            label={
                              <span className={page.inDevelopment ? 'text-[#667085]' : undefined}>
                                {page.label}
                              </span>
                            }
                            onCheckedChange={(checked) => onTogglePage(key, checked)}
                            trailing={page.inDevelopment ? <InDevelopmentBadge /> : undefined}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </DepartmentAccordion>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function SelectionStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{label}</dt>
      <dd className={`mt-0.5 text-[15px] font-semibold text-[#172033] ${countClass}`}>{value}</dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Usuários                                                                   */
/* -------------------------------------------------------------------------- */

/** Busca tolerante a acento e a caixa, como se espera de um campo de nome. */
function searchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function UsersTab({
  assignableUsers,
  baseId,
  onToggleUser,
  selectedUserIds,
}: {
  assignableUsers: PreviewUser[]
  baseId: string
  onToggleUser: (userId: string, selected: boolean) => void
  selectedUserIds: ReadonlySet<string>
}) {
  const searchId = `${baseId}-user-search`
  const [term, setTerm] = useState('')

  const matches = useMemo(() => {
    const key = searchKey(term.trim())

    if (!key) return assignableUsers

    return assignableUsers.filter(
      (user) => searchKey(user.name).includes(key) || searchKey(user.email).includes(key),
    )
  }, [assignableUsers, term])

  const selectedUsers = matches.filter((user) => selectedUserIds.has(user.id))
  const otherUsers = matches.filter((user) => !selectedUserIds.has(user.id))

  return (
    <div className="grid gap-5">
      <div className="max-w-[420px]">
        <label className={fieldLabelClass} htmlFor={searchId}>
          Buscar usuário
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]"
            size={15}
          />
          <input
            className={`${fieldClass} pl-9`}
            id={searchId}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            type="search"
            value={term}
          />
        </div>
      </div>

      {/* Dois blocos fechados, e não duas listas seguidas: quem já está no
          perfil e quem ainda não está são leituras diferentes, e sem a moldura
          elas se misturavam em uma lista só. */}
      <UserGroup
        emptyLabel={
          term ? 'Nenhum usuário selecionado corresponde à busca.' : 'Nenhum usuário selecionado.'
        }
        onToggleUser={onToggleUser}
        selected
        title="Usuários selecionados"
        users={selectedUsers}
      />
      <UserGroup
        emptyLabel={term ? 'Nenhum outro usuário corresponde à busca.' : 'Nenhum outro usuário.'}
        onToggleUser={onToggleUser}
        selected={false}
        title="Outros usuários"
        users={otherUsers}
      />
    </div>
  )
}

function UserGroup({
  emptyLabel,
  onToggleUser,
  selected,
  title,
  users,
}: {
  emptyLabel: string
  onToggleUser: (userId: string, selected: boolean) => void
  selected: boolean
  title: string
  users: PreviewUser[]
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#eaecf2]">
      <div className="flex items-center justify-between gap-2 border-b border-[#eef0f4] bg-[#f6f8fb] px-3 py-2">
        <span className={sectionTitleClass}>{title}</span>
        <span className={`text-[11.5px] font-semibold text-[#667085] ${countClass}`}>
          {users.length}
        </span>
      </div>
      {users.length === 0 ? (
        <p className="px-3 py-2.5 text-[12.5px] text-[#667085]">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-[#f2f4f8] px-3">
          {users.map((user) => (
            <li key={user.id}>
              <SelectionCheckbox
                checked={selected}
                label={
                  <span className="block">
                    <span className="block break-words text-[12.5px] text-[#172033]">
                      {user.name}
                    </span>
                    <span className="block break-all text-[11px] text-[#667085]">{user.email}</span>
                  </span>
                }
                onCheckedChange={(checked) => onToggleUser(user.id, checked)}
                trailing={
                  <span className={`${chipClass} flex-none ${profileColorClasses[user.profile]}`}>
                    {user.profile}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
