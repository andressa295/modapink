/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const NOW = Date.parse('2026-10-21T14:30:00Z')
class Clock extends Date { static now() { return NOW } }
function load(file, dependencies = {}, globals = {}) {
  const loadedModule = { exports: {} }
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText
  vm.runInNewContext(output, { module: loadedModule, exports: loadedModule.exports, Response, Request, URL, Headers,
    TextDecoder, AbortSignal, AbortController, Date: Clock, Intl, console,
    require: name => { assert.ok(name in dependencies, name); return dependencies[name] }, ...globals })
  return loadedModule.exports
}
const lib = load('lib/cart-recovery-summary.ts')
function summary(patch = {}) {
  const data = {
    version: 1, window: { startInclusive: '2026-07-24T03:00:00Z', endExclusive: '2026-10-21T14:30:00Z', timeZone: 'America/Sao_Paulo', days: 90 },
    checkedAt: '2026-10-21T14:30:00Z', status: 'complete', cached: false,
    aggregate: { confirmedOrders: 2, recoveredCarts: 2, grossCents: 25090, productsCents: 23090, sentCarts: 4, recoveryRate: null },
    coverage: { checkedOrders: 10, scannedCarts: 10, scannedMessages: 10, orderPages: 1, latestOrderUpdatedAt: '2026-10-21T14:00:00Z', unresolved: 0, paymentTimestampOrders: 2, missingPaymentTimestampCandidates: 0, inProgress: false },
    limitations: []
  }
  for (const [key, value] of Object.entries(patch)) data[key] = ['window', 'aggregate', 'coverage'].includes(key) ? { ...data[key], ...value } : value
  return data
}

test('accepts exact 90 calendar days including today in Brasilia, independent of host timezone', () => {
  const data = lib.parseCartRecoverySummary(summary())
  assert.equal(data.window.startInclusive, '2026-07-24T03:00:00.000Z')
  assert.equal(lib.recoveryTimestamp(data.window.startInclusive), '24/07/2026, 00:00')
  assert.equal(lib.recoveryTimestamp(data.window.endExclusive), '21/10/2026, 11:30')
  assert.doesNotThrow(() => lib.parseCartRecoverySummary(summary({ window: { endExclusive: '2026-10-21T03:00:00Z' } })))
  for (const patch of [{ days: 30 }, { timeZone: 'UTC' }, { endExclusive: '2026-07-23T03:00:00Z' }, { startInclusive: '2026-07-23T03:00:00Z' }, { startInclusive: '2026-07-24T03:00:00' }, { startInclusive: '2026-07-24T04:00:00Z' }, { startInclusive: '2026-07-24T03:00:00.001Z' }]) {
    assert.throws(() => lib.parseCartRecoverySummary(summary({ window: patch })))
  }
})

test('strict validated aggregates never coerce absent, malformed or negative money to zero', () => {
  for (const bad of [undefined, '123', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => lib.parseCartRecoverySummary(summary({ aggregate: { grossCents: bad } })))
  }
  assert.throws(() => lib.parseCartRecoverySummary(summary({ aggregate: { productsCents: 99999 } })))
  assert.throws(() => lib.parseCartRecoverySummary(summary({ aggregate: { recoveryRate: 50 } })))
  assert.throws(() => lib.parseCartRecoverySummary(summary({ coverage: { checkedOrders: 1 } })))
  assert.throws(() => lib.parseCartRecoverySummary(summary({ coverage: { paymentTimestampOrders: 1 } })))
})

test('complete requires no unknown records, no pending scan and all numeric aggregates', () => {
  for (const patch of [{ aggregate: { confirmedOrders: null } }, { coverage: { unresolved: 1 } }, { coverage: { inProgress: true } }, { limitations: ['payment_time_missing'] }]) {
    assert.throws(() => lib.parseCartRecoverySummary(summary(patch)))
  }
})

test('partial zero, null, stale zero and refresh failure zero are unknown; verified complete zero is real', () => {
  const zero = summary({ aggregate: { confirmedOrders: 0, recoveredCarts: 0, grossCents: 0, productsCents: 0 }, coverage: { paymentTimestampOrders: 0 } })
  assert.equal(lib.recoveryMetricValue(zero, 0), '0')
  assert.match(lib.recoveryMetricValue(zero, 0, true), /^R\$/)
  for (const data of [{ ...zero, status: 'partial' }, { ...zero, checkedAt: '2026-10-21T13:00:00Z' }]) {
    assert.equal(lib.recoveryMetricValue(data, 0), '—')
    assert.equal(lib.recoveryMetricValue(data, 0, true), '—')
  }
  assert.equal(lib.recoveryMetricValue(zero, 0, false, true), '—')
  assert.equal(lib.recoveryMetricValue(zero, null), '—')
  assert.equal(lib.recoveryMetricValue(null, 0), '—')
  assert.equal(lib.recoveryMetricValue({ ...zero, status: 'partial' }, 3), '≥ 3')
  assert.match(lib.recoveryMetricValue({ ...zero, status: 'partial' }, 23090, true), /^≥ R\$\s230,90$/)
})

