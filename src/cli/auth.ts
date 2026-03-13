import { spawn } from 'node:child_process'
import http from 'node:http'
import minimist from 'minimist'
import '@shopify/shopify-api/adapters/node'
import { ApiVersion, shopifyApi } from '@shopify/shopify-api'
import { config } from '#utils/config'
import { logger } from '#utils/logger'

type Role = 'source' | 'dest'

type AuthOptions = {
  role: Role
  shop: string
}

const OAUTH_SCOPES = ['read_products', 'write_products', 'read_validations', 'write_validations']

const isValidShop = (shop: string): boolean => {
  const re = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/
  return re.test(shop)
}

const openInBrowser = (url: string) => {
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true })
  child.unref()
}

const runAuthForShop = async ({ role, shop }: AuthOptions): Promise<void> => {
  if (!isValidShop(shop)) {
    throw new Error(`Invalid shop domain: ${shop}`)
  }

  const clientId = config.SHOPIFY_CLIENT_ID
  const clientSecret = config.SHOPIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be set in the environment')
  }

  const host = config.SHOPIFY_OAUTH_REDIRECT_HOST
  const port = config.SHOPIFY_OAUTH_REDIRECT_PORT
  const callbackPath = '/shopify/oauth/callback'
  const authPath = '/auth'
  const hostName = `${host}:${port}`

  const shopify = shopifyApi({
    apiKey: clientId,
    apiSecretKey: clientSecret,
    scopes: OAUTH_SCOPES,
    hostName,
    hostScheme: 'http',
    apiVersion: ApiVersion.January26,
    isEmbeddedApp: false,
  })

  logger.info(
    `Starting OAuth flow for ${role === 'source' ? 'SOURCE_SHOP' : 'DEST_SHOP'} (${shop})`,
  )

  const tokenPromise = new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url) {
          res.statusCode = 400
          res.end('Bad request')
          return
        }

        const reqUrl = new URL(req.url, `http://${hostName}`)

        if (reqUrl.pathname === authPath) {
          const shopParam = reqUrl.searchParams.get('shop')
          if (shopParam !== shop) {
            res.statusCode = 400
            res.end('Shop mismatch')
            return
          }
          await shopify.auth.begin({
            shop: shopParam,
            callbackPath,
            isOnline: false,
            rawRequest: req,
            rawResponse: res,
          })
          return
        }

        if (reqUrl.pathname === callbackPath) {
          const { session } = await shopify.auth.callback({
            rawRequest: req,
            rawResponse: res,
          })
          const token = session.accessToken
          if (!token) {
            res.statusCode = 500
            res.end('No access token in session')
            server.close()
            reject(new Error('OAuth callback did not return an access token'))
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(
            '<!doctype html><html><body><h1>Shiftify OAuth complete</h1><p>You can close this window and return to the terminal.</p></body></html>',
          )
          server.close()
          resolve(token)
          return
        }

        res.statusCode = 404
        res.end('Not found')
      } catch (err) {
        server.close()
        reject(err)
      }
    })

    server.listen(port, host, () => {
      logger.info(`Listening on http://${hostName}`)
      logger.info('Opening browser for Shopify authorization...')
      const startUrl = `http://${hostName}${authPath}?shop=${encodeURIComponent(shop)}`
      try {
        openInBrowser(startUrl)
      } catch {
        logger.warn('Failed to open browser automatically; please open the URL below manually:')
        console.log(startUrl)
      }
    })

    server.on('error', (err) => {
      reject(err)
    })
  })

  const token = await tokenPromise
  const envVar = role === 'source' ? 'SOURCE_ACCESS_TOKEN' : 'DEST_ACCESS_TOKEN'

  logger.success(
    `Obtained offline access token for ${shop}. Add this line to your .env file (no quotes), save it, then run export/import again:\n${envVar}=${token}`,
  )
}

const main = async () => {
  const argv = minimist(process.argv.slice(2))
  const wantSource = argv.source === true || argv.s === true || (!argv.dest && !argv.d)
  const wantDest = argv.dest === true || argv.d === true || (!argv.source && !argv.s)

  const targets: AuthOptions[] = []
  if (wantSource) {
    targets.push({ role: 'source', shop: config.SOURCE_SHOP })
  }
  if (wantDest) {
    targets.push({ role: 'dest', shop: config.DEST_SHOP })
  }

  if (targets.length === 0) {
    logger.warn('Nothing to do: pass --source and/or --dest')
    return
  }

  for (const t of targets) {
    await runAuthForShop(t)
  }

  logger.success('OAuth flow complete')
  process.exit(0)
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
