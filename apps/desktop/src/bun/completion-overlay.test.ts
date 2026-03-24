import { describe, expect, mock, test } from "bun:test";
import type { BrowserWindow } from "electrobun/bun";
import type { Display } from "electrobun/bun";

import type { CompletionOverlayUpdate } from "@linea/shared";

import { CompletionOverlayController } from "./completion-overlay";

describe("CompletionOverlayController", () => {
  test("treats overlay frames from the renderer as relative to the main window", () => {
    const setFrame = mock(() => {});
    const renderCompletionOverlay = mock((_payload: unknown) => {});
    const mainWindow = {
      frame: { x: 220, y: 80, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay,
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow
    );

    controller.handleReady();
    controller.handleUpdate({
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
    });

    const lastCall = setFrame.mock.calls.at(-1) as
      | [number, number, number, number]
      | undefined;

    expect(lastCall?.[0]).toBe(402);
    expect(lastCall?.[1]).toBe(248);
    expect(lastCall?.[2]).toBe(560);
    expect(lastCall?.[3]).toBe(214);
  });

  test("moves the overlay together with the main window after an update", () => {
    const setFrame = mock(() => {});
    const renderCompletionOverlay = mock((_payload: unknown) => {});
    const mainWindow = {
      frame: { x: 220, y: 80, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay,
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow
    );
    const update: CompletionOverlayUpdate = {
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
        x: 210,
        y: 170,
        width: 560,
        height: 214,
      },
    };

    controller.handleReady();
    controller.handleUpdate(update);
    controller.handleMainMove({ x: 300, y: 120 });

    expect(renderCompletionOverlay).toHaveBeenCalledTimes(2);
    expect(setFrame).toHaveBeenCalledTimes(3);
    const lastCall = setFrame.mock.calls.at(-1) as
      | [number, number, number, number]
      | undefined;

    expect(lastCall?.[0]).toBe(510);
    expect(lastCall?.[1]).toBe(290);
    expect(lastCall?.[2]).toBe(560);
    expect(lastCall?.[3]).toBe(214);
  });

  test("moves the overlay offscreen when the main window blurs", () => {
    const setFrame = mock(() => {});
    const mainWindow = {
      frame: { x: 220, y: 80, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay: mock((_payload: unknown) => {}),
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow
    );

    controller.handleUpdate({
      visible: true,
      theme: "dark",
      items: [{ label: "sum", type: "function" }],
      selectedIndex: 0,
      info: null,
      infoSide: "right",
      infoWidth: null,
      listWidth: 250,
      frame: {
        x: 420,
        y: 220,
        width: 250,
        height: 120,
      },
    });
    controller.handleMainBlur();

    const lastCall = setFrame.mock.calls.at(-1) as
      | [number, number, number, number]
      | undefined;

    expect(lastCall?.[0]).toBe(-10000);
    expect(lastCall?.[1]).toBe(-10000);
    expect(lastCall?.[2]).toBe(1);
    expect(lastCall?.[3]).toBe(1);
  });

  test("restores the overlay when the main window regains focus", () => {
    const setFrame = mock(() => {});
    const mainWindow = {
      frame: { x: 220, y: 80, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay: mock((_payload: unknown) => {}),
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow
    );

    controller.handleUpdate({
      visible: true,
      theme: "dark",
      items: [{ label: "sum", type: "function" }],
      selectedIndex: 0,
      info: null,
      infoSide: "right",
      infoWidth: null,
      listWidth: 250,
      frame: {
        x: 210,
        y: 170,
        width: 250,
        height: 120,
      },
    });
    setFrame.mockClear();
    controller.handleMainBlur();
    setFrame.mockClear();

    controller.handleMainFocus();

    expect(setFrame).toHaveBeenCalledWith(430, 250, 250, 120);
  });

  test("clamps the visible overlay frame to the current display work area", () => {
    const setFrame = mock(() => {});
    const mainWindow = {
      frame: { x: 500, y: 80, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay: mock((_payload: unknown) => {}),
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow,
      () =>
        ({
          bounds: { x: 0, y: 0, width: 1200, height: 900 },
          id: 1,
          isPrimary: true,
          scaleFactor: 1,
          workArea: { x: 0, y: 0, width: 900, height: 700 },
        }) satisfies Display
    );

    controller.handleUpdate({
      visible: true,
      theme: "dark",
      items: [{ label: "sum", type: "function" }],
      selectedIndex: 0,
      info: null,
      infoSide: "right",
      infoWidth: null,
      listWidth: 250,
      frame: {
        x: 560,
        y: 640,
        width: 320,
        height: 180,
      },
    });

    expect(setFrame).toHaveBeenLastCalledWith(580, 520, 320, 180);
  });

  test("flips the docs panel to the opposite side when the current side would be cut off", () => {
    const setFrame = mock(() => {});
    const renderCompletionOverlay = mock((_payload: unknown) => {});
    const mainWindow = {
      frame: { x: 700, y: 80, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay,
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow,
      () =>
        ({
          bounds: { x: 0, y: 0, width: 1280, height: 900 },
          id: 1,
          isPrimary: true,
          scaleFactor: 1,
          workArea: { x: 0, y: 0, width: 1280, height: 900 },
        }) satisfies Display
    );

    controller.handleReady();
    controller.handleUpdate({
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
        x: 140,
        y: 168,
        width: 650,
        height: 214,
      },
    });

    expect(renderCompletionOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({
        infoSide: "left",
        infoWidth: 280,
      })
    );
    expect(setFrame).toHaveBeenLastCalledWith(550, 248, 650, 214);
  });

  test("stacks the docs panel below the list when neither side can fit it", () => {
    const setFrame = mock(() => {});
    const renderCompletionOverlay = mock((_payload: unknown) => {});
    const mainWindow = {
      frame: { x: 0, y: 0, width: 520, height: 900 },
    } as unknown as BrowserWindow;
    const overlayWindow = {
      setFrame,
      webview: {
        rpc: {
          send: {
            renderCompletionOverlay,
          },
        },
      },
    } as unknown as BrowserWindow;
    const controller = new CompletionOverlayController(
      mainWindow,
      overlayWindow,
      () =>
        ({
          bounds: { x: 0, y: 0, width: 600, height: 900 },
          id: 1,
          isPrimary: true,
          scaleFactor: 1,
          workArea: { x: 0, y: 0, width: 600, height: 900 },
        }) satisfies Display
    );

    controller.handleReady();
    controller.handleUpdate({
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
        x: 130,
        y: 200,
        width: 650,
        height: 214,
      },
    });

    expect(renderCompletionOverlay).toHaveBeenLastCalledWith(
      expect.objectContaining({
        infoSide: "bottom",
        infoWidth: 280,
      })
    );
    expect(setFrame).toHaveBeenLastCalledWith(130, 200, 360, 318);
  });
});
