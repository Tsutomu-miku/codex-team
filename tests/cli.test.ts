import { PassThrough } from "node:stream";

import { describe, expect, test } from "@rstest/core";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import { runCli } from "../src/main.js";
import { createAccountStore } from "../src/account-store.js";
import {
  cleanupTempHome,
  createTempHome,
  jsonResponse,
  textResponse,
  writeCurrentAuth,
} from "./test-helpers.js";

dayjs.extend(utc);
dayjs.extend(timezone);

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
      const store = createAccountStore(homeDir, {
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.endsWith("/backend-api/wham/usage")) {
            return jsonResponse({
              plan_type: "plus",
              rate_limit: {
                primary_window: {
                  used_percent: 20,
                  limit_window_seconds: 18_000,
                  reset_after_seconds: 500,
                  reset_at: 1_773_868_641,
                },
                secondary_window: {
                  used_percent: 70,
                  limit_window_seconds: 604_800,
                  reset_after_seconds: 6_000,
                  reset_at: 1_773_890_040,
                },
              },
              credits: {
                has_credits: true,
                unlimited: false,
                balance: "3",
              },
            });
          }

          return textResponse("not found", 404);
        },
      });
      await writeCurrentAuth(homeDir, "acct-cli-update");
      await runCli(["save", "cli-main", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });

      await writeCurrentAuth(homeDir, "acct-cli-update", "chatgpt", "pro");
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
          auth_mode: "chatgpt",
        },
        quota: {
          status: "ok",
          credits_balance: 3,
          plan_type: "plus",
          five_hour: {
            used_percent: 20,
          },
          one_week: {
            used_percent: 70,
          },
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

  test("supports quota refresh and quota list in json mode", async () => {
    const homeDir = await createTempHome();

    try {
      const store = createAccountStore(homeDir, {
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.endsWith("/backend-api/wham/usage")) {
            return jsonResponse({
              plan_type: "plus",
              rate_limit: {
                primary_window: {
                  used_percent: 15,
                  limit_window_seconds: 18_000,
                  reset_after_seconds: 400,
                  reset_at: 1_773_868_641,
                },
                secondary_window: {
                  used_percent: 45,
                  limit_window_seconds: 604_800,
                  reset_after_seconds: 4_000,
                  reset_at: 1_773_890_040,
                },
              },
              credits: {
                has_credits: true,
                unlimited: false,
                balance: "11",
              },
            });
          }

          return textResponse("not found", 404);
        },
      });
      await writeCurrentAuth(homeDir, "acct-cli-quota");
      await runCli(["save", "quota-main", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });

      const refreshStdout = captureWritable();
      const refreshCode = await runCli(["quota", "refresh", "--json"], {
        store,
        stdout: refreshStdout.stream,
        stderr: captureWritable().stream,
      });
      expect(refreshCode).toBe(0);
      expect(JSON.parse(refreshStdout.read())).toMatchObject({
        successes: [
          {
            name: "quota-main",
            credits_balance: 11,
            status: "ok",
            five_hour: {
              used_percent: 15,
            },
            one_week: {
              used_percent: 45,
            },
          },
        ],
        failures: [],
      });

      const listStdout = captureWritable();
      const listCode = await runCli(["quota", "list", "--json"], {
        store,
        stdout: listStdout.stream,
        stderr: captureWritable().stream,
      });
      expect(listCode).toBe(0);
      expect(JSON.parse(listStdout.read())).toMatchObject({
        accounts: [
          {
            name: "quota-main",
            credits_balance: 11,
            status: "ok",
            five_hour: {
              used_percent: 15,
            },
            one_week: {
              used_percent: 45,
            },
          },
        ],
      });
    } finally {
      await cleanupTempHome(homeDir);
    }
  });

  test("formats quota reset times in local time and hides credits in text mode", async () => {
    const homeDir = await createTempHome();

    try {
      const store = createAccountStore(homeDir, {
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.endsWith("/backend-api/wham/usage")) {
            return jsonResponse({
              plan_type: "plus",
              rate_limit: {
                primary_window: {
                  used_percent: 15,
                  limit_window_seconds: 18_000,
                  reset_after_seconds: 400,
                  reset_at: 1_773_868_641,
                },
                secondary_window: {
                  used_percent: 45,
                  limit_window_seconds: 604_800,
                  reset_after_seconds: 4_000,
                  reset_at: 1_773_890_040,
                },
              },
              credits: {
                has_credits: true,
                unlimited: false,
                balance: "11",
              },
            });
          }

          return textResponse("not found", 404);
        },
      });
      await writeCurrentAuth(homeDir, "acct-cli-quota-text");
      await runCli(["save", "quota-main", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });
      await runCli(["quota", "refresh", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });

      const listStdout = captureWritable();
      const listCode = await runCli(["quota", "list"], {
        store,
        stdout: listStdout.stream,
        stderr: captureWritable().stream,
      });

      expect(listCode).toBe(0);

      const output = listStdout.read();
      expect(output).not.toContain("CREDITS");
      expect(output).toContain(
        dayjs.utc("2026-03-18T21:17:21.000Z").tz(dayjs.tz.guess()).format("MM-DD HH:mm"),
      );
      expect(output).toContain(
        dayjs.utc("2026-03-19T03:14:00.000Z").tz(dayjs.tz.guess()).format("MM-DD HH:mm"),
      );
    } finally {
      await cleanupTempHome(homeDir);
    }
  });

  test("refreshes quota automatically after switch", async () => {
    const homeDir = await createTempHome();

    try {
      const store = createAccountStore(homeDir, {
        fetchImpl: async (input) => {
          const url = String(input);
          if (url.endsWith("/backend-api/wham/usage")) {
            return jsonResponse({
              plan_type: "plus",
              rate_limit: {
                primary_window: {
                  used_percent: 9,
                  limit_window_seconds: 18_000,
                  reset_after_seconds: 300,
                  reset_at: 1_773_868_641,
                },
                secondary_window: {
                  used_percent: 66,
                  limit_window_seconds: 604_800,
                  reset_after_seconds: 3_000,
                  reset_at: 1_773_890_040,
                },
              },
              credits: {
                has_credits: true,
                unlimited: false,
                balance: "8",
              },
            });
          }

          return textResponse("not found", 404);
        },
      });
      await writeCurrentAuth(homeDir, "acct-switch-a");
      await runCli(["save", "alpha", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });

      await writeCurrentAuth(homeDir, "acct-switch-b");
      await runCli(["save", "beta", "--json"], {
        store,
        stdout: captureWritable().stream,
        stderr: captureWritable().stream,
      });

      const switchStdout = captureWritable();
      const switchCode = await runCli(["switch", "alpha", "--json"], {
        store,
        stdout: switchStdout.stream,
        stderr: captureWritable().stream,
      });

      expect(switchCode).toBe(0);
      expect(JSON.parse(switchStdout.read())).toMatchObject({
        ok: true,
        action: "switch",
        account: {
          name: "alpha",
        },
        quota: {
          status: "ok",
          credits_balance: 8,
          five_hour: {
            used_percent: 9,
          },
          one_week: {
            used_percent: 66,
          },
        },
      });
    } finally {
      await cleanupTempHome(homeDir);
    }
  });
});
