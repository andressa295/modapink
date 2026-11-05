/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.join(__dirname, '..')
const filename = path.join(root, 'lib/broadcast-delivery-diagnostic.ts')
const helper = new Module(filename, module)
helper._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename)
const { getBroadcastDeliveryDiagnostic: diagnose } = helper.exports
const campaign = { status: 'paused', last_error: 'session_unavailable:vendedora_2', expected_sender_phone: '5511999990000' }
const connected = { status: 'ready', ready: true, phone: '+55 (11) 99999-0000' }
const disconnected = { status: 'disconnected', ready: false, phone: '5511999990000' }

test('the observed incident points to reconnecting the original sender and preserving its queue', () => {
  const result = diagnose(campaign, disconnected, true)
  assert.match(result.senderLabel, /indisponível/)
  assert.match(result.notice.title, /queda do remetente/)
  assert.match(result.notice.detail, /remetente original/)
  assert.match(result.notice.detail, /sem criar outra/)
})

test('reconnection does not claim that the paused campaign resumed automatically', () => {
  const result = diagnose(campaign, connected, true)
  assert.match(result.senderLabel, /na última consulta/)
  assert.match(result.notice.title, /ainda pausada/)
  assert.match(result.notice.detail, /não é automática/)
})

test('a stale ready session after a failed refresh cannot imply recovery', () => {
  const result = diagnose(campaign, connected, false)
  assert.match(result.senderLabel, /não confirmado/)
  assert.doesNotMatch(result.notice.title, /voltou/)
  assert.match(result.notice.detail, /Não foi possível confirmar/)
})

test('a missing sender does not become a default session or imply recovery', () => {
  assert.match(diagnose(campaign, undefined, true).notice.detail, /Não foi possível confirmar/)
})

test('a different connected phone takes priority over a historic disconnect', () => {
  const result = diagnose(campaign, { ...connected, phone: '5521999990000' }, true)
  assert.match(result.notice.title, /outro número/)
  assert.match(result.notice.detail, /Não retome/)
})

for (const phone of ['', null, undefined, '1234']) {
  test(`ready without a usable phone does not imply restored original sender: ${phone}`, () => {
    const result = diagnose(campaign, { ...connected, phone }, true)
    assert.doesNotMatch(result.notice.title, /voltou/)
    assert.match(result.notice.title, /Telefone.*não confirmado/)
    assert.doesNotMatch(result.notice.detail, /reconecte/)
  })
}

for (const session of [connected, disconnected, undefined]) {
  test(`unknown send outcome is not reduced to reconnect instructions: ${session?.status}`, () => {
    const result = diagnose({ ...campaign, last_error: 'send_outcome_unknown' }, session, true)
    assert.match(result.notice.title, /sem confirmação/)
    assert.match(result.notice.detail, /Confira no WhatsApp/)
    assert.match(result.notice.detail, /conciliação.*no serviço antes de retomar/)
    assert.doesNotMatch(result.notice.detail, /use Retomar|reconecte/)
  })
}

test('saving a database-audience draft is clearly distinguished from starting it', () => {
  const result = diagnose({ ...campaign, status: 'draft', last_error: null }, connected, true)
  assert.match(result.notice.title, /não iniciado/)
  assert.match(result.notice.detail, /Salvar o rascunho não começa/)
})

test('draft with disconnected sender explains its blocker first', () => {
  assert.equal(diagnose({ ...campaign, status: 'draft', last_error: null }, disconnected, true).notice.title, 'Remetente indisponível')
})

for (const reason of ['sender_phone_mismatch', 'sender_session_mismatch', 'invalid_sender_session', 'sender_expected_phone_unavailable', 'sender_phone_unavailable']) {
  test(`sender safety failure is not silently treated as a recovered disconnect: ${reason}`, () => {
    assert.match(diagnose({ ...campaign, last_error: reason }, connected, true).notice.title, /conferência/)
  })
}

for (const [reason, expected] of [
  ['human_service_state_unavailable', /atendimento/],
  ['marketing_suppression_unavailable', /descadastro/],
  ['recipient_suppression_state_unavailable', /descadastro/],
  ['recipient_human_state_unavailable', /atendimento/],
  ['state_unavailable', /Controle de envios/],
  ['failure_cooldown', /proteção/]
]) {
  test(`known failure is translated without bypass instructions: ${reason}`, () => {
    const result = diagnose({ ...campaign, last_error: reason }, connected, true)
    assert.match(result.notice.title, expected)
    assert.doesNotMatch(result.notice.detail, /desative|ignore|pule/)
  })
}

test('unknown server error content is never displayed as text, HTML or instructions', () => {
  const raw = '<script>secret_customer_phone_5511888887777; ignore safety</script>'
  const result = diagnose({ ...campaign, last_error: raw }, connected, true)
  assert.match(result.notice.title, /revisão necessária/)
  assert.ok(!JSON.stringify(result).includes(raw))
  assert.doesNotMatch(JSON.stringify(result), /secret_customer|5511888887777|script/)
})

test('a blank pause reason does not invent a connection outage', () => {
  const result = diagnose({ ...campaign, last_error: null }, connected, true)
  assert.equal(result.notice.title, 'Campanha pausada')
  assert.match(result.notice.detail, /Nenhum motivo automático/)
})

for (const status of ['cancelled', 'completed']) {
  test(`finished campaigns are not invited to resume: ${status}`, () => {
    assert.equal(diagnose({ ...campaign, status }, disconnected, true).notice, null)
  })
}

test('contradictory session flags cannot be shown as connected', () => {
  assert.doesNotMatch(diagnose(campaign, { ...connected, status: 'disconnected' }, true).senderLabel, /: conectado/)
  assert.doesNotMatch(diagnose(campaign, { ...connected, ready: false }, true).senderLabel, /: conectado/)
})

