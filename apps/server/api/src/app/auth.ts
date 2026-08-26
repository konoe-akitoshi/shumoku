import {
  checkRateLimit,
  clearAttempts,
  createSession,
  deleteAllSessions,
  deleteSession,
  getSessionPrincipal,
  isSetupComplete,
  recordFailedAttempt,
  setInitialPassword,
  setPassword,
  verifyPassword,
} from '../services/auth.js'
import type { AuthApplicationService } from './services.js'

export function createAuthApplicationService(): AuthApplicationService {
  return {
    isSetupComplete,
    getSessionPrincipal,
    setPassword,
    setInitialPassword,
    verifyPassword,
    createSession,
    deleteSession,
    deleteAllSessions,
    checkRateLimit,
    recordFailedAttempt,
    clearAttempts,
  }
}
