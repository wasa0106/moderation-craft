import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * MSW browser worker setup
 * This configures MSW to intercept requests in the browser
 */

// Create the worker instance with our request handlers
export const worker = setupWorker(...handlers)

// Optionally configure the worker
worker.events.on('request:start', ({ request }) => {
  console.log('MSW intercepted:', request.method, request.url)
})

worker.events.on('response:mocked', ({ request, response }) => {
  console.log('MSW mocked response:', request.method, request.url, 'with status', response.status)
})
