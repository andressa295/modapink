const assert = require("node:assert/strict")
const { test } = require("node:test")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const filename = path.join(__dirname, "..", "lib/chat-conversation-signature.ts")
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const helperModule = new Module(filename, module)
helperModule.filename = filename
helperModule.paths = module.paths
helperModule._compile(compiled, filename)
const { getConversationDisplaySignature: signature } = helperModule.exports

const conversation = {
  id: "conversation-1",
  customer_name: "Cliente",
  avatar_url: null,
  last_message_at: "2026-10-13T18:00:00Z",
  updated_at: "2026-10-13T18:00:00Z",
  last_message: "Boa tarde",
  mode: "DEFAULT",
  state: "DEFAULT",
  status: "open",
  memory: {},
}

test("a profile photo saved after the message updates both list and selected-contact comparison", () => {
  const withPhoto = { ...conversation, avatar_url: "https://storage.example/profile.jpg" }
  assert.notEqual(signature([conversation]), signature([withPhoto]))
  assert.equal(signature([withPhoto]), signature([{ ...withPhoto }]))
  assert.notEqual(signature([withPhoto]), signature([{ ...withPhoto, avatar_url: "https://storage.example/profile-new.jpg" }]))
  assert.notEqual(signature([withPhoto]), signature([{ ...withPhoto, avatar_url: null }]))
})

test("profile name corrections refresh while the message timestamp stays unchanged", () => {
  assert.notEqual(signature([conversation]), signature([{ ...conversation, customer_name: "Sabrina" }]))
})

test("existing message, status and human-intervention updates remain visible", () => {
  for (const update of [
    { last_message: "Nova mensagem" },
    { last_message_at: "2026-10-13T18:01:00Z" },
    { mode: "HUMAN" },
    { state: "TRACKING" },
    { status: "closed" },
    { memory: { human_intervention: { active: true } } },
  ]) {
    assert.notEqual(signature([conversation]), signature([{ ...conversation, ...update }]))
  }
  assert.equal(signature([{ ...conversation, memory: null }]), signature([conversation]))
})
