import { ChevronRight, LayoutGrid, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
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
  AccessProfileFormModal,
  DRAFT_PROFILE_ID,
  type AccessProfileFormMode,
} from './AccessProfileFormDrawer'
import {
  assignableUsersForAudience,
  buildAccessProfilesPreviewModel,
  withoutAssignmentsTo,
  type AccessProfilesPreviewModel,
  type PreviewProfile,
  type PreviewUnassignedUser,
} from './accessProfilesPreviewModel'
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
 * Nenhuma operação de escrita existe aqui além dessa inicialização e da
 * preferência de visualização: criar, editar e selecionar usuários são
 * composição visual, em estado local que morre com a tela. Nenhum usuário é
 * alterado, nenhum vínculo é gravado e nenhum perfil é criado ou editado por
 * esta página.
 *
 * A correspondência entre usuário e perfil é provisória e somente leitura: o
 * vínculo persistido ainda não existe no portal.
 */

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
  // Leitura única na montagem, como na tabela de Usuários e no Histórico. As
  // duas operações de armazenamento acontecem antes da leitura e são
  // idempotentes: a inicialização só grava quando ainda não existe coleção
  // nenhuma, e a atualização só reescreve os perfis iniciais que continuam
  // exatamente como a versão anterior os criou.
  const [collection] = useState(() => {
    ensureInitialAccessProfiles()
    refreshInitialAccessProfiles()

    return listAccessProfiles()
  })
  const [users] = useState(() => listUsers())

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
   * Seleção de usuários no estado local de avaliação: id do usuário para id do
   * perfil, ou null quando ele foi retirado de todos. A chave ausente significa
   * "como está hoje". Ela mora aqui, e não dentro do formulário, porque é o que
   * faz um usuário escolhido em um perfil deixar de aparecer selecionado em
   * qualquer outro. Nada disso é gravado, e a lista da página continua
   * descrevendo a correspondência provisória calculada na leitura.
   */
  const [assignments, setAssignments] = useState<ReadonlyMap<string, string | null>>(
    () => new Map(),
  )

  /**
   * Destino do perfil que está sendo criado, ainda sem escolha.
   *
   * Mora aqui, e não dentro do formulário, porque trocá-lo precisa mexer nas
   * seleções de usuários, que vivem em `assignments`: manter os dois no mesmo
   * lugar é o que garante que nenhuma seleção incompatível fique escondida no
   * estado depois da troca. Na edição ele não é usado, porque o destino vem
   * gravado no perfil e não muda.
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
   * Destino em vigor no formulário aberto.
   *
   * Na edição vem gravado no perfil e é imutável; na criação é a escolha do
   * rascunho. O perfil do sistema não chega aqui, porque não é editável, e a
   * checagem de tipo devolve `null` em vez de assumir um destino que o perfil
   * comum nunca teria.
   */
  const formAudience: StandardAccessProfileAudience | null =
    form === null
      ? null
      : form.mode === 'edit'
        ? isStandardAccessProfileAudience(form.profile.audience)
          ? form.profile.audience
          : null
        : draftAudience

  const compatibleUsers = useMemo(
    () => assignableUsersForAudience(preview.assignableUsers, formAudience),
    [preview.assignableUsers, formAudience],
  )

  function currentProfileIdOf(userId: string): string | null {
    const override = assignments.get(userId)

    return override === undefined ? (matchedProfileByUser.get(userId) ?? null) : override
  }

  // Sobre os compatíveis, e não sobre a coleção inteira: um usuário que o
  // destino descarta não pode aparecer selecionado nem em contagem nenhuma.
  const selectedUserIds = new Set(
    formProfileId === null
      ? []
      : compatibleUsers
          .filter((user) => currentProfileIdOf(user.id) === formProfileId)
          .map((user) => user.id),
  )

  /**
   * Marca ou desmarca um usuário no formulário aberto.
   *
   * Desmarcar significa coisas diferentes nos dois modos. Na EDIÇÃO, tirar
   * alguém do perfil é uma decisão sobre um perfil que existe: ele fica sem
   * perfil, e a chave grava `null`. Na CRIAÇÃO, o rascunho ainda não é nada, e
   * desmarcar é apenas desfazer a escolha: a chave sai do mapa e o usuário volta
   * exatamente para a situação em que estava.
   */
  function toggleUser(userId: string, selected: boolean) {
    setAssignments((current) => {
      const next = new Map(current)

      if (selected) next.set(userId, formProfileId)
      else if (form?.mode === 'create') next.delete(userId)
      else next.set(userId, null)

      return next
    })
  }

  /** Esquece tudo o que o rascunho de criação marcou. */
  function clearDraftAssignments() {
    setAssignments((current) => withoutAssignmentsTo(current, DRAFT_PROFILE_ID, new Set()))
  }

  /**
   * Troca o destino do rascunho e devolve à situação original quem deixou de ser
   * compatível.
   *
   * A limpeza acontece no mesmo movimento da troca, de propósito: se as seleções
   * incompatíveis ficassem no mapa, elas sumiriam da tela (a lista passa a
   * mostrar só os compatíveis) e continuariam existindo no estado, prontas para
   * reaparecer se o destino voltasse.
   */
  function changeDraftAudience(next: StandardAccessProfileAudience) {
    const keepUserIds = new Set(
      assignableUsersForAudience(preview.assignableUsers, next).map((user) => user.id),
    )

    setDraftAudience(next)
    setAssignments((current) => withoutAssignmentsTo(current, DRAFT_PROFILE_ID, keepUserIds))
  }

  /** Abre o Novo perfil sempre do zero: sem destino e sem usuários marcados. */
  function openCreateForm() {
    clearDraftAssignments()
    setDraftAudience(null)
    setForm({ mode: 'create' })
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

  function openEditForm() {
    if (detailProfile === null || detailProfile.isSystem) return

    setForm({ mode: 'edit', profile: detailProfile })
  }

  function closeForm() {
    // Sair do Novo perfil volta para a página; sair da edição volta para a
    // consulta do mesmo perfil, que continua no alvo. Cancelar a criação
    // descarta o rascunho inteiro: destino e usuários marcados.
    if (form?.mode === 'create') {
      setDetailProfileId(null)
      clearDraftAssignments()
      setDraftAudience(null)
    }

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

      <ProfilesSection
        failure={collection.ok ? null : collection.reason}
        onOpenDetail={setDetailProfileId}
        onViewChange={changeView}
        preview={preview}
        view={view}
      />

      <UnassignedSection users={preview.unassignedUsers} />

      <AccessProfileDetailsModal
        onEdit={openEditForm}
        onOpenChange={(open) => {
          if (!open) setDetailProfileId(null)
        }}
        open={detailOpen}
        profile={detailProfile}
      />

      <AccessProfileFormModal
        audience={formAudience}
        compatibleUsers={compatibleUsers}
        form={form}
        onAudienceChange={changeDraftAudience}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
        onToggleUser={toggleUser}
        selectedUserIds={selectedUserIds}
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
  onOpenDetail,
  profile,
  view,
}: {
  onOpenDetail: () => void
  profile: PreviewProfile
  view: AccessProfilesView
}) {
  const className = `${cardBaseClass} ${profile.isSystem ? cardSystemClass : cardStandardClass}`

  if (view === 'grid') {
    return (
      <div className={`${className} grid gap-2`}>
        <ProfileIdentity profile={profile} />
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
      {/* `justify-end` também aqui: a partir de `md` a coluna tem a largura do
          próprio conteúdo e nada muda, mas abaixo disso a grade colapsa em uma
          coluna só, e sem ele a ação voltaria para a esquerda. */}
      <div className="flex justify-end md:pt-0.5">
        <DetailsAction onOpenDetail={onOpenDetail} profileName={profile.name} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Coleção de perfis                                                          */
/* -------------------------------------------------------------------------- */

function ProfilesSection({
  failure,
  onOpenDetail,
  onViewChange,
  preview,
  view,
}: {
  /** Motivo pelo qual os perfis comuns não puderam ser lidos, ou null. */
  failure: AccessProfileStorageFailureReason | null
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
      {/* Três indicadores na mesma linguagem tipográfica da aba Usuários:
          rótulo pequeno em caixa alta e número em fonte monoespaçada, sem
          cartão, sem fundo e sem borda. Nenhum deles conta protegidos: o perfil
          do sistema entra no total como qualquer outro. */}
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
          <SummaryStat
            label="Sem perfil definido"
            value={preview.unassignedUserCount}
            // Âmbar: pede atenção sem afirmar erro. Um acesso sem perfil
            // equivalente é um estado legítimo do portal hoje, e pintá-lo de
            // vermelho transformaria leitura em alarme.
            valueClassName="text-[#b45309]"
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
/* Usuários sem perfil de acesso definido                                     */
/* -------------------------------------------------------------------------- */

/**
 * Usuários cujos acessos atuais não correspondem a exatamente um Perfil de
 * Acesso.
 *
 * Não é erro nem pendência: é a leitura honesta de que aquele acesso ainda não
 * tem um perfil equivalente, ou de que tem mais de um. Sem nenhum caso a seção
 * não renderiza, porque não há nada a dizer.
 *
 * NÃO existe aqui um botão de atribuir perfil. A atribuição ainda não é
 * persistida, e um botão desabilitado ou sem efeito prometeria uma ação que o
 * portal não entrega. Ele entra junto com a persistência, em bloco próprio.
 */
function UnassignedSection({ users }: { users: PreviewUnassignedUser[] }) {
  if (users.length === 0) return null

  return (
    <section aria-labelledby="unassigned-title" className="grid gap-2">
      {/* Sem contador ao lado do título: o indicador `Sem perfil definido`, no
          resumo da página, já mostra este mesmo número, e repeti-lo aqui fazia
          o Administrador conferir duas vezes se os dois batiam. */}
      <h3 className={sectionHeadingClass} id="unassigned-title">
        Usuários sem perfil de acesso definido
      </h3>
      <p className="text-[12px] leading-4 text-[#667085]">
        Os acessos atuais destes usuários ainda não correspondem a um dos Perfis de Acesso
        exibidos.
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
                {/* E-mail no lugar dos departamentos acessados: aquela lista
                    descrevia o acesso antigo, que é justamente o que ainda não
                    virou perfil, e não ajudava a identificar a pessoa. */}
                <span className="mt-0.5 block break-all text-[11.5px] leading-4 text-[#667085]">
                  {user.email}
                </span>
              </span>
            </span>
            <span
              className={`${chipClass} flex-none justify-self-start sm:justify-self-end ${
                profileColorClasses[user.profile]
              }`}
            >
              {user.profile}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
