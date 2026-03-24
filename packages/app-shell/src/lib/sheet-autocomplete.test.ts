import { describe, expect, test } from "bun:test";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";

import {
  collectSheetVariables,
  sheetCompletionSource,
} from "./sheet-autocomplete";

describe("sheet autocomplete", () => {
  test("collects unique variables defined before the cursor", () => {
    const doc = ["alpha = 1", "beta = 2", "alpha = 3", "gamma = beta"].join(
      "\n"
    );
    const cursorPos = doc.indexOf("gamma");

    expect(collectSheetVariables(doc, cursorPos)).toEqual(["alpha", "beta"]);
  });

  test("returns variable and builtin completions for the current token", () => {
    const doc = ["base = 10", "discount = 2", "dis"].join("\n");
    const state = EditorState.create({ doc });
    const context = new CompletionContext(state, doc.length, false);
    const result = sheetCompletionSource(context);

    expect(result?.from).toBe(doc.length - 3);
    expect(result?.options.some((option) => option.label === "discount")).toBe(
      true
    );
    expect(result?.options.some((option) => option.label === "sum")).toBe(true);
    expect(result?.options.some((option) => option.label === "sqrt")).toBe(
      true
    );
    expect(
      result?.options.find((option) => option.label === "discount")?.detail
    ).toBe("Variable");
  });

  test("collects dotted assignment roots and nested properties", () => {
    const doc = [
      "subscriptions.Netflix = 15",
      "subscriptions.spotify = 12",
      "subscriptions.Net",
    ].join("\n");
    const cursorPos =
      doc.lastIndexOf("subscriptions.Net") + "subscriptions.Net".length;

    expect(collectSheetVariables(doc, cursorPos)).toEqual([
      "subscriptions",
      "subscriptions.Netflix",
      "subscriptions.spotify",
    ]);
  });

  test("collects block namespace roots and properties", () => {
    const doc = [
      "subscriptions {",
      "  netflix = 10",
      "  amazon = 15",
      "}",
      "sub",
    ].join("\n");
    const cursorPos = doc.length;

    expect(collectSheetVariables(doc, cursorPos)).toEqual([
      "subscriptions",
      "subscriptions.amazon",
      "subscriptions.netflix",
    ]);
  });

  test("offers nested paths after typing a block namespace prefix", () => {
    const doc = [
      "subscriptions {",
      "  netflix = 10",
      "  amazon = 15",
      "}",
      "subscriptions.",
    ].join("\n");
    const state = EditorState.create({ doc });
    const context = new CompletionContext(state, doc.length, false);
    const result = sheetCompletionSource(context);

    expect(
      result?.options.some((option) => option.label === "subscriptions.netflix")
    ).toBe(true);
    expect(
      result?.options.some((option) => option.label === "subscriptions.amazon")
    ).toBe(true);
    expect(
      result?.options.find((option) => option.label === "subscriptions.netflix")
        ?.detail
    ).toBe("Property");
  });

  test("marks object roots as objects in autocomplete", () => {
    const doc = [
      "subscriptions {",
      "  netflix = 10",
      "  amazon = 15",
      "}",
      "sub",
    ].join("\n");
    const state = EditorState.create({ doc });
    const context = new CompletionContext(state, doc.length, false);
    const result = sheetCompletionSource(context);

    expect(
      result?.options.find((option) => option.label === "subscriptions")?.detail
    ).toBe("Object");
    expect(
      result?.options.find((option) => option.label === "subscriptions")?.type
    ).toBe("class");
    expect(
      typeof result?.options.find((option) => option.label === "subscriptions")
        ?.apply
    ).toBe("function");
  });

  test("includes imported symbols from other sheets in autocomplete", () => {
    const doc = "Import sub";
    const state = EditorState.create({ doc });
    const context = new CompletionContext(state, doc.length, false);
    const result = sheetCompletionSource(context, {
      externalSymbols: [
        {
          kind: "object",
          label: "subscriptions",
        },
        {
          kind: "property",
          label: "subscriptions.total",
        },
      ],
    });

    expect(
      result?.options.find((option) => option.label === "subscriptions")?.detail
    ).toBe("Object");
    expect(
      result?.options.find((option) => option.label === "subscriptions.total")
        ?.detail
    ).toBe("Property");
  });

  test("does not append a dot when completing object imports", () => {
    const doc = "Import sub";
    const state = EditorState.create({ doc });
    const context = new CompletionContext(state, doc.length, false);
    const result = sheetCompletionSource(context, {
      externalSymbols: [
        {
          kind: "object",
          label: "subscriptions",
        },
      ],
    });

    expect(
      result?.options.find((option) => option.label === "subscriptions")?.apply
    ).toBeUndefined();
  });

  test("uses neutral wording in builtin function descriptions", () => {
    const state = EditorState.create({ doc: "" });
    const context = new CompletionContext(state, 0, true);
    const result = sheetCompletionSource(context);
    const logCompletion = result?.options.find(
      (option) => option.label === "log"
    ) as { lineaInfo?: { body?: string } } | undefined;
    const rootCompletion = result?.options.find(
      (option) => option.label === "root"
    ) as { lineaInfo?: { body?: string } } | undefined;

    expect(logCompletion?.lineaInfo?.body).toBe(
      "Supports `log(value)` and base-first syntax like `log 2 (10)`."
    );
    expect(rootCompletion?.lineaInfo?.body).toBe(
      "Supports shorthand root syntax like `root 2 (8)`."
    );
  });

  test("stays closed for non-word typing unless explicitly requested", () => {
    const state = EditorState.create({ doc: "1 +" });
    const implicitContext = new CompletionContext(state, 3, false);
    const explicitContext = new CompletionContext(state, 3, true);

    expect(sheetCompletionSource(implicitContext)).toBeNull();
    expect(
      sheetCompletionSource(explicitContext)?.options.length
    ).toBeGreaterThan(0);
  });

  test("offers workspace tag completions when typing a hashtag", () => {
    const state = EditorState.create({ doc: "#ber" });
    const context = new CompletionContext(state, 4, false);
    const result = sheetCompletionSource(context, {
      workspaceTags: ["berlin", "travel", "work"],
    });

    expect(result?.from).toBe(0);
    expect(result?.options.map((option) => option.label)).toEqual(["#berlin"]);
    expect(result?.options[0]?.detail).toBe("Workspace tag");
    expect(result?.options[0]?.type).toBe("tag");
  });

  test("does not offer workspace tag completions for heading syntax", () => {
    const state = EditorState.create({ doc: "# heading" });
    const context = new CompletionContext(state, 2, false);

    expect(
      sheetCompletionSource(context, {
        workspaceTags: ["heading"],
      })
    ).toBeNull();
  });

  test("does not offer general completions on markdown heading lines", () => {
    const state = EditorState.create({ doc: "# hea" });
    const context = new CompletionContext(state, 5, false);

    expect(sheetCompletionSource(context)).toBeNull();
  });

  test("does not offer completions on comment lines", () => {
    const state = EditorState.create({ doc: "// sum" });
    const context = new CompletionContext(state, 6, false);

    expect(sheetCompletionSource(context)).toBeNull();
  });
});
