import * as Dialog from '@radix-ui/react-dialog'
import {Pencil, X} from 'lucide-react'

import {Button} from '../../components/ui/button'
import {formatUserStatus} from '../../lib/formatters'
import {profileColorClass} from '../../lib/profileColors'
import {type ProfileUserView, type ProfileView} from './accessProfilesModel'
import {
    chipClass,
    consultModalClass,
    countClass,
    modalOverlayClass,
    modalShellClass,
    sectionTitleClass,
    UserAvatar,
} from './accessProfilesUi'
import {DepartmentCoverageChip} from './DepartmentCoverageChip'
import {userStatusColorClasses} from '../../lib/userStatusColors'

/**
 * Modal central de consulta de um Perfil de Acesso.
 *
 * O nome do arquivo ainda diz `Drawer` porque renomeá-lo é um movimento de Git,
 * e esta rodada não executa nenhum. O componente é um modal central: o drawer
 * lateral saiu.
 *
 * Somente leitura: mostra o que o perfil concede e quem corresponde a ele, sem
 * nenhuma ação sobre os dados. O botão Editar apenas abre o formulário visual,
 * que também não grava nada.
 *
 * NÃO tem abas. A consulta é uma leitura contínua, de cima para baixo:
 * descrição, Perfil do Sistema, acessos e usuários. Antes eram três abas para
 * três blocos curtos, e quem abria o perfil para conferir uma coisa precisava
 * clicar para descobrir onde ela estava.
 *
 * Usa o mesmo Radix Dialog da tela de Usuários. É de lá que vêm, sem
 * reimplementação, o foco inicial, o foco preso, o fechamento por Escape e por
 * clique no overlay, o bloqueio da rolagem de fundo e o nome acessível vindo do
 * `Dialog.Title`.
 *
 * A página inicial do perfil não aparece aqui: o campo existe no domínio
 * persistido, mas não faz parte desta composição. Datas e responsáveis de
 * criação e edição também não aparecem: o domínio ainda não tem esses campos, e
 * exibi-los exigiria inventá-los.
 */

