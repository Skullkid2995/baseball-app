import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccessStatus, isAuthorizedEmail } from './access'

function clientWithResult(data: { active: boolean } | null, error: { message: string } | null = null) {
  const query = {
    select() { return this },
    ilike: vi.fn(function () { return query }),
    maybeSingle() { return Promise.resolve({ data, error }) },
  }
  return { from: vi.fn(() => query) } as unknown as SupabaseClient
}

describe('account access lookup', () => {
  it('does not query the database for a missing email', async () => {
    const client = clientWithResult(null)
    expect(await getAccessStatus(client, undefined)).toBe('unauthorized')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('allows active accounts and rejects inactive or missing accounts', async () => {
    expect(await getAccessStatus(clientWithResult({ active: true }), 'member@example.test')).toBe('authorized')
    expect(await getAccessStatus(clientWithResult({ active: false }), 'member@example.test')).toBe('unauthorized')
    expect(await getAccessStatus(clientWithResult(null), 'member@example.test')).toBe('unauthorized')
  })

  it('matches email addresses literally instead of treating underscores as wildcards', async () => {
    const client = clientWithResult({ active: true })
    await getAccessStatus(client, 'score_keeper%test@example.test')
    const query = vi.mocked(client.from).mock.results[0].value
    expect(query.ilike).toHaveBeenCalledWith('email', 'score\\_keeper\\%test@example.test')
  })

  it('distinguishes service failures while the boolean API still fails closed', async () => {
    const logging = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const client = clientWithResult(null, { message: 'Connection interrupted' })
      expect(await getAccessStatus(client, 'member@example.test')).toBe('unavailable')
      expect(await isAuthorizedEmail(client, 'member@example.test')).toBe(false)
    } finally {
      logging.mockRestore()
    }
  })
})
