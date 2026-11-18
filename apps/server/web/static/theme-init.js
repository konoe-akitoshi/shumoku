// Apply the theme before first paint, by the rules of `src/lib/stores/preferences.svelte.ts`: a
// shared page's link (`?theme=light|dark`), else the viewer's choice, else the system's. Loaded
// as a file, not inline, so the Server's `script-src 'self'` CSP header allows it.
;(() => {
  try {
    const url = new URL(window.location.href)
    const linked = url.pathname.startsWith('/share/') ? url.searchParams.get('theme') : null
    const chosen = JSON.parse(localStorage.getItem('shumoku-preferences') || '{}').theme
    const theme = linked === 'light' || linked === 'dark' ? linked : chosen || 'system'
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
  } catch {}
})()
