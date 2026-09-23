import { describe, expect, it } from 'vitest'

import { biAreas, CORPORATE_OVERVIEW_PATH, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import type { User } from '../data/dashboardTypes'
import { deriveUserAccessFromGrants } from '../services/users/userApiMapper'
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
import { SETTINGS_ENTRY_PATH } from './settingsNavigation'
import {
  defaultDepartmentPageKeys,
  deriveUserAccess,
  OVERVIEW_PAGE_KEY,
  type UserAccessConfig,
} from './userAccessRules'

/**
 * Testes da regra central da Página Inicial.
 *
 * Os usuários são derivados por `deriveUserAccess`, a mesma regra da base
 * mockada e do repositório, e os departamentos vêm de `biAreas`: nenhum acesso e
 * nenhuma rota são escritos à mão. O único usuário montado campo a campo é o
 * inconsistente, que a derivação não produz de propósito.
 */

const [firstArea, secondArea, thirdArea] = biAreas

function buildUser(config: UserAccessConfig, overrides: Partial<User> = {}): User {
  const access = deriveUserAccess(config)
  if (!access) throw new Error('Configuração de acesso inválida: o teste precisa de dados reais.')

  return {
    id: 'usr-001',
    name: 'Usuário de Teste',
    email: 'teste@impactotelecom.com',
    status: 'Ativo',
    lastAccess: '01/01/2026 00:00',
    initials: 'UT',
    ...access,
    ...overrides,
  }
}

function analystOf(...areaIds: BiAreaId[]): User {
  return buildUser({
    profile: 'Analista',
    departments: areaIds.map((departmentId) => ({
      departmentId,
      pageKeys: defaultDepartmentPageKeys(departmentId),
    })),
  })
}

/** Analista com acesso inconsistente: nenhum departamento e nenhuma página. */
const analystWithoutAccess: User = {
  id: 'usr-999',
  name: 'Analista sem acesso',
  email: 'sem.acesso@impactotelecom.com',
  profile: 'Analista',
  permissions: '',
  permissionKeys: [],
  departments: [],
  departmentPageAccess: [],
  status: 'Ativo',
  lastAccess: '01/01/2026 00:00',
  initials: 'AS',
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
  it('mantém Administrador e Executivo na Visão Geral Executiva', () => {
    expect(usesCorporateHome(administrator)).toBe(true)
    expect(usesCorporateHome(executive)).toBe(true)

    expect(resolveHomePath(administrator, null)).toBe(CORPORATE_OVERVIEW_PATH)
    expect(resolveHomePath(executive, null)).toBe(CORPORATE_OVERVIEW_PATH)
  })

  it('ignora a preferência de departamento de quem não é Analista', () => {
    expect(resolveHomePath(administrator, secondArea.id)).toBe(CORPORATE_OVERVIEW_PATH)
    expect(resolveHomePath(executive, secondArea.id)).toBe(CORPORATE_OVERVIEW_PATH)
  })

  it('nunca leva o Analista à Visão Geral Executiva', () => {
    const analyst = analystOf(firstArea.id)

    expect(usesCorporateHome(analyst)).toBe(false)
    expect(resolveHomePath(analyst, null)).not.toBe(CORPORATE_OVERVIEW_PATH)
  })

  it('não entrega a Visão Geral Executiva sem usuário nem a perfil desconhecido', () => {
    // Um perfil gravado fora dos três oficiais cai no caminho mais restrito, e
    // não herda a página executiva por não ser Analista.
    const unknownProfile = { ...analystWithoutAccess, profile: 'Gestor' } as unknown as User

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
/* Departamento inicial do Analista                                           */
/* -------------------------------------------------------------------------- */

describe('departamento inicial do Analista', () => {
  it('usa o único departamento permitido quando só existe um', () => {
    const analyst = analystOf(secondArea.id)

    expect(resolveHomeDepartmentId(analyst, null)).toBe(secondArea.id)
    expect(resolveHomePath(analyst, null)).toBe(overviewPathOf(secondArea.id))
  })

  it('usa o primeiro permitido na ordem oficial quando não há preferência', () => {
    const analyst = analystOf(thirdArea.id, firstArea.id)

    expect(resolveHomeDepartmentId(analyst, null)).toBe(firstArea.id)
    expect(resolveHomePath(analyst, null)).toBe(overviewPathOf(firstArea.id))
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
    expect(FALLBACK_HOME_PATH).toBe(SETTINGS_ENTRY_PATH)
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
  it('não oferece escolha a Administrador nem a Executivo', () => {
    expect(canChooseHomeDepartment(administrator)).toBe(false)
    expect(canChooseHomeDepartment(executive)).toBe(false)
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

  it('exige o perfil Analista, e não apenas a ausência de acesso executivo', () => {
    // Um perfil desconhecido e um rótulo legado ainda não normalizado também não
    // abrem a Visão Geral Executiva. Se o critério fosse pela negativa, os dois
    // receberiam o seletor mesmo tendo departamentos de sobra.
    const analyst = analystOf(firstArea.id, secondArea.id)

    for (const profile of ['Gestor', 'Usuário Departamental', '']) {
      const user = { ...analyst, profile } as unknown as User

      expect(usesCorporateHome(user)).toBe(false)
      expect(accessibleHomeDepartmentIds(user)).toEqual([firstArea.id, secondArea.id])
      expect(canChooseHomeDepartment(user)).toBe(false)
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

  it('não descarta a escolha de quem abre a Visão Geral Executiva, quando ela é de um departamento real', () => {
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

    expect(user.profile).toBe('Administrador')
    expect(resolveHomePath(user, null)).toBe(CORPORATE_OVERVIEW_PATH)
    expect(canChooseHomeDepartment(user)).toBe(false)
  })

  it('mantém o Executivo na Visão Geral Executiva', () => {
    const user = buildUser({ profile: 'Executivo' })

    expect(user.profile).toBe('Executivo')
    expect(resolveHomePath(user, null)).toBe(CORPORATE_OVERVIEW_PATH)
    expect(canChooseHomeDepartment(user)).toBe(false)
  })

  it('abre o Analista de um departamento na Visão Geral dele, sem oferecer escolha', () => {
    const user = analystOf('os')

    expect(user.profile).toBe('Analista')
    expect(accessibleHomeDepartmentIds(user)).toEqual(['os'])
    expect(resolveHomePath(user, null)).toBe('/dashboard/os/visao-geral')
    expect(canChooseHomeDepartment(user)).toBe(false)
  })

  it('abre o Analista de vários departamentos no primeiro da ordem oficial e oferece escolha', () => {
    // Ordens de Serviço, Suporte Técnico, COP, Auditoria Técnica e Gestão de
    // Frota. Na ordem de `biAreas`, o primeiro deles é a Auditoria Técnica.
    const user = analystOf('os', 'suporte-tecnico', 'cop', 'auditoria-tecnica', 'gestao-frota')

    expect(user.profile).toBe('Analista')
    expect(accessibleHomeDepartmentIds(user)).toEqual([
      'auditoria-tecnica',
      'cop',
      'gestao-frota',
      'os',
      'suporte-tecnico',
    ])
    expect(canChooseHomeDepartment(user)).toBe(true)
    expect(resolveHomePath(user, null)).toBe('/dashboard/auditoria-tecnica/visao-geral')
    expect(resolveHomePath(user, 'gestao-frota')).toBe('/dashboard/gestao-frota/visao-geral')
    // Um departamento que ele não acessa não vira Página Inicial.
    expect(resolveHomePath(user, 'comercial')).toBe('/dashboard/auditoria-tecnica/visao-geral')
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
  function executiveUser(): User {
    const access = deriveUserAccessFromGrants('Executivo', [
      { departmentId: 'os', pageKeys: [OVERVIEW_PAGE_KEY] },
      { departmentId: 'comercial', pageKeys: [OVERVIEW_PAGE_KEY] },
    ])

    return {
      id: 'usr-exec',
      name: 'Executivo de Teste',
      email: 'executivo@impactotelecom.com',
      status: 'Ativo',
      lastAccess: '01/01/2026 00:00',
      initials: 'ET',
      accessProfileId: 'acesso-executivo',
      ...access,
    }
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

  it('mantém o Executivo entrando pela Página Inicial do portal', () => {
    // A escolha de departamento continua sendo do Analista: o Executivo entra
    // pela lista de dashboards, que já mostra só o que ele acessa.
    const user = executiveUser()

    expect(usesCorporateHome(user)).toBe(true)
    expect(canChooseHomeDepartment(user)).toBe(false)
    expect(resolveHomePath(user, 'cobranca')).toBe(CORPORATE_OVERVIEW_PATH)
  })
})
