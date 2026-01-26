/**
 * Shumoku Real-time Server
 * Entry point
 */

import { loadConfig } from './config.js'
import { Server } from './server.js'

async function main() {
  console.log('Starting Shumoku Server...')

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