export function AccessProfileDetailsModal({
                                              onEdit,
                                              onOpenChange,
                                              open,
                                              profile,
                                          }: {
    onEdit: () => void
    onOpenChange: (open: boolean) => void
    open: boolean
    profile: ProfileView | null
}) {
    return (
        <Dialog.Root onOpenChange={onOpenChange} open={open}>
            <Dialog.Portal>
                <Dialog.Overlay className={modalOverlayClass}/>
                <Dialog.Content className={`${modalShellClass} ${consultModalClass}`}>
                    {profile ? <DetailsBody onEdit={onEdit} profile={profile}/> : null}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

/**
 * Conteúdo separado do invólucro porque o Radix monta o `Dialog.Content` com
 * título e descrição já presentes: sem o perfil não há nome acessível a
 * declarar, e o modal nunca abre nesse estado.
 */
function DetailsBody({onEdit, profile}: { onEdit: () => void; profile: ProfileView }) {
    return (
        <>
            {/* Cabeçalho fixo: só a faixa do meio rola. */}
            <div className="flex flex-none items-start justify-between gap-3 border-b border-[#eef0f4] px-5 py-3.5">
                <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Dialog.Title className="break-words text-[16px] font-bold leading-tight text-[#172033]">
                            {profile.name}
                        </Dialog.Title>
                    </div>
                    <HeaderSummary profile={profile}/>
                </div>
                <Dialog.Description className="sr-only">
                    Consulta do Perfil de Acesso {profile.name}.
                </Dialog.Description>
                <div className="flex flex-none items-center gap-1">
                    {/* Todo perfil é editável: o `Acesso do Sistema` somente leitura
              deixou de existir junto com o tipo de perfil em `access`. */}
                    <Button onClick={onEdit} size="sm">
                        <Pencil aria-hidden="true" size={15}/>
                        Editar
                    </Button>
                    <Dialog.Close asChild>
                        <Button aria-label="Fechar" size="icon" variant="ghost">
                            <X aria-hidden="true" size={18}/>
                        </Button>
                    </Dialog.Close>
                </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
                <DescriptionSection profile={profile}/>
                <AccessSection profile={profile}/>
                <UsersSection users={profile.users}/>
            </div>
        </>
    )
}

/**
 * Linha de resumo sob o título: departamentos e usuários.
 *
 * O DESTINO abria esta linha, com a cor oficial do Perfil do Sistema, e saiu:
 * um Perfil de Acesso não se destina mais a ninguém em particular. O que sobra
 * é o que ele concede e quantas pessoas o usam.
 *
 * Departamento e usuário são flexionados pela contagem, e a linha quebra em
 * telas estreitas.
 */
function HeaderSummary({profile}: { profile: ProfileView }) {
    return (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-4 text-[#667085]">
      <span>
        <span className={countClass}>{profile.groupCount}</span>{' '}
          {profile.groupCount === 1 ? 'departamento' : 'departamentos'}
      </span>
            <span aria-hidden="true">·</span>
            <span>
        <span className={countClass}>{profile.userCount}</span>{' '}
                {profile.userCount === 1 ? 'usuário' : 'usuários'}
      </span>
        </p>
    )
}

/** Rótulo de bloco, o mesmo sobrescrito usado na página. */
function SectionLabel({children}: { children: string }) {
    return <div className={sectionTitleClass}>{children}</div>
}

/* -------------------------------------------------------------------------- */
/* Descrição                                                                  */

/* -------------------------------------------------------------------------- */

function DescriptionSection({profile}: { profile: ProfileView }) {
    return (
        <section>
            <SectionLabel>Descrição</SectionLabel>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-[#475467]">
                {profile.description || 'Este Perfil de Acesso não tem descrição.'}
            </p>
        </section>
    )
}

/* -------------------------------------------------------------------------- */
/* Acessos                                                                    */

/* -------------------------------------------------------------------------- */

/**
 * Cobertura por departamento, com o detalhe das páginas dentro de cada label.
 *
 * A lista de acordeões saiu. Um departamento aparecia duas vezes, uma no label
 * e outra no acordeão, e o modal ficava com uma coluna de páginas que quase
 * nunca era aberta. Agora o label é o detalhe: quem quer saber quais páginas
 * entram passa o cursor, dá Tab ou toca nele.
 */
function AccessSection({profile}: { profile: ProfileView }) {
    const hasNothing = profile.groups.length === 0

    return (
        <section>
            <SectionLabel>Acessos</SectionLabel>

            {hasNothing ? (
                <p className="mt-1.5 text-[12.5px] text-[#667085]">
                    Nenhum departamento vinculado a este perfil.
                </p>
            ) : (
                // A Visão Geral Executiva saiu desta linha. Ela nunca foi concedida por
                // um Perfil de Acesso: quem a abre é decidido pelo Perfil do Sistema da
                // pessoa, em `lib/homeNavigation`.
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.groups.map((group) => (
                        <DepartmentCoverageChip
                            coverage={group.coverage}
                            key={group.id}
                            label={group.label}
                            pages={group.pages}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

/* -------------------------------------------------------------------------- */
/* Usuários                                                                   */

/* -------------------------------------------------------------------------- */

function UsersSection({users}: { users: ProfileUserView[] }) {
    return (
        <section>
            {/* Sem contador ao lado do título: a linha do cabeçalho já diz
          `... · N usuários`, e o mesmo número duas vezes na mesma tela obriga a
          conferir se os dois concordam. */}
            <SectionLabel>Usuários</SectionLabel>

            {users.length === 0 ? (
                <p className="mt-1.5 text-[12.5px] text-[#667085]">
                    Nenhum usuário corresponde a este perfil no momento.
                </p>
            ) : (
                // Um contorno para a lista inteira, com linhas divididas: com uma
                // moldura por pessoa, percorrer dez usuários era percorrer dez caixas.
                <ul className="mt-2 divide-y divide-[#f2f4f8] overflow-hidden rounded-lg border border-[#eaecf2]">
                    {users.map((user) => (
                        <li
                            className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                            key={user.id}
                        >
              <span className="flex min-w-0 items-center gap-2.5">
                <UserAvatar initials={user.initials} profile={user.profileCode}/>
                <span className="min-w-0">
                  <span className="block break-words text-[12.5px] font-medium text-[#172033]">
                    {user.name}
                  </span>
                  <span className="mt-0.5 block break-all text-[11.5px] leading-4 text-[#667085]">
                    {user.email}
                  </span>
                </span>
              </span>
                            <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <span className={`${chipClass} flex-none ${profileColorClass(user.profileCode)}`}>
                  {user.profileName || user.profileCode}
                </span>
                <StatusChip status={user.status}/>
              </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}

/**
 * Mesmas cores de status da tabela de Usuários, com o estado sempre escrito.
 *
 * As cores vêm do mapa compartilhado, e não de um ternário local: antes eram dois
 * literais aqui, e `Pendente` chegava pintado de cinza, como se fosse um usuário
 * desativado.
 */
function StatusChip({status}: { status: ProfileUserView['status'] }) {
    return (
        <span className={`${chipClass} flex-none ${userStatusColorClasses[status]}`}>
      {formatUserStatus(status)}
    </span>
    )
}
