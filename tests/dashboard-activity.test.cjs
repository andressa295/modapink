const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const filename = path.join(__dirname, '..', 'lib/dashboard-activity.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const helperModule = new Module(filename, module)
helperModule.filename = filename
helperModule.paths = module.paths
helperModule._compile(compiled, filename)
const h = helperModule.exports

test('date ranges use São Paulo midnight even when UTC is already the next day', () => {
  const now = new Date('2026-10-11T01:30:00Z')
  const range = h.getDateRange('7d', now)
  assert.equal(range.start.toISOString(), '2026-10-04T03:00:00.000Z')
  assert.equal(range.endExclusive.toISOString(), '2026-10-11T03:00:00.000Z')
  assert.equal(h.formatDateKey(now), '2026-10-10')
  const days = h.listDays('7d', now)
  assert.equal(days.length, 7)
  assert.equal(days.at(-1).date, '2026-10-10')
  assert.ok(days.every(day => day.value === 0 && day.fullLabel))
})

test('current month stops at today and previous month spans December across the year', () => {
  const now = new Date('2027-01-01T13:00:00Z')
  const month = h.getDateRange('month', now)
  assert.equal(month.start.toISOString(), '2027-01-01T03:00:00.000Z')
  assert.equal(month.endExclusive.toISOString(), '2027-01-02T03:00:00.000Z')
  const previous = h.getDateRange('lastMonth', now)
  assert.equal(previous.start.toISOString(), '2026-12-01T03:00:00.000Z')
  assert.equal(previous.endExclusive.toISOString(), '2027-01-01T03:00:00.000Z')
  assert.equal(h.listDays('lastMonth', now).length, 31)
})

test('month rollover, leap years and a 30-day range retain every local date', () => {
  const now = new Date('2028-03-01T03:00:00Z')
  const previous = h.listDays('lastMonth', now)
  assert.equal(previous.length, 29)
  assert.equal(previous[0].date, '2028-02-01')
  assert.equal(previous.at(-1).date, '2028-02-29')
  const thirty = h.listDays('30d', now)
  assert.equal(thirty.length, 30)
  assert.equal(thirty[0].date, '2028-02-01')
  assert.equal(thirty.at(-1).date, '2028-03-01')
  assert.equal(new Set(thirty.map(day => day.date)).size, 30)
})

test('ranges do not depend on the process or browser timezone', () => {
  const originalTZ = process.env.TZ
  const now = new Date('2026-11-01T02:30:00Z')
  try {
    const outputs = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].map(zone => {
      process.env.TZ = zone
      const range = h.getDateRange('month', now)
      return JSON.stringify([range.start, range.endExclusive, h.listDays('month', now)])
    })
    assert.equal(new Set(outputs).size, 1)
    assert.equal(h.formatDateKey(new Date('invalid')), '')
    assert.throws(() => h.getDateRange('7d', new Date('invalid')), RangeError)
  } finally {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  }
})

test('payment notifications need an outgoing sender and an explicit confirmation', () => {
  for (const content of [
    'Pagamento aprovado, amiga 💗 Agora seu pedido entrou em separação. O prazo é de até 2 dias úteis após o pagamento aprovado.',
    'Seu pagamento foi confirmado!',
    'Pedido pago 💗',
    '*Pagamento aprovado* 💗',
    'Compra aprovada.',
    'Payment approved',
    'Order paid',
  ]) {
    assert.equal(h.isPaymentSignal({ sender: 'bot', content }), true, content)
    assert.equal(h.isPaymentSignal({ sender: 'user', content }), false, content)
    assert.equal(h.isPaymentSignal({ content }), false, content)
  }
  assert.equal(h.isOutgoingMessage({ sender: 'Automação' }), true)
  assert.equal(h.isOutgoingMessage({ sender: 'client' }), false)
})

test('future approval, negative statements, client claims and substring paid never imply payment', () => {
  for (const content of [
    'A separação leva até 2 dias úteis após o pagamento aprovado.',
    'Quando seu pagamento for aprovado, avisaremos.',
    'Assim que o pagamento aprovado entrar no sistema, vamos separar.',
    'Seu pagamento não foi aprovado.',
    'Ainda não temos pagamento aprovado para esse pedido.',
    'Se o pedido estiver pago, enviaremos.',
    'Pagamento aprovado? Me envie o comprovante.',
    'Como verificar pagamento aprovado?',
    'Confirme o pagamento aprovado no site.',
    'Pagamento aprovado somente após a análise.',
    'Pedido unpaid',
    'status: unpaid',
    'paid',
    'After payment approved we will ship.',
    'Payment not approved',
    'Payment will be approved tomorrow.',
  ]) assert.equal(h.isPaymentSignal({ sender: 'agent', content }), false, content)
  assert.equal(h.isPaymentSignal({ sender: 'bot', intent: 'paid', flow: 'payment_approved' }), false)
})

