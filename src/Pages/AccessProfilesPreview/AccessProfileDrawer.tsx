import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '../../components/ui/button'
import { profileColorClasses } from '../../lib/profileColors'
import {
  CORPORATE_ACCESS_LABEL,
  type PreviewProfile,
  type PreviewUser,
} from './accessProfilesPreviewModel'
import {
  chipClass,
  countClass,
  DepartmentAccordion,
  DrawerTabPanel,
  DrawerTabs,
  InDevelopmentBadge,
  sectionTitleClass,
  type DrawerTab,
} from './accessProfilesUi'
import { DepartmentCoverageChip } from './DepartmentCoverageChip'

/**
 * Drawer de consulta de um Perfil de Acesso.
 *
 * Somente leitura: mostra o que o perfil concede e quem corresponde a ele, sem
 * nenhuma ação sobre os dados. O botão Editar apenas abre o formulário visual,
 * que também não grava nada.
 *
 * Os indicadores de cobertura são os mesmos dos cards, com a mesma identidade
 * azul: eles não recebem cor de fora, porque a cor não distingue departamento.
 *
 * Usa o mesmo Radix Dialog do drawer da tela de Usuários, com as mesmas classes
 * de overlay e de painel lateral. É de lá que vêm, sem reimplementação, o foco
 * inicial, o foco preso, o fechamento por Escape, o bloqueio da rolagem de
 * fundo, o retorno do foco ao elemento que abriu e o nome acessível vindo do
 * `Dialog.Title`.
 *
 * A página inicial do perfil não aparece em lugar nenhum deste drawer: o campo
 * existe no domínio persistido, mas não faz parte desta composição.
 */

const TABS: readonly DrawerTab[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'acessos', label: 'Acessos' },
  { id: 'usuarios', label: 'Usuários' },
]

