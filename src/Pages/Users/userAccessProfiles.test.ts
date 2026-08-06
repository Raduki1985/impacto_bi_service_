import { describe, expect, it } from 'vitest'

import { biAreas, type BiAreaId } from '../../config/biAreas'
import type { User } from '../../data/dashboardTypes'
import {
  MODEL_PAGE_KEY,
  allDepartmentPageKeys,
  defaultDepartmentPageKeys,
  deriveUserAccess,
  type UserAccessConfig,
} from '../../lib/userAccessRules'
import { TECHNICAL_OPERATIONS_DEPARTMENT_IDS } from '../../config/accessProfileCatalog'
import {
  EXECUTIVE_ACCESS_PROFILE,
  FULL_ACCESS_PROFILE,
  TECHNICAL_OPERATIONS_ACCESS_PROFILE,
  UNPROFILED_ACCESS_LABEL,
  accessConfigFromAccessProfile,
  analystAccessProfileDraft,
  analystAccessProfileOptions,
  departmentAccessProfileId,
  initialAccessProfileId,
  preservedAccessConfig,
  recognizeUserAccessProfile,
  resolveUserAccessConfig,
  userAccessProfileLabel,
} from './userAccessProfiles'

/**
 * Reconhecimento e conversão dos Perfis de Acesso da página Usuários.
 *
 * Os usuários dos testes são montados pela mesma regra que grava a base
 * (`deriveUserAccess`), e não escritos à mão: o que está sendo verificado é o
 * reconhecimento do que o portal realmente persiste hoje. As combinações fora
 * do padrão são obtidas alterando esse resultado, uma única página por vez.
 */

function buildUser(access: UserAccessConfig, overrides: Partial<User> = {}): User {
  const derived = deriveUserAccess(access)

  if (!derived) throw new Error('Configuração de acesso inválida no teste')

  return {
    id: 'usr-100',
    name: 'Usuária de Teste',
    email: 'teste@impactotelecom.com',
    ...derived,
    status: 'Ativo',
    lastAccess: 'Nunca acessou',
    initials: 'UT',
    ...overrides,
  }
}

/** Analista com as páginas padrão de cada departamento informado. */
function analystUser(departmentIds: readonly BiAreaId[]): User {
  return buildUser({
    profile: 'Analista',
    departments: departmentIds.map((departmentId) => ({
      departmentId,
      pageKeys: defaultDepartmentPageKeys(departmentId),
    })),
  })
}

/** Troca as páginas de um departamento já concedido, preservando o restante. */
function withPageKeys(user: User, departmentId: string, pageKeys: string[]): User {
  return {
    ...user,
    departmentPageAccess: user.departmentPageAccess.map((access) =>
      access.departmentId === departmentId ? { ...access, pageKeys } : access,
    ),
  }
}

/**
 * O que o drawer envia ao repositório.
 *
 * Reproduz a abertura de um usuário existente: o seletor nasce no perfil
 * reconhecido, e é esse valor inicial que serve de ponto de comparação. Sem
 * `overrides`, descreve o caso em que só nome ou e-mail foram digitados, e
 * nenhum dos dois campos de perfil foi tocado.
 */
function resolveOnSave(
  user: User,
  overrides: { systemProfile?: User['profile']; accessProfileId?: string | null } = {},
) {
  const loadedAccessProfileId = initialAccessProfileId(user)

  return resolveUserAccessConfig({
    systemProfile: overrides.systemProfile ?? user.profile,
    accessProfileId:
      'accessProfileId' in overrides ? (overrides.accessProfileId ?? null) : loadedAccessProfileId,
    loadedAccessProfileId,
    currentUser: user,
  })
}

/** Os cinco campos que o repositório compara para decidir se grava. */
function accessFields(source: Pick<User, 'profile' | 'permissions' | 'permissionKeys' | 'departments' | 'departmentPageAccess'>) {
  return {
    profile: source.profile,
    permissions: source.permissions,
    permissionKeys: source.permissionKeys,
    departments: source.departments,
    departmentPageAccess: source.departmentPageAccess,
  }
}