test('freshness is based on original checkedAt, never on response receipt or cached flag', () => {
  assert.equal(lib.recoveryIsStale(summary({ cached: true })), false)
  assert.equal(lib.recoveryIsStale(summary({ checkedAt: '2026-10-21T14:15:00Z' })), false)
  assert.equal(lib.recoveryIsStale(summary({ checkedAt: '2026-10-21T14:14:59Z' })), true)
  assert.equal(lib.recoveryIsStale(summary({ checkedAt: '2026-10-21T16:30:00Z' })), true)
  assert.throws(() => lib.parseCartRecoverySummary(summary({ checkedAt: '2026-10-21T16:30:00Z' })))
  assert.equal(lib.recoveryMetricValue(summary({ status: 'partial', checkedAt: '2026-10-21T13:00:00Z' }), 2), '2')
})

test('sanitization rebuilds allowlisted fields and never forwards raw customer, token or error text', () => {
  const raw = summary({ status: 'partial', limitations: ['secret-token https://checkout.test/private', 'payment_time_missing'], customer: 'private customer', token: 'secret' })
  raw.aggregate.private = 'secret'
  raw.coverage.url = 'private checkout'
  const data = lib.parseCartRecoverySummary(raw)
  const serialized = JSON.stringify(data)
  for (const unsafe of ['secret', 'private', 'checkout.test', 'customer', 'token']) assert.equal(serialized.includes(unsafe), false)
  assert.deepEqual(Array.from(data.limitations), ['source_unavailable', 'payment_time_missing'])
})

function routeHarness({ deny = null, key = 'private-key', configError = false, response = () => Response.json(summary()), fail = false } = {}) {
  const calls = []
  let configReads = 0
  const route = load('app/api/dashboard/cart-recovery/route.ts', {
    '@/lib/dashboard-auth': { requireDashboardAdmin: async () => deny },
    '@/lib/whatsapp-proxy.server': {
      getWhatsAppInternalKey: () => { configReads++; if (configError) throw new Error('private config'); return key },
      getWhatsAppApiBaseUrl: () => 'http://127.0.0.1:3001'
    },
    '@/lib/cart-recovery-summary': lib
  }, { fetch: async (url, options) => { calls.push({ url: String(url), ...options }); if (fail) throw new Error('private token'); return response() } })
  return { route, calls, configReads: () => configReads }
}

test('proxy checks dashboard admin before config or network; no keyless loopback financial access', async () => {
  for (const status of [401, 403]) {
    const h = routeHarness({ deny: Response.json({ error: 'denied' }, { status }) })
    assert.equal((await h.route.GET()).status, status)
    assert.equal(h.configReads(), 0)
    assert.equal(h.calls.length, 0)
  }
  for (const input of [{ key: undefined }, { configError: true }]) {
    const h = routeHarness(input.key === undefined && !input.configError ? { key: null } : input)
    const response = await h.route.GET()
    assert.equal(response.status, 503)
    assert.equal(h.calls.length, 0)
  }
})

test('proxy is a fixed GET read-only target; never forwards request parameters, cookies or browser tokens', async () => {
  const h = routeHarness()
  const response = await h.route.GET(new Request('https://panel.test/api/dashboard/cart-recovery?store_id=other&url=https://evil.test', { headers: { Authorization: 'Bearer browser', Cookie: 'private-cookie' } }))
  assert.equal(response.status, 200)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, 'http://127.0.0.1:3001/api/admin/cart-recovery/reconcile')
  assert.equal(h.calls[0].method, 'GET')
  assert.equal(h.calls[0].redirect, 'error')
  assert.equal(h.calls[0].cache, 'no-store')
  assert.equal(h.calls[0].headers['x-internal-api-key'], 'private-key')
  assert.equal(h.calls[0].headers.Authorization, undefined)
  assert.equal(h.calls[0].body, undefined)
  assert.match(response.headers.get('cache-control'), /private, no-store/)
})

