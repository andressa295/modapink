/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const RUNTIME = 'app/api/whatsapp/runtime/[...path]/route.ts'
const BROADCASTS = 'app/api/whatsapp/broadcasts/[[...path]]/route.ts'
const TRANSPORT = 'lib/whatsapp-proxy.server.ts'
const ID = '12345678-1234-1234-1234-123456789abc'
const TOKEN = 'Bearer test.jwt.signature'
const SECRET = 'server-only-test-key'

function harness({ env = {}, denied = null, upstream, fail, timeout = false } = {}) {
  const calls = []
  const logs = []
  let timerCallback
  let cleared = 0
  let authCalls = 0
  const config = {
    WHATSAPP_API_INTERNAL_URL: 'http://127.0.0.1:3001',
    WHATSAPP_API_INTERNAL_KEY: SECRET,
    ...env
  }
  const NextResponse = Response
  const dependencies = {
    'next/server': { NextResponse },
    '@/lib/dashboard-auth': { requireDashboardAdmin: async () => { authCalls++; return denied } }
  }
  function load(file) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    const loadedModule = { exports: {} }
    vm.runInNewContext(compiled, {
      module: loadedModule, exports: loadedModule.exports, process: { env: config },
      Response, Headers, URL, AbortController,
      console: { error: (...args) => logs.push(args) },
      setTimeout: callback => { timerCallback = callback; return 1 },
      clearTimeout: () => { cleared++ },
      fetch: async (target, options) => {
        calls.push({ target: String(target), ...options })
        if (timeout) { timerCallback(); throw new Error('aborted') }
        if (fail) throw fail
        return upstream ? upstream() : Response.json({ ok: true })
      },
      require: name => {
        assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
        return dependencies[name]
      }
    }, { filename: file })
    return loadedModule.exports
  }
  dependencies['@/lib/whatsapp-proxy.server'] = load(TRANSPORT)
  const runtime = load(RUNTIME)
  const broadcasts = load(BROADCASTS)
  async function request(kind, method, route, { body, headers = {}, query = '' } = {}) {
    const url = new URL(`https://panel.example/api/whatsapp/${kind}/${route}${query}`)
    const req = new Request(url, { method, body, headers })
    req.nextUrl = url
    const context = { params: Promise.resolve({ path: route ? route.split('/') : undefined }) }
    return (kind === 'runtime' ? runtime : broadcasts)[method](req, context)
  }
  return { request, calls, logs, authCalls: () => authCalls, cleared: () => cleared }
}

function campaign(h, method = 'GET', route = '', options = {}) {
  return h.request('broadcasts', method, route, {
    ...options, headers: { Authorization: TOKEN, ...options.headers }
  })
}

test('runtime rejects missing/malformed keys before fetch without exposing values', async () => {
  for (const key of [undefined, '', ' ', '\nsecret', 'secret\r', 'secret\t', 'secret\0', 'secret\u007f', 'chave🔑', '[dotenv] loaded\nsecret']) {
    const h = harness({ env: { WHATSAPP_API_INTERNAL_KEY: key } })
    const response = await h.request('runtime', 'GET', 'sessions')
    assert.equal(response.status, 503)
    assert.equal(h.calls.length, 0)
    assert.match((await response.json()).error, /configuração/)
    assert.equal(h.logs.length, 0)
  }
})

test('bad overrides never fall back to another URL or key', async () => {
  const h = harness({ env: {
    WHATSAPP_API_INTERNAL_URL: '', WHATSAPP_API_URL: 'https://fallback.example',
    WHATSAPP_API_INTERNAL_KEY: '', INTERNAL_API_KEY: 'fallback-key',
    NEXT_PUBLIC_API_URL: 'https://public.example'
  } })
  assert.equal((await h.request('runtime', 'GET', 'sessions')).status, 503)
  assert.equal((await campaign(h)).status, 503)
  assert.equal(h.calls.length, 0)
})

test('both proxies reject invalid server URLs without fetch or leaking configuration', async () => {
  for (const url of ['not a URL', '', 'ftp://example.com', 'http:example.com', 'file:///tmp/foo', 'https://u:secret@example.com', 'https://example.com?secret=x', 'https://example.com#secret', 'https://example.com\n', 'https:\\example.com', '/relative']) {
    const h = harness({ env: { WHATSAPP_API_INTERNAL_URL: url } })
    for (const response of [await h.request('runtime', 'GET', 'sessions'), await campaign(h)]) {
      assert.equal(response.status, 503)
      assert.equal((await response.json()).ok, false)
    }
    assert.equal(h.calls.length, 0)
    assert.equal(h.logs.length, 0)
  }
})

