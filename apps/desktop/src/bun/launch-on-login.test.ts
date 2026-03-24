import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  LOGIN_LAUNCH_FLAG,
  appendLaunchOnLoginFlag,
  buildWindowsStartupValue,
  renderLinuxAutostartEntry,
  renderMacLaunchAgentPlist,
  shouldLaunchHidden,
  syncLaunchOnLogin,
} from "./launch-on-login";

describe("launch-on-login helpers", () => {
  test("detects hidden login launches from the command line flag", () => {
    expect(shouldLaunchHidden(["bun", "index.ts"])).toBe(false);
    expect(
      shouldLaunchHidden(["bun", "index.ts", LOGIN_LAUNCH_FLAG])
    ).toBe(true);
  });

  test("appends the hidden login flag only once", () => {
    expect(
      appendLaunchOnLoginFlag([
        "/Applications/Rekna.app/Contents/MacOS/launcher",
      ])
    ).toEqual([
      "/Applications/Rekna.app/Contents/MacOS/launcher",
      LOGIN_LAUNCH_FLAG,
    ]);
    expect(
      appendLaunchOnLoginFlag([
        "/Applications/Rekna.app/Contents/MacOS/launcher",
        LOGIN_LAUNCH_FLAG,
      ])
    ).toEqual([
      "/Applications/Rekna.app/Contents/MacOS/launcher",
      LOGIN_LAUNCH_FLAG,
    ]);
  });

  test("renders platform startup entries with the hidden launch flag", () => {
    const command = appendLaunchOnLoginFlag([
      "/Applications/Rekna.app/Contents/MacOS/launcher",
      "--profile",
      "default",
    ]);

    expect(renderMacLaunchAgentPlist("dev.fabianurbanek.linea", command)).toContain(
      `<string>${LOGIN_LAUNCH_FLAG}</string>`
    );
    expect(
      renderLinuxAutostartEntry("Rekna", [
        "/opt/rekna/rekna",
        "--profile",
        "default",
        LOGIN_LAUNCH_FLAG,
      ])
    ).toContain(`Exec="/opt/rekna/rekna" "--profile" "default" "${LOGIN_LAUNCH_FLAG}"`);
    expect(
      buildWindowsStartupValue([
        "C:\\Program Files\\Rekna\\Rekna.exe",
        "--profile",
        "default",
        LOGIN_LAUNCH_FLAG,
      ])
    ).toBe(
      `"C:\\Program Files\\Rekna\\Rekna.exe" "--profile" "default" "${LOGIN_LAUNCH_FLAG}"`
    );
  });

  test("serializes macOS launch agent sync work without blocking startup", async () => {
    const launchAgentPath = join(
      homedir(),
      "Library",
      "LaunchAgents",
      "dev.fabianurbanek.linea.plist"
    );
    const calls: string[][] = [];
    let resolveFirstCommand: (() => void) | undefined;
    const runCommand = mock((command: string[]) => {
      calls.push(command);

      if (calls.length === 1) {
        return new Promise<void>((resolve) => {
          resolveFirstCommand = resolve;
        });
      }

      return Promise.resolve();
    });

    const firstSync = syncLaunchOnLogin(
      {
        appName: "Rekna",
        command: ["/Applications/Rekna.app/Contents/MacOS/launcher"],
        enabled: true,
        identifier: "dev.fabianurbanek.linea",
        platform: "darwin",
      },
      { runCommand }
    );
    const secondSync = syncLaunchOnLogin(
      {
        appName: "Rekna",
        command: ["/Applications/Rekna.app/Contents/MacOS/launcher"],
        enabled: false,
        identifier: "dev.fabianurbanek.linea",
        platform: "darwin",
      },
      { runCommand }
    );

    expect(firstSync).toBeInstanceOf(Promise);
    await Promise.resolve();
    expect(calls).toEqual([["launchctl", "unload", launchAgentPath]]);

    if (resolveFirstCommand) {
      resolveFirstCommand();
    }

    await firstSync;
    await secondSync;

    expect(calls).toEqual([
      ["launchctl", "unload", launchAgentPath],
      ["launchctl", "load", launchAgentPath],
      ["launchctl", "unload", launchAgentPath],
    ]);
  });
});
