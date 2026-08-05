import { describe, expect, it } from 'vitest'

import { biAreas, type BiAreaId } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import type { AreaSidebarItem } from '../components/navigation/AreaSidebar'
import { navigationGroups } from '../Pages/Dashboard/pageConfig'
import type { User } from '../data/dashboardTypes'
import { users } from '../data/mockAdminData'
import { getDepartmentPageAccessState, hasDepartmentPageAccess } from './accessControl'
import { getAccessibleDepartmentSidebarItems } from './sidebarAccess'
import {
  defaultDepartmentPageKeys,
  deriveUserAccess,
  MODEL_PAGE_KEY,
  type UserAccessConfig,
} from './userAccessRules'

/**
 * Testes da autorização das páginas departamentais depois da publicação das 83
 * páginas que estavam em desenvolvimento.
 *
 * O ponto do bloco: página publicada não é página liberada. A decisão continua
 * sendo pelo par `departmentId + pageKey`, e é a mesma para a sidebar e para o
 * acesso direto por URL, porque as duas passam por
 * `getDepartmentPageAccessState`.
 *
 * Os usuários são derivados por `deriveUserAccess`, a mesma regra que a base
 * mockada e o repositório usam: nenhum acesso é escrito à mão aqui.
 */

const UNKNOWN_PAGE = 'pagina-que-nao-existe'

const analystArea = biAreas[0]
const otherArea = biAreas[1]

function buildUser(config: UserAccessConfig): User {
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
  }
}

function sidebarItems(areaId: BiAreaId): AreaSidebarItem[] {
  return departmentPages[areaId].map((page) => ({ key: page.key, label: page.label }))
}

function pageKeys(areaId: BiAreaId): string[] {
  return departmentPages[areaId].map((page) => page.key)
}

const administrator = buildUser({ profile: 'Administrador' })
const executive = buildUser({ profile: 'Executivo' })
const executiveWithModel = buildUser({
  profile: 'Executivo',
  modelDepartmentIds: [analystArea.id],
})
/**
 * Analista vinculado a um departamento, com as páginas padrão dele: o catálogo
 * inteiro menos o Modelo, exatamente como a base mockada e o repositório montam.
 */
const analyst = buildUser({
  profile: 'Analista',
  departments: [
    { departmentId: analystArea.id, pageKeys: defaultDepartmentPageKeys(analystArea.id) },
  ],
})

/* -------------------------------------------------------------------------- */
/* Administrador                                                              */
/* -------------------------------------------------------------------------- */

describe('Administrador', () => {
  it('abre todas as páginas publicadas de todos os departamentos', () => {
    for (const area of biAreas) {
      for (const pageKey of pageKeys(area.id)) {
        expect(getDepartmentPageAccessState(administrator, area.id, pageKey)).toBe('enabled')
      }
    }
  })

  it('inclui a página Modelo em todo departamento', () => {
    for (const area of biAreas) {
      expect(getDepartmentPageAccessState(administrator, area.id, MODEL_PAGE_KEY)).toBe('enabled')
    }
  })

  it('não abre página que não existe no catálogo, mesmo com o acesso global', () => {
    expect(hasDepartmentPageAccess(administrator, analystArea.id, UNKNOWN_PAGE)).toBe(true)
    expect(getDepartmentPageAccessState(administrator, analystArea.id, UNKNOWN_PAGE)).toBe('hidden')
  })
})

/* -------------------------------------------------------------------------- */
/* Executivo                                                                  */
/* -------------------------------------------------------------------------- */

