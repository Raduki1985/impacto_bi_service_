import { describe, expect, it } from 'vitest'

import {
  EXECUTIVE_ACCESS_PROFILE_NAME,
  FULL_ACCESS_PROFILE_NAME,
} from '../../config/accessProfileCatalog'
import { biAreas, type BiArea } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import type { User } from '../../data/dashboardTypes'
import {
  MODEL_PAGE_KEY,
  defaultDepartmentPageKeys,
  deriveUserAccess,
  type UserAccessConfig,
} from '../../lib/userAccessRules'
import type {
  AccessProfile,
  StandardAccessProfile,
  SystemAccessProfile,
} from '../../types/access'
import {
  UNPROFILED_ACCESS_LABEL,
  accessProfileDraftFor,
  accessProfileOptionsFor,
  accessProfileSummary,
  automaticAccessProfileOption,
  checkAccessProfileSelection,
  findAccessProfileOption,
  initialAccessProfileId,
  toAccessProfileOption,
  userAccessProfileLabel,
  userAccessProfileOption,
} from './userAccessProfiles'

/**
 * Testes do modelo de apresentação do Perfil de Acesso na tela Usuários.
 *
 * O módulo deixou de reconhecer perfis a partir dos acessos gravados: o portal
 * passou a persistir o vínculo (`accessProfileId`), e o que sobrou aqui é
 * apresentação. É isso que estes testes verificam, e em três frentes:
 *
 * - o seletor só oferece perfis existentes, ativos e compatíveis com o Perfil do
 *   Sistema em vigor;
 * - o vínculo gravado nunca é aceito sozinho: ele é confrontado com a coleção
 *   real antes de virar nome exibido ou escolha do formulário;
 * - a recusa do formulário não é `accessProfileId !== null`, e sim a conferência
 *   do id contra as opções oferecidas.
 *
 * Departamentos e páginas vêm do catálogo real, localizados em tempo de
 * execução: nenhuma lista é escrita à mão aqui. Módulo puro, testado sem
 * navegador e sem armazenamento.
 */

/* -------------------------------------------------------------------------- */
/* Dados reais do catálogo                                                    */
/* -------------------------------------------------------------------------- */

function availablePageKeys(area: BiArea): string[] {
  return departmentPages[area.id].filter((page) => !page.disabled).map((page) => page.key)
}

/** Páginas que um perfil comum concede em um departamento: publicadas, sem o Modelo. */
function grantedPageKeys(area: BiArea): string[] {
  return availablePageKeys(area).filter((pageKey) => pageKey !== MODEL_PAGE_KEY)
}

function requireArea(description: string, matches: (area: BiArea) => boolean): BiArea {
  const area = biAreas.find(matches)
  if (!area) throw new Error(`Catálogo sem ${description}: o teste precisa de dados reais.`)

  return area
}

const firstArea = requireArea(
  'departamento com página concedível',
  (area) => grantedPageKeys(area).length >= 1,
)
const secondArea = requireArea(
  'segundo departamento com página concedível',
  (area) => area.id !== firstArea.id && grantedPageKeys(area).length >= 1,
)

/** Ordem oficial dos dois departamentos, que é a de `biAreas` e não a da montagem. */
const orderedLabels = biAreas
  .filter((area) => area.id === firstArea.id || area.id === secondArea.id)
  .map((area) => area.label)

/* -------------------------------------------------------------------------- */
/* Montagem dos perfis                                                        */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROFILE_ID = 'acp-system'

function buildSystemProfile(): SystemAccessProfile {
  return {
    id: SYSTEM_PROFILE_ID,
    name: FULL_ACCESS_PROFILE_NAME,
    kind: 'system',
    audience: 'administrator',
    lifecycle: 'active',
    departmentPageAccess: biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: availablePageKeys(area),
    })),
    homePage: { departmentId: firstArea.id, pageKey: grantedPageKeys(firstArea)[0] },
    hasBeenUsed: true,
  }
}

function buildStandardProfile(
  overrides: Partial<StandardAccessProfile> = {},
): StandardAccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    kind: 'standard',
    audience: 'analyst',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: firstArea.id, pageKeys: grantedPageKeys(firstArea) }],
    homePage: { departmentId: firstArea.id, pageKey: grantedPageKeys(firstArea)[0] },
    hasBeenUsed: false,
    ...overrides,
  }
}

/** Perfil analista com dois departamentos, gravados fora da ordem do catálogo. */
function buildMultiDepartmentProfile(): StandardAccessProfile {
  return buildStandardProfile({
    id: 'acp-010',
    name: 'Operações Técnicas',
    departmentPageAccess: [
      { departmentId: secondArea.id, pageKeys: grantedPageKeys(secondArea) },
      { departmentId: firstArea.id, pageKeys: grantedPageKeys(firstArea) },
    ],
  })
}

