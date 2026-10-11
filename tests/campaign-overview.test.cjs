const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const filename = path.join(__dirname, '..', 'lib/campaign-overview.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const helper = new Module(filename, module)
helper.filename = filename
helper.paths = module.paths
helper._compile(compiled, filename)
const { summarizeCampaigns } = helper.exports

test('campaign overview counts campaigns and sent messages without failed or skipped recipients', () => {
  const result = summarizeCampaigns([
    { status: 'completed', sent_count: 20, failed_count: 4, skipped_count: 3 },
    { status: 'running', sent_count: 7, total_count: 70 },
    { status: 'paused', sent_count: 2 },
    { status: 'draft', sent_count: 0 },
  ])
  assert.deepEqual(result, { campaigns: 4, completed: 1, running: 1, sent: 29 })
})

test('cancelled campaigns and their former sends stay outside the displayed scope', () => {
  assert.deepEqual(summarizeCampaigns([
    { status: 'cancelled', sent_count: 30 },
    { status: 'completed', sent_count: '12' },
  ]), { campaigns: 1, completed: 1, running: 0, sent: 12 })
})

test('empty data is a real zero summary', () => {
  assert.deepEqual(summarizeCampaigns([]), { campaigns: 0, completed: 0, running: 0, sent: 0 })
})

test('invalid counters never inflate successful sends', () => {
  const values = [null, undefined, '', 'abc', -2, 1.5, Infinity, NaN, true, Number.MAX_SAFE_INTEGER + 1]
  assert.equal(summarizeCampaigns(values.map(sent_count => ({ status: 'completed', sent_count }))).sent, 0)
})
