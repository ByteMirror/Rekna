import { buildDesktopReleaseTag } from "../../packages/shared/src/desktop-release";

import { resolveNextDesktopReleaseVersion } from "./desktop-version";

const version = resolveNextDesktopReleaseVersion();

console.log(`version=${version}`);
console.log(`tag=${buildDesktopReleaseTag(version)}`);
