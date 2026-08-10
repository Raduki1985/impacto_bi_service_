import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRightLeft, Lock, Search, X } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'

import { Button } from '../../components/ui/button'
import { STANDARD_ACCESS_PROFILE_AUDIENCES } from '../../lib/accessProfileRules'
import { profileColorClasses } from '../../lib/profileColors'
import type { DepartmentPageAccess, StandardAccessProfileAudience } from '../../types/access'
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
 * O salvamento é REAL: nome, descrição, concessões e atribuições são gravados em
 * uma operação só. Enquanto o modal está aberto, tudo vive em estado local e
 * nada é persistido; cancelar ou fechar descarta o rascunho inteiro.
 *
 * A página inicial não aparece aqui, e é deliberado: ela é calculada a partir
 * das páginas concedidas, na ordem oficial dos catálogos. Expor o campo
 * obrigaria o Administrador a escolher um detalhe técnico que a própria seleção
 * já responde, e permitiria apontar para uma página que o perfil não concede.
 *
 * A Visão Geral Executiva também não aparece como página selecionável, porque é
 * um acesso corporativo de Acesso do Sistema e Acesso Executivo, e não página
 * departamental que um perfil comum possa conceder.
 */

/** Identidade do perfil em edição no estado local; o rascunho tem a sua. */
export const DRAFT_PROFILE_ID = 'perfil-rascunho'

/**
 * Linha de seleção que o formulário NÃO decide, no mesmo desenho da caixa de
 * seleção comum.
 *
 * Cobre os dois estados em que a caixa existe para ser lida, e não para ser
 * clicada: a página em desenvolvimento, que o domínio recusa conceder, e o
 * usuário já vinculado a este perfil, que só sai dele por transferência. Nos dois
 * casos a caixa aparece desabilitada, e não some: o item continua na lista, e o
 * que muda é a possibilidade de agir sobre ele.
 *
 * É local ao formulário de propósito. `SelectionCheckbox` descreve uma escolha, e
 * acrescentar um estado bloqueado a ela mudaria o significado dela em todas as
 * telas que a usam.
 */
function FixedSelection({
  checked,
  label,
  trailing,
}: {
  checked: boolean
  label: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <input
        aria-disabled="true"
        checked={checked}
        className="h-4 w-4 flex-none cursor-not-allowed accent-[var(--accent)]"
        disabled
        readOnly
        type="checkbox"
      />
      <span className="min-w-0 flex-1 break-words text-[12.5px] text-[#475467]">{label}</span>
      {trailing}
    </div>
  )
}

export type AccessProfileFormMode = { mode: 'create' } | { mode: 'edit'; profile: PreviewProfile }

const TABS: readonly ModalTab[] = [
  { id: 'dados', label: 'Dados gerais' },
  { id: 'acessos', label: 'Acessos' },
  { id: 'usuarios', label: 'Usuários' },
]

/** Conteúdo que o formulário entrega para ser gravado. */
export type AccessProfileFormDraft = {
  name: string
  description: string
  departmentPageAccess: DepartmentPageAccess[]
}

/** Pessoa selecionada que já pertence a outro Perfil de Acesso. */
export type AccessProfileTransferNotice = {
  userId: string
  userName: string
  sourceProfileName: string
}

