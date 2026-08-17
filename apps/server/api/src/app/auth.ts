import {
  checkRateLimit,
  clearAttempts,
  createSession,
  deleteSession,
  isSetupComplete,
  recordFailedAttempt,
  setPassword,
  validateSession,
  verifyPassword,
} from '../services/auth.js'
import type { AuthApplicationService } from './services.js'

export function createAuthApplicationService(): AuthApplicationService {
  return {
    isSetupComplete,
    validateSession,
    setPassword,
    verifyPassword,
    createSession,
    deleteSession,
    checkRateLimit,
    recordFailedAttempt,
    clearAttempts,
  }
}
