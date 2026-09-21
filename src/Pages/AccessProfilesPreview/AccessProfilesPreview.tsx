import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, LayoutGrid, List, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '../../components/ui/button'
import { useAuth } from '../../contexts/useAuth'
import { isStandardAccessProfileAudience } from '../../lib/accessProfileRules'
import { profileColorClasses } from '../../lib/profileColors'
import {
  listAccessProfiles,
  type AccessProfileStorageFailureReason,
} from '../../services/accessProfiles/accessProfileRepository'
import {
  ensureInitialAccessProfiles,
  refreshInitialAccessProfiles,
} from '../../services/accessProfiles/initialAccessProfiles'
import {
  readStoredAccessProfilesView,
  writeStoredAccessProfilesView,
  type AccessProfilesView,
} from '../../services/preferences/accessProfilesViewStorage'
import { listUsers } from '../../services/users/userRepository'
import type { StandardAccessProfileAudience } from '../../types/access'
import { AccessProfileDetailsModal } from './AccessProfileDrawer'
import {
  assignAccessProfileToUser,
  createAccessProfileWithUsers,
  deleteAccessProfileWithUsers,
  updateAccessProfileWithUsers,
  type AccessProfileDeleteFailureReason,
  type AccessProfileDirectAssignmentFailureReason,
  type AccessProfileSaveFailureReason,
} from '../../services/accessProfiles/accessProfileAssignment'
import {
  AccessProfileFormModal,
  DRAFT_PROFILE_ID,
  MISSING_AUDIENCE_MESSAGE,
  type AccessProfileFormDraft,
  type AccessProfileFormMode,
  type AccessProfileTransferNotice,
} from './AccessProfileFormDrawer'
import {
  assignableProfilesForUser,
  audienceFromSelectedUsers,
  buildAccessProfilesPreviewModel,
  describeAccessProfileDeletionImpact,
  withoutAssignmentsTo,
  type AccessProfilesPreviewModel,
  type PreviewProfile,
  type PreviewUnassignedUser,
} from './accessProfilesPreviewModel'
import { AssignAccessProfileModal } from './AssignAccessProfileModal'
import { chipClass, countClass, SummaryStat, SystemBadge, UserAvatar } from './accessProfilesUi'
import { CoverageTooltipProvider } from './CoverageTooltipProvider'
import { DepartmentCoverageChip } from './DepartmentCoverageChip'

/**
 * Perfis de Acesso.
 *
 * A tela lista os Perfis de Acesso reais do repositório: identidade, nome,
 * destino, departamentos e páginas vêm do domínio persistido, e não dos acessos
 * dos usuários. A coleção inicial é semeada uma única vez, quando o
 * armazenamento ainda não tem nenhuma coleção.
 *
 * Criar e editar perfil passaram a gravar de verdade, junto com as atribuições
 * de usuários: as duas coleções mudam em uma operação só, coordenada por
 * `accessProfileAssignment`. Enquanto o formulário está aberto, tudo vive em
 * estado local; cancelar ou fechar descarta o rascunho inteiro sem tocar em
 * nada.
 *
 * A correspondência entre usuário e perfil é o VÍNCULO GRAVADO
 * (`accessProfileId`), e não uma semelhança calculada entre acessos.
 */

/** Mensagem de cada recusa do salvamento, na linguagem do Administrador. */
const saveFailureMessages: Record<AccessProfileSaveFailureReason, string> = {
  'invalid-draft': 'Revise o nome e as páginas selecionadas: o perfil não pôde ser gravado.',
  'not-found': 'Este Perfil de Acesso não existe mais. Atualize a página e tente novamente.',
  'system-profile': 'O Acesso do Sistema é mantido pelo portal e não pode ser editado.',
  'inactive-access-profile': 'Um Perfil de Acesso inativo não aceita atribuições de usuários.',
  'unknown-user': 'Um dos usuários selecionados não existe mais. Atualize a página e tente novamente.',
  'incompatible-user':
    'Um dos usuários selecionados não tem o Perfil do Sistema deste destino. Atualize a página e revise a seleção.',
  'unassignment-not-allowed':
    'Um usuário não pode ficar sem Perfil de Acesso. Para retirá-lo daqui, selecione-o no Perfil de Acesso de destino.',
  'invalid-access-configuration':
    'As páginas selecionadas não descrevem um acesso válido. Revise a aba Acessos.',
  'users-unavailable':
    'Não foi possível ler a base de usuários neste navegador. Atualize a página e tente novamente.',
  'storage-failure':
    'Não foi possível gravar a alteração. Nada foi alterado. Verifique o navegador e tente novamente.',
  'audience-classification-required':
    'Os Perfis de Acesso gravados neste navegador ainda estão no formato anterior e não podem ser alterados.',
  'actor-required':
    'Não foi possível identificar quem está realizando a alteração. Entre novamente no portal e tente de novo.',
  'history-unavailable':
    'Não foi possível ler o Histórico deste navegador. Nada foi alterado: a alteração não é gravada sem o registro dela.',
}

/**
 * Mensagem de cada recusa da exclusão.
 *
 * Todas afirmam explicitamente que NADA foi alterado: uma exclusão recusada não
 * pode deixar dúvida sobre o perfil ter sido apagado pela metade, e o serviço
 * garante que ou tudo foi gravado, ou o armazenamento voltou ao estado anterior.
 */
const deleteFailureMessages: Record<AccessProfileDeleteFailureReason, string> = {
  'not-found':
    'Este Perfil de Acesso não existe mais. Nada foi alterado. Atualize a página e tente novamente.',
  'system-profile': 'O Acesso do Sistema é mantido pelo portal e não pode ser excluído.',
  // Estado que a tela pode ter lido antes de alguém entrar no perfil em outra
  // aba: o diálogo já impede o clique quando a contagem é conhecida.
  'profile-has-users':
    'Este Perfil de Acesso tem usuários vinculados e não pode ser excluído. Nada foi alterado. Transfira essas pessoas para outro Perfil de Acesso e tente novamente.',
  'users-unavailable':
    'Não foi possível ler a base de usuários neste navegador. Nada foi alterado. Atualize a página e tente novamente.',
  'storage-failure':
    'Não foi possível concluir a exclusão. Nada foi alterado: o perfil continua como estava.',
  'audience-classification-required':
    'Os Perfis de Acesso gravados neste navegador ainda estão no formato anterior e não podem ser excluídos.',
  'actor-required':
    'Não foi possível identificar quem está realizando a exclusão. Nada foi alterado. Entre novamente no portal e tente de novo.',
  'history-unavailable':
    'Não foi possível ler o Histórico deste navegador. Nada foi alterado: a exclusão não é gravada sem o registro dela.',
}

