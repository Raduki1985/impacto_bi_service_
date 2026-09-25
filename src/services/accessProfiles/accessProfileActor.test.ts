import { describe, expect, it } from 'vitest'

import { normalizeActor } from './accessProfileActor'

describe('responsável', () => {
  it('exige id e nome preenchidos', () => {
    expect(normalizeActor({ id: ' u1 ', name: ' Ana ' })).toEqual({ id: 'u1', name: 'Ana' })
    expect(normalizeActor({ id: '', name: 'Ana' })).toBeNull()
    expect(normalizeActor({ id: 'u1', name: '  ' })).toBeNull()
    expect(normalizeActor(null)).toBeNull()
  })
})
