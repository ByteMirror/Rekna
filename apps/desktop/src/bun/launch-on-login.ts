import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const LOGIN_LAUNCH_FLAG = "--launch-on-login";

type SyncLaunchOnLoginOptions = {
  appName: string;
  command: string[];
  enabled: boolean;
  identifier: string;
  platform: NodeJS.Platform;
};

type CommandRunner = (command: string[]) => Promise<void>;

let launchOnLoginSyncQueue = Promise.resolve();

export function shouldLaunchHidden(argv: string[]) {
  return argv.includes(LOGIN_LAUNCH_FLAG);
}

export function appendLaunchOnLoginFlag(command: string[]) {
  const withoutFlag = command.filter((part) => part !== LOGIN_LAUNCH_FLAG);
  return [...withoutFlag, LOGIN_LAUNCH_FLAG];
}

export function buildWindowsStartupValue(command: string[]) {
  return command.map(quoteCommandPart).join(" ");
}

export function renderMacLaunchAgentPlist(
  identifier: string,
  command: string[]
) {
  const programArguments = command
    .map((part) => `    <string>${escapeXml(part)}</string>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${escapeXml(identifier)}</string>
    <key>ProgramArguments</key>
    <array>
${programArguments}
    </array>
    <key>RunAtLoad</key>
    <true/>
  </dict>
</plist>
`;
}

export function renderLinuxAutostartEntry(name: string, command: string[]) {
  return [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${name}`,
    `Exec=${command.map(quoteCommandPart).join(" ")}`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    "",
  ].join("\n");
}

export function resolveLaunchCommand(execPath: string, argv: string[]) {
  return appendLaunchOnLoginFlag([execPath, ...argv.slice(1)]);
}

export function syncLaunchOnLogin(
  options: SyncLaunchOnLoginOptions,
  { runCommand = runCommandInBackground }: { runCommand?: CommandRunner } = {}
) {
  const nextSync = launchOnLoginSyncQueue.then(() =>
    syncLaunchOnLoginNow(options, runCommand)
  );

  launchOnLoginSyncQueue = nextSync.catch(() => {});
  return nextSync;
}

async function syncLaunchOnLoginNow(
  {
    appName,
    command,
    enabled,
    identifier,
    platform,
  }: SyncLaunchOnLoginOptions,
  runCommand: CommandRunner
) {
  if (platform === "darwin") {
    const launchAgentPath = join(
      homedir(),
      "Library",
      "LaunchAgents",
      `${identifier}.plist`
    );

    mkdirSync(dirname(launchAgentPath), { recursive: true });

    if (!enabled) {
      await runCommand(["launchctl", "unload", launchAgentPath]);
      rmSync(launchAgentPath, { force: true });
      return;
    }

    writeFileSync(
      launchAgentPath,
      renderMacLaunchAgentPlist(identifier, command),
      "utf8"
    );
    await runCommand(["launchctl", "unload", launchAgentPath]);
    await runCommand(["launchctl", "load", launchAgentPath]);
    return;
  }

  if (platform === "linux") {
    const autostartPath = join(
      homedir(),
      ".config",
      "autostart",
      `${identifier}.desktop`
    );

    mkdirSync(dirname(autostartPath), { recursive: true });

    if (!enabled) {
      rmSync(autostartPath, { force: true });
      return;
    }

    writeFileSync(
      autostartPath,
      renderLinuxAutostartEntry(appName, command),
      "utf8"
    );
    return;
  }

  if (platform === "win32") {
    const registryKey =
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

    if (!enabled) {
      await runCommand(["reg", "delete", registryKey, "/v", appName, "/f"]);
      return;
    }

    await runCommand([
      "reg",
      "add",
      registryKey,
      "/v",
      appName,
      "/t",
      "REG_SZ",
      "/d",
      buildWindowsStartupValue(command),
      "/f",
    ]);
  }
}

async function runCommandInBackground(command: string[]) {
  const subprocess = Bun.spawn(command, {
    stderr: "pipe",
    stdout: "ignore",
  });
  const stderr = await readStreamText(subprocess.stderr);
  const exitCode = await subprocess.exited;

  if (exitCode !== 0 && stderr.trim()) {
    console.warn(stderr.trim());
  }
}

function readStreamText(stream: ReadableStream<Uint8Array> | null | undefined) {
  if (!stream) {
    return Promise.resolve("");
  }

  return new Response(stream).text();
}

function quoteCommandPart(part: string) {
  const escaped = part.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