function buildExecutiveProfile(overrides: Partial<StandardAccessProfile> = {}) {
  return buildStandardProfile({
    id: 'acp-002',
    name: EXECUTIVE_ACCESS_PROFILE_NAME,
    audience: 'executive',
    departmentPageAccess: biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: grantedPageKeys(area),
    })),
    ...overrides,
  })
}

/** Coleção completa, como o repositório a entrega: sistema primeiro, comuns depois. */
function buildCollection(...extra: AccessProfile[]): AccessProfile[] {
  return [buildSystemProfile(), buildExecutiveProfile(), buildStandardProfile(), ...extra]
}

/* -------------------------------------------------------------------------- */
/* Montagem dos usuários                                                      */
/* -------------------------------------------------------------------------- */

function buildUser(access: UserAccessConfig, overrides: Partial<User> = {}): User {
  const derived = deriveUserAccess(access)
  if (!derived) throw new Error('Configuração de acesso inválida no teste')

  return {
    id: 'usr-001',
    name: 'Usuária de Teste',
    email: 'teste@impactotelecom.com',
    ...derived,
    accessProfileId: null,
    status: 'Ativo',
    lastAccess: 'Nunca acessou',
    initials: 'UT',
    ...overrides,
  }
}

function analystUser(overrides: Partial<User> = {}): User {
  return buildUser(
    {
      profile: 'Analista',
      departments: [
        { departmentId: firstArea.id, pageKeys: defaultDepartmentPageKeys(firstArea.id) },
      ],
    },
    overrides,
  )
}

/* -------------------------------------------------------------------------- */
/* 1. Opções do seletor                                                       */
/* -------------------------------------------------------------------------- */

describe('opções do seletor', () => {
  it('oferece ao Administrador somente o Acesso do Sistema', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Administrador')

    expect(options.map((option) => option.id)).toEqual([SYSTEM_PROFILE_ID])
    expect(options[0].name).toBe(FULL_ACCESS_PROFILE_NAME)
  })

  it('oferece ao Executivo somente os perfis comuns destinados a Executivos', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Executivo')

    expect(options.map((option) => option.id)).toEqual(['acp-002'])
  })

  it('oferece ao Analista somente os perfis comuns destinados a Analistas', () => {
    const options = accessProfileOptionsFor(buildCollection(buildMultiDepartmentProfile()), 'Analista')

    expect(options.map((option) => option.id)).toEqual(['acp-001', 'acp-010'])
  })

  it('nunca oferece o Acesso do Sistema a quem não é Administrador', () => {
    for (const profile of ['Executivo', 'Analista'] as const) {
      const options = accessProfileOptionsFor(buildCollection(), profile)

      expect(options.some((option) => option.id === SYSTEM_PROFILE_ID)).toBe(false)
    }
  })

  it('não oferece perfil inativo', () => {
    const inactive = buildStandardProfile({ id: 'acp-900', name: 'Perfil desativado', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor(buildCollection(inactive), 'Analista')

    expect(options.map((option) => option.id)).toEqual(['acp-001'])
  })

  it('preserva a ordem da coleção recebida', () => {
    const extra = buildStandardProfile({ id: 'acp-020', name: 'Perfil posterior' })
    const options = accessProfileOptionsFor(buildCollection(extra), 'Analista')

    expect(options.map((option) => option.id)).toEqual(['acp-001', 'acp-020'])
  })
})

/* -------------------------------------------------------------------------- */
/* 2. Departamentos concedidos                                                */
/* -------------------------------------------------------------------------- */

describe('departamentos concedidos por uma opção', () => {
  it('usa os rótulos oficiais dos departamentos, na ordem do catálogo', () => {
    // O perfil grava os dois departamentos fora da ordem do catálogo de
    // propósito: o texto exibido não pode depender da ordem de gravação.
    const option = toAccessProfileOption(buildMultiDepartmentProfile())

    expect(option.departmentLabels).toEqual(orderedLabels)
  })

  it('não exibe id técnico nem chave de página', () => {
    const option = toAccessProfileOption(buildMultiDepartmentProfile())
    const text = option.departmentLabels.join(' ')

    expect(text).not.toContain(firstArea.id)
    expect(text).not.toContain(secondArea.id)
    for (const pageKey of grantedPageKeys(firstArea)) expect(text).not.toContain(pageKey)
  })

  it('ignora departamento fora do catálogo e concessão sem nenhuma página', () => {
    const option = toAccessProfileOption(
      buildStandardProfile({
        departmentPageAccess: [
          { departmentId: 'departamento-que-nao-existe', pageKeys: ['overview'] },
          { departmentId: secondArea.id, pageKeys: [] },
          { departmentId: firstArea.id, pageKeys: grantedPageKeys(firstArea) },
        ],
      }),
    )

    expect(option.departmentLabels).toEqual([firstArea.label])
  })
})

