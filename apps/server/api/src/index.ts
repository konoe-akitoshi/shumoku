/**
 * Shumoku Real-time Server
 * Entry point
 */

import { loadConfig } from './config.js'
import { validateDevApiAuthConfiguration } from './middleware/auth.js'
import { Server } from './server.js'

// Last-resort handlers: log context, then let systemd (or the operator)
// restart us. Continuing on an unknown-state error is worse than dying.
process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled promise rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err)
  process.exit(1)
})

async function main() {
  console.log('Starting Shumoku Server...')

  validateDevApiAuthConfiguration()

  // Load configuration
  const config = loadConfig()

  // Create and start server
  const server = new Server(config)
  await server.start()

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    server.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\nShutting down...')
    server.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
