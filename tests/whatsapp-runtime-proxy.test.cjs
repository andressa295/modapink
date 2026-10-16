/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const pageSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'app',
    '(admin)',
    'dashboard',
    'numeros',
    'page.tsx'
  ),
  'utf8'
)

const proxySource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'app',
    'api',
    'whatsapp',
    'runtime',
    '[...path]',
    'route.ts'
  ),
  'utf8'
)

test('browser uses the authenticated same-origin WhatsApp proxy', () => {
  assert.doesNotMatch(
    pageSource,
    /NEXT_PUBLIC_API_URL/
  )
  assert.match(
    pageSource,
    /const WHATSAPP_RUNTIME_API =\s*"\/api\/whatsapp\/runtime"/
  )
  assert.match(
    pageSource,
    /`\$\{WHATSAPP_RUNTIME_API\}\/sessions\/create`/
  )
  assert.match(
    pageSource,
    /\$\{WHATSAPP_RUNTIME_API\}\/sessions\/qr\//
  )
  assert.match(
    pageSource,
    /\$\{WHATSAPP_RUNTIME_API\}\/sessions\/status\//
  )
})

test('authenticated keeps the modal open until the session is ready', () => {
  const authenticatedStart = pageSource.indexOf(
    'currentStatus === "authenticated"'
  )
  const readyStart = pageSource.indexOf(
    'currentStatus === "ready"',
    authenticatedStart
  )

  assert.ok(authenticatedStart >= 0)
  assert.ok(readyStart > authenticatedStart)

  const authenticatedBlock = pageSource.slice(
    authenticatedStart,
    readyStart
  )

  assert.match(
    authenticatedBlock,
    /setFinishingConnection\(true\)/
  )
  assert.doesNotMatch(
    authenticatedBlock,
    /setShowModal\(false\)/
  )
  assert.match(
    pageSource,
    /Autenticado, finalizando conexão\.\.\./
  )
})

test('runtime proxy is admin-only, private and narrowly allowlisted', () => {
  assert.match(
    proxySource,
    /await requireDashboardAdmin\(\)/
  )
  assert.match(
    proxySource,
    /process\.env\.INTERNAL_API_KEY/
  )
  assert.match(
    proxySource,
    /"x-internal-api-key"/
  )
  assert.match(
    proxySource,
    /path === "sessions\/create"/
  )
  assert.ok(
    proxySource.includes(
      '^sessions\\/(?:qr|status)\\/'
    )
  )
  assert.match(
    proxySource,
    /method === "DELETE"/
  )
  assert.match(
    proxySource,
    /"Cache-Control":\s*"no-store, max-age=0"/
  )
  assert.match(
    proxySource,
    /status: timedOut \? 504 : 502/
  )
})
