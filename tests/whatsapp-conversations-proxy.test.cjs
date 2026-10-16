/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const ROUTE = 'app/api/whatsapp/conversations/[id]/[action]/route.ts'
const TRANSPORT = 'lib/whatsapp-proxy.server.ts'
const ACCESS = 'lib/dashboard-access.ts'
const ID = '12345678-1234-1234-1234-123456789abc'
const SECRET = 'server-only-test-key'
const TOKEN = 'Bearer browser.jwt.signature'
const ACTIONS = ['request-human', 'resume-bot', 'resolve-human', 'send-review']
const compiledFiles = new Map()

function harness({
  env = {}, user = { id: 'verified-user' }, role = 'agent',
  visible = true, databaseError = null, databaseThrows = null, clientThrows = null,
  upstream, fail, timeout = false
} = {}) {
  const calls = []
  const events = []
  const queries = []
  const logs = []
  let timerMs
  let timerCallback
  let cleared = 0
  const config = {
    WHATSAPP_API_INTERNAL_URL: 'http://127.0.0.1:3001',
    WHATSAPP_API_INTERNAL_KEY: SECRET,
    ...env
  }
  const supabase = {
    from(table) {
      events.push('rls')
      const query = { table }
      queries.push(query)
      return {
        select(columns) {
          query.columns = columns
          return {
            eq(column, value) {
              query.filter = { column, value }
              return {
                async maybeSingle() {
                  query.maybeSingle = true
                  if (databaseThrows) throw databaseThrows
                  return { data: visible ? { id: value } : null, error: databaseError }
                }
              }
            }
          }
        }
      }
    }
  }
  const dependencies = {
    'next/server': { NextResponse: Response },
    '@/lib/supabase/server': {
      createClient: async () => {
        events.push('client')
        if (clientThrows) throw clientThrows
        return supabase
      }
    },
    '@/lib/dashboard-auth': {
      getDashboardAccess: async client => {
        assert.equal(client, supabase, 'authentication and RLS must use the same session client')
        events.push('auth')
        return { user, role }
      }
    }
  }
  function load(file) {
    if (!compiledFiles.has(file)) {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
      compiledFiles.set(file, ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
      }).outputText)
    }
    const loadedModule = { exports: {} }
    vm.runInNewContext(compiledFiles.get(file), {
      module: loadedModule, exports: loadedModule.exports, process: { env: config },
      Response, Headers, URL, AbortController, TextDecoder,
      console: { error: (...args) => logs.push(args), log: (...args) => logs.push(args) },
      setTimeout: (callback, delay) => { timerCallback = callback; timerMs = delay; return 1 },
      clearTimeout: () => { cleared++ },
      fetch: async (target, options) => {
        events.push('fetch')
        calls.push({ target: String(target), ...options })
        if (timeout) { timerCallback(); throw new Error(`aborted ${SECRET}`) }
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
  dependencies['@/lib/dashboard-access'] = load(ACCESS)
  dependencies['@/lib/whatsapp-proxy.server'] = load(TRANSPORT)
  const route = load(ROUTE)
  async function request(action = 'request-human', {
    id = ID, body = JSON.stringify({ reason: 'manual_dashboard_intervention' }),
    headers = {}, query = '', requestOrigin = 'https://panel.example'
  } = {}) {
    const url = new URL(`${requestOrigin}/api/whatsapp/conversations/${ID}/request-human${query}`)
    const requestHeaders = new Headers({ 'Content-Type': 'application/json' })
    for (const [key, value] of Object.entries(headers)) {
      if (value === null) requestHeaders.delete(key)
      else requestHeaders.set(key, value)
    }
    const req = new Request(url, { method: 'POST', body, headers: requestHeaders })
    req.nextUrl = url
    return route.POST(req, { params: Promise.resolve({ id, action }) })
  }
  return { request, route, calls, events, queries, logs, timerMs: () => timerMs, cleared: () => cleared }
}

test('chat proxy exports POST only and retains all existing chat roles', async () => {
  for (const role of ['admin', 'agent', 'user']) {
    const h = harness({ role })
    assert.deepEqual(Object.keys(h.route).sort(), ['POST', 'dynamic'])
    assert.equal(h.route.dynamic, 'force-dynamic')
    assert.equal((await h.request()).status, 200, role)
    assert.deepEqual(h.events, ['client', 'auth', 'rls', 'fetch'])
    assert.deepEqual(h.queries, [{
      table: 'conversations', columns: 'id',
      filter: { column: 'id', value: ID }, maybeSingle: true
    }])
  }
})

test('missing verified user fails before RLS, configuration or upstream access', async () => {
  const h = harness({ user: null, role: 'admin', env: { WHATSAPP_API_INTERNAL_URL: 'invalid' } })
  const response = await h.request('send-review', {
    headers: { Authorization: TOKEN, Cookie: 'session=admin', 'x-internal-api-key': SECRET }, body: null
  })
  assert.equal(response.status, 401)
  assert.deepEqual(h.events, ['client', 'auth'])
  assert.equal(h.calls.length, 0)
  assert.equal(h.queries.length, 0)
})

test('session client initialization failure is sanitized and never reaches the upstream API', async () => {
  const h = harness({ clientThrows: new Error(`session client failed ${SECRET} ${TOKEN}`) })
  const response = await h.request()
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /session client failed|server-only-test-key|browser.jwt.signature/)
  assert.deepEqual(h.events, ['client'])
  assert.equal(h.queries.length, 0)
  assert.equal(h.calls.length, 0)
  assert.equal(h.logs.length, 0)
})

test('unrecognized roles fail closed despite client-supplied authorization hints', async () => {
  for (const role of [null, '', 'Admin', 'administrator', 'guest', 'agent ', true, {}, ['admin']]) {
    const h = harness({ role })
    const response = await h.request('request-human', {
      headers: { Authorization: TOKEN, Cookie: 'role=admin', 'x-role': 'admin', 'x-internal-api-key': SECRET }
    })
    assert.equal(response.status, 403, JSON.stringify(role))
    assert.deepEqual(h.events, ['client', 'auth'])
    assert.equal(h.calls.length, 0)
  }
})

test('invisible conversations fail before sending the privileged server credential', async () => {
  for (const role of ['admin', 'agent', 'user']) {
    const h = harness({ role, visible: false })
    assert.equal((await h.request()).status, 404, role)
    assert.deepEqual(h.events, ['client', 'auth', 'rls'])
    assert.equal(h.calls.length, 0)
  }
})

test('RLS query errors and exceptions fail closed without leaking database details', async () => {
  for (const options of [
    { databaseError: { message: `database error ${SECRET}` } },
    { databaseThrows: new Error(`database exception ${SECRET}`) }
  ]) {
    const h = harness(options)
    const response = await h.request()
    assert.equal(response.status, 503)
    assert.doesNotMatch(await response.text(), /database error|database exception|server-only-test-key/)
    assert.equal(h.calls.length, 0)
    assert.equal(h.logs.length, 0)
  }
})

test('UUID and action allowlists reject arbitrary paths before RLS or network', async () => {
  for (const id of ['', 'not-a-uuid', `${ID}/../sessions`, `${ID}%2Fsend-review`, ` ${ID}`, `${ID}\n`, ID.slice(1)]) {
    const h = harness()
    assert.equal((await h.request('request-human', { id })).status, 404, id)
    assert.equal(h.queries.length, 0)
    assert.equal(h.calls.length, 0)
  }
  for (const action of ['', 'delete', 'messages', 'REQUEST-HUMAN', 'request-human/', '../sessions', 'send-review?secret=x']) {
    const h = harness()
    assert.equal((await h.request(action)).status, 404, action)
    assert.equal(h.queries.length, 0)
    assert.equal(h.calls.length, 0)
  }
})

test('all four actions use a fixed server URL and forward only allowed JSON metadata', async () => {
  const body = { requested_by: 'dashboard', requestedBy: 'dashboard', resolved_by: 'dashboard', resolvedBy: 'dashboard', reason: 'manual_dashboard_resume' }
  for (const action of ACTIONS) {
    const h = harness({ env: { WHATSAPP_API_INTERNAL_URL: 'https://api.example/internal/' } })
    const response = await h.request(action, { body: JSON.stringify(body), query: '?url=https://evil.example&internal_api_key=bad' })
    assert.equal(response.status, 200, action)
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0].target, `https://api.example/internal/conversations/${ID}/${action}`)
    assert.equal(h.calls[0].method, 'POST')
    assert.deepEqual(JSON.parse(h.calls[0].body), body)
    assert.equal(h.calls[0].headers.get('Content-Type'), 'application/json')
    assert.equal(h.calls[0].headers.get('Accept'), 'application/json')
    assert.equal(h.timerMs(), 60000)
  }
  const h = harness()
  assert.equal((await h.request('resume-bot', { id: ID.toUpperCase() })).status, 200)
  assert.equal(h.queries[0].filter.value, ID.toUpperCase())
})