test('runtime retains verified dashboard administrator gate before config/network', async () => {
  for (const status of [401, 403]) {
    const h = harness({ denied: Response.json({ error: 'denied' }, { status }) })
    assert.equal((await h.request('runtime', 'GET', 'sessions')).status, status)
    assert.equal(h.authCalls(), 1)
    assert.equal(h.calls.length, 0)
  }
})

test('runtime forwards private key, allowed route and cache-bust only', async () => {
  const sessions = [{ id: 'principal', status: 'ready' }]
  const h = harness({ upstream: () => Response.json(sessions) })
  const response = await h.request('runtime', 'GET', 'sessions', { query: '?t=123&url=https://evil.example' })
  assert.deepEqual(await response.json(), sessions)
  assert.equal(h.calls[0].target, 'http://127.0.0.1:3001/sessions?t=123')
  assert.equal(h.calls[0].headers.get('x-internal-api-key'), SECRET)
  assert.equal(h.calls[0].headers.get('authorization'), null)
  assert.equal(h.calls[0].redirect, 'manual')
  assert.equal(h.calls[0].cache, 'no-store')
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
  assert.equal(h.cleared(), 1)
})

test('runtime preserves session path/method allowlist', async () => {
  for (const [method, route] of [['GET', 'sessions/qr/principal'], ['GET', 'sessions/status/sac'], ['DELETE', 'sessions/teste']]) {
    const h = harness()
    assert.equal((await h.request('runtime', method, route)).status, 200)
    assert.equal(h.calls.length, 1)
  }
  for (const [method, route] of [['GET', 'broadcasts'], ['GET', 'sessions/qr/other'], ['POST', 'sessions/principal'], ['DELETE', 'sessions'], ['DELETE', 'sessions/other']]) {
    const h = harness()
    assert.equal((await h.request('runtime', method, route)).status, 404)
    assert.equal(h.calls.length, 0)
  }
})

test('runtime create validates body and rejects cross-origin mutations', async () => {
  const h = harness()
  const options = { body: JSON.stringify({ sessionId: 'principal' }), headers: { 'Content-Type': 'application/json', Origin: 'https://panel.example' } }
  assert.equal((await h.request('runtime', 'POST', 'sessions/create', options)).status, 200)
  assert.equal(h.calls[0].body, options.body)
  for (const [body, headers, status] of [
    ['{}', { 'Content-Type': 'application/json' }, 400],
    ['{bad', { 'Content-Type': 'application/json' }, 400],
    [JSON.stringify({ sessionId: 'unknown' }), { 'Content-Type': 'application/json' }, 400],
    [options.body, { 'Content-Type': 'text/plain' }, 415],
    [options.body, { ...options.headers, Origin: 'https://evil.example' }, 403]
  ]) {
    assert.equal((await h.request('runtime', 'POST', 'sessions/create', { body, headers })).status, status)
  }
  assert.equal((await h.request('runtime', 'DELETE', 'sessions/principal', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
  assert.equal(h.calls.length, 1)
})

test('campaigns require explicit Bearer; cookies and internal headers cannot authorize', async () => {
  for (const authorization of ['', 'Basic abc', 'Bearer ', 'Bearer token extra']) {
    const h = harness()
    const response = await h.request('broadcasts', 'POST', `${ID}/start`, {
      headers: { Authorization: authorization, Cookie: 'session=admin', 'x-internal-api-key': SECRET }
    })
    assert.equal(response.status, 401)
    assert.equal(h.calls.length, 0)
  }
})

test('campaigns forward exact user Bearer without internal key or cookies, independent of runtime key', async () => {
  const h = harness({ env: { WHATSAPP_API_INTERNAL_KEY: '[dotenv]\ninvalid', INTERNAL_API_KEY: 'other-key' } })
  const response = await campaign(h, 'POST', `${ID}/start`, {
    headers: { Cookie: 'session=admin', 'x-internal-api-key': 'attacker-key' }
  })
  assert.equal(response.status, 200)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].headers.get('Authorization'), TOKEN)
  assert.equal(h.calls[0].headers.get('x-internal-api-key'), null)
  assert.equal(h.calls[0].headers.get('Cookie'), null)
  assert.equal(h.authCalls(), 0) // API validates the Bearer user and role, never a cookie fallback.
})

test('campaign allowlist covers current page actions and contact lists', async () => {
  const routes = [
    ['GET', ''], ['GET', 'sessions'], ['GET', 'contacts/count'], ['GET', 'contact-lists'], ['GET', ID],
    ['POST', ''], ['POST', 'contact-lists/import'],
    ...['start', 'pause', 'resume', 'cancel'].map(action => ['POST', `${ID}/${action}`]),
    ['PATCH', `contact-lists/${ID}`], ['DELETE', `contact-lists/${ID}`]
  ]
  for (const [method, route] of routes) {
    const h = harness()
    assert.equal((await campaign(h, method, route)).status, 200, `${method} ${route}`)
    assert.equal(h.calls[0].target, `http://127.0.0.1:3001/broadcasts${route ? '/' + route : ''}`)
    assert.equal(h.calls[0].method, method)
  }
})

test('campaign allowlist rejects arbitrary paths, IDs, traversal and methods', async () => {
  for (const [method, route] of [
    ['GET', '../sessions'], ['GET', '%2e%2e/sessions'], ['GET', 'sessions/create'],
    ['GET', 'contact-lists/import'], ['POST', `${ID}/delete`], ['POST', 'sessions'],
    ['POST', 'not-a-uuid/start'], ['DELETE', ID], ['PATCH', ''], ['GET', 'https://evil.example'], ['GET', 'sessions//']
  ]) {
    const h = harness()
    assert.equal((await campaign(h, method, route)).status, 404, `${method} ${route}`)
    assert.equal(h.calls.length, 0)
  }
})

test('campaigns preserve audience query and JSON bodies without forwarding extra query parameters', async () => {
  const h = harness({ env: { WHATSAPP_API_INTERNAL_URL: 'https://api.example/api/' } })
  await campaign(h, 'GET', 'contacts/count', { query: `?contact_list_ids=${ID}%2C${ID}&internal_api_key=bad` })
  const url = new URL(h.calls[0].target)
  assert.equal(url.pathname, '/api/broadcasts/contacts/count')
  assert.equal(url.searchParams.get('contact_list_ids'), `${ID},${ID}`)
  assert.equal(url.searchParams.has('internal_api_key'), false)
  const body = JSON.stringify({ audience_mode: 'selected_lists', contact_list_ids: [ID], expected_sender_phone: 'test-phone' })
  await campaign(h, 'POST', '', { body, headers: { 'Content-Type': 'application/json' } })
  assert.equal(h.calls[1].body, body)
  assert.equal(h.calls[1].headers.get('content-type'), 'application/json')
  assert.equal((await campaign(h, 'POST', '', { body: '{bad', headers: { 'Content-Type': 'application/json' } })).status, 400)
  assert.equal((await campaign(h, 'POST', '', { body, headers: { 'Content-Type': 'text/plain' } })).status, 415)
  assert.equal(h.calls.length, 2)
})

test('upstream business/auth statuses and JSON errors remain meaningful', async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 503]) {
    const payload = { ok: false, error: 'Sessão selecionada ainda não está pronta.' }
    const h = harness({ upstream: () => Response.json(payload, { status }) })
    const response = await campaign(h, 'POST', `${ID}/start`)
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), payload)
    assert.equal(h.calls.length, 1)
  }
})