export function AccessProfileDrawer({
  onEdit,
  onOpenChange,
  open,
  profile,
}: {
  onEdit: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  profile: PreviewProfile | null
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#101828]/40" />
        {/* Mesma ancoragem do drawer de Usuários, com mais largura: o mapa de
            acessos precisa de espaço, e max-w-[94vw] mantém o painel quase
            inteiro em telas pequenas sem nunca gerar rolagem horizontal. */}
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-[620px] max-w-[94vw] flex-col bg-white shadow-[-10px_0_34px_rgba(16,24,40,.18)]">
          {profile ? <DrawerBody onEdit={onEdit} profile={profile} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Conteúdo separado do invólucro porque o Radix monta o `Dialog.Content` com
 * título e descrição já presentes: sem o perfil não há nome acessível a
 * declarar, e o drawer nunca abre nesse estado.
 */
function DrawerBody({ onEdit, profile }: { onEdit: () => void; profile: PreviewProfile }) {
  const baseId = useId()
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id)

  const tabs = TABS.map((tab) =>
    tab.id === 'usuarios' ? { ...tab, label: `Usuários (${profile.userCount})` } : tab,
  )

  return (
    <>
      {/* Cabeçalho e abas ficam fora da área rolável: só o painel da aba rola. */}
      <div className="flex flex-none items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Dialog.Title className="text-base font-bold text-[#172033]">
              {profile.name}
            </Dialog.Title>
            {profile.isSystem ? (
              <span className={`${chipClass} bg-[#e6edff] text-[#2f6bff]`}>Sistema</span>
            ) : null}
          </div>
          <Dialog.Description className="mt-0.5 text-xs text-[#98a2b3]">
            {profile.isSystem ? 'Perfil do sistema' : 'Perfil de Acesso'} · {profile.audienceLabel}
          </Dialog.Description>
        </div>
        <div className="flex flex-none items-center gap-1">
          {/* Acesso Total não é editável: o portal o mantém, e um botão que
              nunca vai abrir edição só ensinaria o caminho errado. */}
          {profile.isSystem ? null : (
            <Button onClick={onEdit} size="sm" variant="secondary">
              <Pencil aria-hidden="true" size={15} />
              Editar
            </Button>
          )}
          <Dialog.Close asChild>
            <Button aria-label="Fechar" size="icon" variant="ghost">
              <X aria-hidden="true" size={18} />
            </Button>
          </Dialog.Close>
        </div>
      </div>

      <DrawerTabs
        activeTabId={activeTab}
        baseId={baseId}
        onTabChange={setActiveTab}
        tabs={tabs}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {activeTab === 'resumo' ? (
          <DrawerTabPanel baseId={baseId} tabId="resumo">
            <SummaryTab profile={profile} />
          </DrawerTabPanel>
        ) : null}
        {activeTab === 'acessos' ? (
          <DrawerTabPanel baseId={baseId} tabId="acessos">
            <AccessTab profile={profile} />
          </DrawerTabPanel>
        ) : null}
        {activeTab === 'usuarios' ? (
          <DrawerTabPanel baseId={baseId} tabId="usuarios">
            <UsersTab users={profile.users} />
          </DrawerTabPanel>
        ) : null}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Resumo                                                                     */
/* -------------------------------------------------------------------------- */

function SummaryTab({ profile }: { profile: PreviewProfile }) {
  return (
    <div className="grid gap-5">
      <div>
        <div className={sectionTitleClass}>Descrição</div>
        <p className="mt-1 text-[12.5px] leading-5 text-[#475467]">
          {profile.description || 'Este Perfil de Acesso não tem descrição.'}
        </p>
      </div>

      <div>
        <div className={sectionTitleClass}>Destino</div>
        <p className="mt-1 text-[12.5px] leading-5 text-[#475467]">{profile.audienceLabel}</p>
      </div>

      {/* Disponíveis e em desenvolvimento ficam em linhas separadas: uma página
          em desenvolvimento está concedida, mas não abre, e somá-las
          descreveria um acesso que o portal não entrega hoje. */}
      <dl className="grid gap-2.5 rounded-lg border border-[#eaecf2] bg-[#f6f8fb] px-3.5 py-3">
        <SummaryRow label="Usuários correspondentes" value={profile.userCount} />
        <SummaryRow label="Departamentos" value={profile.departmentCount} />
        <SummaryRow label="Páginas disponíveis" value={profile.pageTotals.available} />
        <SummaryRow label="Páginas em desenvolvimento" value={profile.pageTotals.inDevelopment} />
      </dl>

      {profile.hasCorporateAccess ? (
        <div>
          <div className={sectionTitleClass}>Acesso corporativo</div>
          <p className="mt-1 text-[12.5px] leading-5 text-[#475467]">{CORPORATE_ACCESS_LABEL}</p>
        </div>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12.5px] text-[#667085]">{label}</dt>
      <dd className={`text-[13px] font-semibold text-[#172033] ${countClass}`}>{value}</dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Acessos                                                                    */
/* -------------------------------------------------------------------------- */

function AccessTab({ profile }: { profile: PreviewProfile }) {
  return (
    <div className="grid gap-4">
      {/* A Visão Geral Executiva é um acesso corporativo, e não um
          departamento: ela vem antes da lista e fora dela. */}
      {profile.hasCorporateAccess ? (
        <div className="rounded-lg border border-[#d8e3ff] bg-[#f5f8ff] px-3.5 py-3">
          <div className={sectionTitleClass}>Acesso corporativo</div>
          <p className="mt-1 text-[13px] font-semibold text-[#172033]">{CORPORATE_ACCESS_LABEL}</p>
        </div>
      ) : null}

      {profile.departments.length === 0 ? (
        <p className="text-[12.5px] text-[#667085]">Nenhum departamento vinculado a este perfil.</p>
      ) : (
        <div>
          {/* Os mesmos indicadores do card: a cobertura resumida vem primeiro,
              e o detalhe página a página vem logo abaixo. */}
          <div className={sectionTitleClass}>Acessos</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.departments.map((department) => (
              <DepartmentCoverageChip
                coverage={department.coverage}
                key={department.departmentId}
                label={department.label}
              />
            ))}
          </div>
          <ul className="mt-3 grid gap-1.5">
            {profile.departments.map((department) => (
              <li key={department.departmentId}>
                <DepartmentAccordion
                  label={department.label}
                  meta={
                    <>
                      <span className={countClass}>{department.coverage.granted}</span> de{' '}
                      <span className={countClass}>{department.coverage.total}</span> disponíveis
                      {department.pageTotals.inDevelopment > 0 ? (
                        <>
                          {' · '}
                          <span className={countClass}>
                            {department.pageTotals.inDevelopment}
                          </span>{' '}
                          em desenvolvimento
                        </>
                      ) : null}
                    </>
                  }
                >
                  <ul>
                    {department.pages.map((page) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-[12.5px]"
                        key={page.pageKey}
                      >
                        <span
                          className={`min-w-0 break-words ${
                            page.inDevelopment ? 'text-[#667085]' : 'text-[#475467]'
                          }`}
                        >
                          {page.label}
                        </span>
                        {page.inDevelopment ? <InDevelopmentBadge /> : null}
                      </li>
                    ))}
                  </ul>
                </DepartmentAccordion>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Usuários                                                                   */
/* -------------------------------------------------------------------------- */

function UsersTab({ users }: { users: PreviewUser[] }) {
  if (users.length === 0) {
    return (
      <p className="text-[12.5px] text-[#667085]">
        Nenhum usuário corresponde a este perfil no momento.
      </p>
    )
  }

  return (
    <ul className="grid gap-2">
      {users.map((user) => (
        <li
          className="grid gap-2 rounded-lg border border-[#eaecf2] bg-white px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          key={user.id}
        >
          <span className="min-w-0">
            <span className="block break-words text-[12.5px] font-medium text-[#172033]">
              {user.name}
            </span>
            <span className="block break-all text-[11.5px] text-[#667085]">{user.email}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <span className={`${chipClass} flex-none ${profileColorClasses[user.profile]}`}>
              {user.profile}
            </span>
            <StatusChip status={user.status} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Mesmas cores de status da tabela de Usuários, com o estado sempre escrito. */
function StatusChip({ status }: { status: PreviewUser['status'] }) {
  return (
    <span
      className={`${chipClass} flex-none ${
        status === 'Ativo' ? 'bg-[#dcfce7] text-[#16794a]' : 'bg-[#f1f3f7] text-[#667085]'
      }`}
    >
      {status}
    </span>
  )
}
