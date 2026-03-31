import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { JSDOM } from "jsdom";

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
const originalPause = window.HTMLMediaElement.prototype.pause;
const originalPlay = window.HTMLMediaElement.prototype.play;
const originalFetch = globalThis.fetch;
const legacyReleaseAssets = [
  {
    browser_download_url:
      "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/stable-macos-arm64-Rekna.dmg",
    name: "stable-macos-arm64-Rekna.dmg",
  },
];

afterEach(() => {
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
    writable: true,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: originalPause,
    writable: true,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: originalPlay,
    writable: true,
  });
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value() {},
    writable: true,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value() {
      return Promise.resolve();
    },
    writable: true,
  });
});

describe("Website", () => {
  test("shows macOS download as the only option", async () => {
    window.history.replaceState({}, "", "/");
    mockLatestReleaseAssets(legacyReleaseAssets);

    try {
      const { Website } = await import("./Website");
      const { getByTestId } = render(<Website />, {
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
      await waitFor(() => {
        expect(getByTestId("download-cta").getAttribute("href")).toBe(
          "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/stable-macos-arm64-Rekna.dmg"
        );
      });
      expect(getByTestId("detected-download-platform").textContent).toContain(
        "macOS (Apple Silicon)"
      );
    } finally {
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });

  test("upgrades download links to cleaner versioned release asset names when available", async () => {
    window.history.replaceState({}, "", "/");
    mockLatestReleaseAssets([
      {
        browser_download_url:
          "https://github.com/ByteMirror/Rekna/releases/download/v0.1.3/stable-macos-arm64-Rekna.dmg",
        name: "stable-macos-arm64-Rekna.dmg",
      },
      {
        browser_download_url:
          "https://github.com/ByteMirror/Rekna/releases/download/v0.1.3/Rekna-0.1.3-macOS-arm64.dmg",
        name: "Rekna-0.1.3-macOS-arm64.dmg",
      },
    ]);

    try {
      const { Website } = await import("./Website");
      const { getByTestId } = render(<Website />, {
        container: window.document.body,
      });

      await waitFor(() => {
        expect(getByTestId("download-cta").getAttribute("href")).toBe(
          "https://github.com/ByteMirror/Rekna/releases/download/v0.1.3/Rekna-0.1.3-macOS-arm64.dmg"
        );
      });
    } finally {
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });

  test("renders the homepage as a minimal feature carousel with three vertical tabs", async () => {
    window.history.replaceState({}, "", "/");
    mockLatestReleaseAssets(legacyReleaseAssets);

    try {
      const { Website } = await import("./Website");
      const {
        container,
        getAllByText,
        getByRole,
        getByTestId,
        getByText,
        queryByText,
      } =
        render(<Website featureCycleMs={100} />, {
          container: window.document.body,
        });
      const websiteShell = container.firstElementChild as HTMLDivElement;
      const featureColumn = getByTestId("feature-column");
      const featureTabsShell = getByTestId("feature-tabs-shell");
      const headerIcon = getByRole("img", { name: "Rekna desktop app icon" });
      const tabs = [
        getByRole("tab", { name: "Plain Text Calculations" }),
        getByRole("tab", { name: "Units & Currency" }),
        getByRole("tab", { name: "Connected Sheets" }),
      ];
      const plainTextProgress = getByTestId(
        "feature-tab-progress-plain-text-calculations"
      );
      const unitsProgress = getByTestId(
        "feature-tab-progress-units-and-currency"
      );
      const connectedSheetsProgress = getByTestId(
        "feature-tab-progress-connected-sheets"
      );
      const activeFeatureVideo = getByTestId(
        "feature-video-plain-text-calculations"
      ) as HTMLVideoElement;
      const activeFeatureVideoLayer = getByTestId(
        "feature-video-layer-plain-text-calculations"
      );
      const unitsFeatureVideoLayer = getByTestId(
        "feature-video-layer-units-and-currency"
      );
      const unitsFeatureVideo = getByTestId(
        "feature-video-units-and-currency"
      ) as HTMLVideoElement;
      const connectedFeatureVideo = getByTestId(
        "feature-video-connected-sheets"
      ) as HTMLVideoElement;
      const activeFeatureVideoShell = getByTestId("feature-video-shell");

      expect(tabs[0]?.className.includes("rounded-[1rem]")).toBe(true);
      expect(tabs[0]?.className.includes("flex-col")).toBe(true);
      expect(tabs[0]?.className.includes("items-center")).toBe(true);
      expect(tabs[0]?.className.includes("text-center")).toBe(true);
      expect(tabs[0]?.className.includes("bg-[var(--website-ink)]")).toBe(true);
      expect(tabs[0]?.className.includes("text-[var(--website-bg)]")).toBe(
        true
      );
      expect(tabs[0]?.className.includes("gap-3")).toBe(true);
      expect(tabs[0]?.className.includes("pt-4")).toBe(true);
      expect(tabs[0]?.className.includes("pb-3")).toBe(true);
      expect(tabs[0]?.className.includes("p-4")).toBe(false);
      expect(tabs[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(plainTextProgress.getAttribute("data-active")).toBe("true");
      expect(plainTextProgress.style.animationName).toBe(
        "websiteFeatureProgress"
      );
      expect(plainTextProgress.style.animationDuration).toBe("100ms");
      expect(unitsProgress.getAttribute("data-active")).toBe("false");
      expect(connectedSheetsProgress.getAttribute("data-active")).toBe("false");
      expect(getByTestId("feature-media").getAttribute("data-feature")).toBe(
        "plain-text-calculations"
      );
      expect(activeFeatureVideo.autoplay).toBe(true);
      expect(unitsFeatureVideo.autoplay).toBe(false);
      expect(connectedFeatureVideo.autoplay).toBe(false);
      expect(activeFeatureVideo.controls).toBe(false);
      expect(activeFeatureVideo.muted).toBe(true);
      expect(activeFeatureVideo.playsInline).toBe(true);
      expect(activeFeatureVideo.getAttribute("src")).toBe(
        "/videos/rekna-plain-text-calculations.mp4"
      );
      expect(unitsFeatureVideo.getAttribute("src")).toBe(
        "/videos/rekna-units-and-currency.mp4"
      );
      expect(connectedFeatureVideo.getAttribute("src")).toBe(
        "/videos/rekna-connected-sheets.mp4"
      );
      expect(activeFeatureVideo.getAttribute("data-active")).toBe("true");
      expect(unitsFeatureVideo.getAttribute("data-active")).toBe("false");
      expect(connectedFeatureVideo.getAttribute("data-active")).toBe("false");
      expect(activeFeatureVideoLayer.getAttribute("data-active")).toBe("true");
      expect(unitsFeatureVideoLayer.getAttribute("data-active")).toBe("false");
      expect(activeFeatureVideo.className.includes("h-full")).toBe(true);
      expect(activeFeatureVideo.className.includes("w-auto")).toBe(true);
      expect(activeFeatureVideo.className.includes("max-w-full")).toBe(true);
      expect(activeFeatureVideo.className.includes("rounded-[1.35rem]")).toBe(
        true
      );
      expect(
        activeFeatureVideo.className.includes(
          "shadow-[0_30px_80px_-42px_rgba(0,0,0,0.7)]"
        )
      ).toBe(true);
      expect(
        activeFeatureVideoShell.className.includes("aspect-[1076/960]")
      ).toBe(true);
      expect(activeFeatureVideoShell.className.includes("h-[18rem]")).toBe(
        false
      );
      expect(activeFeatureVideoShell.className.includes("h-[22rem]")).toBe(
        true
      );
      expect(activeFeatureVideoShell.className.includes("sm:h-[27rem]")).toBe(
        true
      );
      expect(activeFeatureVideoShell.className.includes("lg:h-[35rem]")).toBe(
        true
      );
      expect(activeFeatureVideoShell.className.includes("border")).toBe(false);
      expect(activeFeatureVideoShell.className.includes("rounded")).toBe(false);
      expect(activeFeatureVideoShell.className.includes("shadow")).toBe(false);
      expect(activeFeatureVideoShell.className.includes("bg-")).toBe(false);
      expect(featureColumn.className.includes("lg:min-h-[36rem]")).toBe(true);
      expect(queryByText("Plain text")).toBeNull();
      expect(
        queryByText(
          "Write calculations in plain text and watch each line resolve instantly beside the editor."
        )
      ).toBeNull();

      expect(document.body.dataset.rootView).toBe("website");
      expect(websiteShell.style.getPropertyValue("--website-accent")).toBe(
        "var(--primary)"
      );
      expect(headerIcon.className.includes("size-12")).toBe(true);
      expect(getByRole("heading", { level: 1, name: "Rekna" })).toBeTruthy();
      expect(
        getByText(
          "A beautiful open-source calculator that lives in markdown files and keeps you in flow."
        )
      ).toBeTruthy();
      expect(queryByText("Plain text. Exact totals.")).toBeNull();
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
      expect(
        getByTestId(
          "feature-tab-title-plain-text-calculations"
        ).className.includes("px-4")
      ).toBe(true);
      expect(
        getByTestId(
          "feature-tab-title-plain-text-calculations"
        ).className.includes("text-[1.35rem]")
      ).toBe(true);
      expect(
        plainTextProgress.parentElement?.className.includes("w-full")
      ).toBe(true);
      expect(
        plainTextProgress.parentElement?.className.includes("h-[3px]")
      ).toBe(true);
      expect(
        plainTextProgress.parentElement?.parentElement?.className.includes(
          "w-full"
        )
      ).toBe(true);
      expect(
        plainTextProgress.parentElement?.parentElement?.className.includes(
          "absolute"
        )
      ).toBe(false);
      expect(
        plainTextProgress.parentElement?.parentElement?.className.includes(
          "bottom-3"
        )
      ).toBe(false);
      expect(
        plainTextProgress.parentElement?.parentElement?.className.includes(
          "w-24"
        )
      ).toBe(false);
      expect(tabs[0]?.textContent?.trim()).toBe("Plain Text Calculations");
      expect(tabs[1]?.textContent?.trim()).toBe("Units & Currency");
      expect(tabs[2]?.textContent?.trim()).toBe("Connected Sheets");

      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      });

      await waitFor(() => {
        expect(getByTestId("feature-media").getAttribute("data-feature")).toBe(
          "units-and-currency"
        );
      });
      expect(
        getByTestId("feature-video-plain-text-calculations").getAttribute(
          "data-active"
        )
      ).toBe("false");
      expect(
        getByTestId("feature-video-layer-plain-text-calculations").getAttribute(
          "data-active"
        )
      ).toBe("false");
      expect(
        getByTestId("feature-video-units-and-currency").getAttribute(
          "data-active"
        )
      ).toBe("true");
      expect(
        getByTestId("feature-video-layer-units-and-currency").getAttribute(
          "data-active"
        )
      ).toBe("true");
      expect(unitsProgress.getAttribute("data-active")).toBe("true");
      expect(unitsProgress.style.animationDuration).toBe("100ms");
      expect(plainTextProgress.getAttribute("data-active")).toBe("false");

      const connectedSheetsTab = tabs[2];
      if (!connectedSheetsTab) {
        throw new Error("Connected Sheets tab was not rendered");
      }

      await act(async () => {
        fireEvent.click(connectedSheetsTab);
      });

      expect(connectedSheetsTab.getAttribute("aria-pressed")).toBe("true");
      expect(connectedSheetsProgress.getAttribute("data-active")).toBe("true");
      expect(
        getByTestId("feature-video-connected-sheets").getAttribute("data-active")
      ).toBe("true");
      expect(
        getByTestId("feature-video-layer-connected-sheets").getAttribute(
          "data-active"
        )
      ).toBe("true");
      expect(getByTestId("feature-media").getAttribute("data-feature")).toBe(
        "connected-sheets"
      );
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

  test("tracks each active carousel progress indicator from its video's playback position", async () => {
    window.history.replaceState({}, "", "/");
    mockLatestReleaseAssets(legacyReleaseAssets);

    try {
      const { Website } = await import("./Website");
      const { getByRole, getByTestId } = render(<Website />, {
        container: window.document.body,
      });
      const plainTextVideo = getByTestId(
        "feature-video-plain-text-calculations"
      ) as HTMLVideoElement;
      const unitsVideo = getByTestId(
        "feature-video-units-and-currency"
      ) as HTMLVideoElement;
      const plainTextProgress = getByTestId(
        "feature-tab-progress-plain-text-calculations"
      );
      const unitsProgress = getByTestId(
        "feature-tab-progress-units-and-currency"
      );

      let plainTextCurrentTime = 0;
      let unitsCurrentTime = 0;

      Object.defineProperty(plainTextVideo, "currentTime", {
        configurable: true,
        get() {
          return plainTextCurrentTime;
        },
        set(value: number) {
          plainTextCurrentTime = value;
        },
      });

      Object.defineProperty(unitsVideo, "currentTime", {
        configurable: true,
        get() {
          return unitsCurrentTime;
        },
        set(value: number) {
          unitsCurrentTime = value;
        },
      });

      expect(plainTextProgress.style.transform).toBe("scaleX(0)");
      expect(unitsProgress.style.transform).toBe("scaleX(0)");

      Object.defineProperty(plainTextVideo, "duration", {
        configurable: true,
        value: 40,
      });
      Object.defineProperty(unitsVideo, "duration", {
        configurable: true,
        value: 64.4,
      });

      await act(async () => {
        fireEvent.loadedMetadata(plainTextVideo);
      });

      plainTextCurrentTime = 10;

      await act(async () => {
        fireEvent.timeUpdate(plainTextVideo);
      });

      expect(plainTextProgress.style.transform).toBe("scaleX(0.25)");

      await act(async () => {
        fireEvent.click(getByRole("tab", { name: "Units & Currency" }));
      });

      unitsCurrentTime = 16.1;

      await act(async () => {
        fireEvent.loadedMetadata(unitsVideo);
        fireEvent.timeUpdate(unitsVideo);
      });

      expect(unitsProgress.style.transform).toBe("scaleX(0.25)");
      expect(
        getByTestId("feature-media").getAttribute("data-feature")
      ).toBe("units-and-currency");
      expect(unitsVideo.getAttribute("src")).toBe(
        "/videos/rekna-units-and-currency.mp4"
      );
    } finally {
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });

  test("advances to the next feature when the active video ends", async () => {
    window.history.replaceState({}, "", "/");
    mockLatestReleaseAssets(legacyReleaseAssets);

    try {
      const { Website } = await import("./Website");
      const { getByTestId } = render(<Website />, {
        container: window.document.body,
      });
      const plainTextVideo = getByTestId(
        "feature-video-plain-text-calculations"
      ) as HTMLVideoElement;

      expect(getByTestId("feature-media").getAttribute("data-feature")).toBe(
        "plain-text-calculations"
      );

      await act(async () => {
        fireEvent.ended(plainTextVideo);
      });

      await waitFor(() => {
        expect(getByTestId("feature-media").getAttribute("data-feature")).toBe(
          "units-and-currency"
        );
      });
    } finally {
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });

  test("clicking the header download link scrolls to the homepage download section", async () => {
    window.history.replaceState({}, "", "/");
    mockLatestReleaseAssets(legacyReleaseAssets);

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
      expect(getByTestId("download-cta").textContent).toContain(
        "Download for macOS (Apple Silicon)"
      );
      await waitFor(() => {
        expect(getByTestId("download-cta").getAttribute("href")).toBe(
          "https://github.com/ByteMirror/Rekna/releases/download/v0.1.2/stable-macos-arm64-Rekna.dmg"
        );
      });
      expect(getByTestId("detected-download-platform").textContent).toContain(
        "macOS (Apple Silicon)"
      );
    } finally {
      cleanup();
      delete document.body.dataset.rootView;
      window.document.body.innerHTML = "";
      window.history.replaceState({}, "", "/");
    }
  });
});

function mockLatestReleaseAssets(
  assets: Array<{ browser_download_url: string; name: string }>
) {
  globalThis.fetch = (async () => ({
    json: async () => ({ assets }),
    ok: true,
  })) as unknown as typeof fetch;
}