test('redirects and HTML errors never become same-origin redirects or active HTML', async () => {
  for (const status of [200, 302, 307, 500, 502]) {
    const h = harness({ upstream: () => new Response('<script>secret</script>', { status, headers: { Location: 'https://evil.example', 'Content-Type': 'text/html' } }) })
    const response = await campaign(h, 'POST', `${ID}/start`)
    assert.equal(response.status, status >= 400 ? status : 502)
    assert.match(response.headers.get('content-type'), /application\/json/)
    assert.equal(response.headers.get('location'), null)
    assert.doesNotMatch(await response.text(), /secret|<script>/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0].redirect, 'manual')
  }
})

test('network failures and timeouts differ, leak no exception, and never retry mutations', async () => {
  for (const kind of ['runtime', 'broadcasts']) {
    for (const timeout of [false, true]) {
      const h = harness({ fail: new Error(`fetch failed ${SECRET} ${TOKEN}`), timeout })
      const response = kind === 'runtime'
        ? await h.request('runtime', 'DELETE', 'sessions/teste')
        : await campaign(h, 'POST', `${ID}/start`)
      assert.equal(response.status, timeout ? 504 : 502)
      assert.doesNotMatch(await response.text(), /server-only-test-key|test.jwt.signature/)
      assert.equal(h.calls.length, 1)
      assert.equal(h.cleared(), 1)
      assert.equal(h.logs.length, 0)
    }
  }
})

test('browser campaign calls use same-origin proxy and retain Bearer authentication', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app/(admin)/dashboard/disparos/page.tsx'), 'utf8')
  assert.doesNotMatch(source, /NEXT_PUBLIC_API_URL/)
  assert.match(source, /const BROADCASTS_API = "\/api\/whatsapp\/broadcasts"/)
  assert.match(source, /Bearer \$\{session.access_token\}/)
  assert.match(source, /typeof data\?\.error\?\.message === "string"/)
})
