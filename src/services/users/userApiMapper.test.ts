import { describe, expect, it } from 'vitest'

import { ADMIN_FULL_PERMISSION, ADMIN_USERS_READ_PERMISSION } from '../../config/permissions'
import { biAreas } from '../../config/biAreas'
import { defaultDepartmentPageKeys, OVERVIEW_PAGE_KEY } from '../../lib/userAccessRules'
import type { CoreProfileType, CoreUser } from '../../types/coreApi'
import {
  compareByCreation,
  CoreUserMappingError,
  deriveUserAccessFromGrants,
  formatLastAccess,
  mapCoreUser,
  NEVER_ACCESSED_LABEL,
  systemProfileOptionFromCore,
  userProfileFromCode,
  userStatusFromCore,
} from './userApiMapper'

/**
 * Tradução do usuário do serviço para o domínio do portal.
 *
 * Funções puras, sem rede: o usuário é montado à mão no formato exato de
 * `GET /users/me`. O foco é o que muda de forma entre os dois lados (código do
 * tipo de perfil, situação, data do último acesso) e o acesso expandido, que o
 * portal deriva das concessões do serviço.
 */

const area = biAreas[0]

/** Usuário do serviço com os campos que a tradução usa; o resto é ruído do contrato. */
function coreUser(overrides: Partial<CoreUser> = {}): CoreUser {
  return {
    id: '2d0a0f3e-0000-4000-8000-000000000001',
    name: '  Pessoa de Teste  ',
    email: 'Pessoa@ImpactoTelecom.com',
    status: 'active',
    is_active: true,
    last_access: null,
    profile_system_id: 'tipo-analista',
    access_profile_id: 'acesso-1',
    profile_type: { id: 'tipo-analista', code: 'analyst', name: 'Analista' },
    access: { id: 'acesso-1', name: 'Acesso OS' },
    set_password_expire: null,
    created_at: '2026-09-23T10:00:00Z',
    updated_at: '2026-09-23T10:00:00Z',
    ...overrides,
  }
}

describe('Perfil do Sistema pelo código do serviço', () => {
  it('reconhece os três códigos fixos, sem diferenciar caixa', () => {
    expect(userProfileFromCode('adm')).toBe('Administrador')
    expect(userProfileFromCode('executive')).toBe('Executivo')
    expect(userProfileFromCode('analyst')).toBe('Analista')
    expect(userProfileFromCode(' ANALYST ')).toBe('Analista')
  })

  it('devolve null para código desconhecido ou ausente', () => {
    expect(userProfileFromCode('gestor')).toBeNull()
    expect(userProfileFromCode(null)).toBeNull()
    expect(userProfileFromCode(undefined)).toBeNull()
  })
})

describe('situação e último acesso', () => {
  it('active é Ativo, pending é Pendente; inactive e blocked são Inativo', () => {
    expect(userStatusFromCore('active')).toBe('Ativo')
    expect(userStatusFromCore('pending')).toBe('Pendente')
    expect(userStatusFromCore('inactive')).toBe('Inativo')
    expect(userStatusFromCore('blocked')).toBe('Inativo')
  })

  it('pending chega ao portal como Pendente e sem acesso', () => {
    // A situação é o que a tabela usa para decidir as ações da linha, e é por isso
    // que ela não pode chegar achatada em Inativo: pendente não se ativa nem se
    // desativa, e inativo sim.
    const pendente = mapCoreUser(
      coreUser({ status: 'pending', is_active: false, last_access: null }),
      { grants: [] },
    )

    expect(pendente.status).toBe('Pendente')
    expect(pendente.lastAccess).toBe(NEVER_ACCESSED_LABEL)
  })

  it('formata o último acesso como dd/MM/yyyy HH:mm no fuso local', () => {
    const local = new Date(2026, 8, 23, 8, 5)

    expect(formatLastAccess(local.toISOString())).toBe('23/09/2026 08:05')
  })

  it('trata ausência, texto vazio e data inválida como nunca acessou', () => {
    expect(formatLastAccess(null)).toBe(NEVER_ACCESSED_LABEL)
    expect(formatLastAccess('   ')).toBe(NEVER_ACCESSED_LABEL)
    expect(formatLastAccess('ontem')).toBe(NEVER_ACCESSED_LABEL)
  })
})

