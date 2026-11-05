/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const util = require('node:util')
const ts = require('typescript')

// Entirely synthetic credentials. No real provider or database is contacted.
const CODE = 'Z9Q8X-authorization-code-sentinel'
const CLIENT_ID = 'I7R6Y-client-id-sentinel'
const CLIENT_SECRET = 'C5S4W-client-secret-sentinel'
const ACCESS_TOKEN = 'A3T2V-access-token-sentinel'
const REFRESH_TOKEN = 'R1F0U-refresh-token-sentinel'
const SERVICE_KEY = 'K8D7S-database-key-sentinel'
const SECRETS = [CODE, CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN, REFRESH_TOKEN, SERVICE_KEY]
const SECRET_TEXT = SECRETS.join(' ')
const ROUTE = process.env.CALLBACK_ROUTE || path.join(__dirname, '../app/api/nuvemshop/callback/route.ts')
const compiled = ts.transpileModule(fs.readFileSync(ROUTE, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const clean = value => JSON.parse(JSON.stringify(value))

function harness({
  token = { access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, user_id: 1234 },
  tokenStatus = 200,
  tokenRaw,
  tokenThrows,
  store = { id: 1234, url_with_protocol: 'https://shop.example', name: 'Moda Teste', phone: '555-0100' },
  storeStatus = 200,
  storeRaw,
  storeThrows,
  saveError = null,
  saveThrows,
  env = {}
} = {}) {
  const logs = []
  const calls = []
  const saves = []
  const clients = []
  const events = []
  const config = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://database.example',
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    NUVEMSHOP_CLIENT_ID: ` ${CLIENT_ID} `,
    NUVEMSHOP_CLIENT_SECRET: ` ${CLIENT_SECRET} `,
    NEXT_PUBLIC_APP_URL: 'https://panel.example',
    ...env
  }
  const loaded = { exports: {} }
  vm.runInNewContext(compiled, {
    module: loaded, exports: loaded.exports,
    process: { env: config }, URL, URLSearchParams, Response,
    console: Object.fromEntries(['log', 'error', 'warn', 'debug', 'info'].map(level => [level, (...args) => logs.push({ level, args })])),
    fetch: async (target, options) => {
      const index = calls.length
      calls.push({ target, ...clean(options) })
      events.push(index === 0 ? 'token' : 'store')
      assert.ok(index < 2, 'Callback must not add unexpected requests')
      const thrown = index === 0 ? tokenThrows : storeThrows
      if (thrown !== undefined) throw thrown
      const raw = index === 0 ? tokenRaw : storeRaw
      const data = index === 0 ? token : store
      const status = index === 0 ? tokenStatus : storeStatus
      return new Response(raw === undefined ? JSON.stringify(data) : raw, {
        status, headers: { 'Content-Type': 'application/json' }
      })
    },
    require: name => {
      assert.equal(name, '@supabase/supabase-js')
      return {
        createClient: (...args) => {
          clients.push(args)
          return {
            from(table) {
              assert.equal(table, 'stores')
              return {
                async upsert(record, options) {
                  events.push('save')
                  saves.push({ table, record: clean(record), options: clean(options) })
                  if (saveThrows !== undefined) throw saveThrows
                  return { error: saveError }
                }
              }
            }
          }
        }
      }
    }
  }, { filename: ROUTE })
  return {
    calls, logs, saves, clients, events,
    run: (code = ` ${CODE} `) => loaded.exports.GET(new Request(
      `https://panel.example/api/nuvemshop/callback${code === null ? '' : `?code=${encodeURIComponent(code)}`}`
    ))
  }
}

async function assertNoSecrets(h, response) {
  const body = await response.clone().text()
  const output = util.inspect(h.logs, { depth: null }) + body + util.inspect([...response.headers])
  for (const secret of SECRETS) {
    assert.ok(!output.includes(secret), 'Credentials must not reach logs, response bodies, or headers')
    assert.ok(!output.includes(secret.slice(0, 5)), 'Credential prefixes must not be emitted')
  }
  // Every dynamic diagnostic must be a configuration flag or numeric HTTP status.
  for (const { args } of h.logs) {
    assert.equal(typeof args[0], 'string')
    assert.ok(args.length <= 2)
    if (args.length === 1) continue
    if (typeof args[1] === 'string') assert.ok(['SIM', 'NAO'].includes(args[1]))
    else {
      assert.deepEqual(Object.keys(args[1]), ['status'])
      assert.ok(Number.isInteger(args[1].status) && args[1].status >= 100 && args[1].status <= 599)
    }
  }
}

test('successful exchange preserves trimmed credentials, store fetch, upsert and redirect without leaks', async () => {
  const h = harness()
  const response = await h.run()
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('Location'), 'https://panel.example/dashboard?connected=1')
  assert.deepEqual(h.events, ['token', 'store', 'save'])
  assert.deepEqual(h.clients, [['https://database.example', SERVICE_KEY]])
  assert.deepEqual(h.calls[0], {
    target: 'https://www.nuvemshop.com.br/apps/authorize/token', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Phandshop/1.0 (contato@phand.com.br)', Accept: 'application/json'
    },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code: CODE }).toString()
  })
  assert.deepEqual(h.calls[1], {
    target: 'https://api.nuvemshop.com.br/v1/1234/store', method: 'GET',
    headers: {
      Authentication: `bearer ${ACCESS_TOKEN}`,
      'User-Agent': 'Phandshop/1.0 (contato@phand.com.br)', 'Content-Type': 'application/json'
    }
  })
  assert.equal(h.saves.length, 1)
  const { updated_at, ...record } = h.saves[0].record
  assert.ok(Number.isFinite(Date.parse(updated_at)))
  assert.deepEqual(record, {
    store_id: 1234, user_id: 1234, shop: 'https://shop.example', name: 'Moda Teste',
    phone: '555-0100', status: 'connected', access_token: ACCESS_TOKEN
  })
  assert.deepEqual(h.saves[0].options, { onConflict: 'store_id' })
  await assertNoSecrets(h, response)
})

