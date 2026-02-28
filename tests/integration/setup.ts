import { config } from 'dotenv'

// Load integration-specific env before config.ts is imported by any test.
// Default dotenv behaviour does NOT override already-set vars, so these values
// take precedence over the root .env when both files define the same key.
config({ path: '.env.test.integration' })