test('all flexible text fields remain searchable but incoming signals are excluded', () => {
  assert.equal(h.getMessageText({ text: ' A ', content: 'B', body: null, caption: 'C', intent: 'D' }), ' A \nB\nC\nD')
  assert.equal(h.normalizeText('  RECUPERAÇÃO  de Carrinho '), 'recuperacao de carrinho')
  assert.equal(h.isCheckoutSignal({ sender: 'bot', caption: 'Seu link do pedido' }), true)
  assert.equal(h.isCartRecoverySignal({ sender: 'agent', body: 'Seu carrinho está esperando' }), true)
  assert.equal(h.isCheckoutSignal({ sender: 'user', text: 'Quero o checkout' }), false)
  assert.equal(h.isCartRecoverySignal({ sender: 'user', text: 'Esqueci meu carrinho' }), false)
})

test('daily aggregation counts messages, keeps all zero days and deduplicates payments per conversation per day', () => {
  const days = h.listDays('7d', new Date('2026-10-11T15:00:00Z'))
  const rows = [
    { id: '1', conversation_id: 'a', sender: 'bot', created_at: '2026-10-11T02:59:59Z', content: 'Pagamento aprovado' },
    { id: '2', conversation_id: 'a', sender: 'bot', created_at: '2026-10-11T02:59:59Z', content: 'Pagamento confirmado' },
    { id: '3', conversation_id: 'a', sender: 'bot', created_at: '2026-10-11T03:00:00Z', content: 'Pagamento aprovado' },
    { id: '4', conversation_id: 'b', sender: 'user', created_at: '2026-10-11T03:00:00Z', content: 'Pagamento aprovado' },
    { id: '5', sender: 'agent', created_at: '2026-10-11T13:00:00Z', content: 'Link de compra: /checkout' },
    { id: '6', sender: 'agent', created_at: '2026-10-11T13:01:00Z', content: 'Link de compra: /checkout' },
    { id: '6', sender: 'agent', created_at: '2026-10-11T13:01:00Z', content: 'Link de compra: /checkout' },
    { id: '7', sender: 'user', created_at: '2026-10-11T13:02:00Z', content: 'Checkout' },
    { id: '8', sender: 'agent', created_at: '2026-10-11T13:00:00Z', content: 'Seu carrinho está esperando' },
    { id: '9', sender: 'bot', created_at: 'invalid', content: 'Pagamento aprovado' },
    { id: '10', sender: 'bot', created_at: '2026-09-10T13:00:00Z', content: 'Pagamento aprovado' },
  ]
  const payments = h.buildDailyActivity(days, rows, 'payments')
  assert.equal(payments.at(-2).value, 1)
  assert.equal(payments.at(-1).value, 1)
  assert.equal(payments.reduce((sum, day) => sum + day.value, 0), 2)
  assert.equal(h.buildDailyActivity(days, rows, 'checkouts').at(-1).value, 2)
  assert.equal(h.buildDailyActivity(days, rows, 'carts').at(-1).value, 1)
  assert.equal(payments.length, 7)
  assert.equal(days.every(day => day.value === 0), true)
})

test('conversation aggregation uses creation dates without requiring a message sender', () => {
  const days = h.listDays('7d', new Date('2026-10-11T15:00:00Z'))
  const rows = [
    { id: 'conversation1', created_at: '2026-10-11T03:00:00Z' },
    { id: 'conversation1', created_at: '2026-10-11T03:00:00Z' },
    { id: 'conversation2', created_at: '2026-10-11T15:00:00Z' },
    { created_at: '2026-10-10T04:00:00Z' },
    { id: 'broken', created_at: null },
  ]
  const result = h.buildDailyActivity(days, rows, 'conversations')
  assert.equal(result.at(-1).value, 2)
  assert.equal(result.at(-2).value, 1)
})