test('upstream denial, error, timeout and malformed payload return sanitized failure, never zero or retries', async () => {
  for (const input of [
    { response: () => Response.json({ token: 'secret' }, { status: 401 }) },
    { response: () => Response.json({ token: 'secret' }, { status: 429 }) },
    { response: () => Response.json({ token: 'secret' }, { status: 500 }) },
    { response: () => new Response('<html>secret</html>') },
    { response: () => Response.json({ confirmedOrders: 0 }) },
    { response: () => new Response('x'.repeat(32769)) },
    { response: () => Response.json(summary(), { headers: { 'content-length': '32769' } }) },
    { fail: true }
  ]) {
    const h = routeHarness(input)
    const response = await h.route.GET()
    assert.equal(response.status, 503)
    const data = await response.json()
    assert.equal(data.aggregate, undefined)
    assert.equal(JSON.stringify(data).includes('secret'), false)
    assert.equal(h.calls.length, 1)
  }
})

test('proxy returns safe partial coverage but drops arbitrary upstream fields', async () => {
  const h = routeHarness({ response: () => Response.json(summary({ status: 'partial', coverage: { inProgress: true }, customer: 'secret' })) })
  const response = await h.route.GET()
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.status, 'partial')
  assert.equal(data.coverage.inProgress, true)
  assert.equal(data.customer, undefined)
})

function componentHarness(responses) {
  let states = [], cursor = 0, effect, cleanup, calls = 0, timerId = 0
  const listeners = new Map(), timers = new Map()
  const document = { visibilityState: 'visible', addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: name => listeners.delete(name) }
  const window = { setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id }, clearTimeout: id => timers.delete(id) }
  const component = load('app/(admin)/dashboard/components/SalesFunnel.tsx', {
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value }] }, useEffect: cb => { effect = cb } },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'lucide-react': Object.fromEntries(['ArrowUpRight', 'CheckCircle2', 'ShoppingBag', 'ShoppingCart', 'TrendingUp'].map(name => [name, name])),
    './SalesFunnel.module.css': new Proxy({}, { get: (_, key) => key }),
    '@/lib/cart-recovery-summary': lib
  }, { window, document, fetch: async (_, options) => { const response = responses[calls++]; if (response instanceof Error) throw response; if (typeof response === 'function') return response(options); return Response.json(response) } }).default
  const render = () => { cursor = 0; return component() }
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : ''
  render(); cleanup = effect()
  return { render: () => text(render()), settle: () => new Promise(resolve => setImmediate(resolve)), visible: () => listeners.get('visibilitychange')?.(), cleanup, timers, listeners, document, calls: () => calls, runTimer: delay => { const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay); assert.ok(entry, `Missing ${delay}ms timer`); timers.delete(entry[0]); entry[1].callback() } }
}

test('card retains last positive result after refresh failure, visibly marks partial and suppresses zero', async () => {
  const h = componentHarness([summary({ status: 'partial' }), new Error('offline')])
  await h.settle()
  assert.match(h.render(), /≥ 2/)
  assert.match(h.render(), /Conferência parcial/)
  assert.match(h.render(), /24\/07\/2026/)
  h.visible(); await h.settle()
  assert.match(h.render(), /conferência anterior/)
  assert.equal(h.render().includes('≥ 2'), false)
  h.cleanup()
  assert.equal(h.listeners.size, 0)
  assert.equal(h.timers.size, 0)
  const zero = componentHarness([summary({ status: 'partial', aggregate: { confirmedOrders: 0, recoveredCarts: 0, grossCents: 0, productsCents: 0, sentCarts: 0 }, coverage: { paymentTimestampOrders: 0 } })])
  await zero.settle()
  assert.equal(zero.render().includes('R$'), false)
  assert.match(zero.render(), /—/)
  zero.cleanup()
})

test('card deduplicates requests, aborts unmount and makes progress visible without fake conversion rate', async () => {
  let resolve, signal
  const h = componentHarness([options => { signal = options.signal; return new Promise(r => { resolve = r }) }])
  h.visible(); h.visible()
  assert.equal(h.calls(), 1)
  resolve(Response.json(summary({ status: 'partial', coverage: { inProgress: true } })))
  await h.settle()
  assert.match(h.render(), /Conferência em andamento/)
  assert.equal(h.render().includes('Taxa de recuperação'), false)
  h.cleanup()
  assert.equal(signal.aborted, true)
})

function freshness(patch = {}) {
  return { mode: 'incremental', state: 'idle', lastCompletedAt: '2026-10-21T14:30:00Z', lastFullScanAt: '2026-10-21T14:00:00Z', refreshIntervalSeconds: 60, ...patch }
}

