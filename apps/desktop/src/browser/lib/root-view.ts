import type { DesktopWindowContext } from "@linea/shared";

import { isCompletionOverlayWindow } from "./runtime-flags";

type RootViewOptions = {
  hash: string;
  hasElectrobunRuntime: boolean;
  search: string;
  windowContext?: DesktopWindowContext | null;
};

export function resolveRootView({
  hash,
  hasElectrobunRuntime,
  search,
  windowContext,
}: RootViewOptions) {
  if (windowContext?.mode === "completion-overlay") {
    return "completion-overlay";
  }

  if (isCompletionOverlayWindow(search, hash)) {
    return "completion-overlay";
  }

  return hasElectrobunRuntime ? "app" : "website";
}
