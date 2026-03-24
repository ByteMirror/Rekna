import { describe, expect, mock, test } from "bun:test";
import type { BrowserWindow, Display } from "electrobun/bun";

import type { CompletionOverlayUpdate } from "@linea/shared";

import { CompletionOverlayManager } from "./completion-overlay-manager";

const MAIN_WINDOW_FRAME = {
  x: 220,
  y: 80,
  width: 520,
  height: 900,
};

function createUpdate(
  overrides: Partial<CompletionOverlayUpdate> = {}
): CompletionOverlayUpdate {
  return {
    visible: true,
    theme: "dark",
    items: [{ label: "sum", detail: "Block total", type: "function" }],
    selectedIndex: 0,
    info: {
      title: "sum",
      detail: "Block total",
      body: "Returns the total of the consecutive evaluated rows directly above this line.",
    },
    infoSide: "right",
    infoWidth: 280,
    listWidth: 280,
    frame: {
      x: 182,
      y: 168,
      width: 560,
      height: 214,
    },
    ...overrides,
  };
}

function createMainWindow() {
  return {
    frame: { ...MAIN_WINDOW_FRAME },
  } as unknown as BrowserWindow;
}

function createOverlayWindow() {
  return {
    close: mock(() => {}),
    setFrame: mock(() => {}),
    webview: {
      rpc: {
        send: {
          renderCompletionOverlay: mock((_payload: unknown) => {}),
        },
      },
    },
  } as unknown as BrowserWindow;
}

describe("CompletionOverlayManager", () => {
  test("does not create the native overlay window for hidden updates", async () => {
    const mainWindow = createMainWindow();
    const createWindow = mock(async () => createOverlayWindow());
    const manager = new CompletionOverlayManager(
      mainWindow,
      createWindow,
      () => null
    );

    manager.handleUpdate(
      createUpdate({ frame: null, info: null, infoWidth: null, visible: false })
    );
    await Promise.resolve();

    expect(createWindow).not.toHaveBeenCalled();
  });

  test("creates the native overlay window on the first visible update", async () => {
    const mainWindow = createMainWindow();
    const overlayWindow = createOverlayWindow();
    const createWindow = mock(async () => overlayWindow);
    const manager = new CompletionOverlayManager(
      mainWindow,
      createWindow,
      () =>
        ({
          bounds: { x: 0, y: 0, width: 1280, height: 900 },
          id: 1,
          isPrimary: true,
          scaleFactor: 1,
          workArea: { x: 0, y: 0, width: 1280, height: 900 },
        }) satisfies Display
    );

    manager.handleUpdate(createUpdate());
    await Promise.resolve();
    await Promise.resolve();

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(overlayWindow.setFrame).toHaveBeenLastCalledWith(402, 248, 650, 214);
  });

  test("applies the latest pending update once lazy creation finishes", async () => {
    const mainWindow = createMainWindow();
    const overlayWindow = createOverlayWindow();
    const deferredWindow: {
      resolve: ((window: BrowserWindow) => void) | null;
    } = {
      resolve: null,
    };
    const createWindow = mock(
      () =>
        new Promise<BrowserWindow>((resolve) => {
          deferredWindow.resolve = resolve;
        })
    );
    const manager = new CompletionOverlayManager(
      mainWindow,
      createWindow,
      () => null
    );

    manager.handleUpdate(createUpdate());
    manager.handleUpdate(
      createUpdate({ frame: null, info: null, infoWidth: null, visible: false })
    );
    if (!deferredWindow.resolve) {
      throw new Error("Overlay creation promise was not captured");
    }

    deferredWindow.resolve(overlayWindow);
    await Promise.resolve();
    await Promise.resolve();

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(overlayWindow.setFrame).toHaveBeenLastCalledWith(
      -10000,
      -10000,
      1,
      1
    );
  });
});