describe('acesso expandido a partir das concessões do serviço', () => {
  /**
   * O teste que existia aqui afirmava o contrário: o Administrador recebia o
   * catálogo inteiro "sem depender de concessão". Era esse o defeito — um
   * Administrador cujo Perfil de Acesso liberava só um departamento enxergava os
   * onze na barra lateral.
   */
  it('dá ao Administrador apenas o concedido, e mantém admin.full', () => {
    const access = deriveUserAccessFromGrants('Administrador', [
      { departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) },
    ])

    expect(access.profile).toBe('Administrador')
    expect(access.departments).toEqual([area.label])
    expect(access.permissionKeys).toContain(ADMIN_FULL_PERMISSION)
    // A permissão do departamento concedido entra junto: é ela que o
    // `RequirePermission` das rotas confere, e `admin.full` não a supre mais.
    expect(access.permissionKeys).toContain(area.requiredPermission)
  })

  it('não dá departamento nenhum ao Administrador sem menus concedidos', () => {
    const access = deriveUserAccessFromGrants('Administrador', [])

    expect(access.permissionKeys).toEqual([ADMIN_FULL_PERMISSION])
    expect(access.departments).toEqual([])
    expect(access.departmentPageAccess).toEqual([])
  })

  it('dá ao Analista exatamente o concedido, com a Visão Geral imposta', () => {
    const access = deriveUserAccessFromGrants('Analista', [
      { departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) },
    ])

    expect(access.profile).toBe('Analista')
    expect(access.departments).toEqual([area.label])
    expect(access.departmentPageAccess[0].pageKeys).toContain(OVERVIEW_PAGE_KEY)
  })

  it('dá ao Executivo as mesmas concessões mais a leitura de Usuários', () => {
    const access = deriveUserAccessFromGrants('Executivo', [
      { departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) },
    ])

    expect(access.profile).toBe('Executivo')
    expect(access.departments).toEqual([area.label])
    expect(access.permissionKeys).toContain(ADMIN_USERS_READ_PERMISSION)
  })

  it('não inventa departamento para quem não recebeu nenhum menu', () => {
    // Perfil de acesso ainda sem menus no serviço: a pessoa entra, e a
    // navegação fica vazia. Nada é concedido para preencher o vazio.
    const analyst = deriveUserAccessFromGrants('Analista', [])
    const executive = deriveUserAccessFromGrants('Executivo', [])

    expect(analyst).toEqual({
      profile: 'Analista',
      permissions: '',
      permissionKeys: [],
      departments: [],
      departmentPageAccess: [],
    })
    expect(executive.departments).toEqual([])
    expect(executive.permissionKeys).toEqual([ADMIN_USERS_READ_PERMISSION])
  })
})

describe('usuário do portal', () => {
  it('traduz os campos de forma diferente entre os dois lados', () => {
    const user = mapCoreUser(coreUser(), {
      grants: [{ departmentId: area.id, pageKeys: [OVERVIEW_PAGE_KEY] }],
    })

    expect(user.id).toBe('2d0a0f3e-0000-4000-8000-000000000001')
    expect(user.name).toBe('Pessoa de Teste')
    expect(user.email).toBe('pessoa@impactotelecom.com')
    expect(user.initials).toBe('PD')
    expect(user.profile).toBe('Analista')
    expect(user.status).toBe('Ativo')
    expect(user.lastAccess).toBe(NEVER_ACCESSED_LABEL)
    // O Perfil de Acesso é o UUID da tabela `access`, sem tradução.
    expect(user.accessProfileId).toBe('acesso-1')
    expect(user.departments).toEqual([area.label])
    expect(user.audit).toEqual({
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    })
  })

  it('mantém null quem está sem perfil de acesso no serviço', () => {
    const user = mapCoreUser(coreUser({ access_profile_id: null, access: null }), { grants: [] })

    expect(user.accessProfileId).toBeNull()
  })

  it('recusa um tipo de perfil que o portal não conhece, em vez de escondê-lo', () => {
    const desconhecido = coreUser({
      profile_type: { id: 'tipo-x', code: 'gestor', name: 'Gestor' },
    })

    expect(() => mapCoreUser(desconhecido, { grants: [] })).toThrow(CoreUserMappingError)
  })
})

/* -------------------------------------------------------------------------- */
/* Catálogos do formulário                                                    */
/* -------------------------------------------------------------------------- */

function coreProfileType(code: string, name: string): CoreProfileType {
  return {
    id: `tipo-${code}`,
    code,
    name,
    created_at: '2026-09-23T10:00:00Z',
    updated_at: '2026-09-23T10:00:00Z',
  }
}

describe('Perfil do Sistema a partir de profile_types', () => {
  it('vira opção com o UUID, o nome da tabela e a leitura do portal', () => {
    expect(systemProfileOptionFromCore(coreProfileType('ADM', 'Administração'))).toEqual({
      id: 'tipo-ADM',
      code: 'adm',
      name: 'Administração',
      profile: 'Administrador',
    })
  })

  it('não vira opção quando o código é desconhecido', () => {
    expect(systemProfileOptionFromCore(coreProfileType('gestor', 'Gestor'))).toBeNull()
  })
})

describe('ordem de cadastro', () => {
  it('põe o mais antigo primeiro e quem não tem data no fim', () => {
    const antigo = coreUser({ id: 'a', created_at: '2026-01-01T00:00:00Z' })
    const novo = coreUser({ id: 'b', created_at: '2026-06-01T00:00:00Z' })
    const semData = coreUser({ id: 'c', created_at: null })

    expect([novo, semData, antigo].sort(compareByCreation).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})
