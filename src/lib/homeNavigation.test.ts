import { describe, expect, it } from 'vitest'

import { biAreas, CORPORATE_OVERVIEW_PATH, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import type { AuthUser } from '../types/user/userTypes'
import { buildAuthUser, buildAuthUserFromGrants } from './authUserFixtures'
import { PROFILE_TYPE_CODE_BY_USER_PROFILE } from '../services/users/userApiMapper'
import { getDepartmentPageAccessState } from './accessControl'
import { departmentPagePath } from './departmentPageRoutes'
import {
  accessibleHomeDepartmentIds,
  canChooseHomeDepartment,
  FALLBACK_HOME_PATH,
  resolveHomeDepartmentId,
  resolveHomePath,
  shouldDiscardHomeDepartment,
  usesCorporateHome,
} from './homeNavigation'
import { SETTINGS_PROFILE_PATH } from './settingsNavigation'
import { defaultDepartmentPageKeys, OVERVIEW_PAGE_KEY, type UserAccessConfig } from './userAccessRules'

/**
 * Testes da regra central da Página Inicial.
 *
 * Os usuários são derivados por `deriveUserAccess`, a mesma regra da base
 * mockada e do repositório, e os departamentos vêm de `biAreas`: nenhum acesso e
 * nenhuma rota são escritos à mão. O único usuário montado campo a campo é o
 * inconsistente, que a derivação não produz de propósito.
 */

const [firstArea, secondArea, thirdArea] = biAreas

function buildUser(config: UserAccessConfig, overrides: Partial<AuthUser> = {}): AuthUser {
  return buildAuthUser(config, overrides)
}

function analystOf(...areaIds: BiAreaId[]): AuthUser {
  return buildUser({
    profile: 'Analista',
    departments: areaIds.map((departmentId) => ({
      departmentId,
      pageKeys: defaultDepartmentPageKeys(departmentId),
    })),
  })
}

/** Analista com acesso inconsistente: nenhum departamento e nenhuma página. */
const analystWithoutAccess: AuthUser = {
  id: 'usr-999',
  name: 'Analista sem acesso',
  email: 'sem.acesso@impactotelecom.com',
  status: 'active',
  isActive: true,
  lastAccess: '2026-01-01T00:00:00.000Z',
  profileSystemId: 'profile-system-999',
  accessProfileId: 'access-profile-999',
  profileType: { id: 'profile-type-999', code: 'analyst', name: 'Analista' },
  access: { id: 'access-profile-999', name: 'Perfil de Acesso de Teste' },
  setPasswordExpire: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  departmentPageAccess: [],
}

const administrator = buildUser({ profile: 'Administrador' })
const executive = buildUser({ profile: 'Executivo' })

function overviewPathOf(areaId: BiAreaId): string {
  const path = departmentPagePath(areaId, OVERVIEW_PAGE_KEY)
  if (!path) throw new Error(`Catálogo sem Visão Geral em ${areaId}.`)

  return path
}

/* -------------------------------------------------------------------------- */
/* Quem abre a Visão Geral Executiva                                          */
/* -------------------------------------------------------------------------- */

describe('quem abre a Visão Geral Executiva', () => {
  it('não leva ninguém à Visão Geral Executiva enquanto ela está desligada', () => {
    expect(usesCorporateHome(administrator)).toBe(false)
    expect(usesCorporateHome(executive)).toBe(false)

    expect(resolveHomePath(administrator, null)).toBe(overviewPathOf('os'))
    expect(resolveHomePath(executive, null)).toBe(overviewPathOf('os'))
  })

  it('respeita a preferência de departamento de Administrador e Executivo', () => {
    expect(resolveHomePath(administrator, secondArea.id)).toBe(overviewPathOf(secondArea.id))
    expect(resolveHomePath(executive, secondArea.id)).toBe(overviewPathOf(secondArea.id))
  })

  it('nunca leva o Analista à Visão Geral Executiva', () => {
    const analyst = analystOf(firstArea.id)

    expect(usesCorporateHome(analyst)).toBe(false)
    expect(resolveHomePath(analyst, null)).not.toBe(CORPORATE_OVERVIEW_PATH)
  })

  it('não entrega a Visão Geral Executiva sem usuário nem a perfil desconhecido', () => {
    // Um perfil gravado fora dos três oficiais cai no caminho mais restrito, e
    // não herda a página executiva por não ser Analista.
    const unknownProfile: AuthUser = {
      ...analystWithoutAccess,
      profileType: { ...analystWithoutAccess.profileType, code: 'Gestor' },
    }

    expect(usesCorporateHome(null)).toBe(false)
    expect(usesCorporateHome(unknownProfile)).toBe(false)
    expect(resolveHomePath(null, null)).toBe(FALLBACK_HOME_PATH)
    expect(resolveHomePath(unknownProfile, null)).toBe(FALLBACK_HOME_PATH)
  })
})

/* -------------------------------------------------------------------------- */
/* Departamentos permitidos                                                   */
/* -------------------------------------------------------------------------- */

describe('departamentos permitidos como Página Inicial', () => {
  it('lista todos os departamentos do Administrador e do Executivo', () => {
    const allIds = biAreas.map((area) => area.id)

    expect(accessibleHomeDepartmentIds(administrator)).toEqual(allIds)
    expect(accessibleHomeDepartmentIds(executive)).toEqual(allIds)
  })

  it('lista somente os departamentos concedidos ao Analista', () => {
    expect(accessibleHomeDepartmentIds(analystOf(secondArea.id))).toEqual([secondArea.id])
  })

  it('segue a ordem oficial de biAreas, e não a ordem em que o acesso foi gravado', () => {
    const analyst = analystOf(thirdArea.id, firstArea.id)

    expect(analyst.departmentPageAccess.map((access) => access.departmentId)).toEqual([
      thirdArea.id,
      firstArea.id,
    ])
    expect(accessibleHomeDepartmentIds(analyst)).toEqual([firstArea.id, thirdArea.id])
  })

  it('devolve lista vazia sem usuário e para acesso inconsistente', () => {
    expect(accessibleHomeDepartmentIds(null)).toEqual([])
    expect(accessibleHomeDepartmentIds(analystWithoutAccess)).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Departamento inicial                                                       */
/* -------------------------------------------------------------------------- */

describe('departamento inicial', () => {
  it('usa o único departamento permitido quando só existe um', () => {
    const analyst = analystOf(secondArea.id)

    expect(resolveHomeDepartmentId(analyst, null)).toBe(secondArea.id)
    expect(resolveHomePath(analyst, null)).toBe(overviewPathOf(secondArea.id))
  })

  it('abre em Ordens de Serviço quando não há escolha e a Visão Geral de OS é permitida', () => {
    // O padrão não depende da ordem do catálogo: `os` não é o primeiro item de
    // `biAreas`, e mesmo assim é ele que assume sem escolha gravada.
    const analyst = analystOf(firstArea.id, 'os', thirdArea.id)

    expect(biAreas[0].id).not.toBe('os')
    expect(resolveHomeDepartmentId(analyst, null)).toBe('os')
    expect(resolveHomePath(analyst, null)).toBe(overviewPathOf('os'))
  })

  it('usa o primeiro permitido na ordem oficial quando a Visão Geral de OS não é permitida', () => {
    const analyst = analystOf(thirdArea.id, firstArea.id)

    expect(accessibleHomeDepartmentIds(analyst)).not.toContain('os')
    expect(resolveHomeDepartmentId(analyst, null)).toBe(firstArea.id)
    expect(resolveHomePath(analyst, null)).toBe(overviewPathOf(firstArea.id))
  })

  it('prefere a escolha gravada ao padrão de Ordens de Serviço', () => {
    const analyst = analystOf(firstArea.id, 'os')

    expect(resolveHomeDepartmentId(analyst, firstArea.id)).toBe(firstArea.id)
    expect(resolveHomePath(analyst, firstArea.id)).toBe(overviewPathOf(firstArea.id))
  })

  it('respeita a preferência quando ela continua permitida', () => {
    const analyst = analystOf(firstArea.id, thirdArea.id)

    expect(resolveHomeDepartmentId(analyst, thirdArea.id)).toBe(thirdArea.id)
    expect(resolveHomePath(analyst, thirdArea.id)).toBe(overviewPathOf(thirdArea.id))
  })

  it('descarta a preferência de um departamento que o usuário não acessa', () => {
    const analyst = analystOf(firstArea.id, thirdArea.id)

    expect(resolveHomeDepartmentId(analyst, secondArea.id)).toBe(firstArea.id)
    expect(resolveHomePath(analyst, secondArea.id)).toBe(overviewPathOf(firstArea.id))
  })

  it('descarta preferência fora do catálogo, vazia ou fora de forma', () => {
    const analyst = analystOf(firstArea.id, thirdArea.id)

    for (const preference of ['departamento-que-nao-existe', '', ' ', 'null']) {
      expect(resolveHomeDepartmentId(analyst, preference)).toBe(firstArea.id)
    }
  })

  it('mantém a escolha válida mesmo quando o usuário ganha departamentos novos', () => {
    const before = analystOf(firstArea.id, thirdArea.id)
    const after = analystOf(firstArea.id, secondArea.id, thirdArea.id)

    expect(resolveHomeDepartmentId(before, thirdArea.id)).toBe(thirdArea.id)
    expect(resolveHomeDepartmentId(after, thirdArea.id)).toBe(thirdArea.id)
  })

  it('usa o destino seguro quando não há nenhuma Visão Geral concedida', () => {
    expect(resolveHomeDepartmentId(analystWithoutAccess, firstArea.id)).toBeNull()
    expect(resolveHomePath(analystWithoutAccess, firstArea.id)).toBe(FALLBACK_HOME_PATH)
    expect(FALLBACK_HOME_PATH).toBe(SETTINGS_PROFILE_PATH)
    expect(FALLBACK_HOME_PATH).not.toBe(CORPORATE_OVERVIEW_PATH)
  })

  it('nunca devolve a própria Visão Geral Executiva a quem é encaminhado a partir dela', () => {
    // É o que impede ciclo de redirecionamento: quem não abre a página
    // executiva sempre recebe um destino diferente dela.
    const users = [
      null,
      analystOf(firstArea.id),
      analystOf(firstArea.id, secondArea.id),
      analystWithoutAccess,
    ]

    for (const user of users) {
      expect(usesCorporateHome(user)).toBe(false)
      expect(resolveHomePath(user, null)).not.toBe(CORPORATE_OVERVIEW_PATH)
      expect(resolveHomePath(user, secondArea.id)).not.toBe(CORPORATE_OVERVIEW_PATH)
    }
  })

  it('nunca concede acesso: a preferência só escolhe entre o que já é permitido', () => {
    const analyst = analystOf(firstArea.id)

    for (const area of biAreas) {
      const resolved = resolveHomeDepartmentId(analyst, area.id)

      expect(resolved).toBe(firstArea.id)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Página inicial dentro do departamento                                      */
/* -------------------------------------------------------------------------- */

describe('página inicial dentro do departamento', () => {
  it('é sempre a Visão Geral, em qualquer departamento permitido', () => {
    for (const area of biAreas) {
      const analyst = analystOf(area.id)
      const path = resolveHomePath(analyst, area.id)

      expect(path).toBe(overviewPathOf(area.id))
      expect(departmentPages[area.id][0].key).toBe(OVERVIEW_PAGE_KEY)
      expect(path.endsWith('/visao-geral')).toBe(true)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Quem pode escolher                                                         */
/* -------------------------------------------------------------------------- */

describe('quem pode escolher o departamento inicial', () => {
  it('oferece escolha a Administrador e Executivo com a página executiva desligada', () => {
    expect(canChooseHomeDepartment(administrator)).toBe(true)
    expect(canChooseHomeDepartment(executive)).toBe(true)
  })

  it('não oferece escolha ao Analista com um único departamento', () => {
    expect(canChooseHomeDepartment(analystOf(firstArea.id))).toBe(false)
  })

  it('oferece escolha ao Analista com dois ou mais departamentos', () => {
    expect(canChooseHomeDepartment(analystOf(firstArea.id, secondArea.id))).toBe(true)
    expect(canChooseHomeDepartment(analystOf(firstArea.id, secondArea.id, thirdArea.id))).toBe(true)
  })

  it('não oferece escolha sem usuário nem para acesso inconsistente', () => {
    expect(canChooseHomeDepartment(null)).toBe(false)
    expect(canChooseHomeDepartment(analystWithoutAccess)).toBe(false)
  })

  it('oferece a escolha a qualquer perfil que comece por um departamento', () => {
    // Com a Visão Geral Executiva desligada, todo usuário começa por um
    // departamento, então o critério deixa de ser o Perfil do Sistema. Um perfil
    // desconhecido ou um rótulo legado ainda não normalizado também escolhe, e
    // isso não concede nada: a lista oferecida continua sendo a dos
    // departamentos que ele já abre.
    const analyst = analystOf(firstArea.id, secondArea.id)

    for (const code of ['Gestor', 'Usuário Departamental', '']) {
      const user: AuthUser = { ...analyst, profileType: { ...analyst.profileType, code } }

      expect(usesCorporateHome(user)).toBe(false)
      expect(accessibleHomeDepartmentIds(user)).toEqual([firstArea.id, secondArea.id])
      expect(canChooseHomeDepartment(user)).toBe(true)
    }

    expect(canChooseHomeDepartment(analyst)).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Descarte da escolha que deixou de valer                                    */
/* -------------------------------------------------------------------------- */

describe('descarte da escolha gravada', () => {
  it('não descarta uma escolha que continua permitida', () => {
    const analyst = analystOf(firstArea.id, thirdArea.id)

    expect(shouldDiscardHomeDepartment(analyst, firstArea.id)).toBe(false)
    expect(shouldDiscardHomeDepartment(analyst, thirdArea.id)).toBe(false)
  })

  it('descarta a escolha de um departamento que o usuário não acessa mais', () => {
    const before = analystOf(firstArea.id, secondArea.id)
    const after = analystOf(firstArea.id)

    expect(shouldDiscardHomeDepartment(before, secondArea.id)).toBe(false)
    expect(shouldDiscardHomeDepartment(after, secondArea.id)).toBe(true)
  })

  it('descarta escolha fora do catálogo ou fora de forma', () => {
    const analyst = analystOf(firstArea.id, thirdArea.id)

    for (const stored of ['departamento-que-nao-existe', '', ' ', 'null']) {
      expect(shouldDiscardHomeDepartment(analyst, stored)).toBe(true)
    }
  })

  it('descarta qualquer escolha de quem não tem nenhuma Visão Geral concedida', () => {
    expect(shouldDiscardHomeDepartment(analystWithoutAccess, firstArea.id)).toBe(true)
  })

  it('não descarta nada sem usuário nem sem escolha gravada', () => {
    const analyst = analystOf(firstArea.id)

    expect(shouldDiscardHomeDepartment(null, firstArea.id)).toBe(false)
    expect(shouldDiscardHomeDepartment(null, null)).toBe(false)
    expect(shouldDiscardHomeDepartment(analyst, null)).toBe(false)
  })

  it('não descarta a escolha de Administrador e Executivo, quando ela é de um departamento real', () => {
    // Administrador e Executivo alcançam todos os departamentos, então nada do
    // que esteja gravado para eles deixou de ser permitido.
    expect(shouldDiscardHomeDepartment(administrator, secondArea.id)).toBe(false)
    expect(shouldDiscardHomeDepartment(executive, secondArea.id)).toBe(false)
    expect(shouldDiscardHomeDepartment(administrator, 'departamento-que-nao-existe')).toBe(true)
  })

  it('resolve para o primeiro permitido exatamente no caso em que manda descartar', () => {
    // O caminho não muda com a remoção: a escolha inválida já era ignorada, e é
    // isso que impede ciclo de redirecionamento depois do descarte.
    const analyst = analystOf(firstArea.id, thirdArea.id)

    expect(shouldDiscardHomeDepartment(analyst, secondArea.id)).toBe(true)
    expect(resolveHomePath(analyst, secondArea.id)).toBe(overviewPathOf(firstArea.id))
    expect(resolveHomePath(analyst, null)).toBe(overviewPathOf(firstArea.id))
  })
})

/* -------------------------------------------------------------------------- */
/* Combinações reais de Perfil do Sistema e departamentos                     */
/* -------------------------------------------------------------------------- */

/**
 * As mesmas combinações que existiam na base semeada do portal, resolvidas pela
 * regra central: um Administrador, um Executivo, um Analista de um departamento
 * só e um Analista de vários. A base mockada acabou, mas as combinações
 * continuam sendo as que a validação em tela cobre.
 */
describe('Página Inicial por Perfil do Sistema', () => {
  it('mantém o Administrador na Visão Geral Executiva', () => {
    const user = buildUser({ profile: 'Administrador' })

    expect(user.profileType.code).toBe(PROFILE_TYPE_CODE_BY_USER_PROFILE.Administrador)
    expect(resolveHomePath(user, null)).toBe('/dashboard/os/visao-geral')
    expect(canChooseHomeDepartment(user)).toBe(true)
  })

  it('mantém o Executivo na Visão Geral Executiva', () => {
    const user = buildUser({ profile: 'Executivo' })

    expect(user.profileType.code).toBe(PROFILE_TYPE_CODE_BY_USER_PROFILE.Executivo)
    expect(resolveHomePath(user, null)).toBe('/dashboard/os/visao-geral')
    expect(canChooseHomeDepartment(user)).toBe(true)
  })

  it('abre o Analista de um departamento na Visão Geral dele, sem oferecer escolha', () => {
    const user = analystOf('os')

    expect(user.profileType.code).toBe(PROFILE_TYPE_CODE_BY_USER_PROFILE.Analista)
    expect(accessibleHomeDepartmentIds(user)).toEqual(['os'])
    expect(resolveHomePath(user, null)).toBe('/dashboard/os/visao-geral')
    expect(canChooseHomeDepartment(user)).toBe(false)
  })

  it('abre o Analista de vários departamentos no primeiro da ordem oficial e oferece escolha', () => {
    // Ordens de Serviço, Suporte Técnico, COP, Auditoria Técnica e Gestão de
    // Frota. Na ordem de `biAreas`, o primeiro deles é a Auditoria Técnica.
    const user = analystOf('os', 'suporte-tecnico', 'cop', 'auditoria-tecnica', 'gestao-frota')

    expect(user.profileType.code).toBe(PROFILE_TYPE_CODE_BY_USER_PROFILE.Analista)
    expect(accessibleHomeDepartmentIds(user)).toEqual([
      'auditoria-tecnica',
      'cop',
      'gestao-frota',
      'os',
      'suporte-tecnico',
    ])
    expect(canChooseHomeDepartment(user)).toBe(true)
    expect(resolveHomePath(user, null)).toBe('/dashboard/os/visao-geral')
    expect(resolveHomePath(user, 'gestao-frota')).toBe('/dashboard/gestao-frota/visao-geral')
    // Um departamento que ele não acessa não vira Página Inicial.
    expect(resolveHomePath(user, 'comercial')).toBe('/dashboard/os/visao-geral')
  })

  it('descarta a escolha de um departamento que o Analista não acessa', () => {
    const user = analystOf('os', 'suporte-tecnico', 'cop', 'auditoria-tecnica', 'gestao-frota')

    expect(shouldDiscardHomeDepartment(user, 'gestao-frota')).toBe(false)
    expect(shouldDiscardHomeDepartment(user, 'comercial')).toBe(true)
  })

  it('não deixa nenhum Analista cair na Visão Geral Executiva', () => {
    const analysts = [
      analystOf('os'),
      analystOf('comercial'),
      analystOf('suporte-tecnico'),
      analystOf('cobranca', 'fidelizacao', 'retencao', 'retiradas'),
      analystOf('experiencia-cliente'),
    ]

    for (const user of analysts) {
      expect(usesCorporateHome(user)).toBe(false)
      expect(resolveHomePath(user, null)).not.toBe(CORPORATE_OVERVIEW_PATH)
      expect(resolveHomePath(user, null).endsWith('/visao-geral')).toBe(true)
    }
  })
})

/**
 * Um Perfil de Acesso executivo com recorte alcança a escolha da Página Inicial
 * sem nenhuma regra nova.
 *
 * A lista de departamentos oferecida nas Preferências é montada por
 * `accessibleHomeDepartmentIds`, que pergunta ao `accessControl` pelo par
 * departamento e página. Como o perfil concede apenas duas Visões Gerais, a
 * escolha não tem como oferecer uma terceira: é a mesma fonte que decide a
 * sidebar e o acesso direto por URL.
 */
describe('recorte de um perfil executivo na Página Inicial', () => {
  /** Executivo cujo perfil de acesso concede só a Visão Geral de OS e de Comercial. */
  function executiveUser(): AuthUser {
    return buildAuthUserFromGrants(
      'Executivo',
      [
        { departmentId: 'os', pageKeys: [OVERVIEW_PAGE_KEY] },
        { departmentId: 'comercial', pageKeys: [OVERVIEW_PAGE_KEY] },
      ],
      { id: 'usr-exec', name: 'Executivo de Teste', email: 'executivo@impactotelecom.com' },
    )
  }

  it('oferece como Página Inicial somente os departamentos que o perfil concede', () => {
    expect(accessibleHomeDepartmentIds(executiveUser()).sort()).toEqual(['comercial', 'os'])
  })

  it('nunca oferece um departamento cuja Visão Geral o perfil não abre', () => {
    const user = executiveUser()
    const oferecidos = accessibleHomeDepartmentIds(user)

    for (const area of biAreas) {
      const oferecido = oferecidos.includes(area.id)
      const abre =
        getDepartmentPageAccessState(user, area.id, OVERVIEW_PAGE_KEY) === 'enabled'

      expect(oferecido).toBe(abre)
    }
  })

  it('descarta uma escolha gravada que saiu do recorte', () => {
    const user = executiveUser()

    expect(shouldDiscardHomeDepartment(user, 'os')).toBe(false)
    expect(shouldDiscardHomeDepartment(user, 'comercial')).toBe(false)
    // Departamento fora do recorte: a escolha gravada não volta a valer sozinha.
    expect(shouldDiscardHomeDepartment(user, 'cobranca')).toBe(true)
  })

  it('abre o Executivo do recorte em Ordens de Serviço e oferece a escolha entre os dois', () => {
    // Com a Visão Geral Executiva desligada, o Executivo do recorte escolhe
    // entre as duas Visões Gerais que o perfil concede, e o padrão é Ordens de
    // Serviço. Uma escolha fora do recorte não vira Página Inicial.
    const user = executiveUser()

    expect(usesCorporateHome(user)).toBe(false)
    expect(canChooseHomeDepartment(user)).toBe(true)
    expect(resolveHomePath(user, null)).toBe(overviewPathOf('os'))
    expect(resolveHomePath(user, 'comercial')).toBe(overviewPathOf('comercial'))
    expect(resolveHomePath(user, 'cobranca')).toBe(overviewPathOf('os'))
  })
})
