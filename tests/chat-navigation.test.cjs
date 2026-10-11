const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const filename = path.join(__dirname, "..", "lib/chat-navigation.ts")
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const helperModule = new Module(filename, module)
helperModule.filename = filename
helperModule.paths = module.paths
helperModule._compile(compiled, filename)
const { getRequestedChatTab } = helperModule.exports

test("dashboard shortcuts open the manual queue or SAC directly", () => {
  assert.equal(getRequestedChatTab("?tab=human"), "human")
  assert.equal(getRequestedChatTab("?tab=sac"), "sac")
})

test("session shortcuts coexist with a requested conversation", () => {
  assert.equal(getRequestedChatTab("?conversation=customer-id&tab=vendedora_1"), "vendedora_1")
  assert.equal(getRequestedChatTab("?conversation=customer-id"), "all")
})

test("unsupported filters keep the existing all-conversations view", () => {
  for (const search of ["", "?tab=", "?tab=unknown", "?tab=HUMAN", "?tab=%3Cscript%3E", "?tab=../usuarios"]) {
    assert.equal(getRequestedChatTab(search), "all")
  }
})
