import * as Dialog from '@radix-ui/react-dialog'
import { Check, Minus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { isCoreApiConfigured } from '../../data/api/coreApiClient'
import { loadCoreMenuTree } from '../../services/accessProfiles/accessProfileApi'
import type { DepartmentPageAccess } from '../../types/access'
import {
  catalogFromProfileMenuTree,
  defaultSelectionKeysOf,
  describeDepartmentSelectionState,
  pageSelectionKey,
  selectionFromDepartments,
  withDepartmentDefaultPages,
  withoutDepartmentPages,
  type CatalogDepartment,
  type PreviewProfile,
} from './accessProfilesPreviewModel'
import {
  DepartmentAccordion,
  fieldClass,
  fieldLabelClass,
  formModalClass,
  modalOverlayClass,
  modalShellClass,
  ModalTabPanel,
  ModalTabs,
  RequiredMark,
  SelectionCheckbox,
  sectionTitleClass,
  type ModalTab,
} from './accessProfilesUi'
import { DepartmentCoverageBadge } from './DepartmentCoverageChip'

/**
 * Modal central de criação e edição de perfil de acesso.
 *
 * O nome do arquivo ainda diz `Drawer` porque renomeá-lo é um movimento de Git,
 * e esta rodada não executa nenhum. O componente é um modal central: o drawer
 * lateral saiu.
 *
 * DUAS abas: nomear e conceder. A terceira, `Usuários`, foi REMOVIDA por
 * inteiro — o campo `Perfil do Sistema`, a lista de pessoas, a separação entre
 * quem podia e quem não podia entrar, e a transferência em lote.
 *
 * O motivo é o cadastro: um Perfil de Acesso exige o NOME e os MENUS, e nada
 * mais. A aba existia para decidir a quem o perfil se destinava, o que só fazia
 * sentido enquanto `access` apontava para um tipo de perfil no serviço. Essa
 * coluna foi removida, qualquer pessoa pode receber qualquer perfil, e vincular
 * pessoa a perfil é assunto da tela Usuários.
 *
 * O salvamento é REAL: nome, descrição e concessões são gravados em uma operação
 * só. Enquanto o modal está aberto, tudo vive em estado local e nada é
 * persistido; cancelar ou fechar descarta o rascunho inteiro.
 *
 * A página inicial não aparece aqui, e é deliberado: ela é calculada a partir
 * das páginas concedidas, na ordem oficial dos catálogos. Expor o campo
 * obrigaria o Administrador a escolher um detalhe técnico que a própria seleção
 * já responde, e permitiria apontar para uma página que o perfil não concede.
 *
 * A Visão Geral Executiva não aparece aqui de forma nenhuma. Ela é decidida pelo
 * Perfil do Sistema da PESSOA, em `lib/homeNavigation`, e nunca foi uma página
 * que um Perfil de Acesso concedesse.
 */

/** Identidade do perfil em edição no estado local; o rascunho tem a sua. */
export const DRAFT_PROFILE_ID = 'perfil-rascunho'

/*
 * `FixedSelection` existia aqui e foi REMOVIDA.
 *
 * Era a linha com a caixa desabilitada, usada por dois motivos. O primeiro, o
 * usuário já vinculado ao perfil, sumiu junto com a aba `Usuários`. O segundo, a
 * página em desenvolvimento, sumiu agora: a aba Acessos lista os menus do
 * serviço, e "em desenvolvimento" é estado de uma página do portal, que a
 * maioria desses menus não tem. Toda linha da lista é selecionável.
 */

export type AccessProfileFormMode = { mode: 'create' } | { mode: 'edit'; profile: PreviewProfile }

const TABS: readonly ModalTab[] = [
  { id: 'dados', label: 'Dados gerais' },
  { id: 'acessos', label: 'Acessos' },
]

/** Conteúdo que o formulário entrega para ser gravado. */
export type AccessProfileFormDraft = {
  name: string
  description: string
  departmentPageAccess: DepartmentPageAccess[]
}

/** O que a aba Acessos sabe sobre a lista de menus neste instante. */
type AccessCatalogState = {
  /** Menus publicados pelo serviço e reconhecidos pelo portal. */
  catalog: CatalogDepartment[]
  /** true enquanto a árvore do serviço está a caminho. */
  isLoading: boolean
  /** Por que a lista está vazia, ou null quando ela tem itens. */
  emptyReason: string | null
}

/**
 * Catálogo que a aba Acessos percorre: os menus do serviço, TODOS e NADA ALÉM.
 *
 * `catalogFromProfileMenuTree` não filtra mais nada — nem menu pai por chave de
 * departamento, nem submenu por chave de página. O que o serviço publica é o que
 * a aba lista, e tudo o que ela lista pode ser marcado.
 *
 * O catálogo local do portal era exibido aqui em três situações — sem
 * `VITE_CORE_API_URL`, enquanto a chamada estava no ar e quando ela falhava — e
 * deixou de ser em todas. Ele parecia um serviço de menus, mas não era: as
 * caixas marcadas ali viravam uma gravação que o próprio serviço recusaria,
 * porque `menu_ids` só aceita UUID de linha existente em `profile_menu`. Uma
 * lista que não dá para salvar é pior do que uma lista vazia com o motivo
 * escrito.
 *
 * `isLoading` existe para separar "ainda não sei" de "não há": dizer que o
 * serviço não publicou menus enquanto a resposta está a caminho seria afirmar
 * como fato algo que ninguém verificou ainda.
 */
function useAccessCatalog(): AccessCatalogState {
  const [state, setState] = useState<AccessCatalogState>(() =>
    isCoreApiConfigured
      ? { catalog: [], isLoading: true, emptyReason: null }
      : {
          catalog: [],
          isLoading: false,
          emptyReason:
            'O portal não está configurado para falar com o serviço, e os menus de acesso vêm de lá. Defina VITE_CORE_API_URL e recarregue a página.',
        },
  )

  useEffect(() => {
    if (!isCoreApiConfigured) return

    let ativo = true

    loadCoreMenuTree()
      .then((tree) => {
        if (!ativo) return

        const convertido = catalogFromProfileMenuTree(tree)

        setState({
          catalog: convertido,
          isLoading: false,
          // Lista vazia agora só pode ser uma coisa: `profile_menu` sem
          // nenhuma linha. Não há mais crivo que possa esvaziá-la.
          emptyReason:
            convertido.length === 0
              ? 'O serviço ainda não publicou nenhum item de menu. Cadastre os itens em Menu Itens antes de compor um Perfil de Acesso.'
              : null,
        })
      })
      .catch(() => {
        if (!ativo) return

        setState({
          catalog: [],
          isLoading: false,
          emptyReason:
            'Não foi possível ler os menus do serviço. Atualize a página e tente novamente.',
        })
      })

    return () => {
      ativo = false
    }
  }, [])

  return state
}

export function AccessProfileFormModal({
  form,
  onOpenChange,
  onSave,
}: {
  form: AccessProfileFormMode | null
  onOpenChange: (open: boolean) => void
  /**
   * Persiste o perfil; devolve a mensagem de erro, ou null.
   *
   * Assíncrona porque a gravação passa pelo `impacto-bi-service`.
   */
  onSave: (draft: AccessProfileFormDraft) => Promise<string | null>
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
              form={form}
              // Trocar de perfil remonta o corpo, e com ele o estado local: o
              // formulário nunca abre mostrando a seleção do perfil anterior.
              key={form.mode === 'edit' ? form.profile.id : DRAFT_PROFILE_ID}
              onClose={() => onOpenChange(false)}
              onSave={onSave}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function FormBody({
  form,
  onClose,
  onSave,
}: {
  form: AccessProfileFormMode
  onClose: () => void
  onSave: (draft: AccessProfileFormDraft) => Promise<string | null>
}) {
  const baseId = useId()
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id)
  const isEditing = form.mode === 'edit'

  const [name, setName] = useState(isEditing ? form.profile.name : '')
  const [description, setDescription] = useState(isEditing ? form.profile.description : '')
  const [formError, setFormError] = useState<string | null>(null)

  // Catálogo igual nos dois modos: o que muda é a seleção inicial, vazia no
  // rascunho e igual ao acesso atual do perfil na edição.
  const { catalog, isLoading: isLoadingCatalog, emptyReason: catalogError } = useAccessCatalog()
  const [selectedPages, setSelectedPages] = useState<ReadonlySet<string>>(() =>
    isEditing ? selectionFromDepartments(form.profile.departments) : new Set<string>(),
  )
  const [isSaving, setIsSaving] = useState(false)

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
   * da seleção: é o catálogo que define a ordem dos itens, e derivar daqui
   * garante que a gravação carregue exatamente as chaves que o serviço publicou.
   *
   * Sem nenhum filtro: tudo o que está listado pode ser marcado, e tudo o que
   * está marcado é gravado.
   */
  const departmentPageAccess: DepartmentPageAccess[] = useMemo(
    () =>
      catalog.flatMap((department) => {
        const pageKeys = department.pages
          .filter((page) =>
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
   * das abas, e são DUAS: o nome e ao menos uma página. Antecipá-las evita o
   * clique que só devolveria a mesma recusa, mas não substitui a validação do
   * repositório, que continua sendo quem decide.
   *
   * A terceira exigência era o DESTINO, na criação, e ela acabou junto com a
   * aba Usuários: um Perfil de Acesso não se destina mais a um Perfil do
   * Sistema.
   *
   * Usuário nunca esteve na lista, e continua fora: um Perfil de Acesso nasce
   * sem ninguém, e as pessoas entram nele pela tela Usuários.
   */
  const missingRequirement =
    name.trim() === ''
      ? 'Informe o nome do Perfil de Acesso.'
      : departmentPageAccess.length === 0
        ? 'Selecione ao menos uma página disponível em Acessos.'
        : null

  /**
   * A gravação virou assíncrona porque ela pode passar pelo serviço antes de
   * tocar a base local. `isSaving` existe por causa disso: sem ele, dois cliques
   * seguidos disparariam dois `POST /access` e criariam o perfil duas vezes no
   * banco. O botão fica travado enquanto a chamada está no ar.
   */
  async function handleSave() {
    if (missingRequirement) {
      setFormError(missingRequirement)
      return
    }

    if (isSaving) return

    setIsSaving(true)
    try {
      const error = await onSave({ name, description, departmentPageAccess })

      // Recusa mantém o modal aberto com tudo preenchido; o sucesso é o pai quem
      // fecha, ao zerar o formulário.
      setFormError(error)
    } finally {
      setIsSaving(false)
    }
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
              emptyReason={catalogError}
              isLoading={isLoadingCatalog}
              onApplyDepartmentDefaults={applyDepartmentDefaultPages}
              onClearDepartment={clearDepartmentPages}
              onTogglePage={togglePage}
              selection={selectedPages}
            />
          </ModalTabPanel>
        ) : null}
      </div>

      {/* Rodapé fixo: os dois botões continuam alcançáveis em qualquer aba. A
          recusa mora aqui, ao lado do botão que a produziu, e não no topo de uma
          aba que pode nem estar visível no momento do clique. */}
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-[#eef0f4] bg-[#f6f8fb] px-5 py-2.5">
        <span className="min-w-0 text-[11.5px] leading-4 text-[#667085]">
          {/* A recusa do salvamento tem precedência sobre o aviso do catálogo:
              ela é resposta ao clique que a pessoa acabou de dar. */}
          {(formError ?? catalogError) ? (
            <span className="font-medium text-[#b42318]" role="alert">
              {formError ?? catalogError}
            </span>
          ) : (
            'Cancelar descarta tudo o que foi preenchido aqui.'
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={onClose} size="sm" variant="secondary">
            Cancelar
          </Button>
          {/* `loading` troca o botão travado por um botão trabalhando: a gravação
              passa pelo serviço, e sem esse sinal o formulário fica idêntico ao
              de antes do clique enquanto a resposta não chega. */}
          <Button
            disabled={missingRequirement !== null}
            loading={isSaving}
            onClick={handleSave}
            size="sm"
          >
            {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar perfil'}
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
 * O destino saiu daqui e não existe mais em lugar nenhum. Ele chegou a ser um
 * campo desta aba, depois virou a primeira pessoa marcada na aba Usuários, e
 * acabou junto com ela: um Perfil de Acesso não se destina a um Perfil do
 * Sistema, e o serviço não guarda mais essa informação.
 *
 * O NOME é o único campo obrigatório do cadastro; a descrição é opcional, e as
 * páginas são escolhidas na aba Acessos.
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
  emptyReason,
  isLoading,
  onApplyDepartmentDefaults,
  onClearDepartment,
  onTogglePage,
  selection,
}: {
  catalog: CatalogDepartment[]
  /** Por que não há o que listar; null quando o catálogo tem itens. */
  emptyReason: string | null
  isLoading: boolean
  onApplyDepartmentDefaults: (department: CatalogDepartment) => void
  onClearDepartment: (department: CatalogDepartment) => void
  onTogglePage: (key: string, selected: boolean) => void
  selection: ReadonlySet<string>
}) {
  // Espera e ausência são estados diferentes, e a aba não os mistura: a lista
  // vazia só afirma que não há menus depois de o serviço ter respondido.
  if (isLoading) {
    return (
      <div>
        <div className={sectionTitleClass}>Departamentos e páginas</div>
        <p className="mt-2 text-[12.5px] leading-5 text-[#667085]">Lendo os menus do serviço…</p>
      </div>
    )
  }

  if (catalog.length === 0) {
    return (
      <div>
        <div className={sectionTitleClass}>Departamentos e páginas</div>
        <p className="mt-2 text-[12.5px] leading-5 text-[#b42318]" role="alert">
          {emptyReason ?? 'Nenhum menu de acesso disponível.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className={sectionTitleClass}>Departamentos e páginas</div>
      <ul className="mt-2 grid gap-1.5">
        {catalog.map((department) => {
          const total = department.pages.length
          const granted = department.pages.filter((page) =>
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
                      total === 1 ? 'submenu liberado' : 'submenus liberados'
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
                {/* Menu pai sem nenhum submenu aparece, e aparece vazio: ele
                    existe no serviço, e escondê-lo faria procurar na aba Acessos
                    um item recém-cadastrado em Menu Itens. */}
                {department.pages.length === 0 ? (
                  <p className="py-1.5 text-[12px] leading-4 text-[#98a2b3]">
                    Este item de menu ainda não tem submenus. Cadastre-os em Menu Itens para poder
                    concedê-los.
                  </p>
                ) : (
                  <ul>
                    {department.pages.map((page) => {
                      const key = pageSelectionKey(department.departmentId, page.pageKey)

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
                )}
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
