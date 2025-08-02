import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * MSW server setup for Node.js environments (tests)
 * This configures MSW to intercept requests during tests
 */

// Create the server instance with our request handlers
export const server = setupServer(...handlers)

// Server configuration options
server.events.on('request:start', ({ request }) => {
  if (process.env.DEBUG_MSW === 'true') {
    console.log('MSW intercepted:', request.method, request.url)
  }
})

server.events.on('response:mocked', ({ request, response }) => {
  if (process.env.DEBUG_MSW === 'true') {
    console.log(
      'MSW mocked response:',
      request.method,
      request.url,
      'with status',
      response.status
    )
  }
})

// Handle unhandled requests
server.events.on('request:unhandled', ({ request }) => {
  console.warn(
    'Found an unhandled %s request to %s',
    request.method,
    request.url
  )
})