import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  getAccessStatus: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }))
vi.mock('@/lib/env', () => ({ env: { supabase: { url: 'https://example.test', anonKey: 'test-key' } } }))
vi.mock('@/lib/access', () => ({ getAccessStatus: mocks.getAccessStatus }))

import { middleware } from '../middleware'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data: { user: { email: 'allowed@example.test' } }, error: null })
  mocks.getAccessStatus.mockResolvedValue('authorized')
})

afterEach(() => { vi.useRealTimers() })

const request = (path: string) => new NextRequest(`https://baseball.example${path}`)

describe('route protection during a connection failure', () => {
  it.each(['/login', '/login?error=service_unavailable', '/auth/callback?code=test', '/write/test-code'])(
    'keeps the public page %s reachable without waiting for Supabase', async path => {
      const response = await middleware(request(path))
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(mocks.createServerClient).not.toHaveBeenCalled()
    },
  )

  it('requires authentication for a route that only starts with the public prefix', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const response = await middleware(request('/write-private'))
    expect(response.headers.get('location')).toBe('https://baseball.example/login')
  })

  it('allows an authenticated and authorized request', async () => {
    const response = await middleware(request('/games'))
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(mocks.getAccessStatus).toHaveBeenCalledWith(expect.anything(), 'allowed@example.test')
  })

  it('rejects an authenticated account without access', async () => {
    mocks.getAccessStatus.mockResolvedValue('unauthorized')
    const response = await middleware(request('/games'))
    expect(response.headers.get('location')).toBe('https://baseball.example/login?error=unauthorized')
  })

  it('offers a retry instead of reporting access denied when the access lookup fails', async () => {
    mocks.getAccessStatus.mockResolvedValue('unavailable')
    const response = await middleware(request('/games'))
    expect(response.headers.get('location')).toBe('https://baseball.example/login?error=service_unavailable')
    expect(response.headers.get('x-middleware-next')).toBeNull()
  })

  it('treats a missing session as signed out', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError' } })
    const response = await middleware(request('/games'))
    expect(response.headers.get('location')).toBe('https://baseball.example/login')
    expect(mocks.getAccessStatus).not.toHaveBeenCalled()
  })

  it('never grants access when authentication throws', async () => {
    mocks.getUser.mockRejectedValue(new Error('Network unavailable'))
    const response = await middleware(request('/games'))
    expect(response.headers.get('location')).toBe('https://baseball.example/login?error=service_unavailable')
  })

  it('offers a retry for a temporary auth error without treating the user as signed out', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthRetryableFetchError' } })
    const response = await middleware(request('/games'))
    expect(response.headers.get('location')).toBe('https://baseball.example/login?error=service_unavailable')
    expect(mocks.getAccessStatus).not.toHaveBeenCalled()
  })

  it('aborts a stalled request after eight seconds and shows a reachable retry page', async () => {
    vi.useFakeTimers()
    mocks.getUser.mockImplementation(() => new Promise(() => {}))
    const responsePromise = middleware(request('/games'))
    await vi.advanceTimersByTimeAsync(8000)
    const response = await responsePromise
    expect(response.headers.get('location')).toBe('https://baseball.example/login?error=service_unavailable')
    expect(mocks.getAccessStatus).not.toHaveBeenCalled()

    const fetchMock = vi.fn().mockResolvedValue(new Response())
    vi.stubGlobal('fetch', fetchMock)
    try {
      const options = mocks.createServerClient.mock.calls[0][2]
      await options.global.fetch('https://example.test')
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('preserves refreshed cookies in redirects', async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: { getUser: async () => {
        options.cookies.setAll([{ name: 'session-test', value: 'refreshed', options: { httpOnly: true } }])
        return { data: { user: null }, error: null }
      } },
    }))
    const response = await middleware(request('/games'))
    expect(response.cookies.get('session-test')?.value).toBe('refreshed')
  })

  it('uses the same deadline when authentication succeeds but the account lookup stalls', async () => {
    vi.useFakeTimers()
    mocks.getAccessStatus.mockImplementation(() => new Promise(() => {}))
    const responsePromise = middleware(request('/games'))
    await vi.advanceTimersByTimeAsync(8000)
    const response = await responsePromise
    expect(response.headers.get('location')).toBe('https://baseball.example/login?error=service_unavailable')
  })
})
