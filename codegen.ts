import type { CodegenConfig } from '@graphql-codegen/cli'

// Shopify publishes a public schema proxy — no credentials required.
// Update the version here when you upgrade API_VERSION in .env.
const API_VERSION = '2026-01'

const config: CodegenConfig = {
  schema: `https://shopify.dev/admin-graphql-direct-proxy/${API_VERSION}`,
  documents: 'src/**/*.graphql',
  generates: {
    'src/gql/': {
      preset: 'client',
      config: { useTypeImports: true },
    },
  },
}

export default config
