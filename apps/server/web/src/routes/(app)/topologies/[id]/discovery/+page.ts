// "Discovery" was absorbed into the Composition zone (it was never just
// discovery scheduling — it's the curation surface over the resolved graph).
// Redirect any old/deep link to the Composition route.
import { redirect } from '@sveltejs/kit'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params }) => {
  throw redirect(308, `/topologies/${params.id}/composition`)
}
