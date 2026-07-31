import type { ReactNode } from 'react'

import type { BiArea } from '../../config/biAreas'
import { biAreas } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import {
  MODEL_PAGE_KEY,
  OVERVIEW_PAGE_KEY,
  defaultDepartmentPageKeys,
} from '../../lib/userAccessRules'
import type { UserProfile } from '../../types/access'

/**
 * Seção de acessos do drawer de usuários. Só edita rascunhos: as regras fixas
 * de cada perfil continuam sendo impostas pelo repositório, e os departamentos
 * e páginas vêm sempre de `biAreas` e `departmentPages`, sem nenhuma lista
 * paralela declarada aqui.
 *
 * O que aparece depende do perfil selecionado no momento, e não do perfil
 * salvo: Administrador não tem seleção granular, Executivo escolhe apenas onde
 * o Modelo fica liberado e Usuário Departamental escolhe departamentos e
 * páginas.
 */

/** Rascunho de um departamento do Usuário Departamental. */
export type DepartmentSelectionDraft = {
  departmentId: string
  pageKeys: string[]
}

type UserAccessEditorProps = {
  /** Perfil selecionado no formulário, ainda não salvo. */
  profile: UserProfile
  /** true na edição da própria conta: a seção inteira fica bloqueada. */
  disabled: boolean
  modelDepartmentIds: string[]
  onModelDepartmentIdsChange: (next: string[]) => void
  departmentSelections: DepartmentSelectionDraft[]
  onDepartmentSelectionsChange: (next: DepartmentSelectionDraft[]) => void
}

/** Página de Modelo do departamento, quando o catálogo tiver uma. */
function modelPageOf(area: BiArea) {
  return departmentPages[area.id].find((page) => page.key === MODEL_PAGE_KEY) ?? null
}

