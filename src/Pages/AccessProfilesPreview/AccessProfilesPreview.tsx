import { ChevronRight, LayoutGrid, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { profileColorClasses } from '../../lib/profileColors'
import {
  listAccessProfiles,
  type AccessProfileStorageFailureReason,
} from '../../services/accessProfiles/accessProfileRepository'
import {
  ensureInitialAccessProfiles,
  refreshInitialAccessProfiles,
} from '../../services/accessProfiles/initialAccessProfiles'
import { listUsers } from '../../services/users/userRepository'
import { AccessProfileDrawer } from './AccessProfileDrawer'
import {
  AccessProfileFormDrawer,
  DRAFT_PROFILE_ID,
  type AccessProfileFormMode,
} from './AccessProfileFormDrawer'
import {
  buildAccessProfilesPreviewModel,
  CORPORATE_ACCESS_LABEL,
  type AccessProfilesPreviewModel,
  type PreviewProfile,
  type PreviewUnassignedUser,
} from './accessProfilesPreviewModel'
import { chipClass, countClass, sectionTitleClass } from './accessProfilesUi'
import { DepartmentCoverageChip } from './DepartmentCoverageChip'

/**
 * Perfis de Acesso.
 *
 * A tela lista os Perfis de Acesso reais do repositório: identidade, nome,
 * destino, departamentos e páginas vêm do domínio persistido, e não dos acessos
 * dos usuários. A coleção inicial é semeada uma única vez, quando o
 * armazenamento ainda não tem nenhuma coleção.
 *
 * Nenhuma operação de escrita existe aqui além dessa inicialização: criar,
 * editar e selecionar usuários são composição visual, em estado local que morre
 * com a tela. Nenhum usuário é alterado, nenhum vínculo é gravado e nenhum
 * perfil é criado ou editado por esta página.
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
const cardClass = `flex w-full cursor-pointer flex-col gap-2.5 p-4 text-left transition ${surfaceClass} hover:border-[#d6dbe6] hover:bg-[#f6f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]`
const headingClass = 'text-[15px] font-semibold text-[#172033]'

type ProfileView = 'list' | 'grid'

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

  const [view, setView] = useState<ProfileView>('list')
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

  function currentProfileIdOf(userId: string): string | null {
    const override = assignments.get(userId)

    return override === undefined ? (matchedProfileByUser.get(userId) ?? null) : override
  }

  const selectedUserIds = new Set(
    formProfileId === null
      ? []
      : preview.assignableUsers
          .filter((user) => currentProfileIdOf(user.id) === formProfileId)
          .map((user) => user.id),
  )

  function toggleUser(userId: string, selected: boolean) {
    setAssignments((current) => {
      const next = new Map(current)
      next.set(userId, selected ? formProfileId : null)

      return next
    })
  }

  function openEditForm() {
    if (detailProfile === null || detailProfile.isSystem) return

    setForm({ mode: 'edit', profile: detailProfile })
  }

  function closeForm() {
    // Sair do Novo perfil volta para a página; sair da edição volta para a
    // consulta do mesmo perfil, que continua no alvo.
    if (form?.mode === 'create') setDetailProfileId(null)
    setForm(null)
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#172033]">Perfis de acesso</h2>
          <p className="mt-1 text-[13px] text-[#667085]">
            Controle quais áreas e páginas cada grupo de usuários pode visualizar.
          </p>
        </div>
        <Button onClick={() => setForm({ mode: 'create' })} size="sm">
          <Plus aria-hidden="true" size={15} />
          Novo perfil
        </Button>
      </div>

      {preview.systemProfile ? (
        <SystemProfileSection
          onOpenDetail={() => setDetailProfileId(preview.systemProfile?.id ?? null)}
          profile={preview.systemProfile}
        />
      ) : null}

      <ProfilesSection
        failure={collection.ok ? null : collection.reason}
        onOpenDetail={setDetailProfileId}
        onViewChange={setView}
        preview={preview}
        view={view}
      />

      <UnassignedSection users={preview.unassignedUsers} />

      <AccessProfileDrawer
        onEdit={openEditForm}
        onOpenChange={(open) => {
          if (!open) setDetailProfileId(null)
        }}
        open={detailOpen}
        profile={detailProfile}
      />

      <AccessProfileFormDrawer
        assignableUsers={preview.assignableUsers}
        form={form}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
        onToggleUser={toggleUser}
        selectedUserIds={selectedUserIds}
      />
    </div>
  )
}

/** Perfil apontado pelo alvo atual, do sistema ou comum. */
function resolveProfile(
  preview: AccessProfilesPreviewModel,
  profileId: string | null,
): PreviewProfile | null {
  if (profileId === null) return null
  if (preview.systemProfile && profileId === preview.systemProfile.id) return preview.systemProfile

  return preview.profiles.find((profile) => profile.id === profileId) ?? null
}

/* -------------------------------------------------------------------------- */
/* Acessos do perfil                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Seção Acessos de um card: um chip por departamento concedido, lado a lado e
 * com quebra automática de linha.
 *
 * Todos os departamentos aparecem, sem `+ N` e sem corte: o card cresce com o
 * conteúdo, e é por isso que não existe altura fixa aqui.
 */
function ProfileAccessSection({
  departments,
}: {
  departments: PreviewProfile['departments']
}) {
  return (
    <span className="block">
      <span className={`block ${sectionTitleClass}`}>Acessos</span>
      {departments.length === 0 ? (
        <span className="mt-1.5 block text-[12.5px] text-[#667085]">
          Nenhum departamento concedido.
        </span>
      ) : (
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {departments.map((department) => (
            <DepartmentCoverageChip
              coverage={department.coverage}
              key={department.departmentId}
              label={department.label}
            />
          ))}
        </span>
      )}
    </span>
  )
}

/** Destino e quantidade de usuários correspondentes, em uma linha só. */
function ProfileMeta({ profile }: { profile: PreviewProfile }) {
  return (
    <span className="block text-[12.5px] leading-5 text-[#667085]">
      {profile.audienceLabel}
      {' · '}
      <span className={countClass}>{profile.userCount}</span>{' '}
      {profile.userCount === 1 ? 'usuário' : 'usuários'}
    </span>
  )
}

function DetailsAction({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-[var(--accent)]">
      <span className={compact ? 'hidden md:inline' : undefined}>Ver detalhes</span>
      <ChevronRight aria-hidden="true" size={16} />
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Perfil do sistema                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Faixa protegida do Acesso Total.
 *
 * Fica em seção própria, com linha lateral azul e fundo azul muito suave: ele
 * não é comparável aos demais, não é editável e não participa da alternância
 * entre lista e grade.
 */
function SystemProfileSection({
  onOpenDetail,
  profile,
}: {
  onOpenDetail: () => void
  profile: PreviewProfile
}) {
  return (
    <section aria-labelledby="system-profile-title" className="grid gap-2.5">
      <h3 className={headingClass} id="system-profile-title">
        Perfil do sistema
      </h3>
      <div className="rounded-xl border border-[#d8e3ff] border-l-[3px] border-l-[#2f6bff] bg-[#f5f8ff] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] font-semibold text-[#172033]">{profile.name}</span>
              <span className={`${chipClass} bg-[#e6edff] text-[#2f6bff]`}>Sistema</span>
            </div>
            <p className="mt-1 text-[12.5px] leading-5 text-[#667085]">
              {profile.audienceLabel}
              {' · '}
              <span className={countClass}>{profile.userCount}</span>{' '}
              {profile.userCount === 1 ? 'usuário' : 'usuários'}
              {' · '}
              {CORPORATE_ACCESS_LABEL}
            </p>
            <div className="mt-3">
              <ProfileAccessSection departments={profile.departments} />
            </div>
          </div>
          <Button
            aria-label={`Ver detalhes de ${profile.name}`}
            className="flex-none"
            onClick={onOpenDetail}
            size="sm"
            variant="secondary"
          >
            Ver detalhes
          </Button>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Perfis de Acesso                                                           */
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
  onViewChange: (view: ProfileView) => void
  preview: AccessProfilesPreviewModel
  view: ProfileView
}) {
  const { profiles } = preview

  return (
    <section aria-labelledby="profiles-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className={headingClass} id="profiles-title">
            Perfis de Acesso
          </h3>
          {/* Linha compacta no lugar de cartões de indicador: a tela é uma
              ferramenta de controle, e o número grande no topo não ajuda a
              decidir nada aqui. */}
          <p className="mt-1 text-[12.5px] text-[#667085]">
            <span className={countClass}>{preview.profileCount}</span>{' '}
            {preview.profileCount === 1 ? 'Perfil de Acesso' : 'Perfis de Acesso'}
            {' · '}
            <span className={countClass}>{preview.matchedUserCount}</span>{' '}
            {preview.matchedUserCount === 1
              ? 'usuário correspondente'
              : 'usuários correspondentes'}
            {preview.unassignedUserCount > 0 ? (
              <>
                {' · '}
                <span className={countClass}>{preview.unassignedUserCount}</span> em Acessos atuais
                sem perfil
              </>
            ) : null}
          </p>
        </div>
        <ViewToggle onViewChange={onViewChange} view={view} />
      </div>

      {failure ? (
        <CollectionFailurePanel reason={failure} />
      ) : profiles.length === 0 ? (
        <div className={`${surfaceClass} p-5`}>
          <h4 className="text-[14px] font-semibold text-[#172033]">Nenhum Perfil de Acesso</h4>
          <p className="mt-1.5 text-[13px] text-[#667085]">
            A coleção de Perfis de Acesso deste portal está vazia.
          </p>
        </div>
      ) : (
        <ul
          className={
            view === 'list'
              ? 'grid items-start gap-2'
              : 'grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3'
          }
        >
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                className={cardClass}
                onClick={() => onOpenDetail(profile.id)}
                type="button"
              >
                {/* Lista e grade compartilham o mesmo card: o que muda é a
                    largura dada pela grade, e os chips reagem a ela sozinhos. */}
                <span className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[14px] font-semibold text-[#172033]">
                      {profile.name}
                    </span>
                    <ProfileMeta profile={profile} />
                  </span>
                  {view === 'list' ? (
                    <span className="flex-none pt-0.5">
                      <DetailsAction compact />
                    </span>
                  ) : null}
                </span>

                <ProfileAccessSection departments={profile.departments} />

                {view === 'list' ? null : (
                  <span className="block pt-0.5">
                    <DetailsAction />
                  </span>
                )}
              </button>
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
      <h4 className="text-[14px] font-semibold text-[#7a5a12]">{content.title}</h4>
      <p className="mt-1.5 text-[12.5px] leading-5 text-[#8a6a2a]">{content.description}</p>
    </div>
  )
}

/**
 * Alternador entre lista e grade.
 *
 * Estado local e nada mais: a escolha não é gravada, não vai para o
 * localStorage e volta para lista a cada visita. `aria-pressed` comunica qual
 * está ativa, e o rótulo de cada botão diz o que ele faz, sem depender do ícone.
 */
function ViewToggle({
  onViewChange,
  view,
}: {
  onViewChange: (view: ProfileView) => void
  view: ProfileView
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
/* Acessos atuais sem perfil                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Usuários cujos acessos atuais não correspondem a exatamente um Perfil de
 * Acesso.
 *
 * Seção secundária e discreta: não é erro nem pendência. Sem nenhum caso ela
 * não renderiza, porque não há nada a dizer.
 */
function UnassignedSection({ users }: { users: PreviewUnassignedUser[] }) {
  if (users.length === 0) return null

  return (
    <section aria-labelledby="unassigned-title" className="grid gap-2.5">
      <div>
        <h3 className="text-[14px] font-semibold text-[#344054]" id="unassigned-title">
          Acessos atuais sem perfil
        </h3>
        <p className="mt-1 text-[12.5px] text-[#667085]">
          Estes acessos ainda não correspondem a um dos Perfis de Acesso exibidos.
        </p>
      </div>
      <ul className="grid gap-2">
        {users.map((user) => (
          <li
            className={`grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${surfaceClass}`}
            key={user.id}
          >
            <span className="min-w-0">
              <span className="block break-words text-[13px] font-medium text-[#172033]">
                {user.name}
              </span>
              <span className="mt-0.5 block break-words text-[12px] text-[#667085]">
                {user.departmentLabels.length === 0
                  ? 'Nenhum departamento vinculado'
                  : user.departmentLabels.join(', ')}
              </span>
            </span>
            <span
              className={`${chipClass} justify-self-start sm:justify-self-end ${
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