/** Campos de acesso que sairiam da configuração resolvida, ou null se recusada. */
function accessFieldsFromResolution(resolution: ReturnType<typeof resolveOnSave>) {
  if (!resolution.ok) return null

  const derived = deriveUserAccess(resolution.access)

  return derived ? accessFields(derived) : null
}

function deepFreeze(user: User): User {
  Object.freeze(user.permissionKeys)
  Object.freeze(user.departments)

  for (const access of user.departmentPageAccess) {
    Object.freeze(access.pageKeys)
    Object.freeze(access)
  }

  Object.freeze(user.departmentPageAccess)

  return Object.freeze(user)
}

describe('recognizeUserAccessProfile', () => {
  it('reconhece Administrador como Acesso do Sistema', () => {
    const user = buildUser({ profile: 'Administrador' })

    expect(recognizeUserAccessProfile(user)).toEqual(FULL_ACCESS_PROFILE)
    expect(userAccessProfileLabel(user)).toBe('Acesso do Sistema')
  })

  it('reconhece Executivo como Acesso Executivo', () => {
    const user = buildUser({ profile: 'Executivo' })

    expect(recognizeUserAccessProfile(user)).toEqual(EXECUTIVE_ACCESS_PROFILE)
    expect(userAccessProfileLabel(user)).toBe('Acesso Executivo')
  })

  it('decide Administrador e Executivo pelo perfil funcional, sem olhar as páginas', () => {
    // Modelo Dimensional liberado em um departamento: no Analista
    // isso descaracteriza o perfil, mas aqui o alcance vem do Perfil do Sistema.
    const executive = buildUser({ profile: 'Executivo', modelDepartmentIds: ['comercial'] })
    const administrator = withPageKeys(buildUser({ profile: 'Administrador' }), 'comercial', [])

    expect(userAccessProfileLabel(executive)).toBe('Acesso Executivo')
    expect(userAccessProfileLabel(administrator)).toBe('Acesso do Sistema')
  })

  it('reconhece a combinação técnica exata como Operações Técnicas', () => {
    const user = analystUser(TECHNICAL_OPERATIONS_DEPARTMENT_IDS)

    expect(recognizeUserAccessProfile(user)).toEqual(TECHNICAL_OPERATIONS_ACCESS_PROFILE)
    expect(userAccessProfileLabel(user)).toBe('Operações Técnicas')
  })

  it('nomeia o perfil de um departamento apenas com o rótulo oficial dele', () => {
    for (const area of biAreas) {
      const user = analystUser([area.id])

      expect(recognizeUserAccessProfile(user)).toEqual({
        id: departmentAccessProfileId(area.id),
        name: area.label,
      })
      // O prefixo antigo não deve sobreviver em nenhum departamento.
      expect(userAccessProfileLabel(user)).not.toBe(`Acesso ${area.label}`)
    }
  })

  it('não nomeia combinação multidepartamental fora das aprovadas', () => {
    const user = analystUser(['cobranca', 'fidelizacao', 'retencao'])

    expect(recognizeUserAccessProfile(user)).toBeNull()
    expect(userAccessProfileLabel(user)).toBe(UNPROFILED_ACCESS_LABEL)
  })

  it('não reconhece departamento com página adicional', () => {
    const user = withPageKeys(analystUser(['comercial']), 'comercial', [
      ...defaultDepartmentPageKeys('comercial'),
      'pagina-que-nao-existe',
    ])

    expect(recognizeUserAccessProfile(user)).toBeNull()
  })

  it('não reconhece departamento com página removida', () => {
    const defaults = defaultDepartmentPageKeys('comercial')
    const user = withPageKeys(analystUser(['comercial']), 'comercial', defaults.slice(0, -1))

    expect(recognizeUserAccessProfile(user)).toBeNull()
  })

  it('não reconhece departamento com Modelo Dimensional adicional', () => {
    const user = withPageKeys(
      analystUser(['comercial']),
      'comercial',
      allDepartmentPageKeys('comercial'),
    )

    expect(user.departmentPageAccess[0].pageKeys).toContain(MODEL_PAGE_KEY)
    expect(recognizeUserAccessProfile(user)).toBeNull()
  })

  it('não reconhece a combinação técnica com uma página a menos em um dos departamentos', () => {
    const defaults = defaultDepartmentPageKeys('cop')
    const user = withPageKeys(
      analystUser(TECHNICAL_OPERATIONS_DEPARTMENT_IDS),
      'cop',
      defaults.slice(0, -1),
    )

    expect(recognizeUserAccessProfile(user)).toBeNull()
  })

  it('compara sem depender da ordem dos arrays', () => {
    const single = analystUser(['comercial'])
    const reversedPages = withPageKeys(single, 'comercial', [
      ...defaultDepartmentPageKeys('comercial'),
    ].reverse())

    expect(recognizeUserAccessProfile(reversedPages)).toEqual(
      recognizeUserAccessProfile(single),
    )

    const technical = analystUser(TECHNICAL_OPERATIONS_DEPARTMENT_IDS)
    const reversedDepartments: User = {
      ...technical,
      departmentPageAccess: [...technical.departmentPageAccess].reverse(),
    }

    expect(recognizeUserAccessProfile(reversedDepartments)).toEqual(
      TECHNICAL_OPERATIONS_ACCESS_PROFILE,
    )
  })

  it('não reconhece estruturas que não podem ser interpretadas com segurança', () => {
    const unknownDepartment: User = {
      ...analystUser(['comercial']),
      departmentPageAccess: [{ departmentId: 'departamento-extinto', pageKeys: ['overview'] }],
    }
    const duplicated = analystUser(['comercial'])
    const duplicatedDepartment: User = {
      ...duplicated,
      departmentPageAccess: [...duplicated.departmentPageAccess, ...duplicated.departmentPageAccess],
    }
    const withoutAccess: User = { ...duplicated, departmentPageAccess: [] }

    expect(recognizeUserAccessProfile(unknownDepartment)).toBeNull()
    expect(recognizeUserAccessProfile(duplicatedDepartment)).toBeNull()
    expect(recognizeUserAccessProfile(withoutAccess)).toBeNull()
  })

  it('não altera o usuário nem a coleção recebida', () => {
    const users = [
      buildUser({ profile: 'Administrador' }),
      analystUser(['comercial']),
      analystUser(['cobranca', 'fidelizacao', 'retencao']),
    ].map(deepFreeze)
    const snapshot = structuredClone(users)

    const labels = users.map(userAccessProfileLabel)
    users.map(recognizeUserAccessProfile)
    users.map((user) => resolveOnSave(user))

    expect(labels).toEqual(['Acesso do Sistema', 'Comercial', UNPROFILED_ACCESS_LABEL])
    expect(users).toEqual(snapshot)
  })
})