test('server key is isolated from browser Authorization, cookies and internal headers', async () => {
  const h = harness()
  const response = await h.request('resolve-human', { headers: {
    Authorization: TOKEN, Cookie: 'session=private', 'x-internal-api-key': 'browser-injected-key',
    'x-forwarded-authorization': TOKEN, 'x-api-key': 'browser-key'
  } })
  assert.equal(response.status, 200)
  assert.equal(h.calls[0].headers.get('x-internal-api-key'), SECRET)
  assert.equal(h.calls[0].headers.get('authorization'), null)
  assert.equal(h.calls[0].headers.get('cookie'), null)
  assert.equal(h.calls[0].headers.get('x-forwarded-authorization'), null)
  assert.equal(h.calls[0].headers.get('x-api-key'), null)
  assert.equal(h.calls[0].cache, 'no-store')
  assert.equal(h.calls[0].redirect, 'manual')
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
  assert.equal(h.cleared(), 1)
})

test('cross-origin and same-site browser mutations are rejected before RLS or fetch', async () => {
  for (const headers of [
    { Origin: 'https://evil.example' }, { Origin: 'null' }, { Origin: 'file://panel.example' },
    { Origin: 'not an origin' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' },
    { Origin: 'https://panel.example', 'Sec-Fetch-Site': 'cross-site' }
  ]) {
    const h = harness()
    assert.equal((await h.request('resolve-human', { headers })).status, 403)
    assert.equal(h.queries.length, 0)
    assert.equal(h.calls.length, 0)
  }
})

test('same-origin chat mutations work directly and behind a TLS reverse proxy', async () => {
  for (const options of [
    { headers: { Origin: 'https://panel.example', 'Sec-Fetch-Site': 'same-origin' } },
    { requestOrigin: 'http://127.0.0.1:3000', headers: { Host: 'panel.example', Origin: 'https://panel.example' } },
    { requestOrigin: 'http://127.0.0.1:3000', headers: { Host: '127.0.0.1:3000', 'X-Forwarded-Host': 'panel.example, internal.example', Origin: 'https://panel.example' } }
  ]) {
    const h = harness()
    assert.equal((await h.request('resolve-human', options)).status, 200)
    assert.equal(h.calls.length, 1)
  }
})

test('send-review accepts the existing empty JSON request while other actions require an object', async () => {
  for (const body of [null, '']) {
    const h = harness()
    assert.equal((await h.request('send-review', { body })).status, 200)
    assert.equal(h.calls[0].body, '{}')
    for (const action of ACTIONS.filter(value => value !== 'send-review')) {
      assert.equal((await h.request(action, { body })).status, 400)
    }
    assert.equal(h.calls.length, 1)
  }
})

test('JSON content type is required for every action, including empty send-review', async () => {
  for (const action of ACTIONS) {
    for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded']) {
      const h = harness()
      assert.equal((await h.request(action, { headers: { 'Content-Type': contentType }, body: action === 'send-review' ? null : '{}' })).status, 415)
      assert.equal(h.calls.length, 0)
    }
  }
  const h = harness()
  assert.equal((await h.request('request-human', { headers: { 'Content-Type': 'application/json; charset=utf-8' } })).status, 200)
})

