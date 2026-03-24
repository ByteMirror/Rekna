import type { ElectrobunConfig } from "electrobun";

import {
  resolveDesktopReleaseBaseUrl,
  resolveDesktopReleaseVersion,
} from "./scripts/release/desktop-version";

export default {
  app: {
    name: "Rekna",
    identifier: "dev.fabianurbanek.linea",
    version: resolveDesktopReleaseVersion(),
  },
  build: {
    bun: {
      entrypoint: "apps/desktop/src/bun/index.ts",
    },
    copy: {
      "apps/desktop/dist/index.html": "views/mainview/index.html",
      "apps/desktop/dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["apps/desktop/dist/**"],
    mac: {
      bundleCEF: false,
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