/**
 * Mensagem de cada recusa da atribuição direta.
 *
 * Os motivos ficam separados porque exigem ações diferentes do Administrador, e
 * dois deles são estados que a tela não podia prever: o usuário pode ter recebido
 * um perfil em outra aba, e o perfil escolhido pode ter sido desativado ou
 * excluído desde a última leitura. Nos dois casos NADA é gravado, e a mensagem diz
 * o que fazer em seguida.
 */
const assignFailureMessages: Record<AccessProfileDirectAssignmentFailureReason, string> = {
  'user-not-found':
    'Este usuário não existe mais. Nada foi alterado. Atualize a página e tente novamente.',
  'user-already-assigned':
    'Este usuário já recebeu um Perfil de Acesso. Nada foi alterado. Atualize a página para ver o vínculo atual.',
  'access-profile-required': 'Escolha um Perfil de Acesso antes de confirmar.',
  'unknown-access-profile':
    'O Perfil de Acesso escolhido não existe mais. Nada foi alterado. Atualize a página e escolha outro.',
  'system-profile': 'O Acesso do Sistema é mantido pelo portal e não pode ser atribuído aqui.',
  'inactive-access-profile':
    'Este Perfil de Acesso foi desativado e não aceita novos usuários. Nada foi alterado.',
  'incompatible-access-profile':
    'Este Perfil de Acesso não se destina ao Perfil do Sistema deste usuário. Nada foi alterado.',
  'invalid-access-configuration':
    'As páginas deste Perfil de Acesso não descrevem um acesso válido. Nada foi alterado: revise o perfil em Acessos.',
  'users-unavailable':
    'Não foi possível ler a base de usuários neste navegador. Nada foi alterado. Atualize a página e tente novamente.',
  'storage-failure':
    'Não foi possível gravar a atribuição. Nada foi alterado. Verifique o navegador e tente novamente.',
  'audience-classification-required':
    'Os Perfis de Acesso gravados neste navegador ainda estão no formato anterior e não aceitam atribuições.',
  'actor-required':
    'Não foi possível identificar quem está realizando a atribuição. Nada foi alterado. Entre novamente no portal e tente de novo.',
  'history-unavailable':
    'Não foi possível ler o Histórico deste navegador. Nada foi alterado: a atribuição não é gravada sem o registro dela.',
}

/* -------------------------------------------------------------------------- */
/* Classes compartilhadas                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mesmas cores literais das demais abas das Configurações. O painel das
 * Configurações é branco fixo nos dois temas, e as classes precisam ser
 * estáticas para o Tailwind incluí-las no CSS final.
 */
const surfaceClass = 'rounded-xl border border-[#eaecf2] bg-white'

/**
 * Card compacto e do tamanho do próprio conteúdo.
 *
 * Sem `h-full` e sem altura igualada entre os cards de uma linha: um perfil de
 * um departamento não precisa da altura do perfil que tem onze, e esticá-lo
 * deixava metade do card em branco. Cada card termina logo depois de
 * `Ver detalhes`.
 *
 * Sem `cursor-pointer` e sem clique no card inteiro: a ação é o botão de dentro.
 */
/**
 * Superfície dos cards: `#F7F8FA`, nas duas visualizações.
 *
 * O painel das Configurações é branco, e o card branco sobre painel branco só
 * existia pela borda. O cinza neutro separa a coleção do painel sem entrar na
 * disputa de cor: ele não tem matiz própria, então nada dentro do card compete
 * com os labels de cobertura e com o azul do `Ver detalhes`, que continuam
 * sendo a única cor significativa ali.
 *
 * Sem hover próprio, como antes: o card não é clicável, e uma superfície que
 * reage ao cursor prometeria uma ação que não existe. Quem reage são os botões
 * de dentro, `Ver detalhes` e os labels de cobertura, cada um com o próprio
 * hover e o próprio anel de foco.
 */
const cardBaseClass = 'rounded-xl border bg-[#f7f8fa] px-3.5 py-3 text-left transition'
const cardStandardClass = 'border-[#eaecf2]'

/**
 * Acesso do Sistema dentro da mesma coleção.
 *
 * Ele não tem mais seção própria e não tem superfície própria: todos os cards
 * usam o mesmo cinza neutro. O que o distingue é a linha lateral de 3px e a
 * borda mais fria, junto do selo com cadeado e da ausência de edição.
 *
 * A linha lateral é cinza-escura, e não azul: azul aqui é a cor do que se
 * concede e do que se abre, e uma barra azul ao lado de um card cheio de labels
 * azuis lia como mais um acesso em destaque. O cinza diz "este é diferente" sem
 * disputar significado com nada.
 */
const cardSystemClass = 'border-[#d8e3ff] border-l-[3px] border-l-[#475467]'

/** Rótulo de seção com o mesmo peso das demais leituras relevantes da tela. */
const sectionHeadingClass = 'text-[14px] font-semibold text-[#172033]'

