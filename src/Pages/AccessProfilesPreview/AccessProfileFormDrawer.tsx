import * as Dialog from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { STANDARD_ACCESS_PROFILE_AUDIENCES } from '../../lib/accessProfileRules'
import { profileColorClasses } from '../../lib/profileColors'
import type { StandardAccessProfileAudience } from '../../types/access'
import {
  accessProfileAudienceLabels,
  accessProfileAudienceProfiles,
  buildCatalogDepartments,
  CORPORATE_ACCESS_LABEL,
  pageSelectionKey,
  selectionFromDepartments,
  type PreviewProfile,
  type PreviewUser,
} from './accessProfilesPreviewModel'
import {
  chipClass,
  countClass,
  DepartmentAccordion,
  fieldClass,
  fieldLabelClass,
  formModalClass,
  InDevelopmentBadge,
  modalOverlayClass,
  modalShellClass,
  ModalTabPanel,
  ModalTabs,
  SelectionCheckbox,
  sectionTitleClass,
  UserAvatar,
  type ModalTab,
} from './accessProfilesUi'
import { CorporateAccessBadge, DepartmentCoverageBadge } from './DepartmentCoverageChip'

/**
 * Modal central de criação e edição de perfil de acesso.
 *
 * O nome do arquivo ainda diz `Drawer` porque renomeá-lo é um movimento de Git,
 * e esta rodada não executa nenhum. O componente é um modal central: o drawer
 * lateral saiu.
 *
 * Ao contrário da consulta, este modal MANTÉM as três abas. Aqui elas trabalham:
 * são três tarefas distintas (nomear, conceder, atribuir), o conteúdo de cada
 * uma é longo e ninguém preenche as três ao mesmo tempo. A consulta é leitura, e
 * por isso virou uma página contínua.
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
 * porque é um acesso corporativo de Acesso do Sistema e Acesso Executivo, e não
 * página departamental que um perfil comum possa conceder.
 */

/** Identidade do perfil em edição no estado local; o rascunho tem a sua. */
export const DRAFT_PROFILE_ID = 'perfil-rascunho'

export type AccessProfileFormMode = { mode: 'create' } | { mode: 'edit'; profile: PreviewProfile }

const TABS: readonly ModalTab[] = [
  { id: 'dados', label: 'Dados gerais' },
  { id: 'acessos', label: 'Acessos' },
  { id: 'usuarios', label: 'Usuários' },
]