test('all store-domain fallbacks and default name/phone remain unchanged', async () => {
  for (const store of [
    { id: 1234, domains: ['shop.example'] },
    { id: 1234, original_domain: 'shop.example' }
  ]) {
    const h = harness({ store })
    const response = await h.run()
    assert.equal(response.status, 302)
    assert.equal(h.saves[0].record.shop, 'shop.example')
    assert.equal(h.saves[0].record.name, 'Loja Nuvemshop')
    assert.equal(h.saves[0].record.phone, null)
    await assertNoSecrets(h, response)
  }
})

test('missing or blank authorization code returns 400 before any fetch or save', async () => {
  for (const code of [null, '', '  ']) {
    const h = harness()
    const response = await h.run(code)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.clone().json(), { error: 'Código não informado' })
    assert.deepEqual(h.events, [])
    await assertNoSecrets(h, response)
  }
})

test('provider rejection exposes only status, even when the error body contains credentials', async () => {
  for (const tokenStatus of [400, 401, 429, 500, 502]) {
    const h = harness({ tokenStatus, token: {
      access_token: ACCESS_TOKEN, refresh_token: REFRESH_TOKEN, code: CODE,
      error: SECRET_TEXT, error_description: SECRET_TEXT, nested: { debug: SECRET_TEXT }
    } })
    const response = await h.run()
    assert.equal(response.status, 400)
    assert.deepEqual(await response.clone().json(), { error: 'Erro ao obter token', details: { status: tokenStatus } })
    assert.deepEqual(h.events, ['token'])
    await assertNoSecrets(h, response)
  }
})

test('successful HTTP response without a token is rejected safely without store access', async () => {
  for (const token of [{ error: SECRET_TEXT }, { access_token: '', debug: SECRET_TEXT }, [], SECRET_TEXT]) {
    const h = harness({ token })
    const response = await h.run()
    assert.equal(response.status, 400)
    assert.deepEqual(await response.clone().json(), { error: 'Erro ao obter token', details: { status: 200 } })
    assert.deepEqual(h.events, ['token'])
    await assertNoSecrets(h, response)
  }
})

test('malformed or null token responses retain generic 500 behavior without parsing-error leaks', async () => {
  for (const options of [{ tokenRaw: SECRET_TEXT }, { tokenRaw: '{"access_token":"' + ACCESS_TOKEN }, { token: null }]) {
    const h = harness(options)
    const response = await h.run()
    assert.equal(response.status, 500)
    assert.deepEqual(await response.clone().json(), { error: 'Erro interno' })
    assert.deepEqual(h.events, ['token'])
    await assertNoSecrets(h, response)
  }
})

