import { describe, expect, it } from 'vitest'

import { biAreas } from '../../config/biAreas'
import { departmentPages } from '../../config/departmentPages'
import {
  buildAccessProfileEvent,
  buildProfileCreationDetails,
  buildProfileDeletionDetails,
  buildProfileUpdateDetails,
  describeAccessProfileTransition,
  normalizeActor,
  type HistoryProfileSnapshot,
} from './accessProfileHistory'

/**
 * Vocabulário do Histórico dos Perfis de Acesso.
 *
 * Funções puras: os textos precisam ser verificáveis sem navegador, porque são
 * o que o Administrador lê depois para entender o que aconteceu.
 */

const [firstArea, secondArea] = biAreas
const firstPages = departmentPages[firstArea.id].map((page) => page.key)

function snapshot(overrides: Partial<HistoryProfileSnapshot> = {}): HistoryProfileSnapshot {
  return {
    name: 'Perfil de teste',
    departmentPageAccess: [{ departmentId: firstArea.id, pageKeys: firstPages.slice(0, 2) }],
    ...overrides,
  }
}

describe('responsável', () => {
  it('exige id e nome preenchidos', () => {
    expect(normalizeActor({ id: ' u1 ', name: ' Ana ' })).toEqual({ id: 'u1', name: 'Ana' })
    expect(normalizeActor({ id: '', name: 'Ana' })).toBeNull()
    expect(normalizeActor({ id: 'u1', name: '  ' })).toBeNull()
    expect(normalizeActor(null)).toBeNull()
  })
})

describe('evento', () => {
  it('copia nome do perfil e do responsável no momento do evento', () => {
    const event = buildAccessProfileEvent(
      'access-profile-created',
      '2026-09-23T10:00:00.000Z',
      { id: 'acesso-1', name: 'Perfil de teste' },
      { id: 'u1', name: 'Ana' },
      ['Cobertura inicial: Comercial (2 páginas)'],
    )

    expect(event).toMatchObject({
      targetType: 'access-profile',
      action: 'access-profile-created',
      occurredAt: '2026-09-23T10:00:00.000Z',
      targetAccessProfileId: 'acesso-1',
      targetAccessProfileName: 'Perfil de teste',
      actorUserId: 'u1',
      actorName: 'Ana',
      details: ['Cobertura inicial: Comercial (2 páginas)'],
    })
    expect(event.id).toContain('acesso-1')
  })
})

describe('detalhes', () => {
  it('descreve a criação com cobertura e quem entrou, sem linha de destino', () => {
    const details = buildProfileCreationDetails(snapshot(), [
      { userName: 'Bia', fromProfileName: null },
      { userName: 'Caio', fromProfileName: 'Outro perfil' },
    ])

    // `Destino: ...` abria esta lista e saiu junto com o destino do perfil.
    expect(details[0]).toBe(`Cobertura inicial: ${firstArea.label} (2 páginas)`)
    expect(details[1]).toBe('Perfil de Acesso de Bia: Sem perfil definido → Perfil de teste')
    expect(details[2]).toBe('Perfil de Acesso de Caio: Outro perfil → Perfil de teste')
    expect(details.some((linha) => linha.startsWith('Destino:'))).toBe(false)
  })

  it('registra a criação sem ninguém dentro', () => {
    expect(buildProfileCreationDetails(snapshot(), [])).toContain(
      'Nenhum usuário vinculado na criação',
    )
  })

  it('descreve só o que mudou na edição', () => {
    const previous = snapshot()
    const updated = snapshot({
      name: 'Perfil renomeado',
      description: 'Leitura',
      departmentPageAccess: [
        { departmentId: firstArea.id, pageKeys: firstPages.slice(0, 1) },
        { departmentId: secondArea.id, pageKeys: [] },
      ],
    })

    const details = buildProfileUpdateDetails(previous, updated, [])

    expect(details).toContain('Nome alterado: Perfil de teste → Perfil renomeado')
    expect(details).toContain('Descrição definida: Leitura')
    expect(details).toContain(`Departamento adicionado: ${secondArea.label}`)
    expect(details.some((line) => line.startsWith(`Página removida de ${firstArea.label}`))).toBe(
      true,
    )
  })

  it('devolve lista vazia quando a edição não alterou nada', () => {
    expect(buildProfileUpdateDetails(snapshot(), snapshot(), [])).toEqual([])
  })

  it('descreve a exclusão do perfil vazio', () => {
    expect(buildProfileDeletionDetails({ name: 'Perfil de teste' })).toEqual([
      'Perfil excluído: Perfil de teste',
      'Nenhum usuário estava vinculado a este perfil',
    ])
  })

  it('escreve a transição sempre como origem e destino', () => {
    expect(describeAccessProfileTransition('Bia', null, 'Novo')).toBe(
      'Perfil de Acesso de Bia: Sem perfil definido → Novo',
    )
    expect(describeAccessProfileTransition('Bia', 'Antigo', 'Novo')).toBe(
      'Perfil de Acesso de Bia: Antigo → Novo',
    )
  })
})