test('freshness contract is allowlisted and consistent with progress; diagnostics never reach browser', () => {
  const data = lib.parseCartRecoverySummary(summary({ freshness: { ...freshness(), secret: 'private' }, diagnostics: [{ raw: 'private' }] }))
  assert.equal(data.freshness.mode, 'incremental')
  assert.equal(data.freshness.refreshIntervalSeconds, 60)
  assert.equal(data.freshness.secret, undefined)
  assert.equal(data.diagnostics, undefined)
  for (const patch of [{ state: 'future' }, { state: ['idle'] }, { state: {} }, { mode: ['full'] }, { mode: {} }, { mode: 'other' }, { refreshIntervalSeconds: 1 }, { lastCompletedAt: 'invalid' }, { lastCompletedAt: null }, { lastCompletedAt: '2026-10-21T14:30:30Z' }, { lastFullScanAt: '2026-10-21T14:30:01Z' }, { lastFullScanAt: '2026-10-22T14:00:00Z' }, { state: 'running' }]) {
    assert.throws(() => lib.parseCartRecoverySummary(summary({ freshness: freshness(patch) })))
  }
  assert.throws(() => lib.parseCartRecoverySummary(summary({ coverage: { missingPaymentTimestampCandidates: 2, unresolved: 1 } })))
  assert.doesNotThrow(() => lib.parseCartRecoverySummary(summary({ coverage: { inProgress: true }, freshness: freshness({ state: 'running' }) })))
})

test('running and failed refresh preserve prior timestamp and values, not a current lower bound or zero', () => {
  for (const state of ['running', 'failed']) {
    const data = summary({ status: 'partial', freshness: freshness({ state }), coverage: { inProgress: state === 'running' } })
    const parsed = lib.parseCartRecoverySummary(data)
    assert.equal(parsed.checkedAt, '2026-10-21T14:30:00.000Z')
    assert.equal(lib.recoveryMetricValue(parsed, 2), '2')
    assert.equal(lib.recoveryMetricValue(parsed, 0), '—')
    assert.match(lib.recoveryMetricValue(parsed, 23090, true), /^R\$\s230,90$/)
  }
})

test('automatic visible polling waits 60s at idle and 1s after scan slice, never overlaps and stops while hidden', async () => {
  const first = summary({ status: 'partial', freshness: freshness() })
  const progressing = summary({ status: 'partial', coverage: { inProgress: true }, freshness: freshness({ state: 'running' }) })
  const h = componentHarness([first, progressing, first, first])
  await h.settle()
  assert.match(h.render(), /Recuperação de carrinhos · últimos 90 dias/)
  assert.match(h.render(), /painel estiver aberto e visível/)
  assert.equal(h.calls(), 1)
  h.runTimer(60000); await h.settle()
  assert.equal(h.calls(), 2)
  assert.match(h.render(), /última conferência concluída/)
  assert.equal(h.render().includes('≥ 2'), false)
  h.runTimer(1000); await h.settle()
  assert.equal(h.calls(), 3)
  h.document.visibilityState = 'hidden'; h.visible()
  assert.equal(h.timers.size, 0)
  assert.equal(h.calls(), 3)
  h.document.visibilityState = 'visible'; h.visible(); await h.settle()
  assert.equal(h.calls(), 4)
  h.cleanup()
  assert.equal(h.timers.size, 0)
})

test('automatic refresh accepts confirmed decreases after a refund and separates unknown payment dates', async () => {
  const pending = { unresolved: 137, missingPaymentTimestampCandidates: 129 }
  const first = summary({ status: 'partial', coverage: pending, freshness: freshness() })
  const refunded = summary({ status: 'partial', aggregate: { confirmedOrders: 1, recoveredCarts: 1, productsCents: 10000, grossCents: 11000 }, coverage: { ...pending, paymentTimestampOrders: 1 }, freshness: freshness() })
  const h = componentHarness([first, refunded])
  await h.settle()
  assert.match(h.render(), /129\s+pedido\(s\) pago\(s\) sem data de pagamento comprovada/)
  assert.match(h.render(), /8\s+outro\(s\) registro\(s\)/)
  assert.match(h.render(), /pendências não são somadas/)
  h.runTimer(60000); await h.settle()
  assert.match(h.render(), /≥ 1/)
  assert.equal(h.render().includes('≥ 2'), false)
  assert.match(h.render(), /100,00/)
  h.cleanup()
})

test('failed automatic refresh retains saved snapshot, retries at 60s and does not claim a new confirmation', async () => {
  const failed = summary({ status: 'partial', freshness: freshness({ state: 'failed' }) })
  const h = componentHarness([failed, new Error('network')])
  await h.settle()
  assert.match(h.render(), /atualização automática falhou/)
  assert.equal(h.render().includes('≥ 2'), false)
  h.runTimer(60000); await h.settle()
  assert.match(h.render(), /conferência anterior/)
  assert.equal(h.calls(), 2)
  assert.ok([...h.timers.values()].some(timer => timer.delay === 60000))
  h.cleanup()
})
