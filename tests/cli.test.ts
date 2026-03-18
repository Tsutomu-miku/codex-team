import { PassThrough } from "node:stream";

import { describe, expect, test } from "@rstest/core";

import { runCli } from "../src/cli.js";
import { createAccountStore } from "../src/account-store.js";
import { cleanupTempHome, createTempHome, writeCurrentAuth } from "./test-helpers.js";

function captureWritable(): {
  stream: NodeJS.WriteStream;
  read: () => string;
} {
  const stream = new PassThrough();
  let output = "";
  stream.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });

  return {
    stream: stream as unknown as NodeJS.WriteStream,
    read: () => output,
  };
}

describe("CLI", () => {
  test("supports save and current in json mode", async () => {
    const homeDir = await createTempHome();

    try {
      const store = createAccountStore(homeDir);
      await writeCurrentAuth(homeDir, "acct-cli");

      const stdout = captureWritable();
      const stderr = captureWritable();

      const saveCode = await runCli(["save", "cli-main", "--json"], {
        store,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });
      expect(saveCode).toBe(0);
      expect(JSON.parse(stdout.read()).account.name).toBe("cli-main");

      const currentStdout = captureWritable();
      const currentCode = await runCli(["current", "--json"], {
        store,
        stdout: currentStdout.stream,
        stderr: stderr.stream,
      });

      expect(currentCode).toBe(0);
      expect(JSON.parse(currentStdout.read())).toMatchObject({
        exists: true,
        managed: true,
        matched_accounts: ["cli-main"],
      });
    } finally {
      await cleanupTempHome(homeDir);
    }
  });

  test("supports update and rejects unmanaged current auth", async () => {
    const homeDir = await createTempHome();

    try {
      const store = createAccountStore(homeDir);
      await writeCurrentAuth(homeDir, "acct-cli-update");
      await runCli(["save", "cli-main", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });

      await writeCurrentAuth(homeDir, "acct-cli-update", "chatgpt-updated");
      const updateStdout = captureWritable();
      const updateStderr = captureWritable();
      const updateCode = await runCli(["update", "--json"], {
        store,
        stdout: updateStdout.stream,
        stderr: updateStderr.stream,
      });

      expect(updateCode).toBe(0);
      expect(JSON.parse(updateStdout.read())).toMatchObject({
        ok: true,
        action: "update",
        account: {
          name: "cli-main",
          auth_mode: "chatgpt-updated",
        },
      });

      await writeCurrentAuth(homeDir, "acct-unmanaged");
      const unmanagedStdout = captureWritable();
      const unmanagedStderr = captureWritable();
      const unmanagedCode = await runCli(["update", "--json"], {
        store,
        stdout: unmanagedStdout.stream,
        stderr: unmanagedStderr.stream,
      });

      expect(unmanagedCode).toBe(1);
      expect(JSON.parse(unmanagedStderr.read())).toMatchObject({
        ok: false,
        error: "Current account is not managed.",
      });
    } finally {
      await cleanupTempHome(homeDir);
    }
  });
});
