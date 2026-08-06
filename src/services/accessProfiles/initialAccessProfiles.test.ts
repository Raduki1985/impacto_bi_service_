import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  EXECUTIVE_ACCESS_PROFILE_NAME,
  TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
  TECHNICAL_OPERATIONS_DEPARTMENT_IDS,
} from '../../config/accessProfileCatalog'
import { biAreas } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import {
  ACCESS_PROFILE_ID_PATTERN,
  availableDepartmentPageKeys,
  evaluateAccessProfile,
} from '../../lib/accessProfileRules'
import { MODEL_PAGE_KEY, OVERVIEW_PAGE_KEY } from '../../lib/userAccessRules'
import type { StandardAccessProfile } from '../../types/access'
import {
  SYSTEM_ACCESS_PROFILE_ID,
  SYSTEM_ACCESS_PROFILE_NAME,
  createAccessProfile,
  getSystemAccessProfile,
  listAccessProfiles,
} from './accessProfileRepository'
import {
  ACCESS_PROFILES_STORAGE_KEY,
  readStoredAccessProfiles,
  writeStoredAccessProfiles,
} from './accessProfileStorage'
import {
  buildInitialAccessProfiles,
  ensureInitialAccessProfiles,
  initialAccessProfileDesigns,
  refreshInitialAccessProfiles,
} from './initialAccessProfiles'

/**
 * Testes da coleção inicial de Perfis de Acesso.
 *
 * O armazenamento é substituído por uma implementação em memória instalada em
 * `globalThis.window`, o mesmo lugar que os módulos consultam: nenhum
 * localStorage real é tocado.
 *
 * Os departamentos e as páginas vêm do catálogo real, apurados aqui de forma
 * independente do módulo: nenhuma contagem é escrita à mão.
 */

/* -------------------------------------------------------------------------- */
/* Armazenamento em memória                                                   */
/* -------------------------------------------------------------------------- */

class MemoryStorage {
  private entries = new Map<string, string>()
  private failWrites = false

  get length(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('Armazenamento cheio (simulado)')

    this.entries.set(key, value)
  }

  failAllWrites(): void {
    this.failWrites = true
  }
}

type GlobalWithWindow = { window?: { localStorage: unknown } }

function globalWithWindow(): GlobalWithWindow {
  return globalThis as unknown as GlobalWithWindow
}

let memory: MemoryStorage

beforeEach(() => {
  memory = new MemoryStorage()
  globalWithWindow().window = { localStorage: memory }
})

afterEach(() => {
  delete globalWithWindow().window
})

/* -------------------------------------------------------------------------- */
/* Dados reais do catálogo                                                    */
/* -------------------------------------------------------------------------- */

/** Páginas que um perfil comum deve conceder: publicadas, menos o Modelo. */
function expectedPageKeys(departmentId: string): string[] {
  return availableDepartmentPageKeys(departmentId).filter((pageKey) => pageKey !== MODEL_PAGE_KEY)
}

/** Catálogo inteiro do departamento, apurado direto de `departmentPages`. */
function catalogPageKeys(departmentId: string): string[] {
  return departmentPages[departmentId as keyof typeof departmentPages].map((page) => page.key)
}

/**
 * Concessões da assinatura ANTERIOR da coleção inicial, apuradas aqui de forma
 * independente do módulo: naquele momento Ordens de Serviço já publicava o
 * catálogo inteiro, e os outros dez departamentos publicavam somente a Visão
 * Geral. O Modelo continua fora, como sempre esteve.
 */
function previousPageKeys(departmentId: string): string[] {
  const published = departmentId === 'os' ? catalogPageKeys('os') : [OVERVIEW_PAGE_KEY]

  return published.filter((pageKey) => pageKey !== MODEL_PAGE_KEY)
}

/** O mesmo perfil inicial, com as concessões que ele tinha na versão anterior. */
function toPreviousSignature(profile: StandardAccessProfile): StandardAccessProfile {
  return {
    ...profile,
    departmentPageAccess: profile.departmentPageAccess.map((access) => ({
      departmentId: access.departmentId,
      pageKeys: previousPageKeys(access.departmentId),
    })),
  }
}

