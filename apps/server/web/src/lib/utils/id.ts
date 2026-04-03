/**
 * ID Generation Utilities
 */

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generate a random ID
 */
export function nanoid(size = 12): string {
  let id = ''
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  for (let i = 0; i < size; i++) {
    // @ts-expect-error safe index access
    id += alphabet[bytes[i] % alphabet.length]
  }
  return id
}
