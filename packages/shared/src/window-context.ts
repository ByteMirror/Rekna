import type { DesktopWindowContext } from "./rpc";

const DESKTOP_WINDOW_CONTEXT_KEY = "__lineaDesktopWindowContext";

type DesktopWindowGlobal = typeof globalThis & {
  [DESKTOP_WINDOW_CONTEXT_KEY]?: DesktopWindowContext;
};

export function getDesktopWindowContext() {
  return (globalThis as DesktopWindowGlobal)[DESKTOP_WINDOW_CONTEXT_KEY] ?? null;
}

export function setDesktopWindowContext(
  context: DesktopWindowContext | null
) {
  const target = globalThis as DesktopWindowGlobal;

  if (context) {
    target[DESKTOP_WINDOW_CONTEXT_KEY] = context;
    return;
  }

  delete target[DESKTOP_WINDOW_CONTEXT_KEY];
}
