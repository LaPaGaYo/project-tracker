import { describe, expect, it } from "vitest";

import { WorkspaceError } from "@/server/workspaces/core";

import { parseGithubIssueSettingsBody } from "./body";

describe("parseGithubIssueSettingsBody", () => {
  it.each([null, [], "sync", 1, true])(
    "rejects non-object settings bodies with 400",
    (body) => {
      expect(() => parseGithubIssueSettingsBody(body)).toThrowError(
        WorkspaceError
      );

      try {
        parseGithubIssueSettingsBody(body);
      } catch (error) {
        expect(error).toMatchObject({
          status: 400,
          message: "request body must be a JSON object.",
        });
      }
    }
  );
});
