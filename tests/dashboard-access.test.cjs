const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process, Response,
    require: name => {
      if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name)
      return dependencies[name]
    }
  }, { filename: file })
  return module.exports
}

const policy = load('lib/dashboard-access.ts')

test('staff can enter chat, including its trailing slash', () => {
  for (const role of ['agent', 'user']) {
    assert.equal(policy.dashboardHome(role), '/dashboard/conversas')
    assert.equal(policy.canAccessDashboard(role, '/dashboard/conversas'), true)
    assert.equal(policy.canAccessDashboard(role, '/dashboard/conversas/'), true)
  }
})

test('staff cannot open admin areas or lookalike chat paths', () => {
  for (const role of ['agent', 'user']) {
    for (const url of ['/dashboard', '/dashboard/usuarios', '/dashboard/disparos',
      '/dashboard/numeros', '/dashboard/relatorios', '/dashboard/pedidos',
      '/dashboard/configuracoes', '/dashboard/instagram', '/dashboard/conversas-admin',
      '/dashboard/conversas/settings']) {
      assert.equal(policy.canAccessDashboard(role, url), false, role + ': ' + url)
    }
  }
})

test('admin retains access to existing and future dashboard areas', () => {
  assert.equal(policy.dashboardHome('admin'), '/dashboard')
  for (const url of ['/dashboard', '/dashboard/conversas', '/dashboard/usuarios', '/dashboard/new-area']) {
    assert.equal(policy.canAccessDashboard('admin', url), true)
  }
})

test('missing and unknown roles fail closed', () => {
  for (const role of [undefined, null, '', 'ADMIN', 'owner', {}, true]) {
    assert.equal(policy.parseDashboardRole(role), null)
    assert.equal(policy.canAccessDashboard(role, '/dashboard/conversas'), false)
  }
  assert.equal(policy.canAccessDashboard('admin', '/dashboard-other'), false)
})

function authHarness({ user = { id: 'verified-id' }, authError = null, role = 'user', profileError = null } = {}) {
  let selectedId
  const session = { auth: { getUser: async () => ({ data: { user }, error: authError }) } }
  const admin = { from: table => {
    assert.equal(table, 'profiles')
    return { select: column => {
      assert.equal(column, 'role')
      return { eq: (column, id) => {
        assert.equal(column, 'id'); selectedId = id
        return { maybeSingle: async () => ({ data: role === null ? null : { role }, error: profileError }) }
      } }
    } }
  } }
  const auth = load('lib/dashboard-auth.ts', {
    '@supabase/supabase-js': { createClient: () => admin },
    '@/lib/supabase/server': { createClient: async () => session },
    '@/lib/dashboard-access': policy
  })
  return { auth, session, selectedId: () => selectedId }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'

test('role lookup uses verified identity, ignores user metadata', async () => {
  const h = authHarness({ user: { id: 'verified-id', user_metadata: { role: 'admin' } }, role: 'user' })
  const access = await h.auth.getDashboardAccess(h.session)
  assert.equal(access.role, 'user')
  assert.equal(h.selectedId(), 'verified-id')
  assert.equal((await h.auth.requireDashboardAdmin()).status, 403)
})

test('admin endpoints reject expired sessions and role lookup failures', async () => {
  for (const options of [{ user: null }, { authError: new Error('expired') }]) {
    const h = authHarness(options)
    assert.equal((await h.auth.requireDashboardAdmin()).status, 401)
    assert.equal(h.selectedId(), undefined)
  }
  for (const options of [{ profileError: new Error('database failed') }, { role: null }, { role: 'owner' }, { role: 'agent' }]) {
    const h = authHarness(options)
    assert.equal((await h.auth.requireDashboardAdmin()).status, 403)
  }
})

test('admin endpoints accept verified administrators', async () => {
  const h = authHarness({ role: 'admin' })
  assert.equal(await h.auth.requireDashboardAdmin(), null)
})

test('missing server configuration fails closed', async () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const h = authHarness({ role: 'admin' })
    assert.equal((await h.auth.requireDashboardAdmin()).status, 403)
  } finally { process.env.SUPABASE_SERVICE_ROLE_KEY = original }
})
