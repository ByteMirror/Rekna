import type { ElectrobunConfig } from "electrobun";

import {
  resolveDesktopReleaseBaseUrl,
  resolveDesktopReleaseVersion,
} from "../../scripts/release/desktop-version";

export default {
  app: {
    name: "Rekna",
    identifier: "dev.fabianurbanek.linea",
    version: resolveDesktopReleaseVersion(),
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
      icons: "icon.iconset",
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
  release: {
    baseUrl: resolveDesktopReleaseBaseUrl(),
  },
} satisfies ElectrobunConfig;
