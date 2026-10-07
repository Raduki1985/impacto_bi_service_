/*
import { describe, expect, it } from 'vitest'

import {
  EXECUTIVE_ACCESS_PROFILE_NAME,
  FULL_ACCESS_PROFILE_NAME,
} from '../../config/accessProfileCatalog'
import { biAreas, type BiArea } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import { MODEL_PAGE_KEY } from '../../lib/userAccessRules'
import type { AccessProfile, UserProfile } from '../../types/access'
import {
  PROFILE_TYPE_CODE_BY_USER_PROFILE,
  type SystemProfileOption,
} from '../../services/users/userApiMapper'
import type { CoreUser } from '../../types/coreApi'
import {
  UNPROFILED_ACCESS_LABEL,
  accessProfileDraftFor,
  accessProfileOptionsFor,
  accessProfileSummary,
  checkAccessProfileSelection,
  findAccessProfileOption,
  initialAccessProfileId,
  initialProfileSystemId,
  systemProfileOf,
  toAccessProfileOption,
  userAccessProfileLabel,
  userAccessProfileOption,
} from './userAccessProfiles'

/!**
 * Testes do modelo de apresentação do Perfil de Acesso na tela Usuários.
 *
 * O módulo deixou de reconhecer perfis a partir dos acessos gravados: o portal
 * passou a persistir o vínculo (`access_profile_id`), e o que sobrou aqui é
 * apresentação. É isso que estes testes verificam, e em três frentes:
 *
 * - o seletor só oferece perfis existentes e ativos. O recorte por Perfil do
 *   Sistema acabou junto com o destino do Perfil de Acesso: qualquer usuário
 *   pode receber qualquer perfil;
 * - o vínculo gravado nunca é aceito sozinho: ele é confrontado com a coleção
 *   real antes de virar nome exibido ou escolha do formulário;
 * - a recusa do formulário não é `access_profile_id !== null`, e sim a conferência
 *   do id contra as opções oferecidas.
 *
 * Departamentos e páginas vêm do catálogo real, localizados em tempo de
 * execução: nenhuma lista é escrita à mão aqui. Módulo puro, testado sem
 * navegador e sem armazenamento.
 *!/

/!* -------------------------------------------------------------------------- *!/
/!* Dados reais do catálogo                                                    *!/
/!* -------------------------------------------------------------------------- *!/

function availablePageKeys(area: BiArea): string[] {
  return departmentPages[area.id].filter((page) => !page.disabled).map((page) => page.key)
}

/!** Páginas que um perfil comum concede em um departamento: publicadas, sem o Modelo. *!/
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

/!** Ordem oficial dos dois departamentos, que é a de `biAreas` e não a da montagem. *!/
const orderedLabels = biAreas
  .filter((area) => area.id === firstArea.id || area.id === secondArea.id)
  .map((area) => area.label)

/!* -------------------------------------------------------------------------- *!/
/!* Montagem dos perfis                                                        *!/
/!* -------------------------------------------------------------------------- *!/

const SYSTEM_PROFILE_ID = 'acp-system'

/!**
 * Perfil de alcance máximo, com o nome do antigo `Acesso do Sistema`.
 *
 * Continua na coleção porque é um perfil real e amplo, mas deixou de ser
 * especial: não é mais somente leitura, não é exclusivo do Administrador e
 * aparece para todo mundo no seletor.
 *!/
function buildSystemProfile(): AccessProfile {
  return {
    id: SYSTEM_PROFILE_ID,
    name: FULL_ACCESS_PROFILE_NAME,
    lifecycle: 'active',
    departmentPageAccess: biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: availablePageKeys(area),
    })),
    homePage: { departmentId: firstArea.id, pageKey: grantedPageKeys(firstArea)[0] },
    hasBeenUsed: true,
  }
}

function buildStandardProfile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return {
    id: 'acp-001',
    name: 'Perfil de Teste',
    lifecycle: 'active',
    departmentPageAccess: [{ departmentId: firstArea.id, pageKeys: grantedPageKeys(firstArea) }],
    homePage: { departmentId: firstArea.id, pageKey: grantedPageKeys(firstArea)[0] },
    hasBeenUsed: false,
    ...overrides,
  }
}

/!** Perfil com dois departamentos, gravados fora da ordem do catálogo. *!/
function buildMultiDepartmentProfile(): AccessProfile {
  return buildStandardProfile({
    id: 'acp-010',
    name: 'Operações Técnicas',
    departmentPageAccess: [
      { departmentId: secondArea.id, pageKeys: grantedPageKeys(secondArea) },
      { departmentId: firstArea.id, pageKeys: grantedPageKeys(firstArea) },
    ],
  })
}

function buildExecutiveProfile(overrides: Partial<AccessProfile> = {}) {
  return buildStandardProfile({
    id: 'acp-002',
    name: EXECUTIVE_ACCESS_PROFILE_NAME,
    departmentPageAccess: biAreas.map((area) => ({
      departmentId: area.id,
      pageKeys: grantedPageKeys(area),
    })),
    ...overrides,
  })
}

/!** Coleção completa, na ordem em que o repositório a entrega. *!/
function buildCollection(...extra: AccessProfile[]): AccessProfile[] {
  return [buildSystemProfile(), buildExecutiveProfile(), buildStandardProfile(), ...extra]
}

/!* -------------------------------------------------------------------------- *!/
/!* Montagem dos usuários                                                      *!/
/!* -------------------------------------------------------------------------- *!/

/!**
 * Linha de `users` como o serviço a devolve.
 *
 * Este módulo lê DUAS coisas dela, e só elas: o código do tipo de perfil, de
 * onde sai o Perfil do Sistema, e `access_profile_id`, o vínculo com a linha de
 * `access`. Os departamentos e páginas expandidos do domínio não entram aqui —
 * eles vêm do perfil, e é o perfil que estes testes montam.
 *!/
function buildUser(profile: UserProfile, overrides: Partial<CoreUser> = {}): CoreUser {
  const code = PROFILE_TYPE_CODE_BY_USER_PROFILE[profile]

  return {
    id: 'usr-001',
    name: 'Usuária de Teste',
    email: 'teste@impactotelecom.com',
    status: 'active',
    is_active: true,
    last_access: null,
    profile_system_id: `tipo-${code}`,
    access_profile_id: null,
    profile_type: { id: `tipo-${code}`, code, name: profile },
    access: null,
    set_password_expire: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  }
}

function analystUser(overrides: Partial<CoreUser> = {}): CoreUser {
  return buildUser('Analista', overrides)
}

/!* -------------------------------------------------------------------------- *!/
/!* 1. Opções do seletor                                                       *!/
/!* -------------------------------------------------------------------------- *!/

describe('opções do seletor', () => {
  it('oferece a coleção inteira, sem recorte por Perfil do Sistema', () => {
    const options = accessProfileOptionsFor(buildCollection(buildMultiDepartmentProfile()))

    expect(options.map((option) => option.id)).toEqual([
      SYSTEM_PROFILE_ID,
      'acp-002',
      'acp-001',
      'acp-010',
    ])
  })

  it('oferece o perfil de alcance máximo a todo mundo', () => {
    // Ele era exclusivo do Administrador, como `Acesso do Sistema`. Deixou de
    // ser: nenhum perfil pertence mais a um Perfil do Sistema.
    const options = accessProfileOptionsFor(buildCollection())

    expect(options.some((option) => option.id === SYSTEM_PROFILE_ID)).toBe(true)
    expect(options.find((option) => option.id === SYSTEM_PROFILE_ID)?.name).toBe(
      FULL_ACCESS_PROFILE_NAME,
    )
  })

  it('não oferece perfil inativo', () => {
    const inactive = buildStandardProfile({ id: 'acp-900', name: 'Perfil desativado', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor(buildCollection(inactive))

    expect(options.some((option) => option.id === 'acp-900')).toBe(false)
  })

  it('preserva a ordem da coleção recebida', () => {
    const extra = buildStandardProfile({ id: 'acp-020', name: 'Perfil posterior' })
    const options = accessProfileOptionsFor(buildCollection(extra))

    expect(options.map((option) => option.id)).toEqual([
      SYSTEM_PROFILE_ID,
      'acp-002',
      'acp-001',
      'acp-020',
    ])
  })
})

/!* -------------------------------------------------------------------------- *!/
/!* 2. Departamentos concedidos                                                *!/
/!* -------------------------------------------------------------------------- *!/

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

/!*
 * `automaticAccessProfileOption` tinha uma seção própria aqui, e foi REMOVIDA
 * junto com a função: o Administrador recebia o `Acesso do Sistema` sem
 * escolher, porque era o único perfil compatível com ele. Nenhum perfil é mais
 * exclusivo de ninguém, então todo mundo escolhe.
 *!/

/!* -------------------------------------------------------------------------- *!/
/!* 4. Rascunho do seletor                                                     *!/
/!* -------------------------------------------------------------------------- *!/

describe('rascunho do seletor', () => {
  it('mantém uma escolha que continua entre as opções', () => {
    const options = accessProfileOptionsFor(buildCollection())

    expect(accessProfileDraftFor(options, 'acp-001')).toBe('acp-001')
  })

  it('preserva a escolha ao trocar o Perfil do Sistema', () => {
    // A escolha saía do rascunho quando o destino do perfil deixava de casar
    // com o Perfil do Sistema. Não sai mais: as opções são as mesmas para todos.
    const options = accessProfileOptionsFor(buildCollection())

    expect(accessProfileDraftFor(options, 'acp-001')).toBe('acp-001')
    expect(accessProfileDraftFor(options, 'acp-002')).toBe('acp-002')
    expect(accessProfileDraftFor(options, SYSTEM_PROFILE_ID)).toBe(SYSTEM_PROFILE_ID)
  })

  it('limpa a escolha de um perfil que foi desativado', () => {
    const inactive = buildStandardProfile({ id: 'acp-001', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor([buildSystemProfile(), inactive])

    expect(accessProfileDraftFor(options, 'acp-001')).toBeNull()
  })

  it('trata ausência de escolha como null, e não como a primeira opção', () => {
    const options = accessProfileOptionsFor(buildCollection())

    expect(accessProfileDraftFor(options, null)).toBeNull()
  })

  it('nunca aceita um id fora das opções oferecidas', () => {
    const options = accessProfileOptionsFor(buildCollection())

    for (const id of ['acp-999', '']) {
      expect(accessProfileDraftFor(options, id)).toBeNull()
    }
  })
})

/!* -------------------------------------------------------------------------- *!/
/!* 5. Vínculo gravado                                                         *!/
/!* -------------------------------------------------------------------------- *!/

describe('vínculo gravado do usuário', () => {
  it('exibe o nome do perfil apontado pelo vínculo', () => {
    const collection = buildCollection()
    const user = analystUser({ access_profile_id: 'acp-001' })

    expect(userAccessProfileOption(user, collection)?.id).toBe('acp-001')
    expect(userAccessProfileLabel(user, collection)).toBe('Perfil de Teste')
  })

  it('exibe o Acesso do Sistema para o Administrador vinculado a ele', () => {
    const collection = buildCollection()
    const administrator = buildUser('Administrador', { access_profile_id: SYSTEM_PROFILE_ID })

    expect(userAccessProfileLabel(administrator, collection)).toBe(FULL_ACCESS_PROFILE_NAME)
  })

  it('não aceita o vínculo sozinho: id desconhecido fica sem perfil', () => {
    const collection = buildCollection()
    const user = analystUser({ access_profile_id: 'acp-999' })

    expect(userAccessProfileOption(user, collection)).toBeNull()
    expect(userAccessProfileLabel(user, collection)).toBe(UNPROFILED_ACCESS_LABEL)
  })

  it('aceita qualquer vínculo existente, seja qual for o Perfil do Sistema', () => {
    const collection = buildCollection()

    // Os três casos recusavam antes, por incompatibilidade de destino: Analista
    // no perfil executivo, Analista no alcance máximo e Administrador em um
    // perfil comum. Hoje os três valem.
    expect(userAccessProfileLabel(analystUser({ access_profile_id: 'acp-002' }), collection)).toBe(
      EXECUTIVE_ACCESS_PROFILE_NAME,
    )
    expect(
      userAccessProfileLabel(analystUser({ access_profile_id: SYSTEM_PROFILE_ID }), collection),
    ).toBe(FULL_ACCESS_PROFILE_NAME)
    expect(
      userAccessProfileLabel(
        buildUser('Administrador', { access_profile_id: 'acp-001' }),
        collection,
      ),
    ).toBe('Perfil de Teste')
  })

  it('recusa o vínculo com um perfil desativado', () => {
    const collection = [buildStandardProfile({ id: 'acp-001', lifecycle: 'inactive' })]

    expect(userAccessProfileLabel(analystUser({ access_profile_id: 'acp-001' }), collection)).toBe(
      UNPROFILED_ACCESS_LABEL,
    )
  })

  it('trata null, texto vazio e propriedade ausente como ausência de vínculo', () => {
    const collection = buildCollection()
    const withoutProperty = analystUser()
    delete (withoutProperty as { access_profile_id?: unknown }).access_profile_id

    for (const user of [
      analystUser({ access_profile_id: null }),
      analystUser({ access_profile_id: '' }),
      analystUser({ access_profile_id: '   ' }),
      withoutProperty,
    ]) {
      expect(userAccessProfileLabel(user, collection)).toBe(UNPROFILED_ACCESS_LABEL)
    }
  })

  it('abre a edição com o vínculo válido e sem seleção quando ele não vale', () => {
    const collection = buildCollection()

    expect(initialAccessProfileId(analystUser({ access_profile_id: 'acp-001' }), collection)).toBe(
      'acp-001',
    )
    expect(initialAccessProfileId(analystUser({ access_profile_id: 'acp-999' }), collection)).toBeNull()
    expect(initialAccessProfileId(null, collection)).toBeNull()
  })
})

/!* -------------------------------------------------------------------------- *!/
/!* 6. Conteúdo do campo selecionado                                           *!/
/!* -------------------------------------------------------------------------- *!/

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

/!* -------------------------------------------------------------------------- *!/
/!* 7. Recusa do formulário                                                    *!/
/!* -------------------------------------------------------------------------- *!/

describe('conferência da escolha do Perfil de Acesso', () => {
  it('aceita uma escolha que está entre as opções', () => {
    const options = accessProfileOptionsFor(buildCollection())
    const state = checkAccessProfileSelection(options, 'acp-001', true)

    expect(state).toEqual({ ok: true, option: findAccessProfileOption(options, 'acp-001') })
  })

  it('recusa a ausência de escolha', () => {
    const options = accessProfileOptionsFor(buildCollection())

    expect(checkAccessProfileSelection(options, null, true)).toEqual({
      ok: false,
      reason: 'required',
    })
  })

  it('recusa id inexistente e id de perfil inativo pelo mesmo caminho', () => {
    const inactive = buildStandardProfile({ id: 'acp-030', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor(buildCollection(inactive))

    // O id de outro destino saiu desta lista: destino não existe mais, e
    // `acp-002` é uma escolha válida como qualquer outra.
    for (const id of ['acp-999', 'acp-030']) {
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
    const inactive = buildStandardProfile({ id: 'acp-030', lifecycle: 'inactive' })
    const options = accessProfileOptionsFor(buildCollection(inactive))
    const state = checkAccessProfileSelection(options, 'acp-030', true)

    // O id está preenchido e aponta para um perfil que existe: o que o recusa é
    // o perfil estar desativado, e não a ausência de valor.
    expect(state.ok).toBe(false)
  })
})

/!* -------------------------------------------------------------------------- *!/
/!* Perfil do Sistema vindo de profile_types                                   *!/
/!* -------------------------------------------------------------------------- *!/

/!** Catálogo como o serviço devolve: na ordem dele, com os nomes gravados lá. *!/
const profileTypes: SystemProfileOption[] = [
  { id: 'tipo-analista', code: 'analyst', name: 'Analista', profile: 'Analista' },
  { id: 'tipo-exec', code: 'executive', name: 'Executivo', profile: 'Executivo' },
  { id: 'tipo-adm', code: 'adm', name: 'Administrador', profile: 'Administrador' },
]

describe('Perfil do Sistema do formulário', () => {
  it('abre a edição no tipo cujo código corresponde ao perfil gravado', () => {
    expect(initialProfileSystemId(buildUser('Executivo'), profileTypes)).toBe('tipo-exec')
    expect(initialProfileSystemId(buildUser('Administrador'), profileTypes)).toBe('tipo-adm')
  })

  it('abre a criação no Analista, o padrão de sempre', () => {
    expect(initialProfileSystemId(null, profileTypes)).toBe('tipo-analista')
  })

  it('fica sem escolha enquanto o catálogo não chegou', () => {
    expect(initialProfileSystemId(null, [])).toBeNull()
    expect(initialProfileSystemId(buildUser('Executivo'), [])).toBeNull()
  })

  it('traduz o tipo escolhido para a leitura do portal', () => {
    expect(systemProfileOf(profileTypes, 'tipo-adm')).toBe('Administrador')
    expect(systemProfileOf(profileTypes, 'tipo-inexistente')).toBeNull()
    expect(systemProfileOf(profileTypes, null)).toBeNull()
  })
})

*/
