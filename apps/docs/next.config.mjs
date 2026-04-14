import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ['shumoku', '@shumoku/core', '@shumoku/parser-yaml', '@shumoku/renderer'],
  serverExternalPackages: ['libavoid-js'],
  outputFileTracingIncludes: {
    '/api/layout/*': ['./node_modules/**/libavoid-js/**/*.wasm'],
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ]
  },
}

export default withMDX(config)
