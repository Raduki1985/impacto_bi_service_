import { describe, expect, it } from 'vitest'

import type { User } from '../data/dashboardTypes'
import { firstAccessInviteState, formatInviteDeadline } from './firstAccessInvite'

/**
 * Regra que decide quando o reenvio do convite de primeiro acesso fica
 * disponível na tabela de Usuários.
 *
 * O valor a proteger é o link que já está na caixa de entrada de alguém: cada
 * reenvio gera um token novo e mata o anterior. Por isso `pending` existe, e por
 * isso ele é o estado que desabilita o botão.
 */

const AGORA = new Date('2026-09-24T12:00:00Z')

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    name: 'Pessoa de Teste',
    email: 'pessoa@impactotelecom.com',
    profile: 'Analista',
    permissions: '',
    permissionKeys: [],
    departments: [],
    departmentPageAccess: [],
    status: 'Inativo',
    lastAccess: 'Nunca acessou',
    firstAccessExpiresAt: null,
    initials: 'PT',
    ...overrides,
  }
}

describe('quem já entra no portal', () => {
  it('não tem primeiro acesso a reenviar', () => {
    expect(firstAccessInviteState(user({ status: 'Ativo' }), AGORA)).toBe('not-applicable')
  })

  it('continua sem, mesmo que uma validade tenha sobrado no cadastro', () => {
    // O serviço limpa a validade ao definir a senha, então isto não deveria
    // acontecer. Se acontecer, quem já é Ativo não volta a receber convite.
    const ativo = user({ status: 'Ativo', firstAccessExpiresAt: '2026-09-24T12:10:00Z' })

    expect(firstAccessInviteState(ativo, AGORA)).toBe('not-applicable')
  })
})

describe('convite de quem ainda não definiu a senha', () => {
  it('fica pendente enquanto o link está no prazo', () => {
    const convidado = user({ firstAccessExpiresAt: '2026-09-24T12:10:00Z' })

    expect(firstAccessInviteState(convidado, AGORA)).toBe('pending')
  })

  it('vence no instante exato do prazo, e não um minuto depois', () => {
    const convidado = user({ firstAccessExpiresAt: '2026-09-24T12:00:00Z' })

    expect(firstAccessInviteState(convidado, AGORA)).toBe('expired')
  })

  it('libera o reenvio depois do prazo', () => {
    const convidado = user({ firstAccessExpiresAt: '2026-09-24T11:50:00Z' })

    expect(firstAccessInviteState(convidado, AGORA)).toBe('expired')
  })
})

describe('validade ausente ou ilegível', () => {
  // Sem data não há link vivo a proteger. Travar o botão nesses casos deixaria
  // a pessoa inativa sem nenhum caminho para entrar no portal.
  it.each([
    ['nula', null],
    ['ausente', undefined],
    ['em branco', '   '],
    ['ilegível', 'quinta que vem'],
  ])('trata validade %s como vencida', (_caso, valor) => {
    expect(firstAccessInviteState(user({ firstAccessExpiresAt: valor }), AGORA)).toBe('expired')
  })
})

describe('prazo mostrado no texto do botão', () => {
  it('devolve a hora local em HH:mm', () => {
    const local = new Date('2026-09-24T12:10:00Z')
    const esperado = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`

    expect(formatInviteDeadline('2026-09-24T12:10:00Z')).toBe(esperado)
  })

  it('devolve null quando não há prazo a mostrar', () => {
    expect(formatInviteDeadline(null)).toBeNull()
    expect(formatInviteDeadline(undefined)).toBeNull()
    expect(formatInviteDeadline('  ')).toBeNull()
    expect(formatInviteDeadline('quinta que vem')).toBeNull()
  })
})
