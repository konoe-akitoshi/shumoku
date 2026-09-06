import { docsOrigin, editorOrigin, websiteOrigin } from '$lib/site'
export const prerender = true
export const GET = () =>
  new Response(
    `# Shumoku\n\nNetwork diagrams from YAML and infrastructure data.\n\n- [Website](${websiteOrigin}/en)\n- [Playground](${websiteOrigin}/en/playground)\n- [Documentation](${docsOrigin}/en)\n- [Documentation index](${docsOrigin}/llms.txt)\n- [Editor](${editorOrigin})\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  )
