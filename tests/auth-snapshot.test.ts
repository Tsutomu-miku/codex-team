import { describe, expect, test } from "@rstest/core";

import {
  createSnapshotMeta,
  parseAuthSnapshot,
  parseSnapshotMeta,
} from "../src/auth-snapshot.js";
import { createAuthPayload } from "./test-helpers.js";

describe("auth snapshot parsing", () => {
  test("parses a valid auth snapshot", () => {
    const payload = createAuthPayload("acct-primary");
    const snapshot = parseAuthSnapshot(JSON.stringify(payload));

    expect(snapshot.auth_mode).toBe("chatgpt");
    expect(snapshot.tokens.account_id).toBe("acct-primary");
  });

  test("rejects a snapshot without auth_mode", () => {
    const payload = createAuthPayload("acct-primary") as Record<string, unknown>;
    delete payload.auth_mode;

    expect(() => parseAuthSnapshot(JSON.stringify(payload))).toThrow(/auth_mode/);
  });

  test("creates metadata with a preserved created_at on overwrite", () => {
    const payload = createAuthPayload("acct-primary");
    const created = createSnapshotMeta("main", payload, new Date("2026-03-18T00:00:00.000Z"));
    const overwritten = createSnapshotMeta(
      "main",
      payload,
      new Date("2026-03-19T00:00:00.000Z"),
      created.created_at,
    );

    expect(overwritten.created_at).toBe(created.created_at);
    expect(overwritten.updated_at).toBe("2026-03-19T00:00:00.000Z");
    expect(overwritten.last_switched_at).toBe(null);
    expect(overwritten.quota.status).toBe("stale");
  });

  test("parses legacy metadata without quota and defaults to stale", () => {
    const parsed = parseSnapshotMeta(
      JSON.stringify({
        name: "main",
        auth_mode: "chatgpt",
        account_id: "acct-primary",
        created_at: "2026-03-18T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
        last_switched_at: null,
      }),
    );

    expect(parsed.quota.status).toBe("stale");
  });
});
