import { describe, expect, it } from 'vitest'
import { normalizeAuthToken, withBearerAuth } from '../authToken'

describe('authToken helpers', () => {
  it('drops cookie placeholder tokens', () => {
    expect(normalizeAuthToken('cookie')).toBeNull()
    expect(normalizeAuthToken(' cookie ')).toBeNull()
  })

  it('drops empty-like tokens', () => {
    expect(normalizeAuthToken('')).toBeNull()
    expect(normalizeAuthToken('   ')).toBeNull()
    expect(normalizeAuthToken('null')).toBeNull()
    expect(normalizeAuthToken('undefined')).toBeNull()
  })

  it('keeps real bearer tokens', () => {
    expect(normalizeAuthToken('abc.def')).toBe('abc.def')
  })

  it('only appends authorization for real tokens', () => {
    expect(withBearerAuth({'Content-Type': 'application/json'}, 'cookie')).toEqual({
      'Content-Type': 'application/json',
    })
    expect(withBearerAuth({'Content-Type': 'application/json'}, 'real-token')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer real-token',
    })
  })
})
