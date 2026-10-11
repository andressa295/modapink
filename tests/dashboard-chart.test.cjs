const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const filename = path.join(__dirname, '..', 'lib/dashboard-chart.ts')
const helperModule = new Module(filename, module)
helperModule.filename = filename
helperModule.paths = module.paths
helperModule._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename)
const { buildChartGeometry } = helperModule.exports

test('the SVG viewport matches desktop, collapsed-sidebar and mobile widths without vertical scaling', () => {
  for (const width of [294, 390.5, 680, 950.25, 1200]) {
    const g = buildChartGeometry(width, [30, 82, 0, 142, 64, 28, 37])
    assert.equal(g.width, width)
    assert.equal(g.height, 180)
    assert.equal(g.points[0].x, g.left)
    assert.equal(g.points.at(-1).x, width - g.right)
    assert.ok(g.points.every(point => point.y >= g.top && point.y <= g.height - g.bottom))
    const gaps = g.points.slice(1).map((point, index) => point.x - g.points[index].x)
    assert.ok(gaps.every(gap => Math.abs(gap - gaps[0]) < 1e-9))
  }
})

test('a single day sits in the middle and retains one readable label and a focus target', () => {
  for (const width of [300, 900]) {
    const g = buildChartGeometry(width, [7])
    assert.equal(g.points[0].x, (g.left + width - g.right) / 2)
    assert.equal(g.points[0].hitLeft, g.left)
    assert.equal(g.points[0].hitWidth, g.plotWidth)
    assert.deepEqual(g.xTickIndexes, [0])
  }
})

test('zero activity stays on the zero baseline and empty results do not invent points', () => {
  const g = buildChartGeometry(680, [0, 0, 0])
  assert.equal(g.scale, 4)
  assert.ok(g.points.every(point => point.y === g.height - g.bottom))
  const empty = buildChartGeometry(680, [])
  assert.deepEqual(empty.points, [])
  assert.deepEqual(empty.xTickIndexes, [])
  assert.ok(empty.ticks.every(tick => Number.isFinite(tick.y)))
})

test('hover and keyboard targets cover the plot once and select the nearest data point', () => {
  for (const width of [300, 900]) {
    const g = buildChartGeometry(width, Array.from({ length: 31 }, (_, index) => index * 3))
    assert.equal(g.points[0].hitLeft, g.left)
    assert.ok(Math.abs(g.points.at(-1).hitLeft + g.points.at(-1).hitWidth - (width - g.right)) < 1e-9)
    g.points.forEach((point, index) => {
      const end = point.hitLeft + point.hitWidth
      assert.ok(point.hitWidth > 0)
      assert.ok(point.x >= point.hitLeft && point.x <= end)
      if (index) assert.ok(Math.abs(g.points[index - 1].hitLeft + g.points[index - 1].hitWidth - point.hitLeft) < 1e-9)
      const sample = point.hitLeft + point.hitWidth / 2
      const distances = g.points.map(candidate => Math.abs(candidate.x - sample))
      assert.equal(distances.indexOf(Math.min(...distances)), index)
    })
  }
})

test('dense dates keep both endpoints while mobile omits overlapping labels', () => {
  const values = Array(31).fill(20)
  const mobile = buildChartGeometry(294, values)
  const desktop = buildChartGeometry(950, values)
  assert.equal(mobile.xTickIndexes[0], 0)
  assert.equal(mobile.xTickIndexes.at(-1), 30)
  assert.ok(mobile.xTickIndexes.length < desktop.xTickIndexes.length)
  for (const g of [mobile, desktop]) {
    assert.equal(new Set(g.xTickIndexes).size, g.xTickIndexes.length)
    const visiblePoints = g.xTickIndexes.map(index => g.points[index])
    assert.ok(visiblePoints.slice(1).every((point, index) => point.x - visiblePoints[index].x >= 55))
  }
})

test('large totals reserve space for complete localized axis labels and use a scale above every value', () => {
  const ordinary = buildChartGeometry(680, [8, 12])
  const thousands = buildChartGeometry(680, [123456, 987654])
  assert.ok(thousands.left > ordinary.left)
  assert.ok(thousands.scale >= 987654)
  assert.equal(thousands.ticks[0].value, thousands.scale)
  assert.equal(thousands.ticks.at(-1).value, 0)
  assert.ok(thousands.ticks.slice(1).every((tick, index) => tick.y > thousands.ticks[index].y))
})

test('invalid measurements and malformed values still produce a finite, nonnegative plot', () => {
  const g = buildChartGeometry(Number.NaN, [0, Number.NaN, -4, 17, Number.POSITIVE_INFINITY])
  assert.ok(g.width > 0 && g.plotWidth > 0)
  assert.ok(g.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)))
  assert.ok(g.points.every(point => point.y <= g.height - g.bottom))
})
