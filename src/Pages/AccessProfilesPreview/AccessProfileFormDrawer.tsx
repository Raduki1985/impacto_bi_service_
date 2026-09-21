import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRightLeft, Check, Lock, Minus, Search, X } from 'lucide-react'
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
  defaultSelectionKeysOf,
  describeDepartmentSelectionState,
  pageSelectionKey,
  selectionFromDepartments,
  splitUsersByAudience,
  withDepartmentDefaultPages,
  withoutDepartmentPages,
  type CatalogDepartment,
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
  RequiredMark,
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

/**
 * Recusa da criação sem destino definido.
 *
 * O que falta é o destino, e não gente: um Perfil de Acesso pode nascer sem
 * nenhum usuário, e ser preenchido depois, mas nunca sem dizer a quem serve.
 *
 * Mora aqui e é exportada porque o mesmo bloqueio tem duas portas: o botão
 * travado neste formulário e a checagem da página no momento de gravar. As duas
 * precisam dizer a mesma coisa, e apontar para a aba Usuários, que é onde o
 * destino do perfil é decidido.
 */
export const MISSING_AUDIENCE_MESSAGE =
  'Defina em Usuários a quem este Perfil de Acesso se destina: escolha Executivos ou Analistas, ou marque a primeira pessoa.'

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
  assignableUsers,
  audience,
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
   * Todos os usuários que podem receber um perfil comum, sem filtro de destino.
   * Administradores nunca entram aqui. Quem o destino impede continua na lista,
   * marcado como indisponível: é a aba Usuários que separa os dois grupos.
   */
  assignableUsers: PreviewUser[]
  /**
   * Destino em vigor no formulário: o gravado no perfil em edição, ou o que a
   * seleção de usuários e a escolha manual definiram na criação. `null` só
   * acontece na criação, enquanto nenhuma das duas respondeu.
   */
  audience: StandardAccessProfileAudience | null
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
  /** Escolha manual do destino, oferecida na criação quando ninguém está marcado. */
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
              assignableUsers={assignableUsers}
              audience={audience}
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
  assignableUsers,
  audience,
  form,
  lockedUserIds,
  onAudienceChange,
  onClose,
  onSave,
  onToggleUser,
  selectedUserIds,
  transferNotices,
}: {
  assignableUsers: PreviewUser[]
  audience: StandardAccessProfileAudience | null
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
   * Marca as páginas padrão de um departamento, sem tocar em nenhum outro.
   *
   * É um atalho de seleção, e não uma regra nova: ele marca exatamente o que a
   * pessoa marcaria clicando página por página. Abrir ou recolher o departamento
   * continua sendo apenas visual, e nada é gravado até o salvamento.
   */
  function applyDepartmentDefaultPages(department: CatalogDepartment) {
    setSelectedPages((current) => withDepartmentDefaultPages(current, department))
    setFormError(null)
  }

  /** Desmarca tudo o que aquele departamento tinha, e só ele. */
  function clearDepartmentPages(department: CatalogDepartment) {
    setSelectedPages((current) => withoutDepartmentPages(current, department))
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
   * São as exigências do domínio que o formulário consegue antecipar, na ordem
   * das abas: nome, ao menos uma página e, na CRIAÇÃO, o destino. Antecipá-las
   * evita o clique que só devolveria a mesma recusa, mas não substitui a
   * validação do repositório, que continua sendo quem decide.
   *
   * Usuário NÃO está na lista, e é deliberado: um Perfil de Acesso pode ser
   * criado vazio, para as pessoas entrarem depois, uma a uma pela tela Usuários
   * ou em lote por este mesmo formulário. O que ele não pode é nascer sem dizer a
   * quem serve, porque é o destino que decide quem pode recebê-lo. Na edição o
   * destino já está gravado e não muda.
   */
  const missingRequirement =
    name.trim() === ''
      ? 'Informe o nome do Perfil de Acesso.'
      : departmentPageAccess.length === 0
        ? 'Selecione ao menos uma página disponível em Acessos.'
        : !isEditing && audience === null
          ? MISSING_AUDIENCE_MESSAGE
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
              baseId={baseId}
              description={description}
              name={name}
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
              // quando é Analistas ela simplesmente não existe. Na criação o
              // destino vem da aba Usuários, então este bloco aparece assim que
              // o primeiro Executivo é marcado lá.
              hasCorporateAccess={audience === 'executive'}
              onApplyDepartmentDefaults={applyDepartmentDefaultPages}
              onClearDepartment={clearDepartmentPages}
              onTogglePage={togglePage}
              selection={selectedPages}
            />
          </ModalTabPanel>
        ) : null}
        {activeTab === 'usuarios' ? (
          <ModalTabPanel baseId={baseId} tabId="usuarios">
            <UsersTab
              assignableUsers={assignableUsers}
              audience={audience}
              baseId={baseId}
              isEditing={isEditing}
              lockedUserIds={lockedUserIds}
              onAudienceChange={(next) => {
                onAudienceChange(next)
                setFormError(null)
              }}
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
 * Identidade do perfil: nome e descrição, e nada além disso.
 *
 * O destino saiu daqui. Ele não é mais perguntado em campo nenhum: quem diz a
 * quem o perfil serve é a primeira pessoa marcada na aba Usuários, e lá o
 * Administrador escolhe olhando para gente de verdade, em vez de responder antes
 * uma classificação abstrata. A aba Usuários mostra o destino em vigor e impede
 * misturar Executivos com Analistas.
 */
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
          Nome do Perfil de Acesso <RequiredMark />
        </label>
        <input
          aria-required
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
 *
 * Cada departamento traz antes da lista o atalho das páginas padrão, NOS DOIS
 * MODOS: é a primeira coisa do painel porque é a decisão mais comum, e as caixas
 * individuais continuam logo abaixo para ajustar o que ele entregou. O formulário
 * continua abrindo sem nada concedido na criação, e com o acesso gravado na
 * edição, porque o atalho é uma ação e ninguém o aciona por engano ao expandir um
 * departamento.
 *
 * O atalho esteve escondido na edição, por receio de que um clique substituísse a
 * composição de um perfil em uso. Foi liberado pelo Mário em 21/09/2026: ajustar
 * um perfil existente página por página era lento, e nada do que acontece aqui é
 * gravado antes do Salvar, então um clique errado se desfaz fechando o
 * formulário.
 */
function AccessTab({
  catalog,
  hasCorporateAccess,
  onApplyDepartmentDefaults,
  onClearDepartment,
  onTogglePage,
  selection,
}: {
  catalog: ReturnType<typeof buildCatalogDepartments>
  /** Visão Geral Executiva concedida pelo destino, e não pela seleção. */
  hasCorporateAccess: boolean
  onApplyDepartmentDefaults: (department: CatalogDepartment) => void
  onClearDepartment: (department: CatalogDepartment) => void
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
                <DepartmentDefaultSelection
                  department={department}
                  onApplyDefault={() => onApplyDepartmentDefaults(department)}
                  onClear={() => onClearDepartment(department)}
                  selection={selection}
                />
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

/**
 * Atalho de seleção em lote das páginas padrão de um departamento.
 *
 * Existe porque compor um perfil significava marcar dezenas de caixas uma a uma,
 * e o resultado desejado é quase sempre o mesmo: as páginas publicadas daquele
 * departamento. O atalho entrega exatamente isso, e nada que o Administrador não
 * faria clicando página por página.
 *
 * Aparece na criação e na edição. Na edição ele nasce mostrando o que o perfil já
 * tem: `Páginas padrão selecionadas` quando o acesso gravado é exatamente o
 * padrão, e `Seleção parcial` quando é parte dele.
 *
 * DUAS PÁGINAS FICAM DE FORA: `Inteligência (IA)` e `Modelo Dimensional`. Elas
 * continuam visíveis, continuam selecionáveis à mão e continuam sendo gravadas
 * quando marcadas. O que o atalho não faz é concedê-las por conveniência, porque
 * conceder uma evolução futura do portal e um conteúdo técnico é uma decisão, e
 * decisão não vem embutida em um botão de conveniência. A lista mora no modelo de
 * apresentação, por chave técnica do catálogo.
 *
 * `role="checkbox"` com `aria-checked` de três valores, em vez de um `input` com
 * `indeterminate`: o estado `mixed` precisa ser anunciado, e um botão real já é
 * operável por teclado sem nenhum ajuste de foco. As três situações também estão
 * ESCRITAS ao lado, então a leitura não depende do desenho da caixa.
 *
 * Marcar ACRESCENTA as páginas padrão e preserva uma escolha manual de IA ou de
 * Modelo Dimensional. Desmarcar limpa o departamento inteiro, que é o estado em
 * que ele não concede nada. Nenhum outro departamento é afetado, e abrir ou
 * recolher o acordeão não muda seleção nenhuma.
 */
function DepartmentDefaultSelection({
  department,
  onApplyDefault,
  onClear,
  selection,
}: {
  department: CatalogDepartment
  onApplyDefault: () => void
  onClear: () => void
  selection: ReadonlySet<string>
}) {
  // Departamento sem nenhuma página padrão não tem atalho a oferecer: um controle
  // que não marcaria nada só ensinaria que ele está quebrado.
  if (defaultSelectionKeysOf(department).length === 0) return null

  const state = describeDepartmentSelectionState(department, selection)
  const checked = state === 'complete' ? 'true' : state === 'partial' ? 'mixed' : 'false'

  const stateLabel =
    state === 'complete'
      ? 'Páginas padrão selecionadas'
      : state === 'partial'
        ? 'Seleção parcial'
        : 'Nenhuma página selecionada'

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[#f2f4f8] pb-1.5 pt-0.5">
      <button
        aria-checked={checked}
        aria-label={`Selecionar páginas padrão de ${department.label}`}
        className="flex cursor-pointer items-center gap-2.5 rounded-md py-1 text-[12.5px] font-medium text-[#344054] transition hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
        onClick={() => (state === 'complete' ? onClear() : onApplyDefault())}
        role="checkbox"
        type="button"
      >
        <span
          className={`flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border ${
            state === 'empty'
              ? 'border-[#d0d5dd] bg-white'
              : 'border-[var(--accent)] bg-[var(--accent)] text-white'
          }`}
        >
          {state === 'complete' ? (
            <Check aria-hidden="true" size={11} strokeWidth={3} />
          ) : state === 'partial' ? (
            <Minus aria-hidden="true" size={11} strokeWidth={3} />
          ) : null}
        </span>
        Selecionar páginas padrão
      </button>
      <span className="text-[11px] leading-4 text-[#98a2b3]">{stateLabel}</span>
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
 * Placeholder do campo, como valor vazio do próprio `select`.
 *
 * A opção fica desabilitada depois de aberta a lista: ela é o estado inicial, e
 * não uma terceira escolha possível. Um perfil sem destino não é um perfil "de
 * todos", é um perfil incompleto.
 */
const AUDIENCE_PLACEHOLDER = ''

/**
 * Perfil do Sistema que este Perfil de Acesso atende, e é UM só.
 *
 * Um campo, e não dois. Ele responde a pergunta obrigatória da aba, a quem o
 * perfil serve, e é a mesma resposta que separa a lista logo abaixo entre quem
 * pode entrar e quem fica indisponível. O filtro que existia aqui oferecia
 * exatamente as mesmas opções sem decidir nada, e dois seletores iguais na mesma
 * tela eram lidos como um controle repetido.
 *
 * `Perfil do Sistema` é o nome oficial em todo o portal, e é o que este rótulo
 * usa. As opções são as correspondentes aos destinos que um perfil comum aceita,
 * na ordem do domínio (`STANDARD_ACCESS_PROFILE_AUDIENCES`), e por isso são as
 * mesmas palavras dos badges de cada pessoa na lista. Administrador não aparece:
 * ele só recebe `Acesso do Sistema`, e oferecer a opção ensinaria que existe um
 * segundo perfil administrativo.
 *
 * Fica DESABILITADO quando a resposta já está dada e não é mais escolha: na
 * edição, porque o destino foi gravado na criação, e na criação com alguém
 * marcado, porque quem responde passa a ser a pessoa marcada. Em nenhum dos dois
 * casos ele some, para o destino continuar visível onde foi decidido.
 */
function SystemProfileField({
  audience,
  disabled,
  fieldId,
  onAudienceChange,
}: {
  audience: StandardAccessProfileAudience | null
  disabled: boolean
  fieldId: string
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
}) {
  // A frase que explica o campo vive na aba, abaixo da linha inteira, e não
  // dentro dele: ela ocupa a largura do painel, e não os 200px do seletor.
  const hintId = `${fieldId}-hint`

  return (
    <div className="w-[200px] flex-none">
      <label className={fieldLabelClass} htmlFor={fieldId}>
        Perfil do Sistema{' '}
        {disabled ? (
          <span className="font-normal text-[#667085]">(definido)</span>
        ) : (
          <RequiredMark />
        )}
      </label>
      <select
        aria-describedby={hintId}
        aria-required={disabled ? undefined : true}
        className={`${fieldClass} cursor-pointer disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#667085]`}
        disabled={disabled}
        id={fieldId}
        onChange={(event) => {
          const value = event.target.value
          if (value === AUDIENCE_PLACEHOLDER) return

          onAudienceChange(value as StandardAccessProfileAudience)
        }}
        value={audience ?? AUDIENCE_PLACEHOLDER}
      >
        <option disabled value={AUDIENCE_PLACEHOLDER}>
          Selecione o perfil
        </option>
        {STANDARD_ACCESS_PROFILE_AUDIENCES.map((option) => (
          <option key={option} value={option}>
            {accessProfileAudienceProfiles[option]}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Regra do campo, sempre visível.
 *
 * É o limite do domínio dito em uma linha: um Perfil de Acesso serve a um Perfil
 * do Sistema só. Sem ela, a lista de indisponíveis aparece como uma recusa sem
 * motivo, e quem está criando o perfil tenta montar um grupo misto.
 */
const SINGLE_SYSTEM_PROFILE_RULE =
  'Cada Perfil de Acesso atende um único Perfil do Sistema.'

/**
 * Frase abaixo do campo, conforme o que ele é agora.
 *
 * A regra vem sempre na frente, e o complemento muda com a situação: escolha em
 * aberto na criação, escolha já feita pelas pessoas marcadas, e destino gravado
 * na edição. A primeira é a única que ensina algo a fazer; as outras duas
 * explicam por que o campo está travado, o que um campo desabilitado sozinho não
 * diz.
 */
function audienceHint(isEditing: boolean, canChoose: boolean): string {
  if (isEditing) {
    return `${SINGLE_SYSTEM_PROFILE_RULE} Este foi definido na criação e não muda.`
  }

  if (canChoose) {
    return `${SINGLE_SYSTEM_PROFILE_RULE} Marcar a primeira pessoa abaixo também define, e dá para salvar sem nenhum usuário.`
  }

  return `${SINGLE_SYSTEM_PROFILE_RULE} Aqui ele veio das pessoas marcadas: desmarcar todas libera a troca.`
}

/**
 * Frase de lista vazia que diz o que esvaziou a lista.
 *
 * Só a busca esvazia um grupo por decisão de quem está na tela; sem ela, o grupo
 * está vazio por ele mesmo, e a frase é só a constatação.
 */
function emptyListLabel(subject: string, term: string): string {
  return term ? `${subject} corresponde à busca.` : `${subject}.`
}

/** Busca por nome e por e-mail, tolerante a acento e a caixa. */
function filterUsers(users: readonly PreviewUser[], term: string): PreviewUser[] {
  const key = searchKey(term.trim())
  if (!key) return [...users]

  return users.filter(
    (user) => searchKey(user.name).includes(key) || searchKey(user.email).includes(key),
  )
}

/**
 * Atribuição de usuários, e é aqui que o destino do perfil é decidido.
 *
 * Duas formas de responder a mesma pergunta, as duas nesta aba: escolher o
 * `Perfil do Sistema` no campo do topo, quando o perfil está sendo preparado
 * antes das pessoas, ou marcar a primeira pessoa, que responde sozinha. Marcar um
 * Executivo faz dele um perfil de Executivos, marcar um Analista faz dele um
 * perfil de Analistas, e a partir daí o outro Perfil do Sistema deixa de ser
 * selecionável. A regra do domínio continua a mesma: um Perfil de Acesso serve a
 * um Perfil do Sistema só.
 *
 * A lista mostra a base inteira de quem pode receber um perfil comum. Quem o
 * destino já impede continua visível, em um grupo próprio e com a caixa travada:
 * sumir com metade da base explicaria menos do que mostrar por que aquelas
 * pessoas não entram.
 */
function UsersTab({
  assignableUsers,
  audience,
  baseId,
  isEditing,
  lockedUserIds,
  onAudienceChange,
  onToggleUser,
  selectedUserIds,
  transferNotices,
}: {
  assignableUsers: PreviewUser[]
  audience: StandardAccessProfileAudience | null
  baseId: string
  isEditing: boolean
  lockedUserIds: ReadonlySet<string>
  onAudienceChange: (audience: StandardAccessProfileAudience) => void
  onToggleUser: (userId: string, selected: boolean) => void
  selectedUserIds: ReadonlySet<string>
  transferNotices: readonly AccessProfileTransferNotice[]
}) {
  const searchId = `${baseId}-user-search`
  const audienceId = `${baseId}-profile-audience`
  const [term, setTerm] = useState('')

  /**
   * Quando o Perfil do Sistema do perfil ainda é uma escolha, e não um fato.
   *
   * Enquanto ninguém está marcado na criação, o campo aceita troca à vontade,
   * inclusive depois de respondido. A primeira marcação o trava, porque a partir
   * dali quem responde é a pessoa marcada; desmarcar todas o libera de novo. Na
   * edição ele nasce travado: o destino foi gravado na criação.
   */
  const canChooseAudience = !isEditing && selectedUserIds.size === 0

  const { eligible, blocked } = useMemo(
    () => splitUsersByAudience(assignableUsers, audience),
    [assignableUsers, audience],
  )

  const visibleEligible = useMemo(() => filterUsers(eligible, term), [eligible, term])
  const visibleBlocked = useMemo(() => filterUsers(blocked, term), [blocked, term])

  const selectedUsers = visibleEligible.filter((user) => selectedUserIds.has(user.id))
  const otherUsers = visibleEligible.filter((user) => !selectedUserIds.has(user.id))
  const hasLockedUsers = eligible.some((user) => lockedUserIds.has(user.id))

  return (
    <div className="grid gap-5">
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

      {/* Busca e filtro na mesma linha: os dois servem à mesma tarefa, achar a
          pessoa. O filtro tem largura fixa, e não acompanha o texto da opção
          escolhida. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] max-w-[420px] flex-1">
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
        <SystemProfileField
          audience={audience}
          disabled={!canChooseAudience}
          fieldId={audienceId}
          onAudienceChange={onAudienceChange}
        />
      </div>
      <p className="-mt-3 text-[11.5px] leading-4 text-[#667085]" id={`${audienceId}-hint`}>
        {audienceHint(isEditing, canChooseAudience)}
      </p>

      {/* Dois grupos rotulados, e não duas caixas: o que separa quem já está no
          perfil de quem ainda não está é o rótulo com a contagem, o filete sob
          ele e o fundo azul claro das linhas selecionadas. Duas molduras
          fechadas somavam bordas sem somar leitura. */}
      <UserGroup
        emptyLabel={emptyListLabel('Nenhum usuário selecionado', term)}
        lockedUserIds={lockedUserIds}
        onToggleUser={onToggleUser}
        selected
        title="Usuários selecionados"
        users={selectedUsers}
      />
      <UserGroup
        emptyLabel={emptyListLabel('Nenhum outro usuário', term)}
        lockedUserIds={lockedUserIds}
        onToggleUser={onToggleUser}
        selected={false}
        title="Outros usuários"
        users={otherUsers}
      />
      {/* Só existe depois que o destino existe, porque antes dele ninguém está
          impedido, e só enquanto a busca ainda mostra alguém: um grupo de leitura
          vazio contaria uma restrição que ninguém está vendo. Fica por último: é
          leitura, não é escolha. */}
      {visibleBlocked.length > 0 && audience !== null ? (
        <UserGroup
          blocked
          emptyLabel={emptyListLabel('Nenhum usuário indisponível', term)}
          hint={`Têm outro Perfil do Sistema e por isso não entram em um Perfil de Acesso de ${accessProfileAudienceLabels[audience]}.`}
          lockedUserIds={lockedUserIds}
          onToggleUser={onToggleUser}
          selected={false}
          title="Indisponíveis para este perfil"
          users={visibleBlocked}
        />
      ) : null}
    </div>
  )
}

function UserGroup({
  blocked = false,
  emptyLabel,
  hint,
  lockedUserIds,
  onToggleUser,
  selected,
  title,
  users,
}: {
  /** Grupo de leitura: o destino em vigor impede marcar qualquer um deles. */
  blocked?: boolean
  emptyLabel: string
  /** Motivo do grupo, quando ele precisa de um. */
  hint?: string
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
      {hint ? <p className="mt-1.5 text-[11.5px] leading-4 text-[#667085]">{hint}</p> : null}
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
                  selected
                    ? 'bg-[#f5f8ff]'
                    : blocked
                      ? ''
                      : 'transition hover:bg-[#f8fafc]'
                }`}
                key={user.id}
              >
                {blocked ? (
                  <FixedSelection checked={false} label={label} trailing={trailing} />
                ) : lockedUserIds.has(user.id) ? (
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