describe('opções do seletor', () => {
  it('oferece a combinação técnica e um perfil por departamento oficial', () => {
    expect(analystAccessProfileOptions.map((option) => option.id)).toEqual([
      TECHNICAL_OPERATIONS_ACCESS_PROFILE.id,
      ...biAreas.map((area) => departmentAccessProfileId(area.id)),
    ])
  })

  it('não oferece os perfis automáticos nem o estado de leitura', () => {
    const names = analystAccessProfileOptions.map((option) => option.name)

    expect(names).not.toContain(FULL_ACCESS_PROFILE.name)
    expect(names).not.toContain(EXECUTIVE_ACCESS_PROFILE.name)
    expect(names).not.toContain(UNPROFILED_ACCESS_LABEL)
  })
})

describe('rascunho do seletor do Analista', () => {
  /**
   * O drawer guarda o rascunho e o revalida em toda entrada de valor: na
   * abertura e a cada escolha. Estas chamadas reproduzem essa passagem, que é o
   * que garante que o `select` do Analista nunca receba um valor fora das
   * opções que ele renderiza.
   */
  it('não aceita rascunho ao abrir um Administrador', () => {
    const administrator = buildUser({ profile: 'Administrador' })

    expect(initialAccessProfileId(administrator)).toBeNull()
    expect(analystAccessProfileDraft(initialAccessProfileId(administrator))).toBeNull()
  })

  it('não aceita rascunho ao abrir um Executivo', () => {
    const executive = buildUser({ profile: 'Executivo' })

    expect(initialAccessProfileId(executive)).toBeNull()
    expect(analystAccessProfileDraft(initialAccessProfileId(executive))).toBeNull()
  })

  it('nunca trata uma identidade automática como opção do seletor do Analista', () => {
    expect(analystAccessProfileDraft(FULL_ACCESS_PROFILE.id)).toBeNull()
    expect(analystAccessProfileDraft(EXECUTIVE_ACCESS_PROFILE.id)).toBeNull()
    expect(analystAccessProfileDraft('department:departamento-extinto')).toBeNull()
    expect(analystAccessProfileDraft(UNPROFILED_ACCESS_LABEL)).toBeNull()
  })

  it('não escolhe nenhum perfil departamental por conta própria', () => {
    const chosenByItself = analystAccessProfileDraft(FULL_ACCESS_PROFILE.id)

    expect(chosenByItself).toBeNull()
    expect(chosenByItself).not.toBe(TECHNICAL_OPERATIONS_ACCESS_PROFILE.id)
    // Nenhuma opção do seletor é assumida sem escolha explícita.
    for (const option of analystAccessProfileOptions) {
      expect(chosenByItself).not.toBe(option.id)
    }
    expect(analystAccessProfileDraft(null)).toBeNull()
  })

  it('mantém o rascunho ao passar por um Perfil do Sistema automático e voltar', () => {
    const current = analystUser(['comercial'])
    // Abertura no perfil reconhecido.
    const opened = analystAccessProfileDraft(initialAccessProfileId(current))
    // Troca para Administrador: o rascunho continua guardado, apenas sem uso.
    const whileAutomatic = analystAccessProfileDraft(opened)
    // Volta para Analista: a mesma escolha, e nada de automático.
    const restored = analystAccessProfileDraft(whileAutomatic)

    expect(opened).toBe(departmentAccessProfileId('comercial'))
    expect(restored).toBe(departmentAccessProfileId('comercial'))
  })

  it('deixa o salvamento pendente enquanto o Analista não tiver escolha', () => {
    const administrator = buildUser({ profile: 'Administrador' })
    const executive = buildUser({ profile: 'Executivo' })

    for (const user of [administrator, executive]) {
      expect(
        resolveOnSave(user, {
          systemProfile: 'Analista',
          accessProfileId: analystAccessProfileDraft(initialAccessProfileId(user)),
        }),
      ).toEqual({ ok: false, reason: 'access-profile-required' })
    }
  })
})