export function AccessProfileFormModal({
  audience,
  compatibleUsers,
  form,
  lockedUserIds,
  onAudienceChange,
  onOpenChange,
  onSave,
  onToggleUser,
  selectedUserIds,
  transferNotices,
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
  /**
   * Usuários JÁ VINCULADOS a este perfil na base.
   *
   * Eles aparecem marcados e não podem ser desmarcados aqui: retirar alguém de
   * um perfil sem dar outro a ele o deixaria sem acesso ao portal, e o
   * repositório recusa exatamente isso. Oferecer a desmarcação seria oferecer uma
   * ação que a gravação seguinte recusaria.
   */
  lockedUserIds: ReadonlySet<string>
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
  onOpenChange: (open: boolean) => void
  /** Persiste o perfil e as atribuições; devolve a mensagem de erro, ou null. */
  onSave: (draft: AccessProfileFormDraft) => string | null
  onToggleUser: (userId: string, selected: boolean) => void
  /** Selecionados para este perfil no estado local compartilhado da tela. */
  selectedUserIds: ReadonlySet<string>
  /** Transferências que a seleção atual realizará quando for salva. */
  transferNotices: readonly AccessProfileTransferNotice[]
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
              lockedUserIds={lockedUserIds}
              onAudienceChange={onAudienceChange}
              onClose={() => onOpenChange(false)}
              onSave={onSave}
              onToggleUser={onToggleUser}
              selectedUserIds={selectedUserIds}
              transferNotices={transferNotices}
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
  lockedUserIds,
  onAudienceChange,
  onClose,
  onSave,
  onToggleUser,
  selectedUserIds,
  transferNotices,
}: {
  audience: StandardAccessProfileAudience | null
  compatibleUsers: PreviewUser[]
  form: AccessProfileFormMode
  lockedUserIds: ReadonlySet<string>
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
  onClose: () => void
  onSave: (draft: AccessProfileFormDraft) => string | null
  onToggleUser: (userId: string, selected: boolean) => void
  selectedUserIds: ReadonlySet<string>
  transferNotices: readonly AccessProfileTransferNotice[]
}) {
  const baseId = useId()
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id)
  const isEditing = form.mode === 'edit'

  const [name, setName] = useState(isEditing ? form.profile.name : '')
  const [description, setDescription] = useState(isEditing ? form.profile.description : '')
  const [formError, setFormError] = useState<string | null>(null)

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

    setFormError(null)
  }

  /**
   * Concessões na forma que o domínio aceita, montadas a partir do catálogo e não
   * da seleção: é o catálogo que define a ordem dos departamentos e das páginas,
   * e derivar daqui garante que a gravação nunca carregue uma chave que o portal
   * não reconhece.
   *
   * Páginas em desenvolvimento ficam de fora porque não são selecionáveis: o
   * domínio recusa a concessão delas, e uma caixa marcada que a gravação recusa
   * seria uma promessa falsa.
   */
  const departmentPageAccess: DepartmentPageAccess[] = useMemo(
    () =>
      catalog.flatMap((department) => {
        const pageKeys = department.pages
          .filter(
            (page) =>
              !page.inDevelopment &&
              selectedPages.has(pageSelectionKey(department.departmentId, page.pageKey)),
          )
          .map((page) => page.pageKey)

        return pageKeys.length ? [{ departmentId: department.departmentId, pageKeys }] : []
      }),
    [catalog, selectedPages],
  )

  /**
   * O que ainda falta para o perfil poder ser gravado, ou null quando nada falta.
   *
   * São as três exigências do domínio que o formulário consegue antecipar: nome,
   * destino e ao menos uma página. Antecipá-las evita o clique que só devolveria
   * a mesma recusa, mas não substitui a validação do repositório, que continua
   * sendo quem decide.
   */
  const missingRequirement =
    name.trim() === ''
      ? 'Informe o nome do Perfil de Acesso.'
      : audience === null
        ? 'Escolha em Dados gerais a quem este Perfil de Acesso se destina.'
        : departmentPageAccess.length === 0
          ? 'Selecione ao menos uma página disponível em Acessos.'
          : null

  function handleSave() {
    if (missingRequirement) {
      setFormError(missingRequirement)
      return
    }

    const error = onSave({ name, description, departmentPageAccess })

    // Recusa mantém o modal aberto com tudo preenchido; o sucesso é o pai quem
    // fecha, ao zerar o formulário.
    setFormError(error)
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
              onAudienceChange={(next) => {
                onAudienceChange(next)
                setFormError(null)
              }}
              onDescriptionChange={setDescription}
              onNameChange={(value) => {
                setName(value)
                setFormError(null)
              }}
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
              lockedUserIds={lockedUserIds}
              onToggleUser={onToggleUser}
              selectedUserIds={selectedUserIds}
              transferNotices={transferNotices}
            />
          </ModalTabPanel>
        ) : null}
      </div>

      {/* Rodapé fixo: os dois botões continuam alcançáveis em qualquer aba. A
          recusa mora aqui, ao lado do botão que a produziu, e não no topo de uma
          aba que pode nem estar visível no momento do clique. */}
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] bg-[#f6f8fb] px-5 py-2.5">
        <span className="min-w-0 text-[11.5px] leading-4 text-[#667085]">
          {formError ? (
            <span className="font-medium text-[#b42318]" role="alert">
              {formError}
            </span>
          ) : (
            'Cancelar descarta tudo o que foi preenchido aqui.'
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={onClose} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={missingRequirement !== null} onClick={handleSave} size="sm">
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

                    // Página em desenvolvimento aparece na lista, porque existe
                    // no portal, mas não é selecionável: o domínio recusa a
                    // concessão dela, e uma caixa que a gravação recusaria
                    // prometeria um acesso que ninguém receberia.
                    if (page.inDevelopment) {
                      return (
                        <li key={page.pageKey}>
                          <FixedSelection
                            checked={false}
                            label={<span className="text-[#667085]">{page.label}</span>}
                            trailing={<InDevelopmentBadge />}
                          />
                        </li>
                      )
                    }

                    return (
                      <li key={page.pageKey}>
                        <SelectionCheckbox
                          checked={selection.has(key)}
                          label={page.label}
                          onCheckedChange={(checked) => onTogglePage(key, checked)}
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
  lockedUserIds,
  onToggleUser,
  selectedUserIds,
  transferNotices,
}: {
  audience: StandardAccessProfileAudience | null
  baseId: string
  compatibleUsers: PreviewUser[]
  lockedUserIds: ReadonlySet<string>
  onToggleUser: (userId: string, selected: boolean) => void
  selectedUserIds: ReadonlySet<string>
  transferNotices: readonly AccessProfileTransferNotice[]
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
  const hasLockedUsers = compatibleUsers.some((user) => lockedUserIds.has(user.id))

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

      {/* A retirada não acontece aqui, e por isso a orientação aparece antes da
          lista, e não como erro depois de uma tentativa. Cada usuário tem
          exatamente um Perfil de Acesso: tirá-lo deste sem colocá-lo em outro o
          deixaria sem acesso ao portal. */}
      {hasLockedUsers ? (
        <p className="flex items-start gap-2 rounded-lg border border-[#e4e7ee] bg-[#f6f8fb] px-3 py-2 text-[12px] leading-4 text-[#667085]">
          <Lock aria-hidden="true" className="mt-0.5 flex-none text-[#98a2b3]" size={13} />
          <span>
            Quem já está neste perfil aparece marcado e não pode ser desmarcado aqui. Para retirar
            alguém, abra o Perfil de Acesso de destino e selecione a pessoa lá: a transferência
            troca o vínculo sem deixar ninguém sem acesso.
          </span>
        </p>
      ) : null}

      {transferNotices.length > 0 ? (
        <section
          aria-live="polite"
          className="rounded-lg border border-[#f3d9a5] bg-[#fffaf0] px-3 py-2.5 text-[#7a5a12]"
        >
          <div className="flex items-start gap-2">
            <ArrowRightLeft aria-hidden="true" className="mt-0.5 flex-none" size={14} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold leading-4">
                {transferNotices.length === 1
                  ? 'Este colaborador será transferido ao salvar'
                  : `${transferNotices.length} colaboradores serão transferidos ao salvar`}
              </p>
              <p className="mt-1 text-[12px] leading-4 text-[#8a6a2a]">
                A transferência retira cada pessoa do Perfil de Acesso atual e a vincula a este
                perfil na mesma operação.
              </p>
              <ul className="mt-1.5 grid gap-0.5 text-[11.5px] leading-4 text-[#8a6a2a]">
                {transferNotices.map((notice) => (
                  <li key={notice.userId}>
                    <span className="font-semibold">{notice.userName}</span>
                    {' · sai de '}
                    {notice.sourceProfileName}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

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
        lockedUserIds={lockedUserIds}
        onToggleUser={onToggleUser}
        selected
        title="Usuários selecionados"
        users={selectedUsers}
      />
      <UserGroup
        emptyLabel={term ? 'Nenhum outro usuário corresponde à busca.' : 'Nenhum outro usuário.'}
        lockedUserIds={lockedUserIds}
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
  lockedUserIds,
  onToggleUser,
  selected,
  title,
  users,
}: {
  emptyLabel: string
  lockedUserIds: ReadonlySet<string>
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
          {users.map((user) => {
            const label = (
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
            )
            const trailing = (
              <span className={`${chipClass} flex-none ${profileColorClasses[user.profile]}`}>
                {user.profile}
              </span>
            )

            return (
              <li
                className={`rounded-md px-2 ${
                  selected ? 'bg-[#f5f8ff]' : 'transition hover:bg-[#f8fafc]'
                }`}
                key={user.id}
              >
                {lockedUserIds.has(user.id) ? (
                  <FixedSelection checked label={label} trailing={trailing} />
                ) : (
                  <SelectionCheckbox
                    checked={selected}
                    label={label}
                    onCheckedChange={(checked) => onToggleUser(user.id, checked)}
                    trailing={trailing}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