export function UserAccessEditor({
  profile,
  disabled,
  modelDepartmentIds,
  onModelDepartmentIdsChange,
  departmentSelections,
  onDepartmentSelectionsChange,
}: UserAccessEditorProps) {
  function toggleModelDepartment(area: BiArea, granted: boolean) {
    onModelDepartmentIdsChange(
      granted
        ? [...modelDepartmentIds, area.id]
        : modelDepartmentIds.filter((departmentId) => departmentId !== area.id),
    )
  }

  /** Departamento novo nasce com as páginas padrão; ao sair, leva junto todo o
      acesso daquele departamento. */
  function toggleDepartment(area: BiArea, selected: boolean) {
    onDepartmentSelectionsChange(
      selected
        ? [...departmentSelections, { departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) }]
        : departmentSelections.filter((selection) => selection.departmentId !== area.id),
    )
  }

  /** Marcar repõe a página na ordem do catálogo; desmarcar apenas a remove. */
  function togglePage(area: BiArea, pageKey: string, selected: boolean) {
    // A Visão Geral acompanha o departamento e não sai por aqui.
    if (pageKey === OVERVIEW_PAGE_KEY && !selected) return

    onDepartmentSelectionsChange(
      departmentSelections.map((selection) => {
        if (selection.departmentId !== area.id) return selection

        const pageKeys = selected
          ? departmentPages[area.id]
              .filter((page) => page.key === pageKey || selection.pageKeys.includes(page.key))
              .map((page) => page.key)
          : selection.pageKeys.filter((key) => key !== pageKey)

        return { ...selection, pageKeys }
      }),
    )
  }

  if (profile === 'Administrador') {
    return (
      <AccessNotice>
        Administrador possui acesso global a todos os departamentos e páginas do portal.
      </AccessNotice>
    )
  }

  if (profile === 'Executivo') {
    return (
      <div>
        <AccessNotice>
          Executivo recebe todos os departamentos e todas as páginas comuns, que não podem ser
          removidas. Apenas o Modelo Dimensional é liberado individualmente.
        </AccessNotice>
        <div className="mt-3 overflow-hidden rounded-[10px] border border-[#eef0f4]">
          {biAreas.map((area) => {
            const modelPage = modelPageOf(area)

            return (
              <div
                className="flex items-center justify-between gap-3 border-b border-[#f4f6fa] px-3 py-2.5 last:border-b-0"
                key={area.id}
              >
                <span className="min-w-0 truncate text-[12.5px] font-medium text-[#344054]">
                  {area.label}
                </span>
                {modelPage ? (
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-[#475467]">
                    {modelPage.disabled ? <DevelopmentBadge /> : null}
                    <input
                      checked={modelDepartmentIds.includes(area.id)}
                      className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
                      disabled={disabled}
                      onChange={(event) => toggleModelDepartment(area, event.target.checked)}
                      type="checkbox"
                    />
                    Modelo Dimensional
                  </label>
                ) : (
                  <span className="shrink-0 text-[11.5px] text-[#98a2b3]">
                    Sem Modelo Dimensional no catálogo
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <AccessNotice>
        Ao marcar um departamento, o usuário recebe todas as páginas dele, menos o Modelo
        Dimensional. Retire individualmente o que não deve ficar disponível. A Visão Geral é a
        página de entrada do departamento e acompanha sempre a seleção.
      </AccessNotice>
      {departmentSelections.length === 0 ? (
        <p className="mt-2 text-[11.5px] font-medium text-[#b54708]">
          Selecione pelo menos um departamento.
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {biAreas.map((area) => {
          const selection = departmentSelections.find((item) => item.departmentId === area.id) ?? null
          // Visão Geral é o piso do departamento: sozinha, só sai junto com ele.
          const onlyOverview =
            selection !== null &&
            selection.pageKeys.every((pageKey) => pageKey === OVERVIEW_PAGE_KEY)

          return (
            <div className="overflow-hidden rounded-[10px] border border-[#eef0f4]" key={area.id}>
              <label
                className={`flex items-center gap-2.5 px-3 py-2.5 text-[12.5px] font-semibold text-[#344054] ${
                  disabled ? '' : 'cursor-pointer'
                } ${selection ? 'bg-[#f7f9fc]' : ''}`}
              >
                <input
                  checked={selection !== null}
                  className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
                  disabled={disabled}
                  onChange={(event) => toggleDepartment(area, event.target.checked)}
                  type="checkbox"
                />
                {area.label}
              </label>
              {selection ? (
                <div className="border-t border-[#f4f6fa] px-3 py-2">
                  {departmentPages[area.id].map((page) => {
                    const isModel = page.key === MODEL_PAGE_KEY
                    const isOverview = page.key === OVERVIEW_PAGE_KEY
                    // Visão Geral acompanha o departamento: sempre marcada e sem
                    // como sair, porque é o destino do departamento na navegação.
                    const checked = isOverview || selection.pageKeys.includes(page.key)

                    return (
                      <label
                        className={`flex items-center gap-2.5 py-1.5 text-[12px] text-[#475467] ${
                          disabled || isOverview ? '' : 'cursor-pointer'
                        }`}
                        key={page.key}
                      >
                        <input
                          checked={checked}
                          className="h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
                          disabled={disabled || isOverview}
                          onChange={(event) => togglePage(area, page.key, event.target.checked)}
                          type="checkbox"
                        />
                        <span className="min-w-0 truncate">{page.label}</span>
                        {isOverview ? (
                          <span className="shrink-0 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10.5px] font-semibold text-[#175cd3]">
                            Obrigatória
                          </span>
                        ) : null}
                        {isModel ? (
                          <span className="shrink-0 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10.5px] font-semibold text-[#3538cd]">
                            Acesso especial
                          </span>
                        ) : null}
                        {page.disabled ? <DevelopmentBadge /> : null}
                      </label>
                    )
                  })}
                  {onlyOverview ? (
                    <p className="mt-1 text-[11px] text-[#98a2b3]">
                      Para remover este acesso, desmarque o departamento.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Página autorizada que ainda está em desenvolvimento: a permissão existe, a
    tela é que continua bloqueada. */
function DevelopmentBadge() {
  return (
    <span className="shrink-0 rounded-full bg-[#fef4e6] px-2 py-0.5 text-[10.5px] font-semibold text-[#b54708]">
      Em desenvolvimento
    </span>
  )
}

function AccessNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-[#dbeafe] bg-[#f5f8ff] px-3 py-2 text-[12px] leading-relaxed text-[#344054]">
      {children}
    </p>
  )
}
