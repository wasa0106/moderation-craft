import { vi } from 'vitest'

export function mockFetch(url: string, response: any, options: { status?: number; ok?: boolean } = {}) {
  const { status = 200, ok = status >= 200 && status < 300 } = options
  
  ;(global.fetch as any).mockImplementationOnce(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: {
        get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
    })
  )
}

export function mockFetchError(error: Error) {
  ;(global.fetch as any).mockImplementationOnce(() => Promise.reject(error))
}

export function setupDefaultMocks() {
  // Health check
  ;(global.fetch as any).mockImplementation((url: string, options?: any) => {
    const urlPath = url.replace(/^https?:\/\/[^\/]+/, '')
    
    if (urlPath === '/api/health') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'ok',
          timestamp: new Date().toISOString(),
        }),
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
        },
      })
    }
    
    // Default 404 response
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
      headers: {
        get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
    })
  })
}