export function AccessProfilesPreview() {
  /**
   * Responsável por toda alteração feita nesta tela.
   *
   * É o usuário autenticado da sessão, entregue à operação para ser COPIADO no
   * evento do Histórico. A página não reconstrói o responsável depois nem usa um
   * Administrador fixo: sem sessão identificada, o serviço recusa a operação e a
   * mensagem correspondente aparece.
   */
  const { user: currentUser } = useAuth()
  const actor = { id: currentUser?.id ?? '', name: currentUser?.name ?? '' }

  // Leitura única na montagem, como na tabela de Usuários e no Histórico. As
  // duas operações de armazenamento acontecem antes da leitura e são
  // idempotentes: a inicialização só grava quando ainda não existe coleção
  // nenhuma, e a atualização só reescreve os perfis iniciais que continuam
  // exatamente como a versão anterior os criou.
  const [collection, setCollection] = useState(() => {
    ensureInitialAccessProfiles()
    refreshInitialAccessProfiles()

    return listAccessProfiles()
  })
  const [users, setUsers] = useState(() => listUsers())
  /** Confirmação da última gravação, exibida acima da coleção. */
  const [feedback, setFeedback] = useState<string | null>(null)

  /**
   * Perfil apontado pela lixeira, ainda não excluído.
   *
   * Guardar o perfil, e não apenas o id, é o que permite à confirmação escrever o
   * nome e a contagem de usuários mesmo depois de a coleção ser relida.
   */
  const [deleteTarget, setDeleteTarget] = useState<PreviewProfile | null>(null)
  /** Recusa da última tentativa de exclusão, exibida dentro da confirmação. */
  const [deleteError, setDeleteError] = useState<string | null>(null)

  /**
   * Usuário sem Perfil de Acesso apontado pelo `Definir perfil`, ainda sem
   * vínculo gravado.
   *
   * Guardar o usuário, e não apenas o id, é o que permite ao modal mostrar avatar,
   * nome, e-mail e badge sem uma segunda busca, e o que mantém a leitura estável
   * enquanto a gravação acontece.
   */
  const [assignTarget, setAssignTarget] = useState<PreviewUnassignedUser | null>(null)

  /** Relê as duas coleções depois de uma gravação confirmada. */
  function reloadCollections() {
    setCollection(listAccessProfiles())
    setUsers(listUsers())
  }

  const preview = useMemo(
    () => buildAccessProfilesPreviewModel({ profiles: collection.profiles, users }),
    [collection, users],
  )

  /**
   * Visualização escolhida, restaurada do navegador.
   *
   * Grade é o padrão da primeira visita, e a escolha passa a ser lembrada: a
   * página deixou de voltar para lista a cada visita. Um valor gravado que não
   * seja `list` nem `grid` é ignorado na leitura e a página abre em grade, sem
   * erro e sem reescrever o que estava lá.
   */
  const [view, setView] = useState<AccessProfilesView>(() => readStoredAccessProfilesView())
  const [detailProfileId, setDetailProfileId] = useState<string | null>(null)
  const [form, setForm] = useState<AccessProfileFormMode | null>(null)

  /**
   * Seleção de usuários no rascunho: id do usuário para o perfil do formulário.
   * A chave ausente significa "como está gravado hoje". Ela mora aqui, e não
   * dentro do formulário, porque é o que permite visualizar uma transferência
   * antes do salvamento sem alterar a coleção persistida.
   */
  const [assignments, setAssignments] = useState<ReadonlyMap<string, string | null>>(
    () => new Map(),
  )

  /**
   * Destino escolhido à mão no rascunho de criação, ou null enquanto ninguém o
   * escolheu.
   *
   * Existe porque um Perfil de Acesso pode nascer sem nenhum usuário: quando não
   * há ninguém marcado para informar o destino, é o Administrador quem o informa,
   * na própria aba Usuários. Uma seleção de usuários vence esta escolha, e por
   * isso ela é apenas o segundo caminho para a mesma resposta, e não um campo
   * concorrente.
   *
   * Mora aqui, junto de `assignments`, porque trocar o destino mexe nas seleções:
   * manter os dois no mesmo lugar é o que garante que nenhuma marcação
   * incompatível fique escondida no estado. Na edição não é usado, porque o
   * destino vem gravado no perfil e não muda.
   */
  const [draftAudience, setDraftAudience] = useState<StandardAccessProfileAudience | null>(null)

  const matchedProfileByUser = useMemo(() => {
    const byUser = new Map<string, string>()

    for (const profile of preview.profiles) {
      for (const user of profile.users) byUser.set(user.id, profile.id)
    }

    return byUser
  }, [preview])

  // O detalhe é derivado do alvo a cada render, e não guardado no estado: assim
  // ele nunca fica descrevendo uma leitura anterior.
  const detailProfile = resolveProfile(preview, detailProfileId)

  // Enquanto o formulário está aberto, a consulta fica fechada mas o alvo
  // permanece: é isso que devolve o usuário ao mesmo perfil ao cancelar a edição.
  const detailOpen = detailProfile !== null && form === null

  const formProfileId =
    form === null ? null : form.mode === 'edit' ? form.profile.id : DRAFT_PROFILE_ID

  /**
   * Usuários JÁ VINCULADOS ao perfil que está sendo editado.
   *
   * Eles não podem ser desmarcados neste formulário: cada usuário tem
   * exatamente um Perfil de Acesso, e retirá-lo daqui sem colocá-lo em outro o
   * deixaria sem acesso ao portal. O repositório recusa essa operação, e a tela
   * não oferece o que a gravação recusaria.
   *
   * Na criação o conjunto é vazio: um perfil que ainda não existe não tem
   * ninguém vinculado, e toda marcação é uma escolha desfazível.
   */
  const lockedUserIds = useMemo(
    () =>
      form?.mode === 'edit'
        ? new Set(form.profile.users.map((user) => user.id))
        : new Set<string>(),
    [form],
  )

  function currentProfileIdOf(userId: string): string | null {
    const override = assignments.get(userId)

    return override === undefined ? (matchedProfileByUser.get(userId) ?? null) : override
  }

  // Sobre a coleção inteira de atribuíveis: o formulário só deixa marcar quem o
  // destino aceita, então uma seleção incompatível não chega a existir aqui.
  const selectedUserIds = new Set(
    formProfileId === null
      ? []
      : preview.assignableUsers
          .filter((user) => currentProfileIdOf(user.id) === formProfileId)
          .map((user) => user.id),
  )

  /**
   * Destino em vigor no formulário aberto.
   *
   * Na edição vem gravado no perfil e é imutável. Na criação ele tem duas
   * origens, nesta ordem: a seleção de usuários, quando existe alguém marcado, e
   * a escolha feita à mão, quando não existe ninguém.
   *
   * A seleção vem primeiro de propósito. Enquanto houver alguém marcado, o
   * destino é um fato daquela pessoa, e não uma preferência: deixar a escolha
   * manual vencer permitiria um perfil destinado a Executivos com um Analista
   * dentro. Desmarcar todos devolve a palavra à escolha manual.
   *
   * O perfil do sistema não chega aqui, porque não é editável, e a checagem de
   * tipo devolve `null` em vez de assumir um destino que o perfil comum nunca
   * teria.
   */
  const formAudience: StandardAccessProfileAudience | null =
    form === null
      ? null
      : form.mode === 'edit'
        ? isStandardAccessProfileAudience(form.profile.audience)
          ? form.profile.audience
          : null
        : (audienceFromSelectedUsers(preview.assignableUsers, selectedUserIds) ?? draftAudience)

  /**
   * Pessoas selecionadas que já pertencem a outro perfil.
   *
   * A ausência de vínculo não é transferência, e quem já está no perfil editado
   * também fica de fora. O aviso descreve somente a mudança que o salvamento
   * realmente fará, usando os nomes persistidos dos dois lados.
   */
  const transferNotices: AccessProfileTransferNotice[] = preview.assignableUsers.flatMap((user) => {
    if (!selectedUserIds.has(user.id)) return []

    const sourceProfileId = matchedProfileByUser.get(user.id)
    if (!sourceProfileId || sourceProfileId === formProfileId) return []

    const sourceProfile = preview.profiles.find((profile) => profile.id === sourceProfileId)
    if (!sourceProfile) return []

    return [
      {
        userId: user.id,
        userName: user.name,
        sourceProfileName: sourceProfile.name,
      },
    ]
  })

  /**
   * Marca ou desmarca um usuário no formulário aberto.
   *
   * Quem já está no perfil editado é bloqueado pela interface. Portanto, toda
   * desmarcação possível é apenas o cancelamento de uma escolha feita neste
   * rascunho: a chave sai do mapa e o usuário volta ao perfil persistido.
   */
  function toggleUser(userId: string, selected: boolean) {
    setAssignments((current) => {
      const next = new Map(current)

      if (selected) next.set(userId, formProfileId)
      else next.delete(userId)

      return next
    })
  }

  /** Esquece tudo o que o rascunho de criação marcou. */
  function clearDraftAssignments() {
    setAssignments((current) => withoutAssignmentsTo(current, DRAFT_PROFILE_ID, new Set()))
  }

  /**
   * Troca o destino escolhido à mão e limpa o que o rascunho tinha marcado.
   *
   * A limpeza acontece no mesmo movimento da troca. A escolha manual só é
   * oferecida quando ninguém está marcado, então na prática não há o que limpar;
   * limpar assim mesmo é o que impede uma marcação de outro Perfil do Sistema de
   * sobreviver escondida no estado se essa condição mudar.
   */
  function changeDraftAudience(next: StandardAccessProfileAudience) {
    setDraftAudience(next)
    clearDraftAssignments()
  }

  /**
   * Abre o Novo perfil sempre do zero: sem destino e sem nenhum usuário marcado.
   */
  function openCreateForm() {
    clearDraftAssignments()
    setDraftAudience(null)
    setFeedback(null)
    setForm({ mode: 'create' })
  }

  /**
   * Grava o perfil e as atribuições em uma operação só.
   *
   * A lista de usuários é o estado FINAL do vínculo, e não um delta: quem está
   * marcado passa a apontar para este perfil, transferindo-se do anterior quando
   * havia um, e quem não está continua exatamente onde está. Retirar alguém sem
   * dar outro perfil a ele não é oferecido aqui, e o repositório recusaria.
   *
   * Devolve a mensagem de erro para o formulário exibir, ou null no sucesso,
   * quando as duas coleções são relidas e o modal fecha.
   */
  function handleSaveForm(draft: AccessProfileFormDraft): string | null {
    if (form === null) return null

    const userIds = [...selectedUserIds]

    // Na criação, um rascunho sem destino não é gravável: perfil sem destino não
    // existe no domínio. Usuário, esse sim, é opcional. O formulário já mantém o
    // botão travado sem destino; aqui é a segunda porta, com a MESMA frase.
    const result =
      form.mode === 'edit'
        ? updateAccessProfileWithUsers(form.profile.id, { ...draft, userIds, actor })
        : formAudience === null
          ? null
          : createAccessProfileWithUsers({
              ...draft,
              audience: formAudience,
              userIds,
              actor,
            })

    if (result === null) return MISSING_AUDIENCE_MESSAGE
    if (!result.ok) return saveFailureMessages[result.reason]

    reloadCollections()
    setForm(null)
    setDetailProfileId(null)
    setAssignments(new Map())
    setFeedback(`${result.profile.name} foi salvo com sucesso.`)

    return null
  }

  /**
   * Troca a visualização e tenta gravar a escolha.
   *
   * A gravação pode falhar (modo privado, quota, armazenamento bloqueado) e o
   * retorno é ignorado de propósito: a escolha continua valendo nesta sessão de
   * qualquer forma, como já acontece com o tema e com a sidebar. Avisar sobre
   * uma preferência de exibição que não persistiu seria ruído.
   */
  function changeView(next: AccessProfilesView) {
    setView(next)
    writeStoredAccessProfilesView(next)
  }

  /**
   * Abre a edição de um perfil comum.
   *
   * É a MESMA porta para os dois caminhos: o botão Editar do modal de consulta e
   * o lápis do card. O formulário e o estado são os mesmos, e o lápis apenas
   * dispensa a passagem obrigatória pelo `Ver detalhes`. O perfil do sistema é
   * recusado aqui também, e não só na interface, porque o card protegido nem
   * chega a mostrar o botão.
   */
  function openEditForm(profile: PreviewProfile | null) {
    if (profile === null || profile.isSystem) return

    setAssignments(new Map())
    setFeedback(null)
    setForm({ mode: 'edit', profile })
  }

  /** Abre a confirmação da exclusão. Nada é excluído antes do Excluir perfil. */
  function openDeleteDialog(profile: PreviewProfile) {
    if (profile.isSystem) return

    setFeedback(null)
    setDeleteError(null)
    setDeleteTarget(profile)
  }

  function closeDeleteDialog() {
    setDeleteTarget(null)
    setDeleteError(null)
  }

  /**
   * Confirma a exclusão de um perfil que está vazio.
   *
   * Nenhum vínculo é tocado aqui: o serviço recusa a exclusão de um perfil com
   * gente dentro, e o diálogo já nem oferece o botão nesse caso. No sucesso as
   * duas coleções são relidas, o que atualiza cards e contagens sem
   * recarregamento manual. Na recusa a confirmação PERMANECE ABERTA com a
   * mensagem: nada foi alterado, e o Administrador pode tentar de novo ou
   * cancelar.
   */
  function confirmDelete() {
    if (deleteTarget === null) return

    const result = deleteAccessProfileWithUsers(deleteTarget.id, actor)

    if (!result.ok) {
      setDeleteError(deleteFailureMessages[result.reason])
      return
    }

    reloadCollections()

    if (detailProfileId === deleteTarget.id) setDetailProfileId(null)

    setDeleteTarget(null)
    setDeleteError(null)
    setFeedback(`${result.profile.name} foi excluído com sucesso.`)
  }

  /**
   * Perfis que o usuário apontado pelo `Definir perfil` pode receber hoje.
   *
   * Somente os comuns entram na comparação, e a regra é a do domínio: ativos e do
   * destino que corresponde ao Perfil do Sistema da pessoa. `Acesso do Sistema`
   * não é candidato em nenhum caso.
   */
  const assignOptions = useMemo(
    () =>
      assignTarget === null
        ? []
        : assignableProfilesForUser(preview.profiles, assignTarget.profile),
    [assignTarget, preview.profiles],
  )

  /** Abre o modal de atribuição. Nada é gravado antes do `Definir perfil`. */
  function openAssignDialog(user: PreviewUnassignedUser) {
    setFeedback(null)
    setAssignTarget(user)
  }

  /**
   * Grava a primeira atribuição de Perfil de Acesso daquele usuário.
   *
   * A operação de domínio faz tudo em uma gravação só: vínculo, acessos
   * derivados, uso do perfil e evento do Histórico. No sucesso as duas coleções
   * são relidas, o que atualiza a seção de usuários sem perfil, o indicador
   * `Sem perfil definido` e a contagem do perfil escolhido sem recarregamento
   * manual, e o modal fecha. Na recusa o modal PERMANECE aberto com a mensagem:
   * nada foi alterado.
   */
  function handleAssign(accessProfileId: string): string | null {
    if (assignTarget === null) return null

    const result = assignAccessProfileToUser({
      accessProfileId,
      actor,
      userId: assignTarget.id,
    })

    if (!result.ok) return assignFailureMessages[result.reason]

    reloadCollections()
    setAssignTarget(null)
    setFeedback(`${result.userName} agora usa o Perfil de Acesso ${result.profile.name}.`)

    return null
  }

  function closeForm() {
    // Sair do Novo perfil volta para a página; sair da edição volta para a
    // consulta do mesmo perfil, que continua no alvo. Nos dois modos, cancelar
    // descarta todas as escolhas de usuário do rascunho.
    if (form?.mode === 'create') setDetailProfileId(null)

    setAssignments(new Map())
    setForm(null)
  }

  return (
    // O provedor envolve a página inteira, e não cada lista: é o que faz um
    // label do modal fechar o label de um card que ficou aberto atrás dele. Os
    // modais são renderizados por portal, e portal preserva a árvore de contexto.
    <CoverageTooltipProvider>
      <div className="grid gap-5">
      {/* Filete sob o cabeçalho: separa a identidade da página do conteúdo
          administrativo sem gastar um bloco inteiro para isso. */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef0f4] pb-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#172033]">Perfis de acesso</h2>
          <p className="mt-1 text-[13px] text-[#667085]">
            Controle quais áreas e páginas cada grupo de usuários pode visualizar.
          </p>
        </div>
        <Button onClick={openCreateForm} size="sm">
          <Plus aria-hidden="true" size={15} />
          Novo perfil
        </Button>
      </div>

      {feedback ? (
        <div
          className="rounded-lg border border-[#b7e4c7] bg-[#f2fbf5] px-3.5 py-2 text-[12.5px] font-medium text-[#16794a]"
          role="status"
        >
          {feedback}
        </div>
      ) : null}

      <ProfilesSection
        failure={collection.ok ? null : collection.reason}
        onDeleteProfile={openDeleteDialog}
        onEditProfile={openEditForm}
        onOpenDetail={setDetailProfileId}
        onViewChange={changeView}
        preview={preview}
        view={view}
      />

      <UnassignedSection onAssign={openAssignDialog} users={preview.unassignedUsers} />

      <AccessProfileDetailsModal
        onEdit={() => openEditForm(detailProfile)}
        onOpenChange={(open) => {
          if (!open) setDetailProfileId(null)
        }}
        open={detailOpen}
        profile={detailProfile}
      />

      <DeleteProfileDialog
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDelete}
        profile={deleteTarget}
      />

      <AssignAccessProfileModal
        onOpenChange={(open) => {
          // Cancelar, Escape e clique no overlay fecham sem alterar nada: o alvo
          // apenas sai do estado local.
          if (!open) setAssignTarget(null)
        }}
        onSubmit={handleAssign}
        options={assignOptions}
        user={assignTarget}
      />

      <AccessProfileFormModal
        assignableUsers={preview.assignableUsers}
        audience={formAudience}
        form={form}
        lockedUserIds={lockedUserIds}
        onAudienceChange={changeDraftAudience}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
        onSave={handleSaveForm}
        onToggleUser={toggleUser}
        selectedUserIds={selectedUserIds}
        transferNotices={transferNotices}
      />
      </div>
    </CoverageTooltipProvider>
  )
}

