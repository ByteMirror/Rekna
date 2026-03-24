import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import { App, CompletionOverlayApp, Website } from "@linea/app-shell";
import "@linea/app-shell/styles.css";
import { setDesktopWindowContext } from "@linea/shared";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { getElectrobun } from "./lib/rpc";
import { resolveRootView } from "./lib/root-view";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

async function bootstrap() {
  const electrobun = getElectrobun();
  const rpc = electrobun?.rpc;
  const windowContext = rpc ? await rpc.request.getWindowContext({}) : null;

  setDesktopWindowContext(windowContext);

  const rootView = resolveRootView({
    hash: window.location.hash,
    hasElectrobunRuntime: electrobun !== null,
    search: window.location.search,
    windowContext,
  });

  createRoot(rootElement!).render(
    <StrictMode>
      {rootView === "completion-overlay" ? (
        <CompletionOverlayApp />
      ) : rootView === "app" ? (
        <App />
      ) : (
        <Website />
      )}
    </StrictMode>
  );
}

void bootstrap();