test('malformed JSON, scalars, arrays, unknown keys and non-string values cannot reach upstream', async () => {
  const bodies = ['{bad', 'null', 'true', '42', '"dashboard"', '[]', '[{}]',
    '{"role":"admin"}', '{"__proto__":{"role":"admin"}}', '{"reason":"ok","sessionId":"sac"}']
  for (const key of ['requested_by', 'requestedBy', 'resolved_by', 'resolvedBy', 'reason']) {
    for (const value of [null, 123, true, [], {}, 'x'.repeat(201)]) {
      bodies.push(JSON.stringify({ [key]: value }))
    }
  }
  for (const body of bodies) {
    const h = harness()
    assert.equal((await h.request('resolve-human', { body })).status, 400, body)
    assert.equal(h.calls.length, 0)
  }
})

test('allowed string metadata accepts the 200-character boundary without changing its value', async () => {
  const h = harness()
  const body = { reason: 'é'.repeat(200) }
  assert.equal((await h.request('request-human', { body: JSON.stringify(body) })).status, 200)
  assert.deepEqual(JSON.parse(h.calls[0].body), body)
})

test('body limit is 4096 bytes regardless of missing or misleading Content-Length', async () => {
  for (const headers of [{}, { 'Content-Length': '1' }, { 'Content-Length': '4097' }]) {
    const h = harness()
    assert.equal((await h.request('send-review', { body: '{}'.padEnd(4097), headers })).status, 413)
    assert.equal(h.calls.length, 0)
  }
  const oversizedUnicode = JSON.stringify({ reason: 'é'.repeat(2050) })
  assert.ok(oversizedUnicode.length < 4096)
  const unicode = harness()
  assert.equal((await unicode.request('send-review', { body: oversizedUnicode })).status, 413)
  assert.equal(unicode.calls.length, 0)
  const boundary = harness()
  assert.equal((await boundary.request('send-review', { body: '{}'.padEnd(4096) })).status, 200)
  assert.equal(boundary.calls[0].body, '{}')
  const declared = harness()
  assert.equal((await declared.request('send-review', { body: '{}', headers: { 'Content-Length': '4097' } })).status, 413)
  assert.equal(declared.calls.length, 0)
})

