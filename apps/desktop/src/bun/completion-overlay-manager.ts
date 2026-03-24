import type { BrowserWindow, Display } from "electrobun/bun";

import type { CompletionOverlayUpdate } from "@linea/shared";

import { CompletionOverlayController } from "./completion-overlay";

export class CompletionOverlayManager {
  private controller: CompletionOverlayController | null = null;
  private createControllerPromise: Promise<CompletionOverlayController | null> | null =
    null;
  private pendingUpdate: CompletionOverlayUpdate | null = null;

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly createOverlayWindow: () => Promise<BrowserWindow>,
    private readonly resolveDisplayForFrame: (
      frame: BrowserWindow["frame"]
    ) => Display | null = () => null
  ) {}

  handleUpdate(update: CompletionOverlayUpdate) {
    if (this.controller) {
      this.controller.handleUpdate(update);
      return;
    }

    this.pendingUpdate = update;

    if (!update.visible) {
      return;
    }

    void this.ensureController();
  }

  handleReady() {
    this.controller?.handleReady();
  }

  handleMainBlur() {
    this.controller?.handleMainBlur();
  }

  handleMainFocus() {
    this.controller?.handleMainFocus();
  }

  handleMainMove(position: { x: number; y: number }) {
    this.controller?.handleMainMove(position);
  }

  handleMainResize(frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    this.controller?.handleMainResize(frame);
  }

  close() {
    this.pendingUpdate = null;
    this.controller?.close();
    this.controller = null;
  }

  private async ensureController() {
    if (this.controller) {
      return this.controller;
    }

    if (!this.createControllerPromise) {
      this.createControllerPromise = this.createOverlayWindow()
        .then((overlayWindow) => {
          const controller = new CompletionOverlayController(
            this.mainWindow,
            overlayWindow,
            this.resolveDisplayForFrame
          );

          this.controller = controller;
          this.flushPendingUpdate();
          return controller;
        })
        .finally(() => {
          this.createControllerPromise = null;
        });
    }

    return this.createControllerPromise;
  }

  private flushPendingUpdate() {
    if (!this.controller || !this.pendingUpdate) {
      return;
    }

    const update = this.pendingUpdate;
    this.pendingUpdate = null;
    this.controller.handleUpdate(update);
  }
}