describe('accessConfigFromAccessProfile', () => {
  it('converte Operações Técnicas nos cinco departamentos técnicos', () => {
    expect(accessConfigFromAccessProfile(TECHNICAL_OPERATIONS_ACCESS_PROFILE.id)).toEqual({
      profile: 'Analista',
      departments: TECHNICAL_OPERATIONS_DEPARTMENT_IDS.map((departmentId) => ({
        departmentId,
        pageKeys: defaultDepartmentPageKeys(departmentId),
      })),
    })
  })

  it('converte um perfil departamental somente no departamento correspondente', () => {
    expect(accessConfigFromAccessProfile(departmentAccessProfileId('comercial'))).toEqual({
      profile: 'Analista',
      departments: [{ departmentId: 'comercial', pageKeys: defaultDepartmentPageKeys('comercial') }],
    })
  })

  it('recusa identidades que não são perfis selecionáveis', () => {
    expect(accessConfigFromAccessProfile(FULL_ACCESS_PROFILE.id)).toBeNull()
    expect(accessConfigFromAccessProfile(EXECUTIVE_ACCESS_PROFILE.id)).toBeNull()
    expect(accessConfigFromAccessProfile('department:departamento-extinto')).toBeNull()
  })
})

describe('resolveUserAccessConfig, alteração deliberada', () => {
  it('gera a configuração atual de Administrador no cadastro', () => {
    expect(
      resolveUserAccessConfig({
        systemProfile: 'Administrador',
        accessProfileId: departmentAccessProfileId('comercial'),
        loadedAccessProfileId: null,
        currentUser: null,
      }),
    ).toEqual({ ok: true, access: { profile: 'Administrador' } })
  })

  it('gera a configuração de Executivo ao trocar o Perfil do Sistema, preservando o Modelo já liberado', () => {
    // Analista com Modelo liberado em Comercial, promovido a Executivo.
    const current = withPageKeys(
      analystUser(['comercial']),
      'comercial',
      allDepartmentPageKeys('comercial'),
    )

    expect(resolveOnSave(current, { systemProfile: 'Executivo' })).toEqual({
      ok: true,
      access: { profile: 'Executivo', modelDepartmentIds: ['comercial'] },
    })
  })

  it('ignora a seleção anterior do Analista quando o Perfil do Sistema muda para automático', () => {
    const current = analystUser(['comercial'])

    expect(
      resolveOnSave(current, {
        systemProfile: 'Administrador',
        accessProfileId: TECHNICAL_OPERATIONS_ACCESS_PROFILE.id,
      }),
    ).toEqual({ ok: true, access: { profile: 'Administrador' } })
  })

  it('exige Perfil de Acesso no cadastro de um Analista', () => {
    expect(
      resolveUserAccessConfig({
        systemProfile: 'Analista',
        accessProfileId: null,
        loadedAccessProfileId: null,
        currentUser: null,
      }),
    ).toEqual({ ok: false, reason: 'access-profile-required' })
  })

  it('exige Perfil de Acesso ao trocar Administrador para Analista', () => {
    expect(
      resolveOnSave(buildUser({ profile: 'Administrador' }), {
        systemProfile: 'Analista',
        accessProfileId: null,
      }),
    ).toEqual({ ok: false, reason: 'access-profile-required' })
  })

  it('converte quando outro Perfil de Acesso é deliberadamente escolhido', () => {
    const current = analystUser(['cobranca', 'fidelizacao', 'retencao'])

    expect(
      resolveOnSave(current, { accessProfileId: departmentAccessProfileId('cobranca') }),
    ).toEqual({
      ok: true,
      access: {
        profile: 'Analista',
        departments: [{ departmentId: 'cobranca', pageKeys: defaultDepartmentPageKeys('cobranca') }],
      },
    })
  })

  it('converte quando o perfil reconhecido é trocado por outro', () => {
    const current = analystUser(['comercial'])

    expect(
      resolveOnSave(current, { accessProfileId: TECHNICAL_OPERATIONS_ACCESS_PROFILE.id }),
    ).toEqual({
      ok: true,
      access: accessConfigFromAccessProfile(TECHNICAL_OPERATIONS_ACCESS_PROFILE.id),
    })
  })
})