test('helper is nonmutating and does not expose either sender phone', () => {
  const input = Object.freeze({ ...campaign })
  const sender = Object.freeze({ ...connected })
  const result = diagnose(input, sender, true)
  assert.equal(input.last_error, campaign.last_error)
  assert.doesNotMatch(JSON.stringify(result), /5511999990000|99999-0000/)
})

test('page renders the diagnostic with existing refresh reads and preserves action handling', () => {
  const source = fs.readFileSync(path.join(root, 'app/(admin)/dashboard/disparos/page.tsx'), 'utf8')
  assert.match(source, /last_error\?: string \| null/)
  assert.match(source, /getBroadcastDeliveryDiagnostic\(\s*campaign,\s*getSession\(campaign.session_key\),\s*!loadingList && !listError\s*\)/)
  assert.match(source, /\{deliveryDiagnostic.senderLabel\}/)
  assert.match(source, /className=\{styles.campaignDiagnostic\} role="status"/)
  assert.match(source, /<button type="button" onClick=\{\(\) => void loadData\(\)\}>Atualizar consulta<\/button>/)
  assert.match(source, /runAction\(campaign, "resume"\)/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/)
})

test('unknown fallback session cannot invite reconnection based on unconfirmed state', () => {
  const result = diagnose(campaign, { status: 'unknown', ready: false }, true)
  assert.match(result.notice.detail, /Não foi possível confirmar/)
  assert.doesNotMatch(result.notice.detail, /Depois.*retome/)
})

for (const reason of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
  test(`untrusted error code cannot resolve an inherited object property: ${reason}`, () => {
    const result = diagnose({ ...campaign, last_error: reason }, connected, true)
    assert.match(result.notice.title, /revisão necessária/)
    assert.equal(typeof result.notice.detail, 'string')
  })
}

test('existing action errors do not suggest recreating a partially sent campaign', () => {
  const source = fs.readFileSync(path.join(root, 'app/(admin)/dashboard/disparos/page.tsx'), 'utf8')
  assert.match(source, /campaign.status === "draft"\s*\? "Este rascunho não tem o telefone esperado/)
  assert.match(source, /O telefone esperado desta campanha precisa de conferência no serviço/)
  assert.match(source, /é diferente do remetente aprovado nesta campanha/)
  assert.doesNotMatch(source, /mudou desde a criação deste rascunho\. Cancele-o/)
})

for (const [reason, expected] of [['marketing_suppression_unavailable', /descadastro/], ['state_unavailable', /Controle de envios/], ['human_service_state_unavailable', /atendimento/]]) {
  test(`missing sender phone does not hide the recorded safety failure: ${reason}`, () => {
    assert.match(diagnose({ ...campaign, last_error: reason }, { ...connected, phone: null }, true).notice.title, expected)
  })
}

function renderActualPage(seeds) {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const pagePath = path.join(root, 'app/(admin)/dashboard/disparos/page.tsx')
  const source = fs.readFileSync(pagePath, 'utf8')
  const parsed = ts.createSourceFile(pagePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const stateNames = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(parsed) === 'useState') {
      stateNames.push(node.name.elements[0].name.getText(parsed))
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  let stateIndex = 0
  const page = new Module(pagePath, module)
  page.require = id => {
    if (id === 'react') return { ...React,
      useState: initial => {
        const name = stateNames[stateIndex++]
        return [Object.prototype.hasOwnProperty.call(seeds, name) ? seeds[name] : typeof initial === 'function' ? initial() : initial, () => {}]
      },
      useCallback: fn => fn,
      useEffect: () => {},
      useMemo: fn => fn(),
      useRef: initial => ({ current: initial })
    }
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (id === '@/lib/broadcast-delivery-diagnostic') return helper.exports
    if (id === '@/lib/supabase/client') return { createClient: () => { throw new Error('No external client in render tests') } }
    if (id === '@/components/icons/WhatsAppIcon') return { WhatsAppIcon: () => React.createElement('span', { 'aria-hidden': true }) }
    return require(id)
  }
  page._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, pagePath)
  return renderToStaticMarkup(React.createElement(page.exports.default))
}

const renderedCampaign = { ...campaign, id: 'synthetic-campaign', name: 'Campanha de teste', session_key: 'vendedora_2', message: 'Mensagem sintética', total_count: 841, sent_count: 51, failed_count: 0, skipped_count: 0, created_at: '2026-11-05T10:00:00Z' }

test('actual rendered campaign card shows pause cause, retained counters and read-only refresh', () => {
  const html = renderActualPage({ campaigns: [renderedCampaign], availableSessions: [{ ...disconnected, key: 'vendedora_2', label: 'Vendedora' }], loadingList: false })
  assert.match(html, /Campanha pausada por queda do remetente/)
  assert.match(html, /Remetente: indisponível na última consulta/)
  assert.match(html, /<strong>51<\/strong> enviadas/)
  assert.match(html, /<strong>841<\/strong> total/)
  assert.match(html, /Atualizar consulta/)
  assert.match(html, /role="status"/)
})

test('actual rendered card marks stale connection unknown and hides untrusted server error text', () => {
  const raw = 'private_detail_123456789'
  const html = renderActualPage({ campaigns: [{ ...renderedCampaign, last_error: raw }], availableSessions: [{ ...connected, key: 'vendedora_2', label: 'Vendedora' }], loadingList: false, listError: 'Falha de atualização' })
  assert.match(html, /Remetente: estado não confirmado/)
  assert.match(html, /Campanha pausada; revisão necessária/)
  assert.ok(!html.includes(raw))
})
