const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process, Response, URL,
    AbortController, setTimeout, clearTimeout, console,
    require: name => {
      if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name)
      return dependencies[name]
    },
    ...globals
  }, { filename: file })
  return module.exports
}

const truth = load('lib/orders/order-fulfillment.ts')

test('tracking registration does not imply dispatch; actual dispatch resolves stale pending status', () => {
  const registered = { payment_status: 'paid', shipping_status: 'unfulfilled', shipping_tracking_number: 'AP595393493BR' }
  assert.equal(truth.getOrderShippingTruth(registered).stage, 'paid')
  assert.match(truth.getOrderShippingTruth(registered).label, /envio ainda não confirmado/)
  assert.equal(truth.getOrderShippingTruth({ ...registered, shipped_at: '2026-10-02T12:00:00Z' }).stage, 'shipped')
})

test('partial shipments cannot make the entire order delivered or ready for pickup', () => {
  assert.equal(truth.getOrderShippingTruth({ fulfillment_orders: [{ status: 'DELIVERED' }, { status: 'UNPACKED' }] }).stage, 'partially_shipped')
  assert.equal(truth.getOrderShippingTruth({ fulfillment_orders: [{ status: 'READY_FOR_PICKUP' }, { status: 'UNPACKED' }] }).stage, 'partially_ready_for_pickup')
  assert.equal(truth.getOrderShippingTruth({ fulfillment_orders: [{ status: 'READY_FOR_PICKUP' }, { status: 'UNKNOWN' }] }).stage, 'partially_ready_for_pickup')
  assert.equal(truth.getOrderShippingTruth({ fulfillment_orders: [{ status: 'PACKED' }, { status: 'UNKNOWN' }] }).stage, 'partially_packed')
})

test('J3 is motoboy; customer notes and recipient address never select an excursion', () => {
  const result = truth.getOrderShippingTruth({ shipping_option: 'J3', note: 'ônibus de excursão', shipping_status: 'shipped' })
  assert.equal(result.mode, 'motoboy')
  assert.match(result.label, /motoboy/)
  assert.equal(truth.getOrderShippingTruth({ note: 'excursão', shipping_address: { address: 'Rua do Ônibus' } }).mode, 'envio')
})

test('only valid Correios codes receive a generated Correios tracking URL', () => {
  assert.equal(truth.resolveOrderTrackingUrl({ shipping_option: 'J3', tracking_number: 'AP595393493BR' }), null)
  assert.match(truth.resolveOrderTrackingUrl({ shipping_option: 'Correios PAC', tracking_number: 'AP595393493BR' }), /objetos=AP595393493BR/)
})

test('official J3 reference identifies motoboy when the shipping name is generic', async () => {
  const h = routeHarness([{ id: 123, number: 42, payment_status: 'paid', shipping_status: 'shipped', shipping_option: 'Entrega combinada', shipping_option_reference: 'J3', shipping_tracking_number: 'AP595393493BR' }])
  const rows = await (await h.route.GET(new Request('https://example.test/api/orders'))).json()
  assert.equal(h.saved[0].shipping_method, 'Motoboy')
  assert.equal(h.saved[0].tracking_url, null)
  assert.match(rows[0].shipping_label, /motoboy/)
})

function routeHarness(orders) {
  const saved = []
  const apiUrls = []
  const client = { from(table) {
    if (table === 'stores') return { select: async () => ({ data: [{ id: 'store-id', user_id: 123, access_token: 'test-token' }], error: null }) }
    if (table === 'whatsapp_sessions') return { select: async () => ({ data: [], error: null }) }
    if (table === 'conversations') return { select: () => ({ in: async () => ({ data: [], error: null }) }) }
    if (table === 'orders') return { upsert: async (batch) => { saved.push(...batch); return { error: null } } }
    throw new Error('Unexpected table: ' + table)
  } }
  const route = load('app/api/orders/route.ts', {
    '@/lib/dashboard-auth': { requireDashboardAdmin: async () => null },
    '@supabase/supabase-js': { createClient: () => client },
    '../../../utils/phone': { normalizePhone: value => value },
    '@/lib/orders/order-fulfillment': truth
  }, { fetch: async url => {
    apiUrls.push(url)
    return Response.json(orders)
  } })
  return { route, saved, apiUrls }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'

test('sync and response agree on fulfillment status while keeping payment filters and raw payload', async () => {
  const raw = { id: 456, number: 6857, payment_status: 'paid', shipping_status: 'unfulfilled', total: '118.83',
    shipping_option: 'J3', shipping_tracking_number: 'LOCAL-123', shipped_at: '2026-10-02T12:00:00Z',
    fulfillment_orders: [{ id: 'fulfillment-one', status: 'DELIVERED', shipping: { carrier: { name: 'J3' } } }] }
  const h = routeHarness([raw])
  const rows = await (await h.route.GET(new Request('https://example.test/api/orders'))).json()
  assert.equal(new URL(h.apiUrls[0]).searchParams.get('aggregates'), 'fulfillment_orders')
  assert.equal(h.saved[0].shipping_status, 'delivered')
  assert.equal(h.saved[0].shipping_method, 'Motoboy')
  assert.equal(h.saved[0].tracking_number, 'LOCAL-123')
  assert.equal(h.saved[0].tracking_url, null)
  assert.deepEqual(h.saved[0].raw, raw)
  assert.equal(rows[0].status, 'paid')
  assert.equal(rows[0].shipping_status, 'delivered')
  assert.equal(rows[0].shipping, rows[0].shipping_status)
  assert.equal(rows[0].shipping_label, 'Pedido entregue')
  assert.equal(rows[0].shipping_method, 'Motoboy')
  assert.equal(rows[0].total, 118.83)
})

test('sync-only still updates existing columns and returns the existing sync contract', async () => {
  const h = routeHarness([{ id: 123, number: 42, payment_status: 'paid', fulfillment_orders: [{ status: 'DELIVERED' }, { status: 'UNPACKED' }] }])
  const result = await (await h.route.GET(new Request('https://example.test/api/orders?sync_only=1'))).json()
  assert.deepEqual(result, { ok: true, synced: 1, stores: 1, failures: [] })
  assert.equal(h.saved[0].shipping_status, 'partially_shipped')
  assert.equal('shipping_label' in h.saved[0], false)
})

test('shipping method keeps PAC/SEDEX and carrier detail rather than replacing all methods with a generic label', async () => {
  const h = routeHarness([{ id: 123, number: 42, payment_status: 'paid', shipping_option: 'Correios SEDEX' }])
  const rows = await (await h.route.GET(new Request('https://example.test/api/orders'))).json()
  assert.equal(h.saved[0].shipping_method, 'Correios SEDEX')
  assert.equal(rows[0].shipping_method, 'Correios SEDEX')
})