describe('resolveUserAccessConfig, edição sem alteração de perfil', () => {
  it('mantém o acesso do usuário canônico idêntico, campo a campo', () => {
    for (const user of [
      buildUser({ profile: 'Administrador' }),
      buildUser({ profile: 'Executivo' }),
      analystUser(['comercial']),
      analystUser(TECHNICAL_OPERATIONS_DEPARTMENT_IDS),
      analystUser(['cobranca', 'fidelizacao', 'retencao']),
    ]) {
      expect(accessFieldsFromResolution(resolveOnSave(user))).toEqual(accessFields(user))
    }
  })

  it('preserva Administrador e Executivo sem mudança de Perfil do Sistema', () => {
    const administrator = buildUser({ profile: 'Administrador' })
    const executive = buildUser({ profile: 'Executivo', modelDepartmentIds: ['comercial'] })

    expect(accessFieldsFromResolution(resolveOnSave(administrator))).toEqual(
      accessFields(administrator),
    )
    expect(accessFieldsFromResolution(resolveOnSave(executive))).toEqual(accessFields(executive))
    // O Modelo já liberado continua liberado, e nada além dele entra.
    expect(resolveOnSave(executive)).toEqual({
      ok: true,
      access: { profile: 'Executivo', modelDepartmentIds: ['comercial'] },
    })
  })

  it('não reconverte para a ordem canônica um acesso reconhecido em outra ordem', () => {
    // Mesmos cinco departamentos técnicos, gravados em outra ordem: o
    // reconhecimento é por conjunto e continua exibindo o perfil, mas o
    // repositório compara por posição, e reconverter reordenaria a base.
    const reordered = analystUser([...TECHNICAL_OPERATIONS_DEPARTMENT_IDS].reverse())
    const canonical = accessConfigFromAccessProfile(TECHNICAL_OPERATIONS_ACCESS_PROFILE.id)

    expect(recognizeUserAccessProfile(reordered)).toEqual(TECHNICAL_OPERATIONS_ACCESS_PROFILE)

    const resolved = accessFieldsFromResolution(resolveOnSave(reordered))

    expect(resolved).toEqual(accessFields(reordered))
    expect(resolved?.departmentPageAccess).not.toEqual(
      deriveUserAccess(canonical!)?.departmentPageAccess,
    )
  })

  it('recusa o salvamento quando o acesso atual não pode ser reproduzido', () => {
    const defaults = defaultDepartmentPageKeys('comercial')
    // Páginas equivalentes em ordem invertida: reconhecido, porém irreprodutível,
    // porque a derivação sempre devolve as páginas na ordem do catálogo.
    const reorderedPages = withPageKeys(analystUser(['comercial']), 'comercial', [
      ...defaults,
    ].reverse())
    const unknownDepartment: User = {
      ...analystUser(['comercial']),
      departmentPageAccess: [{ departmentId: 'departamento-extinto', pageKeys: ['overview'] }],
    }
    const brokenAdministrator = withPageKeys(
      buildUser({ profile: 'Administrador' }),
      'comercial',
      [],
    )

    expect(defaults).not.toEqual([...defaults].reverse())
    expect(recognizeUserAccessProfile(reorderedPages)).not.toBeNull()

    for (const user of [reorderedPages, unknownDepartment, brokenAdministrator]) {
      expect(preservedAccessConfig(user)).toBeNull()
      expect(resolveOnSave(user)).toEqual({
        ok: false,
        reason: 'current-access-not-preservable',
      })
    }
  })

  it('não converte automaticamente um acesso atual sem perfil', () => {
    const current = analystUser(['cobranca', 'fidelizacao', 'retencao'])
    const resolution = resolveOnSave(current)

    expect(resolution.ok).toBe(true)
    if (!resolution.ok) return

    // O acesso devolvido é o que já está gravado, e não o de algum perfil
    // aprovado: gravá-lo de volta não muda nada no usuário.
    expect(accessFieldsFromResolution(resolution)).toEqual(accessFields(current))
    expect(recognizeUserAccessProfile(buildUser(resolution.access))).toBeNull()
  })

  it('preserva um acesso com página removida sem reintroduzi-la', () => {
    const defaults = defaultDepartmentPageKeys('comercial')
    const current = withPageKeys(analystUser(['comercial']), 'comercial', defaults.slice(0, -1))

    expect(accessFieldsFromResolution(resolveOnSave(current))).toEqual(accessFields(current))
  })

  it('trata voltar ao perfil reconhecido como ausência de alteração', () => {
    const reordered = analystUser([...TECHNICAL_OPERATIONS_DEPARTMENT_IDS].reverse())
    const loaded = initialAccessProfileId(reordered)

    // Trocou para outro perfil e voltou: o valor final é o de origem, então não
    // houve escolha nova e o acesso gravado segue intocado.
    expect(accessFieldsFromResolution(resolveOnSave(reordered, { accessProfileId: loaded }))).toEqual(
      accessFields(reordered),
    )
  })
})

describe('ida e volta entre conversão e reconhecimento', () => {
  it('reconhece de volta o mesmo perfil aprovado em todas as opções do seletor', () => {
    for (const option of analystAccessProfileOptions) {
      const access = accessConfigFromAccessProfile(option.id)

      expect(access).not.toBeNull()
      if (!access) continue

      const user = buildUser(access)

      expect(recognizeUserAccessProfile(user)).toEqual(option)
      expect(initialAccessProfileId(user)).toBe(option.id)
    }
  })

  it('carrega o seletor vazio para quem não tem perfil reconhecido', () => {
    expect(initialAccessProfileId(analystUser(['cobranca', 'fidelizacao']))).toBeNull()
    expect(initialAccessProfileId(buildUser({ profile: 'Administrador' }))).toBeNull()
    expect(initialAccessProfileId(buildUser({ profile: 'Executivo' }))).toBeNull()
    expect(initialAccessProfileId(null)).toBeNull()
  })
})
