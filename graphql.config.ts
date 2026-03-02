import { config as loadEnv } from 'dotenv'
import type { IGraphQLConfig } from 'graphql-config'

loadEnv()
const API_VERSION = process.env.API_VERSION ?? '2026-01'

const config: IGraphQLConfig = {
  schema: `https://shopify.dev/admin-graphql-direct-proxy/${API_VERSION}`,
  documents: 'src/**/*.graphql',
  extensions: {
    codegen: {
      generates: {
        'src/gql/': {
          preset: 'client',
          config: { useTypeImports: true },
        },
      },
    },
  },
}

export default config