/* -------------------------------------------------------------------------- */
/* 3. Perfil automático do Administrador                                      */
/* -------------------------------------------------------------------------- */

describe('perfil automático', () => {
  it('devolve o Acesso do Sistema para o Administrador', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Administrador')

    expect(automaticAccessProfileOption(options, 'Administrador')?.id).toBe(SYSTEM_PROFILE_ID)
  })

  it('não existe para Executivo nem para Analista', () => {
    for (const profile of ['Executivo', 'Analista'] as const) {
      const options = accessProfileOptionsFor(buildCollection(), profile)

      expect(automaticAccessProfileOption(options, profile)).toBeNull()
    }
  })

  it('devolve null quando o Acesso do Sistema não está na coleção', () => {
    const options = accessProfileOptionsFor([buildExecutiveProfile()], 'Administrador')

    expect(automaticAccessProfileOption(options, 'Administrador')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* 4. Rascunho do seletor                                                     */
/* -------------------------------------------------------------------------- */

describe('rascunho do seletor', () => {
  it('mantém uma escolha que continua entre as opções', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Analista')

    expect(accessProfileDraftFor(options, 'Analista', 'acp-001')).toBe('acp-001')
  })

  it('limpa a escolha que deixou de ser compatível ao trocar o Perfil do Sistema', () => {
    const collection = buildCollection()
    const analystOptions = accessProfileOptionsFor(collection, 'Analista')
    const executiveOptions = accessProfileOptionsFor(collection, 'Executivo')

    // Escolha válida para o Analista.
    expect(accessProfileDraftFor(analystOptions, 'Analista', 'acp-001')).toBe('acp-001')
    // A mesma escolha, agora como Executivo: sai do rascunho.
    expect(accessProfileDraftFor(executiveOptions, 'Executivo', 'acp-001')).toBeNull()
  })

  it('limpa a escolha de um perfil que foi desativado', () => {
    const inactive = buildStandardProfile({ id: 'acp-001', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor([buildSystemProfile(), inactive], 'Analista')

    expect(accessProfileDraftFor(options, 'Analista', 'acp-001')).toBeNull()
  })

  it('escolhe sozinho o Acesso do Sistema para o Administrador, ignorando o rascunho anterior', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Administrador')

    expect(accessProfileDraftFor(options, 'Administrador', 'acp-001')).toBe(SYSTEM_PROFILE_ID)
    expect(accessProfileDraftFor(options, 'Administrador', null)).toBe(SYSTEM_PROFILE_ID)
  })

  it('trata ausência de escolha como null, e não como a primeira opção', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Analista')

    expect(accessProfileDraftFor(options, 'Analista', null)).toBeNull()
  })

  it('nunca aceita um id fora das opções oferecidas', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Analista')

    for (const id of ['acp-999', SYSTEM_PROFILE_ID, 'acp-002', '']) {
      expect(accessProfileDraftFor(options, 'Analista', id)).toBeNull()
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 5. Vínculo gravado                                                         */
/* -------------------------------------------------------------------------- */

describe('vínculo gravado do usuário', () => {
  it('exibe o nome do perfil apontado pelo vínculo', () => {
    const collection = buildCollection()
    const user = analystUser({ accessProfileId: 'acp-001' })

    expect(userAccessProfileOption(user, collection)?.id).toBe('acp-001')
    expect(userAccessProfileLabel(user, collection)).toBe('Perfil de Teste')
  })

  it('exibe o Acesso do Sistema para o Administrador vinculado a ele', () => {
    const collection = buildCollection()
    const administrator = buildUser(
      { profile: 'Administrador' },
      { accessProfileId: SYSTEM_PROFILE_ID },
    )

    expect(userAccessProfileLabel(administrator, collection)).toBe(FULL_ACCESS_PROFILE_NAME)
  })

  it('não aceita o vínculo sozinho: id desconhecido fica sem perfil', () => {
    const collection = buildCollection()
    const user = analystUser({ accessProfileId: 'acp-999' })

    expect(userAccessProfileOption(user, collection)).toBeNull()
    expect(userAccessProfileLabel(user, collection)).toBe(UNPROFILED_ACCESS_LABEL)
  })

  it('recusa vínculo de destino incompatível com o Perfil do Sistema', () => {
    const collection = buildCollection()
    // Analista apontando para o perfil executivo, e Analista apontando para o
    // Acesso do Sistema: nenhum dos dois vale.
    for (const accessProfileId of ['acp-002', SYSTEM_PROFILE_ID]) {
      const user = analystUser({ accessProfileId })

      expect(userAccessProfileLabel(user, collection)).toBe(UNPROFILED_ACCESS_LABEL)
    }
  })

  it('recusa o Administrador que não está no Acesso do Sistema', () => {
    const collection = buildCollection()
    const administrator = buildUser({ profile: 'Administrador' }, { accessProfileId: 'acp-001' })

    expect(userAccessProfileLabel(administrator, collection)).toBe(UNPROFILED_ACCESS_LABEL)
  })

  it('trata null, texto vazio e propriedade ausente como ausência de vínculo', () => {
    const collection = buildCollection()
    const withoutProperty = analystUser()
    delete (withoutProperty as { accessProfileId?: unknown }).accessProfileId

    for (const user of [
      analystUser({ accessProfileId: null }),
      analystUser({ accessProfileId: '' }),
      analystUser({ accessProfileId: '   ' }),
      withoutProperty,
    ]) {
      expect(userAccessProfileLabel(user, collection)).toBe(UNPROFILED_ACCESS_LABEL)
    }
  })

  it('abre a edição com o vínculo válido e sem seleção quando ele não vale', () => {
    const collection = buildCollection()

    expect(initialAccessProfileId(analystUser({ accessProfileId: 'acp-001' }), collection)).toBe(
      'acp-001',
    )
    expect(initialAccessProfileId(analystUser({ accessProfileId: 'acp-999' }), collection)).toBeNull()
    expect(initialAccessProfileId(null, collection)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* 6. Conteúdo do campo selecionado                                           */
/* -------------------------------------------------------------------------- */

describe('resumo do perfil selecionado', () => {
  it('traz o nome do perfil e os departamentos oficiais separados por ponto médio', () => {
    const summary = accessProfileSummary(toAccessProfileOption(buildMultiDepartmentProfile()))

    expect(summary?.name).toBe('Operações Técnicas')
    expect(summary?.departments).toBe(orderedLabels.join(' · '))
  })

  it('não exibe nada sem perfil selecionado', () => {
    expect(accessProfileSummary(null)).toBeNull()
  })

  it('diz que não há departamento em vez de deixar a linha vazia', () => {
    const summary = accessProfileSummary(
      toAccessProfileOption(buildStandardProfile({ departmentPageAccess: [] })),
    )

    expect(summary?.departments).toBe('Nenhum departamento concedido')
  })
})

/* -------------------------------------------------------------------------- */
/* 7. Recusa do formulário                                                    */
/* -------------------------------------------------------------------------- */

describe('conferência da escolha do Perfil de Acesso', () => {
  it('aceita uma escolha que está entre as opções', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Analista')
    const state = checkAccessProfileSelection(options, 'acp-001', true)

    expect(state).toEqual({ ok: true, option: findAccessProfileOption(options, 'acp-001') })
  })

  it('recusa a ausência de escolha', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Analista')

    expect(checkAccessProfileSelection(options, null, true)).toEqual({
      ok: false,
      reason: 'required',
    })
  })

  it('recusa id inexistente, inativo e de destino incompatível pelo mesmo caminho', () => {
    const inactive = buildStandardProfile({ id: 'acp-030', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor(buildCollection(inactive), 'Analista')

    // Um id que não existe, o de um perfil desativado e o de um perfil de outro
    // destino: nenhum deles está entre as opções, e os três recusam.
    for (const id of ['acp-999', 'acp-030', 'acp-002', SYSTEM_PROFILE_ID]) {
      expect(checkAccessProfileSelection(options, id, true)).toEqual({
        ok: false,
        reason: 'unknown',
      })
    }
  })

  it('recusa antes de qualquer conferência quando a coleção não pôde ser lida', () => {
    // Nem mesmo uma escolha aparentemente válida passa: sem a coleção, ninguém
    // sabe se ela é válida.
    expect(checkAccessProfileSelection([], 'acp-001', false)).toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })

  it('não valida apenas pela presença do id', () => {
    const options = accessProfileOptionsFor(buildCollection(), 'Analista')
    const state = checkAccessProfileSelection(options, 'acp-002', true)

    // O id está preenchido e aponta para um perfil que existe e está ativo: o
    // que o recusa é o destino, e não a ausência de valor.
    expect(state.ok).toBe(false)
  })
})
