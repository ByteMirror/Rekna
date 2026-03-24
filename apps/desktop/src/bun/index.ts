import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  BuildConfig,
  Screen,
  Updater,
  Utils,
} from "electrobun/bun";

import {
  type DesktopSettings,
  type DesktopWindowContext,
  type LineaRPC,
  OPEN_SHEET_SEARCH_EVENT,
  OPEN_SHEET_SEARCH_MENU_ACTION,
  type WorkspaceSelection,
} from "@linea/shared";
import desktopConfig from "../../electrobun.config";
import { buildRuntimeFlagSuffix } from "../browser/lib/runtime-flags";
import { buildApplicationMenu } from "./application-menu";
import { CompletionOverlayManager } from "./completion-overlay-manager";
import {
  resolveLaunchCommand,
  shouldLaunchHidden,
  syncLaunchOnLogin,
} from "./launch-on-login";
import {
  createStorageForWorkspace,
  openWorkspaceDirectory,
  pickWorkspaceDirectory,
  readWorkspaceSelection,
  writeWorkspaceSelection,
} from "./workspace-selection";
import { shouldUseNativeCompletionOverlay } from "./native-completion-overlay";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const NATIVE_COMPLETION_OVERLAY_ENABLED =
  shouldUseNativeCompletionOverlay(process.platform) &&
  process.env.LINEA_DISABLE_NATIVE_COMPLETION_OVERLAY !== "1";
const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  keepRunningAfterWindowClose: false,
  launchOnLogin: false,
};

mkdirSync(Utils.paths.userData, { recursive: true });

const workspacePreferencesPath = join(Utils.paths.userData, "workspace.json");
let workspaceSelection = readWorkspaceSelection(workspacePreferencesPath);
let storage = createStorage(workspaceSelection);
let desktopSettings = storage?.getDesktopSettings() ?? DEFAULT_DESKTOP_SETTINGS;

ApplicationMenu.setApplicationMenu(
  buildApplicationMenu(desktopConfig.app.name, process.platform)
);

async function getMainViewUrl(mode: "completion-overlay" | "main" = "main") {
  const channel = await Updater.localInfo.channel();
  const flagOptions = {
    mode,
    nativeCompletionOverlayEnabled: NATIVE_COMPLETION_OVERLAY_ENABLED,
  } as const;

  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      return `${DEV_SERVER_URL}${buildRuntimeFlagSuffix(flagOptions)}`;
    } catch {
      // Fall through to bundled assets.
    }
  }

  return "views://mainview/index.html";
}

function getWindowContext(
  mode: DesktopWindowContext["mode"]
): DesktopWindowContext {
  return {
    mode,
    nativeCompletionOverlayEnabled: NATIVE_COMPLETION_OVERLAY_ENABLED,
  };
}

function configureWindowCloseBehavior(settings: DesktopSettings) {
  return BuildConfig.get().then((buildConfig) => {
    buildConfig.runtime = {
      ...buildConfig.runtime,
      exitOnLastWindowClosed: !settings.keepRunningAfterWindowClose,
    };
  });
}

function applyDesktopSettings(settings: DesktopSettings) {
  void configureWindowCloseBehavior(settings);
  void syncLaunchOnLogin({
    appName: desktopConfig.app.name,
    command: resolveLaunchCommand(process.execPath, process.argv),
    enabled: settings.launchOnLogin,
    identifier: desktopConfig.app.identifier,
    platform: process.platform,
  });
}

function getDisplayForWindowFrame(frame: BrowserWindow["frame"]) {
  const displays = Screen.getAllDisplays();
  const frameCenterX = frame.x + frame.width / 2;
  const frameCenterY = frame.y + frame.height / 2;

  for (const display of displays) {
    const withinX =
      frameCenterX >= display.bounds.x &&
      frameCenterX <= display.bounds.x + display.bounds.width;
    const withinY =
      frameCenterY >= display.bounds.y &&
      frameCenterY <= display.bounds.y + display.bounds.height;

    if (withinX && withinY) {
      return display;
    }
  }

  const primaryDisplay = Screen.getPrimaryDisplay();

  return primaryDisplay.workArea.width > 0 ? primaryDisplay : null;
}

async function createMainWindow({ hidden = false } = {}) {
  return new BrowserWindow({
    title: desktopConfig.app.name,
    url: await getMainViewUrl(),
    rpc: mainRpc,
    titleBarStyle: "hiddenInset",
    hidden,
    frame: {
      width: 520,
      height: 900,
      x: 220,
      y: 80,
    },
  });
}

