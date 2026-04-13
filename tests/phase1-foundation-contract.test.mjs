import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

async function readJson(relativePath) {
  const file = await readFile(new URL(relativePath, repoRoot), "utf8");
  return JSON.parse(file);
}

test("database package exposes a development seed entrypoint", async () => {
  const rootPackage = await readJson("package.json");
  const dbPackage = await readJson("packages/db/package.json");

  await assert.doesNotReject(access(new URL("packages/db/src/seed.ts", repoRoot)));
  assert.equal(typeof rootPackage.scripts["db:seed"], "string");
  assert.match(rootPackage.scripts["db:seed"], /@the-platform\/db/);
  assert.equal(typeof dbPackage.scripts["db:seed"], "string");
  assert.match(dbPackage.scripts["db:seed"], /src\/seed\.ts/);
});

test("worker deployment has a dedicated workflow and runtime entrypoint", async () => {
  const workerPackage = await readJson("apps/worker/package.json");
  const workflowPath = new URL(".github/workflows/worker-deploy.yml", repoRoot);
  const flyConfigPath = new URL("apps/worker/fly.toml", repoRoot);

  await assert.doesNotReject(access(workflowPath));
  await assert.doesNotReject(access(flyConfigPath));

  const workflow = await readFile(workflowPath, "utf8");

  assert.equal(typeof workerPackage.scripts.start, "string");
  assert.match(workerPackage.scripts.start, /@the-platform\/worker|src\/index\.ts|dist\//);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /flyctl deploy/);
  assert.match(workflow, /apps\/worker/);
});

test("web home page is reduced to the blank shell required by Phase 1", async () => {
  const page = await readFile(new URL("apps/web/src/app/page.tsx", repoRoot), "utf8");

  assert.doesNotMatch(page, /FoundationCard|foundationPackages|projectStages|taskStatuses/);
  assert.doesNotMatch(page, /Phase 1 foundation|Foundation complete|Ready next/);
  assert.match(page, /return\s*<main[\s\S]*\/>/);
});
