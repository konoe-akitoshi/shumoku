interface ClipboardEnvironment {
  writeText?: (text: string) => Promise<void>
  fallback: (text: string) => boolean
}

function fallbackCopyText(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

function browserClipboardEnvironment(): ClipboardEnvironment {
  const writeText =
    typeof navigator !== 'undefined' && navigator.clipboard?.writeText
      ? (text: string) => navigator.clipboard.writeText(text)
      : undefined

  return { writeText, fallback: fallbackCopyText }
}

/**
 * Copy text using the modern Async Clipboard API when available. Browsers only
 * expose that API in a secure context and may still reject it based on
 * permissions, so retain a user-gesture-compatible fallback for HTTP/LAN and
 * embedded deployments.
 */
export async function copyTextToClipboard(
  text: string,
  environment: ClipboardEnvironment = browserClipboardEnvironment(),
): Promise<void> {
  if (environment.writeText) {
    try {
      await environment.writeText(text)
      return
    } catch {
      // Permission and secure-context failures can still use the fallback.
    }
  }

  if (environment.fallback(text)) return
  throw new Error('Clipboard access is unavailable')
}