/** Coleção inicial inteira como a versão anterior a gravava. */
function previousInitialProfiles(): StandardAccessProfile[] {
  return buildInitialAccessProfiles().profiles.map(toPreviousSignature)
}

function profileByName(profiles: readonly StandardAccessProfile[], name: string) {
  const profile = profiles.find((item) => item.name === name)
  if (!profile) throw new Error(`Coleção inicial sem o perfil ${name}`)

  return profile
}

function grantedDepartmentIds(profile: StandardAccessProfile): string[] {
  return profile.departmentPageAccess.map((access) => access.departmentId)
}

/* -------------------------------------------------------------------------- */
/* 1. Desenho da coleção                                                      */
/* -------------------------------------------------------------------------- */

describe('desenho da coleção inicial', () => {
  it('tem Acesso Executivo, Operações Técnicas e um perfil por departamento', () => {
    const names = initialAccessProfileDesigns().map((design) => design.name)

    expect(names).toEqual([
      EXECUTIVE_ACCESS_PROFILE_NAME,
      TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
      ...biAreas.map((area) => area.label),
    ])
  })

  it('nomeia o perfil de um departamento apenas com o rótulo oficial dele', () => {
    const names = initialAccessProfileDesigns().map((design) => design.name)

    for (const area of biAreas) {
      expect(names).toContain(area.label)
      expect(names).not.toContain(`Acesso ${area.label}`)
    }
  })

  it('mantém Operações Técnicas com nome próprio, sem o prefixo antigo', () => {
    expect(TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME).toBe('Operações Técnicas')
  })

  it('usa os destinos aprovados', () => {
    const designs = initialAccessProfileDesigns()

    expect(designs[0].audience).toBe('executive')

    for (const design of designs.slice(1)) {
      expect(design.audience).toBe('analyst')
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 2. Montagem                                                                */
/* -------------------------------------------------------------------------- */

describe('montagem da coleção inicial', () => {
  it('monta todos os perfis do desenho com o catálogo atual', () => {
    const { profiles, rejected } = buildInitialAccessProfiles()

    expect(rejected).toEqual([])
    expect(profiles.map((profile) => profile.name)).toEqual(
      initialAccessProfileDesigns().map((design) => design.name),
    )
  })

  it('cria entidades comuns, ativas e nunca utilizadas', () => {
    for (const profile of buildInitialAccessProfiles().profiles) {
      expect(profile.kind).toBe('standard')
      expect(profile.lifecycle).toBe('active')
      expect(profile.hasBeenUsed).toBe(false)
    }
  })

  it('gera ids sequenciais no padrão acp-NNN, sem repetir', () => {
    const ids = buildInitialAccessProfiles().profiles.map((profile) => profile.id)

    expect(ids[0]).toBe('acp-001')
    expect(new Set(ids).size).toBe(ids.length)

    for (const id of ids) {
      expect(ACCESS_PROFILE_ID_PATTERN.test(id)).toBe(true)
      expect(id).not.toBe(SYSTEM_ACCESS_PROFILE_ID)
    }
  })

  it('não ocupa o nome nem o id do perfil do sistema', () => {
    const profiles = buildInitialAccessProfiles().profiles

    expect(profiles.map((profile) => profile.name)).not.toContain(SYSTEM_ACCESS_PROFILE_NAME)
  })

  it('concede a Acesso Executivo as páginas publicadas de todos os departamentos, sem o Modelo', () => {
    const executive = profileByName(
      buildInitialAccessProfiles().profiles,
      EXECUTIVE_ACCESS_PROFILE_NAME,
    )

    expect(grantedDepartmentIds(executive)).toEqual(biAreas.map((area) => area.id))

    for (const access of executive.departmentPageAccess) {
      expect(access.pageKeys).toEqual(expectedPageKeys(access.departmentId))
      expect(access.pageKeys).not.toContain(MODEL_PAGE_KEY)
    }
  })

  it('reúne em Operações Técnicas exatamente os cinco departamentos aprovados', () => {
    const technical = profileByName(
      buildInitialAccessProfiles().profiles,
      TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
    )

    expect(new Set(grantedDepartmentIds(technical))).toEqual(
      new Set(TECHNICAL_OPERATIONS_DEPARTMENT_IDS),
    )

    for (const access of technical.departmentPageAccess) {
      expect(access.pageKeys).toEqual(expectedPageKeys(access.departmentId))
    }
  })

  it('concede a cada perfil departamental somente o próprio departamento', () => {
    const profiles = buildInitialAccessProfiles().profiles

    for (const area of biAreas) {
      const profile = profileByName(profiles, area.label)

      expect(grantedDepartmentIds(profile)).toEqual([area.id])
      expect(profile.departmentPageAccess[0].pageKeys).toEqual(expectedPageKeys(area.id))
    }
  })

  it('monta os treze perfis aprovados', () => {
    expect(buildInitialAccessProfiles().profiles).toHaveLength(biAreas.length + 2)
    expect(biAreas.length + 2).toBe(13)
  })

  it('concede o catálogo inteiro de cada departamento incluído, menos o Modelo', () => {
    for (const profile of buildInitialAccessProfiles().profiles) {
      for (const access of profile.departmentPageAccess) {
        const catalog = catalogPageKeys(access.departmentId)

        expect(access.pageKeys).toEqual(catalog.filter((pageKey) => pageKey !== MODEL_PAGE_KEY))
        expect(access.pageKeys).toHaveLength(catalog.length - 1)
      }
    }
  })

  it('nunca concede a página Modelo, que continua exclusiva do Acesso do Sistema', () => {
    for (const profile of buildInitialAccessProfiles().profiles) {
      for (const access of profile.departmentPageAccess) {
        expect(access.pageKeys).not.toContain(MODEL_PAGE_KEY)
      }
    }

    for (const access of getSystemAccessProfile().departmentPageAccess) {
      expect(access.pageKeys).toContain(MODEL_PAGE_KEY)
      expect(access.pageKeys).toEqual(catalogPageKeys(access.departmentId))
    }
  })

  it('nunca concede página em desenvolvimento', () => {
    for (const profile of buildInitialAccessProfiles().profiles) {
      for (const access of profile.departmentPageAccess) {
        for (const pageKey of access.pageKeys) {
          const page = departmentPages[access.departmentId as keyof typeof departmentPages].find(
            (item) => item.key === pageKey,
          )

          expect(page?.disabled).toBe(false)
        }
      }
    }
  })

  it('não deixa nenhum perfil com pendência diante do catálogo atual', () => {
    for (const profile of buildInitialAccessProfiles().profiles) {
      const evaluation = evaluateAccessProfile(profile)

      expect(evaluation.issues).toEqual([])
      expect(evaluation.operationalStatus).toBe('active')
    }
  })

  it('não toca no armazenamento durante a montagem', () => {
    buildInitialAccessProfiles()

    expect(memory.length).toBe(0)
  })
})

/* -------------------------------------------------------------------------- */
/* 3. Página inicial                                                          */
/* -------------------------------------------------------------------------- */

describe('página de entrada de cada perfil', () => {
  it('é a primeira página concedida e disponível, na ordem oficial do catálogo', () => {
    for (const profile of buildInitialAccessProfiles().profiles) {
      const expected = evaluateAccessProfile(profile).effectiveHomePage

      expect(expected).not.toBeNull()
      // A avaliação do domínio percorre `biAreas` e `departmentPages` na ordem
      // oficial: se a montagem tivesse escolhido outra página, as duas
      // divergiriam.
      expect(profile.homePage).toEqual(expected)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* 4. Inicialização do armazenamento                                          */
/* -------------------------------------------------------------------------- */

describe('inicialização do armazenamento', () => {
  it('semeia a coleção quando a chave ainda não existe', () => {
    const result = ensureInitialAccessProfiles()

    expect(result.status).toBe('seeded')

    const stored = readStoredAccessProfiles()

    expect(stored.ok).toBe(true)
    if (!stored.ok) return

    expect(stored.profiles.map((profile) => profile.name)).toEqual(
      initialAccessProfileDesigns().map((design) => design.name),
    )
  })

  it('devolve os perfis na ordem aprovada, e a listagem preserva essa ordem', () => {
    ensureInitialAccessProfiles()

    const listed = listAccessProfiles()

    expect(listed.ok).toBe(true)
    expect(listed.profiles.map((profile) => profile.name)).toEqual([
      SYSTEM_ACCESS_PROFILE_NAME,
      EXECUTIVE_ACCESS_PROFILE_NAME,
      TECHNICAL_OPERATIONS_ACCESS_PROFILE_NAME,
      ...biAreas.map((area) => area.label),
    ])
  })

  it('é idempotente: a segunda chamada não grava nada de novo', () => {
    ensureInitialAccessProfiles()

    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    expect(ensureInitialAccessProfiles()).toEqual({ status: 'already-initialized' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
  })

  it('não semeia de novo uma coleção explicitamente vazia', () => {
    expect(writeStoredAccessProfiles([])).toBe(true)

    expect(ensureInitialAccessProfiles()).toEqual({ status: 'already-initialized' })

    const stored = readStoredAccessProfiles()

    expect(stored.ok).toBe(true)
    if (!stored.ok) return

    expect(stored.profiles).toEqual([])
  })

  it('não sobrescreve uma coleção versão 2 já existente', () => {
    ensureInitialAccessProfiles()

    const created = createAccessProfile({
      name: 'Perfil criado depois da coleção inicial',
      audience: 'analyst',
      departmentPageAccess: [
        { departmentId: biAreas[0].id, pageKeys: [availableDepartmentPageKeys(biAreas[0].id)[0]] },
      ],
      homePage: {
        departmentId: biAreas[0].id,
        pageKey: availableDepartmentPageKeys(biAreas[0].id)[0],
      },
    })

    expect(created.ok).toBe(true)
    expect(ensureInitialAccessProfiles()).toEqual({ status: 'already-initialized' })

    const stored = readStoredAccessProfiles()

    expect(stored.ok).toBe(true)
    if (!stored.ok) return

    // O perfil criado depois recebe o id seguinte ao último da coleção inicial.
    expect(stored.profiles.at(-1)?.name).toBe('Perfil criado depois da coleção inicial')
    expect(stored.profiles.at(-1)?.id).toBe(
      `acp-${String(buildInitialAccessProfiles().profiles.length + 1).padStart(3, '0')}`,
    )
  })

  it('não sobrescreve uma coleção antiga aguardando classificação', () => {
    // Formato anterior: os mesmos perfis, sem destino em nenhum deles.
    const legacy = buildInitialAccessProfiles().profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      kind: profile.kind,
      lifecycle: profile.lifecycle,
      departmentPageAccess: profile.departmentPageAccess,
      homePage: profile.homePage,
      hasBeenUsed: profile.hasBeenUsed,
    }))

    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, JSON.stringify(legacy))
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    expect(ensureInitialAccessProfiles()).toEqual({ status: 'already-initialized' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
    expect(readStoredAccessProfiles()).toEqual({
      ok: false,
      reason: 'audience-classification-required',
      profileCount: legacy.length,
    })
  })

  it('não sobrescreve conteúdo ilegível', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    expect(ensureInitialAccessProfiles()).toEqual({ status: 'already-initialized' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe('{ isto não é json')
  })

  it('responde armazenamento indisponível sem lançar', () => {
    delete globalWithWindow().window

    expect(ensureInitialAccessProfiles()).toEqual({ status: 'storage-unavailable' })
  })

  it('responde falha de escrita sem deixar a coleção pela metade', () => {
    memory.failAllWrites()

    const result = ensureInitialAccessProfiles()

    expect(result.status).toBe('write-failed')
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* 5. Atualização da coleção inicial já gravada                               */
/* -------------------------------------------------------------------------- */

describe('atualização dos Perfis de Acesso iniciais já gravados', () => {
  /** Grava uma coleção diretamente, sem passar pelas regras de escrita do domínio. */
  function seedStorage(profiles: readonly unknown[]): void {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, JSON.stringify(profiles))
  }

  function storedProfiles(): StandardAccessProfile[] {
    const stored = readStoredAccessProfiles()
    if (!stored.ok) throw new Error(`Leitura recusada: ${stored.reason}`)

    return stored.profiles
  }

  it('reconhece a assinatura anterior e passa a conceder todas as páginas do escopo', () => {
    seedStorage(previousInitialProfiles())

    const result = refreshInitialAccessProfiles()

    expect(result.status).toBe('updated')
    expect(storedProfiles()).toEqual(buildInitialAccessProfiles().profiles)
  })

  it('não reescreve o perfil cujas concessões já eram as de hoje', () => {
    seedStorage(previousInitialProfiles())

    const result = refreshInitialAccessProfiles()

    expect(result.status).toBe('updated')
    if (result.status !== 'updated') return

    // Ordens de Serviço já publicava o catálogo inteiro: o perfil exclusivo dela
    // não mudou de conteúdo e não entra na lista de atualizados.
    const ordersProfile = profileByName(buildInitialAccessProfiles().profiles, 'Ordens de Serviço')

    expect(result.updatedProfileIds).not.toContain(ordersProfile.id)
    expect(result.updatedProfileIds.length).toBeGreaterThan(0)
  })

  it('é idempotente: a segunda chamada não grava nada de novo', () => {
    seedStorage(previousInitialProfiles())

    expect(refreshInitialAccessProfiles().status).toBe('updated')

    const after = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    expect(refreshInitialAccessProfiles()).toEqual({ status: 'unchanged' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(after)
    expect(refreshInitialAccessProfiles()).toEqual({ status: 'unchanged' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(after)
  })

  it('não faz nada logo depois da semeadura, que já grava a coleção de hoje', () => {
    expect(ensureInitialAccessProfiles().status).toBe('seeded')

    const after = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    expect(refreshInitialAccessProfiles()).toEqual({ status: 'unchanged' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(after)
  })

  it('preserva o perfil inicial que foi modificado, e atualiza somente os intactos', () => {
    const previous = previousInitialProfiles()
    const modified: StandardAccessProfile = { ...previous[0], name: 'Acesso Executivo revisado' }

    seedStorage([modified, ...previous.slice(1)])

    const result = refreshInitialAccessProfiles()

    expect(result.status).toBe('updated')
    if (result.status !== 'updated') return

    expect(result.updatedProfileIds).not.toContain(modified.id)
    expect(storedProfiles()[0]).toEqual(modified)
  })

  it('preserva o perfil inicial que teve uma página retirada', () => {
    const previous = previousInitialProfiles()
    const [first, ...rest] = previous
    const trimmed: StandardAccessProfile = {
      ...first,
      departmentPageAccess: first.departmentPageAccess.slice(1),
    }

    seedStorage([trimmed, ...rest])

    const result = refreshInitialAccessProfiles()

    expect(result.status).toBe('updated')
    if (result.status !== 'updated') return

    expect(result.updatedProfileIds).not.toContain(trimmed.id)
    expect(storedProfiles()[0]).toEqual(trimmed)
  })

  it('preserva o perfil inicial que foi desativado ou já utilizado', () => {
    const previous = previousInitialProfiles()
    const inactive: StandardAccessProfile = { ...previous[0], lifecycle: 'inactive' }
    const used: StandardAccessProfile = { ...previous[1], hasBeenUsed: true }

    seedStorage([inactive, used, ...previous.slice(2)])

    const result = refreshInitialAccessProfiles()

    expect(result.status).toBe('updated')
    if (result.status !== 'updated') return

    expect(result.updatedProfileIds).not.toContain(inactive.id)
    expect(result.updatedProfileIds).not.toContain(used.id)
    expect(storedProfiles().slice(0, 2)).toEqual([inactive, used])
  })

  it('preserva perfil personalizado e não reordena a coleção', () => {
    const previous = previousInitialProfiles()
    const custom: StandardAccessProfile = {
      id: `acp-${String(previous.length + 1).padStart(3, '0')}`,
      name: 'Perfil personalizado do Administrador',
      description: 'Criado à mão depois da coleção inicial.',
      kind: 'standard',
      audience: 'analyst',
      lifecycle: 'active',
      departmentPageAccess: [
        { departmentId: biAreas[0].id, pageKeys: [availableDepartmentPageKeys(biAreas[0].id)[0]] },
      ],
      homePage: {
        departmentId: biAreas[0].id,
        pageKey: availableDepartmentPageKeys(biAreas[0].id)[0],
      },
      hasBeenUsed: false,
    }

    seedStorage([...previous, custom])

    expect(refreshInitialAccessProfiles().status).toBe('updated')

    const stored = storedProfiles()

    expect(stored).toHaveLength(previous.length + 1)
    expect(stored.map((profile) => profile.id)).toEqual([
      ...previous.map((profile) => profile.id),
      custom.id,
    ])
    expect(stored.at(-1)).toEqual(custom)
  })

  it('não reconhece um perfil desconhecido que ocupe um id inicial', () => {
    const previous = previousInitialProfiles()
    const impostor: StandardAccessProfile = {
      ...previous[0],
      name: 'Perfil de outra origem',
      description: undefined,
      audience: 'analyst',
    }

    seedStorage([impostor])

    expect(refreshInitialAccessProfiles()).toEqual({ status: 'unchanged' })
    expect(storedProfiles()).toEqual([impostor])
  })

  it('preserva a coleção explicitamente vazia', () => {
    seedStorage([])

    expect(refreshInitialAccessProfiles()).toEqual({ status: 'unchanged' })
    expect(storedProfiles()).toEqual([])
  })

  it('não cria coleção nenhuma quando a chave ainda não existe', () => {
    expect(refreshInitialAccessProfiles()).toEqual({ status: 'unchanged' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBeNull()
  })

  it('não toca em conteúdo ilegível', () => {
    memory.setItem(ACCESS_PROFILES_STORAGE_KEY, '{ isto não é json')

    expect(refreshInitialAccessProfiles()).toEqual({ status: 'storage-failure' })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe('{ isto não é json')
  })

  it('não toca na coleção do formato anterior, ainda sem destino', () => {
    const legacy = previousInitialProfiles().map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      kind: profile.kind,
      lifecycle: profile.lifecycle,
      departmentPageAccess: profile.departmentPageAccess,
      homePage: profile.homePage,
      hasBeenUsed: profile.hasBeenUsed,
    }))

    seedStorage(legacy)
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)

    expect(refreshInitialAccessProfiles()).toEqual({
      status: 'audience-classification-required',
    })
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
  })

  it('responde falha de armazenamento sem lançar', () => {
    delete globalWithWindow().window

    expect(refreshInitialAccessProfiles()).toEqual({ status: 'storage-failure' })
  })

  it('não deixa a coleção pela metade quando a gravação falha', () => {
    const previous = previousInitialProfiles()

    seedStorage(previous)
    const before = memory.getItem(ACCESS_PROFILES_STORAGE_KEY)
    memory.failAllWrites()

    expect(refreshInitialAccessProfiles().status).toBe('write-failed')
    expect(memory.getItem(ACCESS_PROFILES_STORAGE_KEY)).toBe(before)
  })

  it('deixa os perfis atualizados sem pendência diante do catálogo atual', () => {
    seedStorage(previousInitialProfiles())
    refreshInitialAccessProfiles()

    for (const profile of storedProfiles()) {
      const evaluation = evaluateAccessProfile(profile)

      expect(evaluation.issues).toEqual([])
      expect(evaluation.operationalStatus).toBe('active')
    }
  })
})
