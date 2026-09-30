import { describe, expect, it } from 'vitest'

import type { CoreUser, CoreUserStatus } from '../types/coreApi'
import { firstAccessInviteState, formatInviteDeadline, hasDefinedPassword } from './firstAccessInvite'

/**
 * Regra que decide quando o reenvio do convite de primeiro acesso fica
 * disponível na tabela de Usuários.
 *
 * Duas perguntas diferentes moram aqui, e a fonte de cada uma mudou:
 *
 * - QUEM tem primeiro acesso a resolver? A situação `pending`, e só ela. Era uma
 *   inferência sobre a validade do convite, porque `pending` não existia e
 *   `inactive` acumulava "nunca definiu senha" e "foi desativado".
 * - QUANDO o reenvio libera? A validade, comparada com o relógio. O valor a
 *   proteger é o link que já está na caixa de entrada de alguém: cada reenvio
 *   gera um token novo e mata o anterior.
 *
 * O `pending` do estado do CONVITE não é o status `pending` da pessoa: ele fala
 * do link, e quer dizer "ainda no prazo".
 *
 * As duas funções leem a LINHA DO SERVIÇO (`CoreUser`), e não o `User` do
 * domínio: a tabela de Usuários lista `users` sem traduzir, e a validade do
 * convite é a coluna `set_password_expire`.
 */

const AGORA = new Date('2026-09-24T12:00:00Z')

function user(overrides: Partial<CoreUser> = {}): CoreUser {
  return {
    id: 'u-1',
    name: 'Pessoa de Teste',
    email: 'pessoa@impactotelecom.com',
    status: 'pending',
    is_active: false,
    last_access: null,
    profile_system_id: 'pt-analyst',
    access_profile_id: 'ac-1',
    profile_type: { id: 'pt-analyst', code: 'analyst', name: 'Analista' },
    access: { id: 'ac-1', name: 'Operação' },
    set_password_expire: null,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  }
}

describe('quem não está pendente', () => {
  it('não tem primeiro acesso a reenviar, estando ativo', () => {
    expect(firstAccessInviteState(user({ status: 'active' }), AGORA)).toBe('not-applicable')
  })

  it('não tem primeiro acesso a reenviar, estando inativo', () => {
    // Inativo é quem um Administrador desativou, e desativar só alcança conta com
    // senha. O caminho dele é a reativação, e o serviço recusa o reenvio com 400.
    expect(firstAccessInviteState(user({ status: 'inactive' }), AGORA)).toBe('not-applicable')
  })

  it.each([
    ['active' as CoreUserStatus],
    ['inactive' as CoreUserStatus],
  ])('continua sem, %s, mesmo que uma validade tenha sobrado no cadastro', (situacao) => {
    // Uma validade em conta com senha não é hipótese: era o que sobrava quando o
    // convite era reenviado a quem já tinha senha, e era exatamente o caso em que
    // a inferência antiga errava, tratando a conta como se não tivesse senha.
    const comSobra = user({ status: situacao, set_password_expire: '2026-09-24T12:10:00Z' })

    expect(firstAccessInviteState(comSobra, AGORA)).toBe('not-applicable')
    expect(hasDefinedPassword(comSobra)).toBe(true)
  })
})

describe('convite de quem ainda não definiu a senha', () => {
  it('fica pendente enquanto o link está no prazo', () => {
    const convidado = user({ set_password_expire: '2026-09-24T12:10:00Z' })

    expect(firstAccessInviteState(convidado, AGORA)).toBe('pending')
  })

  it('vence no instante exato do prazo, e não um minuto depois', () => {
    const convidado = user({ set_password_expire: '2026-09-24T12:00:00Z' })

    expect(firstAccessInviteState(convidado, AGORA)).toBe('expired')
  })

  it('libera o reenvio depois do prazo', () => {
    const convidado = user({ set_password_expire: '2026-09-24T11:50:00Z' })

    expect(firstAccessInviteState(convidado, AGORA)).toBe('expired')
  })
})

describe('validade ausente ou ilegível', () => {
  // Sem data não há link vivo a proteger. Travar o botão nesses casos deixaria
  // a pessoa pendente sem nenhum caminho para entrar no portal.
  it.each([
    ['nula', null],
    // `undefined` não cabe no contrato (`string | null`), e a guarda existe para o
    // JSON que chega sem a chave: o `as` documenta que este caso é justamente o
    // que o tipo não descreve.
    ['ausente', undefined as unknown as null],
    ['em branco', '   '],
    ['ilegível', 'quinta que vem'],
  ])('trata validade %s como vencida', (_caso, valor) => {
    expect(firstAccessInviteState(user({ set_password_expire: valor }), AGORA)).toBe('expired')
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

describe('quem já definiu a senha', () => {
  it('é quem está ativo', () => {
    expect(hasDefinedPassword(user({ status: 'active' }))).toBe(true)
  })

  it('é também o inativo, que só se alcança tendo senha', () => {
    expect(hasDefinedPassword(user({ status: 'inactive' }))).toBe(true)
  })

  it('não é o pendente, com convite no prazo', () => {
    const convidado = user({ set_password_expire: '2026-09-24T12:10:00Z' })

    expect(hasDefinedPassword(convidado)).toBe(false)
  })

  it('não é o pendente de convite vencido: o prazo passou, a senha continua sem existir', () => {
    // É a diferença entre as duas funções: aqui o convite vencido e a ausência de
    // convite dizem a mesma coisa, e em `firstAccessInviteState` os dois se
    // juntam sob `expired` porque nos dois o reenvio é o caminho.
    const vencido = user({ set_password_expire: '2026-09-24T11:50:00Z' })

    expect(firstAccessInviteState(vencido, AGORA)).toBe('expired')
    expect(hasDefinedPassword(vencido)).toBe(false)
  })
})
