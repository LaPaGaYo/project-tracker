import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDetailPanelOrigin,
  getDetailPanelCloseMode
} from "../apps/web/src/components/detail-panel-navigation.ts";

test("buildDetailPanelOrigin preserves the project view query state", () => {
  assert.equal(
    buildDetailPanelOrigin("/workspaces/alpha/projects/OPS", "view=list&priority=high"),
    "/workspaces/alpha/projects/OPS?view=list&priority=high"
  );
  assert.equal(
    buildDetailPanelOrigin("/workspaces/alpha/projects/OPS", ""),
    "/workspaces/alpha/projects/OPS"
  );
});

test("getDetailPanelCloseMode uses history back only for project-origin panel opens", () => {
  const expectedOrigin = "/workspaces/alpha/projects/OPS?view=list";

  assert.equal(getDetailPanelCloseMode(expectedOrigin, expectedOrigin), "back");
  assert.equal(getDetailPanelCloseMode(null, expectedOrigin), "replace");
  assert.equal(
    getDetailPanelCloseMode("/workspaces/alpha/projects/OPS/items/OPS-1", expectedOrigin),
    "replace"
  );
});
