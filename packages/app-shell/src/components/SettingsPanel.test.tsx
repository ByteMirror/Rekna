import { describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost",
});

const { window } = dom;

Object.assign(globalThis, {
  CustomEvent: window.CustomEvent,
  document: window.document,
  DocumentFragment: window.DocumentFragment,
  Element: window.Element,
  Event: window.Event,
  getComputedStyle: window.getComputedStyle.bind(window),
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  MutationObserver: window.MutationObserver,
  Node: window.Node,
  NodeFilter: window.NodeFilter,
  navigator: window.navigator,
  SVGElement: window.SVGElement,
  window,
  Window: window.Window,
});
globalThis.getSelection = window.getSelection.bind(window);
globalThis.self = window;

Object.assign(window.HTMLElement.prototype, {
  attachEvent() {},
  detachEvent() {},
});

describe("SettingsPanel", () => {
  test("shows a theme mode selector with system as an available option", async () => {
    try {
      const { SettingsPanel } = await import("./SettingsPanel");
      const { getByRole, queryByLabelText } = render(
        <SettingsPanel
          desktopSettings={{
            keepRunningAfterWindowClose: true,
            launchOnLogin: false,
          }}
          onBack={() => {}}
          onCarryRoundedValuesChange={() => {}}
          onClose={() => {}}
          onDecimalSeparatorChange={() => {}}
          onFontModeChange={() => {}}
          onKeepRunningAfterCloseChange={() => {}}
          onLaunchOnLoginChange={() => {}}
          onOpenWorkspaceFolder={() => {}}
          onPrecisionChange={() => {}}
          onThemeModeChange={() => {}}
          settings={{
            carryRoundedValues: false,
            decimalSeparator: "dot",
            fontMode: "dynamic",
            precision: 2,
            themeMode: "system",
          }}
          workspaceActionError={null}
          workspaceActionState={null}
          workspaceSelection={null}
        />,
        {
          container: window.document.body,
        }
      );

      expect(queryByLabelText("Night mode")).toBeNull();
      expect(
        getByRole("combobox", { name: "Theme mode" }).textContent
      ).toContain("System");
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("does not show a send feedback action", async () => {
    try {
      const { SettingsPanel } = await import("./SettingsPanel");
      const { queryByRole, queryByText } = render(
        <SettingsPanel
          desktopSettings={{
            keepRunningAfterWindowClose: true,
            launchOnLogin: false,
          }}
          onBack={() => {}}
          onCarryRoundedValuesChange={() => {}}
          onClose={() => {}}
          onDecimalSeparatorChange={() => {}}
          onFontModeChange={() => {}}
          onKeepRunningAfterCloseChange={() => {}}
          onLaunchOnLoginChange={() => {}}
          onThemeModeChange={() => {}}
          onOpenWorkspaceFolder={() => {}}
          onPrecisionChange={() => {}}
          settings={{
            carryRoundedValues: false,
            decimalSeparator: "dot",
            fontMode: "dynamic",
            precision: 2,
            themeMode: "light",
          }}
          workspaceActionError={null}
          workspaceActionState={null}
          workspaceSelection={null}
        />,
        {
          container: window.document.body,
        }
      );

      expect(queryByRole("link", { name: "Send feedback" })).toBeNull();
      expect(queryByText("Send feedback")).toBeNull();
      expect(
        queryByText(
          "Switch Rekna to a different workspace folder or create a fresh one."
        )
      ).toBeNull();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });

  test("uses a single workspace folder action without a name input", async () => {
    try {
      const { SettingsPanel } = await import("./SettingsPanel");
      const { getByRole, queryByRole } = render(
        <SettingsPanel
          desktopSettings={{
            keepRunningAfterWindowClose: true,
            launchOnLogin: false,
          }}
          onBack={() => {}}
          onCarryRoundedValuesChange={() => {}}
          onClose={() => {}}
          onDecimalSeparatorChange={() => {}}
          onFontModeChange={() => {}}
          onKeepRunningAfterCloseChange={() => {}}
          onLaunchOnLoginChange={() => {}}
          onThemeModeChange={() => {}}
          onOpenWorkspaceFolder={() => {}}
          onPrecisionChange={() => {}}
          settings={{
            carryRoundedValues: false,
            decimalSeparator: "dot",
            fontMode: "dynamic",
            precision: 2,
            themeMode: "light",
          }}
          workspaceActionError={null}
          workspaceActionState={null}
          workspaceSelection={{
            name: "Client work",
            path: "/tmp/client-work",
          }}
        />,
        {
          container: window.document.body,
        }
      );

      expect(
        getByRole("button", { name: "Choose workspace folder" })
      ).not.toBeNull();
      expect(queryByRole("button", { name: "Create workspace" })).toBeNull();
      expect(queryByRole("textbox", { name: "New workspace name" })).toBeNull();
    } finally {
      cleanup();
      window.document.body.innerHTML = "";
    }
  });
});
