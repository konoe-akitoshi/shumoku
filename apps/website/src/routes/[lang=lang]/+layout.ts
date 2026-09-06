import type { Locale } from '$lib/site'
import type { LayoutLoad } from './$types'

export const load: LayoutLoad = ({ params }) => ({ lang: params.lang as Locale })
