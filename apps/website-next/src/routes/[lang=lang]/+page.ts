import type { PageLoad } from './$types'
export const prerender = true
export const entries = () => [{ lang: 'en' }, { lang: 'ja' }]
export const load: PageLoad = ({ params }) => ({ lang: params.lang as 'en' | 'ja' })
