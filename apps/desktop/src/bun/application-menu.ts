import { OPEN_SHEET_SEARCH_MENU_ACTION } from "@linea/shared";
import type { ApplicationMenuItemConfig } from "electrobun/bun";

export function buildApplicationMenu(
  appName: string,
  platform: NodeJS.Platform = process.platform
): ApplicationMenuItemConfig[] {
  const menu: ApplicationMenuItemConfig[] = [];

  if (platform === "darwin") {
    menu.push({
      label: appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit", accelerator: "CommandOrControl+Q" },
      ],
    });
  } else {
    menu.push({
      label: "File",
      submenu: [{ role: "quit", accelerator: "CommandOrControl+Q" }],
    });
  }

  menu.push({
    label: "Edit",
    submenu: [
      { role: "undo", accelerator: "CommandOrControl+Z" },
      { role: "redo", accelerator: "CommandOrControl+Shift+Z" },
      { type: "separator" },
      { role: "cut", accelerator: "CommandOrControl+X" },
      { role: "copy", accelerator: "CommandOrControl+C" },
      { role: "paste", accelerator: "CommandOrControl+V" },
      {
        role: "pasteAndMatchStyle",
        accelerator: "CommandOrControl+Shift+V",
      },
      { role: "delete" },
      { type: "separator" },
      { role: "selectAll", accelerator: "CommandOrControl+A" },
      { type: "separator" },
      {
        action: OPEN_SHEET_SEARCH_MENU_ACTION,
        accelerator: "CommandOrControl+F",
        label: "Find Sheets",
      },
    ],
  });

  menu.push({
    label: "Window",
    submenu:
      platform === "darwin"
        ? [
            { role: "minimize", accelerator: "CommandOrControl+M" },
            { role: "zoom" },
            { role: "close", accelerator: "CommandOrControl+W" },
            { type: "separator" },
            { role: "bringAllToFront" },
          ]
        : [
            { role: "minimize", accelerator: "CommandOrControl+M" },
            { role: "toggleFullScreen", accelerator: "F11" },
          ],
  });

  return menu;
}
