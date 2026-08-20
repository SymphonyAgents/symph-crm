import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pipelineSource = readFileSync(new URL('../src/components/Pipeline.tsx', import.meta.url), 'utf8')
const storeSource = readFileSync(new URL('../src/lib/stores/pipeline-view-store.ts', import.meta.url), 'utf8')

assert.doesNotMatch(
  pipelineSource,
  /defaultSearchForUser|currentUserSearchLabel|defaultedSearchRef/,
  'Pipeline must not derive or default its search from the current user',
)
assert.doesNotMatch(
  storeSource,
  /defaultSearchForUser/,
  'The pipeline view store must not expose a current-user search default action',
)
assert.match(
  storeSource,
  /version:\s*4/,
  'Persisted pipeline state must migrate to version 4',
)
assert.match(
  storeSource,
  /initializedUserId\s*\?\s*['"]{2}\s*:\s*state\.search/,
  'Migration must clear searches produced by the legacy current-user default',
)
assert.doesNotMatch(
  storeSource,
  /initializedUserId:\s*state\.initializedUserId|initializedUserId:\s*null/,
  'The legacy current-user initialization marker must not remain in current persisted state',
)

console.log('Pipeline filter defaults are user-neutral and legacy auto-search state is cleared.')
