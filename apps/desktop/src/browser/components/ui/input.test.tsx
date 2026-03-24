import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost",
});

const { window } = dom;

Object.assign(globalThis, {
  document: window.document,
  DocumentFragment: window.DocumentFragment,
  Element: window.Element,
  Event: window.Event,
  getComputedStyle: window.getComputedStyle.bind(window),
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  MutationObserver: window.MutationObserver,
  Node: window.Node,
  navigator: window.navigator,
  window,
});

describe("Input", () => {
  afterEach(() => {
    cleanup();
    window.document.body.innerHTML = "";
  });

  test("removes focus chrome from search inputs", async () => {
    const { Input } = await import("./input");
    const { getByLabelText } = render(
      <Input aria-label="Search sheets" type="search" />,
      {
        container: window.document.body,
      }
    );

    const input = getByLabelText("Search sheets");

    expect(input.className).toContain("appearance-none");
    expect(input.className).not.toContain("focus-visible:border");
    expect(input.className).not.toContain("focus-visible:border-ring");
    expect(input.className).not.toContain("focus-visible:ring");
  });

  test("removes focus chrome from non-search inputs too", async () => {
    const { Input } = await import("./input");
    const { getByLabelText } = render(
      <Input aria-label="Sheet title" type="text" />,
      {
        container: window.document.body,
      }
    );

    const input = getByLabelText("Sheet title");

    expect(input.className).toContain("appearance-none");
    expect(input.className).not.toContain("focus-visible:border");
    expect(input.className).not.toContain("focus-visible:ring");
  });
});
