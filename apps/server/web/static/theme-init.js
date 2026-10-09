// Apply the saved theme before first paint. Loaded as a file, not inline, so
// the Server's `script-src 'self'` CSP header allows it.
;(() => {
  try {
    const theme = JSON.parse(localStorage.getItem('shumoku-settings') || '{}').theme || 'system'
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    if (dark) document.documentElement.classList.add('dark')
  } catch {}
})()