/** Perfil apontado pelo alvo atual, do sistema ou comum. */
function resolveProfile(
  preview: AccessProfilesPreviewModel,
  profileId: string | null,
): PreviewProfile | null {
  if (profileId === null) return null

  return preview.orderedProfiles.find((profile) => profile.id === profileId) ?? null
}

/* -------------------------------------------------------------------------- */
/* Card de perfil                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cobertura do perfil: um label por departamento concedido, lado a lado e com
 * quebra automática de linha.
 *
 * Sem rótulo em cima. Cada label já traz o nome do departamento e a fração de
 * páginas, e abre o detalhe das páginas por conta própria.
 *
 * Todos os departamentos aparecem, sem `+ N` e sem corte: o card cresce com o
 * conteúdo, e é por isso que não existe altura fixa aqui.
 */
function ProfileDepartments({
  departments,
}: {
  departments: PreviewProfile['departments']
}) {
  if (departments.length === 0) {
    return <p className="text-[11.5px] leading-4 text-[#98a2b3]">Nenhum departamento concedido</p>
  }

  return (
    // Sem `stopPropagation`: ele existia só para o clique no label não abrir o
    // card, e o card deixou de ser clicável. Cada label é um botão independente
    // que abre o próprio detalhamento.
    <div className="flex flex-wrap gap-1">
      {departments.map((department) => (
        <DepartmentCoverageChip
          coverage={department.coverage}
          key={department.departmentId}
          label={department.label}
          pages={department.catalogPages}
        />
      ))}
    </div>
  )
}