test('token transport exceptions never log raw error, cause, stack, objects or thrown strings', async () => {
  for (const tokenThrows of [new Error(SECRET_TEXT, { cause: new Error(SECRET_TEXT) }), { details: SECRET_TEXT }, SECRET_TEXT]) {
    const h = harness({ tokenThrows })
    const response = await h.run()
    assert.equal(response.status, 500)
    assert.deepEqual(await response.clone().json(), { error: 'Erro interno' })
    assert.deepEqual(h.events, ['token'])
    await assertNoSecrets(h, response)
  }
})

test('store provider errors never echo bearer credentials from the response body', async () => {
  for (const storeStatus of [401, 429, 500]) {
    const h = harness({ storeStatus, store: { message: SECRET_TEXT, access_token: ACCESS_TOKEN } })
    const response = await h.run()
    assert.equal(response.status, 400)
    assert.deepEqual(await response.clone().json(), { error: 'Erro ao buscar loja', details: { status: storeStatus } })
    assert.deepEqual(h.events, ['token', 'store'])
    await assertNoSecrets(h, response)
  }
})

test('malformed/null store responses and transport errors keep the generic response', async () => {
  for (const options of [{ storeRaw: SECRET_TEXT }, { store: null }, { storeThrows: new Error(SECRET_TEXT) }]) {
    const h = harness(options)
    const response = await h.run()
    assert.equal(response.status, 500)
    assert.deepEqual(await response.clone().json(), { error: 'Erro interno' })
    assert.deepEqual(h.events, ['token', 'store'])
    await assertNoSecrets(h, response)
  }
})

test('missing store domain retains 400 without leaking other store fields', async () => {
  const h = harness({ store: { id: 1234, debug: SECRET_TEXT } })
  const response = await h.run()
  assert.equal(response.status, 400)
  assert.deepEqual(await response.clone().json(), { error: 'Domínio da loja não encontrado', details: { status: 200 } })
  assert.deepEqual(h.events, ['token', 'store'])
  await assertNoSecrets(h, response)
})

test('Supabase error details and hints cannot leak stored access tokens', async () => {
  const h = harness({ saveError: { code: SECRET_TEXT, message: SECRET_TEXT, details: SECRET_TEXT, hint: SECRET_TEXT } })
  const response = await h.run()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.clone().json(), { error: 'Erro ao salvar loja' })
  assert.deepEqual(h.events, ['token', 'store', 'save'])
  assert.equal(h.saves[0].record.access_token, ACCESS_TOKEN)
  await assertNoSecrets(h, response)
})

test('Supabase thrown failures do not leak credentials through the catch logger', async () => {
  const h = harness({ saveThrows: new Error(SECRET_TEXT) })
  const response = await h.run()
  assert.equal(response.status, 500)
  assert.deepEqual(await response.clone().json(), { error: 'Erro interno' })
  assert.deepEqual(h.events, ['token', 'store', 'save'])
  await assertNoSecrets(h, response)
})

test('successful store payloads are not logged, including credentials reflected in shop/name/phone', async () => {
  const h = harness({ store: {
    id: 1234, url_with_protocol: `https://shop.example/${ACCESS_TOKEN}`,
    name: CODE, phone: CLIENT_SECRET, debug: SECRET_TEXT
  } })
  const response = await h.run()
  assert.equal(response.status, 302)
  assert.equal(h.saves[0].record.name, CODE)
  assert.equal(h.saves[0].record.phone, CLIENT_SECRET)
  assert.equal(h.saves[0].record.shop, `https://shop.example/${ACCESS_TOKEN}`)
  await assertNoSecrets(h, response)
})

test('configuration diagnostics emit presence flags only', async () => {
  const h = harness({ env: { NUVEMSHOP_CLIENT_ID: '', NUVEMSHOP_CLIENT_SECRET: '' }, tokenStatus: 401, token: { error: SECRET_TEXT } })
  const response = await h.run()
  assert.equal(response.status, 400)
  assert.deepEqual(h.logs.slice(1, 3).map(({ args }) => args[1]), ['NAO', 'NAO'])
  await assertNoSecrets(h, response)
})
