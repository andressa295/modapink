/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'app',
    '(admin)',
    'dashboard',
    'disparos',
    'page.tsx'
  ),
  'utf8'
)

test('campaign audience always requires an explicit selection', () => {
  assert.match(source, /useState\("unselected"\)/)
  assert.match(
    source,
    /<option value="unselected" disabled>/
  )
  assert.match(
    source,
    /Escolha o público da campanha antes de salvar o rascunho\./
  )
  assert.doesNotMatch(
    source,
    /setAudienceListId\("all"\)/
  )
})

test('start confirmation checks and shows the current eligible audience', () => {
  assert.match(
    source,
    /await getEligibleAudienceEstimate\(campaign\)/
  )
  assert.match(
    source,
    /Estimativa atual: \$\{eligibleCount\.toLocaleString\("pt-BR"\)\} contatos elegíveis/
  )
  assert.match(
    source,
    /Nenhum contato elegível foi encontrado neste público\./
  )
  assert.match(
    source,
    /campaign\.audience_list_ids \|\| \[\]/
  )
  assert.match(
    source,
    /contact_list_ids=\$\{encodeURIComponent\(listIds\.join\(","\)\)\}/
  )
  assert.doesNotMatch(
    source,
    /audienceLabels\.includes\(list\.name\)/
  )
})

test('a freshly imported list is stored before it becomes selected', () => {
  const importedListUpdate = source.indexOf(
    'setContactLists(current => ['
  )
  const importedListSelection = source.indexOf(
    'setAudienceListId(imported.id)'
  )

  assert.ok(importedListUpdate >= 0)
  assert.ok(importedListSelection > importedListUpdate)
})

test('contact-list failures are visible, retryable and block draft creation', () => {
  assert.match(source, /const \[contactListsLoaded, setContactListsLoaded\]/)
  assert.match(source, /const \[contactListsError, setContactListsError\]/)
  assert.match(source, /setContactListsLoaded\(false\)/)
  assert.match(source, /onClick=\{\(\) => void loadContactLists\(\)\}/)
  assert.match(
    source,
    /As carteiras ainda não foram confirmadas\. Recarregue essa lista antes de salvar a campanha\./
  )
  assert.match(
    source,
    /!contactListsLoaded \|\|\s*Boolean\(contactListsError\)/
  )
})

test('stale dashboard requests cannot replace newer campaign and session data', () => {
  assert.match(source, /const loadDataRequestRef = useRef\(0\)/)
  assert.match(
    source,
    /const requestId = \+\+loadDataRequestRef\.current/
  )
  assert.match(
    source,
    /if \(requestId !== loadDataRequestRef\.current\) return/
  )
})

test('sender phone is shown and validated before a campaign starts', () => {
  assert.match(source, /function formatSessionPhone/)
  assert.match(
    source,
    /Remetente: \$\{getCampaignSenderDisplay\(campaign\)\}/
  )
  assert.match(source, /if \(!senderSession\?\.ready\)/)
  assert.match(source, /if \(senderPhone\.length < 10\)/)
  assert.match(
    source,
    /\{session\.label\} — \{formatSessionPhone\(session\.phone\)\}/
  )
  assert.match(
    source,
    /getCampaignSenderDisplay\(campaign\)/
  )
  assert.match(source, /expected_sender_phone:\s*draftSenderPhone/)
  assert.match(
    source,
    /expectedSenderPhone !== senderPhone/
  )
})

test('upload inputs and list actions stay frozen during import', () => {
  assert.match(source, /disabled=\{importingContacts\}/)
  assert.match(
    source,
    /disabled=\{loading \|\| importingContacts\}/
  )
})
