import { config as loadEnv } from 'dotenv'
import type { CodegenConfig } from '@graphql-codegen/cli'

loadEnv()
const API_VERSION = process.env.API_VERSION
if (!API_VERSION) throw new Error('API_VERSION is not set in .env')

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