describe('Executivo', () => {
  it('abre todas as páginas publicadas de todos os departamentos, menos o Modelo', () => {
    for (const area of biAreas) {
      for (const pageKey of pageKeys(area.id)) {
        expect(getDepartmentPageAccessState(executive, area.id, pageKey)).toBe(
          pageKey === MODEL_PAGE_KEY ? 'hidden' : 'enabled',
        )
      }
    }
  })

  it('recebe o Modelo somente no departamento em que ele foi liberado', () => {
    expect(getDepartmentPageAccessState(executiveWithModel, analystArea.id, MODEL_PAGE_KEY)).toBe(
      'enabled',
    )
    expect(getDepartmentPageAccessState(executiveWithModel, otherArea.id, MODEL_PAGE_KEY)).toBe(
      'hidden',
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Analista                                                                   */
/* -------------------------------------------------------------------------- */

describe('Analista', () => {
  it('abre todas as páginas publicadas do departamento concedido, menos o Modelo', () => {
    for (const pageKey of pageKeys(analystArea.id)) {
      expect(getDepartmentPageAccessState(analyst, analystArea.id, pageKey)).toBe(
        pageKey === MODEL_PAGE_KEY ? 'hidden' : 'enabled',
      )
    }
  })

  it('não alcança nenhuma página de um departamento não concedido', () => {
    for (const pageKey of pageKeys(otherArea.id)) {
      expect(getDepartmentPageAccessState(analyst, otherArea.id, pageKey)).toBe('hidden')
    }
  })

  it('não recebe uma página só porque a mesma chave foi concedida em outro departamento', () => {
    const shared = pageKeys(analystArea.id).find((pageKey) => pageKeys(otherArea.id).includes(pageKey))

    expect(shared).toBeDefined()
    expect(hasDepartmentPageAccess(analyst, analystArea.id, shared ?? '')).toBe(true)
    expect(hasDepartmentPageAccess(analyst, otherArea.id, shared ?? '')).toBe(false)
  })
})

/* -------------------------------------------------------------------------- */
/* Sem usuário e fora do catálogo                                             */
/* -------------------------------------------------------------------------- */

describe('limites da autorização', () => {
  it('não libera nada sem usuário', () => {
    expect(hasDepartmentPageAccess(null, analystArea.id, 'overview')).toBe(false)
    expect(getDepartmentPageAccessState(null, analystArea.id, 'overview')).toBe('hidden')
  })

  it('esconde página que não existe no catálogo do departamento', () => {
    expect(getDepartmentPageAccessState(executive, analystArea.id, UNKNOWN_PAGE)).toBe('hidden')
    expect(getDepartmentPageAccessState(analyst, analystArea.id, UNKNOWN_PAGE)).toBe('hidden')
  })
})

/* -------------------------------------------------------------------------- */
/* Navegação lateral                                                          */
/* -------------------------------------------------------------------------- */

describe('sidebar do departamento', () => {
  it('mostra todas as páginas concedidas habilitadas, sem nenhuma bloqueada', () => {
    const items = getAccessibleDepartmentSidebarItems(
      analyst,
      analystArea.id,
      sidebarItems(analystArea.id),
    )

    expect(items.map((item) => item.key)).toEqual(
      pageKeys(analystArea.id).filter((pageKey) => pageKey !== MODEL_PAGE_KEY),
    )
    expect(items.every((item) => item.disabled === false)).toBe(true)
  })

  it('omite a página não concedida em vez de exibi-la bloqueada', () => {
    const items = getAccessibleDepartmentSidebarItems(
      analyst,
      analystArea.id,
      sidebarItems(analystArea.id),
    )

    expect(items.map((item) => item.key)).not.toContain(MODEL_PAGE_KEY)
  })

  it('não mostra item nenhum de departamento não concedido', () => {
    expect(
      getAccessibleDepartmentSidebarItems(analyst, otherArea.id, sidebarItems(otherArea.id)),
    ).toEqual([])
  })

  it('mostra o catálogo inteiro ao Administrador, na ordem do catálogo', () => {
    for (const area of biAreas) {
      const items = getAccessibleDepartmentSidebarItems(
        administrator,
        area.id,
        sidebarItems(area.id),
      )

      expect(items.map((item) => item.key)).toEqual(pageKeys(area.id))
      expect(items.every((item) => item.disabled === false)).toBe(true)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Navegação lateral dentro das Configurações                                 */
/* -------------------------------------------------------------------------- */

/**
 * A sidebar exibida enquanto as Configurações ocupam o conteúdo central mantém o
 * contexto do departamento de origem e passa a filtrar pela mesma regra das
 * sidebars departamentais: entrar nas Configurações não pode revelar uma página
 * que o usuário não recebeu.
 *
 * Os itens usados aqui são os do `pageConfig` de Ordens de Serviço, exatamente a
 * lista que a tela entrega ao filtro, com as páginas administrativas que só
 * existem dentro das Configurações e não pertencem ao catálogo do departamento.
 */
const ordersServiceNavigationItems = navigationGroups.flatMap<AreaSidebarItem>(
  (group) => group.items,
)

/** Josué, o Analista de Ordens de Serviço da base mockada. */
function mockedUser(email: string): User {
  const user = users.find((item) => item.email === email)
  if (!user) throw new Error(`Base mockada sem o usuário ${email}.`)

  return user
}

describe('sidebar do departamento de origem nas Configurações', () => {
  it('não mostra o Modelo ao Analista que não o recebeu', () => {
    const josue = mockedUser('josuefernando@impactotelecom.com')

    const items = getAccessibleDepartmentSidebarItems(josue, 'os', ordersServiceNavigationItems)

    expect(josue.profile).toBe('Analista')
    expect(ordersServiceNavigationItems.map((item) => item.key)).toContain(MODEL_PAGE_KEY)
    expect(items.map((item) => item.key)).not.toContain(MODEL_PAGE_KEY)
  })

  it('mostra o Modelo a quem o recebeu explicitamente', () => {
    const withModel = buildUser({
      profile: 'Analista',
      departments: [
        { departmentId: 'os', pageKeys: [...defaultDepartmentPageKeys('os'), MODEL_PAGE_KEY] },
      ],
    })

    const items = getAccessibleDepartmentSidebarItems(withModel, 'os', ordersServiceNavigationItems)

    expect(items.map((item) => item.key)).toContain(MODEL_PAGE_KEY)
  })

  it('mantém o Administrador com o catálogo inteiro do departamento de origem', () => {
    const items = getAccessibleDepartmentSidebarItems(
      administrator,
      'os',
      ordersServiceNavigationItems,
    )

    expect(items.map((item) => item.key)).toEqual(pageKeys('os'))
    expect(items.map((item) => item.key)).toContain(MODEL_PAGE_KEY)
  })

  it('preserva ordem, rótulos e ícones dos itens que continuam visíveis', () => {
    const josue = mockedUser('josuefernando@impactotelecom.com')

    const items = getAccessibleDepartmentSidebarItems(josue, 'os', ordersServiceNavigationItems)
    const visible = ordersServiceNavigationItems.filter((item) =>
      items.some((accessible) => accessible.key === item.key),
    )

    expect(items.map((item) => item.key)).toEqual(visible.map((item) => item.key))
    expect(items.map((item) => item.label)).toEqual(visible.map((item) => item.label))
    expect(items.map((item) => item.icon)).toEqual(visible.map((item) => item.icon))
  })

  it('não mostra páginas administrativas, que não pertencem ao catálogo do departamento', () => {
    // Usuários e Histórico vivem dentro das Configurações. A sidebar
    // departamental normal já os omitia; a das Configurações passa a fazer o
    // mesmo, para ninguém, nem o Administrador.
    for (const user of [administrator, mockedUser('josuefernando@impactotelecom.com')]) {
      const items = getAccessibleDepartmentSidebarItems(user, 'os', ordersServiceNavigationItems)

      expect(items.map((item) => item.key)).not.toContain('users')
      expect(items.map((item) => item.key)).not.toContain('history')
    }
  })
})
