import { createRequire } from 'node:module'

const require = createRequire(
  new URL('../../../../libs/@shumoku/renderer-png/package.json', import.meta.url),
)
const { Resvg } = require('@resvg/resvg-js')
const names = process.argv.includes('--v7-free-groups')
  ? ['', '-only', '-macro', '-detail'].map((suffix) => `tmp-test6-v7-free-groups${suffix}`)
  : process.argv.includes('--v7-rooted-interior-refined')
    ? ['', '-only', '-macro', '-detail'].map(
        (suffix) => `tmp-test6-v7-rooted-interior-refined${suffix}`,
      )
    : process.argv.includes('--v7-rooted-interior')
      ? ['', '-only', '-macro', '-detail'].map((suffix) => `tmp-test6-v7-rooted-interior${suffix}`)
      : process.argv.includes('--v7-upstream')
        ? ['', '-only', '-macro', '-detail'].map(
            (suffix) => `tmp-test6-v7-internet-upstream${suffix}`,
          )
        : process.argv.includes('--v7-boundary-optimized')
          ? [
              'tmp-test6-v7-boundary-optimized',
              'tmp-test6-v7-boundary-optimized-only',
              'tmp-test6-v7-boundary-optimized-macro',
              'tmp-test6-v7-boundary-optimized-detail',
            ]
          : process.argv.includes('--v7-tree')
            ? [
                'tmp-test6-v7-tree',
                'tmp-test6-v7-tree-only',
                'tmp-test6-v7-tree-macro',
                'tmp-test6-v7-tree-detail',
              ]
            : process.argv.includes('--v7-hierarchy')
              ? [
                  'tmp-test6-v7-hierarchy',
                  'tmp-test6-v7-hierarchy-only',
                  'tmp-test6-v7-hierarchy-detail',
                ]
              : process.argv.includes('--v7-polar')
                ? ['tmp-test6-v7-polar', 'tmp-test6-v7-polar-only', 'tmp-test6-v7-polar-macro']
                : process.argv.includes('--v7')
                  ? [
                      'tmp-test6-v7-boundary',
                      'tmp-test6-v7-boundary-only',
                      'tmp-test6-v7-boundary-macro',
                    ]
                  : process.argv.includes('--search')
                    ? [
                        'tmp-test6-search-local',
                        'tmp-test6-search-local-only',
                        'tmp-test6-search-expanded',
                        'tmp-test6-search-expanded-only',
                      ]
                    : process.argv.includes('--dependency')
                      ? ['tmp-test6-dependency-placement', 'tmp-test6-dependency-placement-only']
                      : process.argv.includes('--role-free')
                        ? ['tmp-test6-role-free-placement', 'tmp-test6-role-free-placement-only']
                        : ['tmp-test6-joint-placement', 'tmp-test6-joint-placement-only']
for (const name of names) {
  const svg = await Bun.file(`${name}.svg`).text()
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 2800 } }).render().asPng()
  await Bun.write(`${name}.png`, png)
}
