const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

test("relatório consulta Nuvemshop antes do espelho local em qualquer período", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "app/api/reports/financial/route.ts"),
    "utf8"
  )

  const generateReport = source.slice(
    source.indexOf("async function generateReport"),
    source.indexOf("export async function GET")
  )

  assert.ok(generateReport.indexOf("fetchDirectOrders") >= 0)
  assert.ok(generateReport.indexOf("fetchLocalOrders") >= 0)
  assert.ok(
    generateReport.indexOf("fetchDirectOrders") <
      generateReport.indexOf("fetchLocalOrders")
  )
  assert.doesNotMatch(generateReport, /rangeDays\s*>\s*8/)
})

test("painel oferece a sessão isolada de teste", () => {
  const numbers = fs.readFileSync(
    path.resolve(process.cwd(), "app/(admin)/dashboard/numeros/page.tsx"),
    "utf8"
  )
  const navigation = fs.readFileSync(
    path.resolve(process.cwd(), "lib/chat-navigation.ts"),
    "utf8"
  )

  assert.match(numbers, /id:\s*"teste"/)
  assert.match(numbers, /Teste · vendas com fotos/)
  assert.match(navigation, /"teste"/)
})
