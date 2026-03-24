import { afterEach, describe, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { JSDOM } from "jsdom";
import { REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL } from "@linea/shared";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
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
  HTMLAnchorElement: window.HTMLAnchorElement,
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

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

afterEach(() => {
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
    writable: true,
  });
});

describe("Website", () => {
  test("prefers the detected platform for the primary download CTA and exposes all variants", async () => {
    window.history.replaceState({}, "", "/");
    setNavigatorSnapshot({
      platform: "MacIntel",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    });

    try {
      const { Website } = await import("./Website");
      const { getByRole, getByTestId, findByTestId } = render(<Website />, {
        container: window.document.body,
      });

      expect(getByTestId("download-section")).toBeTruthy();
      expect(
        getByTestId("download-grid").className.includes("lg:items-center")
      ).toBe(true);
      expect(
        getByTestId("download-grid").className.includes(
          "lg:grid-cols-[minmax(0,1fr)_20rem]"
        )
      ).toBe(true);
      expect(
        getByTestId("download-copy-column").className.includes("justify-center")
      ).toBe(true);
      expect(
        getByTestId("download-page-icon-shell").className.includes(
          "lg:justify-end"
        )
      ).toBe(true);
      expect(getByTestId("download-cta").textContent).toContain(
        "Download for macOS (Apple Silicon)"
      );
      expect(getByTestId("download-cta").getAttribute("href")).toBe(
        `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/stable-macos-arm64-Rekna.dmg`
      );
      expect(getByTestId("detected-download-platform").textContent).toContain(
        "macOS detected"
      );

      await act(async () => {
        fireEvent.pointerDown(
          getByRole("button", { name: "Choose a different download" })
        );
        fireEvent.click(
          getByRole("button", { name: "Choose a different download" })
        );
      });

      expect(
        (await findByTestId("download-option-macos-arm64")).getAttribute("href")
      ).toBe(
        `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/stable-macos-arm64-Rekna.dmg`
      );
      expect(await findByTestId("download-option-linux-x64")).toBeTruthy();
      expect(
        window.document.querySelector('[data-testid="download-option-macos-x64"]')
      ).toBeNull();
      expect(
        window.document.querySelector(
          '[data-testid="download-option-windows-x64"]'
        )
      ).toBeNull();
    } finally {
      restoreNavigatorSnapshot();
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });

  test("renders the homepage as a minimal feature carousel with three vertical tabs", async () => {
    window.history.replaceState({}, "", "/");

    try {
      const { Website } = await import("./Website");
      const { container, getAllByText, getByRole, getByTestId, getByText } =
        render(<Website featureCycleMs={1000} />, {
          container: window.document.body,
        });
      const websiteShell = container.firstElementChild as HTMLDivElement;
      const featureColumn = getByTestId("feature-column");
      const featureTabsShell = getByTestId("feature-tabs-shell");
      const headerIcon = getByRole("img", { name: "Rekna desktop app icon" });
      const tabs = [
        getByRole("tab", { name: "Units and FX" }),
        getByRole("tab", { name: "Sheet memory" }),
        getByRole("tab", { name: "Quiet search" }),
      ];
      const unitsProgress = getByTestId("feature-tab-progress-units-and-fx");
      const memoryProgress = getByTestId("feature-tab-progress-sheet-memory");
      const searchProgress = getByTestId("feature-tab-progress-quiet-search");

      expect(document.body.dataset.rootView).toBe("website");
      expect(websiteShell.style.getPropertyValue("--website-accent")).toBe(
        "var(--primary)"
      );
      expect(headerIcon.className.includes("size-12")).toBe(true);
      expect(getByRole("heading", { level: 1, name: "Rekna" })).toBeTruthy();
      expect(getByText("Plain text. Exact totals.")).toBeTruthy();
      expect(
        getByRole("link", { name: "GitHub" }).getAttribute("href")
      ).toBe("https://github.com/ByteMirror/Rekna");
      const testimonialSection = getByTestId("testimonial-section");
      const testimonialSurface = testimonialSection.children[1] as HTMLElement;

      expect(testimonialSection).toBeTruthy();
      expect(testimonialSurface.className.includes("rounded-[2rem]")).toBe(
        false
      );
      expect(testimonialSurface.className.includes("border")).toBe(false);
      expect(
        testimonialSurface.className.includes(
          "bg-[color-mix(in_oklab,var(--website-surface)_76%,transparent)]"
        )
      ).toBe(false);
      expect(getByText("What People Say")).toBeTruthy();
      expect(
        getByTestId("testimonial-lane-left").getAttribute("data-direction")
      ).toBe("left");
      expect(
        getByTestId("testimonial-lane-right").getAttribute("data-direction")
      ).toBe("right");
      expect(
        getByTestId("testimonial-lane-left").getAttribute("data-paused")
      ).toBe("false");
      expect(
        getByTestId("testimonial-lane-right").getAttribute("data-paused")
      ).toBe("false");
      expect(
        getByTestId(
          "testimonial-card-testimonial-lane-left-consulting-pricing-0"
        ).getAttribute("data-highlighted")
      ).toBe("false");
      expect(
        getAllByText("The fastest way to price ideas").length
      ).toBeGreaterThan(0);
      expect(getAllByText("Fewer spreadsheet handoffs").length).toBeGreaterThan(
        0
      );
      expect(
        getAllByText("Date math finally feels native").length
      ).toBeGreaterThan(0);

      await act(async () => {
        fireEvent.mouseEnter(
          getByTestId(
            "testimonial-card-testimonial-lane-left-consulting-pricing-0"
          )
        );
      });

      expect(
        getByTestId("testimonial-lane-left").getAttribute("data-paused")
      ).toBe("true");
      expect(
        getByTestId("testimonial-lane-right").getAttribute("data-paused")
      ).toBe("false");
      expect(
        getByTestId(
          "testimonial-card-testimonial-lane-left-consulting-pricing-0"
        ).getAttribute("data-highlighted")
      ).toBe("true");
      expect(
        getByTestId(
          "testimonial-card-testimonial-lane-left-consulting-pricing-0"
        ).className.includes("-translate-y-1")
      ).toBe(false);
      expect(
        getByTestId(
          "testimonial-card-testimonial-lane-left-consulting-pricing-0"
        ).className.includes("hover:-translate-y-0.5")
      ).toBe(false);
      expect(
        getByTestId(
          "testimonial-card-testimonial-lane-right-client-pricing-0"
        ).getAttribute("data-highlighted")
      ).toBe("false");

      await act(async () => {
        fireEvent.mouseLeave(
          getByTestId(
            "testimonial-card-testimonial-lane-left-consulting-pricing-0"
          )
        );
      });

      expect(
        getByTestId("testimonial-lane-left").getAttribute("data-paused")
      ).toBe("false");
      expect(
        getByTestId(
          "testimonial-card-testimonial-lane-left-consulting-pricing-0"
        ).getAttribute("data-highlighted")
      ).toBe("false");

      expect(getByTestId("download-section")).toBeTruthy();
      expect(getByRole("link", { name: "Download" }).getAttribute("href")).toBe(
        "#download"
      );
      expect(featureColumn.className.includes("max-w-[21rem]")).toBe(true);
      expect(featureColumn.className.includes("justify-center")).toBe(true);
      expect(featureTabsShell.className.includes("flex-1")).toBe(true);
      expect(featureTabsShell.className.includes("justify-center")).toBe(true);
      expect(featureTabsShell.className.includes("mt-12")).toBe(true);
      expect(getByTestId("feature-tabs").className.includes("flex-col")).toBe(
        true
      );
      expect(getByTestId("feature-tabs").className.includes("gap-5")).toBe(
        true
      );
      expect(tabs[0]?.className.includes("rounded-[1rem]")).toBe(true);
      expect(tabs[0]?.className.includes("items-center")).toBe(true);
      expect(tabs[0]?.className.includes("text-center")).toBe(true);
      expect(tabs[0]?.className.includes("bg-[var(--website-ink)]")).toBe(true);
      expect(tabs[0]?.className.includes("text-[var(--website-bg)]")).toBe(
        true
      );
      expect(tabs[0]?.className.includes("p-4")).toBe(true);
      expect(
        getByTestId("feature-tab-title-units-and-fx").className.includes(
          "text-[1.35rem]"
        )
      ).toBe(true);
      expect(unitsProgress.parentElement?.className.includes("bottom-3")).toBe(
        true
      );
      expect(tabs[0]?.textContent?.trim()).toBe("Units and FX");
      expect(tabs[1]?.textContent?.trim()).toBe("Sheet memory");
      expect(tabs[2]?.textContent?.trim()).toBe("Quiet search");
      expect(tabs[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(unitsProgress.getAttribute("data-active")).toBe("true");
      expect(unitsProgress.style.animationName).toBe("websiteFeatureProgress");
      expect(unitsProgress.style.animationDuration).toBe("1000ms");
      expect(memoryProgress.getAttribute("data-active")).toBe("false");
      expect(searchProgress.getAttribute("data-active")).toBe("false");
      expect(getByTestId("feature-media-title").textContent).toBe(
        "Units and FX"
      );

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 1100));
      });

      await waitFor(() => {
        expect(getByTestId("feature-media-title").textContent).toBe(
          "Sheet memory"
        );
      });
      expect(memoryProgress.getAttribute("data-active")).toBe("true");
      expect(memoryProgress.style.animationDuration).toBe("1000ms");
      expect(unitsProgress.getAttribute("data-active")).toBe("false");

      const searchTab = tabs[2];
      if (!searchTab) {
        throw new Error("Quiet search tab was not rendered");
      }

      await act(async () => {
        fireEvent.click(searchTab);
      });

      expect(searchTab.getAttribute("aria-pressed")).toBe("true");
      expect(searchProgress.getAttribute("data-active")).toBe("true");
      expect(getByTestId("feature-media-title").textContent).toBe(
        "Quiet search"
      );
      expect(getByTestId("feature-media").getAttribute("data-feature")).toBe(
        "quiet-search"
      );
      expect(getByRole("img", { name: "Quiet search preview" })).toBeTruthy();
      expect(getByRole("link", { name: "Download" }).textContent).toBe(
        "Download"
      );
    } finally {
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });

  test("clicking the header download link scrolls to the homepage download section", async () => {
    window.history.replaceState({}, "", "/");
    setNavigatorSnapshot({
      platform: "Win32",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    });

    let scrollTarget: Element | null = null;
    let scrollOptions: ScrollIntoViewOptions | undefined;

    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element, options?: ScrollIntoViewOptions) {
        scrollTarget = this;
        scrollOptions = options;
      },
      writable: true,
    });

    try {
      const { Website } = await import("./Website");
      const { getByRole, getByTestId } = render(<Website />, {
        container: window.document.body,
      });

      const downloadSection = getByTestId("download-section");

      expect(
        getByRole("img", { name: "Rekna app icon" }).getAttribute("src")
      ).toContain("icon_512x512.png");
      expect(
        getByTestId("download-grid").className.includes("lg:items-center")
      ).toBe(true);
      expect(
        getByTestId("download-grid").className.includes(
          "lg:grid-cols-[minmax(0,1fr)_20rem]"
        )
      ).toBe(true);
      expect(
        getByTestId("download-page-icon-shell").className.includes(
          "lg:justify-end"
        )
      ).toBe(true);
      expect(
        getByRole("img", { name: "Rekna app icon" }).className.includes(
          "size-48"
        )
      ).toBe(true);

      await act(async () => {
        fireEvent.click(getByRole("link", { name: "Download" }));
      });

      expect(scrollTarget === downloadSection).toBe(true);
      expect(scrollOptions).toEqual({
        behavior: "smooth",
        block: "start",
      });
      expect(window.location.pathname).toBe("/");
      expect(window.location.hash).toBe("#download");
      expect(getByTestId("download-cta").textContent).toContain("Download for");
      expect(getByTestId("download-cta").getAttribute("href")).toBe(
        `${REKNA_GITHUB_LATEST_DOWNLOAD_BASE_URL}/stable-macos-arm64-Rekna.dmg`
      );
      expect(getByTestId("detected-download-platform").textContent).toContain(
        "Default build selected"
      );
    } finally {
      restoreNavigatorSnapshot();
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });
});

const originalNavigatorState = {
  platform: window.navigator.platform,
  userAgent: window.navigator.userAgent,
};

function setNavigatorSnapshot({
  platform,
  userAgent,
}: {
  platform: string;
  userAgent: string;
}) {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

function restoreNavigatorSnapshot() {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: originalNavigatorState.platform,
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: originalNavigatorState.userAgent,
  });
}
