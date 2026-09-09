export function fieldDescription(
  id: string,
  hint?: string,
  error?: string,
  external?: string | null,
) {
  return (
    [external, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  )
}
