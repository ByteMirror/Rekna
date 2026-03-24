import { describe, expect, test } from "bun:test";
import type { ApplicationMenuItemConfig } from "electrobun/bun";

import { buildApplicationMenu } from "./application-menu";

type RoleMenuItem = Extract<ApplicationMenuItemConfig, { role?: string }>;

function hasMenuRole(item: ApplicationMenuItemConfig): item is RoleMenuItem {
  return "role" in item && typeof item.role === "string";
}

describe("buildApplicationMenu", () => {
  test("includes a native Edit menu with standard text editing roles", () => {
    const menu = buildApplicationMenu("Rekna", "darwin");
    const editMenu = menu.find(
      (item) => "label" in item && item.label === "Edit"
    );

    if (!editMenu || !("submenu" in editMenu) || !editMenu.submenu) {
      throw new Error("Expected an Edit menu with submenu items");
    }

    const editItems = editMenu.submenu.filter(hasMenuRole);
    const editRoles = editItems.map((item) => item.role);
    const acceleratorsByRole = new Map(
      editItems.map((item) => [item.role, item.accelerator ?? null])
    );

    expect(editRoles).toEqual([
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "pasteAndMatchStyle",
      "delete",
      "selectAll",
    ]);
    expect(acceleratorsByRole).toEqual(
      new Map([
        ["undo", "CommandOrControl+Z"],
        ["redo", "CommandOrControl+Shift+Z"],
        ["cut", "CommandOrControl+X"],
        ["copy", "CommandOrControl+C"],
        ["paste", "CommandOrControl+V"],
        ["pasteAndMatchStyle", "CommandOrControl+Shift+V"],
        ["delete", null],
        ["selectAll", "CommandOrControl+A"],
      ])
    );
  });

  test("includes a native sheet search accelerator without a browser find role", () => {
    const menu = buildApplicationMenu("Rekna", "darwin");
    const editMenu = menu.find(
      (item) => "label" in item && item.label === "Edit"
    );

    if (!editMenu || !("submenu" in editMenu) || !editMenu.submenu) {
      throw new Error("Expected an Edit menu with submenu items");
    }

    const findItem = editMenu.submenu.find(
      (item) =>
        "action" in item &&
        item.action === "open-sheet-search" &&
        item.accelerator === "CommandOrControl+F"
    );
    const findRoleItem = editMenu.submenu.find(
      (item) => "role" in item && item.role === "find"
    );

    expect(findItem).toEqual({
      action: "open-sheet-search",
      accelerator: "CommandOrControl+F",
      label: "Find Sheets",
    });
    expect(findRoleItem).toBeUndefined();
  });

  test("includes a native close window accelerator on macOS", () => {
    const menu = buildApplicationMenu("Rekna", "darwin");
    const windowMenu = menu.find(
      (item) => "label" in item && item.label === "Window"
    );

    if (!windowMenu || !("submenu" in windowMenu) || !windowMenu.submenu) {
      throw new Error("Expected a Window menu with submenu items");
    }

    const closeItem = windowMenu.submenu.find(
      (item) =>
        "role" in item &&
        item.role === "close" &&
        item.accelerator === "CommandOrControl+W"
    );

    expect(closeItem).toEqual({
      role: "close",
      accelerator: "CommandOrControl+W",
    });
  });
});