test('invalid server URLs and malformed keys fail closed without logging secrets', async () => {
  const environments = [
    ...['', 'not a URL', 'ftp://api.example', 'https://user:secret@api.example', 'https://api.example?key=secret', 'https://api.example#secret', 'https://api.example\n'].map(url => ({ WHATSAPP_API_INTERNAL_URL: url })),
    ...[' ', 'key\nsecret', 'key\r', 'key\t', 'key\0', 'chave🔑'].map(key => ({ WHATSAPP_API_INTERNAL_KEY: key })),
    { WHATSAPP_API_INTERNAL_URL: 'https://api.example', WHATSAPP_API_INTERNAL_KEY: '', INTERNAL_API_KEY: '' }
  ]
  for (const env of environments) {
    const h = harness({ env: { NEXT_PUBLIC_API_URL: 'https://public-fallback.example', ...env } })
    const response = await h.request()
    assert.equal(response.status, 503, JSON.stringify(env))
    assert.match((await response.json()).error, /configuração/)
    assert.equal(h.calls.length, 0)
    assert.equal(h.logs.length, 0)
  }
})

test('existing literal-loopback keyless mode still requires verified chat access and RLS', async () => {
  for (const url of ['http://127.0.0.1:3001', 'http://[::1]:3001']) {
    const h = harness({ env: { WHATSAPP_API_INTERNAL_URL: url, WHATSAPP_API_INTERNAL_KEY: '', INTERNAL_API_KEY: '' } })
    assert.equal((await h.request()).status, 200)
    assert.deepEqual(h.events, ['client', 'auth', 'rls', 'fetch'])
    assert.equal(h.calls[0].headers.get('x-internal-api-key'), null)
  }
  for (const url of ['http://localhost:3001', 'http://127.1:3001', 'http://10.0.0.1:3001']) {
    const h = harness({ env: { WHATSAPP_API_INTERNAL_URL: url, WHATSAPP_API_INTERNAL_KEY: '', INTERNAL_API_KEY: '' } })
    assert.equal((await h.request()).status, 503)
    assert.equal(h.calls.length, 0)
  }
})

