# Website and docs deployment boundary

The two applications are separate deployable units. Do not configure a deployment
from the repository root.

| Unit | Root directory | Build command | Output | Purpose |
| --- | --- | --- | --- | --- |
| Website | `apps/website` | `bun run build` | `.next` | Existing Next.js homepage, Fumadocs pages, Playground, and Editor routes |
| Docs | `apps/docs` | `bun run build` | `dist` | Fully static Astro documentation and Pagefind index |

Install dependencies from the repository root with `bun install --frozen-lockfile`
before either build. Give each deployment its own cache and environment-variable
scope. A docs deployment does not require the website's runtime variables.

For Cloudflare Pages, create a distinct project manually with `apps/docs` as the
root directory, `bun run build` as the build command, and `dist` as the output
directory. The project name, production domain, DNS, and credentials are owner
decisions and are deliberately not committed here. The existing website deployment
must keep `apps/website` as its root after the rename. No production deployment is
performed by this repository change.
