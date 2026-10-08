import { PROFILE_TYPE_CODE_BY_USER_PROFILE } from '../services/users/userApiMapper'
import { deriveUserAccessFromGrants } from '../services/users/userApiMapper'
import type { DepartmentPageAccess, UserProfile } from '../types/access'
import type { AuthUser } from '../types/user/userTypes'
import { deriveUserAccess, type DerivedUserAccess, type UserAccessConfig } from './userAccessRules'

/** Campos fixos de teste fora do acesso: nenhuma regra depende deles. */
function authUserFrom(access: DerivedUserAccess, overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'usr-001',
    name: 'Usuário de Teste',
    email: 'teste@impactotelecom.com',
    status: 'active',
    isActive: true,
    lastAccess: '2026-01-01T00:00:00.000Z',
    profileSystemId: 'profile-system-001',
    accessProfileId: 'access-profile-001',
    profileType: {
      id: 'profile-type-001',
      code: PROFILE_TYPE_CODE_BY_USER_PROFILE[access.profile],
      name: access.profile,
    },
    access: { id: 'access-profile-001', name: 'Perfil de Acesso de Teste' },
    setPasswordExpire: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    departmentPageAccess: access.departmentPageAccess,
    ...overrides,
  }
}

/**
 * `AuthUser` de teste a partir de uma configuração de acesso declarada
 * (`UserAccessConfig`), pela mesma regra que a base mockada e o repositório
 * usam (`deriveUserAccess`): nenhum acesso é escrito à mão aqui.
 *
 * Os campos fora do acesso (id, nome, datas, Perfil de Acesso vinculado) são
 * valores fixos de teste, sobrescrevíveis por `overrides` — nenhuma regra
 * depende deles.
 */
export function buildAuthUser(config: UserAccessConfig, overrides: Partial<AuthUser> = {}): AuthUser {
  const access = deriveUserAccess(config)
  if (!access) throw new Error('Configuração de acesso inválida: o teste precisa de dados reais.')

  return authUserFrom(access, overrides)
}

/**
 * `AuthUser` de teste a partir das concessões por menu (`DepartmentPageAccess`),
 * pela mesma regra que o tradutor do serviço usa (`deriveUserAccessFromGrants`).
 */
export function buildAuthUserFromGrants(
  profile: UserProfile,
  grants: readonly DepartmentPageAccess[],
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return authUserFrom(deriveUserAccessFromGrants(profile, grants), overrides)
}