/** Nome do perfil, selo do sistema quando for o caso, e a linha de apoio. */
function ProfileIdentity({ profile }: { profile: PreviewProfile }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="break-words text-[13px] font-semibold leading-[1.35] text-[#172033]">
          {profile.name}
        </span>
        {profile.isSystem ? <SystemBadge /> : null}
      </div>
      <p className="mt-0.5 text-[11.5px] leading-4 text-[#667085]">
        {profile.audienceLabel}
        {' · '}
        <span className={countClass}>{profile.userCount}</span>{' '}
        {profile.userCount === 1 ? 'usuário' : 'usuários'}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Ações diretas do card                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Botão de ação do canto superior direito do card.
 *
 * Compacto e discreto por padrão: sem moldura e em cinza, para não competir com
 * o nome do perfil nem com os labels de cobertura, que são a informação do card.
 * A cor aparece só na interação, e o nome acessível diz o que o botão faz e em
 * qual perfil, sem depender do ícone.
 *
 * `tone` decide apenas a cor de hover e de foco. A ação destrutiva não é
 * vermelha em repouso: uma lixeira vermelha em cada card transformaria a coleção
 * inteira em uma fileira de alertas, e o vermelho deixaria de significar algo no
 * momento em que significa.
 */
function CardActionButton({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  tone: 'neutral' | 'destructive'
}) {
  const toneClass =
    tone === 'destructive'
      ? 'text-[#98a2b3] hover:bg-[#fdf3f3] hover:text-[#b42318] focus-visible:ring-[#e5484d] focus-visible:text-[#b42318]'
      : 'text-[#98a2b3] hover:bg-[#eef2f8] hover:text-[#344054] focus-visible:ring-[var(--accent)] focus-visible:text-[#344054]'

  return (
    <button
      aria-label={label}
      className={`flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 ${toneClass}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  )
}

/**
 * Lápis e lixeira, lado a lado, no canto superior direito do card.
 *
 * Só existem no perfil comum. O `Acesso do Sistema` não recebe nenhuma das duas:
 * ele é mantido pelo portal, não é editável e não é excluível, e mostrar botões
 * que o domínio recusaria ensinaria um caminho que não existe.
 *
 * O lápis abre a edição direto, sem passar pelo `Ver detalhes`. A lixeira abre a
 * confirmação, e nunca exclui sozinha.
 */
function ProfileCardActions({
  onDelete,
  onEdit,
  profileName,
}: {
  onDelete: () => void
  onEdit: () => void
  profileName: string
}) {
  return (
    <div className="flex flex-none items-center gap-0.5">
      <CardActionButton
        icon={<Pencil aria-hidden="true" size={13} />}
        label={`Editar perfil ${profileName}`}
        onClick={onEdit}
        tone="neutral"
      />
      <CardActionButton
        icon={<Trash2 aria-hidden="true" size={13} />}
        label={`Excluir perfil ${profileName}`}
        onClick={onDelete}
        tone="destructive"
      />
    </div>
  )
}

/**
 * Ação padronizada de consulta, igual em todos os cards.
 *
 * Texto azul e chevron, o par que o portal já usa para "isto abre uma leitura".
 * O perfil do sistema recebe exatamente a mesma ação: ele não é editável, mas é
 * consultável como qualquer outro, e dar a ele um botão diferente ensinaria uma
 * distinção que não existe na consulta.
 *
 * É o ÚNICO ponto de abertura do card. O card inteiro deixou de ser clicável:
 * uma superfície grande que reage ao clique convive mal com os labels de
 * cobertura, que também são acionáveis e ficam dentro dela, e obrigava a parar
 * a propagação em cada um deles para o toque não abrir as duas coisas.
 *
 * O texto usa `#2563eb` em vez do azul do tema: sobre a superfície do card, o
 * azul do token ficava abaixo do contraste mínimo de 4,5:1. O anel de foco
 * continua em `var(--accent)`, porque ali a referência é a borda do painel.
 */
function DetailsAction({
  onOpenDetail,
  profileName,
}: {
  onOpenDetail: () => void
  profileName: string
}) {
  return (
    <button
      aria-label={`Ver detalhes de ${profileName}`}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md text-[11.5px] font-semibold leading-[1.45] text-[#2563eb] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      onClick={onOpenDetail}
      type="button"
    >
      Ver detalhes
      <ChevronRight aria-hidden="true" size={14} />
    </button>
  )
}

/**
 * Card de um Perfil de Acesso, o mesmo nas duas visões.
 *
 * A diferença entre lista e grade é só a disposição das mesmas peças. Na grade
 * elas empilham, porque a coluna é estreita. Na lista, a partir de `md`,
 * identidade, cobertura e ação ficam em colunas fixas: o nome de todos os
 * perfis cai no mesmo eixo e os labels começam no mesmo ponto, e é isso que faz
 * a lista percorrer como uma tabela.
 *
 * O card é uma superfície neutra: não tem clique, não tem cursor de ação e não
 * entra na ordem de tabulação. Quem age são os botões de dentro.
 */
function ProfileCard({
  onDelete,
  onEdit,
  onOpenDetail,
  profile,
  view,
}: {
  onDelete: () => void
  onEdit: () => void
  onOpenDetail: () => void
  profile: PreviewProfile
  view: AccessProfilesView
}) {
  const className = `${cardBaseClass} ${profile.isSystem ? cardSystemClass : cardStandardClass}`

  // O protegido não recebe lápis nem lixeira em nenhuma das duas visões.
  const actions = profile.isSystem ? null : (
    <ProfileCardActions onDelete={onDelete} onEdit={onEdit} profileName={profile.name} />
  )

  if (view === 'grid') {
    return (
      <div className={`${className} grid gap-2`}>
        {/* Identidade à esquerda e ações no canto superior direito, na mesma
            linha. As ações não usam posicionamento absoluto: elas ocupam espaço
            no fluxo, então o nome do perfil nunca passa por baixo delas e a
            altura natural do card continua sendo a do conteúdo. */}
        <div className="flex items-start justify-between gap-2">
          <ProfileIdentity profile={profile} />
          {actions}
        </div>
        <ProfileDepartments departments={profile.departments} />
        {/* Canto inferior direito: a ação é a última linha do card, e o
            `justify-end` a empurra para a borda direita. O alinhamento é do
            contêiner, e não posicionamento absoluto: o botão continua ocupando
            espaço no fluxo, então o card termina logo depois dele e a altura
            natural de cada card permanece intacta. */}
        <div className="flex justify-end">
          <DetailsAction onOpenDetail={onOpenDetail} profileName={profile.name} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${className} grid items-start gap-x-4 gap-y-2 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]`}
    >
      <ProfileIdentity profile={profile} />
      <ProfileDepartments departments={profile.departments} />
      {/* `Ver detalhes` continua na coluna da direita, e as ações entram acima
          dele, que é o canto superior direito do card também nesta visão.
          `justify-end` em ambos: a partir de `md` a coluna tem a largura do
          próprio conteúdo e nada muda, mas abaixo disso a grade colapsa em uma
          coluna só, e sem ele os dois voltariam para a esquerda. */}
      <div className="grid gap-1.5 md:pt-0.5">
        {actions ? <div className="flex justify-end">{actions}</div> : null}
        <div className="flex justify-end">
          <DetailsAction onOpenDetail={onOpenDetail} profileName={profile.name} />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Coleção de perfis                                                          */
/* -------------------------------------------------------------------------- */

function ProfilesSection({
  failure,
  onDeleteProfile,
  onEditProfile,
  onOpenDetail,
  onViewChange,
  preview,
  view,
}: {
  /** Motivo pelo qual os perfis comuns não puderam ser lidos, ou null. */
  failure: AccessProfileStorageFailureReason | null
  onDeleteProfile: (profile: PreviewProfile) => void
  onEditProfile: (profile: PreviewProfile) => void
  onOpenDetail: (profileId: string) => void
  onViewChange: (view: AccessProfilesView) => void
  preview: AccessProfilesPreviewModel
  view: AccessProfilesView
}) {
  const { orderedProfiles } = preview

  return (
    // Coleção única: o perfil do sistema deixou de ter seção própria e entrou
    // aqui, na primeira posição. Sem título visível, porque a página já se chama
    // Perfis de acesso; o nome acessível da região fica declarado para quem
    // navega por seções.
    <section aria-label="Perfis de Acesso" className="grid gap-3">
      {/* Dois indicadores na mesma linguagem tipográfica da aba Usuários:
          rótulo pequeno em caixa alta e número em fonte monoespaçada, sem
          cartão, sem fundo e sem borda. Nenhum deles conta protegidos: o perfil
          do sistema entra no total como qualquer outro.

          O indicador `Sem perfil definido` saiu daqui em 21/09/2026, por decisão
          do Mário: com a exclusão de perfil em uso bloqueada, o portal não cria
          mais ninguém sem Perfil de Acesso, e o que resta é o legado da base
          antiga, que já aparece por extenso na seção do rodapé. Um indicador fixo
          para uma fila que tende a zerar chamava atenção para o que não é mais
          uma decisão a tomar. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <SummaryStat
            label="Perfis de acesso"
            value={preview.totalProfileCount}
            valueClassName="text-[#101828]"
          />
          <SummaryStat
            label="Usuários correspondentes"
            value={preview.totalMatchedUserCount}
            valueClassName="text-[#16a34a]"
          />
        </div>
        <ViewToggle onViewChange={onViewChange} view={view} />
      </div>

      {failure ? (
        <CollectionFailurePanel reason={failure} />
      ) : orderedProfiles.length === 0 ? (
        <div className={`${surfaceClass} px-4 py-4`}>
          <h3 className="text-[13.5px] font-semibold text-[#172033]">Nenhum Perfil de Acesso</h3>
          <p className="mt-1 text-[12.5px] leading-5 text-[#667085]">
            A coleção de Perfis de Acesso deste portal está vazia.
          </p>
        </div>
      ) : (
        <ul
          className={
            // `items-start` nas duas visões: sem ele, a linha da grade estica
            // todos os itens até a altura do mais alto, e um perfil de um
            // departamento ficava com o tamanho do que tem onze.
            view === 'list'
              ? 'grid items-start gap-2'
              : 'grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3'
          }
        >
          {orderedProfiles.map((profile) => (
            <li key={profile.id}>
              <ProfileCard
                onDelete={() => onDeleteProfile(profile)}
                onEdit={() => onEditProfile(profile)}
                onOpenDetail={() => onOpenDetail(profile.id)}
                profile={profile}
                view={view}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Estado da coleção quando ela não pôde ser usada.
 *
 * Os dois motivos ficam separados porque significam coisas diferentes, e
 * nenhum deles é uma coleção vazia: a página não cria, não substitui e não
 * apaga nada em nenhum dos dois.
 */
function CollectionFailurePanel({ reason }: { reason: AccessProfileStorageFailureReason }) {
  const content =
    reason === 'audience-classification-required'
      ? {
          title: 'Perfis de Acesso no formato anterior',
          description:
            'Os Perfis de Acesso gravados neste navegador ainda não indicam se são de Executivos ou de Analistas. Eles continuam intactos, e esta página não cria perfis por conta própria enquanto essa classificação não for feita.',
        }
      : {
          title: 'Não foi possível ler os Perfis de Acesso',
          description:
            'O armazenamento do navegador está indisponível ou o conteúdo gravado não pôde ser lido. Nada foi alterado nem apagado, e esta lista não representa uma coleção vazia.',
        }

  return (
    <div className="rounded-xl border border-[#f3d9a5] bg-[#fffaf0] px-4 py-4">
      <h3 className="text-[13.5px] font-semibold text-[#7a5a12]">{content.title}</h3>
      <p className="mt-1 text-[12.5px] leading-5 text-[#8a6a2a]">{content.description}</p>
    </div>
  )
}

/**
 * Alternador entre lista e grade.
 *
 * A escolha é gravada no navegador e restaurada na próxima visita. Quando o
 * armazenamento recusa a gravação, ela continua valendo até o fim da sessão.
 * `aria-pressed` comunica qual está ativa, e o rótulo de cada botão diz o que
 * ele faz, sem depender do ícone.
 */
function ViewToggle({
  onViewChange,
  view,
}: {
  onViewChange: (view: AccessProfilesView) => void
  view: AccessProfilesView
}) {
  const buttonClass =
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
  const activeClass = 'bg-white text-[var(--accent)] shadow-[0_1px_2px_rgba(16,24,40,.08)]'
  const inactiveClass = 'text-[#667085] hover:bg-white hover:text-[#344054]'

  return (
    <div className="flex flex-none items-center gap-1 rounded-lg border border-[#eaecf2] bg-[#f6f8fb] p-1">
      <button
        aria-label="Ver em lista"
        aria-pressed={view === 'list'}
        className={`${buttonClass} ${view === 'list' ? activeClass : inactiveClass}`}
        onClick={() => onViewChange('list')}
        title="Ver em lista"
        type="button"
      >
        <List aria-hidden="true" size={16} />
      </button>
      <button
        aria-label="Ver em grade"
        aria-pressed={view === 'grid'}
        className={`${buttonClass} ${view === 'grid' ? activeClass : inactiveClass}`}
        onClick={() => onViewChange('grid')}
        title="Ver em grade"
        type="button"
      >
        <LayoutGrid aria-hidden="true" size={16} />
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Confirmação da exclusão                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Confirmação da exclusão de um Perfil de Acesso comum, ou o aviso de que ela
 * ainda não é possível.
 *
 * O mesmo diálogo cobre os dois estados de propósito. A lixeira continua sempre
 * disponível no card, e é aqui que o Administrador descobre por que aquele perfil
 * não sai e o que precisa acontecer antes: um botão apagado no card informaria
 * que não dá, sem dizer o que fazer.
 *
 * Com usuários dentro, o perfil não é excluído. O diálogo perde o botão
 * destrutivo e passa a ter só o fechamento: não existe confirmação a oferecer
 * para uma operação que o domínio recusa.
 *
 * Vazio, é a confirmação de sempre: mesmo Radix Dialog e mesma composição da
 * confirmação de status da aba Usuários, com foco preso, fechamento por Escape e
 * por clique no overlay, e o botão destrutivo à direita, que diz o que faz por
 * escrito e não apenas pela cor. Nada é excluído até `Excluir perfil`.
 *
 * Uma recusa não fecha o diálogo: a mensagem aparece acima dos botões, afirmando
 * que nada foi alterado, e a mesma confirmação continua disponível para nova
 * tentativa.
 */
function DeleteProfileDialog({
  error,
  onCancel,
  onConfirm,
  profile,
}: {
  error: string | null
  onCancel: () => void
  onConfirm: () => void
  profile: PreviewProfile | null
}) {
  const hasUsers = profile !== null && profile.userCount > 0

  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
      open={profile !== null}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-[0_18px_44px_rgba(16,24,40,.24)]">
          <Dialog.Title className="text-base font-bold text-[#101828]">
            {hasUsers
              ? 'Este Perfil de Acesso ainda não pode ser excluído'
              : 'Excluir Perfil de Acesso?'}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-[#475467]">
            {profile === null
              ? ''
              : hasUsers
                ? `O perfil “${profile.name}” continua como está.`
                : `O perfil “${profile.name}” será excluído do portal.`}
          </Dialog.Description>
          {profile === null ? null : (
            <p className="mt-2 text-[13px] leading-relaxed text-[#475467]">
              {describeAccessProfileDeletionImpact(profile.userCount)}
            </p>
          )}
          {error ? (
            <p
              className="mt-3 rounded-lg border border-[#f4c7c9] bg-[#fdf3f3] px-3 py-2 text-[12.5px] font-medium leading-5 text-[#b42318]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2.5">
            <Button onClick={onCancel} variant={hasUsers ? 'primary' : 'secondary'}>
              {hasUsers ? 'Fechar' : 'Cancelar'}
            </Button>
            {hasUsers ? null : (
              <Button
                className="bg-[#e5484d] hover:bg-[#d13438] focus-visible:ring-[#e5484d]"
                onClick={onConfirm}
              >
                <Trash2 aria-hidden="true" size={15} />
                Excluir perfil
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* -------------------------------------------------------------------------- */
/* Usuários sem perfil de acesso definido                                     */
/* -------------------------------------------------------------------------- */

/**
 * Usuários sem vínculo persistente com um Perfil de Acesso existente e
 * compatível com o próprio Perfil do Sistema.
 *
 * Sem nenhum caso a seção não renderiza, porque não há nada a dizer.
 *
 * Cada linha traz a ação `Definir perfil`, que resolve a situação onde ela é
 * lida. Antes, a única saída era abrir o formulário do perfil de destino e
 * procurar a pessoa na aba Usuários: a informação estava aqui e a ação estava
 * três telas adiante. A atribuição continua sendo responsabilidade da área
 * Perfis de Acesso, e a aba Usuários do formulário continua existindo para
 * compor e transferir vários de uma vez.
 */
function UnassignedSection({
  onAssign,
  users,
}: {
  onAssign: (user: PreviewUnassignedUser) => void
  users: PreviewUnassignedUser[]
}) {
  if (users.length === 0) return null

  return (
    <section aria-labelledby="unassigned-title" className="grid gap-2">
      {/* Sem contador ao lado do título. A regra nasceu para não repetir o
          indicador `Sem perfil definido` do resumo, e vale igual agora que ele
          saiu: a lista está logo abaixo, com nome e e-mail de cada pessoa, e um
          número em cima dela seria a contagem do que já está à vista. */}
      <h3 className={sectionHeadingClass} id="unassigned-title">
        Usuários sem perfil de acesso definido
      </h3>
      <p className="text-[12px] leading-4 text-[#667085]">
        Estes usuários não possuem um vínculo válido com os Perfis de Acesso exibidos e não
        conseguem entrar no portal até receberem um.
      </p>
      {/* Um contorno para a lista inteira, e não um por usuário: são linhas de
          uma mesma leitura, e uma moldura por pessoa dava a elas o mesmo peso
          dos cards de perfil. */}
      <ul className={`divide-y divide-[#f2f4f8] overflow-hidden ${surfaceClass}`}>
        {users.map((user) => (
          <li
            className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
            key={user.id}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <UserAvatar initials={user.initials} profile={user.profile} />
              <span className="min-w-0">
                <span className="block break-words text-[12.5px] font-medium text-[#172033]">
                  {user.name}
                </span>
                {/* E-mail no lugar dos departamentos: sem vínculo, repetir os
                    acessos expandidos antigos não identifica a pessoa nem
                    descreve uma concessão válida. */}
                <span className="mt-0.5 block break-all text-[11.5px] leading-4 text-[#667085]">
                  {user.email}
                </span>
              </span>
            </span>
            {/* Badge e ação na mesma coluna da direita: o badge identifica o
                Perfil do Sistema, e é justamente ele que decide quais perfis o
                modal poderá oferecer. */}
            <span className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1.5 justify-self-start sm:justify-self-end">
              <span className={`${chipClass} flex-none ${profileColorClasses[user.profile]}`}>
                {user.profile}
              </span>
              <AssignAction onAssign={() => onAssign(user)} userName={user.name} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Ação textual de cada linha da seção.
 *
 * Texto, e não ícone: `Definir perfil` é uma ação de escrita e precisa dizer o que
 * faz por escrito, e a linha já tem avatar e badge disputando o olhar. Usa o mesmo
 * azul e o mesmo comportamento de `Ver detalhes`, que é a linguagem da tela para
 * "isto abre algo", e o nome acessível diz de quem é o perfil que será definido.
 */
function AssignAction({
  onAssign,
  userName,
}: {
  onAssign: () => void
  userName: string
}) {
  return (
    <button
      aria-label={`Definir perfil de acesso de ${userName}`}
      className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-md text-[11.5px] font-semibold leading-[1.45] text-[#2563eb] transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      onClick={onAssign}
      type="button"
    >
      Definir perfil
      <ChevronRight aria-hidden="true" size={14} />
    </button>
  )
}
