import { describe, expect, test } from "bun:test";

import { getSelectionCornerStates } from "./selection-shape";

describe("getSelectionCornerStates", () => {
  test("rounds every exposed corner in a stepped multiline selection", () => {
    const corners = getSelectionCornerStates([
      { top: 0, bottom: 10, left: 100, right: 200 },
      { top: 10, bottom: 20, left: 50, right: 400 },
      { top: 20, bottom: 30, left: 50, right: 400 },
      { top: 30, bottom: 40, left: 50, right: 250 },
    ]);

    expect(corners).toEqual([
      {
        topLeft: true,
        topRight: true,
        bottomLeft: false,
        bottomRight: false,
      },
      {
        topLeft: true,
        topRight: true,
        bottomLeft: false,
        bottomRight: false,
      },
      {
        topLeft: false,
        topRight: false,
        bottomLeft: false,
        bottomRight: true,
      },
      {
        topLeft: false,
        topRight: false,
        bottomLeft: true,
        bottomRight: true,
      },
    ]);
  });
});
