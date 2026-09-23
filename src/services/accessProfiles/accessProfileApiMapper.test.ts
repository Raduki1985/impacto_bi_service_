import { describe, expect, it } from 'vitest'

import { biAreas } from '../../config/biAreas'
import { defaultDepartmentPageKeys, OVERVIEW_PAGE_KEY } from '../../lib/userAccessRules'
import type { CoreAccess } from '../../types/coreApi'
import { accessProfileFromCoreAccess } from './accessProfileApiMapper'

/**
 * Tradução de uma linha de `access` do serviço para o `AccessProfile` do portal.
 *
 * Função pura, sem rede: o perfil é montado à mão no formato exato de
 * `GET /access`. O foco é a forma do domínio (lifecycle, homePage, hasBeenUsed),
 * que é o que a tela Perfis de acesso e o cadastro de usuários consomem.
 *
 * `kind` e `audience` saíram do domínio junto com a coluna de tipo de `access`,
 * então nada aqui testa destino: a linha do serviço não carrega mais essa
 * informação, e o portal não a inventa.
 */

const area = biAreas[0]

function coreAccess(overrides: Partial<CoreAccess> = {}): CoreAccess {
  return {
    id: 'acesso-1',
    name: '  Acesso OS  ',
    description: null,
    menus: [],
    users_count: 0,
    created_at: '2026-09-23T10:00:00Z',
    updated_at: '2026-09-23T10:00:00Z',
    ...overrides,
  }
}

describe('Perfil de Acesso a partir de access', () => {
  const grants = [{ departmentId: area.id, pageKeys: defaultDepartmentPageKeys(area.id) }]

  it('vira perfil com as concessões traduzidas e a página inicial derivada', () => {
    const profile = accessProfileFromCoreAccess(coreAccess(), grants)

    expect(profile).toMatchObject({
      id: 'acesso-1',
      name: 'Acesso OS',
      lifecycle: 'active',
      hasBeenUsed: false,
    })
    expect(profile.description).toBeUndefined()
    expect(profile.departmentPageAccess).toEqual(grants)
    expect(profile.homePage).toEqual({ departmentId: area.id, pageKey: OVERVIEW_PAGE_KEY })
  })

  it('marca como já usado o perfil que tem usuários vinculados', () => {
    const profile = accessProfileFromCoreAccess(
      coreAccess({ name: 'Administração', users_count: 2 }),
      [],
    )

    expect(profile).toMatchObject({ name: 'Administração', hasBeenUsed: true })
    // Sem concessão não há destino, e nenhum é inventado.
    expect(profile.homePage).toEqual({ departmentId: '', pageKey: '' })
  })

  it('preserva a descrição preenchida e descarta a vazia', () => {
    expect(
      accessProfileFromCoreAccess(coreAccess({ description: '  Leitura  ' }), grants).description,
    ).toBe('Leitura')
    expect(
      accessProfileFromCoreAccess(coreAccess({ description: '   ' }), grants).description,
    ).toBeUndefined()
  })

  it('traduz toda linha do serviço, sem descartar nenhuma', () => {
    // O descarte existia por causa do TIPO do perfil: um tipo que o portal não
    // reconhecia devolvia null. Sem tipo, não há linha que o portal recuse.
    expect(accessProfileFromCoreAccess(coreAccess({ name: 'Qualquer' }), []).name).toBe('Qualquer')
  })
})