test('upstream business and auth statuses are preserved with a single request', async () => {
  for (const status of [200, 202, 400, 401, 403, 404, 409, 422, 429, 500, 503]) {
    const payload = { ok: status < 400, error: status >= 400 ? 'Operação indisponível.' : undefined }
    const h = harness({ upstream: () => Response.json(payload, { status }) })
    const response = await h.request('resolve-human')
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(payload)))
    assert.equal(h.calls.length, 1)
    assert.equal(h.cleared(), 1)
  }
  const h = harness({ upstream: () => new Response(null, { status: 204 }) })
  const response = await h.request('send-review')
  assert.equal(response.status, 204)
  assert.equal(await response.text(), '')
  assert.equal(h.calls.length, 1)
})

test('upstream redirects and HTML cannot become active same-origin content', async () => {
  for (const status of [200, 302, 307, 500, 502]) {
    const h = harness({ upstream: () => new Response('<script>private-data</script>', {
      status, headers: { Location: 'https://evil.example', 'Content-Type': 'text/html' }
    }) })
    const response = await h.request('send-review')
    assert.equal(response.status, status >= 400 ? status : 502)
    assert.match(response.headers.get('content-type'), /application\/json/)
    assert.equal(response.headers.get('location'), null)
    assert.doesNotMatch(await response.text(), /private-data|<script>/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0].redirect, 'manual')
  }
})

test('all mutation failures are bounded at 60 seconds and never retried', async () => {
  for (const action of ACTIONS) {
    for (const timeout of [false, true]) {
      const h = harness({ fail: new Error(`fetch failed ${SECRET} ${TOKEN}`), timeout })
      const response = await h.request(action)
      assert.equal(response.status, timeout ? 504 : 502, action)
      assert.doesNotMatch(await response.text(), /server-only-test-key|browser.jwt.signature|fetch failed/)
      assert.equal(h.calls.length, 1)
      assert.equal(h.timerMs(), 60000)
      assert.equal(h.calls[0].signal.aborted, timeout)
      assert.equal(h.cleared(), 1)
      assert.equal(h.logs.length, 0)
    }
  }
})

test('chat routes every privileged action through the same-origin proxy and preserves message endpoints', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app/(admin)/dashboard/conversas/page.tsx'), 'utf8')
  assert.match(source, /const CONVERSATIONS_API = "\/api\/whatsapp\/conversations"/)
  for (const action of ACTIONS) {
    assert.ok(source.includes('`${CONVERSATIONS_API}/${currentSelected.id}/' + action + '`'), action)
  }
  const targets = source.match(/`\$\{CONVERSATIONS_API\}\/\$\{currentSelected\.id\}\/(?:request-human|resume-bot|resolve-human|send-review)`/g)
  assert.equal(targets.length, 8, 'including both existing 404 resolve-human fallback targets')
  assert.doesNotMatch(source, /\$\{API\}\/conversations\/[^`]+\/(?:request-human|resume-bot|resolve-human|send-review)/)
  assert.ok(source.includes('`${API}/messages?conversation_id=${encodeURIComponent(id)}&limit=350&_=${Date.now()}`'))
  assert.ok(source.includes('`${API}/send-message`'))
  assert.match(source, /const API =\s*process\.env\.NEXT_PUBLIC_API_URL!/)
  assert.doesNotMatch(source, /WHATSAPP_API_INTERNAL_KEY|INTERNAL_API_KEY|x-internal-api-key/)
})
