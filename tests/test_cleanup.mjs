import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/cleanup-preview-images.yml', import.meta.url), 'utf8');
const source = workflow.split('          script: |\n')[1].split('\n').map(line => line.slice(12)).join('\n');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction('github', 'context', 'core', 'process', source);
const version = (id, days) => ({ id, updated_at: new Date(Date.now() - days * 86400000).toISOString(), metadata: { container: { tags: [] } } });

async function run(versions, { dryRun = false, ownerType = 'User', error } = {}) {
  const requests = [];
  const github = {
    paginate: async (route, params) => {
      requests.push([route, params]);
      if (error) throw error;
      return versions;
    },
    request: async (route, params) => requests.push([route, params]),
  };
  const core = { info() {}, notice() {}, summary: { addRaw() { return this; }, async write() {} } };
  await execute(github, { repo: { owner: 'example' } }, core,
    { env: { OWNER_TYPE: ownerType, DRY_RUN: String(dryRun) } });
  return requests;
}

test('only expired preview versions are deleted, including untagged signatures', async () => {
  const requests = await run([version(1, 8), version(2, 1), version(3, 9)]);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.slice(1).map(([, params]) => params.version_id), [1, 3]);
  assert.ok(requests.every(([route]) => route.includes('/workstation-preview/versions')));
  assert.equal(requests[0][1].per_page, 100);
});

test('dry run never deletes', async () => {
  assert.equal((await run([version(1, 8)], { dryRun: true })).length, 1);
});

test('organizations use organization package endpoints', async () => {
  assert.ok((await run([version(1, 8), version(2, 1)], { ownerType: 'Organization' }))[1][0].includes('/orgs/example/'));
});

test('the entire preview package is removed when every version expires', async () => {
  const requests = await run([version(1, 8), version(2, 9)]);
  assert.deepEqual(requests[1], ['DELETE /users/example/packages/container/workstation-preview', undefined]);
});

test('invalid timestamps fail before any deletion', async () => {
  await assert.rejects(run([version(1, 8), { id: 2, updated_at: 'invalid' }]), /Invalid timestamp/);
});

test('missing package is allowed; authorization errors fail', async () => {
  assert.equal((await run([], { error: { status: 404 } })).length, 1);
  await assert.rejects(run([], { error: { status: 403 } }));
});
