/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const filename = path.join(__dirname, '..', 'app/(admin)/dashboard/disparos/page.tsx')
const source = fs.readFileSync(filename, 'utf8')
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let loadDataCallback
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'loadData') {
    assert.equal(node.initializer.expression.getText(parsed), 'useCallback')
    loadDataCallback = node.initializer.arguments[0].getText(parsed)
  }
  ts.forEachChild(node, visit)
}
visit(parsed)
assert.ok(loadDataCallback, 'Execute the actual page loadData callback, not a copy of its behavior')
const compiled = ts.transpileModule(`(${loadDataCallback})`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function harness(error = '') {
  const requests = []
  const state = {
    campaigns: [{ id: 'previous', status: 'draft' }],
    availableSessions: [{ key: 'previous', ready: true }],
    dailyLimit: 70,
    contactsCount: 9,
    loadingList: true,
    listError: '',
    error,
    campaignActionErrors: { campaign: 'Não foi possível iniciar a campanha.' }
  }
  const setters = Object.fromEntries(Object.keys(state).map(key => [
    `set${key[0].toUpperCase()}${key.slice(1)}`,
    value => { state[key] = typeof value === 'function' ? value(state[key]) : value }
  ]))
  const loadData = vm.runInNewContext(compiled, {
    ...setters,
    Error,
    FALLBACK_SESSIONS: [{ key: 'principal', ready: false }],
    loadDataRequestRef: { current: 0 },
    loadContactLists: async () => {},
    apiRequest: route => {
      // No fetch, authentication, session changes, or real campaign actions.
      if (route === '/contacts/count') return Promise.resolve({ count: 9 })
      const request = { route, ...deferred() }
      requests.push(request)
      return request.promise
    }
  }, { filename })
  function beginLoad() {
    const offset = requests.length
    const done = loadData()
    assert.equal(requests[offset].route, '/')
    assert.equal(requests[offset + 1].route, '/sessions')
    return {
      done,
      campaigns: requests[offset],
      sessions: requests[offset + 1],
      succeed(id = 'latest') {
        requests[offset].resolve({ campaigns: [{ id, status: 'draft' }, { id: 'cancelled', status: 'cancelled' }] })
        requests[offset + 1].resolve({ sessions: [{ key: id, ready: true }], dailyLimit: 80 })
        return done
      },
      fail(message = 'Falha temporária ao carregar campanhas.') {
        requests[offset].reject(new Error(message))
        requests[offset + 1].resolve({ sessions: [] })
        return done
      }
    }
  }
  return { state, beginLoad }
}

function snapshot(state) {
  return JSON.parse(JSON.stringify(state))
}

test('load errors have their own state and visible alert alongside action errors', () => {
  assert.match(source, /const \[listError, setListError\] = useState\(""\)/)
  assert.match(source, /\{listError && <div className=\{styles\.error\} role="alert">\{listError\}<\/div>\}/)
  assert.match(source, /\{error && <div className=\{styles\.error\} role="alert">\{error\}<\/div>\}/)
})

for (const unrelatedError of [
  '',
  'Não foi possível salvar o rascunho.',
  'Não foi possível importar a planilha.'
]) {
  test(`failed load recovers without erasing unrelated errors: ${unrelatedError || 'none'}`, async () => {
    const h = harness(unrelatedError)
    const originalCampaigns = h.state.campaigns
    const originalSessions = h.state.availableSessions
    const actionErrors = h.state.campaignActionErrors
    await h.beginLoad().fail()
    assert.equal(h.state.listError, 'Falha temporária ao carregar campanhas.')
    assert.equal(h.state.error, unrelatedError)
    assert.equal(h.state.campaigns, originalCampaigns)
    assert.equal(h.state.availableSessions, originalSessions)
    assert.equal(h.state.loadingList, false)

    const recovery = h.beginLoad()
    assert.notEqual(h.state.listError, '', 'A new attempt alone must not clear the failure')
    await recovery.succeed()
    assert.equal(h.state.listError, '')
    assert.equal(h.state.error, unrelatedError)
    assert.equal(h.state.campaignActionErrors, actionErrors)
    assert.equal(h.state.campaigns.length, 1)
    assert.equal(h.state.campaigns[0].id, 'latest')
    assert.equal(h.state.availableSessions[0].key, 'latest')
    assert.equal(h.state.dailyLimit, 80)
  })
}

test('both campaign and session reads must succeed before clearing the loading error', async () => {
  const h = harness('Erro de importação independente.')
  await h.beginLoad().fail()
  const recovery = h.beginLoad()
  recovery.campaigns.resolve({ campaigns: [{ id: 'new', status: 'draft' }] })
  await Promise.resolve()
  assert.notEqual(h.state.listError, '')
  recovery.sessions.reject(new Error('Sessões indisponíveis.'))
  await recovery.done
  assert.equal(h.state.listError, 'Sessões indisponíveis.')
  assert.equal(h.state.error, 'Erro de importação independente.')
  await h.beginLoad().succeed()
  assert.equal(h.state.listError, '')
})

test('an outdated success cannot clear the latest load error or replace its data', async () => {
  const h = harness('Erro do rascunho independente.')
  const older = h.beginLoad()
  await h.beginLoad().fail('Falha da consulta mais recente.')
  const latestState = snapshot(h.state)
  await older.succeed('outdated')
  assert.deepEqual(snapshot(h.state), latestState)
})

test('an outdated failure cannot restore an error after the latest request succeeds', async () => {
  const h = harness('Erro de importação independente.')
  await h.beginLoad().fail()
  const older = h.beginLoad()
  await h.beginLoad().succeed('newest')
  const latestState = snapshot(h.state)
  await older.fail('Falha antiga.')
  assert.deepEqual(snapshot(h.state), latestState)
  assert.equal(h.state.listError, '')
})

test('an outdated completion cannot stop loading while the latest request is pending', async () => {
  for (const outcome of ['succeed', 'fail']) {
    const h = harness()
    const older = h.beginLoad()
    const latest = h.beginLoad()
    const pendingState = snapshot(h.state)
    await older[outcome]()
    assert.deepEqual(snapshot(h.state), pendingState)
    assert.equal(h.state.loadingList, true)
    await latest.succeed('newest')
    assert.equal(h.state.loadingList, false)
  }
})