async function createCompletionOverlayWindow() {
  const overlayWindow = new BrowserWindow({
    title: `${desktopConfig.app.name} Overlay`,
    url: await getMainViewUrl("completion-overlay"),
    rpc: overlayRpc,
    titleBarStyle: "hidden",
    transparent: true,
    passthrough: true,
    frame: {
      width: 1,
      height: 1,
      x: -10_000,
      y: -10_000,
    },
    styleMask: {
      Borderless: true,
      Titled: false,
      Closable: false,
      Miniaturizable: false,
      Resizable: false,
      FullSizeContentView: true,
      UtilityWindow: true,
      NonactivatingPanel: true,
      HUDWindow: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true);
  return overlayWindow;
}

let completionOverlayManager: CompletionOverlayManager | null = null;

const mainRpc = BrowserView.defineRPC<LineaRPC>({
  maxRequestTime: 15_000,
  handlers: {
    requests: {
      bootstrap: () => {
        return getStorageOrThrow().bootstrap();
      },
      getDesktopSettings: () => {
        return storage?.getDesktopSettings() ?? DEFAULT_DESKTOP_SETTINGS;
      },
      getWorkspaceSelection: () => {
        return workspaceSelection;
      },
      updateDesktopSettings: (settings: DesktopSettings) => {
        if (!storage) {
          desktopSettings = settings;
          return desktopSettings;
        }

        desktopSettings = storage.updateDesktopSettings(settings);

        if (mainWindow && BrowserWindow.getById(mainWindow.id)) {
          applyDesktopSettings(desktopSettings);
        }

        return desktopSettings;
      },
      createSheet: ({ title }: { title?: string }) => {
        return getStorageOrThrow().createSheet({ body: "", title });
      },
      deleteSheet: ({ id }: { id: string }) => {
        return getStorageOrThrow().deleteSheet(id);
      },
      markSheetOpened: ({ id }: { id: string }) => {
        return getStorageOrThrow().markSheetOpened(id);
      },
      listSheets: () => {
        return getStorageOrThrow().listSheets();
      },
      renameSheet: ({ id, title }: { id: string; title: string }) => {
        return getStorageOrThrow().renameSheet(id, title);
      },
      searchSheets: ({ query, tags }: { query: string; tags?: string[] }) => {
        return getStorageOrThrow().searchSheets(query, tags);
      },
      openWorkspaceFolder: () => {
        const workspacePath = pickWorkspaceDirectory({
          prompt: "Choose a folder for your Rekna workspace",
        });

        if (!workspacePath) {
          return null;
        }

        const selection = openWorkspaceDirectory(workspacePath);
        setWorkspaceSelection(selection);
        return selection;
      },
      getWindowContext: () => {
        return getWindowContext("main");
      },
      updateSheet: ({
        body,
        id,
        title,
      }: {
        body: string;
        id: string;
        title?: string;
      }) => {
        return getStorageOrThrow().updateSheet({ body, id, title });
      },
    },
    messages: {
      updateCompletionOverlay: (update) => {
        completionOverlayManager?.handleUpdate(update);
      },
    },
  },
});

const overlayRpc = BrowserView.defineRPC<LineaRPC>({
  maxRequestTime: 15_000,
  handlers: {
    requests: {
      getWindowContext: () => {
        return getWindowContext("completion-overlay");
      },
    },
    messages: {
      completionOverlayReady: () => {
        completionOverlayManager?.handleReady();
      },
    },
  },
});

let mainWindow = await createMainWindow({
  hidden: shouldLaunchHidden(process.argv),
});
completionOverlayManager = NATIVE_COMPLETION_OVERLAY_ENABLED
  ? new CompletionOverlayManager(
      mainWindow,
      createCompletionOverlayWindow,
      getDisplayForWindowFrame
    )
  : null;

ApplicationMenu.on("application-menu-clicked", (event) => {
  const action = (event as { data?: { action?: string } } | undefined)?.data
    ?.action;

  if (action !== OPEN_SHEET_SEARCH_MENU_ACTION) {
    return;
  }

  const activeMainWindow = BrowserWindow.getById(mainWindow.id);
  if (!activeMainWindow) {
    return;
  }

  activeMainWindow.show();
  activeMainWindow.webview.stopFindInPage();
  activeMainWindow.webview.executeJavascript(
    `window.dispatchEvent(new CustomEvent(${JSON.stringify(OPEN_SHEET_SEARCH_EVENT)}))`
  );
});

applyDesktopSettings(desktopSettings);

Electrobun.events.on("move", (event) => {
  if (event.data.id === mainWindow.id) {
    completionOverlayManager?.handleMainMove(event.data);
  }
});

Electrobun.events.on("resize", (event) => {
  if (event.data.id === mainWindow.id) {
    completionOverlayManager?.handleMainResize(event.data);
  }
});

Electrobun.events.on("focus", (event) => {
  if (event.data.id === mainWindow.id) {
    completionOverlayManager?.handleMainFocus();
  }
});

Electrobun.events.on("blur", (event) => {
  if (event.data.id === mainWindow.id) {
    completionOverlayManager?.handleMainBlur();
  }
});

Electrobun.events.on("close", (event) => {
  if (event.data.id === mainWindow.id) {
    completionOverlayManager?.close();
    completionOverlayManager = null;
  }
});

Electrobun.events.on("reopen", () => {
  if (BrowserWindow.getById(mainWindow.id)) {
    mainWindow.show();
    return;
  }

  void createMainWindow().then((window) => {
    mainWindow = window;
    applyDesktopSettings(desktopSettings);
    completionOverlayManager = NATIVE_COMPLETION_OVERLAY_ENABLED
      ? new CompletionOverlayManager(
          mainWindow,
          createCompletionOverlayWindow,
          getDisplayForWindowFrame
        )
      : null;
  });
});

console.log("Rekna started");
console.log(
  `Workspace path: ${workspaceSelection?.path ?? "No workspace selected"}`
);

function createStorage(selection: WorkspaceSelection | null) {
  if (!selection) {
    return null;
  }

  return createStorageForWorkspace(selection);
}

function getStorageOrThrow() {
  if (!storage) {
    throw new Error("Choose a workspace before opening Rekna.");
  }

  return storage;
}

function setWorkspaceSelection(selection: WorkspaceSelection | null) {
  storage?.close();
  workspaceSelection = selection;
  writeWorkspaceSelection(workspacePreferencesPath, selection);
  storage = createStorage(selection);
  desktopSettings = storage?.getDesktopSettings() ?? DEFAULT_DESKTOP_SETTINGS;
  applyDesktopSettings(desktopSettings);
}