export function AccessProfileFormModal({
  audience,
  compatibleUsers,
  form,
  onAudienceChange,
  onOpenChange,
  onToggleUser,
  selectedUserIds,
}: {
  /**
   * Destino em vigor no formulário: o escolhido no rascunho ou o gravado no
   * perfil em edição. `null` só acontece na criação, antes da escolha.
   */
  audience: StandardAccessProfileAudience | null
  /**
   * Usuários que podem receber ESTE perfil, já filtrados pelo destino.
   * Administradores nunca entram aqui.
   */
  compatibleUsers: PreviewUser[]
  form: AccessProfileFormMode | null
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
  onOpenChange: (open: boolean) => void
  onToggleUser: (userId: string, selected: boolean) => void
  /** Selecionados para este perfil no estado local compartilhado da tela. */
  selectedUserIds: ReadonlySet<string>
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={form !== null}>
      <Dialog.Portal>
        <Dialog.Overlay className={modalOverlayClass} />
        {/* Mais largo que a consulta: aqui o catálogo inteiro é percorrido com
            caixas de seleção, e cada linha carrega rótulo, estado e contagem.
            A altura é fixa nas três abas, e não acompanha o conteúdo: ver
            `formModalClass`. */}
        <Dialog.Content className={`${modalShellClass} ${formModalClass}`}>
          {form ? (
            <FormBody
              audience={audience}
              compatibleUsers={compatibleUsers}
              form={form}
              // Trocar de perfil remonta o corpo, e com ele o estado local: o
              // formulário nunca abre mostrando a seleção do perfil anterior.
              key={form.mode === 'edit' ? form.profile.id : DRAFT_PROFILE_ID}
              onAudienceChange={onAudienceChange}
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
  audience,
  compatibleUsers,
  form,
  onAudienceChange,
  onClose,
  onToggleUser,
  selectedUserIds,
}: {
  audience: StandardAccessProfileAudience | null
  compatibleUsers: PreviewUser[]
  form: AccessProfileFormMode
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
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
      {/* Cabeçalho fixo: uma linha de título e uma de apoio. O que descreve o
          perfil mora no conteúdo, não aqui. */}
      <div className="flex flex-none items-center justify-between gap-3 px-5 pb-2 pt-4">
        <div className="min-w-0">
          <Dialog.Title className="text-[16px] font-bold leading-tight text-[#172033]">
            {isEditing ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}
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

      <ModalTabs activeTabId={activeTab} baseId={baseId} onTabChange={setActiveTab} tabs={TABS} />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'dados' ? (
          <ModalTabPanel baseId={baseId} tabId="dados">
            <GeneralDataTab
              audience={audience}
              baseId={baseId}
              description={description}
              isEditing={isEditing}
              name={name}
              onAudienceChange={onAudienceChange}
              onDescriptionChange={setDescription}
              onNameChange={setName}
            />
          </ModalTabPanel>
        ) : null}
        {activeTab === 'acessos' ? (
          <ModalTabPanel baseId={baseId} tabId="acessos">
            <AccessTab
              catalog={catalog}
              // A Visão Geral Executiva é do Administrador e do Executivo por
              // regra do portal, e não uma página que o perfil conceda: quando o
              // destino é Executivos ela aparece como acesso já concedido, e
              // quando é Analistas ela simplesmente não existe.
              hasCorporateAccess={audience === 'executive'}
              onTogglePage={togglePage}
              selection={selectedPages}
            />
          </ModalTabPanel>
        ) : null}
        {activeTab === 'usuarios' ? (
          <ModalTabPanel baseId={baseId} tabId="usuarios">
            <UsersTab
              audience={audience}
              baseId={baseId}
              compatibleUsers={compatibleUsers}
              onToggleUser={onToggleUser}
              selectedUserIds={selectedUserIds}
            />
          </ModalTabPanel>
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

/**
 * Placeholder do destino, como valor vazio do próprio `select`.
 *
 * A opção fica desabilitada depois de aberta a lista: ela é o estado inicial,
 * e não uma terceira escolha possível. Um perfil sem destino não é um perfil
 * "de todos", é um perfil incompleto.
 */
const AUDIENCE_PLACEHOLDER = ''

/**
 * Destino do perfil, obrigatório e escolhido uma única vez.
 *
 * Na criação é um `select` real, com as duas únicas opções que um perfil comum
 * aceita, na ordem do domínio (`STANDARD_ACCESS_PROFILE_AUDIENCES`).
 * Administradores não aparecem: eles só recebem `Acesso do Sistema`, e oferecer
 * a opção ensinaria que existe um segundo perfil administrativo.
 *
 * Na edição o mesmo campo aparece no mesmo lugar, desabilitado e com a
 * orientação escrita ao lado. Trocar o destino de um perfil em uso mudaria de
 * uma vez o acesso de todos os usuários vinculados a ele, e por isso o domínio
 * não expõe o campo no rascunho de edição.
 *
 * O badge repete o destino com a cor oficial do Perfil do Sistema, a mesma da
 * tabela de Usuários: é o que liga visualmente este campo à aba Usuários, que
 * passa a mostrar apenas pessoas daquele perfil.
 */
function AudienceField({
  audience,
  fieldId,
  isEditing,
  onAudienceChange,
}: {
  audience: StandardAccessProfileAudience | null
  fieldId: string
  isEditing: boolean
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
}) {
  const hintId = `${fieldId}-hint`

  return (
    <div>
      <label className={fieldLabelClass} htmlFor={fieldId}>
        Destinado a{' '}
        <span className="font-normal text-[#667085]">
          {isEditing ? '(definido na criação)' : '(obrigatório)'}
        </span>
      </label>
      <select
        aria-describedby={isEditing ? hintId : undefined}
        aria-required={isEditing ? undefined : true}
        className={`${fieldClass} cursor-pointer disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#667085]`}
        disabled={isEditing}
        id={fieldId}
        onChange={(event) => {
          const value = event.target.value
          if (value === AUDIENCE_PLACEHOLDER) return

          onAudienceChange(value as StandardAccessProfileAudience)
        }}
        value={audience ?? AUDIENCE_PLACEHOLDER}
      >
        <option disabled value={AUDIENCE_PLACEHOLDER}>
          Selecione o Perfil do Sistema
        </option>
        {STANDARD_ACCESS_PROFILE_AUDIENCES.map((option) => (
          <option key={option} value={option}>
            {accessProfileAudienceLabels[option]}
          </option>
        ))}
      </select>
      {audience === null ? null : (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`${chipClass} flex-none ${
              profileColorClasses[accessProfileAudienceProfiles[audience]]
            }`}
          >
            {accessProfileAudienceLabels[audience]}
          </span>
          {isEditing ? (
            <span className="text-[11.5px] leading-4 text-[#667085]" id={hintId}>
              O destino não pode ser alterado após a criação.
            </span>
          ) : null}
        </p>
      )}
    </div>
  )
}

function GeneralDataTab({
  audience,
  baseId,
  description,
  isEditing,
  name,
  onAudienceChange,
  onDescriptionChange,
  onNameChange,
}: {
  audience: StandardAccessProfileAudience | null
  baseId: string
  description: string
  isEditing: boolean
  name: string
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
  onDescriptionChange: (value: string) => void
  onNameChange: (value: string) => void
}) {
  const nameId = `${baseId}-profile-name`
  const descriptionId = `${baseId}-profile-description`
  const audienceId = `${baseId}-profile-audience`

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
      <AudienceField
        audience={audience}
        fieldId={audienceId}
        isEditing={isEditing}
        onAudienceChange={onAudienceChange}
      />
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

/**
 * Seleção de departamentos e páginas.
 *
 * Uma lista e nada em cima dela. Os três indicadores que existiam aqui
 * contavam a própria seleção que estava logo abaixo, e mudavam a cada clique
 * sem responder nada: quem está escolhendo páginas olha para as caixas
 * marcadas, não para um total no topo.
 *
 * O acordeão fechado mostra um label de cobertura compacto, `8/9`, com a mesma
 * identidade dos labels da página e do modal de consulta: é o que permite
 * reconhecer os departamentos já compostos sem abrir um por um, e é a mesma
 * leitura que o Administrador já faz na coleção. Um departamento sem nenhuma
 * página escolhida mostra `0/10`, e não some.
 *
 * O denominador são as páginas DISPONÍVEIS do departamento, e não todas as do
 * catálogo: uma página em desenvolvimento não pode ser liberada, e contá-la no
 * total faria a cobertura completa parecer incompleta para sempre. O estado
 * individual continua ao lado de cada página que ainda não abre.
 */
function AccessTab({
  catalog,
  hasCorporateAccess,
  onTogglePage,
  selection,
}: {
  catalog: ReturnType<typeof buildCatalogDepartments>
  /** Visão Geral Executiva concedida pelo destino, e não pela seleção. */
  hasCorporateAccess: boolean
  onTogglePage: (key: string, selected: boolean) => void
  selection: ReadonlySet<string>
}) {
  return (
    <div>
      {/* Acesso automático, e por isso fora da lista de caixas de seleção: ele
          não é escolhido aqui, é consequência do destino. Uma caixa marcada e
          travada convidaria a desmarcá-la, e uma desmarcável mentiria sobre a
          regra do portal. */}
      {hasCorporateAccess ? (
        <div className="mb-4">
          <div className={sectionTitleClass}>Acesso automático</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <CorporateAccessBadge label={CORPORATE_ACCESS_LABEL} />
            <span className="text-[11.5px] leading-4 text-[#667085]">
              Concedida pelo portal a perfis destinados a Executivos. Não é selecionável nem pode
              ser retirada.
            </span>
          </div>
        </div>
      ) : null}

      <div className={sectionTitleClass}>Departamentos e páginas</div>
      <ul className="mt-2 grid gap-1.5">
        {catalog.map((department) => {
          const total = department.pageTotals.available
          const granted = department.pages.filter(
            (page) =>
              !page.inDevelopment &&
              selection.has(pageSelectionKey(department.departmentId, page.pageKey)),
          ).length
          const percent = total === 0 ? 0 : Math.min(100, (granted / total) * 100)

          return (
            <li key={department.departmentId}>
              <DepartmentAccordion
                label={department.label}
                meta={
                  <DepartmentCoverageBadge
                    accessibleLabel={`${department.label}: ${granted} de ${total} ${
                      total === 1 ? 'página liberada' : 'páginas liberadas'
                    }`}
                    fraction={`${granted}/${total}`}
                    percent={percent}
                  />
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

/**
 * Atribuição de usuários, sempre dentro do destino do perfil.
 *
 * A lista só existe depois que o destino existe: um perfil destinado a
 * Executivos não pode receber Analista nenhum, e oferecer a lista inteira antes
 * da escolha faria o Administrador selecionar pessoas que a escolha seguinte
 * teria de descartar. Sem destino, a aba diz o que falta e onde resolver.
 *
 * A busca opera sobre os usuários compatíveis, e não sobre a coleção: procurar
 * pelo nome de um Analista em um perfil executivo não deve encontrá-lo, porque
 * encontrá-lo sugeriria que ele poderia ser selecionado.
 */
function UsersTab({
  audience,
  baseId,
  compatibleUsers,
  onToggleUser,
  selectedUserIds,
}: {
  audience: StandardAccessProfileAudience | null
  baseId: string
  compatibleUsers: PreviewUser[]
  onToggleUser: (userId: string, selected: boolean) => void
  selectedUserIds: ReadonlySet<string>
}) {
  const searchId = `${baseId}-user-search`
  const [term, setTerm] = useState('')

  const matches = useMemo(() => {
    const key = searchKey(term.trim())

    if (!key) return compatibleUsers

    return compatibleUsers.filter(
      (user) => searchKey(user.name).includes(key) || searchKey(user.email).includes(key),
    )
  }, [compatibleUsers, term])

  if (audience === null) {
    return (
      <div className="rounded-lg border border-[#f3d9a5] bg-[#fffaf0] px-4 py-3.5">
        <p className="text-[12.5px] font-semibold text-[#7a5a12]">Escolha o destino primeiro</p>
        <p className="mt-1 text-[12px] leading-5 text-[#8a6a2a]">
          Em Dados gerais, informe em <strong className="font-semibold">Destinado a</strong> se este
          Perfil de Acesso é de Executivos ou de Analistas. A lista de usuários mostra apenas
          pessoas compatíveis com o destino escolhido.
        </p>
      </div>
    )
  }

  const selectedUsers = matches.filter((user) => selectedUserIds.has(user.id))
  const otherUsers = matches.filter((user) => !selectedUserIds.has(user.id))

  return (
    <div className="grid gap-5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4 text-[#667085]">
        <span>Apenas usuários com o Perfil do Sistema</span>
        <span
          className={`${chipClass} flex-none ${
            profileColorClasses[accessProfileAudienceProfiles[audience]]
          }`}
        >
          {accessProfileAudienceProfiles[audience]}
        </span>
      </p>

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

      {/* Dois grupos rotulados, e não duas caixas: o que separa quem já está no
          perfil de quem ainda não está é o rótulo com a contagem, o filete sob
          ele e o fundo azul claro das linhas selecionadas. Duas molduras
          fechadas somavam bordas sem somar leitura. */}
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
    <section>
      <div className="flex items-baseline justify-between gap-2 border-b border-[#eef0f4] pb-1.5">
        <span className={sectionTitleClass}>{title}</span>
        <span className={`text-[11.5px] font-semibold text-[#667085] ${countClass}`}>
          {users.length}
        </span>
      </div>
      {users.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-[#667085]">{emptyLabel}</p>
      ) : (
        <ul className="mt-1 grid gap-0.5">
          {users.map((user) => (
            <li
              className={`rounded-md px-2 ${
                selected ? 'bg-[#f5f8ff]' : 'transition hover:bg-[#f8fafc]'
              }`}
              key={user.id}
            >
              <SelectionCheckbox
                checked={selected}
                label={
                  <span className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar initials={user.initials} profile={user.profile} size={28} />
                    <span className="min-w-0">
                      <span className="block break-words text-[12.5px] text-[#172033]">
                        {user.name}
                      </span>
                      <span className="block break-all text-[11px] leading-4 text-[#667085]">
                        {user.email}
                      </span>
                    </span>
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
