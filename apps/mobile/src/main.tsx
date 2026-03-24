import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@linea/app-shell/styles.css";
import { App } from "@linea/app-shell";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createFilesystemMobileRequest } from "./request";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

const request = createFilesystemMobileRequest();

createRoot(rootElement).render(
  <StrictMode>
    <App request={request} />
  </StrictMode>
);
