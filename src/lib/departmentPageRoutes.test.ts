import { matchRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { biAreas, CORPORATE_OVERVIEW_PATH } from '../config/biAreas'
import { departmentPages } from '../config/departmentPages'
import { billingOverviewPath } from '../Pages/Billing/pageConfig'
import { commercialOverviewPath } from '../Pages/Commercial/pageConfig'
import { copOverviewPath } from '../Pages/Cop/pageConfig'
import { customerExperienceOverviewPath } from '../Pages/CustomerExperience/pageConfig'
import { pageSlugs } from '../Pages/Dashboard/pageConfig'
import { equipmentRetrievalOverviewPath } from '../Pages/EquipmentRetrieval/pageConfig'
import { fleetManagementOverviewPath } from '../Pages/FleetManagement/pageConfig'
import { loyaltyOverviewPath } from '../Pages/Loyalty/pageConfig'
import { retentionOverviewPath } from '../Pages/Retention/pageConfig'
import { technicalAuditOverviewPath } from '../Pages/TechnicalAudit/pageConfig'
import { technicalSupportOverviewPath } from '../Pages/TechnicalSupport/pageConfig'
import {
  departmentPageKeyFromPath,
  departmentPagePath,
  departmentPageSlug,
  findDepartmentIdBySlug,
  findDepartmentPageByKey,
  findDepartmentPageBySlug,
} from './departmentPageRoutes'
import { MODEL_PAGE_KEY, OVERVIEW_PAGE_KEY } from './userAccessRules'

/**
 * Testes da publicação das páginas departamentais e da resolução de caminho.
 *
 * O catálogo real é a fonte: nenhuma lista de páginas, nomes ou rotas é copiada
 * para cá. As únicas exceções são o total do catálogo e as constantes de Visão
 * Geral já publicadas nos `pageConfig`, que existem justamente para provar que
 * nada mudou de endereço.
 */

/** Total de páginas departamentais catalogadas hoje, somando os onze departamentos. */
const CATALOG_PAGE_COUNT = 106

const UNKNOWN_PAGE = 'pagina-que-nao-existe'

/** Visões Gerais como cada `pageConfig` as publica, para comparar com o caminho resolvido. */
const publishedOverviewPaths: Record<string, string> = {
  'auditoria-tecnica': technicalAuditOverviewPath,
  cobranca: billingOverviewPath,
  comercial: commercialOverviewPath,
  cop: copOverviewPath,
  'experiencia-cliente': customerExperienceOverviewPath,
  fidelizacao: loyaltyOverviewPath,
  'gestao-frota': fleetManagementOverviewPath,
  os: `/dashboard/os/${pageSlugs.overview}`,
  retencao: retentionOverviewPath,
  retiradas: equipmentRetrievalOverviewPath,
  'suporte-tecnico': technicalSupportOverviewPath,
}

/* -------------------------------------------------------------------------- */
/* Catálogo publicado                                                         */
/* -------------------------------------------------------------------------- */

describe('catálogo de páginas departamentais', () => {
  it('catalogou as 106 páginas dos onze departamentos', () => {
    const total = biAreas.reduce((count, area) => count + departmentPages[area.id].length, 0)

    expect(biAreas).toHaveLength(11)
    expect(total).toBe(CATALOG_PAGE_COUNT)
  })

  it('não deixa nenhuma página do catálogo em desenvolvimento', () => {
    for (const area of biAreas) {
      const inDevelopment = departmentPages[area.id].filter((page) => page.disabled)

      expect(inDevelopment.map((page) => `${area.id}/${page.key}`)).toEqual([])
    }
  })

  it('dá a todo departamento uma Visão Geral e mantém a página Modelo no catálogo', () => {
    for (const area of biAreas) {
      const keys = departmentPages[area.id].map((page) => page.key)

      expect(keys).toContain(OVERVIEW_PAGE_KEY)
      expect(keys).toContain(MODEL_PAGE_KEY)
      expect(keys[0]).toBe(OVERVIEW_PAGE_KEY)
    }
  })

  it('não repete chave de página dentro do mesmo departamento', () => {
    for (const area of biAreas) {
      const keys = departmentPages[area.id].map((page) => page.key)

      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('dá nome exibido a toda página catalogada', () => {
    for (const area of biAreas) {
      for (const page of departmentPages[area.id]) {
        expect(page.label.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Departamento a partir da URL                                               */
/* -------------------------------------------------------------------------- */

describe('departamento a partir do segmento da URL', () => {
  it('reconhece o id de todos os departamentos do catálogo', () => {
    for (const area of biAreas) {
      expect(findDepartmentIdBySlug(area.id)).toBe(area.id)
    }
  })

  it('não reconhece segmento que não é departamento', () => {
    expect(findDepartmentIdBySlug('configuracoes')).toBeNull()
    expect(findDepartmentIdBySlug('inicio')).toBeNull()
    expect(findDepartmentIdBySlug('usuarios')).toBeNull()
    expect(findDepartmentIdBySlug('departamento-que-nao-existe')).toBeNull()
    expect(findDepartmentIdBySlug(undefined)).toBeNull()
    expect(findDepartmentIdBySlug('')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Caminho de cada página                                                     */
/* -------------------------------------------------------------------------- */

describe('caminho das páginas departamentais', () => {
  it('preserva o endereço já publicado de cada Visão Geral', () => {
    for (const area of biAreas) {
      expect(departmentPagePath(area.id, OVERVIEW_PAGE_KEY)).toBe(publishedOverviewPaths[area.id])
    }
  })

  it('preserva a tabela de slugs de Ordens de Serviço', () => {
    for (const page of departmentPages.os) {
      const slug = pageSlugs[page.key as keyof typeof pageSlugs]

      expect(departmentPagePath('os', page.key)).toBe(`/dashboard/os/${slug}`)
    }
  })

  it('usa a chave da página como segmento nos dez departamentos, fora a Visão Geral', () => {
    for (const area of biAreas) {
      if (area.id === 'os') continue

      for (const page of departmentPages[area.id]) {
        if (page.key === OVERVIEW_PAGE_KEY) continue

        expect(departmentPageSlug(area.id, page.key)).toBe(page.key)
        expect(departmentPagePath(area.id, page.key)).toBe(`/dashboard/${area.id}/${page.key}`)
      }
    }
  })

  it('monta caminho para toda página catalogada, sem repetir nenhum', () => {
    const paths = biAreas.flatMap((area) =>
      departmentPages[area.id].map((page) => departmentPagePath(area.id, page.key)),
    )

    expect(paths).toHaveLength(CATALOG_PAGE_COUNT)
    expect(paths.every((path) => path !== null)).toBe(true)
    expect(new Set(paths).size).toBe(CATALOG_PAGE_COUNT)
  })

  it('não monta caminho para página fora do catálogo do departamento', () => {
    expect(departmentPagePath('cobranca', UNKNOWN_PAGE)).toBeNull()
    expect(departmentPageSlug('cobranca', UNKNOWN_PAGE)).toBeNull()
    // Usuários e Histórico são páginas das Configurações, e não de Ordens de
    // Serviço: elas não estão no catálogo departamental e não têm caminho aqui.
    expect(departmentPagePath('os', 'users')).toBeNull()
    expect(departmentPagePath('os', 'history')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Página a partir da URL                                                     */
/* -------------------------------------------------------------------------- */

describe('página a partir do segmento da URL', () => {
  it('resolve de volta toda página a partir do próprio slug', () => {
    for (const area of biAreas) {
      for (const page of departmentPages[area.id]) {
        const slug = departmentPageSlug(area.id, page.key)

        expect(findDepartmentPageBySlug(area.id, slug ?? undefined)?.key).toBe(page.key)
      }
    }
  })

  it('devolve null para slug desconhecido e para ausência de slug', () => {
    expect(findDepartmentPageBySlug('cobranca', UNKNOWN_PAGE)).toBeNull()
    expect(findDepartmentPageBySlug('cobranca', undefined)).toBeNull()
    expect(findDepartmentPageBySlug('os', 'usuarios')).toBeNull()
    expect(findDepartmentPageBySlug('os', 'historico')).toBeNull()
  })

  it('não resolve página de um departamento dentro de outro', () => {
    // A chave existe em Cobrança e não em COP: o par é indivisível.
    expect(findDepartmentPageByKey('cobranca', 'collections-agreements')).not.toBeNull()
    expect(findDepartmentPageByKey('cop', 'collections-agreements')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Item ativo da sidebar                                                      */
/* -------------------------------------------------------------------------- */

describe('item ativo da sidebar', () => {
  it('marca a página do próprio caminho em todo departamento', () => {
    for (const area of biAreas) {
      for (const page of departmentPages[area.id]) {
        const path = departmentPagePath(area.id, page.key)

        expect(path).not.toBeNull()
        expect(departmentPageKeyFromPath(area.id, path ?? '')).toBe(page.key)
      }
    }
  })

  it('não marca item nenhum quando o caminho é de outro departamento', () => {
    const billingPath = departmentPagePath('cobranca', 'service') ?? ''

    expect(departmentPageKeyFromPath('cobranca', billingPath)).toBe('service')
    expect(departmentPageKeyFromPath('cop', billingPath)).toBeNull()
  })

  it('não marca item nenhum fora das páginas departamentais', () => {
    const outsidePaths = [
      CORPORATE_OVERVIEW_PATH,
      '/dashboard/configuracoes/preferencias',
      '/dashboard/configuracoes/perfis-acesso',
      '/dashboard/usuarios',
      '/login',
      '/dashboard/cobranca',
      '/dashboard/cobranca/service/detalhe',
      `/dashboard/cobranca/${UNKNOWN_PAGE}`,
    ]

    for (const area of biAreas) {
      for (const pathname of outsidePaths) {
        expect(departmentPageKeyFromPath(area.id, pathname)).toBeNull()
      }
    }
  })

  it('aceita a barra final sem perder o item ativo', () => {
    expect(departmentPageKeyFromPath('cobranca', '/dashboard/cobranca/visao-geral/')).toBe(
      OVERVIEW_PAGE_KEY,
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Convivência com as rotas fixas                                             */
/* -------------------------------------------------------------------------- */

/**
 * Rotas do portal com os mesmos padrões declarados em `App.tsx`, para provar que
 * a rota genérica das páginas departamentais fica atrás de todas as rotas fixas
 * na ordenação do React Router, que prefere segmento literal a parâmetro.
 *
 * Os caminhos departamentais vêm do próprio catálogo; só os padrões que não são
 * de departamento aparecem escritos, porque é exatamente o que precisa ser
 * protegido da rota genérica.
 */
const GENERIC_DEPARTMENT_ROUTE = '/dashboard/:departmentSlug/:pageSlug'

const portalRoutes = [
  { path: '/login' },
  { path: '/dashboard' },
  { path: CORPORATE_OVERVIEW_PATH },
  { path: '/dashboard/usuarios' },
  { path: '/dashboard/configuracoes' },
  { path: '/dashboard/configuracoes/:configPage' },
  { path: '/dashboard/:pageSlug' },
  ...departmentPages.os.map((page) => ({ path: departmentPagePath('os', page.key) ?? '' })),
  ...biAreas.map((area) => ({ path: departmentPagePath(area.id, OVERVIEW_PAGE_KEY) ?? '' })),
  { path: GENERIC_DEPARTMENT_ROUTE },
  { path: '*' },
]

function matchedPath(pathname: string): string | undefined {
  return matchRoutes(portalRoutes, pathname)?.at(-1)?.route.path
}

describe('convivência da rota genérica com as rotas fixas', () => {
  it('deixa as Configurações resolverem na própria rota', () => {
    expect(matchedPath('/dashboard/configuracoes/preferencias')).toBe(
      '/dashboard/configuracoes/:configPage',
    )
    expect(matchedPath('/dashboard/configuracoes/perfis-acesso')).toBe(
      '/dashboard/configuracoes/:configPage',
    )
  })

  it('deixa todas as páginas de Ordens de Serviço nas rotas reais delas', () => {
    for (const page of departmentPages.os) {
      const path = departmentPagePath('os', page.key) ?? ''

      expect(matchedPath(path)).toBe(path)
    }
  })

  it('deixa as dez Visões Gerais nas rotas fixas já publicadas', () => {
    for (const area of biAreas) {
      const path = departmentPagePath(area.id, OVERVIEW_PAGE_KEY) ?? ''

      expect(matchedPath(path)).toBe(path)
    }
  })

  it('resolve na rota genérica as demais páginas departamentais', () => {
    for (const area of biAreas) {
      if (area.id === 'os') continue

      for (const page of departmentPages[area.id]) {
        if (page.key === OVERVIEW_PAGE_KEY) continue

        expect(matchedPath(departmentPagePath(area.id, page.key) ?? '')).toBe(
          GENERIC_DEPARTMENT_ROUTE,
        )
      }
    }
  })

  it('não captura a Visão Geral Executiva, as rotas legadas nem o login', () => {
    expect(matchedPath(CORPORATE_OVERVIEW_PATH)).toBe(CORPORATE_OVERVIEW_PATH)
    expect(matchedPath('/dashboard/usuarios')).toBe('/dashboard/usuarios')
    expect(matchedPath('/dashboard/temporal')).toBe('/dashboard/:pageSlug')
    expect(matchedPath('/dashboard/configuracoes')).toBe('/dashboard/configuracoes')
    expect(matchedPath('/login')).toBe('/login')
  })

  it('leva departamento inexistente e página desconhecida para a rota genérica', () => {
    // A rota genérica recebe, e o componente decide: as duas caem no
    // redirecionamento seguro do portal.
    expect(matchedPath('/dashboard/departamento-que-nao-existe/qualquer')).toBe(
      GENERIC_DEPARTMENT_ROUTE,
    )
    expect(matchedPath(`/dashboard/cobranca/${UNKNOWN_PAGE}`)).toBe(GENERIC_DEPARTMENT_ROUTE)
    expect(matchedPath('/dashboard/os/usuarios')).toBe(GENERIC_DEPARTMENT_ROUTE)
  })
})
